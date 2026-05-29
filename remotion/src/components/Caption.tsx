import React from 'react';
import {C} from '../theme';
import {SANS} from '../fonts';
import {riseIn, sceneFade} from '../anim';

// Top-centered scene caption: teal kicker + black headline.
export const Caption: React.FC<{
  kicker: string;
  title: string;
  frame: number;
  total: number;
}> = ({kicker, title, frame, total}) => {
  const r = riseIn(frame, 4, 14, 20);
  const out = sceneFade(frame, total, 0, 12);
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: SANS,
        opacity: r.opacity * out,
        transform: `translateY(${r.y}px)`,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: C.ai,
          marginBottom: 10,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: C.fg,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
    </div>
  );
};

export const MimiraBadge: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: C.ai,
      background: C.aiBg,
      border: `1px solid ${C.ai}55`,
      borderRadius: 6,
      padding: '2px 7px',
      fontFamily: SANS,
      ...style,
    }}
  >
    Mimira
  </span>
);

export const AttentionBadge: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      fontWeight: 500,
      color: C.warning,
      background: `${C.warning}10`,
      border: `1px solid ${C.warning}4d`,
      borderRadius: 6,
      padding: '2px 8px',
      fontFamily: SANS,
    }}
  >
    <span style={{width: 6, height: 6, borderRadius: 9999, background: C.warning}} />
    {children}
  </span>
);
