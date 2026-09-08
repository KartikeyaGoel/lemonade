import { describe, it, expect } from 'vitest';
import { SNAPSHOT, findCompany, metricsFor } from '../src/lib/companies';
import {
  EXIT_CLAIMS,
  QUAL_CLAIMS,
  QUANT_CLAIMS,
  RISK_CLAIMS,
  buildThesis,
  checkQuant,
  claimsThatHold,
  driftOf,
  drifted,
  journalLines,
  reasoningSound,
  scoreAll,
  scoreThesis,
  thesisLine,
} from '../src/lib/thesis';

const apple = findCompany('AAPL')!;
const roblox = findCompany('RBLX')!;
const netflix = findCompany('NFLX')!;
const nike = findCompany('NKE')!;

function thesisFor(ticker: string, quantId: string, qualId: string, priceAtBuy?: number) {
  return buildThesis({
    company: findCompany(ticker)!,
    quantId,
    qualId,
    week: 1,
    priceAtBuy: priceAtBuy ?? findCompany(ticker)!.price,
    dollars: 100,
  });
}

describe('the number reasons', () => {
  it('gives every company at least one reason its own figures support', () => {
    for (const company of SNAPSHOT) {
      expect(claimsThatHold(company).length, company.ticker).toBeGreaterThan(0);
    }
  });

  it('does not let every reason apply to everything', () => {
    for (const claim of QUANT_CLAIMS) {
      const holdsFor = SNAPSHOT.filter((company) => claim.holds(company, company.price));
      expect(holdsFor.length, claim.id).toBeGreaterThan(0);
      expect(holdsFor.length, claim.id).toBeLessThan(SNAPSHOT.length);
    }
  });

  it('refuses "you get your money back quickly" about a dear company', () => {
    // Asserted against the live figure rather than a literal, because the
    // fundamentals are fetched and Apple's P/E moves.
    expect(metricsFor(apple).pe).toBeGreaterThan(30);
    expect(checkQuant('pays-back-fast', apple).holds).toBe(false);
  });

  it('accepts it about a P/E under 30', () => {
    expect(metricsFor(nike).pe).toBeLessThan(30);
    expect(checkQuant('pays-back-fast', nike).holds).toBe(true);
  });

  it('shows the division either way, so a no is also a lesson', () => {
    const no = checkQuant('worth-the-price', apple);
    expect(no.holds).toBe(false);
    expect(no.evidence).toMatch(/\d/);
    expect(no.evidence).toContain('÷');
    const yes = checkQuant('worth-the-price', netflix);
    expect(yes.holds).toBe(true);
    expect(yes.evidence).toContain('÷');
  });

  it('will not claim a loss-making company has a payback time', () => {
    expect(metricsFor(roblox).pe).toBeNull();
    expect(checkQuant('pays-back-fast', roblox).holds).toBe(false);
    expect(checkQuant('pays-back-fast', roblox).evidence).toContain('no profit');
  });

  it('lets "loses money now but growing fast" be a legitimate reason', () => {
    // Judged on revenue growth. A company with no profit has no profit growth
    // rate, and on the real filings Roblox's was a widening loss — which failed
    // the one claim that exists for it.
    expect(roblox.netIncomeM).toBeLessThan(0);
    expect(roblox.revenueGrowth).toBeGreaterThanOrEqual(0.15);
    expect(checkQuant('not-profitable-yet', roblox).holds).toBe(true);
    expect(checkQuant('not-profitable-yet', apple).holds).toBe(false);
  });

  it('treats an unknown reason as one that does not hold', () => {
    expect(checkQuant('because-i-like-it', apple).holds).toBe(false);
  });
});

