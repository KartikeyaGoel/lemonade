/**
 * Lemonade Stand — Act 1 simulation.
 *
 * Pure module. No React, no browser APIs, no I/O. Everything here is a
 * function of its arguments, so the whole game can be unit tested and later
 * lifted to a server without a rewrite.
 *
 * The public entry point is `runDay(state, decisions) => DayOutcome`.
 */

import { plural } from './copy';


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

  /**
   * What kind of lemon, and what it does.
   *
   * FRAMEWORK.md §1's Stage 1 table asks for "2-3 simple choices such as
   * organic vs. regular" and for willingness to pay to "depend partly on
   * product quality". This is that lever, and it is the *only* thing besides
   * price and batch size a child decides in Act 1.
   *
   * `regular` is exactly 1.0 on both axes on purpose. It is the default for
   * every caller that does not choose, which means the economy a child met
   * before this existed is reproduced to the cent — and every arithmetic
   * identity in `tests/pnl.test.ts` still holds untouched.
   *
   * The dear lemon has to be worth it and must not be a free win: 1.8x the
   * cost for 1.25x the demand only pays back above about a dollar a cup, which
   * is the trade the row asks a child to discover.
   */
  LEMON_GRADES: {
    value: { costFactor: 0.6, demandFactor: 0.85 },
    regular: { costFactor: 1, demandFactor: 1 },
    organic: { costFactor: 1.8, demandFactor: 1.25 },
  },

  /**
   * Buying more at once makes each one cheaper.
   *
   * The "bulk-purchase lesson" row: "buying in larger quantities lowers cost
   * per cup but requires more spending upfront". Read highest-first, so the
   * first tier a quantity clears is the one it gets.
   *
   * Tiers rather than a smooth curve because a child has to be able to *see*
   * the moment it gets cheaper, and a step at a round number is findable by
   * sliding a slider. Twelve and twenty-four are a dozen and two dozen, which
   * is how lemons are actually sold.
   */
  BULK_TIERS: [
    { atLeast: 24, off: 0.2 },
    { atLeast: 12, off: 0.1 },
  ],

  /** cups_wanted = max(0, INTERCEPT - SLOPE * price) * weather */
  DEMAND_INTERCEPT: 60,
  DEMAND_SLOPE: 20,

  /** The highest price any customer in town will ever pay. */
  MAX_RESERVATION_PRICE: 3,

  TOTAL_DAYS: 7,

  /**
   * The profit a child is asked to make in one day, and how often.
   *
   * FRAMEWORK.md §1's Stage 1 table asks for "a clear profit goal after
   * exploration" and an unlock of "hit the profit goal in two separate
   * rounds". Before this, Act 1 ended when seven days had passed: nothing was
   * aimed at, hit, or missed.
   *
   * $25 is measured rather than guessed. Playing the week at every grade and
   * four prices, eleven of twelve strategies clear it twice and the twelfth
   * clears it exactly once — so it rewards finding a decent price without
   * demanding the best one. The best day available is $59, at posh lemons and
   * $2 a cup, which is the trade the quality lever exists to teach.
   */
  ACT1_PROFIT_TARGET: 25,
  ACT1_TARGET_HITS: 2,

  /**
   * Days before the goal is mentioned at all.
   *
   * "1-2 exploratory rounds without a target." A target on day one is a
   * demand made of a child who does not yet know what a cup costs, and the
   * whole of the desired feeling — Experiment, then Notice, then Optimize,
   * then Challenge — depends on the first two arriving before the third.
   */
  ACT1_EXPLORE_DAYS: 2,

  MIN_PRICE: 0,
  MAX_PRICE: 5,
} as const;

/**
 * What a child buys to make the lemonade with.
 *
 * Ordered worst to best so `GRADE_ORDER.indexOf` gives a sane comparison, and
 * named for what is on the label rather than for the mechanic — a nine-year-old
 * buys "posh lemons", not "quality tier 3".
 */
export type LemonGrade = 'value' | 'regular' | 'organic';

export const GRADE_ORDER: readonly LemonGrade[] = ['value', 'regular', 'organic'];

/** The grade every caller gets if it does not choose. Reproduces the old economy. */
export const DEFAULT_GRADE: LemonGrade = 'regular';

