/**
 * Do the stage caps leave room for the words?
 *
 * §50 tightened Act 2 from sixteen days to thirteen and Act 3 from twelve to
 * eight, on the argument that a cap is the fallback for a child who has *not*
 * met the goal and every spare day in it is spent only by whoever is already
 * struggling. That argument is about pacing. It says nothing about learning,
 * and there is a mechanism that makes the two inseparable:
 *
 * **`WORDS_PER_DAY` is 1.** A day hands over exactly one word and queues the
 * rest in `Game.pendingInsights`. So the number of days in a stage is a hard
 * ceiling on how many words that stage can deliver, and shortening a stage is
 * arithmetic on the syllabus whether or not anybody meant it to be.
 *
 * The sums are tight enough to be worth checking rather than asserting. Act 1
 * is seven days and has ten words of its own, so it *starts* the game three
 * words in debt; Act 2 owns ten more. A cap that looks generous against its
 * own act can still starve the queue it inherited.
 *
 * So this plays the arc with the real derivers and the real one-a-day drain,
 * and asks the only question that matters: does every word a child earns
 * actually reach them before the stand stages end?
 */
import { describe, expect, it } from 'vitest';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  act2Progress,
  buyUpgrade,
  deriveAct2Insights,
  deriveAct3Insights,
  deriveDayParams,
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
  updateHandsOff,
  updateTwoStandDays,
} from '../src/lib/business';
import { SHOP, loanQuote, repayLoan, shopProgress, updateShopDays } from '../src/lib/retail';
import { ACT3_DAYS, beginAct2, beginAct3, createGame, type Game } from '../src/lib/progress';
import { batchPlan, deriveInsights, runDay, ECON } from '../src/lib/simulation';
import { GLOSSARY, recurringRevenueInsight, unrecorded } from '../src/lib/glossary';

/** What `page.tsx` hands over per day. Mirrored, and asserted below. */
const WORDS_PER_DAY = 1;

interface Run {
  game: Game;
  /** Words actually handed to the child, in order. */
  delivered: string[];
  /** Words earned but still waiting when the stand stages ended. */
  pending: string[];
  act2Days: number;
  act3Days: number;
  act2MetGoal: boolean;
  act3MetGoal: boolean;
}

type Skill = 'sensible' | 'clumsy';

function sensiblePrice(game: Game, skill: Skill = 'sensible'): number {
  // A child who has not worked out the demand curve yet: one flat price, all
  // week, which is the single most common thing a real player actually does.
  if (skill === 'clumsy') return 1;
  if (game.stand.forecast === 'probably-cold') return 2.2;
  if (game.stand.forecast === 'probably-hot') return 1.9;
  return 2;
}

function batchForCapacity(game: Game, skill: Skill = 'sensible'): number {
  const cap = serviceCapacity(game.business);
  // Fills the cooler every day regardless of the sky, so cold days bin lemons.
  if (skill === 'clumsy') return Math.max(8, Math.floor(cap * 0.95));
  const share =
    game.stand.forecast === 'probably-cold'
      ? 0.45
      : game.stand.forecast === 'probably-hot'
        ? 1
        : 0.72;
  return Math.max(8, Math.floor(cap * share));
}

/**
 * One day, including the word drain, exactly as `openStand` does it.
 *
 * The drain is the part this file exists to exercise, so it is copied from
 * `page.tsx` rather than approximated: earn, filter against both what is
 * learned and what is already queued, put the queue in front of the new
 * arrivals, hand over `WORDS_PER_DAY`, keep the rest.
 */
function playDay(
  game: Game,
  pending: string[],
  delivered: string[],
  byManager: boolean,
  skill: Skill = 'sensible',
): { game: Game; pending: string[]; delivered: string[] } {
  const price = sensiblePrice(game, skill);
  const cups = batchForCapacity(game, skill);
  const params = deriveDayParams(game.business, price);
  const plan = batchPlan(game.stand, cups);
  const result = runDay(game.stand, { ...plan.order, price }, { ...params, lastDay: null });

  const act1 = deriveInsights(result, result.nextState.history);
  const act2 = game.act >= 2 ? deriveAct2Insights(result, game.business, result.nextState.history) : [];
  const act3 = game.act >= 3 ? deriveAct3Insights(result, game.business) : [];
  const round =
    result.subscriberCups > 0
      ? [recurringRevenueInsight(result.subscriberCups, result.subscriberPrice, result.weather)]
      : [];

  const earned = unrecorded([...act1, ...act2, ...act3, ...round], [...game.learned, ...pending]);
  const queue = [...pending, ...earned.map((insight) => insight.id)];
  const today = queue.slice(0, WORDS_PER_DAY);
  const waiting = queue.slice(WORDS_PER_DAY);

  return {
    game: {
      ...game,
      stand: result.nextState,
      learned: [...game.learned, ...today],
      business: {
        ...updateHandsOff(game.business, byManager, result.profit),
        twoStandDays: updateTwoStandDays(game.business, result.profit).twoStandDays,
        shop: updateShopDays(game.business.shop, result.profit),
        loan: repayLoan(game.business.loan),
      },
    },
    pending: waiting,
    delivered: [...delivered, ...today],
  };
}

