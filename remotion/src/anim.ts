import {interpolate, Easing} from 'remotion';
import {EASE_ENTER, EASE_MOVE} from './theme';

const enterEase = Easing.bezier(...EASE_ENTER);
const moveEase = Easing.bezier(...EASE_MOVE);

// Eased 0→1 ramp starting at `delay`, lasting `dur` frames.
export const enter = (frame: number, delay: number, dur = 18) =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: enterEase,
  });

// Symmetric move (for tab highlight slides etc.).
export const move = (frame: number, delay: number, dur: number) =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: moveEase,
  });

// Fade a scene in over `inDur` and out over the last `outDur` frames.
// inDur/outDur of 0 mean "no fade on that edge".
export const sceneFade = (frame: number, total: number, inDur = 14, outDur = 12) => {
  const fadeIn = inDur > 0 ? interpolate(frame, [0, inDur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const fadeOut = outDur > 0 ? interpolate(frame, [total - outDur, total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  return Math.min(fadeIn, fadeOut);
};

// Slide + fade entrance: returns {opacity, translateY}.
export const riseIn = (frame: number, delay: number, dist = 16, dur = 20) => {
  const p = enter(frame, delay, dur);
  return {opacity: p, y: (1 - p) * dist};
};

export const smooth = Easing.bezier(0.22, 1, 0.36, 1);

export const cameraKeyframes = (frame: number, points: Array<[number, number]>) => {
  for (let i = 0; i < points.length - 1; i++) {
    const [aFrame, aValue] = points[i];
    const [bFrame, bValue] = points[i + 1];
    if (frame >= aFrame && frame <= bFrame) {
      return interpolate(frame, [aFrame, bFrame], [aValue, bValue], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: smooth,
      });
    }
  }

  return frame < points[0][0] ? points[0][1] : points[points.length - 1][1];
};

export const pulse = (frame: number, at: number, dur = 18) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: smooth,
  });

  return {
    opacity: Math.sin(Math.PI * p),
    scale: 0.96 + p * 0.1,
  };
};
