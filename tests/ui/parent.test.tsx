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
    // Four stages: one they are standing in, three still ahead.
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
    const act4 = cold.ladder.find((stage) => stage.act === 3)!;
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

/**
 * Deleting the child's data.
 *
 * The one destructive control in the product, and the two things worth pinning
 * are both about restraint: the tap that does the damage must not be the tap
 * that was already under the parent's thumb, and the panel has to name what
 * goes rather than saying "all progress". A parent who is not told they are
 * about to lose eleven badges has not been asked anything.
 */
describe('deleting everything', () => {
  const played = {
    ...createGame(3),
    daysTraded: 12,
  };
  const record = { ...createCareer(), name: 'Ada', seasons: 2, badges: ['first-sale'] };

  function reportFor() {
    return parentReport(played, record, []);
  }

  it('takes two taps, and the first one destroys nothing', async () => {
    const onEraseAll = vi.fn();
    render(
      <ParentScreen report={reportFor()} onEraseAll={onEraseAll} onBack={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete it from this device/i }));
    expect(onEraseAll).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(onEraseAll).toHaveBeenCalledTimes(1);
  });

  it('names what goes, and offers a way out', async () => {
    const onEraseAll = vi.fn();
    render(
      <ParentScreen report={reportFor()} onEraseAll={onEraseAll} onBack={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete it from this device/i }));

    expect(screen.getByText(/2 seasons of play/i)).toBeInTheDocument();
    expect(screen.getByText(/1 badge and/i)).toBeInTheDocument();
    expect(screen.getByText(/the name Ada/i)).toBeInTheDocument();
    expect(screen.getByText(/no copy anywhere else/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /keep it/i }));
    expect(
      screen.queryByRole('button', { name: /yes, delete everything/i }),
    ).not.toBeInTheDocument();
    expect(onEraseAll).not.toHaveBeenCalled();
  });

  /* A child must never find it, and a harness must have to ask for it. */
  it('is absent unless the host passes the handler', () => {
    render(<ParentScreen report={reportFor()} onBack={() => {}} />);
    expect(
      screen.queryByRole('button', { name: /delete it from this device/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * A fresh install has nothing to lose, and the panel must not invent any.
 *
 * The placeholder name is the trap: `parentReport` substitutes "Your kid" for
 * a headline, which is right there and wrong the moment the screen offers to
 * delete it.
 */
describe('deleting everything on a fresh install', () => {
  it('names only what exists', async () => {
    render(
      <ParentScreen
        report={parentReport(createGame(1), createCareer(), [])}
        onEraseAll={() => {}}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete it from this device/i }));

    expect(screen.getByText(/the run in progress/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 badges/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/the name/i)).not.toBeInTheDocument();
  });

  it('names the child once they have typed one', async () => {
    render(
      <ParentScreen
        report={parentReport(createGame(1), createCareer('Ada'), [])}
        onEraseAll={() => {}}
        onBack={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete it from this device/i }));
    expect(screen.getByText(/the name Ada/i)).toBeInTheDocument();
  });
});

/**
 * The admin shortcut, which is the only control on this screen that belongs to
 * the person running a demo rather than to the family.
 *
 * Three render-level facts, because all three are the kind that a refactor
 * quietly loses: it is absent unless the host asks for it, it takes two taps
 * with the second one somewhere else, and it never offers the stage already on
 * screen — which is the one tap that would replace a run with the same run.
 */
describe('skipping ahead, for a demo', () => {
  const report = () => parentReport(createGame(1), createCareer(), []);

  it('is absent unless the host passes the handler', () => {
    render(<ParentScreen report={report()} onBack={() => {}} />);
    expect(screen.queryByRole('button', { name: /skip ahead/i })).not.toBeInTheDocument();
  });

  it('takes two taps, and the first one replaces nothing', async () => {
    const onJump = vi.fn();
    render(<ParentScreen report={report()} onJump={onJump} onBack={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /skip ahead to a stage/i }));
    expect(onJump).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: new RegExp(ACT_TITLES[4].name, 'i') }));
    expect(onJump).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`start at ${ACT_TITLES[4].name}`, 'i') }),
    );
    expect(onJump).toHaveBeenCalledWith(4);
  });

  it('does not offer the stage already on screen', async () => {
    const onJump = vi.fn();
    render(<ParentScreen report={report()} onJump={onJump} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /skip ahead to a stage/i }));

    // A fresh report is Act 1, so every other stage is on offer and that one
    // is not.
    expect(
      screen.queryByRole('button', { name: new RegExp(`1\\. ${ACT_TITLES[1].name}`) }),
    ).not.toBeInTheDocument();
    for (const act of [2, 3, 4] as const) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${act}\\. ${ACT_TITLES[act].name}`) }),
      ).toBeInTheDocument();
    }
  });

  it('says what it costs before it does it', async () => {
    render(<ParentScreen report={report()} onJump={() => {}} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /skip ahead to a stage/i }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(ACT_TITLES[4].name, 'i') }));

    // Names what is replaced, and offers the way out. The wording matters: a
    // demo-er should know the save is a played week rather than a finished
    // game before they put it in front of an audience.
    expect(screen.getByText(/replace this run/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pick a different one/i })).toBeInTheDocument();
  });
});
