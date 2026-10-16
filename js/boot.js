// The entrance "boot": a CD-ROM tray opens, takes the museum disc, closes and reads it.
// About 7 seconds of period waiting; Skip (or Esc) cuts it short.

const TRAY_MS = 900;

export function runBoot(root, { sound, title, onDone }) {
  root.innerHTML = `
    <div class="boot">
      <p class="boot-title">${title} <span>· Disc 1</span></p>
      <div class="drive" aria-hidden="true">
        <div class="cd-tray">
          <div class="tray-well"></div>
          <div class="disc"><span class="disc-label">${title}</span><span class="disc-sub">Y2K compliant · Disc 1</span></div>
        </div>
        <div class="drive-body"><span class="drive-vents"></span><span class="drive-label">CD-ROM 52×</span></div>
        <div class="drive-front"><span class="drive-led"></span><span class="drive-slot"></span><span class="drive-eject"></span></div>
      </div>
      <p class="boot-status" role="status"></p>
      <div class="boot-bar" aria-hidden="true"><i></i></div>
      <button type="button" class="tool boot-skip">Skip <span aria-hidden="true">▸▸</span></button>
    </div>`;

  const q = (s) => root.querySelector(s);
  const tray = q('.cd-tray');
  const disc = q('.disc');
  const led = q('.drive-led');
  const statusEl = q('.boot-status');
  const bar = q('.boot-bar');
  const fill = q('.boot-bar i');
  const bus = sound.createBus();
  const timers = [];
  let progress = 0;
  let progressTimer = 0;
  let done = false;

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const status = (s) => { statusEl.textContent = s; };

  // A period progress bar: it stalls, then jumps.
  function startProgress() {
    bar.classList.add('show');
    progressTimer = setInterval(() => {
      if (Math.random() < 0.3) return;
      progress = Math.min(100, progress + 2 + Math.random() * 9);
      fill.style.width = `${progress}%`;
    }, 120);
  }

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    clearInterval(progressTimer);
    document.removeEventListener('keydown', onKey);
    sound.stopBus(bus);
    sound.welcome();
    onDone();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
  }

  q('.boot-skip').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  q('.boot-skip').focus({ preventScroll: true });

  status('Opening the drive…');
  sound.cdClick(bus);
  at(200, () => { tray.classList.add('out'); sound.cdMotor(TRAY_MS / 1000, bus); });
  at(1250, () => { status('Inserting the museum disc…'); disc.classList.add('in'); });
  at(1650, () => sound.cdClunk(bus));
  at(2000, () => { tray.classList.remove('out'); sound.cdMotor(TRAY_MS / 1000, bus); });
  at(2950, () => { sound.cdClunk(bus); led.classList.add('busy'); });
  at(3200, () => { status('Reading disc…'); sound.cdSpin(4.2, bus); sound.cdSeek(4, bus); });
  at(4300, () => { status('Loading Y2K Museum…'); startProgress(); });
  at(5900, () => status('Checking Y2K compliance… OK'));
  at(7300, () => { fill.style.width = '100%'; status('Starting…'); });
  at(7700, finish);

  return { cancel: () => { done = true; timers.forEach(clearTimeout); clearInterval(progressTimer); document.removeEventListener('keydown', onKey); sound.stopBus(bus); } };
}
