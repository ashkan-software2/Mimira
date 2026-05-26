import { listConversations } from "@/lib/repo";
import { InboxView } from "./InboxView";
import type { ConversationListItem } from "./types";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const conversations: ConversationListItem[] = listConversations().map((c) => ({
    id: c.customer.id,
    lineUserId: c.customer.line_user_id,
    displayName: c.customer.display_name,
    aiPaused: c.customer.ai_paused === 1,
    lastMessageAt: c.last_message_at,
    preview: c.last_message?.text ?? "",
    lastMessageDirection: c.last_message?.direction ?? null,
  }));

  return <InboxView initialConversations={conversations} />;
}
