# Mockups

Design references for the Yuna admin app. Open any `.html` file directly in a browser, or serve the directory:

```bash
cd mockups && python3 -m http.server 8042
# http://localhost:8042/inbox.html
```

These are **not** the app. They are the visual contract that the real Next.js implementation should match. When in doubt, the mockup wins for layout and interaction; `DESIGN-UI.md` wins for tokens.

| Mockup | Spec source | Notes |
|---|---|---|
| `inbox.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Inbox section) | Three-column shell, peak-hours tripwire case, contenteditable bubbles, Pretext-driven layout. Composer has AI-paused and staff-typing states. |
| `bookings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Bookings section) | Single-pane card stream: Pending (full cards) → Confirmed (compact rows, last 30d) → Declined/no-show (collapsed). Ambiguous intents get a warning-toned card border + `needs time` / `needs phone` badges. Confirm slides a card into the Confirmed list with a brief flourish. |
| `settings.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Settings section) | Nine collapsible cards, each saves independently. Line OA, AI brain, and Brand voice are open by default. AI brain card carries the only teal accent in the app (provider segment, kill switch). Section nav with scroll-spy on the left. |
| `broadcasts.html` | `DESIGN-UI.md` + `DESIGN-UX.md` (Broadcasts section) | Composer with two segment cards (All customers · Last 90 days) + a third tag-picker card that's disabled with a `Pro` badge, message body with character counter, schedule toggle, Line phone preview (Pretext bubble that re-wraps as you type), past broadcasts list (delivered · scheduled · stopped-early). v0 does not surface Line push quota in the admin — Line enforces server-side; partial sends show post-hoc. |

## Pretext

Text in mockups is laid out by [Pretext](https://github.com/chenglou/pretext) (`pretext.js`, 30 KB), not the browser's default text engine. Bubbles shrinkwrap to the narrowest width that produces the same line count, and re-layout on resize. Edit any bubble inline to see it re-measure.

When porting a mockup to the real app, keep Pretext for chat bubbles — the alternative is bubbles that stretch to `max-width` even when the text is short, which looks loud and breaks the "calm" polestar.
