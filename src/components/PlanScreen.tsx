'use client';

import { useState } from 'react';
import {
  ECON,
  FORECAST_COPY,
  DEFAULT_DAY_PARAMS,
  batchPlan,
  maxAffordableCups,
  orderForTargetCups,
  projectDay,
  rehearseDay,
  toCents,
  totalFixedCost,
  totalLemons,
  type DayParams,
  type GameState,
  DEFAULT_GRADE,
  type LemonGrade,
} from '@/lib/simulation';
import {
  MAX_TRIES,
  alreadyTried,
  asTry,
  bestTry,
  canRehearse,
  compareTries,
  crowdLabel,
  remember,
  type Try,
  type TryDiff,
} from '@/lib/bench';
import { STAFF, UPGRADES, type BusinessState } from '@/lib/business';
import { ChunkyButton, clearsBar, GoalStrip, HeaderBar, money, PinnedBar, plural, Sheet, SignHeading, Sky, WeatherArt } from './ui';
import { PipBubble, PipSays } from './Pip';
import { StandScene, type SpotId } from './StandScene';
import { CoachTour } from './CoachTour';
import { GradeHint, GradePicker } from './GradePicker';
import { STAND_TOUR } from '@/lib/coach';

/**
 * The stand, from day two onwards.
 *
 * Two things happen here that did not before, and both came out of watching how
 * a kid actually behaves in a game they like.
 *
 * The first is that the plan is *on the stand*. Not a list of labelled sliders —
 * a sign you tap to change the price, a crate you tap to change the batch, a
 * cash box you tap to see where the money goes. Same numbers, same arithmetic,
 * but you reach them by touching the thing they belong to. A settings screen
 * tells a kid this is homework. A place they can poke at does not.
 *
 * The second is the bench: `Try it on yesterday's crowd`. The kid can play the
 * day out against the people who actually turned up yesterday, keep the result,
 * change one number, and play it again — and the game will tell them, in
 * dollars, which of their two decisions did what. That is not a convenience. It
 * is the only way to learn a demand curve from inside a noisy world, and it is
 * the mechanic the whole learning claim of Act 1 now rests on.
 *
 * What it still never shows is a prediction of today. The three honest
 * scenarios live in the cash box; the rehearsal is explicitly labelled as
 * yesterday. How many sell today is the thing they are here to find out.
 */
