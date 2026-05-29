export type ConversationListItem = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  aiPaused: boolean;
  lastMessageAt: number;
  preview: string;
  lastMessageDirection: "in" | "out" | null;
  needsAttention: boolean;
  flags: string[];
};

export type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  sentBy: "customer" | "ai" | "staff";
  text: string;
  createdAt: number;
  needsAttention: boolean;
  attentionResolvedAt: number | null;
  media: {
    kind: "image" | "video";
    url: string;
    mimeType: string;
    fileName?: string;
  } | null;
};

export type ThreadResponse = {
  customer: {
    id: string;
    lineUserId: string;
    displayName: string | null;
    phone: string | null;
    aiPaused: boolean;
    createdAt: number;
    flags: string[];
  };
  messages: ThreadMessage[];
};

// Mirrored from server-side PRESET_FLAGS in lib/repo.ts. The Actions menu
// in InboxView renders these in order.
export const PRESET_FLAGS = [
  "Needs review",
  "Doctor advice",
  "Appointment",
  "Addressed",
] as const;
export type PresetFlag = (typeof PRESET_FLAGS)[number];
