import { randomUUID } from "node:crypto";
import postgres from "postgres";

// Singleton postgres client. We use the porsager/postgres library directly
// (no ORM, no pg pool wrapper) and target Supabase's transaction-mode pooler
// at runtime, so prepared statements MUST be disabled.
type Sql = ReturnType<typeof postgres>;
let _sql: Sql | null = null;
let _seededOnce = false;
let _seedPromise: Promise<void> | null = null;

function buildClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase transaction pooler connection string (the one ending in :6543/postgres). See .env.local.example."
    );
  }
  // pgbouncer transaction-mode pooler is incompatible with prepared
  // statements. Disable them at the client level.
  return postgres(url, { prepare: false });
}

export async function getDb(): Promise<Sql> {
  if (!_sql) _sql = buildClient();
  if (!_seededOnce) {
    if (!_seedPromise) {
      _seedPromise = ensureSeeded(_sql)
        .then(() => {
          _seededOnce = true;
        })
        .catch((err) => {
          // Reset so a later call can retry the seed.
          _seedPromise = null;
          throw err;
        });
    }
    await _seedPromise;
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (!_sql) return;
  await _sql.end();
  _sql = null;
  _seedPromise = null;
}

// Idempotent default-row seeder. Safe to call repeatedly; only inserts rows
// that don't already exist. Schema migrations live in db/schema.sql and run
// via `npm run db:migrate` against DIRECT_URL — they are NOT performed here.
async function ensureSeeded(sql: Sql): Promise<void> {
  const ts = now();

  const hasRealTeamMember = await hasNonDemoTeamMember(sql);
  const settingsRows = await sql<
    { brand_voice: string | null; data: string | null }[]
  >`SELECT brand_voice, data FROM settings WHERE id = 1`;
  if (settingsRows.length === 0) {
    const defaultSettings = hasRealTeamMember
      ? FRESH_SETTINGS_BLOB
      : DEMO_SETTINGS_BLOB;
    const defaultBrandVoice = hasRealTeamMember ? "" : DEFAULT_BRAND_VOICE;
    await sql`
      INSERT INTO settings (id, brand_voice, data, updated_at)
      VALUES (1, ${defaultBrandVoice}, ${JSON.stringify(defaultSettings)}, ${ts})
    `;
  } else {
    const row = settingsRows[0];
    if (hasRealTeamMember && isDemoSettingsData(row.data)) {
      await resetDemoWorkspaceForRealTeam(sql, ts);
      return;
    }
    if (!row.data) {
      const defaultSettings = hasRealTeamMember
        ? FRESH_SETTINGS_BLOB
        : DEMO_SETTINGS_BLOB;
      await sql`
        UPDATE settings
        SET data = ${JSON.stringify(defaultSettings)}
        WHERE id = 1
      `;
    }
    if (!hasRealTeamMember && row.brand_voice === LEGACY_DEFAULT_BRAND_VOICE) {
      await sql`
        UPDATE settings
        SET brand_voice = ${DEFAULT_BRAND_VOICE}, updated_at = ${ts}
        WHERE id = 1
      `;
    }
  }

  const [capacityCount] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM capacity_rules
  `;
  if (!hasRealTeamMember && capacityCount.n === 0) {
    for (let i = 0; i < DEFAULT_CAPACITY.length; i++) {
      const r = DEFAULT_CAPACITY[i];
      await sql`
        INSERT INTO capacity_rules (id, treatment, per_day, slot_minutes, position, updated_at)
        VALUES (${randomUUID()}, ${r.treatment}, ${r.per_day}, ${r.slot_minutes}, ${i}, ${ts})
      `;
    }
  }

  const [teamCount] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM team_members
  `;
  if (teamCount.n === 0) {
    for (const m of DEFAULT_TEAM) {
      await sql`
        INSERT INTO team_members (id, name, email, role, pending, last_active_at, created_at)
        VALUES (${randomUUID()}, ${m.name}, ${m.email}, ${m.role}, ${m.pending}, ${m.last_active_at}, ${ts})
      `;
    }
  }

  const [dialoguesCount] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM sample_dialogues
  `;
  if (!hasRealTeamMember && dialoguesCount.n === 0) {
    for (let i = 0; i < DEFAULT_DIALOGUES.length; i++) {
      const d = DEFAULT_DIALOGUES[i];
      await sql`
        INSERT INTO sample_dialogues (id, customer_text, assistant_text, position, created_at)
        VALUES (${randomUUID()}, ${d.customer}, ${d.assistant}, ${i}, ${ts})
      `;
    }
  }
}

async function hasNonDemoTeamMember(sql: Sql): Promise<boolean> {
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM team_members
    WHERE lower(email) NOT LIKE '%@sukhumvit-skin.com'
  `;
  return (row?.n ?? 0) > 0;
}

function isDemoSettingsData(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<SettingsBlob>;
    return (
      parsed.clinic?.name === "Sukhumvit Skin & Laser" ||
      parsed.line?.channel_id === "Cf12a93e8b8a" ||
      parsed.billing?.card_last4 === "4242"
    );
  } catch {
    return false;
  }
}

