'use client';

import { useState } from 'react';
import {
  DEFAULT_GRADE,
  ECON,
  batchPlan,
  maxAffordableCups,
  type GameState,
  type LemonGrade,
  totalLemons,
} from '@/lib/simulation';
import { GradeHint, GradePicker } from './GradePicker';
import { PipBubble } from './Pip';
import { ActionFooter, ChunkyButton, HeaderBar, SignHeading, Sky, money, plural } from './ui';

/**
 * Shopping, as one decision.
 *
 * A kid does not buy lemons, sugar and cups separately here — they choose a
 * batch size and the game does the shopping list. The itemised receipt is
 * then shown to them, which is where unit cost is actually taught: they see
 * that 28 cups costs $5.60, that it works out at about 20c a cup, and that
 * supplies come in lumps.
 *
 * The receipt's hierarchy is inverted from where it started, and the reason
 * is a playtest note worth writing down: a real kid described this screen as
 * so much text that he skipped it. He was right to. Three itemised lines, a
 * total, a unit cost and two explanatory paragraphs is six things to read, and
 * only one of them changes the decision he is about to make on the very next
 * screen — what a cup costs him, which is the floor his price has to clear.
 * That line was the smallest and faintest thing on the card, under the total.
 *
 * So it leads now. The itemisation stays open, because this screen is mostly
 * reached on a run's first day — `morning → shop → price` runs at the start of
 * a run and, within a session, every later day goes straight to the stand —
 * and on day one the receipt *is* the unit-cost lesson.
 *
 * "Mostly", not "only": a *resumed* Act 1 save also comes through here, so
 * this screen sees day two and later after a reload. That correction cost a
 * bug — the recipe defaulted to normal here and so a reload silently switched
 * a child off the lemons they had chosen. The screen he was actually
 * describing is the daily profit and loss, which is where the disclosure
 * belongs, because that one fires twenty-one times.
 */
