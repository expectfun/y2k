// Home phone with a rotary dial. You turn the dial to the stop; the spring brings it back
// at its own pace, one pulse per step. The challenge is a busy radio phone-in.

const STOP = 60; // the finger stop, degrees clockwise from 3 o'clock
const STEP = 30; // between holes, and one pulse on the way back
const SPEED = 300; // return speed, deg/s: ten pulses a second
const AUTO_SPEED = 520; // a keyboard "finger" turning the dial
const HOLE_R = 68;
const DIAL_TIMEOUT = 12000; // the exchange gives up waiting for a digit

const RADIO = '2090990';
const LENA = '4312568';
const CLOCK = '100';
const BUSY_CALLS = 3; // busy this many times, then through
const MODEM_LIFT = 3; // on this lift your brother is online

const TASK = 'Radio Meteor gives two concert tickets to the 10th caller. Call 209-09-90 until you get through.';

const holeAngle = (n) => STOP - 2 * STEP - (n - 1) * STEP; // n = 1..10, 10 is "0"
const travel = (n) => STOP - holeAngle(n);
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SAY = {
  idle: 'Silence. The receiver is on the hook.',
  dialtone: 'A long beep: the line is free. Dial.',
  dialing: 'Click-click-click…',
  connecting: 'Click… the exchange is connecting you.',
  busy: 'Beep, beep, beep: busy. Hang up and dial again.',
  ringing: 'Ring… ring…',
  modem: 'KSHHHHHHH… Your brother is online with the modem! Hang up and try again.',
  sit: '“The number you have dialed does not exist.” Hang up and check the number.',
  timeout: 'Beep, beep, beep: you were too slow, the exchange gave up. Hang up and start again.',
};

let ctx = null;
let el = null;
let rotEl = null;
let wheel = null;
let dialEl = null;
let hearEl = null;
let dialedEl = null;
let adEl = null;
let bookEl = null;
let handsetBtn = null;

let up = false; // receiver lifted
let line = 'idle';
let bus = null;
let timers = [];
let digits = '';
let rot = 0;
let drag = null; // { n, last }
let moving = false; // the dial is away from rest
let raf = 0;
let queue = [];
let warnedHook = false;

let inMission = false;
let lifts = 0;
let calls = 0;
let digitCount = 0;
let returnMs = 0;
let modemDone = false;

export function mount(container, context) {
  ctx = context;
  el = container;
  up = false;
  line = 'idle';
  digits = '';
  rot = 0;
  drag = null;
  moving = false;
  queue = [];
  warnedHook = false;
  inMission = false;

  el.innerHTML = `
    <div class="rot-stage">
      <div class="rot-col">
        <div class="rotary" role="group" aria-label="Home telephone">
          <svg class="rot-cord" viewBox="0 0 380 410" aria-hidden="true"><path/></svg>
          ${bodySvg()}
          <div class="rot-dial" tabindex="0" role="group"
               aria-label="Rotary dial. Type a digit to turn it; it clicks back by itself.">${dialSvg()}</div>
          <button type="button" class="rot-handset" aria-label="Lift the receiver">${handsetSvg()}</button>
        </div>
        <div class="rot-ear">
          <p class="rot-hear" aria-live="polite"></p>
          <p class="rot-dialed"></p>
        </div>
      </div>
      <aside class="rot-paper">
        <div class="rot-book">
          <p class="rot-book-head">Phone numbers</p>
          <dl>
            <dt>Exact time</dt><dd>100</dd>
            <dt>Lena</dt><dd>431-25-68</dd>
            <dt>Radio Meteor</dt><dd>209-09-90</dd>
          </dl>
        </div>
        <div class="rot-ad" hidden>
          <p class="rot-ad-head">Radio Meteor <span>104.2 FM</span></p>
          <p>Be our <b>10th caller</b> and win two tickets to the New Year concert!</p>
          <p class="rot-ad-num">☎ 209-09-90</p>
        </div>
      </aside>
    </div>`;

  rotEl = el.querySelector('.rotary');
  dialEl = el.querySelector('.rot-dial');
  wheel = el.querySelector('.rot-wheel');
  hearEl = el.querySelector('.rot-hear');
  dialedEl = el.querySelector('.rot-dialed');
  adEl = el.querySelector('.rot-ad');
  bookEl = el.querySelector('.rot-book');
  handsetBtn = el.querySelector('.rot-handset');

  handsetBtn.addEventListener('click', toggleHook);
  dialEl.addEventListener('pointerdown', onDown);
  dialEl.addEventListener('pointermove', onMove);
  dialEl.addEventListener('pointerup', onUp);
  dialEl.addEventListener('pointercancel', onUp);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', fit);

  drawCord();
  fit();
  paint();
  say(SAY.idle);
}

