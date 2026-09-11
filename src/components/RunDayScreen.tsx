'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MORNING_SHARE, WEATHER_COPY, round2, type DayOutcome } from '@/lib/simulation';
import { middayOptions, type MiddayCall } from '@/lib/midday';
import { play } from '@/lib/sound';
import { ChunkyButton, Ground, SignHeading, Sky, WeatherArt, money, plural } from './ui';
import { Stand } from './Stand';
import { CustomerSprite } from './Customer';

/** How long each sprite spends walking on, reading the sign, and leaving. */
const WALK_MS = 1500;

/** Total time the day should take, whatever the size of the crowd. */
const DAY_MS = 12000;

/**
 * The shortest a single customer may hold the screen.
 *
 * Below this a sprite is a flicker rather than a person walking up and
 * deciding, which is the whole point of the screen.
 *
 * This floor used to *stretch the day* instead of being absorbed. The pace was
 * one customer per tick at `DAY_MS / crowd` milliseconds, clamped up to this
 * floor — so past 109 customers the arithmetic stopped fitting and the day ran
 * long. Measured: 13.5s at 37–109 customers, 18.0s at 150, and **32.7s at 284**,
 * which is the biggest crowd the simulation actually produces (a loaded
 * late-game business selling at 25c — the cheap price an experimenting kid
 * tries first). Two and a half times the intended pace, on the screen this
 * file's own comment calls "the signature moment of the product", and directly
 * against the comment below promising "roughly ten seconds regardless of how
 * big the crowd is".
 *
 * Now the floor is absorbed by taking more than one customer per tick, so the
 * day stays bounded and a sprite stays legible. See FRAMEWORK.md §13.
 */
const MIN_TICK_MS = 110;

/** Never draw more than this many sprites at once, however busy the day. */
const MAX_ON_SCREEN = 6;

/**
 * Taps a child spends letting the crowd in, when the crowd is theirs to let in.
 *
 * The first stage hands the pace over: the street stays empty until it is
 * tapped, and each tap sends the next group up to the sign. That is worth
 * doing because watching is the one part of the day a child has no hand in —
 * they price it, they stock it, and then they sit still for twelve seconds —
 * and a tap turns the payoff into something they are causing.
 *
 * Eight rather than one-per-customer, because the crowd runs to sixty on a hot
 * day at a cheap price and sixty taps is a chore, not a game. The group size
 * is derived from the crowd so the number of taps is the same whether four
 * people show up or forty: the day is always about eight presses long.
 *
 * Later stages run themselves. By then a day is a number a child is checking
 * rather than a scene they are meeting, and the arc is spending their
 * attention on the market instead.
 */
const TAPS_PER_DAY = 8;

/** Closest together two customer sounds are allowed to be. */
const MIN_SOUND_GAP_MS = 90;

/**
 * The day running. This is the signature moment of the product, so it gets
 * the visual budget: real people walk up, read the real price, and either
 * pay or keep walking. Nothing here is decorative — every sprite is one
 * customer from the simulation, and the counters are that day's real result
 * arriving in real time.
 */
