import { getDb, now, uuid } from "./db";

export type Customer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  ai_paused: number;
  created_at: number;
};

export type Message = {
  id: string;
  customer_id: string;
  direction: "in" | "out";
  text: string;
  sent_by: "customer" | "ai" | "staff";
  channel_meta: string | null;
  created_at: number;
};

export type ConversationSummary = {
  customer: Customer;
  last_message: Message | null;
  last_message_at: number;
};

export function upsertCustomer(
  lineUserId: string,
  displayName: string | null
): Customer {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM customers WHERE line_user_id = ?")
    .get(lineUserId) as Customer | undefined;

  if (existing) {
    if (displayName && displayName !== existing.display_name) {
      db.prepare("UPDATE customers SET display_name = ? WHERE id = ?").run(
        displayName,
        existing.id
      );
      return { ...existing, display_name: displayName };
    }
    return existing;
  }

  const id = uuid();
  db.prepare(
    "INSERT INTO customers (id, line_user_id, display_name, ai_paused, created_at) VALUES (?, ?, ?, 0, ?)"
  ).run(id, lineUserId, displayName, now());

  return db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(id) as Customer;
}

export function getCustomerById(id: string): Customer | null {
  return (getDb()
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(id) as Customer | undefined) ?? null;
}

export function getCustomerByLineId(lineUserId: string): Customer | null {
  return (getDb()
    .prepare("SELECT * FROM customers WHERE line_user_id = ?")
    .get(lineUserId) as Customer | undefined) ?? null;
}

export function insertMessage(args: {
  customerId: string;
  direction: "in" | "out";
  text: string;
  sentBy: "customer" | "ai" | "staff";
  channelMeta?: Record<string, unknown>;
}): Message {
  const id = uuid();
  const ts = now();
  getDb()
    .prepare(
      "INSERT INTO messages (id, customer_id, direction, text, sent_by, channel_meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      id,
      args.customerId,
      args.direction,
      args.text,
      args.sentBy,
      args.channelMeta ? JSON.stringify(args.channelMeta) : null,
      ts
    );
  return {
    id,
    customer_id: args.customerId,
    direction: args.direction,
    text: args.text,
    sent_by: args.sentBy,
    channel_meta: args.channelMeta ? JSON.stringify(args.channelMeta) : null,
    created_at: ts,
  };
}

export function lastMessagesForCustomer(
  customerId: string,
  limit: number
): Message[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(customerId, limit) as Message[];
  return rows.reverse();
}

export function allMessagesForCustomer(customerId: string): Message[] {
  return getDb()
    .prepare(
      "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at ASC"
    )
    .all(customerId) as Message[];
}

export function listConversations(): ConversationSummary[] {
  const db = getDb();
  const customers = db
    .prepare("SELECT * FROM customers ORDER BY created_at DESC")
    .all() as Customer[];

  const result: ConversationSummary[] = [];
  const lastStmt = db.prepare(
    "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1"
  );
  for (const c of customers) {
    const last = lastStmt.get(c.id) as Message | undefined;
    result.push({
      customer: c,
      last_message: last ?? null,
      last_message_at: last?.created_at ?? c.created_at,
    });
  }
  result.sort((a, b) => b.last_message_at - a.last_message_at);
  return result;
}

export function setAiPaused(customerId: string, paused: boolean): void {
  getDb()
    .prepare("UPDATE customers SET ai_paused = ? WHERE id = ?")
    .run(paused ? 1 : 0, customerId);
}

export function getBrandVoice(): string {
  const row = getDb()
    .prepare("SELECT brand_voice FROM settings WHERE id = 1")
    .get() as { brand_voice: string | null } | undefined;
  return row?.brand_voice ?? "";
}

export function insertBooking(args: {
  customerId: string;
  treatment: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  notes: string | null;
}): string {
  const id = uuid();
  getDb()
    .prepare(
      "INSERT INTO bookings (id, customer_id, treatment, requested_date, requested_time, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)"
    )
    .run(
      id,
      args.customerId,
      args.treatment,
      args.requestedDate,
      args.requestedTime,
      args.notes,
      now()
    );
  return id;
}

export type KnowledgeChunk = {
  id: string;
  source_doc: string;
  text: string;
  embedding: number[];
};

export function insertKnowledgeChunk(args: {
  sourceDoc: string;
  text: string;
  embedding: number[];
}): string {
  const id = uuid();
  getDb()
    .prepare(
      "INSERT INTO knowledge_chunks (id, source_doc, text, embedding, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, args.sourceDoc, args.text, JSON.stringify(args.embedding), now());
  return id;
}

export function listKnowledgeChunks(): KnowledgeChunk[] {
  const rows = getDb()
    .prepare(
      "SELECT id, source_doc, text, embedding FROM knowledge_chunks"
    )
    .all() as { id: string; source_doc: string; text: string; embedding: string }[];
  return rows.map((r) => ({
    id: r.id,
    source_doc: r.source_doc,
    text: r.text,
    embedding: JSON.parse(r.embedding) as number[],
  }));
}

export function deleteKnowledgeForSource(sourceDoc: string): number {
  return getDb()
    .prepare("DELETE FROM knowledge_chunks WHERE source_doc = ?")
    .run(sourceDoc).changes;
}
