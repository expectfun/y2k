// Abacus (счёты): ported from experiments/abacus.html.
// Freeplay shows the value; the challenge hides it, like a real abacus.

// Values in thousandths, so sums stay exact integers.
const WIRES = [
  { beads: 10, label: '0.001', milli: 1 },
  { beads: 10, label: '0.01', milli: 10 },
  { beads: 10, label: '0.1', milli: 100 },
  { beads: 4, label: '¼', milli: 250, quarter: true },
  { beads: 10, label: '1', milli: 1000 },
  { beads: 10, label: '10', milli: 10000 },
  { beads: 10, label: '100', milli: 100000 },
  { beads: 10, label: '1K', milli: 1000000 },
  { beads: 10, label: '10K', milli: 10000000 },
  { beads: 10, label: '100K', milli: 100000000 },
  { beads: 10, label: '1M', milli: 1000000000 },
];

// Prices in kopecks, roughly 2001.
const GOODS = [
  ['Bread', 650], ['Milk, 1 l', 1120], ['Kefir', 980], ['Cheese, 300 g', 4235],
  ['Tea', 2370], ['Sugar, 1 kg', 1460], ['Eggs, 10', 1890], ['Butter', 2145],
  ['Sausage', 6415], ['Buckwheat', 1230], ['Apples, 1 kg', 1550], ['Chocolate', 1275],
];

let ctx = null;
let el = null;
let wiresEl = null;
let abacusEl = null;
let displayEl = null;
let msgEl = null;
let receiptEl = null;
let state = [];
let S = {};
let focusWire = 4;
let inMission = false;
let receiptTotal = 0; // kopecks
let resizeTimer = 0;

const q = (s) => el.querySelector(s);

