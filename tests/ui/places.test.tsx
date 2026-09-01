/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandScene } from '@/components/StandScene';
import { YardScene } from '@/components/YardScene';
import { InvestScreen } from '@/components/acts/InvestScreen';
import { FriendsScreen } from '@/components/meta/FriendsScreen';
import { createBusinessState } from '@/lib/business';
import { desks } from '@/lib/friends';
import { createCareer } from '@/lib/career';
import { plots } from '@/lib/yard';

/**
 * The screens that were turned from forms into places.
 *
 * The whole argument for those rewrites is that a kid can read the plan at a
 * glance without opening anything, and that the numbers written on the objects
 * are the real ones. Both of those are properties of the render, so both belong
 * here rather than in a doc comment.
 */

const SCENE = {
  price: 1.75,
  cupsReady: 24,
  costToBuy: 9.5,
  marginPerCup: 1.16,
  losesMoney: false,
  capacity: 30,
  atCapacity: false,
  regulars: 0,
  regularPrice: 1.6,
  rivalPrice: null,
  kitLabel: null,
  showTapHint: false,
};

describe('the stand as a place', () => {
  it('writes the whole plan on the objects, so nothing has to be opened', () => {
    render(<StandScene {...SCENE} active={null} onSelect={() => {}} />);
    expect(screen.getByText('$1.75')).toBeInTheDocument();
    expect(screen.getByText('24 cups')).toBeInTheDocument();
    expect(screen.getByText('$1.16')).toBeInTheDocument();
    expect(screen.getByText(/you keep/i)).toBeInTheDocument();
  });

  it('does not put a toolbox on a stand with nothing on it', () => {
    // Act 1 has nothing to buy, and a spot that opens onto an empty shop is a
    // dead end dressed up as a feature.
    render(<StandScene {...SCENE} active={null} onSelect={() => {}} />);
    expect(screen.queryByLabelText(/your stand/i)).not.toBeInTheDocument();

    render(<StandScene {...SCENE} kitLabel="cooler" active={null} onSelect={() => {}} />);
    expect(screen.getByLabelText(/your stand/i)).toBeInTheDocument();
  });

  it('hides the rival until there is one, and shows their price when there is', () => {
    render(<StandScene {...SCENE} active={null} onSelect={() => {}} />);
    expect(screen.queryByLabelText(/other stand/i)).not.toBeInTheDocument();

    render(<StandScene {...SCENE} rivalPrice={1.4} active={null} onSelect={() => {}} />);
    expect(within(screen.getByLabelText(/other stand/i)).getByText('$1.40')).toBeInTheDocument();
  });

  it('opens the thing you tapped', async () => {
    const onSelect = vi.fn();
    render(<StandScene {...SCENE} active={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByLabelText(/what to charge/i));
    expect(onSelect).toHaveBeenCalledWith('price');
  });

  it('marks the margin in red when every cup loses money', () => {
    render(<StandScene {...SCENE} marginPerCup={-0.2} losesMoney active={null} onSelect={() => {}} />);
    expect(screen.getByText('-$0.20').className).toMatch(/berry/);
  });
});

describe('the plot of land', () => {
  const bare = createBusinessState();

  it('shows what is not bought yet, with the price on it', () => {
    // The empty dashed plots are what make tomorrow's profit feel like it is
    // for something.
    render(
      <YardScene plots={plots(bare, 1000)} atPark={false} active={null} onSelect={() => {}} />,
    );
    expect(screen.getByLabelText(/Ice cooler, \$35.00 once/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Helper, \$12.00 a day/i)).toBeInTheDocument();
  });

  it('carries the wage on a person for as long as they work there', () => {
    // Where a thing stands is what kind of spending it is, and a wage that
    // stops being mentioned once it is agreed stops being a wage.
    const hired = { ...bare, staff: { ...bare.staff, helper: true } };
    render(
      <YardScene plots={plots(hired, 1000)} atPark={false} active={null} onSelect={() => {}} />,
    );
    expect(screen.getByText('$12.00/day')).toBeInTheDocument();
  });

  it('says "yours" and nothing about money once a thing is bought outright', () => {
    const owned = { ...bare, upgrades: { ...bare.upgrades, cooler: true } };
    render(
      <YardScene plots={plots(owned, 1000)} atPark={false} active={null} onSelect={() => {}} />,
    );
    const cooler = screen.getByLabelText('Ice cooler');
    expect(within(cooler).getByText('yours')).toBeInTheDocument();
    expect(within(cooler).queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe('buying something in Act 2', () => {
  const props = {
    business: createBusinessState(),
    onBuyUpgrade: vi.fn(),
    onToggleStaff: vi.fn(),
    onMove: vi.fn(),
    onDone: vi.fn(),
  };

  it('prices a wage in cups, which is the only unit a kid can judge', async () => {
    render(<InvestScreen cash={200} marginPerCup={1.5} typicalCupsSold={28} {...props} />);
    await userEvent.click(screen.getByLabelText(/Helper, \$12.00 a day/i));
    expect(screen.getByText(/8 cups/)).toBeInTheDocument();
    expect(screen.getByText(/every day, before it has paid for itself/i)).toBeInTheDocument();
  });

  it('warns before the money moves when the queue is shorter than the stand', async () => {
    render(<InvestScreen cash={200} marginPerCup={1.5} typicalCupsSold={15} {...props} />);
    await userEvent.click(screen.getByLabelText(/Ice cooler/i));
    expect(screen.getByText(/room going spare/i)).toBeInTheDocument();
  });

  it('stays quiet when the stand is genuinely full', async () => {
    render(<InvestScreen cash={200} marginPerCup={1.5} typicalCupsSold={30} {...props} />);
    await userEvent.click(screen.getByLabelText(/Ice cooler/i));
    expect(screen.queryByText(/room going spare/i)).not.toBeInTheDocument();
  });

  it('says what is missing rather than just refusing', async () => {
    render(<InvestScreen cash={10} marginPerCup={1.5} typicalCupsSold={30} {...props} />);
    await userEvent.click(screen.getByLabelText(/Ice cooler/i));
    const buy = screen.getByRole('button', { name: /need \$25\.00 more/i });
    expect(buy).toBeDisabled();
  });
});

describe('the friends desk', () => {
  const props = { onOpen: vi.fn(), onBack: vi.fn() };
  const list = (unlocked: { challenge: boolean; club: boolean; table: boolean }) =>
    desks({ career: createCareer(), club: null, me: 'SAM', cards: [], unlocked });

  it('shows what is locked, with what opens it, rather than hiding it', () => {
    render(<FriendsScreen desks={list({ challenge: false, club: false, table: false })} {...props} />);
    expect(screen.getByText(/Play two days at your stand/i)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) {
      if (/Investment club|Same sky|The table/.test(button.textContent ?? '')) {
        expect(button).toBeDisabled();
      }
    }
  });

  it('opens the one that is unlocked', async () => {
    const onOpen = vi.fn();
    render(
      <FriendsScreen
        desks={list({ challenge: true, club: false, table: false })}
        onOpen={onOpen}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByText(/Same sky/i));
    expect(onOpen).toHaveBeenCalledWith('challenge');
  });
});
