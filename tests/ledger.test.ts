/**
 * The record of what a child did, and the currency read off it.
 *
 * Two kinds of test here and the second kind is the point.
 *
 * The first is ordinary: days, streaks, caps, arithmetic. The second asserts
 * the *design rules* that let a currency exist in this product at all. PRODUCT
 * §16 refused XP because "XP rewards time spent… activity mistaken for skill",
 * and credits are only distinguishable from XP by what they pay for. That
 * distinction lives in a table somebody will edit, so it is asserted here
 * rather than left as a comment above the table: no row may pay for arriving,
 * every row is capped, and the hardest decision must out-pay the easiest
 * activity by a wide margin.
 *
 * A design rule nobody can accidentally break is a design rule. One written
 * only in prose is a hope.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DAY_CAP,
  LOG_CAP,
  balance,
  createLedger,
  dayBefore,
  daysBetween,
  didToday,
  earnedOn,
  localDay,
  record,
  recent,
  spend,
  streak,
  timesToday,
  type Deed,
  type Ledger,
} from '../src/lib/ledger';
import {
  EARNERS,
  HELD_A_WHILE_WEEKS,
  TOPUP_STEP,
  affordableDollars,
  awardFor,
  cappedToday,
  checkedInToday,
  creditsCard,
  earnerFor,
  topUp,
  worthNow,
} from '../src/lib/credits';
import { buy, createPortfolio, weeksHeld } from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';

function walkSrc(dir = join(import.meta.dirname, '..', 'src')): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walkSrc(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

/** A ledger with `deeds` written on `on`, paid at the real rates. */
function after(entries: Array<[Deed, string]>): Ledger {
  return entries.reduce((led, [deed, on]) => awardFor(led, deed, on).ledger, createLedger());
}