/**
 * What one lemon costs, given its grade and how many are being bought.
 *
 * Both effects multiply into a single unit price, because that is the number
 * the receipt shows and the number the cost of goods sold has to be computed
 * from. A child can check it: grade price, less the bulk discount, times the
 * number of lemons.
 */
export function lemonUnitCost(grade: LemonGrade = DEFAULT_GRADE, quantity = 0): number {
  const graded = ECON.LEMON_COST * ECON.LEMON_GRADES[grade].costFactor;
  const tier = ECON.BULK_TIERS.find((step) => quantity >= step.atLeast);
  return toCents(graded * (1 - (tier?.off ?? 0)));
}

/** The discount a quantity earns, as a fraction. 0 when it earns none. */
export function bulkDiscountFor(quantity: number): number {
  return ECON.BULK_TIERS.find((step) => quantity >= step.atLeast)?.off ?? 0;
}

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
  /**
   * What each lemon in this lot cost.
   *
   * Added when grade and bulk pricing arrived, because the cost of goods sold
   * can no longer be `lemonsUsed * LEMON_COST` — two lots bought on different
   * days at different grades cost different amounts, and the receipt has to
   * agree with the profit and loss (PRODUCT.md §4).
   *
   * Optional, so a save written before this existed reads back as lemons
   * bought at the plain price, which is what they were.
   */
  unitCost?: number;
  /** What kind they were. Kept for the receipt, not used in the arithmetic. */
  grade?: LemonGrade;
}

