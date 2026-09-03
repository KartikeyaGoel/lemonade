/**
 * Act 2 — Scale.
 *
 * The wall that motivates this act: the kid has found the best price and is
 * still capped. One stand, their own two hands, about thirty cups a day. The
 * only way forward is to spend money to make money, which is the first time
 * they meet capital.
 *
 * Everything here resolves into a `DayParams` that `runDay` already knows how
 * to execute, so the day loop itself never learns about coolers or rivals.
 *
 * Pure module. No React, no I/O.
 */

import {
  ECON,
  type DayOutcome,
  type Insight,
  type DayParams,
  type DayRecord,
  type FixedCostLine,
  round2,
  toCents,
  type Forecast,
} from './simulation';
import {
  SHOP,
  createShopState,
  shopBreakEvenCups,
  shopCapacity,
  shopDailyCost,
  shopCrowd,
  shopFixedCosts,
  loanFixedCosts,
  type LoanState,
  type ShopState,
} from './retail';
import { plural } from './copy';

/* ------------------------------------------------------------------ *
 * Things you can buy
 * ------------------------------------------------------------------ */

/**
 * Capex: paid once, works forever. The point of splitting these from wages is
 * that a kid should feel the difference in their bones before hearing either
 * word — one purchase makes them permanently better, the other is rent.
 */
export const UPGRADES = {
  cooler: {
    id: 'cooler',
    name: 'Ice cooler',
    emoji: '🧊',
    cost: 35,
    blurb: 'Serve 40 more cups a day.',
    effect: 'capacity',
  },
  bigSign: {
    id: 'bigSign',
    name: 'Big painted sign',
    emoji: '🪧',
    cost: 25,
    blurb: 'More people notice you.',
    effect: 'awareness',
  },
  freshSqueeze: {
    id: 'freshSqueeze',
    name: 'Fresh-squeezed',
    emoji: '🍋',
    cost: 30,
    blurb: 'People will pay more, and stay when prices rise.',
    effect: 'quality',
  },
} as const;

export type UpgradeId = keyof typeof UPGRADES;

/** Opex: owed every single day, whether or not anyone buys a cup. */
export const STAFF = {
  helper: {
    id: 'helper',
    name: 'Helper',
    emoji: '🧑‍🤝‍🧑',
    wage: 12,
    blurb: 'Serve 35 more cups a day.',
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    emoji: '🧑‍🍳',
    wage: 20,
    blurb: 'Runs the stand without you. Your hands come free.',
  },
} as const;

export type StaffId = keyof typeof STAFF;

export const LOCATIONS = {
  sidewalk: {
    id: 'sidewalk',
    name: 'Your sidewalk',
    emoji: '🏠',
    fee: ECON.STAND_FEE,
    demandMultiplier: 1,
    blurb: 'Cheap, quiet.',
  },
  park: {
    id: 'park',
    name: 'The park gate',
    emoji: '🌳',
    fee: 14,
    demandMultiplier: 1.7,
    blurb: 'Far busier. Far more rent.',
  },
} as const;

export type LocationId = keyof typeof LOCATIONS;

/** Capacity with no upgrades and no staff: the cap that creates the act. */
export const BASE_SERVICE_CAPACITY = 30;
export const COOLER_CAPACITY = 40;
export const HELPER_CAPACITY = 35;
export const MANAGER_CAPACITY = 20;

/** Fresh-squeezed makes customers less price-sensitive. This is pricing power. */
export const QUALITY_SLOPE = 16;
export const QUALITY_APPEAL_BONUS = 0.6;
export const SIGN_INTERCEPT_BONUS = 8;

/** The most any customer in town will pay, used for competitive appeal. */
const CHOKE_PRICE = ECON.MAX_RESERVATION_PRICE;

/* ------------------------------------------------------------------ *
 * The round
 *
 * A neighbour who signs up gets a cup every day at a discount and pays on the
 * day, the way a milk round worked. The kid gives up margin and gets something
 * they have not had until now: customers who turn up when it is cold.
 *
 * This is the stand's version of a subscription, and a buyer pays extra for it.
 * ------------------------------------------------------------------ */

export const ROUND = {
  /** What a regular saves per cup. The cost of predictability. */
  DISCOUNT: 0.15,
  /** Nobody can run a round bigger than this on one street. */
  MAX_REGULARS: 24,
  /** Fraction of a typical day's customers who will sign up when asked. */
  SIGNUP_RATE: 0.25,
  /** Good lemonade is easier to sell a standing order for. */
  QUALITY_BONUS: 1.5,
} as const;

/**
 * Days the stands stage runs before it hands over regardless.
 *
 * Sixteen, and it stays sixteen. This was cut to thirteen on the argument that
 * a cap is the fallback for a child who has *not* met the goal, so its slack is
 * only ever spent by whoever is already struggling — which is true, and turned
 * out to be the wrong conclusion.
 *
 * `tests/wordbudget.test.ts` measured what the cut actually costs, over ten
 * seeds and two levels of play, and the answer is a specific word:
 * **`delegation`**.
 *
 * | cap | careless runs that lose a word | word lost |
 * | --- | --- | --- |
 * | 16 | 0/10 | — |
 * | 15 | 1/10 | `delegation` |
 * | 14 | 1/10 | `delegation` |
 * | 13 | 2/10 | `delegation` |
 * | 12 | 3/10 | `delegation` |
 * | 11 | 5/10 | `delegation`, `spoilage` |
 *
 * Careful play is untouched at any of these — it finishes by day eleven. The
 * cost lands entirely on the child who plays badly, hires a manager late
 * because the cash took a while, and needs the tail of the stage to get there.
 * And the word they lose is the one this stage is *for*: the manager, the
 * business that runs without you, the difference between owning a job and
 * owning a business.
 *
 * So the length of this stage is load-bearing for its own central idea, and no
 * cap below sixteen is free. If it should be shorter, the lever is the gate —
 * make `delegation` reachable sooner — not the clock.
 *
 * `ACT3_DAYS` is the opposite case and was cut from twelve to six, because
 * there the same measurement found the slack really was spare.
 *
 * The caveat that survives all of it: the cap is not what makes the runway
 * long. The objectives are. A kid who does everything right still plays about
 * twenty-six days before a share price appears, and no cap can shorten that.
 */
