import { describe, it, expect } from 'vitest';
import {
  BADGES,
  BADGE_COUNT,
  badgeById,
  earnedBadges,
  rankFor,
  trophyCase,
  type BadgeContext,
} from '../src/lib/achievements';
import {
  GLOSSARY,
  diversificationInsight,
  peRatioInsight,
  recurringRevenueInsight,
  unrecorded,
  wordFor,
  wordProgress,
  wordsEarned,
} from '../src/lib/glossary';
import {
  AVATARS,
  beginSeason,
  careerCard,
  createCareer,
  newlyEarned,
  recordBadges,
  recordChallenge,
  recordDay,
  recordSeason,
  recordWords,
  recordStudied,
  tidyPlayerName,
} from '../src/lib/career';
import {
  badgeContext,
  badgesHeld,
  createGame,
  newSeason,
  seasonRecord,
  whatsNext,
} from '../src/lib/progress';
import { SNAPSHOT } from '../src/lib/companies';
import { createBusinessState } from '../src/lib/business';
import { buyoutOffer, createOwnershipState } from '../src/lib/ownership';
import { createPortfolio } from '../src/lib/market';
import { round2, type DayRecord } from '../src/lib/simulation';

function day(over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: 1,
    weather: 'mild',
    price: 1.6,
    cupsSold: 28,
    cupsWanted: 28,
    revenue: 44.8,
    profit: 34.34,
    cashAfter: 100,
    ...over,
  };
}

function ctx(over: Partial<BadgeContext> = {}): BadgeContext {
  return {
    history: [],
    business: createBusinessState(),
    ownership: createOwnershipState(),
    portfolio: null,
    learned: [],
    challengesPlayed: 0,
    clubWeeks: 0,
    clubProposalsPassed: 0,
    thesisCount: 0,
    ...over,
  };
}

describe('the trophy case is honest', () => {
  it('has no duplicate ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGE_COUNT);
  });

  it('gives every badge a concept it is evidence of', () => {
    for (const badge of BADGES) {
      expect(badge.proves.length, badge.id).toBeGreaterThan(20);
      expect(badge.how.length, badge.id).toBeGreaterThan(10);
    }
  });

  it('awards nothing at all for a game that has not started', () => {
    expect(earnedBadges(ctx())).toEqual([]);
  });

  it('does not award a badge just for playing lots of days', () => {
    const grind = Array.from({ length: 40 }, (_, i) => day({ day: i + 1, price: 0.75, profit: 4 }));
    const earned = earnedBadges(ctx({ history: grind }));
    expect(earned).toContain('open-for-business');
    expect(earned).not.toContain('priced-up-won');
    expect(earned).not.toContain('cold-day-profit');
  });
});

