import { NextResponse } from "next/server";
import { getCustomerById, insertMessage, setAiPaused } from "@/lib/repo";
import { pushText } from "@/lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { customerId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const customerId = body.customerId?.trim();
  const text = body.text?.trim();
  if (!customerId || !text) {
    return new NextResponse("missing customerId or text", { status: 400 });
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
    await pushText(customer.line_user_id, text);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const msg = await insertMessage({
    customerId: customer.id,
    direction: "out",
    text,
    sentBy: "staff",
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      direction: msg.direction,
      sentBy: msg.sent_by,
      text: msg.text,
      createdAt: msg.created_at,
    },
  });
}