export const ACT2_DAYS = 16;
/** Profitable manager-run days needed to prove it runs without the kid. */
export const HANDS_OFF_DAYS_REQUIRED = 3;

/* ------------------------------------------------------------------ *
 * More than one stand
 *
 * The manager was already in the game and was already the right unlock; it was
 * just pointed at the wrong thing. "Runs the stand without you" was sold as a
 * way to get paid for doing nothing, which is true and is also the least
 * interesting thing about it. What a manager actually buys is *the kid's own
 * hands back*, and there is exactly one thing worth doing with a spare pair of
 * hands: stand behind a second table.
 *
 * So opening a stand is gated on having hired a manager, and the reason is not
 * a rule — it is that somebody has to be at the first one. A kid who works out
 * "I can't be in two places at once" has worked out why companies hire people,
 * and that is a better lesson than any wage line.
 *
 * The arithmetic of the second stand is deliberately plain, because PRODUCT.md
 * §18 already promised it: *growth is arithmetic — one more stand, again.*
 * ------------------------------------------------------------------ */

/** A table, a jug and a sign. Paid once, like every other piece of kit. */
export const STAND_SETUP_COST = 40;

/**
 * Stands in total, including the first one.
 *
 * Three, because the lesson is "one more, again" and the second one teaches it.
 * A fourth would be the same decision a third time for another two minutes of
 * tapping, and §26 is about exactly that.
 */
export const MAX_STANDS = 3;

/**
 * What a second stand on a pitch you are already trading finds.
 *
 * Half a crowd, not a whole one, because the people are already buying from
 * you. This is the only number in the act a kid can get badly wrong without
 * being told: two stands on one pavement look twice as good on the shop screen
 * and are not, and the close screen shows both stands' takings side by side so
 * the thin one is visible the next morning.
 */
export const SAME_PITCH_SHARE = 0.5;

/** Profitable days with two stands open that end the act. */
export const TWO_STAND_DAYS_REQUIRED = 2;

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

export interface RivalState {
  active: boolean;
  /** What they are charging today. */
  price: number;
  location: LocationId;
  daysActive: number;
}

/**
 * A stand beyond the first one.
 *
 * `runBy` is the whole of the staffing lesson. The kid is one person: they can
 * work at one table, and only once a manager is minding the first one. Every
 * stand after that has to be paid for.
 */
export interface ExtraStand {
  id: number;
  location: LocationId;
  runBy: 'you' | 'minder';
}

export interface BusinessState {
  upgrades: Record<UpgradeId, boolean>;
  staff: Record<StaffId, boolean>;
  location: LocationId;
  rival: RivalState;
  /** Money taken out of the business. Safe, and no longer working for them. */
  savings: number;
  /** Consecutive profitable days the manager has run unaided. */
  handsOffDays: number;
  /** Days the kid has traded at the park, used to decide if the rival follows. */
  daysAtPark: number;
  /** Neighbours on the round: a cup a day each, discounted, rain or shine. */
  regulars: number;
  /** How many times the kid has gone out and asked people to sign up. */
  roundDrives: number;
  /** Stands opened beyond the first. Empty until a manager is minding it. */
  stands: ExtraStand[];
  /** Consecutive profitable days run with two or more stands open. */
  twoStandDays: number;
  /** The shop, once there is one. Stage 3. */
  shop: ShopState;
  /** Money borrowed, and still owed. Null until the kid borrows. */
  loan: LoanState | null;
}

export function createBusinessState(): BusinessState {
  return {
    upgrades: { cooler: false, bigSign: false, freshSqueeze: false },
    staff: { helper: false, manager: false },
    location: 'sidewalk',
    rival: { active: false, price: 1.4, location: 'sidewalk', daysActive: 0 },
    savings: 0,
    handsOffDays: 0,
    daysAtPark: 0,
    regulars: 0,
    roundDrives: 0,
    stands: [],
    twoStandDays: 0,
    shop: createShopState(),
    loan: null,
  };
}

/* ------------------------------------------------------------------ *
 * Opening, and staffing, another stand
 * ------------------------------------------------------------------ */

/** Every pitch being traded today, the first stand included. */
export function pitches(business: BusinessState): LocationId[] {
  return [business.location, ...business.stands.map((stand) => stand.location)];
}

export function standCount(business: BusinessState): number {
  return 1 + business.stands.length;
}

/**
 * Whether the kid's own hands are free.
 *
 * True once a manager is minding the first stand and the kid has not already
 * walked off to a second one.
 */
export function youAreFree(business: BusinessState): boolean {
  return business.staff.manager && !business.stands.some((stand) => stand.runBy === 'you');
}

