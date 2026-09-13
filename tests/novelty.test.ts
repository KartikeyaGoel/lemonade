/**
 * How many days in a row offer a child nothing they have not already seen.
 *
 * ## Why this file exists
 *
 * PRODUCT.md §78 ends with the hole no gate could close:
 *
 * > **Nothing here measures whether it is any good.** Every gate in the table
 * > above would have passed on the version five children put down inside five
 * > minutes.
 *
 * That is still true and this file does not claim otherwise. Whether a
 * nine-year-old enjoys an afternoon of this is not decidable from source.
 *
 * But the pilot's complaint was narrower than "is it any good", and it was said
 * twice: *"16 rounds still felt repetitive"*. Repetitive is not a feeling about
 * taste, it is a **property of what the days offered** — and nothing measured
 * it. The response was to shorten the stage, and the only assertion that came
 * out of it was about *length*: `tests/wordbudget.test.ts` holds the day count
 * below what it was. A build could keep that number and make every single day
 * identical, and every gate in the project would stay green.
 *
 * So: a day is **new** if it hands over a word, or offers a goal the child has
 * not been set before, or puts a decision on the yard they could not make
 * before, or asks them something at lunchtime they have not been asked, or
 * explains the day with a cause they have not been given, or brings the
 * competitor somewhere new. Everything in that list is something the game
 * *put in front of them*; none of it is about whether they did well.
 *
 * ## What it measured, including about the version the pilot played
 *
 * Five seeds, two profiles — a child who reads the sky and follows the strip,
 * and a child who charges a flat dollar all week and ignores it. `ACT2_DAYS`
 * was set back to 16 to measure the build the feedback was about:
 *
 * | | stand-stage days | days that offered something new | longest run of days that offered nothing |
 * |---|---|---|---|
 * | careless, `ACT2_DAYS = 16` | 23 | 9-10 | **6-12** |
 * | careless, as shipped (12) | 19 | 9-10 | **5-8** |
 * | careful, either cap | 11-17 | 11-15 | **0-2** |
 *
 * Read the middle column twice. **The number of days that offered a careless
 * child something new did not change** — 9 or 10, at either cap. Every one of
 * the four days the cut removed was a day with nothing in it. That is the
 * clearest evidence in the project that the shortening was the right change
 * rather than a smaller number, and it was not available until something
 * counted this.
 *
 * And the tiered promise shows up in the last column without being designed
 * for: careful play almost never sees two dead days running, careless play sees
 * a week of them. That is the cap doing the sorting, which is what it is for.
 */
import { describe, expect, it } from 'vitest';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  act2Progress,
  buyUpgrade,
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
} from '../src/lib/business';
import { SHOP, loanQuote } from '../src/lib/retail';
import {
  act1Complete,
  act1Progress,
  act2Complete,
  beginAct2,
  createGame,
  type Game,
} from '../src/lib/progress';
import { ECON, batchPlan, runDay, type DayOutcome } from '../src/lib/simulation';
import { paramsForDay, settleDay } from '../src/lib/day';
import { plots } from '../src/lib/yard';
import { middayCall } from '../src/lib/midday';
import { diagnose } from '../src/lib/diagnose';
import { sensiblePrice } from '../src/lib/demo';

const SEEDS = [2026, 4242, 7, 555, 90210];

/**
 * Two profiles, the same two `tests/wordbudget.test.ts` uses.
 *
 * `careless` is not a strawman: a flat dollar whatever the sky, a fixed batch,
 * and the goal strip ignored is the single most common thing a real child
 * actually does.
 */
type Profile = 'careful' | 'careless';

const priceFor = (game: Game, profile: Profile) => {
  /*
   * Through `demo.ts`'s policy rather than a second copy of one.
   *
   * The first version of this read `game.stand.today?.weather`, which is not a
   * field — so it silently took the fallback every day and the careful profile
   * was not reading the sky at all. `tsc` caught it; the tests had passed.
   * One implementation of "what a sensible child charges", in the module the
   * arc tests already read it from.
   */
  return profile === 'careless' ? 1 : sensiblePrice(game);
};

const batchFor = (game: Game, profile: Profile) =>
  profile === 'careless' ? 24 : Math.max(20, Math.round(serviceCapacity(game.business) * 0.9));

