import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {riseIn, sceneFade, enter} from '../anim';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames, 14, 18);

  const mark = riseIn(frame, 4, 16, 22);
  const tag = riseIn(frame, 16, 14, 22);
  const url = riseIn(frame, 28, 14, 22);
  const lineW = enter(frame, 12, 22) * 96;

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          opacity: mark.opacity,
          transform: `translateY(${mark.y}px)`,
        }}
      >
        <Img
          src={staticFile('mimira-logo.png')}
          style={{
            width: 86,
            height: 86,
            borderRadius: 18,
          }}
        />
        <div style={{fontSize: 78, fontWeight: 600, letterSpacing: '-0.03em', color: C.fg}}>
          Mimira
        </div>
      </div>

      <div
        style={{
          height: 4,
          width: lineW,
          background: C.ai,
          borderRadius: RADIUS.full,
          margin: '30px 0 26px',
        }}
      />

      <div
        style={{
          fontSize: 32,
          color: C.fgMuted,
          opacity: tag.opacity,
          transform: `translateY(${tag.y}px)`,
          marginBottom: 36,
        }}
      >
        Warm replies. Booked appointments. Happy customers.
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: C.fg,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.full,
          padding: '12px 28px',
          opacity: url.opacity,
          transform: `translateY(${url.y}px) scale(${interpolate(url.opacity, [0, 1], [0.96, 1])})`,
        }}
      >
        mimira.tech
      </div>
    </AbsoluteFill>
  );
};
