/**
 * What is worth telling a child, and — mostly — what to shut up about.
 *
 * A notification system for children is judged by what it does not send, so
 * most of this file asserts silence. The standard is PRODUCT.md §15: the
 * engines are *records of the child*, never complaints about them, and "you
 * have not played for 3 days" is a telling-off.
 *
 * The policy is the half that needs no server and the half where a
 * notification system is good or awful. It is therefore the half that gets the
 * tests, and it is finished — see `MISSING_FOR_REAL` for the transport, which
 * is a decision rather than a gap.
 */
import { describe, it, expect } from 'vitest';
import {
  BUILT_WITHOUT_A_SERVER,
  MAX_A_DAY,
  MISSING_FOR_REAL,
  nudges,
  roomLeftToday,
  sentToday,
  unshown,
  type NudgeContext,
} from '../src/lib/notify';
import { createLedger, record, type Ledger } from '../src/lib/ledger';
import { awardFor } from '../src/lib/credits';
import { checkIn } from '../src/lib/checkin';
import { createPortfolio } from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';
import {
  QUAL_CLAIMS,
  QUANT_CLAIMS,
  buildThesis,
  driftOf,
  type Drift,
} from '../src/lib/thesis';

const TODAY = '2026-09-07';

/**
 * A real drift, from the real function.
 *
 * Hand-written stand-ins were "Apple changed." — fourteen characters, where
 * the real thing is a full sentence carrying the arithmetic. The assertion
 * that every nudge body says something substantial failed against the fixture
 * rather than against the code, which is PRODUCT.md §49 with a smaller number
 * in it: build fixtures from the real constructors.
 */
function realDrift(ticker = 'AAPL'): Drift {
  const company = SNAPSHOT.find((c) => c.ticker === ticker) ?? SNAPSHOT[0];
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
  if (!drift.drifted) throw new Error('fixture did not drift');
  return drift;
}

function withHistory() {
  const base = createPortfolio(500);
  return {
    ...base,
    week: 1,
    priceHistory: Object.fromEntries(
      Object.entries(base.priceHistory).map(([t, series]) => [t, [series[0], series[0] * 1.06]]),
    ),
  };
}

function context(over: Partial<NudgeContext> = {}): NudgeContext {
  const portfolio = withHistory();
  return {
    ledger: createLedger(),
    today: TODAY,
    checkIn: checkIn(portfolio, { companiesStudied: [] }, createLedger(), TODAY, 500),
    drifts: [],
    fromGrownUp: 0,
    canSpend: false,
    ...over,
  };
}

describe('what it will not say', () => {
  /*
   * The rule that made the streak nudge hard to write. It fires on a live
   * streak and names the run — "3 days running" — never the gap.
   */
  it('never names how long it has been', () => {
    const nagging = /have not|haven't|missed|been a while|days ago|come back|where have you|still not|forgot/i;

    // Every shape of context, including a long-abandoned one.
    let stale: Ledger = createLedger();
    for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      stale = record(stale, 'ran-a-day', day, 1);
    }

    const shapes: NudgeContext[] = [
      context(),
      context({ ledger: stale }),
      context({ fromGrownUp: 3 }),
      context({ canSpend: true, ledger: awardFor(createLedger(), 'passed-on-price', TODAY).ledger }),
      context({ drifts: [realDrift()] }),
    ];

    for (const shape of shapes) {
      for (const nudge of nudges(shape)) {
        expect(`${nudge.title} ${nudge.body}`, nudge.kind).not.toMatch(nagging);
      }
    }
  });

  it('says nothing at all to a child with no market', () => {
    // `unlocks.ts`'s rule applied to a message: nothing exists before the
    // child has done the thing that gives the subject a meaning.
    expect(nudges(context({ checkIn: null }))).toEqual([]);
  });

  it('never sends more than two, whatever is going on', () => {
    const everything = context({
      fromGrownUp: 4,
      canSpend: true,
      ledger: ['passed-on-price', 'reviewed-a-mistake'].reduce(
        (led, deed) => awardFor(led, deed as 'passed-on-price', TODAY).ledger,
        record(record(createLedger(), 'ran-a-day', '2026-09-05', 1), 'ran-a-day', '2026-09-06', 1),
      ),
      drifts: [realDrift()],
    });
    expect(nudges(everything).length).toBe(MAX_A_DAY);
  });

  it('says nothing about a check-in already done', () => {
    const portfolio = withHistory();
    const done = awardFor(createLedger(), 'answered-the-check-in', TODAY).ledger;
    const state = checkIn(portfolio, { companiesStudied: [] }, done, TODAY, 500);
    expect(state.doneToday).toBe(true);
    expect(nudges(context({ checkIn: state, ledger: done })).map((n) => n.kind)).not.toContain(
      'check-in-ready',
    );
  });

  it('says nothing about credits there is nowhere to spend', () => {
    const rich = awardFor(createLedger(), 'passed-on-price', TODAY).ledger;
    expect(nudges(context({ ledger: rich, canSpend: false })).map((n) => n.kind)).not.toContain(
      'credits-to-spend',
    );
  });

  it('says nothing about a balance too small to buy anything', () => {
    const thin = awardFor(createLedger(), 'ran-a-day', TODAY).ledger;
    expect(
      nudges(context({ ledger: thin, canSpend: true })).map((n) => n.kind),
    ).not.toContain('credits-to-spend');
  });

  it('does not brag about a one-day streak', () => {
    // Telling somebody they have a one-day streak is telling them they played
    // yesterday.
    const one = record(createLedger(), 'ran-a-day', '2026-09-06', 1);
    expect(nudges(context({ ledger: one })).map((n) => n.kind)).not.toContain('streak-alive');
  });

  it('does not mention a streak already counted today', () => {
    let led = createLedger();
    for (const day of ['2026-09-05', '2026-09-06', TODAY]) led = record(led, 'ran-a-day', day, 1);
    expect(nudges(context({ ledger: led })).map((n) => n.kind)).not.toContain('streak-alive');
  });
});

