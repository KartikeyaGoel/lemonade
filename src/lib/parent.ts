/**
 * The parent view.
 *
 * The parent is not buying a game, they are buying evidence that their kid
 * understands money. So this is not analytics: no session lengths, no
 * completion percentages, no engagement charts. Every line is something the
 * kid actually decided, with the number they decided it on.
 *
 * Readable in thirty seconds, and it ends with one thing a parent can ask
 * about at dinner.
 *
 * Pure module. No React, no I/O.
 */

import { ECON, round2, weekSummary } from './simulation';
import { LOCATIONS, UPGRADES, standCount, trailingWeeklyProfit, type UpgradeId } from './business';
import { SHOP, loanCleared, shopDailyCost } from './retail';
import { founderStake } from './listing';
import { judgeDealChoice } from './ownership';
import { summarisePortfolio } from './market';
import { ACT_TITLES, readiness, seededWith, type Game } from './progress';
import { BADGE_COUNT, rankFor } from './achievements';
import { GLOSSARY, wordsEarned } from './glossary';
import { standing, type Career } from './career';
import { mastery, reachable } from './mastery';
import { closest, curriculum, reached, type Stage } from './curriculum';
import type { ThesisScore } from './thesis';
import { plural } from './copy';

export interface ParentLine {
  /** Short label, e.g. "Pricing". */
  topic: string;
  /** The decision, in plain English, with the kid's own figure in it. */
  evidence: string;
}

