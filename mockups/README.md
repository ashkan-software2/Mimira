# Mockups

Design references for the Yuna admin app. Open any `.html` file directly in a browser, or serve the directory:

```bash
cd mockups && python3 -m http.server 8042
# http://localhost:8042/inbox.html
```

These are **not** the app. They are the visual contract that the real Next.js implementation should match. When in doubt, the mockup wins for layout and interaction; `DESIGN-UI.md` wins for tokens.

## Sharing the preview from this AWS workspace

The mockups live on the workspace VM. To preview from your laptop, either tunnel over SSH (no AWS console needed) or expose the port on the public IP.

**Option A — SSH local-forward.** On your laptop:

```bash
ssh -L 8042:127.0.0.1:8042 ubuntu@<workspace-public-ip>
# leave open, then browse: http://localhost:8042/settings.html
```

**Option B — public IP.** Bind the server to all interfaces and open the port in the AWS Security Group:

```bash
# On the VM
cd mockups && python3 -m http.server 8042 --bind 0.0.0.0
# In AWS Console: EC2 → this instance → Security → inbound rule
#   TCP 8042, source = My IP (not 0.0.0.0/0 — mockups have no auth)
# Get the public IPv4 from inside the VM:
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
curl -sH "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4
# Then browse: http://<that-ip>:8042/settings.html
```

EC2 public IPs change when the instance is stopped and started — re-check via IMDS after a restart. To keep the server running after you close the shell, use `nohup ... &` or `tmux`.

| Mockup | Spec source | Notes |
|---|---|---|
| `inbox.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Inbox section) | Three-column shell, peak-hours tripwire case, contenteditable bubbles, Pretext-driven layout. Composer has AI-paused and staff-typing states. |
| `bookings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Bookings section) | Single-pane card stream: Pending (full cards) → Confirmed (compact rows, last 30d) → Declined/no-show (collapsed). Ambiguous intents get a warning-toned card border + `needs time` / `needs phone` badges. Confirm slides a card into the Confirmed list with a brief flourish. |
| `settings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Settings section) | Ten collapsible cards, each saves independently. Line OA, AI brain, Kill switch, and Brand voice are open by default. Kill switch is its own card next to AI brain — both carry the teal AI accent and the only `Yuna` badges in the page. Section nav with scroll-spy on the left. |
| `broadcasts.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Broadcasts section) | Composer with two segment cards (All customers · Last 90 days) + a third tag-picker card that's disabled with a `Pro` badge, message body with character counter, schedule toggle, Line phone preview (Pretext bubble that re-wraps as you type), past broadcasts list (delivered · scheduled · stopped-early). v0 does not surface Line push quota in the admin — Line enforces server-side; partial sends show post-hoc. |

## Pretext

Text in mockups is laid out by [Pretext](https://github.com/chenglou/pretext) (`pretext.js`, 30 KB), not the browser's default text engine. Bubbles shrinkwrap to the narrowest width that produces the same line count, and re-layout on resize. Edit any bubble inline to see it re-measure.

When porting a mockup to the real app, keep Pretext for chat bubbles — the alternative is bubbles that stretch to `max-width` even when the text is short, which looks loud and breaks the "calm" polestar.
