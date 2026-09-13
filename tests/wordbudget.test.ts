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
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
} from '../src/lib/business';
import { SHOP, loanQuote, shopProgress } from '../src/lib/retail';
import { ACT3_DAYS, beginAct2, beginAct3, createGame, type Game } from '../src/lib/progress';
import { batchPlan, runDay, ECON } from '../src/lib/simulation';
import { GLOSSARY } from '../src/lib/glossary';
import { WORDS_PER_DAY, WORD_BACKLOG, paramsForDay, settleDay, wordsForToday } from '../src/lib/day';

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

/**
 * Three ways a real child plays this stage, and why the middle one exists.
 *
 * `sensible` reads the sky. `clumsy` charges one flat dollar all week whatever
 * the weather and fills the cooler regardless — the single most common thing a
 * real player actually does — and ignores the goal strip, leaving the manager
 * until the cash pile is deep enough that it never happens.
 *
 * `trying` is the child in between, and it is the profile the stage caps are
 * really about. They have not worked out the demand curve — same flat dollar,
 * same over-filled cooler — but they **do what the game tells them**: the goal
 * strip says hire a manager so the stand runs without you, and Pip's
 * `act2-rival` beat and the close screen's question both name the stand across
 * the road, so they buy the thing that answers him.
 *
 * It exists because "is this child trying or not interested" is not something
 * software can know. What software *can* see is whether they acted on what they
 * were told. This profile is that, and the measurement below is the thing worth
 * knowing: a child who responds finishes inside the cap on most seeds while
 * still pricing badly, so the cap sorts the two without anybody having to guess
 * at a child's state of mind.
 */
type Skill = 'sensible' | 'clumsy' | 'trying';

function sensiblePrice(game: Game, skill: Skill = 'sensible'): number {
  // A child who has not worked out the demand curve yet: one flat price, all
  // week, which is the single most common thing a real player actually does.
  if (skill !== 'sensible') return 1;
  if (game.stand.forecast === 'probably-cold') return 2.2;
  if (game.stand.forecast === 'probably-hot') return 1.9;
  return 2;
}

function batchForCapacity(game: Game, skill: Skill = 'sensible'): number {
  const cap = serviceCapacity(game.business);
  // Fills the cooler every day regardless of the sky, so cold days bin lemons.
  if (skill !== 'sensible') return Math.max(8, Math.floor(cap * 0.95));
  const share =
    game.stand.forecast === 'probably-cold'
      ? 0.45
      : game.stand.forecast === 'probably-hot'
        ? 1
        : 0.72;
  return Math.max(8, Math.floor(cap * share));
}

/**
 * One day, through the app's own transition.
 *
 * This used to be a *copy* of `page.tsx`'s day — earn, filter, drain, four
 * counters — written deliberately, with a comment saying it was "copied from
 * `page.tsx` rather than approximated". It was a fifth copy, and like the
 * others it was missing `advanceRival`. So every figure this file has ever
 * reported, including the table in `business.ts` that justifies
 * `ACT2_DAYS = 16`, was measured with the competitor switched off.
 *
 * It now calls `settleDay`, which is the one the app calls. The word queue is
 * read off `Game.pendingInsights` and the handed-over list off the settlement,
 * so the drain this file exists to exercise is the real drain rather than a
 * re-implementation of it.
 */
function playDay(
  game: Game,
  delivered: string[],
  byManager: boolean,
  skill: Skill = 'sensible',
  stageDay = 1,
): { game: Game; delivered: string[] } {
  const price = sensiblePrice(game, skill);
  const cups = batchForCapacity(game, skill);
  const plan = batchPlan(game.stand, cups);
  const result = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));

  const settled = settleDay(game, result, { ranByManager: byManager, stageDay });
  return {
    game: settled.game,
    delivered: [...delivered, ...settled.handedOver.map((insight) => insight.id)],
  };
}

