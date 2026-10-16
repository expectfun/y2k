// Dumbphone: a flat front face with a multi-tap text editor.
// The screen is an 84×48 canvas (the screen sim), so it can become a texture on a 3D shell later.

import { FONT } from './phone-font.js';

const W = 84;
const H = 48;
const M = 2; // LCD margin, in LCD pixels
const COLS = 14;
const MAX_CHARS = 459; // three linked messages
const COMMIT_MS = 1000;
const TARGET = 'running late, meet at the cinema at 7';

const KEYS = {
  1: ".,?!'-1", 2: 'abc2', 3: 'def3', 4: 'ghi4', 5: 'jkl5', 6: 'mno6',
  7: 'pqrs7', 8: 'tuv8', 9: 'wxyz9', 0: ' 0', '*': '*+=@/:()&#',
};
const KEY_LABELS = {
  1: '.,?!', 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno',
  7: 'pqrs', 8: 'tuv', 9: 'wxyz', 0: '␣', '*': '+@', '#': 'Aa',
};
const KEY_NAMES = {
  1: 'punctuation', 0: 'space', '*': 'symbols', '#': 'switch letter case and numbers',
};
const MODES = ['Abc', 'abc', 'ABC', '123'];
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

let ctx = null;
let el = null;
let screen = null;
let canvas = null;
let liveEl = null;
let noteEl = null;
let text = '';
let mode = 'Abc';
let pending = null; // { key, idx, upper } — the letter still cycling
let commitTimer = 0;
let blinkTimer = 0;
let blinkOn = true;
let splash = null; // lines shown instead of the editor
let splashTimer = 0;
let busy = false; // sending: keys do nothing
let inMission = false;
let presses = 0;

