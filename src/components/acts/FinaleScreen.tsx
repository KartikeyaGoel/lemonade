'use client';

import { useEffect } from 'react';
import { play } from '@/lib/sound';
import { SNAPSHOT, metricsFor } from '@/lib/companies';
import {
  MARKET_WEEKS,
  holdingGain,
  holdingValue,
  type PortfolioState,
  type PortfolioSummary,
} from '@/lib/market';
import { ChunkyButton, clearsBar, money, PinnedBar, SignHeading, Sky } from '../ui';
import { plural } from '@/lib/copy';

/** How Level 1 finished, in the few facts this screen needs to tell it. */
export interface FinaleEnding {
  /** Stands trading at the end, the first one included. */
  stands: number;
  hadShop: boolean;
  borrowed: boolean;
  listed: boolean;
  /** Only meaningful when they listed. */
  shares: number;
  sharePrice: number;
  floated: number;
  /** Only meaningful when they sold up. */
  buyoutMultiple: number;
}

/**
 * The end of the arc.
 *
 * The number that gets the big type is deliberately not the return. It is what
 * they can now do, because a kid who happened to have a good twelve weeks did
 * not learn more than one who had a bad twelve weeks, and telling them
 * otherwise is the single most dangerous thing this product could do.
 */
export function FinaleScreen({
  summary,
  portfolio,
  ending,
  onParent,
  onRestart,
  onTrophies,
  onNewSeason,
  seasonNumber,
}: {
  summary: PortfolioSummary;
  portfolio: PortfolioState;
  /**
   * How Level 1 ended, because there are two ways and they are not the same
   * story.
   *
   * This screen took a `buyoutMultiple` and told everybody they had sold the
   * business. A kid who went public instead was shown *"Sold the business:
   * someone paid 0 times what it earned in a week"* — a sale that did not
   * happen, at a multiple of nothing, on the screen that recaps their whole
   * run. It also lost the two stages in the middle, so a shop and a listing
   * simply did not appear in "the whole story".
   */
  ending: FinaleEnding;
  onParent: () => void;
  onRestart: () => void;
  onTrophies?: () => void;
  /**
   * A new season keeps every badge and word. That is what makes it safe to
   * press — and pressing it is where the learning actually sticks, because
   * nothing durable is learned in one sitting.
   */
  onNewSeason?: () => void;
  seasonNumber?: number;
}) {
  const up = summary.gainDollars >= 0;
  const held = Object.keys(portfolio.holdings);

  // The one cue in the game allowed to take a whole second. It plays whether
  // the twelve weeks went well or badly, because what is being celebrated is
  // finishing, not the return — which is the same argument as the headline.
  useEffect(() => {
    play('fanfare');
  }, []);

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-8" style={clearsBar()}>
        <div className="text-center">
          <div className="font-body text-xs font-extrabold uppercase tracking-[0.25em] text-lemon-light">
            {MARKET_WEEKS} weeks later
          </div>
          <SignHeading className="mt-2 !text-lemon-light text-5xl leading-[0.95]">
            You started with a folding table.
          </SignHeading>
        </div>

        {/* The journey, as one line of arithmetic per act. */}
        <div className="mt-6 rounded-2xl border-[3px] border-white/25 bg-white p-4 shadow-xl">
          <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            The whole story
          </div>
          {/* The five stages, and the middle two only appear if they happened.
              A recap that lists a shop nobody opened is a recap of somebody
              else's run. */}
          <Step n={1} label="Sold lemonade" detail="Found the price that made the most money." />
          <Step
            n={2}
            label={ending.stands > 1 ? 'Opened another stand' : 'Grew it'}
            detail={
              ending.stands > 1
                ? `Paid somebody to mind one stand and went and worked ${ending.stands - 1} more.`
                : 'Spent profit on capacity, and outlasted a rival.'
            }
          />
          {ending.hadShop && (
            <Step
              n={3}
              label="Took a lease"
              detail={
                ending.borrowed
                  ? 'Borrowed for a shop with a door, and paid the rent on the quiet days.'
                  : 'Got a shop with a door, and paid the rent on the quiet days.'
              }
            />
          )}
          <Step
            n={ending.hadShop ? 4 : 3}
            label={ending.listed ? 'Took it public' : 'Sold the business'}
            detail={
              ending.listed
                ? `Cut it into ${ending.shares} pieces at ${money(ending.sharePrice)} each and sold ${Math.round(ending.floated * 100)}% of them.`
                : `Someone paid ${plural(ending.buyoutMultiple, 'time')} what it earned in a week.`
            }
          />
          <Step
            n={ending.hadShop ? 5 : 4}
            label="Bought other businesses"
            detail={`Put ${money(summary.startingValue)} into ${summary.holdingsCount} real companies.`}
          />
        </div>

        <div
          className={`mt-4 rounded-2xl border-[3px] p-4 ${
            up ? 'border-mint/60 bg-mint/15' : 'border-berry/50 bg-berry/15'
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/60">
              Your portfolio
            </span>
            <span
              className={`font-ledger text-sm font-bold tabular-nums ${up ? 'text-mint' : 'text-berry'}`}
            >
              {up ? '+' : ''}
              {(summary.gainPercent * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ledger-row mt-1">
            <span className="text-ink/60">Started with</span>
            <span>{money(summary.startingValue)}</span>
          </div>
          <div className="ledger-row text-base font-extrabold">
            <span>Worth now</span>
            <span>{money(summary.currentValue)}</span>
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/65">
            Twelve weeks is far too short to tell whether you are good at this. That is not a
            consolation — it is the most useful thing on this screen.
          </p>
        </div>

        {held.length > 0 && (
          <div className="mt-4 rounded-2xl border-[3px] border-white/20 bg-white/90 p-3">
            <div className="mb-1 font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              What you still own
            </div>
            {held.map((ticker) => {
              const company = SNAPSHOT.find((c) => c.ticker === ticker)!;
              const gain = holdingGain(portfolio, ticker);
              const pe = metricsFor(company).pe;
              return (
                <div key={ticker} className="flex items-center gap-2 py-1">
                  <span aria-hidden>{company.emoji}</span>
                  <span className="flex-1 font-body text-sm font-extrabold text-ink">
                    {company.name}
                  </span>
                  <span className="font-body text-[10px] font-bold text-ink/45">
                    {pe ? `${pe.toFixed(0)}x` : 'no PE'}
                  </span>
                  <span className="w-20 text-right font-ledger text-xs tabular-nums text-ink/70">
                    {money(holdingValue(portfolio, ticker))}
                  </span>
                  <span
                    className={`w-14 text-right font-ledger text-xs font-bold tabular-nums ${
                      gain.dollars >= 0 ? 'text-mint' : 'text-berry'
                    }`}
                  >
                    {gain.dollars >= 0 ? '+' : ''}
                    {(gain.percent * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* What they can do now. The real reward. */}
        <div className="mt-4 rounded-2xl border-[3px] border-lemon/50 bg-lemon/15 p-4">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            What you can actually do now
          </div>
          <ul className="mt-1.5 space-y-1 font-body text-[13px] font-bold text-white/90">
            <li>· Work out what a business keeps from every dollar it sells.</li>
            <li>· Divide a price by a profit and say whether it is dear or cheap.</li>
            {/* Only for a founder who has one. It is the claim the whole arc
                was rebuilt to be able to make, and it would be a lie to a kid
                who sold up before ever having a price of their own. */}
            {ending.listed && (
              <li>· Say why a share price moved, from the two numbers that moved it.</li>
            )}
            <li>· Tell the difference between a bad business and a good one at a bad price.</li>
            <li>· Sit still when the price of something good goes down.</li>
          </ul>
          {summary.heldThroughDrawdown && (
            <p className="mt-2 rounded-xl bg-white/15 p-2.5 font-body text-[12px] font-extrabold text-lemon-light">
              You watched something you owned fall more than 10% and you kept it. Most grown adults
              cannot do that.
            </p>
          )}
          {summary.panicSold && (
            <p className="mt-2 rounded-xl bg-white/15 p-2.5 font-body text-[12px] font-bold text-white/80">
              You sold something while it was down. Worth asking yourself what had actually changed
              about that business.
            </p>
          )}
        </div>
      </div>

      <PinnedBar className="z-30 bg-gradient-to-t from-black/70 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md space-y-2.5 px-4">
          {onNewSeason ? (
            <ChunkyButton variant="lemon" full onClick={onNewSeason}>
              Season {(seasonNumber ?? 1) + 1} — new street →
            </ChunkyButton>
          ) : (
            <ChunkyButton variant="lemon" full onClick={onParent}>
              Show a grown-up
            </ChunkyButton>
          )}
          <div className="flex gap-2.5">
            {onTrophies && (
              <ChunkyButton variant="ghost" onClick={onTrophies} className="!flex-1 !text-base">
                Trophy case
              </ChunkyButton>
            )}
            {onNewSeason && (
              <ChunkyButton variant="ghost" onClick={onParent} className="!flex-1 !text-base">
                Show a grown-up
              </ChunkyButton>
            )}
            {!onNewSeason && (
              <ChunkyButton variant="ghost" onClick={onRestart} className="!flex-1 !text-base">
                Start over
              </ChunkyButton>
            )}
          </div>
          {onNewSeason && (
            <p className="text-center font-body text-[11px] font-bold text-white/55">
              A new season keeps every badge and every word. Only the stand starts again.
            </p>
          )}
        </div>
      </PinnedBar>
    </Sky>
  );
}

function Step({ n, label, detail }: { n: number; label: string; detail: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lemon-deep font-sign text-sm text-ink">
        {n}
      </div>
      <div>
        <div className="font-body text-sm font-extrabold text-ink">{label}</div>
        <div className="font-body text-[12px] font-bold text-ink/60">{detail}</div>
      </div>
    </div>
  );
}
