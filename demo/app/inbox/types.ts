export type ConversationListItem = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  aiPaused: boolean;
  lastMessageAt: number;
  preview: string;
  lastMessageDirection: "in" | "out" | null;
};

export type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  sentBy: "customer" | "ai" | "staff";
  text: string;
  createdAt: number;
};

export type ThreadResponse = {
  customer: {
    id: string;
    lineUserId: string;
    displayName: string | null;
    phone: string | null;
    aiPaused: boolean;
    createdAt: number;
  };
  messages: ThreadMessage[];
};
