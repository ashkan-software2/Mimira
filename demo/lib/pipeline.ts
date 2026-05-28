import {
  addFlagToCustomer,
  getBrandVoice,
  getCustomerById,
  getSettings,
  insertBooking,
  insertMessage,
  lastMessagesForCustomer,
} from "./repo";
import { retrieve, type RetrievedChunk } from "./rag";
import { pushText, replyText } from "./line";

const PAUSED_REPLY_TH =
  "ขอบคุณที่ทักมานะคะ ขณะนี้ Yuna ถูกพักไว้ชั่วคราว ทีมงานจะตอบกลับเร็วๆ นี้ค่ะ 🙏";

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

const SAFETY_PREAMBLE = `When the CUSTOMER reports a medical concern about themselves (pain, swelling, bleeding, fever, infection, allergic reaction, post-procedure complication) — i.e. they are describing their own symptoms — treat it as a HARD ESCALATION: send ONE calm sentence acknowledging the concern, say a staff member will follow up, and STOP. Never recommend medications, dosages, or specific medical actions.

This rule does NOT apply when:
- the customer is asking what a treatment is, how it works, what it treats, or what conditions it addresses,
- a retrieved knowledge entry mentions medical terms (pain, swelling, etc.) as part of describing a treatment or aftercare,
- the customer is asking a general question about clinic services.
In those cases, answer normally using the retrieved knowledge.`;

