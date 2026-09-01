/**
 * Words you earned.
 *
 * This module exists because of a real gap in the first build. The rule
 * "vocabulary only after experience" was applied so strictly that the game
 * taught the P/E ratio as arithmetic — price divided by yearly profit, years to
 * pay it back — and then never said the words "P/E ratio" out loud. A kid came
 * away able to do it and unable to *say* it.
 *
 * That is a missing feature, not restraint. Concepts you cannot name are
 * concepts you cannot discuss, defend, or be corrected on, and half of being
 * financially literate is being able to join the conversation.
 *
 * So: do it, see the number, then get told the word. The word is a reward and
 * it lands in a collection, because an incomplete collection is the oldest
 * engagement mechanic there is and it happens to be honest here — the list of
 * words you own really is the list of things you understand.
 *
 * Pure module. No React, no I/O.
 */

import {
  type DayRecord,
  type Insight,
  type InsightId,
} from './simulation';
import type { BuyoutOffer } from './ownership';

export type WordAct = 1 | 2 | 3 | 4;

export interface GlossaryWord {
  id: InsightId;
  /** The word a grown-up would use. */
  word: string;
  /** What it means, in language a twelve year old already has. */
  kidLine: string;
  /** How the same word is used about real companies. */
  grownUpLine: string;
  act: WordAct;
}

/**
 * Every word the game can hand over, in the order it can hand them over.
 *
 * The ids are the same ids the insight engine emits, so a word is earned by
 * the thing happening — never by opening a screen.
 */