describe('badges that require actually understanding something', () => {
  it('"charged more, made more" needs a real rise in the same weather', () => {
    const wrongWay = [
      day({ day: 1, price: 1.2, profit: 20 }),
      day({ day: 2, price: 1.6, profit: 15 }),
    ];
    expect(earnedBadges(ctx({ history: wrongWay }))).not.toContain('priced-up-won');

    const rightWay = [
      day({ day: 1, price: 1.2, profit: 20 }),
      day({ day: 2, price: 1.6, profit: 34 }),
    ];
    expect(earnedBadges(ctx({ history: rightWay }))).toContain('priced-up-won');
  });

  it('will not compare a hot day with a cold one to hand it out', () => {
    const mismatched = [
      day({ day: 1, price: 1.2, profit: 20, weather: 'cold' }),
      day({ day: 2, price: 1.6, profit: 34, weather: 'hot' }),
    ];
    expect(earnedBadges(ctx({ history: mismatched }))).not.toContain('priced-up-won');
  });

  it('"steady hand" is stricter than the readiness gate', () => {
    const history = [
      day({ day: 1, price: 1.6, profit: 30 }),
      day({ day: 2, price: 1.6, profit: -4 }),
      day({ day: 3, price: 1.85, profit: 20 }),
      day({ day: 4, price: 1.85, profit: 20 }),
    ];
    // A 25c swing passes the gate (30c tolerance) but not this badge.
    expect(earnedBadges(ctx({ history }))).not.toContain('steady-hand');

    const calm = history.map((d) => (d.day >= 3 ? { ...d, price: 1.65 } : d));
    expect(earnedBadges(ctx({ history: calm }))).toContain('steady-hand');
  });

  it('"held the line" needs a day where they were genuinely competing', () => {
    const alone = [day({ marketShare: 1, profit: 30 })];
    expect(earnedBadges(ctx({ history: alone }))).not.toContain('held-the-line');

    const losing = [day({ marketShare: 0.3, profit: 30 })];
    expect(earnedBadges(ctx({ history: losing }))).not.toContain('held-the-line');

    const holding = [day({ marketShare: 0.62, profit: 30 })];
    expect(earnedBadges(ctx({ history: holding }))).toContain('held-the-line');
  });

  it('"pricing power" needs the juicer as well as the fight', () => {
    const holding = [day({ marketShare: 0.62, profit: 30 })];
    expect(earnedBadges(ctx({ history: holding }))).not.toContain('pricing-power');
    const business = {
      ...createBusinessState(),
      upgrades: { cooler: false, bigSign: false, freshSqueeze: true },
    };
    expect(earnedBadges(ctx({ history: holding, business }))).toContain('pricing-power');
  });

  it('"the round carried a day" needs the cold day, not just the sign-ups', () => {
    const business = { ...createBusinessState(), regulars: 12 };
    const mildOnly = [day({ weather: 'mild', cupsSold: 30, subscriberCups: 12 })];
    const earnedMild = earnedBadges(ctx({ history: mildOnly, business }));
    expect(earnedMild).toContain('started-a-round');
    expect(earnedMild).not.toContain('round-carried-a-day');

    const coldDay = [day({ weather: 'cold', cupsSold: 14, subscriberCups: 12 })];
    expect(earnedBadges(ctx({ history: coldDay, business }))).toContain('round-carried-a-day');
  });

  it('"read the multiple" needs the right answer, not just an answer', () => {
    const wrong = {
      ...createOwnershipState(),
      comparisonAnswered: true,
      comparisonChoiceId: 'bella',
    };
    expect(earnedBadges(ctx({ ownership: wrong }))).not.toContain('read-the-multiple');
    const right = { ...wrong, comparisonChoiceId: 'sam' };
    expect(earnedBadges(ctx({ ownership: right }))).toContain('read-the-multiple');
  });

  it('"sat still" needs the fall to have been ridden out, not sold into', () => {
    const held = createPortfolio(1000, 1);
    held.holdings.AAPL = {
      ticker: 'AAPL',
      shares: 4,
      costBasis: 920,
      worstDrawdown: 0.2,
      soldWhileDown: false,
      heldThroughDrawdown: true,
    };
    expect(earnedBadges(ctx({ portfolio: held }))).toContain('sat-still');

    held.holdings.AAPL.soldWhileDown = true;
    expect(earnedBadges(ctx({ portfolio: held }))).not.toContain('sat-still');
  });

  it('survives a half-migrated save instead of taking the screen down', () => {
    const broken = ctx({ business: undefined as never, ownership: undefined as never });
    expect(() => earnedBadges(broken)).not.toThrow();
  });
});