/** The whole ladder up to the market, under a given pair of caps. */
function playArc(act2Cap: number, act3Cap: number, seed = 2026, skill: Skill = 'sensible'): Run {
  let game = createGame(seed);
  let delivered: string[] = [];

  // Act 1: seven days, fixed.
  for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
    ({ game, delivered } = playDay(game, delivered, false, skill, day + 1));
  }
  game = { ...game, stand: { ...game.stand, status: 'playing' } };

  // Act 2: the goal, or the cap.
  game = beginAct2(game);
  let act2Days = 0;
  while (act2Days < act2Cap && !act2Progress(game.business, act2Days).complete) {
    /*
     * The kit, differentiators first.
     *
     * This bought the cooler and nothing else, which is what the goal strip
     * asks for — "now the queue is the problem" — and it was enough while this
     * file measured a day with no competitor in it. It is not enough now:
     * against the rival, cooler-only never completes the stage at **any** cap,
     * including an unbounded one. See PRODUCT.md §75 and `src/lib/day.ts`.
     *
     * A clumsy player still buys them late, because the cash test below is
     * what makes them clumsy.
     */
    for (const id of ['freshSqueeze', 'bigSign', 'cooler'] as const) {
      if (game.business.upgrades[id]) continue;
      const bought = buyUpgrade(game.stand.cash, game.business, id);
      /* A child who acts on what they were told buys the answer to the rival
         as readily as a careful one; a child who is not reading leaves it
         until the cash pile is deep, which against a rival is never. */
      const floor = skill === 'clumsy' && id !== 'cooler' ? 150 : 60;
      if (bought.ok && game.stand.cash > floor) {
        game = { ...game, stand: { ...game.stand, cash: bought.cash }, business: bought.business };
      }
    }
    /*
     * The goal strip says "hire a manager so the first stand runs without
     * you", from the stage's first day. So anybody reading it hires as soon as
     * the wage is in hand, and only the child who is not reading waits until
     * the pile is deep — which, against a rival, means never.
     */
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
    act2Days += 1;
    ({ game, delivered } = playDay(
      game,
      delivered,
      game.business.staff.manager,
      skill,
      act2Days,
    ));
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
    act3Days += 1;
    ({ game, delivered } = playDay(game, delivered, true, skill, act3Days));
  }
  const act3MetGoal = shopProgress(game.business.shop).complete;

  return {
    game,
    delivered,
    /* Earned but still queued when the stand stages ended. */
    pending: game.pendingInsights.map((insight) => insight.id),
    act2Days,
    act3Days,
    act2MetGoal,
    act3MetGoal,
  };
}

describe('the word budget', () => {
  it('hands over one word a day, and catches up when it falls behind', () => {
    /*
     * The ration, and the one thing that relaxes it.
     *
     * One a day is why the number of days in a stage is a ceiling on how many
     * words it can deliver. That ration had no escape valve, and when the
     * stands cap came down from sixteen to ten it started stranding words the
     * child had already earned — `delegation`, `break-even` and `interest`,
     * measured on the default seed. A word earned and withheld is worse than
     * one never earned: the game decided they had demonstrated something and
     * then did not tell them.
     *
     * So the pace doubles while the queue is backed up, and only while it is.
     * Asserted as the rule rather than re-derived, because this file's whole
     * history of wrong numbers came from re-implementing what the app does.
     */
    expect(WORDS_PER_DAY).toBe(1);
    expect(wordsForToday(0)).toBe(1);
    expect(wordsForToday(WORD_BACKLOG - 1)).toBe(1);
    expect(wordsForToday(WORD_BACKLOG)).toBe(2);
    /* Measured against words *already waiting*, so day one — which earns three
       at once and is the day the ration exists for — cannot trigger it. That
       distinction is held in `tests/day.test.ts`, where it was found. */
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
    /*
     * Sensible play, which is the play this property is promised to. See the
     * describe block below for why careless play is held to a different
     * standard.
     */
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
     * The direct answer to "does shortening it compromise the learning".
     *
     * Compared against the caps the project started with — sixteen and twelve
     * — rather than against an absolute number, because the absolute number is
     * a property of the derivers and moves when the copy does.
     *
     * It is not merely no worse. Ten and six with the catch-up drain deliver
     * **more** words than sixteen and twelve did on the ration, in ten fewer
     * days, because the old arc was long enough to earn words it was then too
     * slow to hand over.
     */
    const tightened = playArc(ACT2_DAYS, ACT3_DAYS);
    const roomy = playArc(16, 12);

    expect(tightened.delivered.length).toBeGreaterThanOrEqual(roomy.delivered.length);
    for (const word of roomy.delivered) {
      expect(tightened.delivered, `the shorter arc dropped ${word}`).toContain(word);
    }
    expect(tightened.pending).toEqual([]);
  });
});

/**
 * Ten seeds, because one seed is an anecdote. The weather drives everything
 * downstream of it — profit, the hands-off streak, whether a day counts — so a
 * cap that holds on one week's weather says very little about the next.
 */
const SEEDS = [2026, 4242, 7, 555, 90210, 31337, 1, 12345, 8080, 999];

