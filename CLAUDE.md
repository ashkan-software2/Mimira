## Repo layout

- `app/`, `lib/`, `db/`, `scripts/`, `chunks/` — the Next.js app, runtime libraries, database schema, maintenance scripts, and seeded knowledge chunks. Run the dev server with `bash serve.sh` or `npm run dev`.
- `mockups/` — static HTML visual references. The real app must match the layout and tokens here.
- `DESIGN.md`, `DESIGN-DEMO.md`, `DESIGN-ENG.md`, `DESIGN-UX.md`, `DESIGN-UI.md`, `TEST-PLAN.md`, `TODOS.md` — shared design + planning docs at the worktree root. Read these before making product, architecture, or visual decisions. Keep app code in the root app folders above and never overwrite the shared docs without explicit user approval.

## Task completion protocol

When you finish a task (or a coherent chunk of one), follow the **Task completion
protocol** in `AGENTS.md`: mark progress in the relevant `*-TASKS.md` / `TODOS.md`
doc, commit code + doc together, and push the current branch — automatically, without
being asked. See `AGENTS.md` for the guardrails.

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Visual design system

Always read `DESIGN-UI.md` before making any visual or UI decision (colors, fonts, spacing, layout, motion, component primitives). It is the single source of truth for the admin app's look and feel.

The product/architecture design lives in `DESIGN.md`. `DESIGN-UI.md` is its visual companion — do not write visual tokens into `DESIGN.md`, and do not deviate from `DESIGN-UI.md` without explicit user approval. When running `/qa` or `/design-review`, flag any code that conflicts with the rules and tokens in `DESIGN-UI.md`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
