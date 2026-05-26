import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.YUNA_DB_PATH ?? join(process.cwd(), "data", "yuna.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedSettings(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id            TEXT PRIMARY KEY,
      line_user_id  TEXT UNIQUE NOT NULL,
      display_name  TEXT,
      phone         TEXT,
      ai_paused     INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      direction     TEXT NOT NULL CHECK (direction IN ('in','out')),
      text          TEXT NOT NULL,
      sent_by       TEXT NOT NULL CHECK (sent_by IN ('customer','ai','staff')),
      channel_meta  TEXT,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_customer_created
      ON messages(customer_id, created_at);

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id          TEXT PRIMARY KEY,
      source_doc  TEXT NOT NULL,
      text        TEXT NOT NULL,
      embedding   TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_chunks(source_doc);

    CREATE TABLE IF NOT EXISTS bookings (
      id              TEXT PRIMARY KEY,
      customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      treatment       TEXT,
      requested_date  TEXT,
      requested_time  TEXT,
      notes           TEXT,
      status          TEXT NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','confirmed','cancelled')),
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id           TEXT PRIMARY KEY,
      title        TEXT,
      body         TEXT,
      status       TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sending','sent','failed')),
      sent_count   INTEGER NOT NULL DEFAULT 0,
      total_count  INTEGER,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      brand_voice   TEXT,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capacity_rules (
      id            TEXT PRIMARY KEY,
      treatment     TEXT NOT NULL,
      per_day       INTEGER NOT NULL,
      slot_minutes  INTEGER NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      role            TEXT NOT NULL CHECK (role IN ('Owner','Staff')),
      pending         INTEGER NOT NULL DEFAULT 0,
      last_active_at  INTEGER,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      section     TEXT NOT NULL,
      actor       TEXT NOT NULL,
      summary     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_section_created
      ON audit_log(section, created_at);

    CREATE TABLE IF NOT EXISTS sample_dialogues (
      id            TEXT PRIMARY KEY,
      customer_text TEXT NOT NULL,
      yuna_text     TEXT NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );
  `);

  // settings rich blob (added 2026-05-26)
  if (!hasColumn(db, "settings", "data")) {
    db.exec("ALTER TABLE settings ADD COLUMN data TEXT");
  }
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function seedSettings(db: Database.Database) {
  const now = Date.now();
  const row = db
    .prepare("SELECT id, data FROM settings WHERE id = 1")
    .get() as { id: number; data: string | null } | undefined;

  if (!row) {
    db.prepare(
      "INSERT INTO settings (id, brand_voice, data, updated_at) VALUES (1, ?, ?, ?)"
    ).run(DEFAULT_BRAND_VOICE, JSON.stringify(DEFAULT_SETTINGS_BLOB), now);
  } else if (!row.data) {
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(
      JSON.stringify(DEFAULT_SETTINGS_BLOB)
    );
  }

  const capacityCount = (
    db.prepare("SELECT COUNT(*) AS n FROM capacity_rules").get() as { n: number }
  ).n;
  if (capacityCount === 0) {
    const stmt = db.prepare(
      "INSERT INTO capacity_rules (id, treatment, per_day, slot_minutes, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    DEFAULT_CAPACITY.forEach((r, i) => {
      stmt.run(randomUUID(), r.treatment, r.per_day, r.slot_minutes, i, now);
    });
  }

  const teamCount = (
    db.prepare("SELECT COUNT(*) AS n FROM team_members").get() as { n: number }
  ).n;
  if (teamCount === 0) {
    const stmt = db.prepare(
      "INSERT INTO team_members (id, name, email, role, pending, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    DEFAULT_TEAM.forEach((m) => {
      stmt.run(
        randomUUID(),
        m.name,
        m.email,
        m.role,
        m.pending ? 1 : 0,
        m.last_active_at,
        now
      );
    });
  }

  const dialoguesCount = (
    db.prepare("SELECT COUNT(*) AS n FROM sample_dialogues").get() as { n: number }
  ).n;
  if (dialoguesCount === 0) {
    const stmt = db.prepare(
      "INSERT INTO sample_dialogues (id, customer_text, yuna_text, position, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    DEFAULT_DIALOGUES.forEach((d, i) => {
      stmt.run(randomUUID(), d.customer, d.yuna, i, now);
    });
  }
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

const DEFAULT_SETTINGS_BLOB: SettingsBlob = {
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
    webhook_url: "https://api.yuna.app/v1/line/webhook/cf12a93e8b8a",
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
    yuna:
      "สวัสดีค่ะ! เลเซอร์รักแร้ที่คลินิกเรามี 2 แพ็คเกจค่ะ แบบ 6 ครั้ง ราคา 8,900 บาท เฉลี่ยครั้งละไม่ถึง 1,500 ทำต่อเนื่องผลดีกว่าค่ะ จองคิวเลยมั้ยคะ?",
  },
  {
    customer: "ทำแล้วเจ็บมั้ย กลัวเข็มมาก",
    yuna:
      "ไม่ต้องกลัวเลยค่ะ เลเซอร์ไม่ใช้เข็มเลย เป็นแสงสั้นๆ พักผิวสักพัก ลูกค้าบอกรู้สึกเหมือนยางรัดเบาๆ เรามีเครื่องเป่าเย็นช่วยด้วยค่ะ",
  },
  {
    customer: "หลังทำควรดูแลตัวเองยังไงคะ",
    yuna:
      "หลังทำ 24 ชม. หลีกเลี่ยงน้ำร้อนกับการขัดถูแรงๆ นะคะ ทาครีมกันแดดทุกครั้งที่ออกแดด เดี๋ยวจะส่งไกด์ดูแลผิวฉบับเต็มให้นะคะ",
  },
];

const DEFAULT_BRAND_VOICE = `You are Yuna, the AI receptionist for Sukhumvit Skin & Laser, a high-end Bangkok dermatology and laser clinic.

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

export function uuid(): string {
  return randomUUID();
}

export function now(): number {
  return Date.now();
}