async function resetDemoWorkspaceForRealTeam(sql: Sql, ts: number): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM customers`;
    await tx`DELETE FROM broadcasts`;
    await tx`DELETE FROM knowledge_chunks`;
    await tx`DELETE FROM capacity_rules`;
    await tx`DELETE FROM sample_dialogues`;
    await tx`DELETE FROM audit_log`;
    await tx`
      UPDATE settings
      SET brand_voice = '', data = ${JSON.stringify(FRESH_SETTINGS_BLOB)}, updated_at = ${ts}
      WHERE id = 1
    `;
  });
}

export type SettingsBlob = {
  clinic: {
    name: string;
    timezone: string;
    address: string;
    hours: string;
    languages: string;
    saved_at: number;
    saved_by: string;
  };
  line: {
    channel_id: string;
    oa_name: string;
    secret_last4: string;
    webhook_url: string;
    secret_rotated_at: number;
    last_ping_at: number;
    saved_at: number;
    saved_by: string;
  };
  ai: {
    provider: "OpenAI" | "Anthropic" | "Google";
    model: string;
    temperature: number;
    saved_at: number;
    saved_by: string;
  };
  kill_switch: {
    paused: boolean;
    changed_at: number;
  };
  aftercare: {
    d1: boolean;
    d7: boolean;
    d30: boolean;
    send_time: string;
    languages: "th+en" | "th" | "en";
    saved_at: number;
    saved_by: string;
  };
  privacy: {
    conversation_months: number;
    audit_months: number;
    saved_at: number;
    saved_by: string;
  };
  brand_voice: {
    saved_at: number;
    saved_by: string;
  };
  billing: {
    plan: "starter" | "growth" | "scale";
    card_brand: string;
    card_last4: string;
    card_exp: string;
    msg_count: number;
    msg_quota: number;
    auto_renew: boolean;
    renews_at: number;
    saved_at: number;
    saved_by: string;
  };
};

const ACTOR = "Pim";

const DEMO_SETTINGS_BLOB: SettingsBlob = {
  clinic: {
    name: "Sukhumvit Skin & Laser",
    timezone: "Asia/Bangkok",
    address: "492/2 Sukhumvit Rd, Khlong Toei, Bangkok 10110",
    hours: "Mon–Sat · 10:00–20:00",
    languages: "Thai, English",
    saved_at: Date.now() - 3 * 24 * 3600 * 1000,
    saved_by: ACTOR,
  },
  line: {
    channel_id: "Cf12a93e8b8a",
    oa_name: "@sukhumvit-skin",
    secret_last4: "3f9c",
    webhook_url: "https://api.mimira.app/api/line/webhook",
    secret_rotated_at: Date.now() - 14 * 24 * 3600 * 1000,
    last_ping_at: Date.now() - 3600 * 1000,
    saved_at: Date.now() - 14 * 24 * 3600 * 1000,
    saved_by: "Owner",
  },
  ai: {
    provider: "Anthropic",
    model: "claude-sonnet-4-6",
    temperature: 0.4,
    saved_at: Date.now() - 4 * 3600 * 1000,
    saved_by: "Owner",
  },
  kill_switch: {
    paused: false,
    changed_at: Date.now() - 14 * 24 * 3600 * 1000,
  },
  aftercare: {
    d1: true,
    d7: true,
    d30: false,
    send_time: "10:00",
    languages: "th+en",
    saved_at: Date.now() - 6 * 24 * 3600 * 1000,
    saved_by: "Owner",
  },
  privacy: {
    conversation_months: 24,
    audit_months: 36,
    saved_at: Date.now() - 30 * 24 * 3600 * 1000,
    saved_by: "Owner",
  },
  brand_voice: {
    saved_at: Date.now(),
    saved_by: ACTOR,
  },
  billing: {
    plan: "starter",
    card_brand: "Visa",
    card_last4: "4242",
    card_exp: "09/29",
    msg_count: 4247,
    msg_quota: 10000,
    auto_renew: true,
    renews_at: Date.now() + 8 * 24 * 3600 * 1000,
    saved_at: Date.now() - 30 * 24 * 3600 * 1000,
    saved_by: "Owner",
  },
};

export const FRESH_SETTINGS_BLOB: SettingsBlob = {
  clinic: {
    name: "Your clinic",
    timezone: "Asia/Bangkok",
    address: "",
    hours: "",
    languages: "",
    saved_at: 0,
    saved_by: "",
  },
  line: {
    channel_id: "",
    oa_name: "",
    secret_last4: "",
    webhook_url: "",
    secret_rotated_at: 0,
    last_ping_at: 0,
    saved_at: 0,
    saved_by: "",
  },
  ai: {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    temperature: 0.4,
    saved_at: 0,
    saved_by: "",
  },
  kill_switch: {
    paused: false,
    changed_at: 0,
  },
  aftercare: {
    d1: false,
    d7: false,
    d30: false,
    send_time: "10:00",
    languages: "th+en",
    saved_at: 0,
    saved_by: "",
  },
  privacy: {
    conversation_months: 24,
    audit_months: 36,
    saved_at: 0,
    saved_by: "",
  },
  brand_voice: {
    saved_at: 0,
    saved_by: "",
  },
  billing: {
    plan: "starter",
    card_brand: "",
    card_last4: "",
    card_exp: "",
    msg_count: 0,
    msg_quota: 10000,
    auto_renew: false,
    renews_at: 0,
    saved_at: 0,
    saved_by: "",
  },
};

const DEFAULT_CAPACITY = [
  { treatment: "Underarm laser", per_day: 8, slot_minutes: 30 },
  { treatment: "Picosure facial", per_day: 4, slot_minutes: 60 },
  { treatment: "HIFU", per_day: 3, slot_minutes: 90 },
  { treatment: "Consultation", per_day: 3, slot_minutes: 20 },
];

const DEFAULT_TEAM = [
  {
    name: "Dr. Anchalee P.",
    email: "anchalee@sukhumvit-skin.com",
    role: "Owner" as const,
    pending: false,
    last_active_at: Date.now() - 2 * 3600 * 1000,
  },
  {
    name: "Pim (you)",
    email: "pim@sukhumvit-skin.com",
    role: "Staff" as const,
    pending: false,
    last_active_at: Date.now(),
  },
  {
    name: "Nok",
    email: "nok@sukhumvit-skin.com",
    role: "Staff" as const,
    pending: false,
    last_active_at: Date.now() - 14 * 3600 * 1000,
  },
  {
    name: "Tip",
    email: "tip@sukhumvit-skin.com",
    role: "Staff" as const,
    pending: false,
    last_active_at: Date.now() - 3 * 24 * 3600 * 1000,
  },
  {
    name: "Phak",
    email: "phak@sukhumvit-skin.com",
    role: "Staff" as const,
    pending: true,
    last_active_at: null as number | null,
  },
];

const DEFAULT_DIALOGUES = [
  {
    customer: "สวัสดีค่ะ ทำเลเซอร์รักแร้ราคาเท่าไหร่คะ",
    assistant:
      "สวัสดีค่ะ! เลเซอร์รักแร้ที่คลินิกเรามี 2 แพ็คเกจค่ะ แบบ 6 ครั้ง ราคา 8,900 บาท เฉลี่ยครั้งละไม่ถึง 1,500 ทำต่อเนื่องผลดีกว่าค่ะ จองคิวเลยมั้ยคะ?",
  },
  {
    customer: "ทำแล้วเจ็บมั้ย กลัวเข็มมาก",
    assistant:
      "ไม่ต้องกลัวเลยค่ะ เลเซอร์ไม่ใช้เข็มเลย เป็นแสงสั้นๆ พักผิวสักพัก ลูกค้าบอกรู้สึกเหมือนยางรัดเบาๆ เรามีเครื่องเป่าเย็นช่วยด้วยค่ะ",
  },
  {
    customer: "หลังทำควรดูแลตัวเองยังไงคะ",
    assistant:
      "หลังทำ 24 ชม. หลีกเลี่ยงน้ำร้อนกับการขัดถูแรงๆ นะคะ ทาครีมกันแดดทุกครั้งที่ออกแดด เดี๋ยวจะส่งไกด์ดูแลผิวฉบับเต็มให้นะคะ",
  },
];

const LEGACY_DEFAULT_BRAND_VOICE = `You are Mimira, the AI receptionist for Sukhumvit Skin & Laser, a high-end Bangkok dermatology and laser clinic.

