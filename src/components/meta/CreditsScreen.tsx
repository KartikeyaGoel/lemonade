'use client';

import {
  CREDITS_PER_DOLLAR,
  TOPUP_STEP,
  affordableDollars,
  creditsCard,
} from '@/lib/credits';
import { recent, type Ledger, type Streak } from '@/lib/ledger';
import { earnerFor } from '@/lib/credits';
import { ChunkyButton, PinnedBar, SignHeading, Sky, clearsBar, money, plural } from '../ui';

/**
 * Credits: what they are for, and what is still worth doing today.
 *
 * The screen is built around `leftToday` rather than around the balance,
 * because a currency screen that only shows a number is a scoreboard and a
 * scoreboard teaches nothing. This one answers "what should I do next", and
 * the list is sorted by what it pays — so the top of it is always the hardest
 * and most valuable thing still available.
 *
 * That ordering is the whole argument for a currency existing here at all.
 * PRODUCT.md §16 refused XP because "XP rewards time spent… activity mistaken
 * for skill", and the thing that makes credits different is visible on this
 * screen: turning down an overpriced business is at the top, at 40, and
 * running a day at the stand is at the bottom, at 2.
 *
 * There is exactly one thing to buy and it is money to invest with. Not a
 * badge, not a rank, not a cosmetic — §16's ladder is derived from what has
 * been demonstrated, and a buyable rung would make it a shop.
 */
export function CreditsScreen({
  ledger,
  streak,
  today,
  canSpend,
  onTopUp,
  onBack,
}: {
  ledger: Ledger;
  streak: Streak;
  /** The child's own calendar day, so "today" means their today. */
  today: string;
  /**
   * Whether there is somewhere for the money to go.
   *
   * False before the practice account exists. The button is hidden rather
   * than disabled, because a control that cannot work is worse than no
   * control — a child taps it, nothing happens, and they learn the screen is
   * broken.
   */
  canSpend: boolean;
  onTopUp: (dollars: number) => void;
  onBack: () => void;
}) {
  const card = creditsCard(ledger, today);
  const affordable = affordableDollars(ledger);
  const log = recent(ledger, 6);

  return (
    <Sky mood="dusk">
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-5"
        style={clearsBar()}
      >
        <button
          type="button"
          onClick={onBack}
          className="-m-2 self-start p-2 font-body text-sm font-extrabold text-ink/70"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 text-4xl">Credits</SignHeading>

        <div className="mt-3 rounded-2xl border-[3px] border-ink/12 bg-white/80 px-4 py-3">
          <div className="font-sign text-4xl leading-none text-ink">{card.balance}</div>
          <p className="mt-1 font-body text-[12px] font-bold text-ink/60">{card.line}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="stat-chip !text-[11px]">{card.today} earned today</span>
            <span className="stat-chip !text-[11px]">{card.earned} all told</span>
            {streak.running > 0 && (
              <span className="stat-chip !text-[11px]">
                {plural(streak.running, 'day')} running
              </span>
            )}
          </div>
        </div>

        {canSpend && affordable >= TOPUP_STEP && (
          <div className="mt-3 rounded-2xl border-[3px] border-mint/50 bg-mint/15 px-4 py-3">
            <div className="font-body text-sm font-extrabold text-ink/85">
              Turn credits into money to invest
            </div>
            <p className="mt-1 font-body text-[12px] font-bold text-ink/60">
              {CREDITS_PER_DOLLAR} credits is $1, in ${TOPUP_STEP} steps. It goes into your
              practice account to buy more of what you already believe in.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[TOPUP_STEP, TOPUP_STEP * 2, affordable]
                .filter((amount, index, all) => amount <= affordable && all.indexOf(amount) === index)
                .map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => onTopUp(amount)}
                    className="flex min-h-11 items-center rounded-xl border-[3px] border-ink/15 bg-white/85 px-3 py-2 font-body text-sm font-extrabold text-ink/80 transition active:translate-y-[1px]"
                  >
                    {money(amount)} · {amount * CREDITS_PER_DOLLAR} credits
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="mt-4 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
          Still worth doing today
        </div>
        {/*
          Sorted by what it pays, which puts the hardest thing first. A child
          reading down this list is being pointed at passing on an overpriced
          company, not at buying something.
        */}
        <div className="mt-1.5 space-y-1.5">
          {card.leftToday.slice(0, 6).map((earner) => (
            <div
              key={earner.deed}
              className="flex items-start justify-between gap-3 rounded-xl border-2 border-ink/12 bg-white/70 px-3 py-2"
            >
              <div>
                <div className="font-body text-[13px] font-extrabold leading-snug text-ink/85">
                  {earner.label}
                </div>
                <div className="mt-0.5 font-body text-[11px] font-bold leading-snug text-ink/50">
                  {earner.because}
                </div>
              </div>
              <span className="shrink-0 font-sign text-xl leading-none text-mint-deep">
                {earner.worth}
              </span>
            </div>
          ))}
          {card.leftToday.length === 0 && (
            <p className="rounded-xl border-2 border-ink/12 bg-white/70 px-3 py-2 font-body text-[13px] font-bold text-ink/70">
              You have earned everything today has to give. That takes some doing.
            </p>
          )}
        </div>

        {log.length > 0 && (
          <>
            <div className="mt-4 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
              What you did
            </div>
            <div className="mt-1.5 space-y-1">
              {log.map((entry, index) => (
                <div
                  key={`${entry.deed}-${entry.on}-${index}`}
                  className="flex items-center justify-between gap-3 font-body text-[12px] font-bold text-ink/60"
                >
                  <span className="truncate">
                    {earnerFor(entry.deed)?.label ?? entry.deed}
                    {entry.what ? ` · ${entry.what}` : ''}
                  </span>
                  <span className="shrink-0 font-extrabold text-ink/45">
                    {/* Zero is shown rather than hidden: a child who read a
                        fourth company today should see that it counted as a
                        thing they did even though the day's credit was spent. */}
                    {entry.credits > 0 ? `+${entry.credits}` : 'capped'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <PinnedBar className="mt-auto">
          <ChunkyButton variant="mint" full onClick={onBack}>
            Done
          </ChunkyButton>
        </PinnedBar>
      </div>
    </Sky>
  );
}
