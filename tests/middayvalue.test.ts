/**
 * Is the lunchtime decision a decision, or decoration?
 *
 * ## Why this file exists
 *
 * `RunDayScreen`'s `interactive` mode was argued carefully, shipped, and
 * bypassed by five children out of five. PRODUCT.md §71 records the conclusion
 * that matters: **design reasoning has a track record in this project and it is
 * one for two.** So a second mechanic aimed at the same problem cannot be
 * shipped on reasoning alone, and "we will find out in the next pilot" is not
 * good enough either.
 *
 * The way out is to separate what needs a child from what does not.
 *
 * Whether a nine-year-old *reads* the card needs a child. But three properties
 * that have to hold before reading it could possibly be worth anything are
 * arithmetic, and they can be measured against the simulation today:
 *
 *  1. **Consequential.** Answering well rather than badly has to move real
 *     money. If the three answers all produce the same day, no child will
 *     engage with it twice however well it is presented.
 *  2. **Situation-dependent.** The best answer has to depend on what happened.
 *     If one answer is always right, this is not a decision — it is a tax on
 *     attention, and a child will correctly reduce it to a reflex.
 *  3. **Learnable, and un-farmable.** The information on the card has to be
 *     enough to choose well, *and* a fixed rule must not beat reading the
 *     situation. Otherwise the mechanic rewards thoughtlessness, which is worse
 *     than rewarding nothing.
 *
 * Those three are what this file holds. They are not a prediction about
 * behaviour; they are the conditions under which behaviour could pay off, and
 * they are the part that a later change to the demand curve or the weather
 * could silently destroy.
 *
 * ## What was measured
 *
 * Over 2,650 days that carried a question, across 120 seeds, seven prices and
 * four batch sizes:
 *
 * | | |
 * |---|---|
 * | best answer vs worst | mean **$6.57**, median $5.50, p90 $13.00 |
 * | best answer vs "Keep" | mean **$2.78**, median $2.29 |
 * | `running-out` → best answer is "raise" | **97%** of days |
 * | `not-selling` → best answer | drop 57%, keep 25%, raise 18% |
 *
 * And the backtest, which is the part that settles it:
 *
 * | strategy | average profit a day |
 * |---|---|
 * | always raise | $21.87 |
 * | always drop | $21.12 |
 * | always keep — *ignore the feature* | **$22.07** |
 * | read the lean the card reports | **$24.37** |
 * | perfect hindsight | $24.85 |
 *
 * Reading the situation is worth about 10% of a day and captures 98% of what
 * perfect hindsight would get. Both fixed strategies lose to simply ignoring
 * the feature, so a child who always raises does worse than one who never
 * looks — the mechanic cannot decay into a reflex tap that still pays.
 *
 * The sweep here is smaller than that, to keep the suite quick, and every
 * threshold is set with margin below the measured figure.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, orderForTargetCups, runDay } from '../src/lib/simulation';
import { middayCall, middayOptions, type Lean } from '../src/lib/midday';
import { leverReady, type Lever } from '../src/lib/levers';

type Answer = 'down' | 'hold' | 'up';

interface Trial {
  lean: Lean;
  profit: Record<Answer, number>;
  best: Answer;
  worst: Answer;
}

/**
 * One day, run once at each of the three answers.
 *
 * The same stand, the same order and the same seed every time, so the only
 * thing that differs between the three runs is what the afternoon half of the
 * crowd read off the sign.
 */
function trial(seed: number, price: number, cups: number): Trial | null {
  const stand = createInitialState(seed);
  const order = orderForTargetCups(stand, cups);
  const call = middayCall(runDay(stand, { ...order, price }));
  if (!call) return null;

  const profit = {} as Record<Answer, number>;
  /*
   * The three price answers only.
   *
   * `middayOptions` gained a fourth on a running-out day — sending out for
   * more cups — and this file is about whether the *price* decision is a
   * decision. Mixing a capacity choice into the same backtest would measure
   * two mechanics as one and tell us nothing about either.
   */
  for (const option of middayOptions(price)) {
    if (option.id === 'more') continue;
    profit[option.id] = runDay(stand, {
      ...order,
      price,
      afternoonPrice: option.price,
    }).profit;
  }
  const ranked = (Object.keys(profit) as Answer[]).sort((a, b) => profit[b] - profit[a]);
  return { lean: call.lean, profit, best: ranked[0], worst: ranked[ranked.length - 1] };
}

