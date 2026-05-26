# Demo Plan — Single-Client Stripped Build

> Companion to [DESIGN.md](DESIGN.md), [DESIGN-ENG.md](DESIGN-ENG.md), [DESIGN-UX.md](DESIGN-UX.md), [DESIGN-UI.md](DESIGN-UI.md). Generated 2026-05-26.
>
> This is the **demo** version of the plan — one clinic, no multi-tenancy, no test infrastructure, no compliance plumbing. Goal: a working Line integration with chat replies, an appointment queue, and a broadcast composer that we can show off in ~2 weeks instead of 8. The full plan is the production target; this doc is the runway.

## Scope

**In:**
1. Line OA webhook → ack < 1s → AI replies in Thai using clinic's knowledge.
2. Admin Inbox: see all conversations, take over, reply manually.
3. Admin Bookings: queue of captured appointment intents, confirm/cancel.
4. Admin Broadcasts: compose, send to all known customers.
5. Knowledge upload: text/markdown files chunked + embedded for RAG.
6. Settings: single brand-voice textarea, Line creds, Anthropic key.

**Out (deferred to full plan, see [DESIGN-ENG.md](DESIGN-ENG.md)):**
- Multi-tenancy / RLS / `org_id` plumbing.
- Aftercare D1/D7 followups + scheduler state machine + DLQ.
- Medical-safety judge classifier + `audit_events` table + 50-turn eval.
- PDPA consent flow, DSAR endpoint, retention TTL, sub-processor disclosure UI.
- LLM provider abstraction — Claude is hardcoded.
- Supabase Vault — secrets live in env vars.
- Image / sticker / audio handling beyond a single static Thai apology.
- AI kill-switch toggles, roles (owner/staff), staff invites.
- Reply-token 50s budget enforcement + retries + Thai fallback ack.
- Embedding cache, Cohere batch ingest, prompt caching, Inngest concurrency tuning.
- Staging vs prod env separation.
- Vitest / Playwright / Promptfoo / CI gates — **no tests** for the demo.
- Sentry, DLQ alerts, observability tooling.

## Stack

| Component | Demo choice | Why |
|---|---|---|
| App | Next.js 15 App Router + TS | Same as full plan; one deploy hosts webhook + admin UI. |
| DB | Supabase Postgres + pgvector | Same as full plan, **no RLS policies**. |
| Auth | Supabase Auth magic link, one admin user | Skip role plumbing entirely. |
| LLM | Anthropic Claude (`claude-sonnet-4-6` default) | Hardcoded. No provider abstraction. |
| Embeddings | Cohere `embed-multilingual-v3` (1024-dim) | Same as full plan, called inline. No cache. |
| Scheduler / async | Inngest free tier | Same as full plan, but only used for (a) webhook handoff and (b) broadcast fan-out. No state-machine table. |
| Channel | Line Messaging API (reply + push) | Direct calls, no `ChannelAdapter` interface. |
| Secrets | `.env.local` + Vercel env vars | One clinic, no rotation, no Vault. |
| Hosting | Vercel + Supabase Singapore + Inngest | Same as full plan. |

## Schema (no `org_id` anywhere)

```sql
-- One row per Line user we've heard from
customers (
  id            uuid pk,
  line_user_id  text unique,
  display_name  text,
  phone         text null,
  created_at    timestamptz default now()
)

-- Inbound + outbound message log
messages (
  id            uuid pk,
  customer_id   uuid references customers,
  direction     text check (direction in ('in','out')),
  text          text,
  sent_by       text check (sent_by in ('customer','ai','staff')),
  channel_meta  jsonb,
  created_at    timestamptz default now()
)

-- RAG corpus
knowledge_chunks (
  id          uuid pk,
  source_doc  text,
  text        text,
  embedding   vector(1024)
)
-- single ivfflat index, lists=100 is fine for demo volume

-- Appointment intents captured from chat or manually added
bookings (
  id              uuid pk,
  customer_id     uuid references customers,
  treatment       text,
  requested_date  date,
  requested_time  time,
  notes           text,
  status          text check (status in ('new','confirmed','cancelled')) default 'new',
  created_at      timestamptz default now()
)

-- Broadcast history
broadcasts (
  id           uuid pk,
  title        text,
  body         text,
  status       text check (status in ('draft','sending','sent','failed')) default 'draft',
  sent_count   int default 0,
  total_count  int,
  created_at   timestamptz default now()
)

-- Single-row config
settings (
  id            int pk default 1 check (id = 1),
  brand_voice   text,
  updated_at    timestamptz default now()
)
```

That's it — 6 tables. The full plan has ~15.

## Chat pipeline (the heart of the demo)

```
Line webhook POST /api/line/webhook
  ├─ HMAC-SHA256 signature verify  (still mandatory — Line rejects otherwise)
  ├─ insert messages row (direction='in')
  ├─ emit Inngest event "chat.received" with replyToken
  └─ 200 OK  (< 1s)

Inngest fn "chat.received"
  ├─ if attachmentKind != 'text': send static Thai apology via reply API, done
  ├─ load last 10 messages for this customer  (no RLS, simple SELECT)
  ├─ Cohere embed of inbound text
  ├─ pgvector top-5 from knowledge_chunks
  ├─ Claude call:
  │     system = settings.brand_voice + safety preamble + retrieved chunks
  │     messages = last 10 turns + new inbound
  │     tools = [extract_booking_intent]      ← optional, see below
  ├─ if Claude returned tool_use(extract_booking_intent): insert bookings row
  ├─ send Claude's text reply via Line reply API
  └─ insert messages row (direction='out', sent_by='ai')
```

