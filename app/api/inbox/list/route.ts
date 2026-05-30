import { NextResponse } from "next/server";
import { requireApiMember } from "@/lib/auth";
import {
  customerIdsNeedingAttention,
  listConversations,
  messageMedia,
  parseFlags,
} from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiMember();
  if (auth instanceof NextResponse) return auth;

  const [conversations, attentionSet] = await Promise.all([
    listConversations(),
    customerIdsNeedingAttention(),
  ]);
  return NextResponse.json({
    conversations: conversations.map((c) => {
      const media = messageMedia(c.last_message);
      return {
        id: c.customer.id,
        lineUserId: c.customer.line_user_id,
        displayName: c.customer.display_name,
        aiPaused: c.customer.ai_paused,
        lastMessageAt: c.last_message_at,
        preview: media ? `[${media.kind}]` : c.last_message?.text ?? "",
        lastMessageDirection: c.last_message?.direction ?? null,
        needsAttention: attentionSet.has(c.customer.id),
        flags: parseFlags(c.customer.flags),
      };
    }),
  });
}
