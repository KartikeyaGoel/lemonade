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
  'berry-light': '#FF9DAE',
  mint: '#2ED9A0',
  'mint-deep': '#0B7A59',
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
  /*
   * The green that is text rather than a background, on the three surfaces it
   * appears on. `mint` itself is only ever a fill behind ink — at 1.8:1 on
   * white it could never be a figure — so the moment a green *number* was
   * wanted, a second green had to exist and be checked.
   */
  ['mint-deep', 'white', 'body'],
  ['mint-deep', 'panel-cream', 'body'],
  ['mint-deep', 'lemon-light', 'body'],
  /*
   * The listed-company screen, whose share price is green when it rose and
   * pink when it fell. Measured against the solid panel those figures sit on
   * rather than against the sky, because the sky is a gradient and its bottom
   * stop is far too light to carry a tinted figure at all.
   */
  ['berry-light', 'night-panel', 'body'],
  ['mint', 'night-panel', 'body'],
  ['ink', 'sky-hot', 'large'],
  // The hand-painted price on the sign, which is the most-looked-at number in
  // the game and was the one that failed hardest.
  ['berry', 'lemon-light', 'body'],
];

/**
 * Tinted ink on the lemon sign, which is its own case.
 *
 * `text-ink/45` is an idiom that works on white — 5.6:1 — and fails on the
 * sign, because lemon-light is already most of the way to the ink. The label
 * reading "tap the sign" sat there at 2.69:1 and nine pixels, and it is the
 * only thing in the game that says where the price lives. The pilot's note was
 * *"I couldn't figure out where to adjust the price"*, which read as a missing
 * affordance and was an unreadable one.
 */
const TINTED_ON_SIGN = [
  ['ink', 0.7, 'lemon-light', 1, 'white', 'body'],
];

/**
 * The night sky, which is a gradient and therefore three backgrounds.
 *
 * Every screen from the listing onwards sits on it, and `Sky` renders it as
 * `from-[#1E2A4A] via-[#3B4A78] to-[#6B7BA8]`. A card at the top of the screen
 * has a background two and a half times darker than the same card at the
 * bottom, so a translucent panel measured against one stop tells you nothing
 * about the other two.
 */
const NIGHT_SKY = { 'night-top': '#1E2A4A', 'night-mid': '#3B4A78', 'night-bottom': '#6B7BA8' };

/**
 * Translucent fills, composited before they are measured.
 *
 * This is the half of the problem the curated pair list could not express, and
 * every contrast defect found by a real person has been in it rather than in
 * `PAIRS`. The readiness gate put `text-ink/65` on `bg-mint/15` over this sky:
 * pale mint over white, which is what the idiom means on the light screens,
 * composites to **dark teal** over a night gradient, and the dark ink on it
 * measured **1.35:1** against a 4.5:1 bar. The tick and the border said
 * "you did this" and the sentence underneath was unreadable.
 *
 * Nothing in a class name says which surface it will end up over, so the pairs
 * are listed by hand as `[text, textAlpha, fill, fillAlpha, over, size]` and
 * `over` may be a palette key or one of the sky's stops.
 *
 * `fillAlpha: 1` means an opaque panel, which is the shape of the fix: the
 * state goes on the border and the tick, and the text sits on a solid surface
 * that was measured once.
 */
