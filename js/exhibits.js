// Exhibit data. Plaques, hints and comparisons live here (the rest of the texts are in
// the exhibit modules), so a Russian version can find them later.

export const exhibits = [
  {
    id: 'abacus',
    order: 1,
    title: 'Abacus',
    native: 'счёты',
    tags: ['physical', 'hands', 'counting'],
    plaque:
      'The Russian abacus has been counting since the 17th century, and it was still on shop counters when the year 2000 arrived. ' +
      'Cashiers flicked the beads faster than you could find a calculator, and many trusted the beads more than batteries. ' +
      'There is no display: the answer is simply wherever the beads are.',
    alt: 'A wooden Russian abacus: eleven horizontal wires with beads, two dark beads in the middle of each wire, and one short wire with four beads.',
    hint: {
      kind: 'manual',
      page: 'p. 3',
      title: 'How to count on счёты',
      html: `
        <ol>
          <li>Each wire is one digit. Rubles start on the wire marked <b>1</b> and go up; kopecks are on the wires marked <b>0.1</b> and <b>0.01</b>.</li>
          <li>Beads pushed to the <b>left</b> are counted. Tap a bead to slide it (and the ones next to it) across, or swipe.</li>
          <li>The two dark beads mark the middle, so you can see five at a glance.</li>
          <li>The short wire with four beads was for quarter kopecks. Ignore it.</li>
          <li>To start again, a cashier tilted the abacus. Here, press <b>Reset</b>.</li>
        </ol>
        <p class="hint-small">Keyboard: ↑ ↓ choose a wire, ← → move beads.</p>`,
    },
    note: { label: 'Replica', text: 'Shortened: 7 of the original 11 wires. Real счёты went up to millions.' },
    teaser: 'Add up a shop receipt on the beads. No display, like the real thing.',
    today: 'A calculator: ~10 s. Your phone: ~3 s.',
    challengeLabel: 'Try the challenge',
  },
  {
    id: 'phone',
    order: 2,
    title: 'Mobile phone',
    tags: ['physical', 'screen', 'limits'],
    plaque:
      'Before touchscreens, a phone had twelve keys, and most of them carried three or four letters. ' +
      'To write “s” you pressed 7 four times; to write “ss” you did that, waited, and did it again. ' +
      'A text message held 160 characters and cost money, so people invented a whole shorthand to fit: “c u l8r”. ' +
      'Teenagers got so fast they could text inside a pocket without looking.',
    alt: 'A grey-blue mobile phone with a small green monochrome screen, two soft keys under the screen, a C key and a twelve-key keypad.',
    hint: {
      kind: 'manual',
      page: 'p. 34',
      title: 'Writing a text message',
      html: `
        <ul>
          <li>Each key carries several letters. Press <b>2</b> once for <i>a</i>, twice for <i>b</i>, three times for <i>c</i>.</li>
          <li>Two letters on the same key? Wait a moment until the cursor moves on.</li>
          <li><b>0</b> is a space, <b>1</b> is punctuation.</li>
          <li><b>#</b> switches Abc / abc / ABC / 123. <b>C</b> deletes.</li>
          <li>The left key under the screen sends, the right one clears.</li>
        </ul>
        <p class="hint-small">Keyboard: digits, * and # work; Backspace is C.</p>`,
    },
    note: { label: 'Replica', text: 'A lookalike, not a real model. Phones like it came from many makers.' },
    teaser: 'Text a friend that you are running late, with twelve keys.',
    today: '~5 s on a phone keyboard, ~2 s by voice.',
    challengeLabel: 'Try the challenge',
  },
  {
    id: 'dialup',
    order: 3,
    title: 'Dial-up internet',
    tags: ['virtual', 'waiting', 'sounds'],
    plaque:
      'Around 2000, going online meant your computer phoning another computer over the home phone line. ' +
      'The modem screeched while the two machines agreed on a speed, and while you were online nobody at home could make or take a call. ' +
      'Email did not arrive by itself: you connected, pressed Send/Receive, waited, and hung up. ' +
      'Time online was often paid by the minute, so people read their mail after disconnecting.',
    alt: 'A beige computer monitor showing an early-2000s desktop with an email program, and a modem with red status lights below it.',
    hint: {
      kind: 'note',
      title: 'Note from your big brother',
      html: `
        <p>Mail does NOT come by itself!! Press Send/Receive.</p>
        <p>Don't stay online all evening, Mom needs the phone.</p>
        <p>And DON'T pick up the phone while the modem is on!!!</p>`,
    },
    note: { label: 'Reconstruction', text: 'The desktop and “Pigeon Mail” are lookalikes of the era’s programs, not copies.' },
    teaser: 'Your friend sent you photos from the party. Check your email.',
    today: '0 s — your phone would have shown it before you even asked.',
    challengeLabel: 'Start over',
  },
];

export const sorted = () => [...exhibits].sort((a, b) => a.order - b.order);
export const byId = (id) => exhibits.find((e) => e.id === id) || null;

export function nextOf(ex) {
  const list = sorted();
  return list[list.indexOf(ex) + 1] || null;
}