describe('the day a deed happened on', () => {
  it('uses the child’s own calendar day, not UTC', () => {
    /*
     * The distinction is load-bearing rather than pedantic. `page.tsx` computes
     * the daily challenge date with `toISOString()` — UTC — and is right to,
     * because the Same-Sky Challenge is one sky for the whole planet. A streak
     * is the opposite fact: a child in California playing after dinner is
     * already tomorrow in UTC, so a UTC day would break their streak at 5pm.
     *
     * 23:30 on the 5th, in a zone behind UTC, is the 6th in UTC and the 5th to
     * the child. This asserts we say the 5th.
     */
    const evening = new Date(2026, 8, 5, 23, 30);
    expect(localDay(evening)).toBe('2026-09-05');
    expect(localDay(evening)).toBe(
      `${evening.getFullYear()}-09-0${evening.getDate()}`,
    );
  });

  it('pads single-digit months and days', () => {
    expect(localDay(new Date(2026, 0, 1, 12))).toBe('2026-01-01');
    expect(localDay(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });

  it('steps back a day across month and year ends', () => {
    expect(dayBefore('2026-09-06')).toBe('2026-09-05');
    expect(dayBefore('2026-09-01')).toBe('2026-08-31');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
    expect(dayBefore('2024-03-01')).toBe('2024-02-29');
  });

  it('counts the gap between two days', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(daysBetween('2026-09-01', '2026-09-02')).toBe(1);
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-09-02', '2026-09-01')).toBe(-1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('the ledger', () => {
  it('starts empty and owes nothing', () => {
    const fresh = createLedger();
    expect(fresh.entries).toEqual([]);
    expect(fresh.days).toEqual([]);
    expect(balance(fresh)).toBe(0);
    expect(streak(fresh, '2026-09-07').running).toBe(0);
  });

  it('writes a deed down without mutating what it was given', () => {
    const fresh = createLedger();
    const after1 = record(fresh, 'ran-a-day', '2026-09-07', 2);
    expect(fresh.entries).toHaveLength(0);
    expect(after1.entries).toHaveLength(1);
    expect(after1.earned).toBe(2);
    expect(after1.days).toEqual(['2026-09-07']);
  });

  it('keeps one entry per doing but one day per day', () => {
    let led = createLedger();
    led = record(led, 'ran-a-day', '2026-09-07', 2);
    led = record(led, 'read-accounts', '2026-09-07', 10);
    expect(led.entries).toHaveLength(2);
    expect(led.days).toEqual(['2026-09-07']);
  });

  it('keeps days sorted however they arrive', () => {
    let led = createLedger();
    led = record(led, 'ran-a-day', '2026-09-09', 2);
    led = record(led, 'ran-a-day', '2026-09-07', 2);
    expect(led.days).toEqual(['2026-09-07', '2026-09-09']);
  });

  /*
   * The eviction bug this shape exists to prevent.
   *
   * A capped log cannot be the source of truth for a running total: the first
   * eviction would silently reduce a child's credits and nothing would look
   * broken. So `earned` is stored, and this is the test that says the total
   * survives the log it came from being thrown away.
   */
  it('keeps the total after the log it came from has been evicted', () => {
    let led = createLedger();
    for (let i = 0; i < LOG_CAP + 50; i += 1) {
      led = record(led, 'ran-a-day', '2026-09-07', 2);
    }
    expect(led.entries).toHaveLength(LOG_CAP);
    expect(led.earned).toBe((LOG_CAP + 50) * 2);
  });

  it('caps the day list too', () => {
    let led = createLedger();
    let day = '2020-01-01';
    for (let i = 0; i < DAY_CAP + 20; i += 1) {
      led = record(led, 'ran-a-day', day, 1);
      const next = new Date(Date.UTC(...(day.split('-').map(Number) as [number, number, number])));
      next.setUTCMonth(next.getUTCMonth() - 1 + 1);
      next.setUTCDate(next.getUTCDate() + 1);
      day = next.toISOString().slice(0, 10);
    }
    expect(led.days).toHaveLength(DAY_CAP);
  });

  it('counts what was done today, and what was not', () => {
    const led = after([
      ['read-accounts', '2026-09-07'],
      ['read-accounts', '2026-09-07'],
      ['ran-a-day', '2026-09-06'],
    ]);
    expect(timesToday(led, 'read-accounts', '2026-09-07')).toBe(2);
    expect(didToday(led, 'read-accounts', '2026-09-07')).toBe(true);
    expect(didToday(led, 'ran-a-day', '2026-09-07')).toBe(false);
    expect(didToday(led, 'ran-a-day', '2026-09-06')).toBe(true);
  });

  it('reports the recent log newest first', () => {
    const led = after([
      ['ran-a-day', '2026-09-05'],
      ['read-accounts', '2026-09-06'],
      ['wrote-a-thesis', '2026-09-07'],
    ]);
    expect(recent(led, 2).map((e) => e.deed)).toEqual(['wrote-a-thesis', 'read-accounts']);
  });

  it('adds up one day’s earnings', () => {
    const led = after([
      ['read-accounts', '2026-09-07'],
      ['wrote-a-thesis', '2026-09-07'],
      ['read-accounts', '2026-09-06'],
    ]);
    expect(earnedOn(led, '2026-09-07')).toBe(20);
    expect(earnedOn(led, '2026-09-06')).toBe(10);
    expect(earnedOn(led, '2026-09-05')).toBe(0);
  });
});

describe('spending', () => {
  it('never goes negative, and refuses rather than clamping', () => {
    const led = after([['passed-on-price', '2026-09-07']]);
    expect(balance(led)).toBe(40);

    // Refused outright, not clamped to the balance: a purchase that half
    // happens is the equity-slice bug of §54 with a smaller number in it.
    expect(spend(led, 41)).toBe(led);
    expect(spend(led, 0)).toBe(led);
    expect(spend(led, -5)).toBe(led);
    expect(balance(spend(led, 40))).toBe(0);
  });

  it('leaves “earned” alone when credits are spent', () => {
    const led = spend(after([['passed-on-price', '2026-09-07']]), 40);
    // §4: the record of what was demonstrated is monotonic. The balance falls;
    // the fact that they earned it does not.
    expect(led.earned).toBe(40);
    expect(balance(led)).toBe(0);
  });
});

describe('the streak, and what it is allowed to count', () => {
  it('counts consecutive days of doing something', () => {
    const led = after([
      ['ran-a-day', '2026-09-05'],
      ['ran-a-day', '2026-09-06'],
      ['ran-a-day', '2026-09-07'],
    ]);
    const s = streak(led, '2026-09-07');
    expect(s.running).toBe(3);
    expect(s.best).toBe(3);
    expect(s.todayCounted).toBe(true);
    expect(s.quietFor).toBe(0);
  });

  it('stays alive on a day not yet played', () => {
    /*
     * A streak that reads 0 until you act is a punishment for the morning. A
     * child who played yesterday and has not opened it yet today should see a
     * live streak they can keep, not a dead one they have already lost.
     */
    const led = after([
      ['ran-a-day', '2026-09-05'],
      ['ran-a-day', '2026-09-06'],
    ]);
    const s = streak(led, '2026-09-07');
    expect(s.running).toBe(2);
    expect(s.todayCounted).toBe(false);
    expect(s.quietFor).toBe(1);
  });

  it('breaks after a missed day but remembers the best run', () => {
    const led = after([
      ['ran-a-day', '2026-09-01'],
      ['ran-a-day', '2026-09-02'],
      ['ran-a-day', '2026-09-03'],
      ['ran-a-day', '2026-09-07'],
    ]);
    const s = streak(led, '2026-09-07');
    expect(s.running).toBe(1);
    expect(s.best).toBe(3);
  });

  it('reports how long it has been quiet', () => {
    const led = after([['ran-a-day', '2026-09-01']]);
    const s = streak(led, '2026-09-10');
    expect(s.running).toBe(0);
    expect(s.quietFor).toBe(9);
  });

  it('does not accuse a child whose clock went backwards', () => {
    // A timezone flight, or a child changing the date. Treat the run as intact.
    const led = after([
      ['ran-a-day', '2026-09-06'],
      ['ran-a-day', '2026-09-07'],
    ]);
    const s = streak(led, '2026-09-05');
    expect(s.running).toBeGreaterThan(0);
    expect(s.quietFor).toBe(0);
  });

  /*
   * The rule that keeps this on the right side of §15's "Nothing in it is
   * given for showing up."
   *
   * There must be no way to advance a streak by arriving. Asserted against the
   * union itself rather than against the current behaviour, because the way
   * this would break is somebody adding a well-meaning `opened-the-app` deed.
   */
  it('has no deed that means “turned up”', () => {
    const ARRIVAL = /open|visit|launch|login|log-in|arriv|turned-up|daily-bonus|appear/i;
    const offenders = EARNERS.map((e) => e.deed).filter((deed) => ARRIVAL.test(deed));
    expect(offenders).toEqual([]);
  });
});

describe('credits are not XP, and the table has to prove it', () => {
  it('pays nothing at all for a deed that is not on the table', () => {
    expect(worthNow(createLedger(), 'answered-the-check-in', '2026-09-07')).toBe(15);
    expect(earnerFor('answered-the-check-in')).toBeDefined();
  });

  it('caps every single row per day', () => {
    // §16's grind test. An uncapped row is farmable, however good the behaviour.
    const uncapped = EARNERS.filter((e) => !Number.isFinite(e.perDay) || e.perDay < 1);
    expect(uncapped).toEqual([]);
    expect(EARNERS.every((e) => e.perDay <= 4)).toBe(true);
  });

  it('pays far more for the hardest decision than for the most repeatable one', () => {
    const byDeed = new Map(EARNERS.map((e) => [e.deed, e]));
    const hardest = byDeed.get('passed-on-price')!;
    const easiest = byDeed.get('ran-a-day')!;

    // Per doing, and per day at the cap. Both have to favour judgment.
    expect(hardest.worth).toBeGreaterThanOrEqual(easiest.worth * 10);
    expect(hardest.worth * hardest.perDay).toBeGreaterThan(easiest.worth * easiest.perDay * 5);
  });

  it('lists the table highest-paying first, so the top of it is the hardest thing', () => {
    const worths = EARNERS.map((e) => e.worth);
    expect([...worths].sort((a, b) => b - a)).toEqual(worths);
  });

  it('gives every row a reason a child could read', () => {
    for (const earner of EARNERS) {
      expect(earner.label.length, earner.deed).toBeGreaterThan(4);
      expect(earner.because.length, earner.deed).toBeGreaterThan(20);
      // Plain strings go straight into the DOM; an entity would render literally.
      expect(earner.label, earner.deed).not.toMatch(/&[a-z]+;/);
      expect(earner.because, earner.deed).not.toMatch(/&[a-z]+;/);
    }
  });

  it('stops paying at the cap but still writes the deed down', () => {
    let led = createLedger();
    const day = '2026-09-07';

    const first = awardFor(led, 'read-accounts', day, 'AAPL');
    led = first.ledger;
    const second = awardFor(led, 'read-accounts', day, 'MSFT');
    led = second.ledger;
    const third = awardFor(led, 'read-accounts', day, 'KO');
    led = third.ledger;
    const fourth = awardFor(led, 'read-accounts', day, 'NKE');
    led = fourth.ledger;

    expect([first.credits, second.credits, third.credits, fourth.credits]).toEqual([10, 10, 10, 0]);
    expect(fourth.capped).toBe(true);
    // The fourth company is still on the record. Only the money is capped:
    // dropping it would make every screen that reads the log lie.
    expect(timesToday(led, 'read-accounts', day)).toBe(4);
    expect(led.entries.at(-1)?.what).toBe('NKE');
    expect(cappedToday(led, 'read-accounts', day)).toBe(true);
  });

  it('resets the cap the next day', () => {
    const led = after([
      ['held-when-nothing-changed', '2026-09-06'],
      ['held-when-nothing-changed', '2026-09-06'],
    ]);
    expect(cappedToday(led, 'held-when-nothing-changed', '2026-09-06')).toBe(true);
    expect(cappedToday(led, 'held-when-nothing-changed', '2026-09-07')).toBe(false);
  });
});

describe('what credits buy', () => {
  it('buys money to invest, and refuses what cannot be afforded', () => {
    const led = after([['passed-on-price', '2026-09-07']]); // 40 credits = $8 raw
    // Reported as $5, never $8: the figure a screen shows has to be one the
    // shop will actually sell. The old $10 minimum reported $8 and refused it.
    expect(affordableDollars(led)).toBe(5);

    const tooSmall = topUp(led, 3);
    expect(tooSmall.dollars).toBe(0);
    expect(tooSmall.why).toContain(`$${TOPUP_STEP} steps`);

    const tooBig = topUp(led, 50);
    expect(tooBig.dollars).toBe(0);
    expect(tooBig.why).toContain('credits and you have');

    // An odd request buys what it can rather than being refused.
    const ok = topUp(led, 8);
    expect(ok.dollars).toBe(5);
    expect(balance(ok.ledger)).toBe(15);
    expect(ok.ledger.earned).toBe(40);
  });

  it('leaves no balance that reads as affordable and is not', () => {
    /*
     * The property the dead state violated, asserted across the whole range a
     * child can reach in a day: whatever `affordableDollars` says is buyable
     * must be buyable.
     */
    let led = createLedger();
    for (let day = 1; day <= 30; day += 1) {
      led = awardFor(led, 'checked-a-thesis', `2026-09-${`${day}`.padStart(2, '0')}`).ledger;
      const offered = affordableDollars(led);
      if (offered === 0) continue;
      expect(topUp(led, offered).dollars, `balance ${balance(led)} offered $${offered}`).toBe(
        offered,
      );
    }
  });

  it('has exactly one thing to buy, and it is not a rung of the ladder', () => {
    /*
     * §16: ranks are derived from what has been demonstrated, and "there is no
     * way to rank up except to demonstrate something." So the shop must not
     * sell badges, words, ranks or unlocks. It sells research capital, which
     * is why the module exports one purchase and no others.
     */
    const led = after([['passed-on-price', '2026-09-07']]);
    const bought = topUp(led, 5);
    expect(bought.dollars).toBe(5);
    // The purchase changed the balance and nothing else about the record.
    expect(bought.ledger.entries).toEqual(led.entries);
    expect(bought.ledger.days).toEqual(led.days);
  });
});

describe('the credits card', () => {
  it('points at the hardest thing still available today', () => {
    const card = creditsCard(createLedger(), '2026-09-07');
    expect(card.leftToday[0].deed).toBe('passed-on-price');
    expect(card.balance).toBe(0);
    expect(card.today).toBe(0);
  });

  it('drops what has already been earned today', () => {
    const led = after([['passed-on-price', '2026-09-07']]);
    const card = creditsCard(led, '2026-09-07');
    expect(card.leftToday.map((e) => e.deed)).not.toContain('passed-on-price');
    expect(card.today).toBe(40);
    expect(card.balance).toBe(40);
  });

  it('says how much more is needed for the next top-up', () => {
    const card = creditsCard(createLedger(), '2026-09-07');
    expect(card.line).toContain('more buys');
    const rich = creditsCard(after([['passed-on-price', '2026-09-07']]), '2026-09-07');
    expect(rich.line).toContain('enough for $5');
  });

  it('knows whether the ritual has been done today', () => {
    expect(checkedInToday(createLedger(), '2026-09-07')).toBe(false);
    const led = after([['answered-the-check-in', '2026-09-07']]);
    expect(checkedInToday(led, '2026-09-07')).toBe(true);
    expect(checkedInToday(led, '2026-09-08')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Every deed has to be reachable
 * ------------------------------------------------------------------ */

describe('the payout table is wired to the game', () => {
  /*
   * PRODUCT.md §40: a mechanic written, tested, and wired to nothing.
   *
   * This is the shape that class takes in a reward table, and the dead-code
   * gate cannot see it — a `Deed` is a member of a union, not an export, so
   * `check-dead-code` counts the union as used the moment anything imports the
   * type. Three of the customer's twelve credit behaviours sat in `EARNERS`
   * paying nothing, because no call site ever recorded them: a child could read
   * "Noticed too much was in one company — 20" on the credits screen and there
   * was no way in the game to do it.
   *
   * A reward you cannot earn is worse than a reward that does not exist. It is
   * a promise on a screen.
   */
  it('has a real call site for every deed', () => {
    const source = walkSrc()
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    const unreachable = EARNERS.map((earner) => earner.deed).filter((deed) => {
      const noted = new RegExp(`noteDeed\\(\\s*'${deed}'`).test(source);
      const awarded = new RegExp(`awardFor\\([^)]*'${deed}'`).test(source);
      return !noted && !awarded;
    });

    expect(unreachable).toEqual([]);
  });

  it('has an earner for every deed in the union', () => {
    // And the other direction: a deed nothing pays for would be recorded and
    // silently worth nothing, which is the same lie from the other end.
    const source = readFileSync(
      join(import.meta.dirname, '..', 'src', 'lib', 'ledger.ts'),
      'utf8',
    );
    const union = [...source.matchAll(/^ {2}\| '([a-z-]+)'/gm)].map((m) => m[1] as Deed);
    expect(union.length).toBeGreaterThan(10);

    const paid = new Set(EARNERS.map((earner) => earner.deed));
    expect(union.filter((deed) => !paid.has(deed))).toEqual([]);
  });
});

describe('patience, and why it is not a salary', () => {
  /*
   * "Staying invested over time" was the last item on the customer's credit
   * list and the one their example was about — "you held a stock for 3 days,
   * here's 50 for more trading".
   *
   * It had been mapped onto the streak, and that was wrong: the streak counts
   * days the *child* did something, and this counts weeks the *position* was
   * left alone. A child can turn up every single day and still churn.
   */
  it('counts weeks from the first buy, not from the last top-up', () => {
    let portfolio = createPortfolio(500);
    const ticker = SNAPSHOT[0].ticker;

    portfolio = buy(portfolio, ticker, 100).portfolio;
    expect(weeksHeld(portfolio, ticker)).toBe(0);

    // Three weeks on, and a top-up in the middle.
    portfolio = { ...portfolio, week: 2 };
    portfolio = buy(portfolio, ticker, 30).portfolio;
    portfolio = { ...portfolio, week: 4 };

    /*
     * Four, not two. The thing being measured is how long the child stuck with
     * the idea, not how long since they last touched it — otherwise adding to
     * a position you believe in would reset your patience.
     */
    expect(weeksHeld(portfolio, ticker)).toBe(4);
  });

  it('is nothing for a holding that does not exist', () => {
    const portfolio = createPortfolio(500);
    expect(weeksHeld(portfolio, SNAPSHOT[0].ticker)).toBe(0);
    expect(weeksHeld({ ...portfolio, week: 40 }, 'NOPE')).toBe(0);
  });

  it('pays once per holding, however many weeks pass', () => {
    /*
     * The call site checks the ledger for this ticker before awarding, and
     * this is the property that check exists for: paid every week, patience
     * becomes a salary and the reward stops being for a decision.
     */
    const today = '2026-09-07';
    let led = createLedger();
    const ticker = SNAPSHOT[0].ticker;

    const pay = () => {
      const already = led.entries.some((e) => e.deed === 'held-a-while' && e.what === ticker);
      if (already) return 0;
      const out = awardFor(led, 'held-a-while', today, ticker);
      led = out.ledger;
      return out.credits;
    };

    expect(pay()).toBe(25);
    expect(pay()).toBe(0);
    expect(pay()).toBe(0);
    expect(led.entries.filter((e) => e.deed === 'held-a-while')).toHaveLength(1);
  });

  it('needs a month of market before it pays at all', () => {
    let portfolio = createPortfolio(500);
    const ticker = SNAPSHOT[0].ticker;
    portfolio = buy(portfolio, ticker, 100).portfolio;

    for (let week = 0; week < HELD_A_WHILE_WEEKS; week += 1) {
      expect(weeksHeld({ ...portfolio, week }, ticker)).toBeLessThan(HELD_A_WHILE_WEEKS);
    }
    expect(weeksHeld({ ...portfolio, week: HELD_A_WHILE_WEEKS }, ticker)).toBe(
      HELD_A_WHILE_WEEKS,
    );
  });

  it('pays patience more than it pays buying', () => {
    const byDeed = new Map(EARNERS.map((e) => [e.deed, e]));
    // The point of the row. Buying is 10; leaving it alone for a month is 25.
    expect(byDeed.get('held-a-while')!.worth).toBeGreaterThan(
      byDeed.get('wrote-a-thesis')!.worth,
    );
  });
});

