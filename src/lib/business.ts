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
  type GameState,
  type Weather,
  round2,
  toCents,
} from './simulation';

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
    blurb: 'Runs the stand without you. You still get paid.',
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
 * This is the stand's version of a subscription, and Act 3 pays extra for it.
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

export const ACT2_DAYS = 14;
/** Profitable manager-run days needed to prove it runs without the kid. */
export const HANDS_OFF_DAYS_REQUIRED = 3;

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
  };
}

/* ------------------------------------------------------------------ *
 * Deriving the day
 * ------------------------------------------------------------------ */

export function serviceCapacity(business: BusinessState): number {
  return (
    BASE_SERVICE_CAPACITY +
    (business.upgrades.cooler ? COOLER_CAPACITY : 0) +
    (business.staff.helper ? HELPER_CAPACITY : 0) +
    (business.staff.manager ? MANAGER_CAPACITY : 0)
  );
}

export function dailyFixedCosts(business: BusinessState): FixedCostLine[] {
  const lines: FixedCostLine[] = [
    { label: `${LOCATIONS[business.location].name} pitch`, amount: LOCATIONS[business.location].fee },
  ];
  if (business.staff.helper) lines.push({ label: 'Helper wages', amount: STAFF.helper.wage });
  if (business.staff.manager) lines.push({ label: 'Manager wages', amount: STAFF.manager.wage });
  return lines;
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

export function deriveDayParams(business: BusinessState, myPrice: number): DayParams {
  const fixedCosts = dailyFixedCosts(business);
  return {
    demandIntercept: ECON.DEMAND_INTERCEPT + (business.upgrades.bigSign ? SIGN_INTERCEPT_BONUS : 0),
    demandSlope: business.upgrades.freshSqueeze ? QUALITY_SLOPE : ECON.DEMAND_SLOPE,
    demandMultiplier: LOCATIONS[business.location].demandMultiplier,
    fixedCosts,
    serviceCapacity: serviceCapacity(business),
    marketShare: marketShareAgainstRival(myPrice, business),
    equityShare: 0,
    // Act 2 onwards the stand keeps trading; there is no fixed final day.
    lastDay: null,
    cashFloor: ECON.STARTING_CASH,
    subscribers: business.regulars,
    subscriberDiscount: ROUND.DISCOUNT,
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
 * This is the number Act 3 pays extra for, so it is computed from cups actually
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
 * A buyer in Act 3 is buying next month's profit, not last week's, so they pay
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
}

export function act2Progress(business: BusinessState, standDay: number): Act2Progress {
  const complete = business.staff.manager && business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED;
  let nextStep: string;
  if (!business.staff.manager) {
    nextStep = 'Hire a manager so the stand runs without you.';
  } else if (business.handsOffDays < HANDS_OFF_DAYS_REQUIRED) {
    nextStep = `${HANDS_OFF_DAYS_REQUIRED - business.handsOffDays} more profitable days run by your manager.`;
  } else {
    nextStep = 'Your stand runs itself.';
  }
  return {
    handsOffDays: business.handsOffDays,
    required: HANDS_OFF_DAYS_REQUIRED,
    complete,
    nextStep,
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

/* ------------------------------------------------------------------ *
 * Trailing performance — the number Act 3 will price
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
 * before it. Act 3 uses this to justify a higher multiple.
 *
 * The window is seven days rather than five for a specific reason: weather
 * swings daily demand by up to 50%, and at five days that noise dominated the
 * signal so completely that the same run could read -28% or +14% depending on
 * where you cut it. Every strategy came out "shrinking", which made the growth
 * premium in Act 3 unreachable. Seven days lets a full weather cycle average
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

/** Weather-neutral: how good is the business, ignoring one lucky day. */
export function isRunningProfitably(history: DayRecord[], days = 5): boolean {
  if (history.length < days) return false;
  return trailingDailyProfit(history, days) > 0;
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

/** Cups the manager will make: enough for a normal day at this capacity. */
export function managerBatch(business: BusinessState, weather: Weather = 'mild'): number {
  const capacity = serviceCapacity(business);
  const rough = Math.round(28 * LOCATIONS[business.location].demandMultiplier);
  return Math.min(capacity, Math.max(12, rough));
}

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
