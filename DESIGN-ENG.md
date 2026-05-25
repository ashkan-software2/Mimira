# Engineering Review Appendix

> Companion to [DESIGN.md](DESIGN.md) (core product/architecture) and [DESIGN-UX.md](DESIGN-UX.md) (design review). Added by `/plan-eng-review` on 2026-05-25.

The design-review appendix in [DESIGN-UX.md](DESIGN-UX.md) (8/10) covers UI/UX and visual rules; this appendix covers architecture, code quality, tests, performance, and engineering decisions. **22 decisions resolved (D1–D22), 5 outside-voice findings unresolved, 16 engineering implementation tasks (ET1–ET16).** Each decision has a D-ID for traceability in commits and PRs.

## Engineering Review Additions

These decisions resolve specific architectural gaps in [DESIGN.md](DESIGN.md). Each links to a decision ID (D1–D22).

### Tenant isolation (D1)

**Server-side workers (Inngest functions) authenticate to Postgres via `SET LOCAL app.current_org_id = '<uuid>'` at job start.** RLS policies use `current_setting('app.current_org_id')::uuid` instead of (or in addition to) the JWT claim. This makes RLS the single source of truth for tenant isolation — code cannot forget to filter. Worker invocations without `SET LOCAL` get zero rows back (fail-safe).

User-facing requests continue to use the Supabase JWT `org_id` claim path (unchanged from original plan).

### pgvector index strategy (D2)

