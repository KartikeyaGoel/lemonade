/** @vitest-environment jsdom */
/**
 * The screens that are a card on purpose, rendered rather than walked into.
 *
 * ## Why these are not left to the walk
 *
 * `tests/ui/engagement.test.tsx` fails a screen that only ever offers a child
 * one thing to press, unless it is named as a card with a reason. That check
 * is only as good as the route the walk happens to take, and the route moved:
 * giving the market a way home (§87) meant the walk could leave before
 * advancing a week, so it stopped meeting the week report at all — and the
 * allowlist entries for it went stale without anything about those screens
 * changing.
 *
 * An entry justified by "the walk saw it offer one control" is hostage to the
 * walk. These render the screens directly and assert the property itself, so
 * the engagement allowlist can point at a fact instead of at a coincidence.
 *
 * ## What "a card" has to mean
 *
 * Not "has one button". **Offers nothing to decide** — the content is the
 * thing being said, and the only control carries you onward or back. A screen
 * that offers exactly one *choice* is a different and worse thing, because a
 * choice of one is a fake choice, and it would fail here.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WeekReportScreen } from '@/components/acts/WeekReportScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { advanceWeek, createPortfolio } from '@/lib/market';
import { createClub } from '@/lib/club';

/** Controls that are on every screen and are not a decision. Same rule as the walks. */
const FURNITURE = /^(🔊|🔇|↺|Back|Back →|←|For a grown-up.*|Skip to a stage)$/i;

function decisions(): string[] {
  return [...document.querySelectorAll('button')]
    .filter((b) => !(b as HTMLButtonElement).disabled)
    .map((b) => (b.textContent ?? '').trim())
    .filter((label) => !FURNITURE.test(label));
}

describe('the week report is a readout, not a decision', () => {
  afterEach(cleanup);

  /* §49: from the real constructor. A hand-built WeekReport would be a
     screenshot of my own assumptions about what a week looks like. */
  function reportAfterAWeek() {
    let portfolio = createPortfolio(1000, 2026);
    const first = advanceWeek(portfolio);
    portfolio = first.portfolio;
    return first.report;
  }

  it('offers exactly one way on, whichever way the money went', () => {
    const report = reportAfterAWeek();
    for (const changePct of [0.08, -0.08]) {
      render(
        <WeekReportScreen
          report={{ ...report, changePct }}
          heldTickers={[]}
          onContinue={() => {}}
        />,
      );
      /* The heading is the only thing that differs between the two, and both
         strings are named in the engagement allowlist, so both are checked. */
      expect(screen.getByText(changePct >= 0 ? 'Your money grew' : 'Your money dipped')).toBeInTheDocument();
      expect(decisions(), `changePct ${changePct}`).toHaveLength(1);
      cleanup();
    }
  });

  it('carries the child onward rather than asking them something', () => {
    let went = 0;
    render(
      <WeekReportScreen report={reportAfterAWeek()} heldTickers={[]} onContinue={() => { went += 1; }} />,
    );
    const [only] = decisions();
    fireEvent.click(screen.getByText(only));
    expect(went, `"${only}" did not carry the child onward`).toBe(1);
  });
});

describe("the club's scoreboard is a readout", () => {
  afterEach(cleanup);

  it('offers nothing to decide, because the deciding was proposing and voting', () => {
    const club = createClub('The club', 'Ada', 500, 7);
    render(
      <ClubScreen club={club} me="Ada" startingCash={500} seed={7} onChange={() => {}} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByText('How are we doing', { exact: false }));

    expect(screen.getByText('How are we doing')).toBeInTheDocument();
    /* Zero, not one. Everything on it is a number the club produced, and the
       only control is the way back — which `FURNITURE` excludes. */
    expect(decisions()).toEqual([]);
  });
});