export function ShopScreen({
  state,
  onConfirm,
  onBack,
}: {
  state: GameState;
  onConfirm: (targetCups: number, grade: LemonGrade) => void;
  onBack: () => void;
}) {
  const maxCups = Math.max(0, maxAffordableCups(state));
  // Default to something sensible so a first-timer can simply tap through.
  const [target, setTarget] = useState(() => Math.min(maxCups, 28));
  /*
   * Lever 1 of FRAMEWORK.md §1's Stage 1 table lives here, on day one, because
   * this is the shopping screen and a product choice is a shopping decision.
   * Day two onward the same picker is inside the crate of lemons on the stand.
   */
  /*
   * Carried forward from yesterday, not reset.
   *
   * A recipe is a standing decision. A child who switched to posh lemons has
   * not decided to switch back this morning — and `gradeDemandFactor` reads
   * yesterday's grade for word of mouth, so a silent reset moves demand for a
   * reason they did not choose.
   *
   * This screen's own comment says it "is only ever reached on a run's first
   * day". That is not true: `morning → shop → price` is also the path a
   * *resumed* Act 1 save takes, so day two onward lands here after a reload
   * and the reset was visible on the second screen of a real session.
   */
  const [grade, setGrade] = useState<LemonGrade>(
    () => state.history[state.history.length - 1]?.grade ?? DEFAULT_GRADE,
  );
  const plan = batchPlan(state, target, grade);

  const firstEver = state.history.length === 0;
  const [touched, setTouched] = useState(false);

  const pantryLemons = totalLemons(state.lemonLots);
  const hasPantry = pantryLemons > 0 || state.sugarServings > 0 || state.cupsInStock > 0;

  return (
    <Sky mood="dawn">
      <HeaderBar day={state.day} totalDays={ECON.TOTAL_DAYS} cash={state.cash} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-md flex-col px-5 pb-8 pt-4">
        <SignHeading className="text-center">How much can you make?</SignHeading>

        {/* The one number the kid actually sets. */}
        <div className="mt-6 text-center">
          <div className="font-sign text-7xl leading-none text-wood-deep">{plan.cupsMakeable}</div>
          <div className="font-body text-sm font-extrabold uppercase tracking-widest text-ink/60">
            cups of lemonade
          </div>
        </div>

        {firstEver && !touched && (
          <PipBubble className="mt-3">Slide it. Watch the shopping list change.</PipBubble>
        )}

        <input
          aria-label="Batch size in cups"
          className={`slider ${firstEver && !touched ? 'mt-1' : 'mt-5'}`}
          type="range"
          min={0}
          max={Math.max(4, maxCups)}
          step={1}
          value={target}
          onChange={(event) => {
            setTouched(true);
            setTarget(Number(event.target.value));
          }}
          style={{ ['--fill' as string]: `${(target / Math.max(4, maxCups)) * 100}%` }}
        />
        <div className="flex justify-between font-body text-xs font-extrabold text-ink/50">
          <span>none</span>
          <span>as much as you can afford</span>
        </div>

        {/* The receipt. This is the unit-cost lesson, shown not told — with the
            one line that feeds the next decision on top. */}
        <div className="mt-5 rounded-2xl border-[3px] border-ink/15 bg-white/85 p-4">
          {/* Two numbers, and they are genuinely different quantities rather
              than two views of one. What a cup costs to make is the floor the
              price has to clear. What leaves the cash box today is bigger,
              because lemons come whole and packs come in tens. Labelling them
              precisely is what stops them reading as a contradiction. */}
          {plan.cupsMakeable > 0 && (
            <div className="flex items-end justify-between">
              <div>
                <div className="font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
                  Each cup costs you
                </div>
                <div className="font-sign text-4xl leading-none text-wood-deep">
                  {money(plan.costPerCup)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
                  Out of the box
                </div>
                <div className="font-ledger text-xl font-extrabold tabular-nums text-ink">
                  {money(plan.cost.total)}
                </div>
              </div>
            </div>
          )}
          {plan.cupsMakeable === 0 && (
            <div className="ledger-row font-extrabold">
              <span>Total to spend</span>
              <span>{money(plan.cost.total)}</span>
            </div>
          )}

          {/*
            A receipt, and it has to read as one.

            A first-time player looked at this and asked where the slider for
            the lemons and the sugar was. There isn't one, and there should not
            be: the recipe is fixed — one lemon is four cups — so the batch is
            the single bet, and a second and third dial for ingredients that
            follow from it would be three taps to say one thing. §4: reduce
            taps aggressively, never the rigour.

            But the question was fair, because these rows used the exact visual
            grammar of every *tappable* row in the game — bold name on the left,
            price on the right, same as the plots in the yard and the companies
            in the market. So the heading names the slider as the cause, an
            arrow points down from it, and the names are no longer set in the
            weight that means "you can press this".
          */}
          <div className="mt-3 border-t-2 border-dashed border-ink/20 pt-2">
            <div className="mb-1 font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
              <span aria-hidden>↓ </span>So the slider buys
            </div>
              <ReceiptLine
                emoji="🍋"
                label={`Lemons x${plan.order.buyLemons}`}
                note={`${ECON.CUPS_PER_LEMON} cups each`}
                amount={plan.cost.lemons}
              />
              <ReceiptLine
                emoji="🥄"
                label={`Sugar x${plan.order.buySugarPacks}`}
                note={`${ECON.SUGAR_SERVINGS_PER_PACK} cups each`}
                amount={plan.cost.sugar}
              />
              <ReceiptLine
                emoji="🥤"
                label={`Cups x${plan.order.buyCupPacks}`}
                note={`${ECON.CUPS_PER_CUP_PACK} per pack`}
                amount={plan.cost.cups}
              />

              {hasPantry && (
                <p className="mt-3 font-body text-xs font-bold text-ink/60">
                  Using what you already have first: {plural(pantryLemons, 'lemon')},{' '}
                  {state.sugarServings} sugar, {plural(state.cupsInStock, 'cup')}.
                </p>
              )}
              {plan.cupsMakeable > plan.targetCups && plan.targetCups > 0 && (
                <p className="mt-2 font-body text-xs font-bold text-ink/60">
                  Lemons come whole and packs come in tens, so you get {plural(plan.cupsMakeable, 'cup')}.
                </p>
              )}
          </div>
        </div>

        {/*
          What kind of lemon. Below the shopping list, because the list has to
          be read first — the choice only means something once a child has seen
          what a cup costs.
        */}
        <div className="mt-4">
          <div className="text-center font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
            Which lemons?
          </div>
          <div className="mt-1.5">
            <GradePicker grade={grade} lemons={plan.order.buyLemons} onPick={setGrade} />
            <GradeHint grade={grade} lemons={plan.order.buyLemons} />
          </div>
        </div>

        <ActionFooter className="mt-auto flex gap-3 pt-6">
          <ChunkyButton variant="ghost" onClick={onBack} className="!px-5 !text-xl">
            ←
          </ChunkyButton>
          <ChunkyButton
            variant="lemon"
            full
            disabled={!plan.affordable}
            onClick={() => onConfirm(target, grade)}
          >
            Set my price →
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}

function ReceiptLine({
  emoji,
  label,
  note,
  amount,
}: {
  emoji: string;
  label: string;
  note: string;
  amount: number;
}) {
  return (
    <div className="ledger-row py-1">
      <span className="flex items-baseline gap-2">
        <span aria-hidden className="opacity-60">
          {emoji}
        </span>
        {/* Not `font-extrabold`: that weight is what a pressable row looks
            like everywhere else in this game, and these are consequences. */}
        <span className="font-body font-bold text-ink/70">{label}</span>
        <span className="font-body text-xs font-bold text-ink/40">{note}</span>
      </span>
      <span className="text-ink/70">{money(amount)}</span>
    </div>
  );
}
