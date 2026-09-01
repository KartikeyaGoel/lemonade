/**
 * Lemonade Stand — Act 1 simulation.
 *
 * Pure module. No React, no browser APIs, no I/O. Everything here is a
 * function of its arguments, so the whole game can be unit tested and later
 * lifted to a server without a rewrite.
 *
 * The public entry point is `runDay(state, decisions) => DayOutcome`.
 */

/* ------------------------------------------------------------------ *
 * Economics
 *
 * These are the tuned numbers from PRODUCT.md. On a mild day they put the
 * profit-maximising price at $1.60 (28 cups, ~$34 profit) while a cheap
 * $0.75 price sells far more cups for far less money. That gap is the
 * entire lesson of Act 1, so treat these as load-bearing.
 * ------------------------------------------------------------------ */

export const ECON = {
  STARTING_CASH: 20,

  LEMON_COST: 0.5,
  CUPS_PER_LEMON: 4,

  SUGAR_PACK_COST: 0.4,
  SUGAR_SERVINGS_PER_PACK: 10,

  CUP_PACK_COST: 0.3,
  CUPS_PER_CUP_PACK: 10,

  STAND_FEE: 5,

  /** A lemon is usable on the day it is bought plus the two days after. */
  LEMON_SHELF_LIFE_DAYS: 3,

  /** cups_wanted = max(0, INTERCEPT - SLOPE * price) * weather */
  DEMAND_INTERCEPT: 60,
  DEMAND_SLOPE: 20,

  /** The highest price any customer in town will ever pay. */
  MAX_RESERVATION_PRICE: 3,

  TOTAL_DAYS: 7,

  MIN_PRICE: 0,
  MAX_PRICE: 5,
} as const;

export type Weather = 'cold' | 'mild' | 'hot';

export const WEATHER_MULTIPLIER: Record<Weather, number> = {
  cold: 0.6,
  mild: 1.0,
  hot: 1.5,
};

/* ------------------------------------------------------------------ *
 * Forecast
 *
 * The forecast is a hint, never a promise. Each forecast leans towards one
 * kind of day but can resolve to any of them, which is what makes a single
 * bad day meaningless and a seven-day average meaningful.
 * ------------------------------------------------------------------ */

export type Forecast = 'probably-cold' | 'probably-mild' | 'probably-hot';

const FORECAST_ODDS: Record<Forecast, Array<[Weather, number]>> = {
  'probably-cold': [
    ['cold', 0.6],
    ['mild', 0.3],
    ['hot', 0.1],
  ],
  'probably-mild': [
    ['cold', 0.25],
    ['mild', 0.5],
    ['hot', 0.25],
  ],
  'probably-hot': [
    ['cold', 0.1],
    ['mild', 0.3],
    ['hot', 0.6],
  ],
};

export const FORECAST_COPY: Record<Forecast, { headline: string; hint: string }> = {
  'probably-cold': { headline: 'Probably cool', hint: 'Fewer people out walking.' },
  'probably-mild': { headline: 'Probably mild', hint: 'A normal sort of day.' },
  'probably-hot': { headline: 'Probably hot', hint: 'Thirsty crowds, maybe.' },
};

export const WEATHER_COPY: Record<Weather, string> = {
  cold: 'It turned out cool',
  mild: 'It turned out mild',
  hot: 'It turned out hot',
};

/* ------------------------------------------------------------------ *
 * Deterministic RNG (mulberry32)
 *
 * The seed lives in game state and is threaded through every draw, so the
 * same state plus the same decisions always produces the same day. Tests
 * depend on this; so does replaying a day after a page reload.
 * ------------------------------------------------------------------ */

function nextSeed(seed: number): number {
  return (seed + 0x6d2b79f5) >>> 0;
}

