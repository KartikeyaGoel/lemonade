/**
 * A save that starts part-way through, for showing the game to somebody.
 *
 * The ask was "is there a way to shortcut to level 2", level 2 being the
 * market, and the suggestion was to unlock the stages for a demo. Unlocking is
 * the wrong lever, for a reason worth writing down.
 *
 * **Nothing that stops you reaching the market is an unlock.** `unlocks.ts`
 * gates the meta-game — the trophy case, the club, the playbook — and none of
 * those are in the way. What is in the way is `readiness`: four criteria, each
 * read off state that only playing produces, and the last of them is the one
 * that gates *committing money*. Turn every unlock on and the market screen
 * opens with a $0 account and a Buy button that refuses, because
 * `beginAct5` seeds the account from `seededWith` — the buyout or the float —
 * and both are zero on a fresh save. The demo would show a locked, empty
 * market. That is a worse outcome than the gates.
 *
 * So this does not unlock anything. It **plays the game forward** and hands
 * back the save a child would have had, using the same functions the app uses:
 * `runDay` for every day, `openStand` and `buyUpgrade` for the business,
 * `recordDealChoice` and `acceptBuyout` for the sale, `beginAct2`..`beginAct5`
 * for the transitions. No gate is touched, no flag is forced, and no figure is
 * invented — which is what keeps PRODUCT.md §4 true, because the cash on screen
 * is the cash those days actually made. A demo that shows £900 next to a week
 * that earned £207 is a demo somebody will ask about.
 *
 * It is also why the badges are not in here. `page.tsx` already derives them
 * from `earnedBadges(badgeContext(...))` whenever the game settles, so a jumped
 * save earns exactly the badges its own history deserves. Handing out trophies
 * would break §16, and it is not necessary.
 *
 * The playthrough policy below is the one `tests/arc.test.ts` walks to prove
 * the game is finishable, and that file imports it from here rather than
 * keeping a second copy — so the demo save cannot rot without the arc test
 * going red.
 *
 * **This is a demo affordance.** Like `ResetButton`, it should come out before
 * real families have the app: a child two taps from replacing their own week is
 * not a thing to ship. See PRODUCT.md §61.
 *
 * Pure module. No React, no I/O.
 */

import {
  ACT_TITLES,
  beginAct2,
  beginAct3,
  beginAct4,
  beginAct5,
  createGame,
  ACT3_DAYS,
  type Act,
  type Game,
} from './progress';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  UPGRADES,
  act2Progress,
  buyUpgrade,
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
  type UpgradeId,
} from './business';
import { SHOP, loanQuote, shopProgress } from './retail';
import { acceptBuyout, bestDeal, buyoutOffer, recordDealChoice } from './ownership';
import { ECON, batchPlan, runDay } from './simulation';
import { paramsForDay, settleDay } from './day';

/**
 * A price that clears the day's costs.
 *
 * Charging $1.60 loses money on a cold day once a manager is on $20, which is
 * the actual Act 2 lesson rather than a bug — so the policy reads the sky.
 */
export function sensiblePrice(game: Game): number {
  if (game.stand.forecast === 'probably-cold') return 2.2;
  if (game.stand.forecast === 'probably-hot') return 1.9;
  return 2;
}

/**
 * A batch sized to the business rather than to one table.
 *
 * A fixed 24-cup batch turns a 114-cup crowd at three pitches and a shop into a
 * sold-out morning and a loss against $145 of rent and wages. Sizing off
 * capacity is what a player does once the business is bigger than their hands.
 */
export function batchForCapacity(game: Game): number {
  const cap = serviceCapacity(game.business);
  const share =
    game.stand.forecast === 'probably-cold'
      ? 0.45
      : game.stand.forecast === 'probably-hot'
        ? 1
        : 0.72;
  return Math.max(8, Math.floor(cap * share));
}