describe('the story reasons', () => {
  it('includes reasons that argue against buying', () => {
    expect(QUAL_CLAIMS.filter((claim) => claim.bearish).length).toBeGreaterThan(0);
  });

  it('records pairing a bearish reason with a buy as the contradiction it is', () => {
    const thesis = thesisFor('AAPL', 'keeps-a-lot', 'everyone-has-one');
    expect(thesis.contradiction).toBe(true);
    expect(reasoningSound(thesis)).toBe(false);
  });

  it('counts a sound thesis as sound', () => {
    const thesis = thesisFor('AAPL', 'keeps-a-lot', 'cant-copy-it');
    expect(thesis.quantHeld).toBe(true);
    expect(thesis.contradiction).toBe(false);
    expect(reasoningSound(thesis)).toBe(true);
  });

  it('reads as one sentence a kid could say out loud', () => {
    const line = thesisLine(thesisFor('NFLX', 'grows-fast', 'pay-every-month'));
    expect(line).toContain('NFLX');
    expect(line).toContain('growing fast');
    expect(line).toContain('every month');
  });
});

describe('grading the decision, not the outcome', () => {
  // Built at Apple's real price, because the claims are now checked against the
  // price actually being paid — at an arbitrary $100 Apple's P/E is 13 and
  // "you get your money back quickly" becomes *true*, which quietly turned the
  // deliberately-unsound thesis into a sound one.
  const paid = apple.price;
  const sound = thesisFor('AAPL', 'keeps-a-lot', 'cant-copy-it', paid);
  const unsound = thesisFor('AAPL', 'pays-back-fast', 'cant-copy-it', paid);
  const up = paid * 1.2;
  const down = paid * 0.8;

  it('builds the fixtures it thinks it does', () => {
    expect(sound.quantHeld).toBe(true);
    expect(unsound.quantHeld).toBe(false);
  });

  it('calls a sound reason that made money a good call', () => {
    expect(scoreThesis(sound, up).verdict).toBe('good-call');
  });

  it('calls an unsound reason that made money luck, and says so plainly', () => {
    const score = scoreThesis(unsound, up);
    expect(score.verdict).toBe('lucky');
    expect(score.madeMoney).toBe(true);
    expect(score.lesson.toLowerCase()).toContain('luck');
  });

  it('does not blame a sound reason for a bad twelve weeks', () => {
    const score = scoreThesis(sound, down);
    expect(score.verdict).toBe('right-idea-wrong-time');
    expect(score.lesson).toContain('held up');
  });

  it('closes the loop when an unsound reason also lost money', () => {
    expect(scoreThesis(unsound, down).verdict).toBe('now-you-know');
  });

  it('treats a contradiction that made money as luck too, and names the contradiction', () => {
    const contradicted = thesisFor('AAPL', 'keeps-a-lot', 'switching-away', paid);
    const score = scoreThesis(contradicted, up);
    expect(score.verdict).toBe('lucky');
    expect(score.lesson).toContain('against buying');
  });

  it('treats flat as not having made money', () => {
    expect(scoreThesis(sound, paid).madeMoney).toBe(false);
  });

  it('judges a value claim at the price paid, not at some other price', () => {
    // The same claim about the same company, cheap and dear.
    const cheap = thesisFor('AAPL', 'pays-back-fast', 'cant-copy-it', apple.price / 4);
    const dear = thesisFor('AAPL', 'pays-back-fast', 'cant-copy-it', apple.price);
    expect(cheap.quantHeld).toBe(true);
    expect(dear.quantHeld).toBe(false);
  });
});

describe('the end-of-run report', () => {
  const endPrice = (ticker: string) => {
    const company = findCompany(ticker)!;
    // AAPL up a fifth, NFLX down a fifth, from whatever the real price is.
    return ticker === 'AAPL' ? company.price * 1.2 : company.price * 0.8;
  };

  it('leads with the luck when there was luck, not with the money', () => {
    const report = scoreAll(
      [
        thesisFor('AAPL', 'pays-back-fast', 'cant-copy-it'), // unsound, up
        thesisFor('NFLX', 'grows-fast', 'pay-every-month'), // sound, down
      ],
      endPrice,
    );
    expect(report.lucky).toBe(1);
    expect(report.summary.toLowerCase()).toContain('luck');
  });

  it('credits sound thinking even when the money went the wrong way', () => {
    const report = scoreAll([thesisFor('NFLX', 'grows-fast', 'pay-every-month')], endPrice);
    expect(report.sound).toBe(1);
    expect(report.lucky).toBe(0);
    expect(report.summary).toContain('sound');
  });

  it('says nothing was learned when nothing was written down', () => {
    expect(scoreAll([], endPrice).summary).toContain('did not write a reason');
  });
});