export interface StandOpening {
  /** The pitch this stand would take. */
  location: LocationId;
  /** Who would be behind the table. */
  runBy: 'you' | 'minder';
  /** Paid once, today. */
  setup: number;
  /** Owed every day from tomorrow: the pitch, plus a wage if somebody is paid. */
  daily: number;
  /** Cups a day this stand could serve. */
  capacity: number;
  /** Crowd it adds, after any splitting with a stand you already have there. */
  crowdAdded: number;
  /** Why it cannot be opened, or null. */
  blocked: string | null;
}

/**
 * Everything the kid needs to see before opening a stand, live, on one screen.
 *
 * Deliberately not a recommendation. It reports the four numbers — what it
 * costs once, what it costs a day, what it can serve and what crowd it finds —
 * and leaves the arithmetic to them. A stand on a pitch they already work is a
 * worse deal than the same stand somewhere new, and nothing here says so.
 */
export function standOpening(
  business: BusinessState,
  location: LocationId,
  cash: number,
): StandOpening {
  const runBy: 'you' | 'minder' = youAreFree(business) ? 'you' : 'minder';
  const daily = round2(LOCATIONS[location].fee + (runBy === 'minder' ? STAFF.manager.wage : 0));

  const already = pitches(business).filter((pitch) => pitch === location).length;
  const crowdAdded = round2(LOCATIONS[location].demandMultiplier * SAME_PITCH_SHARE ** already);

  let blocked: string | null = null;
  if (!business.staff.manager) blocked = 'Somebody has to mind this one first.';
  else if (standCount(business) >= MAX_STANDS) blocked = 'That is as many as one street will take.';
  else if (cash < STAND_SETUP_COST) blocked = `You need $${STAND_SETUP_COST} for the table and the jug.`;

  return {
    location,
    runBy,
    setup: STAND_SETUP_COST,
    daily,
    capacity: runBy === 'you' ? BASE_SERVICE_CAPACITY : MANAGER_CAPACITY,
    crowdAdded,
    blocked,
  };
}

export interface OpenStandResult {
  business: BusinessState;
  cash: number;
  opened: boolean;
  reason: string | null;
}

export function openStand(
  business: BusinessState,
  location: LocationId,
  cash: number,
): OpenStandResult {
  const opening = standOpening(business, location, cash);
  if (opening.blocked) {
    return { business, cash, opened: false, reason: opening.blocked };
  }
  const id = business.stands.reduce((max, stand) => Math.max(max, stand.id), 0) + 1;
  return {
    business: {
      ...business,
      stands: [...business.stands, { id, location, runBy: opening.runBy }],
    },
    cash: round2(cash - opening.setup),
    opened: true,
    reason: null,
  };
}

/**
 * Shuts a stand and puts the kid back where they came from.
 *
 * Closing is not undoing: the table is already paid for and that money is gone.
 * What comes back is the daily cost, which is the point — a stand that loses
 * money every day is a decision you are allowed to reverse.
 */
export function closeStand(business: BusinessState, id: number): BusinessState {
  return { ...business, stands: business.stands.filter((stand) => stand.id !== id) };
}

/* ------------------------------------------------------------------ *
 * What every stand adds up to
 * ------------------------------------------------------------------ */

export interface StandLine {
  /** 0 is the first stand. */
  id: number;
  name: string;
  emoji: string;
  location: LocationId;
  runBy: 'you' | 'minder' | 'manager';
  /** Cups a day this stand can serve. */
  capacity: number;
  /** Its share of the crowd, before price and before the rival. */
  crowd: number;
}

/**
 * Every stand, with what it brings and what it can serve.
 *
 * The first stand keeps every scrap of the old arithmetic — base capacity plus
 * cooler plus helper plus manager — so a save with no extra stands runs exactly
 * the day it ran before this existed.
 */
export function standLines(business: BusinessState): StandLine[] {
  const seen: Partial<Record<LocationId, number>> = {};
  const crowdFor = (location: LocationId): number => {
    const already = seen[location] ?? 0;
    seen[location] = already + 1;
    return round2(LOCATIONS[location].demandMultiplier * SAME_PITCH_SHARE ** already);
  };

  const first: StandLine = {
    id: 0,
    name: LOCATIONS[business.location].name,
    emoji: LOCATIONS[business.location].emoji,
    location: business.location,
    runBy: business.staff.manager ? 'manager' : 'you',
    capacity:
      BASE_SERVICE_CAPACITY +
      (business.upgrades.cooler ? COOLER_CAPACITY : 0) +
      (business.staff.helper ? HELPER_CAPACITY : 0) +
      (business.staff.manager ? MANAGER_CAPACITY : 0),
    crowd: crowdFor(business.location),
  };

  const rest = business.stands.map((stand) => ({
    id: stand.id,
    name: LOCATIONS[stand.location].name,
    emoji: LOCATIONS[stand.location].emoji,
    location: stand.location,
    runBy: stand.runBy,
    capacity: stand.runBy === 'you' ? BASE_SERVICE_CAPACITY : MANAGER_CAPACITY,
    crowd: crowdFor(stand.location),
  }));

  return [first, ...rest];
}

/**
 * Every place the business sells from, the shop included.
 *
 * `standLines` stays stands-only because the pitch logic and the rival's corner
 * are about pavements. This is the list for anything that asks "how much can
 * the whole business pour, and where did it pour it" — capacity, crowd, and the
 * split on the close screen all read it, so those three can never disagree
 * about what the business is.
 */
