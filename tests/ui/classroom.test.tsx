/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassroomScreen } from '@/components/meta/ClassroomScreen';
import { entry } from '@/lib/classroom';

/**
 * The board a teacher runs live, in front of thirty children.
 *
 * There is no second chance at a lesson, so the failure modes worth testing are
 * the ones that would waste one: a code that will not copy, an entry that will
 * not go in, the answer showing before the measurement.
 */

const CLASS = [
  entry('ADA', 100, 98),
  entry('LEE', 120, 152),
  entry('SAM', 140, 171),
  entry('KIT', 150, 190),
  entry('JO', 160, 205),
  entry('MO', 170, 181),
  entry('ZED', 300, -22),
];

function board(entries = CLASS, onChange = vi.fn()) {
  render(
    <ClassroomScreen
      seed={2026}
      entries={entries}
      onChange={onChange}
      onNewCode={() => {}}
      onBack={() => {}}
    />,
  );
  return onChange;
}

describe('setting up', () => {
  it('puts a code on screen that a child can type into the game they have', () => {
    board([]);
    expect(screen.getByText(/^SKY-/)).toBeInTheDocument();
    expect(screen.getByText(/Same sky/i)).toBeInTheDocument();
  });

  it('says there is nothing to look at yet rather than drawing an empty curve', () => {
    board([]);
    expect(screen.getByText(/Nothing on the board yet/i)).toBeInTheDocument();
  });
});

describe('collecting results', () => {
  it('takes two numbers and a name nobody has to type', async () => {
    const onChange = board([]);
    await userEvent.type(screen.getByLabelText('Price'), '1.75');
    await userEvent.type(screen.getByLabelText('Made'), '41.20');
    await userEvent.click(screen.getByRole('button', { name: /add to the board/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ priceCents: 175, profit: 41.2 }),
    ]);
  });

  it('refuses a result with no price rather than plotting a zero', async () => {
    const onChange = board([]);
    await userEvent.type(screen.getByLabelText('Made'), '40');
    await userEvent.click(screen.getByRole('button', { name: /add to the board/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts a child who lost money', async () => {
    const onChange = board([]);
    await userEvent.type(screen.getByLabelText('Price'), '3.00');
    await userEvent.type(screen.getByLabelText('Made'), '-22');
    await userEvent.click(screen.getByRole('button', { name: /add to the board/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ profit: -22 })]);
  });

  it('lets a mistyped entry be taken back off', async () => {
    const onChange = board();
    await userEvent.click(screen.getByLabelText(/Remove ADA/i));
    expect(onChange).toHaveBeenCalledWith(CLASS.filter((item) => item.who !== 'ADA'));
  });
});

describe('the lesson', () => {
  it('plots one dot per child and never names one on the chart', () => {
    board();
    const chart = screen.getByRole('img');
    expect(chart.querySelectorAll('circle')).toHaveLength(CLASS.length);
    expect(chart.textContent).not.toMatch(/ADA|LEE|SAM|KIT/);
  });

  it('keeps the answer back until the teacher asks for it', async () => {
    board();
    // The order is the lesson. Showing the curve first turns thirty
    // experiments into thirty guesses at something the computer already knew.
    expect(screen.queryByText(/played at every price/i)).not.toBeInTheDocument();
    const reveal = screen.getByRole('button', { name: /show what the week could have done/i });
    await userEvent.click(reveal);
    expect(screen.getByText(/played at every price/i)).toBeInTheDocument();
  });

  it('does not offer the reveal before the shape means anything', () => {
    board(CLASS.slice(0, 2));
    expect(
      screen.queryByRole('button', { name: /show what the week could have done/i }),
    ).not.toBeInTheDocument();
  });

  it('tells the class what they found, in their own numbers', () => {
    board();
    expect(screen.getByText(/7 children, 7 different prices, one identical week/i)).toBeInTheDocument();
    expect(screen.getByText(/Best on average: \$1\.60/i)).toBeInTheDocument();
    expect(screen.getByText(/1 lost money/i)).toBeInTheDocument();
  });
});
