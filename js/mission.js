// Mission timer and result card. The exhibit page owns the bar and the dialog;
// exhibits drive them through ctx.mission.

export function formatTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createMission({ bar, idle, dialog, today, nextHref, nextLabel }) {
  const taskEl = bar.querySelector('.mission-task');
  const timeEl = bar.querySelector('.mission-time');
  let active = false;
  let t0 = 0;
  let t1 = 0;
  let timer = 0;
  let onCancel = null;
  let onRetry = null;
  let onClose = null;

  const elapsed = () => (t0 ? (t1 || performance.now()) - t0 : 0);
  const paint = () => { timeEl.textContent = formatTime(elapsed()); };
  const stopTick = () => { clearInterval(timer); timer = 0; };
  const showBar = (on) => { bar.hidden = !on; if (idle) idle.hidden = on; };

  bar.querySelector('.mission-stop').addEventListener('click', () => {
    const cb = onCancel;
    api.end();
    cb?.();
  });

  dialog.querySelector('[data-r="retry"]').addEventListener('click', () => {
    onClose = null;
    dialog.close();
    onRetry?.();
  });
  dialog.querySelector('[data-r="close"]').addEventListener('click', () => dialog.close());
  const nextA = dialog.querySelector('.result-next');
  nextA.href = nextHref;
  nextA.textContent = nextLabel;

  dialog.addEventListener('close', () => {
    if (!active) showBar(false);
    const cb = onClose;
    onClose = null;
    cb?.();
  });

  const api = {
    get active() { return active; },
    get running() { return active && !!t0 && !t1; },
    elapsed,

    begin({ task, onCancel: cancel = null, onRetry: retry = null } = {}) {
      active = true;
      t0 = 0;
      t1 = 0;
      stopTick();
      onCancel = cancel;
      onRetry = retry;
      taskEl.textContent = task;
      showBar(true);
      paint();
    },

    startTimer() {
      if (!active || t0) return;
      t0 = performance.now();
      timer = setInterval(paint, 250);
      paint();
    },

    // Freeze the clock (e.g. at "Send") before the result card shows up.
    stop() {
      if (!api.running) return;
      t1 = performance.now();
      stopTick();
      paint();
    },

    complete({ summary, lines = [], onClose: close = null } = {}) {
      if (!active) return;
      if (!t0) t0 = performance.now();
      api.stop();
      active = false;
      onClose = close;
      dialog.querySelector('.result-time').textContent = summary ?? `That took you ${formatTime(elapsed())}.`;
      dialog.querySelector('.result-lines').innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join('');
      dialog.querySelector('.result-today').innerHTML = `<b>Today:</b> ${esc(today)}`;
      if (!dialog.open) dialog.showModal();
    },

    end() {
      active = false;
      t0 = 0;
      t1 = 0;
      stopTick();
      showBar(false);
      paint();
    },

    destroy() {
      stopTick();
      onClose = null;
      if (dialog.open) dialog.close();
    },
  };
  return api;
}