export function sellingPoints(business: BusinessState): StandLine[] {
  const stands = standLines(business);
  if (!business.shop.open) return stands;
  return [
    ...stands,
    {
      id: -1,
      name: SHOP.name,
      emoji: SHOP.emoji,
      location: business.location,
      runBy: 'minder',
      capacity: shopCapacity(business.shop),
      crowd: shopCrowd(business.shop),
    },
  ];
}

/**
 * Splits a day's cups across the stands that served them.
 *
 * Attribution, not simulation: the day is run once for the whole business and
 * then divided by the crowd each stand brought, capped by what each stand could
 * actually serve. The parts sum to the whole exactly — the last stand takes the
 * remainder — because the close screen prints both, and two numbers that do not
 * add up to the third are worse than one number on its own.
 */
export function splitCups(business: BusinessState, cupsSold: number): number[] {
  const lines = sellingPoints(business);
  if (lines.length === 1) return [cupsSold];

  const total = lines.reduce((sum, line) => sum + line.crowd, 0);
  if (total <= 0) return lines.map(() => 0);

  // Crowd decides the split; capacity is the ceiling on what a stand could
  // physically have poured, so a tiny stand on a busy pitch does not get
  // credited with cups it had no cups for.
  const rounded = lines.map((line) =>
    Math.floor(Math.min(line.capacity, (line.crowd / total) * cupsSold)),
  );
  let left = cupsSold - rounded.reduce((sum, cups) => sum + cups, 0);
  // Hand the remainder out to whoever still has room, biggest stand first.
  const order = lines
    .map((line, i) => i)
    .sort((a, b) => lines[b].capacity - lines[a].capacity);
  for (const i of order) {
    while (left > 0 && rounded[i] < lines[i].capacity) {
      rounded[i] += 1;
      left -= 1;
    }
    if (left <= 0) break;
  }
  return rounded;
}

/* ------------------------------------------------------------------ *
 * Deriving the day
 * ------------------------------------------------------------------ */

/**
 * Every cup the whole business can pour today, wherever it pours them.
 *
 * With one stand and no shop this is the identical sum it always was, which is
 * what keeps every Act 1 and Act 2 number in the tests where it was.
 */
export function serviceCapacity(business: BusinessState): number {
  return sellingPoints(business).reduce((sum, line) => sum + line.capacity, 0);
}

/**
 * Everything owed today whether or not one cup sells.
 *
 * The order is deliberate and it is the lesson: pitches, then wages, then rent,
 * then the bank. Each line is owed by a different kind of promise, and by the
 * end of Stage 3 a kid has made all four.
 */
export function dailyFixedCosts(business: BusinessState): FixedCostLine[] {
  const lines: FixedCostLine[] = [
    { label: `${LOCATIONS[business.location].name} pitch`, amount: LOCATIONS[business.location].fee },
  ];
  for (const stand of business.stands) {
    lines.push({ label: `${LOCATIONS[stand.location].name} pitch`, amount: LOCATIONS[stand.location].fee });
  }
  if (business.staff.helper) lines.push({ label: 'Helper wages', amount: STAFF.helper.wage });
  if (business.staff.manager) lines.push({ label: 'Manager wages', amount: STAFF.manager.wage });
  const minders = business.stands.filter((stand) => stand.runBy === 'minder').length;
  if (minders > 0) {
    lines.push({
      label: minders === 1 ? 'Stand minder' : `Stand minders ×${minders}`,
      amount: round2(minders * STAFF.manager.wage),
    });
  }
  lines.push(...shopFixedCosts(business.shop));
  lines.push(...loanFixedCosts(business.loan));
  return lines;
}

/**
 * The whole crowd this business can see, and how much of it is behind a door.
 *
 * `indoorShare` is what buys the shop its weather immunity, and it is a share
 * rather than a flag because a kid with two pitches and a shop is half exposed
 * to the sky and half not.
 */
export function crowdMix(business: BusinessState): { crowd: number; indoorShare: number } {
  const indoor = shopCrowd(business.shop);
  const crowd = round2(sellingPoints(business).reduce((sum, line) => sum + line.crowd, 0));
  return { crowd, indoorShare: crowd > 0 ? indoor / crowd : 0 };
}

/**
 * How attractive a stand looks to someone walking past, given its price and
 * whether the lemonade is any good. Zero once nobody would pay that much.
 */
export function standAppeal(price: number, quality: boolean): number {
  const headroom = Math.max(0, CHOKE_PRICE - price);
  return headroom * (1 + (quality ? QUALITY_APPEAL_BONUS : 0));
}

/**
 * The share of the street that comes to you rather than the rival.
 *
 * A rival only competes if they are pitched on the same corner, which is why
 * moving to the park is a real answer to being undercut — until they follow
 * you there.
 */
export function marketShareAgainstRival(
  myPrice: number,
  business: BusinessState,
): number {
  const { rival } = business;
  if (!rival.active || rival.location !== business.location) return 1;

  const mine = standAppeal(myPrice, business.upgrades.freshSqueeze);
  const theirs = standAppeal(rival.price, false);
  if (mine + theirs <= 0) return 0.5;
  return mine / (mine + theirs);
}