export const GLOSSARY: GlossaryWord[] = [
  {
    id: 'revenue',
    word: 'Revenue',
    kidLine: 'Every dollar that came in. Cups times price, before you pay for anything.',
    grownUpLine: 'The top line of any company. It says how big something is, and nothing about whether it works.',
    act: 1,
  },
  {
    id: 'unit-cost',
    word: 'Unit cost',
    kidLine: 'What one cup costs you to make, lemons and sugar and the cup itself.',
    grownUpLine: 'Cost of goods sold. Firms fight over fractions of a cent here, because it repeats on every sale.',
    act: 1,
  },
  {
    id: 'margin',
    word: 'Margin',
    kidLine: 'What you keep out of each cup after what it cost you to make.',
    grownUpLine: 'The single most useful number on a company. Two firms with the same revenue and different margins are not the same business.',
    act: 1,
  },
  {
    id: 'fixed-cost',
    word: 'Fixed cost',
    kidLine: 'The stand fee. You owe it on a freezing day when you sell four cups.',
    grownUpLine: 'Rent, salaries, machines. They do not care how the month went, which is what makes a bad month dangerous.',
    act: 1,
  },
  {
    id: 'profit',
    word: 'Profit',
    kidLine: 'What is actually left. Revenue minus everything, including the boring bits.',
    grownUpLine: 'Net income. It is the number every valuation is eventually built on.',
    act: 1,
  },
  {
    id: 'elasticity',
    word: 'Elasticity',
    kidLine: 'How many customers you lose when you put the price up.',
    grownUpLine: 'Price elasticity of demand. It decides whether raising prices makes a company more money or less.',
    act: 1,
  },
  {
    id: 'spoilage',
    word: 'Spoilage',
    kidLine: 'Lemons you bought and never sold. You paid full price for nothing.',
    grownUpLine: 'Inventory write-downs. Whole retailers have been sunk by buying stock nobody wanted.',
    act: 1,
  },
  {
    id: 'capacity',
    word: 'Capacity',
    kidLine: 'The most cups you can physically pour in a day, however long the queue is.',
    grownUpLine: 'Why a company with growing demand still needs to spend money to grow, and why that spending shows up before the profit does.',
    act: 1,
  },
  {
    id: 'signal-vs-noise',
    word: 'Signal and noise',
    kidLine: 'One cold day means nothing. Seven days means something.',
    grownUpLine: 'The habit that separates investors from gamblers. A single day of a share price is almost pure noise.',
    act: 1,
  },
  {
    id: 'demand-bet',
    word: 'Forecasting',
    kidLine: 'You had to order the lemons before you knew what the weather would do.',
    grownUpLine: 'Every business commits money before it knows. Being roughly right early beats being exactly right late.',
    act: 1,
  },
  {
    id: 'operating-leverage',
    word: 'Operating leverage',
    kidLine: 'Once the fee is paid, extra cups are nearly all profit — and empty days hurt much more.',
    grownUpLine: 'High fixed costs magnify both directions. It is why airlines swing from records to rescue.',
    act: 2,
  },
  {
    id: 'capex-vs-opex',
    word: 'Capex and opex',
    kidLine: 'The cooler cost you once. The helper costs you again every single day.',
    grownUpLine: 'Capital spending buys something you keep. Operating spending is rent on somebody else. Companies report them apart on purpose.',
    act: 2,
  },
  {
    id: 'return-on-cash',
    word: 'Return on capital',
    kidLine: 'The cooler cost $35 and earned it back in two days. That is a good use of $35.',
    grownUpLine: 'The question good investors ask first: when this company spends a dollar, what does the dollar come back as?',
    act: 2,
  },
  {
    id: 'competition',
    word: 'Competition',
    kidLine: 'Someone opened up down the street and took some of your customers.',
    grownUpLine: 'Any business making easy money is about to have company. The interesting question is what stops them.',
    act: 2,
  },
  {
    id: 'differentiation',
    word: 'Moat',
    kidLine: 'Fresh-squeezed meant people walked past the cheaper stand to reach yours.',
    grownUpLine: 'A reason customers stay when a rival is cheaper. Warren Buffett calls it a moat, and it is most of why he pays up for anything.',
    act: 2,
  },
  {
    id: 'recurring-revenue',
    word: 'Recurring revenue',
    kidLine: 'Your regulars turn up when it is cold, because they already signed up.',
    grownUpLine: 'Money that arrives without being re-won every month. It is why a subscription business is priced above a shop with the same profit.',
    act: 2,
  },
  {
    id: 'dividends',
    word: 'Dividend',
    kidLine: 'Your manager did the work and the money still came to you, for owning it.',
    grownUpLine: 'Cash a company sends its owners. Owning and working are different jobs, and only one of them scales.',
    act: 2,
  },
  {
    id: 'compounding',
    word: 'Compounding',
    kidLine: 'Profit bought capacity, capacity made more profit, and that bought more again.',
    grownUpLine: 'The most powerful idea in investing and the hardest to feel, because it does almost nothing before it does everything.',
    act: 2,
  },
  {
    id: 'equity',
    word: 'Equity',
    kidLine: 'A slice of your stand that somebody else owns, forever, along with a slice of the profit.',
    grownUpLine: 'A share is exactly this. Buying one makes you a part-owner of a business, not a bettor on a squiggly line.',
    act: 3,
  },
  {
    id: 'multiple',
    word: 'Multiple',
    kidLine: 'How many weeks of profit somebody wants for a stand. Six weeks or twenty-five weeks.',
    grownUpLine: 'Every business on earth is priced as a multiple of what it earns. Learn to compare multiples and you can compare anything.',
    act: 3,
  },
  {
    id: 'pe-ratio',
    word: 'P/E ratio',
    kidLine: 'Your multiple, with a name. Price divided by profit — how long until you get your money back.',
    grownUpLine: 'Say it out loud: price to earnings. It is the first number people quote about a share, and now you know exactly what it is.',
    act: 3,
  },
  {
    id: 'business-model',
    word: 'Business model',
    kidLine: 'How the money actually arrives. One cup to a stranger, or a standing order every day.',
    grownUpLine: 'Two firms with identical profit can be worth very different amounts, because one has to win its customers again and one does not.',
    act: 3,
  },
  {
    id: 'diversification',
    word: 'Diversification',
    kidLine: 'You owned three companies, so one of them falling did not sink you.',
    grownUpLine: 'The only free lunch in finance. It does not raise your return, it stops one mistake ending the game.',
    act: 4,
  },
  {
    id: 'drawdown',
    word: 'Drawdown',
    kidLine: 'How far down your money went before it came back. It went down. You sat still.',
    grownUpLine: 'Every good long-term investment has terrifying stretches. Selling into them is how most people turn a dip into a loss.',
    act: 4,
  },
  {
    id: 'thesis',
    word: 'Thesis',
    kidLine: 'The reason you bought it, written down before you bought it.',
    grownUpLine: 'Without one you cannot tell a good decision from a lucky one, and you will learn the wrong lesson from both.',
    act: 4,
  },
  {
    id: 'luck-vs-skill',
    word: 'Luck and skill',
    kidLine: 'You made money on one where your reason turned out to be wrong. That was luck.',
    grownUpLine: 'Judge the decision, not the outcome. A run of luck mistaken for skill is how people lose far more later.',
    act: 4,
  },
];

