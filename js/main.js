// The app shell (top bar, stage, side panel, bottom navigation) and routing.
// Hash routes keep one page alive, so the audio unlocked at the entrance keeps working.

import { getFrame } from './frame.js';
import { sorted, byId } from './exhibits.js';
import { HALL_ART } from './hall-art.js';
import * as sound from './sound.js';
import { createMission, formatTime } from './mission.js';

const shell = document.getElementById('shell');
const app = document.getElementById('app');
const crumbs = shell.querySelector('.crumbs');
const helpBtn = document.getElementById('help');
const muteBtn = document.getElementById('mute');
const navHall = document.getElementById('nav-hall');
const navPrev = document.getElementById('nav-prev');
const navNext = document.getElementById('nav-next');
const navPos = document.getElementById('nav-pos');
const toastEl = document.getElementById('toast');
const frame = getFrame();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const list = sorted();

let entered = false;
let current = null; // { mod, mission, hint }
let routeToken = 0;
let toastTimer = 0;
let navTargets = {};

shell.querySelector('.logo-text').textContent = frame.name;
paintMute();
muteBtn.addEventListener('click', () => {
  sound.setMuted(!sound.isMuted());
  paintMute();
});
helpBtn.addEventListener('click', () => current?.hint?.showModal());
for (const [btn, key] of [[navHall, 'hall'], [navPrev, 'prev'], [navNext, 'next']]) {
  btn.addEventListener('click', () => { if (navTargets[key]) location.hash = navTargets[key]; });
}
window.addEventListener('hashchange', route);
route();

function paintMute() {
  const m = sound.isMuted();
  muteBtn.innerHTML = m ? '<span aria-hidden="true">🔇</span> Sound off' : '<span aria-hidden="true">🔊</span> Sound on';
  muteBtn.setAttribute('aria-pressed', String(!m));
}

