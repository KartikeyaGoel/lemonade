import { describe, expect, it } from 'vitest';
import { ACT_TITLES, createGame, beginAct2, type Act, type Game } from '../src/lib/progress';
import { batchPlan, runDay, type GameState } from '../src/lib/simulation';
import { closest, curriculum, reached } from '../src/lib/curriculum';
import { mastery } from '../src/lib/mastery';
import { parentReport } from '../src/lib/parent';

function play(
  seed: number,
  days: number,
  decide: (state: GameState) => { price: number; cups: number },
): Game {
  let game = createGame(seed);
  for (let i = 0; i < days; i += 1) {
    if (game.stand.status !== 'playing') break;
    const { price, cups } = decide(game.stand);
    const plan = batchPlan(game.stand, cups);
    const out = runDay(game.stand, { ...plan.order, price }, { lastDay: null });
    if (!out) break;
    game = { ...game, stand: out.nextState };
  }
  return game;
}

/** Reads the queue and nothing else. Enough to light up part of stage one. */
function pricer(state: GameState) {
  const last = state.history[state.history.length - 1];
  let price = last?.price ?? 1.5;
  if (last) {
    const away = Math.max(0, last.cupsWanted - last.cupsSold);
    if (last.cupsSold >= (last.cupsMade ?? 0) && away > 0) price = Math.min(3, price + 0.25);
    else if ((last.cupsMade ?? 0) - last.cupsSold >= 4) price = Math.max(0.75, price - 0.25);
  }
  return { price, cups: 24 };
}

const ACTS: Act[] = [1, 2, 3, 4];

describe('the ladder', () => {
  it('has one rung per act, in order', () => {
    const stages = curriculum(createGame(1));
    expect(stages.map((stage) => stage.act)).toEqual(ACTS);
  });

  it('shows the whole syllabus on day zero, including the stages not yet open', () => {
    // The reason this exists at all: a parent looking at it before their kid
    // has played must still be able to see what the game teaches.
    const stages = curriculum(createGame(1));
    expect(stages).toHaveLength(4);
    for (const stage of stages) {
      expect(stage.grownUpConcept.length).toBeGreaterThan(0);
      expect(stage.outOf).toBeGreaterThan(0);
    }
  });

  it('accounts for every skill exactly once', () => {
    const game = createGame(1);
    const all = mastery(game);
    const grouped = curriculum(game).flatMap((stage) => stage.skills);
    expect(grouped.map((s) => s.id).sort()).toEqual(all.map((s) => s.id).sort());
  });

  it('marks where the kid is standing, and never from how much they showed', () => {
    const early = curriculum(createGame(1));
    expect(early.map((s) => s.state)).toEqual(['here', 'locked', 'locked', 'locked']);

    const later = curriculum(beginAct2(createGame(1)));
    expect(later.map((s) => s.state)).toEqual(['done', 'here', 'locked', 'locked']);
  });

  it('counts only the stages the kid could have reached', () => {
    const game = createGame(1);
    const open = curriculum(game).filter((s) => s.state !== 'locked');
    const total = open.reduce((sum, s) => sum + s.outOf, 0);
    expect(reached(curriculum(game)).outOf).toBe(total);
    expect(reached(curriculum(game)).held).toBe(0);
  });

  it('fills in from what a kid did, not from what they were shown', () => {
    const game = play(4242, 7, pricer);
    const stageOne = curriculum(game).find((stage) => stage.act === 1)!;
    expect(stageOne.held + stageOne.emerging).toBeGreaterThan(0);
    const shown = stageOne.skills.filter((skill) => skill.level !== 'unseen');
    for (const skill of shown) {
      expect(skill.sightings.length).toBeGreaterThan(0);
      expect(skill.sightings[0].when).toMatch(/Day|Week/);
    }
  });

  it('never names an idle player as having shown anything', () => {
    const oblivious = play(4242, 7, () => ({ price: 1.5, cups: 20 }));
    expect(reached(curriculum(oblivious)).held).toBe(0);
  });

  it('points at the nearest thing, preferring one already half shown', () => {
    const fresh = closest(curriculum(createGame(1)));
    expect(fresh).not.toBeNull();
    expect(fresh!.act).toBe(1);

    const played = curriculum(play(4242, 7, pricer));
    const emerging = played.flatMap((s) => s.skills).find((s) => s.level === 'emerging');
    if (emerging) expect(closest(played)!.level).toBe('emerging');
  });

  it('has nothing to point at once every reachable skill is held', () => {
    const stages = curriculum(createGame(1)).map((stage) => ({
      ...stage,
      state: 'locked' as const,
    }));
    expect(closest(stages)).toBeNull();
  });
});

describe('the two registers', () => {
  it('gives every act a question for the kid and a concept for the grown-up', () => {
    for (const act of ACTS) {
      const title = ACT_TITLES[act];
      expect(title.question.endsWith('?')).toBe(true);
      expect(title.grownUpConcept).not.toBe(title.question);
      expect(title.grownUpWhy.length).toBeGreaterThan(40);
    }
  });

  it('never puts the grown-up wording in the kid-facing fields', () => {
    // The whole argument for two registers is that a child never reads the
    // second one. If a concept noun leaks into `name`, `promise` or
    // `question`, the stage has become a chapter heading.
    const jargon = /margin|capital|valuation|equity|earnings|unit economics|fixed cost/i;
    for (const act of ACTS) {
      const title = ACT_TITLES[act];
      expect(jargon.test(title.question), `act ${act} question`).toBe(false);
      expect(jargon.test(title.name), `act ${act} name`).toBe(false);
      expect(jargon.test(title.promise), `act ${act} promise`).toBe(false);
    }
  });
});

describe('the report a parent opens before their kid has played', () => {
  const cold = parentReport(createGame(1));

  it('still says what the game teaches', () => {
    expect(cold.ladder).toHaveLength(4);
    expect(cold.ladder.map((s) => s.grownUpConcept).join(' ')).toContain('margin');
  });

  it('claims nothing', () => {
    expect(cold.understanding).toEqual([]);
    expect(reached(cold.ladder).held).toBe(0);
    expect(cold.ladderLine).toContain('not started');
  });

  it('says out loud where the evidence comes from', () => {
    expect(cold.ladderLine).toMatch(/never from something they are told/);
  });

  it('reports honestly once there is something to report', () => {
    const warm = parentReport(play(4242, 7, pricer));
    expect(warm.ladderLine).not.toContain('not started');
    expect(warm.ladder.find((s) => s.act === 1)!.skills.some((s) => s.sightings.length > 0)).toBe(
      true,
    );
  });
});
