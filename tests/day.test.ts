/**
 * One day, in one place — and the screen that was unreachable because it wasn't.
 *
 * `src/lib/day.ts` exists because a day used to advance the game in four
 * places: two React callbacks in `page.tsx`, a memo beside them, and a copy in
 * `src/lib/demo.ts` that `tests/arc.test.ts` walks to prove the game is
 * finishable. That copy was missing `advanceRival`, so for however long, every
 * measurement of the stands stage was taken with the competitor switched off.
 *
 * `scripts/check-one-day.mjs` is what stops a fifth copy appearing. This file
 * holds the behaviour the single copy is supposed to have, and in particular
 * the defect that only became visible once the measurements were honest.
 */
import { describe, expect, it } from 'vitest';
import {
  WEEKLY_EVERY,
  WORDS_PER_DAY,
  WORD_BACKLOG,
  afterDay,
  paramsForDay,
  settleDay,
  wordsForToday,
  type AfterDay,
} from '../src/lib/day';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  RIVAL_APPEARS_ON_DAY,
  act2Progress,
  buyUpgrade,
  openStand,
  standCount,
  toggleStaff,
  type UpgradeId,
} from '../src/lib/business';
import { ACT3_DAYS, beginAct2, beginAct3, createGame, type Game } from '../src/lib/progress';
import { DEFAULT_DAY_PARAMS, ECON, batchPlan, runDay } from '../src/lib/simulation';
import { batchForCapacity, sensiblePrice, throughActOne } from '../src/lib/demo';
import { SHOP, loanQuote } from '../src/lib/retail';

const SEEDS = [2026, 4242, 7, 555, 90210, 31337, 1, 12345, 8080, 999];

/** The kit a child buys once they have understood the stage. */
const KIT: UpgradeId[] = ['freshSqueeze', 'bigSign', 'cooler'];

/**
 * The stands stage, played well, reporting every routing decision it made.
 *
 * Deliberately drives `afterDay` rather than re-deciding anything, because the
 * whole point of extracting it was that the routing could be exercised without
 * playing to the day in question.
 */
