'use client';

import { useState } from 'react';
import { ROUND, UPGRADES } from '@/lib/business';
import { ActionFooter, ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * The end-of-week fork: take the money out, or leave it in.
 *
 * We never say which is right. What we do is make both consequences concrete —
 * what the cash could buy if it stays, and the fact that once it is out it is
 * safe and doing nothing. The kid feels compounding a week later.
 *
 * The round sits here too, because it is the same kind of decision: give up a
 * slice of every cup in exchange for customers who turn up when it is cold.
 * That trade is the whole reason a subscription business is priced above a shop
 * with the same profit, and a buyer will pay them for it.
 */
export function WeeklyChoiceScreen({
  cash,
  savings,
  weekNumber,
  regulars,
  expectedSignups,
  onChoose,
}: {
  cash: number;
  savings: number;
  weekNumber: number;
  regulars: number;
  /** Roughly how many would say yes, worked out from how many already buy. */
  expectedSignups: number;
  onChoose: (cashOut: number, signUpRegulars: boolean) => void;
}) {
  const [out, setOut] = useState(0);
  const [drive, setDrive] = useState(false);
  const staysIn = Math.max(0, cash - out);
  const affordable = Object.values(UPGRADES).filter((u) => u.cost <= staysIn);

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
            End of week {weekNumber}
          </div>
          <SignHeading className="mt-1 text-4xl">Keep it or grow it?</SignHeading>
        </div>

        <div className="mt-6 rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
          <div className="ledger-row">
            <span className="font-body font-extrabold">In the business</span>
            <span>{money(cash)}</span>
          </div>
          <div className="ledger-row text-ink/60">
            <span>Already in savings</span>
            <span>{money(savings)}</span>
          </div>
        </div>

        <div className="mt-5 text-center">
          <div className="font-sign text-6xl leading-none text-berry">{money(out)}</div>
          <div className="font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
            moved to savings
          </div>
        </div>

        <input
          aria-label="How much to move to savings"
          className="slider mt-4"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(cash))}
          step={1}
          value={out}
          onChange={(event) => setOut(Number(event.target.value))}
          style={{ ['--fill' as string]: `${(out / Math.max(1, cash)) * 100}%` }}
        />
        <div className="flex justify-between font-body text-xs font-extrabold text-ink/50">
          <span>leave it all in</span>
          <span>take it all out</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Panel title="Taken out" amount={out} tone="safe">
            Safe. It stops growing.
          </Panel>
          <Panel title="Left in" amount={staysIn} tone="grow">
            {affordable.length > 0
              ? `Enough for the ${affordable[affordable.length - 1].name.toLowerCase()}.`
              : 'Not enough for an upgrade yet.'}
          </Panel>
        </div>

        {/* The round. Costs no money — costs margin. */}
        <button
          type="button"
          onClick={() => setDrive((value) => !value)}
          aria-pressed={drive}
          className={`mt-4 w-full rounded-2xl border-[3px] p-3.5 text-left ${
            drive ? 'border-mint bg-mint/25' : 'border-ink/20 bg-white/75'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-xl leading-none">
              {drive ? '✅' : '⬜️'}
            </span>
            <div>
              <div className="font-body text-sm font-extrabold text-ink">
                Spend the week signing up regulars
              </div>
              <div className="mt-0.5 font-body text-[12px] font-bold leading-tight text-ink/65">
                A cup a day, {Math.round(ROUND.DISCOUNT * 100)}% off, and they come whatever the
                weather.{' '}
                {expectedSignups > 0
                  ? `About ${expectedSignups} would say yes.`
                  : 'Not enough people buy from you yet for this to work.'}
              </div>
              {regulars > 0 && (
                <div className="mt-0.5 font-body text-[11px] font-extrabold text-ink/45">
                  You already have {regulars} on the round.
                </div>
              )}
            </div>
          </div>
        </button>

        <ActionFooter className="mt-auto pt-6">
          <ChunkyButton variant="lemon" full onClick={() => onChoose(out, drive)}>
            {drive
              ? out === 0
                ? 'Leave it in, go sign people up →'
                : `Move ${money(out)} out, go sign people up →`
              : out === 0
                ? 'Leave it all in →'
                : `Move ${money(out)} to savings →`}
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}

function Panel({
  title,
  amount,
  tone,
  children,
}: {
  title: string;
  amount: number;
  tone: 'safe' | 'grow';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border-[3px] p-3 ${
        tone === 'grow' ? 'border-mint/60 bg-mint/15' : 'border-ink/20 bg-white/80'
      }`}
    >
      <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/50">
        {title}
      </div>
      <div className="font-ledger text-lg font-bold tabular-nums text-ink">{money(amount)}</div>
      <div className="mt-0.5 font-body text-[11px] font-bold leading-tight text-ink/60">{children}</div>
    </div>
  );
}
