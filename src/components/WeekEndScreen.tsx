'use client';

import { ECON, closingTakeaway, type GameState, weekSummary } from '@/lib/simulation';
import { ChunkyButton, SignHeading, Sky, money } from './ui';

/**
 * End of the week. The kid gets to see their own learning curve plotted:
 * every price they tried against what it earned. This is their real data,
 * seven points, no smoothing and no invention.
 *
 * Then a locked door, so they know there is more.
 */
export function WeekEndScreen({
  state,
  onReplay,
  onContinue,
  onChallenge,
  challengeResult,
}: {
  state: GameState;
  onReplay: () => void;
  onContinue?: () => void;
  /** Only passed once a whole week exists to send somebody. */
  onChallenge?: () => void;
  /** When this run *was* a challenge, the comparison is the point of the screen. */
  challengeResult?: boolean;
}) {
  const summary = weekSummary(state.history);
  // A duel is one day, and a screen that says "seven days" after one of them
  // is the kind of small lie that makes a kid stop trusting the numbers.
  const short = summary.days < ECON.TOTAL_DAYS;

  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div className="font-sign text-6xl leading-none text-wood-deep">
            {short ? 'That was your day.' : 'You figured out pricing.'}
          </div>
          <p className="mt-3 font-body text-base font-extrabold text-ink/70">
            {summary.days} {summary.days === 1 ? 'day' : 'days'}. {money(summary.totalProfit)} of
            profit.{' '}
            {summary.days > 1 ? 'Here is every price you tried.' : 'Here is what you charged.'}
          </p>
        </div>

        <PriceProfitChart state={state} />

        {/* Evidence, drawn from decisions rather than a score. */}
        <div className="mt-5 space-y-2">
          <Evidence
            label="Your best day"
            value={`${money(summary.bestDay?.price ?? 0)} a cup → ${money(summary.bestDay?.profit ?? 0)}`}
          />
          <Evidence label="Average day" value={money(summary.averageProfit)} />
          <Evidence label="Profitable days" value={`${summary.profitableDays} of ${summary.days}`} />
          {summary.foundOptimalBand && (
            <Evidence
              label="Found the best price band"
              value={`on day ${summary.daysToOptimalBand}`}
              highlight
            />
          )}
        </div>

        <div className="mt-5 rounded-2xl border-[3px] border-ink/20 bg-white/85 p-4">
          <p className="font-body text-sm font-bold text-ink/80">{closingTakeaway(state.history)}</p>
        </div>

        {/* The door. Now it opens. */}
        <div className="mt-5 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-5 text-center">
          <div aria-hidden className="text-4xl">
            🧊
          </div>
          <div className="mt-1 font-sign text-3xl text-ink">Act 2: Scale</div>
          <p className="mt-1 font-body text-sm font-bold text-ink/65">
            A cooler. A better spot. Someone else behind the counter.
          </p>
        </div>

        {/* A week is the smallest thing worth sending somebody, which is why
            this is the first moment a challenge is offered. */}
        {onChallenge && (
          <button
            type="button"
            onClick={onChallenge}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border-[3px] border-wood-dark bg-white/85 p-4 text-left"
          >
            <span aria-hidden className="text-3xl">
              ⚔️
            </span>
            <div>
              <div className="font-sign text-xl text-ink">
                {challengeResult ? 'See how you did against them' : 'Send this exact week to a friend'}
              </div>
              <div className="mt-0.5 font-body text-[12px] font-bold text-ink/60">
                {challengeResult
                  ? 'Paste their score and find out where the gap came from.'
                  : 'Same weather, same forecasts, same rival. The only difference is what you each decided.'}
              </div>
            </div>
          </button>
        )}

        <div className="mt-6 space-y-2.5">
          {onContinue && (
            <ChunkyButton variant="mint" full onClick={onContinue}>
              Keep going →
            </ChunkyButton>
          )}
          <ChunkyButton variant="ghost" full onClick={onReplay} className="!text-lg">
            Start over
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function Evidence({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border-2 px-4 py-2.5 ${
        highlight ? 'border-mint bg-mint/20' : 'border-ink/15 bg-white/80'
      }`}
    >
      <span className="font-body text-sm font-extrabold text-ink/70">{label}</span>
      <span className="font-ledger text-sm font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/**
 * Price on the x axis, profit on the y, one dot per day, joined in the order
 * they were played so the kid can literally see themselves hill-climbing.
 */
function PriceProfitChart({ state }: { state: GameState }) {
  const history = state.history;
  const width = 320;
  const height = 200;
  const pad = { left: 38, right: 12, top: 14, bottom: 30 };

  const maxProfit = Math.max(10, ...history.map((h) => h.profit));
  const minProfit = Math.min(0, ...history.map((h) => h.profit));
  const maxPrice = Math.max(2, ...history.map((h) => h.price));

  const x = (price: number) =>
    pad.left + (price / maxPrice) * (width - pad.left - pad.right);
  const y = (profit: number) =>
    height -
    pad.bottom -
    ((profit - minProfit) / (maxProfit - minProfit || 1)) * (height - pad.top - pad.bottom);

  const best = history.reduce((a, h) => (h.profit > a.profit ? h : a), history[0]);
  const zeroY = y(0);

  return (
    <div className="mt-6 rounded-2xl border-[3px] border-ink/20 bg-white/92 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
          Profit vs price
        </span>
        <span className="font-body text-[11px] font-bold text-ink/40">your 7 days</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Your profit at each price you tried">
        {/* Break-even line */}
        <line x1={pad.left} x2={width - pad.right} y1={zeroY} y2={zeroY} stroke="#2B2118" strokeOpacity="0.25" strokeDasharray="4 4" />
        <text x={pad.left - 6} y={zeroY + 4} textAnchor="end" fontSize="9" fill="#2B2118" fillOpacity="0.5">
          $0
        </text>
        <text x={pad.left - 6} y={y(maxProfit) + 4} textAnchor="end" fontSize="9" fill="#2B2118" fillOpacity="0.5">
          {`$${maxProfit.toFixed(0)}`}
        </text>

        {/* Axis labels */}
        <text x={pad.left} y={height - 8} fontSize="9" fill="#2B2118" fillOpacity="0.5">
          $0
        </text>
        <text x={width - pad.right} y={height - 8} textAnchor="end" fontSize="9" fill="#2B2118" fillOpacity="0.5">
          {`$${maxPrice.toFixed(2)}`}
        </text>

        {/* The path through their days, in the order played */}
        <polyline
          points={history.map((h) => `${x(h.price)},${y(h.profit)}`).join(' ')}
          fill="none"
          stroke="#C97B3C"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeOpacity="0.55"
        />

        {history.map((h) => {
          const isBest = h.day === best?.day;
          return (
            <g key={h.day}>
              <circle
                cx={x(h.price)}
                cy={y(h.profit)}
                r={isBest ? 8 : 5.5}
                fill={isBest ? '#2ED9A0' : h.profit < 0 ? '#FF5470' : '#FFC61A'}
                stroke="#2B2118"
                strokeWidth="2"
              />
              <text
                x={x(h.price)}
                y={y(h.profit) - (isBest ? 13 : 10)}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#2B2118"
                fillOpacity="0.7"
              >
                {h.day}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 text-center font-body text-[11px] font-bold text-ink/45">
        Numbers are the day you played it. Green is your best.
      </div>
    </div>
  );
}
