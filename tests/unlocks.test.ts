import { describe, it, expect } from 'vitest';
import {
  UNLOCK_COPY,
  announceable,
  isFirstRun,
  isUnlocked,
  newlyUnlocked,
  unlockedFeatures,
  type Feature,
} from '../src/lib/unlocks';
import {
  createCareer,
  recordAnnounced,
  recordBadges,
  recordWords,
  type Career,
} from '../src/lib/career';
import { createGame, type Game } from '../src/lib/progress';
import { ECON, orderForTargetCups, runDay, type DayRecord } from '../src/lib/simulation';
import { createPortfolio } from '../src/lib/market';

const ALL = Object.keys(UNLOCK_COPY) as Feature[];

function day(n: number): DayRecord {
  return {
    day: n,
    weather: 'mild',
    price: 1.6,
    cupsSold: 28,
    cupsWanted: 28,
    revenue: 44.8,
    profit: 34.34,
    cashAfter: 100,
  };
}

function withDays(count: number): Game {
  const game = createGame(1);
  return {
    ...game,
    stand: { ...game.stand, history: Array.from({ length: count }, (_, i) => day(i + 1)) },
  };
}

describe('the first launch has one thing on it', () => {
  it('unlocks nothing at all', () => {
    expect(unlockedFeatures(createGame(1), createCareer())).toEqual([]);
  });

  it('knows it is a first run', () => {
    expect(isFirstRun(createGame(1), createCareer())).toBe(true);
  });

  it('stops being a first run the moment a day has been played', () => {
    expect(isFirstRun(withDays(1), createCareer())).toBe(false);
  });

  it('does not offer a trophy case before there is a trophy', () => {
    expect(isUnlocked('trophies', withDays(3), createCareer())).toBe(false);
  });

  it('does not ask for a name before there is anything to put it on', () => {
    expect(isUnlocked('identity', withDays(3), createCareer())).toBe(false);
  });
});

describe('each system arrives at the moment it makes sense', () => {
  it('opens the trophy case with the first badge', () => {
    const career = recordBadges(createCareer(), ['open-for-business']);
    expect(isUnlocked('trophies', withDays(1), career)).toBe(true);
    expect(isUnlocked('identity', withDays(1), career)).toBe(true);
  });

  it('opens the glossary with the first word', () => {
    const career = recordWords(createCareer(), ['revenue']);
    expect(isUnlocked('words', createGame(1), career)).toBe(true);
  });

  it('counts a word earned in this run, not just career ones', () => {
    const game = { ...withDays(1), learned: ['revenue'] };
    expect(isUnlocked('words', game, createCareer())).toBe(true);
  });

  it('offers suggestions only once there is one day to compare against', () => {
    expect(isUnlocked('whats-next', createGame(1), createCareer())).toBe(false);
    expect(isUnlocked('whats-next', withDays(1), createCareer())).toBe(true);
  });

  it('offers a challenge on the second day, so somebody else is in the game early', () => {
    expect(isUnlocked('challenge', withDays(1), createCareer())).toBe(false);
    expect(isUnlocked('challenge', withDays(2), createCareer())).toBe(true);
  });

  it('still offers the challenge to a kid who only ever played a duel', () => {
    const career = { ...createCareer(), challengesPlayed: 1 };
    expect(isUnlocked('challenge', createGame(1), career)).toBe(true);
  });

  it('offers a club only once the kid has their own money in the market', () => {
    // The market is the fifth stage now: the listing stage comes before it, and
    // a kid arguing about Apple with three friends before they have ever owned
    // a share of anything is the club arriving before it means anything.
    expect(isUnlocked('club', { ...withDays(20), act: 3 }, createCareer())).toBe(false);
    expect(isUnlocked('club', { ...withDays(20), act: 4 }, createCareer())).toBe(true);
  });

  it('offers a new season only once a run has finished', () => {
    const game = { ...withDays(20), act: 4 as const, portfolio: createPortfolio(100, 1) };
    expect(isUnlocked('seasons', game, createCareer())).toBe(false);
    const finished = { ...game, portfolio: { ...game.portfolio!, status: 'closed' as const } };
    expect(isUnlocked('seasons', finished, createCareer())).toBe(true);
  });
});

describe('unlocks never reverse', () => {
  it('keeps a challenge unlocked in a later season with a fresh stand', () => {
    const career = { ...createCareer(), challengesPlayed: 2, seasons: 3 };
    expect(isUnlocked('challenge', createGame(1), career)).toBe(true);
  });

  it('keeps the club unlocked back in Act 1 of a new season', () => {
    const career = { ...createCareer(), clubWeeks: 4 };
    expect(isUnlocked('club', createGame(1), career)).toBe(true);
  });

  it('never orphans a club that exists but has not advanced a week', () => {
    // Seasons carry the club across, so a club created in Act 4 and then left
    // behind by a new season must still be reachable from Act 1.
    const game = { ...createGame(1), club: { name: 'Lunch Table' } as never };
    expect(isUnlocked('club', game, createCareer())).toBe(true);
  });

  it('keeps seasons unlocked once one has been finished', () => {
    const career = { ...createCareer(), seasons: 2 };
    expect(isUnlocked('seasons', createGame(1), career)).toBe(true);
  });
});