/** The whole ladder up to the market, under a given pair of caps. */
function playArc(act2Cap: number, act3Cap: number, seed = 2026, skill: Skill = 'sensible'): Run {
  let game = createGame(seed);
  let pending: string[] = [];
  let delivered: string[] = [];

  // Act 1: seven days, fixed.
  for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
    ({ game, pending, delivered } = playDay(game, pending, delivered, false, skill));
  }
  game = { ...game, stand: { ...game.stand, status: 'playing' } };

  // Act 2: the goal, or the cap.
  game = beginAct2(game);
  let act2Days = 0;
  while (act2Days < act2Cap && !act2Progress(game.business, act2Days).complete) {
    if (!game.business.upgrades.cooler && game.stand.cash > 80) {
      const bought = buyUpgrade(game.stand.cash, game.business, 'cooler');
      if (bought.ok) {
        game = { ...game, stand: { ...game.stand, cash: bought.cash }, business: bought.business };
      }
    }
    if (!game.business.staff.manager && game.stand.cash > (skill === 'clumsy' ? 300 : 120)) {
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
    ({ game, pending, delivered } = playDay(
      game,
      pending,
      delivered,
      game.business.staff.manager,
      skill,
    ));
    act2Days += 1;
  }
  const act2MetGoal = act2Progress(game.business, act2Days).complete;

  // Act 3: the shop, on a loan.
  game = beginAct3(game);
  const loan = loanQuote();
  game = {
    ...game,
    business: { ...game.business, loan },
    stand: { ...game.stand, cash: game.stand.cash + loan.principal },
  };
  let act3Days = 0;
  while (act3Days < act3Cap && !shopProgress(game.business.shop).complete) {
    if (!game.business.shop.open && game.stand.cash >= SHOP.fitOut) {
      game = {
        ...game,
        stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut },
        business: { ...game.business, shop: { ...game.business.shop, open: true } },
      };
    }
    ({ game, pending, delivered } = playDay(game, pending, delivered, true, skill));
    act3Days += 1;
  }
  const act3MetGoal = shopProgress(game.business.shop).complete;

  return { game, delivered, pending, act2Days, act3Days, act2MetGoal, act3MetGoal };
}

describe('the word budget', () => {
  it('hands over one word a day, which is what makes days a syllabus', () => {
    expect(WORDS_PER_DAY).toBe(1);
  });

  it('has more words than a single run has days, by design', () => {
    /*
     * Recorded rather than fixed. Thirty-four words against roughly thirty
     * days means no single run delivers the whole glossary — which is the
     * point of a career that survives a replay, and the reason the trophy case
     * and the words tab are per-career rather than per-run.
     *
     * It is also why the caps matter: with a queue that already cannot be
     * emptied, every day removed is a word deferred to a run that may never
     * happen.
     */
    expect(GLOSSARY.length).toBeGreaterThan(30);
  });

  it('delivers every word it earns, under the current caps', () => {
    const run = playArc(ACT2_DAYS, ACT3_DAYS);

    /*
     * The assertion that makes the tightening safe. A word that is earned but
     * never handed over is worse than one never earned: the game decided the
     * child had done the thing, ticked it off `learned`, and then said nothing.
     */
    expect(
      run.pending,
      `words earned but never handed over: ${run.pending.join(', ')}`,
    ).toEqual([]);
  });

  it('still reaches both stage goals under the current caps', () => {
    const run = playArc(ACT2_DAYS, ACT3_DAYS);
    expect(run.act2MetGoal, `Act 2 timed out after ${run.act2Days} days`).toBe(true);
    expect(run.act3MetGoal, `Act 3 timed out after ${run.act3Days} days`).toBe(true);
  });

  it('delivers no fewer words than the old, longer caps did', () => {
    /*
     * The direct answer to "does tightening compromise the learning".
     *
     * Compared against the caps this replaced — sixteen and twelve — rather
     * than against an absolute number, because the absolute number is a
     * property of the derivers and moves when the copy does.
     */
    const tightened = playArc(ACT2_DAYS, ACT3_DAYS);
    const roomy = playArc(16, 12);

    expect(tightened.delivered.length).toBeGreaterThanOrEqual(roomy.delivered.length);
    expect(new Set(tightened.delivered)).toEqual(new Set(roomy.delivered));
  });
});

