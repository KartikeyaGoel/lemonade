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
  act2Progress,
  buyUpgrade,
  deriveDayParams,
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
  updateHandsOff,
  updateTwoStandDays,
} from './business';
import { SHOP, loanQuote, repayLoan, shopProgress, updateShopDays } from './retail';
import { acceptBuyout, bestDeal, buyoutOffer, recordDealChoice } from './ownership';
import { ECON, batchPlan, deriveInsights, runDay } from './simulation';

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
 * One day, with every counter the close screen advances.
 *
 * Deliberately mirrors `closeDay` in `src/app/page.tsx`: the hands-off streak,
 * the two-stand streak, the shop's run of good days, a day off the loan and the
 * lifetime day count. If this drifts from that, a stage goal can become
 * unreachable in the app while every test still passes.
 *
 * The words are collected here too. A child is handed one insight a day and
 * ends up having been told all of them; a jumped save arrives with the same set
 * already learned, which is what `readiness` reads for its margin criterion.
 */
export function playDay(game: Game, price: number, cups: number, byManager = false): Game {
  const params = deriveDayParams(game.business, price);
  const plan = batchPlan(game.stand, cups);
  const outcome = runDay(game.stand, { ...plan.order, price }, { ...params, lastDay: null });
  const taught = deriveInsights(outcome, game.stand.history).map((insight) => insight.id);
  return {
    ...game,
    stand: outcome.nextState,
    daysTraded: game.daysTraded + 1,
    learned: [...new Set([...game.learned, ...taught])],
    business: {
      ...updateHandsOff(game.business, byManager, outcome.profit),
      twoStandDays: updateTwoStandDays(game.business, outcome.profit).twoStandDays,
      shop: updateShopDays(game.business.shop, outcome.profit),
      loan: repayLoan(game.business.loan),
    },
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
  for (let day = 0; day < ECON.TOTAL_DAYS; day += 1) {
    const plan = batchPlan(game.stand, cups);
    const outcome = runDay(game.stand, { ...plan.order, price });
    const taught = deriveInsights(outcome, game.stand.history).map((insight) => insight.id);
    game = {
      ...game,
      stand: outcome.nextState,
      daysTraded: game.daysTraded + 1,
      learned: [...new Set([...game.learned, ...taught])],
    };
  }
  return { ...game, stand: { ...game.stand, status: 'playing' } };
}

/**
 * The stands stage, played the way the goal strip asks.
 *
 * Buy the cooler, hire a manager once there is a wage in hand, wait for the
 * hands-off days, then open at the park. Returns how many days it took as well,
 * because "before the fallback fires" is the assertion that matters.
 */
export function throughStands(start: Game): { game: Game; days: number } {
  let game = beginAct2(start);
  let days = 0;
  while (days < ACT2_DAYS && !act2Progress(game.business, days).complete) {
    if (!game.business.upgrades.cooler && game.stand.cash > 80) {
      const bought = buyUpgrade(game.stand.cash, game.business, 'cooler');
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
    game = playDay(game, sensiblePrice(game), batchForCapacity(game), game.business.staff.manager);
    days += 1;
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
    game = playDay(game, sensiblePrice(game), batchForCapacity(game), true);
    days += 1;
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