export interface ParentReport {
  headline: string;
  act: number;
  actName: string;
  daysTraded: number;
  /** What they did. Facts, not scores. */
  activity: ParentLine[];
  /** What they demonstrably understand, tied to decisions. */
  understanding: ParentLine[];
  /** Things not yet demonstrated. Honest, and never framed as failure. */
  notYet: string[];
  /**
   * The four stages, named by the concept each teaches, with the evidence
   * underneath. This is the answer to "what is my child actually learning" —
   * a question the rest of this report answered only for the part already
   * finished, which is no use at all to a parent looking at it on day one.
   *
   * It is deliberately the whole ladder including the stages not yet open.
   * A syllabus with the future cut off is a progress bar, and a progress bar
   * says nothing about what is being taught.
   */
  ladder: Stage[];
  /** One sentence above the ladder. Never a percentage, never a grade. */
  ladderLine: string;
  conversationStarter: string;
  /**
   * The record across every season, not just this run.
   *
   * The parent is not buying a game, they are buying evidence that their kid
   * understands money — and after a reset "0 days of business" is a terrible
   * answer to give them when the kid has actually played for a fortnight. The
   * career record is the evidence; this is where it belongs.
   */
  career: {
    name: string;
    /**
     * Whether that name is the child's or ours.
     *
     * `name` carries a placeholder when nobody typed one, which is right for a
     * headline and wrong anywhere the report offers to *do* something to it —
     * the delete confirmation was listing "the name Your kid" among the things
     * a parent was about to lose. Naming a thing that does not exist, on the
     * one screen whose whole job is to be trustworthy, is the cheapest possible
     * way to lose a reader.
     */
    named: boolean;
    rank: string;
    seasons: number;
    lifetimeDays: number;
    badges: { held: number; total: number };
    words: { held: number; total: number };
    /** The words themselves, so a parent can ask about one by name. */
    wordList: string[];
  } | null;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/**
 * Builds the report from real state only.
 *
 * If the kid has not done a thing, it goes in `notYet` rather than being
 * softened into a claim. A parent who is told their kid understands
 * diversification when they do not will stop trusting every other line.
 */
export function parentReport(
  game: Game,
  career?: Career | null,
  /** Scored buys, so a reason that held up can be cited as evidence. */
  theses: ThesisScore[] = [],
): ParentReport {
  const history = game.stand.history;
  const summary = weekSummary(history);
  const gate = readiness(game);

  const activity: ParentLine[] = [];
  const understanding: ParentLine[] = [];
  const notYet: string[] = [];

  /* ---- What they did ---- */

  if (history.length > 0) {
    activity.push({
      topic: 'Days of business',
      evidence: `${plural(history.length, 'day')} traded, ${summary.profitableDays} of them profitable.`,
    });
    activity.push({
      topic: 'Best day',
      evidence: `${money(summary.bestDay?.profit ?? 0)} profit, charging ${money(summary.bestDay?.price ?? 0)} a cup.`,
    });
  }

  const ownedUpgrades = (Object.keys(game.business.upgrades) as UpgradeId[]).filter(
    (id) => game.business.upgrades[id],
  );
  if (ownedUpgrades.length > 0) {
    activity.push({
      topic: 'Reinvested',
      evidence: `Bought ${ownedUpgrades.map((id) => UPGRADES[id].name.toLowerCase()).join(', ')} out of profits rather than taking the cash out.`,
    });
  }
  if (game.business.staff.manager) {
    activity.push({
      topic: 'Hired',
      evidence: `Put a manager on ${money(20)} a day so the stand earns without them working it.`,
    });
  }
  if (game.business.location !== 'sidewalk') {
    activity.push({
      topic: 'Moved',
      evidence: `Traded from ${LOCATIONS[game.business.location].name}, paying ${money(LOCATIONS[game.business.location].fee)} a day in rent for the extra footfall.`,
    });
  }

  if (game.business.stands.length > 0) {
    const where = game.business.stands
      .map((stand) => LOCATIONS[stand.location].name.toLowerCase())
      .join(' and ');
    activity.push({
      topic: 'Opened another',
      evidence: `Runs ${plural(standCount(game.business), 'stand')} on one price, at ${where} as well as ${LOCATIONS[game.business.location].name.toLowerCase()}. Every pitch fee and wage is owed on all of them.`,
    });
  }

  if (game.business.shop.open) {
    activity.push({
      topic: 'Took a lease',
      evidence: `Opened a shop: ${money(SHOP.fitOut)} to fit out, ${money(shopDailyCost(game.business.shop))} a day owed before the door opens. Weather stops mattering much, and a quiet day costs real money.`,
    });
  }

  if (loanCleared(game.business.loan)) {
    activity.push({
      topic: 'Cleared the loan',
      evidence: `Borrowed ${money(game.business.loan!.principal)} and handed back ${money(game.business.loan!.total)}, every repayment owed whatever the day was like.`,
    });
  } else if (game.business.loan) {
    activity.push({
      topic: 'Borrowed',
      evidence: `Took ${money(game.business.loan.principal)} from the bank and will hand back ${money(game.business.loan.total)}. ${money(game.business.loan.outstanding)} still outstanding, at ${money(game.business.loan.daily)} a day whatever the day was like.`,
    });
  }

  /*
   * Only when a slice was actually sold to the investor.
   *
   * Gated on the cash rather than on the percentage, because the percentage was
   * for a while carrying the public float as well — so a kid who borrowed for
   * the shop and then listed was reported as having "taken $0.00 up front in
   * exchange for 30% of every future profit", which is a sale that never
   * happened. The float has its own line below, and `handleList` no longer
   * writes into this field at all.
   */
  if (game.ownership.equityCashReceived > 0) {
    activity.push({
      topic: 'Sold a share',
      evidence: `Took ${money(game.ownership.equityCashReceived)} up front in exchange for ${Math.round(game.ownership.equitySoldPct * 100)}% of every future profit. She has since collected ${money(game.ownership.investorPaidToDate)}.`,
    });
  }

  if (game.ownership.buyoutAccepted) {
    activity.push({
      topic: 'Sold the business',
      evidence: `Accepted ${money(game.ownership.buyoutPrice)} — ${plural(game.ownership.buyoutMultiple, 'time')} what it earned in a week — and walked away with ${money(game.ownership.buyoutProceeds)}.`,
    });
  }

  if (game.listing.listed) {
    const l = game.listing;
    activity.push({
      topic: 'Took it public',
      // `ipoMultiple`, not `multiple`: the second one re-rates every week, and
      // quoting the float's valuation against this week's multiple printed two
      // figures that did not divide into each other.
      evidence: `Valued the company at ${money(round2(l.ipoPrice * l.shares))} — ${l.ipoMultiple.toFixed(1)} times weekly profit — cut it into ${l.shares} shares at ${money(l.ipoPrice)} each, sold ${Math.round(l.floated * 100)}% for ${money(l.raised)} and kept ${Math.round(l.founderShare * 100)}%.`,
    });
    if (l.weeks.length > 0) {
      const last = l.weeks[l.weeks.length - 1];
      const down = l.weeks.filter((week) => week.change < 0).length;
      activity.push({
        topic: 'Own share price',
        evidence: `${l.weeks.length} ${l.weeks.length === 1 ? 'week' : 'weeks'} listed, ${down} of them down. Now ${money(l.price)} against ${money(l.ipoPrice)} at the float, and their stake is worth ${money(founderStake(l))}. Last move: ${last.reason}`,
      });
    }
  }

  if (game.portfolio) {
    const p = summarisePortfolio(game.portfolio, seededWith(game) || game.portfolio.cash);
    activity.push({
      topic: 'Investing',
      evidence: `Holds ${p.holdingsCount} ${p.holdingsCount === 1 ? 'company' : 'companies'} after ${plural(game.portfolio.week, 'week')}. Researched ${p.researchedCount} before buying.`,
    });
  }

  /* ---- What they understand, evidenced by a decision ---- */

  if (summary.foundOptimalBand) {
    understanding.push({
      topic: 'Pricing',
      evidence: `Found the profit-maximising price by day ${summary.daysToOptimalBand}, having tested cheaper and dearer first.`,
    });
  } else if (history.length >= ECON.TOTAL_DAYS) {
    notYet.push('Still hunting for the best price. They have the method, not the answer yet.');
  }

  /*
   * What they demonstrated, and what they were merely shown.
   *
   * These five lines used to read `game.learned.includes('capex-vs-opex')` and
   * then tell a parent their child understood capital versus running costs.
   * `learned` is true the moment the game has *displayed a card with those
   * words on it* — so this section was reporting what the software did and
   * calling it what the child knew. It is the one screen in the product whose
   * entire job is to be trustworthy, and it was the least trustworthy thing in
   * it.
   *
   * `src/lib/mastery.ts` replaces the claim with the evidence: a skill appears
   * here only after the kid did something, on separate occasions, that only
   * makes sense if they understand it — cited with the day and their own
   * figures so a parent can go and check.
   */
  const skills = reachable(mastery(game, theses), game.act);
  for (const skill of skills) {
    if (skill.level === 'held') {
      understanding.push({
        topic: skill.grownUpName,
        evidence: `${skill.sightings[skill.sightings.length - 1].when}: ${
          skill.sightings[skill.sightings.length - 1].what
        }${skill.sightings.length > 1 ? ` And ${skill.sightings.length - 1} other ${skill.sightings.length === 2 ? 'time' : 'times'}.` : ''}`,
      });
    } else if (skill.level === 'emerging') {
      notYet.push(
        `${skill.grownUpName} — done once (${skill.sightings[0].when.toLowerCase()}), not yet twice.`,
      );
    }
  }

  const choice = game.ownership.comparisonChoiceId;
  if (choice) {
    const verdict = judgeDealChoice(choice);
    if (verdict.correct) {
      understanding.push({
        topic: 'Valuation',
        evidence: `Chose ${verdict.best.name} at ${verdict.best.askingMultiple}x weekly profit over a rival at ${6}x, because the dearer one was growing. This is a price-to-earnings judgement.`,
      });
    } else {
      notYet.push(
        `Picked ${verdict.chosen.name} from the stands for sale. Comparing price against earnings is still settling.`,
      );
    }
  }

  if (game.ownership.passedOnOverpriced) {
    understanding.push({
      topic: 'Discipline',
      evidence: 'Turned down a well-known, perfectly steady business purely because the asking price was too high.',
    });
  }

  if (game.portfolio) {
    const p = summarisePortfolio(game.portfolio, seededWith(game) || 1);
    // Diversification is now reported from `mastery`, which measures the same
    // thing against the same portfolio. Only the shortfall is added here.
    if (!p.diversified && p.holdingsCount > 0) {
      notYet.push('Money is still concentrated in one or two companies.');
    }
    if (p.heldThroughDrawdown) {
      understanding.push({
        topic: 'Holding on',
        evidence: 'Watched a holding fall more than 10% and did not sell. This is the single best predictor of how someone does in real markets.',
      });
    }
    if (p.panicSold) {
      notYet.push('Sold a holding while it was down. Worth asking what changed about the business, if anything.');
    }
  }

  /*
   * Only ever said about a child who has actually had a bad day.
   *
   * The readiness criteria are unmet by default, so on a fresh save this
   * printed "reacts strongly to one bad day" about a kid who had not yet
   * played one — the first thing a parent read about their child was a
   * character judgement the game had invented. `Not yet` is for things not
   * shown, never for things not attempted.
   */
  if (history.length >= 3) {
    for (const criterion of gate.criteria) {
      if (!criterion.met && criterion.id === 'held-through-loss') {
        notYet.push('Reacts strongly to one bad day. The seven-day average is the lesson still landing.');
      }
    }
  }

  /* ---- The ladder ---- */

  const ladder = curriculum(game, theses);

  /* ---- Something to ask at dinner ---- */

  const starter = conversationStarter(game);

  return {
    headline: headlineFor(game),
    act: game.act,
    actName: ACT_TITLES[game.act].name,
    daysTraded: history.length,
    activity,
    understanding,
    notYet: [...new Set(notYet)],
    ladder,
    ladderLine: ladderLine(ladder, history.length),
    conversationStarter: starter,
    career: career
      ? {
          name: career.name || 'Your kid',
          named: career.name.length > 0,
          // Standing, not badges: the ladder runs on badges plus words plus
          // companies read, and quoting the wrong one here understates the kid.
          rank: rankFor(standing(career)).name,
          seasons: career.seasons,
          // Not plus this run's history: days are banked as they are played.
          lifetimeDays: career.lifetimeDays,
          badges: { held: career.badges.length, total: BADGE_COUNT },
          words: {
            held: new Set([...career.words, ...game.learned]).size,
            total: GLOSSARY.length,
          },
          wordList: wordsEarned([...career.words, ...game.learned]).map((word) => word.word),
        }
      : null,
  };
}

function headlineFor(game: Game): string {
  const weekly = trailingWeeklyProfit(game.stand.history);
  if (game.portfolio) {
    const p = summarisePortfolio(game.portfolio, seededWith(game) || game.portfolio.cash);
    return `Investing ${money(p.currentValue)} across ${p.holdingsCount} real companies.`;
  }
  if (game.listing.listed) {
    return `Runs a public company worth ${money(round2(game.listing.price * game.listing.shares))}.`;
  }
  if (game.ownership.buyoutAccepted) {
    return `Sold the business for ${money(game.ownership.buyoutPrice)}.`;
  }
  if (game.business.shop.open) {
    return `Running a shop and ${standCount(game.business)} ${standCount(game.business) === 1 ? 'stand' : 'stands'}.`;
  }
  if (game.stand.history.length >= ECON.TOTAL_DAYS) {
    return `Running a stand earning about ${money(weekly)} a week.`;
  }
  return 'Learning to price a lemonade stand.';
}

/**
 * One question, picked to be answerable by the kid and interesting to the
 * parent. Always about a decision the kid actually made.
 */
/**
 * The one line above the ladder.
 *
 * The hardest case is the one that caused this to be built: a parent opening
 * the report before their child has played a single day. The old report simply
 * had nothing to say, which is why it was hidden on a first run — and hiding
 * it meant the person evaluating whether this teaches anything was shown a
 * lemonade game and no evidence whatsoever. So the empty state is not an
 * apology. It is the syllabus, offered as a promise, with the mechanism stated
 * plainly enough that a sceptical adult can check it later.
 */
export function ladderLine(ladder: Stage[], daysTraded: number): string {
  const { held, outOf } = reached(ladder);
  if (daysTraded === 0) {
    return 'Nothing shown yet — they have not started. Every line below fills in from something they do, never from something they are told.';
  }
  const next = closest(ladder);
  if (held === 0) {
    return next
      ? `Nothing counted twice yet. Closest: ${next.grownUpName.toLowerCase()}.`
      : 'Nothing counted yet. This fills in from what they do.';
  }
  const tail = next ? ` Closest next: ${next.grownUpName.toLowerCase()}.` : '';
  return `${held} of ${outOf} shown more than once in the stages they have reached.${tail}`;
}

export function conversationStarter(game: Game): string {
  const summary = weekSummary(game.stand.history);

  if (game.portfolio && summarisePortfolio(game.portfolio, 1).heldThroughDrawdown) {
    return 'One of your companies dropped more than 10% and you kept it. What made you decide it was still worth holding?';
  }
  if (game.ownership.passedOnOverpriced) {
    return 'You turned down the downtown kiosk even though it makes good money. Why was the price wrong?';
  }
  if (game.listing.weeks.some((week) => week.change < 0)) {
    return 'Your own share price went down one week. Did the business get worse, or did people just change their minds?';
  }
  if (game.listing.listed) {
    return `You sold ${Math.round(game.listing.floated * 100)}% of your company instead of all of it to one buyer. What did you give up, and what did you keep?`;
  }
  if (game.business.loan) {
    return 'You borrowed money for the shop. What happens to that repayment on a day nobody comes in?';
  }
  if (game.business.shop.open) {
    return `The shop owes ${money(shopDailyCost(game.business.shop))} before it opens. How many cups is that, and how do you work it out?`;
  }
  if (game.business.stands.length > 0) {
    return 'You opened a second stand. Did it find new customers, or take them off the first one?';
  }
  if (game.ownership.buyoutAccepted) {
    return `Someone paid you ${plural(game.ownership.buyoutMultiple, 'time')} what your stand earns in a week. Why would anyone pay that much?`;
  }
  if (game.ownership.equitySoldPct > 0) {
    return `You sold ${Math.round(game.ownership.equitySoldPct * 100)}% of your stand for ${money(game.ownership.equityCashReceived)}. Was that a good trade, now you have seen what it costs you?`;
  }
  if (game.business.rival.active) {
    return 'Someone opened a stand near yours and charged less. What did you do about it, and did it work?';
  }
  if (game.business.staff.manager) {
    return 'Your manager runs the stand now and you still get paid. Who is actually doing the work, and why do you get the money?';
  }
  if (Object.values(game.business.upgrades).some(Boolean)) {
    return 'You spent profit on equipment instead of keeping the cash. What did you get back for it?';
  }
  if (summary.foundOptimalBand) {
    return `You settled on ${money(summary.bestPrice ?? 0)} a cup. What happened when you charged less than that?`;
  }
  if (game.stand.history.length > 0) {
    return 'What is the most you think someone would pay for a cup of lemonade, and how would you find out?';
  }
  return 'Ask them to show you the day they made the most money, and why.';
}
