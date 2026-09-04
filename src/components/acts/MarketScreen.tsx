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
import {
  MAX_POSITION_FRACTION,
  MARKET_WEEKS,
  canRunStand,
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
  onClub,
  onWeekendStand,
  onPlaybook,
}: {
  /** Run the first-run tour of the market. */
  tour?: boolean;
  onToured?: () => void;
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

        {/* The pot */}
        <div className="mt-3 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
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
              <div className="font-body text-[11px] font-bold text-white/65">
                Four rules, tested against every twelve weeks of real history there is.
              </div>
            </div>
          </button>
        )}

        {onClub && (
          <button
            type="button"
            onClick={onClub}
            className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[3px] border-white/25 bg-white/10 p-3 text-left"
          >
            <span aria-hidden className="text-xl">
              🧑‍🤝‍🧑
            </span>
            <div>
              <div className="font-body text-sm font-extrabold text-lemon-light">
                Investment club
              </div>
              <div className="font-body text-[11px] font-bold text-white/60">
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
                : 'border-white/15 bg-white/5 opacity-60'
            }`}
          >
            <span aria-hidden className="text-2xl">
              🍋
            </span>
            <div className="flex-1">
              <div className="font-body text-sm font-extrabold text-lemon-light">
                {canRunStand(portfolio) ? 'Saturday stand' : 'Stand done for this week'}
              </div>
              <div className="font-body text-[11px] font-bold text-white/65">
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

        <CoachTour tour={MARKET_TOUR} run={tour && !comparing} onDone={() => onToured?.()} />

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
            <div className="mt-0.5 font-body text-[11px] font-bold text-white/70">
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
            onClick={() => {
              setComparing((on) => !on);
              setPicked([]);
            }}
            /* Raised twice. `py-0.5` made this a 25-pixel target at eleven
               pixels of type; `py-1.5` got it to 33. Compare is the verb this
               screen most wants a kid to reach for, so it now gets the full 44
               the guideline asks for, with the pill drawn exactly as before. */
            className={`inline-flex min-h-11 items-center rounded-full border-2 px-3 py-1.5 font-body text-[11px] font-extrabold ${
              comparing ? 'border-mint bg-mint/25 text-white' : 'border-white/40 text-white/70'
            }`}
          >
            ⚖️ Compare
          </button>
        </div>
        <div className="mb-1 px-1 font-body text-[10px] font-bold text-white/50">
          {comparing
            ? 'Pick two. Same idea as trying two prices on your stand.'
            : `Real weekly prices · figures from their own filings · data to ${SNAPSHOT_AS_OF}`}
        </div>

        {/* The collection, where the collecting happens. Opening a company's
            accounts fills a slot, and the only place that was visible was a tab
            in the trophy case — a long way from the moment it happens. */}
        {!comparing && (
          <div className="mb-1 flex items-center gap-2 rounded-xl border-[3px] border-white/20 bg-white/5 px-2.5 py-1.5">
            <span aria-hidden className="text-sm">
              📖
            </span>
            <span className="font-ledger text-xs font-bold tabular-nums text-lemon-light">
              {read.read}/{read.total}
            </span>
            <span className="flex-1 font-body text-[10px] font-extrabold leading-tight text-white/55">
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
                  <span className="font-body text-[10px] font-extrabold text-white/45">
                    🔒 {TIERS[tier].opensAt - badges} more ⭐ to unlock
                  </span>
                )}
              </div>

              {!openTier ? (
                <div className="mt-1 rounded-2xl border-[3px] border-dashed border-white/20 bg-white/5 px-3 py-2.5">
                  <p className="font-body text-[11px] font-bold text-white/55">
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
                      {...(inTier[0]?.ticker === c.ticker ? { 'data-coach': 'company-card' } : {})}
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
            <ChunkyButton variant="mint" full disabled={picked.length < 2} onClick={() => undefined}>
              {picked.length < 2 ? `Pick ${2 - picked.length} more` : 'Holding them up…'}
            </ChunkyButton>
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
  onBack,
}: {
  result: ReturnType<typeof faceoff>;
  onBack: () => void;
}) {
  const { a, b, rows, tradeOff } = result;
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
          {[a, b].map((c) => (
            <div key={c.ticker} className="rounded-2xl border-[3px] border-white/25 bg-white/10 p-2.5 text-center">
              <div aria-hidden className="text-2xl">
                {c.emoji}
              </div>
              <div className="font-body text-sm font-extrabold text-lemon-light">{c.name}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-2xl border-[3px] border-lemon/50 bg-lemon/10 px-3 py-2.5 font-body text-[13px] font-extrabold leading-snug text-white">
          {tradeOff}
        </p>

        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border-[3px] border-white/20 bg-white/90 px-3 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden>{row.emoji}</span>
                <span className="flex-1 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/50">
                  {row.label}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div
                  className={`rounded-lg px-2 py-1 text-center font-body text-[13px] font-extrabold ${
                    row.edge === 'a' ? 'bg-mint/25 text-ink' : 'text-ink/65'
                  }`}
                >
                  {row.a}
                </div>
                <div
                  className={`rounded-lg px-2 py-1 text-center font-body text-[13px] font-extrabold ${
                    row.edge === 'b' ? 'bg-mint/25 text-ink' : 'text-ink/65'
                  }`}
                >
                  {row.b}
                </div>
              </div>
              <p className="mt-1 font-body text-[11px] font-bold leading-snug text-ink/50">
                {row.meaning}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center font-body text-[11px] font-bold text-white/50">
          Green means <em>more</em>, which is not the same as better. Every one of these is a
          trade-off somebody is paying for.
        </p>
      </div>
    </Sky>
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
