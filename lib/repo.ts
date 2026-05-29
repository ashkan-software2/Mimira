import { toSql as pgvectorToSql } from "pgvector";
import { getDb, now, uuid, type SettingsBlob } from "./db";

export type Customer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  ai_paused: boolean;
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

export async function upsertCustomer(
  lineUserId: string,
  displayName: string | null
): Promise<Customer> {
  const sql = await getDb();
  const existingRows = await sql<Customer[]>`
    SELECT * FROM customers WHERE line_user_id = ${lineUserId}
  `;
  const existing = existingRows[0];

  if (existing) {
    if (displayName && displayName !== existing.display_name) {
      await sql`
        UPDATE customers SET display_name = ${displayName} WHERE id = ${existing.id}
      `;
      return { ...existing, display_name: displayName };
    }
    return existing;
  }

  const id = uuid();
  await sql`
    INSERT INTO customers (id, line_user_id, display_name, ai_paused, created_at)
    VALUES (${id}, ${lineUserId}, ${displayName}, FALSE, ${now()})
  `;

  const [row] = await sql<Customer[]>`SELECT * FROM customers WHERE id = ${id}`;
  return row;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const sql = await getDb();
  const rows = await sql<Customer[]>`SELECT * FROM customers WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getCustomerByLineId(
  lineUserId: string
): Promise<Customer | null> {
  const sql = await getDb();
  const rows = await sql<Customer[]>`
    SELECT * FROM customers WHERE line_user_id = ${lineUserId}
  `;
  return rows[0] ?? null;
}

export async function insertMessage(args: {
  customerId: string;
  direction: "in" | "out";
  text: string;
  sentBy: "customer" | "ai" | "staff";
  channelMeta?: Record<string, unknown>;
}): Promise<Message> {
  const sql = await getDb();
  const id = uuid();
  const ts = now();
  const channelMeta = args.channelMeta ? JSON.stringify(args.channelMeta) : null;
  await sql`
    INSERT INTO messages (id, customer_id, direction, text, sent_by, channel_meta, created_at)
    VALUES (${id}, ${args.customerId}, ${args.direction}, ${args.text}, ${args.sentBy}, ${channelMeta}, ${ts})
  `;
  return {
    id,
    customer_id: args.customerId,
    direction: args.direction,
    text: args.text,
    sent_by: args.sentBy,
    channel_meta: channelMeta,
    created_at: ts,
  };
}

type AttentionMeta = {
  needs_attention?: unknown;
  attention_resolved_at?: unknown;
  attention_resolved_by?: unknown;
};

export type MessageMedia = {
  kind: "image" | "video";
  url: string;
  mimeType: string;
  fileName?: string;
};

type MediaMeta = {
  media?: unknown;
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

export function messageMedia(m: Message | null | undefined): MessageMedia | null {
  if (!m || !m.channel_meta) return null;
  let meta: MediaMeta | null;
  try {
    meta = JSON.parse(m.channel_meta) as MediaMeta;
  } catch {
    return null;
  }
  const media = meta?.media;
  if (!media || typeof media !== "object") return null;
  const raw = media as Record<string, unknown>;
  if (raw.kind !== "image" && raw.kind !== "video") return null;
  if (typeof raw.url !== "string" || typeof raw.mimeType !== "string") return null;
  return {
    kind: raw.kind,
    url: raw.url,
    mimeType: raw.mimeType,
    fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
  };
}

// Returns the set of customer ids that have at least one AI message flagged
// for attention that has not been resolved. Used to drive the conversation
// list badge without relying on "last message" state (so the badge survives
// a customer reply on top of an unresolved escalation).
export async function customerIdsNeedingAttention(): Promise<Set<string>> {
  const sql = await getDb();
  // channel_meta is TEXT; cast to JSONB to use JSON operators. The query is
  // equivalent to the old SQLite `json_extract(..., '$.needs_attention') = 1`.
  const rows = await sql<{ customer_id: string }[]>`
    SELECT DISTINCT customer_id FROM messages
    WHERE sent_by = 'ai'
      AND channel_meta IS NOT NULL
      AND (channel_meta::jsonb)->>'needs_attention' = 'true'
      AND (channel_meta::jsonb)->>'attention_resolved_at' IS NULL
  `;
  return new Set(rows.map((r) => r.customer_id));
}

// Mark every open "needs attention" flag on this customer's AI messages as
// resolved. Returns the number of messages that flipped.
export async function resolveAttentionForCustomer(args: {
  customerId: string;
  actor: string;
}): Promise<number> {
  const sql = await getDb();
  const rows = await sql<{ id: string; channel_meta: string }[]>`
    SELECT id, channel_meta FROM messages
    WHERE customer_id = ${args.customerId}
      AND sent_by = 'ai'
      AND channel_meta IS NOT NULL
  `;
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
    await sql`
      UPDATE messages SET channel_meta = ${JSON.stringify(meta)} WHERE id = ${row.id}
    `;
    resolved++;
  }
  return resolved;
}

export async function lastMessagesForCustomer(
  customerId: string,
  limit: number,
  opts?: { sinceMs?: number }
): Promise<Message[]> {
  const sql = await getDb();
  const sinceMs = opts?.sinceMs;
  const rows =
    sinceMs !== undefined
      ? await sql<Message[]>`
          SELECT * FROM messages
          WHERE customer_id = ${customerId}
            AND created_at >= ${sinceMs}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await sql<Message[]>`
          SELECT * FROM messages
          WHERE customer_id = ${customerId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
  return [...rows].reverse();
}

export async function allMessagesForCustomer(
  customerId: string,
  opts?: { sinceMs?: number }
): Promise<Message[]> {
  const sql = await getDb();
  const sinceMs = opts?.sinceMs;
  const rows =
    sinceMs !== undefined
      ? await sql<Message[]>`
          SELECT * FROM messages
          WHERE customer_id = ${customerId}
            AND created_at >= ${sinceMs}
          ORDER BY created_at ASC
        `
      : await sql<Message[]>`
          SELECT * FROM messages
          WHERE customer_id = ${customerId}
          ORDER BY created_at ASC
        `;
  return [...rows];
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const sql = await getDb();
  const customers = await sql<Customer[]>`
    SELECT * FROM customers ORDER BY created_at DESC
  `;

  const result: ConversationSummary[] = [];
  for (const c of customers) {
    const [last] = await sql<Message[]>`
      SELECT * FROM messages
      WHERE customer_id = ${c.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    result.push({
      customer: c,
      last_message: last ?? null,
      last_message_at: last?.created_at ?? c.created_at,
    });
  }
  result.sort((a, b) => b.last_message_at - a.last_message_at);
  return result;
}

