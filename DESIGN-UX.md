# Design Review Appendix

> Companion to [DESIGN.md](DESIGN.md) (core product/architecture) and [DESIGN-ENG.md](DESIGN-ENG.md) (engineering review). Added by `/plan-design-review` on 2026-05-25.

The product/architecture body in [DESIGN.md](DESIGN.md) is solid (8/10). This appendix takes the plan from architecture-complete to design-complete: screen inventory, interaction states, user journeys, AI-slop hard rules, responsive + a11y, and 8 unresolved decisions that will haunt week 1 if left ambiguous.

Initial design completeness: **3/10**. After this appendix: **8/10** (gated on the 8 unresolved decisions getting owner input).

## Screen Inventory & Information Hierarchy

The admin app has 5 tabs. Each screen below lists purpose, what the user sees first/second/third, primary CTA, and any edge that affects layout.

### Inbox (default landing tab, most-used)
**Purpose:** Staff sees live + escalated chats, can take over any thread, can manually reply.
**Information hierarchy:**
1. **Escalated chats list** (left rail) — sorted by escalation timestamp newest-first. Each row: customer Line display name, last message preview (1 line, truncated), escalation badge (amber = "Needs attention" — collapses tripwire + low-confidence; blue = "Staff requested" — customer asked for human), age in minutes.
2. **Active chat thread** (center column) — full message history. Mimira's replies tagged with a subtle "Mimira" badge; staff replies tagged with staff initials. Auto-scrolls to latest. RAG sources for each Mimira reply shown inline (collapsible).
3. **Customer context** (right rail) — Line user ID, phone (if captured), previous bookings, language, audit log link.

**Primary CTA:** "Take over chat" (top-right of active thread). Pressing it puts Mimira silent for that thread; staff types in the composer at the bottom.

**Secondary actions:** "Resolve & return to Mimira" (post-takeover), "Flag for review" (escalates to owner).

### Knowledge
**Purpose:** Owner/staff uploads, structures, and edits the clinic-specific content Mimira grounds its replies on.
**Information hierarchy (two columns, no right rail):**
1. **Knowledge tree** (left rail) — hierarchical: Treatments / Aftercare / FAQ / Brand stories / Pricing. Each node shows last-edited date. Chunk counts, embedding model, audit log, and tags are server-side concerns — clinic admins don't read them.
2. **Editor** (center column) — plain-text textarea. Line doesn't render markdown, so a preview pane would lie about what customers see. What the admin types is what Mimira grounds on, modulo prose chunking on the server.

**Primary CTA:** "Add document" (top-left of the tree). Modal asks for category, then drops user into the editor.

**Document controls (in editor header):** Save (primary) · Delete (ghost). No draft/live toggle in v0 — saving makes a doc live; re-indexing runs in the background and a toast confirms when it's available in chat. If a clinic later asks for staged edits, add the toggle then.

**Empty state (critical):** A clinic with zero documents sees a 3-step starter: "1. Upload your treatment menu. 2. Upload your top 10 FAQs. 3. Upload one brand-voice sample." Each step has an upload button. **No Mimira replies will go live until step 1 completes — hard gate, not a suggestion.**

### Bookings
**Purpose:** Staff sees inbound booking intents captured from chat; confirms manually.
**Information hierarchy:**
1. **Pending queue** (top) — newest first. Each card: customer name, requested treatment, requested date/time, captured phone, link back to source chat.
2. **Confirmed** (middle) — past 30 days.
3. **Declined / no-show** (bottom, collapsed by default).

