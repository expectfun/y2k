// Dial-up email: a 2001 desktop with a mail client ("Pigeon Mail") and a dial-up connection.
// The mission is the main mode; "Start over" repeats it.

const NUMBER = '555-0142';
const RATE = 5000; // bytes per second, what 48,000 bps gave you after overhead
const SKIP_SPEED = 12;
const TASK = 'Your friend sent you photos from the party. Check your email.';
const CLOCK_START = new Date(2001, 9, 14, 20, 41, 0);

const ME = 'alex2001@pigeon.example';

const OLD_MAIL = [
  {
    id: 'old-mom', from: 'Mom', addr: 'mama@pigeon.example', subject: 'Re: Sunday', date: '09.10.2001 18:02', size: 2,
    body: 'Did you call grandma? She asked again about the photos from the dacha.\n\nAnd please don\'t sit on the internet all evening, I am waiting for a call from aunt Olya.\n\nMom',
  },
  {
    id: 'old-lena', from: 'Lena', addr: 'lena_2001@mail.example', subject: 'party on saturday!!!', date: '11.10.2001 22:15', size: 1,
    body: 'its at my place, 7pm. bring CDs!!! my dad says we can use his camera :))\n\nLena',
  },
];

const SERVER_MAIL = [
  {
    id: 'spam', from: 'Prize Department', addr: 'winner@lottery-intl.example', subject: 'CONGRATULATIONS!!! You have WON!!!', size: 3,
    body: 'Dear Winner,\n\nYour e-mail address was selected in our INTERNATIONAL E-MAIL LOTTERY. You have won $1,000,000.00 (ONE MILLION US DOLLARS)!!!\n\nTo claim your prize, simply reply with your full name, home address and bank account number.\n\nThis is NOT spam. You received this message because you are a WINNER.',
  },
  {
    id: 'chain', from: 'Katya', addr: 'katya_k@mail.example', subject: 'FW: FW: FW: FW: send this to 10 people!!!', size: 5,
    body: '>>>> THIS IS NOT A JOKE!!!\n>>>> A girl in Ohio deleted this letter and the same day her computer broke.\n>>>> Send it to 10 friends in the next 10 minutes and your wish will come true.\n>>>> Send it to 0 people and you will have bad luck for 7 years.\n>>>>\n>>>> DO NOT BREAK THE CHAIN!!!',
  },
  {
    id: 'news', from: 'CD-ROM Weekly', addr: 'news@cdrom-weekly.example', subject: 'Issue #47: the 10 best screensavers of 2001', size: 12,
    body: '=====================================\n   CD-ROM WEEKLY  ·  ISSUE #47\n=====================================\n\n1. Flying toasters are back!\n2. Pipes, but in 3D\n3. An aquarium that looks almost real\n...\n\nTo unsubscribe, send an empty letter with the subject UNSUBSCRIBE. Please allow 6-8 weeks.',
  },
  {
    id: 'friend', from: 'Lena', addr: 'lena_2001@mail.example', subject: 'photos from the party :)))', size: 312,
    attach: { name: 'party.jpg', size: 305 },
    body: 'hiii!\n\nhere are the photos from saturday. sorry the file is so big, my dad\'s camera is 2 megapixels!!! :)\n\nthe one where Max falls off the sofa is the best.\n\nLena\n\nP.S. don\'t print it in colour, the printer ink is expensive',
  },
];

const ICONS = {
  net: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="14" height="11" fill="#ddd5c3" stroke="#000"/><rect x="4" y="8" width="10" height="7" fill="#2f7f7c"/><rect x="6" y="17" width="6" height="3" fill="#bbb" stroke="#000"/><path d="M16 22h7" stroke="#000" stroke-dasharray="2 1.5"/><circle cx="25" cy="22" r="5.5" fill="#3a7bd5" stroke="#000"/><path d="M19.5 22h11M25 16.5c-3 3-3 8 0 11M25 16.5c3 3 3 8 0 11" stroke="#bfe3ff" fill="none"/></svg>',
  mail: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="8" width="26" height="17" fill="#fff8d8" stroke="#000"/><path d="M3 8l13 10L29 8" fill="none" stroke="#000"/><path d="M20 4l6 3-3 2z" fill="#6aa0d8" stroke="#000"/></svg>',
  pc: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="17" fill="#ddd5c3" stroke="#000"/><rect x="7" y="7" width="18" height="11" fill="#2f7f7c"/><rect x="8" y="23" width="16" height="5" fill="#ddd5c3" stroke="#000"/></svg>',
  tray: '<svg viewBox="0 0 20 16" aria-hidden="true"><rect x="1" y="2" width="8" height="7" fill="#ddd5c3" stroke="#000"/><rect x="11" y="6" width="8" height="7" fill="#ddd5c3" stroke="#000"/><rect x="2.5" y="3.5" width="5" height="4" class="tray-a"/><rect x="12.5" y="7.5" width="5" height="4" class="tray-b"/></svg>',
};

