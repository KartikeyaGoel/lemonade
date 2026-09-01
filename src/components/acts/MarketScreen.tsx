'use client';

import { useState } from 'react';
import {
  FUNDAMENTALS_SOURCE,
  MODELS,
  SNAPSHOT,
  SNAPSHOT_AS_OF,
  formatMillions,
  metricsFor,
  standComparison,
  type Company,
} from '@/lib/companies';
import {
  MAX_POSITION_FRACTION,
  MARKET_WEEKS,
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
import type { Readiness } from '@/lib/progress';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * Act 4. Other people's lemonade stands.
 *
 * Every company is described with the same four numbers the kid used on their
 * own stand — what it sells, what it keeps, what slice that is, and how many
 * years of profit the market is asking for. Nothing here is a recommendation.
 */
export function MarketScreen({
  portfolio,
  readiness,
  knowsPE,
  onResearch,
  onStartBuy,
  onSell,
  onAdvanceWeek,
  onOpenGate,
  onClub,
}: {
  portfolio: PortfolioState;
  readiness: Readiness;
  /** True once the kid has been handed the words "P/E ratio" in Act 3. */
  knowsPE: boolean;
  onResearch: (ticker: string) => void;
  onStartBuy: (company: Company) => void;
  onSell: (ticker: string, fraction: number) => void;
  onAdvanceWeek: () => void;
  onOpenGate: () => void;
  /** Only passed once a club is a thing that exists for this kid. */
  onClub?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const company = open ? SNAPSHOT.find((c) => c.ticker === open) ?? null : null;

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
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-28 pt-5">
        <div className="flex items-baseline justify-between">
          <SignHeading className="!text-lemon-light text-3xl">The market</SignHeading>
          {/* Weeks *elapsed*, not a week number. The counter starts at zero
              because no time has passed yet, and "Week 0 / 12" read like a
              bug. */}
          <span className="stat-chip !text-xs">
            {portfolio.week} of {MARKET_WEEKS} weeks done
          </span>
        </div>

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

        {!readiness.canTrade && (
          <button
            type="button"
            onClick={onOpenGate}
            className="mt-3 w-full rounded-2xl border-[3px] border-dashed border-lemon/60 bg-lemon/10 p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden>🔒</span>
              <span className="font-body text-sm font-extrabold text-lemon-light">
                Research is open. Buying is not, yet.
              </span>
            </div>
            <div className="mt-0.5 font-body text-[11px] font-bold text-white/70">
              {readiness.metCount} of {readiness.criteria.length} things shown. Tap to see what is left.
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

        <div className="mt-5 px-1 font-sign text-xl text-lemon-light">Businesses you could own</div>
        <div className="mb-1 px-1 font-body text-[10px] font-bold text-white/50">
          Real weekly prices · figures from their own filings · data to {SNAPSHOT_AS_OF}
        </div>

        {SNAPSHOT.map((c) => {
          const price = currentPrice(portfolio, c.ticker);
          const m = metricsFor(c, price, asOf);
          return (
            <button
              key={c.ticker}
              type="button"
              onClick={() => {
                onResearch(c.ticker);
                setOpen(c.ticker);
              }}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border-[3px] border-white/20 bg-white/85 px-3 py-2.5 text-left"
            >
              <span aria-hidden className="text-2xl">
                {c.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-body text-sm font-extrabold text-ink">
                  {c.name}{' '}
                  <span className="font-ledger text-[11px] text-ink/40">{c.ticker}</span>
                </div>
                <div className="font-body text-[11px] font-bold text-ink/55">{c.whatTheySell}</div>
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
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/60 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="lemon" full onClick={onAdvanceWeek}>
            {portfolio.week >= MARKET_WEEKS ? 'See how you did →' : 'Next week →'}
          </ChunkyButton>
        </div>
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
  // week. Act 4 replays real history, so mixing this week's price with a filing
  // from two years later would produce a P/E nobody ever quoted.
  const m = metricsFor(company, price, asOf);
  const allowed = maxSpendOn(portfolio, company.ticker);
  const holding = portfolio.holdings[company.ticker];
  const gain = holding ? holdingGain(portfolio, company.ticker) : null;

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-28 pt-5">
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
            {/* The word, once they have earned it in Act 3. Same number,
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
            Sells, keeps and share count from {FUNDAMENTALS_SOURCE}. Prices are real weekly
            closes. Nothing on this card was rounded for the lesson.
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
