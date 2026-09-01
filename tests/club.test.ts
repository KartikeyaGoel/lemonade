import { describe, it, expect } from 'vitest';
import {
  MAX_MEMBERS,
  advanceClubWeek,
  clubAttribution,
  clubLog,
  createClub,
  decodeClub,
  encodeClub,
  joinClub,
  openProposal,
  pass,
  propose,
  vote,
  whoseTurn,
  type ClubState,
} from '../src/lib/club';
import { findCompany } from '../src/lib/companies';
import {
  MAX_POSITION_FRACTION,
  currentDate,
  currentPrice,
  totalValue,
} from '../src/lib/market';
import { QUANT_CLAIMS, checkQuant } from '../src/lib/thesis';

const apple = findCompany('AAPL')!;
const netflix = findCompany('NFLX')!;
const nike = findCompany('NKE')!;

function threeMemberClub(cash = 3000): ClubState {
  let club = createClub('Lunch Table', 'Ada', cash, 7);
  club = joinClub(club, 'Kai').club;
  club = joinClub(club, 'Yusuf').club;
  return club;
}

describe('setting one up', () => {
  it('starts with the founder on the clock', () => {
    const club = createClub('Lunch Table', 'Ada', 1000, 7);
    expect(club.members.map((m) => m.name)).toEqual(['Ada']);
    expect(whoseTurn(club)).toBe('Ada');
    expect(club.portfolio.cash).toBe(1000);
  });

  it('pools a joiner\'s stake into the same pot', () => {
    const club = joinClub(createClub('C', 'Ada', 1000, 7), 'Kai', 500).club;
    expect(club.portfolio.cash).toBe(1500);
    expect(club.startingCash).toBe(1500);
  });

  it('refuses a duplicate name, because votes are keyed by it', () => {
    const club = joinClub(createClub('C', 'Ada', 1000, 7), 'Kai').club;
    const again = joinClub(club, 'kai');
    expect(again.ok).toBe(false);
    expect(again.reason).toContain('already in this club');
  });

  it('caps the club', () => {
    let club = createClub('C', 'A', 1000, 7);
    for (const name of ['B', 'C2', 'D']) club = joinClub(club, name).club;
    expect(club.members).toHaveLength(MAX_MEMBERS);
    expect(joinClub(club, 'E').ok).toBe(false);
  });
});

describe('you cannot spend the club\'s money without a reason', () => {
  it('refuses a proposal with no number reason', () => {
    const club = threeMemberClub();
    const result = propose(club, 'Ada', apple, 200, '', 'cant-copy-it');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('both halves');
  });

  it('refuses a proposal with no story reason', () => {
    const club = threeMemberClub();
    expect(propose(club, 'Ada', apple, 200, 'keeps-a-lot', '').ok).toBe(false);
  });

  it('refuses a club of one, because nobody could say no', () => {
    const solo = createClub('C', 'Ada', 1000, 7);
    const result = propose(solo, 'Ada', apple, 200, 'keeps-a-lot', 'cant-copy-it');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('at least two');
  });

  it('refuses somebody proposing out of turn', () => {
    const club = threeMemberClub();
    const result = propose(club, 'Kai', apple, 200, 'keeps-a-lot', 'cant-copy-it');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Ada's turn");
  });

  it('refuses a second proposal while one is waiting on votes', () => {
    let club = threeMemberClub();
    club = propose(club, 'Ada', apple, 200, 'keeps-a-lot', 'cant-copy-it').club;
    const second = propose(club, 'Kai', netflix, 200, 'grows-fast', 'pay-every-month');
    expect(second.ok).toBe(false);
  });

  it('holds the club to the same position cap as a solo portfolio', () => {
    const club = threeMemberClub(1000);
    const tooMuch = MAX_POSITION_FRACTION * 1000 + 50;
    const result = propose(club, 'Ada', apple, tooMuch, 'keeps-a-lot', 'cant-copy-it');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('most the club can put into AAPL');
  });

  it('records whether the reason held, at the moment it was given', () => {
    const club = threeMemberClub();
    const asOf = currentDate(club.portfolio);
    const price = currentPrice(club.portfolio, 'AAPL');
    const holding = QUANT_CLAIMS.find((claim) => claim.holds(apple, price, asOf))!;
    const strong = propose(club, 'Ada', apple, 200, holding.id, 'cant-copy-it');
    expect(openProposal(strong.club)!.thesis.quantHeld).toBe(true);
  });

  it('checks the reason against the price the club would actually pay', () => {
    // Act 4 replays real history, so the club's price is the close from the
    // week it is in — not today's. Asserting a hardcoded outcome here would be
    // asserting a fact about one arbitrary week.
    const club = threeMemberClub();
    const price = currentPrice(club.portfolio, 'AAPL');
    const result = propose(club, 'Ada', apple, 200, 'pays-back-fast', 'cant-copy-it');
    const proposal = openProposal(result.club)!;
    expect(proposal.thesis.priceAtBuy).toBe(price);
    expect(proposal.thesis.asOf).toBe(currentDate(club.portfolio));
    expect(proposal.thesis.quantHeld).toBe(
      checkQuant('pays-back-fast', apple, price, currentDate(club.portfolio)).holds,
    );
  });
});

