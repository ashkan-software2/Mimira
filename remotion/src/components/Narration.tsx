import React from 'react';
import {interpolate, Easing} from 'remotion';
import {C} from '../theme';
import {SANS} from '../fonts';

// One word in a kinetic caption. `em` highlights it in the brand teal,
// `br` forces a line break after the word.
export type Token = {w: string; em?: boolean; br?: boolean};

// Turn a plain string into tokens, marking the given phrases as emphasized.
// Emphasis phrases are matched case-insensitively against word runs.
export function tokenize(text: string, emphasis: string[] = []): Token[] {
  const words = text.split(/\s+/).filter(Boolean);
  const emSet = new Set<number>();
  const lower = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
  for (const phrase of emphasis) {
    const parts = phrase
      .toLowerCase()
      .split(/\s+/)
      .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''));
    for (let i = 0; i + parts.length <= lower.length; i++) {
      let hit = true;
      for (let j = 0; j < parts.length; j++) {
        if (lower[i + j] !== parts[j]) {
          hit = false;
          break;
        }
      }
      if (hit) for (let j = 0; j < parts.length; j++) emSet.add(i + j);
    }
  }
  return words.map((w, i) => ({w, em: emSet.has(i)}));
}

const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Variant = 'center' | 'top';

const VARIANTS: Record<Variant, React.CSSProperties> = {
  center: {
    fontSize: 82,
    fontWeight: 600,
    lineHeight: 1.14,
    letterSpacing: '-0.025em',
    maxWidth: 1480,
    justifyContent: 'center',
  },
  top: {
    fontSize: 40,
    fontWeight: 600,
    lineHeight: 1.22,
    letterSpacing: '-0.02em',
    maxWidth: 1480,
    justifyContent: 'center',
  },
};

export const Narration: React.FC<{
  tokens: Token[];
  frame: number;
  total: number; // VO length in frames — reveal is paced across this
  variant?: Variant;
  style?: React.CSSProperties;
}> = ({tokens, frame, total, variant = 'center', style}) => {
  const n = tokens.length;
  // Spread word entrances across the first ~78% of the narration so the last
  // words land a beat before the line ends, then hold.
  const startAt = 4;
  const endAt = Math.max(startAt + n, total * 0.78);
  const v = VARIANTS[variant];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: variant === 'center' ? 22 : 12,
        rowGap: variant === 'center' ? 6 : 2,
        fontFamily: SANS,
        color: C.fg,
        textAlign: 'center',
        ...v,
        ...style,
      }}
    >
      {tokens.map((t, i) => {
        const delay = interpolate(i, [0, Math.max(1, n - 1)], [startAt, endAt], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const p = interpolate(frame, [delay, delay + 11], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: ease,
        });
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: 'inline-block',
                color: t.em ? C.ai : C.fg,
                opacity: interpolate(p, [0, 1], [0, 1]),
                transform: `translateY(${(1 - p) * 18}px)`,
                filter: `blur(${(1 - p) * 4}px)`,
              }}
            >
              {t.w}
            </span>
            {t.br && <span style={{flexBasis: '100%', height: 0}} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};