export async function setAiPaused(
  customerId: string,
  paused: boolean
): Promise<void> {
  const sql = await getDb();
  await sql`UPDATE customers SET ai_paused = ${paused} WHERE id = ${customerId}`;
}

export async function getFlagsForCustomer(
  customerId: string
): Promise<string[]> {
  const sql = await getDb();
  const rows = await sql<{ flags: string | null }[]>`
    SELECT flags FROM customers WHERE id = ${customerId}
  `;
  return parseFlags(rows[0]?.flags ?? null);
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

export async function setFlagsForCustomer(
  customerId: string,
  flags: string[]
): Promise<string[]> {
  const cleaned = Array.from(
    new Set(flags.map((f) => f.trim()).filter(Boolean))
  );
  const sql = await getDb();
  const value = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
  await sql`UPDATE customers SET flags = ${value} WHERE id = ${customerId}`;
  return cleaned;
}

// Idempotent — used by the pipeline to auto-flag conversations the AI
// handed off, without clobbering anything staff has already toggled.
export async function addFlagToCustomer(
  customerId: string,
  flag: string
): Promise<string[]> {
  const current = await getFlagsForCustomer(customerId);
  if (current.includes(flag)) return current;
  return setFlagsForCustomer(customerId, [...current, flag]);
}

export async function removeFlagFromCustomer(
  customerId: string,
  flag: string
): Promise<string[]> {
  const current = await getFlagsForCustomer(customerId);
  if (!current.includes(flag)) return current;
  return setFlagsForCustomer(
    customerId,
    current.filter((f) => f !== flag)
  );
}

export async function getBrandVoice(): Promise<string> {
  const sql = await getDb();
  const rows = await sql<{ brand_voice: string | null }[]>`
    SELECT brand_voice FROM settings WHERE id = 1
  `;
  return rows[0]?.brand_voice ?? "";
}

export async function getSettings(): Promise<SettingsBlob> {
  const sql = await getDb();
  const rows = await sql<{ data: string | null }[]>`
    SELECT data FROM settings WHERE id = 1
  `;
  const data = rows[0]?.data;
  if (!data) throw new Error("settings row not initialized");
  return JSON.parse(data) as SettingsBlob;
}

export async function saveSettings(next: SettingsBlob): Promise<void> {
  const sql = await getDb();
  await sql`
    UPDATE settings
    SET data = ${JSON.stringify(next)}, updated_at = ${now()}
    WHERE id = 1
  `;
}

export async function updateSettings<K extends keyof SettingsBlob>(
  section: K,
  patch: Partial<SettingsBlob[K]>
): Promise<SettingsBlob> {
  const current = await getSettings();
  const merged: SettingsBlob = {
    ...current,
    [section]: { ...current[section], ...patch },
  };
  await saveSettings(merged);
  return merged;
}

export async function insertBooking(args: {
  customerId: string;
  treatment: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  notes: string | null;
}): Promise<string> {
  const sql = await getDb();
  const id = uuid();
  await sql`
    INSERT INTO bookings (id, customer_id, treatment, requested_date, requested_time, notes, status, created_at)
    VALUES (${id}, ${args.customerId}, ${args.treatment}, ${args.requestedDate}, ${args.requestedTime}, ${args.notes}, 'new', ${now()})
  `;
  return id;
}

/** Bookings for a treatment on a calendar day (Settings → capacity enforcement). */
export async function countBookingsForTreatmentOnDate(
  treatment: string,
  requestedDate: string
): Promise<number> {
  const sql = await getDb();
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM bookings
    WHERE LOWER(TRIM(treatment)) = LOWER(TRIM(${treatment}))
      AND requested_date = ${requestedDate}
      AND status <> 'cancelled'
  `;
  return row?.n ?? 0;
}

export type KnowledgeChunk = {
  id: string;
  source_doc: string;
  text: string;
  embedding: number[];
};

export async function insertKnowledgeChunk(args: {
  sourceDoc: string;
  text: string;
  embedding: number[];
}): Promise<string> {
  const sql = await getDb();
  const id = uuid();
  const vec = pgvectorToSql(args.embedding);
  await sql`
    INSERT INTO knowledge_chunks (id, source_doc, text, embedding, created_at)
    VALUES (${id}, ${args.sourceDoc}, ${args.text}, ${vec}::vector, ${now()})
  `;
  return id;
}

export async function deleteKnowledgeForSource(
  sourceDoc: string
): Promise<number> {
  const sql = await getDb();
  const rows = await sql`
    DELETE FROM knowledge_chunks WHERE source_doc = ${sourceDoc}
  `;
  // postgres-js returns a result with a `count` property for write queries.
  return rows.count ?? 0;
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
export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const sql = await getDb();
  const rows = await sql<
    {
      id: string;
      source_doc: string;
      text: string;
      created_at: number;
    }[]
  >`
    SELECT id, source_doc, text, created_at FROM knowledge_chunks ORDER BY id ASC
  `;

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

export async function listCapacityRules(): Promise<CapacityRule[]> {
  const sql = await getDb();
  const rows = await sql<CapacityRule[]>`
    SELECT id, treatment, per_day, slot_minutes, position
    FROM capacity_rules
    ORDER BY position ASC, treatment ASC
  `;
  return [...rows];
}

export async function upsertCapacityRule(args: {
  id?: string | null;
  treatment: string;
  per_day: number;
  slot_minutes: number;
}): Promise<CapacityRule> {
  const sql = await getDb();
  if (args.id) {
    await sql`
      UPDATE capacity_rules
      SET treatment = ${args.treatment},
          per_day = ${args.per_day},
          slot_minutes = ${args.slot_minutes},
          updated_at = ${now()}
      WHERE id = ${args.id}
    `;
    const [row] = await sql<CapacityRule[]>`
      SELECT id, treatment, per_day, slot_minutes, position
      FROM capacity_rules WHERE id = ${args.id}
    `;
    return row;
  }
  const id = uuid();
  const [maxRow] = await sql<{ p: number | null }[]>`
    SELECT MAX(position) AS p FROM capacity_rules
  `;
  const maxPos = maxRow?.p ?? -1;
  await sql`
    INSERT INTO capacity_rules (id, treatment, per_day, slot_minutes, position, updated_at)
    VALUES (${id}, ${args.treatment}, ${args.per_day}, ${args.slot_minutes}, ${maxPos + 1}, ${now()})
  `;
  return {
    id,
    treatment: args.treatment,
    per_day: args.per_day,
    slot_minutes: args.slot_minutes,
    position: maxPos + 1,
  };
}

export async function removeCapacityRule(id: string): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM capacity_rules WHERE id = ${id}`;
}

// ---------- Team members ----------

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Staff";
  pending: boolean;
  last_active_at: number | null;
  created_at: number;
};

