/** @vitest-environment jsdom */
/**
 * The panels behind the stand.
 *
 * `PlanScreen` was the second-worst-covered file in the product — 117
 * uncovered statements, most of them in three contiguous blocks that turned
 * out to be whole panels nobody had ever rendered: the regulars board, the
 * rival across the road, and the try-versus-try comparison.
 *
 * The last of those is the one that matters. PRODUCT.md's claim for Act 1 is
 * that a kid learns a demand curve from the bench — play the day against
 * yesterday's crowd, change one number, play it again, and be told in dollars
 * which decision did what. That comparison sheet *is* the teaching, and the
 * reason it was uncovered is instructive: it only exists after two tries with
 * different numbers, which no test had ever bothered to do.
 *
 * These render the component directly rather than driving the whole app,
 * because the states are cheap to construct here and expensive to reach from
 * the title screen — a rival only appears after a fortnight of Act 2.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanScreen } from '@/components/PlanScreen';
import {
  DEFAULT_DAY_PARAMS,
  batchPlan,
  runDay,
  type DayParams,
  type GameState,
} from '@/lib/simulation';
import { createBusinessState, type BusinessState } from '@/lib/business';
import { createGame } from '@/lib/progress';
import { canRehearse } from '@/lib/bench';

/**
 * A stand with real days behind it.
 *
 * The bench refuses to rehearse against a day it cannot replay — `canRehearse`
 * wants the seed and the forecast the day actually ran on — so the history has
 * to come from `runDay` rather than from a literal.
 */
function standWithHistory(days = 2): GameState {
  let state = createGame(31337).stand;
  for (let day = 0; day < days; day++) {
    const plan = batchPlan(state, 30);
    state = runDay(state, { ...plan.order, price: 1.5 }, DEFAULT_DAY_PARAMS).nextState;
  }
  return state;
}

const withRegulars: DayParams = {
  ...DEFAULT_DAY_PARAMS,
  serviceCapacity: 60,
  subscribers: 4,
};

function withRival(): BusinessState {
  const base = createBusinessState();
  return {
    ...base,
    rival: { active: true, price: 1.2, location: base.location, daysActive: 3 },
  };
}

function plan(props: Partial<Parameters<typeof PlanScreen>[0]> = {}) {
  return render(
    <PlanScreen
      state={standWithHistory()}
      params={withRegulars}
      business={withRival()}
      dayLabel="Day 9"
      onOpen={() => {}}
      {...props}
    />,
  );
}

/** A hotspot on the stand. Each is a button with an `aria-label`. */
function tapSpot(name: string) {
  return userEvent.click(screen.getByRole('button', { name }));
}

describe('the panels behind the stand', () => {
  afterEach(cleanup);

  it('opens the regulars board once somebody is on the round', async () => {
    plan();
    await tapSpot('Your regulars');
    expect(screen.getByText(/on your round/i)).toBeInTheDocument();
    // The discount is the whole point of a standing order, so it is named.
    expect(screen.getByText(/cheaper than the sign/i)).toBeInTheDocument();
  });

  it('says "neighbour" for one and "neighbours" for four', async () => {
    plan({ params: { ...withRegulars, subscribers: 1 } });
    await tapSpot('Your regulars');
    expect(screen.getByText(/1 neighbour\b/)).toBeInTheDocument();
    cleanup();

    plan();
    await tapSpot('Your regulars');
    expect(screen.getByText(/4 neighbours/)).toBeInTheDocument();
  });

  it('hides the regulars board when nobody has signed up', () => {
    plan({ params: { ...withRegulars, subscribers: 0 } });
    expect(screen.queryByRole('button', { name: 'Your regulars' })).not.toBeInTheDocument();
  });

  it('opens the stand across the road, and does not call it a control', async () => {
    plan();
    await tapSpot('The other stand');
    expect(screen.getByText(/They are charging/i)).toBeInTheDocument();
  });

  it('hides the rival when there is not one on this street', () => {
    plan({ business: createBusinessState() });
    expect(screen.queryByRole('button', { name: 'The other stand' })).not.toBeInTheDocument();
  });

  it('opens the crate, the sign and the cash box', async () => {
    plan();

    await tapSpot('How much to make');
    expect(screen.getByRole('slider', { name: /batch size/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^done$/i }));

    await tapSpot('What to charge per cup');
    expect(screen.getByRole('slider', { name: /price per cup/i })).toBeInTheDocument();
  });
});

