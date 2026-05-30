# TODOS

Deferred items captured during planning. Each entry: WHAT, WHY, PROS, CONS, CONTEXT, DEPENDS-ON.

## Shipped documentation updates

- **Agent workflow clarification** — **DONE 2026-05-29, commit `052f343`.** `AGENTS.md` and `CLAUDE.md` now state that agents should scan relevant `.md` docs broadly before work, keep in-progress markers local-only, and commit/push only completed work or coherent completed chunks.

## Shipped app fixes

- **LINE channel name label** — **DONE 2026-05-30, commit `this commit`.** Settings now exposes a human Channel name for the LINE account while keeping the internal LINE destination identifier hidden and auto-synced from webhooks.
- **LINE webhook URL always visible** — **DONE 2026-05-30, commit `7fa4d0f`.** Settings now always shows the platform webhook URL during LINE setup, and the Help popup uses the same URL instead of falling back to a placeholder.
- **LINE Settings credential simplification** — **DONE 2026-05-30, commit `3a25c90`.** Settings now asks only for Channel ID, editable Channel Secret, Channel Access Token, and the webhook URL, removes the Rotate / Verify connection / OA display name controls, and adds a Help modal with LINE setup steps.
- **Demo inbox badge + clinic profile simplification** — **DONE 2026-05-30, commit `this commit`.** Inbox nav now counts unresolved attention threads instead of hardcoded demo totals / total customers, and Settings no longer exposes clinic hours or languages-spoken fields. The AI prompt now handles language choice directly from the customer's message.
- **Default brand voice for all users** — **DONE 2026-05-30, commit `this commit`.** New, demo, and first-owner-reset workspaces now receive the warm Mimira brand voice prompt by default; blank existing settings rows are repaired on startup without overwriting custom prompts.

## Post-v0 evals (deferred from D14)

User chose to keep only the 50-turn aftercare safety eval in v0; the four additional
evals below are deferred to post-launch. Recommend running them before clinic #3
onboards.

### Thai fluency benchmark (3 providers)

