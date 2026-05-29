# Clerk Auth Gate — Implementation Tracker

**Live implementation status only.** The durable decision + task spec lives in
[DESIGN-ENG.md → Auth Gate Review](DESIGN-ENG.md#auth-gate-review-added-2026-05-29) (review
dashboard, decisions `AGD*`, task spec); deferred follow-ups live in [TODOS.md](TODOS.md) →
"Auth gate follow-ups". IDs here map 1:1 to the spec's `AG1–AG14` (= plan `T1–T14`).

**Status legend:** ✅ done · ◑ partial · ☐ not started · 🔒 in progress (claimed — do not pick up)
Statuses below were reconciled against the codebase on 2026-05-29 — re-verify before trusting.

## Task status

| ID | P | Task | Status | Notes (verified 2026-05-29) |
|----|---|------|--------|------|
| AG1 | P1 | Install Clerk; `proxy.ts` allowlist `/api/line/(.*)`, avoid `auth.protect()` (bug #8302) | ✅ | `proxy.ts` uses `isPublicRoute` matcher incl. `/api/line/webhook`; calls `auth.protect()` only for non-public routes. **Recheck:** plan said avoid `auth.protect()` — confirm the guarded usage doesn't hit bug #8302, and that the LINE matcher covers `/api/line/(.*)` not just `/webhook`. |
| AG2 | P1 | `(auth)` bare group + `(app)` protected group | ✅ | Implemented as root `app/sign-in` + `app/sign-up` + protected `app/(admin)` group. Functionally equivalent to plan's naming. |
| AG3 | P1 | `lib/auth.ts`: `requireMember`/`requireApiMember`/`withAuthedAction`, all return the member | ◑ | `requireMember` ✅, `requireApiMember` ✅, `requireOwner` ✅. **`withAuthedAction` wrapper NOT implemented** — settings uses ad-hoc `requireOwnerActor()` instead. |
| AG4 | P1 | Schema: `clerk_user_id` UNIQUE + `lower(email)` unique index | ✅ | Committed in `f5d36ea`: `db/schema.sql` adds nullable `clerk_user_id` + `idx_team_members_clerk_user_id` UNIQUE + `idx_team_members_email_lower` UNIQUE on `lower(email)`; `TeamMember` type + selects carry `clerk_user_id`. |
| AG5 | P1 | Hardened lazy-link (atomic, lower-email, verified primary, real actor) | ✅ | `getMemberForUser()` now: (1) rejects unverified primary emails; (2) resolves by `clerk_user_id` first (authoritative), then case-insensitive email; (3) binds the row via guarded+idempotent `linkClerkUserId()` on email-match and on bootstrap, so the link is atomic at the row level (unique index backstops concurrent sign-ins). Returned member carries the real `clerk_user_id` → unblocks AG13 actor. |
| AG6 | P1 | Guards on all `/api/inbox/*` + Server Actions (settings/knowledge) | ✅ | `/api/inbox/*` guarded (7 routes) ✅; `settings/actions.ts` guarded via `requireOwner` ✅; `knowledge/actions.ts` `createKnowledgeDoc` gated via `requireMember()` (committed `28af14d`). All P1 server-action/API surfaces covered. |
| AG7 | P1 | `inviteTeamMember()` → Clerk Invitations API; restrict signup | ✅ | `sendClerkInvitation()` → `client.invitations.createInvitation()` wired into `inviteTeamMember()`. Verify signup is actually restricted to invited emails. |
| AG8 | P1 | `ADMIN_EMAIL` bootstrap; demo seeds non-linkable in prod | ◑ | Demo non-linkable ✅ (`isDemoAccount`, seed excludes `@sukhumvit-skin.com`). **`ADMIN_EMAIL` env bootstrap NOT present** — `bootstrapFirstOwner` promotes the first signed-in user instead. |
| AG9–AG12 | P1 | Vitest unit + 2 CRITICAL integration tests (LINE regression, direct-API 401) + e2e smoke | ☐ | **No test framework installed** — no vitest/playwright config, no app tests. The LINE-webhook regression test is mandatory per the review. |
| AG13 | P2 | Replace hardcoded `ACTOR="Pim"` with real linked member | ☐ | Still `const ACTOR = "Pim"` in `app/api/inbox/flags/route.ts` and `app/(admin)/settings/actions.ts`; booking labels in `bookings/data.ts` also hardcode "Pim". |
| AG14 | P2 | Deploy/env checklist | ☐ | `.env.example` has Clerk keys; no written deploy/env checklist. |

### Already shipped beyond the original task list
- `requireOwner()` server-side role enforcement (was deferred P1 in TODOS.md) — **done**, commit gates all owner-grade settings actions.
- Public chat-media protection (Codex #12) — **done**, commit `edd32b4` (authed `/api/inbox/media` proxy + private Blob).
- Sign-in / sign-up page branding — **done**, commit `874ff91`. `app/sign-in` + `app/sign-up` wrapped in shared `app/_components/AuthLayout` (brand mark + product tagline) with a token-themed Clerk widget (`app/_components/clerkAppearance.ts`). Conforms to DESIGN-UX.md login-copy rule + DESIGN-UI.md radius/no-card-shadow hierarchy. Not an AG task; recorded here as a shipped extra.

## Suggested implementation order

The P1 spine is built (AG1–AG2, AG4–AG7 done; AG3/AG8 partial). Remaining work is
hardening + tests. Recommended sequence for what's left:

1. **AG3 (finish)** — extract `withAuthedAction` wrapper; refactor settings/knowledge actions onto it.
2. **AG13** — thread the real linked member through as actor (depends on AG5, now done).
3. **AG8 (finish)** — add `ADMIN_EMAIL` bootstrap path.
4. **AG9–AG12** — install Vitest + Playwright; write the LINE-webhook regression + direct-API-401 integration tests first (mandatory), then unit + e2e smoke.
5. **AG14** — deploy/env checklist.
6. Then `/review` the diff → `/ship`.

## Carry-forward concern

`requireOwner()` is now implemented, closing the original D11 gap. Remaining hard blocker before
ship is **AG9–AG12** — the mandatory LINE-webhook regression test does not yet exist, so the
"direct-API 401" and "LINE still works" guarantees are currently unverified by CI.
