/** @vitest-environment jsdom */
/**
 * The demo shortcut offers every stage, including the one you are standing on.
 *
 * ## The defect
 *
 * Reported from outside the build: *"the shortcut for market seems to have gone
 * away in the game."*
 *
 * It had. `JumpBlock` filtered the stage list by `stage.act !== at`, hiding
 * whichever stage the save was currently in, on the reasoning that this
 * "removes the only tap that would replace a run with an identical one". The
 * consequence was that **using the shortcut removed the shortcut**: jump to the
 * market, and the market is no longer on the list. The market is the stage
 * anybody demonstrating this game shows, so the one tap that mattered was the
 * one that deleted itself.
 *
 * And the premise was false. `demoGame(act)` *plays the stage forward from a
 * seed*, so the save it hands over is a fresh one. A demo-er who has bought a
 * share or advanced a week does not have that save any more, and resetting to
 * a clean stage is the thing a demo needs most, because a demo happens more
 * than once.
 *
 * ## Why this is a count and not a walk
 *
 * §9's rule: when something has to be complete, enumerate it. There are four
 * stages and four places to stand, so the whole space is sixteen cases and
 * there is no reason to sample it. A walk would have to reach the grown-up
 * screen from an act-4 save and then read a list — and `tests/ui/soak.test.tsx`
 * did reach this screen, many times, and could not have noticed: every row it
 * was offered worked. The missing row is invisible to anything that measures
 * what it was shown.
 *
 * ## What this would miss
 *
 * That the jump *works*. It checks the list is complete and the copy is honest
 * about a reset; `tests/demo.test.ts` is what proves each stage's save is
 * playable. Both were checked in the browser: re-jumping to the market on a
 * portfolio dirtied to week 7 and $3.21 put it back to week 0 and $4,760.14.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ParentScreen } from '@/components/acts/ParentScreen';
import { parentReport } from '@/lib/parent';
import { DEMO_STAGES, demoGame } from '@/lib/demo';
import { createCareer } from '@/lib/career';
import type { Act } from '@/lib/progress';

const ACTS: Act[] = [1, 2, 3, 4];

/** The grown-up screen, on a real save for that stage, with the list open. */
function openJumpList(act: Act) {
  render(
    <ParentScreen
      report={parentReport(demoGame(act), createCareer())}
      onJump={() => {}}
      onBack={() => {}}
    />,
  );
  fireEvent.click(screen.getByText('Skip ahead to a stage'));
}

describe('the demo shortcut', () => {
  afterEach(cleanup);

  it('offers all four stages from every stage, so using it cannot remove it', () => {
    const missing: string[] = [];

    for (const at of ACTS) {
      openJumpList(at);
      const text = document.body.textContent ?? '';
      for (const stage of DEMO_STAGES) {
        /* `N. Name`, the row's own heading, so a mention in prose elsewhere on
           the screen cannot stand in for a row that is not there. */
        if (!text.includes(`${stage.act}. ${stage.name}`)) {
          missing.push(`standing on act ${at}: no row for ${stage.act}. ${stage.name}`);
        }
      }
      cleanup();
    }

    expect(missing, 'a stage the demo shortcut would not offer').toEqual([]);
  });

  it('marks the stage you are on rather than hiding it', () => {
    for (const at of ACTS) {
      openJumpList(at);
      const here = DEMO_STAGES.find((s) => s.act === at)!;
      expect(screen.getByText('you are here')).toBeInTheDocument();
      expect(
        screen.getByText('Start this stage again, on a fresh save.'),
        `act ${at} does not say what tapping its own row does`,
      ).toBeInTheDocument();
      /* The promise line is the *other* rows' subtitle, so the marked row
         having replaced it is what stops the tap looking like a no-op. */
      expect(document.body.textContent).toContain(`${here.act}. ${here.name}`);
      cleanup();
    }
  });

  it('calls a reset a reset, and a jump a jump', () => {
    /* Standing in the market, tapping the market is a restart. */
    openJumpList(4);
    fireEvent.click(screen.getByText('4. Markets', { exact: false }));
    expect(screen.getByText(/Start Markets again, from a save played fresh up to it\?/)).toBeInTheDocument();
    expect(screen.getByText('Start Markets again')).toBeInTheDocument();
    cleanup();

    /* Standing in act 1, tapping the market replaces the run. */
    openJumpList(1);
    fireEvent.click(screen.getByText('4. Markets', { exact: false }));
    expect(
      screen.getByText(/Replace this run with a game that has been played up to Markets\?/),
    ).toBeInTheDocument();
    expect(screen.getByText('Start at Markets')).toBeInTheDocument();
  });

  it('hands back the act that was picked', () => {
    const jumped: Act[] = [];
    render(
      <ParentScreen
        report={parentReport(demoGame(4), createCareer())}
        onJump={(act) => jumped.push(act)}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Skip ahead to a stage'));
    fireEvent.click(screen.getByText('4. Markets', { exact: false }));
    fireEvent.click(screen.getByText('Start Markets again'));
    expect(jumped, 'the market row did not ask for the market').toEqual([4]);
  });
});