/**
 * Ten seeds, because one seed is an anecdote. The weather drives everything
 * downstream of it — profit, the hands-off streak, whether a day counts — so a
 * cap that holds on one week's weather says very little about the next.
 */
const SEEDS = [2026, 4242, 7, 555, 90210, 31337, 1, 12345, 8080, 999];

describe('how tight the caps can go', () => {
  it('keeps the stands goal reachable for careful play, on every seed', () => {
    const missed = SEEDS.filter((seed) => !playArc(ACT2_DAYS, ACT3_DAYS, seed).act2MetGoal);
    expect(missed, `Act 2 goal missed on seeds: ${missed.join(', ')}`).toEqual([]);
  });

  it('keeps the shop goal reachable for careless play too, on every seed', () => {
    /*
     * Stronger than the stands assertion on purpose, because the measurement
     * says it can be: the shop objective completes on day five whether the kid
     * plays well or badly, so its cap owes careless play the same guarantee.
     */
    const missed = SEEDS.filter(
      (seed) => !playArc(ACT2_DAYS, ACT3_DAYS, seed, 'clumsy').act3MetGoal,
    );
    expect(missed, `Act 3 goal missed on seeds: ${missed.join(', ')}`).toEqual([]);
  });

  it('leaves the shop cap a day of margin over the worst run it has to survive', () => {
    /*
     * The property behind `ACT3_DAYS = 6`. Not "the cap is six" — that would
     * fail every time somebody tunes the shop — but "the cap is more than the
     * slowest run needs". If a change to the shop's economics ever makes a good
     * day harder, this fails and the cap gets looked at again instead of
     * quietly starting to time children out.
     */
    const worst = Math.max(
      ...SEEDS.flatMap((seed) =>
        (['sensible', 'clumsy'] as const).map(
          (skill) => playArc(ACT2_DAYS, 99, seed, skill).act3Days,
        ),
      ),
    );
    expect(worst).toBeLessThan(ACT3_DAYS);
  });

  it('does not cut the stands cap to its floor, and says why', () => {
    /*
     * The asymmetry this file exists to record.
     *
     * Careful play finishes the stands stage by day eleven, so eleven is the
     * arithmetic floor and every cap above it looks like slack. It is not
     * slack: the cost of taking it lands on the child who plays badly, and the
     * word it takes from them is `delegation` — the one the stage exists to
     * teach.
     */
    const worstCareful = Math.max(
      ...SEEDS.map((seed) => playArc(99, ACT3_DAYS, seed).act2Days),
    );
    expect(worstCareful).toBe(11);
    expect(ACT2_DAYS).toBeGreaterThan(worstCareful);
  });

  it('names the word that stops the stands stage being shortened', () => {
    /*
     * Kept as an assertion rather than a note, because it is the whole reason
     * `ACT2_DAYS` is sixteen, and a future tuning pass will otherwise look at
     * a cap five days past the floor and reasonably assume it is waste.
     *
     * If this ever stops failing — if a shorter stage stops costing anybody
     * `delegation` — then the cap genuinely can come down, and this test is
     * how somebody finds that out.
     */
    const lostAt = (cap: number) => {
      const missing = new Set<string>();
      for (const seed of SEEDS) {
        const shipped = playArc(cap, ACT3_DAYS, seed, 'clumsy');
        const roomy = playArc(ACT2_DAYS, 12, seed, 'clumsy');
        roomy.delivered
          .filter((word) => !shipped.delivered.includes(word))
          .forEach((word) => missing.add(word));
      }
      return missing;
    };

    expect([...lostAt(ACT2_DAYS)]).toEqual([]);
    expect([...lostAt(13)]).toContain('delegation');
    expect([...lostAt(11)]).toContain('delegation');
  });

  it('costs careless play nothing at all, as shipped', () => {
    /*
     * The direct answer to "does tightening compromise the learning", and the
     * assertion that decided where the caps landed.
     *
     * Measured against careless play rather than careful, because careful play
     * finishes both stages long before either cap and cannot notice a change to
     * them. If a cap costs anybody a word, it costs it here — which is exactly
     * how the `delegation` problem was found, as a failure of this test at
     * `ACT2_DAYS = 13`.
     *
     * Compared against the caps the project started with, sixteen and twelve.
     * Every word, on every seed, identical: the shop's six days are genuinely
     * spare and the stands' sixteen are genuinely not.
     */
    for (const seed of SEEDS) {
      const shipped = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'clumsy');
      const original = playArc(16, 12, seed, 'clumsy');
      expect(
        shipped.delivered,
        `seed ${seed}: the shipped caps lost ${original.delivered.filter((w) => !shipped.delivered.includes(w)).join(', ')}`,
      ).toEqual(original.delivered);
      expect(shipped.pending).toEqual([]);
    }
  });
});


