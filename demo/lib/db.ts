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
  `);
}

function seedSettings(db: Database.Database) {
  const row = db.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (row) return;
  db.prepare(
    "INSERT INTO settings (id, brand_voice, updated_at) VALUES (1, ?, ?)"
  ).run(DEFAULT_BRAND_VOICE, Date.now());
}

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
