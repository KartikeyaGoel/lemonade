'use client';

import { useState } from 'react';
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
} from '@/lib/club';
import { SNAPSHOT, findCompany, metricsFor, type Company } from '@/lib/companies';
import {
  MARKET_WEEKS,
  currentDate,
  currentPrice,
  holdingValue,
  maxSpendOn,
  totalValue,
} from '@/lib/market';
import { reasoningSound, thesisLine } from '@/lib/thesis';
import { ChunkyButton, CodeBox, CodeInput, SignHeading, Sky, money } from '../ui';
import { ThesisScreen } from './ThesisScreen';

/**
 * The investment club.
 *
 * A kid can read a P/E all day and still not know whether 34 is a lot. What
 * settles it is having to say "I think we should put $200 of *our* money into
 * this, and here is why" to a friend who is allowed to say no. That is the whole
 * mechanic, and everything on this screen exists to make that sentence happen.
 *
 * There is no server. The club's entire state travels in one long code that gets
 * passed from phone to phone, which forces it to be turn-based — and turn-based
 * turns out to be better, because you get time to actually read the thesis
 * before you vote on it.
 */
export function ClubScreen({
  club,
  me,
  startingCash,
  seed,
  onChange,
  onBack,
}: {
  club: ClubState | null;
  me: string;
  /** What the kid can put in from their own portfolio, if starting one. */
  startingCash: number;
  seed: number;
  onChange: (club: ClubState | null) => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<'main' | 'pick' | 'log' | 'scores'>('main');
  const [picked, setPicked] = useState<Company | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!club) {
    return (
      <SetupView
        me={me}
        startingCash={startingCash}
        seed={seed}
        joinError={joinError}
        onSetError={setJoinError}
        onCreated={onChange}
        onBack={onBack}
      />
    );
  }

  const proposal = openProposal(club);
  const myTurn = whoseTurn(club) === me;
  const amMember = club.members.some((member) => member.name === me);
  const iVoted = proposal ? Boolean(proposal.votes[me]) : false;
  const canVote = Boolean(proposal && amMember && proposal.by !== me && !iVoted);
  const value = totalValue(club.portfolio);
  const gain = value - club.startingCash;

  if (picked) {
    // The club is held to the same position cap a solo portfolio is, so no
    // single argument can put the whole pot into one company.
    const spendable = maxSpendOn(club.portfolio, picked.ticker);
    return (
      <ThesisScreen
        company={picked}
        price={currentPrice(club.portfolio, picked.ticker)}
        asOf={currentDate(club.portfolio)}
        maxDollars={Math.max(1, spendable)}
        actionLabel="Propose to the club"
        onCancel={() => setPicked(null)}
        onConfirm={(quantId, qualId, dollars) => {
          const result = propose(club, me, picked, dollars, quantId, qualId);
          setPicked(null);
          if (!result.ok) {
            setNotice(result.reason ?? 'That proposal could not be made.');
            return;
          }
          setNotice(`Proposed. Pass the code to ${club.members.find((m) => m.name !== me)?.name ?? 'the others'} to vote.`);
          onChange(result.club);
        }}
      />
    );
  }

  if (view === 'pick') {
    return (
      <PickView
        cash={club.portfolio.cash}
        asOf={currentDate(club.portfolio)}
        priceOf={(ticker) => currentPrice(club.portfolio, ticker)}
        onPick={(company) => {
          setPicked(company);
          setView('main');
        }}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'log') {
    return <LogView club={club} onBack={() => setView('main')} />;
  }

  if (view === 'scores') {
    return <ScoresView club={club} onBack={() => setView('main')} />;
  }

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-32 pt-6">
        <div className="flex items-baseline justify-between">
          <SignHeading className="!text-lemon-light text-3xl">{club.name}</SignHeading>
          {/* Weeks *elapsed*, not a week number. The counter starts at zero
              because no time has passed yet, and "Week 0 / 12" read like a
              bug. */}
          <span className="stat-chip !text-xs">
            {club.portfolio.week} of {MARKET_WEEKS} weeks done
          </span>
        </div>

        {/* The pot. Nobody owns "their" shares here, which is the point. */}
        <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            The pot
          </div>
          <div className="font-sign text-5xl leading-none text-white">{money(value)}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="stat-chip !text-xs">💵 {money(club.portfolio.cash)} cash</span>
            <span className={`stat-chip !text-xs ${gain >= 0 ? '' : '!text-berry'}`}>
              {gain >= 0 ? '▲' : '▼'} {money(Math.abs(gain))}
            </span>
            <span className="stat-chip !text-xs">
              {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        {notice && (
          <div className="mt-3 rounded-2xl border-[3px] border-lemon/60 bg-lemon/15 p-3 font-body text-[12px] font-bold text-white">
            {notice}
          </div>
        )}

        {/* Members and whose turn it is */}
        <div className="mt-4 flex flex-wrap gap-2">
          {club.members.map((member) => (
            <span
              key={member.name}
              className={`rounded-full border-[3px] px-3 py-1 font-body text-[12px] font-extrabold ${
                whoseTurn(club) === member.name
                  ? 'border-lemon bg-lemon text-ink'
                  : 'border-white/25 bg-white/10 text-white/70'
              }`}
            >
              {member.name}
              {member.name === me ? ' (you)' : ''}
            </span>
          ))}
        </div>

        {/* The open proposal */}
        {proposal ? (
          <div className="mt-4 rounded-2xl border-[3px] border-lemon/60 bg-white p-4">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              {proposal.by} wants to buy
            </div>
            <div className="mt-0.5 font-sign text-2xl text-ink">
              {money(proposal.dollars)} of {proposal.ticker}
            </div>
            <div className="mt-2 font-body text-[13px] font-bold leading-snug text-ink/75">
              &ldquo;{thesisLine(proposal.thesis)}&rdquo;
            </div>
            <div
              className={`mt-2 rounded-xl border-2 px-2.5 py-1.5 font-body text-[12px] font-bold ${
                reasoningSound(proposal.thesis)
                  ? 'border-mint/60 bg-mint/20 text-ink/80'
                  : 'border-berry/50 bg-berry/10 text-ink/80'
              }`}
            >
              {reasoningSound(proposal.thesis)
                ? '✓ The numbers back that reason up.'
                : proposal.thesis.contradiction
                  ? '✕ That story reason is an argument against buying.'
                  : '✕ The numbers do not back that reason up.'}
            </div>

            <div className="mt-2 font-body text-[11px] font-bold text-ink/50">
              Votes in: {Object.keys(proposal.votes).length} of {club.members.length - 1}. A tie
              fails.
            </div>

            {canVote ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ChunkyButton
                  variant="mint"
                  onClick={() => {
                    const result = vote(club, me, 'up');
                    if (result.ok) {
                      onChange(result.club);
                      setNotice(result.resolved?.outcome ?? 'Voted. Pass the code on.');
                    } else setNotice(result.reason ?? null);
                  }}
                >
                  Yes, buy it
                </ChunkyButton>
                <ChunkyButton
                  variant="wood"
                  onClick={() => {
                    const result = vote(club, me, 'down');
                    if (result.ok) {
                      onChange(result.club);
                      setNotice(result.resolved?.outcome ?? 'Voted. Pass the code on.');
                    } else setNotice(result.reason ?? null);
                  }}
                >
                  No, not at that price
                </ChunkyButton>
              </div>
            ) : (
              <div className="mt-3 font-body text-[12px] font-extrabold text-ink/60">
                {proposal.by === me
                  ? 'Your proposal. Pass the code on so they can vote.'
                  : 'You have voted. Pass the code on.'}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border-[3px] border-white/20 bg-white/5 p-4">
            <div className="font-body text-[13px] font-extrabold text-white">
              {myTurn ? 'Your turn.' : `Waiting on ${whoseTurn(club)}.`}
            </div>
            <div className="mt-0.5 font-body text-[12px] font-bold text-white/60">
              {myTurn
                ? 'Propose one buy, with a reason the others can argue with. Or pass.'
                : 'Pass the code to them and they can take their turn.'}
            </div>
            {myTurn && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ChunkyButton variant="lemon" onClick={() => setView('pick')}>
                  Propose a buy
                </ChunkyButton>
                <ChunkyButton
                  variant="ghost"
                  onClick={() => {
                    const result = pass(club, me);
                    if (result.ok) {
                      onChange(result.club);
                      setNotice('Passed. Not buying is a real decision.');
                    } else setNotice(result.reason ?? null);
                  }}
                >
                  Pass this turn
                </ChunkyButton>
              </div>
            )}
          </div>
        )}

        {/* What the club owns */}
        {Object.keys(club.portfolio.holdings).length > 0 && (
          <div className="mt-5">
            <div className="px-1 font-sign text-xl text-lemon-light">What we own</div>
            <div className="mt-2 space-y-2">
              {Object.keys(club.portfolio.holdings).map((ticker) => {
                const company = findCompany(ticker)!;
                const held = holdingValue(club.portfolio, ticker);
                const basis = club.portfolio.holdings[ticker].costBasis;
                const change = basis > 0 ? (held - basis) / basis : 0;
                return (
                  <div
                    key={ticker}
                    className="flex items-center gap-3 rounded-2xl border-[3px] border-white/20 bg-white/10 p-3"
                  >
                    <span aria-hidden className="text-2xl">
                      {company.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="font-body text-[13px] font-extrabold text-white">
                        {company.name}
                      </div>
                      <div className="font-body text-[11px] font-bold text-white/55">
                        {money(currentPrice(club.portfolio, ticker))} a share ·{' '}
                        {metricsFor(company, currentPrice(club.portfolio, ticker), currentDate(club.portfolio)).pe
                          ? `P/E ${metricsFor(company, currentPrice(club.portfolio, ticker), currentDate(club.portfolio)).pe!.toFixed(0)}`
                          : 'no P/E'}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-ledger text-sm font-bold tabular-nums text-white">
                        {money(held)}
                      </div>
                      <div
                        className={`font-body text-[11px] font-extrabold ${
                          change >= 0 ? 'text-mint' : 'text-berry'
                        }`}
                      >
                        {change >= 0 ? '+' : ''}
                        {Math.round(change * 100)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <ChunkyButton variant="ghost" onClick={() => setView('log')}>
            The log
          </ChunkyButton>
          <ChunkyButton variant="ghost" onClick={() => setView('scores')}>
            How are we doing
          </ChunkyButton>
        </div>

        {!proposal && (
          <div className="mt-3">
            <ChunkyButton
              variant="wood"
              full
              disabled={club.portfolio.week >= MARKET_WEEKS}
              onClick={() => {
                const result = advanceClubWeek(club);
                if (result.ok) {
                  onChange(result.club);
                  setNotice(
                    result.report
                      ? `Week ${result.report.week} done. The pot moved ${result.report.changePct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(result.report.changePct * 100))}%.`
                      : null,
                  );
                } else setNotice(result.reason ?? null);
              }}
            >
              {club.portfolio.week >= MARKET_WEEKS ? 'The twelve weeks are up' : 'Move the week on →'}
            </ChunkyButton>
          </div>
        )}

        <div className="mt-5">
          <CodeBox label="Pass this to the next person" code={encodeClub(club)} small />
        </div>

        <div className="mt-3">
          <CodeInput
            placeholder="Paste their updated club code"
            action="Catch up"
            error={joinError}
            onSubmit={(value) => {
              const next = decodeClub(value);
              if (!next) {
                setJoinError('That club code is not right.');
                return;
              }
              setJoinError(null);
              setNotice('Caught up.');
              onChange(next);
            }}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t-[3px] border-white/15 bg-[#16203A] px-4 pb-5 pt-6">
        <ChunkyButton variant="lemon" full onClick={onBack}>
          Back →
        </ChunkyButton>
      </div>
    </Sky>
  );
}

/* ------------------------------------------------------------------ *
 * Setting one up
 * ------------------------------------------------------------------ */

function SetupView({
  me,
  startingCash,
  seed,
  joinError,
  onSetError,
  onCreated,
  onBack,
}: {
  me: string;
  startingCash: number;
  seed: number;
  joinError: string | null;
  onSetError: (error: string | null) => void;
  onCreated: (club: ClubState) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('The Lunch Table');
  const [stake, setStake] = useState(() => Math.floor(Math.max(0, startingCash) / 2));

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            🧑‍🤝‍🧑
          </div>
          <SignHeading className="mt-2 !text-lemon-light text-4xl">Investment club</SignHeading>
          <p className="mt-2 font-body text-sm font-bold leading-snug text-white/70">
            Put money in one pot with up to {MAX_MEMBERS - 1} friends. You take turns. Nobody
            gets to buy anything without giving a reason the others can vote down.
          </p>
        </div>

        <div className="mt-7 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            Start one
          </div>
          <input
            aria-label="Club name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 24))}
            className="mt-2 w-full rounded-xl border-[3px] border-ink/15 bg-white px-3 py-2 font-sign text-xl text-ink"
          />
          <div className="mt-3 font-body text-[11px] font-extrabold uppercase tracking-wide text-white/55">
            Your stake
          </div>
          <div className="font-sign text-3xl text-white">{money(stake)}</div>
          <input
            aria-label="Your stake"
            className="slider mt-2"
            type="range"
            min={0}
            max={Math.max(1, Math.floor(startingCash))}
            step={1}
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            style={{ ['--fill' as string]: `${(stake / Math.max(1, startingCash)) * 100}%` }}
          />
          <ChunkyButton
            variant="lemon"
            full
            className="mt-3"
            onClick={() => onCreated(createClub(name, me, stake, seed))}
          >
            Start the club →
          </ChunkyButton>
        </div>

        <div className="mt-5">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            Or join one
          </div>
          <div className="mt-2">
            <CodeInput
              placeholder="Paste the club code your friend sent"
              action="Join the club"
              error={joinError}
              onSubmit={(value) => {
                const club = decodeClub(value);
                if (!club) {
                  onSetError('That club code is not right.');
                  return;
                }
                const joined = joinClub(club, me, stake);
                if (!joined.ok) {
                  onSetError(joined.reason ?? 'Could not join.');
                  return;
                }
                onSetError(null);
                onCreated(joined.club);
              }}
            />
          </div>
        </div>

        <div className="mt-auto pt-6">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

/* ------------------------------------------------------------------ *
 * Picking something to propose
 * ------------------------------------------------------------------ */

function PickView({
  cash,
  asOf,
  priceOf,
  onPick,
  onBack,
}: {
  cash: number;
  /** The real week the club is replaying. */
  asOf: string;
  /** Real historical price for this week of the club's run. */
  priceOf: (ticker: string) => number;
  onPick: (company: Company) => void;
  onBack: () => void;
}) {
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-24 pt-6">
        <SignHeading className="!text-lemon-light text-3xl">What should we buy?</SignHeading>
        <p className="mt-1 font-body text-[12px] font-bold text-white/60">
          {money(cash)} in the pot. You will have to say why.
        </p>
        <div className="mt-4 space-y-2">
          {SNAPSHOT.map((company) => {
            const price = priceOf(company.ticker);
            const m = metricsFor(company, price, asOf);
            return (
              <button
                key={company.ticker}
                type="button"
                onClick={() => onPick(company)}
                className="flex w-full items-center gap-3 rounded-2xl border-[3px] border-white/20 bg-white/10 p-3 text-left"
              >
                <span aria-hidden className="text-2xl">
                  {company.emoji}
                </span>
                <div className="min-w-0">
                  <div className="font-body text-[13px] font-extrabold text-white">
                    {company.name}
                  </div>
                  <div className="font-body text-[11px] font-bold text-white/55">
                    {m.pe ? `P/E ${m.pe.toFixed(0)}` : 'loses money'} ·{' '}
                    {Math.round(m.netMargin * 100)}c of every dollar
                  </div>
                </div>
                <span className="ml-auto font-ledger text-sm font-bold tabular-nums text-white/70">
                  {money(price)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-5 pt-4">
        <ChunkyButton variant="ghost" full onClick={onBack}>
          Back
        </ChunkyButton>
      </div>
    </Sky>
  );
}

/* ------------------------------------------------------------------ *
 * The log and the scores
 * ------------------------------------------------------------------ */

function LogView({ club, onBack }: { club: ClubState; onBack: () => void }) {
  const log = clubLog(club);
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-24 pt-6">
        <SignHeading className="!text-lemon-light text-3xl">The log</SignHeading>
        <p className="mt-1 font-body text-[12px] font-bold text-white/60">
          Every reason anybody gave, and what the club decided.
        </p>
        <div className="mt-4 space-y-2">
          {log.length === 0 && (
            <div className="font-body text-sm font-bold text-white/60">Nothing yet.</div>
          )}
          {log.map((line, index) => (
            <div
              key={index}
              className="rounded-2xl border-[3px] border-white/20 bg-white/10 p-3 font-body text-[12px] font-bold leading-snug text-white/85"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-5 pt-4">
        <ChunkyButton variant="ghost" full onClick={onBack}>
          Back
        </ChunkyButton>
      </div>
    </Sky>
  );
}

/**
 * Two leaderboards, on purpose.
 *
 * Money made and reasoning that held up are different things, and the gap
 * between them is the entire lesson of the club. A single ranked-by-returns
 * board would be a machine for teaching kids to gamble.
 */
function ScoresView({ club, onBack }: { club: ClubState; onBack: () => void }) {
  const attribution = clubAttribution(club);
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-24 pt-6">
        <SignHeading className="!text-lemon-light text-3xl">How are we doing</SignHeading>

        <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            The pot
          </div>
          <div className="font-sign text-4xl leading-none text-white">
            {money(attribution.clubValue)}
          </div>
          <div
            className={`font-body text-[12px] font-extrabold ${
              attribution.clubGain >= 0 ? 'text-mint' : 'text-berry'
            }`}
          >
            {attribution.clubGain >= 0 ? '+' : ''}
            {money(attribution.clubGain)} since we started
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {attribution.members.map((member) => (
            <div
              key={member.name}
              className="rounded-2xl border-[3px] border-white/20 bg-white/10 p-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-sign text-xl text-white">{member.name}</span>
                <span
                  className={`font-ledger text-sm font-bold tabular-nums ${
                    member.gain >= 0 ? 'text-mint' : 'text-berry'
                  }`}
                >
                  {member.gain >= 0 ? '+' : ''}
                  {money(member.gain)}
                </span>
              </div>
              <div className="mt-0.5 font-body text-[11px] font-bold text-white/60">
                {member.proposalsMade === 0
                  ? 'Has not proposed anything yet.'
                  : `${member.proposalsPassed} of ${member.proposalsMade} carried · ${money(member.dollarsCommitted)} committed · reasons held up ${member.soundCount} of ${member.proposalsMade} times`}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border-[3px] border-lemon/60 bg-lemon/15 p-4 font-body text-[13px] font-bold leading-snug text-white">
          {attribution.verdict}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-5 pt-4">
        <ChunkyButton variant="ghost" full onClick={onBack}>
          Back
        </ChunkyButton>
      </div>
    </Sky>
  );
}
