import Anthropic from "@anthropic-ai/sdk";
import {
  getBrandVoice,
  getCustomerById,
  insertBooking,
  insertMessage,
  lastMessagesForCustomer,
} from "./repo";
import { retrieve, type RetrievedChunk } from "./rag";
import { pushText, replyText } from "./line";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const SAFETY_PREAMBLE = `Treat any medical concern (pain, swelling, bleeding, fever, infection, allergic reaction, post-procedure complication) as a HARD ESCALATION: send ONE calm sentence acknowledging the concern, say that a staff member will follow up, and STOP. Never recommend medications, dosages, or specific medical actions.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

const BOOKING_TOOL = {
  name: "extract_booking_intent",
  description:
    "Call this when the customer is requesting a booking, reschedule, or cancellation. Capture whatever details they gave; leave fields null if not mentioned. Do not invent details.",
  input_schema: {
    type: "object" as const,
    properties: {
      treatment: {
        type: "string",
        description: "Treatment requested (e.g. 'Picosure laser', 'HIFU', 'consultation'). Null if not specified.",
      },
      requested_date: {
        type: "string",
        description: "ISO 8601 date YYYY-MM-DD if a specific date was mentioned. Null otherwise.",
      },
      requested_time: {
        type: "string",
        description: "24h time HH:MM if a specific time was mentioned. Null otherwise.",
      },
      notes: {
        type: "string",
        description: "Any extra details: 'reschedule from Sat to Wed', 'first time customer', etc.",
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

# Safety guardrails
${SAFETY_PREAMBLE}

# Retrieved clinic knowledge (most relevant first)
${knowledge}

# Reply format
- Plain text only. No markdown, no asterisks.
- Keep replies under ~3 short sentences unless the customer asked a specific question that needs more.
- If you do not know an answer from the retrieved knowledge, say a staff member will follow up. Never invent prices or schedules.`;
}

type RoleMessage = {
  role: "user" | "assistant";
  content: string;
};

function toRoleMessages(
  history: { direction: "in" | "out"; text: string }[]
): RoleMessage[] {
  return history.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text,
  }));
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

  const messages: RoleMessage[] = [
    ...toRoleMessages(trimmed),
    { role: "user", content: args.inboundText },
  ];

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 800,
    system,
    messages,
    tools: [BOOKING_TOOL],
  });

  let bookingId: string | null = null;
  let replyTextBody = "";
  for (const block of response.content) {
    if (block.type === "text") {
      replyTextBody += block.text;
    } else if (block.type === "tool_use" && block.name === "extract_booking_intent") {
      const input = block.input as {
        treatment?: string | null;
        requested_date?: string | null;
        requested_time?: string | null;
        notes?: string | null;
      };
      bookingId = insertBooking({
        customerId: args.customerId,
        treatment: input.treatment ?? null,
        requestedDate: input.requested_date ?? null,
        requestedTime: input.requested_time ?? null,
        notes: input.notes ?? null,
      });
    }
  }

  replyTextBody = replyTextBody.trim();
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
