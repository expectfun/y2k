// Shared audio: one AudioContext, unlocked by the entrance click, plus small synth helpers.
// Everything is synthesized — no recordings, no licensing.

const MUTE_KEY = 'y2k.muted';
const VOLUME = 0.9;

let ac = null;
let master = null;
let noiseBuf = null;
let muted = readMuted();

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}

export function isMuted() { return muted; }

export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ac.currentTime, 0.015);
}

// A bus groups sounds so they can be cut together (e.g. hanging up mid-handshake).
export function createBus() {
  if (!ac) return null;
  const g = ac.createGain();
  g.connect(master);
  return g;
}

export function stopBus(bus) {
  if (!ac || !bus) return;
  const t = ac.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + 0.03);
  setTimeout(() => { try { bus.disconnect(); } catch { /* already gone */ } }, 100);
}

// --- building blocks -------------------------------------------------------

const now = () => ac.currentTime + 0.01;

function env(at, dur, gain, dest, attack = 0.005, release = 0.02) {
  const g = ac.createGain();
  const a = Math.min(attack, dur / 3);
  const r = Math.min(release, dur / 3);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + a);
  g.gain.setValueAtTime(gain, at + dur - r);
  g.gain.linearRampToValueAtTime(0, at + dur);
  g.connect(dest);
  return g;
}

function osc(freq, type, at, dur, dest) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(dest);
  o.start(at);
  o.stop(at + dur + 0.02);
  return o;
}

function tones(freqs, at, dur, gain, { type = 'sine', bus, attack, release } = {}) {
  const g = env(at, dur, gain, bus || master, attack, release);
  for (const f of [].concat(freqs)) osc(f, type, at, dur, g);
  return g;
}

function bell(freq, at, dur, gain, bus) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(bus || master);
  osc(freq, 'triangle', at, dur, g);
}

function getNoise() {
  if (!noiseBuf) {
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(at, dur, gain, { freq = 1800, q = 0.8, type = 'bandpass', bus, attack, release } = {}) {
  const src = ac.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  filter.Q.value = q;
  const g = env(at, dur, gain, bus || master, attack, release);
  src.connect(filter);
  filter.connect(g);
  src.start(at, Math.random());
  src.stop(at + dur + 0.02);
  return { filter, gain: g };
}

// Amplitude-modulated tone (the answering modem's 2100 Hz "wobble").
function am(freq, at, dur, gain, rate, depth, dest) {
  const g = env(at, dur, gain, dest, 0.02, 0.02);
  const m = ac.createGain();
  m.gain.value = 1 - depth;
  m.connect(g);
  osc(freq, 'sine', at, dur, m);
  const lfoGain = ac.createGain();
  lfoGain.gain.value = depth;
  lfoGain.connect(m.gain);
  osc(rate, 'sine', at, dur, lfoGain);
}

// Frequency-shift keying: random bits at 300 baud, the chirpy "negotiation".
function fsk(f0, f1, at, dur, gain, dest) {
  const g = env(at, dur, gain, dest);
  const o = ac.createOscillator();
  o.type = 'sine';
  const baud = 300;
  const n = Math.floor(dur * baud);
  for (let i = 0; i < n; i++) o.frequency.setValueAtTime(Math.random() < 0.5 ? f0 : f1, at + i / baud);
  o.connect(g);
  o.start(at);
  o.stop(at + dur + 0.02);
}

// The long "kshhhh": scrambled data training, band-limited to a phone line.
function hiss(at, dur, gain, freq, dest) {
  const { filter } = noise(at, dur, gain, { freq, q: 0.6, bus: dest, release: 0.01 });
  filter.frequency.linearRampToValueAtTime(freq * 1.25, at + dur);
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 260;
  lfoGain.connect(filter.frequency);
  osc(6.5, 'sine', at, dur, lfoGain);
}

// --- public sounds -------------------------------------------------------

export function welcome() {
  if (!ac) return;
  const s = now();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, s + i * 0.09, 0.9, 0.07));
}

export function keyBeep() {
  if (!ac) return;
  tones(1400, now(), 0.055, 0.03, { type: 'square' });
}

// Wooden bead click; a bigger move gets a second clack.
export function clack(moved = 1) {
  if (!ac) return;
  const s = now();
  noise(s, 0.035, 0.35, { freq: 2200 + Math.random() * 600, q: 2.5, release: 0.025 });
  tones(500 + Math.random() * 90, s, 0.045, 0.05, { type: 'triangle' });
  if (moved > 2) noise(s + 0.03, 0.03, 0.22, { freq: 2600, q: 2.5 });
}

export function buzz() {
  if (!ac) return;
  tones(150, now(), 0.28, 0.05, { type: 'square' });
}

export function ding() {
  if (!ac) return;
  bell(1046.5, now(), 0.7, 0.12);
}

export function chime() {
  if (!ac) return;
  const s = now();
  bell(1318.5, s, 0.5, 0.1);
  bell(1760, s + 0.13, 0.7, 0.1);
}

export function thunk() {
  if (!ac) return;
  const s = now();
  noise(s, 0.05, 0.3, { type: 'lowpass', freq: 700, q: 0.7 });
  tones(180, s, 0.06, 0.08, { type: 'triangle' });
}

export function dialTone(dur, bus) {
  if (!ac) return;
  tones([350, 440], now(), dur, 0.07, { bus });
}

const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477],
  4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
  '*': [941, 1209], 0: [941, 1336], '#': [941, 1477],
};
export const DTMF_STEP = 0.16;

export function dtmfSequence(digits, delay, bus) {
  if (!ac) return;
  let s = now() + delay;
  for (const d of digits) {
    if (DTMF[d]) tones(DTMF[d], s, 0.09, 0.07, { bus });
    s += DTMF_STEP;
  }
}

export const HANDSHAKE_SECONDS = 15.5;

// A V.90-ish handshake, compressed: ring, answer tone, negotiation chirps,
// line-probe "bongs", ping-pong, then the long hiss that suddenly stops.
export function handshake(bus) {
  if (!ac) return HANDSHAKE_SECONDS;
  const o = bus || master;
  const s = now();
  tones([440, 480], s + 0.2, 1.0, 0.045, { bus: o });
  am(2100, s + 1.6, 2.6, 0.06, 15, 0.25, o);
  fsk(980, 1180, s + 3.6, 1.4, 0.04, o);
  fsk(1650, 1850, s + 4.0, 1.0, 0.035, o);
  const probe = [];
  for (let f = 150; f <= 3750; f += 150) probe.push(f);
  tones(probe, s + 5.4, 0.3, 0.012, { bus: o });
  tones(probe, s + 5.9, 0.3, 0.012, { bus: o });
  for (let i = 0; i < 8; i++) tones(i % 2 ? 2400 : 1200, s + 6.5 + i * 0.11, 0.09, 0.045, { bus: o });
  hiss(s + 7.6, 3.1, 0.14, 1700, o);
  tones(1800, s + 7.6, 3.1, 0.015, { bus: o });
  hiss(s + 10.9, 4.6, 0.17, 1900, o);
  return HANDSHAKE_SECONDS;
}