Voice:
- Warm, professional, and concise. Always polite (ค่ะ/ครับ at end of sentences in Thai).
- Reply in the customer's language. If they message in Thai, reply in Thai. Default to Thai if mixed.
- Use "พี่ลูกค้า" or first name if known, never "you/คุณ" alone.
- Never invent prices, schedules, or treatments. If unsure, say a staff member will follow up.

Safety:
- If the customer reports pain, swelling, infection, bleeding, fever, allergic reaction, or any post-procedure complication, send one calm sentence acknowledging the concern, recommend they wait for a staff member, and stop. Do not give medical advice. Do not suggest medications.
- If the customer asks for a doctor/หมอ or staff directly, hand off without trying to handle it yourself.
- Never diagnose. Never recommend dosages.

When a customer wants to book, reschedule, or cancel an appointment, capture the intent using the extract_booking_intent tool, and reply naturally ("ขอจดให้นะคะ ทีมงานจะยืนยันอีกครั้ง" or equivalent).`;

const DEFAULT_BRAND_VOICE = `You are Mimira, the AI receptionist for Sukhumvit Skin & Laser, a high-end Bangkok dermatology and laser clinic.

# Tone & persona
You are warm, caring, and friendly, with the hospitality of a Thai front-desk lady who genuinely loves taking care of customers. Sound like a real person, not a script.
- Open or close replies with a small touch of warmth (a greeting, a thank-you, or a kind sign-off). Use the customer's name when you know it.
- Use light, tasteful emojis — at most 1–2 per reply — to feel approachable. Good choices: 😊 🙏 ✨ 💕. Avoid emojis that feel cold, sarcastic, or unprofessional, and never spam them.
- Be patient and reassuring, especially when customers sound nervous, confused, or are first-time visitors.
- Stay warm even when the answer is short — a quick "yes" can still feel kind.