/**
 * One day, through the same function the app uses.
 *
 * This used to be a second implementation of playing a day — the hands-off
 * streak, the two-stand streak, the shop's good days, a day off the loan, the
 * lifetime count — written to "deliberately mirror `closeDay` in
 * `src/app/page.tsx`". It did not mirror it. `closeDay` advanced the rival and
 * this did not, so `tests/arc.test.ts` proved the game finishable with the
 * competitor switched off, and the measurement that set `ACT2_DAYS = 16` was
 * taken in the same absent-competitor world. See `src/lib/day.ts` for the
 * numbers and for why there is now one function instead of two.
 *
 * The only thing this adds on top is that it drains the word queue. A child is
 * rationed to one insight a day by `WORDS_PER_DAY`; a demo save stands in for
 * somebody who *played* those days and was handed them one at a time, so it
 * arrives having been told the same set rather than a seventh of it. That is
 * what `readiness` reads for its margin criterion, and rationing it here would
 * hand somebody a market they cannot buy in.
 */
export function playDay(
  game: Game,
  price: number,
  cups: number,
  byManager = false,
  /**
   * Which day of the current stage this is, counting today.
   *
   * Defaults to the lifetime day count, which is what every caller meant by
   * "today" before the rival — which reads it — was wired in here.
   */
  stageDay = game.daysTraded + 1,
): Game {
  const plan = batchPlan(game.stand, cups);
  const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));

  const { game: settled } = settleDay(game, outcome, { ranByManager: byManager, stageDay });
  return {
    ...settled,
    learned: [
      ...new Set([...settled.learned, ...settled.pendingInsights.map((insight) => insight.id)]),
    ],
    pendingInsights: [],
  };
}

/**
 * Act 1, played sensibly, which is where every later stage starts from.
 *
 * $1.40 and a 36-cup batch rather than a thriftier pair, because the margin
 * insight only lands on a day that sells thirty cups or on a day that sold more
 * and earned less — and `readiness` will not let anybody trade in the market
 * without it. A cheaper week reaches Act 5 and then refuses to buy anything,
 * which is the exact failure this module exists to avoid.
 */
export function throughActOne(seed = 2026, price = 1.4, cups = 36): Game {
  let game = createGame(seed);
  /*
   * Through `playDay`, which is through `settleDay`.
   *
   * This had its own day loop — `runDay` plus `deriveInsights` and three
   * fields — which is a fourth implementation of a day and was missing the
   * counters, the competitor and the word queue. It got away with it because
   * Stage 1 has none of those. `paramsForDay` reads the act, so Stage 1 still
   * runs on the flat `DEFAULT_DAY_PARAMS` the specification asks for.
   */
  for (let day = 0; day < ECON.TOTAL_DAYS; day += 1) {
    game = playDay(game, price, cups, false, day + 1);
  }
  return { ...game, stand: { ...game.stand, status: 'playing' } };
}

/**
 * The stands stage, played the way the goal strip asks.
 *
 * Buy the kit, hire a manager once there is a wage in hand, wait for the
 * hands-off days, then open at the park. Returns how many days it took as well,
 * because "before the fallback fires" is the assertion that matters.
 *
 * ## Why it buys three things and not one
 *
 * It bought the cooler alone, which is enough to serve the queue and is the
 * whole of what the stage's first wall asks for. That was a competent-looking
 * policy right up until `playDay` started advancing the rival, at which point
 * it stopped finishing the stage at all.
 *
 * Measured over ten seeds, with the rival live, holding everything else in
 * this file fixed:
 *
 * | what it buys | finishes | days | cash over the stage |
 * |---|---|---|---|
 * | cooler only | 3/10 | 13.9 | **−$56** |
 * | cooler + sign + fresh-squeezed | **10/10** | **5.1** | **+$192** |
 *
 * Fifty-five dollars, and the stage goes from not-finishable inside its clock
 * to finished in five days with every single day profitable. That is not a
 * tuning artefact — it is `business.ts`'s own stated design working as
 * written: *"a kid who tries to win on price alone ends up destroying their
 * own margin to beat someone who cannot go any lower. The way out is to be
 * different, not cheaper."* `freshSqueeze` swaps `ECON.DEMAND_SLOPE` for
 * `QUALITY_SLOPE` so the queue stops caring so much what the sign says, and
 * `bigSign` adds intercept. Both feed `standAppeal`, which is what decides the
 * split against the rival.
 *
 * So this is the policy a child who has understood the stage would play, and
 * it is what the arc test should be walking. The order matters: the two
 * differentiators come first, because they are what make the days profitable
 * enough to afford the rest.
 */
