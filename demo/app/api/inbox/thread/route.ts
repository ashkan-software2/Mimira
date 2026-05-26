import { NextResponse } from "next/server";
import { allMessagesForCustomer, getCustomerById } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  if (!customerId) {
    return new NextResponse("missing customerId", { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  const messages = allMessagesForCustomer(customerId);

  return NextResponse.json({
    customer: {
      id: customer.id,
      lineUserId: customer.line_user_id,
      displayName: customer.display_name,
      phone: customer.phone,
      aiPaused: customer.ai_paused === 1,
      createdAt: customer.created_at,
    },
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      sentBy: m.sent_by,
      text: m.text,
      createdAt: m.created_at,
    })),
  });
}