/* ------------------------------------------------------------------ *
 * The other two halves of the journal
 * ------------------------------------------------------------------ */

describe('biggest risk, and what would change my mind', () => {
  const company = SNAPSHOT[0];

  it('records both when they are given', () => {
    const thesis = buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
      riskId: RISK_CLAIMS[0].id,
      exitId: EXIT_CLAIMS[0].id,
    });
    expect(thesis.riskId).toBe(RISK_CLAIMS[0].id);
    expect(thesis.exitId).toBe(EXIT_CLAIMS[0].id);
  });

  it('leaves them off rather than storing an id that means nothing', () => {
    /*
     * One meaning per absent field. A `riskId` that matches no claim would
     * make `riskClaim` return undefined, and every reader would then have to
     * guess whether that meant "not asked" or "asked and broken".
     */
    const thesis = buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
      riskId: 'not-a-real-risk',
      exitId: '',
    });
    expect('riskId' in thesis).toBe(false);
    expect('exitId' in thesis).toBe(false);
  });

  /*
   * The constraint that decided the shape of this feature.
   *
   * A `Thesis` travels between children — `club.ts` puts one inside every
   * proposal so a friend can read it before voting — and PRIVACY.md promises
   * "No free text between children". So both new fields are ids picked from a
   * list, and this is the test that stops somebody helpfully turning one into
   * a text box.
   */
  it('carries only ids, so nothing a child typed can travel', () => {
    const thesis = buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
      riskId: RISK_CLAIMS[2].id,
      exitId: EXIT_CLAIMS[1].id,
    });

    for (const [key, value] of Object.entries(thesis)) {
      if (typeof value !== 'string') continue;
      // Every string on a thesis is a ticker, an id, a date or a name the
      // child chose for themselves — never prose. Prose has spaces in it.
      if (key === 'by') continue;
      expect(value, `${key} looks like free text`).not.toMatch(/\s/);
    }
  });

  it('gives every risk something to watch for, so it is checkable', () => {
    for (const risk of RISK_CLAIMS) {
      expect(risk.label.length, risk.id).toBeGreaterThan(8);
      expect(risk.watchFor.length, risk.id).toBeGreaterThan(15);
    }
  });

  /*
   * The mirror image of the habit this module exists to refuse.
   *
   * `thesis.ts` opens by saying the most dangerous thing this product could
   * teach is "I bought it because it went up". "I will sell if it goes down"
   * is the same mistake pointing the other way, so no exit may be about the
   * price.
   */
  it('has no exit that is really about the share price', () => {
    const priceish = /price|went down|goes down|drops|falls|cheaper|dearer|worth less/i;
    expect(EXIT_CLAIMS.filter((claim) => priceish.test(claim.label))).toEqual([]);
  });

  it('has no exit a child could claim on any given day', () => {
    /*
     * The property behind the rule above. Every exit has to require the
     * *business* to have changed, because an exit that is always available is
     * a rubber stamp rather than a test — and this list is the test a child
     * set themselves.
     *
     * "I find a better business at a better price" was in here and failed the
     * price rule; the fix was to remove it rather than to reword it, because
     * opportunity cost is exactly the always-available exit.
     */
    const alwaysAvailable = /I find|I want|I change my mind|I feel|I decide/i;
    expect(EXIT_CLAIMS.filter((claim) => alwaysAvailable.test(claim.label))).toEqual([]);
    expect(EXIT_CLAIMS.length).toBeGreaterThanOrEqual(4);
  });

  it('reads back as the four lines the note asked for', () => {
    const thesis = buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
      riskId: RISK_CLAIMS[0].id,
      exitId: EXIT_CLAIMS[0].id,
    });
    const lines = journalLines(thesis, company.name);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(`I bought: ${company.name}`);
    expect(lines[1]).toMatch(/^Because: /);
    expect(lines[2]).toMatch(/^Biggest risk: /);
    expect(lines[3]).toMatch(/^I plan to hold unless /);
  });

  it('prints two lines, not four with blanks, for an older entry', () => {
    // Every thesis written before these fields existed. An empty field reads
    // as an answer, so the line is left out instead.
    const thesis = buildThesis({
      company,
      quantId: QUANT_CLAIMS[0].id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: company.price,
      dollars: 100,
    });
    const lines = journalLines(thesis, company.name);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).not.toMatch(/Biggest risk|hold unless/);
  });
});

