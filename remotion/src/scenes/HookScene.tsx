import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {C, RADIUS} from '../theme';
import {sceneFade} from '../anim';

// Ambient drifting chat bubbles behind the opening line. Deterministic —
// every position is a function of the frame, so it renders identically.
const BUBBLES = [
  {x: 12, y: 22, w: 220, delay: 0, speed: 0.18, tint: false},
  {x: 70, y: 16, w: 180, delay: 8, speed: 0.14, tint: true},
  {x: 80, y: 64, w: 240, delay: 16, speed: 0.2, tint: false},
  {x: 16, y: 70, w: 200, delay: 24, speed: 0.12, tint: true},
  {x: 44, y: 84, w: 160, delay: 32, speed: 0.16, tint: false},
  {x: 6, y: 46, w: 150, delay: 40, speed: 0.1, tint: true},
  {x: 88, y: 38, w: 150, delay: 12, speed: 0.13, tint: false},
];

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames, 12, 16);

  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade, overflow: 'hidden'}}>
      {BUBBLES.map((b, i) => {
        const appear = interpolate(frame, [b.delay, b.delay + 22], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const drift = (frame - b.delay) * b.speed;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: (b.x / 100) * width,
              top: (b.y / 100) * height - drift,
              width: b.w,
              height: Math.round(b.w * 0.42),
              borderRadius: 22,
              borderBottomLeftRadius: i % 2 ? 22 : 6,
              borderBottomRightRadius: i % 2 ? 6 : 22,
              background: b.tint ? C.aiBg : C.surface,
              border: `1px solid ${b.tint ? `${C.ai}33` : C.border}`,
              boxShadow: '0 10px 34px rgba(15,23,42,0.05)',
              opacity: appear * 0.9,
              transform: `scale(${interpolate(appear, [0, 1], [0.9, 1])})`,
            }}
          >
            <div style={{padding: '0 18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8}}>
              <div style={{height: 7, width: '78%', borderRadius: RADIUS.full, background: b.tint ? `${C.ai}40` : C.borderSubtle}} />
              <div style={{height: 7, width: '52%', borderRadius: RADIUS.full, background: b.tint ? `${C.ai}30` : C.borderSubtle}} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