export function RunDayScreen({
  outcome,
  onDone,
  interactive = false,
  midday = null,
  onMidday,
}: {
  outcome: DayOutcome;
  onDone: () => void;
  /** Hand the pace to the child: the crowd waits to be let in. Stage 1 only. */
  interactive?: boolean;
  /**
   * The question at lunchtime, if this day has one.
   *
   * The only decision inside a day, and the reason this screen stopped being
   * something every child in the pilot skipped. `null` on a day that is simply
   * going fine, and then nothing interrupts. See `src/lib/midday.ts`.
   */
  midday?: MiddayCall | null;
  /**
   * Answering it. The caller re-runs the same day with the new afternoon
   * price and hands back a fresh `outcome`; this component keeps its place in
   * the crowd, because the morning half of the new outcome is identical.
   */
  onMidday?: (price: number) => void;
}) {
  // Pace the day so it always resolves in roughly twelve seconds regardless of
  // how big the crowd is, then let an impatient kid speed it up.
  const [hurry, setHurry] = useState(false);

  /**
   * How many customers are allowed on so far.
   *
   * The whole of tap-to-let-them-in is this one number. An automatic day
   * permits the lot up front and the interval below walks them on at its own
   * pace; an interactive day starts at nobody and each tap raises the ceiling
   * by a group. Everything downstream — sprites, counters, coins, the end of
   * the day — is derived exactly as it was, so the two modes differ in when a
   * customer is allowed to arrive and in nothing else.
   */
  const [allowed, setAllowed] = useState(() =>
    interactive ? 0 : Number.POSITIVE_INFINITY,
  );

  /**
   * Customers per tick, and how long a tick lasts.
   *
   * Two knobs rather than one, because a big crowd cannot be paced by
   * shortening the tick alone — `MIN_TICK_MS` is a legibility floor and past
   * about a hundred customers it is binding. So the crowd is divided into at
   * most `DAY_MS / MIN_TICK_MS` groups, and a whole group walks up per tick.
   * The day stays bounded and each tick stays long enough to read.
   */
  const { baseTick, step } = useMemo(() => {
    const crowd = Math.max(1, outcome.customers.length);
    const mostTicks = Math.floor(DAY_MS / MIN_TICK_MS);
    const perTick = Math.max(1, Math.ceil(crowd / mostTicks));
    const ticksNeeded = Math.ceil(crowd / perTick);
    return {
      step: perTick,
      baseTick: Math.max(MIN_TICK_MS, Math.min(320, Math.round(DAY_MS / ticksNeeded))),
    };
  }, [outcome.customers.length]);

  const tick = hurry ? 24 : baseTick;
  const walkMs = hurry ? 420 : WALK_MS;

  /** People per tap, so a day is about `TAPS_PER_DAY` presses whatever the crowd. */
  const group = Math.max(1, Math.ceil(outcome.customers.length / TAPS_PER_DAY));

  /**
   * How many customers have walked on so far. Everything else is derived from
   * this one number.
   *
   * It lives in a ref as well as state because changing speed re-runs the
   * interval effect, and an index local to the effect would restart at zero —
   * which previously re-counted every sale and inflated the takings.
   */
  const revealedRef = useRef(0);
  const [revealed, setRevealed] = useState(0);
  /**
   * Set once the last customer's verdict has had time to land. Without this
   * the counters would stop `lagTicks` short of the total forever, because
   * `revealed` stops climbing and the trailing offset never closes.
   */
  const [drained, setDrained] = useState(false);

  /**
   * Lunchtime, and whether it has been dealt with.
   *
   * `askedAt` is the customer index the day stops at. Derived from the walk-up
   * crowd and `MORNING_SHARE` so it is the same boundary `buildCustomers` uses
   * — the child is asked at exactly the point the afternoon sign starts being
   * read, or the people they are pricing for would already have walked past.
   *
   * `answered` latches. A day gets one question: re-running the day hands this
   * component a new `outcome` with the same crowd length, and without the
   * latch the beat would fire again the moment the pause lifted.
   */
  const [answered, setAnswered] = useState(false);
  const regulars = outcome.subscriberCups;
  const walkUps = Math.max(0, outcome.customers.length - regulars);
  const askedAt = regulars + Math.floor(walkUps * MORNING_SHARE);
  /** The question is on screen, and the day is holding still for it. */
  const asking = Boolean(midday && onMidday) && !answered && revealed >= askedAt && askedAt > 0;

  /*
   * The pause.
   *
   * Implemented as a ceiling on `permitted` rather than by stopping the
   * interval, because that is the same mechanism tap-to-admit already uses and
   * it means the two cannot fight. A hurrying child is stopped too: the point
   * of the beat is that hurrying should cost you the chance to react, and a
   * speed-up button that skipped the only decision in the day would be the
   * "Let the rest come" mistake a second time.
   */
  const permitted = Math.min(
    allowed,
    outcome.customers.length,
    asking ? askedAt : Number.POSITIVE_INFINITY,
  );

  useEffect(() => {
    if (revealedRef.current >= permitted) return;

    const interval = window.setInterval(() => {
      if (revealedRef.current >= permitted) {
        window.clearInterval(interval);
        return;
      }
      revealedRef.current = Math.min(permitted, revealedRef.current + step);
      setRevealed(revealedRef.current);
    }, tick);

    return () => window.clearInterval(interval);
  }, [permitted, tick, step]);

  // Let the last few verdicts land, then declare the day over.
  useEffect(() => {
    if (revealed < outcome.customers.length) return;
    const timer = window.setTimeout(() => setDrained(true), walkMs * 0.5);
    return () => window.clearTimeout(timer);
  }, [revealed, outcome.customers.length, walkMs]);

  /**
   * The same courtesy for a group that has arrived but is not the last group.
   *
   * The counters trail the crowd by `lagTicks` on purpose, so a verdict lands
   * as the sprite reaches the sign rather than as it walks on. That trailing
   * offset closes by itself while a tick is running — and an interactive day
   * *stops* between taps, so without this the scoreboard would rest a few
   * customers short of what the child had just watched happen, and only catch
   * up when they tapped again. Wrong on screen, and wrong in the way that
   * teaches a child not to trust the number.
   */
  const [restedAt, setRestedAt] = useState(0);
  useEffect(() => {
    if (revealed === 0 || revealed < permitted) return;
    const timer = window.setTimeout(() => setRestedAt(revealed), walkMs * 0.5);
    return () => window.clearTimeout(timer);
  }, [revealed, permitted, walkMs]);

  // An empty day still has to end.
  useEffect(() => {
    if (outcome.customers.length === 0) setDrained(true);
  }, [outcome.customers.length]);

  // A verdict lands partway through the walk, so the counters trail the crowd
  // by a fixed number of ticks. Deriving them this way makes them idempotent:
  // no accumulation, so no double counting however often the speed changes.
  const lagTicks = Math.max(1, Math.round((walkMs * 0.42) / tick));
  const settled = drained
    ? outcome.customers.length
    : Math.min(
        outcome.customers.length,
        Math.max(restedAt, Math.max(0, revealed - lagTicks)),
      );

  const decided = outcome.customers.slice(0, settled);
  const sold = decided.filter((c) => c.outcome === 'bought').length;
  const walked = decided.length - sold;

  /**
   * A coin for every cup, and a shrug for everyone who walks.
   *
   * This is the single most valuable sound in the game: it attaches a feeling
   * to the exact instant a cup sells, forty times a day, which is how a kid
   * comes to *want* the number to go up before anybody explains why it should.
   *
   * Throttled, because the hurry button runs the crowd at one customer every
   * 24ms and forty overlapping coins is a buzz, not a reward. The throttle
   * drops sounds rather than queueing them, so the audio never runs on after
   * the day has finished.
   */
  const heard = useRef({ sold: 0, walked: 0, at: 0 });
  useEffect(() => {
    const last = heard.current;
    const gainedSale = sold > last.sold;
    const gainedWalk = walked > last.walked;
    last.sold = sold;
    last.walked = walked;
    if (!gainedSale && !gainedWalk) return;

    const now = performance.now();
    if (now - last.at < MIN_SOUND_GAP_MS) return;
    last.at = now;
    // A sale outranks a walk-off when both land in the same tick: the money is
    // the thing being taught.
    play(gainedSale ? 'coin' : 'sad');
  }, [sold, walked]);
  /*
   * The takings, summed per cup rather than multiplied.
   *
   * This was `sold * outcome.price`, which is exact on a day with one price and
   * wrong the moment there are two: a child who raised the sign at lunchtime
   * would have watched the counter charge the morning price for the whole
   * afternoon, and then met a different figure on the close screen. §4's rule
   * is that any two figures shown together reconcile, and this is the pair a
   * child watches most closely — it moves while they look at it.
   *
   * Regulars are at the standing price, which is discounted, so they are added
   * separately rather than folded in at the walk-up rate.
   */
  const taken = round2(
    decided.reduce((sum, customer) => {
      if (customer.outcome !== 'bought') return sum;
      if (customer.kind === 'regular') return sum + outcome.subscriberPrice;
      return sum + (customer.afternoon ? outcome.afternoonPrice : outcome.price);
    }, 0),
  );

  /** The sign as it stands right now, which is what the stand must draw. */
  const signNow = answered ? outcome.afternoonPrice : outcome.price;

  /*
   * A day cannot be over while it is still asking.
   *
   * `drained` is set from a timer that fires once `revealed` reaches the whole
   * crowd, and on a tiny crowd the pause and that timer can race. Without this
   * the footer would offer "count up the money" underneath an unanswered
   * question, and the child's answer would arrive after the day had been
   * settled.
   */
  const finished = drained && !asking;

  /*
   * Show the tap control only when there is somebody left to let in *and* the
   * group already permitted has finished arriving. Otherwise the button would
   * sit there during the walk-on, inviting a child to stack four groups on top
   * of each other and turn their own pacing back into the automatic one.
   */
  const waiting =
    !asking && !finished && allowed < outcome.customers.length && revealed >= permitted;

  // Keep only the sprites still on screen; a crowd of 90 must not pile up in
  // the DOM on a phone.
  const onScreen = useMemo(() => {
    const lifetime = Math.min(MAX_ON_SCREEN, Math.max(1, Math.ceil(walkMs / tick)));
    const start = Math.max(0, revealed - lifetime);
    return outcome.customers.slice(start, revealed).map((customer, i) => ({
      customer,
      lane: (start + i) % 3,
    }));
  }, [outcome.customers, revealed, tick, walkMs]);

  const cupsLeft = Math.max(0, outcome.cupsMakeable - sold);
  const jarFill = outcome.cupsMakeable > 0 ? sold / outcome.cupsMakeable : 0;

  /*
   * Down to the last quarter of the batch, on a day that really does run out.
   *
   * Three cups minimum so a tiny batch — four cups, a first-day child buying
   * one lemon — still gets the warning rather than going from full to empty
   * with nothing said in between.
   *
   * And at least one group's worth, which is the part measured rather than
   * guessed. A quarter of a 32-cup batch is eight cups, and a hot day at 40c
   * clears eleven cups a tap: the warning appeared for a single beat and then
   * the chip said SOLD OUT. A warning that arrives one frame before the thing
   * it warns about is decoration. Sized against the pace, it always has a
   * whole group to be read in.
   */
  const runningOut =
    outcome.turnedAwaySoldOut > 0 &&
    cupsLeft > 0 &&
    cupsLeft <= Math.max(3, group, Math.ceil(outcome.cupsMakeable * 0.25));

  return (
    <Sky mood={outcome.weather}>
      <WeatherArt mood={outcome.weather} />

      {/* Live scoreboard: three numbers, no more. */}
      <div className="relative z-30 flex items-center justify-between gap-1.5 px-3 pt-4">
        <span className="stat-chip !px-2.5">🥤 {sold} sold</span>
        <span className="stat-chip !px-2.5">💵 {money(taken)}</span>
        <span className="stat-chip !px-2.5">🚶 {walked} passed</span>
      </div>
      <div className="relative z-30 mt-1.5 flex justify-center">
        <span className={`stat-chip !px-3 ${cupsLeft === 0 ? '!border-berry !text-berry' : ''}`}>
          {cupsLeft > 0 ? `${plural(cupsLeft, 'cup')} left to sell` : 'SOLD OUT'}
        </span>
      </div>

      <div className="relative z-20 mx-auto w-full max-w-md px-5 pt-3 text-center">
        <SignHeading className="text-3xl">{WEATHER_COPY[outcome.weather]}</SignHeading>
        {/*
          The warning arrives before the wall, not after it.
          
          "SOLD OUT" already appears — the instant there is nothing left, which
          is the instant it stops being useful. What a child needs is the
          sentence that finishes the heading: it turned out hot, *and so* the
          batch is not going to last. Said while cups remain, it is a lesson
          about how much to make; said after, it is a receipt.
          
          Gated on the day actually running short, so it is never a false
          alarm: a batch that gets down to its last few cups and serves
          everybody who wants one says nothing.
        */}
        {runningOut && (
          /*
            On a chip, not straight onto the sky.
            
            Measured in a browser: berry on the mild sky gradient is 2.4:1 at
            this point on it, and 4.37:1 at the very lightest stop — under AA
            for body text everywhere on the screen. The contrast gate did not
            catch it, because it checks a curated list of pairs and berry-on-sky
            is not a pair anybody would deliberately add. `check-contrast.mjs`
            already records the reason in its own comment: the sky is a
            gradient, and its bottom stop is far too light to carry a tinted
            figure at all. So the sentence sits on the same white chip the three
            counters above it sit on, where berry measures 5.18:1.
            
            Fully opaque rather than the chip's usual white/85, and that is
            measured too: at 85% the sky shows through enough to bring the
            worst of the three moods down to 4.52:1, which passes AA by two
            hundredths. A warning is the wrong place to spend a margin that
            thin, and this is the only chip on the screen whose whole job is
            to be read in a hurry.
          */
          <p className="mt-1.5 flex justify-center">
            <span className="stat-chip !border-berry/40 !bg-white !text-berry animate-popIn">
              You&rsquo;re going to sell out soon.
            </span>
          </p>
        )}
      </div>

      {/*
        The lunchtime question, in the empty sky rather than over the street.

        It started life in the footer, where every other control on this screen
        lives, and a browser check killed that: three stacked buttons and two
        lines of text is about 340 of 812 pixels, which buried the stand, the
        jar and the customers — the evidence the child is being asked to reason
        about. The top of this screen is empty sky on every weather, so the card
        goes there and the whole scene stays visible underneath it.

        Three answers, always the same three and always in the same order,
        including the one that changes nothing. A screen that offered "raise it"
        on a busy day and "drop it" on a quiet one would be telling a child the
        answer and asking them to confirm it, which is the game playing the
        game. See `src/lib/midday.ts`.
      */}
      {asking && midday && onMidday && (
        <div className="pointer-events-none absolute inset-x-0 top-[22dvh] z-40 px-5">
          <div className="pointer-events-auto mx-auto w-full max-w-md animate-popIn rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-3 shadow-xl">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
              Lunchtime
            </div>
            {midday.says.map((line) => (
              <p
                key={line}
                className="mt-0.5 font-body text-[13px] font-extrabold leading-snug text-ink"
              >
                {line}
              </p>
            ))}
            <div className="mt-2 flex flex-col gap-1">
              {middayOptions(midday.price).map((option) => (
                <ChunkyButton
                  key={option.id}
                  variant={option.id === 'hold' ? 'ghost' : 'mint'}
                  full
                  className="!py-2 !text-base"
                  onClick={() => {
                    setAnswered(true);
                    /* Nothing to re-run when the sign does not move — the
                       outcome in hand is already that day. */
                    if (option.id !== 'hold') onMidday(option.price);
                  }}
                >
                  {option.label}
                </ChunkyButton>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The street. Sprites cross this, pausing in front of the sign. */}
      <div
        className="absolute inset-x-0 bottom-0 top-[15dvh] overflow-hidden"
        style={{
          // Sprites pause clear of the stand, which is about half the screen wide.
          ['--walk-to' as string]: '38vw',
          ['--walk-off' as string]: '120vw',
        }}
      >
        <Backdrop />

        <div className="absolute bottom-[32%] left-[3vw] z-20">
          {/* The sign changes when the child changes it. Watching the number on
              the stand move is most of what makes the decision feel real. */}
          <Stand price={signNow} fill={jarFill} compact />
        </div>

        <div className="absolute inset-x-0 bottom-[31%] h-[60px]">
          {onScreen.map(({ customer, lane }) => (
            <CustomerSprite
              key={customer.id}
              customer={customer}
              /* Each person is drawn against the price *they* read, so an
                 afternoon shopper thinking "$1.75? no thanks" is thinking it
                 about the sign that was actually up when they arrived. */
              price={customer.afternoon ? outcome.afternoonPrice : outcome.price}
              lane={lane}
              speedMs={walkMs}
            />
          ))}
        </div>

        <Ground height="h-[31%]" />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-5 pb-7">
        {finished ? (
          <ChunkyButton variant="lemon" full onClick={onDone} className="animate-popIn">
            Count up the money →
          </ChunkyButton>
        ) : waiting ? (
          /*
            The child's own hand on the pace.
            
            Two controls, and the second one matters as much as the first: a
            child who has had enough of tapping must be able to stop tapping
            without waiting the day out one group at a time. Once the rest are
            let in the footer falls back to the ordinary speed-up button, so
            there is never a moment where the only thing on offer is a press
            they did not want to make.
          */
          <div className="flex flex-col items-center gap-2">
            <ChunkyButton
              variant="lemon"
              full
              onClick={() => setAllowed((seen) => seen + group)}
              className="animate-popIn"
            >
              {/*
                Not "Open up!" — the price screen a tap earlier says "Open the
                stand!", and two consecutive buttons that both say open leave a
                child wondering what the first one did.
              */}
              {revealed === 0 ? 'Wave them over →' : 'Let them in →'}
            </ChunkyButton>
            <button
              type="button"
              onClick={() => setAllowed(Number.POSITIVE_INFINITY)}
              className="flex min-h-11 items-center rounded-full bg-white/70 px-5 py-2 font-body text-sm font-extrabold text-ink/70"
            >
              Let the rest come
            </button>
          </div>
        ) : asking ? (
          /*
            Nothing, while the day is holding still for a question.

            Found in the browser: "Tap to speed up" sat under the lunchtime
            card, which is a second control competing for the same thumb and
            one that cannot do anything — the pause is a ceiling on how many
            customers may arrive, so hurrying moves nothing until the question
            is answered. A button that does nothing is indistinguishable from a
            game that has stopped working.
          */
          null
        ) : (
          <button
            type="button"
            onClick={() => setHurry(true)}
            className="mx-auto flex min-h-11 items-center rounded-full bg-white/70 px-5 py-2 font-body text-sm font-extrabold text-ink/70"
          >
            {hurry ? 'Hurrying…' : 'Tap to speed up'}
          </button>
        )}
      </div>
    </Sky>
  );
}


/**
 * Hedge, fence and a couple of trees behind the stand. Purely scene-setting,
 * but it is what stops the screen reading as a form on a blue background.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[31%] z-0">
      {/* Trees */}
      <div className="absolute bottom-[26px] left-[62vw]">
        <div className="mx-auto h-16 w-16 rounded-full bg-grass-deep/90" />
        <div className="mx-auto -mt-2 h-10 w-3 bg-wood-dark/80" />
      </div>
      <div className="absolute bottom-[26px] left-[84vw]">
        <div className="mx-auto h-12 w-12 rounded-full bg-grass-deep/80" />
        <div className="mx-auto -mt-2 h-8 w-2.5 bg-wood-dark/70" />
      </div>

      {/* Picket fence */}
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 opacity-70">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="h-9 w-2.5 shrink-0 rounded-t-sm bg-white/85" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-3 h-1.5 bg-white/70" />
    </div>
  );
}