function playStands(seed: number): { went: AfterDay[]; days: number; game: Game } {
  let game = beginAct2(throughActOne(seed));
  const went: AfterDay[] = [];
  let days = 0;

  while (days < ACT2_DAYS) {
    for (const id of KIT) {
      if (game.business.upgrades[id]) continue;
      const bought = buyUpgrade(game.stand.cash, game.business, id);
      if (bought.ok) {
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

    const price = sensiblePrice(game);
    const plan = batchPlan(game.stand, batchForCapacity(game));
    const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
    days += 1;
    game = settleDay(game, outcome, {
      ranByManager: game.business.staff.manager,
      stageDay: days,
    }).game;

    /* Exactly what `closeDay` does, including the fork's return path. */
    let where = afterDay(game, days, { forkTaken: false });
    went.push(where);
    if (where === 'weekly-choice') {
      where = afterDay(game, days, { forkTaken: true });
      went.push(where);
    }
    if (where === 'next-act') break;
  }
  return { went, days, game };
}

describe('the reinvest-or-take-it-out fork, which good play could not reach', () => {
  /*
   * The defect, and it is the sharpest example of what the duplicated day loop
   * was hiding.
   *
   * The fork fired on `stageDay % WEEKLY_EVERY === 0` and nowhere else. Nobody
   * thought that was a problem because the stands stage was believed to take
   * eleven days — a figure measured with no competitor in the game. It takes
   * five or six. So the fork, the savings account, and the *entire round* —
   * `ROUND`, `signUpRegulars`, the recurring-revenue word and the twenty tests
   * in `tests/round.test.ts` — were reachable only by playing badly.
   */
  it('is offered to a child who finishes the stands stage quickly', () => {
    for (const seed of SEEDS) {
      const { went, days } = playStands(seed);
      expect(
        days,
        `seed ${seed}: the stage took ${days} days, so the seven-day rhythm would have reached it anyway`,
      ).toBeLessThan(WEEKLY_EVERY);
      expect(
        went,
        `seed ${seed}: finished the stands stage in ${days} days and was never offered the fork`,
      ).toContain('weekly-choice');
    }
  });

  it('offers it once, and then lets the stage end', () => {
    /*
     * The loop this could have become: the fork routes back through `afterDay`,
     * so without `forkTaken` a child would be handed it for ever.
     */
    for (const seed of SEEDS) {
      const { went } = playStands(seed);
      expect(went.filter((w) => w === 'weekly-choice').length, `seed ${seed}`).toBe(1);
      expect(went[went.length - 1], `seed ${seed}: the stage never handed over`).toBe('next-act');
    }
  });

  it('still keeps the seven-day rhythm for a stage that runs long', () => {
    /*
     * The fix adds a trigger, it does not replace one. A careless child who
     * grinds to the cap gets the fork on day seven exactly as before.
     */
    const game = beginAct2(throughActOne(2026));
    expect(afterDay(game, WEEKLY_EVERY, { forkTaken: false })).toBe('weekly-choice');
    expect(afterDay(game, WEEKLY_EVERY - 1, { forkTaken: false })).toBe('plan');
  });

  it('offers it on the shop stage too, which is shorter than a week', () => {
    let game = beginAct3(throughActOne(2026));
    const loan = loanQuote();
    game = {
      ...game,
      business: { ...game.business, loan, shop: { ...game.business.shop, open: true, goodDays: 5 } },
      stand: { ...game.stand, cash: game.stand.cash + loan.principal + SHOP.fitOut },
    };
    // The shop objective is met, so this is the stage's last day.
    expect(afterDay(game, 5, { forkTaken: false })).toBe('weekly-choice');
    expect(afterDay(game, 5, { forkTaken: true })).toBe('next-act');
    expect(ACT3_DAYS).toBeLessThan(WEEKLY_EVERY);
  });
});

describe('settling a day', () => {
  it('advances the competitor, which is the line that went missing', () => {
    /*
     * Pinned by name rather than left to the gate script, because the gate can
     * only see that nobody *else* calls `advanceRival` — not that `settleDay`
     * still does.
     */
    let game = beginAct2(throughActOne(2026));
    expect(game.business.rival.active).toBe(false);

    for (let day = 1; day <= RIVAL_APPEARS_ON_DAY; day += 1) {
      const price = sensiblePrice(game);
      const plan = batchPlan(game.stand, batchForCapacity(game));
      const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
      game = settleDay(game, outcome, { ranByManager: false, stageDay: day }).game;
    }
    expect(game.business.rival.active, 'the rival never opened').toBe(true);
  });

  it('never gives Stage 1 a competitor, whatever the day number', () => {
    /*
     * FRAMEWORK.md §1: Stage 1's demand is "driven only by price + quality ...
     * No weather, competition, location". `advanceRival` carries the guard, and
     * this is the assertion that it is still being handed the act.
     */
    let game = createGame(2026);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day += 1) {
      const plan = batchPlan(game.stand, 28);
      const outcome = runDay(game.stand, { ...plan.order, price: 1.6 }, paramsForDay(game, 1.6));
      game = settleDay(game, outcome, { ranByManager: false, stageDay: day }).game;
      expect(game.business.rival.active, `a rival appeared on Stage 1 day ${day}`).toBe(false);
    }
  });

  it('leaves the Saturday stand out of every counter', () => {
    /*
     * A folding table paid for out of an investment account is not the business
     * the streaks, the loan or the competitor are about.
     */
    const base = beginAct2(throughActOne(2026));
    const weekend: Game = { ...base, weekend: true };
    const price = 1.5;
    const plan = batchPlan(weekend.stand, 24);
    const outcome = runDay(weekend.stand, { ...plan.order, price }, paramsForDay(weekend, price));
    const settled = settleDay(weekend, outcome, { ranByManager: false, stageDay: 9 }).game;

    expect(settled.business).toBe(weekend.business);
    // But the day itself still happened.
    expect(settled.stand.history.length).toBe(weekend.stand.history.length + 1);
    expect(settled.daysTraded).toBe(weekend.daysTraded + 1);
  });
});

describe("today's rules, answered once", () => {
  it('gives Stage 1 the flat parameters its specification asks for', () => {
    const game = createGame(2026);
    const params = paramsForDay(game, 1.6);
    expect(params.demandIntercept).toBe(DEFAULT_DAY_PARAMS.demandIntercept);
    expect(params.marketShare).toBe(1);
    expect(params.lastDay).toBe(ECON.TOTAL_DAYS);
  });

  it('gives the Saturday stand no mercy floor, so it cannot print money', () => {
    /*
     * The floor that stops a nine-year-old going broke on day three would
     * otherwise top up an investment account every Saturday.
     */
    const game: Game = { ...createGame(2026), weekend: true };
    expect(paramsForDay(game, 1.5).cashFloor).toBeNull();
    expect(paramsForDay(createGame(2026), 1.5).cashFloor).toBe(ECON.STARTING_CASH);
  });

  it('carries the business into every stage after the first', () => {
    const game = beginAct2(throughActOne(2026));
    const withKit: Game = {
      ...game,
      business: { ...game.business, upgrades: { ...game.business.upgrades, bigSign: true } },
    };
    expect(paramsForDay(withKit, 1.6).demandIntercept).toBeGreaterThan(
      paramsForDay(game, 1.6).demandIntercept,
    );
    expect(paramsForDay(game, 1.6).lastDay).toBeNull();
  });
});

describe('the word queue catching up', () => {
  it('rations one a day, and doubles only once the queue is backed up', () => {
    expect(wordsForToday(0)).toBe(WORDS_PER_DAY);
    expect(wordsForToday(WORD_BACKLOG - 1)).toBe(WORDS_PER_DAY);
    expect(wordsForToday(WORD_BACKLOG)).toBe(WORDS_PER_DAY + 1);
  });

  it('cannot fire on day one, which is the day the ration exists for', () => {
    /*
     * Three explanations stacked under the first profit and loss a child has
     * ever read is a worksheet, and that is the whole reason for the ration.
     * Day one earns at most three words and hands over one, so the queue
     * reaches two — below the backlog — and the catch-up cannot trigger until
     * a later day has added to it.
     */
    const game = createGame(2026);
    const plan = batchPlan(game.stand, 28);
    const outcome = runDay(game.stand, { ...plan.order, price: 1.6 }, paramsForDay(game, 1.6));
    const settled = settleDay(game, outcome, { ranByManager: false, stageDay: 1 });
    expect(settled.handedOver.length).toBe(WORDS_PER_DAY);
  });

  it('empties a backlog rather than carrying it past the end of the stages', () => {
    /*
     * The failure this was built for. With the stands cap at ten, a run through
     * both stand stages is eighteen days for careful play, and a flat ration
     * stranded `delegation`, `break-even` and `interest` — earned, queued, and
     * never handed over.
     */
    for (const seed of SEEDS) {
      const { game } = playStands(seed);
      expect(
        game.pendingInsights.length,
        `seed ${seed}: ${game.pendingInsights.map((i) => i.id).join(', ')} still queued`,
      ).toBeLessThan(WORD_BACKLOG);
    }
  });
});

describe('the stands stage completes for play that answers the rival', () => {
  it('finishes well inside its cap on every seed', () => {
    /*
     * The headline number, and the one the pilot's "sixteen rounds still felt
     * repetitive" turned out to be about. This stage is finishable in five or
     * six days by a child who works out that being different beats being
     * cheaper. It was being given sixteen.
     */
    for (const seed of SEEDS) {
      const { days, game } = playStands(seed);
      expect(act2Progress(game.business, days).complete, `seed ${seed} timed out`).toBe(true);
      expect(days, `seed ${seed} took ${days} days`).toBeLessThanOrEqual(6);
    }
  });
});