/**
 * Everything today put in front of the child, as a set of marks.
 *
 * Deliberately about *offers* rather than outcomes. A day that went badly is
 * not a repeat — losing money on a cold day after winning on a hot one is the
 * lesson. A day that asks the same question, sets the same goal and sells the
 * same things is the repeat, whatever the profit came to.
 */
function whatTodayOffered(
  game: Game,
  outcome: DayOutcome,
  yesterday: Game,
  stageDay: number,
): string[] {
  const marks: string[] = [];
  marks.push(
    `goal:${game.act === 1 ? act1Progress(game.stand).goal : act2Progress(game.business, stageDay).nextStep}`,
  );
  for (const plot of plots(game.business, game.stand.cash)) {
    if (plot.affordable) marks.push(`offer:${plot.id}`);
  }
  const call = middayCall(outcome);
  if (call) marks.push(`midday:${call.lean}`);
  const found = diagnose(outcome, yesterday.stand.history);
  if (found) marks.push(`why:${found.answers.map((answer) => answer.cause).join(',')}`);
  if (game.business.rival.active) marks.push(`rival:${game.business.rival.location}`);
  return marks;
}

interface Walk {
  /** One entry a day: did it offer anything not already seen? */
  novelty: boolean[];
  /** The longest run of days that offered nothing new. */
  deadest: number;
  days: number;
  fresh: number;
}

function walk(profile: Profile, seed: number): Walk {
  let game = createGame(seed);
  const seen = new Set<string>();
  const novelty: boolean[] = [];
  let handedOver = 0;

  const oneDay = (stageDay: number) => {
    const yesterday = game;
    const price = priceFor(game, profile);
    const plan = batchPlan(game.stand, batchFor(game, profile));
    const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
    game = settleDay(game, outcome, {
      ranByManager: game.business.staff.manager,
      stageDay,
    }).game;

    let anythingNew = game.learned.length > handedOver;
    handedOver = game.learned.length;
    for (const mark of whatTodayOffered(game, outcome, yesterday, stageDay)) {
      if (!seen.has(mark)) {
        anythingNew = true;
        seen.add(mark);
      }
    }
    novelty.push(anythingNew);
  };

  let a1 = 0;
  while (a1 < ECON.TOTAL_DAYS && !act1Complete(game.stand)) {
    a1 += 1;
    oneDay(a1);
  }
  game = { ...game, stand: { ...game.stand, status: 'playing' } };
  game = beginAct2(game);

  let a2 = 0;
  while (a2 < ACT2_DAYS && !act2Complete(game.business, a2)) {
    if (profile === 'careful') followTheStrip();
    a2 += 1;
    oneDay(a2);
  }

  function followTheStrip() {
    for (const id of ['freshSqueeze', 'bigSign', 'cooler'] as const) {
      if (game.business.upgrades[id]) continue;
      const bought = buyUpgrade(game.stand.cash, game.business, id);
      if (bought.ok && game.stand.cash > 60) {
        game = { ...game, stand: { ...game.stand, cash: bought.cash }, business: bought.business };
      }
    }
    if (!game.business.staff.manager && game.stand.cash > 120) {
      game = { ...game, business: toggleStaff(game.business, 'manager') };
    }
    if (
      game.business.staff.manager &&
      game.business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED &&
      standCount(game.business) < 2
    ) {
      const opened = openStand(game.business, 'park', game.stand.cash);
      if (opened.opened) {
        game = { ...game, stand: { ...game.stand, cash: opened.cash }, business: opened.business };
      }
    }
    if (standCount(game.business) >= 2 && !game.business.shop.open) {
      if (!game.business.loan) {
        const loan = loanQuote();
        game = {
          ...game,
          business: { ...game.business, loan },
          stand: { ...game.stand, cash: game.stand.cash + loan.principal },
        };
      }
      if (game.stand.cash >= SHOP.fitOut) {
        game = {
          ...game,
          stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut },
          business: { ...game.business, shop: { ...game.business.shop, open: true } },
        };
      }
    }
  }

  let deadest = 0;
  let run = 0;
  for (const wasNew of novelty) {
    if (wasNew) run = 0;
    else {
      run += 1;
      deadest = Math.max(deadest, run);
    }
  }
  return { novelty, deadest, days: novelty.length, fresh: novelty.filter(Boolean).length };
}

