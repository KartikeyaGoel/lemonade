'use client';

import { useState } from 'react';
import { trophyCase, type Badge, type BadgeTier } from '@/lib/achievements';
import { GLOSSARY, wordProgress } from '@/lib/glossary';
import { careerCard, type Career } from '@/lib/career';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

const TIER_STYLE: Record<BadgeTier, string> = {
  bronze: 'border-[#C08552] bg-[#F6E2CE]',
  silver: 'border-[#9AA7B4] bg-[#E9EEF3]',
  gold: 'border-[#D9A521] bg-[#FBEFC6]',
  legend: 'border-[#8A5BD6] bg-[#EBE0FB]',
};

const ACT_LABEL: Record<string, string> = {
  '1': 'One stand',
  '2': 'Scale',
  '3': 'Ownership',
  '4': 'Markets',
  social: 'With friends',
};

/**
 * The trophy case, the glossary, and the career record.
 *
 * A locked badge is shown, not hidden. The gap is the point — a case that fills
 * up by itself is worth nothing to look at, and the locked cards are where the
 * kid finds out that "hold your price while somebody undercuts you" is a thing
 * you can go and do on purpose.
 */
export function TrophyScreen({
  career,
  learned,
  badges,
  onBack,
}: {
  career: Career;
  learned: string[];
  badges: string[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'badges' | 'words' | 'career'>('badges');
  const card = careerCard({ ...career, badges });
  const held = new Set([...career.words, ...learned]);
  const words = wordProgress([...held]);

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-28 pt-6">
        {/* The card. Rank comes from badges, never from time played. */}
        <div className="rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
          <div className="flex items-center gap-3">
            <div aria-hidden className="text-4xl">
              {card.avatar}
            </div>
            <div className="min-w-0">
              <div className="truncate font-sign text-2xl text-white">{card.name}</div>
              <div className="font-body text-xs font-extrabold text-lemon-light">
                {card.rank.emoji} {card.rank.name}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-ledger text-2xl font-bold tabular-nums text-white">
                {card.badges.held}
                <span className="text-white/40">/{card.badges.total}</span>
              </div>
              <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-white/50">
                badges
              </div>
            </div>
          </div>
          <div className="mt-2 font-body text-[12px] font-bold text-white/70">{card.line}</div>
        </div>

        <div className="mt-4 flex gap-2">
          {(['badges', 'words', 'career'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={`flex-1 rounded-xl border-[3px] py-2 font-body text-xs font-extrabold uppercase tracking-wide ${
                tab === option
                  ? 'border-lemon bg-lemon text-ink'
                  : 'border-white/25 bg-white/10 text-white/70'
              }`}
            >
              {option === 'words' ? `Words ${words.earned}/${words.total}` : option}
            </button>
          ))}
        </div>

        {tab === 'badges' && (
          <div className="mt-4 space-y-5">
            {trophyCase(badges).map((group) => (
              <div key={String(group.act)}>
                <div className="px-1 font-sign text-lg text-lemon-light">
                  {ACT_LABEL[String(group.act)]}
                  <span className="ml-2 font-body text-[11px] font-extrabold text-white/45">
                    {group.badges.filter((b) => b.held).length}/{group.badges.length}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {group.badges.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} held={badge.held} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'words' && (
          <div className="mt-4 space-y-2">
            <p className="px-1 font-body text-[12px] font-bold text-white/60">
              Every word here you earned by doing the thing it describes. That is why you can
              use them in a sentence.
            </p>
            {GLOSSARY.map((word) => {
              const has = held.has(word.id);
              return (
                <div
                  key={word.id}
                  className={`rounded-2xl border-[3px] p-3 ${
                    has ? 'border-lemon/60 bg-white' : 'border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`font-sign text-xl ${has ? 'text-ink' : 'text-white/35'}`}
                    >
                      {has ? word.word : '???'}
                    </span>
                    <span
                      className={`font-body text-[10px] font-extrabold uppercase tracking-wide ${
                        has ? 'text-ink/40' : 'text-white/30'
                      }`}
                    >
                      Act {word.act}
                    </span>
                  </div>
                  {has ? (
                    <>
                      <div className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/75">
                        {word.kidLine}
                      </div>
                      <div className="mt-1.5 border-t-2 border-dashed border-ink/10 pt-1.5 font-body text-[12px] font-bold leading-snug text-ink/55">
                        {word.grownUpLine}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 font-body text-[12px] font-bold text-white/40">
                      Not earned yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'career' && (
          <div className="mt-4 space-y-2">
            <Stat label="Seasons played" value={String(career.seasons)} />
            <Stat label="Days of business" value={String(career.lifetimeDays)} />
            <Stat label="Profit, all time" value={money(career.lifetimeProfit)} />
            <Stat label="Best week" value={money(career.bestWeekProfit)} />
            <Stat
              label="Best price for the stand"
              value={
                career.bestBuyoutMultiple > 0
                  ? `${career.bestBuyoutMultiple}x weekly profit`
                  : 'not sold yet'
              }
            />
            <Stat
              label="Challenges"
              value={
                career.challengesPlayed > 0
                  ? `${career.challengesWon} won of ${career.challengesPlayed}`
                  : 'none yet'
              }
            />
            <Stat
              label="Club"
              value={
                career.clubWeeks > 0
                  ? `${career.clubWeeks} weeks, ${career.clubProposalsPassed} proposals carried`
                  : 'not in one yet'
              }
            />
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t-[3px] border-white/15 bg-[#16203A] px-4 pb-5 pt-6">
        <ChunkyButton variant="lemon" full onClick={onBack}>
          Back →
        </ChunkyButton>
      </div>
    </Sky>
  );
}

function BadgeCard({ badge, held }: { badge: Badge; held: boolean }) {
  return (
    <div
      className={`rounded-2xl border-[3px] p-2.5 ${
        held ? TIER_STYLE[badge.tier] : 'border-white/15 bg-white/5'
      }`}
    >
      <div aria-hidden className={`text-2xl ${held ? '' : 'opacity-25 grayscale'}`}>
        {held ? badge.emoji : '🔒'}
      </div>
      <div
        className={`mt-1 font-body text-[12px] font-extrabold leading-tight ${
          held ? 'text-ink' : 'text-white/60'
        }`}
      >
        {badge.name}
      </div>
      <div
        className={`mt-0.5 font-body text-[11px] font-bold leading-tight ${
          held ? 'text-ink/60' : 'text-white/40'
        }`}
      >
        {held ? badge.proves : badge.how}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-2xl border-[3px] border-white/20 bg-white/10 px-3.5 py-2.5">
      <span className="font-body text-[12px] font-extrabold text-white/70">{label}</span>
      <span className="font-ledger text-sm font-bold tabular-nums text-white">{value}</span>
    </div>
  );
}
