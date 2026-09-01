/**
 * The investment club.
 *
 * This is the highest-value mechanic in the product, and it is worth being
 * clear about why. A kid can read a P/E all day and still not know whether 34
 * is a lot. What settles it is having to say "I think we should put $200 of our
 * money into this, and here is why" to a friend who is allowed to say no.
 * Defending a number to somebody with a vote is how people actually learn to
 * value things, and it is the part a video cannot do.
 *
 * How it works with no server: the club's whole state — the pooled cash, the
 * holdings, the open proposal, the log — fits in one long code that is passed
 * from phone to phone. It is turn-based because it has to be, and turn-based
 * turns out to be better: you get time to read the thesis before you vote.
 *
 * The rules that carry the teaching:
 *
 *  - You cannot propose a buy without a written thesis. Not "cannot easily" —
 *    the function refuses.
 *  - A tie fails. If you cannot convince anyone, you do not get to spend
 *    everybody's money.
 *  - At the end, money made and reasoning that held up are reported as two
 *    separate leaderboards, because they are two separate things and the
 *    difference is the entire lesson.
 *
 * Pure module. No React, no I/O, no network.
 */

import { round2 } from './simulation';
import {
  advanceWeek,
  buy,
  createPortfolio,
  currentDate,
  currentPrice,
  maxSpendOn,
  totalValue,
  type PortfolioState,
  type WeekReport,
} from './market';
import { findCompany, type Company } from './companies';
import { buildThesis, reasoningSound, thesisLine, type Thesis } from './thesis';
import { decodeLong, encodeLong } from './sharecode';

export const CLUB_PREFIX = 'CLUB';
export const MAX_MEMBERS = 4;
/** A club needs somebody to argue with, or the vote is theatre. */
export const MIN_MEMBERS_TO_PROPOSE = 2;

export interface ClubMember {
  name: string;
  joinedWeek: number;
}

export type ProposalStatus = 'open' | 'passed' | 'rejected';

export interface Proposal {
  id: number;
  by: string;
  ticker: string;
  dollars: number;
  thesis: Thesis;
  week: number;
  votes: Record<string, 'up' | 'down'>;
  status: ProposalStatus;
  /** Filled in when it resolves, so the log reads as a story. */
  outcome?: string;
}

export interface ClubState {
  version: number;
  name: string;
  seed: number;
  members: ClubMember[];
  /** Index into `members` of whoever may propose next. */
  turn: number;
  portfolio: PortfolioState;
  proposals: Proposal[];
  startingCash: number;
  nextProposalId: number;
}

export function createClub(
  name: string,
  founder: string,
  startingCash: number,
  seed: number,
): ClubState {
  return {
    version: 1,
    name: name.slice(0, 24) || 'The club',
    seed: seed >>> 0,
    members: [{ name: tidyMember(founder), joinedWeek: 1 }],
    turn: 0,
    portfolio: createPortfolio(round2(startingCash), seed),
    proposals: [],
    startingCash: round2(startingCash),
    nextProposalId: 1,
  };
}

export function tidyMember(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.slice(0, 12) || 'Member';
}

export interface ClubResult {
  ok: boolean;
  reason?: string;
  club: ClubState;
}

/**
 * Joining pools money. The newcomer's stake goes into the same pot, which is
 * the point — from here on nobody has "their" shares, only a share of ours.
 */
export function joinClub(club: ClubState, name: string, stake = 0): ClubResult {
  const member = tidyMember(name);
  if (club.members.length >= MAX_MEMBERS) {
    return { ok: false, reason: `A club holds ${MAX_MEMBERS} people.`, club };
  }
  if (club.members.some((m) => m.name.toLowerCase() === member.toLowerCase())) {
    return { ok: false, reason: `${member} is already in this club.`, club };
  }

  const added = Math.max(0, round2(stake));
  return {
    ok: true,
    club: {
      ...club,
      members: [...club.members, { name: member, joinedWeek: club.portfolio.week }],
      startingCash: round2(club.startingCash + added),
      portfolio: { ...club.portfolio, cash: round2(club.portfolio.cash + added) },
    },
  };
}

export function whoseTurn(club: ClubState): string {
  return club.members[club.turn % club.members.length]?.name ?? '';
}

export function openProposal(club: ClubState): Proposal | null {
  return club.proposals.find((p) => p.status === 'open') ?? null;
}

/* ------------------------------------------------------------------ *
 * Proposing
 * ------------------------------------------------------------------ */