describe('the bench, which is where Act 1 is supposed to be learned', () => {
  afterEach(cleanup);

  it('can rehearse against a day that really ran', () => {
    const state = standWithHistory();
    expect(canRehearse(state.history[state.history.length - 1])).toBe(true);
  });

  it('keeps a try, and shows what it made', async () => {
    plan();
    await userEvent.click(screen.getByRole('button', { name: /Try it on yesterday/i }));
    /*
     * Queried by accessible name rather than text, because the row is built
     * from several spans — "TRY", the number, the price, the batch, the
     * profit — and `getByText` only sees one text node at a time.
     */
    expect(screen.getByRole('button', { name: /Try 1/i })).toBeInTheDocument();
  });

  it('compares two tries and attributes the difference', async () => {
    /*
     * The sheet this file exists for. Two tries at *different* prices, because
     * `alreadyTried` sends an identical pair down the other path entirely — and
     * that path was the one covered, which is why this looked tested.
     */
    plan();
    const bench = () => screen.getByRole('button', { name: /Try it on yesterday/i });
    /*
     * More than one sheet can be open at once here, so "the Done button" is
     * ambiguous and the newest one is the one on top.
     */
    const closeTopSheet = async () => {
      const dones = screen.getAllByRole('button', { name: /^done$/i });
      await userEvent.click(dones[dones.length - 1]);
    };

    await userEvent.click(bench());

    /*
     * Move the price, so the second try asks a different question.
     *
     * `fireEvent.change` rather than `userEvent.keyboard('{ArrowUp}')`: arrow
     * keys on a range input do not drive React's `onChange` under jsdom, so the
     * dial looked moved and the value had not changed — which sent the second
     * try down `alreadyTried` and produced no comparison at all. The test
     * passed the wrong thing for the wrong reason until this was fixed.
     */
    await tapSpot('What to charge per cup');
    const dial = screen.getByRole('slider', { name: /price per cup/i });
    fireEvent.change(dial, { target: { value: '2.5' } });
    await closeTopSheet();

    await userEvent.click(bench());

    /*
     * "Try 2" now appears more than once, and that is the assertion: once as
     * the row on the bench, and again inside the comparison sheet that opened
     * itself the moment there was a second try to compare.
     */
    expect(screen.getAllByRole('button', { name: /Try 2/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Try 1 vs Try 2/i)).toBeInTheDocument();
    // And it attributes the gap rather than just reporting two numbers.
    expect(screen.getByText(/Try 2 against Try 1/i)).toBeInTheDocument();
  });

  it('refuses to bank the same numbers twice, and offers them back instead', async () => {
    plan();
    const bench = () => screen.getByRole('button', { name: /Try it on yesterday/i });
    await userEvent.click(bench());
    await userEvent.click(bench());
    expect(
      screen.getByRole('button', { name: /Put these numbers back on the stand/i }),
    ).toBeInTheDocument();
  });

  it('will not offer the bench with no day to rehearse against', () => {
    plan({ state: createGame(7).stand });
    expect(screen.queryByRole('button', { name: /Try it on yesterday/i })).not.toBeInTheDocument();
  });
});

describe('the goal strip and the act it belongs to', () => {
  afterEach(cleanup);

  it('shows the stage goal when there is one, instead of Act 1 arithmetic', () => {
    plan({ stage: { goal: 'Hire a manager.', day: 3, total: 16 } });
    expect(screen.getByText(/Hire a manager/)).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it('carries a note above the stand when the day is not an ordinary one', () => {
    plan({ note: 'The float is in the cash box.' });
    expect(screen.getByText(/float is in the cash box/i)).toBeInTheDocument();
  });

  it('offers the yard only when there is somewhere to spend money', () => {
    const { container } = plan({ onInvest: () => {} });
    expect(within(container).getByText(/Day 9/)).toBeInTheDocument();
  });
});
