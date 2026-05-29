import { after, NextResponse } from "next/server";
import {
  verifyLineSignature,
  getMessageContent,
  getProfile,
  replyText,
  APOLOGY_THAI,
} from "@/lib/line";
import { savePublicMedia, type ChatMedia } from "@/lib/media";
import {
  getCustomerByLineId,
  getSettings,
  insertMessage,
  updateSettings,
  upsertCustomer,
} from "@/lib/repo";
import { gateOutboundMessage, recordOutboundMessage } from "@/lib/outbound";
import { runChatPipeline } from "@/lib/pipeline";
import { lineDestinationMatches } from "@/lib/settings-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineEvent =
  | {
      type: "message";
      replyToken: string;
      source: { type: "user"; userId: string };
      message:
        | { type: "text"; id: string; text: string }
        | { type: "image" | "video" | "audio" | "file" | "location" | "sticker"; id: string };
    }
  | { type: "follow" | "unfollow" | "join" | "leave" | "postback" | string; [k: string]: unknown };

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(raw, signature)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: { events?: LineEvent[]; destination?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  let settings = await getSettings();
  // LINE sends the bot user id as `destination`. Rejecting on mismatch blocked
  // all real traffic when Settings still had the seeded demo channel id.
  if (
    body.destination?.trim() &&
    !lineDestinationMatches(body.destination, settings.line.channel_id)
  ) {
    console.warn(
      "[line/webhook] channel_id mismatch — syncing from LINE destination",
      { stored: settings.line.channel_id, destination: body.destination }
    );
    settings = await updateSettings("line", {
      channel_id: body.destination.trim(),
    });
  }

  const events = body.events ?? [];

  // Ack within 1s, but register the work with Next so serverless runtimes keep
  // the invocation alive long enough to persist the inbound message and reply.
  for (const ev of events) {
    after(async () => {
      try {
        await handleEvent(ev);
      } catch (err) {
        console.error("[line/webhook] event handler failed", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(ev: LineEvent): Promise<void> {
  if (ev.type !== "message") return;
  const userEvent = ev as Extract<LineEvent, { type: "message" }>;
  if (userEvent.source.type !== "user") return;

  const userId = userEvent.source.userId;
  const replyToken = userEvent.replyToken;

  // Ensure we know this customer; fetch profile if first time.
  let customer = await getCustomerByLineId(userId);
  if (!customer) {
    const profile = await getProfile(userId);
    customer = await upsertCustomer(userId, profile?.displayName ?? null);
  }

  // Non-text messages: log media previews for staff, send a static Thai apology, stop.
  if (userEvent.message.type !== "text") {
    let media: ChatMedia | undefined;
    if (
      userEvent.message.type === "image" ||
      userEvent.message.type === "video"
    ) {
      try {
        const content = await getMessageContent(userEvent.message.id);
        media = await savePublicMedia({
          bytes: content.data,
          mimeType: content.contentType,
          kind: userEvent.message.type,
          folder: "line",
        });
      } catch (err) {
        console.error("[line/webhook] failed to save message content", err);
      }
    }

    await insertMessage({
      customerId: customer.id,
      direction: "in",
      text: `[${userEvent.message.type}]`,
      sentBy: "customer",
      channelMeta: {
        messageId: userEvent.message.id,
        kind: userEvent.message.type,
        media,
      },
    });
    const outboundGate = await gateOutboundMessage();
    const apologyText = outboundGate.allowed
      ? APOLOGY_THAI
      : outboundGate.replyText;
    try {
      await replyText(replyToken, apologyText);
      await insertMessage({
        customerId: customer.id,
        direction: "out",
        text: apologyText,
        sentBy: "ai",
        channelMeta: outboundGate.allowed
          ? undefined
          : { reason: "billing_quota" },
      });
      if (outboundGate.allowed) {
        await recordOutboundMessage();
      }
    } catch (err) {
      console.error("[line/webhook] apology reply failed", err);
    }
    return;
  }

  // Text message: log inbound first, then either run pipeline or skip if paused.
  const text = userEvent.message.text;
  await insertMessage({
    customerId: customer.id,
    direction: "in",
    text,
    sentBy: "customer",
    channelMeta: { messageId: userEvent.message.id },
  });
  console.info("[line/webhook] inbound text saved", {
    customerId: customer.id,
    lineUserId: userId,
    preview: text.slice(0, 80),
  });

  if (customer.ai_paused) {
    // Staff handles manually from the Inbox UI. No automated reply.
    return;
  }

  try {
    await runChatPipeline({
      customerId: customer.id,
      inboundText: text,
      replyToken,
    });
  } catch (err) {
    console.error("[line/webhook] pipeline failed", err);
  }
}

// LINE verifies the webhook URL by GETting it during setup.
export async function GET() {
  return NextResponse.json({ ok: true });
}
