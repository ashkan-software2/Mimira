import React from 'react';
import {
  AbsoluteFill,
  Series,
  Sequence,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {C} from './theme';
import {VOICEOVER, VoiceLine} from './voiceover';
import {Intro} from './scenes/Intro';
import {HookScene} from './scenes/HookScene';
import {ChannelsScene} from './scenes/ChannelsScene';
import {InboxScene} from './scenes/InboxScene';
import {BookingScene} from './scenes/BookingScene';
import {PromoScene} from './scenes/PromoScene';
import {Outro} from './scenes/Outro';
import {Narration, tokenize, Token} from './components/Narration';

// 30 fps. Each scene = lead-in + its voiceover clip + tail.
const LEAD = 10; // frames before the VO starts (scene entrance)
const TAIL = 18; // frames after the VO ends (let the line breathe)

const SCENE_BY_ID: Record<string, React.FC> = {
  hook: HookScene,
  meet: Intro,
  answer: BookingScene,
  channels: ChannelsScene,
  inbox: InboxScene,
  outbound: PromoScene,
  outro: Outro,
};

// Kinetic captions. `center` lines are the hero (typography-only scenes);
// `top` lines sit above the product UI. Intro/Outro carry their own
// typography, so they have no overlay. Phrasing is condensed for legibility.
type NarrCfg = {variant: 'center' | 'top'; tokens: Token[]};
const NARRATION: Record<string, NarrCfg> = {
  hook: {
    variant: 'center',
    tokens: tokenize(
      'Your clinic runs on conversations. Managing all of them is where most operations fall short.',
      ['conversations', 'fall short'],
    ),
  },
  answer: {
    variant: 'top',
    tokens: tokenize('Answers every customer 24/7 — turning conversations into booked appointments.', [
      '24/7',
      'booked appointments',
    ]),
  },
  channels: {
    variant: 'top',
    tokens: tokenize('Across every social app — with natural, human-like response times.', [
      'every social app',
      'human-like',
    ]),
  },
  inbox: {
    variant: 'top',
    tokens: tokenize('Your staff inbox — jump in whenever a human touch is needed.', [
      'staff inbox',
      'human touch',
    ]),
  },
  outbound: {
    variant: 'top',
    tokens: tokenize('Intelligent outbound — promotions, aftercare, and reminders, sent automatically.', [
      'outbound',
      'automatically',
    ]),
  },
};

const sceneDuration = (line: VoiceLine) => LEAD + line.frames + TAIL;
export const TOTAL_FRAMES = VOICEOVER.reduce((n, l) => n + sceneDuration(l), 0);

// Caption + VO start LEAD frames into the scene, so useCurrentFrame here is
// rebased to the moment the voice begins.
const NarrationOverlay: React.FC<{cfg: NarrCfg; voFrames: number}> = ({cfg, voFrames}) => {
  const frame = useCurrentFrame();
  if (cfg.variant === 'center') {
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 200px'}}>
        <Narration tokens={cfg.tokens} frame={frame} total={voFrames} variant="center" />
      </AbsoluteFill>
    );
  }
  return (
    <div style={{position: 'absolute', top: 56, left: 220, right: 220, display: 'flex', justifyContent: 'center'}}>
      <Narration tokens={cfg.tokens} frame={frame} total={voFrames} variant="top" />
    </div>
  );
};

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Series>
        {VOICEOVER.map((line) => {
          const Scene = SCENE_BY_ID[line.id] ?? HookScene;
          const cfg = NARRATION[line.id];
          return (
            <Series.Sequence key={line.id} durationInFrames={sceneDuration(line)}>
              <Scene />
              <Sequence from={LEAD} name={`vo-${line.id}`}>
                <Audio src={staticFile(line.file)} />
                {cfg && <NarrationOverlay cfg={cfg} voFrames={line.frames} />}
              </Sequence>
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Music bed — "Bright Horizons Ahead", under the whole film, with in/out fades. */}
      <Audio
        src={staticFile('bright-horizons.wav')}
        loop
        volume={(f) =>
          0.14 *
          Math.min(
            interpolate(f, [0, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            interpolate(f, [TOTAL_FRAMES - 42, TOTAL_FRAMES - 6], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          )
        }
      />
    </AbsoluteFill>
  );
};