/** Every day in the sweep that carried a question. */
const DAYS: Trial[] = (() => {
  const out: Trial[] = [];
  for (let seed = 1; seed <= 45; seed++) {
    for (const price of [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5]) {
      for (const cups of [16, 24, 32, 44]) {
        const t = trial(seed, price, cups);
        if (t) out.push(t);
      }
    }
  }
  return out;
})();

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Total profit from playing every day in the sweep by one rule. */
function played(pick: (lean: Lean) => Answer): number {
  return DAYS.reduce((sum, day) => sum + day.profit[pick(day.lean)], 0) / DAYS.length;
}

describe('the lunchtime decision is a decision', () => {
  it('has enough days in the sweep to mean anything', () => {
    expect(DAYS.length, 'the sweep produced almost no questions').toBeGreaterThan(600);
    // And both shapes of day are represented, or the claims below are partial.
    for (const lean of ['running-out', 'not-selling'] as const) {
      expect(DAYS.filter((d) => d.lean === lean).length, lean).toBeGreaterThan(100);
    }
  });

  it('moves real money, so engaging with it can pay', () => {
    /*
     * Property 1. A decision whose three answers produce the same day is
     * decoration, and no presentation rescues it.
     *
     * Measured at a $6.57 mean and a $5.50 median against a day worth about
     * $22. The floor is set at $2.50 — well under half the measured median —
     * because what this test is for is catching the day the economy is retuned
     * and the decision quietly stops mattering, not pinning today's figure.
     */
    const spread = DAYS.map((d) => d.profit[d.best] - d.profit[d.worst]);
    const overHolding = DAYS.map((d) => d.profit[d.best] - d.profit.hold);
    expect(median(spread), `median best-vs-worst was $${median(spread).toFixed(2)}`).toBeGreaterThan(
      2.5,
    );
    expect(
      median(overHolding),
      `median value of answering well over keeping the price was $${median(overHolding).toFixed(2)}`,
    ).toBeGreaterThan(1);
  });

  it('has a different right answer depending on how the morning went', () => {
    /*
     * Property 2. If one answer were always best this would be a tax on
     * attention rather than a decision, and a child would be right to reduce
     * it to a reflex.
     *
     * Measured: on a day running short, raising is best 97% of the time — a
     * near-deterministic rule, which is exactly the scarcity-pricing lesson
     * and is meant to be learnable in two or three tries. On a day that is not
     * selling, dropping wins only 57% of the time, so that one stays hard.
     */
    const bestFor = (lean: Lean) => {
      const sub = DAYS.filter((d) => d.lean === lean);
      const tally = { down: 0, hold: 0, up: 0 } as Record<Answer, number>;
      for (const day of sub) tally[day.best]++;
      return { tally, n: sub.length };
    };

    const short = bestFor('running-out');
    expect(
      short.tally.up / short.n,
      'raising stopped being the answer on a day that runs short',
    ).toBeGreaterThan(0.8);

    const quiet = bestFor('not-selling');
    expect(
      quiet.tally.down / quiet.n,
      'dropping stopped being the usual answer on a day nobody is buying',
    ).toBeGreaterThan(0.4);

    // And the two situations genuinely disagree about what to do.
    expect(
      short.tally.up / short.n,
      'the two leans want the same answer, so the lean tells a child nothing',
    ).toBeGreaterThan(quiet.tally.up / quiet.n + 0.3);
  });

  it('rewards reading the card and punishes answering it blindly', () => {
    /*
     * Property 3, and the one that makes this worth shipping.
     *
     * `readTheLean` is the rule a child can get straight off the card: it says
     * which way the day is leaning, and nothing else. If that rule did not beat
     * the fixed ones, the card would be decoration. If a fixed rule beat it,
     * the mechanic would reward a reflex — which is worse than rewarding
     * nothing, because it would look like learning.
     *
     * Measured: read-the-lean $24.37 a day against always-keep $22.07, and
     * *both* fixed moves lose to simply ignoring the feature.
     */
    const alwaysUp = played(() => 'up');
    const alwaysDown = played(() => 'down');
    const ignoreIt = played(() => 'hold');
    const readTheLean = played((lean) => (lean === 'running-out' ? 'up' : 'down'));
    const perfect = mean(DAYS.map((d) => d.profit[d.best]));

    const report =
      `up $${alwaysUp.toFixed(2)} · down $${alwaysDown.toFixed(2)} · ` +
      `ignore $${ignoreIt.toFixed(2)} · read $${readTheLean.toFixed(2)} · perfect $${perfect.toFixed(2)}`;

    // Reading it beats ignoring it, by enough to be worth a child's attention.
    expect(readTheLean, report).toBeGreaterThan(ignoreIt * 1.05);

    // And it gets most of the way to what perfect hindsight would.
    expect(readTheLean / perfect, report).toBeGreaterThan(0.9);

    /*
     * Neither reflex pays. This is the assertion that stops the mechanic
     * degrading into "always tap the green one": a child who does that should
     * end up behind a child who never looked, and they do.
     */
    expect(alwaysUp, `always raising beat ignoring it — ${report}`).toBeLessThan(ignoreIt);
    expect(alwaysDown, `always dropping beat ignoring it — ${report}`).toBeLessThan(ignoreIt);
  });
});