describe('what it does say, and in what order', () => {
  it('puts a changed reason above everything else', () => {
    /*
     * Ordered by what a child can act on, not by what flatters the product. A
     * reason that stopped being true is the only nudge about money they have
     * already committed.
     */
    const loud = context({
      fromGrownUp: 2,
      canSpend: true,
      drifts: [realDrift()],
    });
    expect(nudges(loud)[0].kind).toBe('reason-changed');
  });

  it('puts a grown-up above the check-in', () => {
    // Somebody took the trouble; a child should not find it three days later.
    const kinds = nudges(context({ fromGrownUp: 1 })).map((n) => n.kind);
    expect(kinds.indexOf('grown-up-wrote')).toBeLessThan(kinds.indexOf('check-in-ready'));
  });

  it('names the company rather than announcing a chore', () => {
    const only = nudges(context()).find((n) => n.kind === 'check-in-ready')!;
    // "Your check-in is ready" is a chore with a bell on it.
    expect(only.title).not.toMatch(/check.?in/i);
    expect(SNAPSHOT.some((company) => only.title.includes(company.name))).toBe(true);
  });

  it('sends every nudge somewhere it can be acted on', () => {
    const everywhere = context({
      fromGrownUp: 1,
      canSpend: true,
      drifts: [realDrift()],
    });
    for (const nudge of [...nudges(everywhere), ...nudges(context())]) {
      expect(['checkin', 'market', 'messages', 'credits'], nudge.kind).toContain(nudge.goTo);
      expect(nudge.title.length, nudge.kind).toBeGreaterThan(3);
      expect(nudge.body.length, nudge.kind).toBeGreaterThan(15);
    }
  });
});

describe('not saying it twice', () => {
  it('drops what has already been shown', () => {
    const here = context();
    const first = nudges(here)[0];
    expect(unshown(here, []).map((n) => n.id)).toContain(first.id);
    expect(unshown(here, [first.id]).map((n) => n.id)).not.toContain(first.id);
  });

  it('keys ids by day, so the same reason can arrive tomorrow', () => {
    const today = nudges(context())[0].id;
    const tomorrow = nudges(context({ today: '2026-09-08' }))[0].id;
    expect(today).not.toBe(tomorrow);
    expect(today.endsWith(`:${TODAY}`)).toBe(true);
  });

  it('keys a changed reason by which holding it is about', () => {
    // Worth saying once about Apple on Tuesday and again about Nike on Friday,
    // and never twice about Apple on Tuesday.
    const apple = nudges(context({ drifts: [realDrift('AAPL')] }))[0].id;
    const nike = nudges(context({ drifts: [realDrift('NKE')] }))[0].id;
    expect(apple).not.toBe(nike);
  });

  it('holds the daily cap across a reload', () => {
    /*
     * Without this, closing and reopening the tab would re-earn the whole
     * allowance — which is how a two-a-day promise becomes twenty.
     */
    const shown = [`check-in-ready:${TODAY}`, `streak-alive:${TODAY}`];
    expect(sentToday(shown, TODAY)).toBe(2);
    expect(roomLeftToday(shown, TODAY)).toBe(0);
    // Yesterday's do not count against today.
    expect(roomLeftToday(['check-in-ready:2026-09-06'], TODAY)).toBe(MAX_A_DAY);
  });
});

describe('the honest account of what is missing', () => {
  /*
   * These two lists are a pair on purpose. A single list of holes reads like a
   * broken feature; the pair reads like what it is — a feature whose policy is
   * finished and whose delivery is one decision away.
   */
  it('names the transport pieces, including the consent', () => {
    const all = MISSING_FOR_REAL.join(' ').toLowerCase();
    expect(all).toContain('push');
    expect(all).toContain('vapid');
    expect(all).toContain('server');
    expect(all).toContain('consent');
    // The unsubscribe, which is the one people forget.
    expect(all).toContain('unsubscribe');
  });

  it('names what does work, so the pair is not only a list of holes', () => {
    expect(BUILT_WITHOUT_A_SERVER.length).toBeGreaterThanOrEqual(4);
    const all = BUILT_WITHOUT_A_SERVER.join(' ').toLowerCase();
    expect(all).toContain('cap');
    expect(all).toContain('grown-up screen');
  });
});