export function mount(container, context) {
  ctx = context;
  el = container;
  state = WIRES.map(() => 0);
  inMission = false;
  focusWire = 4;

  el.innerHTML = `
    <div class="abacus-stage">
      <div class="abacus-col">
        <div class="abacus-bar">
          <div class="abacus-display" contenteditable="true" spellcheck="false" inputmode="decimal" role="textbox"
               aria-label="Value on the abacus. Type a number and press Enter to set the beads.">0</div>
          <button type="button" class="btn abacus-set">Set</button>
          <button type="button" class="btn abacus-reset">Reset</button>
          <button type="button" class="btn primary abacus-done" hidden>Done</button>
        </div>
        <p class="abacus-msg" role="status"></p>
        <div class="abacus" role="group" aria-label="Abacus. Up and down arrows choose a wire, left and right move beads.">
          <div class="frame-top"></div><div class="frame-bottom"></div>
          <div class="frame-left"></div><div class="frame-right"></div>
          <div class="abacus-wires"></div>
        </div>
      </div>
      <div class="receipt" hidden></div>
    </div>`;

  wiresEl = q('.abacus-wires');
  abacusEl = q('.abacus');
  displayEl = q('.abacus-display');
  msgEl = q('.abacus-msg');
  receiptEl = q('.receipt');

  q('.abacus-reset').addEventListener('click', () => { reset(); ctx.sound.clack(5); });
  q('.abacus-set').addEventListener('mousedown', (e) => e.preventDefault()); // keep the typed text until we read it
  q('.abacus-set').addEventListener('click', applyDisplayInput);
  q('.abacus-done').addEventListener('click', checkAnswer);
  displayEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyDisplayInput(); }
  });
  displayEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9.,]/g, '');
    document.execCommand('insertText', false, text);
  });
  displayEl.addEventListener('blur', updateDisplay);
  displayEl.addEventListener('focus', () => {
    const range = document.createRange();
    range.selectNodeContents(displayEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  abacusEl.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  build();
}

export function unmount() {
  window.removeEventListener('resize', onResize);
  clearTimeout(resizeTimer);
  el = ctx = null;
}

export function challenge() {
  inMission = true;
  reset();
  makeReceipt();
  displayEl.hidden = true;
  q('.abacus-set').hidden = true;
  q('.abacus-done').hidden = false;
  receiptEl.hidden = false;
  msgEl.textContent = 'Set the total on the beads, then press Done.';
  ctx.mission.begin({
    task: 'Add up the shop receipt on the abacus, then press Done.',
    onCancel: exitMission,
    onRetry: challenge,
  });
  ctx.mission.startTimer();
}

function exitMission() {
  inMission = false;
  displayEl.hidden = false;
  q('.abacus-set').hidden = false;
  q('.abacus-done').hidden = true;
  receiptEl.hidden = true;
  msgEl.textContent = '';
  updateDisplay();
}

// --- receipt ---------------------------------------------------------------

const rub = (kop) => `${Math.floor(kop / 100)}.${String(kop % 100).padStart(2, '0')}`;

function makeReceipt() {
  const pool = [...GOODS];
  const n = 3 + Math.floor(Math.random() * 2);
  const items = [];
  for (let i = 0; i < n; i++) items.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  receiptTotal = items.reduce((s, [, p]) => s + p, 0);
  const time = `${17 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
  receiptEl.setAttribute('aria-label', `Shop receipt: ${items.map(([name, p]) => `${name} ${rub(p)}`).join(', ')}. Total unknown.`);
  receiptEl.innerHTML = `
    <p class="r-shop">GROCERY No. 7</p>
    <p class="r-meta">14.10.2001 &nbsp; ${time}</p>
    <p class="r-rule">--------------------------</p>
    ${items.map(([name, p]) => `<p class="r-line"><span>${name}</span><span>${rub(p)}</span></p>`).join('')}
    <p class="r-rule">--------------------------</p>
    <p class="r-line r-total"><span>TOTAL</span><span>?</span></p>
    <p class="r-thanks">Thank you for your purchase!</p>`;
}

function checkAnswer() {
  if (!inMission) return;
  if (valueMilli() === receiptTotal * 10) {
    inMission = false;
    ctx.sound.chime();
    const total = rub(receiptTotal);
    exitMission();
    msgEl.textContent = `Correct: ${total}.`;
    receiptEl.hidden = false;
    receiptEl.querySelector('.r-total span:last-child').textContent = total;
    ctx.mission.complete({ lines: [`Receipt total: ${total} rubles, counted on beads.`] });
  } else {
    ctx.sound.buzz();
    msgEl.textContent = 'Not quite — check the beads.';
  }
}

// --- the abacus itself -------------------------------------------------------

function computeScale() {
  const availH = Math.min(Math.max(window.innerHeight - 330, 320), 600);
  const baseWireH = 38;
  const scale = Math.min(3, Math.max(0.6, availH / (WIRES.length * baseWireH)));
  const wireH = Math.round(baseWireH * scale);
  const width = Math.round((WIRES.length * wireH) / 2); // 1:2, like the original
  S = {
    wireH,
    width,
    beadW: Math.max(6, Math.round(10 * scale)),
    beadH: Math.max(10, Math.round(18 * scale)),
    margin: Math.max(3, Math.round(6 * scale)),
    gap: Math.max(1, Math.round(2 * scale)),
    frameW: Math.max(4, Math.round(8 * scale)),
    frameH: Math.max(3, Math.round(4 * scale)),
    frameP: Math.max(2, Math.round(3 * scale)),
    labelSize: Math.max(0.55, 0.6 * scale),
    labelRight: Math.max(22, Math.round(30 * scale)),
  };
}

function build() {
  computeScale();
  wiresEl.innerHTML = '';
  abacusEl.style.width = `${S.width}px`;
  abacusEl.style.marginRight = `${S.labelRight + 10}px`;

  const [ft, fb, fl, fr] = ['.frame-top', '.frame-bottom', '.frame-left', '.frame-right'].map((s) => abacusEl.querySelector(s));
  for (const f of [ft, fb]) {
    f.style.left = `${-S.frameP}px`;
    f.style.right = `${-S.frameP}px`;
    f.style.height = `${S.frameH}px`;
  }
  ft.style.top = `${-S.frameH / 2}px`;
  fb.style.bottom = `${-S.frameH / 2}px`;
  for (const f of [fl, fr]) {
    f.style.top = `${-S.frameH / 2}px`;
    f.style.bottom = `${-S.frameH / 2}px`;
    f.style.width = `${S.frameW}px`;
  }
  fl.style.left = `${-S.frameP}px`;
  fr.style.right = `${-S.frameP}px`;

  // Wires top-down: millions at the top, thousandths at the bottom.
  for (let i = WIRES.length - 1; i >= 0; i--) {
    const cfg = WIRES[i];
    const row = document.createElement('div');
    row.className = 'abacus-wire';
    row.style.height = `${S.wireH}px`;
    row.dataset.wire = i;
    row.tabIndex = i === focusWire ? 0 : -1;
    row.setAttribute('role', 'slider');
    row.setAttribute('aria-orientation', 'horizontal');
    row.setAttribute('aria-valuemin', '0');
    row.setAttribute('aria-valuemax', String(cfg.beads));
    row.setAttribute('aria-label', cfg.quarter ? 'Quarter-kopeck wire' : `Wire ${cfg.label}`);

    row.innerHTML = `<div class="wire-line"></div><span class="wire-label" style="font-size:${S.labelSize}rem;right:${-S.labelRight}px">${cfg.label}</span>`;
    const mid = Math.floor(cfg.beads / 2);
    for (let b = 0; b < cfg.beads; b++) {
      const bead = document.createElement('div');
      bead.className = 'bead';
      bead.style.width = `${S.beadW}px`;
      bead.style.height = `${S.beadH}px`;
      if (b === mid - 1 || b === mid) bead.dataset.dark = '1';
      bead.innerHTML = '<div class="bead-inner"></div>';
      row.appendChild(bead);
    }

    // Tap or swipe anywhere on the wire; the closest bead moves.
    let startX = 0;
    let target = -1;
    row.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      startX = e.clientX;
      target = closestBead(row, e.clientX);
    });
    row.addEventListener('pointerup', (e) => {
      if (target < 0) return;
      const dx = e.clientX - startX;
      const counted = target < state[i];
      // counted beads swipe right to uncount, uncounted swipe left to count
      if (Math.abs(dx) <= 5 || (counted ? dx > 5 : dx < -5)) toggle(i, target);
      target = -1;
    });
    row.addEventListener('pointercancel', () => { target = -1; });
    wiresEl.appendChild(row);
  }

  for (let i = 0; i < WIRES.length; i++) layoutWire(i);
  updateDisplay();
}

function rowOf(w) {
  return wiresEl.children[WIRES.length - 1 - w];
}

function layoutWire(w) {
  const cfg = WIRES[w];
  const count = state[w];
  const row = rowOf(w);
  const beads = row.querySelectorAll('.bead');
  for (let b = 0; b < cfg.beads; b++) {
    const left = b < count
      ? S.margin + b * (S.beadW + S.gap)
      : S.width - S.margin - S.beadW - (cfg.beads - 1 - b) * (S.beadW + S.gap);
    beads[b].style.left = `${left}px`;
  }
  row.setAttribute('aria-valuenow', String(count));
  row.setAttribute('aria-valuetext', `${count} counted`);
}

function setCount(w, count) {
  const moved = Math.abs(count - state[w]);
  if (!moved) return;
  state[w] = count;
  layoutWire(w);
  updateDisplay();
  ctx.sound.clack(moved);
  if (inMission) msgEl.textContent = '';
}

function toggle(w, b) {
  setCount(w, b < state[w] ? b : b + 1);
}

function closestBead(row, clientX) {
  const relX = clientX - row.getBoundingClientRect().left;
  let closest = 0;
  let min = Infinity;
  row.querySelectorAll('.bead').forEach((bead, idx) => {
    const d = Math.abs(relX - (bead.offsetLeft + bead.offsetWidth / 2));
    if (d < min) { min = d; closest = idx; }
  });
  return closest;
}

function onKey(e) {
  const w = Number(e.target.dataset?.wire);
  if (Number.isNaN(w)) return;
  const max = WIRES[w].beads;
  const moves = {
    ArrowLeft: () => setCount(w, Math.min(max, state[w] + 1)),
    ArrowRight: () => setCount(w, Math.max(0, state[w] - 1)),
    Home: () => setCount(w, max),
    End: () => setCount(w, 0),
    ArrowUp: () => moveFocus(Math.min(WIRES.length - 1, w + 1)),
    ArrowDown: () => moveFocus(Math.max(0, w - 1)),
  };
  if (!moves[e.key]) return;
  e.preventDefault();
  moves[e.key]();
}

function moveFocus(w) {
  rowOf(focusWire).tabIndex = -1;
  focusWire = w;
  const row = rowOf(w);
  row.tabIndex = 0;
  row.focus();
}

function valueMilli() {
  return state.reduce((sum, n, i) => sum + n * WIRES[i].milli, 0);
}

function updateDisplay() {
  if (!displayEl || document.activeElement === displayEl) return;
  const v = valueMilli();
  // kopecks read as money: 43.20, not 43.2
  displayEl.textContent = (v / 1000).toLocaleString('en-US', { minimumFractionDigits: v % 1000 ? 2 : 0, maximumFractionDigits: 3 });
}

function reset() {
  state.fill(0);
  for (let i = 0; i < WIRES.length; i++) layoutWire(i);
  updateDisplay();
}

function applyDisplayInput() {
  const raw = displayEl.textContent.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const val = parseFloat(raw);
  if (!Number.isNaN(val)) {
    // Greedy from the top, skipping the quarter wire (nobody used it for this).
    let remaining = Math.round(Math.min(val, 10999999.999) * 1000);
    for (let w = WIRES.length - 1; w >= 0; w--) {
      if (WIRES[w].quarter) { state[w] = 0; continue; }
      const count = Math.min(WIRES[w].beads, Math.floor(remaining / WIRES[w].milli));
      state[w] = count;
      remaining -= count * WIRES[w].milli;
    }
    for (let w = 0; w < WIRES.length; w++) layoutWire(w);
    ctx.sound.clack(5);
  }
  displayEl.blur();
  updateDisplay();
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!el) return;
    const prev = S.wireH;
    computeScale();
    if (S.wireH !== prev) build();
  }, 120);
}
