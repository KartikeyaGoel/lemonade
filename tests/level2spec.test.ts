/**
 * The customer's Level 2 specification, item by item.
 *
 * This file exists because "did we build everything?" was asked three times
 * and answered wrongly twice. The first time I had built the seven build notes
 * and called the whole message done. The second time PRODUCT.md §65 found four
 * reward behaviours sitting in the payout table that nothing in the game could
 * ever award — a promise on a screen.
 *
 * Both misses had the same cause: I checked whether something was *in the
 * code* rather than whether a child could *do* it. So the question is now a
 * test run. Each assertion below names a line from the specification and
 * checks the thing that would be missing if it were unbuilt — a call site, a
 * reachable branch, a produced value — rather than an import.
 *
 * Deliberately not a snapshot and deliberately not clever. A checklist that
 * runs is worth more than a document that agrees with itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EARNERS } from '../src/lib/credits';
import { STEPS, storyFor } from '../src/lib/checkin';
import {
  BUSINESS_QUESTIONS,
  SCOUT_QUESTIONS,
  STOCK_QUESTIONS,
  rate,
} from '../src/lib/scout';
import {
  EXIT_CLAIMS,
  QUAL_CLAIMS,
  QUANT_CLAIMS,
  RISK_CLAIMS,
  buildThesis,
  driftOf,
  journalLines,
} from '../src/lib/thesis';
import { missionsFor } from '../src/lib/missions';
import { SNAPSHOT } from '../src/lib/companies';
import { createPortfolio } from '../src/lib/market';
import { MISSING_FOR_REAL, nudges } from '../src/lib/notify';
import { asCode, createInbox, openThread, receive, send } from '../src/lib/messages';
import { ECON } from '../src/lib/simulation';

const SRC = join(import.meta.dirname, '..', 'src');

function walk(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const source = () => walk().map((file) => readFileSync(file, 'utf8')).join('\n');

/* ------------------------------------------------------------------ *
 * "How rewards work: reward investor behavior"
 * ------------------------------------------------------------------ */