export function propose(
  club: ClubState,
  by: string,
  company: Company,
  dollars: number,
  quantId: string,
  qualId: string,
): ClubResult {
  const member = tidyMember(by);

  if (club.members.length < MIN_MEMBERS_TO_PROPOSE) {
    return {
      ok: false,
      reason: 'A club needs at least two people. Somebody has to be able to say no.',
      club,
    };
  }
  if (whoseTurn(club) !== member) {
    return { ok: false, reason: `It is ${whoseTurn(club)}'s turn.`, club };
  }
  if (openProposal(club)) {
    return { ok: false, reason: 'There is already a proposal waiting on votes.', club };
  }
  if (!quantId || !qualId) {
    return {
      ok: false,
      reason: 'A proposal needs both halves of a reason: a number and a story.',
      club,
    };
  }

  const amount = round2(dollars);
  if (amount <= 0) {
    return { ok: false, reason: 'Propose an amount above zero.', club };
  }
  const ceiling = maxSpendOn(club.portfolio, company.ticker);
  if (amount > ceiling + 0.01) {
    return {
      ok: false,
      reason:
        ceiling <= 0
          ? `The club already holds as much ${company.ticker} as the rules allow.`
          : `The most the club can put into ${company.ticker} right now is $${ceiling.toFixed(2)}.`,
      club,
    };
  }

  const thesis = buildThesis({
    company,
    quantId,
    qualId,
    week: club.portfolio.week,
    priceAtBuy: currentPrice(club.portfolio, company.ticker),
    asOf: currentDate(club.portfolio),
    dollars: amount,
    by: member,
  });

  const proposal: Proposal = {
    id: club.nextProposalId,
    by: member,
    ticker: company.ticker,
    dollars: amount,
    thesis,
    week: club.portfolio.week,
    votes: {},
    status: 'open',
  };

  return {
    ok: true,
    club: {
      ...club,
      proposals: [...club.proposals, proposal],
      nextProposalId: club.nextProposalId + 1,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Voting
 * ------------------------------------------------------------------ */

export interface VoteResult extends ClubResult {
  /** Set once the proposal has resolved. */
  resolved: Proposal | null;
}

export function vote(
  club: ClubState,
  voter: string,
  direction: 'up' | 'down',
): VoteResult {
  const member = tidyMember(voter);
  const proposal = openProposal(club);

  if (!proposal) return { ok: false, reason: 'Nothing is up for a vote.', club, resolved: null };
  if (!club.members.some((m) => m.name === member)) {
    return { ok: false, reason: `${member} is not in this club.`, club, resolved: null };
  }
  if (proposal.by === member) {
    return { ok: false, reason: 'You cannot vote on your own proposal.', club, resolved: null };
  }
  if (proposal.votes[member]) {
    return { ok: false, reason: `${member} has already voted.`, club, resolved: null };
  }

  const votes = { ...proposal.votes, [member]: direction };
  const others = club.members.filter((m) => m.name !== proposal.by);
  const everybodyVoted = others.every((m) => votes[m.name]);

  if (!everybodyVoted) {
    const updated = { ...proposal, votes };
    return { ok: true, club: replaceProposal(club, updated), resolved: null };
  }

  return resolve(club, { ...proposal, votes });
}

/**
 * A tie fails.
 *
 * If you cannot talk one other person round, you do not get to spend
 * everybody's money — which is a rule about persuasion, and persuasion is where
 * the reasoning gets tested.
 */
function resolve(club: ClubState, proposal: Proposal): VoteResult {
  const tally = Object.values(proposal.votes);
  const up = tally.filter((v) => v === 'up').length;
  const down = tally.length - up;

  if (up <= down) {
    const rejected: Proposal = {
      ...proposal,
      status: 'rejected',
      outcome: `Voted down ${down}–${up}. The money stayed in the pot.`,
    };
    return {
      ok: true,
      club: advanceTurn(replaceProposal(club, rejected)),
      resolved: rejected,
    };
  }

  const trade = buy(club.portfolio, proposal.ticker, proposal.dollars);
  if (!trade.ok) {
    const failed: Proposal = {
      ...proposal,
      status: 'rejected',
      outcome: `Passed ${up}–${down}, but the trade would not go through: ${trade.reason ?? 'no reason given'}`,
    };
    return {
      ok: true,
      club: advanceTurn(replaceProposal(club, failed)),
      resolved: failed,
    };
  }

  const passed: Proposal = {
    ...proposal,
    status: 'passed',
    outcome: `Passed ${up}–${down}. The club put $${proposal.dollars.toFixed(2)} into ${proposal.ticker}.`,
  };

  return {
    ok: true,
    club: advanceTurn({ ...replaceProposal(club, passed), portfolio: trade.portfolio }),
    resolved: passed,
  };
}

function replaceProposal(club: ClubState, proposal: Proposal): ClubState {
  return {
    ...club,
    proposals: club.proposals.map((p) => (p.id === proposal.id ? proposal : p)),
  };
}

function advanceTurn(club: ClubState): ClubState {
  return { ...club, turn: (club.turn + 1) % Math.max(1, club.members.length) };
}

/** Skipping is allowed and costs nothing. Not buying is a real decision. */
export function pass(club: ClubState, by: string): ClubResult {
  const member = tidyMember(by);
  if (whoseTurn(club) !== member) {
    return { ok: false, reason: `It is ${whoseTurn(club)}'s turn.`, club };
  }
  if (openProposal(club)) {
    return { ok: false, reason: 'Settle the open proposal first.', club };
  }
  return { ok: true, club: advanceTurn(club) };
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

export interface ClubWeekResult extends ClubResult {
  report: WeekReport | null;
}

export function advanceClubWeek(club: ClubState): ClubWeekResult {
  if (openProposal(club)) {
    return {
      ok: false,
      reason: 'Finish voting before the week moves on.',
      club,
      report: null,
    };
  }
  const { portfolio, report } = advanceWeek(club.portfolio);
  return { ok: true, club: { ...club, portfolio }, report };
}

/* ------------------------------------------------------------------ *
 * Who was actually any good
 * ------------------------------------------------------------------ */

export interface MemberScore {
  name: string;
  proposalsMade: number;
  proposalsPassed: number;
  dollarsCommitted: number;
  /** Money the club made on the buys this member talked through. */
  gain: number;
  /** How many of their theses held up against the numbers. */
  soundCount: number;
  soundRate: number | null;
}

export interface ClubAttribution {
  members: MemberScore[];
  clubValue: number;
  clubGain: number;
  /** Whose picks made the most money. */
  bestReturns: string | null;
  /** Whose reasoning held up most often. These are often different people. */
  bestReasoning: string | null;
  /** The sentence that separates the two, which is the point of the screen. */
  verdict: string;
}

export function clubAttribution(club: ClubState): ClubAttribution {
  const passedProposals = club.proposals.filter((p) => p.status === 'passed');

  const members: MemberScore[] = club.members.map((member) => {
    const mine = club.proposals.filter((p) => p.by === member.name);
    const won = mine.filter((p) => p.status === 'passed');

    const dollarsCommitted = round2(won.reduce((sum, p) => sum + p.dollars, 0));
    const gain = round2(
      won.reduce((sum, p) => {
        const now = currentPrice(club.portfolio, p.ticker);
        const growth = p.thesis.priceAtBuy > 0 ? now / p.thesis.priceAtBuy - 1 : 0;
        return sum + p.dollars * growth;
      }, 0),
    );
    const soundCount = mine.filter((p) => reasoningSound(p.thesis)).length;

    return {
      name: member.name,
      proposalsMade: mine.length,
      proposalsPassed: won.length,
      dollarsCommitted,
      gain,
      soundCount,
      soundRate: mine.length > 0 ? soundCount / mine.length : null,
    };
  });

  const withProposals = members.filter((m) => m.proposalsMade > 0);
  const bestReturns =
    withProposals.length > 0
      ? [...withProposals].sort((a, b) => b.gain - a.gain)[0].name
      : null;
  const bestReasoning =
    withProposals.length > 0
      ? [...withProposals].sort(
          (a, b) => (b.soundRate ?? 0) - (a.soundRate ?? 0) || b.proposalsMade - a.proposalsMade,
        )[0].name
      : null;

  const clubValue = totalValue(club.portfolio);
  const clubGain = round2(clubValue - club.startingCash);

  let verdict: string;
  if (passedProposals.length === 0) {
    verdict = 'The club never bought anything, so there is nothing to attribute yet.';
  } else if (bestReturns && bestReasoning && bestReturns !== bestReasoning) {
    verdict = `${bestReturns} made the club the most money. ${bestReasoning}'s reasons held up most often. Those are not the same thing, and over a longer run it is ${bestReasoning}'s record that repeats.`;
  } else if (bestReturns) {
    verdict = `${bestReturns} both made the most money and had the soundest reasons. That is the combination worth copying.`;
  } else {
    verdict = 'Nobody put a proposal forward.';
  }

  return { members, clubValue, clubGain, bestReturns, bestReasoning, verdict };
}

/** The club log, newest first, in sentences. */
export function clubLog(club: ClubState): string[] {
  return [...club.proposals]
    .reverse()
    .map((p) => `Week ${p.week} — ${p.by}: ${thesisLine(p.thesis)} ${p.outcome ?? 'Waiting on votes.'}`);
}

/* ------------------------------------------------------------------ *
 * Passing it along
 * ------------------------------------------------------------------ */

export function encodeClub(club: ClubState): string {
  return encodeLong(CLUB_PREFIX, club);
}

export function decodeClub(code: string): ClubState | null {
  const club = decodeLong<ClubState>(CLUB_PREFIX, code);
  if (!club || club.version !== 1) return null;
  if (!Array.isArray(club.members) || club.members.length === 0) return null;
  if (!club.portfolio || typeof club.portfolio.week !== 'number') return null;

  // Every ticker in a code has to be one we actually know about, or a doctored
  // code could put a company that does not exist into somebody's portfolio.
  const tickers = Object.keys(club.portfolio.holdings ?? {});
  if (tickers.some((ticker) => !findCompany(ticker))) return null;

  return {
    ...club,
    proposals: Array.isArray(club.proposals) ? club.proposals : [],
    nextProposalId: club.nextProposalId ?? (club.proposals?.length ?? 0) + 1,
  };
}