**Single shared `ivfflat` index on the embedding column + `WHERE org_id = ?` pre-filter** in every retrieval query. Tune `lists ≈ sqrt(N)` where N is the total chunk count across all clinics. NOT per-tenant partial indexes (didn't scale, would fight the ≤1-day-onboarding metric).

Migration path: switch to HNSW with `hnsw.iterative_scan = 'strict_order'` (pgvector ≥ 0.7) once a single clinic's corpus exceeds ~20k chunks or recall complaints surface.

### Reply policy (D3)

**Reply-token-only path with hard 50s budget** for inbound chat. Reply API used exclusively. If `embed + retrieval + LLM` cannot complete in 50s (10s buffer for network → 60s Line cap), fall back to a quick Thai ack ("พิมพ์อยู่นะคะ ทีมงานจะตอบกลับเร็วๆ นี้") and route to staff escalation inbox. Push API is reserved for broadcast + scheduled aftercare. Zero push-quota cost for ordinary chat.

### Judge classifier (D4)

**Small dedicated fast model (Claude Haiku OR Gemini Flash, hard-coded across all clinics) acts as the aftercare judge, running pre-send.** Independent of the clinic's chosen generator (breaks circular trust). On timeout / rate-limit / error / 5xx: do NOT send the AI reply — route to staff escalation. Fail-safe by construction.

Judge prompt is stable across all clinics → marked as a prompt-cache breakpoint on Anthropic to halve latency + cost.

### Observability (D5)

**Wire Sentry + Vercel Observability + Inngest DLQ alerts in week 1.** Alert rules: webhook signature failure rate >0, DLQ depth >0, judge classifier error rate >5%, scheduled_messages stuck in `sending` >24h. Email alerts v0 (Slack webhook later). Plan for migration to Datadog / Better Stack once revenue justifies.

### Secrets storage (D6)

**Drop the "master key in Vercel env" line.** Use Supabase Vault's built-in server-managed encryption directly. Per-clinic LLM API keys + Line OA channel credentials encrypted at rest via Vault. Decryption in-process via the standard Supabase Vault client.

v1 migration path documented: move wrapping key to AWS KMS or GCP KMS once revenue justifies (~$1/mo + audit log + rotation).

### Webhook replay protection (D7)

**Inngest idempotency key = Line's `webhookEventId`** on every event emitted from the webhook handler. Inngest dedupes within its default 24h window. No extra `processed_webhook_events` table to maintain.

### LLM provider abstraction (D8)

**Thin internal `Provider` interface with explicit v0 feature contract:**

```ts
interface Provider {
  complete(args: {
    messages: Message[];
    maxTokens: number;
    temperature: number;
    cacheControl?: CacheBreakpoint;  // for prompt caching (Anthropic / Gemini)
  }): Promise<{ text: string; usage: TokenUsage }>;
}
```

Three implementations: `openai.ts`, `anthropic.ts`, `google.ts`. **Explicitly deferred v0:** streaming, tool use, vision, function calling. When clinic asks, extend the interface intentionally.

Anthropic path wires prompt caching on the system-prompt + brand-voice + safety-prompt prefix from week 3. OpenAI auto-caches prefixes ≥1024 tokens (no code). Gemini explicit cache wired week 4 if Google selected by any clinic.

### Failure modes (D9)

**New section below** consolidates customer-facing failure modes with the exact Thai message customers see, the staff-visible event, and the alert routing per failure type.

### Channel adapter interface (D10)

**Defined inline:**

```ts
interface ChannelAdapter {
  verifySignature(req: Request): boolean;
  normalizeInbound(req: Request): Promise<InternalMessage>;
  sendReply(token: string, text: string): Promise<void>;
  sendPush(userId: string, text: string): Promise<{ quotaUsed: number }>;
  getQuotaStatus(): Promise<{ used: number; limit: number; resetsAt: Date }>;
}

interface InternalMessage {
  id: string;            // dedup key (Line webhookEventId for Line)
  orgId: string;
  customerId: string;    // Line userId, normalized
  text: string | null;   // null for image/sticker/audio
  attachmentKind: 'text' | 'image' | 'sticker' | 'audio' | 'video';
  channelMeta: Record<string, unknown>;  // Line-specific raw payload
  receivedAt: Date;
}
```

Week 1 implementation: `LineAdapter` against this interface. Channel #2 (FB/IG/WA) implements the same interface = no core rewrite.

### Image handling (D20, customized)

On image / sticker / audio / video inbound, AI politely replies in Thai (per-clinic brand voice):

> "ขอโทษนะคะ ระบบยังดูรูปไม่ได้ค่ะ จะให้ถามข้อความได้ไหมคะ หรืออยากให้ทีมงานช่วยดูรูปคะ?"

Two paths offered to the customer:
1. **Reformulate as text** → AI handles normally.
2. **Send to human staff** → escalation queue.

Customer picks via free-text reply. Heuristic intent detection (does reply contain "ส่ง", "ทีมงาน", "พนักงาน", "human", "staff" → escalate; anything else → treat as text turn). Does NOT require multimodal LLM. Reduces escalation flood vs the mute-fallback in the original plan.

Measurement gate: during clinic #1 shadowing (week 0) + first week live, log photo-first %. If >40%, fast-follow with a real multimodal LLM (Claude/GPT-4o/Gemini vision) in week 8 buffer.

### Env separation (D12)

**Two Supabase projects (yuna-prod, yuna-staging) + Vercel preview branches → staging in week 1.** Synthetic test clinic + test customers seeded in staging. Migrations run staging-first, then prod via CI gate. ~half day setup.

### Test stack (D15)

**Vitest (unit/integration) + Playwright (E2E) + Promptfoo (LLM evals).** All locked in week 1. CI gates merge on critical-path test pass. See **TEST-PLAN.md** for the full coverage diagram and what /qa should consume.

### Critical-path tests, week-attached (D13)

Each test is a CI-blocking deliverable in its named week.

| Week | Test | Why |
|------|------|-----|
| 1 | RLS leak across all tables (2 test orgs, 10 rows each, assert 0 cross-tenant visibility) | Tenant isolation foundation; ship-blocking |
| 1 | Worker SET LOCAL fail-safe (worker without SET LOCAL → 0 rows) | Confirms RLS policy denies workers that forget the SET |
| 2 | Webhook signature regression (known-good + known-bad fixtures, bit-exact) | Line spec compliance |
| 2 | Replay protection (same webhookEventId 2× → 2nd is no-op) | Idempotency invariant |
| 3 | Reply-token budget enforcement (simulate LLM > 50s → fallback + escalate; no use-after-expiry) | Customer-facing latency contract |
| 3 | Provider contract tests (same input → same output shape on 3 providers) | Adapter correctness |
| 5 | scheduler state machine (full lifecycle + retry × 3 → DLQ + idempotency re-fire) | >90% delivery promise |
| 6 | Aftercare 50-turn safety eval (no diagnosis leaks) | Medical safety |
| 6 | Judge fail-safe (kill judge endpoint → AI reply NOT sent + escalate) | Medical safety + judge resilience |
| 6 | Push-quota guardrail (quota=5, broadcast to 10 → halts at 5 + admin error) | Quota cliff prevention |
| 7 | DSAR round-trip (export → delete → re-export 404 + audit retained) | PDPA compliance |

### Performance optimizations (D16, D17)

- **Embedding cache:** Normalized-query LRU on inbound (in-memory per worker; Redis-Upstash later). Knowledge ingest uses Cohere batch API (96 docs/call). Reduces inbound embed cost ~70% and ingest time from ~60min to ~5min for 5k chunks.
- **LLM prompt caching (Anthropic path, week 3; Google week 4):** system + brand-voice + safety prompt marked as cache breakpoint. ~90% reduction in cached-token cost + 50–150ms latency improvement per reply. Judge prompt also cached (stable across calls).
- **Aftercare concurrency:** Inngest `concurrency` directive — max 5 concurrent jobs per clinic, max 20 globally per LLM provider, max 10 per Line OA push channel. Random 0–60s jitter added to `scheduled_for` so 9:00 customers spread to 9:00–9:01.

### Hosting / region (D22c)

**Stay on Supabase + Vercel + Inngest in Singapore region for v0.** Plan explicitly commits to Bangkok migration when EITHER (a) a clinic's lawyer formally requires Thailand-resident patient data, OR (b) Supabase opens a Bangkok region, OR (c) Yuna revenue exceeds the cost of self-hosting on AWS Bangkok. DPA template addresses cross-border transfer (Singapore↔Thailand) — PDPA adequacy is well-established. Honest framing in clinic conversations: "patient data in Singapore now, with documented migration trigger." Note: Bangkok was preferred but no managed-vendor combo offers it today (May 2026); LLM/Cohere are US-hosted regardless and surfaced via sub-processor disclosure.

### AI kill-switch (outside-voice add)

- **Per-clinic toggle in Settings:** "Pause AI for this clinic — route all to staff." One click. Owner-only.
- **Per-conversation toggle in inbox:** "Turn off AI for this customer." Staff-accessible.
- Both ship in week 4 alongside the admin inbox.

> Note: the existing design-review appendix (Settings "9 sections" + Inbox layout) already supports both controls. AI brain card (#3) gets a kill switch toggle. Active thread gets a per-conversation pause action next to "Take over chat".

---

## Customer-Facing Failure Modes (D9)

| Error | Action | Customer sees (Thai) | Staff sees | Alert |
|-------|--------|----------------------|------------|-------|
| Webhook signature invalid | Drop request, 401 to Line | Nothing (Line retries) | Nothing | Sentry: signature_fail_rate spike |
| Replay (duplicate eventId) | Idempotent no-op, 200 to Line | Nothing | Nothing | Inngest dashboard only |
| Reply-token budget reached | Send Thai ack + escalate | "พิมพ์อยู่นะคะ ทีมงานจะตอบกลับเร็วๆ นี้" | Chat appears in escalation queue, tagged "slow LLM" | Sentry: slow_reply_count spike |
| LLM rate limit (5xx) | Exponential backoff inside 50s budget; if budget exhausted → escalate | Same as above OR normal reply if backoff succeeded | Tagged "llm_rate_limit" if escalated | Daily digest if > 5% of replies |
| LLM provider auth fail (clinic key rotated) | Escalate + alert admin | "พิมพ์อยู่นะคะ ทีมงานจะตอบกลับเร็วๆ นี้" | Banner in Settings: "LLM key invalid, please update" | Email to owner immediately |
| RAG returns 0 chunks | LLM call with no context → typically escalates | Generic "ขออภัยค่ะ ดิฉันยังไม่มีข้อมูลในส่วนนี้ ขอส่งให้ทีมงานช่วยดูนะคะ" | Tagged "no_rag_match" | Weekly: top no-match queries for knowledge expansion |
| Judge classifier fails (5xx / timeout) | Do NOT send AI reply → escalate | Same generic escalation message | Tagged "judge_fail" | Sentry: judge_fail_rate >5% |
| Embedding (Cohere) fails | Retry once → fall back to keyword RAG OR escalate | Generic escalation if both fail | Tagged "embed_fail" | Sentry alert |
| Scheduled message in DLQ | Inngest DLQ + alert | Nothing (D1/D7 reminder didn't send) | Banner in inbox: "Aftercare reminder failed for {customer}" | Email immediately |
| Push quota exceeded mid-broadcast | Hard-stop send, error to owner | Partial broadcast (some received) | Owner sees: "Broadcast halted at N/M, quota exhausted, override?" | None (user-driven) |
| RLS policy denies legit query | 403 to admin UI | N/A | "Access denied" banner with copy of attempted org_id claim | Sentry: rls_denial spike (catches mis-scoped JWT bugs) |
| Image / sticker / audio inbound | Polite Thai ack + offer choice (D20) | "ขอโทษนะคะ ระบบยังดูรูปไม่ได้ค่ะ จะให้ถามข้อความได้ไหมคะ หรืออยากให้ทีมงานช่วยดูรูปคะ?" | Tagged "non_text_inbound" | Weekly: photo-first % per clinic |

---

## ASCII Diagrams (D11)

### Webhook event flow (Line → reply or escalate)

```
                   ┌───────────────────────────────────┐
Line OA ── HTTP ──>│ POST /api/line/webhook (Vercel)   │
                   │  1. HMAC-SHA256 sig verify        │── 401 if bad sig ──> drop
                   │  2. Detect inbound kind           │
                   │  3. emit Inngest event            │
                   │     id = Line webhookEventId      │── 200 OK <1s ────> Line (ack)
                   └───────────────┬───────────────────┘
                                   │  (idempotency key = eventId)
                                   ▼
                   ┌───────────────────────────────────┐
                   │  Inngest worker: chat.reply       │
                   │  ┌─────────────────────────────┐  │
                   │  │ SET LOCAL app.current_org_id│  │
                   │  └─────────────────────────────┘  │
                   │  ┌─────────────────────────────┐  │
                   │  │ load org cfg + conv history │  │  ⬅ Postgres RLS-scoped
                   │  └─────────────────────────────┘  │
                   │  ┌─────────────────────────────┐  │
                   │  │ embed query (Cohere; cache) │  │
                   │  └─────────────────────────────┘  │
                   │  ┌─────────────────────────────┐  │
                   │  │ pgvector (ivfflat) + filter │  │  ⬅ WHERE org_id = ?
                   │  └─────────────────────────────┘  │
                   │  ┌─────────────────────────────┐  │
                   │  │ Provider.complete (cached)  │  │  ⬅ Anthropic/OpenAI/Google
                   │  └─────────────────────────────┘  │
                   │  ┌─ aftercare context only? ──┐   │
                   │  │ judge.classify (Haiku)     │   │  ⬅ fail → escalate
                   │  └────────────────────────────┘   │
                   │  ┌─────────────────────────────┐  │
                   │  │ budget check (<50s used?)   │  │── budget over ─> escalate
                   │  └─────────────────────────────┘  │
                   │  ┌─────────────────────────────┐  │
                   │  │ LineAdapter.sendReply(tok)  │  │── error ─> escalate
                   │  └─────────────────────────────┘  │
                   └───────────────────────────────────┘
```

### Tenant isolation: user path + worker path

```
USER REQUEST PATH                       INNGEST WORKER PATH
─────────────────                       ───────────────────
HTTP request                            Inngest event fires
   │                                       │
   ▼                                       ▼
JWT in Authorization header             worker.start()
   │ (org_id claim signed by              │
   │  Supabase Auth)                       │  job.org_id from event payload
   ▼                                       ▼
Supabase client (PostgREST)             SET LOCAL app.current_org_id = $1;
   │ uses auth.jwt() in policies          │
   ▼                                       ▼
Postgres RLS policy                     Postgres RLS policy
USING (org_id = (auth.jwt()             USING (org_id =
        ->> 'org_id')::uuid)              current_setting('app.current_org_id')::uuid)
   │                                       │
   ▼                                       ▼
returns org-scoped rows                 returns org-scoped rows
(or 0 rows if claim missing)            (or 0 rows if SET LOCAL missing) <- FAIL-SAFE
```

### Aftercare scheduler state machine

```
                ┌──────────┐
   (D1/D7 job   │ pending  │
    scheduled)  └────┬─────┘
                     │ Inngest fires at scheduled_for + jitter
                     ▼
                ┌──────────┐
                │ sending  │── timeout (>60s) ──┐
                └────┬─────┘                     │
                     │ Line API call             │
                     │                           │
        ┌────────────┼────────────┐              │
        │ success    │ fail (5xx) │              │
        ▼            ▼            ▼              │
   ┌────────┐   retry < 3?     retry >=3 ◀──────┘
   │  sent  │   ├── yes → sending (backoff)
   └────────┘   └── no  → ┌──────┐
                          │ DLQ  │── alert owner via email
                          └──────┘
   re-fire same scheduled_message_id while sent? → no-op (idempotency)
   customer requests deletion mid-cycle?         → state = cancelled
```

### Judge classifier decision tree

```
   AI generates aftercare reply
              │
              ▼
   ┌──────────────────────────────┐
   │ judge.classify(reply, ctx)   │  ⬅ small model (Haiku/Flash)
   │  prompt-cached on Anthropic  │
   └──────────────┬───────────────┘
                  │
       ┌──────────┼──────────────┐
       │ ok       │ unsafe       │ error / timeout / 5xx
       ▼          ▼              ▼
   send reply  do NOT send    do NOT send
   to customer + escalate     + escalate
                + log to       + log to
                audit_events   audit_events
                with verdict   with verdict='judge_unavailable'
```

---

## Worktree Parallelization Strategy

The plan is mostly sequential by week, but two parallelization opportunities exist within and across weeks.

| Step | Modules touched | Depends on |
|------|----------------|------------|
| W1-schema | db/migrations, db/policies, lib/auth | — |
| W2-webhook | app/api/line, lib/channel-adapter | W1-schema |
| W2-knowledge | app/admin/knowledge, lib/rag, lib/embeddings | W1-schema |
| W3-chat | lib/chat-pipeline, lib/llm-providers | W2-webhook, W2-knowledge |
| W4-inbox | app/admin/inbox, lib/escalation | W3-chat |
| W4-killswitch | app/admin/settings, lib/ai-toggle | W3-chat |
| W5-scheduler | lib/scheduler, db/scheduled_messages | W1-schema |
| W5-bookings | app/admin/bookings, lib/booking-capture | W3-chat |
| W6-broadcast | app/admin/broadcasts, lib/broadcast | W5-scheduler |
| W6-aftercare-safety | lib/judge, lib/guardrails, db/audit_events | W3-chat, W5-scheduler |
| W7-dsar | app/admin/dsar, lib/retention | W1-schema |

**Parallel lanes:**
- **Lane A (foundational):** W1-schema (must finish before anything else)
- **Lanes B + C parallel after W1:** B = W2-webhook → W3-chat (critical path), C = W2-knowledge (parallel to webhook, both depend only on schema)
- **Lanes D + E parallel after W3:** D = W4-inbox + W4-killswitch, E = W5-scheduler + W5-bookings
- **Lanes F + G parallel after W5:** F = W6-broadcast, G = W6-aftercare-safety
- **Lane H sequential:** W7-dsar (depends only on schema; could parallel earlier if engineers free)

**Conflict flags:**
- W4-inbox + W4-killswitch both touch `app/admin/` — merge carefully (or sequence within Lane D).
- W6-broadcast + W6-aftercare-safety both depend on `lib/scheduler` from W5 but touch different modules — safe to parallel.

---

## NOT in Scope (Engineering)

- **Multimodal image understanding LLM** — deferred until photo-first inbound rate measured during clinic #1 shadowing. Fast-follow in week 8 buffer if >40%.
- **KMS-based wrapping key (AWS KMS / GCP KMS)** — v1 upgrade from Vault built-in.
- **Bangkok hosting migration** — documented trigger, deferred until trigger fires.
- **Streaming LLM responses** — explicitly excluded from v0 Provider interface.
- **Tool use / function calling in LLM** — deferred; not needed for v0 chat shape.
- **Brand voice eval, knowledge grounding eval, Thai fluency benchmark, judge FP/FN eval** — deferred to **TODOS.md** per user direction during this review (D14).
- **Multi-org user (cofounder owns multiple clinics)** — UI/routing deferred to first multi-org owner request.

(Items already deferred by the design appendix and original plan are not duplicated here.)

---

## Unresolved Decisions (Engineering)

The following outside-voice findings surfaced during /plan-eng-review but did not receive a yes/no — NOT applied to the plan today. Re-decide before week 1.

1. **Cofounder agreement as week-0 blocker** — plan still has it as "Assignment" afterthought (see [DESIGN.md](DESIGN.md) §The Assignment). Recommend elevating to a hard precondition before week 1 schema work.
2. **Reframe "≤1 day onboarding" metric** to "≤1 day of OUR work after clinic delivers creds + knowledge" (see [DESIGN.md](DESIGN.md) §Success Criteria).
3. **PDPA consent UX** — append-to-first-reply (with link to clinic privacy notice) vs the current standalone-wall consent message (see [DESIGN.md](DESIGN.md) §PDPA Compliance). Lawyer review before week 6.
4. ~~**Pre-send quota hard-block** for aftercare + broadcast~~ — **RESOLVED 2026-05-25: no in-app quota awareness in v0.** Pulling per-OA quota from Line in real time is operationally awkward, and the clinic already sees the canonical number in Line OA Manager. v0 ships no pre-send guard and no readout; Line server-side enforces, and Yuna surfaces partial sends in the broadcast log as `Stopped early` with the partial recipient count. The Line adapter still exposes `getQuotaStatus()` for server-side use (rate-limit guard around aftercare bursts) but no UI consumes it in v0. See [DESIGN.md](DESIGN.md) §Line API Constraints and [DESIGN-UX.md](DESIGN-UX.md) Unresolved #8.
5. **Front-desk shadowing as week-0 HARD GATE** (vs week-0 nice-to-have) — plan currently has the shadowing recommendation in [DESIGN.md](DESIGN.md) §The Assignment but doesn't gate week 1 schema work on it.

> See **TODOS.md** for the full list of unresolved + deferred items.

---

## Engineering Implementation Tasks (ET1–ET16)

Synthesized from this review's findings. Each task derives from a specific decision above. Runs alongside the design appendix's T1–T10 (no ID collision: design = `T*`, engineering = `ET*`).

| ID | Priority | Effort (human / CC) | Component | Task | Source finding |
|---|---|---|---|---|---|
| ET1 | P1 | ~6h / ~45min | db/policies | Implement SET LOCAL pattern + RLS policies using `current_setting` | Architecture A1 (D1) |
| ET2 | P1 | ~2h / ~15min | db/migrations | Single shared ivfflat index + tune `lists` parameter | Architecture A2 (D2) |
| ET3 | P1 | ~4h / ~30min | lib/chat-pipeline | 50s reply-token budget enforcement + Thai fallback | Architecture A3 (D3) |
| ET4 | P1 | ~4h / ~30min | lib/judge | Haiku/Flash judge + fail-to-escalate behavior | Architecture A4 (D4) |
| ET5 | P1 | ~3h / ~20min | observability | Wire Sentry + Inngest DLQ alerts + alert rules | Architecture A5 (D5) |
| ET6 | P1 | ~2h / ~10min | secrets | Use Supabase Vault built-in (remove master-key-in-Vercel-env) | Architecture A6 (D6) |
| ET7 | P1 | ~30min / ~5min | webhook | Inngest idempotency key on event emit | Architecture A7 (D7) |
| ET8 | P1 | ~6h / ~45min | lib/llm-providers | Thin Provider interface + 3 adapters + `cacheControl` | Code-quality C1 (D8) |
| ET9 | P1 | ~4h / ~20min | channel-adapter | Define ChannelAdapter interface + Line implementation | Code-quality C3 (D10) |
| ET10 | P1 | ~4h / ~30min | env-separation | Supabase staging project + Vercel preview wiring | Code-quality C5 (D12) |
| ET11 | P1 | ~3h / ~20min | lib/embeddings | LRU cache + Cohere batch API for ingest | Perf P1 (D16) |
| ET12 | P1 | ~2h / ~15min | inngest | Concurrency directives + scheduled-for jitter | Perf P2 (D17) |
| ET13 | P1 | ~8h / ~1h | image-handling | Politely offer text-or-escalate path | Outside voice + D20 |
| ET14 | P1 | ~3h / ~20min | ai-killswitch | Per-clinic + per-conversation pause toggles | Outside voice O-9 |
| ET15 | P1 | ~2h / ~15min | tests | Critical-path test scaffolding (all 11 from D13) | Test review T1 (D13) |
| ET16 | P2 | ~2h / ~15min | docs | Hosting decision documentation (Singapore + BKK migration trigger) | Outside voice + D22c |

> Full JSONL form: `~/.gstack/projects/ashkan-software2-Yuna/tasks-eng-review-20260525-161034.jsonl` (consumed by `/autoplan`).

> Test plan with full coverage diagram + 53-path audit: see **TEST-PLAN.md** in this repo.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | unavailable | codex CLI not installed in this environment |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN (PLAN) | 14 issues found, 0 critical gaps, 5 unresolved (cofounder week-0, onboarding metric reframe, PDPA consent UX, pre-send quota hard-block, front-desk shadowing as hard gate); 22 decisions resolved D1–D22; 16 tasks ET1–ET16 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES_OPEN | score 3/10 → 8/10, 8 unresolved decisions surfaced, screen inventory + state matrix + 2 journey storyboards + AI-slop hard rules + responsive/a11y added; 10 P1–P3 tasks T1–T10 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **OUTSIDE-VOICE (eng):** Claude subagent ran (codex unavailable). 11 findings; 2 cross-model tensions surfaced (D19 judge classifier kept pre-send LLM judge; D20 image handling adopted custom UX). 4 non-tension findings adopted into plan; 5 unresolved (see Unresolved (Engineering) section above).
- **CROSS-MODEL:** 1 substantive tension (D19) — user chose pre-send LLM judge over outside voice's hybrid regex+async-audit.
- **UNRESOLVED:** 8 design decisions (see [DESIGN-UX.md](DESIGN-UX.md) §Unresolved Design Decisions) + 5 engineering outside-voice findings = 13 total. Re-decide before week 1.
- **VERDICT:** Plan is architecture-complete (eng review ✓), design-complete (design review ✓), and implementation-ready in structure. 13 unresolved decisions block "fully cleared" status. Codex/CEO/DX reviews not run; eng + design are the required gates and both have run. Optional next: `/plan-ceo-review` to validate the wedge under outside-voice's "image-first inbound" strategic concern, and `/design-consultation` before week 2 to lock the visual system.