- **What:** A 20-turn Thai fluency eval comparing Anthropic Claude, OpenAI GPT, Google Gemini on Thai-language replies for skin-clinic-typical questions.
- **Why:** Validates (or revises) the plan's claim that Claude is the best default Thai LLM. Today this claim is unsupported.
- **Pros:** Empirical basis for the default-LLM choice; supports clinic owner's vendor-selection decision; catches if Gemini or GPT became better at Thai mid-v0.
- **Cons:** ~1 day to build the eval set (needs native Thai reviewer); ~$30 in LLM costs per run.
- **Context:** Plan defaults new clinics to Claude with the rationale "top Thai fluency" — outside voice flagged this as unsubstantiated. Expand eval to 150+ turns from 2+ clinics before declaring (per outside voice #11).
- **Depends on:** A native Thai-speaking reviewer to label "fluent / awkward / wrong"; ideally clinic #1 staff member.

### Judge classifier FP/FN rate

- **What:** A 200-turn benign + 50-turn adversarial eval measuring how often the judge incorrectly escalates safe replies (FP) and how often it lets unsafe replies through (FN).
- **Why:** Today the judge ships without any measured calibration. A 30% FP rate would flood the staff escalation queue; a 10% FN rate is a medical-safety incident.
- **Pros:** Quantifies the safety margin; catches drift if model or prompt changes.
- **Cons:** ~1 day to build the labeled eval set; needs a sample of real aftercare replies (must come from clinic #1 post-launch).
- **Context:** D4 fixed the architecture (small-model judge pre-send + fail→escalate) but did not measure quality. Run before clinic #3.
- **Depends on:** Clinic #1 live for at least 2 weeks to provide real aftercare reply samples.

### Brand voice adherence eval

- **What:** A 20-turn eval per clinic measuring how consistently the AI maintains the configured warm/casual/close-friend Thai register across topics.
- **Why:** Brand voice is the wedge — "robotic English-first chatbots erode trust." Today there's no way to detect register drift between turns or providers.
- **Pros:** Catches drift; enables A/B testing of voice prompt variants.
- **Cons:** ~half day per clinic to build the eval; needs the clinic's owner to label "on-brand / off-brand."
- **Context:** Plan's brand voice config is free-form prompt + 3-5 samples. Quality is currently anecdotal.
- **Depends on:** Clinic owner participation; multi-clinic version needs clinic #2.

### Knowledge grounding eval

- **What:** A 20-turn eval measuring whether the AI uses retrieved RAG chunks vs hallucinates answers from training data.
- **Why:** RAG grounding is what differentiates Mimira from a generic Thai chatbot. If the model frequently bypasses the retrieved chunks, the knowledge upload is theater.
- **Pros:** Catches hallucination; supports retrieval-tuning iterations.
- **Cons:** ~1 day to build; needs labeled "in-corpus / out-of-corpus" question pairs.
- **Context:** Plan assumes RAG correctness; outside voice flagged this should be measured.
- **Depends on:** Stable knowledge corpus for clinic #1.

## Unresolved engineering review decisions (re-decide before week 1)

These five decisions surfaced during /plan-eng-review on 2026-05-25 but did not receive a yes/no from the user. They are NOT applied to the plan. Re-decide.

- **Cofounder week-0 blocker.** Elevate the plan's "Assignment" afterthought to a hard precondition before week 1.
- **Reframe "≤1 day onboarding" metric** to "≤1 day of OUR work after clinic delivers creds + knowledge."
- **PDPA consent UX:** append-to-first-reply (with link to clinic privacy notice) vs the current standalone-wall consent message. Lawyer review before week 6.
- ~~**Pre-send quota hard-block** for aftercare + broadcast~~ — **RESOLVED 2026-05-25: no in-app quota awareness in v0.** Line server-side enforces; the broadcast log's `Stopped early` state covers the failure case post-hoc. The owner's source of truth for remaining quota is Line OA Manager. See [DESIGN.md](DESIGN.md) §Line API Constraints, [DESIGN-UX.md](DESIGN-UX.md) Unresolved #8, [DESIGN-ENG.md](DESIGN-ENG.md) Unresolved #4.
- **Front-desk shadowing as week-0 HARD GATE** (vs week-0 nice-to-have). Plan's "Assignment" section currently has the shadowing recommendation but doesn't gate week 1 schema work on it.

## Other deferred items (from plan)

- **Multimodal image understanding LLM** — fast-follow in week 8 buffer if photo-first inbound > 40% during clinic #1 shadowing.
- **KMS-based wrapping key (AWS KMS or GCP KMS)** — v1 upgrade from Supabase Vault built-in.
- **Bangkok hosting migration** — trigger: clinic lawyer requires TH residency OR Supabase opens BKK region OR Mimira revenue justifies AWS Bangkok self-host.
- **Streaming LLM responses, tool use, function calling in LLM** — explicitly out of v0 Provider interface.
- **Channels beyond Line (FB / WA / IG)** — adapter interface is defined; first concrete second adapter is a v1 item.
- **Manager role** — only `owner` + `staff` in v0.
- **Multi-org user (cofounder owns multiple clinics)** — multi-org membership UI deferred until first multi-org owner request.
- **Calendar integrations for bookings** — paid clinics can custom.
- **Product analytics** — placeholder folder + README only in v0.

## Pro-tier features (deferred from v0)

Features intentionally scoped out of v0 and surfaced as locked `Pro` entry points in the UI. Each is a deliberate upsell hook, not an oversight.

### Tag-based broadcast segments

- **What:** Owner-defined customer tags (e.g. `laser-interest`, `vip`, `lapsed-90d`) usable as a Broadcasts recipient segment. v0 ships only two segments: All customers, Last 90 days. Tags are visible as a third disabled "By tag" card with a `Pro` badge in the Broadcasts composer.
- **Why deferred:** Tagging needs (a) a tag-management UI in the customer drawer, (b) an audit story for who tagged whom and when, and (c) at least one validated clinic use case beyond "laser interest" — none of which clinic #1 has asked for yet. Shipping the disabled card in v0 lets us learn whether owners try to click it.
- **Depends on:** First clinic that explicitly asks for tag segmentation; tag schema in `customers` table.

### In-app push-quota readout

- **What:** Live readout of Line OA monthly push quota in the admin (banner in Broadcasts, indicator in the top bar). See resolved entry above under "Unresolved engineering review decisions" for why v0 ships without it.
- **Why deferred:** Real-time per-OA quota pull is operationally awkward (Line's quota endpoint has its own rate limits and per-OA refresh quirks). The clinic already sees the canonical number in Line OA Manager. Pro tier could justify the engineering work as part of a broader analytics surface.
- **Depends on:** A clinic explicitly asking for in-app visibility; a reliable cache strategy for the Line quota endpoint.

## Auth gate follow-ups (deferred during /plan-eng-review 2026-05-29)

> The in-scope build tasks (T1–T14) are tracked step-by-step in [CLERK-AUTH-TASKS.md](CLERK-AUTH-TASKS.md). This section holds only the items the review explicitly **deferred** past the gate.

Surfaced while planning the Clerk auth gate (login/signup + whole-app gating, single-tenant). The gate itself is in scope; these four were explicitly deferred. **Two of the four are now DONE** (server-side role enforcement, public-media protection); multi-tenant migration and guard claim-caching remain deferred.

### Multi-tenant migration (org_id + RLS) — deferred from D1

- **What:** `org_id` on every table, Postgres Row-Level Security, signup-creates-org, JWT org claim, and LINE webhook routing by clinic — the multi-tenant SaaS described in DESIGN.md / DESIGN-ENG.md.
- **Why:** Unlocks the cofounder's multi-clinic distribution channel.
- **Pros:** Real SaaS; clinic #2 onboards in a day; matches the documented vision.
- **Cons:** Multi-week; touches every table and every query in `lib/repo.ts` + pipeline + webhook; tenant-isolation bugs leak patient data across clinics.
- **Context:** Deferred in D1 because the built schema is single-tenant and a second clinic isn't real yet. The Clerk auth gate is the foundation — the Clerk identity becomes the org member. Boring-by-default: don't spend the multi-tenant innovation token until clinic #2 is concrete.
- **Depends on:** This auth gate landing first; a real second clinic as the trigger.

### ~~Server-side role enforcement: requireOwner() — deferred from D11 (P1)~~ — **DONE 2026-05-29**

**RESOLVED:** `requireOwner()` ships in `lib/auth.ts`; every owner-grade Server Action in `app/(admin)/settings/actions.ts` is gated through `requireOwnerActor()` → `requireOwner()`. The privilege-escalation gap is closed.

- **What:** A `requireOwner()` guard applied to owner-grade Server Actions in `app/settings/actions.ts` (team mutation, role change, DSAR export, LINE-secret rotation, billing).
- **Why:** Without it, any authenticated Staff member can call Owner-only endpoints directly — server-side privilege escalation. Roles are currently UI-only.
- **Pros:** Closes a known privilege-escalation gap; makes the existing Owner/Staff model mean something at the API; cheap given the D9 guard infra.
- **Cons:** ~3h human / ~15 min CC. Small window of exposure until it lands.
- **Context:** Surfaced by Codex (#6), consciously deferred by the user in D11. Authentication + membership ship now; role checks are the immediate next follow-up. **Track as P1 — this is a deferred security gap, not a nice-to-have.**
- **Depends on:** D9 guard infrastructure (shipping in this PR).

### ~~Protect public chat media (signed URLs / authed proxy) — Codex #12~~ — **DONE 2026-05-29**

**RESOLVED (commit `edd32b4`):** `app/api/inbox/media/route.ts` is an authed media proxy gated by `requireApiMember()`. `savePublicMedia()` now writes Vercel Blob with `access: "private"`, `protectedMediaUrl()` routes all thread media through the proxy, and `lineAccessibleMediaUrl()` issues short-lived signed tokens for LINE delivery. The data-exposure path is closed.

- **What:** Chat images/videos are written by `lib/media.ts` `savePublicMedia()` to public Vercel Blob / `public/uploads`. Gating pages/APIs does NOT protect media URLs already referenced in threads. Add signed URLs or an authed media proxy that reuses the guard.
- **Why:** For a skin clinic, a leaked or guessed media URL exposes patient photos even with the app gated — a real privacy/PDPA exposure.
- **Pros:** Closes a data-exposure path the auth gate alone leaves open.
- **Cons:** Needs a media-proxy route or signed-URL scheme + migration of existing public URLs; expands scope beyond the gate.
- **Context:** Out of scope for the auth gate itself; surfaced by Codex outside-voice review. The proxy would reuse `requireApiMember()`.
- **Depends on:** Auth gate (guard helpers) landing first.

### Guard claim-caching for scale — deferred from D7 (P3)

- **What:** Cache membership/role in Clerk session claims to drop the per-request `team_members` lookup, if request volume ever makes it matter.
- **Why:** Avoids a per-request DB query at high traffic.
- **Pros:** Removes the hot-path query under load.
- **Cons:** Adds a stale-revocation window (fired staff keep access until token refresh) and a team_members↔Clerk-metadata sync to maintain.
- **Context:** Deferred in D7 — at clinic scale (a few staff) the indexed lookup is effectively free and instant revocation is worth more than the saved query. **P3: revisit only if request volume changes the math.**
- **Depends on:** Nothing.