export function PlanScreen({
  state,
  params = DEFAULT_DAY_PARAMS,
  business,
  dayLabel,
  stage,
  guide,
  note,
  onOpen,
  onInvest,
  tour = false,
  onToured,
}: {
  /**
   * Run the first-run tour of the stand.
   *
   * The caller decides, because whether a child has seen it lives on the
   * career and this component does not read storage. See `src/lib/coach.ts`
   * for why the tour exists at all: day one is three screens with a slider
   * each, and this screen is the same two decisions as hotspots on a picture.
   */
  tour?: boolean;
  onToured?: () => void;
  state: GameState;
  /** Act 2 onwards: capacity, rent, wages and competition all live here. */
  params?: DayParams;
  business?: BusinessState;
  dayLabel?: string;
  /**
   * The act's own goal and its own clock, for every act that is not Act 1.
   *
   * This exists because of the sharpest piece of playtest evidence we have. A
   * kid played eighteen days and quit bored — and day eighteen is Act 2, day
   * eleven of fourteen, three days from the end. The cause is visible right
   * here: the goal strip below used to be wrapped in `dayLabel === undefined`,
   * which is true in Act 1 and false in every act after it. So the objective
   * vanished on day eight and never came back, and the header dropped its
   * its day count at the same moment. He was grinding an unbounded day loop
   * with no
   * stated aim and no finish line, and the one screen that did name the aim
   * was the shop, which he had no reason to open.
   *
   * Act 1 still derives both from `ECON`, because its goal really is
   * arithmetic on the starting cash. Every later act has to be told.
   */
  stage?: { goal: string; day?: number; total?: number };
  /**
   * Pip, on the stand.
   *
   * Two beats land here and both are about a kid who has stopped knowing why
   * he is pressing the button: the bench, which is the only planning tool in
   * the game, and Act 2's stall — past halfway with no manager hired, which is
   * the exact state the one playtester quit in.
   */
  guide?: { lines: readonly string[]; onDismiss: () => void } | null;
  /** One line of context above the stand, when the day is not an ordinary one. */
  note?: string;
  onOpen: (targetCups: number, price: number, grade: LemonGrade) => void;
  /** Stages 2 to 4: jump to the yard. */
  onInvest?: () => void;
}) {
  const fixedCost = totalFixedCost(params.fixedCosts);
  const maxCups = Math.max(0, maxAffordableCups(state, fixedCost));
  const yesterday = state.history[state.history.length - 1];

  /**
   * Start the dial where the kid left off, not at Act 1's 28.
   *
   * A kid who has bought a cooler and moved to the park can serve 90 cups; if
   * the slider still defaulted to 28 they would pay $34 a day in rent and
   * wages to sell a third of what they could, and read it as their own bad
   * decision rather than ours.
   */
  const [targetCups, setTargetCups] = useState(() => {
    const capacity = Math.floor(params.serviceCapacity);
    const suggestion = yesterday ? Math.ceil(yesterday.cupsSold * 1.25) : 28;
    return Math.max(8, Math.min(maxCups, capacity, suggestion));
  });
  const [price, setPrice] = useState(() => yesterday?.price ?? 1.5);
  /*
   * Lever 1, carried forward from yesterday rather than reset.
   *
   * A recipe is a standing decision, not a daily one — a child who switched to
   * posh lemons yesterday has not decided to switch back this morning, and
   * word of mouth in `gradeDemandFactor` reads yesterday's grade, so silently
   * resetting to normal would make the demand move for no reason they chose.
   */
  const [grade, setGrade] = useState<LemonGrade>(yesterday?.grade ?? DEFAULT_GRADE);

  /** Which object on the stand is open. Null means the whole scene is visible. */
  const [spot, setSpot] = useState<SpotId | null>(null);

  /** Today's thinking. Not saved: tomorrow is a different question. */
  const [tries, setTries] = useState<Try[]>([]);
  const [nextTryId, setNextTryId] = useState(1);
  const [shown, setShown] = useState<Try | null>(null);
  const [diff, setDiff] = useState<TryDiff | null>(null);
  const [repeat, setRepeat] = useState<Try | null>(null);
  /** Set the first time anything on the stand is opened. Retires the finger. */
  const [poked, setPoked] = useState(false);

  /**
   * Which step of the first-run tour is showing, or -1 for none.
   *
   * Ends for good the moment the child opens anything, in `onSelect` below.
   * Tapping the highlighted thing *is* the lesson landing, so carrying on
   * would be a mascot talking over a kid who already understood — the exact
   * failure `Pip.tsx` warns about.
   */
  /*
   * The tour runs until anything on the stand is opened.
   *
   * `poked` is set by the first tap on any hotspot, so passing `!poked` here
   * is what makes a child tapping the lit-up thing end the tour — they have
   * demonstrated the only thing it was trying to teach. `CoachTour` owns the
   * step state and reports back once, either way.
   */
  const tourRunning = tour && !poked;

  const plan = batchPlan(state, targetCups, grade);
  const projection = projectDay(state, targetCups, price, params, grade);
  const forecast = FORECAST_COPY[state.forecast];
  const rival = business?.rival;
  const rivalHere = Boolean(rival?.active && rival.location === business?.location);
  const capacity = Math.floor(params.serviceCapacity);
  /*
   * A queue with no ceiling has no number.
   *
   * `DEFAULT_DAY_PARAMS.serviceCapacity` is `Number.POSITIVE_INFINITY`, which
   * is the right value — nothing caps a folding table but the pantry — and
   * `Math.floor` of it is still `Infinity`. Printed straight into a row it
   * reads "Cups you can serve in a day: Infinity", which is not a sentence.
   *
   * Not reachable today: Act 1 does not render the sheet this appears in, and
   * every act that does passes a finite capacity from the business the child
   * built. It is one omitted prop away from being reachable, and "as many as
   * you can pour" is a better answer than a number anyway.
   */
  const capped = Number.isFinite(capacity);
  const capacityLabel = capped ? `${capacity}` : 'as many as you can pour';
  const atCapacity = capped && projection.cupsMakeable >= capacity;
  const rehearsable = canRehearse(yesterday);
  const best = bestTry(tries);

  /**
   * Play today's plan against yesterday's crowd.
   *
   * The auto-comparison against the previous try is the important part. A kid
   * will not think to ask "which of my two changes did that" — so the moment
   * there is a second try, the answer is put in front of them.
   */
  const runTry = () => {
    if (!rehearsable) return;
    const already = alreadyTried(tries, targetCups, price);
    if (already) {
      setRepeat(already);
      return;
    }
    const order = orderForTargetCups(state, targetCups);
    /*
     * The recipe goes into the rehearsal too.
     *
     * Without it the bench priced every plan at the normal lemon and told a
     * child holding posh lemons that a plan made $23.98 when it made $20.38 —
     * on the one screen whose whole job is to let them be wrong for free.
     */
    const outcome = rehearseDay(state, { ...order, price, grade }, params, yesterday);
    if (!outcome) return;

    const attempt = asTry(nextTryId, targetCups, outcome);
    const previous = tries[0] ?? null;
    setTries(remember(tries, attempt));
    setNextTryId((n) => n + 1);
    setSpot(null);
    if (previous) setDiff(compareTries(previous, attempt));
    else setShown(attempt);
  };

  /**
   * Puts an old attempt back on the stand.
   *
   * Named `useTry` until the linter pointed out that React reads `use…` as a
   * hook and was refusing to check three callbacks in this file because of it.
   * A name that makes a tool wrong about your code will eventually make a
   * person wrong about it too.
   */
  const loadTry = (attempt: Try) => {
    setTargetCups(attempt.targetCups);
    setPrice(attempt.price);
    setShown(null);
    setDiff(null);
    setRepeat(null);
  };

  /**
   * Act 1 has nothing to spend money on and nothing on the stand, so the
   * toolbox was a spot that opened a panel listing four things the kid cannot
   * buy yet. It appears when it becomes real: something owned, or a shop to go
   * to.
   */
  const kit = business ? describeKit(business) : null;
  const kitLabel = business && (onInvest || kit !== 'plain') ? kit : null;

  return (
    <Sky mood={state.forecast}>
      <WeatherArt mood={state.forecast} />
      <HeaderBar
        day={stage?.day ?? state.history.length + 1}
        totalDays={stage?.total ?? (dayLabel ? null : ECON.TOTAL_DAYS)}
        // "Day 18" next to a heading that says Saturday reads as a bug. When
        // the day has its own name, the header uses it.
        label={note ? dayLabel : undefined}
        cash={state.cash}
      />

      {/* min-h plus a flex-1 scene: the stand grows to fill whatever is left
          between the goal strip and the pinned buttons, instead of sitting in a
          fixed box with two hundred pixels of empty sky under it. */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-md flex-col px-4 pt-2" style={clearsBar()}>
        <div className="flex items-center justify-between gap-3">
          <SignHeading className="text-3xl">{dayLabel ?? `Day ${state.day}`}</SignHeading>
          <span className="stat-chip !text-xs">{forecast.headline} · a guess</span>
        </div>

        {note && (
          <p className="mt-1 rounded-2xl border-[3px] border-mint/50 bg-mint/15 px-3 py-1.5 font-body text-[12px] font-extrabold leading-snug text-ink/80">
            {note}
          </p>
        )}

        {guide && (
          <PipSays className="mt-2" lines={guide.lines} onDismiss={guide.onDismiss} />
        )}

        {stage ? (
          <GoalStrip>{stage.goal}</GoalStrip>
        ) : (
          dayLabel === undefined && (
            <GoalStrip>
              {ECON.TOTAL_DAYS - state.history.length}{' '}
              {ECON.TOTAL_DAYS - state.history.length === 1 ? 'day' : 'days'} left ·{' '}
              {money(state.cash)} of {money(ECON.STARTING_CASH)} start
            </GoalStrip>
          )
        )}

        <StandScene
          price={price}
          cupsReady={projection.cupsMakeable}
          costToBuy={projection.costToBuy}
          marginPerCup={projection.marginPerCup}
          losesMoney={projection.losesMoneyPerCup}
          capacity={capacity}
          atCapacity={atCapacity}
          regulars={params.subscribers}
          regularPrice={toCents(price * (1 - params.subscriberDiscount))}
          rivalPrice={rivalHere && rival ? rival.price : null}
          kitLabel={kitLabel}
          showTapHint={!poked}
          className="min-h-[230px] flex-1"
          active={spot}
          onSelect={(next) => {
            setPoked(true);
            setSpot((current) => (current === next ? null : next));
          }}
        />

        {/* First time here, one finger and one instruction. The scene is a new
            kind of screen — a kid who does not know it is touchable will read it
            as a picture and go looking for the sliders that are no longer
            there. */}
        {/*
          Suppressed while the tour is running: the tour says this, one thing
          at a time and pointing at each. Two Pips saying the same sentence at
          once was visible the moment the dim went behind them.

          Kept for afterwards, because a child who skipped the tour, or who
          comes back next season, still needs to know the scene is touchable.
        */}
        {!poked && !tourRunning && (
          <PipBubble point="up" className="-mt-1">
            Tap the sign to change your price. Tap the lemons to make more.
          </PipBubble>
        )}

        {/* The lab book. Reads like the row of saved attempts down the side of a
            factory game, and does the same job: it makes the last thing you
            tried something you can measure the next thing against. */}
        {tries.length > 0 ? (
          <div className="mt-1">
            <div className="flex items-baseline justify-between px-1">
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
                Tried it on {crowdLabel(yesterday).toLowerCase()}
              </span>
              <span className="font-body text-[10px] font-extrabold text-ink/40">
                {tries.length}/{MAX_TRIES} · tap to compare
              </span>
            </div>
            <div className="-mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1">
              {tries.map((attempt) => (
                <button
                  key={attempt.id}
                  type="button"
                  onClick={() =>
                    attempt.id === tries[0].id
                      ? setShown(attempt)
                      : setDiff(compareTries(attempt, tries[0]))
                  }
                  className={`shrink-0 rounded-xl border-[3px] bg-white/90 px-2.5 py-1.5 text-left ${
                    best && attempt.id === best.id ? 'border-mint' : 'border-ink/20'
                  }`}
                >
                  <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/50">
                    Try {attempt.id}
                    {best && attempt.id === best.id && tries.length > 1 ? ' ★' : ''}
                  </div>
                  <div className="font-body text-[11px] font-extrabold text-ink/70">
                    {money(attempt.price)} · {plural(attempt.cupsMade, 'cup')}
                  </div>
                  <div
                    className={`font-ledger text-[13px] font-bold tabular-nums ${
                      attempt.profit >= 0 ? 'text-ink' : 'text-berry'
                    }`}
                  >
                    {money(attempt.profit)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          rehearsable &&
          poked && (
            <PipBubble className="mt-2">
              Now try it on yesterday&apos;s crowd. Being wrong here is free.
            </PipBubble>
          )
        )}
      </div>

      {/* Pinned, so the kid can poke at the stand and still reach both actions.
          Two buttons, and they are visibly different weights: trying is cheap
          and reversible, opening is neither. */}
      <PinnedBar className="z-30 pb-5 pt-8 bg-gradient-to-t from-black/30 to-transparent">
        <div className="mx-auto w-full max-w-md space-y-2 px-4">
          {rehearsable && (
            <ChunkyButton
              variant="wood"
              full
              onClick={runTry}
              className="!text-lg"
              coach="try"
            >
              🧪 Try it on yesterday&apos;s crowd
            </ChunkyButton>
          )}
          <ChunkyButton
            variant="mint"
            full
            disabled={!plan.affordable}
            onClick={() => onOpen(targetCups, price, grade)}
          >
            Open the stand!
          </ChunkyButton>
        </div>
      </PinnedBar>

      {/* ---- The first-run tour ---- */}

      {/*
        Only while nothing is open. A sheet is a child doing the thing the tour
        was asking for, and the spotlight would be arguing with them.
      */}
      <CoachTour tour={STAND_TOUR} run={tourRunning && spot === null} onDone={() => onToured?.()} />

      {/* ---- Inside the objects ---- */}

      {spot === 'price' && (
        <Sheet title="What will you charge?" onClose={() => setSpot(null)}>
          <div className="flex items-center justify-center gap-4">
            <ChunkyButton
              variant="ghost"
              onClick={() => setPrice((p) => nudge(p, -0.05))}
              className="!h-14 !w-14 !px-0 !font-body !text-3xl !font-black"
            >
              −
            </ChunkyButton>
            <div className="min-w-[128px] text-center">
              <div className="font-sign text-5xl leading-none text-berry">{money(price)}</div>
              <div className="font-body text-[10px] font-extrabold uppercase tracking-widest text-ink/50">
                per cup
              </div>
            </div>
            <ChunkyButton
              variant="ghost"
              onClick={() => setPrice((p) => nudge(p, 0.05))}
              className="!h-14 !w-14 !px-0 !font-body !text-3xl !font-black"
            >
              +
            </ChunkyButton>
          </div>

          <input
            aria-label="Price per cup"
            className="slider mt-4"
            type="range"
            min={0}
            max={300}
            step={5}
            value={Math.round(price * 100)}
            onChange={(event) => setPrice(Number(event.target.value) / 100)}
            style={{ ['--fill' as string]: `${(price / 3) * 100}%` }}
          />

          <div className="mt-3">
            <Row label="Costs you to make" value={`−${money(projection.costPerCup)}`} muted />
            <Row
              label="You keep, per cup"
              value={money(projection.marginPerCup)}
              strong
              alert={projection.losesMoneyPerCup}
            />
          </div>
          {yesterday && (
            <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
              Yesterday you charged {money(yesterday.price)} and sold {yesterday.cupsSold}.
            </p>
          )}
        </Sheet>
      )}

      {spot === 'batch' && (
        <Sheet title="How much will you make?" onClose={() => setSpot(null)}>
          <div className="text-center">
            <div className="font-sign text-6xl leading-none text-wood-deep">
              {projection.cupsMakeable}
            </div>
            <div className="font-body text-[10px] font-extrabold uppercase tracking-widest text-ink/50">
              cups of lemonade
            </div>
          </div>

          <input
            aria-label="Batch size in cups"
            className="slider mt-4"
            type="range"
            min={0}
            max={Math.max(4, maxCups)}
            step={1}
            value={targetCups}
            onChange={(event) => setTargetCups(Number(event.target.value))}
            style={{ ['--fill' as string]: `${(targetCups / Math.max(4, maxCups)) * 100}%` }}
          />

          <div className="mt-3">
            <Row
              label={`Lemons ×${plan.order.buyLemons}`}
              value={money(plan.cost.lemons)}
              note={`${ECON.CUPS_PER_LEMON} cups each`}
            />
            <Row
              label={`Sugar ×${plan.order.buySugarPacks}`}
              value={money(plan.cost.sugar)}
              note={`${ECON.SUGAR_SERVINGS_PER_PACK} cups each`}
            />
            <Row
              label={`Cups ×${plan.order.buyCupPacks}`}
              value={money(plan.cost.cups)}
              note={`${ECON.CUPS_PER_CUP_PACK} per pack`}
            />
            <Row label="Total to spend" value={money(plan.cost.total)} strong />
          </div>

          {totalLemons(state.lemonLots) + state.sugarServings + state.cupsInStock > 0 && (
            <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
              Using what you already have first: {plural(totalLemons(state.lemonLots), 'lemon')},{' '}
              {state.sugarServings} sugar, {plural(state.cupsInStock, 'cup')}.
            </p>
          )}
          {atCapacity && (
            <p className="mt-2 font-body text-[12px] font-extrabold text-wood-deep">
              You can only serve {plural(capacity, 'cup')} a day. Making more would just be lemons in the bin.
            </p>
          )}

          {/*
            Which lemons, under the shopping list rather than beside it.
            Same place the decision lives on day one — the shopping screen —
            and the same picker, so the two days agree about where a recipe is
            chosen. FRAMEWORK.md §1, Lever 1.
          */}
          <div className="mt-4 border-t-2 border-dashed border-ink/15 pt-3">
            <div className="text-center font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
              Which lemons?
            </div>
            <div className="mt-1.5">
              <GradePicker grade={grade} lemons={plan.order.buyLemons} onPick={setGrade} />
              <GradeHint grade={grade} lemons={plan.order.buyLemons} />
            </div>
          </div>
        </Sheet>
      )}

      {spot === 'money' && (
        <Sheet title="Where the money goes" onClose={() => setSpot(null)}>
          <Row label="A cup costs you" value={money(projection.costPerCup)} muted />
          <Row label="You charge" value={money(price)} muted />
          <Row
            label="You keep, per cup"
            value={money(projection.marginPerCup)}
            strong
            alert={projection.marginPerCup <= 0}
          />

          {params.fixedCosts.length > 0 && (
            <div className="mt-2 border-t-2 border-dashed border-ink/20 pt-1.5">
              {params.fixedCosts.map((line) => (
                <Row key={line.label} label={line.label} value={`−${money(line.amount)}`} muted />
              ))}
              {params.fixedCosts.length > 1 && (
                <Row label="Owed before you sell a thing" value={`−${money(fixedCost)}`} strong />
              )}
            </div>
          )}

          <p className="mt-2 font-body text-[12px] font-extrabold text-wood-deep">
            {projection.breakEvenCups !== null
              ? `Sell ${plural(projection.breakEvenCups, 'cup')} and you are even. Everything after that is yours.`
              : 'At this price you cannot break even, however many you sell.'}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Scenario
              label="All sells"
              cups={projection.bestCase.cupsSold}
              profit={projection.bestCase.profit}
            />
            <Scenario
              label="Half sells"
              cups={projection.halfCase.cupsSold}
              profit={projection.halfCase.profit}
            />
            <Scenario label="None sells" cups={0} profit={projection.worstCase.profit} />
          </div>
          <p className="mt-2 font-body text-[11px] font-bold text-ink/45">
            How many actually sell is up to the street. That is the bit you have to figure out.
          </p>
        </Sheet>
      )}

      {spot === 'regulars' && (
        <Sheet title="Your regulars" onClose={() => setSpot(null)}>
          <p className="font-body text-sm font-bold leading-snug text-ink/75">
            {params.subscribers} {params.subscribers === 1 ? 'neighbour' : 'neighbours'} on your
            round. They get a cup every day at{' '}
            {money(toCents(price * (1 - params.subscriberDiscount)))} — cheaper than the sign — and
            they turn up whatever the sky does.
          </p>
          <div className="mt-3">
            <Row label="Sign price" value={money(price)} muted />
            <Row
              label="Their price"
              value={money(toCents(price * (1 - params.subscriberDiscount)))}
              muted
            />
            <Row
              label="Promised money, before you open"
              value={money(
                toCents(price * (1 - params.subscriberDiscount)) * params.subscribers,
              )}
              strong
            />
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
            Raise the sign price and theirs goes up with it — they always pay a fixed slice less.
          </p>
        </Sheet>
      )}

      {spot === 'kit' && (
        <Sheet title="Your stand" onClose={() => setSpot(null)}>
          {business && (
            <div className="space-y-1.5">
              {Object.values(UPGRADES).map((upgrade) => (
                <Owned
                  key={upgrade.id}
                  emoji={upgrade.emoji}
                  name={upgrade.name}
                  blurb={upgrade.blurb}
                  owned={business.upgrades[upgrade.id]}
                  priceLabel={money(upgrade.cost)}
                />
              ))}
              {Object.values(STAFF).map((person) => (
                <Owned
                  key={person.id}
                  emoji={person.emoji}
                  name={person.name}
                  blurb={person.blurb}
                  owned={business.staff[person.id]}
                  priceLabel={`${money(person.wage)} a day`}
                />
              ))}
            </div>
          )}
          <div className="mt-3">
            <Row label="Cups you can serve in a day" value={capacityLabel} strong />
          </div>
          {onInvest && (
            <ChunkyButton
              variant="lemon"
              full
              className="mt-3 !text-base"
              onClick={() => {
                setSpot(null);
                onInvest();
              }}
            >
              🛠️ Spend money on the stand
            </ChunkyButton>
          )}
        </Sheet>
      )}

      {spot === 'rival' && rival && (
        <Sheet title="The stand across the road" onClose={() => setSpot(null)}>
          <p className="font-body text-sm font-bold leading-snug text-ink/75">
            They are charging <span className="text-berry">{money(rival.price)}</span> today. Some of
            the people who would have walked to you will stop there instead.
          </p>
          <div className="mt-3">
            <Row label="Their price" value={money(rival.price)} muted />
            <Row label="Your price" value={money(price)} muted />
            <Row
              label="Share of the street coming to you"
              value={`${Math.round(params.marketShare * 100)}%`}
              strong
            />
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
            You do not have to be cheaper. Being worth it also works.
          </p>
        </Sheet>
      )}

      {/* ---- The bench ---- */}

      {repeat && (
        <Sheet title="You already tried that" onClose={() => setRepeat(null)}>
          <p className="font-body text-sm font-bold leading-snug text-ink/75">
            {money(repeat.price)} with {plural(repeat.cupsMade, 'cup')} made{' '}
            <span className="font-ledger font-bold">{money(repeat.profit)}</span> on that crowd. The
            same plan on the same people gives the same answer — change something first.
          </p>
        </Sheet>
      )}

      {shown && (
        <Sheet
          title={`Try ${shown.id} on ${crowdLabel(yesterday).toLowerCase()}`}
          onClose={() => setShown(null)}
        >
          <TryDetail attempt={shown} />
          <ChunkyButton
            variant="lemon"
            full
            className="mt-3 !text-base"
            onClick={() => loadTry(shown)}
          >
            Put these numbers back on the stand
          </ChunkyButton>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
            Yesterday&apos;s crowd, not today&apos;s. Today the weather gets a vote.
          </p>
        </Sheet>
      )}

      {diff && (
        <Sheet
          title={`Try ${diff.from.id} vs Try ${diff.to.id}`}
          onClose={() => setDiff(null)}
        >
          <div className="rounded-2xl border-[3px] border-ink/15 bg-white/85 p-3">
            <p className="font-body text-sm font-extrabold leading-snug text-ink">
              {diff.headline}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`font-sign text-4xl leading-none ${
                  diff.gap >= 0 ? 'text-mint' : 'text-berry'
                }`}
              >
                {diff.gap >= 0 ? '+' : '−'}
                {money(Math.abs(diff.gap)).replace('-', '')}
              </span>
              <span className="font-body text-[12px] font-extrabold text-ink/55">
                Try {diff.to.id} against Try {diff.from.id}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {diff.lines.map((line) => (
              <div
                key={line.label}
                className="flex items-start justify-between gap-3 rounded-xl border-2 border-ink/12 bg-white/70 px-2.5 py-1.5"
              >
                <span className="flex-1">
                  <span className="block font-body text-[13px] font-extrabold text-ink">
                    {line.label}
                  </span>
                  <span className="block font-body text-[11px] font-bold text-ink/50">
                    {line.detail}
                  </span>
                </span>
                <span
                  className={`font-ledger text-[14px] font-bold tabular-nums ${
                    line.amount >= 0 ? 'text-ink' : 'text-berry'
                  }`}
                >
                  {line.amount >= 0 ? '+' : '−'}
                  {money(Math.abs(line.amount)).replace('-', '')}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right font-body text-[11px] font-extrabold text-ink/45">
            Those add up to the gap. They always do.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <ChunkyButton
              variant="ghost"
              full
              className="!text-sm"
              onClick={() => loadTry(diff.from)}
            >
              Use Try {diff.from.id}
            </ChunkyButton>
            <ChunkyButton
              variant="lemon"
              full
              className="!text-sm"
              onClick={() => loadTry(diff.to)}
            >
              Use Try {diff.to.id}
            </ChunkyButton>
          </div>
        </Sheet>
      )}
    </Sky>
  );
}

function nudge(current: number, delta: number): number {
  return Math.min(ECON.MAX_PRICE, Math.max(0, Math.round((current + delta) * 100) / 100));
}

/** "cooler · sign", or the honest version when there is nothing on it yet. */
function describeKit(business: BusinessState): string {
  const owned = [
    ...Object.values(UPGRADES)
      .filter((u) => business.upgrades[u.id])
      .map((u) => u.name.toLowerCase()),
    ...Object.values(STAFF)
      .filter((s) => business.staff[s.id])
      .map((s) => s.name.toLowerCase()),
  ];
  if (owned.length === 0) return 'plain';
  if (owned.length === 1) return owned[0];
  return `${owned.length} things`;
}

function Row({
  label,
  value,
  note,
  muted,
  strong,
  alert,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`ledger-row text-[13px] ${strong ? 'mt-1 border-t-2 border-dashed border-ink/20 pt-1 font-extrabold' : ''}`}
    >
      <span className={muted ? 'text-ink/60' : ''}>
        {label}
        {note && <span className="ml-1.5 font-body text-[11px] font-bold text-ink/40">{note}</span>}
      </span>
      <span className={alert ? 'text-berry' : ''}>{value}</span>
    </div>
  );
}

function Owned({
  emoji,
  name,
  blurb,
  owned,
  priceLabel,
}: {
  emoji: string;
  name: string;
  blurb: string;
  owned: boolean;
  priceLabel: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 ${
        owned ? 'border-mint/60 bg-mint/12' : 'border-ink/12 bg-white/50'
      }`}
    >
      <span aria-hidden className={`text-xl ${owned ? '' : 'grayscale opacity-45'}`}>
        {emoji}
      </span>
      <span className="flex-1">
        <span className="block font-body text-[13px] font-extrabold text-ink">{name}</span>
        <span className="block font-body text-[11px] font-bold text-ink/50">{blurb}</span>
      </span>
      <span className="font-body text-[11px] font-extrabold text-ink/45">
        {owned ? 'yours' : priceLabel}
      </span>
    </div>
  );
}

function TryDetail({ attempt }: { attempt: Try }) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span
          className={`font-sign text-5xl leading-none ${
            attempt.profit >= 0 ? 'text-ink' : 'text-berry'
          }`}
        >
          {money(attempt.profit)}
        </span>
        <span className="font-body text-[12px] font-extrabold text-ink/55">profit</span>
      </div>
      <div className="mt-2">
        <Row label={`Sold ${attempt.cupsSold} of ${plural(attempt.cupsMade, 'cup')}`} value={money(attempt.revenue)} muted />
        <Row label="Lemons, sugar and cups" value={`−${money(attempt.ingredientCost)}`} muted />
        {attempt.fixedCost > 0 && (
          <Row label="Owed whatever happened" value={`−${money(attempt.fixedCost)}`} muted />
        )}
        {attempt.spoilageCost > 0 && (
          <Row
            label={`${plural(attempt.spoiledLemons, 'lemon')} thrown away`}
            value={`−${money(attempt.spoilageCost)}`}
            muted
          />
        )}
        {attempt.investorCut > 0 && (
          <Row label="Your investor's slice" value={`−${money(attempt.investorCut)}`} muted />
        )}
        <Row label="Left for you" value={money(attempt.profit)} strong alert={attempt.profit < 0} />
      </div>
      {(attempt.turnedAway > 0 || attempt.walkedAwayOnPrice > 0) && (
        <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
          {attempt.turnedAway > 0 &&
            `${plural(attempt.turnedAway, 'person', 'people')} wanted one after you ran out. `}
          {attempt.walkedAwayOnPrice > 0 &&
            `${attempt.walkedAwayOnPrice} looked at the sign and kept walking.`}
        </p>
      )}
    </div>
  );
}

function Scenario({ label, cups, profit }: { label: string; cups: number; profit: number }) {
  const good = profit > 0;
  return (
    <div
      className={`rounded-xl border-2 px-2 py-1.5 text-center ${
        good ? 'border-mint/60 bg-mint/15' : 'border-berry/40 bg-berry/10'
      }`}
    >
      <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/55">
        {label}
      </div>
      <div className="font-body text-[10px] font-bold text-ink/45">{plural(cups, 'cup')}</div>
      <div className={`font-ledger text-[13px] font-bold tabular-nums ${good ? 'text-ink' : 'text-berry'}`}>
        {money(profit)}
      </div>
    </div>
  );
}
