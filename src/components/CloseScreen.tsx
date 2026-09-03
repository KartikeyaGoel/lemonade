'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ECON, type DayOutcome, type DayProjection, type Insight, weekSummary } from '@/lib/simulation';
import { closingLine, ledgerNoveltyOf, ledgerStartsOpen } from '@/lib/guide';
import { play } from '@/lib/sound';
import { PipSays } from './Pip';
import { ChunkyButton, SignHeading, Sky, money, useCountUp } from './ui';

/** Long enough for the headline to finish arriving before the till rings. */
const COUNT_SETTLE_MS = 760;

/**
 * End of day. The P&L is the reward for the day's work, so this is the one
 * screen in the game that is allowed to look precise and grown-up: real line
 * items, tabular figures, arithmetic the kid can redo on paper.
 *
 * Every number here is the kid's own. Nothing is illustrative.
 *
 * ## Why the statement folds, and what stops that being a downgrade
 *
 * A real middle schooler called this screen so much text that he stopped
 * reading it — and he is the only person who has played the game. A dozen rows
 * rendered twenty-one times were not twenty-one readings; they were three
 * readings and eighteen skips, so the exposure we thought we were buying was
 * already worth nothing by about day four.
 *
 * So from day four it folds, and Pip carries one line of it out front. The
 * obvious risk is that a good enough summary means the ledger is never opened
 * again, which would be worse than the wall — it swaps a fact the kid can
 * check for an adult telling him he did well. Three things prevent that, and
 * they live in `guide.ts`:
 *
 *  - Pip names a *line* of the statement and its real number, never the profit
 *    on its own, so the sentence is one number short and the missing number is
 *    in the ledger.
 *  - The line rotates with what actually decided the day, so across the arc a
 *    kid who only reads Pip still meets revenue, ingredients, the costs owed
 *    anyway, spoilage and capacity.
 *  - `ledgerStartsOpen` overrides the fold on any day carrying a row he has
 *    never seen. He can never miss a new line item; he only ever gets the
 *    folded version of a statement he has already read three times.
 */
