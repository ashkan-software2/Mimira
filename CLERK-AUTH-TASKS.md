# Clerk Auth Gate — Implementation Tracker

**Live implementation status only.** The durable decision + task spec lives in
[DESIGN-ENG.md → Auth Gate Review](DESIGN-ENG.md#auth-gate-review-added-2026-05-29) (review
dashboard, decisions `AGD*`, task spec); deferred follow-ups live in [TODOS.md](TODOS.md) →
"Auth gate follow-ups". IDs here map 1:1 to the spec's `AG1–AG14` (= plan `T1–T14`).

**Status legend:** ✅ done · ◑ partial · ☐ not started
Statuses below were reconciled against the codebase on 2026-05-29 — re-verify before trusting.

## Task status

| ID | P | Task | Status | Notes (verified 2026-05-29) |
|----|---|------|--------|------|
| AG1 | P1 | Install Clerk; `proxy.ts` allowlist `/api/line/(.*)`, avoid `auth.protect()` (bug #8302) | ✅ | `proxy.ts` uses `isPublicRoute` matcher incl. `/api/line/webhook`; calls `auth.protect()` only for non-public routes. **Recheck:** plan said avoid `auth.protect()` — confirm the guarded usage doesn't hit bug #8302, and that the LINE matcher covers `/api/line/(.*)` not just `/webhook`. |
| AG2 | P1 | `(auth)` bare group + `(app)` protected group | ✅ | Implemented as root `app/sign-in` + `app/sign-up` + protected `app/(admin)` group. Functionally equivalent to plan's naming. |
| AG3 | P1 | `lib/auth.ts`: `requireMember`/`requireApiMember`/`withAuthedAction`, all return the member | ◑ | `requireMember` ✅, `requireApiMember` ✅, `requireOwner` ✅. **`withAuthedAction` wrapper NOT implemented** — settings uses ad-hoc `requireOwnerActor()` instead. |
| AG4 | P1 | Schema: `clerk_user_id` UNIQUE + `lower(email)` unique index | ☐ | **No `clerk_user_id` column.** `team_members.email` is `TEXT NOT NULL UNIQUE` (case-sensitive), not a `lower(email)` unique index. Linking is by email only. |
| AG5 | P1 | Hardened lazy-link (atomic, lower-email, verified primary, real actor) | ◑ | `getMemberForUser()` lazy-links by email + `bootstrapFirstOwner`, lowercases on insert. **Missing:** atomic upsert, verified-primary-email check, real actor (see AG13). |
| AG6 | P1 | Guards on all `/api/inbox/*` + Server Actions (settings/knowledge) | ◑ | `/api/inbox/*` guarded (7 routes) ✅; `settings/actions.ts` guarded via `requireOwner` ✅. **`knowledge/actions.ts` has NO guard** — gap. |
| AG7 | P1 | `inviteTeamMember()` → Clerk Invitations API; restrict signup | ✅ | `sendClerkInvitation()` → `client.invitations.createInvitation()` wired into `inviteTeamMember()`. Verify signup is actually restricted to invited emails. |
| AG8 | P1 | `ADMIN_EMAIL` bootstrap; demo seeds non-linkable in prod | ◑ | Demo non-linkable ✅ (`isDemoAccount`, seed excludes `@sukhumvit-skin.com`). **`ADMIN_EMAIL` env bootstrap NOT present** — `bootstrapFirstOwner` promotes the first signed-in user instead. |
| AG9–AG12 | P1 | Vitest unit + 2 CRITICAL integration tests (LINE regression, direct-API 401) + e2e smoke | ☐ | **No test framework installed** — no vitest/playwright config, no app tests. The LINE-webhook regression test is mandatory per the review. |
| AG13 | P2 | Replace hardcoded `ACTOR="Pim"` with real linked member | ☐ | Still `const ACTOR = "Pim"` in `app/api/inbox/flags/route.ts` and `app/(admin)/settings/actions.ts`; booking labels in `bookings/data.ts` also hardcode "Pim". |
| AG14 | P2 | Deploy/env checklist | ☐ | `.env.example` has Clerk keys; no written deploy/env checklist. |

### Already shipped beyond the original task list
- `requireOwner()` server-side role enforcement (was deferred P1 in TODOS.md) — **done**, commit gates all owner-grade settings actions.
- Public chat-media protection (Codex #12) — **done**, commit `edd32b4` (authed `/api/inbox/media` proxy + private Blob).

## Suggested implementation order

The P1 spine is mostly built; remaining work is hardening + tests. Recommended sequence:

1. **AG4** — add `clerk_user_id` column + `lower(email)` unique index (migration). Foundation for AG5.
2. **AG5** — harden lazy-link onto AG4 (atomic upsert, verified-primary-email).
3. **AG6 (finish)** — add the missing guard to `knowledge/actions.ts`.
4. **AG3 (finish)** — extract `withAuthedAction` wrapper; refactor settings/knowledge actions onto it.
5. **AG13** — thread the real linked member through as actor (depends on AG5).
6. **AG8 (finish)** — add `ADMIN_EMAIL` bootstrap path.
7. **AG9–AG12** — install Vitest + Playwright; write the LINE-webhook regression + direct-API-401 integration tests first (mandatory), then unit + e2e smoke.
8. **AG14** — deploy/env checklist.
9. Then `/review` the diff → `/ship`.

## Carry-forward concern

`requireOwner()` is now implemented, closing the original D11 gap. Remaining hard blocker before
ship is **AG9–AG12** — the mandatory LINE-webhook regression test does not yet exist, so the
"direct-API 401" and "LINE still works" guarantees are currently unverified by CI.
