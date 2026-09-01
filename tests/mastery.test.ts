import { describe, expect, it } from 'vitest';
import { createGame, type Game } from '../src/lib/progress';
import { batchPlan, runDay, type DayRecord, type GameState } from '../src/lib/simulation';
import { mastery, masteryLine, reachable, tally, type SkillId } from '../src/lib/mastery';

/**
 * Plays a stretch of days the way a given kid would.
 *
 * `decide` sees exactly what a player sees — the state, the forecast, and
 * everything that has already happened — and never the weather before it
 * happens.
 */
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

const held = (game: Game): SkillId[] =>
  mastery(game)
    .filter((skill) => skill.level === 'held')
    .map((skill) => skill.id);

const levelOf = (game: Game, id: SkillId) =>
  mastery(game).find((skill) => skill.id === id)!.level;

/* ------------------------------------------------------------------ *
 * Three players
 *
 * Each understands one thing and not the other, which is what makes this a
 * test of the measurement rather than a test of the simulation.
 * ------------------------------------------------------------------ */

/** Understands the queue. Never looks at the sky: same batch every morning. */
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

/** Understands the sky. Never touches the price. */
function forecaster(state: GameState) {
  const size = { 'probably-hot': 36, 'probably-mild': 22, 'probably-cold': 12 } as const;
  return { price: 1.5, cups: size[state.forecast] };
}

/** Understands neither. Same price, same batch, every single day. */
function oblivious(_state: GameState) {
  return { price: 1.5, cups: 20 };
}

describe('telling understanding apart from activity', () => {
  it('scores a kid who reads the queue, and only for that', () => {
    // This is the test the whole product rests on. If the game cannot tell a
    // child who adjusts from a child who does not, it is not teaching
    // anything, and no amount of vocabulary on the screen changes that.
    const game = play(2026, 16, pricer);
    expect(held(game)).toContain('reads-the-queue');
    expect(held(game)).not.toContain('bets-on-the-forecast');
  });

  it('scores a kid who reads the sky, and only for that', () => {
    const game = play(2026, 16, forecaster);
    expect(held(game)).toContain('bets-on-the-forecast');
    expect(held(game)).not.toContain('reads-the-queue');
  });

  it('scores a kid who does neither on nothing at all', () => {
    // Sixteen days of play, a stand full of money, and no claim made about
    // what they understand. That refusal is the whole point.
    const game = play(2026, 16, oblivious);
    expect(game.stand.cash).toBeGreaterThan(200);
    expect(held(game)).toEqual([]);
    expect(mastery(game).every((skill) => skill.level === 'unseen')).toBe(true);
  });

  it('never awards a skill for being told a word', () => {
    // The bug this module exists to fix: the parent report used to claim a kid
    // understood capital versus running costs because a card with those words
    // on it had been displayed.
    const told: Game = {
      ...createGame(7),
      learned: ['margin', 'capex-vs-opex', 'competition', 'signal-vs-noise', 'demand-bet'],
    };
    expect(mastery(told).every((skill) => skill.level === 'unseen')).toBe(true);
  });
});

describe('what a sighting has to be', () => {
  it('needs more than one occasion before anything is called held', () => {
    const game = play(2026, 16, pricer);
    for (const skill of mastery(game)) {
      if (skill.level === 'held') {
        expect(skill.sightings.length).toBeGreaterThanOrEqual(skill.needed);
      }
      if (skill.level === 'emerging') expect(skill.sightings.length).toBeLessThan(skill.needed);
      if (skill.level === 'unseen') expect(skill.sightings).toHaveLength(0);
    }
  });

  it('cites where to look and quotes the kid’s own figures', () => {
    const game = play(2026, 16, forecaster);
    const seen = mastery(game).flatMap((skill) => skill.sightings);
    expect(seen.length).toBeGreaterThan(0);
    for (const sighting of seen) {
      expect(sighting.when).toMatch(/^(Day |Week |The )/);
      // A sentence with no number in it is an opinion, and this module does not
      // deal in those — a parent has to be able to go and check it.
      expect(sighting.what).toMatch(/\d/);
    }
  });

  it('stays silent on days recorded before the evidence existed', () => {
    // An older save has no `cupsMade`. Silence is the honest answer; guessing
    // would put an unfounded claim in the one report that has to be trusted.
    const game = play(2026, 16, pricer);
    const old: Game = {
      ...game,
      stand: {
        ...game.stand,
        history: game.stand.history.map(({ cupsMade: _gone, ...rest }) => rest),
      },
    };
    expect(levelOf(old, 'reads-the-queue')).toBe('unseen');
    expect(levelOf(old, 'stops-the-waste')).toBe('unseen');
    expect(levelOf(old, 'bets-on-the-forecast')).toBe('unseen');
  });
});

/* ------------------------------------------------------------------ *
 * Boundaries, on hand-built days
 *
 * The policy tests above prove the detectors fire on real play. These prove
 * they fire on exactly the right thing, which a simulated week cannot.
 * ------------------------------------------------------------------ */