describe('rank comes from badges, never from time', () => {
  it('starts at the bottom', () => {
    expect(rankFor(0).name).toBe('Kid with a jug');
    expect(rankFor(0).nextName).toBe('Stand owner');
  });

  it('only ever climbs as standing is added', () => {
    let last = -1;
    for (let held = 0; held <= 90; held++) {
      const rank = rankFor(held);
      expect(rank.index).toBeGreaterThanOrEqual(last);
      last = rank.index;
    }
  });

  it('does not run out while there is still collection left to gather', () => {
    // Standing is badges + words + companies read, so the ceiling moves as the
    // game grows. Badges alone must not reach the last rung.
    expect(rankFor(BADGE_COUNT).nextAt).not.toBeNull();
    expect(rankFor(BADGE_COUNT + GLOSSARY.length + SNAPSHOT.length).nextAt).toBeNull();
  });

  it('is reachable: every rung is passed on the way up', () => {
    expect(rankFor(80).index).toBeGreaterThan(rankFor(40).index);
    expect(rankFor(40).index).toBeGreaterThan(rankFor(10).index);
  });
});

describe('the trophy screen', () => {
  it('shows locked badges too, so there is something to want', () => {
    const groups = trophyCase(['open-for-business']);
    const all = groups.flatMap((g) => g.badges);
    expect(all).toHaveLength(BADGE_COUNT);
    expect(all.filter((b) => b.held)).toHaveLength(1);
    expect(all.filter((b) => !b.held).length).toBeGreaterThan(20);
  });

  it('groups them by act, including the social ones', () => {
    expect(trophyCase([]).map((g) => g.act)).toEqual([1, 2, 3, 4, 'social']);
  });

  it('can look a badge up by id', () => {
    expect(badgeById('walked-away')!.name).toBe('Walked away');
    expect(badgeById('nope')).toBeUndefined();
  });
});

describe('words you earned', () => {
  it('has no duplicate ids', () => {
    expect(new Set(GLOSSARY.map((w) => w.id)).size).toBe(GLOSSARY.length);
  });

  it('says the actual grown-up word for every entry', () => {
    for (const word of GLOSSARY) {
      expect(word.word.length, word.id).toBeGreaterThan(2);
      expect(word.kidLine.length, word.id).toBeGreaterThan(20);
      expect(word.grownUpLine.length, word.id).toBeGreaterThan(20);
    }
  });

  it('finally says "P/E ratio" out loud', () => {
    const pe = wordFor('pe-ratio')!;
    expect(pe.word).toBe('P/E ratio');
    expect(pe.grownUpLine).toContain('price to earnings');
  });

  it('only lists what has been earned', () => {
    expect(wordsEarned([])).toEqual([]);
    expect(wordsEarned(['margin', 'pe-ratio']).map((w) => w.id)).toEqual(['margin', 'pe-ratio']);
  });

  it('keeps the canonical order however they came in', () => {
    expect(wordsEarned(['pe-ratio', 'margin']).map((w) => w.id)).toEqual(['margin', 'pe-ratio']);
  });

  it('counts progress per act, so an empty shelf is visible', () => {
    const progress = wordProgress(['margin', 'pe-ratio']);
    expect(progress.earned).toBe(2);
    expect(progress.total).toBe(GLOSSARY.length);
    expect(progress.byAct.find((a) => a.act === 3)!.earned).toBe(1);
    expect(progress.byAct.find((a) => a.act === 4)!.earned).toBe(0);
    expect(progress.byAct.reduce((sum, a) => sum + a.total, 0)).toBe(GLOSSARY.length);
  });

  it('ignores a word the kid already has', () => {
    const insights = [diversificationInsight(['AAPL', 'KO', 'NFLX'])];
    expect(unrecorded(insights, [])).toHaveLength(1);
    expect(unrecorded(insights, ['diversification'])).toHaveLength(0);
  });

  it('never hands the same word over twice in one batch', () => {
    const twice = [
      recurringRevenueInsight(6, 1.36, 'cold'),
      recurringRevenueInsight(7, 1.36, 'mild'),
    ];
    expect(unrecorded(twice, [])).toHaveLength(1);
  });
});

