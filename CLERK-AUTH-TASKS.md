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
| AG1 | P1 | Install Clerk; `proxy.ts` allowlist `/api/line/(.*)`, avoid `auth.protect()` (bug #8302) | ✅ | `proxy.ts` uses `isPublicRoute` matcher incl. `/api/line(.*)` and calls `auth.protect()` only for non-public routes. LINE webhook and future LINE callback routes stay public. |
| AG2 | P1 | `(auth)` bare group + `(app)` protected group | ✅ | Implemented as root `app/sign-in` + `app/sign-up` + protected `app/(admin)` group. Functionally equivalent to plan's naming. |
| AG3 | P1 | `lib/auth.ts`: `requireMember`/`requireApiMember`/`withAuthedAction`, all return the member | ✅ | Shipped 2026-05-30. `requireMember`/`requireOwner` return `CurrentMember`; `requireApiMember()` now returns `CurrentMember` or a 403 `NextResponse`; `withAuthedAction()` wraps member/owner Server Actions and is used by settings + knowledge actions. Commit: this task commit. |
| AG4 | P1 | Schema: `clerk_user_id` UNIQUE + `lower(email)` unique index | ✅ | Committed in `f5d36ea`: `db/schema.sql` adds nullable `clerk_user_id` + `idx_team_members_clerk_user_id` UNIQUE + `idx_team_members_email_lower` UNIQUE on `lower(email)`; `TeamMember` type + selects carry `clerk_user_id`. |
| AG5 | P1 | Hardened lazy-link (atomic, lower-email, verified primary, real actor) | ✅ | `getMemberForUser()` now: (1) rejects unverified primary emails; (2) resolves by `clerk_user_id` first (authoritative), then case-insensitive email; (3) binds the row via guarded+idempotent `linkClerkUserId()` on email-match and on bootstrap, so the link is atomic at the row level (unique index backstops concurrent sign-ins). Returned member carries the real `clerk_user_id` → unblocks AG13 actor. |
| AG6 | P1 | Guards on all `/api/inbox/*` + Server Actions (settings/knowledge) | ✅ | `/api/inbox/*` guarded (7 routes) ✅; `settings/actions.ts` guarded via `requireOwner` ✅; `knowledge/actions.ts` `createKnowledgeDoc` gated via `requireMember()` (committed `28af14d`). All P1 server-action/API surfaces covered. |
| AG7 | P1 | `inviteTeamMember()` → Clerk Invitations API; restrict signup | ✅ | `sendClerkInvitation()` → `client.invitations.createInvitation()` wired into `inviteTeamMember()`. Verify signup is actually restricted to invited emails. |
| AG8 | P1 | `ADMIN_EMAIL` bootstrap; demo seeds non-linkable in prod | ✅ | Shipped 2026-05-30. Demo non-linkable ✅ (`isDemoAccount`, seed excludes `@sukhumvit-skin.com`). `ADMIN_EMAIL` now restricts first-owner bootstrap to that verified Clerk primary email when configured; unset preserves dev/demo bootstrap behavior. Commit: this task commit. |
| AG9–AG12 | P1 | Vitest unit + 2 CRITICAL integration tests (LINE regression, direct-API 401) + e2e smoke | ◑ | Shipped 2026-05-30. Vitest harness added (`npm test`) with focused regressions for all 7 `/api/inbox/*` routes returning 403 before route validation when Clerk membership is missing, plus LINE webhook signature regression proving invalid signatures 401 and valid signed webhooks remain public/no-Clerk. Playwright e2e smoke and broader unit coverage still outstanding. Commit: this task commit. |
| AG13 | P2 | Replace hardcoded `ACTOR="Pim"` with real linked member | ✅ | Shipped 2026-05-30. Settings actions and inbox flag resolution now attribute changes to the authenticated Clerk-linked team member; demo booking labels no longer hardcode `Pim`. Commit: this task commit. |
| AG14 | P2 | Deploy/env checklist | ☐ | `.env.example` has Clerk keys; no written deploy/env checklist. |

### Already shipped beyond the original task list
- `requireOwner()` server-side role enforcement (was deferred P1 in TODOS.md) — **done**, commit gates all owner-grade settings actions.
- Public chat-media protection (Codex #12) — **done**, commit `edd32b4` (authed `/api/inbox/media` proxy + private Blob).
- Sign-in / sign-up page branding — **done**, commit `874ff91`. `app/sign-in` + `app/sign-up` wrapped in shared `app/_components/AuthLayout` (brand mark + product tagline) with a token-themed Clerk widget (`app/_components/clerkAppearance.ts`). Conforms to DESIGN-UX.md login-copy rule + DESIGN-UI.md radius/no-card-shadow hierarchy. Not an AG task; recorded here as a shipped extra.
- Demo Clerk user access — **done 2026-05-30, commit: this task commit.** `demo@mimira.tech` is now classified as a demo account, gets an Owner team-member row lazily on verified Clerk sign-in, and remains excluded from the real-team bootstrap/reset checks so it opens the seeded demo workspace instead of the Access not enabled screen.

## Suggested implementation order

The P1 spine is built (AG1–AG8 done). Remaining work is
hardening + tests. Recommended sequence for what's left:

1. **AG9–AG12** — add Playwright and a browser e2e smoke, then broaden unit coverage around lazy-link/bootstrap edge cases.
2. **AG14** — deploy/env checklist.
3. Then `/review` the diff → `/ship`.

## Carry-forward concern

`requireOwner()` is now implemented, closing the original D11 gap. Remaining hard blocker before
ship is **AG9–AG12** — the mandatory LINE-webhook and direct-API-401 regressions now exist in
Vitest, but browser e2e smoke and broader unit coverage are still missing.