const LEDS = ['HS', 'AA', 'CD', 'OH', 'RD', 'SD', 'TR', 'MR'];

let ctx = null;
let el = null;
let desk = null;
let E = {};
let wins = new Set();
let timers = new Set();
let dialTimers = new Set();
let tickTimer = 0;
let lastTick = 0;

let conn = 'offline'; // offline | dialing | online
let bus = null;
let pendingReceive = false;
let recv = null;
let inbox = [];
let server = [];
let selected = null;
let simNow = 0; // simulated ms since mount ("real 2001 time")
let speed = 1;
let skippedMs = 0;
let connectedAt = 0;
let missionDone = false;
let dialWin = null;
let trayWin = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (list) => list.map((m) => ({ ...m }));

function later(ms, fn, group = timers) {
  const id = setTimeout(() => { group.delete(id); fn(); }, ms);
  group.add(id);
  return id;
}

// --- mount -----------------------------------------------------------------

export function mount(container, context) {
  ctx = context;
  el = container;
  el.innerHTML = `
    <div class="dial">
      <div class="monitor">
        <div class="screen">
          <div class="desktop">
            <div class="icons">
              <button type="button" class="dicon" data-act="dialer">${ICONS.net}<span>Home Internet</span></button>
              <button type="button" class="dicon" data-act="focus-mail">${ICONS.mail}<span>Pigeon Mail</span></button>
              <button type="button" class="dicon" data-act="pc">${ICONS.pc}<span>My Computer</span></button>
            </div>

            <section class="win mail" aria-label="Pigeon Mail">
              <div class="titlebar"><span>${ICONS.mail}Inbox — Pigeon Mail</span><span class="tb-deco" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span></div>
              <div class="menubar" aria-hidden="true"><span>File</span><span>Edit</span><span>View</span><span>Tools</span><span>Message</span><span>Help</span></div>
              <div class="toolbar">
                <button type="button" class="tbtn" data-act="new"><b aria-hidden="true">✉</b>New Mail</button>
                <button type="button" class="tbtn" data-act="reply"><b aria-hidden="true">↩</b>Reply</button>
                <button type="button" class="tbtn tbtn-sr" data-act="sendrecv"><b aria-hidden="true">⇅</b>Send/Receive</button>
                <button type="button" class="tbtn" data-act="delete"><b aria-hidden="true">✕</b>Delete</button>
              </div>
              <div class="mail-body">
                <nav class="folders" aria-label="Folders">
                  <p class="f-root">Local Folders</p>
                  <p class="f-item f-sel">Inbox <b class="inbox-count"></b></p>
                  <p class="f-item">Outbox</p>
                  <p class="f-item">Sent Items</p>
                  <p class="f-item">Deleted Items</p>
                  <p class="f-item">Drafts</p>
                </nav>
                <div class="mail-main">
                  <div class="msglist">
                    <div class="mhead" aria-hidden="true"><span></span><span>From</span><span>Subject</span><span class="c-date">Received</span></div>
                    <div class="mrows" role="list" aria-label="Messages"></div>
                  </div>
                  <div class="preview" tabindex="-1" aria-live="off"></div>
                </div>
              </div>
              <div class="statusbar"><span class="st-left"></span><span class="st-right">Working Offline</span></div>
            </section>

            <div class="sticky" hidden>
              <p>Don't forget to hang up — someone needs the phone!</p>
              <p class="sticky-small">(the little computers by the clock)</p>
            </div>
            <div class="balloon" hidden role="status"></div>
          </div>
          <div class="taskbar">
            <span class="start" aria-hidden="true"><i></i>Start</span>
            <span class="task-item" aria-hidden="true">Inbox — Pigeon Mail</span>
            <span class="tray">
              <button type="button" class="tray-net" hidden aria-label="Dial-up connection: connected. Details">${ICONS.tray}<span class="tray-time">0:00:00</span></button>
              <span class="clock">20:41</span>
            </span>
          </div>
        </div>
        <div class="monitor-chin" aria-hidden="true"><span class="power"></span></div>
      </div>
      <div class="modem" aria-hidden="true">
        <span class="modem-name">FastLink 56K</span>
        <span class="leds">${LEDS.map((l) => `<span class="led-wrap"><i class="led" data-led="${l}"></i><small>${l}</small></span>`).join('')}</span>
      </div>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;

  desk = el.querySelector('.desktop');
  E = {
    mail: el.querySelector('.win.mail'),
    icons: el.querySelector('.icons'),
    taskbar: el.querySelector('.taskbar'),
    rows: el.querySelector('.mrows'),
    preview: el.querySelector('.preview'),
    count: el.querySelector('.inbox-count'),
    stLeft: el.querySelector('.st-left'),
    stRight: el.querySelector('.st-right'),
    tray: el.querySelector('.tray-net'),
    trayTime: el.querySelector('.tray-time'),
    clock: el.querySelector('.clock'),
    sticky: el.querySelector('.sticky'),
    balloon: el.querySelector('.balloon'),
    modem: el.querySelector('.modem'),
    live: el.querySelector('.dial > [aria-live]'),
  };

  el.addEventListener('click', onClick);
  E.tray.addEventListener('click', openTray);
  simNow = 0;
  speed = 1;
  lastTick = performance.now();
  tickTimer = setInterval(tick, 100);

  resetSim();
  beginMission();
}

export function unmount() {
  clearInterval(tickTimer);
  for (const id of [...timers, ...dialTimers]) clearTimeout(id);
  timers.clear();
  dialTimers.clear();
  ctx.sound.stopBus(bus);
  bus = null;
  wins.clear();
  recv = null;
  el = ctx = desk = null;
}

export function challenge() {
  resetSim();
  beginMission();
}

function beginMission() {
  missionDone = false;
  skippedMs = 0;
  ctx.mission.begin({ task: TASK, onRetry: challenge });
}

function resetSim() {
  hangup({ quiet: true });
  for (const w of [...wins]) w.close();
  inbox = clone(OLD_MAIL).map((m) => ({ ...m, read: true }));
  server = clone(SERVER_MAIL);
  selected = null;
  E.sticky.hidden = true;
  E.balloon.hidden = true;
  renderList();
  E.preview.innerHTML = '<p class="pv-empty">There is no message selected.</p>';
}

function say(msg) {
  if (E.live) E.live.textContent = msg;
}

// --- clock and simulated time -------------------------------------------------

function tick() {
  const t = performance.now();
  const dt = t - lastTick;
  lastTick = t;
  const sdt = dt * speed;
  simNow += sdt;
  if (speed > 1 && ctx.mission.running) skippedMs += sdt - dt;
  if (recv) advanceReceive(sdt);
  const d = clockNow();
  E.clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (conn === 'online') {
    const dur = hms(simNow - connectedAt);
    E.trayTime.textContent = dur;
    if (trayWin) trayWin.q('.tray-dur').textContent = dur;
  }
}

const clockNow = () => new Date(CLOCK_START.getTime() + simNow);

function stamp() {
  const d = clockNow();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hms(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// --- clicks -----------------------------------------------------------------

function onClick(e) {
  const row = e.target.closest('.mrow');
  if (row) return selectMessage(row.dataset.id);
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act;
  const actions = {
    sendrecv: sendReceive,
    dialer: openDialer,
    'focus-mail': () => E.mail.querySelector('.tbtn-sr').focus(),
    pc: () => ctx.toast('My Computer is not part of this exhibit — yet.'),
    new: () => ctx.toast('Writing letters is not part of this exhibit — yet.'),
    reply: () => ctx.toast('Writing letters is not part of this exhibit — yet.'),
    delete: deleteSelected,
    photo: openPhoto,
  };
  actions[act]?.();
}

// --- windows ----------------------------------------------------------------

function openWin({ title, html, cls = '', modal = false, closable = true, onX }) {
  const w = document.createElement('section');
  w.className = `win dialog ${cls}`;
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-label', title);
  w.innerHTML = `
    <div class="titlebar"><span>${esc(title)}</span>${closable ? '<button type="button" class="tb-x" aria-label="Close">×</button>' : ''}</div>
    <div class="win-body">${html}</div>`;
  let blocker = null;
  const prevFocus = document.activeElement;
  if (modal) {
    blocker = document.createElement('div');
    blocker.className = 'blocker';
    desk.append(blocker);
    setInert(true);
  }
  desk.append(w);

  const api = {
    el: w,
    q: (s) => w.querySelector(s),
    body(html2) { w.querySelector('.win-body').innerHTML = html2; focusDefault(); },
    close() {
      if (!w.isConnected) return;
      w.remove();
      blocker?.remove();
      wins.delete(api);
      if (modal) setInert(false);
      if (prevFocus?.isConnected && !prevFocus.closest('[inert]')) prevFocus.focus({ preventScroll: true });
    },
  };
  const x = () => (onX ? onX() : api.close());
  w.querySelector('.tb-x')?.addEventListener('click', x);
  w.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closable) { e.stopPropagation(); x(); }
  });
  function focusDefault() {
    setTimeout(() => (w.querySelector('[data-default]') || w.querySelector('.win-body button'))?.focus({ preventScroll: true }), 0);
  }
  focusDefault();
  wins.add(api);
  return api;
}

function setInert(on) {
  for (const n of [...desk.children, E.taskbar]) {
    if (!n.classList.contains('blocker')) n.inert = on;
  }
}

function alertWin(title, message, icon = 'warn') {
  ctx.sound.ding();
  const w = openWin({
    title,
    modal: true,
    html: `<div class="alert"><span class="alert-icon alert-${icon}" aria-hidden="true">${icon === 'warn' ? '!' : 'i'}</span><p>${message}</p></div>
           <div class="win-actions"><button type="button" class="wbtn" data-default>OK</button></div>`,
  });
  w.q('.wbtn').addEventListener('click', () => w.close());
  return w;
}

// --- connecting -------------------------------------------------------------

function sendReceive() {
  ctx.mission.startTimer();
  if (conn === 'online') return startReceive();
  if (conn === 'dialing') { ctx.toast('Still connecting… listen to the modem.'); return; }
  ctx.sound.ding();
  const w = openWin({
    title: 'Pigeon Mail',
    modal: true,
    html: `<div class="alert"><span class="alert-icon alert-warn" aria-hidden="true">!</span>
             <p>No connection. You are working offline.<br>Connect to the Internet?</p></div>
           <div class="win-actions"><button type="button" class="wbtn" data-r="yes" data-default>Connect</button><button type="button" class="wbtn" data-r="no">Stay offline</button></div>`,
  });
  w.q('[data-r="yes"]').addEventListener('click', () => { w.close(); pendingReceive = true; openDialer(); });
  w.q('[data-r="no"]').addEventListener('click', () => w.close());
}

function openDialer() {
  ctx.mission.startTimer();
  if (conn === 'online') { openTray(); return; }
  if (dialWin) return;
  dialWin = openWin({
    title: 'Connect To',
    modal: true,
    onX: cancelDial,
    html: `
      <div class="dialer">
        <div class="dialer-top">${ICONS.net}<strong>Home Internet</strong></div>
        <div class="field"><span>User name:</span><span class="fake-input">alex2001</span></div>
        <div class="field"><span>Password:</span><span class="fake-input">••••••••</span></div>
        <div class="check"><span class="fake-check" aria-hidden="true">✓</span> Save password</div>
        <div class="field"><span>Phone number:</span><span class="fake-input">${NUMBER}</span></div>
        <div class="field"><span>Dialing from:</span><span class="fake-input">New Location</span></div>
      </div>
      <div class="win-actions"><button type="button" class="wbtn" data-r="dial" data-default>Dial</button><button type="button" class="wbtn" data-r="cancel">Cancel</button></div>`,
  });
  dialWin.q('[data-r="dial"]').addEventListener('click', dial);
  dialWin.q('[data-r="cancel"]').addEventListener('click', cancelDial);
}

function cancelDial() {
  pendingReceive = false;
  if (conn === 'dialing') hangup({ quiet: true, keepDialog: true });
  dialWin?.close();
  dialWin = null;
}

function dial() {
  conn = 'dialing';
  setLeds('dialing');
  dialWin.body(`
    <div class="connecting">
      <div class="conn-anim" aria-hidden="true">${ICONS.pc}<span class="dots"><i></i><i></i><i></i><i></i></span>${ICONS.net}</div>
      <p class="conn-status">Dialing…</p>
      <p class="conn-detail">Home Internet · ${NUMBER}</p>
    </div>
    <div class="win-actions"><button type="button" class="wbtn" data-r="cancel" data-default>Cancel</button></div>`);
  dialWin.q('[data-r="cancel"]').addEventListener('click', cancelDial);
  const status = (s) => { if (dialWin) dialWin.q('.conn-status').textContent = s; say(s); };
  status(`Dialing ${NUMBER}…`);

  const sound = ctx.sound;
  bus = sound.createBus();
  sound.dialTone(1.3, bus);
  sound.dtmfSequence(NUMBER.replace(/\D/g, ''), 1.4, bus);
  const hs = 2.8;
  const end = hs + sound.HANDSHAKE_SECONDS;
  later(hs * 1000, () => sound.handshake(bus), dialTimers);
  later((hs + 1.6) * 1000, () => { status('Connecting… the modems are agreeing on a speed.'); setLeds('handshake'); }, dialTimers);
  later(end * 1000, () => { status('Verifying username and password…'); setLeds('verify'); }, dialTimers);
  later((end + 2.2) * 1000, () => status('Logging on to network…'), dialTimers);
  later((end + 3.6) * 1000, connected, dialTimers);
}

function connected() {
  conn = 'online';
  connectedAt = simNow;
  ctx.sound.stopBus(bus);
  bus = null;
  dialWin?.close();
  dialWin = null;
  setLeds('online');
  E.tray.hidden = false;
  E.trayTime.textContent = '0:00:00';
  E.stRight.textContent = 'Online';
  balloon('Home Internet is now connected.\nConnected at 48,000 bps.');
  say('Connected at 48,000 bps.');
  if (pendingReceive) {
    pendingReceive = false;
    later(900, startReceive);
  }
}

function hangup({ quiet = false, keepDialog = false } = {}) {
  for (const id of dialTimers) clearTimeout(id);
  dialTimers.clear();
  ctx.sound.stopBus(bus);
  bus = null;
  const was = conn;
  conn = 'offline';
  pendingReceive = false;
  setLeds('off');
  E.tray.hidden = true;
  E.tray.classList.remove('nag');
  E.stRight.textContent = 'Working Offline';
  trayWin?.close();
  trayWin = null;
  if (!keepDialog) { dialWin?.close(); dialWin = null; }
  if (recv) {
    recv.win.close();
    recv = null;
    speed = 1;
    E.modem.classList.remove('busy');
    if (!quiet) alertWin('Pigeon Mail', 'The connection to the server was interrupted. Connect again to receive the rest of your mail.');
  }
  if (quiet || was === 'offline') return;
  ctx.sound.thunk();
  E.sticky.hidden = true;
  say('Disconnected.');
  if (was === 'online') ctx.toast(missionDone ? 'Hung up. The phone line is free again.' : 'Disconnected. The phone line is free.');
}

function openTray() {
  if (conn !== 'online') return;
  if (trayWin) { trayWin.close(); trayWin = null; return; }
  trayWin = openWin({
    title: 'Connected to Home Internet',
    cls: 'tray-win',
    onX: () => { trayWin.close(); trayWin = null; },
    html: `
      <div class="tray-info">
        <p>Connected at <b>48,000 bps</b></p>
        <p>Duration: <b class="tray-dur">${hms(simNow - connectedAt)}</b></p>
      </div>
      <div class="win-actions"><button type="button" class="wbtn" data-r="hang">Disconnect</button><button type="button" class="wbtn" data-r="ok" data-default>OK</button></div>`,
  });
  trayWin.q('[data-r="hang"]').addEventListener('click', () => hangup());
  trayWin.q('[data-r="ok"]').addEventListener('click', () => { trayWin.close(); trayWin = null; });
}

function balloon(msg) {
  E.balloon.textContent = msg;
  E.balloon.hidden = false;
  later(4500, () => { E.balloon.hidden = true; });
}

function setLeds(state) {
  const on = {
    off: ['TR', 'MR'],
    dialing: ['OH', 'TR', 'MR'],
    handshake: ['OH', 'TR', 'MR'],
    verify: ['CD', 'OH', 'TR', 'MR'],
    online: ['HS', 'CD', 'OH', 'TR', 'MR'],
  }[state];
  const blink = state === 'handshake' || state === 'verify' ? ['RD', 'SD'] : [];
  for (const led of E.modem.querySelectorAll('.led')) {
    led.classList.toggle('on', on.includes(led.dataset.led));
    led.classList.toggle('blink', blink.includes(led.dataset.led));
  }
}

// --- receiving mail -----------------------------------------------------------

function startReceive() {
  if (recv || conn !== 'online') return;
  const win = openWin({
    title: 'Pigeon Mail — Send/Receive',
    cls: 'progress-win',
    closable: false,
    html: `
      <p class="pr-task">Receiving: 'Home Internet' — Inbox</p>
      <p class="pr-status" aria-live="polite">Connecting to server mail.pigeon.example…</p>
      <div class="progress"><i></i></div>
      <p class="pr-detail">&nbsp;</p>
      <div class="win-actions">
        <button type="button" class="wbtn pr-skip">Skip ahead (museum time)</button>
        <button type="button" class="wbtn pr-stop">Stop</button>
      </div>`,
  });
  recv = {
    win,
    phase: 0,
    phaseLeft: 1500,
    total: server.length,
    idx: 0,
    got: 0,
    elapsed: 0,
  };
  E.stLeft.textContent = 'Receiving…';
  E.balloon.hidden = true;
  E.modem.classList.add('busy');
  win.q('.pr-skip').addEventListener('click', () => {
    speed = speed === 1 ? SKIP_SPEED : 1;
    win.q('.pr-skip').textContent = speed === 1 ? 'Skip ahead (museum time)' : `Back to real time (now ×${SKIP_SPEED})`;
    win.el.classList.toggle('skipping', speed > 1);
  });
  win.q('.pr-stop').addEventListener('click', () => finishReceive(true));
}

const PHASES = [
  ['Connecting to server mail.pigeon.example…', 1500],
  ['Authorizing user alex2001…', 1000],
  ['Checking for new messages…', 1000],
];

function advanceReceive(sdt) {
  const r = recv;
  r.elapsed += sdt;
  if (r.phase < PHASES.length) {
    r.phaseLeft -= sdt;
    if (r.phaseLeft <= 0) {
      r.phase++;
      if (r.phase < PHASES.length) r.phaseLeft = PHASES[r.phase][1];
      else if (!server.length) return finishReceive();
    }
  } else {
    const m = server[0];
    r.got += (RATE * (0.85 + Math.random() * 0.25) * sdt) / 1000;
    if (r.got >= m.size * 1000) {
      server.shift();
      inbox.unshift({ ...m, read: false, date: stamp() });
      r.got = 0;
      r.idx++;
      renderList();
      if (!server.length) return finishReceive();
    }
  }
  paintReceive();
}

function paintReceive() {
  const r = recv;
  const q = r.win.q;
  if (r.phase < PHASES.length) {
    q('.pr-status').textContent = PHASES[r.phase][0];
    q('.progress i').style.width = '0%';
    q('.pr-detail').textContent = `${mmss(r.elapsed / 1000)} elapsed (real time)`;
    return;
  }
  const m = server[0];
  const left = server.reduce((s, x) => s + x.size * 1000, 0) - r.got;
  q('.pr-status').textContent = `Receiving message ${r.idx + 1} of ${r.total} (${m.size} KB)…`;
  q('.progress i').style.width = `${Math.min(100, (r.got / (m.size * 1000)) * 100).toFixed(1)}%`;
  q('.pr-detail').textContent = `${Math.floor(r.got / 1000)} KB of ${m.size} KB · ${mmss(r.elapsed / 1000)} elapsed · about ${mmss(left / RATE)} left (real time)`;
}

function finishReceive(stopped = false) {
  const r = recv;
  if (!r) return;
  recv = null;
  speed = 1;
  E.modem.classList.remove('busy');
  r.win.q('.pr-skip').hidden = true;
  r.win.q('.pr-stop').hidden = true;
  r.win.q('.progress i').style.width = '100%';
  const n = r.idx;
  const msg = stopped ? 'Stopped.' : n ? `Done. ${n} new message${n > 1 ? 's' : ''}.` : 'No new messages.';
  r.win.q('.pr-status').textContent = msg;
  say(msg);
  renderList();
  if (n && !stopped) ctx.sound.chime();
  later(1300, () => r.win.close());
}

// --- the mail client ------------------------------------------------------------

function renderList() {
  const unread = inbox.filter((m) => !m.read).length;
  E.count.textContent = unread ? `(${unread})` : '';
  if (!recv) E.stLeft.textContent = `${inbox.length} message(s), ${unread} unread`;
  const focusedId = document.activeElement?.classList.contains('mrow') ? document.activeElement.dataset.id : null;
  E.rows.innerHTML = inbox.map((m) => `
    <button type="button" role="listitem" class="mrow${m.read ? '' : ' unread'}${m.id === selected ? ' sel' : ''}" data-id="${m.id}"
      aria-label="${m.read ? '' : 'Unread. '}From ${esc(m.from)}: ${esc(m.subject)}${m.attach ? ', with attachment' : ''}. ${m.date}">
      <span class="c-att">${m.attach ? '📎' : ''}</span>
      <span class="c-from">${esc(m.from)}</span>
      <span class="c-subj">${esc(m.subject)}</span>
      <span class="c-date">${m.date}</span>
    </button>`).join('');
  if (focusedId) E.rows.querySelector(`[data-id="${focusedId}"]`)?.focus({ preventScroll: true });
}

function selectMessage(id) {
  const m = inbox.find((x) => x.id === id);
  if (!m) return;
  selected = id;
  m.read = true;
  renderList();
  E.rows.querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true });
  E.preview.innerHTML = `
    <div class="pv-head">
      <p><b>From:</b> ${esc(m.from)} &lt;${esc(m.addr)}&gt;</p>
      <p><b>Date:</b> ${m.date}</p>
      <p><b>To:</b> ${ME}</p>
      <p><b>Subject:</b> ${esc(m.subject)}</p>
    </div>
    ${m.attach ? `<p class="pv-att"><button type="button" class="att" data-act="photo">📎 ${m.attach.name} (${m.attach.size} KB)</button></p>` : ''}
    <div class="pv-body">${esc(m.body)}</div>`;
  E.preview.scrollTop = 0;
}

function deleteSelected() {
  if (!selected) return;
  inbox = inbox.filter((m) => m.id !== selected);
  selected = null;
  renderList();
  E.preview.innerHTML = '<p class="pv-empty">There is no message selected.</p>';
}

// --- the photo ----------------------------------------------------------------

function openPhoto() {
  const existing = [...wins].find((w) => w.el.classList.contains('viewer'));
  if (existing) existing.close();
  const w = openWin({
    title: 'party.jpg — Image Preview',
    cls: 'viewer',
    html: `<canvas width="320" height="240" role="img"
             aria-label="Party photo: four friends on a red sofa, eyes glowing red from the flash, one of them falling off the sofa. An orange date stamp in the corner."></canvas>
           <p class="viewer-status">Opening party.jpg…</p>`,
  });
  const cv = w.q('canvas');
  const g = cv.getContext('2d');
  const photo = drawParty();
  g.fillStyle = '#c3c3c3';
  g.fillRect(0, 0, 320, 240);

  const done = () => {
    g.drawImage(photo, 0, 0);
    w.q('.viewer-status').textContent = 'party.jpg · 640×480 · 305 KB';
    photoSeen();
  };
  if (ctx.reducedMotion()) return done();

  const dur = 3200;
  const t0 = performance.now();
  const step = () => {
    if (!w.el.isConnected) return;
    const p = Math.min(1, (performance.now() - t0) / dur);
    const y = Math.floor((p * 240) / 8) * 8; // 8-pixel bands, like a slow JPEG decode
    if (y > 0) g.drawImage(photo, 0, 0, 320, y, 0, 0, 320, y);
    w.q('.viewer-status').textContent = `Loading… ${Math.round(p * 100)}%`;
    if (p < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

function photoSeen() {
  if (missionDone || !ctx.mission.running) return;
  missionDone = true;
  const wall = ctx.mission.elapsed();
  ctx.mission.stop();
  later(700, () => {
    const lines = [];
    if (skippedMs > 1500) lines.push(`Without museum time it would have taken ${ctx.formatTime(wall + skippedMs)}.`);
    if (conn === 'online') {
      const min = Math.max(1, Math.round((simNow - connectedAt) / 60000));
      lines.push(`You have been online for ${min} min. All that time, nobody could call your home.`);
    }
    ctx.mission.complete({
      lines,
      onClose: () => {
        if (conn !== 'online') return;
        E.sticky.hidden = false;
        E.tray.classList.add('nag');
      },
    });
  });
}

// A flash photo from a 2001 party: red eyes, a date stamp, a friend falling off the sofa.
function drawParty() {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 240;
  const g = c.getContext('2d');

  const bg = g.createRadialGradient(160, 110, 20, 160, 120, 260);
  bg.addColorStop(0, '#c9a27a');
  bg.addColorStop(0.55, '#6e4a33');
  bg.addColorStop(1, '#1d120c');
  g.fillStyle = bg;
  g.fillRect(0, 0, 320, 240);

  // wallpaper stripes and a garland
  g.fillStyle = 'rgba(255,240,210,0.07)';
  for (let x = 0; x < 320; x += 18) g.fillRect(x, 0, 7, 150);
  const flags = ['#e04b3a', '#f2c230', '#3a8fe0', '#4cbf5a'];
  g.strokeStyle = '#333';
  g.beginPath();
  g.moveTo(0, 18);
  g.quadraticCurveTo(160, 52, 320, 14);
  g.stroke();
  for (let i = 0; i < 13; i++) {
    const x = 8 + i * 25;
    const y = 18 + Math.sin((i / 12) * Math.PI) * 17;
    g.fillStyle = flags[i % 4];
    g.beginPath();
    g.moveTo(x - 7, y);
    g.lineTo(x + 7, y);
    g.lineTo(x, y + 14);
    g.fill();
  }

  // sofa
  g.fillStyle = '#7a2626';
  roundRect(g, 10, 140, 300, 110, 22);
  g.fillStyle = '#922f2f';
  roundRect(g, 0, 175, 320, 70, 16);

  const people = [
    { x: 62, y: 118, skin: '#f1c7a5', hair: '#3b2416', shirt: '#2f6db5', tilt: 0 },
    { x: 132, y: 112, skin: '#e8b48f', hair: '#c99a3e', shirt: '#e2e2e2', tilt: -0.06 },
    { x: 204, y: 116, skin: '#f3cfb3', hair: '#1c1410', shirt: '#9c3fb0', tilt: 0.05 },
    { x: 282, y: 150, skin: '#eebd98', hair: '#5a3a22', shirt: '#3f9c4a', tilt: 0.9 }, // Max, falling
  ];
  for (const p of people) {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.tilt);
    g.fillStyle = p.shirt;
    roundRect(g, -30, 26, 60, 80, 22);
    g.fillStyle = p.skin;
    g.beginPath();
    g.arc(0, 0, 23, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.hair;
    g.beginPath();
    g.arc(0, -6, 24, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
    for (const ex of [-8, 8]) { // red eyes from the flash
      g.fillStyle = '#e3121a';
      g.beginPath();
      g.arc(ex, -2, 3.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(ex - 1.5, -4, 1.4, 1.4);
    }
    g.strokeStyle = '#7a3a2a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.restore();
  }

  // flash glare on the wall
  const glare = g.createRadialGradient(150, 70, 0, 150, 70, 90);
  glare.addColorStop(0, 'rgba(255,255,240,0.35)');
  glare.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = glare;
  g.fillRect(0, 0, 320, 240);

  // sensor noise
  const img = g.getImageData(0, 0, 320, 240);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // the date stamp
  g.font = 'bold 15px "Courier New", monospace';
  g.textAlign = 'right';
  g.shadowColor = 'rgba(255,140,30,0.8)';
  g.shadowBlur = 4;
  g.fillStyle = '#ff9a2a';
  g.fillText("'01 10 13", 310, 230);
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}
