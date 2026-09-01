/**
 * The ladder: four stages, each named twice.
 *
 * A parent played this and asked for "stages based on concepts instead of
 * days". The frustration behind that is real and the fix she reached for is
 * not: naming the stages after the economics, on the child's screen, turns a
 * game into a worksheet. What she could not do was *see the learning* — the
 * grown-up report was unreachable on a first run, and nothing anywhere said
 * which idea her kid was currently inside.
 *
 * So the stages already existed; they were only ever labelled in days. This
 * module publishes them, grouped by the concept each one teaches, with the
 * evidence from `mastery.ts` hanging underneath. Rendered in the grown-up view
 * it is a syllabus. Rendered on the child's side it is never rendered at all —
 * the child gets `ACT_TITLES[act].question`, which is the same stage asked as
 * a question worth answering.
 *
 * The honest part, and the reason this is worth building rather than writing
 * on a marketing page: a stage fills in from what the kid *did*. Nothing here
 * counts because a screen was shown. A parent can read any line, ask "when?",
 * and be given a day number and their child's own figures.
 *
 * Pure module. No React, no I/O.
 */

import { ACT_TITLES, type Act, type Game } from './progress';
import { mastery, type Skill } from './mastery';
import type { ThesisScore } from './thesis';

export type StageState = 'done' | 'here' | 'locked';

export interface Stage {
  act: Act;
  /** The child's version. Shown on the act intro, never with the concept. */
  question: string;
  /** The grown-up's version. Never shown to a child. */
  grownUpConcept: string;
  grownUpWhy: string;
  state: StageState;
  /** Every skill this stage can produce, whether or not it has. */
  skills: Skill[];
  held: number;
  emerging: number;
  outOf: number;
}

const ACTS: Act[] = [1, 2, 3, 4];

/**
 * Where the kid is on the ladder, and what each rung has actually produced.
 *
 * A stage is `done`, `here` or `locked` from the act alone — never from how
 * much of it was demonstrated. A kid who moved to Act 3 having shown one skill
 * out of three in Act 2 has finished Act 2 and shown one skill out of three,
 * and both of those are worth a parent knowing separately. Collapsing them
 * into a single "70% complete" would lose the only half that is true.
 */
export function curriculum(game: Game, theses: ThesisScore[] = []): Stage[] {
  const skills = mastery(game, theses);
  return ACTS.map((act) => {
    const mine = skills.filter((skill) => skill.act === act);
    return {
      act,
      question: ACT_TITLES[act].question,
      grownUpConcept: ACT_TITLES[act].grownUpConcept,
      grownUpWhy: ACT_TITLES[act].grownUpWhy,
      state: act < game.act ? 'done' : act === game.act ? 'here' : 'locked',
      skills: mine,
      held: mine.filter((skill) => skill.level === 'held').length,
      emerging: mine.filter((skill) => skill.level === 'emerging').length,
      outOf: mine.length,
    };
  });
}

/** Held across every stage the kid has been able to reach. */
export function reached(stages: Stage[]): { held: number; outOf: number } {
  const open = stages.filter((stage) => stage.state !== 'locked');
  return {
    held: open.reduce((sum, stage) => sum + stage.held, 0),
    outOf: open.reduce((sum, stage) => sum + stage.outOf, 0),
  };
}

/**
 * The nearest thing the kid has half-shown.
 *
 * A parent asking "what should I watch for tonight" wants one answer, and the
 * useful one is never the hardest unmet skill — it is the one already sighted
 * once, which needs a single repeat to count.
 */
export function closest(stages: Stage[]): Skill | null {
  const here = stages.filter((stage) => stage.state !== 'locked');
  for (const stage of here) {
    const emerging = stage.skills.find((skill) => skill.level === 'emerging');
    if (emerging) return emerging;
  }
  for (const stage of here) {
    const unseen = stage.skills.find((skill) => skill.level === 'unseen');
    if (unseen) return unseen;
  }
  return null;
}
