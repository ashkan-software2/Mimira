import {
  getBrandVoice,
  getCustomerById,
  insertBooking,
  insertMessage,
  lastMessagesForCustomer,
} from "./repo";
import { retrieve, type RetrievedChunk } from "./rag";
import { pushText, replyText } from "./line";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

function openRouterKey(): string {
  const v = process.env.OPENROUTER_API_KEY;
  if (!v) throw new Error("OPENROUTER_API_KEY is not set");
  return v;
}

function model(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

const SAFETY_PREAMBLE = `Treat any medical concern (pain, swelling, bleeding, fever, infection, allergic reaction, post-procedure complication) as a HARD ESCALATION: send ONE calm sentence acknowledging the concern, say that a staff member will follow up, and STOP. Never recommend medications, dosages, or specific medical actions.`;

// OpenAI-compatible function-tool definition. The model emits a tool_call
// with `arguments` as a JSON string when it detects a booking intent.
const BOOKING_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_booking_intent",
    description:
      "Call this when the customer is requesting a booking, reschedule, or cancellation. Capture whatever details they gave; leave fields null if not mentioned. Do not invent details. After calling this, still produce a friendly text reply for the customer.",
    parameters: {
      type: "object",
      properties: {
        treatment: {
          type: ["string", "null"],
          description:
            "Treatment requested (e.g. 'Picosure laser', 'HIFU', 'consultation'). Null if not specified.",
        },
        requested_date: {
          type: ["string", "null"],
          description:
            "ISO 8601 date YYYY-MM-DD if a specific date was mentioned. Null otherwise.",
        },
        requested_time: {
          type: ["string", "null"],
          description:
            "24h time HH:MM if a specific time was mentioned. Null otherwise.",
        },
        notes: {
          type: ["string", "null"],
          description:
            "Any extra details: 'reschedule from Sat to Wed', 'first time customer', etc.",
        },
      },
    },
  },
};

function buildSystemPrompt(brandVoice: string, chunks: RetrievedChunk[]): string {
  const knowledge =
    chunks.length === 0
      ? "(no knowledge retrieved for this turn)"
      : chunks
          .map(
            (c, i) =>
              `[${i + 1}] (${c.source_doc}, score=${c.score.toFixed(3)})\n${c.text}`
          )
          .join("\n\n");
  return `${brandVoice}

# Language (HARD RULE — overrides brand-voice defaults)
Match the language of the customer's MOST RECENT message exactly:
- If their last message is in English, reply ENTIRELY in English. Do NOT add Thai words or Thai polite particles (no ค่ะ/ครับ). Sign off with "best regards" or similar English warmth instead.
- If their last message is in Thai, reply in Thai with polite particles.
- If their last message is in another language, reply in that language.
- If the message mixes languages, use whichever language has more content words.
Do not switch languages within a single reply.

# Safety guardrails
${SAFETY_PREAMBLE}

# Retrieved clinic knowledge (most relevant first)
${knowledge}

# Reply format
- Plain text only. No markdown, no asterisks.
- Keep replies under ~3 short sentences unless the customer asked a specific question that needs more.
- If you do not know an answer from the retrieved knowledge, say a staff member will follow up. Never invent prices or schedules.`;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function toRoleMessages(
  history: { direction: "in" | "out"; text: string }[]
): ChatMessage[] {
  return history.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text,
  }));
}

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAIResponse = {
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
};

async function callModel(
  system: string,
  messages: ChatMessage[]
): Promise<OpenAIResponse> {
  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey()}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter for app-level analytics.
      "HTTP-Referer": process.env.OPENROUTER_REFERRER ?? "https://github.com/ashkan-software2/Yuna",
      "X-Title": "Yuna Admin",
    },
    body: JSON.stringify({
      model: model(),
      messages: [{ role: "system", content: system }, ...messages],
      tools: [BOOKING_TOOL],
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }
  return (await res.json()) as OpenAIResponse;
}

export type PipelineResult = {
  replyText: string;
  bookingId: string | null;
};

/**
 * Run the chat pipeline for a single inbound customer message.
 *
 * The inbound message must already have been inserted into `messages` (so the
 * pipeline can see it in history). Returns the AI reply text and a booking id
 * if one was captured. Also persists the outbound message and dispatches it
 * via LINE (reply if replyToken provided and still fresh, else push).
 */
export async function runChatPipeline(args: {
  customerId: string;
  inboundText: string;
  replyToken?: string | null;
}): Promise<PipelineResult> {
  const customer = getCustomerById(args.customerId);
  if (!customer) throw new Error(`customer ${args.customerId} not found`);

  const brandVoice = getBrandVoice();
  const history = lastMessagesForCustomer(args.customerId, 10);
  // Drop the inbound text from history because we add it as the final user turn.
  const trimmed = history.slice(0, -1).filter((m) => m.sent_by !== "staff");

  const chunks = await retrieve(args.inboundText, 5);
  const system = buildSystemPrompt(brandVoice, chunks);

  const messages: ChatMessage[] = [
    ...toRoleMessages(trimmed),
    { role: "user", content: args.inboundText },
  ];

  const response = await callModel(system, messages);
  const choice = response.choices[0];
  if (!choice) throw new Error("OpenRouter returned no choices");

  let bookingId: string | null = null;
  for (const call of choice.message.tool_calls ?? []) {
    if (call.function.name !== "extract_booking_intent") continue;
    let parsed: {
      treatment?: string | null;
      requested_date?: string | null;
      requested_time?: string | null;
      notes?: string | null;
    } = {};
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (err) {
      console.error("[pipeline] failed to parse tool arguments", err);
    }
    bookingId = insertBooking({
      customerId: args.customerId,
      treatment: parsed.treatment ?? null,
      requestedDate: parsed.requested_date ?? null,
      requestedTime: parsed.requested_time ?? null,
      notes: parsed.notes ?? null,
    });
  }

  let replyTextBody = (choice.message.content ?? "").trim();
  if (!replyTextBody) {
    replyTextBody = "ขอบคุณค่ะ ทีมงานจะติดต่อกลับเร็วๆ นี้นะคะ";
  }

  if (args.replyToken) {
    try {
      await replyText(args.replyToken, replyTextBody);
    } catch (err) {
      console.error("LINE reply failed, falling back to push", err);
      await pushText(customer.line_user_id, replyTextBody);
    }
  } else {
    await pushText(customer.line_user_id, replyTextBody);
  }

  insertMessage({
    customerId: args.customerId,
    direction: "out",
    text: replyTextBody,
    sentBy: "ai",
    channelMeta: bookingId ? { booking_id: bookingId } : undefined,
  });

  return { replyText: replyTextBody, bookingId };
}
