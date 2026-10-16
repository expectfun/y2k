// Routing: entrance → hall → exhibits, all on one page (hash routes keep the audio unlocked).

import { getFrame } from './frame.js';
import { sorted, byId, nextOf } from './exhibits.js';
import { HALL_ART } from './hall-art.js';
import * as sound from './sound.js';
import { createMission, formatTime } from './mission.js';

const app = document.getElementById('app');
const muteBtn = document.getElementById('mute');
const toastEl = document.getElementById('toast');
const frame = getFrame();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let entered = false;
let current = null; // { mod, mission }
let routeToken = 0;
let toastTimer = 0;

paintMute();
muteBtn.addEventListener('click', () => {
  sound.setMuted(!sound.isMuted());
  paintMute();
});
window.addEventListener('hashchange', route);
route();

function paintMute() {
  const m = sound.isMuted();
  muteBtn.innerHTML = m
    ? '<span aria-hidden="true">🔇</span><span class="mute-label">Sound off</span>'
    : '<span aria-hidden="true">🔊</span><span class="mute-label">Sound on</span>';
  muteBtn.setAttribute('aria-label', m ? 'Sound is off. Turn sound on' : 'Sound is on. Mute');
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
  window.scrollTo(0, 0);
}

function teardown() {
  if (!current) return;
  try { current.mod?.unmount?.(); } catch (err) { console.error(err); }
  current.mission?.destroy();
  current = null;
}

// --- entrance ------------------------------------------------------------

function renderEntrance() {
  document.title = frame.name;
  app.innerHTML = `
    <section class="entrance">
      <div class="odometer" aria-hidden="true">${[...'1999'].map((d) => `<span>${d}</span>`).join('')}</div>
      <h1 class="ent-title">${frame.name}</h1>
      <p class="ent-tagline">${frame.tagline}</p>
      <button type="button" class="btn primary ent-enter">${frame.enterLabel}</button>
      <p class="ent-note">${frame.entranceNote}</p>
    </section>`;
  const odo = app.querySelector('.odometer');
  const flip = () => {
    if (!odo.isConnected) return;
    odo.innerHTML = [...'2000'].map((d, i) => `<span class="flip" style="--i:${i}">${d}</span>`).join('');
  };
  if (reducedMotion.matches) flip();
  else setTimeout(flip, 900);

  const enter = app.querySelector('.ent-enter');
  enter.addEventListener('click', () => {
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
  const list = sorted();
  app.innerHTML = `
    <section class="hall-view">
      <header class="page-head">
        ${frame.back ? `<a class="back" href="${frame.back.href}">${frame.back.label}</a>` : ''}
        <h1 tabindex="-1">${frame.name}</h1>
        <p class="lede">${frame.hallIntro}</p>
      </header>
      <div class="hall">
        <p class="hall-sign" aria-hidden="true">${frame.hallTitle}</p>
        <ul class="hall-cases">
          ${list.map((e, i) => `
            <li>
              <a class="case" href="#${e.id}">
                <span class="case-glass" aria-hidden="true">${HALL_ART[e.id] || ''}</span>
                <span class="case-plinth" aria-hidden="true"><span class="case-num">${i + 1}</span></span>
                <span class="case-label"><strong>${e.title}</strong><span>${e.years}</span></span>
              </a>
            </li>`).join('')}
        </ul>
      </div>
      <section class="hall-list" aria-labelledby="list-h">
        <h2 id="list-h">All exhibits</h2>
        <ol>
          ${list.map((e) => `<li><a href="#${e.id}">${e.title}</a>, ${e.years}. ${e.alt}</li>`).join('')}
        </ol>
      </section>
    </section>`;
  app.querySelector('h1').focus({ preventScroll: true });
}

// --- exhibit page ----------------------------------------------------------

async function renderExhibit(ex, token) {
  const next = nextOf(ex);
  const nextHref = next ? `#${next.id}` : '#hall';
  document.title = `${ex.title} — ${frame.name}`;

  app.innerHTML = `
    <article class="exhibit exhibit-${ex.id}">
      <header class="page-head ex-head">
        <a class="back" href="#hall">← Hall</a>
        <div class="ex-title">
          <h1 tabindex="-1">${ex.title}</h1>
          <p class="ex-years">${ex.native ? `<span lang="ru">${ex.native}</span> · ` : ''}${ex.years}</p>
        </div>
        <div class="ex-actions">
          <button type="button" class="btn hint-btn" aria-label="Hint" title="Hint">?</button>
          <button type="button" class="btn primary challenge-btn">${ex.challengeLabel}</button>
        </div>
      </header>

      <div class="mission-bar" hidden>
        <span class="mission-label">Challenge</span>
        <span class="mission-task"></span>
        <span class="mission-time" aria-label="Time">0:00</span>
        <button type="button" class="btn small mission-stop">Stop</button>
      </div>

      <div class="ex-body">
        <div class="stage-wrap">
          <p class="sr-only">${ex.alt}</p>
          <div class="stage"></div>
        </div>
        <aside class="ex-side">
          <section class="plaque" aria-labelledby="plaque-h">
            <h2 id="plaque-h">${ex.title} <span>${ex.years}</span></h2>
            <p>${ex.plaque}</p>
          </section>
          <a class="next-link" href="${nextHref}">${next ? `Next exhibit: ${next.title} →` : 'Back to the hall →'}</a>
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
      </dialog>
    </article>`;

  const root = app.firstElementChild;
  const q = (s) => root.querySelector(s);
  const hint = q('.hint');
  for (const d of root.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  q('.hint-btn').addEventListener('click', () => hint.showModal());

  const mission = createMission({
    bar: q('.mission-bar'),
    dialog: q('.result'),
    today: ex.today,
    nextHref,
    nextLabel: next ? 'Next exhibit →' : 'Back to the hall',
  });
  current = { mission, mod: null };

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

  const ctx = {
    sound,
    mission,
    toast,
    formatTime,
    reducedMotion: () => reducedMotion.matches,
  };
  mod.mount(q('.stage'), ctx);
  q('.challenge-btn').addEventListener('click', () => mod.challenge?.());

  q('h1').focus({ preventScroll: true });
  if (!seen(ex.id)) {
    markSeen(ex.id);
    hint.showModal();
  }
}
