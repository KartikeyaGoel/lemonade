/**
 * Stage 3 — the shop.
 *
 * The wall that motivates this stage is the sky. By the end of the stands the
 * kid has three pitches, a manager, a helper and a round of regulars, and every
 * bit of it still shuts when it rains: `WEATHER_MULTIPLIER.cold` is 0.6, so
 * four customers in ten simply are not there, and no amount of kit fixes that.
 *
 * A room with a door fixes it. That is the whole argument for retail, and it is
 * an argument a child can feel in a week of bad weather rather than be told.
 *
 * What a shop costs is the lesson underneath. A pitch is five dollars a day and
 * you can walk away from it tomorrow. A shop is a fit-out you pay for once, a
 * rent you owe on the day nobody comes, and staff who are owed whatever
 * happened — and the fit-out is more money than the business has. So this is
 * also the first time the kid cannot get where they want out of profit, which
 * is where `LOAN` and the investor come in: two ways to buy the same door, one
 * that costs money and one that costs a piece of the company.
 *
 * Pure module. No React, no I/O. Deliberately imports nothing from
 * `business.ts` — the aggregation goes the other way, so there is no cycle.
 */

import { type FixedCostLine, round2 } from './simulation';

/* ------------------------------------------------------------------ *
 * The shop
 * ------------------------------------------------------------------ */

export const SHOP = {
  name: 'The corner shop',
  emoji: '🏪',
  /**
   * Paid once: the counter, the fridge, the paint, the sign over the door.
   *
   * Deliberately more than a good fortnight of stand profit. A kid who wants it
   * has to either wait, borrow, or sell a piece of the company, and all three
   * are real answers.
   */
  fitOut: 600,
  /** Owed every single day. The biggest number in the game that is not a sale. */
  rent: 45,
  /** A high street is busier than a park gate, by a lot. */
  demandMultiplier: 3,
  /** What the room and the counter can physically serve in a day. */
  capacity: 60,
  /** Each shop assistant, owed daily. */
  staffWage: 18,
  staffCapacity: 45,
  /** Nobody can usefully stand behind one counter. */
  maxStaff: 2,
} as const;

/** Profitable days with the shop open that end the stage. */
export const SHOP_DAYS_REQUIRED = 5;

export interface ShopState {
  open: boolean;
  /** Assistants on the floor. Capacity, at a wage, every day. */
  staff: number;
  /** Consecutive profitable days traded with the door open. */
  goodDays: number;
}

export function createShopState(): ShopState {
  return { open: false, staff: 0, goodDays: 0 };
}

export function shopCapacity(shop: ShopState): number {
  if (!shop.open) return 0;
  return SHOP.capacity + shop.staff * SHOP.staffCapacity;
}

export function shopCrowd(shop: ShopState): number {
  return shop.open ? SHOP.demandMultiplier : 0;
}

export function shopFixedCosts(shop: ShopState): FixedCostLine[] {
  if (!shop.open) return [];
  const lines: FixedCostLine[] = [{ label: 'Shop rent', amount: SHOP.rent }];
  if (shop.staff > 0) {
    lines.push({ label: `Shop staff ×${shop.staff}`, amount: round2(shop.staff * SHOP.staffWage) });
  }
  return lines;
}

/**
 * What the door costs a day before a single cup is sold.
 *
 * The number the kid should have in their head all through this stage, because
 * it is the one that decides whether a quiet Tuesday is survivable.
 */
export function shopDailyCost(shop: ShopState): number {
  return round2(shopFixedCosts(shop).reduce((sum, line) => sum + line.amount, 0));
}

/**
 * Cups a day the shop must sell at this price to cover its own costs.
 *
 * Operating leverage, stated as the only thing about it a kid needs: a big
 * fixed cost is a number of cups you owe before you earn anything.
 */
export function shopBreakEvenCups(shop: ShopState, price: number, unitCost: number): number | null {
  const margin = round2(price - unitCost);
  if (margin <= 0) return null;
  return Math.ceil(shopDailyCost(shop) / margin);
}

export function hireShopStaff(shop: ShopState): ShopState {
  if (!shop.open || shop.staff >= SHOP.maxStaff) return shop;
  return { ...shop, staff: shop.staff + 1 };
}

export function letShopStaffGo(shop: ShopState): ShopState {
  if (shop.staff <= 0) return shop;
  return { ...shop, staff: shop.staff - 1 };
}

/**
 * Updates the run of good days after a day is closed.
 *
 * One bad day does not wipe it, for the same reason it does not wipe the
 * hands-off streak: the weather is not a decision, and punishing a child for
 * the sky teaches the wrong thing about risk.
 */
export function updateShopDays(shop: ShopState, profit: number): ShopState {
  if (!shop.open) return shop;
  if (profit > 0) return { ...shop, goodDays: shop.goodDays + 1 };
  return { ...shop, goodDays: Math.max(0, shop.goodDays - 1) };
}

