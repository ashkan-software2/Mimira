// Deterministic, royalty-free upbeat music bed for the Mimira demo.
// Synthesizes a polished product-demo bed, timed UI clicks, soft whooshes,
// and confirmation chimes, then writes a 16-bit PCM stereo WAV to public/.
// No external deps — pure math, fully reproducible.

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'music.wav');

const SR = 44100;
const DUR = 39; // seconds (matches the 1170-frame / 30fps composition)
const N = Math.floor(SR * DUR);

const L = new Float32Array(N);
const R = new Float32Array(N);

// midi note -> frequency
const f = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Seeded LCG for the shaker (deterministic "noise").
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

// --- Chord progression: I–V–vi–IV in C major, optimistic voicings ---
// Each chord = upper voices (for pad + arpeggio) + a bass root.
const CHORDS = [
  {bass: 36, notes: [48, 55, 60, 64, 67, 74]}, // C add9
  {bass: 31, notes: [43, 50, 55, 59, 62, 67]}, // G
  {bass: 33, notes: [45, 52, 57, 60, 64, 67]}, // Am7
  {bass: 29, notes: [41, 48, 53, 57, 60, 67]}, // F add9
];

const CHORD_DUR = 2.0; // seconds per chord
const addSample = (i, v) => {
  if (i < 0 || i >= N) return;
  L[i] += v;
  R[i] += v;
};
const addStereo = (i, vl, vr) => {
  if (i < 0 || i >= N) return;
  L[i] += vl;
  R[i] += vr;
};

// --- Pad: soft additive sines per chord note, slow attack/release ---
for (let c = 0; c * CHORD_DUR < DUR; c++) {
  const chord = CHORDS[c % CHORDS.length];
  const t0 = c * CHORD_DUR;
  const start = Math.floor(t0 * SR);
  const len = Math.floor(CHORD_DUR * SR);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    // quicker attack keeps the bed more forward and inspirational.
    const atk = Math.min(1, t / 0.22);
    const rel = Math.min(1, (CHORD_DUR - t) / 0.45);
    const env = Math.max(0, Math.min(atk, rel));
    let s = 0;
    for (const m of chord.notes) {
      const freq = f(m);
      const ph = 2 * Math.PI * freq * t;
      // two partials, gentle
      s += Math.sin(ph) * 0.6 + Math.sin(2 * ph) * 0.08;
    }
    s = (s / chord.notes.length) * 0.11 * env;
    // slow stereo shimmer
    const pan = 0.5 + 0.12 * Math.sin(2 * Math.PI * 0.05 * (t0 + t));
    addStereo(start + j, s * (1 - pan + 0.5), s * (pan + 0.5));
  }
}

// --- Sub bass: sine on chord root ---
for (let c = 0; c * CHORD_DUR < DUR; c++) {
  const chord = CHORDS[c % CHORDS.length];
  const t0 = c * CHORD_DUR;
  const start = Math.floor(t0 * SR);
  const len = Math.floor(CHORD_DUR * SR);
  const freq = f(chord.bass);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.max(0, Math.min(t / 0.18, (CHORD_DUR - t) / 0.35, 1));
    const s = Math.sin(2 * Math.PI * freq * t) * 0.075 * env;
    addSample(start + j, s);
  }
}

// --- Arpeggio: bright pluck, sixteenth-note feel, rises through chord ---
const STEP = 0.24; // seconds between plucks
const pluck = (startSec, freq, gain) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.9 * SR);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 5.5);
    const ph = 2 * Math.PI * freq * t;
    const s =
      (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) *
      env *
      gain;
    const pan = 0.5 + 0.22 * Math.sin(startSec * 2.7);
    addStereo(start + j, s * (1.1 - pan), s * (0.65 + pan));
  }
};
{
  let step = 0;
  for (let tSec = 0.9; tSec < DUR - 1.5; tSec += STEP) {
    const c = Math.floor(tSec / CHORD_DUR) % CHORDS.length;
    const chord = CHORDS[c];
    // cycle through upper four voices, occasionally an octave up
    const voices = chord.notes.slice(2);
    const idx = step % voices.length;
    let m = voices[idx];
    if (step % 8 === 7) m += 12;
    pluck(tSec, f(m), step % 8 === 0 ? 0.095 : 0.068);
    step++;
  }
}

// --- Light drums: soft kick and clap for forward movement ---
const kick = (startSec, gain) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.22 * SR);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 18);
    const freq = 92 - 44 * Math.min(1, t / 0.12);
    const s = Math.sin(2 * Math.PI * freq * t) * env * gain;
    addSample(start + j, s);
  }
};

const clap = (startSec, gain) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.16 * SR);
  let prev = 0;
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 24);
    const white = rnd() * 2 - 1;
    const snap = (white - prev) * env * gain;
    prev = white;
    addStereo(start + j, snap, snap * 0.92);
  }
};

for (let tSec = 0.72; tSec < DUR - 1.0; tSec += 0.96) {
  kick(tSec, 0.15);
  kick(tSec + 0.48, 0.055);
  clap(tSec + 0.48, 0.026);
}

