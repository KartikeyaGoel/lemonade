'use client';

import {
  LOCATIONS,
  STAFF,
  UPGRADES,
  act2Progress,
  dailyFixedCosts,
  serviceCapacity,
  type BusinessState,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from '@/lib/business';
import { totalFixedCost } from '@/lib/simulation';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * Act 2's shop. This is where profit turns into capacity, and where a kid
 * meets the difference between buying a thing and hiring a person.
 *
 * Deliberately laid out as two separate lists with different headings, because
 * the whole lesson is that these two kinds of spending do not behave the same
 * way. One list shows a price. The other shows a price *per day*.
 */
export function InvestScreen({
  cash,
  business,
  onBuyUpgrade,
  onToggleStaff,
  onMove,
  onDone,
}: {
  cash: number;
  business: BusinessState;
  onBuyUpgrade: (id: UpgradeId) => void;
  onToggleStaff: (id: StaffId) => void;
  onMove: (id: LocationId) => void;
  onDone: () => void;
}) {
  const capacity = serviceCapacity(business);
  const dailyCost = totalFixedCost(dailyFixedCosts(business));
  const progress = act2Progress(business, 0);

  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-28 pt-5">
        <SignHeading className="text-center text-4xl">Grow the stand</SignHeading>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="stat-chip">💵 {money(cash)}</span>
          <span className="stat-chip">🥤 {capacity} cups a day</span>
          <span className="stat-chip">📉 {money(dailyCost)} a day in costs</span>
        </div>

        {/* Goal, stated as a thing to do rather than a lesson to absorb. */}
        <div className="mt-3 rounded-2xl border-[3px] border-wood-dark bg-lemon-light px-4 py-3 text-center">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
            Goal
          </div>
          <div className="mt-0.5 font-body text-sm font-extrabold text-ink">{progress.nextStep}</div>
        </div>

        {/* Capex */}
        <SectionHeading title="Buy once, keep forever" note="one payment" />
        {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
          const item = UPGRADES[id];
          const owned = business.upgrades[id];
          const affordable = cash >= item.cost;
          return (
            <Row
              key={id}
              emoji={item.emoji}
              name={item.name}
              blurb={item.blurb}
              right={
                owned ? (
                  <span className="stat-chip !border-mint !bg-mint/25">Owned</span>
                ) : (
                  <ChunkyButton
                    variant={affordable ? 'lemon' : 'ghost'}
                    disabled={!affordable}
                    onClick={() => onBuyUpgrade(id)}
                    className="!px-4 !py-2 !text-lg"
                  >
                    {money(item.cost)}
                  </ChunkyButton>
                )
              }
            />
          );
        })}

        {/* Opex */}
        <SectionHeading title="Pay every single day" note="wages" />
        {(Object.keys(STAFF) as StaffId[]).map((id) => {
          const item = STAFF[id];
          const hired = business.staff[id];
          return (
            <Row
              key={id}
              emoji={item.emoji}
              name={item.name}
              blurb={item.blurb}
              right={
                <ChunkyButton
                  variant={hired ? 'ghost' : 'mint'}
                  onClick={() => onToggleStaff(id)}
                  className="!px-4 !py-2 !text-base"
                >
                  {hired ? 'Let go' : `${money(item.wage)}/day`}
                </ChunkyButton>
              }
              highlight={hired}
            />
          );
        })}

        {/* Location */}
        <SectionHeading title="Where you trade" note="rent" />
        {(Object.keys(LOCATIONS) as LocationId[]).map((id) => {
          const spot = LOCATIONS[id];
          const here = business.location === id;
          return (
            <Row
              key={id}
              emoji={spot.emoji}
              name={spot.name}
              blurb={
                spot.demandMultiplier > 1
                  ? `${spot.blurb} ${Math.round((spot.demandMultiplier - 1) * 100)}% more customers.`
                  : spot.blurb
              }
              right={
                here ? (
                  <span className="stat-chip !border-mint !bg-mint/25">Here</span>
                ) : (
                  <ChunkyButton
                    variant="wood"
                    onClick={() => onMove(id)}
                    className="!px-4 !py-2 !text-base"
                  >
                    {money(spot.fee)}/day
                  </ChunkyButton>
                )
              }
              highlight={here}
            />
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/25 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="lemon" full onClick={onDone}>
            Open up today →
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-5 flex items-baseline justify-between px-1">
      <span className="font-sign text-xl text-ink">{title}</span>
      <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
        {note}
      </span>
    </div>
  );
}

function Row({
  emoji,
  name,
  blurb,
  right,
  highlight,
}: {
  emoji: string;
  name: string;
  blurb: string;
  right: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mt-2 flex items-center gap-3 rounded-2xl border-[3px] px-3 py-2.5 ${
        highlight ? 'border-mint/60 bg-mint/10' : 'border-ink/15 bg-white/85'
      }`}
    >
      <span aria-hidden className="text-2xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-body text-sm font-extrabold text-ink">{name}</div>
        <div className="font-body text-[11px] font-bold leading-tight text-ink/55">{blurb}</div>
      </div>
      {right}
    </div>
  );
}
