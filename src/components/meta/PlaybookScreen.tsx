'use client';

import { useMemo, useState } from 'react';
import {
  DECK_SIZE,
  RULE_CARDS,
  decodePlaybook,
  encodePlaybook,
  record,
  ruleById,
  toggleRule,
  type Playbook,
  type RuleKind,
} from '@/lib/playbook';
import { ChunkyButton, clearsBar, CodeBox, CodeInput, PinnedBar, SignHeading, Sky } from '../ui';

/**
 * The deck builder.
 *
 * See `src/lib/playbook.ts` for the argument. The short version: a kid gets
 * good at Clash Royale because the strategy is an object they own and tinker
 * with, and this game had nowhere for a strategy to live.
 *
 * The result panel deliberately leads with **how often**, not **how much**. One
 * twelve-week return is a coin toss with a story attached; two hundred of them
 * is a shape. Putting the win rate in the biggest type on the screen is the
 * single most opinionated decision in this file and the most important one.
 */
const KIND_TITLE: Record<RuleKind, string> = {
  pick: 'What you will buy',
  size: 'How much in each',
  hold: 'What you do when it falls',
};

export function PlaybookScreen({
  playbook,
  onChange,
  onBack,
}: {
  playbook: Playbook;
  onChange: (next: Playbook) => void;
  onBack: () => void;
}) {
  const [tested, setTested] = useState(false);
  const [theirs, setTheirs] = useState<Playbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Two hundred-odd backtests. Cheap enough to do on every change, but only
  // done once the kid asks — the point is that testing is a deliberate act.
  const mine = useMemo(() => (tested ? record(playbook) : null), [tested, playbook]);
  const friend = useMemo(() => (theirs ? record(theirs) : null), [theirs]);

  const slots = Array.from({ length: DECK_SIZE }, (_, i) => playbook.ruleIds[i] ?? null);

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pt-5" style={clearsBar()}>
        <button
          type="button"
          onClick={onBack}
          className="-m-2 self-start p-2 font-body text-sm font-extrabold text-lemon-light"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 !text-lemon-light text-3xl">Your playbook</SignHeading>
        <p className="mt-1 font-body text-[13px] font-bold leading-snug text-white/70">
          Four rules you decide in advance. Then the game plays them out over every twelve weeks of
          real market history there is, and tells you how they did — not once, every time.
        </p>

        {/* The deck. */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {slots.map((id, index) => {
            const card = id ? ruleById(id) : null;
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!id) return;
                  onChange(toggleRule(playbook, id));
                  setTested(false);
                }}
                className={`flex h-20 flex-col items-center justify-center rounded-xl border-[3px] px-1 ${
                  card ? 'border-lemon bg-lemon/20' : 'border-dashed border-white/25 bg-white/5'
                }`}
              >
                <span aria-hidden className="text-xl">
                  {card?.emoji ?? '＋'}
                </span>
                <span className="mt-0.5 text-center font-body text-[9px] font-extrabold leading-tight text-white/85">
                  {card?.name ?? 'empty'}
                </span>
              </button>
            );
          })}
        </div>

        {mine && (
          <div className="mt-4 rounded-2xl border-[3px] border-mint/60 bg-white/10 p-4 animate-riseFade">
            <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
              Across {mine.windows} real twelve-week stretches
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-sign text-5xl leading-none text-white">
                {Math.round(mine.winRate * 100)}%
              </span>
              <span className="font-body text-xs font-extrabold text-white/70">
                of them ended ahead
              </span>
            </div>
            <p className="mt-2 font-body text-[13px] font-extrabold leading-snug text-lemon-light">
              {mine.headline}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Figure label="Typical" value={asPct(mine.medianReturn)} />
              <Figure label="Best stretch" value={asPct(mine.bestReturn)} good />
              <Figure label="Worst stretch" value={asPct(mine.worstReturn)} bad />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Figure label="Companies it allows" value={`${mine.namesEverBought}`} />
              <Figure
                label="Stretches it sat out"
                value={`${mine.satOutCount}`}
              />
            </div>

            <p className="mt-2 font-body text-[11px] font-bold leading-snug text-white/55">
              Every one of those stretches really happened. Nothing here is a simulation of a market
              — it is the market, replayed.
            </p>
          </div>
        )}

        {friend && theirs && mine && (
          <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/10 p-3">
            <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
              Their playbook
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {theirs.ruleIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full border-2 border-white/30 px-2 py-0.5 font-body text-[10px] font-extrabold text-white/80"
                >
                  {ruleById(id)?.emoji} {ruleById(id)?.name}
                </span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Figure label="You, ahead" value={`${Math.round(mine.winRate * 100)}%`} />
              <Figure label="Them, ahead" value={`${Math.round(friend.winRate * 100)}%`} />
            </div>
            <p className="mt-2 font-body text-[12px] font-bold leading-snug text-white/70">
              {verdict(mine.winRate, friend.winRate, mine.worstReturn, friend.worstReturn)}
            </p>
          </div>
        )}

        {/* The collection. */}
        {(['pick', 'size', 'hold'] as RuleKind[]).map((kind) => (
          <div key={kind} className="mt-4">
            <div className="px-1 font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-lemon-light/80">
              {KIND_TITLE[kind]}
            </div>
            <div className="mt-1 space-y-1.5">
              {RULE_CARDS.filter((card) => card.kind === kind).map((card) => {
                const inDeck = playbook.ruleIds.includes(card.id);
                const full = playbook.ruleIds.length >= DECK_SIZE && !inDeck;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={full}
                    onClick={() => {
                      onChange(toggleRule(playbook, card.id));
                      setTested(false);
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-2xl border-[3px] px-3 py-2 text-left ${
                      inDeck ? 'border-lemon bg-lemon/20' : 'border-white/20 bg-white/85'
                    } ${full ? 'opacity-40' : ''}`}
                  >
                    <span aria-hidden className="text-xl leading-none">
                      {card.emoji}
                    </span>
                    <span className="flex-1">
                      <span
                        className={`block font-body text-[13px] font-extrabold ${
                          inDeck ? 'text-lemon-light' : 'text-ink'
                        }`}
                      >
                        {card.name}
                      </span>
                      <span
                        className={`block font-body text-[11px] font-bold leading-snug ${
                          inDeck ? 'text-white/70' : 'text-ink/60'
                        }`}
                      >
                        {card.says}
                      </span>
                      <span
                        className={`mt-0.5 block font-body text-[11px] font-semibold italic leading-snug ${
                          inDeck ? 'text-white/50' : 'text-ink/45'
                        }`}
                      >
                        {card.teaches}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sharing. */}
        {playbook.ruleIds.length > 0 && (
          <div className="mt-5 space-y-2">
            <CodeBox label="Send your playbook to a friend" code={encodePlaybook(playbook)} />
            <div>
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light/70">
                Got theirs? Run it against yours
              </div>
              <div className="mt-1.5">
                <CodeInput
                  placeholder="PLAY-..."
                  action="Test theirs"
                  error={error}
                  onSubmit={(value) => {
                    const decoded = decodePlaybook(value);
                    if (!decoded) {
                      setError('That playbook code is not right. Check for a missing character.');
                      return;
                    }
                    setError(null);
                    setTheirs(decoded);
                    setTested(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <PinnedBar className="z-30 bg-gradient-to-t from-black/60 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton
            variant="mint"
            full
            disabled={playbook.ruleIds.length === 0}
            onClick={() => setTested(true)}
          >
            {playbook.ruleIds.length === 0
              ? 'Pick some rules first'
              : tested
                ? 'Test it again'
                : '🧪 Test it on real history'}
          </ChunkyButton>
        </div>
      </PinnedBar>
    </Sky>
  );
}

function asPct(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(0)}%`;
}

function Figure({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-white/20 bg-white/5 px-2 py-1.5 text-center">
      <div className="font-body text-[9px] font-extrabold uppercase tracking-wide text-white/50">
        {label}
      </div>
      <div
        className={`font-ledger text-sm font-bold tabular-nums ${
          good ? 'text-mint' : bad ? 'text-berry' : 'text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * How two playbooks compare, said honestly.
 *
 * Never "you win". A higher win rate bought with a deeper worst case is not
 * better, it is a different trade, and saying otherwise would undo the whole
 * point of showing the distribution in the first place.
 */
function verdict(mine: number, theirs: number, myWorst: number, theirWorst: number): string {
  if (Math.abs(mine - theirs) < 0.03) {
    return 'Almost the same hit rate by completely different routes. Look at the worst stretches — that is where the two of you actually differ.';
  }
  const better = mine > theirs;
  const safer = myWorst > theirWorst;
  if (better && safer) {
    return 'Yours is ahead more often and falls less far. That combination is rare — check it is not just refusing to buy anything.';
  }
  if (better) {
    return `Yours wins more often, and its worst stretch is worse (${asPct(myWorst)} against ${asPct(theirWorst)}). You are being paid for taking that.`;
  }
  if (safer) {
    return `Theirs wins more often, but yours falls less far when it goes wrong. Which of those you want is a real question, not a wrong answer.`;
  }
  return 'Theirs is ahead more often and falls less far. Worth taking one of their cards and seeing which one is doing the work.';
}
