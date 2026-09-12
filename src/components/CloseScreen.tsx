'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ECON, type DayOutcome, type DayProjection, type Insight, weekSummary } from '@/lib/simulation';
import { sellingPoints, splitCups, type BusinessState } from '@/lib/business';
import { closingLine, ledgerNoveltyOf, ledgerStartsOpen } from '@/lib/guide';
import { middayResult } from '@/lib/midday';
import { diagnose, wordOfMouth, type Cause } from '@/lib/diagnose';
import type { Stop } from '@/lib/journey';
import { play } from '@/lib/sound';
import { PipSays } from './Pip';
import { ChunkyButton, SignHeading, Sky, money, plural, useCountUp } from './ui';

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
  business,
  managerAvailable,
  onManagerRuns,
  comparable = true,
  nextUp,
  whatsNext,
  onNext,
}: {
  outcome: DayOutcome;
  insights: Insight[];
  /**
   * The business, once there is more than one counter in it.
   *
   * Only used to split the day's cups across the places that poured them, so
   * it is optional: Act 1 and the Saturday stand are one table and have nothing
   * to split.
   */
  business?: BusinessState;
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
  /**
   * Is today comparable to yesterday at all?
   *
   * False on the two kinds of day where "what made today different" is a
   * question about nothing:
   *
   *  - **A manager-run day.** The manager picked the price and the batch, so
   *    asking a child to attribute a change they did not make is worse than
   *    silence — and the whole point of the day is that they stepped away.
   *  - **The Saturday stand out of the market.** It is a folding table again,
   *    and yesterday is the *shop they sold forty days ago*. Found by probing
   *    the path: a real child would have been told "you made 84 cups yesterday
   *    and 24 today — 60 fewer to sell", which is true, meaningless, and
   *    attributed to a decision nobody made.
   *
   * Defaults true because most days are ordinary ones and every test that
   * renders this screen predates the question.
   */
  comparable?: boolean;
  nextUp?: ReactNode;
  /**
   * Where they are, and the padlock in front of them.
   *
   * This is the screen on which a child decides whether to play another day,
   * and until now it was the only screen in the run that said nothing about
   * the run. The pilot's wording was *"I couldn't even tell how long I have to
   * keep going to exit this level"*, and the goal strip — which does say —
   * lives on the *planning* screen, one tap the other side of this decision.
   *
   * `stop` is the visible locked thing `journey.ts` argues for, moved from the
   * title screen to a screen a child is actually looking at. It is also the
   * answer to money being a score with no sink: the cash is for something, and
   * this is where that something is named. See PRODUCT.md §70 for why it is
   * this rather than a shop in stage one.
   */
  whatsNext?: {
    goal?: string;
    stop: Stop | null;
    /**
     * What the money piling up is actually for.
     *
     * Only sent in the first stage, and it is the last piece of §68's cause B.
     * Cash goes from $20 to about $195 across Stage 1 — measured — and changes
     * nothing a child can do, which makes it a score. It carries into Stage 2
     * untouched and buys the first thing in the yard, and until now the game
     * never said so. Naming it turns the pile into something they are saving
     * for without putting a shop in a stage the specification deliberately
     * keeps free of one.
     */
    buys?: { name: string; cost: number; cash: number };
  };
  onNext: () => void;
}) {
  const sites = business ? sellingPoints(business) : [];
  const split = business ? splitCups(business, outcome.cupsSold) : [];
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
  /*
   * What the pantry did to the cash box, in money.
   *
   * Everything the P&L charged today that was *not* paid for today, less
   * whatever was paid for today and not used. Three terms, and all three
   * matter:
   *
   *  - `ingredients.total` — what today's cups drank
   *  - `spoilageCost` — what went in the bin, bought on some earlier day
   *  - `purchases.cost.total` — what actually left the cash box this morning
   *
   * The first version of this line had only two of them, and so it closed the
   * cash box on every day except one with spoiled lemons — where it was short
   * by exactly the value of the fruit thrown away. Nothing noticed: the case
   * is uncommon, the figure is small, and it looks like rounding. A fuzz over
   * three thousand randomised days found it on the eighth.
   *
   * Derived here rather than plumbed through the simulation because the
   * simulation already reports all three halves, and `tests/fuzz.test.ts`
   * holds the identity this arithmetic is claiming.
   */
  const pantryShift =
    Math.round(
      (outcome.ingredients.total + outcome.spoilageCost - outcome.purchases.cost.total) * 100,
    ) / 100;
  const [ledgerOpen, setLedgerOpen] = useState(() => ledgerStartsOpen(outcome, history));

  /**
   * Did they move the sign at lunchtime?
   *
   * Read from the outcome rather than passed in, because the close screen is
   * the one place in the game that has to reconcile every figure a day
   * produced and it should not need telling what happened in it.
   */
  const changedAtLunch = outcome.afternoonPrice !== outcome.price;
  const lunchLine = middayResult(outcome);

  /**
   * The day before this one, which is what the question compares against.
   *
   * `outcome.nextState.history` has today appended, so yesterday is the
   * second-to-last entry. Sliced rather than indexed because `diagnose` and
   * `wordOfMouth` both want the history *as it was before today* — the same
   * thing `deriveInsights` is handed.
   */
  const before = history.slice(0, -1);
  const question = comparable ? diagnose(outcome, before) : null;
  const mouth = wordOfMouth(outcome, before);
  const [answered, setAnswered] = useState<Cause | null>(null);

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
            See the rule at the top of `guide.ts`.

            The lunchtime change goes in the same bubble when there was one,
            because it is the only decision the child made *during* the day and
            reading its consequence next to the profit is the whole reason the
            decision was worth offering. */}
        <PipSays
          className="mt-4"
          lines={lunchLine ? [lunchLine, closingLine(outcome)] : [closingLine(outcome)]}
          point="up"
        />

        {/*
          One question, where the eye already is.

          Directly under the money and above the ledger, because the pilot is
          exact about the order a child reads this screen in: *"they all looked
          at how much money and immediately went to day 2."* A question below
          the statement would be read by nobody.

          Deliberately **not recorded**. It would be easy to feed this into the
          grown-up report, and §16's rule is that a claim about a child has to
          rest on something they did with their own money at stake and nobody
          asking them to. Tapping the right box in a four-way question is not
          that. The value here is the retrieval, not the score.

          See `src/lib/diagnose.ts` — silent on day one, and on any pair of days
          that were really the same day.
        */}
        {question && (
          <div className="mt-4 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
                Yesterday vs today
              </span>
              {/*
                The comparison they asked for, unprompted: "Most kids asked
                laksh how much money he made in day 1 and day 2 — so a compare
                option might be great."
              */}
              <span className="font-ledger text-[13px] font-bold tabular-nums text-ink/80">
                {money(question.yesterdayProfit)} → {money(question.todayProfit)}
              </span>
            </div>

            {answered === null ? (
              <>
                <p className="mt-1 font-body text-sm font-extrabold leading-snug text-ink">
                  What made today different?
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {question.answers.map((answer) => (
                    <button
                      key={answer.cause}
                      type="button"
                      onClick={() => setAnswered(answer.cause)}
                      className="min-h-11 rounded-xl border-[3px] border-wood-dark/40 bg-white/80 px-3 py-2 text-left font-body text-[13px] font-extrabold text-ink active:translate-y-[1px]"
                    >
                      {answer.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="animate-popIn">
                <p className="mt-1 font-body text-sm font-extrabold leading-snug text-ink">
                  {answered === question.cause
                    ? 'That was the biggest change.'
                    : question.correction}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/80">
                  {question.because}
                </p>
                {/*
                  The recipe's own effect, said whether or not it was the
                  biggest change — because the pilot wanted it *legible*, not
                  quizzed, and it almost never wins the question. See
                  `wordOfMouth`.
                */}
                {mouth && (
                  <p className="mt-1.5 font-body text-[12px] font-bold leading-snug text-wood-deep">
                    {mouth}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* The statement. Deliberately plain and exact. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/25 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-body text-xs font-extrabold uppercase tracking-[0.18em] text-ink/50">
              Profit and loss
            </span>
            <span className="font-body text-xs font-bold text-ink/40">
              {outcome.cupsSold} of {plural(outcome.cupsAvailable, 'cup')} sold
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
              className="flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-ink/15 bg-ink/[0.04] px-3 py-2 font-body text-xs font-extrabold uppercase tracking-widest text-ink/60"
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
          {/*
            Revenue, as however many lines it takes to reconcile.

            Up to three prices can be charged in one day — the standing price a
            regular prepaid, the morning sign, and the afternoon sign if the
            child moved it at lunchtime. §4's rule is that any two figures shown
            together add up, and `cups × price` for a single price does not add
            up to the takings on a day with two of them. So each price gets its
            own row and the subtotal is the sum, which is a child's own
            arithmetic either way.
          */}
          {outcome.subscriberCups > 0 || changedAtLunch ? (
            <>
              {outcome.subscriberCups > 0 && (
                <Line
                  label="Regulars"
                  detail={`${plural(outcome.subscriberCups, 'cup')} × ${money(outcome.subscriberPrice)} — they came whatever the weather`}
                  amount={outcome.subscriberRevenue}
                />
              )}
              {changedAtLunch ? (
                <>
                  <Line
                    label="Morning"
                    detail={`${plural(outcome.morningCups, 'cup')} × ${money(outcome.price)}`}
                    amount={outcome.morningRevenue}
                  />
                  <Line
                    label="Afternoon"
                    detail={`${plural(outcome.afternoonCups, 'cup')} × ${money(outcome.afternoonPrice)} — after you changed the sign`}
                    amount={outcome.afternoonRevenue}
                  />
                </>
              ) : (
                <Line
                  label="Walk-ups"
                  detail={`${plural(outcome.cupsSold - outcome.subscriberCups, 'cup')} × ${money(outcome.price)}`}
                  amount={outcome.walkupRevenue}
                />
              )}
              <Subtotal label="Revenue" amount={outcome.revenue} />
            </>
          ) : (
            <Line
              label="Revenue"
              detail={`${plural(outcome.cupsSold, 'cup')} × ${money(outcome.price)}`}
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
              <span>🍯 {money(outcome.ingredients.honey)}</span>
              <span>🥤 {money(outcome.ingredients.cups)}</span>
              <span className="text-ink/35">≈ {money(outcome.ingredients.perCup)} a cup</span>
            </div>
          )}

          {/*
            Cups bought ready-made at lunchtime.
            
            Its own line because it is neither the ingredients — which are what
            the morning's shopping poured — nor the rent. A ready-made cup
            consumed nothing from the pantry, so folding it into ingredients
            would break the `≈ a cup` figure beside it; leaving it out entirely
            would leave the gross profit failing to reconcile by exactly this
            amount. §4.
          */}
          {outcome.afternoonTopUp > 0 && (
            <Line
              label="Cups bought at lunchtime"
              detail={`${plural(outcome.afternoonTopUp, 'cup')} × ${money(
                outcome.topUpCost / outcome.afternoonTopUp,
              )} — ready made, so dearer than the morning's`}
              amount={-outcome.topUpCost}
            />
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

          {/*
            Where the cups actually went, once there is more than one counter.

            The framework this stage was built from asks for exactly this beat:
            *"both stands' takings on one screen the next day, and the first
            one's crowd is visibly thinner"*. Without it, opening a second stand
            on a pitch you already work looks identical to opening one somewhere
            new — and half a crowd for a whole pitch fee is the one mistake in
            the stage a kid can make without ever being told.

            Attribution, not simulation: the day is run once for the whole
            business and divided by the crowd each place brought, capped by what
            each could pour. The parts sum to the whole exactly.
          */}
          {sites.length > 1 && (
            <div className="mt-3 rounded-xl border-[3px] border-ink/12 bg-white px-3 py-2">
              <div className="mb-1 font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Where it sold
              </div>
              {sites.map((site, i) => (
                <div key={site.id} className="ledger-row text-[13px]">
                  <span className="text-ink/65">
                    <span aria-hidden>{site.emoji}</span> {site.name}
                    {site.capacity > 0 && split[i] >= site.capacity && (
                      <span className="text-berry"> · full</span>
                    )}
                  </span>
                  <span>
                    {split[i]} {split[i] === 1 ? 'cup' : 'cups'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Cash reconciliation: profit and cash are not the same thing, and
              pretending otherwise would be the first lie we ever told. */}
          <div className="mt-3 rounded-xl bg-ink/5 p-3">
            {/*
              The pantry, in money.

              This is the last unnamed number on the screen a child is told
              they can check by hand. Profit charges the lemons *used*; cash
              pays for the lemons *bought*, and those are different on any day
              the pantry is not empty at both ends. Found by playing: a $10.02
              loss took the cash box from $250.00 to $240.90, and the ninety
              two cents in between were a lot of honey bought the day before.
              Pennies on a one-table business; not pennies with three pitches
              and a shop.

              So it gets a name and a sign. Add it to the profit above and the
              two cash figures below close exactly — which is the whole promise
              of §4, and the reason cash-is-not-profit is worth teaching here
              rather than asserting.
            */}
            {Math.abs(pantryShift) >= 0.01 && (
              <>
                {/* Short label, long reason underneath — the same grammar as
                    every other line in this ledger, and the only shape that
                    survives a 320-pixel phone. Spelled out on one line it
                    wrapped, and the figure stayed up with the first half of
                    its own label. */}
                <div className="ledger-row text-[13px] text-ink/70">
                  <span>{pantryShift > 0 ? 'From the pantry' : 'Into the pantry'}</span>
                  <span>
                    {pantryShift > 0 ? '+' : '-'}
                    {money(Math.abs(pantryShift))}
                  </span>
                </div>
                <p className="mb-1 font-body text-[11px] font-bold leading-snug text-ink/50">
                  {pantryShift > 0
                    ? 'Some of what you used today was bought on an earlier day.'
                    : 'You bought more than today\u2019s cups used. The rest keeps.'}
                </p>
              </>
            )}
            {/*
              The top-up is its own row, and it has to be.
              The floor is a retention rule, but it creates money, and while it
              was hidden behind a sentence the two figures on this line did not
              reconcile with the profit above them: a $52.86 loss took the cash
              box from $66.80 to $20.00 and the arithmetic did not close. On a
              one-table business the gap was pennies. With a rent and a loan it
              was most of the day. This is the one screen a kid is meant to
              check by hand, so the gap gets a name and a number.
            */}
            {outcome.cashFloored && (
              <>
                <div className="ledger-row text-[13px] text-ink/70">
                  <span>Cash after the day</span>
                  {/* The real figure before the floor caught it. Not
                      `cashBefore + profit`: cash and profit are deliberately
                      different stories here — cash pays for every lemon bought,
                      profit counts only the ones sold. */}
                  <span>{money(outcome.cashAfter - outcome.cashTopUp)}</span>
                </div>
                <div className="ledger-row text-[13px] text-wood-deep">
                  <span>Topped up so you can open tomorrow</span>
                  <span>+{money(outcome.cashTopUp)}</span>
                </div>
              </>
            )}
            <div className="ledger-row text-[13px] text-ink/70">
              <span>Cash</span>
              <span>
                {money(outcome.cashBefore)} → {money(outcome.cashAfter)}
              </span>
            </div>
            {outcome.cashFloored && (
              <p className="mt-1 font-body text-[11px] font-extrabold text-wood-deep">
                You never go below {money(ECON.STARTING_CASH)}, so there is always a tomorrow. It
                is not free money — it is the game keeping you open.
              </p>
            )}
            {(outcome.nextState.lemonLots.length > 0 ||
              outcome.nextState.honeyServings > 0 ||
              outcome.nextState.cupsInStock > 0) && (
              <p className="mt-1 font-body text-[11px] font-bold text-ink/55">
                Still in the pantry for tomorrow:{' '}
                {plural(outcome.nextState.lemonLots.reduce((s, l) => s + l.lemons, 0), 'lemon')},{' '}
                {outcome.nextState.honeyServings} honey,{' '}
                {plural(outcome.nextState.cupsInStock, 'cup')}.
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

        {/*
          Where this is going, immediately above the button that goes there.

          Deliberately the last thing before "start day 4", because that is the
          moment the decision is made. Two lines and a padlock: what they are
          aiming at, and what it opens. Any longer and it joins the list of
          things this audience scrolls past.
        */}
        {whatsNext && (whatsNext.goal || whatsNext.stop) && !isLastDay && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white/85 p-3">
            {whatsNext.goal && (
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-sm leading-tight">
                  🎯
                </span>
                <span className="font-body text-[13px] font-extrabold leading-snug text-ink/85">
                  {whatsNext.goal}
                </span>
              </div>
            )}
            {whatsNext.stop && (
              <div
                className={`flex items-start gap-2 ${
                  whatsNext.goal ? 'mt-2 border-t-2 border-dashed border-ink/15 pt-2' : ''
                }`}
              >
                <span aria-hidden className="text-sm leading-tight">
                  🔒
                </span>
                <div className="min-w-0">
                  <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                    Then: {whatsNext.stop.name}
                  </div>
                  <div className="font-body text-[12px] font-bold leading-snug text-ink/70">
                    {whatsNext.stop.what}
                  </div>
                  {whatsNext.buys && (
                    <div className="mt-1 font-body text-[12px] font-extrabold leading-snug text-wood-deep">
                      {money(whatsNext.buys.cash)} comes with you. {whatsNext.buys.name} costs{' '}
                      {money(whatsNext.buys.cost)}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <ChunkyButton variant="lemon" full onClick={onNext}>
            {isLastDay ? 'See your week →' : `Start day ${outcome.nextState.day} →`}
          </ChunkyButton>

          {/*
            * Stepping away, which is what a manager is actually for.
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
  const unsold = outcome.cupsAvailable - outcome.cupsSold;

  if (outcome.turnedAwaySoldOut > 0) {
    return `You sold every cup and ${outcome.turnedAwaySoldOut} more people still wanted one. You could have made more.`;
  }
  if (unsold > 0 && outcome.walkedAwayOnPrice > outcome.cupsSold) {
    return `${plural(unsold, 'cup')} went unsold and most people walked past without stopping. More people said no than yes.`;
  }
  if (unsold > 0) {
    return `You made ${plural(outcome.cupsAvailable, 'cup')} and sold ${outcome.cupsSold}. The ${unsold} you did not sell were already paid for.`;
  }
  if (outcome.cupsSold === planned.cupsMakeable) {
    return 'Everything you made, you sold. Exactly the good case.';
  }
  return `${plural(outcome.cupsSold, 'cup')} sold today.`;
}
