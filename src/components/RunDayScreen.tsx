'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WEATHER_COPY, round2, type DayOutcome } from '@/lib/simulation';
import { ChunkyButton, Ground, SignHeading, Sky, WeatherArt, money } from './ui';
import { Stand } from './Stand';
import { CustomerSprite } from './Customer';

/** How long each sprite spends walking on, reading the sign, and leaving. */
const WALK_MS = 1500;

/** Total time the day should take, whatever the size of the crowd. */
const DAY_MS = 12000;

/** Never draw more than this many sprites at once, however busy the day. */
const MAX_ON_SCREEN = 6;

/**
 * The day running. This is the signature moment of the product, so it gets
 * the visual budget: real people walk up, read the real price, and either
 * pay or keep walking. Nothing here is decorative — every sprite is one
 * customer from the simulation, and the counters are that day's real result
 * arriving in real time.
 */
export function RunDayScreen({ outcome, onDone }: { outcome: DayOutcome; onDone: () => void }) {
  // Pace the day so it always resolves in roughly ten seconds regardless of
  // how big the crowd is, then let an impatient kid speed it up.
  const [hurry, setHurry] = useState(false);
  const baseTick = useMemo(
    () => Math.max(110, Math.min(320, Math.round(DAY_MS / Math.max(1, outcome.customers.length)))),
    [outcome.customers.length],
  );
  const tick = hurry ? 24 : baseTick;
  const walkMs = hurry ? 420 : WALK_MS;

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

  useEffect(() => {
    if (revealedRef.current >= outcome.customers.length) return;

    const interval = window.setInterval(() => {
      if (revealedRef.current >= outcome.customers.length) {
        window.clearInterval(interval);
        return;
      }
      revealedRef.current += 1;
      setRevealed(revealedRef.current);
    }, tick);

    return () => window.clearInterval(interval);
  }, [outcome.customers.length, tick]);

  // Let the last few verdicts land, then declare the day over.
  useEffect(() => {
    if (revealed < outcome.customers.length) return;
    const timer = window.setTimeout(() => setDrained(true), walkMs * 0.5);
    return () => window.clearTimeout(timer);
  }, [revealed, outcome.customers.length, walkMs]);

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
    : Math.max(0, Math.min(outcome.customers.length, revealed - lagTicks));

  const decided = outcome.customers.slice(0, settled);
  const sold = decided.filter((c) => c.outcome === 'bought').length;
  const walked = decided.length - sold;
  const taken = round2(sold * outcome.price);

  const finished = drained;

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
          {cupsLeft > 0 ? `${cupsLeft} cups left to sell` : 'SOLD OUT'}
        </span>
      </div>

      <div className="relative z-20 mx-auto w-full max-w-md px-5 pt-3 text-center">
        <SignHeading className="text-3xl">{WEATHER_COPY[outcome.weather]}</SignHeading>
      </div>

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
          <Stand price={outcome.price} fill={jarFill} compact />
        </div>

        <div className="absolute inset-x-0 bottom-[31%] h-[60px]">
          {onScreen.map(({ customer, lane }) => (
            <CustomerSprite
              key={customer.id}
              customer={customer}
              price={outcome.price}
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
        ) : (
          <button
            type="button"
            onClick={() => setHurry(true)}
            className="mx-auto block rounded-full bg-white/70 px-5 py-2 font-body text-sm font-extrabold text-ink/70"
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