export async function listTeamMembers(): Promise<TeamMember[]> {
  const sql = await getDb();
  const rows = await sql<TeamMember[]>`
    SELECT id, name, email, role, pending, last_active_at, created_at
    FROM team_members
    ORDER BY pending ASC, role ASC, created_at ASC
  `;
  return [...rows];
}

export async function getActiveTeamMemberByEmail(
  email: string
): Promise<TeamMember | null> {
  const sql = await getDb();
  const rows = await sql<TeamMember[]>`
    SELECT id, name, email, role, pending, last_active_at, created_at
    FROM team_members
    WHERE lower(email) = lower(${email})
      AND pending = false
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getTeamMemberByEmail(
  email: string
): Promise<TeamMember | null> {
  const sql = await getDb();
  const rows = await sql<TeamMember[]>`
    SELECT id, name, email, role, pending, last_active_at, created_at
    FROM team_members
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function markTeamMemberActive(id: string): Promise<void> {
  const sql = await getDb();
  await sql`
    UPDATE team_members
    SET pending = false, last_active_at = ${now()}
    WHERE id = ${id}
  `;
}

export async function bootstrapFirstOwner(args: {
  name: string;
  email: string;
}): Promise<TeamMember | null> {
  const sql = await getDb();
  const [row] = await sql<{ total: number; real: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE lower(email) NOT LIKE '%@sukhumvit-skin.com'
      )::int AS real
    FROM team_members
  `;

  if ((row?.total ?? 0) > 0 && (row?.real ?? 0) > 0) {
    return null;
  }

  const id = uuid();
  const ts = now();
  await sql`DELETE FROM team_members`;
  await sql`
    INSERT INTO team_members (id, name, email, role, pending, last_active_at, created_at)
    VALUES (${id}, ${args.name}, ${args.email}, 'Owner', false, ${ts}, ${ts})
  `;
  return {
    id,
    name: args.name,
    email: args.email,
    role: "Owner",
    pending: false,
    last_active_at: ts,
    created_at: ts,
  };
}

export async function insertTeamMember(args: {
  name: string;
  email: string;
  role: "Owner" | "Staff";
  pending: boolean;
}): Promise<TeamMember> {
  const sql = await getDb();
  const id = uuid();
  const ts = now();
  await sql`
    INSERT INTO team_members (id, name, email, role, pending, last_active_at, created_at)
    VALUES (${id}, ${args.name}, ${args.email}, ${args.role}, ${args.pending}, ${null}, ${ts})
  `;
  return {
    id,
    name: args.name,
    email: args.email,
    role: args.role,
    pending: args.pending,
    last_active_at: null,
    created_at: ts,
  };
}

export async function updateTeamMember(
  id: string,
  patch: { name?: string; role?: "Owner" | "Staff"; pending?: boolean }
): Promise<void> {
  const sql = await getDb();
  // postgres-js doesn't have a Drizzle-style dynamic builder; expand each
  // optional field in turn. Doing them as separate UPDATEs is fine — the
  // settings UI only ever sets one field at a time today, and the rows are
  // tiny, so the round-trip cost is negligible.
  if (patch.name !== undefined) {
    await sql`UPDATE team_members SET name = ${patch.name} WHERE id = ${id}`;
  }
  if (patch.role !== undefined) {
    await sql`UPDATE team_members SET role = ${patch.role} WHERE id = ${id}`;
  }
  if (patch.pending !== undefined) {
    await sql`UPDATE team_members SET pending = ${patch.pending} WHERE id = ${id}`;
    if (!patch.pending) {
      await sql`UPDATE team_members SET last_active_at = ${now()} WHERE id = ${id}`;
    }
  }
}

export async function removeTeamMember(id: string): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM team_members WHERE id = ${id}`;
}

// ---------- Audit log ----------

export type AuditEntry = {
  id: string;
  section: string;
  actor: string;
  summary: string;
  created_at: number;
};

export async function appendAudit(args: {
  section: string;
  actor: string;
  summary: string;
}): Promise<AuditEntry> {
  const sql = await getDb();
  const id = uuid();
  const ts = now();
  await sql`
    INSERT INTO audit_log (id, section, actor, summary, created_at)
    VALUES (${id}, ${args.section}, ${args.actor}, ${args.summary}, ${ts})
  `;
  return { id, ...args, created_at: ts };
}

export async function listAuditLog(opts?: {
  section?: string;
  limit?: number;
  sinceMs?: number;
}): Promise<AuditEntry[]> {
  const sql = await getDb();
  const limit = opts?.limit ?? 50;
  const sinceMs = opts?.sinceMs;
  if (opts?.section && sinceMs !== undefined) {
    const rows = await sql<AuditEntry[]>`
      SELECT id, section, actor, summary, created_at FROM audit_log
      WHERE section = ${opts.section}
        AND created_at >= ${sinceMs}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return [...rows];
  }
  if (opts?.section) {
    const rows = await sql<AuditEntry[]>`
      SELECT id, section, actor, summary, created_at FROM audit_log
      WHERE section = ${opts.section}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return [...rows];
  }
  if (sinceMs !== undefined) {
    const rows = await sql<AuditEntry[]>`
      SELECT id, section, actor, summary, created_at FROM audit_log
      WHERE created_at >= ${sinceMs}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return [...rows];
  }
  const rows = await sql<AuditEntry[]>`
    SELECT id, section, actor, summary, created_at FROM audit_log
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return [...rows];
}

// ---------- Sample dialogues (brand voice) ----------

export type SampleDialogue = {
  id: string;
  customer_text: string;
  assistant_text: string;
  position: number;
};

export async function listSampleDialogues(): Promise<SampleDialogue[]> {
  const sql = await getDb();
  const rows = await sql<SampleDialogue[]>`
    SELECT id, customer_text, assistant_text, position
    FROM sample_dialogues
    ORDER BY position ASC
  `;
  return [...rows];
}

export async function insertSampleDialogue(args: {
  customer_text: string;
  assistant_text: string;
}): Promise<SampleDialogue> {
  const sql = await getDb();
  const id = uuid();
  const [maxRow] = await sql<{ p: number | null }[]>`
    SELECT MAX(position) AS p FROM sample_dialogues
  `;
  const pos = (maxRow?.p ?? -1) + 1;
  await sql`
    INSERT INTO sample_dialogues (id, customer_text, assistant_text, position, created_at)
    VALUES (${id}, ${args.customer_text}, ${args.assistant_text}, ${pos}, ${now()})
  `;
  return {
    id,
    customer_text: args.customer_text,
    assistant_text: args.assistant_text,
    position: pos,
  };
}

export async function removeSampleDialogue(id: string): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM sample_dialogues WHERE id = ${id}`;
}

// ---------- DSAR export ----------

export type CustomerExport = {
  customer: Customer;
  messages: Message[];
  bookings: unknown[];
};

export async function exportAllCustomers(opts?: {
  conversationSinceMs?: number;
}): Promise<CustomerExport[]> {
  const sql = await getDb();
  const customers = await sql<Customer[]>`
    SELECT * FROM customers ORDER BY created_at ASC
  `;
  const sinceMs = opts?.conversationSinceMs;
  const out: CustomerExport[] = [];
  for (const c of customers) {
    const messages =
      sinceMs !== undefined
        ? await sql<Message[]>`
            SELECT * FROM messages
            WHERE customer_id = ${c.id}
              AND created_at >= ${sinceMs}
            ORDER BY created_at ASC
          `
        : await sql<Message[]>`
            SELECT * FROM messages
            WHERE customer_id = ${c.id}
            ORDER BY created_at ASC
          `;
    const bookings = await sql`
      SELECT * FROM bookings
      WHERE customer_id = ${c.id}
      ORDER BY created_at ASC
    `;
    out.push({ customer: c, messages: [...messages], bookings: [...bookings] });
  }
  return out;
}