describe('staggering the levers did not thin the opening', () => {
  /*
   * The worry §71 names about the weakest change in the pass: the wall was on
   * day three and the staggering makes day *one* simpler, so if the first two
   * minutes were already fine, thinning them is a regression.
   *
   * It is countable rather than arguable. Day one lost the recipe and gained
   * the lunchtime question, and days four onwards have both — so the decision
   * count per day should be flat at the start and *rise*, which is the shape a
   * progression is supposed to have and which a flat three never had.
   */
  const LEVERS: Lever[] = ['price', 'batch', 'grade'];

  /** How often a day at a sensible price carries a lunchtime question. */
  function questionRate(dayNumber: number): number {
    let asked = 0;
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let state = createInitialState(seed);
      for (let day = 1; day <= dayNumber; day++) {
        const outcome = runDay(state, { ...orderForTargetCups(state, 28), price: 1.5 });
        if (day === dayNumber) {
          total++;
          if (middayCall(outcome)) asked++;
        }
        state = outcome.nextState;
      }
    }
    return asked / total;
  }

  function decisionsOn(dayNumber: number): number {
    const played = dayNumber - 1;
    return LEVERS.filter((lever) => leverReady(lever, played)).length + questionRate(dayNumber);
  }

  it('leaves the first day with about as much to decide as it had', () => {
    /*
     * Three, before. Measured at 2.87 after — two levers plus a question on
     * 87% of days. The floor is 2.5, which is the point at which a child would
     * genuinely be looking at a thinner opening than the pilot saw.
     */
    const dayOne = decisionsOn(1);
    expect(dayOne, `day one now offers ${dayOne.toFixed(2)} decisions`).toBeGreaterThan(2.5);
  });

  it('gives the day the pilot got bored on more to decide, not less', () => {
    /*
     * The whole point. "After Day 3 I got the feeling the game is getting too
     * repetitive" — so day four has to be the day something arrives. Measured
     * at 3.80 against a flat 3.00 before.
     */
    const dayOne = decisionsOn(1);
    const dayFour = decisionsOn(4);
    expect(dayFour, `day four offers ${dayFour.toFixed(2)}`).toBeGreaterThan(3.5);
    expect(
      dayFour,
      `day four (${dayFour.toFixed(2)}) is not richer than day one (${dayOne.toFixed(2)})`,
    ).toBeGreaterThan(dayOne + 0.5);
  });
});
