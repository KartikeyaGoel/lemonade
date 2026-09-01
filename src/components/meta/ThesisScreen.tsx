'use client';

import { useState } from 'react';
import { MODELS, metricsFor, type Company } from '@/lib/companies';
import { QUAL_CLAIMS, QUANT_CLAIMS, checkQuant } from '@/lib/thesis';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * Write the reason before the money moves.
 *
 * The most dangerous habit this product could teach by accident is "I bought it
 * because it went up". So nothing is bought here without a sentence in two
 * halves — a number reason that gets checked against the company's own figures,
 * and a story reason in the kid's words.
 *
 * When the number reason does not hold, the screen says so, shows the division,
 * and *still lets them buy*. Blocking would teach obedience. Recording the
 * mismatch and grading it twelve weeks later teaches consequence, which is the
 * thing we are actually after.
 */
export function ThesisScreen({
  company,
  price,
  asOf,
  maxDollars,
  actionLabel,
  onCancel,
  onConfirm,
}: {
  company: Company;
  /**
   * The price being paid right now, which is a real historical close rather
   * than today's. Every claim is checked against it.
   */
  price: number;
  /** The real week being replayed, so claims are judged on what was public. */
  asOf: string;
  maxDollars: number;
  actionLabel: string;
  onConfirm: (quantId: string, qualId: string, dollars: number) => void;
  onCancel: () => void;
}) {
  const [dollars, setDollars] = useState(() =>
    Math.max(1, Math.floor(Math.min(maxDollars, maxDollars * 0.6))),
  );
  const [quantId, setQuantId] = useState<string | null>(null);
  const [qualId, setQualId] = useState<string | null>(null);
  const [override, setOverride] = useState(false);

  const metrics = metricsFor(company, price, asOf);
  const check = quantId ? checkQuant(quantId, company, price, asOf) : null;
  const qual = qualId ? QUAL_CLAIMS.find((claim) => claim.id === qualId) : null;
  const ready = Boolean(quantId && qualId);
  const mismatch = Boolean(check && !check.holds);
  const contradiction = Boolean(qual?.bearish);
  const needsOverride = ready && (mismatch || contradiction) && !override;

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-4xl">
            {company.emoji}
          </span>
          <div>
            <SignHeading className="!text-lemon-light text-3xl">{company.name}</SignHeading>
            <div className="font-body text-[11px] font-extrabold uppercase tracking-wide text-white/55">
              {money(price)} a share ·{' '}
              {metrics.pe ? `P/E ${metrics.pe.toFixed(0)}` : 'no P/E — it loses money'} ·{' '}
              {MODELS[company.model].name}
            </div>
          </div>
        </div>

        {/* How much */}
        <div className="mt-5 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            How much
          </div>
          <div className="font-sign text-5xl leading-none text-white">{money(dollars)}</div>
          <input
            aria-label="How much to put in"
            className="slider mt-3"
            type="range"
            min={1}
            max={Math.max(1, Math.floor(maxDollars))}
            step={1}
            value={dollars}
            onChange={(event) => setDollars(Number(event.target.value))}
            style={{ ['--fill' as string]: `${(dollars / Math.max(1, maxDollars)) * 100}%` }}
          />
          <div className="font-body text-[11px] font-bold text-white/55">
            Most you can put in right now: {money(maxDollars)}
          </div>
        </div>

        {/* The number half */}
        <div className="mt-5">
          <div className="px-1 font-sign text-xl text-lemon-light">Why, by the numbers</div>
          <div className="mt-2 space-y-2">
            {QUANT_CLAIMS.map((claim) => {
              const picked = quantId === claim.id;
              return (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => {
                    setQuantId(claim.id);
                    setOverride(false);
                  }}
                  className={`w-full rounded-2xl border-[3px] p-3 text-left ${
                    picked ? 'border-lemon bg-white' : 'border-white/20 bg-white/5'
                  }`}
                >
                  <div
                    className={`font-body text-[13px] font-extrabold leading-tight ${
                      picked ? 'text-ink' : 'text-white/85'
                    }`}
                  >
                    {claim.label}
                  </div>
                  {picked && (
                    <div
                      className={`mt-1.5 rounded-xl border-2 px-2.5 py-1.5 font-body text-[12px] font-bold leading-snug ${
                        check!.holds
                          ? 'border-mint/60 bg-mint/20 text-ink/80'
                          : 'border-berry/50 bg-berry/10 text-ink/80'
                      }`}
                    >
                      <span className="font-extrabold">
                        {check!.holds ? '✓ The numbers agree. ' : '✕ The numbers do not agree. '}
                      </span>
                      {check!.evidence}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* The story half */}
        <div className="mt-5">
          <div className="px-1 font-sign text-xl text-lemon-light">And why, in your words</div>
          <p className="mt-0.5 px-1 font-body text-[11px] font-bold text-white/50">
            {company.story}
          </p>
          <div className="mt-2 space-y-2">
            {QUAL_CLAIMS.map((claim) => {
              const picked = qualId === claim.id;
              return (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => {
                    setQualId(claim.id);
                    setOverride(false);
                  }}
                  className={`w-full rounded-2xl border-[3px] p-3 text-left ${
                    picked ? 'border-lemon bg-white' : 'border-white/20 bg-white/5'
                  }`}
                >
                  <div
                    className={`font-body text-[13px] font-extrabold leading-tight ${
                      picked ? 'text-ink' : 'text-white/85'
                    }`}
                  >
                    {claim.label}
                  </div>
                  {picked && claim.bearish && (
                    <div className="mt-1.5 rounded-xl border-2 border-berry/50 bg-berry/10 px-2.5 py-1.5 font-body text-[12px] font-bold leading-snug text-ink/80">
                      <span className="font-extrabold">Hang on. </span>
                      That is a reason to expect it to do <em>worse</em>. It is a fine reason to
                      sell, and an odd one to buy on.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t-[3px] border-white/15 bg-[#16203A] px-4 pb-5 pt-8">
        {needsOverride ? (
          <>
            <div className="mb-2 rounded-xl border-[3px] border-berry/50 bg-berry/15 px-3 py-2 font-body text-[12px] font-bold text-white">
              You can still do it. We will write down that the reason did not hold, and in twelve
              weeks you will find out whether that mattered.
            </div>
            <ChunkyButton variant="wood" full onClick={() => setOverride(true)}>
              Do it anyway
            </ChunkyButton>
          </>
        ) : (
          <ChunkyButton
            variant="lemon"
            full
            disabled={!ready}
            onClick={() => ready && onConfirm(quantId!, qualId!, dollars)}
          >
            {ready ? `${actionLabel} — ${money(dollars)} →` : 'Pick both halves of the reason'}
          </ChunkyButton>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-1 font-body text-xs font-extrabold uppercase tracking-wide text-white/50"
        >
          Cancel
        </button>
      </div>
    </Sky>
  );
}
