import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {riseIn, sceneFade, enter} from '../anim';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames, 0, 14);

  const mark = riseIn(frame, 2, 18, 22);
  const word = riseIn(frame, 10, 14, 22);
  const tag = riseIn(frame, 22, 14, 22);
  const lineW = enter(frame, 30, 24) * 120;

  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: SANS,
        opacity: fade,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        <Img
          src={staticFile('mimira-logo.png')}
          style={{
            width: 116,
            height: 116,
            borderRadius: 24,
            opacity: mark.opacity,
            transform: `translateY(${mark.y}px) scale(${interpolate(mark.opacity, [0, 1], [0.92, 1])})`,
          }}
        />
        <div
          style={{
            fontSize: 104,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: C.fg,
            opacity: word.opacity,
            transform: `translateY(${word.y}px)`,
          }}
        >
          Mimira
        </div>
      </div>

      <div
        style={{
          height: 4,
          width: lineW,
          background: C.ai,
          borderRadius: RADIUS.full,
          marginTop: 34,
          marginBottom: 28,
        }}
      />

      <div
        style={{
          fontSize: 34,
          fontWeight: 400,
          color: C.fgMuted,
          letterSpacing: '-0.01em',
          opacity: tag.opacity,
          transform: `translateY(${tag.y}px)`,
        }}
      >
        The AI front desk for your clinic.
      </div>
    </AbsoluteFill>
  );
};