// Phrases the AI uses when handing a thread off to staff — pricing it doesn't
// know, medical escalations, booking confirmations, "we'll get back to you" —
// any of these are a signal the inbox should flag for human follow-up.
const HANDOFF_PATTERNS: RegExp[] = [
  /\b(?:a\s+)?(?:staff|team)\s+member\s+will\s+(?:follow\s*up|be\s+in\s+(?:touch|contact)|reach\s+out|contact|confirm|get\s+back)/i,
  /\b(?:our\s+)?(?:staff|team)\s+will\s+(?:follow\s*up|be\s+in\s+(?:touch|contact)|reach\s+out|contact|confirm|get\s+back)/i,
  /\bwe(?:'ll|\s+will)\s+(?:follow\s*up|be\s+in\s+(?:touch|contact)|reach\s+out|get\s+back\s+to\s+you|confirm)/i,
  /ทีมงาน(?:จะ)?(?:ติดต่อ|ตอบ|ยืนยัน|แจ้ง|ดูแล)/,
  /พนักงาน(?:จะ)?(?:ติดต่อ|ตอบ|ยืนยัน|แจ้ง)/,
];

function detectHandoff(text: string): boolean {
  return HANDOFF_PATTERNS.some((re) => re.test(text));
}

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
  // Brand voice owns persona, tone, language, and reply format — edit it in
  // Settings → Brand voice. Only safety guardrails, the retrieval-grounding
  // rule, and per-turn retrieved knowledge are injected by the system.
  return `${brandVoice}

# Safety guardrails (non-negotiable)
${SAFETY_PREAMBLE}

# Using retrieved clinic knowledge (non-negotiable)
The "Retrieved clinic knowledge" section below contains entries the staff added
about this clinic's actual services. If any entry is even loosely related to the
customer's question, ANSWER using that entry — quote or paraphrase the facts it
contains. Do NOT fall back to "a staff member will follow up" just because an
entry is short or terse; short entries are still authoritative. Only say you
don't know when NONE of the entries cover the topic at all.

# Retrieved clinic knowledge (most relevant first)
${knowledge}`;
}

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function toRoleMessages(
  history: { direction: "in" | "out"; text: string }[]
): ChatMessage[] {
  return history.map((m) =>
    m.direction === "in"
      ? { role: "user", content: m.text }
      : { role: "assistant", content: m.text }
  );
}

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
  messages: ChatMessage[],
  temperature: number,
  options: { withTools: boolean } = { withTools: true }
): Promise<OpenAIResponse> {
  const body: Record<string, unknown> = {
    model: model(),
    messages: [{ role: "system", content: system }, ...messages],
    max_tokens: 800,
    temperature,
  };
  if (options.withTools) body.tools = [BOOKING_TOOL];

  const res = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey()}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter for app-level analytics.
      "HTTP-Referer": process.env.OPENROUTER_REFERRER ?? "https://github.com/ashkan-software2/Yuna",
      "X-Title": "Yuna Admin",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errBody}`);
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
  const customer = await getCustomerById(args.customerId);
  if (!customer) throw new Error(`customer ${args.customerId} not found`);

  // Clinic-wide kill switch — Yuna stays silent until staff turns her back on.
  const settings = await getSettings();
  if (settings.kill_switch.paused) {
    if (args.replyToken) {
      try {
        await replyText(args.replyToken, PAUSED_REPLY_TH);
      } catch (err) {
        console.error("LINE reply failed during paused state", err);
      }
    }
    await insertMessage({
      customerId: args.customerId,
      direction: "out",
      text: PAUSED_REPLY_TH,
      sentBy: "staff",
      channelMeta: { reason: "kill_switch" },
    });
    return { replyText: PAUSED_REPLY_TH, bookingId: null };
  }

  const brandVoice = await getBrandVoice();
  const history = await lastMessagesForCustomer(args.customerId, 10);
  // Drop the inbound text from history because we add it as the final user turn.
  const trimmed = history.slice(0, -1).filter((m) => m.sent_by !== "staff");

  const chunks = await retrieve(args.inboundText, 5);
  const system = buildSystemPrompt(brandVoice, chunks);

  const messages: ChatMessage[] = [
    ...toRoleMessages(trimmed),
    { role: "user", content: args.inboundText },
  ];

  const response = await callModel(system, messages, settings.ai.temperature);
  const choice = response.choices[0];
  if (!choice) throw new Error("OpenRouter returned no choices");

  let bookingId: string | null = null;
  const toolCalls = choice.message.tool_calls ?? [];
  const toolResults: { id: string; content: string }[] = [];
  for (const call of toolCalls) {
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
    bookingId = await insertBooking({
      customerId: args.customerId,
      treatment: parsed.treatment ?? null,
      requestedDate: parsed.requested_date ?? null,
      requestedTime: parsed.requested_time ?? null,
      notes: parsed.notes ?? null,
    });
    toolResults.push({
      id: call.id,
      content: JSON.stringify({ status: "captured", booking_id: bookingId }),
    });
  }

  let replyTextBody = (choice.message.content ?? "").trim();

  // If the model emitted tool calls, many providers (e.g. Gemini) return empty
  // content alongside the call. Run a follow-up turn — with the tool result
  // attached and tools disabled — to get the actual customer-facing reply
  // instead of falling back to a canned line for every tool-triggered turn.
  if (toolCalls.length > 0 && !replyTextBody) {
    const followUp = await callModel(
      system,
      [
        ...messages,
        { role: "assistant", content: null, tool_calls: toolCalls },
        ...toolResults.map((r) => ({
          role: "tool" as const,
          tool_call_id: r.id,
          content: r.content,
        })),
      ],
      settings.ai.temperature,
      { withTools: false }
    );
    replyTextBody = (followUp.choices[0]?.message.content ?? "").trim();
  }

  if (!replyTextBody) {
    // Last-resort fallback only — the model genuinely returned nothing usable.
    replyTextBody =
      "Thanks for your message — a team member will follow up with you shortly.";
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

  const meta: Record<string, unknown> = {};
  if (bookingId) meta.booking_id = bookingId;
  const handoff = detectHandoff(replyTextBody);
  if (handoff) {
    meta.needs_attention = true;
    await addFlagToCustomer(args.customerId, "Needs review");
  }

  await insertMessage({
    customerId: args.customerId,
    direction: "out",
    text: replyTextBody,
    sentBy: "ai",
    channelMeta: Object.keys(meta).length > 0 ? meta : undefined,
  });

  return { replyText: replyTextBody, bookingId };
}
