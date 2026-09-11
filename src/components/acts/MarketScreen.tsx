'use client';

import { useState } from 'react';
import {
  FUNDAMENTALS_SOURCE,
  PRICES_SOURCE,
  MODELS,
  SNAPSHOT,
  SNAPSHOT_AS_OF,
  TIERS,
  formatMillions,
  hasAccountsBy,
  metricsFor,
  standComparison,
  tierUnlocked,
  type Company,
  type Tier,
} from '@/lib/companies';
import { collectionLine, progress } from '@/lib/collection';
import { faceoff } from '@/lib/facedown';
import { strengthsAndRisks, type Quality as QualityItem } from '@/lib/qualities';
import {
  MAX_POSITION_FRACTION,
  MARKET_WEEKS,
  canRunStand,
  closesUpToNow,
  currentDate,
  currentPrice,
  holdingGain,
  holdingValue,
  investedValue,
  maxSpendOn,
  positionFraction,
  totalValue,
  type PortfolioState,
} from '@/lib/market';
import { runningFor } from '@/lib/live';
import type { Readiness } from '@/lib/progress';
import { PipSays } from '../Pip';
import { ChunkyButton, clearsBar, money, PinnedBar, SignHeading, Sky } from '../ui';
import { CoachTour } from '../CoachTour';
import { MARKET_TOUR } from '@/lib/coach';

/**
 * Act 5. Other people's lemonade stands.
 *
 * Every company is described with the same four numbers the kid used on their
 * own stand — what it sells, what it keeps, what slice that is, and how many
 * years of profit the market is asking for. Nothing here is a recommendation.
 */