export function throughStands(start: Game): { game: Game; days: number } {
  let game = beginAct2(start);
  let days = 0;
  /* Differentiators first, then capacity. See the note above. */
  const KIT: UpgradeId[] = ['freshSqueeze', 'bigSign', 'cooler'];
  while (days < ACT2_DAYS && !act2Progress(game.business, days).complete) {
    for (const id of KIT) {
      if (game.business.upgrades[id]) continue;
      const bought = buyUpgrade(game.stand.cash, game.business, id);
      if (bought.ok && game.stand.cash - UPGRADES[id].cost > 20) {
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
    days += 1;
    game = playDay(
      game,
      sensiblePrice(game),
      batchForCapacity(game),
      game.business.staff.manager,
      days,
    );
  }
  return { game, days };
}

/** The shop stage, paid for with a loan and traded until it pays for itself. */
export function throughShop(start: Game): { game: Game; days: number } {
  let game = beginAct3(start);
  const loan = loanQuote();
  game = {
    ...game,
    business: { ...game.business, loan },
    stand: { ...game.stand, cash: game.stand.cash + loan.principal },
  };
  let days = 0;
  while (days < ACT3_DAYS && !shopProgress(game.business.shop).complete) {
    if (!game.business.shop.open && game.stand.cash >= SHOP.fitOut) {
      game = {
        ...game,
        stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut },
        business: { ...game.business, shop: { ...game.business.shop, open: true } },
      };
    }
    days += 1;
    game = playDay(game, sensiblePrice(game), batchForCapacity(game), true, days);
  }
  return { game, days };
}

/**
 * The listing stage, taken through the sell-up door.
 *
 * Two doors lead to the market and either would do for a demo. This one is
 * taken because it hands over a single unambiguous number — what a buyer paid
 * for the whole thing — and because the deal board is where the two criteria
 * `readiness` cares about are recorded: ranking three stands by what they cost
 * per dollar of profit, and declining the dear one. Both come from
 * `recordDealChoice`, so choosing the best deal is what satisfies them, not a
 * flag being set.
 */
export function throughSale(start: Game): Game {
  const game = beginAct4(start);
  const ranked = recordDealChoice(game.ownership, bestDeal().id);
  const offer = buyoutOffer(game.stand.history, ranked);
  return { ...game, ownership: acceptBuyout(ranked, offer) };
}

/** A stage somebody can be dropped into, named the way the road names it. */
export interface DemoStage {
  act: Act;
  /** Where the app should land. Stage 1 has nothing to introduce. */
  phase: 'morning' | 'act-intro' | 'market';
  name: string;
  promise: string;
}

export const DEMO_STAGES: readonly DemoStage[] = ([1, 2, 3, 4, 5] as Act[]).map((act) => ({
  act,
  phase: act === 1 ? 'morning' : act === 5 ? 'market' : 'act-intro',
  name: ACT_TITLES[act].name,
  promise: ACT_TITLES[act].promise,
}));

/**
 * The save for a given stage, played rather than declared.
 *
 * Each case stands on the one before it, so a jump to the market carries a real
 * week at one stand, a manager, a second pitch, a shop with a loan against it
 * and a sale — and the account it opens with is what that business fetched.
 */
export function demoGame(act: Act, seed = 2026): Game {
  if (act === 1) return createGame(seed);

  const one = throughActOne(seed);
  if (act === 2) return beginAct2(one);

  const stands = throughStands(one).game;
  if (act === 3) return beginAct3(stands);

  const shop = throughShop(stands).game;
  if (act === 4) return beginAct4(shop);

  /*
   * The till is emptied on the way in, exactly as `page.tsx` does it, because
   * `beginAct5` adds `stand.cash` to the proceeds itself and counting it twice
   * would put money in the account that no day earned.
   */
  const sold = throughSale(shop);
  return beginAct5({ ...sold, stand: { ...sold.stand, cash: 0 } });
}

/**
 * What a jumped save does not contain, said in code next to the thing that
 * makes it.
 *
 * A demo save is an honest week that somebody else played, not a child's. These
 * are the things a demo-er should not claim it shows.
 */
export const NOT_IN_A_JUMPED_SAVE: readonly string[] = [
  'The first-run sequence: the cold open, the one-card rule, and every unlock arriving as a reward.',
  'The pacing. Four stages arrive in a second here and over days in a real run.',
  'Anything earned by writing: no theses, no journal entries, no check-ins.',
  'An empty ledger, so no credits and no streak until the demo earns them.',
];