describe('the twelve credit behaviours', () => {
  /**
   * The list as the customer wrote it, mapped to the deed that implements it.
   *
   * Written out in their words on purpose. A mapping table in the customer's
   * language is the only version of this that can be checked against the
   * message they actually sent.
   */
  const ASKED_FOR: Array<[string, string]> = [
    ['applying the stock framework correctly', 'rated-a-business'],
    ['researching before buying', 'read-accounts'],
    ['writing a thesis', 'wrote-a-thesis'],
    ['diversifying', 'diversified'],
    ['identifying excessive concentration', 'trimmed-concentration'],
    ['understanding why the market moved', 'named-the-mover'],
    ['distinguishing company news from market noise', 'told-news-from-noise'],
    ['checking whether the thesis changed', 'checked-a-thesis'],
    ['holding when no action is warranted', 'held-when-nothing-changed'],
    ['reviewing a mistake', 'reviewed-a-mistake'],
    ['teaching a concept to a parent', 'taught-a-grown-up'],
    ['staying invested over time', 'held-a-while'],
  ];

  it('has a payout row for each', () => {
    const paid = new Set(EARNERS.map((earner) => earner.deed));
    const missing = ASKED_FOR.filter(([, deed]) => !paid.has(deed as never));
    expect(missing.map(([words]) => words)).toEqual([]);
  });

  it('has somewhere in the game each can actually be done', () => {
    /*
     * The §65 assertion. A row in a table looks exactly like a feature, and
     * four of these paid nothing because no screen ever recorded them.
     */
    const src = source();
    const unreachable = ASKED_FOR.filter(([, deed]) => {
      const noted = new RegExp(`noteDeed\\(\\s*'${deed}'`).test(src);
      const awarded = new RegExp(`awardFor\\([^)]*'${deed}'`).test(src);
      return !noted && !awarded;
    });
    expect(unreachable.map(([words]) => words)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * "Explanation needs to be grounded in good investing framework
 *  which needs two sides"
 * ------------------------------------------------------------------ */

describe('the two-sided framework', () => {
  it('asks all five business questions', () => {
    // "Does it make money / have a path to profit? Is it growing? Do customers
    // want what it sells? Does it have an advantage over competitors? Is
    // management using money well?"
    expect(BUSINESS_QUESTIONS.map((q) => q.id).sort()).toEqual(
      ['growing', 'has-an-edge', 'makes-money', 'money-well-used', 'people-want-it'].sort(),
    );
  });

  it('asks all three stock questions', () => {
    // "What am I paying for it? What expectations are already reflected in the
    // price? What could go wrong?"
    expect(STOCK_QUESTIONS.map((q) => q.id).sort()).toEqual(
      ['expectations-in-the-price', 'what-am-i-paying', 'what-could-go-wrong'].sort(),
    );
  });

  it('reports the two sides apart, so the price half cannot hide', () => {
    const company = SNAPSHOT[0];
    const answers = Object.fromEntries(
      SCOUT_QUESTIONS.map((q) => [q.id, q.holds(company, company.price)]),
    );
    const rating = rate(company, answers);
    expect(rating.business.outOf).toBe(BUSINESS_QUESTIONS.length);
    expect(rating.stock.outOf).toBe(STOCK_QUESTIONS.length);
  });
});

/* ------------------------------------------------------------------ *
 * "Daily ritual could be something like: Today's Investor Check-in"
 * ------------------------------------------------------------------ */

describe("today's investor check-in", () => {
  it('has the six steps in the order given', () => {
    expect(STEPS).toEqual([
      'what-happened', // 1. What happened?
      'why', // 2. Why did it happen?
      'does-it-touch-me', // 3. Does it affect anything I own?
      'do-i-act', // 4. Does my portfolio need action?
      'discover', // 5. Discover something new
      'credits', // 6. Earn today's credits
    ]);
  });

  it('is reachable from a screen, not only from a test', () => {
    // §40: a mechanic written, tested, and wired to nothing.
    expect(source()).toContain("case 'checkin'");
    expect(source()).toContain('CheckInScreen');
  });
});

/* ------------------------------------------------------------------ *
 * "Investment Journal. Every purchase captures…"
 * ------------------------------------------------------------------ */

describe('the investment journal', () => {
  const company = SNAPSHOT[0];
  const full = () =>
    buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
      riskId: RISK_CLAIMS[0].id,
      exitId: EXIT_CLAIMS[0].id,
    });

  it('captures all four lines', () => {
    // "I bought / Because / Biggest risk / I plan to hold unless"
    const lines = journalLines(full(), company.name);
    expect(lines[0]).toMatch(/^I bought: /);
    expect(lines[1]).toMatch(/^Because: /);
    expect(lines[2]).toMatch(/^Biggest risk: /);
    expect(lines[3]).toMatch(/^I plan to hold unless /);
  });

  it('collects the two new fields from a screen', () => {
    const src = source();
    expect(src).toContain('RISK_CLAIMS');
    expect(src).toContain('EXIT_CLAIMS');
    expect(src).toMatch(/riskId/);
    expect(src).toMatch(/exitId/);
  });

  it('lets the duck come back when a reason stops being true', () => {
    /*
     * "You bought this because revenue was growing quickly. Revenue growth has
     * now slowed. Want to revisit your thesis?" — the customer's own example,
     * which they called the strongest mechanic available.
     */
    const payback = QUANT_CLAIMS.find((claim) => claim.id === 'pays-back-fast')!;
    const cheap = company.price * 0.3;
    const thesis = buildThesis({
      company,
      quantId: payback.id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: cheap,
      dollars: 100,
    });
    const drift = driftOf(thesis, company, company.price * 8);
    expect(drift.drifted).toBe(true);
    expect(drift.says).toMatch(/not true any more/);
    // And it reaches a screen with something to press.
    expect(source()).toContain('onChecked');
  });
});

/* ------------------------------------------------------------------ *
 * "Parent Sharing. The child could get a mission…"
 * ------------------------------------------------------------------ */

describe('parent missions', () => {
  it('produces all three the customer listed', () => {
    const base = createPortfolio(500);
    const withWeek = {
      ...base,
      week: 1,
      priceHistory: Object.fromEntries(
        Object.entries(base.priceHistory).map(([t, s]) => [t, [s[0], s[0] * 1.06]]),
      ),
    };
    const theses = SNAPSHOT.slice(0, 2).map((company, i) =>
      buildThesis({
        company,
        quantId: QUANT_CLAIMS[i % QUANT_CLAIMS.length].id,
        qualId: QUAL_CLAIMS[0].id,
        week: 0,
        priceAtBuy: company.price * 0.4,
        dollars: 100,
      }),
    );

    const all = missionsFor({
      theses,
      companyFor: (ticker) => SNAPSHOT.find((company) => company.ticker === ticker),
      story: storyFor(withWeek),
      worthOf: () => 100,
    });

    // "Teach your parent why you bought one of your stocks."
    // "Explain today's market move to someone at home."
    // "Show your parent your portfolio and explain which holding you're most
    //  confident about."
    expect(all.map((mission) => mission.id).sort()).toEqual(
      ['most-confident', 'what-moved', 'why-i-bought'].sort(),
    );
  });

  it('rewards the telling', () => {
    expect(source()).toMatch(/noteDeed\('taught-a-grown-up'/);
  });
});

/* ------------------------------------------------------------------ *
 * The seven build notes
 * ------------------------------------------------------------------ */

describe('the build notes', () => {
  it('shows one opening price, not two', () => {
    // "On first slide it shows 1.5 then it shows 1"
    expect(ECON.OPENING_PRICE).toBeGreaterThan(0);
    // And no component may hard-code one — pinned in tests/layout.test.ts.
    expect(source()).not.toMatch(/price=\{1\.5\}/);
  });

  it('says what the practice days are for and when they end', () => {
    // "Goal to try things out - need a better defined goal" and "2 days to try
    // things out - but 7 days to play"
    expect(source()).toContain('Practice ');
    expect(source()).toMatch(/goal starts on day/);
  });

  it('has no sugar left anywhere', () => {
    // "Change sugar to honey"
    const offenders = walk().filter((file) => /sugar/i.test(readFileSync(file, 'utf8')));
    // storage.ts keeps one deliberate mention: the old persisted key.
    expect(offenders.map((f) => f.slice(f.indexOf('src')))).toEqual(['src/lib/storage.ts']);
  });

  it('warns before selling out rather than after', () => {
    // "It turned out hot, you're going to sell out soon"
    expect(source()).toMatch(/going to sell out soon/);
  });

  it('lets the child let the crowd in', () => {
    // "Tap to have the people stream in… maybe for only level 1"
    expect(source()).toMatch(/Wave them over/);
    expect(source()).toMatch(/interactive=\{game\.act === 1\}/);
  });
});

/* ------------------------------------------------------------------ *
 * "notifications throughout the day abt portfolio of me or friends"
 * ------------------------------------------------------------------ */

describe('the parts that need a server, and what stands in for them', () => {
  it('decides what to say without one', () => {
    const said = nudges({
      ledger: { version: 1, earned: 0, spent: 0, entries: [], days: [] },
      today: '2026-09-07',
      checkIn: null,
      drifts: [],
      fromGrownUp: 2,
      canSpend: false,
    });
    expect(said.length).toBeGreaterThan(0);
    expect(source()).toContain('showNotice');
  });

  it('carries a message between two children, with no server', () => {
    const inbox = openThread(createInbox(), 'friend', 'Ada');
    const sent = send(inbox, inbox.threads[0].id, 'child', 'I bought Costco', '2026-09-07');
    const { code } = asCode(sent.inbox, sent.message!.id, 'Sam');
    expect(code).toMatch(/^MSG-/);

    const theirs = receive(createInbox(), code!, '2026-09-08');
    expect(theirs.message?.body).toBe('I bought Costco');
  });

  it('says in code what is still missing, including the consent', () => {
    /*
     * The honest half. These are not gaps in a feature, they are one decision
     * the customer has not taken — and the list lives next to the code so the
     * next person to open the file finds it.
     */
    const all = MISSING_FOR_REAL.join(' ').toLowerCase();
    for (const piece of ['push', 'vapid', 'server', 'consent', 'unsubscribe']) {
      expect(all, piece).toContain(piece);
    }
  });
});