const LAYERED = [
  ...TINTED_ON_SIGN,
  /* The readiness gate, both card states, on all three stops of the sky. */
  ...Object.keys(NIGHT_SKY).flatMap((stop) => [
    ['lemon-light', 1, 'night-panel', 1, stop, 'body'],
    ['white', 0.85, 'night-panel', 1, stop, 'body'],
    ['white', 1, 'night-panel', 1, stop, 'body'],
  ]),
  /* The market's own white cards, which are nearly opaque over the same sky. */
  ...Object.keys(NIGHT_SKY).flatMap((stop) => [
    ['ink', 1, 'white', 0.9, stop, 'body'],
    /*
     * The faceoff rows, which are the pair the pilot misread.
     *
     * `ink/65` is the figure on the side that is *not* more; `ink/70` is the
     * "▲ more" marker, the row label, the summary and the meaning.
     *
     * The marker matters most and was nearly shipped at `ink/45`, which
     * measures **2.63:1**. That would have been worse than the defect it
     * replaced: the mint fill at least *communicated*, wrongly, whereas an
     * unreadable marker communicates nothing at all and the row would have
     * had no indication of which side was more. Caught here rather than by a
     * person, which is the point of adding these pairs at the same time as the
     * change rather than afterwards.
     *
     * `ink/65` is the floor on this surface — 4.62:1 against the sky's darkest
     * stop, where `white/90` composites lightest.
     */
    ['ink', 0.7, 'white', 0.9, stop, 'body'],
    ['ink', 0.65, 'white', 0.9, stop, 'body'],
  ]),
  /* The derived strengths and risks, on the solid night panel. */
  ...Object.keys(NIGHT_SKY).map((stop) => ['white', 0.7, 'night-panel', 1, stop, 'body']),
  /*
   * Un-panelled text, each against the stop it actually sits over.
   *
   * The stop is a judgement and it has to be, exactly as the note above on the
   * listed-company figures says: a script cannot see where on the page an
   * element lands. What it *can* do is hold the judgement once it is written
   * down, so moving the gate's paragraph to the foot of the screen later on
   * would need this line changed rather than nobody noticing.
   */
  ['white', 0.85, null, 0, 'night-top', 'body'],
  ['white', 0.85, null, 0, 'night-mid', 'body'],
  ['lemon-light', 1, null, 0, 'night-top', 'large'],
];

/**
 * The floor under all of that, and the reason it is a rule and not a taste.
 *
 * **Pure white on the bottom stop of the night sky is 4.18:1.** Body text needs
 * 4.5. So there is no opacity, and no tint, at which a sentence can be laid
 * straight onto the foot of a night screen and still be readable — the lightest
 * colour there is loses.
 *
 * That is worth asserting rather than remembering, because it converts a whole
 * category of judgement into a single fact: anything at the bottom of a night
 * screen goes on a panel. If the palette is ever retuned so that this stops
 * being true, this check fails and the rule can be relaxed on purpose.
 */
const SKY_FLOOR = ['white', 'night-bottom'];

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

/** One colour laid over another at `alpha`, as the browser would paint it. */
function blend(over, alpha, under) {
  const f = rgb(over);
  const b = rgb(under);
  return `#${f
    .map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Resolve a name to a hex, from the palette or from the sky's stops. */
function surface(name) {
  return PALETTE[name] ?? NIGHT_SKY[name] ?? name;
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

console.log('\nTranslucent fills, composited\n');
for (const [fg, fgA, fill, fillA, over, size] of LAYERED) {
  const need = size === 'large' ? 3 : 4.5;
  const base = surface(over);
  const bg = fill ? blend(surface(fill), fillA, base) : base;
  const text = blend(surface(fg), fgA, bg);
  const got = ratio(rgb(text), rgb(bg));
  const ok = got >= need;
  if (!ok) failed = true;
  const what = fill ? `${fill}/${Math.round(fillA * 100)}` : 'nothing';
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${got.toFixed(2).padStart(5)}:1  need ${need}  ` +
      `${fg}/${Math.round(fgA * 100)} on ${what} over ${over}`,
  );
}

console.log('\nThe night sky cannot carry body text at its lightest stop\n');
{
  const [fg, stop] = SKY_FLOOR;
  const got = ratio(rgb(surface(fg)), rgb(surface(stop)));
  const ok = got < 4.5;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${got.toFixed(2)}:1 is under 4.5, so ${fg} on ${stop} needs a panel. ` +
      `If this ever passes 4.5 the rule above can be relaxed.`,
  );
}

/*
 * Green for good and pink for bad appear side by side on the profit and loss,
 * the holdings list and the table. Colour is never the only carrier — there is
 * a sign on every figure and a word on every verdict — but the two should still
 * not collapse into the same colour.
 */
const MEANING_PAIRS = [
  ['mint', 'berry'],
  /* On white: the challenge comparison and the reckoning verdict. */
  ['mint-deep', 'berry'],
  /* On the night sky: a share price that rose against one that fell. */
  ['mint', 'berry-light'],
];
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