/**
 * The share of the *whole business* the rival is competing for.
 *
 * `marketShareAgainstRival` answers the question for one pitch, which was the
 * only question there was while the business was one table. It is now the wrong
 * question: a boy with a stand across the road from the kid's front garden was
 * taking half the customers out of a shop on the high street and a stand at the
 * park gate, neither of which he can see.
 *
 * So the pitch-level answer is weighted by how much of the crowd each pitch
 * actually brings, and everything he is not standing next to keeps all of its
 * own. He still hurts — the home pitch is real revenue — and he hurts less the
 * bigger the rest of the business gets, which is exactly what happens to a
 * corner shop when somebody opens a stall outside one of its branches.
 */
export function effectiveMarketShare(business: BusinessState, myPrice: number): number {
  const { rival } = business;
  if (!rival.active) return 1;

  const share = marketShareAgainstRival(myPrice, business);
  if (share >= 1) return 1;

  const lines = standLines(business);
  const contested = lines
    .filter((line) => line.location === rival.location)
    .reduce((sum, line) => sum + line.crowd, 0);
  const total = lines.reduce((sum, line) => sum + line.crowd, 0) + shopCrowd(business.shop);
  if (total <= 0) return share;

  // Weighted: his corner loses share, every other pitch and the shop keep all
  // of theirs.
  return round2((contested * share + (total - contested)) / total);
}

export function deriveDayParams(business: BusinessState, myPrice: number): DayParams {
  const fixedCosts = dailyFixedCosts(business);
  const { crowd, indoorShare } = crowdMix(business);
  return {
    demandIntercept: ECON.DEMAND_INTERCEPT + (business.upgrades.bigSign ? SIGN_INTERCEPT_BONUS : 0),
    demandSlope: business.upgrades.freshSqueeze ? QUALITY_SLOPE : ECON.DEMAND_SLOPE,
    demandMultiplier: crowd,
    fixedCosts,
    serviceCapacity: serviceCapacity(business),
    marketShare: effectiveMarketShare(business, myPrice),
    equityShare: 0,
    // Act 2 onwards the stand keeps trading; there is no fixed final day.
    lastDay: null,
    cashFloor: ECON.STARTING_CASH,
    subscribers: business.regulars,
    subscriberDiscount: ROUND.DISCOUNT,
    indoorShare,
  };
}

/* ------------------------------------------------------------------ *
 * Signing people up
 * ------------------------------------------------------------------ */

export interface RoundDriveResult {
  business: BusinessState;
  added: number;
  regulars: number;
  /** What actually happened, in the kid's numbers. */
  blurb: string;
}

/**
 * Goes door to door and signs up whoever says yes.
 *
 * How many say yes depends on how many people already buy — you cannot build a
 * round on a street that does not want lemonade — and on whether the lemonade
 * is good, because a standing order is a bigger ask than one cup.
 */
export function signUpRegulars(business: BusinessState, history: DayRecord[]): RoundDriveResult {
  const typicalCups = history.length > 0 ? trailingDailyCups(history) : 0;
  const quality = business.upgrades.freshSqueeze ? ROUND.QUALITY_BONUS : 1;
  const room = Math.max(0, ROUND.MAX_REGULARS - business.regulars);
  const added = Math.min(room, Math.round(typicalCups * ROUND.SIGNUP_RATE * quality));

  const next: BusinessState = {
    ...business,
    regulars: business.regulars + added,
    roundDrives: business.roundDrives + 1,
  };

  let blurb: string;
  if (added === 0 && room === 0) {
    blurb = `Everyone on the street who wants a standing order already has one (${business.regulars}).`;
  } else if (added === 0) {
    blurb = 'Nobody signed up. Not enough people buy from you yet to build a round on.';
  } else {
    blurb = `${added} ${added === 1 ? 'neighbour' : 'neighbours'} signed up. That is ${next.regulars} ${
      next.regulars === 1 ? 'cup' : 'cups'
    } a day you can count on, at ${Math.round(ROUND.DISCOUNT * 100)}% off.`;
  }

  return { business: next, added, regulars: next.regulars, blurb };
}

/** Average cups sold per day recently — the pool a round can be built from. */
export function trailingDailyCups(history: DayRecord[], days = 7): number {
  if (history.length === 0) return 0;
  const window = history.slice(-days);
  return window.reduce((sum, day) => sum + day.cupsSold, 0) / window.length;
}

/**
 * What fraction of recent takings came from the round.
 *
 * This is the number a buyer pays extra for, so it is computed from cups actually
 * served rather than from how many people are signed up — a round you cannot
 * pour for is not revenue.
 */
export function regularShareOfSales(history: DayRecord[], days = 7): number {
  const window = history.slice(-days);
  const cups = window.reduce((sum, day) => sum + day.cupsSold, 0);
  if (cups === 0) return 0;
  const regularCups = window.reduce((sum, day) => sum + (day.subscriberCups ?? 0), 0);
  return Math.min(1, regularCups / cups);
}

/**
 * How steady the takings are, week to week: 1 means every day was identical.
 *
 * A buyer is buying next month's profit, not last week's, so they pay
 * more for a business whose days look alike.
 */
export function revenueSteadiness(history: DayRecord[], days = 7): number | null {
  const window = history.slice(-days);
  if (window.length < 3) return null;
  const mean = window.reduce((sum, day) => sum + day.revenue, 0) / window.length;
  if (mean <= 0) return 0;
  const variance =
    window.reduce((sum, day) => sum + (day.revenue - mean) ** 2, 0) / window.length;
  const spread = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(1, 1 - spread));
}