const BY_ID = new Map(GLOSSARY.map((word) => [word.id, word] as const));

export function wordFor(id: string): GlossaryWord | undefined {
  return BY_ID.get(id as InsightId);
}

/** The collection screen: what they hold, in canonical order. */
export function wordsEarned(learned: string[]): GlossaryWord[] {
  const held = new Set(learned);
  return GLOSSARY.filter((word) => held.has(word.id));
}

export interface WordProgress {
  earned: number;
  total: number;
  /** Per act, so the screen can show which shelf is still empty. */
  byAct: Array<{ act: WordAct; earned: number; total: number }>;
}

export function wordProgress(learned: string[]): WordProgress {
  const held = new Set(learned);
  const acts: WordAct[] = [1, 2, 3, 4];
  return {
    earned: GLOSSARY.filter((word) => held.has(word.id)).length,
    total: GLOSSARY.length,
    byAct: acts.map((act) => {
      const inAct = GLOSSARY.filter((word) => word.act === act);
      return {
        act,
        earned: inAct.filter((word) => held.has(word.id)).length,
        total: inAct.length,
      };
    }),
  };
}

/* ------------------------------------------------------------------ *
 * The naming moments for Acts 2, 3 and 4
 *
 * Acts 1 and 2 hand out words from inside the day loop, because the day
 * produced the evidence. The later acts have specific beats instead, so each
 * one gets a builder here that fills the evidence in from what actually
 * happened. Nothing below invents a number.
 * ------------------------------------------------------------------ */

const money = (n: number) => `$${n.toFixed(2)}`;

/** Earned the first day a regular is served. */
export function recurringRevenueInsight(
  regularCups: number,
  regularPrice: number,
  weather: string,
): Insight {
  const coldDay = weather === 'cold';
  return {
    id: 'recurring-revenue',
    term: 'Recurring revenue',
    evidence: `${regularCups} ${regularCups === 1 ? 'cup went' : 'cups went'} to regulars at ${money(regularPrice)}${
      coldDay ? ', on a cold day when almost nobody else came' : ''
    }.`,
    carriesForward:
      'You gave up a slice of every cup and got customers who show up regardless. That trade is why a company people pay monthly is priced above one that has to win them again.',
  };
}

/** Earned when a slice of the stand is sold. */
export function equityInsight(slicePct: number, cash: number): Insight {
  return {
    id: 'equity',
    term: 'Equity',
    evidence: `You sold ${Math.round(slicePct * 100)}% of your stand for ${money(cash)}. That slice is theirs from now on, and so is ${Math.round(slicePct * 100)}% of every profit.`,
    carriesForward:
      'This is exactly what a share is. When you buy one you are buying this — a slice of a real business, permanently.',
  };
}

/** Earned when they rank the stands for sale by what they earn. */
export function multipleInsight(bestName: string, bestMultiple: number, worstMultiple: number): Insight {
  return {
    id: 'multiple',
    term: 'Multiple',
    evidence: `${bestName} was asking ${bestMultiple} weeks of profit. The famous one wanted ${worstMultiple}.`,
    carriesForward:
      'Every business is priced as some number of times what it earns. Once you can compare that number you can compare a lemonade stand with an airline.',
  };
}

