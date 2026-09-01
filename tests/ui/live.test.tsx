/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveOpenScreen } from '@/components/acts/LiveOpenScreen';
import { catchUp, createLivePortfolio, dateOfWeek, LATEST_WEEK } from '@/lib/live';
import { buy, createPortfolio, type PortfolioState } from '@/lib/market';
import { MarketScreen } from '@/components/acts/MarketScreen';

/** Rewinds by rows of price data. See `tests/live.test.ts` for why not weeks. */
function openedRowsAgo(cash: number, rows: number): PortfolioState {
  const fresh = createLivePortfolio(cash);
  const windowStart = LATEST_WEEK - rows;
  // The anchor date has to move with it, or `rehydrate` correctly snaps the
  // account straight back to where it really belongs.
  return { ...fresh, windowStart, anchorDate: dateOfWeek(windowStart) };
}

/**
 * The one screen in the game where the world moved on its own.
 *
 * Both of its states have to be honest, and the empty one is the harder of the
 * two: a grown-up being shown this for the first time has an account that has
 * done nothing, and the temptation to manufacture a number there is exactly
 * what the rest of the product exists to refuse.
 */

describe('opening a live account that has been sitting', () => {
  const away = buy(openedRowsAgo(1000, 4), 'AAPL', 300).portfolio;
  const { portfolio, report } = catchUp(away);

  it('leads with the time that passed, not with a score', () => {
    render(
      <LiveOpenScreen portfolio={portfolio} report={report} onEnter={() => {}} onBack={() => {}} />,
    );
    // Said in whatever unit is true: the newest row is a week in progress, so
    // four rows back is three weeks and a bit.
    expect(screen.getByText(new RegExp(`${report!.weeks} weeks went by`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/Nobody pressed anything/i)).toBeInTheDocument();
  });

  it('never announces a number of weeks the calendar does not support', () => {
    render(
      <LiveOpenScreen portfolio={portfolio} report={report} onEnter={() => {}} onBack={() => {}} />,
    );
    expect(report!.weeks).toBeLessThanOrEqual(Math.floor(report!.days / 7));
    expect(screen.queryByText(/0 weeks went by/i)).not.toBeInTheDocument();
  });

  it('names the real dates it covers', () => {
    render(
      <LiveOpenScreen portfolio={portfolio} report={report} onEnter={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(new RegExp(`${report!.from} to ${report!.to}`))).toBeInTheDocument();
  });
});

describe('opening one that has done nothing yet', () => {
  const fresh = createLivePortfolio(750);

  it('says so plainly instead of inventing a number', () => {
    render(
      <LiveOpenScreen portfolio={fresh} report={null} onEnter={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/Nothing has happened yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting is most of this/i)).toBeInTheDocument();
    expect(screen.queryByText(/went by/i)).not.toBeInTheDocument();
  });

  it('still proves the market is real on the very first visit', () => {
    render(
      <LiveOpenScreen portfolio={fresh} report={null} onEnter={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/What the market did last week/i)).toBeInTheDocument();
    expect(screen.getByText(/whether you own them or not/i)).toBeInTheDocument();
  });

  it('shows the account at its real value and nothing else', () => {
    render(
      <LiveOpenScreen portfolio={fresh} report={null} onEnter={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('$750.00')).toBeInTheDocument();
  });

  it('goes to the market', async () => {
    const onEnter = vi.fn();
    render(<LiveOpenScreen portfolio={fresh} report={null} onEnter={onEnter} onBack={() => {}} />);
    await userEvent.click(screen.getByText(/Go to the market/i));
    expect(onEnter).toHaveBeenCalledOnce();
  });
});

describe('the market screen, live', () => {
  const live = createLivePortfolio(900);
  const props = {
    readiness: { criteria: [], metCount: 0, canTrade: true },
    knowsPE: true,
    badges: 12,
    studied: [] as string[],
    onResearch: () => {},
    onStartBuy: () => {},
    onSell: () => {},
    onOpenGate: () => {},
  };

  it('has no way to advance a week, because that is the whole difference', () => {
    render(<MarketScreen portfolio={live} {...props} onLeave={() => {}} />);
    expect(screen.queryByText(/Next week/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/See how you did/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Done for now/i)).toBeInTheDocument();
  });

  it('says how long it has been running instead of how much is left', () => {
    render(<MarketScreen portfolio={live} {...props} onLeave={() => {}} />);
    expect(screen.queryByText(/of 12 weeks done/i)).not.toBeInTheDocument();
    expect(screen.getByText(/this week|weeks in|A year in/i)).toBeInTheDocument();
  });

  it('still shows the counter on a replayed account', () => {
    render(
      <MarketScreen
        portfolio={createPortfolio(900, 5)}
        {...props}
        onAdvanceWeek={() => {}}
      />,
    );
    expect(screen.getByText(/of 12 weeks done/i)).toBeInTheDocument();
    expect(screen.getByText(/Next week/i)).toBeInTheDocument();
  });
});
