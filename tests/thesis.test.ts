import { describe, it, expect } from 'vitest';
import { SNAPSHOT, findCompany, metricsFor } from '../src/lib/companies';
import {
  QUAL_CLAIMS,
  QUANT_CLAIMS,
  buildThesis,
  checkQuant,
  claimsThatHold,
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