/* ------------------------------------------------------------------ *
 * Buying things
 * ------------------------------------------------------------------ */

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
  cash: number;
  business: BusinessState;
}

export function buyUpgrade(
  cash: number,
  business: BusinessState,
  id: UpgradeId,
): PurchaseResult {
  if (business.upgrades[id]) {
    return { ok: false, reason: 'You already own that.', cash, business };
  }
  const cost = UPGRADES[id].cost;
  if (cash < cost) {
    return { ok: false, reason: 'Not enough cash yet.', cash, business };
  }
  return {
    ok: true,
    cash: round2(cash - cost),
    business: { ...business, upgrades: { ...business.upgrades, [id]: true } },
  };
}

/** Hiring costs nothing today; it costs every day from now on. */
export function toggleStaff(business: BusinessState, id: StaffId): BusinessState {
  return { ...business, staff: { ...business.staff, [id]: !business.staff[id] } };
}

export function moveTo(business: BusinessState, location: LocationId): BusinessState {
  return { ...business, location };
}

/* ------------------------------------------------------------------ *
 * The rival
 * ------------------------------------------------------------------ */

/** The day of Act 2 on which somebody else spots the opportunity. */
export const RIVAL_APPEARS_ON_DAY = 3;
/** They will not sell below this, so a price war has a floor. */
export const RIVAL_PRICE_FLOOR = 0.8;
export const RIVAL_FOLLOWS_AFTER_PARK_DAYS = 3;

/**
 * Moves the rival for tomorrow.
 *
 * They undercut, but only down to their own floor, so a kid who tries to win
 * on price alone ends up destroying their own margin to beat someone who
 * cannot go any lower. The way out is to be different, not cheaper.
 */
export function advanceRival(
  business: BusinessState,
  actDay: number,
  myPrice: number,
): RivalState {
  const { rival } = business;

  if (!rival.active) {
    if (actDay >= RIVAL_APPEARS_ON_DAY) {
      return {
        active: true,
        price: toCents(Math.max(RIVAL_PRICE_FLOOR, myPrice - 0.2)),
        location: business.location,
        daysActive: 1,
      };
    }
    return rival;
  }

  // Creep towards undercutting whatever the kid charged.
  const target = Math.max(RIVAL_PRICE_FLOOR, myPrice - 0.15);
  const next = toCents(rival.price + Math.sign(target - rival.price) * Math.min(0.15, Math.abs(target - rival.price)));

  // If the kid ran away to the park and it is working, the rival follows.
  const follows =
    business.location === 'park' &&
    rival.location !== 'park' &&
    business.daysAtPark >= RIVAL_FOLLOWS_AFTER_PARK_DAYS;

  return {
    active: true,
    price: next,
    location: follows ? 'park' : rival.location,
    daysActive: rival.daysActive + 1,
  };
}

/* ------------------------------------------------------------------ *
 * Weekly choice: reinvest or take it out
 * ------------------------------------------------------------------ */

export interface WeeklyChoice {
  /** Money moved out of the business into savings. */
  cashOut: number;
  /** Spend the week's spare afternoons signing up regulars. */
  signUpRegulars?: boolean;
}

/**
 * Taking money out makes it safe and stops it compounding. Leaving it in is
 * what buys the next cooler. We never say which is right — the kid feels the
 * difference over the following week.
 */
export function applyWeeklyChoice(
  cash: number,
  business: BusinessState,
  choice: WeeklyChoice,
  history: DayRecord[] = [],
): { cash: number; business: BusinessState; drive: RoundDriveResult | null } {
  const out = Math.max(0, Math.min(cash, round2(choice.cashOut)));
  let next: BusinessState = { ...business, savings: round2(business.savings + out) };

  let drive: RoundDriveResult | null = null;
  if (choice.signUpRegulars) {
    drive = signUpRegulars(next, history);
    next = drive.business;
  }

  return { cash: round2(cash - out), business: next, drive };
}

/* ------------------------------------------------------------------ *
 * Act 2 completion
 * ------------------------------------------------------------------ */

export interface Act2Progress {
  handsOffDays: number;
  required: number;
  complete: boolean;
  /** What the kid still has to do, in their own terms. */
  nextStep: string;
  /** Stands trading today, the first one included. */
  stands: number;
  twoStandDays: number;
}

/**
 * Three steps, in the order the wall arrives.
 *
 * A ceiling of thirty cups a day, then a manager so the first stand does not
 * need the kid, then a second stand for the kid to go and stand at. Each step
 * only makes sense once the one before it has happened, which is the whole of
 * PRODUCT.md §4's rule about not teaching a concept before its wall — nobody
 * wonders why companies hire people until they personally cannot be in two
 * places at once.
 */
export function act2Progress(business: BusinessState, _standDay: number): Act2Progress {
  const stands = standCount(business);
  const complete = stands >= 2 && business.twoStandDays >= TWO_STAND_DAYS_REQUIRED;
  let nextStep: string;
  if (!business.staff.manager) {
    nextStep = 'Hire a manager so the first stand runs without you.';
  } else if (business.handsOffDays < HANDS_OFF_DAYS_REQUIRED) {
    nextStep = `${HANDS_OFF_DAYS_REQUIRED - business.handsOffDays} more good days run by your manager.`;
  } else if (stands < 2) {
    nextStep = 'Your hands are free. Open a second stand.';
  } else if (business.twoStandDays < TWO_STAND_DAYS_REQUIRED) {
    const left = TWO_STAND_DAYS_REQUIRED - business.twoStandDays;
    nextStep = `${left} more good ${left === 1 ? 'day' : 'days'} with both stands open.`;
  } else {
    nextStep = 'Two stands, one price, and both of them paying.';
  }
  return {
    handsOffDays: business.handsOffDays,
    required: HANDS_OFF_DAYS_REQUIRED,
    complete,
    nextStep,
    stands,
    twoStandDays: business.twoStandDays,
  };
}

