# Mimira promo video (Remotion)

A 1080p brand promo for Mimira, built with [Remotion](https://remotion.dev).
Kinetic-typography narration synced to an ElevenLabs voiceover, intercut with
the product UI. Renders to `out/mimira-promo.mp4` (~62s).

## Pipeline

1. **Voiceover** — `npm run voiceover` synthesizes one clip per script line with
   ElevenLabs TTS (voice `fviOuGnDdPySDtD0rt0F`, model `eleven_multilingual_v2`),
   writes `public/vo/line*.mp3`, and emits the timing manifest `src/voiceover.ts`
   (per-line duration in frames @ 30fps). Reads `ELEVEN_LABS_API_KEY` from
   `../.env.local`. `FORCE=1 npm run voiceover` regenerates every clip.
2. **Music bed** — `npm run audio` regenerates the royalty-free bed (`public/music.wav`).
3. **Preview** — `npm run studio`.
4. **Render** — `npm run render` → `out/mimira-promo.mp4`.

## Composition (`src/Demo.tsx`)

`Demo` builds a `<Series>` from `VOICEOVER`: each script line is one scene whose
duration is `LEAD + voiceover frames + TAIL`, so visuals always match the
narration even if the voiceover is re-synthesized. Each line plays its `<Audio>`
clip and overlays a kinetic caption (`components/Narration.tsx`, word-by-word
reveal paced across the clip). The music bed loops underneath with in/out fades.

| Line       | Scene                       | On-screen caption                      |
|------------|-----------------------------|----------------------------------------|
| `hook`     | `HookScene` (typography)     | "Your clinic runs on conversations…"   |
| `meet`     | `Intro` (brand bumper)       | — (built-in wordmark)                  |
| `answer`   | `BookingScene`               | "Answers every customer 24/7 …"        |
| `channels` | `ChannelsScene` (hub/spoke)  | "Across every social app …"            |
| `inbox`    | `InboxScene`                 | "Your staff inbox …"                   |
| `outbound` | `PromoScene`                 | "Intelligent outbound …"               |
| `outro`    | `Outro` (brand bumper)       | — (built-in wordmark)                  |

The script lives in `scripts/gen-voiceover.mjs` (`LINES`); the captions and
scene mapping live in `src/Demo.tsx` (`NARRATION`, `SCENE_BY_ID`). Colors and
type follow the app's tokens in `src/theme.ts` / `src/fonts.ts`.
