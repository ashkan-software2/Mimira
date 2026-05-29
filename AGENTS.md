# Coding Tasks

This workspace is a dev VM. User-visible app changes must be shipped to the
remote/deployment before the user can see them in their browser; local dev
server changes are only visible inside the VM unless explicitly exposed.

When spawning Claude Code sessions for coding work, tell the session to use gstack skills.

Examples:

- **Security audit:** `Load gstack. Run /cso`
- **Code review:** `Load gstack. Run /review`
- **QA test a URL:** `Load gstack. Run /qa https://...`
- **Build a feature end-to-end:** `Load gstack. Run /autoplan, implement the plan, then run /ship`
- **Plan before building:** `Load gstack. Run /office-hours then /autoplan. Save the plan, don't implement.`
