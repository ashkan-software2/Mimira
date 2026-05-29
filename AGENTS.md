# Coding Tasks

This workspace is a dev VM. User-visible app changes must be shipped to the
remote/deployment before the user can see them in their browser; local dev
server changes are only visible inside the VM unless explicitly exposed.

## Task completion protocol (do this automatically — do not wait to be asked)

Before starting implementation, scan the repo docs instead of reading only a
hand-picked subset: review `AGENTS.md` plus every root/shared `.md` file that can
affect the task, including task trackers, design docs, test plans, and mockup
READMEs. Use the docs to find the relevant tracker and constraints before
editing code.

While work is underway, mark ownership or progress as in-progress only in the
local VM. In-progress claims are coordination hints for local/concurrent agents,
not shipped project history. Do not commit or push in-progress-only tracking
changes.

When you finish a task, or a coherent self-contained chunk of one, complete ALL
of these before reporting back:

1. **Mark progress in the tracking doc.** Update the relevant `*-TASKS.md` /
   `TODOS.md` file: flip the item to done and note the commit hash. If the work
   wasn't a tracked task, add a one-line entry under the appropriate "shipped"
   section so the docs stay an accurate record.
2. **Commit** the code and the doc update together, with a descriptive message.
   End every commit message with the required `Co-Authored-By` trailer.
3. **Push** the current branch to its remote.

Guardrails (this repo runs concurrent agents on shared branches):
- Only stage YOUR task's related files — never sweep in another agent's
  in-progress work. Use explicit paths, not `git add -A`.
- Only commit/push after the work lints + typechecks clean (`npm run lint`).
- Only commit/push once the work or coherent chunk is complete. Local
  in-progress notes stay uncommitted until they are resolved into the final
  tracking update.
- Push the current branch only; never force-push or push other branches.

When spawning Claude Code sessions for coding work, tell the session to use gstack skills.

Examples:

- **Security audit:** `Load gstack. Run /cso`
- **Code review:** `Load gstack. Run /review`
- **QA test a URL:** `Load gstack. Run /qa https://...`
- **Build a feature end-to-end:** `Load gstack. Run /autoplan, implement the plan, then run /ship`
- **Plan before building:** `Load gstack. Run /office-hours then /autoplan. Save the plan, don't implement.`
