/**
 * @vitest-environment jsdom
 */
/**
 * Every word the game can hand a child, generated once.
 *
 * `glossary.ts` has a builder per word for the later acts — multiple, P/E,
 * drawdown, thesis, luck, diversification, business model — and half of them
 * had never been called. Each one produces a sentence with the child's own
 * figures in it, so an uncalled builder is a sentence nobody has read: §36's
 * whole argument is that a word arrives *after* the thing it names, with the
 * evidence attached, and the evidence is exactly the part that can be wrong.
 *
 * Also here: the workbench that compares two rehearsals, the sound settings a
 * locked-down school device has to survive, and the last few branches of the
 * modules that were already nearly covered.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GLOSSARY,
  businessModelInsight,
  diversificationInsight,
  drawdownInsight,
  equityInsight,
  luckInsight,
  multipleInsight,
  peRatioInsight,
  recurringRevenueInsight,
  thesisInsight,
  unrecorded,
  wordFor,
  wordProgress,
  wordsEarned,
} from '../src/lib/glossary';
import { buyoutOffer, createOwnershipState } from '../src/lib/ownership';
import {
  alreadyTried,
  asTry,
  bestTry,
  canRehearse,
  compareTries,
  crowdLabel,
  remember,
} from '../src/lib/bench';
import { QUANT_CLAIMS, QUAL_CLAIMS, buildThesis, scoreThesis } from '../src/lib/thesis';
import { SNAPSHOT } from '../src/lib/companies';
import { isMuted, onMuteChange, setMuted } from '../src/lib/sound';
import { createInitialState, runDay, type DayRecord } from '../src/lib/simulation';

function dayRecord(over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: 1,
    weather: 'mild',
    forecast: 'probably-mild',
    price: 1.5,
    cupsMade: 40,
    cupsSold: 38,
    cupsWanted: 45,
    revenue: 57,
    profit: 30,
    fixedCost: 5,
    cashAfter: 300,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const history = Array.from({ length: 21 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 24 + (i % 5) * 4 }),
);

/** A word card is only worth showing if every part of it reads. */
function readable(label: string, insight: { id: string; term: string; evidence: string; carriesForward: string }) {
  expect(insight.term.length, `${label} has no term`).toBeGreaterThan(2);
  expect(insight.evidence.length, `${label} has no evidence`).toBeGreaterThan(15);
  expect(insight.carriesForward.length, `${label} carries nothing forward`).toBeGreaterThan(15);
  const all = `${insight.term} ${insight.evidence} ${insight.carriesForward}`;
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object Object]']) {
    expect(all, `${label} says "${bad}"`).not.toContain(bad);
  }
  // Every generated word is a word the glossary actually knows about.
  expect(wordFor(insight.id), `${label} is not in the glossary`).toBeTruthy();
}

