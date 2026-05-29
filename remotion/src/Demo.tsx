import React from 'react';
import {AbsoluteFill, Series, Audio, staticFile} from 'remotion';
import {C} from './theme';
import {Intro} from './scenes/Intro';
import {InboxScene} from './scenes/InboxScene';
import {BookingScene} from './scenes/BookingScene';
import {CapacityScene} from './scenes/CapacityScene';
import {PromoScene} from './scenes/PromoScene';
import {Outro} from './scenes/Outro';

// 30 fps. Total = 1170 frames = 39s.
export const SCENES = [
  {Comp: Intro, dur: 90},
  {Comp: InboxScene, dur: 300},
  {Comp: BookingScene, dur: 225},
  {Comp: CapacityScene, dur: 195},
  {Comp: PromoScene, dur: 225},
  {Comp: Outro, dur: 135},
];
export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.dur, 0);

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Series>
        {SCENES.map(({Comp, dur}, i) => (
          <Series.Sequence key={i} durationInFrames={dur}>
            <Comp />
          </Series.Sequence>
        ))}
      </Series>
      <Audio src={staticFile('music.wav')} volume={0.85} />
    </AbsoluteFill>
  );
};