// --- Light shaker: filtered noise burst on the off-beats ---
const shaker = (startSec, gain) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.12 * SR);
  let prev = 0;
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 38);
    const white = rnd() * 2 - 1;
    // simple high-pass-ish via differencing for a "tss" timbre
    const s = (white - prev) * env * gain;
    prev = white;
    addStereo(start + j, s * 0.9, s);
  }
};
for (let tSec = 0.84; tSec < DUR - 1.0; tSec += STEP) {
  // accent pattern: softer on the beat, brighter on the &
  const isOff = Math.round(tSec / STEP) % 2 === 1;
  shaker(tSec, isOff ? 0.032 : 0.018);
}

// --- Product UI sound design: short, clean accents synced to visual moments ---
const uiClick = (startSec, gain = 0.16, pan = 0.5) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.075 * SR);
  let prev = 0;
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 70);
    const white = rnd() * 2 - 1;
    const tick = (white - prev) * 0.42;
    prev = white;
    const tone = Math.sin(2 * Math.PI * 2100 * t) * 0.58 + Math.sin(2 * Math.PI * 3150 * t) * 0.22;
    const s = (tick + tone) * env * gain;
    addStereo(start + j, s * (1.15 - pan), s * (0.85 + pan));
  }
};

const softPop = (startSec, gain = 0.12, pan = 0.5) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.18 * SR);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 18);
    const bend = 680 + 260 * Math.exp(-t * 16);
    const s = Math.sin(2 * Math.PI * bend * t) * env * gain;
    addStereo(start + j, s * (1.08 - pan), s * (0.92 + pan));
  }
};

const chime = (startSec, gain = 0.12, pan = 0.5) => {
  [0, 0.075, 0.14].forEach((offset, idx) => {
    const freq = [1046.5, 1318.5, 1568][idx];
    const start = Math.floor((startSec + offset) * SR);
    const len = Math.floor(0.58 * SR);
    for (let j = 0; j < len; j++) {
      const t = j / SR;
      const env = Math.exp(-t * 5.8);
      const s = Math.sin(2 * Math.PI * freq * t) * env * gain * (idx === 2 ? 0.75 : 1);
      addStereo(start + j, s * (1.05 - pan), s * (0.95 + pan));
    }
  });
};

const sweep = (startSec, gain = 0.035, pan = 0.5) => {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.52 * SR);
  let prev = 0;
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const p = t / 0.52;
    const env = Math.sin(Math.PI * p);
    const white = rnd() * 2 - 1;
    const hp = white - prev;
    prev = white;
    const s = hp * env * gain * (0.35 + p);
    addStereo(start + j, s * (1.1 - pan), s * (0.9 + pan));
  }
};

[
  [0.38, 0.13, 0.48],
  [1.03, 0.1, 0.52],
  [4.16, 0.11, 0.42],
  [5.36, 0.16, 0.38],
  [13.88, 0.14, 0.58],
  [16.18, 0.19, 0.63],
  [22.45, 0.12, 0.44],
  [28.84, 0.2, 0.62],
  [30.3, 0.15, 0.56],
  [35.42, 0.11, 0.5],
].forEach(([t, g, p]) => uiClick(t, g, p));

[
  [5.28, 0.11, 0.4],
  [13.78, 0.1, 0.56],
  [22.38, 0.09, 0.42],
  [30.24, 0.11, 0.58],
].forEach(([t, g, p]) => softPop(t, g, p));

[
  [3.9, 0.024, 0.42],
  [13.45, 0.024, 0.55],
  [21.95, 0.02, 0.42],
  [28.45, 0.024, 0.58],
].forEach(([t, g, p]) => sweep(t, g, p));

chime(16.26, 0.055, 0.58);
chime(30.38, 0.048, 0.58);

// --- Master: gentle fade in/out + normalize + soft clip ---
const fadeIn = Math.floor(1.2 * SR);
const fadeOut = Math.floor(2.0 * SR);
let peak = 0;
for (let i = 0; i < N; i++) {
  if (i < fadeIn) {
    const g = i / fadeIn;
    L[i] *= g;
    R[i] *= g;
  }
  if (i > N - fadeOut) {
    const g = (N - i) / fadeOut;
    L[i] *= g;
    R[i] *= g;
  }
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.89 / peak : 1;
const softclip = (x) => Math.tanh(x * 1.05);

// --- Write 16-bit PCM stereo WAV ---
const bytesPerSample = 2;
const channels = 2;
const dataLen = N * channels * bytesPerSample;
const buf = Buffer.alloc(44 + dataLen);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataLen, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(channels, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * channels * bytesPerSample, 28);
buf.writeUInt16LE(channels * bytesPerSample, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataLen, 40);

let off = 44;
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, softclip(L[i] * norm)));
  const r = Math.max(-1, Math.min(1, softclip(R[i] * norm)));
  buf.writeInt16LE((l * 32767) | 0, off);
  buf.writeInt16LE((r * 32767) | 0, off + 2);
  off += 4;
}

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, buf);
console.log(`Wrote ${OUT} (${DUR}s, ${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