export function MarketScreen({
  tour = false,
  onToured,
  portfolio,
  readiness,
  knowsPE,
  badges,
  studied,
  onResearch,
  onStartBuy,
  onSell,
  onAdvanceWeek,
  onLeave,
  onOpenGate,
  guide,
  drifts = [],
  onChecked,
  onClub,
  onWeekendStand,
  onPlaybook,
}: {
  /** Run the first-run tour of the market. */
  tour?: boolean;
  /** Reports whether the child reached the end. See `markFor`. */
  onToured?: (finished: boolean) => void;
  portfolio: PortfolioState;
  readiness: Readiness;
  /** True once the kid has been handed the words "P/E ratio" at the sale. */
  knowsPE: boolean;
  /** Standing, which is what opens the later tiers of the collection. */
  badges: number;
  /** Every company whose accounts this kid has ever opened. */
  studied: string[];
  onResearch: (ticker: string) => void;
  onStartBuy: (company: Company) => void;
  onSell: (ticker: string, fraction: number) => void;
  /**
   * Absent in the live market, where a week arrives because a week has passed.
   *
   * The button is the difference between replaying history and living in it,
   * so it is the one control that must not exist on a live account.
   */
  onAdvanceWeek?: () => void;
  /** Live only: there is no end to walk towards, so there is a way out. */
  onLeave?: () => void;
  onOpenGate: () => void;
  /**
   * Pip's payoff line, once.
   *
   * "Every one of these is somebody's lemonade stand" is the thesis the whole
   * product rests on. It is the first line of the README and the spine of the
   * pitch, and until Pip existed it was never once said to the child playing.
   */
  guide?: { lines: readonly string[]; onDismiss: () => void } | null;
  /**
   * Written reasons that have stopped being true.
   *
   * The mechanic the customer's note called the strongest one available: "you
   * bought this because revenue was growing quickly, and growth has now
   * slowed." It appears here rather than in a notification because it has to
   * arrive where a child can act on it, and because it is *rare* — only a
   * claim that held at purchase and does not now, which is a handful of
   * holdings over a whole run rather than a weekly nag.
   */
  drifts?: readonly { says: string; ticker?: string }[];
  /**
   * The child having actually looked at a reason that stopped being true.
   *
   * The card used to end on "Want to think again?" with nothing to press,
   * which made the question rhetorical — and left "checking whether the
   * thesis changed" as a row on the credits screen with no way in the game to
   * do it. A reward you cannot earn is a promise on a screen.
   */
  onChecked?: (ticker?: string) => void;
  /** Only passed once a club is a thing that exists for this kid. */
  onClub?: () => void;
  /** Saturday: run the stand once a week and put the takings in the account. */
  onWeekendStand?: () => void;
  /** The rulebook, once there is a trade behind them to make it mean something. */
  onPlaybook?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  /** Two tickers held against each other. The same verb as the Act 1 bench. */
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const hasRead = new Set(studied);
  const read = progress(studied, badges);
  const asOfDate = (p: PortfolioState) => currentDate(p);
  const company = open ? SNAPSHOT.find((c) => c.ticker === open) ?? null : null;

  if (comparing && picked.length === 2) {
    const [a, b] = picked.map((t) => SNAPSHOT.find((c) => c.ticker === t)!);
    return (
      <FaceoffView
        result={faceoff(a, b, currentPrice(portfolio, a.ticker), currentPrice(portfolio, b.ticker), asOfDate(portfolio))}
        history={{
          a: closesUpToNow(portfolio, a.ticker).map((point) => point.close),
          b: closesUpToNow(portfolio, b.ticker).map((point) => point.close),
        }}
        priceOf={(ticker) => currentPrice(portfolio, ticker)}
        asOf={asOfDate(portfolio)}
        onBack={() => setPicked([])}
      />
    );
  }

  if (company) {
    return (
      <CompanyDetail
        company={company}
        portfolio={portfolio}
        canTrade={readiness.canTrade}
        knowsPE={knowsPE}
        onBack={() => setOpen(null)}
        onStartBuy={onStartBuy}
        onSell={onSell}
        onOpenGate={onOpenGate}
      />
    );
  }

  // Everything on this screen is read as of the week being replayed, so the
  // accounts shown are the ones that were public then.
  const asOf = currentDate(portfolio);
  const invested = investedValue(portfolio);
  const total = totalValue(portfolio);
  const held = Object.keys(portfolio.holdings);

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pt-5" style={clearsBar()}>
        <div className="flex items-baseline justify-between">
          <SignHeading className="!text-lemon-light text-3xl">The market</SignHeading>
          {/* Weeks *elapsed*, not a week number. The counter starts at zero
              because no time has passed yet, and "Week 0 / 12" read like a
              bug. */}
          <span className="stat-chip !text-xs">
            {portfolio.live ? runningFor(portfolio) : `${portfolio.week} of ${MARKET_WEEKS} weeks done`}
          </span>
        </div>

        {guide && (
          <PipSays className="mt-4" lines={guide.lines} onDismiss={guide.onDismiss} />
        )}

        {/*
          One drift at a time, and above the money.
          
          One, because §26's rule is one thing lit up with a finger pointing at
          it, and a child with four stale reasons handed all four at once will
          act on none of them. Above the money because it is the thing that
          should change what they do with it, and a warning under a total is a
          footnote.
        */}
        {drifts.length > 0 && (
          <div
            className="mt-4 rounded-2xl border-[3px] border-berry/60 bg-white px-4 py-3"
            data-coach="market-drift"
          >
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-berry">
              Your reason has changed
            </div>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/80">
              {drifts[0].says}
            </p>
            {drifts.length > 1 && (
              <p className="mt-1.5 font-body text-[11px] font-extrabold text-ink/45">
                {drifts.length - 1} more like this. One at a time.
              </p>
            )}
            {onChecked && (
              <button
                type="button"
                onClick={() => onChecked(drifts[0].ticker)}
                className="mt-2 min-h-11 w-full rounded-xl border-[3px] border-ink/20 bg-white font-body text-xs font-extrabold uppercase tracking-wide text-ink/70"
              >
                I have had a look
              </button>
            )}
          </div>
        )}

        {/* The pot */}
        <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-night-panel p-4">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            Your money
          </div>
          <div className="font-sign text-5xl leading-none text-white">{money(total)}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="stat-chip !text-xs">💵 {money(portfolio.cash)} cash</span>
            <span className="stat-chip !text-xs">📈 {money(invested)} invested</span>
            <span className="stat-chip !text-xs">
              {held.length} {held.length === 1 ? 'company' : 'companies'}
            </span>
          </div>
        </div>

        {onPlaybook && (
          <button
            type="button"
            onClick={onPlaybook}
            className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[3px] border-lemon/60 bg-lemon/15 p-3 text-left"
          >
            <span aria-hidden className="text-xl">
              📓
            </span>
            <div>
              <div className="font-body text-sm font-extrabold text-lemon-light">Your playbook</div>
              <div className="font-body text-[11px] font-bold text-white/85">
                Four rules, tested against every twelve weeks of real history there is.
              </div>
            </div>
          </button>
        )}

        {onClub && (
          <button
            type="button"
            onClick={onClub}
            className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[3px] border-white/25 bg-night-panel p-3 text-left"
          >
            <span aria-hidden className="text-xl">
              🧑‍🤝‍🧑
            </span>
            <div>
              <div className="font-body text-sm font-extrabold text-lemon-light">
                Investment club
              </div>
              <div className="font-body text-[11px] font-bold text-white/85">
                Pool money with friends. Nobody buys anything without a reason the others can
                vote down.
              </div>
            </div>
          </button>
        )}

        {/* The Saturday stand.
            Two loops side by side rather than one after the other: a two-minute
            one that makes money out of unit economics, and a twelve-week one
            that turns money into ownership. The line underneath is the whole
            product in one sentence — this is what a Saturday buys you. */}
        {onWeekendStand && (
          <button
            type="button"
            onClick={onWeekendStand}
            disabled={!canRunStand(portfolio)}
            className={`mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[3px] p-3 text-left ${
              canRunStand(portfolio)
                ? 'border-lemon bg-lemon/20'
                : 'border-white/15 bg-night-panel opacity-60'
            }`}
          >
            <span aria-hidden className="text-2xl">
              🍋
            </span>
            <div className="flex-1">
              <div className="font-body text-sm font-extrabold text-lemon-light">
                {canRunStand(portfolio) ? 'Saturday stand' : 'Stand done for this week'}
              </div>
              <div className="font-body text-[11px] font-bold text-white/85">
                {canRunStand(portfolio)
                  ? 'You still make lemonade at weekends. Whatever it makes goes into the account.'
                  : 'Come back after next week.'}
              </div>
            </div>
            {portfolio.standEarnings !== 0 && (
              <span className="font-ledger text-xs font-bold tabular-nums text-mint">
                +{money(portfolio.standEarnings)}
              </span>
            )}
          </button>
        )}

        <CoachTour tour={MARKET_TOUR} run={tour && !comparing} onDone={(finished) => onToured?.(finished)} />

        {!readiness.canTrade && (
          <button
            type="button"
            onClick={onOpenGate}
            data-coach="gate"
            className="mt-3 w-full rounded-2xl border-[3px] border-dashed border-lemon/60 bg-lemon/10 p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden>🔒</span>
              <span className="font-body text-sm font-extrabold text-lemon-light">
                Research is open. Buying is not, yet.
              </span>
            </div>
            <div className="mt-0.5 font-body text-[11px] font-bold text-white/85">
              You have shown {readiness.metCount} of the {readiness.criteria.length} things you need
              before real money moves. Tap to see which.
            </div>
          </button>
        )}

        {/* Holdings first — the kid's own stuff always leads. */}
        {held.length > 0 && (
          <>
            <div className="mt-5 px-1 font-sign text-xl text-lemon-light">What you own</div>
            {held.map((ticker) => {
              const c = SNAPSHOT.find((x) => x.ticker === ticker)!;
              const gain = holdingGain(portfolio, ticker);
              return (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => {
                    onResearch(ticker);
                    setOpen(ticker);
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl border-[3px] border-white/25 bg-white/90 px-3 py-2.5 text-left"
                >
                  <span aria-hidden className="text-2xl">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-sm font-extrabold text-ink">{c.name}</div>
                    <div className="font-body text-[11px] font-bold text-ink/55">
                      {money(holdingValue(portfolio, ticker))} · {Math.round(positionFraction(portfolio, ticker) * 100)}% of your money
                    </div>
                  </div>
                  <div
                    className={`font-ledger text-sm font-bold tabular-nums ${
                      gain.dollars >= 0 ? 'text-mint' : 'text-berry'
                    }`}
                  >
                    {gain.dollars >= 0 ? '+' : ''}
                    {(gain.percent * 100).toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </>
        )}

        <div className="mt-5 flex items-baseline justify-between px-1">
          <span className="font-sign text-xl text-lemon-light">Businesses you could own</span>
          <button
            type="button"
            data-coach="compare"
            onClick={() => {
              setComparing((on) => !on);
              setPicked([]);
            }}
            /* Raised twice. `py-0.5` made this a 25-pixel target at eleven
               pixels of type; `py-1.5` got it to 33. Compare is the verb this
               screen most wants a kid to reach for, so it now gets the full 44
               the guideline asks for, with the pill drawn exactly as before. */
            className={`inline-flex min-h-11 items-center rounded-full border-2 px-3 py-1.5 font-body text-[11px] font-extrabold ${
              comparing ? 'border-mint bg-mint/25 text-white' : 'border-white/40 text-white/85'
            }`}
          >
            ⚖️ Compare
          </button>
        </div>
        <div className="mb-1 px-1 font-body text-[10px] font-bold text-white/85">
          {comparing
            ? 'Pick two. Same idea as trying two prices on your stand.'
            : `Real weekly prices · figures from their own filings · data to ${SNAPSHOT_AS_OF}`}
        </div>

        {/* The collection, where the collecting happens. Opening a company's
            accounts fills a slot, and the only place that was visible was a tab
            in the trophy case — a long way from the moment it happens. */}
        {!comparing && (
          <div className="mb-1 flex items-center gap-2 rounded-xl border-[3px] border-white/20 bg-night-panel px-2.5 py-1.5">
            <span aria-hidden className="text-sm">
              📖
            </span>
            <span className="font-ledger text-xs font-bold tabular-nums text-lemon-light">
              {read.read}/{read.total}
            </span>
            <span className="flex-1 font-body text-[10px] font-extrabold leading-tight text-white/85">
              {collectionLine(studied, badges)}
            </span>
          </div>
        )}

        {([1, 2, 3] as Tier[]).map((tier) => {
          // Not listed yet in the week being replayed is not the same as
          // locked: it simply was not a company a kid could have bought.
          const inTier = SNAPSHOT.filter((c) => c.tier === tier && hasAccountsBy(c, asOf));
          if (inTier.length === 0) return null;
          const openTier = tierUnlocked(tier, badges);

          return (
            <div key={tier} className="mt-3">
              <div className="flex items-baseline justify-between px-1">
                <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-lemon-light/80">
                  {TIERS[tier].name}
                </span>
                {!openTier && (
                  <span className="font-body text-[10px] font-extrabold text-white/85">
                    🔒 {TIERS[tier].opensAt - badges} more ⭐ to unlock
                  </span>
                )}
              </div>

              {!openTier ? (
                <div className="mt-1 rounded-2xl border-[3px] border-dashed border-white/20 bg-night-panel px-3 py-2.5">
                  <p className="font-body text-[11px] font-bold text-white/85">
                    {TIERS[tier].blurb}
                  </p>
                  <div className="mt-1.5 flex gap-1.5 opacity-30">
                    {inTier.map((c) => (
                      <span key={c.ticker} aria-hidden className="text-xl grayscale">
                        {c.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                inTier.map((c) => {
                  const price = currentPrice(portfolio, c.ticker);
                  const m = metricsFor(c, price, asOf);
                  const chosen = picked.includes(c.ticker);
                  return (
                    <button
                      key={c.ticker}
                      type="button"
                      // The very first card on the screen, not the first of
                      // each tier: three tiers render, so this used to put the
                      // same anchor on two or three cards. Harmless, since the
                      // tour takes the first match, but an attribute that
                      // reads like an id should appear once.
                      {...(tier === 1 && inTier[0]?.ticker === c.ticker
                        ? { 'data-coach': 'company-card' }
                        : {})}
                      onClick={() => {
                        if (comparing) {
                          setPicked((current) =>
                            current.includes(c.ticker)
                              ? current.filter((t) => t !== c.ticker)
                              : [...current, c.ticker].slice(-2),
                          );
                          return;
                        }
                        onResearch(c.ticker);
                        setOpen(c.ticker);
                      }}
                      className={`mt-2 flex w-full items-center gap-3 rounded-2xl border-[3px] px-3 py-2.5 text-left ${
                        chosen ? 'border-mint bg-white' : 'border-white/20 bg-white/85'
                      }`}
                    >
                      <span aria-hidden className="text-2xl">
                        {c.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-sm font-extrabold text-ink">
                          {c.name}{' '}
                          <span className="font-ledger text-[11px] text-ink/40">{c.ticker}</span>
                          {/* A slot filled. Small, because reading a company is
                              worth noting and not worth congratulating. */}
                          {hasRead.has(c.ticker) && (
                            <span aria-label="You have read these accounts" className="ml-1 text-[11px]">
                              📖
                            </span>
                          )}
                        </div>
                        <div className="font-body text-[11px] font-bold text-ink/55">
                          {c.whatTheySell}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-ledger text-sm font-bold tabular-nums text-ink">
                          {money(price)}
                        </div>
                        <div className="font-body text-[10px] font-extrabold text-ink/50">
                          {m.pe ? `${m.pe.toFixed(0)}x profit` : 'loses money'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <PinnedBar className="z-30 pb-5 pt-8 bg-gradient-to-t from-black/60 to-transparent">
        <div className="mx-auto w-full max-w-md px-4">
          {comparing ? (
            /*
              An instruction, not a button.
              
              This was a `ChunkyButton` — disabled while fewer than two were
              picked, and then enabled with `onClick={() => undefined}`. So a
              child saw a big mint button reading "Pick 2 more" that could not
              be pressed, and then one reading "Holding them up…" that did
              nothing when it was. The comparison opens by itself the moment the
              second card is tapped, so there was never anything for it to do.
              
              Two failures at once: PRODUCT.md §40's mechanic wired to nothing,
              and a disabled primary button sitting over a scrolling list, which
              a browser check showed reads as a rendering glitch rather than as
              a prompt — the card underneath shows straight through it.
              
              Found while fixing the night screens' legibility, which is what
              made it visible at all.
            */
            <div className="rounded-2xl border-[3px] border-mint/60 bg-night-panel px-4 py-3 text-center">
              <div className="font-body text-[13px] font-extrabold text-white">
                {picked.length === 0
                  ? 'Tap two companies to hold them up against each other.'
                  : 'One more. Any two you like.'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setComparing(false);
                  setPicked([]);
                }}
                className="mt-1 inline-flex min-h-11 items-center font-body text-[12px] font-extrabold text-lemon-light underline"
              >
                Never mind
              </button>
            </div>
          ) : (
            <ChunkyButton
              variant="lemon"
              full
              onClick={portfolio.live ? onLeave : onAdvanceWeek}
            >
              {portfolio.live
                ? 'Done for now →'
                : portfolio.week >= MARKET_WEEKS
                  ? 'See how you did →'
                  : 'Next week →'}
            </ChunkyButton>
          )}
        </div>
      </PinnedBar>
    </Sky>
  );
}

/**
 * Two companies, held up against each other.
 *
 * Deliberately the same shape as the Act 1 bench: two things side by side and
 * the differences named. It never picks a winner — see `src/lib/facedown.ts`
 * for why a game that tells a kid "lower P/E is better" has taught them
 * something false.
 */
function FaceoffView({
  result,
  history,
  priceOf,
  asOf,
  onBack,
}: {
  result: ReturnType<typeof faceoff>;
  /**
   * Real weekly closes up to this week for each side, oldest first.
   *
   * Passed in because `closesUpToNow` needs the portfolio and this component
   * deliberately does not have one — and because the *ceiling* on that series
   * is the only thing stopping a price chart being a cheat sheet. See
   * `pastCloses`.
   */
  history: { a: number[]; b: number[] };
  /** The price each side is being bought at this week. */
  priceOf: (ticker: string) => number;
  /** The week being replayed, so the accounts are the ones public then. */
  asOf: string;
  onBack: () => void;
}) {
  const { a, b, rows, tradeOff } = result;
  /*
   * At the price on screen, and as of the week being replayed — the same two
   * arguments every other figure on this screen is computed from. A "the price
   * already expects a lot" risk worked out against today's real-world price
   * while a child is paying a price from 2022 would be a warning about a
   * company nobody is buying.
   */
  const caseFor = {
    a: strengthsAndRisks(a, priceOf(a.ticker), asOf),
    b: strengthsAndRisks(b, priceOf(b.ticker), asOf),
  };
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="self-start font-body text-sm font-extrabold text-lemon-light"
        >
          ← Pick two others
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[a, b].map((c, i) => (
            <div
              key={c.ticker}
              className="rounded-2xl border-[3px] border-white/25 bg-night-panel p-2.5 text-center"
            >
              <div aria-hidden className="text-2xl">
                {c.emoji}
              </div>
              <div className="font-body text-sm font-extrabold text-lemon-light">{c.name}</div>
              {/*
                A year of real weekly closes, ending this week.

                The pilot asked for a historical timeline. It goes here rather
                than on the company card because the whole value of it is the
                comparison — two shapes side by side say something neither says
                alone. Unlabelled on purpose: an axis would make it a chart to
                study, and what a child needs from it is the shape.
              */}
              <Sparkline
                points={i === 0 ? history.a : history.b}
                label={`${c.name}, the last year of weekly prices`}
              />
            </div>
          ))}
        </div>

        {/*
          The explanation *above* the table, not under it.

          It used to be the last line on the screen, at eleven pixels and
          white/50 on a night sky — 2.2:1, and below six rows on a phone, so
          nobody ever reached it. The pilot's grown-up read the six highlighted
          cells and concluded "Costco is a bad buy", which is exactly what the
          screen was saying.
        */}
        <p className="mt-3 rounded-2xl border-[3px] border-white/25 bg-night-panel px-3 py-2 font-body text-[12px] font-bold leading-snug text-white/85">
          Nobody wins this table. <strong className="text-lemon-light">More</strong> is marked on
          each row, and more is not the same as better — every row is a trade-off somebody is
          paying for.
        </p>

        <p className="mt-2 rounded-2xl border-[3px] border-lemon/50 bg-lemon/10 px-3 py-2.5 font-body text-[13px] font-extrabold leading-snug text-white">
          {tradeOff}
        </p>

        {/*
          What is good about each, and what could go wrong.

          Two questions the pilot asked in two different ways — "including
          Strengths and Risks for both companies will be helpful" and "why would
          i buy something ... there are qualitative risks and benefits of each
          stock right, the app should articulate these?" — and the answer is
          derived from the filings rather than written by us. `qualities.ts` has
          the argument, including the one input that is authored.
        */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { company: a, side: caseFor.a },
            { company: b, side: caseFor.b },
          ].map(({ company, side }) => (
            <div
              key={company.ticker}
              className="rounded-2xl border-[3px] border-white/20 bg-night-panel p-2.5"
            >
              <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.12em] text-mint">
                Going for it
              </div>
              {side.strengths.map((quality) => (
                <Quality key={quality.id} quality={quality} />
              ))}
              <div className="mt-2 font-body text-[10px] font-extrabold uppercase tracking-[0.12em] text-berry-light">
                Could go wrong
              </div>
              {side.risks.map((quality) => (
                <Quality key={quality.id} quality={quality} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border-[3px] border-white/20 bg-white/90 px-3 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden>{row.emoji}</span>
                <span className="flex-1 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/70">
                  {row.label}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['a', 'b'] as const).map((which) => (
                  <div
                    key={which}
                    /*
                      Neutral, and that is the whole fix.

                      `FaceoffRow.edge` means *which one is more* — its own doc
                      comment says "which is not the same as which one is
                      better" — and this rendered it as `bg-mint/25`. Mint is
                      the profit colour on the close screen, the correct-answer
                      colour on the deal board, the selected colour on the grade
                      picker and the met colour on the readiness gate. So the
                      screen was saying "wins" in the only colour vocabulary the
                      product has, on four rows out of six, and the pilot read
                      it exactly that way: "Right now it seems Costco is a bad
                      buy."

                      We taught "lower P/E is better" by accident, in the one
                      file that opens by promising not to. The marker is now a
                      word and an arrow in ink — legible, directional, and
                      carrying no verdict.
                    */
                    className={`rounded-lg px-2 py-1 text-center font-body text-[13px] font-extrabold ${
                      row.edge === which ? 'bg-ink/[0.07] text-ink' : 'text-ink/65'
                    }`}
                  >
                    {which === 'a' ? row.a : row.b}
                    {row.edge === which && (
                      <span className="mt-0.5 block font-body text-[9px] font-extrabold uppercase tracking-[0.1em] text-ink/70">
                        ▲ more
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/*
                The row's meaning, behind a tap.

                It is a constant per row — the same six sentences for every pair
                of companies anybody ever compares — which is literally why the
                pilot said "reading comparisons over and over again people just
                end up scrolling over it". The fifth comparison was word-for-word
                the first. What varies now is above: the trade-off sentence, the
                two shapes, and each company's own case. This stays reachable
                for a child meeting a row for the first time, and stops being
                the bulk of the screen for one meeting it for the fifth.
              */}
              <details className="group mt-1">
                <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/70">
                  What this means
                  <span aria-hidden className="transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <p className="mt-1 font-body text-[11px] font-bold leading-snug text-ink/70">
                  {row.meaning}
                </p>
              </details>
            </div>
          ))}
        </div>
      </div>
    </Sky>
  );
}

/** One derived strength or risk, with the figure it came from underneath. */
function Quality({ quality }: { quality: QualityItem }) {
  return (
    <div className="mt-1">
      <div className="font-body text-[12px] font-extrabold leading-snug text-white">
        {quality.says}
      </div>
      <div className="font-body text-[10px] font-bold leading-snug text-white/85">
        {quality.because}
      </div>
    </div>
  );
}

/**
 * A year of weekly closes, drawn small and unlabelled.
 *
 * No axis and no figures: this is a *shape*, and the numbers that matter are
 * already on the rows underneath. A chart with an axis invites a child to
 * read a trend off it and buy the line that goes up, which is the one habit
 * `thesis.ts` exists to prevent.
 *
 * Flat when there is nothing to draw — a run at week zero of the earliest
 * window has one point — rather than dividing by a zero range.
 */
function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return <div className="mt-1 h-6" aria-hidden />;
  const low = Math.min(...points);
  const high = Math.max(...points);
  const range = high - low;
  const width = 100;
  const height = 24;
  const path = points
    .map((close, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = range === 0 ? height / 2 : height - ((close - low) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  /* Up or down over the whole stretch, which is the one thing worth colouring. */
  const rose = points[points.length - 1] >= points[0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1 h-6 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polyline
        points={path}
        fill="none"
        stroke={rose ? '#2ED9A0' : '#FF9DAE'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * One company, told as a lemonade stand.
 *
 * The order matters: what they sell, then what they keep, then the price. A
 * kid should form a view about the business before they see what it costs,
 * because that is the habit that survives contact with a real market.
 */
function CompanyDetail({
  company,
  portfolio,
  canTrade,
  knowsPE,
  onBack,
  onStartBuy,
  onSell,
  onOpenGate,
}: {
  company: Company;
  portfolio: PortfolioState;
  canTrade: boolean;
  knowsPE: boolean;
  onBack: () => void;
  onStartBuy: (company: Company) => void;
  onSell: (ticker: string, fraction: number) => void;
  onOpenGate: () => void;
}) {
  const price = currentPrice(portfolio, company.ticker);
  const asOf = currentDate(portfolio);
  // Metrics at the price on screen, against the accounts that were public that
  // week. The market replays real history, so mixing this week's price with a
  // filing
  // from two years later would produce a P/E nobody ever quoted.
  const m = metricsFor(company, price, asOf);
  const allowed = maxSpendOn(portfolio, company.ticker);
  const holding = portfolio.holdings[company.ticker];
  const gain = holding ? holdingGain(portfolio, company.ticker) : null;

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pt-5" style={clearsBar()}>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 self-start rounded-full bg-white/80 px-4 py-1.5 font-body text-sm font-extrabold text-ink"
        >
          ← Market
        </button>

        <div className="rounded-2xl border-[3px] border-white/25 bg-white p-4 shadow-xl">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-3xl">
              {company.emoji}
            </span>
            <div>
              <div className="font-sign text-3xl leading-none text-ink">{company.name}</div>
              <div className="font-body text-[11px] font-bold text-ink/50">{company.whatTheySell}</div>
            </div>
          </div>

          {/* Exactly the lines a lemonade stand has. */}
          <div className="mt-4">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                A year of business
              </span>
              {/* Where the number came from, on the same card as the number.
                  Cheap to show and the whole product rests on it. */}
              <span className="font-body text-[10px] font-bold text-ink/40">
                FY{m.year.fiscalYear}, filed {m.year.filedOn}
              </span>
            </div>
            <div className="ledger-row">
              <span className="font-body font-extrabold">Sells</span>
              <span>{formatMillions(m.year.revenueM)}</span>
            </div>
            <div className="ledger-row">
              <span className="font-body font-extrabold">Keeps</span>
              <span className={m.year.netIncomeM < 0 ? 'text-berry' : ''}>
                {formatMillions(m.year.netIncomeM)}
              </span>
            </div>
            <div className="ledger-row border-t-2 border-dashed border-ink/20 pt-1">
              <span className="text-ink/60">Which is</span>
              <span>{(m.netMargin * 100).toFixed(1)}c of every dollar</span>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-ink/5 p-3">
            <div className="ledger-row text-[13px]">
              <span className="text-ink/60">Price per share</span>
              <span>{money(price)}</span>
            </div>
            {m.eps !== null && m.profitable && (
              <div className="ledger-row text-[13px]">
                <span className="text-ink/60">Profit per share, a year</span>
                <span>{money(m.eps)}</span>
              </div>
            )}
            <div className="ledger-row border-t-2 border-dashed border-ink/20 pt-1 text-[14px] font-extrabold">
              <span>Years to pay it back</span>
              <span className={m.pe ? '' : 'text-berry'}>
                {m.pe ? m.pe.toFixed(0) : 'never yet'}
              </span>
            </div>
            {/* The word, once they have earned it on their own company. Same number,
                named — so they can say it to somebody. */}
            {knowsPE && (
              <div className="ledger-row text-[12px] text-ink/55">
                <span>Which is its P/E ratio</span>
                <span>{m.pe ? m.pe.toFixed(0) : 'no P/E — no earnings to divide by'}</span>
              </div>
            )}
          </div>

          <p className="mt-3 font-body text-[13px] font-bold text-ink/75">
            {standComparison(company, price, asOf)}
          </p>

          {/* How the money arrives, mapped back to something they did. Two
              companies with the same profit are not worth the same amount, and
              this is the reason. */}
          <div className="mt-3 rounded-xl border-2 border-dashed border-ink/20 p-3">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              How the money arrives
            </div>
            <div className="mt-0.5 font-sign text-xl text-ink">{MODELS[company.model].name}</div>
            <div className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/70">
              At your stand this was {MODELS[company.model].standVersion}.
            </div>
            <div className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/55">
              {MODELS[company.model].effect}
            </div>
          </div>
          <p className="mt-2 rounded-xl bg-lemon-light p-3 font-body text-[13px] font-bold text-ink/85">
            {company.story}
          </p>

          <p className="mt-2 font-body text-[10px] font-bold leading-snug text-ink/40">
            {/* Both sources named, not one. PRODUCT.md §21 makes a point of
                there being two, and `PRICES_SOURCE` existed for this line and
                was never used — so the card credited the filings and left the
                prices as "real weekly closes", which is a claim without a
                source attached to it. */}
            Sells, keeps and share count from {FUNDAMENTALS_SOURCE}. Prices from{' '}
            {PRICES_SOURCE}. Nothing on this card was rounded for the lesson.
          </p>
        </div>

        {holding && gain && (
          <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/90 p-3.5">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              You own
            </div>
            <div className="ledger-row text-[14px] font-extrabold">
              <span>{money(holdingValue(portfolio, company.ticker))}</span>
              <span className={gain.dollars >= 0 ? 'text-mint' : 'text-berry'}>
                {gain.dollars >= 0 ? '+' : ''}
                {money(gain.dollars)}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <ChunkyButton
                variant="ghost"
                onClick={() => onSell(company.ticker, 0.5)}
                className="!flex-1 !py-2 !text-base"
              >
                Sell half
              </ChunkyButton>
              <ChunkyButton
                variant="ghost"
                onClick={() => onSell(company.ticker, 1)}
                className="!flex-1 !py-2 !text-base"
              >
                Sell all
              </ChunkyButton>
            </div>
            {gain.percent < -0.05 && (
              <p className="mt-2 font-body text-[11px] font-extrabold text-wood-deep">
                It is down. Has anything changed about the business, or just the price?
              </p>
            )}
          </div>
        )}

        {/* Buying */}
        <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/90 p-3.5">
          {!canTrade ? (
            <button type="button" onClick={onOpenGate} className="w-full text-left">
              <div className="font-body text-sm font-extrabold text-ink">🔒 Buying locked</div>
              <div className="font-body text-[11px] font-bold text-ink/55">
                Tap to see what you still need to show.
              </div>
            </button>
          ) : allowed <= 0.01 ? (
            <div>
              <div className="font-body text-sm font-extrabold text-ink">At your limit here</div>
              <div className="font-body text-[11px] font-bold text-ink/55">
                No single company may be more than {Math.round(MAX_POSITION_FRACTION * 100)}% of your
                money. Spread it around.
              </div>
            </div>
          ) : (
            <>
              <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/50">
                Up to {money(allowed)} here
              </div>
              <div className="mt-0.5 font-body text-[12px] font-bold leading-snug text-ink/65">
                You will be asked for a reason first — one from the numbers, one in your own
                words. In twelve weeks the game tells you which of them was actually right.
              </div>
              <ChunkyButton
                variant="mint"
                full
                onClick={() => onStartBuy(company)}
                className="mt-2 !py-3 !text-xl"
              >
                Buy {company.ticker} →
              </ChunkyButton>
            </>
          )}
        </div>
      </div>
    </Sky>
  );
}