function day(over: Partial<DayRecord> & { day: number }): DayRecord {
  return {
    weather: 'mild',
    price: 1.5,
    cupsSold: 20,
    cupsMade: 20,
    cupsWanted: 20,
    revenue: 30,
    profit: 10,
    cashAfter: 100,
    forecast: 'probably-mild',
    marketShare: 1,
    ...over,
  };
}

function withDays(history: DayRecord[]): Game {
  const game = createGame(3);
  return { ...game, stand: { ...game.stand, history } };
}

describe('the boundaries', () => {
  it('does not call a sell-out a sell-out when nobody was turned away', () => {
    // Selling every cup you made is not evidence of anything if that was also
    // every cup anybody wanted.
    const exact = withDays([
      day({ day: 1, cupsMade: 20, cupsSold: 20, cupsWanted: 20 }),
      day({ day: 2, price: 2 }),
      day({ day: 3, cupsMade: 20, cupsSold: 20, cupsWanted: 20 }),
      day({ day: 4, price: 2.5 }),
    ]);
    expect(levelOf(exact, 'reads-the-queue')).toBe('unseen');
  });

  it('calls it when people were turned away and the price went up', () => {
    const queued = withDays([
      day({ day: 1, cupsMade: 20, cupsSold: 20, cupsWanted: 34 }),
      day({ day: 2, price: 1.75 }),
      day({ day: 3, cupsMade: 20, cupsSold: 20, cupsWanted: 31 }),
      day({ day: 4, price: 2 }),
    ]);
    expect(levelOf(queued, 'reads-the-queue')).toBe('held');
    expect(mastery(queued)[0].sightings[0].what).toContain('14 people turned away');
  });

  it('does not count a price nudged by a cent as holding firm', () => {
    const wobbled = withDays([
      day({ day: 1, profit: -3 }),
      day({ day: 2, price: 1.75, profit: 8 }),
    ]);
    expect(levelOf(wobbled, 'judges-on-a-run')).toBe('unseen');
  });

  it('counts holding a price through a loss that then came good', () => {
    const steady = withDays([
      day({ day: 1, profit: -3 }),
      day({ day: 2, profit: 8 }),
      day({ day: 3, profit: -1 }),
      day({ day: 4, profit: 9 }),
    ]);
    expect(levelOf(steady, 'judges-on-a-run')).toBe('held');
  });

  it('will not credit answering a rival if the price was cut anyway', () => {
    const undercut = withDays([
      day({ day: 1, marketShare: 0.6 }),
      day({ day: 2, price: 1.25, profit: 12 }),
      day({ day: 3, marketShare: 0.6 }),
      day({ day: 4, price: 1, profit: 12 }),
    ]);
    expect(levelOf(undercut, 'holds-under-attack')).toBe('unseen');
  });

  it('credits holding the price against a rival and still making money', () => {
    const holdfast = withDays([
      day({ day: 1, marketShare: 0.6 }),
      day({ day: 2, price: 1.5, profit: 12 }),
      day({ day: 3, marketShare: 0.55 }),
      day({ day: 4, price: 1.6, profit: 11 }),
    ]);
    expect(levelOf(holdfast, 'holds-under-attack')).toBe('held');
  });

  it('will not credit capacity bought by a kid who was never short', () => {
    const roomy = {
      ...withDays([day({ day: 1 }), day({ day: 2 })]),
    };
    roomy.business = { ...roomy.business, upgrades: { ...roomy.business.upgrades, cooler: true } };
    expect(levelOf(roomy, 'buys-capacity-when-it-binds')).toBe('unseen');
  });

  it('credits capacity bought after days of turning people away', () => {
    const packed = withDays([
      day({ day: 1, cupsMade: 20, cupsSold: 20, cupsWanted: 40 }),
      day({ day: 2, cupsMade: 20, cupsSold: 20, cupsWanted: 38 }),
    ]);
    packed.business = { ...packed.business, staff: { ...packed.business.staff, helper: true } };
    expect(levelOf(packed, 'buys-capacity-when-it-binds')).toBe('held');
  });
});

describe('the report', () => {
  it('does not hold a child to account for acts they have not reached', () => {
    const early = play(2026, 5, pricer);
    expect(reachable(mastery(early), 1).every((skill) => skill.act === 1)).toBe(true);
    expect(tally(mastery(early), 1).outOf).toBeLessThan(tally(mastery(early), 4).outOf);
  });

  it('says something true when nothing has been demonstrated', () => {
    expect(masteryLine(mastery(createGame(1)), 1)).toContain('from what they do');
  });

  it('names the thing rather than handing out a score', () => {
    // A number invites comparison with another child, which is the thing this
    // product has spent its whole design avoiding.
    const line = masteryLine(mastery(play(2026, 16, pricer)), 2);
    expect(line).not.toMatch(/%/);
    expect(line).not.toMatch(/grade|score|out of \d+ points/i);
  });
});
