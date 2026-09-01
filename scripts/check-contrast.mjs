#!/usr/bin/env node
/**
 * Can the text actually be read?
 *
 * The palette was chosen to look like a hand-painted lemonade sign, which is
 * the right instinct and is also exactly the instinct that produces pale text
 * on a pale background. About one boy in twelve has some colour vision
 * deficiency, plenty of this audience will play on a phone in daylight, and a
 * child who cannot read a number is not going to tell anybody — they will just
 * stop playing and it will read as "not engaging".
 *
 * WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text (18.66px bold or 24px).
 * This checks the combinations the game actually uses, listed by hand, because
 * a static scan of Tailwind classes cannot tell which pairs ever meet.
 *
 * Also checks the palette against the two common forms of colour blindness, by
 * simulating them and re-measuring: the game uses green for good and pink for
 * bad in several places, and if those two collapse into each other the meaning
 * has to be carried by something else as well.
 */

const PALETTE = {
  'lemon-light': '#FFF3A0',
  lemon: '#FFE14D',
  'lemon-deep': '#FFC61A',
  'lemon-rind': '#E0A200',
  'sky-cold': '#7FA8C9',
  'sky-mild': '#5FBFF0',
  'sky-hot': '#FFD27A',
  grass: '#5FBF5F',
  'grass-deep': '#3D9440',
  wood: '#C97B3C',
  'wood-deep': '#9A5526',
  'wood-dark': '#6E3B18',
  ink: '#2B2118',
  'ink-soft': '#5A4A38',
  berry: '#BF3F54',
  mint: '#2ED9A0',
  white: '#FFFFFF',
  'panel-cream': '#FFF8E4',
  'night-panel': '#3A4363',
};

/**
 * Pairs the game puts on screen, as `[text, background, size]`.
 *
 * `large` means 18.66px bold or bigger, which is most of the sign lettering.
 * Anything not marked large is held to the body-text bar.
 */
const PAIRS = [
  ['ink', 'white', 'body'],
  ['ink', 'panel-cream', 'body'],
  ['ink', 'lemon-light', 'body'],
  ['ink', 'lemon', 'large'],
  ['ink-soft', 'white', 'body'],
  ['ink-soft', 'panel-cream', 'body'],
  ['berry', 'white', 'body'],
  ['berry', 'panel-cream', 'body'],
  ['wood-deep', 'lemon-light', 'body'],
  ['wood-dark', 'lemon-light', 'body'],
  ['white', 'berry', 'body'],
  ['white', 'wood-deep', 'body'],
  ['white', 'night-panel', 'body'],
  ['lemon-light', 'night-panel', 'body'],
  ['ink', 'mint', 'body'],
  ['ink', 'sky-hot', 'large'],
  // The hand-painted price on the sign, which is the most-looked-at number in
  // the game and was the one that failed hardest.
  ['berry', 'lemon-light', 'body'],
];

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Brettel-style approximation of dichromatic vision.
 *
 * Not a clinical simulation — it is a linear transform in RGB that is close
 * enough to answer the only question being asked here: do two colours the game
 * uses to mean opposite things stay distinguishable.
 */
const BLINDNESS = {
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
};

function simulate(colour, matrix) {
  const [r, g, b] = rgb(colour);
  return matrix.map((row) => Math.max(0, Math.min(255, row[0] * r + row[1] * g + row[2] * b)));
}

/** How far apart two colours look, 0–1, in plain RGB distance. */
function apart(a, b) {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return d / Math.hypot(255, 255, 255);
}

let failed = false;

console.log('Text contrast (WCAG 2.1 AA)\n');
for (const [fg, bg, size] of PAIRS) {
  const need = size === 'large' ? 3 : 4.5;
  const got = ratio(rgb(PALETTE[fg]), rgb(PALETTE[bg]));
  const ok = got >= need;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${got.toFixed(2).padStart(5)}:1  need ${need}  ${fg} on ${bg}`,
  );
}

/*
 * Green for good and pink for bad appear side by side on the profit and loss,
 * the holdings list and the table. Colour is never the only carrier — there is
 * a sign on every figure and a word on every verdict — but the two should still
 * not collapse into the same colour.
 */
const MEANING_PAIRS = [['mint', 'berry']];
const SEPARATE_ENOUGH = 0.12;

console.log('\nColour-blind separation of good and bad\n');
for (const [a, b] of MEANING_PAIRS) {
  for (const [name, matrix] of Object.entries(BLINDNESS)) {
    const distance = apart(simulate(PALETTE[a], matrix), simulate(PALETTE[b], matrix));
    const ok = distance >= SEPARATE_ENOUGH;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'}  ${distance.toFixed(3)}  need ${SEPARATE_ENOUGH}  ${a} vs ${b} under ${name}`,
    );
  }
}

if (failed) {
  console.error('\nSome text cannot be read. Fix the palette or the pairing.');
  process.exit(1);
}
console.log('\nOK');
