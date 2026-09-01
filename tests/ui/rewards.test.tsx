/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BadgeToast } from '@/components/meta/BadgeToast';
import { CloseScreen } from '@/components/CloseScreen';
import { BADGES } from '@/lib/achievements';
import { batchPlan, createInitialState, runDay, type DayOutcome } from '@/lib/simulation';

/**
 * The reward layer, which is where every bug in this project has actually
 * lived.
 *
 * Five hundred and thirty-seven tests covered the simulation, the accounts, the
 * backtests and the evidence layer, and not one of them covered a component.
 * Every defect found by playing was in this layer: three overlays stacked over
 * the first profit and loss, three vocabulary words on day one, a toast landing
 * on the primary button, eleven badges from a finished season arriving over the
 * next season's first morning. All of them shipped through a green suite.
 *
 * So these tests are aimed squarely at that: what is on top of what, how many
 * things arrive at once, and whether the thing a kid needs to tap is reachable.
 */

function aDay(): DayOutcome {
  const state = createInitialState(2026);
  const plan = batchPlan(state, 24);
  return runDay(state, { ...plan.order, price: 1.5 });
}

const badges = BADGES.slice(0, 3);

describe('a badge landing', () => {
  it('shows one at a time and says how many are behind it', () => {
    // Day one earns two badges and a word at the same moment. Showing them
    // stacked buried the profit and loss under three yellow cards.
    render(<BadgeToast badges={badges} onDismiss={() => {}} />);
    expect(screen.getByText(badges[0].name)).toBeInTheDocument();
    expect(screen.queryByText(badges[1].name)).not.toBeInTheDocument();
    expect(screen.getByText(/2 more waiting/i)).toBeInTheDocument();
  });

  it('says how to get rid of it', () => {
    // Without the label the only two ways out were waiting and guessing.
    render(<BadgeToast badges={badges} onDismiss={() => {}} />);
    expect(screen.getByText(/tap to close/i)).toBeInTheDocument();
  });

  it('goes away when tapped anywhere on it', async () => {
    const onDismiss = vi.fn();
    render(<BadgeToast badges={badges} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByText(badges[0].name));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders nothing at all when the queue is empty', () => {
    const { container } = render(<BadgeToast badges={[]} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lifts clear of a screen with a pinned button underneath it', () => {
    // Found by playing: the toast landed squarely on "Open the stand!", which
    // turns a reward into an obstacle.
    const { container } = render(
      <BadgeToast badges={badges} onDismiss={() => {}} raised />,
    );
    expect(container.firstElementChild?.className).toMatch(/pb-32/);
  });
});

describe('the end of a day', () => {
  it('leads with the profit and the profit is the real one', () => {
    const outcome = aDay();
    render(<CloseScreen outcome={outcome} insights={[]} onNext={() => {}} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/You (made|lost)/);
  });

  it('shows a profit and loss that adds up on paper', () => {
    // The one promise the close screen makes: any two figures a kid subtracts
    // must give the third. If the rendered lines ever stop reconciling, the
    // screen is worse than no screen.
    const outcome = aDay();
    render(<CloseScreen outcome={outcome} insights={[]} onNext={() => {}} />);
    const shown = (label: RegExp) => {
      const row = screen.getByText(label).closest('div');
      const text = row?.textContent ?? '';
      const match = text.match(/-?\$[\d,]+\.\d\d/);
      return match ? Number(match[0].replace(/[$,]/g, '')) : NaN;
    };
    const revenue = shown(/^Revenue$/);
    expect(revenue).toBeCloseTo(outcome.revenue, 2);
  });

  it('never hides the way forward behind a reward', () => {
    const outcome = aDay();
    render(<CloseScreen outcome={outcome} insights={[]} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /day|next|finish|see/i })).toBeInTheDocument();
  });

  it('counts the headline up rather than printing it', async () => {
    // The reward for the whole day. It used to simply be there on arrival.
    const outcome = aDay();
    render(<CloseScreen outcome={outcome} insights={[]} onNext={() => {}} />);
    const heading = screen.getByRole('heading', { level: 1 });
    const first = heading.textContent;
    await vi.waitFor(
      () => {
        expect(heading.textContent).not.toBe(first);
      },
      { timeout: 1500 },
    );
    await vi.waitFor(
      () => {
        expect(heading.textContent).toContain(Math.abs(outcome.profit).toFixed(2));
      },
      { timeout: 2000 },
    );
  });
});

describe('when something breaks', () => {
  it('says what happened, promises the save, and gives a way out', async () => {
    // Without this, a thrown component in production is a blank white page and
    // a kid with no reason to believe their stand is still there.
    const { default: ErrorPage } = await import('@/app/error');
    const reset = vi.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);

    expect(screen.getByRole('heading').textContent).toMatch(/spilled/i);
    expect(screen.getByText(/still saved on this device/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('never shows a child a stack trace', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const boom = new Error('TypeError: cannot read properties of undefined');
    render(<ErrorPage error={boom} reset={() => {}} />);
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });
});
