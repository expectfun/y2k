# Y2K Museum

An online museum of early-2000s tech: the waiting, the limits and the sounds.

Plain HTML + JS modules, no build step. ES modules need a server, so locally:

    python3 -m http.server 8000   # then open http://localhost:8000

## Layout

- `index.html` — entry point, mute toggle
- `js/main.js` — routing (`#hall`, `#abacus`, `#phone`, `#dialup`), entrance, hall, exhibit page
- `js/frame.js` — world-specific texts (neutral frame now; `?world=` later)
- `js/exhibits.js` — exhibit data: plaques, hints, "today" comparisons
- `js/hall-art.js` — SVG art for the display cases
- `js/sound.js` — shared AudioContext, mute, synthesized sounds (DTMF, modem handshake…)
- `js/mission.js` — challenge timer and result card
- `exhibits/*.js` — each exports `mount(el, ctx)`, `unmount()` and `challenge()`
- `css/` — frame styles plus one file per exhibit