/**
 * What each kind of play is owed.
 *
 * The pilot said the stands stage "still felt repetitive" at sixteen rounds,
 * and the measurement above says why: **careless play always runs this stage
 * to its clock.** It never completes the objective at any reachable cap — the
 * hands-off streak ticks down on a loss and a careless price loses money about
 * two days in three — so sixteen was not a fallback that only the struggling
 * child spent. It was the number of days a struggling child actually played,
 * every single time.
 *
 * That splits the promise in two, and the split is deliberate:
 *
 *  - **Sensible play is owed every word.** It finishes the stage in five or
 *    six days, so the cap cannot touch it, and the assertions above hold the
 *    whole syllabus for it.
 *  - **Careless play is owed an ending.** A child grinding identical losing
 *    days is not learning `capex-vs-opex` on day fourteen; they are bored, and
 *    the pilot put the game down. So the cap is set for engagement, and the
 *    words it costs are named here rather than hidden.
 *
 * What makes that trade honest rather than convenient is *which* words careless
 * play loses, and why. `capex-vs-opex` needs an upgrade and a wage;
 * `dividends` needs a manager and a profitable day. Both are gated on
 * affording a manager, not on days — so extending the stage does not teach
 * them, it just gives a losing child more losing days in which to maybe scrape
 * the wage together. Measured: careless play loses the same four words at cap
 * ten and at cap sixteen. The six extra days bought nothing.
 */
