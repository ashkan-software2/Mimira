-- Mimira demo schema. Idempotent — safe to re-run.
--
-- Apply with `npm run db:migrate`, which connects via DIRECT_URL (session-mode,
-- not the transaction pooler) so DDL behaves predictably. Runtime queries go
-- through DATABASE_URL (transaction pooler) with prepare:false.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  line_user_id  TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  phone         TEXT,
  ai_paused     BOOLEAN NOT NULL DEFAULT FALSE,
  flags         TEXT,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL CHECK (direction IN ('in','out')),
  text          TEXT NOT NULL,
  sent_by       TEXT NOT NULL CHECK (sent_by IN ('customer','ai','staff')),
  channel_meta  TEXT,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_customer_created
  ON messages(customer_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          TEXT PRIMARY KEY,
  source_doc  TEXT NOT NULL,
  text        TEXT NOT NULL,
  embedding   vector(1024) NOT NULL,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_chunks(source_doc);
-- HNSW + cosine: matches the `<=>` operator we use at query time. Built lazily;
-- on a fresh DB this is fast since there are no rows yet.
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  treatment       TEXT,
  requested_date  TEXT,
  requested_time  TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','confirmed','cancelled')),
  created_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id           TEXT PRIMARY KEY,
  title        TEXT,
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sending','sent','failed')),
  sent_count   INTEGER NOT NULL DEFAULT 0,
  total_count  INTEGER,
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  brand_voice  TEXT,
  data         TEXT,
  updated_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS capacity_rules (
  id            TEXT PRIMARY KEY,
  treatment     TEXT NOT NULL,
  per_day       INTEGER NOT NULL,
  slot_minutes  INTEGER NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  updated_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL CHECK (role IN ('Owner','Staff')),
  pending         BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at  BIGINT,
  created_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  section     TEXT NOT NULL,
  actor       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_section_created
  ON audit_log(section, created_at);

CREATE TABLE IF NOT EXISTS sample_dialogues (
  id            TEXT PRIMARY KEY,
  customer_text  TEXT NOT NULL,
  assistant_text TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    BIGINT NOT NULL
);
