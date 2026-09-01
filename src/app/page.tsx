'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  batchPlan,
  deriveInsights,
  orderForTargetCups,
  projectDay,
  runDay,
  type DayOutcome,
  type DayProjection,
  type Insight,
} from '@/lib/simulation';
import {
  ACT2_DAYS,
  act2Progress,
  signUpRegulars,
  advanceRival,
  applyWeeklyChoice,
  buyUpgrade,
  deriveAct2Insights,
  deriveDayParams,
  managerBatch,
  managerPrice,
  moveTo,
  serviceCapacity,
  toggleStaff,
  trailingWeeklyProfit,
  updateHandsOff,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from '@/lib/business';
import {
  acceptBuyout,
  acceptEquity,
  buyoutOffer,
  declineEquity,
  equityOffer,
  recordDealChoice,
  recordInvestorCut,
} from '@/lib/ownership';
import {
  DIVERSIFIED_MIN_HOLDINGS,
  advanceWeek,
  buy as buyStock,
  currentDate,
  currentPrice,
  markResearched,
  maxSpendOn,
  sell as sellStock,
  summarisePortfolio,
  type WeekReport,
} from '@/lib/market';
import {
  act1Complete,
  beginWeekend,
  endWeekend,
  WEEKEND_FLOAT,
  act2Complete,
  badgeContext,
  badgesHeld,
  beginAct2,
  beginAct3,
  beginAct4,
  createChallengeGame,
  createGame,
  newSeason,
  readiness,
  seasonRecord,
  whatsNext,
  type Game,
} from '@/lib/progress';
import { parentReport } from '@/lib/parent';
import { clearGame, loadCareer, loadGame, saveCareer, saveGame } from '@/lib/storage';
import { badgeById, earnedBadges, rankFor, type Badge } from '@/lib/achievements';
import {
  businessModelInsight,
  diversificationInsight,
  drawdownInsight,
  equityInsight,
  luckInsight,
  multipleInsight,
  peRatioInsight,
  recurringRevenueInsight,
  thesisInsight,
  unrecorded,
} from '@/lib/glossary';
import {
  beginSeason,
  createCareer,
  newlyEarned,
  recordAnnounced,
  recordBadges,
  recordChallenge,
  recordDay,
  recordSeason,
  recordWords,
  recordStudied,
  standing,
  type Career,
} from '@/lib/career';
import { announceable, isFirstRun, isUnlocked, newlyUnlocked, type Unlock } from '@/lib/unlocks';
import { road, roadLine } from '@/lib/journey';
import { desks } from '@/lib/friends';
import { cardFor } from '@/lib/table';
import { createPlaybook } from '@/lib/playbook';
import type { ChallengeSpec } from '@/lib/challenge';
import { buildThesis, quantClaim, qualClaim, scoreAll, type Thesis } from '@/lib/thesis';
import type { ClubState } from '@/lib/club';
import { STANDS_FOR_SALE } from '@/lib/ownership';
import { findCompany, type Company } from '@/lib/companies';

import { TitleScreen } from '@/components/TitleScreen';
import { MorningScreen } from '@/components/MorningScreen';
import { ShopScreen } from '@/components/ShopScreen';
import { PriceScreen } from '@/components/PriceScreen';
import { PlanScreen } from '@/components/PlanScreen';
import { RunDayScreen } from '@/components/RunDayScreen';
import { CloseScreen } from '@/components/CloseScreen';
import { WeekEndScreen } from '@/components/WeekEndScreen';
import { ActIntroScreen } from '@/components/acts/ActIntroScreen';
import { InvestScreen } from '@/components/acts/InvestScreen';
import { WeeklyChoiceScreen } from '@/components/acts/WeeklyChoiceScreen';
import { EquityOfferScreen } from '@/components/acts/EquityOfferScreen';
import { DealBoardScreen } from '@/components/acts/DealBoardScreen';
import { BuyoutScreen } from '@/components/acts/BuyoutScreen';
import { MarketScreen } from '@/components/acts/MarketScreen';
import { WeekReportScreen } from '@/components/acts/WeekReportScreen';
import { GateScreen } from '@/components/acts/GateScreen';
import { ParentScreen } from '@/components/acts/ParentScreen';
import { FinaleScreen } from '@/components/acts/FinaleScreen';
import { TrophyScreen } from '@/components/meta/TrophyScreen';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import { TableScreen } from '@/components/meta/TableScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { FriendsScreen } from '@/components/meta/FriendsScreen';
import { ThesisScreen } from '@/components/meta/ThesisScreen';
import { UnlockCard } from '@/components/meta/UnlockCard';
import { WordCard } from '@/components/meta/WordCard';
import { BadgeToast } from '@/components/meta/BadgeToast';
import { NextUp } from '@/components/meta/NextUp';
import { ReckoningScreen } from '@/components/meta/ReckoningScreen';

/** One screen, one decision. */
/** How many new words a kid is handed at the end of one day. One. */
const WORDS_PER_DAY = 1;

type Phase =
  | 'title'
  | 'act-intro'
  | 'morning'
  | 'shop'
  | 'price'
  | 'plan'
  | 'invest'
  | 'run'
  | 'close'
  | 'week-end'
  | 'weekly-choice'
  | 'equity'
  | 'deals'
  | 'buyout'
  | 'market'
  | 'week-report'
  | 'gate'
  | 'parent'
  | 'finale'
  | 'trophies'
  | 'challenge'
  | 'playbook'
  | 'table'
  | 'club'
  | 'friends'
  | 'thesis'
  | 'reckoning';

/** The wall each act opens on, in the kid's language. */
const ACT_WALLS: Record<number, string> = {
  2: 'You found the best price. You still cannot make more than 30 cups a day.',
  3: 'Your stand runs itself and earns money. So what is the whole thing actually worth?',
  4: 'You have cash and no business. Other people have businesses and want cash.',
};

export default function Page() {
  const [game, setGame] = useState<Game | null>(null);
  const [career, setCareer] = useState<Career | null>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const [hasSave, setHasSave] = useState(false);

  // The meta-game arrives in queues rather than all at once, so a kid never
  // gets four cards in a row. Each queue drains one card per tap.
  const [unlockQueue, setUnlockQueue] = useState<Unlock[]>([]);
  const [wordQueue, setWordQueue] = useState<Insight[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<Badge[]>([]);
  const [thesisTarget, setThesisTarget] = useState<Company | null>(null);

  // In-flight decisions for the day being set up.
  const [targetCups, setTargetCups] = useState(0);
  const [outcome, setOutcome] = useState<DayOutcome | null>(null);
  const [planned, setPlanned] = useState<DayProjection | null>(null);
  const [newInsights, setNewInsights] = useState<Insight[]>([]);
  const [weekReport, setWeekReport] = useState<WeekReport | null>(null);
  const [returnPhase, setReturnPhase] = useState<Phase>('market');

  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      setGame(saved);
      setHasSave(true);
    } else {
      setGame(createGame());
    }
    setCareer(loadCareer() ?? createCareer());
  }, []);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  /**
   * The game including the day being read on the close screen.
   *
   * A day is not banked into `stand.history` until the kid taps through the
   * profit and loss, which meant every badge landed one screen late — the toast
   * for "you opened for business" arrived over day two's planning screen
   * instead of over the result that earned it. Badges never reverse, so it is
   * safe to count a day the moment its numbers are on screen.
   */
  const settledGame = useMemo(
    () => (game && outcome ? { ...game, stand: outcome.nextState } : game),
    [game, outcome],
  );

  /**
   * Fold what the kid has just demonstrated into the permanent record.
   *
   * Badges are recomputed from state every time rather than being set at the
   * moment they happen, which means a badge can never be missed because the
   * code path that would have awarded it was not taken. `recordBadges` and
   * `recordWords` return the same object when nothing changed, so this settles
   * after one pass instead of looping.
   */
  useEffect(() => {
    if (!settledGame || !career) return;
    const earned = earnedBadges(badgeContext(settledGame, career));
    const fresh = newlyEarned(career, earned);

    let next = recordWords(career, settledGame.learned);
    if (fresh.length > 0) {
      next = recordBadges(next, earned);
      // Deduped on insert. In development React runs effects twice, and either
      // pass can fire before `setCareer` has committed — which put the same
      // badge in the queue twice and gave React duplicate keys.
      setBadgeQueue((queue) => {
        const have = new Set(queue.map((badge) => badge.id));
        const add = fresh
          .map((id) => badgeById(id))
          .filter((badge): badge is Badge => Boolean(badge) && !have.has(badge!.id));
        return add.length > 0 ? [...queue, ...add] : queue;
      });
    }
    if (next !== career) setCareer(next);
  }, [settledGame, career]);

  /** Announce each new system exactly once, the moment it becomes real. */
  useEffect(() => {
    if (!settledGame || !career) return;
    const fresh = newlyUnlocked(settledGame, career, career.announced);
    if (fresh.length === 0) return;
    // Everything is marked seen; only the non-silent ones get a card.
    setUnlockQueue((queue) => {
      const have = new Set(queue.map((unlock) => unlock.feature));
      const add = announceable(fresh).filter((unlock) => !have.has(unlock.feature));
      return add.length > 0 ? [...queue, ...add] : queue;
    });
    setCareer(recordAnnounced(career, fresh.map((unlock) => unlock.feature)));
  }, [settledGame, career]);

  /**
   * Hand over a word the kid has just earned, once.
   *
   * Day-loop insights ride on the close screen, where they belong next to the
   * numbers that produced them. These are the milestone words from the later
   * acts — equity, multiple, P/E — which have no close screen to sit on, so
   * each gets its own card.
   */
  const queueWords = useCallback(
    (current: Game, insights: Insight[]): Game => {
      const fresh = unrecorded(insights, current.learned);
      if (fresh.length === 0) return current;
      setWordQueue((queue) => {
        const have = new Set(queue.map((insight) => insight.id));
        const add = fresh.filter((insight) => !have.has(insight.id));
        return add.length > 0 ? [...queue, ...add] : queue;
      });
      return { ...current, learned: [...current.learned, ...fresh.map((i) => i.id)] };
    },
    [],
  );

  /** Act 2 onwards, the day's economics come from the business the kid built. */
  const dayParams = useMemo(() => {
    if (!game) return DEFAULT_DAY_PARAMS;
    if (game.act === 1) return DEFAULT_DAY_PARAMS;
    const price = game.stand.history[game.stand.history.length - 1]?.price ?? 1.6;
    return {
      ...deriveDayParams(game.business, price),
      equityShare: game.ownership.equitySoldPct,
    };
  }, [game]);

  const act2Day = game ? Math.max(1, game.stand.history.length - ECON.TOTAL_DAYS + 1) : 1;

  /* ---------------- Starting and resuming ---------------- */

  const start = useCallback(() => {
    if (!game) return;
    if (game.act === 4) {
      // A Saturday left half-finished is still a Saturday: the float is sitting
      // in the cash box, so send them back to the stand rather than stranding
      // it there.
      if (game.weekend) {
        setPhase('plan');
        return;
      }
      setPhase(game.portfolio?.status === 'closed' ? 'finale' : 'market');
      return;
    }
    if (game.act === 3) {
      setPhase(game.ownership.equityOfferSeen ? 'plan' : 'equity');
      return;
    }
    setPhase(game.act === 1 ? 'morning' : 'plan');
  }, [game]);

  /* ---------------- The day loop ---------------- */



  const openStand = useCallback(
    (price: number, cups: number, ranByManager = false) => {
      if (!game) return;

      /*
       * The Saturday stand is a folding table again.
       *
       * It deliberately does not inherit the cooler, the pitch or the manager:
       * the kid sold that business. It also runs with no cash floor, because
       * the mercy rule that stops a nine-year-old going broke on day three
       * would quietly print money into an investment account.
       */
      const params = game.weekend
        ? { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null }
        : // A duel is a one-day Act 1, so the last day comes from the challenge
          // rather than from ECON. Everything else about the day is identical.
          game.act === 1
          ? { ...DEFAULT_DAY_PARAMS, lastDay: game.challenge?.spec.days ?? ECON.TOTAL_DAYS }
          : { ...deriveDayParams(game.business, price), equityShare: game.ownership.equitySoldPct };

      const order = orderForTargetCups(game.stand, cups);
      const result = runDay(game.stand, { ...order, price }, params);

      const act1Insights = deriveInsights(result, result.nextState.history);
      const act2Insights =
        game.act >= 2 ? deriveAct2Insights(result, game.business, result.nextState.history) : [];
      // The round earns its word the first day somebody on it is served, and
      // the copy leans on a cold day if that is what happened — because turning
      // up when nobody else did is the entire point of recurring revenue.
      const roundInsights =
        result.subscriberCups > 0
          ? [recurringRevenueInsight(result.subscriberCups, result.subscriberPrice, result.weather)]
          : [];
      // Filtered against what is queued as well as what has been given, or a
      // word waiting its turn would be earned again tomorrow and end up in the
      // queue twice.
      const earned = unrecorded(
        [...act1Insights, ...act2Insights, ...roundInsights],
        [...game.learned, ...game.pendingInsights.map((insight) => insight.id)],
      );

      // One word a day. Day one earns three, and three explanations stacked
      // under the first P&L a kid has ever read is a worksheet. The rest wait
      // their turn — see `Game.pendingInsights`.
      const queue = [...game.pendingInsights, ...earned];
      const today = queue.slice(0, WORDS_PER_DAY);
      const waiting = queue.slice(WORDS_PER_DAY);

      setPlanned(projectDay(game.stand, cups, price, params));
      setOutcome(result);
      setNewInsights(today);

      setGame({
        ...game,
        // Only what was actually handed over counts as learned; that is what
        // gates the harder panels and fills the words tab.
        learned: [...game.learned, ...today.map((i) => i.id)],
        pendingInsights: waiting,
        business: updateHandsOff(game.business, ranByManager, result.profit),
        ownership: recordInvestorCut(game.ownership, result.investorCut),
      });
      setPhase('run');
    },
    [game],
  );

  /** The manager runs a sensible day so the kid can genuinely step away. */
  const letManagerRun = useCallback(() => {
    if (!game) return;
    openStand(managerPrice(game.stand.history), managerBatch(game.business), true);
  }, [game, openStand]);

  const closeDay = useCallback(() => {
    if (!game || !outcome) return;

    // Act 1 ends itself after seven days; later acts pass lastDay: null, so
    // the stand's own status is already correct and needs no fixing up here.
    const nextStand = outcome.nextState;
    const business = {
      ...game.business,
      rival: advanceRival(game.business, act2Day, outcome.price),
      daysAtPark:
        game.business.location === 'park' ? game.business.daysAtPark + 1 : game.business.daysAtPark,
    };

    const advanced: Game = { ...game, stand: nextStand, business, daysTraded: game.daysTraded + 1 };

    // Sunday. The float and the day's takings go back into the account, and the
    // kid lands back where the money is for.
    if (advanced.weekend) {
      setGame(endWeekend(advanced));
      setCareer((current) => (current ? recordDay(current, outcome.profit) : current));
      setOutcome(null);
      setPlanned(null);
      setNewInsights([]);
      setPhase('market');
      return;
    }

    setGame(advanced);
    // Banked now rather than at the end of a season, because most runs are
    // abandoned rather than finished and the parent view reads this number.
    setCareer((current) => (current ? recordDay(current, outcome.profit) : current));
    setOutcome(null);
    setPlanned(null);
    setNewInsights([]);

    // Act boundaries.
    if (
      advanced.act === 1 &&
      act1Complete(advanced.stand, advanced.challenge?.spec.days ?? ECON.TOTAL_DAYS)
    ) {
      setPhase('week-end');
      return;
    }
    if (advanced.act === 2) {
      if (act2Complete(advanced.business, act2Day)) {
        setGame(beginAct3(advanced));
        setPhase('act-intro');
        return;
      }
      // Every seventh day of the act, the reinvest-or-take-it-out fork.
      if (act2Day % 7 === 0) {
        setPhase('weekly-choice');
        return;
      }
    }
    if (advanced.act === 3 && !advanced.ownership.comparisonAnswered) {
      setPhase('deals');
      return;
    }
    if (advanced.act === 3 && advanced.ownership.comparisonAnswered) {
      setPhase('buyout');
      return;
    }
    setPhase('plan');
  }, [game, outcome, act2Day]);

  /* ---------------- Act 2 actions ---------------- */

  const handleBuyUpgrade = useCallback(
    (id: UpgradeId) => {
      if (!game) return;
      const result = buyUpgrade(game.stand.cash, game.business, id);
      if (!result.ok) return;
      setGame({
        ...game,
        stand: { ...game.stand, cash: result.cash },
        business: result.business,
      });
    },
    [game],
  );

  const handleToggleStaff = useCallback(
    (id: StaffId) => {
      if (!game) return;
      setGame({ ...game, business: toggleStaff(game.business, id) });
    },
    [game],
  );

  const handleMove = useCallback(
    (id: LocationId) => {
      if (!game) return;
      setGame({ ...game, business: moveTo(game.business, id) });
    },
    [game],
  );

  const handleWeeklyChoice = useCallback(
    (cashOut: number, signUpRegulars: boolean) => {
      if (!game) return;
      const result = applyWeeklyChoice(
        game.stand.cash,
        game.business,
        { cashOut, signUpRegulars },
        game.stand.history,
      );
      setGame({
        ...game,
        stand: { ...game.stand, cash: result.cash },
        business: result.business,
      });
      setPhase('plan');
    },
    [game],
  );

  /* ---------------- Act 3 actions ---------------- */

  const handleEquity = useCallback(
    (accept: boolean) => {
      if (!game) return;
      const offer = equityOffer(game.stand.history);
      if (accept) {
        const sold: Game = {
          ...game,
          stand: { ...game.stand, cash: game.stand.cash + offer.cash },
          ownership: acceptEquity(game.ownership, offer),
        };
        setGame(queueWords(sold, [equityInsight(offer.slice, offer.cash)]));
      } else {
        setGame({ ...game, ownership: declineEquity(game.ownership) });
      }
      setPhase('plan');
    },
    [game],
  );

  const handleDealChoice = useCallback(
    (choiceId: string) => {
      if (!game) return;
      const chosen: Game = { ...game, ownership: recordDealChoice(game.ownership, choiceId) };
      const multiples = STANDS_FOR_SALE.map((stand) => stand.askingMultiple);
      setGame(
        queueWords(chosen, [
          multipleInsight(
            STANDS_FOR_SALE.find((stand) => stand.id === choiceId)?.name ?? 'The one you picked',
            STANDS_FOR_SALE.find((stand) => stand.id === choiceId)?.askingMultiple ??
              Math.min(...multiples),
            Math.max(...multiples),
          ),
        ]),
      );
      setPhase('buyout');
    },
    [game],
  );

  const handleBuyout = useCallback(
    (accept: boolean) => {
      if (!game) return;
      if (!accept) {
        setPhase('plan');
        return;
      }
      const offer = buyoutOffer(game.stand.history, game.ownership);
      const sold: Game = { ...game, ownership: acceptBuyout(game.ownership, offer) };

      // The single most important sentence in the product, built out of the
      // arithmetic the kid is looking at on the screen behind this card.
      const words: Insight[] = [peRatioInsight(offer)];
      if (offer.roundPremium > 0) {
        words.push(businessModelInsight(offer.roundShare, offer.roundPremium));
      }

      setGame(
        queueWords(beginAct4({ ...sold, stand: { ...sold.stand, cash: 0 } }), words),
      );
      setPhase('act-intro');
    },
    [game],
  );

  /* ---------------- Act 4 actions ---------------- */

  /**
   * Buying, with the reason written down first.
   *
   * The thesis is recorded whether or not the numbers backed it up. Twelve
   * weeks later `scoreAll` grades the reasoning separately from the money,
   * which is the only way a kid can tell a good decision from a lucky one.
   */
  const handleThesisBuy = useCallback(
    (company: Company, quantId: string, qualId: string, dollars: number) => {
      if (!game?.portfolio) return;

      const result = buyStock(game.portfolio, company.ticker, dollars);
      if (!result.ok) {
        setThesisTarget(null);
        setPhase('market');
        return;
      }

      const thesis: Thesis = buildThesis({
        company,
        quantId,
        qualId,
        week: game.portfolio.week,
        priceAtBuy: currentPrice(game.portfolio, company.ticker),
        asOf: currentDate(game.portfolio),
        dollars,
      });

      const words: Insight[] = [
        thesisInsight(
          company.ticker,
          quantClaim(quantId)?.label ?? '',
          (qualClaim(qualId)?.label ?? '').toLowerCase(),
        ),
      ];
      const holdings = Object.keys(result.portfolio.holdings);
      if (holdings.length >= DIVERSIFIED_MIN_HOLDINGS) {
        words.push(diversificationInsight(holdings));
      }

      setGame(
        queueWords(
          { ...game, portfolio: result.portfolio, theses: [...game.theses, thesis] },
          words,
        ),
      );
      setThesisTarget(null);
      setPhase('market');
    },
    [game, queueWords],
  );

  const handleSellStock = useCallback(
    (ticker: string, fraction: number) => {
      if (!game?.portfolio) return;
      const result = sellStock(game.portfolio, ticker, fraction);
      if (result.ok) setGame({ ...game, portfolio: result.portfolio });
    },
    [game],
  );

  const handleAdvanceWeek = useCallback(() => {
    if (!game?.portfolio) return;
    if (game.portfolio.status === 'closed') {
      setPhase('finale');
      return;
    }
    const { portfolio, report } = advanceWeek(game.portfolio);

    // Drawdown is earned by riding one out, so the word waits for a holding
    // that actually went underwater and was actually kept.
    const words: Insight[] = [];
    const ridden = Object.values(portfolio.holdings).find(
      (holding) => holding.heldThroughDrawdown && !holding.soldWhileDown,
    );
    if (ridden) words.push(drawdownInsight(ridden.worstDrawdown, ridden.ticker));

    setGame(queueWords({ ...game, portfolio }, words));
    setWeekReport(report);
    setPhase('week-report');
  }, [game, queueWords]);

  /**
   * A new season: a genuinely new stand, and every badge and word kept.
   *
   * This has to be safe to press, or nobody will press it — and the replay is
   * where the learning actually sticks, because nothing durable is learned in
   * one sitting.
   */
  const startNewSeason = useCallback(() => {
    if (!game || !career) return;
    setCareer(beginSeason(recordSeason(career, seasonRecord(game))));
    setGame(newSeason(game));
    setHasSave(false);
    setThesisTarget(null);
    setPhase('morning');
  }, [game, career]);

  const restart = useCallback(() => {
    clearGame();
    // The club belongs to a group of people rather than to this run, so
    // starting over must not quietly destroy one somebody else is also in.
    // The playbook is the kid's own thinking and is carried for the same
    // reason: pressing replay should not delete a strategy they built.
    setGame({
      ...createGame(),
      club: game?.club ?? null,
      playbook: game?.playbook ?? createPlaybook(),
    });
    setHasSave(false);
    setPhase('morning');
  }, [game]);

  /* ---------------- Playing with other people ---------------- */

  /** Starts a fresh stand on somebody else's weather. Trophies are untouched. */
  const playChallenge = useCallback(
    (spec: ChallengeSpec) => {
      if (!career) return;
      setGame(createChallengeGame(spec, null));
      setHasSave(false);
      setPhase('morning');
    },
    [career],
  );

  const handleClubChange = useCallback(
    (next: ClubState | null) => {
      if (!game || !career) return;

      // The career counters have to move when the club does, because the club
      // badges are the only ones that cannot be derived from this device's own
      // history — the week happened on somebody else's phone.
      const me = career.name || 'You';
      const before = game.club;
      let updatedCareer = career;

      if (next && before && next.portfolio.week > before.portfolio.week) {
        updatedCareer = { ...updatedCareer, clubWeeks: updatedCareer.clubWeeks + 1 };
      }
      const passedByMe = (club: ClubState | null) =>
        club?.proposals.filter((p) => p.by === me && p.status === 'passed').length ?? 0;
      const gained = passedByMe(next) - passedByMe(before);
      if (gained > 0) {
        updatedCareer = {
          ...updatedCareer,
          clubProposalsPassed: updatedCareer.clubProposalsPassed + gained,
        };
      }

      if (updatedCareer !== career) setCareer(updatedCareer);
      setGame({ ...game, club: next });
    },
    [game, career],
  );

  /* ---------------- Render ---------------- */

  if (!game || !career) return <div className="min-h-[100dvh] bg-[#8ED6F6]" />;

  const openParent = () => {
    setReturnPhase(phase);
    setPhase('parent');
  };

  const held = badgesHeld(game, career);
  const me = career.name || 'You';
  const firstRun = isFirstRun(game, career);
  const knowsPE = game.learned.includes('pe-ratio') || career.words.includes('pe-ratio');

  /**
   * The queues jump the phase, but never over the day itself.
   *
   * Playing it showed why 'close' has to be excluded as well as 'run': the very
   * first unlock card appeared *instead of* the kid's first profit and loss
   * statement, which is the entire payoff of the day they just played. Rewards
   * come after the result, never in front of it.
   */
  const owedTheResult = phase === 'run' || phase === 'close';
  if (!owedTheResult) {
    if (wordQueue.length > 0) {
      return (
        <WordCard
          insight={wordQueue[0]}
          remaining={wordQueue.length - 1}
          onDone={() => setWordQueue((queue) => queue.slice(1))}
        />
      );
    }
    if (unlockQueue.length > 0) {
      return (
        <UnlockCard
          unlock={unlockQueue[0]}
          onDone={() => setUnlockQueue((queue) => queue.slice(1))}
          askIdentity={
            unlockQueue[0].feature === 'trophies' &&
            isUnlocked('identity', game, career) &&
            !career.name
          }
          onSetIdentity={(name, avatar) =>
            setCareer((current) => (current ? { ...current, name, avatar } : current))
          }
        />
      );
    }
  }

  /**
   * What the last few days actually looked like, for the Act 2 shop.
   *
   * Every price in that act is really a number of cups, and turning it into
   * cups needs two facts from the recent past: what the kid keeps on a cup at
   * the price they have settled on, and how many cups a normal day sells. Both
   * are read from history rather than from a projection, because a purchase is
   * judged against days that happened, not against a plan.
   */
  const recentDays = game.stand.history.slice(-3);
  const typicalCupsSold =
    recentDays.length > 0
      ? recentDays.reduce((sum, day) => sum + day.cupsSold, 0) / recentDays.length
      : 0;
  const recentMargin = (() => {
    const lastPrice = game.stand.history[game.stand.history.length - 1]?.price ?? 1.6;
    return projectDay(game.stand, 40, lastPrice, dayParams).marginPerCup;
  })();

  const thesisReport = game.portfolio
    ? scoreAll(game.theses, (ticker) => currentPrice(game.portfolio!, ticker))
    : scoreAll([], () => 0);

  /**
   * The kid's own card at the table.
   *
   * Built once here rather than inside the table screen, because the friends
   * desk needs it too — the status line on that card is "you lead on thinking",
   * which cannot be worked out without the card itself.
   */
  const myCard = cardFor(
    me,
    standing(career),
    career.bestWeekProfit,
    thesisReport.sound,
    thesisReport.scores.length,
    game.playbook,
    game.portfolio
      ? summarisePortfolio(game.portfolio, game.ownership.buyoutProceeds).gainPercent * 100
      : 0,
  );

  /**
   * Closes out the twelve weeks.
   *
   * If any win turned out to be luck, the word for that is handed over here —
   * before the finale, because a kid who has already seen a big green number is
   * not in the mood to hear it.
   */
  const finishTheRun = () => {
    const lucky = thesisReport.scores.find((score) => score.verdict === 'lucky');
    if (lucky) {
      setGame(queueWords(game, [luckInsight(lucky.thesis.ticker, lucky.gainPct)]));
    }
    setPhase(game.theses.length > 0 ? 'reckoning' : 'finale');
  };

  /**
   * What is on the title screen besides the one button.
   *
   * Empty on a first run, and it stays empty until the kid has done the thing
   * that makes each entry mean something.
   */
  const titleExtras: Array<{ emoji: string; label: string; onClick: () => void }> = [];
  const openFrom = (from: Phase, to: Phase) => () => {
    setReturnPhase(from);
    setPhase(to);
  };
  if (isUnlocked('trophies', game, career)) {
    titleExtras.push({ emoji: '🏆', label: 'Your stuff', onClick: openFrom('title', 'trophies') });
  }
  /*
   * One door for everything with somebody else behind it.
   *
   * This used to be three pills — Table, Challenge, Club — which by the end was
   * five buttons under the one that starts the game, and five buttons is the
   * menu that `src/lib/unlocks.ts` exists to prevent. They are also one loop
   * rather than three features; see `src/lib/friends.ts`.
   */
  if (isUnlocked('challenge', game, career)) {
    titleExtras.push({
      emoji: '🧑‍🤝‍🧑',
      label: 'Friends',
      onClick: openFrom('title', 'friends'),
    });
  }
  if (isUnlocked('playbook', game, career)) {
    titleExtras.push({ emoji: '📓', label: 'Playbook', onClick: openFrom('title', 'playbook') });
  }

  const screen = (() => {
    switch (phase) {
    case 'title':
      return (
        <TitleScreen
          onStart={start}
          hasSave={hasSave && (game.stand.history.length > 0 || game.act > 1)}
          onParent={firstRun ? undefined : openParent}
          rank={
            isUnlocked('trophies', game, career)
              ? { avatar: career.avatar, name: me, rank: rankFor(held.length).name }
              : null
          }
          extras={titleExtras}
          road={{ stops: road(game), line: roadLine(game, career) }}
        />
      );

    case 'act-intro':
      return (
        <ActIntroScreen
          act={game.act}
          wall={ACT_WALLS[game.act] ?? ''}
          cash={game.act === 4 ? (game.portfolio?.cash ?? 0) : game.stand.cash}
          onBegin={() => {
            if (game.act === 2) setPhase('invest');
            else if (game.act === 3) setPhase('equity');
            else setPhase('market');
          }}
        />
      );

    /* ---- Act 1: the guided ramp ---- */
    case 'morning':
      return <MorningScreen state={game.stand} onContinue={() => setPhase('shop')} />;

    case 'shop':
      return (
        <ShopScreen
          state={game.stand}
          onBack={() => setPhase('morning')}
          onConfirm={(cups) => {
            setTargetCups(cups);
            setPhase('price');
          }}
        />
      );

    case 'price':
      return (
        <PriceScreen
          state={game.stand}
          cupsMakeable={batchPlan(game.stand, targetCups).cupsMakeable}
          learned={game.learned}
          onBack={() => setPhase('shop')}
          onConfirm={(price) => openStand(price, targetCups)}
        />
      );

    /* ---- Acts 2 and 3: the cockpit ---- */
    case 'plan':
      return (
        <PlanScreen
          state={game.stand}
          params={
            game.weekend
              ? { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null }
              : dayParams
          }
          business={game.weekend ? undefined : game.business}
          dayLabel={
            game.weekend
              ? 'Saturday'
              : game.act === 1
                ? undefined
                : `Day ${game.stand.history.length + 1}`
          }
          note={
            game.weekend
              ? `$${WEEKEND_FLOAT.toFixed(2)} out of your investing money to buy lemons. Everything in the cash box goes back in tonight.`
              : undefined
          }
          onInvest={game.act === 2 ? () => setPhase('invest') : undefined}
          onOpen={(cups, price) => {
            setTargetCups(cups);
            openStand(price, cups);
          }}
        />
      );

    case 'invest':
      return (
        <InvestScreen
          cash={game.stand.cash}
          business={game.business}
          marginPerCup={recentMargin}
          typicalCupsSold={typicalCupsSold}
          onBuyUpgrade={handleBuyUpgrade}
          onToggleStaff={handleToggleStaff}
          onMove={handleMove}
          onDone={() => setPhase('plan')}
        />
      );

    case 'run':
      return outcome ? (
        <RunDayScreen outcome={outcome} onDone={() => setPhase('close')} />
      ) : null;

    case 'close':
      return outcome ? (
        <CloseScreen
          outcome={outcome}
          insights={newInsights}
          planned={planned}
          managerAvailable={game.act === 2 && game.business.staff.manager}
          nextUp={
            isUnlocked('whats-next', settledGame ?? game, career) ? (
              <div className="mt-4">
                <NextUp
                  things={whatsNext(settledGame ?? game, career)}
                  onOpenTrophies={
                    isUnlocked('trophies', game, career)
                      ? () => {
                          setReturnPhase('close');
                          setPhase('trophies');
                        }
                      : undefined
                  }
                />
              </div>
            ) : null
          }
          onNext={closeDay}
        />
      ) : null;

    case 'friends':
      return (
        <FriendsScreen
          desks={desks({
            career,
            club: game.club,
            me,
            cards: [myCard],
            unlocked: {
              challenge: isUnlocked('challenge', game, career),
              club: isUnlocked('club', game, career),
              table: isUnlocked('playbook', game, career),
            },
          })}
          onOpen={(id) => {
            setReturnPhase('friends');
            setPhase(id === 'challenge' ? 'challenge' : id === 'club' ? 'club' : 'table');
          }}
          onBack={() => setPhase(returnPhase === 'friends' ? 'title' : returnPhase)}
        />
      );

    case 'table':
      return <TableScreen mine={myCard} onBack={() => setPhase(returnPhase)} />;

    case 'playbook':
      return (
        <PlaybookScreen
          playbook={game.playbook}
          onChange={(playbook) => setGame({ ...game, playbook })}
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'week-end':
      return (
        <WeekEndScreen
          state={game.stand}
          onChallenge={
            isUnlocked('challenge', game, career)
              ? () => {
                  setReturnPhase('week-end');
                  setPhase('challenge');
                }
              : undefined
          }
          challengeResult={Boolean(game.challenge)}
          onReplay={restart}
          onContinue={() => {
            setGame(beginAct2(game));
            setPhase('act-intro');
          }}
        />
      );

    case 'weekly-choice':
      return (
        <WeeklyChoiceScreen
          cash={game.stand.cash}
          savings={game.business.savings}
          weekNumber={Math.floor(act2Day / 7)}
          regulars={game.business.regulars}
          expectedSignups={signUpRegulars(game.business, game.stand.history).added}
          onChoose={handleWeeklyChoice}
        />
      );

    /* ---- Act 3 ---- */
    case 'equity':
      return (
        <EquityOfferScreen
          offer={equityOffer(game.stand.history)}
          weeklyProfit={trailingWeeklyProfit(game.stand.history)}
          onAccept={() => handleEquity(true)}
          onDecline={() => handleEquity(false)}
        />
      );

    case 'deals':
      return <DealBoardScreen onChoose={(choiceId) => handleDealChoice(choiceId)} />;

    case 'buyout':
      return (
        <BuyoutScreen
          offer={buyoutOffer(game.stand.history, game.ownership)}
          onAccept={() => handleBuyout(true)}
          onDecline={() => handleBuyout(false)}
        />
      );

    /* ---- Act 4 ---- */
    case 'market':
      return game.portfolio ? (
        <MarketScreen
          portfolio={game.portfolio}
          readiness={readiness(game)}
          knowsPE={knowsPE}
          badges={standing(career)}
          onPlaybook={
            isUnlocked('playbook', game, career)
              ? () => {
                  setReturnPhase('market');
                  setPhase('playbook');
                }
              : undefined
          }
          onWeekendStand={() => {
            setGame(beginWeekend(game));
            setPhase('plan');
          }}
          studied={career.companiesStudied}
          onResearch={(ticker) => {
            setGame({ ...game, portfolio: markResearched(game.portfolio!, ticker) });
            // Kept on the career rather than the run: reading a set of accounts
            // is something the kid did, and it should still count next season.
            setCareer((current) => (current ? recordStudied(current, [ticker]) : current));
          }}
          onStartBuy={(company) => {
            setThesisTarget(company);
            setPhase('thesis');
          }}
          onSell={handleSellStock}
          onAdvanceWeek={handleAdvanceWeek}
          onOpenGate={() => setPhase('gate')}
          onClub={
            isUnlocked('club', game, career)
              ? () => {
                  setReturnPhase('market');
                  setPhase('club');
                }
              : undefined
          }
        />
      ) : null;

    case 'week-report':
      return weekReport ? (
        <WeekReportScreen
          report={weekReport}
          heldTickers={Object.keys(game.portfolio?.holdings ?? {})}
          onContinue={() => {
            if (game.portfolio?.status !== 'closed') {
              setPhase('market');
              return;
            }
            // The reckoning comes before the score. Finding out that a win was
            // luck lands very differently after the celebration than before it.
            finishTheRun();
          }}
        />
      ) : null;

    case 'gate':
      return <GateScreen readiness={readiness(game)} onBack={() => setPhase('market')} />;

    case 'reckoning':
      return game.portfolio ? (
        <ReckoningScreen
          report={thesisReport}
          onContinue={() => setPhase('finale')}
        />
      ) : null;

    case 'finale':
      return game.portfolio ? (
        <FinaleScreen
          summary={summarisePortfolio(game.portfolio, game.ownership.buyoutProceeds)}
          portfolio={game.portfolio}
          buyoutMultiple={game.ownership.buyoutMultiple}
          onParent={openParent}
          onRestart={restart}
          seasonNumber={game.season}
          onTrophies={
            isUnlocked('trophies', game, career)
              ? () => {
                  setReturnPhase('finale');
                  setPhase('trophies');
                }
              : undefined
          }
          onNewSeason={isUnlocked('seasons', game, career) ? startNewSeason : undefined}
        />
      ) : null;

    case 'parent':
      return (
        <ParentScreen
          report={parentReport(game, career, thesisReport.scores)}
          onBack={() => setPhase(returnPhase)}
        />
      );

    /* ---- The meta-game. None of this exists on a first run. ---- */
    case 'trophies':
      return (
        <TrophyScreen
          game={game}
          career={career}
          learned={game.learned}
          badges={held}
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'challenge':
      return (
        <ChallengeScreen
          seed={game.seed}
          me={me}
          history={game.stand.history}
          badges={held.length}
          onPlayChallenge={playChallenge}
          onCompared={(comparison) => {
            setCareer((current) =>
              current ? recordChallenge(current, comparison.winner === 'you') : current,
            );
            if (game.challenge && !game.challenge.settled) {
              setGame({ ...game, challenge: { ...game.challenge, settled: true } });
            }
          }}
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'club':
      return (
        <ClubScreen
          club={game.club}
          me={me}
          startingCash={game.portfolio?.cash ?? 0}
          seed={game.seed}
          onChange={handleClubChange}
          // Back to wherever they came from. Hardcoding the market meant
          // opening the club from the title screen dropped them into a market
          // they might not have — a blank screen in a fresh season.
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'thesis':
      return thesisTarget && game.portfolio ? (
        <ThesisScreen
          company={thesisTarget}
          price={currentPrice(game.portfolio, thesisTarget.ticker)}
          asOf={currentDate(game.portfolio)}
          maxDollars={Math.max(1, maxSpendOn(game.portfolio, thesisTarget.ticker))}
          actionLabel="Buy"
          onCancel={() => {
            setThesisTarget(null);
            setPhase('market');
          }}
          onConfirm={(quantId, qualId, dollars) =>
            handleThesisBuy(thesisTarget, quantId, qualId, dollars)
          }
        />
      ) : null;
    }
  })();

  return (
    <>
      {screen}
      {/* Badges wait for 'run' *and* 'close'. A badge is a reward for the day's
          result, so putting it on top of the day's result is self-defeating —
          and on day one there are two of them plus a word, which between them
          covered the profit and loss entirely. They land on the next screen,
          one at a time. */}
      {phase !== 'run' && phase !== 'close' && badgeQueue.length > 0 && (
        <BadgeToast
          badges={badgeQueue}
          raised={phase === 'plan' || phase === 'market'}
          onDismiss={() => setBadgeQueue((queue) => queue.slice(1))}
        />
      )}
    </>
  );
}
