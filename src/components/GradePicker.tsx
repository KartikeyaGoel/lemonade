'use client';

import { ECON, GRADE_ORDER, lemonUnitCost, type LemonGrade } from '@/lib/simulation';
import { money } from './ui';

/**
 * What kind of lemon to buy.
 *
 * Lever 1 of FRAMEWORK.md §1's Stage 1 table — "2-3 simple choices such as
 * organic vs. regular" — and the first decision in the game that is a genuine
 * trade rather than a number to tune. A dearer lemon costs more every single
 * day and brings more people; the cheap one saves money now and quietly costs
 * customers tomorrow.
 *
 * Three choices, which is the whole point: §13 records that what has to be
 * bounded is the number of decisions in front of a child, not the number of
 * things drawn. Three is also what the specification asked for.
 *
 * Every number here is derived. The price shown is `lemonUnitCost`, the same
 * function the receipt and the cost of goods sold use, so a child who checks
 * the shopping list against this card finds them equal.
 */
const COPY: Record<LemonGrade, { name: string; label: string; emoji: string; note: string }> = {
  value: {
    name: 'Cheap',
    label: 'Cheap lemons',
    emoji: '🍋',
    note: 'Saves money. Fewer people come back.',
  },
  regular: {
    name: 'Normal',
    label: 'Normal lemons',
    emoji: '🍋',
    note: 'The usual. Nothing to explain.',
  },
  organic: {
    name: 'Posh',
    label: 'Posh lemons',
    emoji: '✨',
    note: 'Costs more. More people want one.',
  },
};

export function GradePicker({
  grade,
  lemons,
  onPick,
}: {
  grade: LemonGrade;
  /** How many are being bought, so the bulk discount shows in the price. */
  lemons: number;
  onPick: (grade: LemonGrade) => void;
}) {
  return (
    <div>
      <div className="flex gap-1.5">
        {GRADE_ORDER.map((option) => {
          const on = option === grade;
          const each = lemonUnitCost(option, lemons);
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${COPY[option].label}, ${money(each)} each`}
              onClick={() => onPick(option)}
              className={`flex min-h-11 flex-1 flex-col items-center rounded-xl border-[3px] px-1.5 py-2 transition ${
                on ? 'border-mint bg-mint/25' : 'border-ink/20 bg-white/70'
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {COPY[option].emoji}
              </span>
              <span className="mt-0.5 font-body text-[11px] font-extrabold text-ink">
                {COPY[option].name}
              </span>
              <span className="font-ledger text-[11px] font-bold tabular-nums text-ink/70">
                {money(each)}
              </span>
            </button>
          );
        })}
      </div>

      {/* One line about the one they picked, rather than three lines at once. */}
      <p className="mt-2 text-center font-body text-[12px] font-bold leading-snug text-ink/70">
        {COPY[grade].note}
      </p>

      {/*
        The bulk step, named only when it is actually being earned.
        A discount a child cannot see is not a lesson, and a discount announced
        before it applies is a puzzle.
      */}
      {lemons >= ECON.BULK_TIERS[ECON.BULK_TIERS.length - 1].atLeast && (
        <p className="mt-1 text-center font-body text-[11px] font-extrabold text-mint-deep">
          Buying {lemons} at once, so each one is cheaper.
        </p>
      )}
    </div>
  );
}

/** The dearer-lemon question, asked as the trade it is. */
export function GradeHint({ grade, lemons }: { grade: LemonGrade; lemons: number }) {
  const posh = lemonUnitCost('organic', lemons);
  const cheap = lemonUnitCost('value', lemons);
  if (grade !== 'regular') return null;
  return (
    <p className="mt-1 text-center font-body text-[11px] font-bold text-ink/55">
      Posh is {money(posh)} a lemon, cheap is {money(cheap)}. Try both and watch the queue.
    </p>
  );
}

/** Re-exported so callers do not need two imports for one decision. */
export { type LemonGrade };