describe('announcing them', () => {
  it('announces each new one exactly once', () => {
    const career = recordBadges(createCareer(), ['open-for-business']);
    const game = withDays(1);

    const first = newlyUnlocked(game, career, career.announced);
    expect(first.map((u) => u.feature).sort()).toEqual(['identity', 'trophies', 'whats-next']);

    const after = recordAnnounced(career, first.map((u) => u.feature));
    expect(newlyUnlocked(game, after, after.announced)).toEqual([]);
  });

  it('shows exactly one card at the end of day one', () => {
    // Four systems come true at once here — the trophy case, the name prompt,
    // the words collection and the suggestions. Three of them explain
    // themselves where they appear, so only one gets a card.
    const career = recordBadges(recordWords(createCareer(), ['revenue']), ['open-for-business']);
    const fresh = newlyUnlocked(withDays(1), career, career.announced);
    expect(fresh.length).toBeGreaterThan(1);
    expect(announceable(fresh).map((u) => u.feature)).toEqual(['trophies']);
  });

  it('still marks the silent ones seen, so they never queue up later', () => {
    const career = recordBadges(recordWords(createCareer(), ['revenue']), ['open-for-business']);
    const game = withDays(1);
    const fresh = newlyUnlocked(game, career, career.announced);
    const after = recordAnnounced(career, fresh.map((u) => u.feature));
    expect(newlyUnlocked(game, after, after.announced)).toEqual([]);
  });

  it('gives the later systems a card of their own', () => {
    let career = recordBadges(createCareer(), ['open-for-business']);
    career = recordAnnounced(career, ['trophies', 'identity', 'whats-next', 'words']);
    const week = withDays(ECON.TOTAL_DAYS);
    expect(announceable(newlyUnlocked(week, career, career.announced)).map((u) => u.feature)).toEqual([
      'challenge',
    ]);
  });

  it('gives every feature copy that says why now', () => {
    for (const feature of ALL) {
      const copy = UNLOCK_COPY[feature];
      expect(copy.title.length, feature).toBeGreaterThan(3);
      expect(copy.because.length, feature).toBeGreaterThan(20);
      expect(copy.emoji.length, feature).toBeGreaterThan(0);
    }
  });

  it('announces a later unlock without re-announcing the earlier ones', () => {
    let career = recordBadges(createCareer(), ['open-for-business']);
    career = recordAnnounced(career, ['trophies', 'identity', 'whats-next']);
    const week = withDays(ECON.TOTAL_DAYS);
    expect(newlyUnlocked(week, career, career.announced).map((u) => u.feature)).toEqual(['challenge']);
  });
});

/**
 * What survives a new season, which is meant to be everything earned.
 *
 * The seasons card says it in so many words — "Start again on a different
 * street, keep everything you earned" — and the Friends desk did not. It gated
 * on `game.stand.history.length`, the *current run's* days, so a child who had
 * played a whole season and pressed "new season" lost it until they had played
 * two more days.
 *
 * Found by playing a season to the end in a browser and looking at the title
 * screen. The `club` case already carried a clause for the same problem.
 */
describe('a new season keeps what the last one earned', () => {
  /** A career that has played a full season, and a game that has not. */
  const veteran: Career = {
    ...createCareer('Ada'),
    seasons: 2,
    lifetimeDays: 7,
    badges: ['open-for-business', 'cold-day-profit'],
    words: ['revenue', 'profit'],
  };

  it('keeps the Friends desk open on a fresh season', () => {
    const freshRun = createGame(2026);
    expect(freshRun.stand.history).toHaveLength(0);
    expect(
      isUnlocked('challenge', freshRun, veteran),
      'a child who played a whole season lost the duel',
    ).toBe(true);
  });

  it('still keeps it shut for somebody who has never played a day', () => {
    /* The other direction, or the gate means nothing: day one announces the
       trophy case and day two announces this, one card at a time. */
    const beginner = { ...createCareer('Bo'), lifetimeDays: 0 };
    expect(isUnlocked('challenge', createGame(7), beginner)).toBe(false);
  });

  it('opens it after two days of a first run, as it always did', () => {
    let game = createGame(11);
    const beginner = { ...createCareer('Cy'), lifetimeDays: 0 };
    for (let day = 0; day < 2; day += 1) {
      const order = orderForTargetCups(game.stand, 28);
      game = { ...game, stand: runDay(game.stand, { ...order, price: 1.5 }).nextState };
    }
    expect(isUnlocked('challenge', game, beginner)).toBe(true);
  });
});
