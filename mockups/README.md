# Mockups

Design references for the Mimira admin app. Open any `.html` file directly in a browser, or serve the directory:

```bash
cd mockups && python3 -m http.server 8042
# http://localhost:8042/inbox.html
```

These are **not** the app. They are the visual contract that the real Next.js implementation should match. When in doubt, the mockup wins for layout and interaction; `DESIGN-UI.md` wins for tokens.

## Sharing the preview from this AWS workspace

The canonical path: serve from the workspace VM on port `8042`, bound to all interfaces, behind an AWS Security Group rule that allows the user's laptop IP. SSH local-forward is the laptop-side alternative when the user doesn't want to touch the SG.

### For agents (canonical setup — run on the VM)

The full recipe is in [`serve.sh`](./serve.sh). Run it any time:

```bash
bash ./serve.sh
```

It is idempotent: kills any prior server on 8042, restarts bound to `0.0.0.0`, fetches the EC2 public IPv4 via IMDSv2, self-tests reachability, and prints the URL. Sample output:

```
SERVER  http://127.0.0.1:8042/  (PID 12345)
PUBLIC  35.87.188.87
SELF-TEST  HTTP 200 in 0.002s  →  SG is open
URL     http://35.87.188.87:8042/settings.html
```

**Interpreting the self-test:**
- `HTTP 200` → ready. Hand the URL to the user.
- `000` / timeout → the AWS Security Group is blocking port 8042. The agent cannot fix this from inside the VM. Ask the user:
  > EC2 console → this instance → Security tab → Edit inbound rules → add `TCP 8042`, source = your laptop's IP (don't use `0.0.0.0/0`, the mockups have no auth). Then re-run `serve.sh`.

**EC2 public IPs change** when the instance is stopped and started, so always re-run `serve.sh` after a restart rather than caching the IP.

### Laptop-side alternative — SSH local-forward (no AWS console needed)

From the user's laptop:

```bash
ssh -L 8042:127.0.0.1:8042 ubuntu@<workspace-public-ip>
# leave open, then browse: http://localhost:8042/settings.html
```

The VM-side server still has to be running; run `serve.sh` on the VM first.

| Mockup | Spec source | Notes |
|---|---|---|
| `inbox.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Inbox section) | Three-column shell, peak-hours tripwire case, contenteditable bubbles, Pretext-driven layout. Composer has AI-paused and staff-typing states. |
| `bookings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Bookings section) | Single-pane card stream: Pending (full cards) → Confirmed (compact rows, last 30d) → Declined/no-show (collapsed). Ambiguous intents get a warning-toned card border + `needs time` / `needs phone` badges. Confirm slides a card into the Confirmed list with a brief flourish. |
| `settings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Settings section) | Ten collapsible cards, each saves independently. Line OA, AI brain, Kill switch, and Brand voice are open by default. Kill switch is its own card next to AI brain — both carry the teal AI accent and the only `Mimira` badges in the page. Section nav with scroll-spy on the left. |
| `broadcasts.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Broadcasts section) | Composer with two segment cards (All customers · Last 90 days) + a third tag-picker card that's disabled with a `Pro` badge, message body with character counter, schedule toggle, Line phone preview (Pretext bubble that re-wraps as you type), past broadcasts list (delivered · scheduled · stopped-early). v0 does not surface Line push quota in the admin — Line enforces server-side; partial sends show post-hoc. |

## Pretext

Text in mockups is laid out by [Pretext](https://github.com/chenglou/pretext) (`pretext.js`, 30 KB), not the browser's default text engine. Bubbles shrinkwrap to the narrowest width that produces the same line count, and re-layout on resize. Edit any bubble inline to see it re-measure.

When porting a mockup to the real app, keep Pretext for chat bubbles — the alternative is bubbles that stretch to `max-width` even when the text is short, which looks loud and breaks the "calm" polestar.