export function unmount() {
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', fit);
  cancelAnimationFrame(raf);
  clearTimers();
  ctx.sound.stopBus(bus);
  bus = null;
  el = ctx = null;
}

export function challenge() {
  if (up) hangUp(true);
  inMission = true;
  lifts = 0;
  calls = 0;
  digitCount = 0;
  returnMs = 0;
  modemDone = false;
  adEl.hidden = false;
  bookEl.hidden = true;
  ctx.mission.begin({ task: TASK, onCancel: exitMission, onRetry: challenge });
}

function exitMission() {
  inMission = false;
  adEl.hidden = true;
  bookEl.hidden = false;
}

// Shrink the phone to fit short windows, like the mobile phone does.
function fit() {
  if (!el) return;
  const stage = el.querySelector('.rot-stage');
  stage.style.zoom = '';
  const avail = el.clientHeight - 40;
  const need = stage.offsetHeight;
  if (need > avail) stage.style.zoom = String(Math.max(0.6, avail / need));
}

// --- drawing ---------------------------------------------------------------

function dialSvg() {
  let holes = '';
  let rims = '';
  let nums = '';
  for (let n = 1; n <= 10; n++) {
    const a = rad(holeAngle(n));
    const x = (HOLE_R * Math.cos(a)).toFixed(1);
    const y = (HOLE_R * Math.sin(a)).toFixed(1);
    holes += `<circle cx="${x}" cy="${y}" r="14" fill="#000"/>`;
    rims += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#000" stroke-width="1.5" opacity=".6"/>`;
    nums += `<text x="${x}" y="${y}" dy=".36em">${n % 10}</text>`;
  }
  const sa = rad(STOP);
  const stop = (r) => `${(r * Math.cos(sa)).toFixed(1)} ${(r * Math.sin(sa)).toFixed(1)}`;
  return `
    <svg viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        <mask id="rot-holes" maskUnits="userSpaceOnUse" x="-100" y="-100" width="200" height="200">
          <circle r="95" fill="#fff"/>${holes}<circle r="38" fill="#000"/>
        </mask>
        <radialGradient id="rot-wheel-g" cx=".38" cy=".3" r=".8">
          <stop offset="0" stop-color="#4a4f58"/><stop offset=".55" stop-color="#1b1e24"/><stop offset="1" stop-color="#0b0c10"/>
        </radialGradient>
      </defs>
      <circle r="98" class="rot-plate"/>
      <g class="rot-nums">${nums}</g>
      <circle r="36" class="rot-card"/>
      <text class="rot-card-text" y="-6">tel.</text>
      <text class="rot-card-text rot-card-num" y="12">251-13-07</text>
      <g class="rot-wheel">
        <circle r="95" fill="url(#rot-wheel-g)" mask="url(#rot-holes)"/>${rims}
        <circle r="38" fill="none" stroke="#000" stroke-width="2" opacity=".5"/>
      </g>
      <path class="rot-stop" d="M ${stop(72)} L ${stop(99)}"/>
    </svg>`;
}

function bodySvg() {
  return `
    <svg class="rot-body" viewBox="0 0 380 280" aria-hidden="true">
      <defs>
        <linearGradient id="rot-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d0473f"/><stop offset=".45" stop-color="#a82a26"/><stop offset="1" stop-color="#6e1714"/>
        </linearGradient>
      </defs>
      <rect class="rot-plunger" x="82" y="12" width="16" height="22" rx="3"/>
      <rect class="rot-plunger" x="282" y="12" width="16" height="22" rx="3"/>
      <path d="M52 34 Q60 8 90 8 Q120 8 128 34 Z M252 34 Q260 8 290 8 Q320 8 328 34 Z" fill="#8c201d"/>
      <path d="M60 30 L320 30 Q340 30 346 48 L376 250 Q380 278 352 278 L28 278 Q0 278 4 250 L34 48 Q40 30 60 30 Z" fill="url(#rot-red)"/>
      <path d="M62 34 L318 34 Q334 34 339 46" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <circle cx="190" cy="160" r="106" fill="#5c1210" opacity=".55"/>
    </svg>`;
}