/**
 * Updates the hands-off counter after a day.
 *
 * Only manager-run profitable days count, and one bad day does not wipe the
 * streak to zero — the kid should not be punished for weather.
 */
export function updateHandsOff(business: BusinessState, ranByManager: boolean, profit: number): BusinessState {
  if (!business.staff.manager || !ranByManager) return business;
  const handsOffDays = profit > 0 ? business.handsOffDays + 1 : Math.max(0, business.handsOffDays - 1);
  return { ...business, handsOffDays };
}

/**
 * Updates the two-stand counter after a day.
 *
 * Same rule as the hands-off streak, and for the same reason: a cold Tuesday is
 * not a bad decision. What it does count is the day where two pitches, two
 * pitch fees and a wage all came out of one price and the business still made
 * money, which is a genuinely harder thing to do than one stand ever was.
 */
export function updateTwoStandDays(business: BusinessState, profit: number): BusinessState {
  if (standCount(business) < 2) return business;
  const twoStandDays = profit > 0 ? business.twoStandDays + 1 : Math.max(0, business.twoStandDays - 1);
  return { ...business, twoStandDays };
}

/* ------------------------------------------------------------------ *
 * Trailing performance — the number a buyer will price
 * ------------------------------------------------------------------ */

/** Average daily profit over the last `days` days. */
export function trailingDailyProfit(history: DayRecord[], days = 7): number {
  if (history.length === 0) return 0;
  const window = history.slice(-days);
  return round2(window.reduce((sum, day) => sum + day.profit, 0) / window.length);
}

/** What the business earns in a week, which is what a buyer will pay for. */
export function trailingWeeklyProfit(history: DayRecord[], days = 7): number {
  return round2(trailingDailyProfit(history, days) * 7);
}

/**
 * Is the business growing? Compares the most recent stretch against the one
 * before it. The sale uses this to justify a higher multiple.
 *
 * The window is seven days rather than five for a specific reason: weather
 * swings daily demand by up to 50%, and at five days that noise dominated the
 * signal so completely that the same run could read -28% or +14% depending on
 * where you cut it. Every strategy came out "shrinking", which made the growth
 * premium at the sale unreachable. Seven days lets a full weather cycle average
 * out, so the number reflects the business rather than the sky.
 */
export function growthRate(history: DayRecord[], window = 7): number | null {
  if (history.length < window * 2) return null;
  const older = history.slice(-window * 2, -window);
  const recent = history.slice(-window);
  const avg = (days: DayRecord[]) => days.reduce((s, d) => s + d.profit, 0) / days.length;
  const before = avg(older);
  const after = avg(recent);
  if (before <= 0) return after > 0 ? 1 : null;
  return round2((after - before) / before);
}


/**
 * Suggested price the game will never show as advice, only used to let the
 * manager run a sensible day on the kid's behalf.
 */
export function managerPrice(history: DayRecord[], fallback = 1.6): number {
  if (history.length === 0) return fallback;
  const best = history.reduce((a, d) => (d.profit > a.profit ? d : a), history[0]);
  return best.price;
}

/**
 * Cups the manager will make.
 *
 * The forecast argument was accepted and then ignored, which did not matter
 * while nothing could actually hand the manager a day. Now that the close
 * screen can, it matters a great deal: a manager who makes twenty-eight cups
 * into a cold morning throws most of them away, loses money, and the kid never
 * earns the hands-off days the act is asking them for. Reading the sky is the
 * least a person on twenty dollars a day can do.
 */
export function managerBatch(business: BusinessState, forecast: Forecast = 'probably-mild'): number {
  const capacity = serviceCapacity(business);
  const rough = Math.round(28 * LOCATIONS[business.location].demandMultiplier);
  const sized = Math.round(rough * MANAGER_SIZING[forecast]);
  return Math.min(capacity, Math.max(10, sized));
}

/** How far the manager leans on the forecast. Cautious, deliberately. */
const MANAGER_SIZING: Record<Forecast, number> = {
  'probably-hot': 1.3,
  'probably-mild': 1,
  'probably-cold': 0.55,
};

/* ------------------------------------------------------------------ *
 * Act 2 vocabulary
 *
 * Same rule as Act 1: nothing fires until the kid has already lived it. A kid
 * who never hired anyone never hears the word "opex".
 * ------------------------------------------------------------------ */