export interface ShopProgress {
  open: boolean;
  goodDays: number;
  required: number;
  complete: boolean;
  /** The one line the goal strip shows. */
  goal: string;
}

export function shopProgress(shop: ShopState): ShopProgress {
  if (!shop.open) {
    return {
      open: false,
      goodDays: 0,
      required: SHOP_DAYS_REQUIRED,
      complete: false,
      goal: `Open the shop. The fit-out is $${SHOP.fitOut}.`,
    };
  }
  const left = Math.max(0, SHOP_DAYS_REQUIRED - shop.goodDays);
  return {
    open: true,
    goodDays: shop.goodDays,
    required: SHOP_DAYS_REQUIRED,
    complete: shop.goodDays >= SHOP_DAYS_REQUIRED,
    goal: left === 0 ? 'The shop pays for itself.' : `${left} more good days at the shop.`,
  };
}

/* ------------------------------------------------------------------ *
 * The loan
 *
 * The other half of the capital lesson, and the half the game did not have.
 * An investor takes a slice of every future profit and never has to be paid
 * back. A bank takes none of the company and has to be paid back on the day
 * nobody comes in. Neither is the right answer, which is the point.
 * ------------------------------------------------------------------ */

export const LOAN = {
  /** What the bank will lend against a business this size. */
  amount: 400,
  /** Paid back over this many days. */
  days: 20,
  /**
   * What the borrowing costs, as a fraction of what is borrowed.
   *
   * A quarter is high for a real loan and about right for a twelve-year-old's
   * first one: it has to be big enough to see in the ledger. The kid pays back
   * $500 for $400, and the repayment line says so every day.
   */
  interestRate: 0.25,
} as const;

export interface LoanState {
  principal: number;
  /** Principal plus interest: what will actually be handed back. */
  total: number;
  /** Owed every day until it is cleared. */
  daily: number;
  /** Still to pay. */
  outstanding: number;
}

export function loanQuote(amount = LOAN.amount): LoanState {
  const total = round2(amount * (1 + LOAN.interestRate));
  return {
    principal: amount,
    total,
    daily: round2(total / LOAN.days),
    outstanding: total,
  };
}

/** The extra you hand back for the privilege. The word is "interest". */
export function loanInterest(loan: LoanState): number {
  return round2(loan.total - loan.principal);
}

export function loanFixedCosts(loan: LoanState | null): FixedCostLine[] {
  if (!loan || loan.outstanding <= 0) return [];
  return [{ label: 'Loan repayment', amount: Math.min(loan.daily, loan.outstanding) }];
}

/**
 * Takes a day's repayment off the balance. Called once a day, after the close.
 *
 * A cleared loan is kept with nothing outstanding rather than thrown away. It
 * costs nothing from then on — `loanFixedCosts` goes quiet — and it is the only
 * honest evidence that the kid borrowed and paid it back. Deleting it would
 * leave the parent report reading `learned.includes('interest')`, which records
 * what the software displayed rather than what the child did, and PRODUCT.md
 * §36 exists because that mistake was already made once.
 */
export function repayLoan(loan: LoanState | null): LoanState | null {
  if (!loan || loan.outstanding <= 0) return loan;
  const paid = Math.min(loan.daily, loan.outstanding);
  return { ...loan, outstanding: Math.max(0, round2(loan.outstanding - paid)) };
}

export function loanCleared(loan: LoanState | null): boolean {
  return loan !== null && loan.outstanding <= 0;
}

export interface FundingOption {
  id: 'cash' | 'loan' | 'investor';
  name: string;
  /** What it puts in the till today. */
  cashToday: number;
  /** What it costs, in the kid's terms, with no verdict attached. */
  cost: string;
  /** True when this one would actually cover the fit-out. */
  enough: boolean;
}

/**
 * The three ways to buy a door, side by side, with no recommendation.
 *
 * Waiting is on the list on purpose. It is the option a game normally hides,
 * and it is genuinely the cheapest of the three — it just costs the one thing
 * a kid feels most, which is time.
 */
export function fundingOptions(cash: number, investorCash: number): FundingOption[] {
  const quote = loanQuote();
  return [
    {
      id: 'cash',
      name: 'Pay for it yourself',
      cashToday: round2(cash),
      cost: 'Nothing. You wait until the money is there.',
      enough: cash >= SHOP.fitOut,
    },
    {
      id: 'loan',
      name: 'Borrow it from the bank',
      cashToday: quote.principal,
      cost: `$${quote.daily.toFixed(2)} a day for ${LOAN.days} days. You hand back $${quote.total.toFixed(0)}.`,
      enough: round2(cash + quote.principal) >= SHOP.fitOut,
    },
    {
      id: 'investor',
      name: 'Sell a slice to Auntie Ro',
      cashToday: round2(investorCash),
      cost: 'She keeps her slice of every profit, for as long as you own this.',
      enough: round2(cash + investorCash) >= SHOP.fitOut,
    },
  ];
}