function handsetSvg() {
  return `
    <svg viewBox="0 0 340 84" aria-hidden="true">
      <defs>
        <linearGradient id="rot-hs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d9524a"/><stop offset=".5" stop-color="#a82a26"/><stop offset="1" stop-color="#701815"/>
        </linearGradient>
      </defs>
      <g fill="url(#rot-hs)">
        <rect x="40" y="10" width="260" height="30" rx="15"/>
        <ellipse cx="46" cy="48" rx="44" ry="33"/>
        <ellipse cx="294" cy="48" rx="44" ry="33"/>
      </g>
      <path d="M60 15 L280 15" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
}

// The curly cord, from the side of the body to the end of the handset.
const HS = { left: 20, top: 92, w: 340, h: 84, dx: -10, dy: -84, tilt: -7 };

function cordEnd(lifted) {
  const x = HS.left + 22;
  const y = HS.top + 74;
  if (!lifted) return [x, y];
  const ox = HS.left + HS.w / 2;
  const oy = HS.top + HS.h;
  const a = rad(HS.tilt);
  const rx = x - ox;
  const ry = y - oy;
  return [ox + rx * Math.cos(a) - ry * Math.sin(a) + HS.dx, oy + rx * Math.sin(a) + ry * Math.cos(a) + HS.dy];
}

function drawCord() {
  const [x2, y2] = cordEnd(up);
  const x1 = 10;
  const y1 = 372;
  const cx = -24;
  const cy = (y1 + y2) / 2 + 30;
  const loops = 14;
  const pts = [];
  for (let i = 0; i <= loops * 16; i++) {
    const t = i / (loops * 16);
    const u = 1 - t;
    const bx = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const by = u * u * y1 + 2 * u * t * cy + t * t * y2;
    const tx = 2 * u * (cx - x1) + 2 * t * (x2 - cx);
    const ty = 2 * u * (cy - y1) + 2 * t * (y2 - cy);
    const len = Math.hypot(tx, ty) || 1;
    const ph = 2 * Math.PI * loops * t;
    const fade = Math.min(1, t * 12, (1 - t) * 12);
    const off = 6 * Math.sin(ph) * fade;
    const along = 3.2 * Math.cos(ph) * fade;
    pts.push(`${(bx - (ty / len) * off + (tx / len) * along).toFixed(1)},${(by + (tx / len) * off + (ty / len) * along).toFixed(1)}`);
  }
  el.querySelector('.rot-cord path').setAttribute('d', `M${pts.join(' L')}`);
}

function paint() {
  wheel.setAttribute('transform', `rotate(${rot.toFixed(2)})`);
}

function say(text) {
  hearEl.textContent = text;
}

const fmt = (d) => (d.length <= 3 ? d : `${d.slice(0, 3)}-${d.slice(3, 5)}${d.length > 5 ? `-${d.slice(5)}` : ''}`);

function showDialed() {
  dialedEl.textContent = digits ? `Dialed: ${fmt(digits)}` : '';
}

// --- the receiver and the line ---------------------------------------------

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function setLine(state, text = SAY[state]) {
  ctx.sound.stopBus(bus);
  bus = state === 'idle' ? null : ctx.sound.createBus();
  clearTimers();
  line = state;
  const s = ctx.sound;
  if (state === 'dialtone') s.lineTone(1, 0, 60, bus);
  else if (state === 'busy' || state === 'timeout') s.lineTone(0.35, 0.35, 60, bus);
  else if (state === 'ringing') s.lineTone(0.8, 3.2, 120, bus);
  else if (state === 'sit') s.sitTones(bus);
  else if (state === 'modem') s.lineNoise(30, bus);
  say(text);
}

function toggleHook() {
  if (up) hangUp();
  else lift();
}

function lift() {
  up = true;
  rotEl.classList.add('lifted');
  handsetBtn.setAttribute('aria-label', 'Hang up the receiver');
  drawCord();
  ctx.sound.clack(1);
  digits = '';
  showDialed();
  if (inMission) {
    ctx.mission.startTimer();
    lifts++;
    if (lifts === MODEM_LIFT && !modemDone) {
      modemDone = true;
      return setLine('modem');
    }
  }
  setLine('dialtone');
  later(() => setLine('timeout'), DIAL_TIMEOUT);
}

function hangUp(quiet = false) {
  up = false;
  rotEl.classList.remove('lifted');
  handsetBtn.setAttribute('aria-label', 'Lift the receiver');
  drawCord();
  if (!quiet) ctx.sound.thunk();
  digits = '';
  showDialed();
  setLine('idle');
}

function onPulse() {
  if (up && line === 'dialtone') setLine('dialing');
}

function onDigit(n) {
  if (!up) {
    if (!warnedHook) {
      warnedHook = true;
      ctx.toast('Lift the receiver first: the dial only works with the line open.');
    }
    return;
  }
  if (line !== 'dialing') return; // busy, ringing, modem: the exchange isn't listening
  digits += String(n % 10);
  showDialed();
  clearTimers();
  if (!inMission && digits === CLOCK) return connect();
  if (digits.length === 7) return connect();
  later(() => setLine('timeout'), DIAL_TIMEOUT);
}

function connect() {
  setLine('connecting');
  later(route, 900);
}

function route() {
  const n = digits;
  if (inMission) {
    if (n !== RADIO) return setLine('sit');
    calls++;
    if (calls <= BUSY_CALLS) return setLine('busy');
    setLine('ringing');
    later(winCall, 4300);
    return;
  }
  if (n === CLOCK) {
    const d = new Date();
    setLine('talk', `“Exact time: ${d.getHours()} hours ${d.getMinutes()} minutes.” Beep, beep, beep…`);
    ctx.sound.pips(3, bus);
    later(() => setLine('busy', 'Click. The clock hung up. Beep, beep, beep…'), 4500);
    return;
  }
  if (n === RADIO) return setLine('busy', 'Beep, beep, beep: busy. Half the city is calling the radio.');
  setLine('ringing');
  if (n === LENA) {
    later(() => {
      setLine('talk', '“Hello? Lena’s not home, she went to the cinema. Call back later!” (Lena’s mom)');
      later(() => setLine('busy', 'Click. She hung up. Beep, beep, beep…'), 4500);
    }, 4300);
    return;
  }
  later(() => say('Ring… ring… Nobody picks up.'), 13000);
}

function winCall() {
  ctx.mission.stop();
  setLine('talk', '“Radio Meteor, you’re on the air! You’re caller number ten: the tickets are yours!”');
  ctx.sound.chime();
  later(() => {
    const waited = Math.round(returnMs / 1000);
    inMission = false;
    ctx.mission.complete({
      lines: [
        `${calls} calls to get through.`,
        `${digitCount} digits dialed; ${waited} s of that was just the dial spinning back.`,
      ],
      onClose: () => {
        if (ctx && !inMission) { hangUp(true); exitMission(); }
      },
    });
  }, 2600);
}

// --- the dial --------------------------------------------------------------

function toDial(e) {
  const r = dialEl.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 200 - 100;
  const y = ((e.clientY - r.top) / r.height) * 200 - 100;
  return { x, y, r: Math.hypot(x, y), a: (Math.atan2(y, x) * 180) / Math.PI };
}

function holeAt(p) {
  for (let n = 1; n <= 10; n++) {
    const a = rad(holeAngle(n));
    if (Math.hypot(p.x - HOLE_R * Math.cos(a), p.y - HOLE_R * Math.sin(a)) < 17) return n;
  }
  return 0;
}

function onDown(e) {
  if (e.button > 0 || moving) return;
  const p = toDial(e);
  const n = holeAt(p);
  if (!n) return;
  e.preventDefault();
  dialEl.setPointerCapture(e.pointerId);
  drag = { n, last: p.a };
  moving = true;
  rot = 0;
}

function onMove(e) {
  if (!drag) return;
  const p = toDial(e);
  if (p.r < 20) return; // too close to the middle for a sensible angle
  let d = p.a - drag.last;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  drag.last = p.a;
  rot = clamp(rot + d, 0, travel(drag.n));
  paint();
}

function onUp() {
  if (!drag) return;
  const { n } = drag;
  drag = null;
  release(n);
}

// Let go: the spring takes the dial back and sends one pulse per step it passes.
function release(n) {
  const full = travel(n);
  if (rot >= full - 10) rot = full;
  const pulses = clamp(Math.floor((rot - STEP) / STEP), 0, 10);
  if (pulses === 0 && rot > 4) ctx.toast('Turn it all the way to the metal stop, then let go.');
  else if (pulses && pulses !== n) ctx.toast(`You let go before the stop: that dialed ${pulses % 10}, not ${n % 10}.`);
  if (rot > 4) ctx.sound.dialWhirr(rot / SPEED);

  let left = pulses;
  const t0 = performance.now();
  animate(-SPEED, 0, () => {
    while (left > 0 && rot <= STEP + STEP * left) {
      left--;
      ctx.sound.pulseClick();
      onPulse();
    }
  }, () => {
    if (inMission) returnMs += performance.now() - t0;
    moving = false;
    if (pulses) {
      if (inMission) digitCount++;
      onDigit(pulses);
    }
    pump();
  });
}

function animate(speed, target, step, done) {
  let last = performance.now();
  const tick = (now) => {
    if (!el) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    rot = speed > 0 ? Math.min(target, rot + speed * dt) : Math.max(target, rot + speed * dt);
    paint();
    step?.();
    if (rot === target) return done();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// Keyboard digits: a finger turns the dial to the stop, one digit at a time.
function pump() {
  if (moving || !queue.length) return;
  const n = queue.shift();
  moving = true;
  rot = 0;
  animate(AUTO_SPEED, travel(n), null, () => release(n));
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const t = e.target;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;

  const num = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  const k = /^[0-9]$/.test(e.key) ? e.key : num?.[1];
  if (k) {
    e.preventDefault();
    if (e.repeat) return;
    queue.push(Number(k) || 10);
    pump();
    return;
  }
  const onButton = t.tagName === 'BUTTON' || t.tagName === 'A';
  if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
    e.preventDefault();
    toggleHook();
  }
}
