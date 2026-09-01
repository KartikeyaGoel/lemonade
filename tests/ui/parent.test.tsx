/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleScreen } from '@/components/TitleScreen';
import { ParentScreen } from '@/components/acts/ParentScreen';
import { ActIntroScreen } from '@/components/acts/ActIntroScreen';
import { parentReport } from '@/lib/parent';
import { ACT_TITLES, createGame } from '@/lib/progress';
import { road, roadLine } from '@/lib/journey';
import { createCareer } from '@/lib/career';

/**
 * The route a parent takes, and what they find at the end of it.
 *
 * A customer played the deployed build and asked for the learning to be made
 * visible. The cause turned out to be structural rather than editorial: the
 * grown-up report was hidden until the kid had finished a run, so the person
 * deciding whether this teaches anything was shown a lemonade stand and no
 * evidence at all. Both halves of that are render-level facts, so both are
 * pinned here.
 */

const game = createGame(1);
const career = createCareer();

describe('reaching the grown-up view', () => {
  it('is reachable on a completely fresh install', () => {
    const onParent = vi.fn();
    render(
      <TitleScreen
        onStart={() => {}}
        hasSave={false}
        onParent={onParent}
        parentLabel="For a grown-up: what this teaches"
        road={{ stops: road(game), line: roadLine(game, career) }}
      />,
    );
    expect(screen.getByText(/what this teaches/i)).toBeInTheDocument();
  });

  it('actually opens it', async () => {
    const onParent = vi.fn();
    render(
      <TitleScreen onStart={() => {}} hasSave={false} onParent={onParent} />,
    );
    await userEvent.click(screen.getByText(/for a grown-up/i));
    expect(onParent).toHaveBeenCalledOnce();
  });

  it('does not turn the first screen into a menu to do it', () => {
    // One button, plus the road, plus a quiet pill. If the grown-up link ever
    // becomes a fifth thing competing with "Start selling", the entry is gone.
    render(<TitleScreen onStart={() => {}} hasSave={false} onParent={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('what a parent finds there before their kid has played', () => {
  const cold = parentReport(game);

  it('names all four stages by what they teach', () => {
    render(<ParentScreen report={cold} onBack={() => {}} />);
    for (const stage of cold.ladder) {
      expect(screen.getByText(stage.grownUpConcept)).toBeInTheDocument();
    }
  });

  it('shows the stages ahead rather than hiding them', () => {
    render(<ParentScreen report={cold} onBack={() => {}} />);
    expect(screen.getAllByText('Ahead')).toHaveLength(3);
    expect(screen.getByText('Here now')).toBeInTheDocument();
  });

  it('claims nothing, and says where the evidence will come from', () => {
    render(<ParentScreen report={cold} onBack={() => {}} />);
    expect(screen.getByText(/never from something they are told/i)).toBeInTheDocument();
    expect(screen.getByText(/because the game showed them a word/i)).toBeInTheDocument();
    expect(screen.queryByText('What they can do')).not.toBeInTheDocument();
  });

  it('lists the skills of a locked stage without pretending they were missed', () => {
    render(<ParentScreen report={cold} onBack={() => {}} />);
    const act4 = cold.ladder.find((stage) => stage.act === 4)!;
    for (const skill of act4.skills) {
      expect(screen.getByText(skill.grownUpName)).toBeInTheDocument();
    }
  });
});

describe('the child never sees the grown-up register', () => {
  it('opens an act with the question, not the concept', () => {
    for (const act of [2, 3, 4] as const) {
      const { unmount } = render(
        <ActIntroScreen act={act} wall="Something is in the way." cash={50} onBegin={() => {}} />,
      );
      expect(screen.getByText(ACT_TITLES[act].question)).toBeInTheDocument();
      expect(screen.queryByText(ACT_TITLES[act].grownUpConcept)).not.toBeInTheDocument();
      expect(screen.queryByText(ACT_TITLES[act].grownUpWhy)).not.toBeInTheDocument();
      unmount();
    }
  });
});