describe('the words the later acts hand over', () => {
  it('names a multiple from two real asking prices', () => {
    for (const [best, worst] of [
      [6, 25],
      [1, 2],
      [12, 12],
    ] as [number, number][]) {
      readable(`multiple ${best}/${worst}`, multipleInsight("Sam's corner stand", best, worst));
    }
  });

  it('names a P/E from an offer, whatever the business did', () => {
    for (const [label, days] of [
      ['a profitable run', history],
      ['a losing run', history.map((d) => ({ ...d, profit: -9 }))],
      ['a single day', [dayRecord()]],
    ] as [string, DayRecord[]][]) {
      readable(`pe (${label})`, peRatioInsight(buyoutOffer(days, createOwnershipState())));
    }
  });

  it('names a drawdown that was ridden out, at every depth', () => {
    for (const worst of [0.02, 0.15, 0.4, 0.95]) {
      readable(`drawdown ${worst}`, drawdownInsight(worst, SNAPSHOT[0].ticker));
    }
  });

  it('names diversification from however many companies are held', () => {
    for (const count of [1, 2, 4, SNAPSHOT.length]) {
      readable(
        `diversification x${count}`,
        diversificationInsight(SNAPSHOT.slice(0, count).map((c) => c.ticker)),
      );
    }
  });

  it('names a thesis from the two halves a child picked', () => {
    const quant = QUANT_CLAIMS[0];
    const qual = QUAL_CLAIMS[0];
    readable('thesis', thesisInsight(SNAPSHOT[0].ticker, quant.label, qual.label));
  });

  /*
   * Luck is the one word in the glossary that is handed over for being
   * *wrong* — a win the reason did not predict — so both signs of the gain
   * have to read as the same lesson rather than as a scolding.
   */
  it('names luck for a win and for a loss', () => {
    for (const gain of [0.4, -0.3, 0, 2.5]) {
      readable(`luck ${gain}`, luckInsight(SNAPSHOT[0].ticker, gain));
    }
  });

  it('names a business model from the share that is recurring', () => {
    for (const [share, premium] of [
      [0, 0],
      [0.3, 0.25],
      [1, 0.5],
    ] as [number, number][]) {
      readable(`model ${share}`, businessModelInsight(share, premium));
    }
  });

  it('names equity from the slice sold and the cash taken', () => {
    for (const [slice, cash] of [
      [0.1, 62.15],
      [0.5, 400],
    ] as [number, number][]) {
      readable(`equity ${slice}`, equityInsight(slice, cash));
    }
  });

  it('names recurring revenue from a real round, in every sky', () => {
    for (const weather of ['cold', 'mild', 'hot']) {
      for (const [cups, price] of [
        [1, 1],
        [12, 1.2],
      ] as [number, number][]) {
        readable(
          `recurring ${cups} in ${weather}`,
          recurringRevenueInsight(cups, price, weather),
        );
      }
    }
  });

  it('drops the words a child already has', () => {
    const two = [multipleInsight('Sam', 6, 25), drawdownInsight(0.2, SNAPSHOT[0].ticker)];
    expect(unrecorded(two, [])).toHaveLength(2);
    expect(unrecorded(two, [two[0].id])).toHaveLength(1);
    expect(unrecorded(two, two.map((i) => i.id))).toHaveLength(0);
  });

  it('counts progress through the whole glossary', () => {
    for (const held of [[], GLOSSARY.slice(0, 5).map((w) => w.id), GLOSSARY.map((w) => w.id)]) {
      const progress = wordProgress(held);
      expect(progress.earned).toBe(held.length);
      expect(progress.total).toBe(GLOSSARY.length);
      // Per shelf as well as overall, so a screen can show which act is empty.
      expect(progress.byAct.reduce((sum, shelf) => sum + shelf.earned, 0)).toBe(held.length);
      expect(wordsEarned(held)).toHaveLength(held.length);
    }
    // A word that does not exist is not counted as one that does.
    expect(wordFor('not-a-word')).toBeUndefined();
    expect(wordsEarned(['not-a-word'])).toHaveLength(0);
  });
});

describe('the workbench, where two plans are held against each other', () => {
  function tryAt(id: number, cups: number, price: number) {
    const state = { ...createInitialState(9), cash: 400 };
    const outcome = runDay(state, {
      buyLemons: Math.ceil(cups / 4),
      buySugarPacks: 3,
      buyCupPacks: 3,
      price,
    });
    return asTry(id, cups, outcome);
  }

  it('compares two rehearsals and names the cause of the gap', () => {
    const cheap = tryAt(1, 40, 1);
    const dear = tryAt(2, 40, 3);
    for (const [from, to] of [
      [cheap, dear],
      [dear, cheap],
    ]) {
      const diff = compareTries(from, to);
      expect(diff.headline.length, 'no headline').toBeGreaterThan(10);
      expect(Number.isFinite(diff.gap)).toBe(true);
      expect(diff.lines.length, 'no lines').toBeGreaterThan(0);
      /*
       * The lines have to sum to the gap exactly. That is the whole promise of
       * the comparison: the difference between two afternoons, itemised, with
       * nothing left over and nothing invented.
       */
      const summed = diff.lines.reduce((total, line) => total + line.amount, 0);
      expect(summed, 'the diff lines do not add up to the gap').toBeCloseTo(diff.gap, 2);
      for (const line of diff.lines) {
        expect(Number.isFinite(line.amount)).toBe(true);
        const all = `${line.label} ${line.detail}`;
        for (const bad of ['NaN', 'Infinity', 'undefined']) {
          expect(all, `a diff line says "${bad}"`).not.toContain(bad);
        }
      }
    }
  });

  it('compares a plan with itself and finds nothing to say', () => {
    const one = tryAt(1, 40, 1.5);
    const diff = compareTries(one, { ...one, id: 2 });
    expect(diff.gap).toBeCloseTo(0, 2);
    expect(diff.headline.length).toBeGreaterThan(5);
  });

  it('remembers a run of tries, keeps the best, and spots a repeat', () => {
    let tries = [] as ReturnType<typeof asTry>[];
    for (let i = 1; i <= 6; i++) tries = remember(tries, tryAt(i, 20 + i * 4, 1 + i * 0.25));
    expect(tries.length).toBeGreaterThan(0);
    const best = bestTry(tries);
    expect(best).toBeTruthy();
    for (const attempt of tries) {
      expect(best!.profit).toBeGreaterThanOrEqual(attempt.profit);
    }
    // The same dials again is a repeat rather than a new attempt.
    const repeat = tries[0];
    expect(alreadyTried(tries, repeat.targetCups, repeat.price)?.id).toBe(repeat.id);
    expect(alreadyTried(tries, 999, 4.99)).toBeNull();
    expect(bestTry([])).toBeNull();
  });

  it('describes yesterday’s crowd, and refuses to rehearse without one', () => {
    for (const weather of ['cold', 'mild', 'hot'] as const) {
      const label = crowdLabel(dayRecord({ weather }));
      expect(label.length, `no crowd label for ${weather}`).toBeGreaterThan(3);
      expect(label).not.toContain('undefined');
    }
    expect(canRehearse(undefined)).toBe(false);
    expect(canRehearse(dayRecord())).toBe(true);
  });
});