describe('the P/E naming moment uses the kid\'s own arithmetic', () => {
  const history: DayRecord[] = Array.from({ length: 7 }, (_, i) =>
    day({ day: i + 1, profit: 40, revenue: 60, cupsSold: 30, cupsWanted: 30 }),
  );

  it('quotes the division that actually produced the multiple', () => {
    const offer = buyoutOffer(history, createOwnershipState());
    const insight = peRatioInsight(offer);

    expect(insight.id).toBe('pe-ratio');
    expect(insight.term).toBe('P/E ratio');
    expect(insight.evidence).toContain(offer.price.toFixed(2));
    expect(insight.evidence).toContain(offer.weeklyProfit.toFixed(2));
    expect(insight.evidence).toContain(`= ${offer.multiple}`);
  });

  it('changes the unit from weeks to years explicitly', () => {
    const offer = buyoutOffer(history, createOwnershipState());
    const insight = peRatioInsight(offer);
    expect(insight.carriesForward).toContain('years instead of weeks');
    expect(insight.carriesForward).toContain('P/E of 20');
  });

  it('states the payback as a length of time, not a fraction of a year', () => {
    const offer = buyoutOffer(history, createOwnershipState());
    const months = Math.max(1, Math.round(offer.multiple / 4.33));
    expect(peRatioInsight(offer).carriesForward).toContain(`about ${months} month`);
  });
});

