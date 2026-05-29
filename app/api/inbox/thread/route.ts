import { NextResponse } from "next/server";
import { retentionCutoffMs } from "@/lib/settings-runtime";
import {
  allMessagesForCustomer,
  getCustomerById,
  getSettings,
  messageAttentionResolvedAt,
  messageMedia,
  messageNeedsAttention,
  parseFlags,
} from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  if (!customerId) {
    return new NextResponse("missing customerId", { status: 400 });
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  const settings = await getSettings();
  const messages = await allMessagesForCustomer(customerId, {
    sinceMs: retentionCutoffMs(settings.privacy.conversation_months),
  });

  return NextResponse.json({
    customer: {
      id: customer.id,
      lineUserId: customer.line_user_id,
      displayName: customer.display_name,
      phone: customer.phone,
      aiPaused: customer.ai_paused,
      createdAt: customer.created_at,
      flags: parseFlags(customer.flags),
    },
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      sentBy: m.sent_by,
      text: m.text,
      createdAt: m.created_at,
      needsAttention: messageNeedsAttention(m),
      attentionResolvedAt: messageAttentionResolvedAt(m),
      media: messageMedia(m),
    })),
  });
}