export function mount(container, context) {
  ctx = context;
  el = container;
  text = '';
  mode = 'Abc';
  pending = null;
  splash = null;
  busy = false;
  inMission = false;

  el.innerHTML = `
    <div class="phone-stage">
      <div class="phone" role="group" aria-label="Mobile phone">
        <div class="phone-ear" aria-hidden="true"></div>
        <div class="phone-brand" aria-hidden="true">KOMET</div>
        <div class="phone-screen"><canvas role="img" aria-label="Phone screen"></canvas></div>
        <div class="phone-soft">
          <button type="button" class="soft" data-k="L" aria-label="Left soft key: Send"></button>
          <button type="button" class="key-c" data-k="C" aria-label="C: delete">C</button>
          <button type="button" class="soft" data-k="R" aria-label="Right soft key: Clear"></button>
        </div>
        <div class="keypad">
          ${PAD.map((k) => `
            <button type="button" class="key" data-k="${k}" aria-label="${k}, ${KEY_NAMES[k] || KEY_LABELS[k]}">
              <span>${k}</span><small aria-hidden="true">${KEY_LABELS[k]}</small>
            </button>`).join('')}
        </div>
        <div class="phone-mic" aria-hidden="true"></div>
      </div>
      <aside class="phone-note" hidden>
        <p class="note-kicker">Text your friend:</p>
        <p class="note-text">${TARGET}</p>
      </aside>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;

  canvas = el.querySelector('canvas');
  liveEl = el.querySelector('[aria-live]');
  noteEl = el.querySelector('.phone-note');
  screen = createScreen(canvas);

  for (const btn of el.querySelectorAll('[data-k]')) {
    const k = btn.dataset.k;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault(); // no focus ring or text selection while mashing keys
      press(k);
    });
    btn.addEventListener('click', (e) => { if (e.detail === 0) press(k); }); // keyboard activation
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  blinkTimer = setInterval(() => { blinkOn = !blinkOn; if (!pending && !splash) render(); }, 500);
  render();
}

export function unmount() {
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  clearInterval(blinkTimer);
  clearTimeout(commitTimer);
  clearTimeout(splashTimer);
  el = ctx = screen = null;
}

export function challenge() {
  commit();
  clearTimeout(splashTimer);
  splash = null;
  busy = false;
  text = '';
  mode = 'Abc';
  presses = 0;
  inMission = true;
  noteEl.hidden = false;
  ctx.mission.begin({
    task: 'Text your friend: “running late, meet at the cinema at 7”. Press the left key under the screen to send.',
    onCancel: () => { inMission = false; noteEl.hidden = true; },
    onRetry: challenge,
  });
  render();
}

function onResize() {
  if (!screen) return;
  screen.resize();
  render();
}

// --- input -----------------------------------------------------------------

function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const t = e.target;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;

  let k = null;
  const num = /^Numpad([0-9])$/.exec(e.code);
  if (/^[0-9]$/.test(e.key)) k = e.key;
  else if (num) k = num[1];
  else if (e.key === '*' || e.code === 'NumpadMultiply') k = '*';
  else if (e.key === '#') k = '#';
  else if (e.key === 'Backspace') k = 'C';
  if (k) {
    e.preventDefault();
    if (!e.repeat) press(k);
    return;
  }
  const onButton = t.tagName === 'BUTTON' || t.tagName === 'A';
  if (/^[a-z]$/i.test(e.key) || (e.key === ' ' && !onButton)) {
    e.preventDefault();
    ctx.toast('No QWERTY in 2001 — use the keys.');
  }
}

function press(k) {
  if (!screen || busy) return;
  flashKey(k);
  ctx.sound.keyBeep();
  if (splash) { dismissSplash(); return; }
  if (inMission) {
    ctx.mission.startTimer();
    presses++;
  }
  blinkOn = true;

  if (k === 'L') return send();
  if (k === 'R') { commit(); text = ''; return render(); }
  if (k === 'C') { commit(); text = text.slice(0, -1); return render(); }
  if (k === '#') {
    commit();
    let i = MODES.indexOf(mode);
    if (mode === 'Abc' && modeLabel() === 'abc') i = 1; // auto-lowercase already showing
    mode = MODES[(i + 1) % MODES.length];
    return render();
  }
  type(k);
}

function type(k) {
  if (mode === '123') {
    commit();
    if (text.length < MAX_CHARS) text += k;
    return render();
  }
  const chars = KEYS[k];
  if (pending && pending.key === k) {
    pending.idx = (pending.idx + 1) % chars.length;
    text = text.slice(0, -1) + applyCase(chars[pending.idx], pending.upper);
  } else {
    commit();
    if (text.length >= MAX_CHARS) return render();
    const upper = upperNext();
    pending = { key: k, idx: 0, upper };
    text += applyCase(chars[0], upper);
  }
  clearTimeout(commitTimer);
  commitTimer = setTimeout(() => { commit(); render(); }, COMMIT_MS);
  render();
}

function commit() {
  clearTimeout(commitTimer);
  if (pending) {
    pending = null;
    liveEl.textContent = text;
  }
}

const applyCase = (ch, upper) => (upper ? ch.toUpperCase() : ch);
const atSentenceStart = () => /(^|[.!?]\s+)$/.test(text);
const upperNext = () => mode === 'ABC' || (mode === 'Abc' && atSentenceStart());
const modeLabel = () => (mode === 'Abc' && !atSentenceStart() ? 'abc' : mode);
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function counterLabel() {
  const len = text.length;
  if (len <= 160) return `${160 - len}/1`;
  const parts = Math.ceil(len / 153);
  return `${parts * 153 - len}/${parts}`;
}

function flashKey(k) {
  const btn = el.querySelector(`[data-k="${CSS.escape(k)}"]`);
  if (!btn) return;
  btn.classList.add('down');
  setTimeout(() => btn.classList.remove('down'), 110);
}

// --- sending ---------------------------------------------------------------

function send() {
  commit();
  if (!text.trim()) return showSplash(['Write a', 'message', 'first'], 1300);
  if (inMission && normalize(text) !== normalize(TARGET)) {
    ctx.sound.buzz();
    return showSplash(['Not quite.', 'Check the', 'text.'], 1800);
  }
  if (inMission) ctx.mission.stop();
  busy = true;
  const len = text.length;
  showSplash(['Sending', 'message...'], 1100, () => {
    ctx.sound.chime();
    showSplash(['Message', 'sent'], 1300, () => {
      busy = false;
      text = '';
      render();
      if (inMission) {
        inMission = false;
        noteEl.hidden = true;
        ctx.mission.complete({ lines: [`${presses} key presses for ${len} characters.`] });
      }
    });
  });
}

function showSplash(lines, ms, then) {
  clearTimeout(splashTimer);
  splash = lines;
  liveEl.textContent = lines.join(' ');
  render();
  splashTimer = setTimeout(() => {
    splash = null;
    render();
    then?.();
  }, ms);
}

function dismissSplash() {
  clearTimeout(splashTimer);
  splash = null;
  render();
}

// --- screen ----------------------------------------------------------------

function createScreen(cv) {
  const g = cv.getContext('2d');
  const buf = new Uint8Array(W * H);
  let p = 1; // device pixels per LCD pixel
  let gap = 0;
  let bg = null;

  // Cell edges are rounded per pixel, so the grid stays crisp at any width.
  const cell = (x, y, fill) => {
    const x0 = Math.round((x + M) * p);
    const y0 = Math.round((y + M) * p);
    fill(x0, y0, Math.round((x + M + 1) * p) - x0 - gap, Math.round((y + M + 1) * p) - y0 - gap);
  };

  function resize() {
    const w = Math.max(W, Math.round((cv.clientWidth || W * 3) * (window.devicePixelRatio || 1)));
    cv.width = w;
    cv.height = Math.round((w * (H + 2 * M)) / (W + 2 * M));
    p = w / (W + 2 * M);
    gap = Math.max(0, Math.round(p * 0.18));
    // Backlight plus faint "ghost" pixels, drawn once per size.
    bg = document.createElement('canvas');
    bg.width = cv.width;
    bg.height = cv.height;
    const b = bg.getContext('2d');
    const grad = b.createRadialGradient(w / 2, cv.height / 2, 10, w / 2, cv.height / 2, w * 0.7);
    grad.addColorStop(0, '#b4d088');
    grad.addColorStop(1, '#8fae63');
    b.fillStyle = grad;
    b.fillRect(0, 0, bg.width, bg.height);
    b.fillStyle = 'rgba(30, 44, 18, 0.07)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cell(x, y, (a, c, d, e) => b.fillRect(a, c, d, e));
  }
  resize();

  const px = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = 1; };

  return {
    resize,
    clear() { buf.fill(0); },
    text(str, x, y) {
      for (const ch of str) {
        const glyph = FONT[ch] ?? FONT['?'];
        glyph.forEach((row, r) => row.forEach((on, c) => { if (on) px(x + c, y + r); }));
        x += 6;
      }
    },
    invert(x, y, w, h) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) buf[j * W + i] ^= 1;
      }
    },
    vline(x, y, h) { for (let j = y; j < y + h; j++) px(x, j); },
    flush() {
      g.drawImage(bg, 0, 0);
      g.fillStyle = '#1e2a14';
      const fill = (a, b, c, d) => g.fillRect(a, b, c, d);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (buf[y * W + x]) cell(x, y, fill);
      }
    },
  };
}

// Word wrap to 14 columns; a trailing space may hang off the edge, like on the real thing.
function wrap(t) {
  const lines = [];
  let start = 0;
  while (t.length - start > COLS) {
    const space = t.lastIndexOf(' ', start + COLS);
    const cut = space > start ? space + 1 : start + COLS;
    lines.push(t.slice(start, cut));
    start = cut;
  }
  lines.push(t.slice(start));
  return lines;
}

const textWidth = (s) => s.length * 6 - 1;

function render() {
  if (!screen) return;
  screen.clear();
  canvas.setAttribute('aria-label', splash ? `Phone screen: ${splash.join(' ')}` : `Phone screen. Message: ${text || 'empty'}`);

  if (splash) {
    const top = Math.round((H - splash.length * 9) / 2);
    splash.forEach((ln, i) => screen.text(ln, Math.round((W - textWidth(ln)) / 2), top + i * 9));
    return screen.flush();
  }

  screen.text(modeLabel(), 0, 0);
  const cnt = counterLabel();
  screen.text(cnt, W - textWidth(cnt), 0);

  const lines = wrap(text);
  const last = lines.length - 1;
  let cursorLine = last;
  let cursorCol = lines[last].length;
  if (cursorCol >= COLS) { cursorLine++; cursorCol = 0; lines.push(''); }
  const first = Math.max(0, cursorLine - 3);
  for (let i = 0; i < 4 && first + i < lines.length; i++) screen.text(lines[first + i].slice(0, COLS), 0, 9 + i * 8);

  if (pending && lines[last].length) {
    const pl = last - first;
    if (pl >= 0) screen.invert((lines[last].length - 1) * 6, 8 + pl * 8, 6, 9);
  } else if (blinkOn) {
    screen.vline(Math.max(0, cursorCol * 6 - 1), 8 + (cursorLine - first) * 8, 9);
  }

  screen.text('Send', 0, 41);
  screen.text('Clear', W - textWidth('Clear'), 41);
  screen.flush();
}