describe('the career record', () => {
  it('never loses a badge, whatever happens to the stand', () => {
    let career = recordBadges(createCareer('Ada'), ['open-for-business', 'walked-away']);
    career = recordBadges(career, ['open-for-business']);
    expect(career.badges).toHaveLength(2);
  });

  it('reports only what is new, so a card is shown once', () => {
    const career = recordBadges(createCareer(), ['open-for-business']);
    expect(newlyEarned(career, ['open-for-business', 'steady-hand'])).toEqual(['steady-hand']);
  });

  it('is unchanged by an update that adds nothing', () => {
    const career = recordBadges(createCareer(), ['open-for-business']);
    expect(recordBadges(career, ['open-for-business'])).toBe(career);
    expect(recordWords(career, [])).toBe(career);
  });

  it('keeps the best of each season rather than the last', () => {
    let career = createCareer('Ada');
    career = recordSeason(career, {
      weekProfit: 300,
      buyoutMultiple: 11,
      portfolioGainPct: 0.2,
      daysTraded: 20,
      totalProfit: 900,
    });
    career = recordSeason(career, {
      weekProfit: 100,
      buyoutMultiple: 6,
      portfolioGainPct: -0.1,
      daysTraded: 20,
      totalProfit: 400,
    });
    expect(career.bestWeekProfit).toBe(300);
    expect(career.bestBuyoutMultiple).toBe(11);
  });

  it('banks each day as it is played, not when a season ends', () => {
    let career = createCareer('Ada');
    career = recordDay(career, 34.34);
    career = recordDay(career, -4.5);
    expect(career.lifetimeDays).toBe(2);
    expect(career.lifetimeProfit).toBe(29.84);
  });

  it('does not double-count days when a season is then recorded', () => {
    let career = recordDay(recordDay(createCareer(), 10), 10);
    career = recordSeason(career, {
      weekProfit: 70,
      buyoutMultiple: 8,
      portfolioGainPct: 0,
      daysTraded: 2,
      totalProfit: 20,
    });
    expect(career.lifetimeDays).toBe(2);
    expect(career.lifetimeProfit).toBe(20);
  });

  it('counts challenges played whether or not they were won', () => {
    let career = recordChallenge(createCareer(), false);
    career = recordChallenge(career, true);
    expect(career.challengesPlayed).toBe(2);
    expect(career.challengesWon).toBe(1);
  });

  it('tidies a name to something a share code can carry', () => {
    expect(tidyPlayerName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
    expect(tidyPlayerName('a'.repeat(40))).toHaveLength(12);
  });

  it('offers a handful of avatars and defaults to a real one', () => {
    expect(AVATARS.length).toBeGreaterThan(5);
    expect(AVATARS).toContain(createCareer().avatar);
  });

  it('shows the rank and how far the next one is, in the currency the rank runs on', () => {
    const card = careerCard(recordBadges(createCareer('Ada'), ['open-for-business']));
    expect(card.rank.name).toBe('Kid with a jug');
    expect(card.standing).toEqual({ held: 1, nextAt: 6 });
    expect(card.line).toContain('5 more ⭐');
    expect(card.badges).toEqual({ held: 1, total: BADGE_COUNT });
  });

  it('counts a word and a company read towards the next rank, same as a badge', () => {
    // The card used to say "9 more badges" to a kid whose rank was already
    // computed from badges plus words plus companies read, so a kid one company
    // short of Operator was told they needed nine badges.
    const mixed = recordStudied(
      recordWords(recordBadges(createCareer('Ada'), ['open-for-business', 'first-profit']), [
        'revenue',
        'profit',
      ]),
      ['AAPL'],
    );
    const card = careerCard(mixed);
    expect(card.standing.held).toBe(5);
    expect(card.badges.held).toBe(2);
    expect(card.line).toContain('1 more ⭐');
  });

  it('counts seasons up', () => {
    expect(beginSeason(createCareer()).seasons).toBe(2);
  });
});

describe('what to do next', () => {
  it('never suggests something from an act they have not opened', () => {
    const game = createGame(1);
    const suggestions = whatsNext(game, createCareer());
    const names = suggestions.map((s) => s.title);
    expect(names).not.toContain('Walked away');
    expect(names).not.toContain('Spread out');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('drops a suggestion the moment it is earned', () => {
    const game = { ...createGame(1), stand: { ...createGame(1).stand, history: [day()] } };
    const before = whatsNext(createGame(1), createCareer()).map((s) => s.title);
    const after = whatsNext(game, createCareer()).map((s) => s.title);
    expect(before).toContain('Open for business');
    expect(after).not.toContain('Open for business');
  });

  it('holds one slot for something to do with a friend', () => {
    const suggestions = whatsNext(createGame(1), createCareer());
    expect(suggestions.map((s) => s.title)).toContain('Same sky');
  });

  it('leads with the nearest act, not the furthest', () => {
    const game = { ...createGame(1), act: 4 as const };
    const titles = whatsNext(game, createCareer()).map((s) => s.title);
    expect(titles[0]).toBe('Open for business');
  });

  it('fills the social slot with a solo goal once the social ones are done', () => {
    const career = recordBadges(createCareer(), ['same-sky', 'club-member', 'carried-the-vote']);
    const suggestions = whatsNext(createGame(1), career);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.title)).not.toContain('Same sky');
  });

  it('merges the career record with the current run', () => {
    const game = createGame(1);
    const career = recordBadges(createCareer(), ['walked-away']);
    expect(badgesHeld(game, career)).toContain('walked-away');
    expect(badgeContext(game, career).challengesPlayed).toBe(0);
  });
});

describe('a new season', () => {
  it('is a genuinely new stand', () => {
    const game = { ...createGame(1), act: 4 as const, learned: ['margin'] };
    const next = newSeason(game, 99);
    expect(next.act).toBe(1);
    expect(next.learned).toEqual([]);
    expect(next.stand.history).toEqual([]);
    expect(next.season).toBe(2);
  });

  it('carries the club across, because the club is not this run', () => {
    const game = { ...createGame(1), club: { name: 'Lunch Table' } as never };
    expect(newSeason(game, 99).club).toEqual({ name: 'Lunch Table' });
  });

  it('summarises what the season contributed before it is thrown away', () => {
    const game = {
      ...createGame(1),
      stand: { ...createGame(1).stand, history: [day({ profit: 30 }), day({ day: 2, profit: 40 })] },
      ownership: { ...createOwnershipState(), buyoutMultiple: 11 },
    };
    const record = seasonRecord(game);
    expect(record.totalProfit).toBe(70);
    expect(record.daysTraded).toBe(2);
    expect(record.buyoutMultiple).toBe(11);
  });
});