**Booking intent capture:** use a Claude tool-call (`extract_booking_intent` with `treatment`, `date`, `time`, `notes` params). Simpler than a separate classifier model, and the LLM is already in-loop. If the tool fires, we (a) save to `bookings` and (b) the reply text still goes through normally — Claude can naturally say "ขอจดให้นะคะ ทีมงานจะยืนยันอีกครั้ง" because the system prompt tells it to.

## Admin UI

Five pages. Use the mockups in `/mockups` ([DESIGN-UX.md](DESIGN-UX.md), [DESIGN-UI.md](DESIGN-UI.md)) as the visual target — they were drawn for the full plan but the layouts work fine for single-tenant.

| Page | Demo behavior |
|---|---|
| **Inbox** | List customers ordered by most recent message. Click → thread view. "Take over" button suppresses AI for that customer (just a `customer.ai_paused boolean` — add it if you want, otherwise skip). Manual reply sends via Line push API. |
| **Bookings** | Table of `bookings` with status filter. Confirm/cancel updates `status`. No calendar integration. |
| **Broadcasts** | Compose form (title, body, "send to all"). On send: insert `broadcasts` row + emit Inngest event that fans out one job per `customers` row, each calling Line push. Progress bar polled from `sent_count`. Line will reject mid-send when monthly push quota is exhausted → reflect partial count in the row, no in-app quota readout (matches full plan D9/D22). |
| **Knowledge** | Upload `.md`/`.txt`. On upload: split on headings (~500 char chunks), Cohere embed each, insert into `knowledge_chunks`. Show list of source docs with delete. |
| **Settings** | One textarea for `brand_voice`. Line/Anthropic/Cohere keys live in env vars for demo — don't even put them in the UI. |

## Build order (~2 weeks, 1 engineer)

**Days 1–2 — foundations + Line:**
- `npx create-next-app` + Supabase project + Inngest project.
- Migrations for the 6 tables above. No RLS.
- `/api/line/webhook` route: signature verify, insert inbound row, emit Inngest event, ack 200.
- Inngest function that just echoes "OK ค่ะ" via reply token. End of day 2: we can talk to the bot and get a reply.

**Days 3–4 — RAG + smart chat:**
- Knowledge upload page (no chunking sophistication — split on `\n\n` headers + length cap).
- Cohere embed wired, pgvector index created.
- Replace the echo with the real Claude pipeline above. End of day 4: bot answers a real question from the knowledge base.

**Day 5 — Inbox + booking capture:**
- Inbox list + thread view (SSR, server actions for reply).
- Add `extract_booking_intent` tool to Claude call; insert `bookings` row on tool_use.
- Bookings page (table + confirm/cancel actions).

**Days 6–7 — Broadcasts + Settings:**
- Compose form + Inngest fan-out job.
- Settings page (just brand_voice for now).

**Days 8–10 — buffer:**
- Demo polish: empty states, loading states, Thai font, the things you only notice when you start clicking around.
- Fix whatever the clinic owner asks for after seeing it live.

## What we lose by skipping the full plan

This is the honest list — read it before showing the demo, because the clinic owner WILL ask about some of these:

1. **No medical safety guardrails.** Claude with a careful system prompt is doing all the work. Acceptable for a sandboxed demo with the founder watching; **not acceptable** for real patient traffic, even a tiny bit. The aftercare judge + audit log is the #1 thing to add back before any real customer messages flow.
2. **No tenant isolation.** Adding clinic #2 means a real refactor — `org_id` on every table, RLS policies, JWT claim wiring. Plan for ~1 week of refactor before the second clinic ships.
3. **No PDPA flow.** No consent message, no DSAR endpoint. Fine for a demo with a friendly first clinic; legally cannot run on real Thai customer data without it.
4. **Secrets in env vars.** Fine for one clinic with one set of creds. Anyone with Vercel access reads them in plaintext.
5. **No retries on Line failures.** If the Line API 5xx's, the customer's message gets no AI reply — they'll see it in the inbox eventually but nothing prompts them. Full plan has the 50s budget + Thai ack fallback.
6. **No aftercare followups.** Not in scope per request — if the demo conversation goes "but does it also message them on day 1 and day 7?" the answer is "yes, that's in the full plan, ~1 week of work to add."
7. **No tests.** Refactoring back to multi-tenant without a test suite is going to hurt. Budget the test scaffolding (D13, ~1 week) as part of the multi-tenant refactor, not after.

## Path back to the full plan

The demo is a deliberate fork. To converge with [DESIGN-ENG.md](DESIGN-ENG.md):

1. Add `org_id uuid` to every table + RLS policies (ET1, ET2).
2. Wire Supabase Auth `org_id` JWT claim + `SET LOCAL` for workers.
3. Lift Claude calls behind the `Provider` interface (ET8).
4. Wrap Line behind the `ChannelAdapter` interface (ET9).
5. Move secrets into Supabase Vault (ET6).
6. Add the aftercare scheduler + judge classifier + audit log (ET3, ET4, T-aftercare).
7. Add PDPA consent + DSAR + retention TTL.
8. Add the test stack (D15) and the 11 critical-path tests (D13).
9. Add Sentry + Inngest DLQ alerts (ET5).

Roughly ~4 weeks of refactor to go from demo-grade to "Approach B" production-grade, assuming the demo schema and pipeline are clean. Don't let the demo's missing-`org_id` rot — keep it as a single hardcoded UUID constant in code so the eventual `WHERE org_id = ?` lift is mechanical.