describe('the vote', () => {
  function withProposal() {
    const club = threeMemberClub();
    return propose(club, 'Ada', apple, 200, 'keeps-a-lot', 'cant-copy-it').club;
  }

  it('does not let the proposer vote for themselves', () => {
    const result = vote(withProposal(), 'Ada', 'up');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('your own proposal');
  });

  it('does not let a stranger vote', () => {
    expect(vote(withProposal(), 'Someone', 'up').ok).toBe(false);
  });

  it('does not let one person vote twice', () => {
    const once = vote(withProposal(), 'Kai', 'up');
    expect(vote(once.club, 'Kai', 'down').ok).toBe(false);
  });

  it('waits until everyone who can vote has voted', () => {
    const partial = vote(withProposal(), 'Kai', 'up');
    expect(partial.resolved).toBeNull();
    expect(openProposal(partial.club)).not.toBeNull();
  });

  it('buys when it passes, out of the shared pot', () => {
    let club = withProposal();
    club = vote(club, 'Kai', 'up').club;
    const done = vote(club, 'Yusuf', 'up');
    expect(done.resolved!.status).toBe('passed');
    expect(done.club.portfolio.holdings.AAPL.shares).toBeGreaterThan(0);
    expect(done.club.portfolio.cash).toBeCloseTo(3000 - 200, 2);
  });

  it('lets a tie fail, so you have to convince somebody', () => {
    let club = withProposal();
    club = vote(club, 'Kai', 'up').club;
    const done = vote(club, 'Yusuf', 'down');
    expect(done.resolved!.status).toBe('rejected');
    expect(done.resolved!.outcome).toContain('Voted down');
    expect(done.club.portfolio.holdings.AAPL).toBeUndefined();
    expect(done.club.portfolio.cash).toBe(3000);
  });

  it('moves the turn on whichever way the vote went', () => {
    let club = withProposal();
    club = vote(club, 'Kai', 'down').club;
    club = vote(club, 'Yusuf', 'down').club;
    expect(whoseTurn(club)).toBe('Kai');
  });

  it('lets a member pass without spending anything', () => {
    const club = threeMemberClub();
    const passed = pass(club, 'Ada');
    expect(passed.ok).toBe(true);
    expect(whoseTurn(passed.club)).toBe('Kai');
    expect(passed.club.portfolio.cash).toBe(3000);
  });

  it('will not let the week move on with a vote outstanding', () => {
    const result = advanceClubWeek(withProposal());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Finish voting');
  });
});