export function CloseScreen({
  outcome,
  insights,
  planned,
  managerAvailable,
  onManagerRuns,
  nextUp,
  onNext,
}: {
  outcome: DayOutcome;
  insights: Insight[];
  /** What the planning screen told them before they opened, if they used it. */
  planned?: DayProjection | null;
  /** Act 2: a manager is on the payroll, so stepping away is a real option. */
  managerAvailable?: boolean;
  /** Hands tomorrow to the manager. This is what earns a hands-off day. */
  onManagerRuns?: () => void;
  /**
   * Three things worth trying next, once there is a day to compare them
   * against. Passed in rather than built here, because it needs the career
   * record and this screen only knows about today.
   */
  nextUp?: ReactNode;
  onNext: () => void;
}) {
  const summary = weekSummary(outcome.nextState.history);
  const isLastDay = outcome.nextState.status === 'finished';
  const madeMoney = outcome.profit > 0;

  /**
   * The headline counts up, then the till rings.
   *
   * This is the reward for the whole day, and it used to simply be on the
   * screen when the screen arrived. The count is capped at three quarters of a
   * second, so a good day feels bigger without taking longer to read.
   *
   * Only the headline moves. The profit and loss underneath is the thing a kid
   * is supposed to check on paper, and a ledger whose figures are still
   * settling is a ledger nobody trusts.
   */
  const counted = useCountUp(outcome.profit);

  /**
   * A day that is structurally new shows everything, whatever day number it is.
   * `novelty` is also worth naming on screen: "something new today" is the
   * honest reason the statement came back, and it is the same rule the rest of
   * the game follows — no concept before the wall that motivates it.
   */
  const history = outcome.nextState.history;
  const novelty = ledgerNoveltyOf(outcome, history);
  const [ledgerOpen, setLedgerOpen] = useState(() => ledgerStartsOpen(outcome, history));

  useEffect(() => {
    const timer = window.setTimeout(() => play(madeMoney ? 'cash' : 'sad'), COUNT_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [outcome.day, madeMoney]);

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-6">
        <div className="text-center">
          <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
            Day {outcome.day} results
          </div>
          <SignHeading className="mt-1 text-5xl">
            {madeMoney ? `You made ${money(counted)}` : `You lost ${money(Math.abs(counted))}`}
          </SignHeading>
        </div>

        {/* What happened, in one line, from the only character in the game.
            Observation with a number in it — never a suggestion for tomorrow.
            See the rule at the top of `guide.ts`. */}
        <PipSays className="mt-4" lines={[closingLine(outcome)]} point="up" />

        {/* The statement. Deliberately plain and exact. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/25 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-body text-xs font-extrabold uppercase tracking-[0.18em] text-ink/50">
              Profit and loss
            </span>
            <span className="font-body text-xs font-bold text-ink/40">
              {outcome.cupsSold} of {outcome.cupsMakeable} cups sold
            </span>
          </div>

          {novelty && ledgerOpen && (
            <p className="mb-2 rounded-xl border-2 border-mint/60 bg-mint/15 px-2.5 py-1 font-body text-[11px] font-extrabold text-ink/75">
              Something new today: {novelty}.
            </p>
          )}

          {!ledgerOpen && (
            <button
              type="button"
              onClick={() => setLedgerOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border-2 border-ink/15 bg-ink/[0.04] px-3 py-2 font-body text-xs font-extrabold uppercase tracking-widest text-ink/60"
            >
              <span>See every number</span>
              <span aria-hidden>+</span>
            </button>
          )}

          {ledgerOpen && (
          <>

          {/* With a round running there are two prices in the day, so revenue
              is shown as the two lines that add up to it. One number covering
              both would not reconcile by hand. */}
          {outcome.subscriberCups > 0 ? (
            <>
              <Line
                label="Regulars"
                detail={`${outcome.subscriberCups} cups × ${money(outcome.subscriberPrice)} — they came whatever the weather`}
                amount={outcome.subscriberRevenue}
              />
              <Line
                label="Walk-ups"
                detail={`${outcome.cupsSold - outcome.subscriberCups} cups × ${money(outcome.price)}`}
                amount={outcome.walkupRevenue}
              />
              <Subtotal label="Revenue" amount={outcome.revenue} />
            </>
          ) : (
            <Line
              label="Revenue"
              detail={`${outcome.cupsSold} cups × ${money(outcome.price)}`}
              amount={outcome.revenue}
            />
          )}
          {/* The breakdown reads as three icons rather than a sentence with two
              plus signs in it. Same three numbers, a third of the words. */}
          <Line
            label="Ingredients"
            detail={outcome.cupsSold > 0 ? null : 'nothing poured'}
            amount={-outcome.ingredients.total}
          />
          {outcome.cupsSold > 0 && (
            <div className="-mt-0.5 mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-[11px] font-bold text-ink/45">
              <span>
                🍋 {outcome.ingredients.lemonsUsed} · {money(outcome.ingredients.lemons)}
              </span>
              <span>🥄 {money(outcome.ingredients.sugar)}</span>
              <span>🥤 {money(outcome.ingredients.cups)}</span>
              <span className="text-ink/35">≈ {money(outcome.ingredients.perCup)} a cup</span>
            </div>
          )}

          <Subtotal label="Gross profit" amount={outcome.grossProfit} />

          {/* Fixed costs, itemised. Act 1 has one line; later acts have rent
              and wages, and the kid needs to see which is which. */}
          {outcome.fixedCostLines.map((line, i) => (
            <Line
              key={line.label}
              label={line.label}
              detail={i === 0 ? 'owed whether or not anyone buys' : 'every single day'}
              amount={-line.amount}
            />
          ))}
          {outcome.spoiledLemons > 0 && (
            <Line
              label="Spoiled lemons"
              detail={`${outcome.spoiledLemons} × ${money(ECON.LEMON_COST)}`}
              amount={-outcome.spoilageCost}
            />
          )}

          {outcome.investorCut > 0 && (
            <>
              <Subtotal label="Profit before your investor" amount={outcome.profitBeforeEquity} />
              <Line
                label="Your investor's 20%"
                detail="the slice you sold, collected"
                amount={-outcome.investorCut}
              />
            </>
          )}

          <div className="mt-2 border-t-[3px] border-ink/70 pt-2">
            <div className="ledger-row text-lg font-extrabold">
              <span>Profit</span>
              <span className={outcome.profit < 0 ? 'text-berry' : 'text-mint'}>
                {money(outcome.profit)}
              </span>
            </div>
          </div>

          {/* Cash reconciliation: profit and cash are not the same thing, and
              pretending otherwise would be the first lie we ever told. */}
          <div className="mt-3 rounded-xl bg-ink/5 p-3">
            <div className="ledger-row text-[13px] text-ink/70">
              <span>Cash</span>
              <span>
                {money(outcome.cashBefore)} → {money(outcome.cashAfter)}
              </span>
            </div>
            {outcome.cashFloored && (
              <p className="mt-1 font-body text-[11px] font-extrabold text-wood-deep">
                Your original {money(ECON.STARTING_CASH)} is protected. You can never go below it.
              </p>
            )}
            {(outcome.nextState.lemonLots.length > 0 ||
              outcome.nextState.sugarServings > 0 ||
              outcome.nextState.cupsInStock > 0) && (
              <p className="mt-1 font-body text-[11px] font-bold text-ink/55">
                Still in the pantry for tomorrow:{' '}
                {outcome.nextState.lemonLots.reduce((s, l) => s + l.lemons, 0)} lemons,{' '}
                {outcome.nextState.sugarServings} sugar, {outcome.nextState.cupsInStock} cups.
              </p>
            )}
          </div>
          </>
          )}
        </div>

        {/* Plan against reality. This is what closes the feedback loop: they
            set two dials, were shown three scenarios, and now find out which
            one the street actually chose. */}
        {planned && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white p-3.5 shadow-lg">
            <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
              What you planned vs what happened
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Compare
                label="Cups made"
                planned={`${planned.cupsMakeable}`}
                actual={`${outcome.cupsSold} sold`}
              />
              <Compare
                label="If all sold"
                planned={money(planned.bestCase.profit)}
                actual={money(outcome.profit)}
                good={outcome.profit >= planned.halfCase.profit}
              />
            </div>
            <p className="mt-2 font-body text-[12px] font-bold text-ink/60">
              {describeGap(outcome, planned)}
            </p>
          </div>
        )}

        {/* What the day taught, named only now that it has been felt.
            One sentence is visible. The "why it will matter later" half is real
            and worth keeping, but it is the second paragraph of italic text on a
            screen a twelve-year-old is already scrolling past, so it waits
            behind a tap. Curiosity opens it; nobody is made to read it. */}
        {insights.length > 0 && (
          <div className="mt-4 space-y-3">
            {insights.map((insight, i) => (
              <div
                key={insight.id}
                className="rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4 animate-popIn"
                style={{ animationDelay: `${i * 110}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg">
                    💡
                  </span>
                  <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
                    New word
                  </span>
                </div>
                <div className="mt-1 font-sign text-2xl leading-none text-ink">{insight.term}</div>
                <p className="mt-1.5 font-body text-sm font-bold text-ink/80">{insight.evidence}</p>
                <details className="group mt-2">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border-2 border-wood-dark/40 px-2 py-0.5 font-body text-[11px] font-extrabold text-wood-deep">
                    Why this matters
                    <span aria-hidden className="transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <p className="mt-1.5 font-body text-[13px] font-semibold italic text-ink/60">
                    {insight.carriesForward}
                  </p>
                </details>
              </div>
            ))}
          </div>
        )}

        {summary.days >= 3 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="stat-chip">Best day {money(summary.bestDay?.profit ?? 0)}</span>
            <span className="stat-chip">{summary.days}-day average {money(summary.averageProfit)}</span>
          </div>
        )}

        {nextUp}

        <div className="mt-6">
          <ChunkyButton variant="lemon" full onClick={onNext}>
            {isLastDay ? 'See your week →' : `Start day ${outcome.nextState.day} →`}
          </ChunkyButton>

          {/*
            * Stepping away, which is the whole point of Act 2's last stretch.
            *
            * This was a sentence — "Your manager can run tomorrow without you"
            * — and nothing else. The function that does it existed, the counter
            * it feeds existed, and the goal strip told the kid to go and earn
            * three manager-run days. There was no button anywhere in the game
            * that ran one. So the stated goal was unreachable, the badge for it
            * was unreachable, and an attentive kid was left looking for a
            * control that did not exist.
            *
            * It is deliberately the quieter of the two: handing the stand over
            * is a real decision with a real cost, not the default.
            */}
          {managerAvailable && onManagerRuns && !isLastDay && (
            <>
              <ChunkyButton variant="ghost" full onClick={onManagerRuns} className="mt-2 !text-lg">
                Let your manager run it →
              </ChunkyButton>
              <p className="mt-1.5 text-center font-body text-[11px] font-bold text-ink/50">
                You still get paid. Their wage is owed either way.
              </p>
            </>
          )}
        </div>
      </div>
    </Sky>
  );
}

function Line({
  label,
  detail,
  amount,
}: {
  label: string;
  detail: string | null;
  amount: number;
}) {
  return (
    <div className="py-1">
      <div className="ledger-row">
        <span className="font-body font-extrabold">{label}</span>
        <span className={amount < 0 ? 'text-ink/80' : ''}>{money(amount)}</span>
      </div>
      {detail && <div className="font-body text-[11px] font-bold text-ink/40">{detail}</div>}
    </div>
  );
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="my-1 border-t-2 border-dashed border-ink/25 pt-1">
      <div className="ledger-row font-extrabold text-ink/80">
        <span>{label}</span>
        <span>{money(amount)}</span>
      </div>
    </div>
  );
}


function Compare({
  label,
  planned,
  actual,
  good,
}: {
  label: string;
  planned: string;
  actual: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-ink/12 bg-white/70 px-2.5 py-2">
      <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
        {label}
      </div>
      <div className="font-ledger text-[12px] tabular-nums text-ink/50">planned {planned}</div>
      <div
        className={`font-ledger text-[14px] font-bold tabular-nums ${
          good === false ? 'text-berry' : 'text-ink'
        }`}
      >
        {actual}
      </div>
    </div>
  );
}

/**
 * One sentence on why the day landed where it did. Names the cause, never the
 * fix — the kid works out the fix themselves on the next day's dials.
 */
function describeGap(outcome: DayOutcome, planned: DayProjection): string {
  const unsold = outcome.cupsMakeable - outcome.cupsSold;

  if (outcome.turnedAwaySoldOut > 0) {
    return `You sold every cup and ${outcome.turnedAwaySoldOut} more people still wanted one. You could have made more.`;
  }
  if (unsold > 0 && outcome.walkedAwayOnPrice > outcome.cupsSold) {
    return `${unsold} cups went unsold and most people walked past without stopping. More people said no than yes.`;
  }
  if (unsold > 0) {
    return `You made ${outcome.cupsMakeable} cups and sold ${outcome.cupsSold}. The ${unsold} you did not sell were already paid for.`;
  }
  if (outcome.cupsSold === planned.cupsMakeable) {
    return 'Everything you made, you sold. Exactly the good case.';
  }
  return `You sold ${outcome.cupsSold} cups today.`;
}
