import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {sceneFade} from '../anim';

const CX = 960;
const CY = 612;

type Channel = {name: string; mark: string; color: string; fg?: string; x: number; y: number};
const CHANNELS: Channel[] = [
  {name: 'LINE', mark: 'LINE', color: '#06C755', x: CX - 388, y: CY - 132},
  {name: 'Messenger', mark: 'f', color: '#0084FF', x: CX + 388, y: CY - 132},
  {name: 'Instagram', mark: 'IG', color: '#E1306C', x: CX - 452, y: CY + 118},
  {name: 'WhatsApp', mark: 'W', color: '#25D366', x: CX + 452, y: CY + 118},
  {name: 'TikTok', mark: '♪', color: '#111111', x: CX, y: CY + 300},
];

const CHIP_W = 196;
const CHIP_H = 60;

export const ChannelsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames);

  const hubP = interpolate(frame, [4, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ringPulse = 0.5 + 0.5 * Math.sin(frame / 9);

  return (
    <AbsoluteFill style={{background: C.bg, opacity: fade, fontFamily: SANS}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        {CHANNELS.map((ch, i) => {
          const appear = interpolate(frame, [10 + i * 6, 34 + i * 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          // A message dot travels from the channel into the hub, on a loop,
          // staggered per channel so traffic feels continuous + human-paced.
          const period = 64;
          const t = (((frame - i * 13) % period) + period) % period / period;
          const dx = interpolate(t, [0, 1], [ch.x, CX]);
          const dy = interpolate(t, [0, 1], [ch.y, CY]);
          const dotOp = Math.sin(Math.PI * t) * appear;
          return (
            <g key={ch.name}>
              <line
                x1={ch.x}
                y1={ch.y}
                x2={CX}
                y2={CY}
                stroke={C.border}
                strokeWidth={2}
                strokeDasharray="2 8"
                strokeLinecap="round"
                opacity={appear * 0.9}
              />
              <circle cx={dx} cy={dy} r={7} fill={ch.color} opacity={dotOp} />
            </g>
          );
        })}
      </svg>

      {/* Channel chips */}
      {CHANNELS.map((ch, i) => {
        const appear = interpolate(frame, [10 + i * 6, 34 + i * 6], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={ch.name}
            style={{
              position: 'absolute',
              left: ch.x - CHIP_W / 2,
              top: ch.y - CHIP_H / 2,
              width: CHIP_W,
              height: CHIP_H,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 16px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.full,
              boxShadow: '0 8px 26px rgba(15,23,42,0.07)',
              opacity: appear,
              transform: `translateY(${(1 - appear) * 14}px) scale(${interpolate(appear, [0, 1], [0.92, 1])})`,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: RADIUS.full,
                background: ch.color,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: ch.mark.length > 2 ? 11 : 16,
                fontWeight: 700,
                letterSpacing: ch.mark.length > 2 ? '0.02em' : 0,
              }}
            >
              {ch.mark}
            </div>
            <span style={{fontSize: 18, fontWeight: 500, color: C.fg}}>{ch.name}</span>
          </div>
        );
      })}

      {/* Mimira hub */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY,
          transform: `translate(-50%, -50%) scale(${interpolate(hubP, [0, 1], [0.8, 1])})`,
          opacity: hubP,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -18,
            borderRadius: 36,
            border: `2px solid ${C.ai}`,
            opacity: 0.18 + 0.22 * ringPulse,
            transform: `scale(${1 + ringPulse * 0.12})`,
          }}
        />
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 30,
            background: C.fg,
            color: C.bg,
            display: 'grid',
            placeItems: 'center',
            fontSize: 74,
            fontWeight: 600,
            boxShadow: `0 22px 60px rgba(10,124,124,0.22)`,
          }}
        >
          M
        </div>
      </div>

      {/* Response-time readout */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY + 132,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.full,
          padding: '9px 18px',
          fontSize: 17,
          color: C.fg,
          boxShadow: '0 8px 26px rgba(15,23,42,0.07)',
          opacity: interpolate(frame, [40, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        <span style={{width: 8, height: 8, borderRadius: 9999, background: C.success}} />
        Replies in <strong style={{fontWeight: 600}}>~8s</strong>
        <span style={{color: C.fgSubtle}}>·</span>
        <span style={{color: C.fgMuted}}>natural, human-like</span>
      </div>
    </AbsoluteFill>
  );
};
