import {loadFont as loadLatin} from '@remotion/google-fonts/IBMPlexSans';
import {loadFont as loadThai} from '@remotion/google-fonts/IBMPlexSansThaiLooped';
import {loadFont as loadMono} from '@remotion/google-fonts/IBMPlexMono';

// Latin/UI face.
const {fontFamily: latin} = loadLatin('normal', {
  weights: ['400', '500', '600'],
  subsets: ['latin'],
});

// Thai face — load the 'thai' subset so customer messages render correctly
// in the render's headless Chromium (which has no system Thai font).
const {fontFamily: thai} = loadThai('normal', {
  weights: ['400', '500', '600'],
  subsets: ['thai', 'latin'],
});

const {fontFamily: monoFamily} = loadMono('normal', {
  weights: ['400', '500'],
  subsets: ['latin'],
});

// Order matters: Latin first, Thai second — browsers fall through per glyph.
export const SANS = `${latin}, ${thai}, system-ui, sans-serif`;
export const MONO = `${monoFamily}, ui-monospace, monospace`;