describe('every reason a child can give for a trade', () => {
  /*
   * A number reason carries a `holds` test and an `evidence` sentence, both
   * generated from the company's real filings at the price actually being
   * paid. Evidence that has never been generated is a sentence a child could
   * be shown that nobody has read — including the branches that exist to say
   * "this reason does not apply here", which are the honest ones.
   */
  it('produces readable evidence for every number reason against every company', () => {
    for (const company of SNAPSHOT) {
      for (const claim of QUANT_CLAIMS) {
        const evidence = claim.evidence(company, company.price, '2026-09-01');
        expect(evidence.length, `${company.ticker}/${claim.id} said nothing`).toBeGreaterThan(10);
        for (const bad of ['NaN', 'Infinity', 'undefined', '[object Object]']) {
          expect(evidence, `${company.ticker}/${claim.id} says "${bad}"`).not.toContain(bad);
        }
        // And it either holds or it does not, without throwing.
        expect(typeof claim.holds(company, company.price, '2026-09-01')).toBe('boolean');
      }
    }
  });

  it('holds and fails at least once each, so neither branch is dead', () => {
    for (const claim of QUANT_CLAIMS) {
      const verdicts = new Set(
        SNAPSHOT.map((company) => claim.holds(company, company.price, '2026-09-01')),
      );
      expect(
        verdicts.size,
        `${claim.id} gives the same answer for all ${SNAPSHOT.length} companies`,
      ).toBe(2);
    }
  });

  /*
   * The bearish reasons are the point of the qualitative half: picking one as a
   * reason to *buy* is a contradiction, and the game records it rather than
   * hiding the option, because spotting it is the lesson.
   */
  it('offers reasons to expect worse as well as better', () => {
    expect(QUAL_CLAIMS.some((claim) => claim.bearish)).toBe(true);
    expect(QUAL_CLAIMS.some((claim) => !claim.bearish)).toBe(true);
    for (const claim of QUAL_CLAIMS) {
      expect(claim.label.length, `${claim.id} has no label`).toBeGreaterThan(8);
    }
  });

  it('scores a thesis against what actually happened', () => {
    const company = SNAPSHOT[0];
    const bearish = QUAL_CLAIMS.find((claim) => claim.bearish)!;
    const bullish = QUAL_CLAIMS.find((claim) => !claim.bearish)!;
    for (const [quant, qual] of [
      [QUANT_CLAIMS[0].id, bullish.id],
      [QUANT_CLAIMS[1].id, bearish.id],
    ]) {
      const thesis = buildThesis({
        company,
        quantId: quant,
        qualId: qual,
        week: 0,
        priceAtBuy: company.price,
        dollars: 200,
        asOf: '2026-09-01',
      });
      // A bearish reason given as a reason to buy is recorded as one.
      expect(thesis.contradiction).toBe(qual === bearish.id);
      for (const endPrice of [company.price * 1.4, company.price * 0.6, company.price, 0]) {
        const score = scoreThesis(thesis, endPrice);
        expect(Number.isFinite(score.gainPct)).toBe(true);
        expect(score.verdict.length).toBeGreaterThan(3);
      }
    }
  });
});

describe('sound on a device that will not have it', () => {
  beforeEach(() => window.localStorage.clear());

  it('remembers being muted, and tells anybody listening', () => {
    const heard: boolean[] = [];
    const stop = onMuteChange((next: boolean) => heard.push(next));
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(heard).toEqual([true, false]);
    stop();
    setMuted(true);
    expect(heard, 'kept talking after unsubscribing').toEqual([true, false]);
  });

  /*
   * A locked-down school device, or private browsing. The setting has to work
   * for the session even when it cannot be written down — a child who cannot
   * mute a game in a classroom stops playing it.
   */
  it('still mutes when the device refuses to remember it', () => {
    const realSet = window.localStorage.setItem.bind(window.localStorage);
    const realGet = window.localStorage.getItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    window.localStorage.getItem = () => {
      throw new DOMException('SecurityError');
    };
    try {
      expect(() => setMuted(true)).not.toThrow();
      expect(() => isMuted()).not.toThrow();
    } finally {
      window.localStorage.setItem = realSet;
      window.localStorage.getItem = realGet;
      setMuted(false);
    }
  });
});