/**
 * The P/E moment. This is the single most important sentence in the product,
 * and it is built out of the kid's own buyout arithmetic so it cannot drift
 * from what they just saw.
 */
export function peRatioInsight(offer: BuyoutOffer): Insight {
  // Months rather than a fraction of a year. "0.23 of a year" is arithmetically
  // fine and reads like nothing; "about three months" is a length of time a
  // twelve year old can feel, which is what makes the jump to *years* land.
  const months = Math.max(1, Math.round(offer.multiple / 4.33));
  return {
    id: 'pe-ratio',
    term: 'P/E ratio',
    evidence: `Somebody paid ${money(offer.price)} for a stand earning ${money(offer.weeklyProfit)} a week. ${money(offer.price)} ÷ ${money(offer.weeklyProfit)} = ${offer.multiple}. That is your multiple.`,
    carriesForward: `Real companies are priced the same way, only counted in years instead of weeks. Your ${offer.multiple} weeks is about ${months} ${months === 1 ? 'month' : 'months'} — a bargain nobody gets in real life. When someone says a share trades at a P/E of 20, they mean twenty years of profit, and you already know exactly what that sentence means.`,
  };
}

/** Earned once they hold three companies at the same time. */
export function diversificationInsight(tickers: string[]): Insight {
  return {
    id: 'diversification',
    term: 'Diversification',
    evidence: `You own ${tickers.length} companies: ${tickers.join(', ')}. No single one of them can take all your money.`,
    carriesForward:
      'This does not make you more money on average. It stops one bad call ending the game, which is what lets you stay in long enough for the good calls to matter.',
  };
}

/** Earned by riding a real fall down and not selling. */
export function drawdownInsight(worstPct: number, ticker: string): Insight {
  return {
    id: 'drawdown',
    term: 'Drawdown',
    evidence: `${ticker} fell ${Math.round(worstPct * 100)}% below what you paid, and you did not sell it.`,
    carriesForward:
      'Every investment worth owning has stretches like that. The people who lose money are usually the ones who sold during one.',
  };
}

/** Earned by writing a reason down before spending money. */
export function thesisInsight(ticker: string, quantLine: string, qualLine: string): Insight {
  return {
    id: 'thesis',
    term: 'Thesis',
    evidence: `Before you bought ${ticker} you wrote: ${quantLine} And: ${qualLine}`,
    carriesForward:
      'That sentence is the difference between investing and guessing. In twelve weeks you will find out whether the reason was right, which is a separate question from whether you made money.',
  };
}

/** Earned when the game has to tell them a win was luck. */
export function luckInsight(ticker: string, gainPct: number): Insight {
  return {
    id: 'luck-vs-skill',
    term: 'Luck and skill',
    evidence: `${ticker} made you ${Math.round(gainPct * 100)}% and the reason you gave for buying it did not hold up.`,
    carriesForward:
      'This is the most expensive lesson in finance to learn backwards. Say it out loud: that one was luck.',
  };
}

/** Earned by feeling how the money arrives, not just how much. */
export function businessModelInsight(regularShare: number, premium: number): Insight {
  return {
    id: 'business-model',
    term: 'Business model',
    evidence: `${Math.round(regularShare * 100)}% of your cups went to regulars, and the buyer paid ${premium} extra ${premium === 1 ? 'week' : 'weeks'} of profit for it.`,
    carriesForward:
      'Same profit, higher price, purely because of how the money arrives. That is the whole reason Netflix and a restaurant chain are priced differently.',
  };
}

/** Words a run has genuinely earned that the save has not recorded yet. */
export function unrecorded(insights: Insight[], learned: string[]): Insight[] {
  const held = new Set(learned);
  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (held.has(insight.id) || seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
}

/** History convenience: did a regular ever actually get served? */
export function hasServedRegulars(history: DayRecord[]): boolean {
  return history.some((day) => (day.subscriberCups ?? 0) > 0);
}