/** Returns a float in [0, 1) for a given seed, without advancing it. */
function randomFrom(seed: number): number {
  let t = seed >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A tiny cursor so a sequence of draws reads linearly. */
class Rng {
  constructor(private seed: number) {
    this.seed = seed >>> 0;
  }
  next(): number {
    this.seed = nextSeed(this.seed);
    return randomFrom(this.seed);
  }
  get currentSeed(): number {
    return this.seed;
  }
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

/** Lemons bought on the same day, tracked together so they expire together. */
export interface LemonLot {
  lemons: number;
  purchasedOnDay: number;
}

export interface DayRecord {
  day: number;
  weather: Weather;
  price: number;
  cupsSold: number;
  cupsWanted: number;
  revenue: number;
  profit: number;
  cashAfter: number;
  /** Cups sold to punch-card regulars, who come whatever the weather. */
  subscriberCups?: number;
  /** Share of the street that came to them, after competition. 1 means alone. */
  marketShare?: number;
  /** Everything owed today whether or not anyone bought. */
  fixedCost?: number;
  /** Lemons bought and thrown away. Money spent on nothing. */
  spoiledLemons?: number;
  /** What the sky was promised to do, as opposed to what it did. */
  forecast?: Forecast;
  /**
   * The seed as it stood *before* this day was played.
   *
   * Kept so the day can be played again against a different plan. Without it a
   * finished day is a number in a list; with it, the crowd that turned up is
   * reproducible, and "the same people, twenty cents dearer" becomes a question
   * the kid can actually ask. See `rehearseDay`.
   */
  seedBefore?: number;
}

export interface GameState {
  /** 1-based index of the day about to be played. */
  day: number;
  cash: number;
  lemonLots: LemonLot[];
  sugarServings: number;
  cupsInStock: number;
  /** Forecast for `day`. Generated one day ahead so the morning can show it. */
  forecast: Forecast;
  seed: number;
  history: DayRecord[];
  status: 'playing' | 'finished';
}

export interface Decisions {
  buyLemons: number;
  buySugarPacks: number;
  buyCupPacks: number;
  /** Price per cup, in dollars. */
  price: number;
}

/* ------------------------------------------------------------------ *
 * Derived read-only helpers
 *
 * The UI needs these live, before a day is run, to show the kid what their
 * money buys. They are exported so no arithmetic is duplicated in React.
 * ------------------------------------------------------------------ */

export function totalLemons(lots: LemonLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.lemons, 0);
}

export function purchaseCost(decisions: Pick<Decisions, 'buyLemons' | 'buySugarPacks' | 'buyCupPacks'>) {
  const lemons = round2(decisions.buyLemons * ECON.LEMON_COST);
  const sugar = round2(decisions.buySugarPacks * ECON.SUGAR_PACK_COST);
  const cups = round2(decisions.buyCupPacks * ECON.CUP_PACK_COST);
  return { lemons, sugar, cups, total: round2(lemons + sugar + cups) };
}

/**
 * How many cups the kid could actually pour, given a pantry. Whichever
 * ingredient runs out first is the binding constraint — that is the whole
 * point, and the UI names it.
 */
export function cupsMakeableFrom(lemons: number, sugarServings: number, cupsInStock: number) {
  const fromLemons = Math.floor(lemons * ECON.CUPS_PER_LEMON);
  const cups = Math.min(fromLemons, Math.floor(sugarServings), Math.floor(cupsInStock));
  let limitedBy: 'lemons' | 'sugar' | 'cups' | 'none' = 'none';
  if (cups === 0 || cups === fromLemons) limitedBy = 'lemons';
  if (cups === Math.floor(sugarServings) && Math.floor(sugarServings) <= fromLemons) limitedBy = 'sugar';
  if (Math.floor(cupsInStock) <= Math.min(fromLemons, Math.floor(sugarServings))) limitedBy = 'cups';
  return { cups: Math.max(0, cups), limitedBy };
}

/** Pantry after a purchase but before the day runs. */
export function pantryAfterPurchase(state: GameState, decisions: Decisions) {
  return {
    lemons: totalLemons(state.lemonLots) + decisions.buyLemons,
    sugarServings: state.sugarServings + decisions.buySugarPacks * ECON.SUGAR_SERVINGS_PER_PACK,
    cupsInStock: state.cupsInStock + decisions.buyCupPacks * ECON.CUPS_PER_CUP_PACK,
  };
}

/** The spec's demand curve, in one place. */
export function cupsWantedAt(price: number, weather: Weather): number {
  const raw = ECON.DEMAND_INTERCEPT - ECON.DEMAND_SLOPE * price;
  return Math.max(0, raw) * WEATHER_MULTIPLIER[weather];
}

/** Lemons needed to pour `cups`. You cut a whole lemon even for one cup. */
export function lemonsNeededFor(cups: number): number {
  return Math.ceil(cups / ECON.CUPS_PER_LEMON);
}

/**
 * Ingredient cost of the cups actually sold. Derived, never hardcoded, so
 * the per-cup number on screen is always the kid's real arithmetic.
 */
export function ingredientCostOf(cupsSold: number) {
  const lemonsUsed = lemonsNeededFor(cupsSold);
  const lemons = round2(lemonsUsed * ECON.LEMON_COST);
  const sugar = round2(cupsSold * (ECON.SUGAR_PACK_COST / ECON.SUGAR_SERVINGS_PER_PACK));
  const cups = round2(cupsSold * (ECON.CUP_PACK_COST / ECON.CUPS_PER_CUP_PACK));
  const total = round2(lemons + sugar + cups);
  return {
    lemonsUsed,
    lemons,
    sugar,
    cups,
    total,
    perCup: cupsSold > 0 ? total / cupsSold : 0,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds to cents exactly the way the UI prints money (`toFixed(2)`).
 *
 * Any figure the kid is shown, and any figure derived from a figure they are
 * shown, must go through this. Otherwise two numbers on screen can differ by
 * a cent from the third, and the P&L stops being verifiable by hand.
 */
export function toCents(n: number): number {
  return Number(n.toFixed(2));
}

/* ------------------------------------------------------------------ *
 * Outcome
 * ------------------------------------------------------------------ */

/** One passer-by, kept so the run-the-day animation has real people to draw. */
export interface Customer {
  id: number;
  /** The most this person would ever pay for a cup. */
  reservationPrice: number;
  outcome: 'bought' | 'too-expensive' | 'sold-out';
  /**
   * A regular has already bought a punch card, so they are not deciding
   * anything today — they turn up and are served. Drawn differently, because
   * seeing your regulars arrive first on a cold day is the whole lesson.
   */
  kind: 'passerby' | 'regular';
}

export interface DayOutcome {
  day: number;
  forecast: Forecast;
  weather: Weather;
  price: number;

  purchases: {
    lemons: number;
    sugarPacks: number;
    cupPacks: number;
    cost: ReturnType<typeof purchaseCost>;
    clamped: boolean;
  };

  passersby: number;
  cupsMakeable: number;
  cupsWanted: number;
  cupsSold: number;
  walkedAwayOnPrice: number;
  turnedAwaySoldOut: number;
  customers: Customer[];

  revenue: number;
  /** Cups served to punch-card regulars, at the discounted standing price. */
  subscriberCups: number;
  subscriberPrice: number;
  subscriberRevenue: number;
  /** Revenue from people who walked past today and chose to buy. */
  walkupRevenue: number;
  ingredients: ReturnType<typeof ingredientCostOf>;
  grossProfit: number;
  grossMarginPerCup: number;
  /** Total of every fixed cost owed today. Act 1: just the stand fee. */
  standFee: number;
  fixedCostLines: FixedCostLine[];
  profitBeforeEquity: number;
  /** Paid to an outside owner, if the kid has sold a share. */
  investorCut: number;
  params: DayParams;
  spoiledLemons: number;
  spoilageCost: number;
  profit: number;

  cashBefore: number;
  cashAfter: number;
  /** True when the $20 starting float caught a loss that would go below it. */
  cashFloored: boolean;

  nextState: GameState;
}

/* ------------------------------------------------------------------ *
 * The day loop
 * ------------------------------------------------------------------ */

export function createInitialState(seed = 20240601): GameState {
  const rng = new Rng(seed);
  const forecast = drawForecast(rng);
  return {
    day: 1,
    cash: ECON.STARTING_CASH,
    lemonLots: [],
    sugarServings: 0,
    cupsInStock: 0,
    forecast,
    seed: rng.currentSeed,
    history: [],
    status: 'playing',
  };
}

function drawForecast(rng: Rng): Forecast {
  const roll = rng.next();
  if (roll < 1 / 3) return 'probably-cold';
  if (roll < 2 / 3) return 'probably-mild';
  return 'probably-hot';
}

function drawWeather(rng: Rng, forecast: Forecast): Weather {
  const roll = rng.next();
  let acc = 0;
  for (const [weather, odds] of FORECAST_ODDS[forecast]) {
    acc += odds;
    if (roll < acc) return weather;
  }
  return 'mild';
}

/**
 * Builds the queue of people who walk past the stand today.
 *
 * The headline number stays exactly the spec's demand curve: precisely
 * `cupsWanted` people are willing to pay today's price. We then hand each
 * person a reservation price consistent with their decision purely so the
 * animation has something honest to show. No hidden randomness in the money.
 */
function buildCustomers(
  rng: Rng,
  price: number,
  weather: Weather,
  walkupCapacity: number,
  params: DayParams,
  cupsWanted: number,
  subscriberCups: number,
) {
  const passersby = Math.round(
    params.demandIntercept * WEATHER_MULTIPLIER[weather] * params.demandMultiplier * params.marketShare,
  );
  const willing = Math.min(passersby, Math.round(cupsWanted));

  const flags: boolean[] = Array.from({ length: passersby }, (_, i) => i < willing);
  // Fisher-Yates, so the buyers are spread through the day rather than bunched.
  for (let i = flags.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }

  // Regulars first. They have already paid, so they are not making a decision
  // and their reservation price is irrelevant — but they still take cups out
  // of the pantry, and on a cold day they are the only people who came.
  const customers: Customer[] = Array.from({ length: subscriberCups }, (_, i) => ({
    id: i,
    reservationPrice: price,
    outcome: 'bought' as const,
    kind: 'regular' as const,
  }));

  let walkupSold = 0;
  let walkedAwayOnPrice = 0;
  let turnedAwaySoldOut = 0;

  for (let i = 0; i < flags.length; i++) {
    const isWilling = flags[i];
    const reservationPrice = isWilling
      ? round2(price + rng.next() * Math.max(0, ECON.MAX_RESERVATION_PRICE - price))
      : round2(rng.next() * price);

    let outcome: Customer['outcome'];
    if (!isWilling) {
      outcome = 'too-expensive';
      walkedAwayOnPrice++;
    } else if (walkupSold < walkupCapacity) {
      outcome = 'bought';
      walkupSold++;
    } else {
      outcome = 'sold-out';
      turnedAwaySoldOut++;
    }

    customers.push({
      id: subscriberCups + i,
      reservationPrice,
      outcome,
      kind: 'passerby',
    });
  }

  return {
    passersby,
    willing,
    customers,
    walkupSold,
    sold: subscriberCups + walkupSold,
    walkedAwayOnPrice,
    turnedAwaySoldOut,
  };
}

/** Spends ingredients oldest-lemons-first, then ages and discards the rest. */
function consumeAndAge(lots: LemonLot[], lemonsUsed: number, day: number) {
  const remaining: LemonLot[] = lots.map((lot) => ({ ...lot }));
  let toUse = lemonsUsed;

  for (const lot of remaining) {
    if (toUse <= 0) break;
    const take = Math.min(lot.lemons, toUse);
    lot.lemons -= take;
    toUse -= take;
  }

  let spoiledLemons = 0;
  const kept: LemonLot[] = [];
  for (const lot of remaining) {
    if (lot.lemons <= 0) continue;
    const lastUsableDay = lot.purchasedOnDay + ECON.LEMON_SHELF_LIFE_DAYS - 1;
    if (day >= lastUsableDay) {
      spoiledLemons += lot.lemons;
    } else {
      kept.push(lot);
    }
  }

  return { lots: kept, spoiledLemons };
}

/* ------------------------------------------------------------------ *
 * Day parameters
 *
 * Act 1 is a bare stand: one fixed fee, a fixed demand curve, no rivals.
 * Later acts change those numbers — a cooler raises capacity, a park pitch
 * raises both demand and rent, fresh-squeezing makes customers less
 * price-sensitive, a rival takes a share of the street, an investor takes a
 * share of the profit.
 *
 * Rather than growing `runDay` a new branch per act, everything variable is
 * hoisted into `DayParams`. Act 1 simply uses the defaults, which is why the
 * Act 1 tests keep passing untouched. The later acts compute their params in
 * `business.ts` and hand them in.
 * ------------------------------------------------------------------ */

export interface FixedCostLine {
  label: string;
  amount: number;
}

export interface DayParams {
  /** Cups wanted at a price of zero, before weather. Awareness raises it. */
  demandIntercept: number;
  /** How fast customers leave as the price rises. Quality lowers it. */
  demandSlope: number;
  /** Multiplies demand. Location does this. */
  demandMultiplier: number;
  /** Every cost owed today whether or not anyone buys. */
  fixedCosts: FixedCostLine[];
  /** Hard ceiling on cups servable in a day, whatever the pantry holds. */
  serviceCapacity: number;
  /** Fraction of the street's demand that comes to you, after competition. */
  marketShare: number;
  /** Fraction of profit owed to an outside owner. */
  equityShare: number;
  /**
   * The day on which the run ends, or null if the stand just keeps trading.
   *
   * Act 1 is a fixed seven-day arc. Later acts are open-ended, and without
   * this the stand marked itself "finished" on every single day past the
   * seventh, which broke both the close screen and any further trading.
   */
  lastDay: number | null;
  /**
   * The floor under the cash balance, or null for none.
   *
   * Act 1 never lets a kid go broke: a bad day is a lesson, and a game-over
   * screen on day three is not. But the floor quietly creates money, which is
   * fine when the stand is the whole game and wrong the moment the stand is
   * feeding a portfolio — a losing Saturday would be topped back up to twenty
   * dollars and the kid would end the week richer for it.
   */
  cashFloor: number | null;
  /**
   * How many punch-card regulars have a standing cup coming to them today.
   *
   * These people paid up front, so they arrive whatever the sky is doing. They
   * are served before the queue and at a discount, which is the trade: less
   * money per cup, in exchange for money that does not depend on the weather.
   */
  subscribers: number;
  /** The discount a punch card buys, as a fraction of the day's list price. */
  subscriberDiscount: number;
}

export const DEFAULT_DAY_PARAMS: DayParams = {
  demandIntercept: ECON.DEMAND_INTERCEPT,
  demandSlope: ECON.DEMAND_SLOPE,
  demandMultiplier: 1,
  fixedCosts: [{ label: 'Stand fee', amount: ECON.STAND_FEE }],
  serviceCapacity: Number.POSITIVE_INFINITY,
  marketShare: 1,
  equityShare: 0,
  lastDay: ECON.TOTAL_DAYS,
  cashFloor: ECON.STARTING_CASH,
  subscribers: 0,
  subscriberDiscount: 0,
};

export function resolveDayParams(params?: Partial<DayParams>): DayParams {
  return { ...DEFAULT_DAY_PARAMS, ...(params ?? {}) };
}

export function totalFixedCost(lines: FixedCostLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amount, 0));
}

/** The demand curve, generalised over the day's parameters. */
export function cupsWantedWith(price: number, weather: Weather, params: DayParams): number {
  const raw = params.demandIntercept - params.demandSlope * price;
  return Math.max(0, raw) * WEATHER_MULTIPLIER[weather] * params.demandMultiplier * params.marketShare;
}

/**
 * Runs one day of business.
 *
 * Purchases happen in the morning and leave cash immediately; sales come in
 * over the day; the stand fee is charged whether anyone shows up or not.
 * Profit is reported on the cups actually sold, with spoiled lemons broken
 * out as their own line, so every figure on the close screen is arithmetic
 * the kid can redo by hand.
 */
export function runDay(
  state: GameState,
  decisions: Decisions,
  paramsInput?: Partial<DayParams>,
): DayOutcome {
  const params = resolveDayParams(paramsInput);
  const fixedCost = totalFixedCost(params.fixedCosts);

  if (state.status === 'finished') {
    throw new Error('The week is over — start a new week before running another day.');
  }

  const rng = new Rng(state.seed);

  const price = clampPrice(decisions.price);

  // Never let a mistyped order overdraw the account.
  const requested = {
    buyLemons: Math.max(0, Math.floor(decisions.buyLemons)),
    buySugarPacks: Math.max(0, Math.floor(decisions.buySugarPacks)),
    buyCupPacks: Math.max(0, Math.floor(decisions.buyCupPacks)),
  };
  const affordable = clampPurchaseToCash(requested, state.cash);
  const cost = purchaseCost(affordable);

  const pantry = pantryAfterPurchase(state, { ...affordable, price });
  const { cups: pourable } = cupsMakeableFrom(pantry.lemons, pantry.sugarServings, pantry.cupsInStock);
  // You can only serve as fast as your stand and staff allow, however much
  // lemonade is sitting in the pantry.
  const cupsMakeable = Math.min(pourable, Math.floor(params.serviceCapacity));

  const weather = drawWeather(rng, state.forecast);
  const cupsWanted = cupsWantedWith(price, weather, params);

  // Regulars are served first. They paid in advance, so pouring their cup for
  // a stranger at full price would be spending money the kid already took.
  const subscriberCups = Math.max(0, Math.min(Math.floor(params.subscribers), cupsMakeable));
  const walkupCapacity = Math.max(0, cupsMakeable - subscriberCups);

  const crowd = buildCustomers(
    rng,
    price,
    weather,
    walkupCapacity,
    params,
    cupsWanted,
    subscriberCups,
  );
  const cupsSold = crowd.sold;

  const subscriberPrice = toCents(price * (1 - params.subscriberDiscount));
  const subscriberRevenue = round2(subscriberCups * subscriberPrice);
  const walkupRevenue = round2(crowd.walkupSold * price);
  const revenue = round2(subscriberRevenue + walkupRevenue);
  const ingredients = ingredientCostOf(cupsSold);
  const grossProfit = round2(revenue - ingredients.total);
  // Derived from the rounded per-cup cost, for the same reason: the close
  // screen shows both, and they must reconcile on paper. With punch cards in
  // play the two prices blend, so we use what was actually taken per cup
  // rather than the list price — otherwise the margin would not tie back.
  const realisedPrice = cupsSold > 0 ? toCents(revenue / cupsSold) : price;
  const grossMarginPerCup =
    cupsSold > 0 ? toCents(realisedPrice - toCents(ingredients.perCup)) : toCents(price);

  // Ingredients leave the pantry; leftovers age and may be thrown out.
  const lotsWithPurchase: LemonLot[] = [
    ...state.lemonLots.map((lot) => ({ ...lot })),
    ...(affordable.buyLemons > 0 ? [{ lemons: affordable.buyLemons, purchasedOnDay: state.day }] : []),
  ];
  const aged = consumeAndAge(lotsWithPurchase, ingredients.lemonsUsed, state.day);
  const spoilageCost = round2(aged.spoiledLemons * ECON.LEMON_COST);

  const profitBeforeEquity = round2(revenue - ingredients.total - fixedCost - spoilageCost);
  // An outside owner is paid out of profit, and only when there is profit.
  const investorCut =
    params.equityShare > 0 && profitBeforeEquity > 0
      ? round2(profitBeforeEquity * params.equityShare)
      : 0;
  const profit = round2(profitBeforeEquity - investorCut);

  // Cash is a cash story: money out for shopping and wages, money in from sales.
  const rawCash = round2(state.cash - cost.total - fixedCost + revenue - investorCut);
  const cashAfter = params.cashFloor === null ? rawCash : Math.max(rawCash, params.cashFloor);
  const cashFloored = cashAfter > rawCash;

  const record: DayRecord = {
    day: state.day,
    weather,
    price,
    cupsSold,
    cupsWanted: Math.round(cupsWanted),
    revenue,
    profit,
    cashAfter,
    subscriberCups,
    marketShare: params.marketShare,
    fixedCost,
    spoiledLemons: aged.spoiledLemons,
    forecast: state.forecast,
    seedBefore: state.seed,
  };

  const isLastDay = params.lastDay !== null && state.day >= params.lastDay;
  const nextForecast = drawForecast(rng);

  const nextState: GameState = {
    day: state.day + 1,
    cash: cashAfter,
    lemonLots: aged.lots,
    // Unsold lemonade is discarded, but unopened sugar and cups keep.
    sugarServings: Math.max(0, pantry.sugarServings - cupsSold),
    cupsInStock: Math.max(0, pantry.cupsInStock - cupsSold),
    forecast: nextForecast,
    seed: rng.currentSeed,
    history: [...state.history, record],
    status: isLastDay ? 'finished' : 'playing',
  };

  return {
    day: state.day,
    forecast: state.forecast,
    weather,
    price,
    purchases: {
      lemons: affordable.buyLemons,
      sugarPacks: affordable.buySugarPacks,
      cupPacks: affordable.buyCupPacks,
      cost,
      clamped:
        affordable.buyLemons !== requested.buyLemons ||
        affordable.buySugarPacks !== requested.buySugarPacks ||
        affordable.buyCupPacks !== requested.buyCupPacks,
    },
    passersby: crowd.passersby,
    cupsMakeable,
    cupsWanted: Math.round(cupsWanted),
    cupsSold,
    walkedAwayOnPrice: crowd.walkedAwayOnPrice,
    turnedAwaySoldOut: crowd.turnedAwaySoldOut,
    customers: crowd.customers,
    revenue,
    subscriberCups,
    subscriberPrice,
    subscriberRevenue,
    walkupRevenue,
    ingredients,
    grossProfit,
    grossMarginPerCup,
    standFee: fixedCost,
    fixedCostLines: params.fixedCosts,
    profitBeforeEquity,
    investorCut,
    params,
    spoiledLemons: aged.spoiledLemons,
    spoilageCost,
    profit,
    cashBefore: state.cash,
    cashAfter,
    cashFloored,
    nextState,
  };
}

/**
 * Yesterday's crowd, today's plan.
 *
 * The hardest thing to learn from this game is the *derivative*: what happens
 * to the money when you change the price and nothing else. Seven days of play
 * will not teach it, because the weather moves at the same time as the price
 * and the kid cannot tell which one did what. A scientist would hold the world
 * still and change one thing. So we let them.
 *
 * This replays the crowd that actually turned up — same seed, same forecast,
 * same weather — against whatever plan the kid is currently holding. It is a
 * rehearsal, so nothing here is ever saved: the outcome is read and thrown
 * away, and the day they open for real is drawn fresh.
 *
 * Two things it deliberately is not:
 *
 * - It is not a prediction. It answers "if the same people came back" and says
 *   so on screen. Today's sky is unknown and stays unknown, so grinding the
 *   dials against yesterday still loses money when it turns cold — which is
 *   itself the lesson underneath, and the one no projection can teach.
 * - It is not an oracle over data the kid does not have. Every input is a day
 *   they already lived through. Nothing about tomorrow leaks backwards.
 *
 * Returns null for a day recorded before we kept the seed, which is the only
 * honest answer: we cannot reproduce that crowd, so we will not pretend to.
 */
export function rehearseDay(
  state: GameState,
  decisions: Decisions,
  params: Partial<DayParams> | undefined,
  past: DayRecord,
): DayOutcome | null {
  if (past.seedBefore === undefined || past.forecast === undefined) return null;

  // Today's cash and today's pantry — this is a plan for today, and the lemons
  // sitting in the crate are as old as they really are. Only the crowd is
  // borrowed. `status` is forced because a rehearsal after the last day is
  // still a fair question.
  const asItWas: GameState = {
    ...state,
    status: 'playing',
    seed: past.seedBefore,
    forecast: past.forecast,
  };

  return runDay(asItWas, decisions, params);
}

export function clampPrice(price: number): number {
  if (!Number.isFinite(price)) return 0;
  return round2(Math.min(ECON.MAX_PRICE, Math.max(ECON.MIN_PRICE, price)));
}

/** Trims an order, cheapest-priority-last, until it fits the available cash. */
export function clampPurchaseToCash(
  requested: { buyLemons: number; buySugarPacks: number; buyCupPacks: number },
  cash: number,
) {
  const result = { ...requested };
  const order: Array<keyof typeof result> = ['buyLemons', 'buySugarPacks', 'buyCupPacks'];
  while (purchaseCost(result).total > cash) {
    // Shave the biggest line first so the order stays balanced.
    let biggest: keyof typeof result | null = null;
    let biggestCost = 0;
    for (const key of order) {
      if (result[key] <= 0) continue;
      const unit =
        key === 'buyLemons'
          ? ECON.LEMON_COST
          : key === 'buySugarPacks'
            ? ECON.SUGAR_PACK_COST
            : ECON.CUP_PACK_COST;
      const lineCost = result[key] * unit;
      if (lineCost > biggestCost) {
        biggestCost = lineCost;
        biggest = key;
      }
    }
    if (!biggest) break;
    result[biggest] -= 1;
  }
  return result;
}

/** The most cups the kid could fund today, used to size the shopping helper. */
export function suggestedShoppingList(cash: number, targetCups: number) {
  const budget = Math.max(0, cash - ECON.STAND_FEE);
  const lemons = lemonsNeededFor(targetCups);
  const sugarPacks = Math.ceil(targetCups / ECON.SUGAR_SERVINGS_PER_PACK);
  const cupPacks = Math.ceil(targetCups / ECON.CUPS_PER_CUP_PACK);
  return clampPurchaseToCash({ buyLemons: lemons, buySugarPacks: sugarPacks, buyCupPacks: cupPacks }, budget);
}

/* ------------------------------------------------------------------ *
 * "How many cups do you want to make today?"
 *
 * A middle schooler should not be doing three-way inventory arithmetic to
 * open a lemonade stand. They pick one number — a batch size — and the game
 * works out the shopping list, using up what is already in the pantry
 * first. The itemised receipt is then shown to them, which is where unit
 * cost gets taught. One decision in, real arithmetic out.
 * ------------------------------------------------------------------ */

export interface Order {
  buyLemons: number;
  buySugarPacks: number;
  buyCupPacks: number;
}

/** The cheapest shopping list that lets the kid pour `targetCups` today. */
export function orderForTargetCups(state: GameState, targetCups: number): Order {
  const target = Math.max(0, Math.floor(targetCups));
  const have = {
    lemons: totalLemons(state.lemonLots),
    sugar: state.sugarServings,
    cups: state.cupsInStock,
  };

  const lemonsNeeded = Math.max(0, lemonsNeededFor(target) - have.lemons);
  const sugarShort = Math.max(0, target - have.sugar);
  const cupsShort = Math.max(0, target - have.cups);

  return {
    buyLemons: lemonsNeeded,
    buySugarPacks: Math.ceil(sugarShort / ECON.SUGAR_SERVINGS_PER_PACK),
    buyCupPacks: Math.ceil(cupsShort / ECON.CUPS_PER_CUP_PACK),
  };
}

/**
 * The largest batch the kid can actually afford today, keeping the stand fee
 * aside so a big order can never bankrupt them into a forced loss.
 */
export function maxAffordableCups(state: GameState, fixedCost: number = ECON.STAND_FEE): number {
  const budget = round2(state.cash - fixedCost);
  if (budget <= 0) {
    // Broke: they can still sell whatever is already in the pantry.
    const { cups } = cupsMakeableFrom(totalLemons(state.lemonLots), state.sugarServings, state.cupsInStock);
    return cups;
  }
  let best = 0;
  // Demand never exceeds 90 cups (60 x 1.5 hot), so this is a tight bound.
  for (let target = 0; target <= 90; target++) {
    if (purchaseCost(orderForTargetCups(state, target)).total <= budget) best = target;
  }
  return best;
}

/** Profit the kid would have made at `price`, holding today's weather fixed. */
export function counterfactualProfit(
  price: number,
  weather: Weather,
  cupsMakeable: number,
  params?: Partial<DayParams>,
): number {
  const resolved = resolveDayParams(params);
  const wanted = Math.round(cupsWantedWith(price, weather, resolved));
  const sold = Math.min(wanted, cupsMakeable);
  const ing = ingredientCostOf(sold);
  return round2(sold * price - ing.total - totalFixedCost(resolved.fixedCosts));
}

/* ------------------------------------------------------------------ *
 * Batch plan
 *
 * The kid picks a batch size; this is everything the shop screen needs to
 * show them. Note that `cupsMakeable` can exceed what they asked for:
 * lemons are whole and sugar and cups come in tens, so a request for 5 cups
 * buys enough for 8. We show the true number rather than the requested one,
 * because minimum order sizes are themselves part of unit economics.
 * ------------------------------------------------------------------ */

export interface BatchPlan {
  targetCups: number;
  order: Order;
  cost: ReturnType<typeof purchaseCost>;
  /** What they will genuinely be able to pour today. */
  cupsMakeable: number;
  limitedBy: 'lemons' | 'sugar' | 'cups' | 'none';
  /** Cost per cup of this batch if every cup sells. */
  costPerCup: number;
  affordable: boolean;
  pantryAfter: { lemons: number; sugarServings: number; cupsInStock: number };
}

export function batchPlan(state: GameState, targetCups: number): BatchPlan {
  const order = orderForTargetCups(state, targetCups);
  const cost = purchaseCost(order);
  const pantry = pantryAfterPurchase(state, { ...order, price: 0 });
  const { cups, limitedBy } = cupsMakeableFrom(pantry.lemons, pantry.sugarServings, pantry.cupsInStock);
  return {
    targetCups: Math.max(0, Math.floor(targetCups)),
    order,
    cost,
    cupsMakeable: cups,
    limitedBy,
    costPerCup: cups > 0 ? ingredientCostOf(cups).perCup : 0,
    affordable: cost.total <= state.cash,
    pantryAfter: pantry,
  };
}

/* ------------------------------------------------------------------ *
 * Earned insights
 *
 * This is the learning layer, and it is deliberately not a lesson. Nothing
 * here fires until the kid has already felt the thing it names: the word
 * arrives as a label for something they just did, with their own numbers as
 * the evidence. Everything is derived from real history, so the game can
 * never claim a lesson the kid did not actually live through.
 *
 * These are also the exact habits that decide whether Act 4 is investing or
 * a bloodbath — margin, operating leverage, signal versus noise, and
 * return on money put in. Same ideas, bigger numbers, later.
 * ------------------------------------------------------------------ */

export type InsightId =
  | 'revenue'
  | 'unit-cost'
  | 'fixed-cost'
  | 'profit'
  | 'elasticity'
  | 'margin'
  | 'capacity'
  | 'spoilage'
  | 'signal-vs-noise'
  | 'operating-leverage'
  | 'demand-bet'
  | 'return-on-cash'
  | 'capex-vs-opex'
  | 'competition'
  | 'differentiation'
  | 'dividends'
  | 'compounding'
  | 'recurring-revenue'
  | 'business-model'
  | 'equity'
  | 'multiple'
  | 'pe-ratio'
  | 'diversification'
  | 'drawdown'
  | 'thesis'
  | 'luck-vs-skill';

export interface Insight {
  id: InsightId;
  /** The real word. Given only after the experience, never before. */
  term: string;
  /** What it means, in the kid's own numbers. */
  evidence: string;
  /** Why it will matter when they are looking at real companies. */
  carriesForward: string;
}

/**
 * Which insights today's result has genuinely earned.
 *
 * `history` must already include today's record.
 */
export function deriveInsights(outcome: DayOutcome, history: DayRecord[]): Insight[] {
  const found: Insight[] = [];
  const money = (n: number) => `$${n.toFixed(2)}`;

  // Day one always earns the two words the whole game is built on.
  if (outcome.day === 1) {
    found.push({
      id: 'revenue',
      term: 'Revenue',
      evidence: `${outcome.cupsSold} cups x ${money(outcome.price)} = ${money(outcome.revenue)}. That is revenue: all the money that came in.`,
      carriesForward: 'Every company reports this number. It is the top line.',
    });
    found.push({
      id: 'profit',
      term: 'Profit',
      evidence: `${money(outcome.revenue)} in, ${money(outcome.ingredients.total + outcome.standFee + outcome.spoilageCost)} out, so you kept ${money(outcome.profit)}.`,
      carriesForward: 'Revenue is what a business collects. Profit is what it keeps. They are not the same, and the second one is the one that matters.',
    });
  }

  // The stand fee bites hardest on a quiet day.
  if (outcome.cupsSold > 0 && outcome.grossProfit < outcome.standFee * 1.5 && outcome.day <= 3) {
    found.push({
      id: 'fixed-cost',
      term: 'Fixed cost',
      evidence: `The ${money(outcome.standFee)} stand fee was the same today as on any day, whether you sold ${outcome.cupsSold} cups or a hundred.`,
      carriesForward: 'Costs that do not move with sales are why a slow month hurts so much, and why a busy one is so profitable.',
    });
  }

  // Elasticity: earned once they have actually moved the price and seen it.
  const distinctPrices = new Set(history.map((h) => h.price));
  if (distinctPrices.size >= 2 && outcome.walkedAwayOnPrice > 0) {
    found.push({
      id: 'elasticity',
      term: 'Price elasticity',
      evidence: `${outcome.walkedAwayOnPrice} people looked at ${money(outcome.price)} and kept walking. ${outcome.cupsSold} paid it.`,
      carriesForward: 'Raising a price always loses some customers. The question is whether the ones who stay more than make up for it.',
    });
  }

  // Margin: the wall is selling plenty and still not getting richer.
  const bestSoFar = history.reduce((a, h) => Math.max(a, h.profit), -Infinity);
  const soldMoreEarnedLess = history.some(
    (h) => h.cupsSold > outcome.cupsSold && h.profit < outcome.profit,
  );
  if (outcome.cupsSold >= 30 || soldMoreEarnedLess) {
    found.push({
      id: 'margin',
      term: 'Gross margin',
      evidence: `You keep ${money(outcome.grossMarginPerCup)} of every ${money(outcome.price)} cup, because each one costs ${money(outcome.ingredients.perCup)} to make.`,
      carriesForward: soldMoreEarnedLess
        ? 'You have now had a day where you sold more cups and made less money. Volume is not the goal. Margin times volume is.'
        : 'Two businesses can sell the same amount and one keeps far more of it. That gap is margin.',
    });
  }

  // Capacity: they ran out with customers still queueing.
  if (outcome.turnedAwaySoldOut > 0) {
    const lost = round2(outcome.turnedAwaySoldOut * outcome.grossMarginPerCup);
    found.push({
      id: 'capacity',
      term: 'Capacity',
      evidence: `You sold out. ${outcome.turnedAwaySoldOut} more people wanted a cup, which is about ${money(lost)} of profit you could not collect.`,
      carriesForward: 'Demand you cannot serve is invisible on a P&L. Growing companies spend money to stop leaving it behind.',
    });
  }

  if (outcome.spoiledLemons > 0) {
    found.push({
      id: 'spoilage',
      term: 'Spoilage',
      evidence: `${outcome.spoiledLemons} lemons went bad before you could use them. That is ${money(outcome.spoilageCost)} of your money in the bin.`,
      carriesForward: 'Stock sitting unsold is money doing nothing, and some of it rots. Real businesses obsess over this.',
    });
  }

  // Signal vs noise: needs at least three days to be an honest claim.
  if (history.length >= 3) {
    const avg = round2(history.reduce((sum, h) => sum + h.profit, 0) / history.length);
    const worst = history.reduce((a, h) => Math.min(a, h.profit), Infinity);
    found.push({
      id: 'signal-vs-noise',
      term: 'Signal vs noise',
      evidence: `Your best day was ${money(bestSoFar)} and your worst ${money(worst)}, but your average across ${history.length} days is ${money(avg)}.`,
      carriesForward: 'One day tells you almost nothing, because weather moves it. The average is the thing that is actually true about your business.',
    });
  }

  // Operating leverage: the same fee spread over more cups.
  if (history.length >= 4) {
    const feePerCup = outcome.cupsSold > 0 ? round2(outcome.standFee / outcome.cupsSold) : 0;
    if (feePerCup > 0) {
      found.push({
        id: 'operating-leverage',
        term: 'Operating leverage',
        evidence: `Split across ${outcome.cupsSold} cups, the ${money(outcome.standFee)} fee cost you ${money(feePerCup)} a cup. On a 10 cup day it would be ${money(round2(outcome.standFee / 10))} a cup.`,
        carriesForward: 'Selling more does not just add profit, it makes every cup more profitable. This is why growth is worth so much.',
      });
    }
  }

  // Calibration. The batch size the kid chose was a bet on how busy the day
  // would be: they read a forecast, formed a view, and committed real money
  // to it before knowing the answer. That is structurally the same act as
  // buying a share, so it is worth naming and scoring honestly.
  if (outcome.day >= 2 && outcome.cupsMakeable > 0) {
    const soldShare = outcome.cupsSold / outcome.cupsMakeable;
    const forecastCopy = FORECAST_COPY[outcome.forecast].headline.toLowerCase();

    if (outcome.turnedAwaySoldOut > 0) {
      found.push({
        id: 'demand-bet',
        term: 'Your call was too cautious',
        evidence: `The forecast said ${forecastCopy}. You made ${outcome.cupsMakeable} cups and could have sold ${outcome.cupsSold + outcome.turnedAwaySoldOut}.`,
        carriesForward: 'You had the right read and did not back it hard enough. Being right is only worth something if you acted on it.',
      });
    } else if (soldShare < 0.55) {
      found.push({
        id: 'demand-bet',
        term: 'Your call was too optimistic',
        evidence: `The forecast said ${forecastCopy}, so you made ${outcome.cupsMakeable} cups. You sold ${outcome.cupsSold}. The rest was money already spent.`,
        carriesForward: 'A good story about the future is not the same as a good result. You committed real money to a guess, and the guess was rich.',
      });
    } else if (soldShare >= 0.8) {
      found.push({
        id: 'demand-bet',
        term: 'You judged the day well',
        evidence: `You made ${outcome.cupsMakeable} cups and sold ${outcome.cupsSold} of them.`,
        carriesForward: 'You read a hint about the future, put money behind it, and got it about right. Do that repeatedly and it stops being luck.',
      });
    }
  }

  // Return on cash: the bridge to Act 4.
  if (history.length >= ECON.TOTAL_DAYS) {
    const spent = round2(outcome.purchases.cost.total + outcome.standFee);
    if (spent > 0) {
      found.push({
        id: 'return-on-cash',
        term: 'Return on money put in',
        evidence: `Today you put ${money(spent)} into the stand and got ${money(outcome.revenue)} back.`,
        carriesForward: 'This is the only question an investor ever asks: if I put money in here, how much comes back, and how sure am I?',
      });
    }
  }

  return found;
}

/**
 * Running scoreboard of what the kid has demonstrably worked out. Decisions,
 * not quiz scores — this is what the parent view will eventually read from.
 */
export function weekSummary(history: DayRecord[]) {
  if (history.length === 0) {
    return {
      days: 0,
      totalProfit: 0,
      bestDay: null as DayRecord | null,
      averageProfit: 0,
      bestPrice: null as number | null,
      foundOptimalBand: false,
      daysToOptimalBand: null as number | null,
      profitableDays: 0,
    };
  }
  const totalProfit = round2(history.reduce((s, h) => s + h.profit, 0));
  const bestDay = history.reduce((a, h) => (h.profit > a.profit ? h : a), history[0]);
  // The profit curve is flat enough near the top that anything in this band
  // counts as having found it. We are testing understanding, not precision.
  const inBand = (price: number) => price >= 1.4 && price <= 1.85;
  const firstInBand = history.find((h) => inBand(h.price));
  return {
    days: history.length,
    totalProfit,
    bestDay,
    averageProfit: round2(totalProfit / history.length),
    bestPrice: bestDay.price,
    foundOptimalBand: Boolean(firstInBand),
    daysToOptimalBand: firstInBand ? firstInBand.day : null,
    profitableDays: history.filter((h) => h.profit > 0).length,
  };
}

/* ------------------------------------------------------------------ *
 * Projection — the live feedback loop on the planning screen
 *
 * This is what the kid can see change as they move the dials, and it is
 * deliberately limited to things they could genuinely work out standing at
 * their own stand: how many cups they can pour, what each one costs, what
 * they keep per cup, and how many they must sell to cover the day's costs.
 *
 * It does NOT project demand. If the game told them how many cups they were
 * going to sell at a given price, the entire discovery of Act 1 would
 * collapse into sweeping a slider and reading off the maximum. They have to
 * find that by trading days, which is the point.
 * ------------------------------------------------------------------ */

export interface DayProjection {
  cupsMakeable: number;
  /** Cash leaving now for supplies. */
  costToBuy: number;
  costPerCup: number;
  marginPerCup: number;
  /** Cups they must sell to cover the stand fee at this margin. */
  breakEvenCups: number | null;
  /** True if the price is below cost, so no number of cups can ever pay. */
  losesMoneyPerCup: boolean;
  /** Every cup sells. */
  bestCase: { cupsSold: number; revenue: number; profit: number };
  /** Only half the batch sells — the over-ordering lesson, before it bites. */
  halfCase: { cupsSold: number; revenue: number; profit: number };
  /** Nobody buys at all. */
  worstCase: { cupsSold: number; revenue: number; profit: number };
}

/** Profit if exactly `cupsSold` cups sell at `price` from this batch. */
export function profitIfSold(
  cupsSold: number,
  price: number,
  params?: Partial<DayParams>,
): number {
  const sold = Math.max(0, Math.floor(cupsSold));
  const fixed = totalFixedCost(resolveDayParams(params).fixedCosts);
  return round2(sold * price - ingredientCostOf(sold).total - fixed);
}

export function projectDay(
  state: GameState,
  targetCups: number,
  price: number,
  paramsInput?: Partial<DayParams>,
): DayProjection {
  const params = resolveDayParams(paramsInput);
  const fixed = totalFixedCost(params.fixedCosts);
  const plan = batchPlan(state, targetCups);
  const cups = Math.min(plan.cupsMakeable, Math.floor(params.serviceCapacity));
  // Round the per-cup cost before deriving margin from it. The kid will
  // subtract the two figures we show them, and must get the answer we show.
  const costPerCup = toCents(cups > 0 ? ingredientCostOf(cups).perCup : ingredientCostOf(1).perCup);
  const marginPerCup = toCents(price - costPerCup);

  const scenario = (cupsSold: number) => ({
    cupsSold,
    revenue: round2(cupsSold * price),
    profit: profitIfSold(cupsSold, price, params),
  });

  return {
    cupsMakeable: cups,
    costToBuy: plan.cost.total,
    costPerCup,
    marginPerCup,
    breakEvenCups: marginPerCup > 0 ? Math.ceil(fixed / marginPerCup) : null,
    losesMoneyPerCup: marginPerCup <= 0,
    bestCase: scenario(cups),
    halfCase: scenario(Math.floor(cups / 2)),
    worstCase: scenario(0),
  };
}

/* ------------------------------------------------------------------ *
 * Closing takeaway
 *
 * The end-of-week line must be true of the week the kid actually played. It
 * is tempting to hardcode "cheap cups sold the most and earned the least",
 * but a kid who never tried a cheap price did not learn that, and telling
 * them they did is the same sin as a mocked dashboard.
 * ------------------------------------------------------------------ */

export function closingTakeaway(history: DayRecord[]): string {
  if (history.length === 0) return 'You did not run a single day.';

  const money = (n: number) => `$${n.toFixed(2)}`;
  const best = history.reduce((a, h) => (h.profit > a.profit ? h : a), history[0]);
  const mostCups = history.reduce((a, h) => (h.cupsSold > a.cupsSold ? h : a), history[0]);
  const cheapest = history.reduce((a, h) => (h.price < a.price ? h : a), history[0]);
  const dearest = history.reduce((a, h) => (h.price > a.price ? h : a), history[0]);

  // The strongest lesson: a day that sold more cups for less money.
  if (mostCups.day !== best.day && mostCups.profit < best.profit) {
    return `On day ${mostCups.day} you sold ${mostCups.cupsSold} cups and made ${money(mostCups.profit)}. On day ${best.day} you sold ${best.cupsSold} and made ${money(best.profit)}. Selling more is not the same as earning more.`;
  }

  // Next best: they found a peak between their cheapest and dearest.
  if (best.price > cheapest.price && best.price < dearest.price) {
    return `Your best price, ${money(best.price)}, was not your cheapest (${money(cheapest.price)}) or your dearest (${money(dearest.price)}). There is a best price in the middle, and you found it.`;
  }

  // They only ever went up, and the top was still their best.
  if (best.price === dearest.price && dearest.price > cheapest.price) {
    return `Your dearest price, ${money(best.price)}, was also your best. You never found the point where charging more starts losing you money — try pushing past it.`;
  }

  // They only ever went cheap.
  if (best.price === cheapest.price && cheapest.price < dearest.price) {
    return `Your cheapest price was your best this week. Every price you tried above ${money(cheapest.price)} earned less. Worth testing whether that holds.`;
  }

  return `You charged ${money(best.price)} on your best day and made ${money(best.profit)}.`;
}