export function deriveAct2Insights(
  outcome: DayOutcome,
  business: BusinessState,
  history: DayRecord[],
): Insight[] {
  const found: Insight[] = [];
  const money = (n: number) => `$${n.toFixed(2)}`;

  const ownsCapex = Object.values(business.upgrades).some(Boolean);
  const paysWages = business.staff.helper || business.staff.manager;

  // Capex vs opex only makes sense once they hold one of each.
  if (ownsCapex && paysWages) {
    const wages = outcome.fixedCostLines
      .filter((line) => line.label.toLowerCase().includes('wages'))
      .reduce((sum, line) => sum + line.amount, 0);
    found.push({
      id: 'capex-vs-opex',
      term: 'Capex and opex',
      evidence: `Your cooler cost you once and shows up nowhere today. Your wages cost ${money(wages)} again, and will again tomorrow.`,
      carriesForward:
        'One kind of spending buys you a machine that keeps working. The other is rent on somebody else. Companies report them separately, and for good reason.',
    });
  }

  // Competition, the day they are actually losing share.
  if (business.rival.active && business.rival.location === business.location) {
    const share = marketShareAgainstRival(outcome.price, business);
    found.push({
      id: 'competition',
      term: 'Competition',
      evidence: `You charged ${money(outcome.price)} and they charged ${money(business.rival.price)}. You got about ${Math.round(share * 100)}% of the street.`,
      carriesForward:
        'Anyone can open next to you. The question that decides whether a business lasts is why a customer would still walk to yours.',
    });
  }

  // Differentiation, once they have answered the rival with something else.
  if (business.rival.active && business.upgrades.freshSqueeze) {
    found.push({
      id: 'differentiation',
      term: 'Differentiation',
      evidence: `Fresh-squeezed means you held ${money(outcome.price)} while they sold at ${money(business.rival.price)} and you still took customers.`,
      carriesForward:
        'Being cheapest is a race anyone can join. Being different is a reason to pay more. That reason is what investors call a moat.',
    });
  }

  // Dividends: the stand paid them while a manager did the work.
  if (business.staff.manager && outcome.profit > 0) {
    found.push({
      id: 'dividends',
      term: 'Owning versus working',
      evidence: `Your manager ran today and the stand still made ${money(outcome.profit)} for you.`,
      carriesForward:
        'You got paid for owning it, not for working it. When a company sends its owners cash for the same reason, it is called a dividend.',
    });
  }

  // Marketing, the day the sign is up and the crowd is bigger for it.
  if (business.upgrades.bigSign) {
    found.push({
      id: 'marketing',
      term: 'Marketing',
      evidence: `Your sign put about ${SIGN_INTERCEPT_BONUS} more people in front of the stand today. It cost ${money(UPGRADES.bigSign.cost)}, once.`,
      carriesForward:
        'Money spent on being noticed. Every company spends it, and the only question worth asking is whether more came back than went out.',
    });
  }

  // Delegating, the day a wage buys the kid's own hands back.
  if (business.staff.manager && standCount(business) >= 2) {
    const minded = standLines(business).filter((line) => line.runBy !== 'you').length;
    found.push({
      id: 'delegation',
      term: 'Delegating',
      evidence: `You are one person. Paying ${money(STAFF.manager.wage)} a day to mind ${minded === 1 ? 'a stand' : `${minded} stands`} is what let you go and work another one.`,
      carriesForward:
        'This is why companies hire. A wage buys back the founder\u2019s time, and their time was the thing capping the whole business.',
    });
  }

  // Compounding, once reinvestment has visibly raised the ceiling.
  if (ownsCapex && history.length >= 8) {
    const early = history.slice(0, 4).reduce((sum, day) => sum + day.profit, 0) / 4;
    const recent = history.slice(-4).reduce((sum, day) => sum + day.profit, 0) / 4;
    if (recent > early * 1.3 && early > 0) {
      found.push({
        id: 'compounding',
        term: 'Compounding',
        evidence: `You were averaging ${money(round2(early))} a day. You are now averaging ${money(round2(recent))}, because profit bought capacity that made more profit.`,
        carriesForward:
          'Money left in a business earns money, which is then also left in. That loop is the single most powerful idea in investing.',
      });
    }
  }

  return found;
}

/* ------------------------------------------------------------------ *
 * Stage 3 vocabulary
 *
 * Same rule again: nothing fires until the kid has lived it. A child who never
 * opens a shop never hears "break-even", and a child who never borrows never
 * hears "interest" — which is the point of a word being a reward rather than a
 * lesson. It also means the two words most likely to matter later arrive
 * attached to a rent they were genuinely worried about paying.
 * ------------------------------------------------------------------ */

export function deriveAct3Insights(
  outcome: DayOutcome,
  business: BusinessState,
): Insight[] {
  const found: Insight[] = [];
  const money = (n: number) => `$${n.toFixed(2)}`;

  if (business.shop.open) {
    const owed = shopDailyCost(business.shop);
    const perCup = outcome.ingredients.perCup;
    const cups = shopBreakEvenCups(business.shop, outcome.price, perCup);
    if (cups !== null) {
      found.push({
        id: 'break-even',
        term: 'Break-even',
        evidence: `The shop owes ${money(owed)} before it opens. At ${money(outcome.price)} a cup you keep ${money(round2(outcome.price - perCup))}, so ${plural(cups, 'cup')} is the point where today stops losing money.`,
        carriesForward:
          'Every business has a number of sales below which it loses money. A big rent pushes that number up fast, and that is what makes a quiet week dangerous.',
      });
    }
  }

  if (business.loan) {
    found.push({
      id: 'interest',
      term: 'Interest',
      evidence: `You borrowed ${money(business.loan.principal)} and you will hand back ${money(business.loan.total)}. Today\u2019s ${money(business.loan.daily)} was owed whatever happened.`,
      carriesForward:
        'The price of borrowing money. It is owed on a bad day as well as a good one, which is exactly what makes it sharper than selling a slice of the company.',
    });
  }

  return found;
}
