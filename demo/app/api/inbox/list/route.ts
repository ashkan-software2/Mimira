import { NextResponse } from "next/server";
import {
  customerIdsNeedingAttention,
  listConversations,
  parseFlags,
} from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [conversations, attentionSet] = await Promise.all([
    listConversations(),
    customerIdsNeedingAttention(),
  ]);
  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.customer.id,
      lineUserId: c.customer.line_user_id,
      displayName: c.customer.display_name,
      aiPaused: c.customer.ai_paused,
      lastMessageAt: c.last_message_at,
      preview: c.last_message?.text ?? "",
      lastMessageDirection: c.last_message?.direction ?? null,
      needsAttention: attentionSet.has(c.customer.id),
      flags: parseFlags(c.customer.flags),
    })),
  });
}