export function toast(msg, ms = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function seen(id) {
  try { return localStorage.getItem(`y2k.seen.${id}`) === '1'; } catch { return false; }
}
function markSeen(id) {
  try { localStorage.setItem(`y2k.seen.${id}`, '1'); } catch { /* fine */ }
}

async function route() {
  const token = ++routeToken;
  teardown();
  if (!entered) return renderEntrance();
  const ex = byId(location.hash.slice(1));
  if (ex) await renderExhibit(ex, token);
  else renderHall();
}

function teardown() {
  if (!current) return;
  try { current.mod?.unmount?.(); } catch (err) { console.error(err); }
  current.mission?.destroy();
  current = null;
}

// Bottom bar and breadcrumb. Inactive buttons stay in place, just disabled.
function setChrome({ mode, ex = null }) {
  shell.dataset.mode = mode;
  const i = ex ? list.indexOf(ex) : -1;
  const prev = ex ? list[i - 1] : null;
  const next = ex ? list[i + 1] : list[0];
  navTargets = {
    hall: mode === 'hall' ? null : '#hall',
    prev: prev ? `#${prev.id}` : null,
    next: next ? `#${next.id}` : null,
  };
  navHall.disabled = !navTargets.hall;
  navPrev.disabled = !navTargets.prev;
  navNext.disabled = !navTargets.next;
  navPrev.title = prev ? prev.title : '';
  navNext.title = next ? next.title : '';
  navNext.querySelector('.nav-label').textContent = mode === 'hall' ? 'Start the tour' : 'Next';
  navPos.textContent = ex ? `Exhibit ${i + 1} of ${list.length}` : `${list.length} exhibits`;
  crumbs.innerHTML = ex
    ? `<a href="#hall">${frame.hallTitle}</a><span aria-hidden="true">›</span><span aria-current="page">${ex.title}</span>`
    : mode === 'hall' ? `<span aria-current="page">${frame.hallTitle}</span>` : '';
  helpBtn.hidden = !ex;
}

// --- entrance ------------------------------------------------------------

function renderEntrance() {
  document.title = frame.name;
  setChrome({ mode: 'entrance' });
  app.innerHTML = `
    <section class="entrance">
      <div class="odometer" aria-hidden="true">${[...'1999'].map((d) => `<span>${d}</span>`).join('')}</div>
      <h1 class="ent-title">${frame.name}</h1>
      <p class="ent-tagline">${frame.tagline}</p>
      <button type="button" class="btn-big ent-enter">${frame.enterLabel}</button>
      <p class="ent-note">${frame.entranceNote}</p>
    </section>`;
  const odo = app.querySelector('.odometer');
  const flip = () => {
    if (!odo.isConnected) return;
    odo.innerHTML = [...'2000'].map((d, i) => `<span class="flip" style="--i:${i}">${d}</span>`).join('');
  };
  if (reducedMotion.matches) flip();
  else setTimeout(flip, 900);

  app.querySelector('.ent-enter').addEventListener('click', () => {
    entered = true;
    sound.unlock();
    sound.welcome();
    if (!byId(location.hash.slice(1))) history.replaceState(null, '', '#hall');
    route();
  });
}

// --- hall ----------------------------------------------------------------

function renderHall() {
  document.title = frame.name;
  setChrome({ mode: 'hall' });
  app.innerHTML = `
    <div class="layout">
      <div class="stage stage-hall">
        <div class="hall">
          <ul class="hall-cases">
            ${list.map((e, i) => `
              <li>
                <a class="case" href="#${e.id}">
                  <span class="case-glass" aria-hidden="true">${HALL_ART[e.id] || ''}</span>
                  <span class="case-plinth" aria-hidden="true"><span class="case-num">${i + 1}</span></span>
                  <span class="case-label"><strong>${e.title}</strong><span>${e.years}</span></span>
                  <span class="sr-only">${e.alt}</span>
                </a>
              </li>`).join('')}
          </ul>
        </div>
      </div>
      <aside class="side">
        <div class="side-head">
          <h1 tabindex="-1">${frame.hallTitle}</h1>
          <p class="side-sub">${frame.name}</p>
        </div>
        <div class="plaque"><p>${frame.hallIntro}</p></div>
        <ol class="side-list">
          ${list.map((e) => `<li><a href="#${e.id}">${e.title}</a><span>${e.years}</span></li>`).join('')}
        </ol>
        <p class="side-tip">${frame.hallTip}</p>
      </aside>
    </div>`;
  app.querySelector('h1').focus({ preventScroll: true });
}

// --- exhibit page ----------------------------------------------------------

async function renderExhibit(ex, token) {
  const i = list.indexOf(ex);
  const next = list[i + 1];
  document.title = `${ex.title} — ${frame.name}`;
  setChrome({ mode: 'exhibit', ex });

  app.innerHTML = `
    <div class="layout exhibit-${ex.id}">
      <div class="stage-wrap">
        <p class="sr-only">${ex.alt}</p>
        <div class="stage"></div>
      </div>
      <aside class="side">
        <div class="side-head">
          <h1 tabindex="-1">${ex.title}</h1>
          <p class="side-sub">${ex.native ? `<span lang="ru">${ex.native}</span> · ` : ''}${ex.years}</p>
        </div>
        <div class="plaque"><p>${ex.plaque}</p></div>

        <section class="challenge" aria-label="Challenge">
          <div class="challenge-idle">
            <p class="ch-teaser">${ex.teaser}</p>
            <button type="button" class="btn-big challenge-btn"><span aria-hidden="true">★</span> ${ex.challengeLabel}</button>
          </div>
          <div class="mission-bar" hidden>
            <p class="mission-head"><span>Challenge</span><span class="mission-time" aria-label="Time">0:00</span></p>
            <p class="mission-task"></p>
            <button type="button" class="tool mission-stop">Stop challenge</button>
          </div>
        </section>
      </aside>
    </div>

    <dialog class="hint hint-${ex.hint.kind}" aria-labelledby="hint-h">
      <form method="dialog" class="hint-paper">
        ${ex.hint.kind === 'manual' ? `<p class="hint-kicker">Owner's manual · ${ex.hint.page}</p>` : ''}
        <h2 id="hint-h">${ex.hint.title}</h2>
        <div class="hint-body">${ex.hint.html}</div>
        <button class="btn" value="ok">Got it</button>
      </form>
    </dialog>

    <dialog class="result" aria-labelledby="result-h">
      <div class="ticket">
        <p class="ticket-kicker">${ex.title} · challenge complete</p>
        <h2 id="result-h" class="result-time"></h2>
        <ul class="result-lines"></ul>
        <p class="result-today"></p>
        <div class="result-actions">
          <button type="button" class="btn" data-r="retry">Try again</button>
          <a class="btn primary result-next" href="#hall"></a>
          <button type="button" class="btn" data-r="close">Close</button>
        </div>
      </div>
    </dialog>`;

  const q = (s) => app.querySelector(s);
  const hint = q('.hint');
  for (const d of app.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }

  const mission = createMission({
    bar: q('.mission-bar'),
    idle: q('.challenge-idle'),
    dialog: q('.result'),
    today: ex.today,
    nextHref: next ? `#${next.id}` : '#hall',
    nextLabel: next ? 'Next exhibit →' : 'Back to the hall',
  });
  current = { mission, hint, mod: null };

  let mod;
  try {
    mod = await import(`../exhibits/${ex.id}.js`);
  } catch (err) {
    console.error(err);
    q('.stage').textContent = 'This exhibit is closed for repairs (it failed to load).';
    return;
  }
  if (token !== routeToken) return;
  current.mod = mod;

  mod.mount(q('.stage'), {
    sound,
    mission,
    toast,
    formatTime,
    reducedMotion: () => reducedMotion.matches,
  });
  q('.challenge-btn').addEventListener('click', () => mod.challenge?.());

  q('h1').focus({ preventScroll: true });
  if (!seen(ex.id)) {
    markSeen(ex.id);
    hint.showModal();
  }
}