describe('a reason that has stopped being true', () => {
  const company = SNAPSHOT[0];

  /** A thesis whose number claim held at the price it was bought at. */
  function heldAt(price: number) {
    const claim = QUANT_CLAIMS.find((c) => c.holds(company, price)) ?? QUANT_CLAIMS[0];
    return buildThesis({
      company,
      quantId: claim.id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: price,
      dollars: 100,
    });
  }

  it('says nothing while the reason still holds', () => {
    const cheap = company.price * 0.5;
    const thesis = heldAt(cheap);
    expect(thesis.quantHeld).toBe(true);
    expect(driftOf(thesis, company, cheap).drifted).toBe(false);
    expect(driftOf(thesis, company, cheap).says).toBe('');
  });

  it('speaks up when a value claim stops holding at a higher price', () => {
    /*
     * The exact mechanic the note asked for, and it is derived rather than
     * generated: the same `holds()` function, twice, at two prices. "You get
     * your money back quickly" is true at a low price and false at a high one,
     * with nothing about the business having changed — which is the honest
     * lesson about what a price is.
     */
    const payback = QUANT_CLAIMS.find((c) => c.id === 'pays-back-fast')!;
    const cheap = company.price * 0.3;
    expect(payback.holds(company, cheap)).toBe(true);

    const thesis = buildThesis({
      company,
      quantId: payback.id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: cheap,
      dollars: 100,
    });

    const dear = company.price * 8;
    expect(payback.holds(company, dear)).toBe(false);

    const drift = driftOf(thesis, company, dear);
    expect(drift.drifted).toBe(true);
    expect(drift.says).toContain(company.name);
    expect(drift.says).toMatch(/not true any more/);
    // It has to carry the figures, not just the verdict.
    expect(drift.says.length).toBeGreaterThan(80);
  });

  it('stays quiet about a reason that never held in the first place', () => {
    /*
     * Already recorded as a mismatch at purchase and graded at the end.
     * Raising it again now is nagging about a decision the child has been
     * shown once and will be shown again.
     */
    const dear = company.price * 8;
    const payback = QUANT_CLAIMS.find((c) => c.id === 'pays-back-fast')!;
    const thesis = buildThesis({
      company,
      quantId: payback.id,
      qualId: QUAL_CLAIMS[0].id,
      week: 0,
      priceAtBuy: dear,
      dollars: 100,
    });
    expect(thesis.quantHeld).toBe(false);
    expect(driftOf(thesis, company, dear * 1.5).drifted).toBe(false);
  });

  it('reports only the drifted ones across a whole portfolio', () => {
    const payback = QUANT_CLAIMS.find((c) => c.id === 'pays-back-fast')!;
    const cheap = company.price * 0.3;
    const other = SNAPSHOT[1];

    const theses = [
      buildThesis({
        company,
        quantId: payback.id,
        qualId: QUAL_CLAIMS[0].id,
        week: 0,
        priceAtBuy: cheap,
        dollars: 100,
      }),
      buildThesis({
        company: other,
        quantId: payback.id,
        qualId: QUAL_CLAIMS[0].id,
        week: 0,
        priceAtBuy: other.price * 0.3,
        dollars: 100,
      }),
    ];

    const out = drifted(
      theses,
      (ticker) => SNAPSHOT.find((c) => c.ticker === ticker),
      (ticker) => (ticker === company.ticker ? company.price * 8 : other.price * 0.3),
    );
    expect(out).toHaveLength(1);
    expect(out[0].says).toContain(company.name);
  });

  it('says nothing about a ticker it cannot find', () => {
    const thesis = heldAt(company.price * 0.5);
    const out = drifted([{ ...thesis, ticker: 'NOPE' }], () => undefined, () => 1);
    expect(out).toEqual([]);
  });
});

