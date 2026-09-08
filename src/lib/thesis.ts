/**
 * Thesis before money.
 *
 * The most dangerous thing this product could accidentally teach is "I bought
 * it because it went up". A game that lets a kid tap a company, watch a number
 * rise, and feel clever has taught them to gamble and told them it was
 * investing.
 *
 * So money does not move in the market until there is a sentence, in two halves:
 *
 *  - a **number reason**, picked from the company's actual metrics and then
 *    *checked against them*. A kid who claims a company is growing fast enough
 *    to justify its price gets shown the division. If it does not hold, the game
 *    says so — and still lets them buy, with the mismatch recorded. Blocking
 *    them would teach obedience; recording it teaches consequence.
 *  - a **story reason**, in their own words from a short list of real ones.
 *    Two of the options are bearish, which makes them wrong reasons to *buy*,
 *    and pairing one with a purchase is recorded as the contradiction it is.
 *
 * Twelve weeks later every thesis is graded on whether the reasoning held,
 * which is a different question from whether the money went up. The
 * uncomfortable box — made money, reason was wrong — is the whole point of the
 * feature.
 *
 * Pure module. No React, no I/O.
 */

import { formatMillions, metricsFor, type Company } from './companies';

export interface QuantClaim {
  id: string;
  /** What the kid taps. Their words, not a textbook's. */
  label: string;
  /**
   * True when the company's own numbers support the claim *at this price*.
   *
   * The price is passed in rather than read off the company because the market
   * replays real history — the kid is paying the price from the week they are
   * in, and a claim about value has to be judged against the price they are
   * actually paying, not against today's.
   */
  holds: (company: Company, price: number, asOf?: string) => boolean;
  /** The arithmetic, shown either way, so a "no" is also a lesson. */
  evidence: (company: Company, price: number, asOf?: string) => string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const QUANT_CLAIMS: QuantClaim[] = [
  {
    id: 'pays-back-fast',
    label: 'You get your money back quickly',
    holds: (c, price, asOf) => {
      const pe = metricsFor(c, price, asOf).pe;
      return pe !== null && pe <= 30;
    },
    evidence: (c, price, asOf) => {
      const pe = metricsFor(c, price, asOf).pe;
      if (pe === null) return `${c.name} has no profit to divide by, so there is no payback time at all.`;
      return `${c.name} costs ${pe.toFixed(0)} years of profit. Thirty or under counts as quick.`;
    },
  },
  {
    id: 'keeps-a-lot',
    label: 'It keeps a big slice of every dollar',
    holds: (c, _price, asOf) => metricsFor(c, undefined, asOf).netMargin >= 0.2,
    evidence: (c, _price, asOf) => {
      const m = metricsFor(c, undefined, asOf);
      return `${c.name} keeps ${Math.round(m.netMargin * 100)}c of every dollar it takes in. Twenty or more is a big slice.`;
    },
  },
  {
    id: 'grows-fast',
    label: 'Its profit is growing fast',
    holds: (c, _price, asOf) => metricsFor(c, undefined, asOf).year.growth >= 0.1,
    evidence: (c, _price, asOf) => {
      const { growth } = metricsFor(c, undefined, asOf).year;
      return `${c.name}'s profit is moving ${growth >= 0 ? 'up' : 'down'} about ${pct(Math.abs(growth))} a year. Ten percent up or better counts as fast.`;
    },
  },
  {
    id: 'worth-the-price',
    label: 'It grows fast enough to be worth the price',
    holds: (c, price, asOf) => {
      const pe = metricsFor(c, price, asOf).pe;
      const { growth } = metricsFor(c, price, asOf).year;
      return pe !== null && growth > 0 && pe / (growth * 100) <= 4;
    },
    evidence: (c, price, asOf) => {
      const pe = metricsFor(c, price, asOf).pe;
      const { growth } = metricsFor(c, price, asOf).year;
      if (pe === null) return `${c.name} has no P/E, so there is nothing to weigh against its growth.`;
      if (growth <= 0) return `${c.name} is not growing, so paying ${pe.toFixed(0)} years of profit is not being paid for by growth.`;
      const ratio = pe / (growth * 100);
      return `${pe.toFixed(0)} years of profit ÷ ${Math.round(growth * 100)}% growth = ${ratio.toFixed(1)}. Four or under means the growth is roughly paying for the price.`;
    },
  },
  {
    id: 'volume-business',
    label: 'It sells a huge amount and keeps a sliver',
    holds: (c, _price, asOf) => {
      const m = metricsFor(c, undefined, asOf);
      return m.netMargin <= 0.05 && m.year.revenueM >= 40_000;
    },
    evidence: (c, _price, asOf) => {
      const m = metricsFor(c, undefined, asOf);
      return `${c.name} takes in ${(m.year.revenueM / 1000).toFixed(0)} billion a year and keeps ${Math.round(m.netMargin * 100)}c of each dollar. That is a volume business, on purpose.`;
    },
  },
  {
    id: 'more-people-buying',
    label: 'More people buy from it every year',
    /*
     * Revenue growth on its own, with nothing said about profit.
     *
     * Added because Take-Two had no number reason at all: it is loss-making
     * after a writedown, so every profit-based claim is unavailable, and its
     * sales grow at 8% — real, but under the bar for "growing fast". A kid
     * looking at it was offered no honest reason to buy and no explanation
     * why, which reads as the game being broken rather than the company being
     * awkward. Growing sales is a genuine reason, and separating it from
     * profit is the point: it is the difference between a business getting
     * bigger and a business getting better.
     */
    holds: (c, _price, asOf) => metricsFor(c, undefined, asOf).year.revenueGrowth >= 0.05,
    evidence: (c, _price, asOf) => {
      const { revenueGrowth, revenueM } = metricsFor(c, undefined, asOf).year;
      return `${c.name}'s sales are growing about ${pct(revenueGrowth)} a year, to ${(revenueM / 1000).toFixed(1)} billion. That is more people buying, whatever the profit is doing.`;
    },
  },
  {
    id: 'cheap-against-sales',
    label: 'The whole company costs less than two years of its sales',
    /*
     * The one reason left when a company has no earnings to price against.
     *
     * Crocs after a writedown had no P/E, sales growing 4% — too slow for any
     * growth claim — and so not a single number a kid could point at. That is
     * not a company they should be blocked from having a view on; it is the
     * company where you have to reach for a different ruler. Price against
     * sales is the ruler analysts actually use when earnings are absent.
     *
     * It is stated flatly rather than as a virtue, because cheap against sales
     * is exactly what a business in trouble looks like, and finding out which
     * one this is is the kid's job.
     */
    holds: (c, price, asOf) => {
      const m = metricsFor(c, price, asOf);
      return m.year.revenueM > 0 && m.marketCapM <= 2 * m.year.revenueM;
    },
    evidence: (c, price, asOf) => {
      const m = metricsFor(c, price, asOf);
      const years = m.marketCapM / m.year.revenueM;
      return `Buying all of ${c.name} would cost ${formatMillions(m.marketCapM)}, and it sells ${formatMillions(m.year.revenueM)} a year — ${years.toFixed(1)} years of sales. Cheap on that ruler. Worth asking why.`;
    },
  },
  {
    id: 'not-profitable-yet',
    label: 'It loses money now but is growing fast',
    // Tested against *revenue* growth, not profit growth. A company with no
    // profit has no profit growth rate, and on real figures Roblox's "profit
    // growth" was a widening loss — which made the one company this reason
    // exists for fail it.
    holds: (c, _price, asOf) => {
      const { netIncomeM, revenueGrowth } = metricsFor(c, undefined, asOf).year;
      return netIncomeM < 0 && revenueGrowth >= 0.15;
    },
    evidence: (c, _price, asOf) => {
      const { netIncomeM, revenueGrowth } = metricsFor(c, undefined, asOf).year;
      return netIncomeM < 0
        ? `${c.name} lost ${(Math.abs(netIncomeM) / 1000).toFixed(1)} billion last year, and what it sells is growing about ${pct(revenueGrowth)} a year. This is a bet on later, not a bargain now.`
        : `${c.name} already makes money, so this reason does not apply to it.`;
    },
  },
  {
    id: 'room-to-improve',
    label: 'It keeps a small slice, and that could get better',
    holds: (c) => c.revenueGrowth > 0 && metricsFor(c).netMargin < 0.15 && c.netIncomeM > 0,
    evidence: (c) => {
      const m = metricsFor(c);
      if (c.netIncomeM <= 0) return `${c.name} does not make a profit yet, so there is no slice to widen.`;
      if (c.growth <= 0) return `${c.name} is not growing, so a thin slice is not obviously about to get thicker.`;
      return `${c.name} keeps only ${Math.round(m.netMargin * 100)}c of each dollar while still growing ${pct(c.growth)} a year. If it ever keeps more, the profit moves a long way.`;
    },
  },
];

export interface QualClaim {
  id: string;
  label: string;
  /**
   * A reason to expect the business to do *worse*. Picking one of these as a
   * reason to buy is a contradiction, and we record it as one rather than
   * hiding the option — spotting it is the lesson.
   */
  bearish?: boolean;
}

export const QUAL_CLAIMS: QualClaim[] = [
  { id: 'new-thing-coming', label: 'They have something new coming that people want' },
  { id: 'more-shops', label: 'They keep opening more places' },
  { id: 'everyone-i-know', label: 'Everyone I know uses it' },
  { id: 'pay-every-month', label: 'People pay them every month without thinking' },
  { id: 'cant-copy-it', label: 'Nobody else can really copy what they do' },
  { id: 'switching-away', label: 'People I know are switching away from it', bearish: true },
  { id: 'everyone-has-one', label: 'Almost everyone already has one', bearish: true },
];

/* ------------------------------------------------------------------ *
 * The other two halves of the journal
 *
 * The customer's Level 2 note asks every purchase to capture four things:
 * "I bought: X / Because: ___ / Biggest risk: ___ / I plan to hold unless:
 * ___". The first two existed as the number reason and the story reason. These
 * are the other two, and they are the cheapest high-value thing on the whole
 * Level 2 list: "hold unless" is what turns an opinion into **a test the child
 * wrote themselves**, which is the difference between the duck being
 * interesting and the duck being right.
 *
 * **Picked from a list, never typed, and that is not laziness.** A `Thesis`
 * travels between children — `club.ts` carries one inside every proposal so a
 * friend can read it before voting — and PRIVACY.md promises "No free text
 * between children". A typed "biggest risk" box would put a child's own prose
 * into a code passed across a lunch table, which is a promise broken in a page
 * a teacher is invited to check.
 *
 * It is also better teaching. A blank box gets "idk"; a list of seven real
 * risks is seven things a nine-year-old now knows can go wrong with a business.
 * ------------------------------------------------------------------ */

export interface RiskClaim {
  id: string;
  /** What could go wrong, in the child's words. */
  label: string;
  /** What to watch for, so the risk is checkable rather than a mood. */
  watchFor: string;
}

export const RISK_CLAIMS: RiskClaim[] = [
  {
    id: 'growth-slows',
    label: 'It stops growing so fast',
    watchFor: 'Sales growing slower than they were when you bought it.',
  },
  {
    id: 'someone-copies',
    label: 'Somebody copies what they do',
    watchFor: 'A rival selling the same thing cheaper.',
  },
  {
    id: 'people-move-on',
    label: 'People get bored of it',
    watchFor: 'Fewer people using it than last year.',
  },
  {
    id: 'costs-rise',
    label: 'It gets dearer to run',
    watchFor: 'Keeping less of every dollar than it used to.',
  },
  {
    id: 'too-dear-already',
    label: 'I paid too much for it',
    watchFor: 'The price falling while the business carries on the same.',
  },
  {
    id: 'one-product',
    label: 'They only really sell one thing',
    watchFor: 'Bad news about that one thing.',
  },
  {
    id: 'borrowed-a-lot',
    label: 'They have borrowed a lot of money',
    watchFor: 'Borrowing getting dearer for everybody.',
  },
];

export interface ExitClaim {
  id: string;
  /** "I plan to hold unless…" */
  label: string;
}

/**
 * The test a child sets themselves, and it deliberately excludes the price.
 *
 * There is no "unless it goes down", because that is the habit this whole
 * module exists to refuse — `thesis.ts` opens by saying the most dangerous
 * thing this product could teach is "I bought it because it went up", and its
 * mirror image is "I sold because it went down". Every exit below is about the
 * *business* changing, which is the only thing that should change a reason.
 */
export const EXIT_CLAIMS: ExitClaim[] = [
  { id: 'reason-stops-being-true', label: 'the reason I wrote down stops being true' },
  { id: 'growth-stops', label: 'it stops growing' },
  { id: 'stops-keeping-money', label: 'it stops keeping much of what it takes in' },
  { id: 'people-leave', label: 'people I know stop using it' },
  /*
   * Deliberately no "I find a better business at a better price".
   *
   * It is real investing — opportunity cost is how grown-ups think — and it is
   * the wrong option to put in front of a nine-year-old, because it is the
   * only exit on this list that is *always available*. Every other one
   * requires the business to have actually changed. A child who wants to trade
   * can always claim to have found something better, which turns the test they
   * set themselves into a rubber stamp, and §16's whole objection to XP is
   * activity mistaken for skill.
   *
   * Found by a test asserting no exit is about the price. It flagged this row,
   * and the right answer turned out not to be a better regex.
   */
];

export function riskClaim(id: string): RiskClaim | undefined {
  return RISK_CLAIMS.find((claim) => claim.id === id);
}

export function exitClaim(id: string): ExitClaim | undefined {
  return EXIT_CLAIMS.find((claim) => claim.id === id);
}

export function quantClaim(id: string): QuantClaim | undefined {
  return QUANT_CLAIMS.find((claim) => claim.id === id);
}

export function qualClaim(id: string): QualClaim | undefined {
  return QUAL_CLAIMS.find((claim) => claim.id === id);
}

/** Which number reasons this company's own figures support at this price. */
export function claimsThatHold(
  company: Company,
  price = company.price,
  asOf?: string,
): QuantClaim[] {
  return QUANT_CLAIMS.filter((claim) => claim.holds(company, price, asOf));
}

export interface QuantCheck {
  holds: boolean;
  evidence: string;
}

export function checkQuant(
  claimId: string,
  company: Company,
  price = company.price,
  asOf?: string,
): QuantCheck {
  const claim = quantClaim(claimId);
  if (!claim) return { holds: false, evidence: 'That is not one of the reasons.' };
  return {
    holds: claim.holds(company, price, asOf),
    evidence: claim.evidence(company, price, asOf),
  };
}

/* ------------------------------------------------------------------ *
 * The thesis itself
 * ------------------------------------------------------------------ */

export interface Thesis {
  ticker: string;
  quantId: string;
  qualId: string;
  /** The week the money went in. */
  week: number;
  priceAtBuy: number;
  dollars: number;
  /** Did the number reason hold against the company's figures at the time? */
  quantHeld: boolean;
  /** The real date the reason was checked against. */
  asOf?: string;
  /** Was the story reason a reason to expect it to do worse? */
  contradiction: boolean;
  /**
   * The other two halves of the journal, both optional.
   *
   * Optional because every thesis written before they existed does not have
   * them, and a child's saved reasoning must not be invalidated by a feature
   * arriving after it. Every reader below treats `undefined` as "they were not
   * asked" rather than as "they had no answer" — the difference matters when
   * the duck comes back in twelve weeks to ask whether the thesis still holds.
   */
  riskId?: string;
  exitId?: string;
  /** Who wrote it. Used by the club, ignored in solo play. */
  by?: string;
}

export function buildThesis(args: {
  company: Company;
  quantId: string;
  qualId: string;
  week: number;
  priceAtBuy: number;
  dollars: number;
  /** The real calendar date of the week this was written. */
  asOf?: string;
  by?: string;
  riskId?: string;
  exitId?: string;
}): Thesis {
  // Checked at the price actually being paid, against the accounts that were
  // public on the week being replayed. Both halves matter: judging a value claim
  // at the wrong price, or against figures filed years later, would grade the
  // kid on information they did not have.
  const quant = checkQuant(args.quantId, args.company, args.priceAtBuy, args.asOf);
  const qual = qualClaim(args.qualId);
  return {
    ticker: args.company.ticker,
    quantId: args.quantId,
    qualId: args.qualId,
    week: args.week,
    priceAtBuy: args.priceAtBuy,
    dollars: args.dollars,
    quantHeld: quant.holds,
    asOf: args.asOf,
    contradiction: Boolean(qual?.bearish),
    by: args.by,
    /*
     * Only recorded if they are real ids. A `riskId` that matches nothing is
     * worse than none at all: `riskClaim` would return undefined and every
     * reader would have to decide whether that meant "not asked" or "asked and
     * broken". One meaning per absent field.
     */
    ...(args.riskId && riskClaim(args.riskId) ? { riskId: args.riskId } : {}),
    ...(args.exitId && exitClaim(args.exitId) ? { exitId: args.exitId } : {}),
  };
}

/** The whole thesis as one readable sentence, for the log and the club. */
export function thesisLine(thesis: Thesis): string {
  const quant = quantClaim(thesis.quantId);
  const qual = qualClaim(thesis.qualId);
  return `${thesis.ticker}: ${quant?.label ?? 'no number reason'} — and ${(qual?.label ?? 'no story reason').toLowerCase()}.`;
}

/**
 * The journal entry as the note asked for it: four lines, in the child's words.
 *
 * Returned as lines rather than a paragraph because that is how it is read —
 * "I bought / Because / Biggest risk / I plan to hold unless" is a form a child
 * filled in, and running it together into prose loses the thing that makes it
 * a journal rather than a sentence.
 */
export function journalLines(thesis: Thesis, name?: string): string[] {
  const quant = quantClaim(thesis.quantId);
  const qual = qualClaim(thesis.qualId);
  const risk = thesis.riskId ? riskClaim(thesis.riskId) : undefined;
  const exit = thesis.exitId ? exitClaim(thesis.exitId) : undefined;

  const lines = [
    `I bought: ${name ?? thesis.ticker}`,
    `Because: ${quant?.label ?? 'no number reason'}, and ${(qual?.label ?? 'no story reason').toLowerCase()}`,
  ];
  // Absent means "not asked", so the line is left out rather than filled with a
  // dash. A journal with an empty field in it invites reading it as an answer.
  if (risk) lines.push(`Biggest risk: ${risk.label.toLowerCase()}`);
  if (exit) lines.push(`I plan to hold unless ${exit.label}`);
  return lines;
}

/* ------------------------------------------------------------------ *
 * Has the reason stopped being true?
 * ------------------------------------------------------------------ */

export interface Drift {
  /** True when the number reason held at the time and does not now. */
  drifted: boolean;
  /** The claim being re-checked, if it is still a known one. */
  claim?: QuantClaim;
  /**
   * What the duck says. Empty when nothing has changed, so a caller can use
   * this as the test for whether there is anything worth saying at all.
   */
  says: string;
}

/**
 * The mechanic the customer's note called the strongest one available:
 *
 * > "You bought this because revenue was growing quickly. Revenue growth has
 * > now slowed. Want to revisit your thesis?"
 *
 * Which is producible, exactly, from what a thesis already stores — the claim
 * and whether it held when the money went in — re-run against the company as
 * it stands now. Nothing here is generated or guessed; it is the same
 * `holds()` function, twice, at two prices.
 *
 * **Only reports a claim that has stopped being true.** A claim that never
 * held is already recorded as a mismatch at purchase and graded at the end;
 * telling a child again now would be nagging about a decision they have
 * already been shown. And a claim that still holds is not news. The whole
 * value of this is that it is *rare and specific*, which is what makes it
 * worth reading when it does appear.
 */
export function driftOf(
  thesis: Thesis,
  company: Company,
  priceNow: number,
  asOf?: string,
): Drift {
  const claim = quantClaim(thesis.quantId);
  if (!claim) return { drifted: false, says: '' };
  if (!thesis.quantHeld) return { drifted: false, claim, says: '' };

  const stillHolds = claim.holds(company, priceNow, asOf);
  if (stillHolds) return { drifted: false, claim, says: '' };

  return {
    drifted: true,
    claim,
    says: `You bought ${company.name} because ${claim.label.toLowerCase()}. That is not true any more — ${claim.evidence(company, priceNow, asOf)} Want to think again?`,
  };
}

/** Every holding whose written reason has stopped being true. */
export function drifted(
  theses: readonly Thesis[],
  companyFor: (ticker: string) => Company | undefined,
  priceFor: (ticker: string) => number,
  asOf?: string,
): Drift[] {
  return theses
    .map((thesis) => {
      const company = companyFor(thesis.ticker);
      if (!company) return { drifted: false, says: '' };
      return driftOf(thesis, company, priceFor(thesis.ticker), asOf);
    })
    .filter((drift) => drift.drifted);
}

/**
 * Was the reasoning sound?
 *
 * Deliberately independent of the outcome. A thesis is sound if the number
 * reason held against the company's own figures and the story reason was not
 * an argument against buying.
 */
export function reasoningSound(thesis: Thesis): boolean {
  return thesis.quantHeld && !thesis.contradiction;
}

export type Verdict = 'good-call' | 'lucky' | 'right-idea-wrong-time' | 'now-you-know';

export interface ThesisScore {
  thesis: Thesis;
  gainPct: number;
  madeMoney: boolean;
  sound: boolean;
  verdict: Verdict;
  headline: string;
  /** What to take from it. Never congratulates luck. */
  lesson: string;
}

const VERDICT_HEADLINE: Record<Verdict, string> = {
  'good-call': 'Good call',
  lucky: 'That one was luck',
  'right-idea-wrong-time': 'Right idea, wrong time',
  'now-you-know': 'Now you know why',
};

export function scoreThesis(thesis: Thesis, endPrice: number): ThesisScore {
  const gainPct = thesis.priceAtBuy > 0 ? (endPrice - thesis.priceAtBuy) / thesis.priceAtBuy : 0;
  const madeMoney = gainPct > 0;
  const sound = reasoningSound(thesis);

  const verdict: Verdict = madeMoney
    ? sound
      ? 'good-call'
      : 'lucky'
    : sound
      ? 'right-idea-wrong-time'
      : 'now-you-know';

  const move = `${thesis.ticker} went ${gainPct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(gainPct * 100))}%`;

  let lesson: string;
  switch (verdict) {
    case 'good-call':
      lesson = `${move}, and the reason you gave was true when you gave it. That is the only combination you can repeat on purpose.`;
      break;
    case 'lucky':
      lesson = thesis.contradiction
        ? `${move}, but your own reason was an argument against buying it. You made money by accident. Say it out loud: that was luck.`
        : `${move}, but the numbers never backed the reason you gave. You made money anyway, which is the most expensive way to learn a bad habit. That was luck.`;
      break;
    case 'right-idea-wrong-time':
      lesson = `${move}, even though your reason held up. This happens constantly, and it is why investors talk in years.`;
      break;
    case 'now-you-know':
      lesson = `${move}, and the numbers did not support your reason at the time either. Nothing lost but the lesson.`;
      break;
  }

  return {
    thesis,
    gainPct,
    madeMoney,
    sound,
    verdict,
    headline: VERDICT_HEADLINE[verdict],
    lesson,
  };
}

export interface ThesisReport {
  scores: ThesisScore[];
  sound: number;
  lucky: number;
  /** The sentence we most want a kid to leave with. */
  summary: string;
}

export function scoreAll(
  theses: Thesis[],
  endPrice: (ticker: string) => number,
): ThesisReport {
  const scores = theses.map((thesis) => scoreThesis(thesis, endPrice(thesis.ticker)));
  const sound = scores.filter((score) => score.sound).length;
  const lucky = scores.filter((score) => score.verdict === 'lucky').length;

  let summary: string;
  if (scores.length === 0) {
    summary = 'You did not write a reason down for anything, so there is nothing to learn from yet.';
  } else if (lucky === 0 && sound === scores.length) {
    summary = `${sound} of ${scores.length} reasons held up. Whatever the money did, your thinking was sound — that is the part that repeats.`;
  } else if (lucky > 0) {
    summary = `${lucky} of your ${scores.length} ${lucky === 1 ? 'win was' : 'wins were'} luck: the money went up and the reason was wrong. Noticing that is worth more than the money.`;
  } else {
    summary = `${sound} of ${scores.length} reasons held up against the numbers. Work on the others before you work on the picks.`;
  }

  return { scores, sound, lucky, summary };
}