/** What one lemon from this lot cost, for a lot that may predate grades. */
export function lotUnitCost(lot: LemonLot): number {
  return lot.unitCost ?? ECON.LEMON_COST;
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
  /**
   * How many cups they actually made that morning.
   *
   * Added for the evidence layer in `src/lib/mastery.ts`, which cannot tell the
   * difference between "sold 24 because that is all anybody wanted" and "sold 24
   * because that is all there was" without it — and that difference is the whole
   * of the pricing lesson. Optional, because a save from before this existed
   * simply produces no sighting rather than a wrong one.
   */
  cupsMade?: number;
  /** Cups sold to punch-card regulars, who come whatever the weather. */
  subscriberCups?: number;
  /**
   * What kind of lemon was used.
   *
   * Recorded because word of mouth reads it: today's demand is partly
   * yesterday's quality, which is the "lower quality can reduce demand over
   * time" half of FRAMEWORK.md §1's quality row. Optional, so a save from
   * before grades existed reads back as `regular`, which is what it was.
   */
  grade?: LemonGrade;
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
  /**
   * What kind of lemon to buy today.
   *
   * Optional, and absent means `regular` — which costs and sells exactly what
   * a lemon cost and sold before this decision existed.
   */
  grade?: LemonGrade;
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

export function purchaseCost(
  decisions: Pick<Decisions, 'buyLemons' | 'buySugarPacks' | 'buyCupPacks' | 'grade'>,
) {
  /*
   * The unit price is worked out once and reported, because the shopping list
   * shows it and the pantry stores it. A child reading the receipt sees
   * "18 lemons at 36c" and can multiply it themselves.
   */
  const perLemon = lemonUnitCost(decisions.grade ?? DEFAULT_GRADE, decisions.buyLemons);
  const lemons = round2(decisions.buyLemons * perLemon);
  const sugar = round2(decisions.buySugarPacks * ECON.SUGAR_PACK_COST);
  const cups = round2(decisions.buyCupPacks * ECON.CUP_PACK_COST);
  return {
    lemons,
    sugar,
    cups,
    total: round2(lemons + sugar + cups),
    perLemon,
    bulkOff: bulkDiscountFor(decisions.buyLemons),
  };
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

/**
 * How much quality is moving demand today.
 *
 * Two halves, because FRAMEWORK.md §1's quality row asks for two things:
 * better lemons "can increase demand and support a higher selling price", and
 * lower quality "can reduce demand over time".
 *
 * The first is today's grade. The second is word of mouth — yesterday's grade
 * still counts for half, so cheapening the recipe does not bite until the day
 * after and neither does fixing it. That is the smallest mechanic that makes
 * the sentence true: a child who switches to the cheap lemon sees a normal-ish
 * day and a worse one after it, which is what a reputation *is*.
 *
 * Half and half rather than a long decay, because a seven-day stage cannot
 * teach a trend that takes five days to show up.
 */
export function gradeDemandFactor(
  grade: LemonGrade = DEFAULT_GRADE,
  history: readonly DayRecord[] = [],
): number {
  const today = ECON.LEMON_GRADES[grade].demandFactor;
  const yesterday = history[history.length - 1]?.grade;
  /*
   * Day one has nothing to remember, so today's grade is the whole story.
   * Anything else would mean a child's first day was judged on a decision they
   * had not made yet.
   */
  if (!yesterday) return today;
  return (today + ECON.LEMON_GRADES[yesterday].demandFactor) / 2;
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
export function ingredientCostOf(cupsSold: number, lemonSpend?: number) {
  const lemonsUsed = lemonsNeededFor(cupsSold);
  /*
   * `lemonSpend` is what the lemons actually poured today cost, taken oldest
   * first out of the pantry by `lemonsConsumed`. Passed in rather than
   * recomputed, because two lots bought on different days at different grades
   * cost different amounts and only the pantry knows which ones were used.
   *
   * Falls back to the plain price so every existing caller — and every test
   * written before grades existed — gets exactly the number it always got.
   */
  const lemons = round2(lemonSpend ?? lemonsUsed * ECON.LEMON_COST);
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
  /**
   * What was made with, and what it cost.
   *
   * Reported so the receipt, the close screen and the two new words can all
   * quote the same figure — a child who reads "each one was 36c" on the
   * shopping list must find 36c in the word card too (PRODUCT.md §4).
   */
  grade: LemonGrade;
  lemonUnitCost: number;
  lemonsBought: number;
  /** The bulk discount this order earned, as a fraction. 0 when none. */
  bulkOff: number;
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
  /**
   * What the floor put in, so the cash line reconciles on paper.
   *
   * The floor is a retention rule and a good one: a nine-year-old who goes
   * broke on day three quits. But it quietly *creates money*, and while the
   * whole business was one table and a $5 fee that was small enough to hide.
   * With a shop, two pitches, a manager and a loan the daily costs are over a
   * hundred dollars, and a bad day was printing fifty of them into the cash box
   * behind a sentence that said only "your original $20 is protected".
   *
   * Two figures on screen that do not reconcile with the third is the one thing
   * PRODUCT.md §4 does not allow, and it was happening in the ledger — the
   * screen whose entire job is to be checkable by hand. So the top-up is a
   * number now, and the close screen prints it as its own line.
   */
  cashTopUp: number;

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
  /*
   * How many people walk past, which is not how many want a cup.
   *
   * This distinction is load-bearing in a way that is easy to miss. The whole
   * footfall is generated first and each person then decides, so the *number of
   * random draws this function makes depends only on the weather and the day's
   * parameters — never on the price or the batch*. That is what makes the seed
   * carried into tomorrow independent of today's decisions, and therefore what
   * makes two kids on the same challenge code genuinely get the same week.
   *
   * Every claim the same-sky challenge and the classroom board make rests on
   * it, so `tests/challenge.test.ts` pins it. Anything added here that draws a
   * different number of times depending on a decision silently breaks both.
   */
  const passersby = Math.round(
    params.demandIntercept *
      weatherFactor(weather, params.indoorShare) *
      params.demandMultiplier *
      params.marketShare,
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
  /*
   * What the lemons poured today cost, and what the ones thrown away cost.
   *
   * Accumulated here rather than multiplied out afterwards because this is the
   * only place that knows *which* lemons went — oldest first — and once grades
   * exist "which" and "how much" are different questions.
   */
  let lemonSpend = 0;
  let spoilageSpend = 0;

  for (const lot of remaining) {
    if (toUse <= 0) break;
    const take = Math.min(lot.lemons, toUse);
    lot.lemons -= take;
    toUse -= take;
    lemonSpend += take * lotUnitCost(lot);
  }

  let spoiledLemons = 0;
  const kept: LemonLot[] = [];
  for (const lot of remaining) {
    if (lot.lemons <= 0) continue;
    const lastUsableDay = lot.purchasedOnDay + ECON.LEMON_SHELF_LIFE_DAYS - 1;
    if (day >= lastUsableDay) {
      spoiledLemons += lot.lemons;
      spoilageSpend += lot.lemons * lotUnitCost(lot);
    } else {
      kept.push(lot);
    }
  }

  return {
    lots: kept,
    spoiledLemons,
    lemonSpend: round2(lemonSpend),
    spoilageSpend: round2(spoilageSpend),
  };
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
  /**
   * The share of this business that sits behind a door, from 0 to 1.
   *
   * A stand on a pavement lives and dies by the sky: on a cold day six in ten
   * people who would have bought simply are not there. A room with a door does
   * not work like that, and that difference is the whole reason a shop is worth
   * its rent. So the weather a day is run at is blended — the pavement gets the
   * real sky and the indoor part gets a floor under it.
   *
   * Zero everywhere until a shop is open, which is what keeps every stand day,
   * every challenge and every classroom week arithmetically identical to before.
   */
  indoorShare: number;
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
  indoorShare: 0,
};

export function resolveDayParams(params?: Partial<DayParams>): DayParams {
  return { ...DEFAULT_DAY_PARAMS, ...(params ?? {}) };
}

export function totalFixedCost(lines: FixedCostLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amount, 0));
}

/**
 * The floor the sky cannot get under, once you are trading indoors.
 *
 * Not 1: a shop is quieter when it is freezing, because fewer people are out at
 * all. It is nothing like a pavement, which loses four customers in ten.
 */
export const INDOOR_WEATHER_FLOOR = 0.95;

/**
 * How much the sky is worth today, given how much of the business is indoors.
 *
 * One number, used by both the demand curve and the footfall, so the two can
 * never drift apart.
 */
export function weatherFactor(weather: Weather, indoorShare = 0): number {
  const outside = WEATHER_MULTIPLIER[weather];
  if (indoorShare <= 0) return outside;
  const inside = Math.max(outside, INDOOR_WEATHER_FLOOR);
  const share = Math.min(1, indoorShare);
  return outside * (1 - share) + inside * share;
}

/** The demand curve, generalised over the day's parameters. */
export function cupsWantedWith(price: number, weather: Weather, params: DayParams): number {
  const raw = params.demandIntercept - params.demandSlope * price;
  return (
    Math.max(0, raw) *
    weatherFactor(weather, params.indoorShare) *
    params.demandMultiplier *
    params.marketShare
  );
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

  // Never let a mistyped order overdraw the account — or poison the day.
  const requested = {
    buyLemons: whole(decisions.buyLemons),
    buySugarPacks: whole(decisions.buySugarPacks),
    buyCupPacks: whole(decisions.buyCupPacks),
  };
  const grade = decisions.grade ?? DEFAULT_GRADE;
  const affordable = clampPurchaseToCash(requested, state.cash);
  const cost = purchaseCost({ ...affordable, grade });

  const pantry = pantryAfterPurchase(state, { ...affordable, price });
  const { cups: pourable } = cupsMakeableFrom(pantry.lemons, pantry.sugarServings, pantry.cupsInStock);
  // You can only serve as fast as your stand and staff allow, however much
  // lemonade is sitting in the pantry.
  const cupsMakeable = Math.min(pourable, Math.floor(params.serviceCapacity));

  const weather = drawWeather(rng, state.forecast);
  /*
   * Quality moves how many people want a cup — never how many walk past.
   *
   * That distinction is the whole reason this is safe. `buildCustomers` draws
   * once per passer-by, and `buildCustomers`'s own comment records that the
   * number of draws must depend "only on the weather and the day's parameters
   * — never on the price or the batch", or two children on the same challenge
   * code stop getting the same week. Grade is a decision, so it belongs on the
   * same side of that line as price: it changes who buys, not who walks by.
   */
  const cupsWanted = cupsWantedWith(price, weather, params) * gradeDemandFactor(grade, state.history);

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
  /*
   * Ingredients leave the pantry *before* they are costed.
   *
   * The order matters now and did not used to. Cost of goods sold was
   * `lemonsUsed * LEMON_COST`, so it could be worked out from a count. With
   * grades and bulk pricing, two lots cost different amounts per lemon and
   * only the pantry knows which ones were poured — oldest first. So the
   * consumption happens first and reports what it spent.
   */
  const lotsWithPurchase: LemonLot[] = [
    ...state.lemonLots.map((lot) => ({ ...lot })),
    ...(affordable.buyLemons > 0
      ? [
          {
            lemons: affordable.buyLemons,
            purchasedOnDay: state.day,
            unitCost: cost.perLemon,
            grade,
          },
        ]
      : []),
  ];
  const aged = consumeAndAge(lotsWithPurchase, lemonsNeededFor(cupsSold), state.day);
  const ingredients = ingredientCostOf(cupsSold, aged.lemonSpend);
  const grossProfit = round2(revenue - ingredients.total);
  // Derived from the rounded per-cup cost, for the same reason: the close
  // screen shows both, and they must reconcile on paper. With punch cards in
  // play the two prices blend, so we use what was actually taken per cup
  // rather than the list price — otherwise the margin would not tie back.
  const realisedPrice = cupsSold > 0 ? toCents(revenue / cupsSold) : price;
  const grossMarginPerCup =
    cupsSold > 0 ? toCents(realisedPrice - toCents(ingredients.perCup)) : toCents(price);

  // Leftovers age and may be thrown out, costed at what they were bought for.
  const spoilageCost = aged.spoilageSpend;

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
  const cashTopUp = round2(cashAfter - rawCash);

  const record: DayRecord = {
    day: state.day,
    weather,
    price,
    cupsSold,
    cupsMade: cupsMakeable,
    cupsWanted: Math.round(cupsWanted),
    revenue,
    profit,
    cashAfter,
    subscriberCups,
    marketShare: params.marketShare,
    fixedCost,
    spoiledLemons: aged.spoiledLemons,
    grade,
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
    grade,
    lemonUnitCost: cost.perLemon,
    lemonsBought: affordable.buyLemons,
    bulkOff: cost.bulkOff,
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
    cashTopUp,
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

/**
 * A count of things, from whatever arrived.
 *
 * `Math.max(0, Math.floor(x))` is `NaN` for `NaN`, and that was the shape this
 * used, one line under a comment promising a mistyped order could not hurt
 * anything. A single `NaN` in the order makes the ingredient cost `NaN`, then
 * the profit, then the cash — and the close screen prints "You made $NaN" with
 * a ledger of blanks. Nothing in the UI can produce it today because every dial
 * is numeric; a decoded share code and a hand-edited save both can.
 *
 * Also caps the count. `1e12` lemons is not an overdraft, it is a hang: the
 * purchase clamp walks the order down one unit at a time.
 */
function whole(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_ORDER_UNITS, Math.max(0, Math.floor(n)));
}

/**
 * More than anybody could sell in a season, and small enough to loop over.
 *
 * The number itself is arbitrary. What matters is that it exists, because the
 * order clamp is iterative.
 */
const MAX_ORDER_UNITS = 100_000;

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
  /** What kind of lemon this plan is priced for. */
  grade: LemonGrade;
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

export function batchPlan(
  state: GameState,
  targetCups: number,
  grade: LemonGrade = DEFAULT_GRADE,
): BatchPlan {
  const order = orderForTargetCups(state, targetCups);
  /*
   * Costed at the grade being bought, so the shopping list a child reads
   * before opening is the money that actually leaves the cash box. Defaults to
   * `regular`, which is what every caller written before grades existed meant.
   */
  const cost = purchaseCost({ ...order, grade });
  const pantry = pantryAfterPurchase(state, { ...order, price: 0 });
  const { cups, limitedBy } = cupsMakeableFrom(pantry.lemons, pantry.sugarServings, pantry.cupsInStock);
  return {
    targetCups: Math.max(0, Math.floor(targetCups)),
    order,
    cost,
    cupsMakeable: cups,
    limitedBy,
    /*
     * Priced from this order's own lemons rather than the list price, because
     * grade and volume both move it and this is the number the plan screen
     * shows as "what a cup costs you".
     */
    costPerCup:
      cups > 0
        ? ingredientCostOf(cups, round2(lemonsNeededFor(cups) * cost.perLemon)).perCup
        : 0,
    grade,
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
 * These are also the exact habits that decide whether the market is investing or
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
  | 'quality'
  | 'bulk-discount'
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
  | 'luck-vs-skill'
  // Stage 2 — more than one stand
  | 'marketing'
  | 'delegation'
  // Stage 3 — the shop
  | 'break-even'
  | 'interest'
  // Stage 4 — going public
  | 'shares'
  | 'share-price'
  | 'market-cap'
  | 'going-public';

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
      evidence: `${plural(outcome.cupsSold, 'cup')} x ${money(outcome.price)} = ${money(outcome.revenue)}. That is revenue: all the money that came in.`,
      carriesForward: 'Every company reports this number. It is the top line.',
    });
    found.push({
      id: 'profit',
      term: 'Profit',
      evidence: `${money(outcome.revenue)} in, ${money(outcome.ingredients.total + outcome.standFee + outcome.spoilageCost)} out, so you kept ${money(outcome.profit)}.`,
      carriesForward: 'Revenue is what a business collects. Profit is what it keeps. They are not the same, and the second one is the one that matters.',
    });
  }

  /*
   * Unit cost, from the receipt.
   *
   * This word existed in the glossary, was counted in the total the words tab
   * shows a child, and was read by `PriceScreen` to decide whether to show the
   * margin row — and nothing anywhere awarded it. PRODUCT.md §53. It is the
   * third instance of §40's class, and the only one found by a guard rather
   * than by a person reading a diff.
   *
   * `ShopScreen` had said where it belonged for a long time: "on day one the
   * receipt *is* the unit-cost lesson". So it lands on the first day anything
   * sells, which is almost always day one.
   *
   * Not inside the `day === 1` block, deliberately. A day one that sells
   * nothing has no per-cup cost to talk about, and putting it there would lose
   * the word for good rather than for a day — which is the failure this whole
   * section is about.
   *
   * "About", because lemons come whole and the division rarely lands on a
   * round cent. §4 asks that any two figures shown together reconcile with the
   * third on paper; a rounded number a kid can check beats an exact one they
   * cannot.
   */
  if (outcome.cupsSold > 0) {
    found.push({
      id: 'unit-cost',
      term: 'Unit cost',
      evidence: `The lemons, sugar and cups came to ${money(outcome.ingredients.total)} for ${plural(outcome.cupsSold, 'cup')}. So each cup cost about ${money(outcome.ingredients.perCup)} to make.`,
      carriesForward:
        'What one more of a thing costs to make. It is the number a price has to beat, and the first thing to check when a busy day still made no money.',
    });
  }

  // The stand fee bites hardest on a quiet day.
  if (outcome.cupsSold > 0 && outcome.grossProfit < outcome.standFee * 1.5 && outcome.day <= 3) {
    found.push({
      id: 'fixed-cost',
      term: 'Fixed cost',
      evidence: `The ${money(outcome.standFee)} stand fee was the same today as on any day, whether you sold ${plural(outcome.cupsSold, 'cup')} or a hundred.`,
      carriesForward: 'Costs that do not move with sales are why a slow month hurts. They are also why a busy one pays so well.',
    });
  }

  // Elasticity: earned once they have actually moved the price and seen it.
  const distinctPrices = new Set(history.map((h) => h.price));
  if (distinctPrices.size >= 2 && outcome.walkedAwayOnPrice > 0) {
    found.push({
      id: 'elasticity',
      term: 'Price elasticity',
      evidence: `${plural(outcome.walkedAwayOnPrice, 'person', 'people')} looked at ${money(outcome.price)} and kept walking. ${outcome.cupsSold} paid it.`,
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

  /*
   * Quality, named the day a child buys something other than the normal lemon.
   *
   * Both directions earn it, because the lesson is the trade rather than the
   * upgrade — a child who cheapens the recipe and watches the queue thin out
   * has learned exactly the thing the word is for.
   */
  if (outcome.grade && outcome.grade !== DEFAULT_GRADE && outcome.cupsSold > 0) {
    const posh = outcome.grade === 'organic';
    found.push({
      id: 'quality',
      term: 'Quality',
      evidence: posh
        ? `You bought the posh lemons at ${money(outcome.lemonUnitCost)} each. ${plural(Math.round(outcome.cupsWanted), 'person', 'people')} wanted a cup.`
        : `You bought the cheap lemons at ${money(outcome.lemonUnitCost)} each and saved money. Watch how many people want one tomorrow.`,
      carriesForward:
        'Every business picks how good to make the thing. Cheaper costs less and sells less. There is no answer that is always right.',
    });
  }

  /*
   * Buying in bulk, named the day the order actually earns the discount.
   *
   * Conditional on the discount being real rather than on the size of the
   * order, so the word never arrives alongside a price a child did not get.
   */
  if (outcome.bulkOff > 0 && outcome.lemonsBought > 0) {
    found.push({
      id: 'bulk-discount',
      term: 'Buying in bulk',
      evidence: `You bought ${plural(outcome.lemonsBought, 'lemon')} at once, so each one was ${money(outcome.lemonUnitCost)} instead of ${money(ECON.LEMON_COST * ECON.LEMON_GRADES[outcome.grade ?? DEFAULT_GRADE].costFactor)}.`,
      carriesForward:
        'Buying more at once makes each one cheaper — but the money leaves today and the lemons still go off. That trade is why shops run out of cash.',
    });
  }

  if (outcome.spoiledLemons > 0) {
    found.push({
      id: 'spoilage',
      term: 'Spoilage',
      evidence: `${plural(outcome.spoiledLemons, 'lemon')} went bad before you could use them. That is ${money(outcome.spoilageCost)} of your money in the bin.`,
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
      evidence: `Your best day was ${money(bestSoFar)} and your worst ${money(worst)}, but your average across ${plural(history.length, 'day')} is ${money(avg)}.`,
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
        evidence: `Split across ${plural(outcome.cupsSold, 'cup')}, the ${money(outcome.standFee)} fee cost you ${money(feePerCup)} a cup. On a 10 cup day it would be ${money(round2(outcome.standFee / 10))} a cup.`,
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
        evidence: `The forecast said ${forecastCopy}. You made ${plural(outcome.cupsMakeable, 'cup')} and could have sold ${outcome.cupsSold + outcome.turnedAwaySoldOut}.`,
        carriesForward: 'You had the right read and did not back it hard enough. Being right is only worth something if you acted on it.',
      });
    } else if (soldShare < 0.55) {
      found.push({
        id: 'demand-bet',
        term: 'Your call was too optimistic',
        evidence: `The forecast said ${forecastCopy}, so you made ${plural(outcome.cupsMakeable, 'cup')}. You sold ${outcome.cupsSold}. The rest was money already spent.`,
        carriesForward: 'A good story about the future is not the same as a good result. You committed real money to a guess, and the guess was rich.',
      });
    } else if (soldShare >= 0.8) {
      found.push({
        id: 'demand-bet',
        term: 'You judged the day well',
        evidence: `You made ${plural(outcome.cupsMakeable, 'cup')} and sold ${outcome.cupsSold} of them.`,
        carriesForward: 'You read a hint about the future, put money behind it, and got it about right. Do that repeatedly and it stops being luck.',
      });
    }
  }

  // Return on cash: the bridge to the market.
  if (history.length >= ECON.TOTAL_DAYS) {
    const spent = round2(outcome.purchases.cost.total + outcome.standFee);
    if (spent > 0) {
      found.push({
        id: 'return-on-cash',
        term: 'Return on money put in',
        evidence: `Today you put ${money(spent)} into the stand and got ${money(outcome.revenue)} back.`,
        carriesForward: 'One question sits under every investment. If I put money in here, how much comes back? And how sure am I?',
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
  grade: LemonGrade = DEFAULT_GRADE,
): DayProjection {
  const params = resolveDayParams(paramsInput);
  const fixed = totalFixedCost(params.fixedCosts);
  const plan = batchPlan(state, targetCups, grade);
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
    return `On day ${mostCups.day} you sold ${plural(mostCups.cupsSold, 'cup')} and made ${money(mostCups.profit)}. On day ${best.day} you sold ${best.cupsSold} and made ${money(best.profit)}. Selling more is not the same as earning more.`;
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
