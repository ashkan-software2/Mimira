import {
  customerIdsNeedingAttention,
  listConversations,
  parseFlags,
} from "@/lib/repo";
import { InboxView } from "./InboxView";
import type { ConversationListItem } from "./types";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [attentionSet, conversationRows] = await Promise.all([
    customerIdsNeedingAttention(),
    listConversations(),
  ]);
  const conversations: ConversationListItem[] = conversationRows.map((c) => ({
    id: c.customer.id,
    lineUserId: c.customer.line_user_id,
    displayName: c.customer.display_name,
    aiPaused: c.customer.ai_paused,
    lastMessageAt: c.last_message_at,
    preview: c.last_message?.text ?? "",
    lastMessageDirection: c.last_message?.direction ?? null,
    needsAttention: attentionSet.has(c.customer.id),
    flags: parseFlags(c.customer.flags),
  }));

  return <InboxView initialConversations={conversations} />;
}
