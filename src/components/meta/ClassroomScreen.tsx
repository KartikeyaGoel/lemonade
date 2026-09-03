'use client';

import { useMemo, useState } from 'react';
import { encodeChallenge } from '@/lib/challenge';
import {
  ENOUGH_FOR_A_CURVE,
  bestOnCurve,
  bins,
  classWeek,
  entry as makeEntry,
  findings,
  howClose,
  trueCurve,
  type CurvePoint,
  type Entry,
} from '@/lib/classroom';
import { ChunkyButton, CodeBox, SignHeading, Sky, money } from '../ui';

/**
 * The classroom board.
 *
 * Written for a teacher, on a projector, with thirty children in the room and
 * about five minutes to collect results. Everything about it follows from that:
 * two fields to type, no accounts, no roster, and a chart that is legible from
 * the back of a room.
 *
 * The order on this screen is the lesson. Code first, then the class's own
 * dots, and the real curve only when the teacher asks for it. Showing the
 * answer before the measurement would turn thirty experiments into thirty
 * guesses at something the computer already knew.
 *
 * See `src/lib/classroom.ts` for why a demand curve measured by a class beats
 * one drawn on a whiteboard.
 */
export function ClassroomScreen({
  seed,
  entries,
  onChange,
  onNewCode,
  onBack,
}: {
  seed: number;
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  onNewCode: () => void;
  onBack: () => void;
}) {
  const [who, setWho] = useState('');
  const [price, setPrice] = useState('');
  const [profit, setProfit] = useState('');
  const [revealed, setRevealed] = useState(false);

  const spec = useMemo(() => classWeek(seed), [seed]);
  const code = useMemo(() => encodeChallenge(spec), [spec]);
  // A hundred and forty replays of a week. Fast, but not on every keystroke.
  const curve = useMemo(() => (revealed ? trueCurve(spec) : []), [revealed, spec]);

  const board = findings(entries);
  const grouped = bins(entries);

  const add = () => {
    const cents = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100);
    const made = Number(profit.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(cents) || cents <= 0 || !Number.isFinite(made)) return;
    onChange([...entries, makeEntry(who || `#${entries.length + 1}`, cents, made)]);
    setWho('');
    setPrice('');
    setProfit('');
  };

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="-m-2 self-start p-2 font-body text-sm font-extrabold text-ink/70"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 text-3xl">The class board</SignHeading>
        <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/70">
          Everyone plays the same week. Collect two numbers from each of them and the class has
          measured a demand curve.
        </p>

        {/* 1. The code. Big, because it is going on a whiteboard. */}
        <div className="mt-4">
          <Step n={1} title="Write this on the board" />
          <CodeBox label="Class code" code={code} />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-body text-[11px] font-bold text-ink/55">
              Children enter it under Friends → Same sky → play this week.
            </span>
            <button
              type="button"
              onClick={onNewCode}
              className="shrink-0 rounded-full border-2 border-ink/25 px-3 py-1.5 font-body text-[11px] font-extrabold text-ink/60"
            >
              New week
            </button>
          </div>
        </div>

        {/* 2. Collection. Two fields, because thirty children is five minutes. */}
        <div className="mt-5">
          <Step n={2} title="Type in what each of them got" />
          <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-3">
            <div className="flex gap-2">
              <Field label="Name" value={who} onChange={setWho} placeholder="optional" wide />
              <Field label="Price" value={price} onChange={setPrice} placeholder="1.75" />
              <Field label="Made" value={profit} onChange={setProfit} placeholder="41.20" />
            </div>
            <ChunkyButton variant="mint" full onClick={add} className="mt-2 !py-2 !text-lg">
              Add to the board
            </ChunkyButton>
            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entries.map((item, i) => (
                  <button
                    key={`${item.who}-${i}`}
                    type="button"
                    aria-label={`Remove ${item.who}`}
                    onClick={() => onChange(entries.filter((_, at) => at !== i))}
                    className="rounded-full border-2 border-ink/15 bg-ink/5 px-2 py-0.5 font-body text-[10px] font-extrabold text-ink/60"
                  >
                    {item.who} {money(item.priceCents / 100)} · {money(item.profit)} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. The chart. This is the lesson. */}
        <div className="mt-5">
          <Step n={3} title="What the class found" />
          <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-3">
            <Chart entries={entries} grouped={grouped} curve={curve} />
            <div className="mt-2 space-y-1">
              {board.lines.map((line) => (
                <p key={line} className="font-body text-[12px] font-extrabold leading-snug text-ink/75">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* 4. The answer, and only when asked for. */}
        {entries.length >= ENOUGH_FOR_A_CURVE && (
          <div className="mt-3">
            {revealed ? (
              <div className="rounded-2xl border-[3px] border-mint bg-mint/15 px-3 py-2.5">
                <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/50">
                  The same week, played at every price
                </div>
                <p className="mt-1 font-body text-[13px] font-extrabold leading-snug text-ink/80">
                  {howClose(entries, curve)}
                </p>
                <p className="mt-1 font-body text-[11px] font-bold leading-snug text-ink/55">
                  The green line is what a careful week would have earned at each price. Nobody was
                  told it. Your dots found the same shape.
                </p>
              </div>
            ) : (
              <ChunkyButton variant="lemon" full onClick={() => setRevealed(true)}>
                Show what the week could have done
              </ChunkyButton>
            )}
          </div>
        )}
      </div>
    </Sky>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 px-1">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 font-body text-[11px] font-extrabold text-white">
        {n}
      </span>
      <span className="font-sign text-lg text-ink">{title}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${wide ? 'flex-[1.2]' : 'flex-1'}`}>
      <span className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={label === 'Name' ? 'text' : 'decimal'}
        className="w-full rounded-lg border-[3px] border-ink/20 px-2 py-1.5 font-ledger text-sm font-bold text-ink placeholder:font-body placeholder:font-bold placeholder:text-ink/25"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * The chart
 *
 * Hand-drawn SVG rather than a library: one chart, thirty points, and a
 * charting dependency would be larger than the rest of the application.
 * ------------------------------------------------------------------ */

const W = 320;
const H = 190;
const PAD = { left: 30, right: 8, top: 10, bottom: 22 };
const MIN_CENTS = 50;
const MAX_CENTS = 400;

function Chart({
  entries,
  grouped,
  curve,
}: {
  entries: Entry[];
  grouped: ReturnType<typeof bins>;
  curve: CurvePoint[];
}) {
  const profits = [
    ...entries.map((e) => e.profit),
    ...curve.map((p) => p.profit),
    0,
  ];
  const top = Math.max(10, ...profits);
  const bottom = Math.min(0, ...profits);

  const x = (cents: number) =>
    PAD.left +
    ((Math.max(MIN_CENTS, Math.min(MAX_CENTS, cents)) - MIN_CENTS) / (MAX_CENTS - MIN_CENTS)) *
      (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + ((top - value) / (top - bottom || 1)) * (H - PAD.top - PAD.bottom);

  const peak = bestOnCurve(curve);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={
        entries.length === 0
          ? 'An empty chart of price against profit'
          : `${entries.length} results plotted, price along the bottom and profit up the side`
      }
    >
      {/* Zero, which is the only gridline that means anything here. */}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#2B211833" strokeWidth={1.5} />
      <text x={2} y={y(0) + 3} className="font-ledger" fontSize={8} fill="#2B211877">
        $0
      </text>
      <text x={2} y={y(top) + 3} className="font-ledger" fontSize={8} fill="#2B211877">
        {`$${Math.round(top)}`}
      </text>

      {[100, 200, 300, 400].map((cents) => (
        <g key={cents}>
          <line
            x1={x(cents)}
            x2={x(cents)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#2B211814"
            strokeWidth={1}
          />
          <text
            x={x(cents)}
            y={H - PAD.bottom + 12}
            textAnchor="middle"
            className="font-ledger"
            fontSize={8}
            fill="#2B211877"
          >
            {`$${cents / 100}`}
          </text>
        </g>
      ))}

      {/* The real curve, if it has been asked for. Behind the dots. */}
      {curve.length > 0 && (
        <>
          <polyline
            fill="none"
            stroke="#2ED9A0"
            strokeWidth={2.5}
            strokeLinejoin="round"
            points={curve.map((p) => `${x(p.priceCents)},${y(p.profit)}`).join(' ')}
          />
          {peak && (
            <line
              x1={x(peak.priceCents)}
              x2={x(peak.priceCents)}
              y1={y(peak.profit)}
              y2={H - PAD.bottom}
              stroke="#2ED9A0"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}
        </>
      )}

      {/* What the class measured: the average at each price they tried. */}
      {grouped.length > 1 && (
        <polyline
          fill="none"
          stroke="#BF3F54"
          strokeWidth={2}
          strokeLinejoin="round"
          points={grouped.map((b) => `${x(b.priceCents)},${y(b.averageProfit)}`).join(' ')}
        />
      )}

      {/* Every child, one dot. Nobody is labelled. */}
      {entries.map((item, i) => (
        <circle
          key={`${item.who}-${i}`}
          cx={x(item.priceCents)}
          cy={y(item.profit)}
          r={3.5}
          fill="#2B2118"
          fillOpacity={0.65}
        />
      ))}

      <text
        x={(W - PAD.left) / 2 + PAD.left}
        y={H - 2}
        textAnchor="middle"
        fontSize={8}
        fill="#2B211866"
        className="font-body"
      >
        price a cup
      </text>
    </svg>
  );
}
