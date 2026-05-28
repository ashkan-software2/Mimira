import { NextResponse } from "next/server";
import { getCustomerById, insertMessage, setAiPaused } from "@/lib/repo";
import { pushImage, pushText } from "@/lib/line";
import { type ChatMedia } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    customerId?: string;
    text?: string;
    media?: ChatMedia;
    mediaPublicUrl?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const customerId = body.customerId?.trim();
  const text = body.text?.trim() ?? "";
  const media = body.media;
  const mediaPublicUrl = body.mediaPublicUrl?.trim() ?? "";
  if (!customerId || (!text && !media)) {
    return new NextResponse("missing customerId or message", { status: 400 });
  }
  if (media && media.kind !== "image") {
    return new NextResponse("only image replies are supported", { status: 400 });
  }
  if (media && !mediaPublicUrl) {
    return new NextResponse(
      "PUBLIC_APP_URL or NEXT_PUBLIC_APP_URL is required to send images through LINE",
      { status: 400 }
    );
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  // Staff reply implies a takeover — pause AI if not already.
  if (!customer.ai_paused) {
    await setAiPaused(customer.id, true);
  }

  try {
    if (text) {
      await pushText(customer.line_user_id, text);
    }
    if (media) {
      await pushImage(customer.line_user_id, mediaPublicUrl, mediaPublicUrl);
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const messages = [];
  if (text) {
    messages.push(
      await insertMessage({
        customerId: customer.id,
        direction: "out",
        text,
        sentBy: "staff",
      })
    );
  }
  if (media) {
    messages.push(
      await insertMessage({
        customerId: customer.id,
        direction: "out",
        text: "[image]",
        sentBy: "staff",
        channelMeta: { media },
      })
    );
  }

  return NextResponse.json({
    ok: true,
    messages: messages.map((msg) => ({
      id: msg.id,
      direction: msg.direction,
      sentBy: msg.sent_by,
      text: msg.text,
      createdAt: msg.created_at,
    })),
  });
}