const CAREFUL = SEEDS.map((seed) => walk('careful', seed));
const CARELESS = SEEDS.map((seed) => walk('careless', seed));
const worst = (runs: Walk[], pick: (w: Walk) => number) => Math.max(...runs.map(pick));

describe('how repetitive the stand stages are, for a child who plays them well', () => {
  it('almost never gives them two days running with nothing new in them', () => {
    /*
     * Measured: 0 to 2 across five seeds, at either cap — a careful child
     * finishes on the rungs rather than on the clock, so the cap never touches
     * them. Bounded at 4 because the figure moves with the weather and because
     * a child who has bought everything is *meant* to have a quiet day before
     * the next rung.
     */
    const dead = worst(CAREFUL, (w) => w.deadest);
    expect(dead, `careful play sat through ${dead} days in a row with nothing new`).toBeLessThanOrEqual(4);
  });

  it('offers something new on the large majority of their days', () => {
    /* Measured: 15/17, 15/16, 11/11, 13/13, 14/15 — better than three in four
       on every seed, and every day on two of them. */
    for (const run of CAREFUL) {
      expect(
        run.fresh / run.days,
        `${run.fresh} of ${run.days} days offered something new`,
      ).toBeGreaterThan(0.75);
    }
  });
});

describe('and for a child who is not really playing', () => {
  it('never sits them in front of a week and a half of the same day', () => {
    /*
     * Measured: 5 to 8, against 6 to 12 at `ACT2_DAYS = 16` — the build a child
     * called repetitive. Bounded at 9, which is the assertion that stops the
     * cap creeping back up: raising `ACT2_DAYS` to 16 puts two of the five
     * seeds at 12 and fails this.
     *
     * Not bounded at the careful figure, deliberately. The promise is tiered —
     * careless play is optimised for engagement and the cap does the sorting —
     * and a child charging a flat dollar in the rain is *going* to have days
     * that look the same, because they are making the same decision. Demanding
     * novelty they did not ask for would mean manufacturing it.
     */
    const dead = worst(CARELESS, (w) => w.deadest);
    expect(dead, `careless play sat through ${dead} days in a row with nothing new`).toBeLessThanOrEqual(9);
  });

  it('still gets a real share of days with something in them', () => {
    /*
     * Measured: 9 or 10 of 19 — about half. Low, and correctly so: most of what
     * this game offers is a response to a decision, and a child making the same
     * decision every day gets the same response. What matters is that the floor
     * is not near zero, because a stage that offers a disengaged child *nothing*
     * for a fortnight is the stage the pilot put down.
     */
    for (const run of CARELESS) {
      expect(run.fresh, `only ${run.fresh} of ${run.days} days offered anything`).toBeGreaterThan(6);
    }
  });

  it('gives the careful child the less repetitive time of the two', () => {
    /*
     * The tiered promise, as an ordering rather than as two numbers — which is
     * the form that survives the figures drifting. If this ever inverts, the
     * game has started rewarding the child who is not paying attention.
     */
    expect(worst(CAREFUL, (w) => w.deadest)).toBeLessThan(worst(CARELESS, (w) => w.deadest));
  });
});

describe('what this does and does not say', () => {
  it('counts what the game offered, not whether the child did well', () => {
    /*
     * The distinction the metric rests on, asserted so it cannot quietly erode
     * into "a day they made money on".
     *
     * A careless child loses money on most days and their profit is nearly
     * constant; if novelty tracked outcomes, every one of those would count as
     * a repeat and the measure would be about failure rather than about
     * repetition. So: the marks are goals, offers, questions and explanations,
     * and a day can be new while going badly.
     */
    const run = CARELESS[0];
    expect(run.novelty.filter(Boolean).length).toBeGreaterThan(0);
    /* Day one is always new — there is nothing to have seen before. */
    expect(run.novelty[0]).toBe(true);
    /* And the last day of a careless run is not, because by then there is
       nothing left the child has not been offered and turned down. */
    expect(run.novelty.at(-1)).toBe(false);
  });
});
