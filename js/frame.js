// The frame: everything world-specific. Exhibits never read this.
// Later, ?world=city (or another host) picks a different frame with a way back to its hub.

const frames = {
  neutral: {
    name: 'Y2K Museum',
    tagline: 'Tech from around the year 2000 — the waiting, the limits and the sounds.',
    entranceNote: 'Best with sound on. This museum is Y2K compliant.',
    enterLabel: 'Enter',
    hallTitle: 'Main hall',
    hallIntro: 'Three objects from the turn of the millennium. Pick any display case, or start the tour from the oldest one.',
    hallTip: 'Every exhibit works: touch it, then try its challenge to feel how long things took.',
    back: null, // { href, label } — a link back to the host world's hub
  },
};

export function getFrame() {
  let world = null;
  try { world = new URLSearchParams(location.search).get('world'); } catch { /* ignore */ }
  return frames[world] || frames.neutral;
}
