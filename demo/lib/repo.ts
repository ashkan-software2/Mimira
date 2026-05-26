import { getDb, now, uuid, type SettingsBlob } from "./db";

export type Customer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  ai_paused: number;
  flags: string | null;
  created_at: number;
};

// Preset conversation flags staff can toggle from the Inbox Actions menu.
// Kept here (and not as a DB enum) so other surfaces (pipeline, list API)
// can reference the canonical strings.
export const PRESET_FLAGS = [
  "Needs review",
  "Doctor advice",
  "Appointment",
  "Addressed",
] as const;
export type PresetFlag = (typeof PRESET_FLAGS)[number];

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

type AttentionMeta = {
  needs_attention?: unknown;
  attention_resolved_at?: unknown;
  attention_resolved_by?: unknown;
};

function parseAttentionMeta(m: Message | null | undefined): AttentionMeta | null {
  if (!m || !m.channel_meta) return null;
  try {
    return JSON.parse(m.channel_meta) as AttentionMeta;
  } catch {
    return null;
  }
}

export function messageNeedsAttention(m: Message | null | undefined): boolean {
  const meta = parseAttentionMeta(m);
  if (!meta || meta.needs_attention !== true) return false;
  return meta.attention_resolved_at == null;
}

export function messageAttentionResolvedAt(
  m: Message | null | undefined
): number | null {
  const meta = parseAttentionMeta(m);
  if (!meta || meta.needs_attention !== true) return null;
  return typeof meta.attention_resolved_at === "number"
    ? meta.attention_resolved_at
    : null;
}

