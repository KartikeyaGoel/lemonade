'use client';

import { useState } from 'react';
import {
  HOLD_WEEKS,
  STANDS_FOR_SALE,
  askingPrice,
  judgeDealChoice,
  paybackWeeks,
  type StandForSale,
} from '@/lib/ownership';
import { ActionFooter, ChunkyButton, clearsBar, money, PinnedBar, SignHeading, Sky } from '../ui';

/**
 * Comparison shopping. This is where PE actually lands.
 *
 * Three stands, all earning the same amount today, at three different prices.
 * Every simple heuristic fails: the cheapest is shrinking, the dearest is
 * merely steady, and the best is in the middle. The kid has to divide.
 *
 * Before they choose, they get price, payback and trend and nothing else. No
 * projected totals — that is the reveal, because working out that a growing
 * business is worth more is the entire point of the exercise.
 */
export function DealBoardScreen({
  onChoose,
}: {
  onChoose: (choiceId: string, correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const verdict = picked ? judgeDealChoice(picked) : null;

  if (revealed && verdict) {
    return (
      <Sky mood="dusk">
        <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
          <SignHeading className="text-center text-4xl">
            {verdict.correct ? 'That was the best deal.' : 'Look at the numbers.'}
          </SignHeading>
          <p className="mt-2 text-center font-body text-sm font-bold text-ink/70">
            If you owned each one for {HOLD_WEEKS} weeks:
          </p>

          <div className="mt-5 rounded-2xl border-[3px] border-ink/20 bg-white p-3 shadow-lg">
            {verdict.rows.map((row) => (
              <div
                key={row.stand.id}
                className={`mb-2 rounded-xl border-2 px-3 py-2 last:mb-0 ${
                  row.isBest
                    ? 'border-mint bg-mint/15'
                    : row.stand.id === verdict.chosen.id
                      ? 'border-berry/60 bg-berry/10'
                      : 'border-ink/12 bg-white'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-body text-sm font-extrabold">
                    {row.stand.emoji} {row.stand.name}
                  </span>
                  <span className="font-ledger text-xs tabular-nums text-ink/60">
                    {row.stand.askingMultiple}x
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1 font-ledger text-[11px] tabular-nums">
                  <Cell label="paid" value={money(row.price)} />
                  <Cell label="collected" value={money(row.projected)} />
                  <Cell
                    label="ended up"
                    value={money(row.value)}
                    tone={row.value > 0 ? 'good' : 'bad'}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4">
            <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
              The idea
            </div>
            <p className="mt-1 font-body text-sm font-bold text-ink/85">{verdict.lesson}</p>
            <p className="mt-2 font-body text-[13px] font-semibold italic text-ink/60">
              That number — price divided by what it earns — is the one every investor argues
              about. It has a name, and you will meet it next.
            </p>
          </div>

          <ActionFooter className="mt-auto pt-6">
            <ChunkyButton variant="lemon" full onClick={() => onChoose(picked!, verdict.correct)}>
              Back to your own stand →
            </ChunkyButton>
          </ActionFooter>
        </div>
      </Sky>
    );
  }

  return (
    <Sky mood="probably-hot">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pt-6" style={clearsBar()}>
        <SignHeading className="text-center text-4xl">Three stands for sale</SignHeading>
        <p className="mt-2 text-center font-body text-sm font-bold text-ink/70">
          All three make <strong>$100 a week</strong> right now. Which is the best buy?
        </p>

        <div className="mt-5 space-y-3">
          {STANDS_FOR_SALE.map((stand) => (
            <DealCard
              key={stand.id}
              stand={stand}
              selected={picked === stand.id}
              onSelect={() => setPicked(stand.id)}
            />
          ))}
        </div>
      </div>

      <PinnedBar className="z-30 bg-gradient-to-t from-black/25 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="mint" full disabled={!picked} onClick={() => setRevealed(true)}>
            {picked ? 'That one' : 'Pick one'}
          </ChunkyButton>
        </div>
      </PinnedBar>
    </Sky>
  );
}

function DealCard({
  stand,
  selected,
  onSelect,
}: {
  stand: StandForSale;
  selected: boolean;
  onSelect: () => void;
}) {
  const trend =
    stand.weeklyGrowth > 0
      ? { label: 'busier every week', tone: 'text-mint' }
      : stand.weeklyGrowth < 0
        ? { label: 'quieter every week', tone: 'text-berry' }
        : { label: 'exactly the same every week', tone: 'text-ink/60' };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border-[4px] p-4 text-left transition-transform active:scale-[0.99] ${
        selected ? 'border-mint bg-mint/15' : 'border-ink/20 bg-white/90'
      }`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-2xl">
          {stand.emoji}
        </span>
        <span className="font-sign text-2xl text-ink">{stand.name}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 font-ledger text-[13px] tabular-nums">
        <Cell label="asking price" value={money(askingPrice(stand))} />
        <Cell label="money back in" value={`${paybackWeeks(stand)} wks`} />
      </div>

      <div className={`mt-2 font-body text-[12px] font-extrabold ${trend.tone}`}>{trend.label}</div>
      <div className="mt-0.5 font-body text-[11px] font-bold text-ink/55">{stand.blurb}</div>
    </button>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div>
      <div className="font-body text-[9px] font-extrabold uppercase tracking-wide text-ink/40">
        {label}
      </div>
      <div
        className={`font-bold ${tone === 'good' ? 'text-mint' : tone === 'bad' ? 'text-berry' : 'text-ink'}`}
      >
        {value}
      </div>
    </div>
  );
}