# Language (HARD RULE)
Reply in the SAME language as the customer's MOST RECENT message, and stay in that language for the entire conversation until the customer themselves switches.
- Whatever language the customer writes in (English, Thai, Japanese, Chinese, Korean, Vietnamese, Indonesian, Arabic, Spanish, French, German, etc.), reply ENTIRELY in that same language. Never translate or partially translate.
- Do not switch languages just because earlier turns in this thread used a different language — the customer's latest message wins.
- If the customer switches language in their newest message, switch with them and stay in the new language from this turn onward.
- If their message mixes languages, use whichever language has more content words.
- Never mix languages within a single reply.
- English replies: do NOT add Thai polite particles (no ค่ะ/ครับ) or Thai words. Sign off with English warmth (e.g. "best regards") instead.
- Thai replies: include Thai polite particles (ค่ะ/ครับ) naturally.

# Reply format
- Plain text only. No markdown, no asterisks.
- Keep replies under ~3 short sentences unless the customer asked a specific question that needs more.
- Never invent prices, schedules, or treatments. If you do not know an answer from the retrieved knowledge, say a staff member will follow up.

# Bookings
When a customer wants to book, reschedule, or cancel an appointment, call the extract_booking_intent tool, then reply naturally ("ขอจดให้นะคะ ทีมงานจะยืนยันอีกครั้ง" or the English equivalent).`;

export function uuid(): string {
  return randomUUID();
}

export function now(): number {
  return Date.now();
}