// Returns the set of customer ids that have at least one AI message flagged
// for attention that has not been resolved. Used to drive the conversation
// list badge without relying on "last message" state (so the badge survives
// a customer reply on top of an unresolved escalation).
export function customerIdsNeedingAttention(): Set<string> {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT customer_id FROM messages
       WHERE sent_by = 'ai'
         AND channel_meta IS NOT NULL
         AND json_extract(channel_meta, '$.needs_attention') = 1
         AND json_extract(channel_meta, '$.attention_resolved_at') IS NULL`
    )
    .all() as { customer_id: string }[];
  return new Set(rows.map((r) => r.customer_id));
}

// Mark every open "needs attention" flag on this customer's AI messages as
// resolved. Returns the number of messages that flipped.
export function resolveAttentionForCustomer(args: {
  customerId: string;
  actor: string;
}): number {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, channel_meta FROM messages WHERE customer_id = ? AND sent_by = 'ai' AND channel_meta IS NOT NULL"
    )
    .all(args.customerId) as { id: string; channel_meta: string }[];
  const update = db.prepare(
    "UPDATE messages SET channel_meta = ? WHERE id = ?"
  );
  const ts = now();
  let resolved = 0;
  for (const row of rows) {
    let meta: AttentionMeta & Record<string, unknown>;
    try {
      meta = JSON.parse(row.channel_meta);
    } catch {
      continue;
    }
    if (meta.needs_attention !== true) continue;
    if (meta.attention_resolved_at != null) continue;
    meta.attention_resolved_at = ts;
    meta.attention_resolved_by = args.actor;
    update.run(JSON.stringify(meta), row.id);
    resolved++;
  }
  return resolved;
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

export function getFlagsForCustomer(customerId: string): string[] {
  return parseFlags(
    (
      getDb()
        .prepare("SELECT flags FROM customers WHERE id = ?")
        .get(customerId) as { flags: string | null } | undefined
    )?.flags ?? null
  );
}

export function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function setFlagsForCustomer(
  customerId: string,
  flags: string[]
): string[] {
  const cleaned = Array.from(
    new Set(flags.map((f) => f.trim()).filter(Boolean))
  );
  getDb()
    .prepare("UPDATE customers SET flags = ? WHERE id = ?")
    .run(cleaned.length > 0 ? JSON.stringify(cleaned) : null, customerId);
  return cleaned;
}

// Idempotent — used by the pipeline to auto-flag conversations the AI
// handed off, without clobbering anything staff has already toggled.
export function addFlagToCustomer(customerId: string, flag: string): string[] {
  const current = getFlagsForCustomer(customerId);
  if (current.includes(flag)) return current;
  return setFlagsForCustomer(customerId, [...current, flag]);
}

export function removeFlagFromCustomer(
  customerId: string,
  flag: string
): string[] {
  const current = getFlagsForCustomer(customerId);
  if (!current.includes(flag)) return current;
  return setFlagsForCustomer(
    customerId,
    current.filter((f) => f !== flag)
  );
}

export function getBrandVoice(): string {
  const row = getDb()
    .prepare("SELECT brand_voice FROM settings WHERE id = 1")
    .get() as { brand_voice: string | null } | undefined;
  return row?.brand_voice ?? "";
}

export function getSettings(): SettingsBlob {
  const row = getDb()
    .prepare("SELECT data FROM settings WHERE id = 1")
    .get() as { data: string | null } | undefined;
  if (!row?.data) {
    throw new Error("settings row not initialized");
  }
  return JSON.parse(row.data) as SettingsBlob;
}

export function saveSettings(next: SettingsBlob): void {
  getDb()
    .prepare("UPDATE settings SET data = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(next), now());
}

export function updateSettings<K extends keyof SettingsBlob>(
  section: K,
  patch: Partial<SettingsBlob[K]>
): SettingsBlob {
  const current = getSettings();
  const merged: SettingsBlob = {
    ...current,
    [section]: { ...current[section], ...patch },
  };
  saveSettings(merged);
  return merged;
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

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: "Treatments" | "Aftercare & safety";
  chunkCount: number;
  body: string;
  lastEditedAt: number;
};

// Group raw knowledge_chunks rows into "documents" for the admin Knowledge page.
// Each chunk file starts with a title line; chunks sharing a title belong to the
// same conceptual document. The chunker is upstream, so we re-derive doc grouping
// at read time instead of adding another table.
export function listKnowledgeDocs(): KnowledgeDoc[] {
  const rows = getDb()
    .prepare(
      "SELECT id, source_doc, text, created_at FROM knowledge_chunks ORDER BY id ASC"
    )
    .all() as {
      id: string;
      source_doc: string;
      text: string;
      created_at: number;
    }[];

  const byTitle = new Map<
    string,
    { firstId: string; sections: string[]; lastEditedAt: number }
  >();

  for (const row of rows) {
    const lines = row.text.split("\n");
    const title = (lines[0] ?? "").trim();
    if (!title) continue;
    let rest = lines.slice(1).join("\n");
    // Drop a leading blank line if the first content line was the title.
    rest = rest.replace(/^\n+/, "");

    const entry = byTitle.get(title);
    if (entry) {
      entry.sections.push(rest);
      if (row.created_at > entry.lastEditedAt) entry.lastEditedAt = row.created_at;
    } else {
      byTitle.set(title, {
        firstId: row.id,
        sections: [rest],
        lastEditedAt: row.created_at,
      });
    }
  }

  const docs: KnowledgeDoc[] = [];
  for (const [title, entry] of byTitle) {
    docs.push({
      id: entry.firstId,
      title,
      category: categorize(title),
      chunkCount: entry.sections.length,
      body: entry.sections.join("\n\n").trim(),
      lastEditedAt: entry.lastEditedAt,
    });
  }

  docs.sort((a, b) => a.title.localeCompare(b.title));
  return docs;
}

function categorize(title: string): KnowledgeDoc["category"] {
  const t = title.toLowerCase();
  if (
    t.startsWith("post") ||
    t.startsWith("normal temporary") ||
    t.startsWith("when to contact") ||
    t.includes("side effect") ||
    t.includes("aftercare")
  ) {
    return "Aftercare & safety";
  }
  return "Treatments";
}

// ---------- Capacity rules ----------

export type CapacityRule = {
  id: string;
  treatment: string;
  per_day: number;
  slot_minutes: number;
  position: number;
};

export function listCapacityRules(): CapacityRule[] {
  return getDb()
    .prepare(
      "SELECT id, treatment, per_day, slot_minutes, position FROM capacity_rules ORDER BY position ASC, treatment ASC"
    )
    .all() as CapacityRule[];
}

export function upsertCapacityRule(args: {
  id?: string | null;
  treatment: string;
  per_day: number;
  slot_minutes: number;
}): CapacityRule {
  const db = getDb();
  if (args.id) {
    db.prepare(
      "UPDATE capacity_rules SET treatment = ?, per_day = ?, slot_minutes = ?, updated_at = ? WHERE id = ?"
    ).run(args.treatment, args.per_day, args.slot_minutes, now(), args.id);
    return db
      .prepare(
        "SELECT id, treatment, per_day, slot_minutes, position FROM capacity_rules WHERE id = ?"
      )
      .get(args.id) as CapacityRule;
  }
  const id = uuid();
  const maxPos =
    (
      db.prepare("SELECT MAX(position) AS p FROM capacity_rules").get() as {
        p: number | null;
      }
    ).p ?? -1;
  db.prepare(
    "INSERT INTO capacity_rules (id, treatment, per_day, slot_minutes, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, args.treatment, args.per_day, args.slot_minutes, maxPos + 1, now());
  return {
    id,
    treatment: args.treatment,
    per_day: args.per_day,
    slot_minutes: args.slot_minutes,
    position: maxPos + 1,
  };
}

export function removeCapacityRule(id: string): void {
  getDb().prepare("DELETE FROM capacity_rules WHERE id = ?").run(id);
}

// ---------- Team members ----------

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Staff";
  pending: number;
  last_active_at: number | null;
  created_at: number;
};

export function listTeamMembers(): TeamMember[] {
  return getDb()
    .prepare(
      "SELECT id, name, email, role, pending, last_active_at, created_at FROM team_members ORDER BY pending ASC, role ASC, created_at ASC"
    )
    .all() as TeamMember[];
}

export function insertTeamMember(args: {
  name: string;
  email: string;
  role: "Owner" | "Staff";
  pending: boolean;
}): TeamMember {
  const id = uuid();
  const ts = now();
  getDb()
    .prepare(
      "INSERT INTO team_members (id, name, email, role, pending, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, args.name, args.email, args.role, args.pending ? 1 : 0, null, ts);
  return {
    id,
    name: args.name,
    email: args.email,
    role: args.role,
    pending: args.pending ? 1 : 0,
    last_active_at: null,
    created_at: ts,
  };
}

export function updateTeamMember(
  id: string,
  patch: { name?: string; role?: "Owner" | "Staff"; pending?: boolean }
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.role !== undefined) {
    fields.push("role = ?");
    values.push(patch.role);
  }
  if (patch.pending !== undefined) {
    fields.push("pending = ?");
    values.push(patch.pending ? 1 : 0);
    if (!patch.pending) {
      fields.push("last_active_at = ?");
      values.push(now());
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  getDb()
    .prepare(`UPDATE team_members SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function removeTeamMember(id: string): void {
  getDb().prepare("DELETE FROM team_members WHERE id = ?").run(id);
}

// ---------- Audit log ----------

export type AuditEntry = {
  id: string;
  section: string;
  actor: string;
  summary: string;
  created_at: number;
};

export function appendAudit(args: {
  section: string;
  actor: string;
  summary: string;
}): AuditEntry {
  const id = uuid();
  const ts = now();
  getDb()
    .prepare(
      "INSERT INTO audit_log (id, section, actor, summary, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, args.section, args.actor, args.summary, ts);
  return { id, ...args, created_at: ts };
}

export function listAuditLog(opts?: {
  section?: string;
  limit?: number;
}): AuditEntry[] {
  const limit = opts?.limit ?? 50;
  if (opts?.section) {
    return getDb()
      .prepare(
        "SELECT id, section, actor, summary, created_at FROM audit_log WHERE section = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(opts.section, limit) as AuditEntry[];
  }
  return getDb()
    .prepare(
      "SELECT id, section, actor, summary, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as AuditEntry[];
}

// ---------- Sample dialogues (brand voice) ----------

export type SampleDialogue = {
  id: string;
  customer_text: string;
  yuna_text: string;
  position: number;
};

export function listSampleDialogues(): SampleDialogue[] {
  return getDb()
    .prepare(
      "SELECT id, customer_text, yuna_text, position FROM sample_dialogues ORDER BY position ASC"
    )
    .all() as SampleDialogue[];
}

export function insertSampleDialogue(args: {
  customer_text: string;
  yuna_text: string;
}): SampleDialogue {
  const db = getDb();
  const id = uuid();
  const maxPos =
    (
      db.prepare("SELECT MAX(position) AS p FROM sample_dialogues").get() as {
        p: number | null;
      }
    ).p ?? -1;
  const pos = maxPos + 1;
  db.prepare(
    "INSERT INTO sample_dialogues (id, customer_text, yuna_text, position, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, args.customer_text, args.yuna_text, pos, now());
  return {
    id,
    customer_text: args.customer_text,
    yuna_text: args.yuna_text,
    position: pos,
  };
}

export function removeSampleDialogue(id: string): void {
  getDb().prepare("DELETE FROM sample_dialogues WHERE id = ?").run(id);
}

// ---------- DSAR export ----------

export type CustomerExport = {
  customer: Customer;
  messages: Message[];
  bookings: unknown[];
};

export function exportAllCustomers(): CustomerExport[] {
  const db = getDb();
  const customers = db
    .prepare("SELECT * FROM customers ORDER BY created_at ASC")
    .all() as Customer[];
  const out: CustomerExport[] = [];
  for (const c of customers) {
    const messages = db
      .prepare(
        "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at ASC"
      )
      .all(c.id) as Message[];
    const bookings = db
      .prepare(
        "SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at ASC"
      )
      .all(c.id);
    out.push({ customer: c, messages, bookings });
  }
  return out;
}