describe('who was actually any good', () => {
  /**
   * Ada proposes with a reason the numbers back; Kai proposes with one they do
   * not.
   *
   * Kai's claim is chosen at runtime from the ones that fail at the club's
   * actual price, because the price is a real historical close and which claims
   * hold depends on which week the club is replaying.
   */
  function playedOut(): ClubState {
    let club = threeMemberClub(6000);

    const netflixPrice = currentPrice(club.portfolio, 'NFLX');
    const holding = QUANT_CLAIMS.find((claim) => claim.holds(netflix, netflixPrice, currentDate(club.portfolio)))!;
    club = propose(club, 'Ada', netflix, 500, holding.id, 'pay-every-month').club;
    club = vote(club, 'Kai', 'up').club;
    club = vote(club, 'Yusuf', 'up').club;

    const applePrice = currentPrice(club.portfolio, 'AAPL');
    const failing = QUANT_CLAIMS.find(
      (claim) => !claim.holds(apple, applePrice, currentDate(club.portfolio)),
    )!;
    club = propose(club, 'Kai', apple, 500, failing.id, 'cant-copy-it').club;
    club = vote(club, 'Ada', 'up').club;
    club = vote(club, 'Yusuf', 'up').club;

    for (let week = 0; week < 6; week++) club = advanceClubWeek(club).club;
    return club;
  }

  it('separates money made from reasoning that held up', () => {
    const club = playedOut();
    const attribution = clubAttribution(club);

    const ada = attribution.members.find((m) => m.name === 'Ada')!;
    const kai = attribution.members.find((m) => m.name === 'Kai')!;

    expect(ada.soundRate).toBe(1);
    expect(kai.soundRate).toBe(0);
    expect(attribution.bestReasoning).toBe('Ada');
  });

  it('says out loud when the best returns and the best thinking are different people', () => {
    const club = playedOut();
    const attribution = clubAttribution(club);
    if (attribution.bestReturns !== attribution.bestReasoning) {
      expect(attribution.verdict).toContain('not the same thing');
    } else {
      expect(attribution.verdict).toContain('worth copying');
    }
  });

  it('counts each member\'s dollars and passes', () => {
    const attribution = clubAttribution(playedOut());
    const ada = attribution.members.find((m) => m.name === 'Ada')!;
    expect(ada.proposalsMade).toBe(1);
    expect(ada.proposalsPassed).toBe(1);
    expect(ada.dollarsCommitted).toBe(500);
  });

  it('gives the member who never proposed anything no score to attribute', () => {
    const attribution = clubAttribution(playedOut());
    const yusuf = attribution.members.find((m) => m.name === 'Yusuf')!;
    expect(yusuf.proposalsMade).toBe(0);
    expect(yusuf.soundRate).toBeNull();
  });

  it('admits there is nothing to attribute when the club never bought', () => {
    const club = threeMemberClub();
    expect(clubAttribution(club).verdict).toContain('never bought');
  });

  it('reports the club\'s own value against what went in', () => {
    const club = playedOut();
    const attribution = clubAttribution(club);
    expect(attribution.clubValue).toBeCloseTo(totalValue(club.portfolio), 2);
    expect(attribution.clubGain).toBeCloseTo(attribution.clubValue - club.startingCash, 2);
  });

  it('logs every proposal as a readable sentence, newest first', () => {
    const log = clubLog(playedOut());
    expect(log).toHaveLength(2);
    expect(log[0]).toContain('Kai');
    expect(log[0]).toContain('Passed');
    expect(log[1]).toContain('Ada');
  });
});

describe('passing the club between phones', () => {
  it('round-trips through a code', () => {
    let club = threeMemberClub();
    club = propose(club, 'Ada', nike, 200, 'pays-back-fast', 'cant-copy-it').club;
    club = vote(club, 'Kai', 'up').club;
    club = vote(club, 'Yusuf', 'up').club;

    const back = decodeClub(encodeClub(club));
    expect(back).toEqual(club);
    expect(currentPrice(back!.portfolio, 'NKE')).toBe(currentPrice(club.portfolio, 'NKE'));
  });

  it('rejects a code carrying a company that does not exist', () => {
    const club = threeMemberClub();
    const doctored = {
      ...club,
      portfolio: {
        ...club.portfolio,
        holdings: {
          FAKE: {
            ticker: 'FAKE',
            shares: 1000,
            costBasis: 1,
            worstDrawdown: 0,
            soldWhileDown: false,
            heldThroughDrawdown: false,
          },
        },
      },
    };
    const code = encodeClub(doctored as ClubState);
    expect(decodeClub(code)).toBeNull();
  });

  it('rejects a corrupted code rather than loading half a club', () => {
    const code = encodeClub(threeMemberClub());
    const broken = `${code.slice(0, code.length - 2)}${code.endsWith('A') ? 'B' : 'A'}${code.slice(code.length - 1)}`;
    expect(decodeClub(broken)).toBeNull();
  });

  it('rejects something that is not a club code at all', () => {
    expect(decodeClub('SKY-ABCD-EFGH-IJ')).toBeNull();
    expect(decodeClub('')).toBeNull();
  });
});