describe('what each cap owes each kind of player', () => {
  it('lets careful play reach both stage goals, on every seed', () => {
    const missed = SEEDS.filter((seed) => !playArc(ACT2_DAYS, ACT3_DAYS, seed).act2MetGoal);
    expect(missed, `Act 2 goal missed on seeds: ${missed.join(', ')}`).toEqual([]);
    const missed3 = SEEDS.filter((seed) => !playArc(ACT2_DAYS, ACT3_DAYS, seed).act3MetGoal);
    expect(missed3, `Act 3 goal missed on seeds: ${missed3.join(', ')}`).toEqual([]);
  });

  it('gives careful play the whole syllabus, on every seed', () => {
    /*
     * The half of the promise that may never be traded away. If a cap ever
     * costs a child who is playing well a single word, the cap is wrong — not
     * the syllabus.
     */
    for (const seed of SEEDS) {
      const shipped = playArc(ACT2_DAYS, ACT3_DAYS, seed);
      const uncapped = playArc(99, 99, seed);
      const lost = uncapped.delivered.filter((word) => !shipped.delivered.includes(word));
      expect(lost, `seed ${seed}: careful play lost ${lost.join(', ')}`).toEqual([]);
      expect(shipped.pending, `seed ${seed}: words earned and withheld`).toEqual([]);
    }
  });

  it('always ends the stands stage for careless play, rather than stranding it', () => {
    /*
     * The other half. Careless play does not reach the objective — that is the
     * measurement, not a choice — so what it is owed is that the stage ends
     * anyway, at the cap, on every seed.
     */
    for (const seed of SEEDS) {
      const run = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'clumsy');
      expect(run.act2Days, `seed ${seed} ran past the cap`).toBeLessThanOrEqual(ACT2_DAYS);
      expect(
        run.act2MetGoal || run.act2Days === ACT2_DAYS,
        `seed ${seed}: neither finished nor timed out`,
      ).toBe(true);
    }
  });

  it('lets a child who acts on what they were told finish inside the cap', () => {
    /*
     * **The measurement that answers "can the game tell these two apart".**
     *
     * It cannot read intent, and it should not try: any score for "is this
     * child trying" is a guess wearing a number's clothes, and the cost of
     * guessing wrong lands on the child who most needed the help. What it can
     * see is whether they *acted* on what they were shown.
     *
     * So the cap is left to do the sorting, and the thing to check is that it
     * sorts correctly. Measured over ten seeds, for a child still charging one
     * flat dollar all week — no demand curve at all — who simply does what the
     * goal strip and Pip told them:
     *
     * | | finishes the stage | words lost against a sixteen-day cap |
     * |---|---|---|
     * | prices well | 5–6 days, 10/10 | none |
     * | **prices badly, acts on the help** | **7–10 days, 7/10** | 2, on 3 seeds |
     * | ignores both | never | 2–3, on 9 seeds |
     *
     * The middle row is the one that matters. A ten-day cap does not punish
     * the child who is trying and struggling, because acting on the help is
     * enough to get out even with the pricing still wrong. Nobody had to
     * classify anybody.
     */
    const finished = SEEDS.filter(
      (seed) => playArc(ACT2_DAYS, ACT3_DAYS, seed, 'trying').act2MetGoal,
    );
    expect(
      finished.length,
      `only ${finished.length}/10 seeds finished for a child who acted on the help`,
    ).toBeGreaterThanOrEqual(6);

    /* And when the cap does bite, it costs them little. */
    let hurt = 0;
    for (const seed of SEEDS) {
      const shipped = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'trying');
      const roomy = playArc(16, ACT3_DAYS, seed, 'trying');
      const extra = roomy.delivered.filter((word) => !shipped.delivered.includes(word));
      expect(
        extra.length,
        `seed ${seed}: six more days would have taught ${extra.join(', ')}`,
      ).toBeLessThanOrEqual(2);
      if (extra.length > 0) hurt++;
    }
    expect(hurt, `${hurt}/10 seeds lost a word to the cap`).toBeLessThanOrEqual(4);
  });

  it('names exactly what the shorter cap costs a child who is not reading', () => {
    /*
     * The bill, itemised, rather than a claim that there is no bill.
     *
     * Six fewer days do cost the disengaged child two or three words on nine
     * seeds in ten. Every one of them is named here, and the set is closed: if
     * shortening the stage ever starts costing something *else*, this fails and
     * the trade gets argued again instead of assumed.
     *
     * Why the trade is the right way round: `capex-vs-opex` needs an upgrade
     * and a wage, and `dividends` needs a manager and a profitable day. Both
     * are gated on **affording a manager**, not on days. A child pricing below
     * cost against a rival never affords one, so the six extra days do not
     * teach these words — they give a losing child six more losing days in
     * which the weather might do it for them. `spoilage`, `break-even` and
     * `compounding` all turn on trailing averages, which more days of noise can
     * satisfy by luck.
     *
     * Against that: six identical losing days, which is what the pilot
     * actually put the game down over.
     */
    const ALLOWED = ['capex-vs-opex', 'dividends', 'spoilage', 'break-even', 'compounding'];
    let hurt = 0;
    for (const seed of SEEDS) {
      const shipped = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'clumsy');
      const roomy = playArc(16, ACT3_DAYS, seed, 'clumsy');
      const extra = roomy.delivered.filter((word) => !shipped.delivered.includes(word));
      for (const word of extra) {
        expect(ALLOWED, `seed ${seed}: the shorter cap newly costs ${word}`).toContain(word);
      }
      expect(extra.length, `seed ${seed} lost ${extra.length} words`).toBeLessThanOrEqual(3);
      if (extra.length > 0) hurt++;
    }
    /* Recorded, not tightened: nine in ten is the measurement. */
    expect(hurt).toBeLessThanOrEqual(9);

    /* And the shorter cap never teaches *less* to the child who is trying. */
    for (const seed of SEEDS) {
      const trying = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'trying');
      const careless = playArc(ACT2_DAYS, ACT3_DAYS, seed, 'clumsy');
      expect(
        trying.delivered.length,
        `seed ${seed}: acting on the help taught fewer words than ignoring it`,
      ).toBeGreaterThanOrEqual(careless.delivered.length);
    }
  });

  it('keeps both caps one clear day above the slowest run they must carry', () => {
    /*
     * The property behind both numbers, stated once. Not "the cap is ten" —
     * that would fail every time somebody tunes the economy — but "the cap is
     * more than the slowest run that is promised to finish needs".
     *
     * Only sensible play is measured, because only sensible play is *promised*
     * to finish. `clumsy` needs twenty-two to fifty-nine days, so including it
     * would pin the caps to a run nothing guarantees — and `trying` finishes
     * inside the cap on most seeds without being promised anything, which is
     * the measurement in the test below.
     */
    const slowest = (stage: 'act2' | 'act3') =>
      Math.max(
        ...SEEDS.flatMap((seed) =>
          (['sensible'] as const).map((skill) =>
            stage === 'act2'
              ? playArc(99, ACT3_DAYS, seed, skill).act2Days
              : playArc(ACT2_DAYS, 99, seed, skill).act3Days,
          ),
        ),
      );

    expect(ACT2_DAYS, `the slowest run that must finish takes ${slowest('act2')} days`).toBeGreaterThan(
      slowest('act2'),
    );
    expect(ACT3_DAYS, `the slowest run that must finish takes ${slowest('act3')} days`).toBeGreaterThan(
      slowest('act3'),
    );
  });

  it('is shorter than the arc the pilot called repetitive', () => {
    /*
     * The feedback, as an assertion.
     *
     * "Sixteen rounds still felt repetitive." The stand stages ran twenty-eight
     * days for a careless child and every one of the last sixteen was the same
     * losing day. Whatever else changes, that total may not go back up.
     */
    const days = (a2: number, a3: number, skill: Skill) =>
      SEEDS.map((seed) => {
        const run = playArc(a2, a3, seed, skill);
        return ECON.TOTAL_DAYS + run.act2Days + run.act3Days;
      });

    const now = Math.max(...days(ACT2_DAYS, ACT3_DAYS, 'clumsy'));
    const before = Math.max(...days(16, 6, 'clumsy'));
    expect(now, `the stand stages now run to ${now} days, up from ${before}`).toBeLessThan(before);

    // And careful play, which is the run the teaching claim rests on.
    const careful = Math.max(...days(ACT2_DAYS, ACT3_DAYS, 'sensible'));
    expect(careful, `careful play now takes ${careful} days`).toBeLessThanOrEqual(20);
  });
});
