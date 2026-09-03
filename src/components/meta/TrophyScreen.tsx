'use client';

import { useState } from 'react';
import { trophyCase, type Badge, type BadgeTier } from '@/lib/achievements';
import { GLOSSARY, wordProgress } from '@/lib/glossary';
import { careerCard, standing, type Career } from '@/lib/career';
import type { Game } from '@/lib/progress';
import { collectionLine, progress, shelves } from '@/lib/collection';
import { mastery, masteryLine, reachable, type Level } from '@/lib/mastery';
import { ChunkyButton, clearsBar, money, PinnedBar, plural, Sky } from '../ui';

const TIER_STYLE: Record<BadgeTier, string> = {
  bronze: 'border-[#C08552] bg-[#F6E2CE]',
  silver: 'border-[#9AA7B4] bg-[#E9EEF3]',
  gold: 'border-[#D9A521] bg-[#FBEFC6]',
  legend: 'border-[#8A5BD6] bg-[#EBE0FB]',
};

type Tab = 'can do' | 'badges' | 'words' | 'read' | 'record';

const TABS: Tab[] = ['can do', 'badges', 'words', 'read', 'record'];

const SKILL_STYLE: Record<Level, string> = {
  held: 'border-mint/70 bg-white',
  emerging: 'border-lemon/60 bg-white/90',
  unseen: 'border-dashed border-white/25 bg-white/5',
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
  game,
  career,
  learned,
  badges,
  onBack,
}: {
  /** Read only for the evidence layer, which is derived from play. */
  game: Game;
  career: Career;
  learned: string[];
  badges: string[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>('can do');
  const card = careerCard({ ...career, badges });
  const held = new Set([...career.words, ...learned]);
  const words = wordProgress([...held]);
  /*
   * Standing, not badges.
   *
   * The shelves in the market open on standing, and this screen was gating the
   * same shelves on the raw badge count — so the trophy case showed a padlock on
   * a shelf the market had already opened. See `TIERS` in `src/lib/companies.ts`.
   */
  const stars = standing({ ...career, badges });
  const read = progress(career.companiesStudied, stars);
  const skills = reachable(mastery(game), game.act);

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-6" style={clearsBar()}>
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
            {/* Standing leads, because standing is what the rank runs on. The
                badge count is still here, one line down, because it is the
                thing the case itself is full of. */}
            <div className="ml-auto text-right">
              <div className="font-ledger text-2xl font-bold tabular-nums text-white">
                ⭐ {card.standing.held}
                {card.standing.nextAt !== null && (
                  <span className="text-white/40">/{card.standing.nextAt}</span>
                )}
              </div>
              <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-white/50">
                {plural(card.badges.held, 'badge')}
              </div>
            </div>
          </div>
          <div className="mt-2 font-body text-[12px] font-bold text-white/70">{card.line}</div>
        </div>

        {/* Four tabs, each a set with a hole in it. The counts are on the tabs
            themselves because the gap is the reason to open one. */}
        <div className="mt-4 grid grid-cols-5 gap-1">
          {TABS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              /* `py-2.5`, not `py-1.5`: five tabs across a phone leaves each one
                 65 pixels wide, so the only dimension available to make them
                 hittable is the height. At 29 pixels they were under a thumb's
                 worth, on the screen a kid opens to look at what they have. */
              className={`rounded-xl border-[3px] px-0.5 py-2.5 font-body text-[9px] font-extrabold uppercase leading-tight tracking-tight ${
                tab === option
                  ? 'border-lemon bg-lemon text-ink'
                  : 'border-white/25 bg-white/10 text-white/70'
              }`}
            >
              {option === 'words'
                ? `Words ${words.earned}`
                : option === 'read'
                  ? `Read ${read.read}`
                  : option}
            </button>
          ))}
        </div>

        {/*
          * What you can do.
          *
          * The first tab, because it is the only one that answers "am I getting
          * better at this" rather than "how much have I collected". Everything
          * here was earned by doing, never by being told — see
          * `src/lib/mastery.ts`.
          *
          * The unseen ones are the point of showing it to the kid at all. They
          * are not a report card; they are a list of things nobody has told them
          * to try, which is the only kind of learning that sticks.
          */}
        {tab === 'can do' && (
          <div className="mt-4 space-y-2">
            <p className="px-1 font-body text-[12px] font-bold text-white/60">
              {masteryLine(mastery(game), game.act)}
            </p>
            {skills.map((skill) => (
              <div
                key={skill.id}
                className={`rounded-2xl border-[3px] p-3 ${SKILL_STYLE[skill.level]}`}
              >
                <div className="flex items-baseline gap-2">
                  <span aria-hidden>
                    {skill.level === 'held' ? '✅' : skill.level === 'emerging' ? '🌱' : '⬜'}
                  </span>
                  <span
                    className={`flex-1 font-sign text-lg leading-tight ${
                      skill.level === 'unseen' ? 'text-white/40' : 'text-ink'
                    }`}
                  >
                    {skill.plain}
                  </span>
                  {skill.level === 'held' && skill.sightings.length > 1 && (
                    <span className="shrink-0 font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/40">
                      ×{skill.sightings.length}
                    </span>
                  )}
                </div>

                {/* The receipt. A kid who is told they did something well and
                    cannot see when will not believe it either. */}
                {skill.sightings.length > 0 ? (
                  <div className="mt-1.5 border-t-2 border-dashed border-ink/12 pt-1.5 font-body text-[11px] font-bold leading-snug text-ink/60">
                    <span className="font-extrabold text-ink/75">
                      {skill.sightings[skill.sightings.length - 1].when}:
                    </span>{' '}
                    {skill.sightings[skill.sightings.length - 1].what}
                    {skill.level === 'emerging' && (
                      <span className="mt-1 block font-extrabold text-wood-deep">
                        Do it once more and it counts.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 font-body text-[11px] font-bold text-white/35">
                    Nobody is going to tell you when. You will know.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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

        {/*
          * The collection.
          *
          * `companiesStudied` has driven the kid's rank since the market opened
          * and has never been shown to them. See `src/lib/collection.ts` — a
          * set with a hole in it is the oldest reason in games to go and do the
          * thing again, and here the thing is reading a set of accounts.
          */}
        {tab === 'read' && (
          <div className="mt-4 space-y-5">
            <p className="px-1 font-body text-[12px] font-bold text-white/60">
              {collectionLine(career.companiesStudied, stars)}
            </p>
            {shelves(career.companiesStudied, stars).map((shelf) => (
              <div key={shelf.tier}>
                <div className="flex items-baseline justify-between px-1">
                  <span className="font-sign text-lg text-lemon-light">
                    {shelf.open ? shelf.name : '🔒 ' + shelf.name}
                  </span>
                  <span className="font-body text-[11px] font-extrabold text-white/45">
                    {shelf.open ? `${shelf.read}/${shelf.slots.length}` : shelf.opensWhen}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {shelf.slots.map((slot) => (
                    <div
                      key={slot.ticker}
                      className={`flex aspect-square flex-col items-center justify-center rounded-xl border-[3px] px-0.5 ${
                        slot.read
                          ? 'border-lemon/70 bg-white'
                          : slot.reachable
                            ? 'border-dashed border-white/30 bg-white/5'
                            : 'border-white/15 bg-white/[0.03]'
                      }`}
                    >
                      <span aria-hidden className={`text-xl ${slot.read ? '' : 'opacity-25 grayscale'}`}>
                        {slot.company.emoji}
                      </span>
                      <span
                        className={`mt-0.5 font-body text-[9px] font-extrabold leading-none ${
                          slot.read ? 'text-ink/70' : 'text-white/30'
                        }`}
                      >
                        {slot.reachable ? slot.ticker : '???'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'record' && (
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
                  ? `${plural(career.clubWeeks, 'week')}, ${plural(career.clubProposalsPassed, 'proposal')} carried`
                  : 'not in one yet'
              }
            />
          </div>
        )}
      </div>

      <PinnedBar className="z-20 mx-auto max-w-md border-t-[3px] border-white/15 bg-[#16203A] px-4 pb-5 pt-6">
        <ChunkyButton variant="lemon" full onClick={onBack}>
          Back →
        </ChunkyButton>
      </PinnedBar>
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