**Primary CTA:** "Confirm" (green, on each pending card) or "Reschedule" (opens a template message back to the customer's Line).

**Edge:** Booking intents with ambiguous fields ("next week", "afternoon") get a yellow border and a "needs phone" / "needs time" badge listing what's missing.

### Broadcasts
**Purpose:** Owner composes and sends manual broadcasts (promotions, news).

**v0 scope:** No in-app push-quota readout. Pulling Line's per-OA quota in real time is operationally awkward; clinics already see the canonical number in Line OA Manager. v0 lets Line server-side enforce the cap and surfaces partial sends post-hoc (see Interaction State Matrix below). Tag-based segments are deferred to a future Pro tier — v0 ships only **All customers** and **Last 90 days**.

**Information hierarchy:**
1. **Composer** (top) — recipient segment (two cards: All customers / Last 90 days; a third "By tag" card is visible but disabled with a `Pro` badge), message body with character counter (Line limit 5,000), optional image, schedule (now / scheduled).
2. **Live Line preview** (right side of composer) — phone-framed mockup of how the message appears on Line, re-wraps live as the owner types.
3. **Past broadcasts** (below) — list of recent sends with delivered / scheduled / stopped-early states, recipient counts, read percentage, and reply counts.

**Primary CTA:** "Send to N" (bottom-right of composer). A segment is preselected (Last 90 days), so the CTA is never disabled at idle — clicking the disabled "By tag" card does nothing and shows the `Pro` badge.

**Edge:** A broadcast that Line stops mid-send (quota exhausted, OA suspended, or other Line-side rejection) appears in the past-broadcasts list as `Stopped early` with the partial recipient count (e.g. `3,400 / 4,210`). No pre-send guard in v0; the owner sees the outcome, not a prediction.

### Promotions

**Purpose:** Owner authors, schedules, and retires time-bounded offers. A live promo is two things at once — content Mimira mentions when customers ask about deals (via RAG) and an optional one-shot broadcast.

**v0 scope:** Owner-authored, single-language (Thai). Each promo has a body, an optional **image URL** (pasted, e.g. LINE CDN URL or external URL — no upload pipeline in v0), an optional video URL, and a start/end date range. Going live atomically embeds the body into `knowledge_chunks` and tags the row with `source_doc = 'promo:<id>'`; the retrieval query filters out expired rows (`expires_at IS NULL OR expires_at > now()`).

**Deferred to v1:**
- **Image upload pipeline** (Supabase Storage / S3). v0 accepts pasted image URLs only. Same fallback Broadcasts uses for now.
- **"Also broadcast on go-live" toggle.** v0 ships pull-side only (RAG retrieval). Broadcast integration waits until the Broadcasts page is built and the cross-page coupling can be designed cleanly.

**Data model (locked by plan-eng-review 2026-05-28):**

New `promotions` table holds canonical promo records (drafts, live, past). `knowledge_chunks` holds the embeddings for the body, derived on Go Live.

```sql
CREATE TABLE IF NOT EXISTS promotions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  image_url   TEXT,                 -- pasted URL; no upload pipeline in v0
  video_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','live','past')),
  start_at    BIGINT,               -- epoch ms; informational for Drafts
  end_at      BIGINT,               -- epoch ms; lazy-expire trigger when status='live'
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

-- Extension to knowledge_chunks (idempotent ALTER):
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS expires_at  BIGINT NULL;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'knowledge'
  CHECK (source_kind IN ('knowledge','promo'));
```

**v0 status state machine (3 states, manual transitions):**
- `Draft` → `Live`: manual click `Go live`. Inserts `knowledge_chunks` rows from the body with `source_kind='promo'`, `source_doc='promo:<id>'`, `expires_at=<end_at>`.
- `Live` → `Past`: manual click `Stop`, OR lazy on-page-load (when an admin loads `/promotions` or any admin page that reads the gallery, if `end_at <= now()` flip to `Past` and DELETE the matching `knowledge_chunks` rows). No background scheduler in v0.
- No `Scheduled` status in v0 — without a scheduler, "scheduled" would lie about behavior. `start_at` is informational metadata only.

**Required code changes (regression-safe):**
- `repo.ts` `listKnowledgeDocs()` MUST filter `WHERE source_kind = 'knowledge'` so promos never leak into the Knowledge admin tree.
- `rag.ts` `retrieve()` MUST add `WHERE expires_at IS NULL OR expires_at > <now>` to the top-K query.
- `rag.ts` (or `pipeline.ts`) MUST always-inject the most-recent Live promo as a guaranteed extra chunk in addition to top-K, so customers asking about deals see the offer even if its body doesn't out-score evergreen treatment docs on cosine similarity. Use most-recent by `created_at` if multiple Live promos exist; tie-break by soonest `end_at`.
- `insertKnowledgeChunk()` signature adds optional `expiresAt: number | null` and `sourceKind: 'knowledge' | 'promo'` (default `'knowledge'`) parameters. Existing callers unaffected.
- Embedding cost: re-embed only fires on explicit Save in the slide-over editor, not per-keystroke.

**The memorable thing:** *"I can swap in a new promo and Mimira already knows about it."* Activating a promo and making it AI-retrievable are the same action — there is no separate "publish to RAG" toggle.

**Information hierarchy (single-pane gallery, no left rail):**

1. **Status-stacked gallery** — page-level. Cards grouped by status section in this order: **Live**, **Scheduled**, **Drafts**, **Past**. Past is collapsed by default. Drafts collapses if empty. Each section header shows the count: `● LIVE (2)`.
2. **Promo card** — `repeat(auto-fill, minmax(240px, 1fr))` with 16 px gap. 4:3 image area at the top, 12 px radius (matches `--radius-lg`). Title (`text-base / 500`, two-line clamp), meta line (`text-xs / 400 / --fg-muted`) showing the most relevant date-context per status. Card actions: `Edit` ghost button + `⋯` menu (Duplicate · Stop · Delete) revealed on hover/focus. 1 px `--border`, no shadow. Hover deepens border to `--fg-subtle`.
3. **Slide-over editor** — opens on Edit click. ~480 px wide, slides in from the right with `--ease-enter` over 240 ms. Backdrop dims at `rgba(0,0,0,0.32)`. Esc or backdrop-click closes. Contains, top-to-bottom: status pill, LINE phone-frame preview (~285 px), form fields (Title, Body, Image, Video URL, Live dates), an inline helper line in `--ai-accent` reading *"Mimira mentions this when customers ask about deals."*, and a footer row with the action buttons.

**Primary CTA:** `+ New promo` (top-right of the page). Inside the slide-over, the bottom CTA is `Go live` (primary, near-black) for drafts/scheduled, and `Save` (primary) + `Stop` (ghost) for live promos. Never two primary CTAs in the slide-over at once.

**Status semantics (load-bearing — v0 has 3 states):**

| Status | Dot | In RAG? | Visible to customers? |
|---|---|---|---|
| **Live** | `--success` | Yes — `knowledge_chunks` entry active with `source_kind='promo'` | Yes — Mimira may quote on demand |
| **Drafts** | hollow circle | No | No |
| **Past** | `--fg-subtle` | No — embedding rows deleted at lazy expire or manual Stop | No |

No `Scheduled` status in v0 (no background scheduler — see Data model above). Owner sets `start_at` as planning metadata on a Draft, but the transition to Live is always a manual click.

`--warning` amber stays reserved for "Needs attention" escalations (see DESIGN-UI.md AI accent rule). Do not repurpose for promo status.

**The "Go live" action is atomic:**

1. `promotions.status` → `Live`, `updated_at = now()`.
2. INSERT rows into `knowledge_chunks` with `source_kind='promo'`, `source_doc='promo:<id>'`, `expires_at=<end_at>` (or NULL if owner didn't set end_at). Each chunk is the promo body (single chunk in v0 — promo bodies are short).
3. **No broadcast in v0** (deferred — see v0 scope). Future v1 toggle will live in the slide-over editor; the spec doesn't render the toggle in v0 to avoid a UI that lies.

**Stop / Lazy expire:**
- Manual: owner clicks `Stop` in the slide-over editor → `promotions.status='past'`, DELETE matching `knowledge_chunks` rows.
- Lazy: on every admin page load that reads the gallery, run `UPDATE promotions SET status='past' WHERE status='live' AND end_at IS NOT NULL AND end_at <= <now>` and DELETE expired `knowledge_chunks` rows (matched by `source_kind='promo' AND expires_at <= <now>`). 2 SQL writes per admin load when expiries are pending; no-op otherwise.
- No background scheduler in v0 — if no admin loads the page for a day, expiry waits until next load. Customer-facing retrieval still filters expired rows in `retrieve()`, so a forgotten Stop doesn't surface stale promos to customers even when the admin lazy-expire hasn't fired yet.

**Promo retrieval defense (locked):** `retrieve()` returns the standard top-K. The pipeline ALSO fetches the most-recent Live promo (most-recent `created_at`; tie-break by soonest `end_at`) and appends it as chunk K+1 with a fixed mid-range score. This guarantees Mimira sees the Live promo when a customer asks about deals, regardless of cosine similarity rankings. Edge case: zero Live promos → no extra chunk, top-K only.

**Empty state (no promos):** Left-aligned, two sentences:
> No promotions yet.
> Promotions Mimira can answer about. Add your first to get started.

`[ + New promo ]` CTA below. No illustration. No 3-step starter (Promotions is not a gate the way Knowledge is).

**Edge:**
- A draft with no image renders a dotted-border placeholder card in `--surface-2` showing a 16 px `+ image` icon. The new-promo flow asks for the image first, before the title, so this state is rare in normal usage.
- Multiple Live promos visible at once is intentional, not a bug. The gallery's vertical density makes it obvious when there are too many overlapping offers — a useful side-effect that nudges the owner to think about LLM context bloat without us having to write a rule.

**Out of scope for v0:**
- Multi-language promo body (EN promo content arrives when the second clinic onboards a non-Thai audience).
- Inline performance metrics on the card (impressions, click-through) — the clinic looks at Line OA Manager.
- Drag-to-reorder — status + date dictates ordering.
- Customer-facing tag segmentation for promo audiences — Pro tier, deferred per Broadcasts v0 scope.

### Settings
**Purpose:** Owner configures everything that affects Mimira's behavior, billing, and team.
**Information hierarchy — nine independently-saving sections, each its own collapsible card. DO NOT cram into one scrolling page:**
1. **Clinic profile** — name, address, hours, languages spoken.
2. **Line OA** — channel ID + secret (encrypted, last-4 visible only), webhook URL (read-only), "Test signature" button.
3. **AI brain** — LLM provider picker (OpenAI / Anthropic / Google), model dropdown, embedding provider (locked to Cohere v0 with "request override" link), temperature slider.
4. **Brand voice** — free-form prompt textarea + 3–5 sample dialogue pairs. See Unresolved.
5. **Capacity rules** — informational fields ("we handle X bookings/day per treatment"); surfaces in chat to prevent overbooking talk. v0 = informational only.
6. **Aftercare schedule** — D1/D7 toggles, hour-of-day picker (clinic timezone), template messages per language.
7. **Privacy & retention** — conversation TTL (default 24mo), DSAR export button, sub-processor disclosure (auto-generated from current AI brain selection).
8. **Team** — staff invites, role assignments (owner / staff), audit log access.
9. **Billing** — current plan, message volume meter, payment method.

**Primary CTA per section:** "Save changes" — each section saves independently; no global save button.

**Edge:** Changing the LLM provider shows a confirmation modal: "This affects all future replies. Active conversations finish on the current provider." Save is logged to `audit_events`.

---

## Interaction State Matrix

Every feature ships with all five states designed. Missing states = engineer ships "No items found." which depletes goodwill.

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Inbox — escalated chats list | Skeleton rows (3 placeholders, exact row height, subtle shimmer) | "No escalations. Mimira is handling everything." + sparkline of replies/hour today | "Couldn't reach chat service. Retrying in 5s..." + manual retry | New escalation slides in from top with a brief amber pulse | If only some chats load: show what loaded + "5 more queued, retrying" sticky at top |
| Inbox — active thread | Skeleton message bubbles (5 placeholders) | "Pick a chat from the left to view" + small illustration of the side rail | "Couldn't load this thread. Try refreshing." | Sent staff reply appears immediately with a subtle "sending…" tag; replaces with checkmark on confirm | Loaded most messages + spinner at top for older history |
| Knowledge — tree | Skeleton tree (5 placeholder leaves) | 3-step starter (see Knowledge empty state above) | "Couldn't load knowledge base. Retry." | Save → toast "Saved." → follow-up toast "Mimira is using this · live in 30s" | "8 of 12 documents loaded — loading remaining" with progress |
| Knowledge — editor | Editor placeholder shimmer | "Pick a document from the tree or click Add Document." | "Failed to save — your edits are kept locally. Retry." | Save → "Saved" → fades to "Saved 8s ago" | Auto-saved draft toast every 30s |
| Bookings — queue | Skeleton cards (3) | "No pending bookings. New requests appear here when a customer commits in chat." + link to a sample chat | "Couldn't load bookings. Retry." | Confirm → card slides to Confirmed section with a green check | Missing-fields cards highlighted yellow with "needs phone" badge |
| Broadcasts — composer | n/a (instant) | n/a (always usable) | If image upload fails: inline below image area "Couldn't upload. Try a smaller image or paste a Line CDN URL." | Send → progress bar (recipients reached / total) → toast "Sent to 4,210 / 4,210 customers" | Line stopped the send mid-flight (quota / OA suspended / API error): broadcast appears in the log as `Stopped early` with the partial count (e.g. `3,400 / 4,210`) and a tooltip showing the Line error response. No in-app quota readout; the owner's source of truth for remaining quota is Line OA Manager. |
| Promotions — gallery | Skeleton card grid (3 placeholders, 4:3 aspect, exact card dimensions) | Left-aligned two-line message + `+ New promo` CTA. No illustration, no starter wizard. | "Couldn't load promotions. Retry." | New draft card slides in at the top of the Drafts section with a brief `--border-subtle` → `--border` outline pulse (160 ms). | Some cards load, others fail: failed cards render with a single-line error in the card body and a small Retry ghost button. Section count reflects what loaded. |
| Promotions — editor (slide-over) | Editor field skeletons inside the slide-over (does not block the gallery behind it) | n/a — slide-over only opens with content (new or existing) | Save fails: inline toast "Couldn't save. Your edits are kept locally — retry?" Image URL invalid or unreachable: inline below the URL field "Image URL didn't load. Paste a different URL." | `Save` → toast "Saved" → fades to "Saved 8s ago". `Go live` → status pill flips green; toast "Live. Mimira is using this · in chat in ~30s." | Body changed on a Live promo: re-embed only fires on explicit Save (not per-keystroke), toast "Saved. Mimira is using the new version · in chat in ~30s." Status stays Live throughout. |
| Promotions — auto-expire | n/a (server-side) | n/a | DLQ after 3 retries on the embedding-removal step; audit_events entry visible to owner. | Card moves from Live to Past at midnight clinic-local; embedding row deleted; audit_events entry. No customer-facing notice. | n/a |
| Settings — any section | Skeleton fields per section | n/a (always has defaults) | "Couldn't save. Your changes are kept locally — retry?" | Save → toast "Saved" → audit log entry in background | Field-level validation: red inline text below the field, never a global error |
| Customer first-contact consent (Line) | n/a | n/a | If Line API fails, customer sees nothing; server-side retry | Customer sees Thai consent message + 2 quick-reply buttons ("ยินยอม" / "สอบถามก่อน") | n/a |
| Aftercare D1/D7 send | n/a (server-side) | n/a | DLQ after 3 retries; `audit_events` entry visible to staff | Sent → `audit_events` entry + delivered tag in customer's conversation | LLM-judge classifier blocks an aftercare reply: doesn't send, escalates to staff inbox with "auto-blocked: diagnosis language detected" |

Rule: **never ship "No items found." as an empty state.** Every empty state = message + primary action + (where possible) momentum (illustration, sparkline, or next-step hint).

---

## User Journey Storyboards

Two journeys matter most in v0. Storyboard both before week 1.

### Journey A — Clinic Owner Onboarding (target: ≤ 1 working day for clinic #2)

| Step | User does | User feels | Plan supports? |
|---|---|---|---|
| 1 | Signs up at app.mimira.ai | Curious, mild skepticism | Yes — Supabase Auth |
| 2 | Lands on "Welcome — let's get Mimira ready in 4 steps" | Relieved (clear scope) | **Missing — needs an onboarding checklist screen** |
| 3 | Connect Line OA — pastes channel ID + secret | Anxious (these feel important) | Backend ready; **missing UX: a "Test signature" button that confirms the webhook received a real ping** |
| 4 | Upload knowledge — drops in treatment menu | Skeptical ("will it parse correctly?") | **Missing — needs a preview of parsed chunks before commit** |
| 5 | Set brand voice — picks LLM provider, writes voice prompt, optionally pastes 3 sample dialogues | Engaged (this is the magic) | Plan flags as Open Question — see Unresolved |
| 6 | Test chat — talks to Mimira as if a customer | Excited or alarmed (defining moment) | **Missing — needs an in-app sandbox chat that uses the real configured Mimira in a dry-run scope** |
| 7 | "Go live" toggle — Line OA inbound is now live | Hopeful, slightly nervous | **Missing — needs an explicit go-live screen with green-checked "must-haves"** |
| 8 | First real customer message arrives, Mimira replies | Relief or panic | Inbox tab shows the live chat |

**Gap:** the plan has no onboarding UX. A clinic owner sitting at their front desk at 8pm trying to set Mimira up will stall at step 2 (Line OA) with no test-ping confirmation. Add an onboarding flow to week 1.

### Journey B — Thai Customer First Inbound Message (first-impression + PDPA)

| Step | User does | User feels | Plan supports? |
|---|---|---|---|
| 1 | Adds the clinic's Line OA | Curious about the clinic | n/a (Line UX) |
| 2 | Sends first message: "สวัสดีค่ะ อยากสอบถามเรื่องเลเซอร์" | Hopeful, casual | Webhook receives |
| 3 | Sees consent message (Thai, friendly, 2 quick-reply buttons) | Slight friction, but accepts | Plan says consent exists; **need to design the exact Thai copy + button labels** |
| 4 | Taps "ยินยอม" | Relief, ready to chat | Recorded in `consents` table |
| 5 | Mimira replies in warm Thai: "ยินดีต้อนรับค่ะ! เลเซอร์ที่คลินิกเรามี 3 ประเภท..." | Pleasantly surprised — feels like a friend, not a robot | RAG + brand voice cover this |
| 6 | Asks "ราคาเท่าไหร่คะ?" | Hopeful | Yes |
| 7 | Mimira answers from Knowledge or escalates if pricing isn't in Knowledge | Satisfied OR "I'll wait for staff" | Escalation logic exists; **need to design the staff-handoff UX from customer's POV — does the customer see "a staff member will reply" or does the conversation just continue?** |
| 8 | Books → Mimira captures booking intent | Excited | Yes |

**Gap:** the consent message Thai copy + the customer-side staff-handoff UX are unspecified. Both are first-impression moments where trust is built or broken.

---

## Visual Hard Rules & AI-Slop Risk Audit

There is no visual `DESIGN.md` yet. To prevent the admin UI from defaulting to AI-slop patterns, lock in these hard rules now.

**Classifier:** the admin app is **APP UI** (dense, task-focused, dashboard-adjacent). The customer-facing surface is Line itself — not designed by us beyond message text.



**Hard rules for the admin UI:**
- No 1 rule: In all of the design choices, CEO prefers something easy to use. So if some things can be ignored, u can ignore. For example, adding or removing knowledge, can just be simple (or can be added later)
- No purple / violet / indigo gradients. Default accent = a single warm color from the Thai-market palette (likely a calm teal or terracotta-amber — to be locked by `/design-consultation`).
- No 3-column feature-grid layout anywhere. Every Settings "section" is a stacked card.
- No icons in colored circles as section decoration.
- No centered everything. Left-align by default; only headers and primary CTAs may center contextually.
- Border-radius hierarchy: cards 8px, buttons 6px, inputs 4px. Not a uniform 16px bubbly radius.
- No decorative blobs, floating circles, wavy SVG dividers.
- No emoji as UI decoration. Emoji allowed only in user-generated content (customer messages, Knowledge body).
- Generic hero copy is banned. The login page header is NOT "Welcome to Mimira." It is a concrete one-sentence statement of what Mimira does for this clinic.
- **Typography:** pick a real Thai-aware typeface (recommend IBM Plex Sans Thai Looped or Noto Sans Thai) for both UI and content. Do NOT ship with `system-ui` as the primary font — Thai script in `system-ui` falls back to vendor defaults that look unprofessional.
- Body text minimum 16px. Thai script needs the height; 14px is unreadable for casual register.
- Tabular numerics (`font-variant-numeric: tabular-nums`) on number columns (recipient counts, message counts, dates).

**Litmus checks before week 4 demo:**
1. Brand/product unmistakable in first screen? — must be YES (logo + product tagline on every screen)
2. One strong visual anchor per screen? — YES (Inbox = active thread; Knowledge = editor; Settings = the open section)
3. Page understandable by scanning headings only? — YES
4. Each section has one job? — YES (the 9-section Settings is the biggest risk; one-page-scroll fails this)
5. Are cards actually necessary? — review at week 4; cards allowed only where the card IS the interaction
6. Does motion improve hierarchy? — minimum 3 intentional motions: new-escalation slide-in, save-toast fade, knowledge-tree expand
7. Would it feel premium with all decorative shadows removed? — must be YES

---

## Design System Gap

**RESOLVED 2026-05-25.** Visual design system now lives in [DESIGN-UI.md](DESIGN-UI.md). Aesthetic: Quiet Modernist (cool — ChatGPT/Apple lineage); type family: IBM Plex Sans + Plex Sans Thai Looped; primary CTA: near-black filled (not blue); single AI accent `#0a7c7c` reserved for Mimira-generated UI elements. Polestar: *calm and quiet, never overwhelming.*

Note: the "warm color from the Thai-market palette" recommendation in the Hard rules section above (line 143) is **superseded** by `DESIGN-UI.md`. The cool direction was chosen because Mimira's warmth lives in her *message copy on Line*, not in the admin chrome — the admin is the instrument, not the hug.

---

## Responsive & Accessibility

### Responsive

- **Mobile (375–414px):** **Inbox is the only tab that MUST work fluidly on mobile** — clinic staff respond during peak hours from phones. Knowledge / Bookings / Broadcasts / Settings are desktop-primary, mobile-degraded.
- **Tablet (768–1024px):** Inbox compresses 3-column → 2-column (list + thread). Right rail (customer context) drops to a slide-out drawer triggered from the thread header.
- **Desktop (≥1024px):** Full 3-column Inbox. Knowledge tree + editor + metadata side-by-side. Settings sections side-by-side at ≥1440px.
- No horizontal scroll at any breakpoint. No `user-scalable=no` in viewport meta. `env(safe-area-inset-*)` for notch devices (Thai market is heavily iPhone).

### Accessibility

- Touch targets ≥ 44px on all interactive elements.
- `focus-visible` ring on every interactive element. Never `outline: none`.
- WCAG AA contrast on body text (4.5:1).
- Color is never the only signal: escalation reason uses color AND icon AND text label.
- Keyboard nav: Tab through Inbox list, Enter to open a thread, J/K to move between threads (Slack/Gmail convention).
- Screen-reader landmarks: `<nav>` for the tab bar, `<main>` for the active panel, `<aside>` for right-rail context.
- Thai screen-reader exhaustive testing: defer to week 7 polish — flagged as TODO.

---

## Unresolved Design Decisions

Each will haunt implementation if deferred without owner input. Recommendation given for each.

| # | Decision | If deferred, what happens | Recommendation |
|---|---|---|---|
| 1 | **Admin UI language** — Thai-only, English-only, or both with toggle | Engineers ship whatever language is in JSX; clinic staff get an English admin UI by accident | **Both with toggle, Thai default.** Owner can switch in Settings. Affects every label. Translation pipeline needed from week 1. |
| 2 | **Brand voice config UX** — free-form prompt, structured sliders + samples, or hybrid | Engineer ships a textarea labeled "Brand voice" with no examples; outputs are inconsistent across clinics | **Hybrid: free-form prompt + 3–5 sample dialogue pairs.** Office-hours session already recommended this; lock it in. |
| 3 | **Mobile-first vs desktop-first for admin** | Engineer ships a desktop UI that's "responsive" by stacking columns on mobile; Inbox unusable on phone | **Desktop-first for Knowledge / Bookings / Broadcasts / Settings; mobile-first for Inbox only.** Reflects actual staff workflow. |
| 4 | **Inbox real-time update mechanism** — polling, SSE, or notification-only | Engineer picks polling; staff sees stale chats for 5–10s after escalation | **SSE.** Simpler than WebSocket, native browser support, works through Vercel edge. Polling fallback if SSE fails. |
| 5 | **Customer-side staff handoff UX** — does the customer see "a staff member is replying" or does the conversation just continue? | Customer is confused why reply tone suddenly changes | **One subtle Thai transition message:** "เจ้าหน้าที่กำลังตอบกลับค่ะ". Single sentence, no separate avatar/branding. Sent once per handoff, not per staff message. |
| 6 | **Knowledge document structure** — single dump per category or structured per file | Engineer ships single textarea per category; RAG recall suffers; clinic edits become big-bang re-embeddings | **Structured: each treatment / device / FAQ entry is its own document with metadata.** Plan already leans this way (Open Question #2). Lock it in. |
| 7 | **Consent message Thai copy** — formal legal vs. friendly short-text | Formal text scares customers off; chat completion rate drops | **Friendly short-text (2–3 sentences) + a "Read full terms" link to a longer formal version.** Get clinic #1's lawyer to vet both. |
| 8 | ~~**Push-quota readout placement**~~ — **RESOLVED 2026-05-25: no in-app quota readout in v0** | Owner doesn't see remaining quota inside Mimira; they look at Line OA Manager (the canonical source) | **No quota UI in v0.** Pulling per-OA quota from Line in real time is operationally awkward, and the clinic already sees the canonical number in Line OA Manager. Line server-side enforces the cap; Mimira surfaces partial sends post-hoc in the broadcast log as `Stopped early` with the partial recipient count. Surfacing quota in-app is reserved for a future Pro tier. |

---

## NOT in Scope (Design)

Explicitly deferred:
- Image / sticker understanding from customers — v0 routes to staff (plan §Line API Constraints).
- Custom theming per clinic — Mimira admin uses one brand.
- Dark mode — defer to v1.
- Analytics dashboard UI — plan already defers; this review confirms.
- Multi-channel UX (FB / IG / WhatsApp) — channel adapter exists architecturally; UX is Line-only in v0.
- Calendar integrations UX — booking queue is manual confirm; integrations are upsell.
- Thai screen-reader exhaustive testing — week 7 polish.

## What Already Exists

Nothing. Mimira is greenfield. Every component, screen, and visual decision is being made for the first time. There is no prior design system to leverage. This is why running `/design-consultation` before week 2 is high-value.

## Implementation Tasks

| ID | Priority | Effort (human / CC) | Component | Task | Source finding |
|---|---|---|---|---|---|
| T1 | P1 | ~3d / ~45min | onboarding-flow | Build 4-step onboarding (Line connect → Knowledge upload → brand voice → sandbox chat) with go-live gate | Journey A — clinic owner stalls at step 2 without test-ping |
| T2 | P1 | ~1d / ~20min | design-system | Run `/design-consultation` → produce visual DESIGN.md (fonts, colors, spacing, motion) | Design System Gap section |
| T3 | P1 | ~1d / ~30min | i18n | Set up translation pipeline (next-intl); ship Thai + English admin | Unresolved #1 — admin UI language |
| T4 | P1 | ~4h / ~15min | inbox-states | Implement all 5 states for Inbox per state matrix | Pass 2 — state matrix |
| T5 | P1 | ~2h / ~10min | knowledge-empty | Build the 3-step starter empty state with a hard go-live gate | Knowledge empty state spec |
| T6 | P2 | ~3h / ~10min | settings-cards | Split Settings into 9 independently-saving collapsible cards | Settings information hierarchy |
| T7 | — | — | — | ~~Top-bar quota indicator + Broadcasts tab banner~~ — **DROPPED 2026-05-25.** Quota tracking is not in v0 (see Unresolved #8 resolution); the broadcast log's `Stopped early` state covers the failure case. Tag-based segments also deferred to Pro tier — v0 Broadcasts ships with two segments (All customers · Last 90 days) and a disabled `Pro`-badged "By tag" card. | Unresolved #8 — quota placement |
| T8 | P2 | ~4h / ~15min | sse-inbox | Real-time Inbox updates via SSE with polling fallback | Unresolved #4 — Inbox real-time |
| T9 | P2 | ~2h / ~10min | staff-handoff | Auto-send "เจ้าหน้าที่กำลังตอบกลับค่ะ" on takeover (once per handoff) | Unresolved #5 — staff handoff UX |
| T10 | P3 | ~1h / ~5min | consent-copy | Clinic #1's lawyer vets short + long Thai consent text | Unresolved #7 — consent copy |
| T11 | P1 | ~2h / ~10min | promotions-schema | Add `promotions` table per spec (id, title, body, image_url, video_url, status enum draft/live/past, start_at, end_at, created_at, updated_at). Add `expires_at BIGINT NULL` and `source_kind TEXT DEFAULT 'knowledge'` columns to `knowledge_chunks` via idempotent ALTER. Run via existing `npm run db:migrate` | Architecture D2, D6 |
| T12 | P1 | ~30min / ~5min | knowledge-admin-filter | `repo.ts:listKnowledgeDocs()` MUST filter `WHERE source_kind = 'knowledge'`. Regression — without this fix, going-live a promo silently leaks it into the Knowledge admin tree | Critical regression, Step 0 |
| T13 | P1 | ~1h / ~10min | promotions-rag-filter | `rag.ts:retrieve()` MUST add `WHERE expires_at IS NULL OR expires_at > <now>`. Regression — without this, expired promos linger in retrieval until manual Stop fires | Critical regression, Step 0 |
| T14 | P1 | ~1h / ~10min | promotions-rag-inject | Add second query in `retrieve()` (or wrap in `pipeline.ts`) that fetches the most-recent Live promo and appends it to the chunk array. Ensures Mimira sees the promo regardless of cosine ranking | Architecture D3 |
| T15 | P2 | ~1d / ~45min | promotions-page | Build `app/promotions/` page: gallery + 3 status sections (Live/Drafts/Past) + slide-over editor. Image URL paste only (no upload). No broadcast toggle. Manual Go Live / Stop. Lazy expire on page load | Promotions screen inventory + D4/D5 |
| T16 | P2 | ~1h / ~10min | promotions-actions | Server actions: createPromotion, updatePromotion, goLive (atomic: status flip + insertKnowledgeChunk with source_kind='promo'), stop (atomic: status flip + delete chunks), lazy-expire helper called from the page loader | Architecture D4 lazy expire |
| T17 | P3 | ~30min / ~5min | promotions-audit | Add 'Promotions' section to audit_log writes on every status transition (created/edited/go-live/stop/expired). Reuses existing `appendAudit()` | Operational visibility |
