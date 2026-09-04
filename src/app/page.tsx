'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  batchPlan,
  deriveInsights,
  orderForTargetCups,
  projectDay,
  round2,
  runDay,
  type DayOutcome,
  type DayProjection,
  type Insight,
  DEFAULT_GRADE,
  type LemonGrade,
} from '@/lib/simulation';
import {
  ACT2_DAYS,
  act2Progress,
  signUpRegulars,
  advanceRival,
  applyWeeklyChoice,
  buyUpgrade,
  closeStand as closeStandAt,
  deriveAct2Insights,
  deriveAct3Insights,
  deriveDayParams,
  managerBatch,
  managerPrice,
  moveTo,
  openStand as openStandAt,
  standCount,
  toggleStaff,
  trailingWeeklyProfit,
  updateHandsOff,
  updateTwoStandDays,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from '@/lib/business';
import {
  SHOP,
  hireShopStaff,
  letShopStaffGo,
  loanQuote,
  repayLoan,
  updateShopDays,
} from '@/lib/retail';
import {
  deriveListingInsights,
  listCompany,
  listingOffer,
  floatPlan,
  markListedWeek,
  type PriceMove,
} from '@/lib/listing';
import {
  acceptBuyout,
  acceptEquity,
  canSellSlice,
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
  totalValue,
  type PortfolioState,
  type WeekReport,
} from '@/lib/market';
import {
  act1Complete,
  beginWeekend,
  endWeekend,
  WEEKEND_FLOAT,
  ACT3_DAYS,
  act2Complete,
  act3Complete,
  act3Progress,
  act4Complete,
  actDay,
  badgeContext,
  badgesHeld,
  beginAct2,
  beginAct3,
  beginAct4,
  beginAct5,
  act1Progress,
  createChallengeGame,
  createGame,
  newSeason,
  readiness,
  seasonRecord,
  seededWith,
  whatsNext,
  type Game,
} from '@/lib/progress';
import { parentReport } from '@/lib/parent';
import { catchUp, createLivePortfolio, type CatchUp } from '@/lib/live';
import { LiveOpenScreen } from '@/components/acts/LiveOpenScreen';
import {
  clearGame,
  eraseEverything,
  loadBoard,
  loadCareer,
  loadGame,
  loadGuideSeen,
  loadLive,
  saveBoard,
  saveGuideSeen,
  saveLive,
  saveCareer,
  saveGame,
  type SavedBoard,
} from '@/lib/storage';
import { nextBeat, type Beat, type GuideLine } from '@/lib/guide';
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
  recordClubWeek,
  recordClubWin,
  recordDay,
  recordSeason,
  recordWords,
  recordStudied,
  standing,
  type Career,
  recordCoached,
} from '@/lib/career';
import {
  FUNDING_TOUR,
  LISTING_TOUR,
  MARKET_TOUR,
  STAND_TOUR,
  YARD_TOUR,
  toured,
  type TourId,
} from '@/lib/coach';
import { announceable, isFirstRun, isUnlocked, newlyUnlocked, type Unlock } from '@/lib/unlocks';
import { road, roadLine } from '@/lib/journey';
import { desks } from '@/lib/friends';
import { cardFor } from '@/lib/table';
import { createPlaybook } from '@/lib/playbook';
import type { ChallengeSpec } from '@/lib/challenge';
import { buildThesis, quantClaim, qualClaim, scoreAll, type Thesis } from '@/lib/thesis';
import type { ClubState } from '@/lib/club';
import { STANDS_FOR_SALE } from '@/lib/ownership';
import { type Company } from '@/lib/companies';

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
import { FundingScreen } from '@/components/acts/FundingScreen';
import { ListingScreen } from '@/components/acts/ListingScreen';
import { ListedScreen } from '@/components/acts/ListedScreen';
import { DealBoardScreen } from '@/components/acts/DealBoardScreen';
import { BuyoutScreen } from '@/components/acts/BuyoutScreen';
import { MarketScreen } from '@/components/acts/MarketScreen';
import { WeekReportScreen } from '@/components/acts/WeekReportScreen';
import { GateScreen } from '@/components/acts/GateScreen';
import { ParentScreen } from '@/components/acts/ParentScreen';
import { ErasedScreen } from '@/components/meta/ErasedScreen';
import { FinaleScreen } from '@/components/acts/FinaleScreen';
import { TrophyScreen } from '@/components/meta/TrophyScreen';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import { TableScreen } from '@/components/meta/TableScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { FriendsScreen } from '@/components/meta/FriendsScreen';
import { ClassroomScreen } from '@/components/meta/ClassroomScreen';
import { ThesisScreen } from '@/components/meta/ThesisScreen';
import { UnlockCard } from '@/components/meta/UnlockCard';
import { WordCard } from '@/components/meta/WordCard';
import { BadgeToast } from '@/components/meta/BadgeToast';
import { ResetButton } from '@/components/ResetButton';
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
  | 'funding'
  | 'deals'
  | 'buyout'
  | 'listing'
  | 'listed'
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
  | 'classroom'
  | 'live-open'
  | 'live'
  | 'thesis'
  | 'reckoning'
  | 'erased';

/**
 * Screens where a child's reward is never allowed to appear.
 *
 * `run` and `close` are excluded because a badge over the day's profit and
 * loss hides the thing it is rewarding. `parent` and `classroom` are excluded
 * for the opposite reason: an adult is reading, and nothing on those screens is
 * addressed to a kid.
 */
const KID_FREE_SCREENS = new Set<Phase>(['run', 'close', 'parent', 'classroom']);

/** The wall each act opens on, in the kid's language. */
/**
 * The wall each stage opens on, in the kid's language.
 *
 * Not a summary of what is coming. The thing that has just stopped working,
 * stated as the reason the next stage exists at all — PRODUCT.md §4: no concept
 * before the wall that motivates it. Each of these is a sentence a kid could
 * have written themselves the day before they read it.
 */
const ACT_WALLS: Record<number, string> = {
  2: 'You found the best price. You still cannot make more than 30 cups a day.',
  3: 'Two stands, a manager and a helper — and the rain still shuts all of it.',
  4: 'The shop pays for its own door. So what is the whole thing actually worth?',
};

/**
 * The wall the market opens on, which depends on how the kid got here.
 *
 * Two doors lead into Act 5 and they are not the same story. A founder who
 * listed still owns most of a company and has a price of their own to compare
 * against; a founder who sold up has money and no business. Telling the second
 * one "you have a price of your own" is a sentence about somebody else's run,
 * on the screen that is supposed to name what just happened to them.
 */
function marketWall(game: Game): string {
  return game.listing.listed
    ? 'You have money, and a price of your own to compare it against. Everybody else has one too.'
    : 'You have money and no business. Other people have businesses and want cash.';
}

export default function Page() {
  const [game, setGame] = useState<Game | null>(null);
  const [career, setCareer] = useState<Career | null>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const [hasSave, setHasSave] = useState(false);
  /**
   * Today, as ISO, filled in after mount.
   *
   * Reading the clock during render makes the server and the first client
   * render disagree, so this stays null until there is a browser to ask.
   */
  const [today, setToday] = useState<string | null>(null);
  /**
   * The classroom board, on the teacher's device.
   *
   * Kept out of the save and out of the career: it belongs to whoever is
   * running the lesson, not to any child's run, and it has to survive the
   * accidental refresh that would otherwise cost twenty-five typed-in results.
   */
  const [board, setBoard] = useState<SavedBoard>({ seed: 20260901, entries: [] });

  // The meta-game arrives in queues rather than all at once, so a kid never
  // gets four cards in a row. Each queue drains one card per tap.
  const [unlockQueue, setUnlockQueue] = useState<Unlock[]>([]);
  const [wordQueue, setWordQueue] = useState<Insight[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<Badge[]>([]);
  const [thesisTarget, setThesisTarget] = useState<Company | null>(null);

  // In-flight decisions for the day being set up.
  const [targetCups, setTargetCups] = useState(0);
  /**
   * The lemon chosen on the shopping screen, held until the price is set.
   *
   * Day one splits one decision across two screens — `shop` then `price` — so
   * the grade has to survive the hop. Day two onward the plan screen holds
   * both at once and hands them over together.
   */
  const [targetGrade, setTargetGrade] = useState<LemonGrade>(DEFAULT_GRADE);
  const [outcome, setOutcome] = useState<DayOutcome | null>(null);
  const [planned, setPlanned] = useState<DayProjection | null>(null);
  const [newInsights, setNewInsights] = useState<Insight[]>([]);
  const [weekReport, setWeekReport] = useState<WeekReport | null>(null);
  const [returnPhase, setReturnPhase] = useState<Phase>('market');

  /**
   * The live account.
   *
   * Its own slot, outside the run and outside the career. A kid who starts a
   * new street does not liquidate what they hold in the real market, and a
   * season that ends does not end this. `catchUpReport` is what the world did
   * while they were away — computed once on open, then shown once.
   */
  const [live, setLive] = useState<PortfolioState | null>(null);
  const [catchUpReport, setCatchUpReport] = useState<CatchUp | null>(null);
  /**
   * Which account the trade being set up belongs to.
   *
   * The thesis screen navigates away from whichever market opened it, so the
   * answer cannot be read from `phase` by the time the buy is confirmed.
   */
  const [tradingLive, setTradingLive] = useState(false);

  /**
   * Which of Pip's lines have already been said.
   *
   * Career-scoped: a kid on their third season has been told where this goes.
   * `null` until it has been read from the device, so nothing is spoken during
   * the first render and then un-spoken a tick later.
   */
  const [guideSeen, setGuideSeen] = useState<string[] | null>(null);
  /**
   * The storage keys a deletion actually removed.
   *
   * Held so the confirmation can list them. Reported by the storage layer
   * rather than assembled here, because "we deleted six things" is a claim and
   * the only honest source for it is the code that did the deleting.
   */
  const [erasedKeys, setErasedKeys] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      setGame(saved);
      setHasSave(true);
    } else {
      setGame(createGame());
    }
    setCareer(loadCareer() ?? createCareer());
    const savedBoard = loadBoard();
    if (savedBoard) setBoard(savedBoard);
    setLive(loadLive());
    setGuideSeen(loadGuideSeen());
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    saveBoard(board);
  }, [board]);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  useEffect(() => {
    if (live) saveLive(live);
  }, [live]);

  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  useEffect(() => {
    if (guideSeen) saveGuideSeen(guideSeen);
  }, [guideSeen]);

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

  /**
   * Hands over one word now and queues the rest for the days after it.
   *
   * `queueWords` shows a full-screen card, which is right for a beat that earns
   * one or two words — an equity deal, a buyout, a thesis. The listing earns
   * four at once, and putting four through it produced a stack of four cards
   * over the biggest moment in the game. That is precisely the failure
   * PRODUCT.md §26 records and fixed once already: *"day one handed over three
   * new words in three stacked panels of italic explanation"*.
   *
   * So the first one lands on the moment that earned it, and the rest go into
   * `Game.pendingInsights`, which the day loop already drains at one a day.
   * Nothing is lost and nothing is skipped; the kid is simply still being told
   * one new thing tomorrow.
   */
  const handOverOne = useCallback(
    (current: Game, insights: Insight[]): Game => {
      const fresh = unrecorded(insights, [
        ...current.learned,
        ...current.pendingInsights.map((insight) => insight.id),
      ]);
      if (fresh.length === 0) return current;
      const [first, ...rest] = fresh;
      return {
        ...queueWords(current, [first]),
        pendingInsights: [...current.pendingInsights, ...rest],
      };
    },
    [queueWords],
  );

  /**
   * Everything owned by somebody other than the kid.
   *
   * Auntie Ro's slice plus whatever went to the public at the float. Two
   * separate things that are recorded separately — see `handleList` — and add
   * up to one number in exactly one place, which is here.
   */
  const outsideShare = useMemo(
    () => (game ? round2(game.ownership.equitySoldPct + game.listing.floated) : 0),
    [game],
  );

  /** Act 2 onwards, the day's economics come from the business the kid built. */
  const dayParams = useMemo(() => {
    if (!game) return DEFAULT_DAY_PARAMS;
    if (game.act === 1) return DEFAULT_DAY_PARAMS;
    const price = game.stand.history[game.stand.history.length - 1]?.price ?? 1.6;
    return {
      ...deriveDayParams(game.business, price),
      equityShare: outsideShare,
    };
  }, [game, outsideShare]);


  /*
   * Each stage counts its own days from where the one before it stopped.
   *
   * `Game.stageStartDay` is recorded when a stage opens rather than derived
   * from a fixed day count, because the stands stage ends on a condition and
   * not on a clock: two kids can arrive at the shop on day fourteen and day
   * twenty-two, and a shop clock that assumed the fortnight would tell one of
   * them they were on day minus two.
   */
  const stageDay = game ? actDay(game) : 1;

  /**
   * The stage's goal and clock, computed once.
   *
   * Both the stand and the yard show it, and for a while they each worked it
   * out for themselves — which is how the yard ended up telling a kid to "open
   * the shop" two good days before the stands stage had finished with them. One
   * source, two readers.
   *
   * Act 1 is deliberately absent: its goal is arithmetic on the starting cash
   * and it derives its own.
   */
  /**
   * Should this tour run now?
   *
   * One helper rather than the same condition written at four call sites. A
   * tour waits for the badge queue for the reason PRODUCT.md §57 records: the
   * spotlight's dim panels sit over the badge toast, so a child reaching for
   * "tap to close" would hit a panel instead. Badges are the reward for what
   * just happened; a tour is about what happens next.
   */
  const showTour = useCallback(
    (id: TourId) => badgeQueue.length === 0 && !toured(career?.coached ?? [], id),
    [badgeQueue.length, career],
  );

  const markToured = useCallback(
    (id: TourId) => setCareer((current) => (current ? recordCoached(current, id) : current)),
    [],
  );

  const stage = useMemo(() => {
    if (!game || game.weekend) return undefined;
    /*
     * Act 1 has a goal now, and it says what it is.
     *
     * It used to be the one stage with no `stage` entry, so the plan screen
     * fell back to a day countdown and a cash comparison — "6 days left ·
     * $33.40 of $20.00 start". FRAMEWORK.md §14 recorded that as the reason a
     * child could not tell whether what they just did was good: nothing was
     * being aimed at. `act1Progress` supplies the line, and stays quiet for
     * the first two exploratory days.
     */
    if (game.act === 1) {
      const progress = act1Progress(game.stand);
      return {
        goal: progress.goal,
        /*
         * The day about to be played, not the number already banked.
         *
         * `PlanScreen` reads `stage?.day ?? state.history.length + 1` for its
         * header. Act 1 had no stage entry before the goal existed, so it took
         * that fallback and was right; supplying `history.length` here made
         * the header read "Day 1 / 7" above a screen titled "Day 2".
         */
        day: game.stand.history.length + 1,
        total: ECON.TOTAL_DAYS,
      };
    }
    if (game.act === 2) {
      return {
        goal: act2Progress(game.business, stageDay).nextStep,
        day: stageDay,
        total: ACT2_DAYS,
      };
    }
    if (game.act === 3) {
      return { goal: act3Progress(game.business).goal, day: stageDay, total: ACT3_DAYS };
    }
    if (game.act === 4) {
      if (game.listing.listed) {
        return {
          goal: `Trade the week out. One piece of you is $${game.listing.price.toFixed(2)}.`,
          day: stageDay,
        };
      }
      const worth = listingOffer(game.stand.history, game.ownership).worthAnything;
      return {
        goal: worth
          ? 'Find out what the whole thing is worth.'
          : 'Nobody buys a business that loses money. Get a good week together first.',
        day: stageDay,
      };
    }
    return undefined;
  }, [game, stageDay]);

  /* ---------------- Starting and resuming ---------------- */

  const start = useCallback(() => {
    if (!game) return;
    if (game.act === 5) {
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
    /*
     * The listing stage always resumes at the stand.
     *
     * This read `comparisonAnswered ? 'plan' : 'plan'` — a ternary whose two
     * branches were the same phase. It is a leftover: the comment below it
     * once promised "to the offer if it has not [been seen]", and the offer
     * had its own screen until it moved into the shop's three-way funding
     * choice and `EquityOfferScreen` was deleted. There is no offer phase left
     * to route to, so the honest version is the unconditional one. Whether a
     * kid who has not answered the comparison should instead resume on the
     * deal board is a game-design question, recorded in PRODUCT.md rather than
     * decided here.
     */
    if (game.act === 4) {
      setPhase('plan');
      return;
    }

    /*
     * A week that is already over must not reopen as a morning.
     *
     * The phase is not persisted, so closing the game is the same as
     * reloading it — and the end of a week is the most natural moment in the
     * whole product to put it down. Resuming sent every Act 1 save to the
     * morning screen regardless, so a kid with seven days already banked was
     * walked to a price dial whose only forward button calls `runDay`, and
     * `runDay` refuses a finished week by throwing. React does not route a
     * throw from an event handler to an error boundary, so `error.tsx` never
     * appeared: the button was simply dead, and the run could not be
     * recovered from inside the game.
     *
     * Only Act 1 and a duel can reach it — every later stage passes
     * `lastDay: null` and never finishes a week — which puts it on the first
     * week every child plays. Found by playing the game in a browser: every
     * unit test reached the week-end screen through the close screen, which
     * is the one path that cannot hit this.
     */
    if (game.act === 1 && act1Complete(game.stand, game.challenge?.spec.days ?? ECON.TOTAL_DAYS)) {
      setPhase('week-end');
      return;
    }

    setPhase(game.act === 1 ? 'morning' : 'plan');
  }, [game]);

  /* ---------------- The day loop ---------------- */



  const openStand = useCallback(
    (price: number, cups: number, ranByManager = false, grade: LemonGrade = DEFAULT_GRADE) => {
      if (!game) return;

      /*
       * Never hand `runDay` a week that is already over.
       *
       * `start` closes the route that got a kid here, and every stage past the
       * first resets the stand to `playing`, so this should now be
       * unreachable. It stays because of *how* it failed rather than how
       * often: `runDay` enforces the invariant by throwing, this is an event
       * handler, and React sends a throw from an event handler nowhere — not
       * to `error.tsx`, not to the console a child can see. The failure was a
       * button that did nothing, which a nine-year-old cannot tell apart from
       * a game that has stopped working, and which no amount of tapping
       * escapes.
       *
       * So it refuses towards the screen the kid should have been on instead
       * of towards a stack trace.
       */
      if (game.stand.status === 'finished') {
        setPhase('week-end');
        return;
      }

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
          : { ...deriveDayParams(game.business, price), equityShare: outsideShare };

      const order = orderForTargetCups(game.stand, cups);
      const result = runDay(game.stand, { ...order, price, grade }, params);

      const act1Insights = deriveInsights(result, result.nextState.history);
      const act2Insights =
        game.act >= 2 ? deriveAct2Insights(result, game.business, result.nextState.history) : [];
      // Break-even and interest, and only for a kid who has a rent or a
      // repayment to be taught them by. Both derivers are filtered against
      // what has already been handed over, so nothing repeats.
      const act3Insights = game.act >= 3 ? deriveAct3Insights(result, game.business) : [];
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
        [...act1Insights, ...act2Insights, ...act3Insights, ...roundInsights],
        [...game.learned, ...game.pendingInsights.map((insight) => insight.id)],
      );

      // One word a day. Day one earns three, and three explanations stacked
      // under the first P&L a kid has ever read is a worksheet. The rest wait
      // their turn — see `Game.pendingInsights`.
      const queue = [...game.pendingInsights, ...earned];
      const today = queue.slice(0, WORDS_PER_DAY);
      const waiting = queue.slice(WORDS_PER_DAY);

      /*
       * Projected at the recipe the day was actually played with.
       *
       * At the normal lemon this said a perfect day had "planned $17.54"
       * against an actual $14.74 — a $2.80 shortfall on a day where every cup
       * planned was a cup sold. The comparison screen exists to show a child
       * where a plan went wrong, so a phantom gap is worse than no gap.
       */
      setPlanned(projectDay(game.stand, cups, price, params, grade));
      setOutcome(result);
      setNewInsights(today);

      /*
       * Everything the day changes about the business, in one place.
       *
       * The order matters only in that each of these reads the *pre-day* state
       * and none of them reads another's output: the hands-off streak, the
       * two-stand streak, the shop's run of good days and a day off the loan.
       * The Saturday stand is excluded from all four, because a folding table
       * out of an investment account is not the business any of them are about.
       */
      const businessAfter = game.weekend
        ? game.business
        : {
            ...updateHandsOff(game.business, ranByManager, result.profit),
            twoStandDays: updateTwoStandDays(game.business, result.profit).twoStandDays,
            shop: updateShopDays(game.business.shop, result.profit),
            loan: repayLoan(game.business.loan),
          };

      setGame({
        ...game,
        // Only what was actually handed over counts as learned; that is what
        // gates the harder panels and fills the words tab.
        learned: [...game.learned, ...today.map((i) => i.id)],
        pendingInsights: waiting,
        business: businessAfter,
        ownership: recordInvestorCut(game.ownership, result.investorCut),
      });
      setPhase('run');
    },
    [game, outsideShare],
  );

  /** The manager runs a sensible day so the kid can genuinely step away. */
  const letManagerRun = useCallback(() => {
    if (!game) return;
    openStand(
      managerPrice(game.stand.history),
      managerBatch(game.business, game.stand.forecast),
      true,
    );
  }, [game, openStand]);

  const [lastMove, setLastMove] = useState<PriceMove | null>(null);

  /**
   * One week of being public, marked.
   *
   * Called from the close of every seventh day of the stage. Two numbers move
   * and both are shown: what the market expects a week, and how many weeks of
   * it the market will pay. The kid then carries on running the shop, which is
   * the whole point — a share price is something that happens *to* a business
   * that is otherwise having an ordinary Tuesday.
   */
  const markTheWeek = useCallback(
    (current: Game) => {
      const weekly = trailingWeeklyProfit(current.stand.history);
      const { listing, move } = markListedWeek(current.listing, weekly);
      setLastMove(move);
      setGame(handOverOne({ ...current, listing }, deriveListingInsights(listing, move)));
      setPhase('listed');
    },
    [handOverOne],
  );

  const closeDay = useCallback(() => {
    if (!game || !outcome) return;

    // Act 1 ends itself after seven days; later acts pass lastDay: null, so
    // the stand's own status is already correct and needs no fixing up here.
    const nextStand = outcome.nextState;
    const business = {
      ...game.business,
      /*
       * No rival in the first stage.
       *
       * `advanceRival` had no act guard and `RIVAL_APPEARS_ON_DAY` is 3, so a
       * competitor turned up on Act 1 day three — visible on the stand, with a
       * price, and doing *nothing*, because Act 1 runs on `DEFAULT_DAY_PARAMS`
       * and never consults `deriveDayParams`. A child watched somebody
       * undercut them and nothing happened.
       *
       * Wrong twice over: a mechanic wired to nothing (PRODUCT.md §40), and
       * competition is an Act 2 word — FRAMEWORK.md §1 says Stage 1's demand
       * is "driven only by price + quality ... No weather, competition,
       * location". Found by playing to day four.
       */
      rival: advanceRival(game.business, stageDay, outcome.price, game.act),
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
      if (act2Complete(advanced.business, stageDay)) {
        setGame(beginAct3(advanced));
        setPhase('act-intro');
        return;
      }
      // Every seventh day of the act, the reinvest-or-take-it-out fork.
      if (stageDay % 7 === 0) {
        setPhase('weekly-choice');
        return;
      }
    }
    if (advanced.act === 3) {
      if (act3Complete(advanced.business, stageDay)) {
        setGame(beginAct4(advanced));
        setPhase('act-intro');
        return;
      }
      // The same weekly fork as the stands stage. A shop makes the choice
      // sharper rather than redundant: the rent is owed either way, so money
      // taken out of a business with a lease is money it may need on Tuesday.
      if (stageDay % 7 === 0) {
        setPhase('weekly-choice');
        return;
      }
    }
    /*
     * The listing stage, in the order the beats have to arrive.
     *
     * The deal board first, because ranking three stands by what they cost per
     * dollar of profit is what makes a multiple mean anything — and it has to
     * happen before the kid is handed one for their own company, or the number
     * on their own offer is the first multiple they have ever seen and they
     * have nothing to judge it against.
     *
     * Then the two ways out. Then, once listed, a week at a time: the day loop
     * carries on and the price is marked every seventh day, because that is
     * what being public is — you keep running the shop and somebody re-prices
     * it while you do.
     */
    if (advanced.act === 4) {
      if (!advanced.ownership.comparisonAnswered) {
        setPhase('deals');
        return;
      }
      if (!advanced.listing.listed) {
        // Nothing to price yet. The goal strip says why, and the day loop
        // carries on — one decent week is all it takes.
        if (listingOffer(advanced.stand.history, advanced.ownership).worthAnything) {
          setPhase('listing');
          return;
        }
        setPhase('plan');
        return;
      }
      if (stageDay % 7 === 0) {
        markTheWeek(advanced);
        return;
      }
    }
    setPhase('plan');
  }, [game, outcome, stageDay, markTheWeek]);

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

  /* ---------------- Stage 2: another stand ---------------- */

  const handleOpenStand = useCallback(
    (location: LocationId) => {
      if (!game) return;
      const result = openStandAt(game.business, location, game.stand.cash);
      if (!result.opened) return;
      setGame({
        ...game,
        stand: { ...game.stand, cash: result.cash },
        business: result.business,
      });
    },
    [game],
  );

  /**
   * Shutting one down.
   *
   * Not an undo — the table is paid for and that money is gone. What comes
   * back is the pitch fee and the wage, which is the honest shape of the
   * decision: a site that loses money every day is one you are allowed to
   * close, and closing it does not refund what it cost to open.
   */
  const handleCloseStand = useCallback(
    (location: LocationId) => {
      if (!game) return;
      const target = game.business.stands.find((stand) => stand.location === location);
      if (!target) return;
      setGame({ ...game, business: closeStandAt(game.business, target.id) });
    },
    [game],
  );

  /* ---------------- Stage 3: the shop ---------------- */

  /**
   * Opens the shop, having been paid for one of the three ways.
   *
   * The fit-out leaves the cash box here rather than inside each funding
   * handler, so there is exactly one place that can spend it and exactly one
   * place that can set `shop.open`. The three routes differ only in where the
   * money came from, and that difference is already recorded — a loan on the
   * business, a slice on the ownership, or neither.
   */
  const openTheShop = useCallback(
    (extraCash: number, patch: Partial<Game> = {}) => {
      if (!game) return;
      const cash = game.stand.cash + extraCash;
      if (cash < SHOP.fitOut) return;
      const opened: Game = {
        ...game,
        ...patch,
        stand: { ...game.stand, cash: round2(cash - SHOP.fitOut) },
        business: {
          ...(patch.business ?? game.business),
          shop: { ...game.business.shop, open: true, goodDays: 0 },
        },
      };
      setGame(opened);
      setPhase('plan');
    },
    [game],
  );

  /*
   * Paying for it yourself, or borrowing, is *also* a decision about the
   * investor: it is turning her down.
   *
   * `declineEquity` records that, and it has to be recorded somewhere or the
   * badge for keeping the whole company becomes unearnable — which is what
   * happened the moment the offer moved out of its own screen and into the
   * three-way choice. A badge nothing can produce is the §40 defect exactly.
   */
  const handlePayCash = useCallback(
    () => openTheShop(0, { ownership: declineEquity(game?.ownership ?? createGame(0).ownership) }),
    [openTheShop, game],
  );

  /**
   * Another pair of hands behind the counter, or one fewer.
   *
   * A wage, so it costs nothing today and everything tomorrow — the same shape
   * as the helper, and the only reason it lives on the shop rather than in the
   * crew row is that the shop is the one place that can hold two of them.
   */
  const handleShopStaff = useCallback(
    (delta: 1 | -1) => {
      if (!game) return;
      const shop = delta === 1 ? hireShopStaff(game.business.shop) : letShopStaffGo(game.business.shop);
      if (shop === game.business.shop) return;
      setGame({ ...game, business: { ...game.business, shop } });
    },
    [game],
  );

  const handleBorrow = useCallback(() => {
    if (!game) return;
    const loan = loanQuote();
    openTheShop(loan.principal, {
      business: { ...game.business, loan },
      ownership: declineEquity(game.ownership),
    });
  }, [game, openTheShop]);

  /**
   * Selling a slice, which is a real thing to do whether or not it buys a shop.
   *
   * The offer is priced at five weeks of the slice and deliberately in the
   * investor's favour, so on a young business it often does *not* cover the
   * fit-out on its own. The first version of this handed the cash to
   * `openTheShop`, which bailed out silently when it was short — the kid tapped
   * a button, gave away a fifth of their company and got nothing at all.
   *
   * So the two things are separate, in the order they actually happen: she pays
   * and takes her slice, and then the shop opens if that covered it. If it did
   * not, the money is in the till and the kid can trade for a few more days and
   * come back — which is the honest answer and is a better lesson than a
   * disabled button.
   */
  const handleSellSliceForShop = useCallback(
    (slice: number) => {
      if (!game) return;
      /*
       * Checked before the cash goes in the box. The funding screen only
       * offers slices that fit under `MAX_EQUITY_SOLD`, so this is the second
       * lock on the same door — and the door matters, because `acceptEquity`
       * refuses a slice that will not fit and this line is what would
       * otherwise pay for it anyway.
       */
      if (!canSellSlice(game.ownership, slice)) return;
      const offer = equityOffer(game.stand.history, slice);
      const cash = round2(game.stand.cash + offer.cash);
      const sold: Game = {
        ...game,
        stand: { ...game.stand, cash },
        ownership: acceptEquity(game.ownership, offer),
      };
      const withWord = queueWords(sold, [equityInsight(offer.slice, offer.cash)]);

      if (cash >= SHOP.fitOut) {
        setGame({
          ...withWord,
          stand: { ...withWord.stand, cash: round2(cash - SHOP.fitOut) },
          business: {
            ...withWord.business,
            shop: { ...withWord.business.shop, open: true, goodDays: 0 },
          },
        });
      } else {
        setGame(withWord);
      }
      setPhase('plan');
    },
    [game, queueWords],
  );

  /* ---------------- Stage 4: going public ---------------- */

  const handleList = useCallback(
    (fraction: number) => {
      if (!game) return;
      const offer = listingOffer(game.stand.history, game.ownership);
      const plan = floatPlan(offer, fraction, game.ownership);
      const listing = listCompany(offer, plan);

      /*
       * The float raises cash and the public keeps a share of every profit from
       * now on, exactly the way the single investor already did.
       *
       * It is deliberately *not* written into `ownership.equitySoldPct`, which
       * was the first attempt and was wrong in a way that only showed up in the
       * parent report: that field means "the slice Auntie Ro bought", and half
       * the game reads it as such. A kid who borrowed for the shop and then
       * floated 30% was reported as having *"taken $0.00 up front in exchange
       * for 30% of every future profit"* — a sale that never happened, in the
       * one screen that has to be trustworthy.
       *
       * The two are added where they are actually used, in the day's params, so
       * a kid who sold Auntie Ro 20% and then floated 30% watches half of every
       * close screen leave. That is the correct and slightly alarming answer.
       */
      const listed: Game = {
        ...game,
        listing,
        stand: { ...game.stand, cash: round2(game.stand.cash + plan.cashRaised) },
      };
      setLastMove(null);
      setGame(handOverOne(listed, deriveListingInsights(listing, null)));
      setPhase('listed');
    },
    [game, handOverOne],
  );

  /**
   * Leaving the listing stage for the market.
   *
   * Two doors arrive here: the listing, once a week has been lived through, and
   * the buyout, which still exists and is still a respectable ending. Both hand
   * over what the kid actually walked out with — see `beginAct5`.
   */
  const handleLeaveForMarket = useCallback(() => {
    if (!game) return;
    setGame(beginAct5({ ...game, stand: { ...game.stand, cash: 0 } }));
    setPhase('act-intro');
  }, [game]);

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
      setPhase('listing');
    },
    [game, queueWords],
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
        queueWords(beginAct5({ ...sold, stand: { ...sold.stand, cash: 0 } }), words),
      );
      setPhase('act-intro');
    },
    [game, queueWords],
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

  /**
   * Buying and selling in the live account.
   *
   * Deliberately the same rules: the same position cap, the same thesis
   * required before a buy, the same drawdown bookkeeping. The only thing that
   * changes between the two markets is which weeks they are.
   */
  const handleLiveBuy = useCallback(
    (company: Company, quantId: string, qualId: string, dollars: number) => {
      if (!live) return;
      const result = buyStock(live, company.ticker, dollars);
      if (result.ok) setLive(result.portfolio);
      setThesisTarget(null);
      setTradingLive(false);
      setPhase('live');
    },
    [live],
  );

  const handleLiveSell = useCallback(
    (ticker: string, fraction: number) => {
      if (!live) return;
      const result = sellStock(live, ticker, fraction);
      if (result.ok) setLive(result.portfolio);
    },
    [live],
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

    /*
     * The live account is opened here, at the moment the twelve weeks close,
     * and never again.
     *
     * It has to happen while `game.portfolio` still exists, because the stake
     * is whatever they walked out with — cashed out at that final week's real
     * prices. Do it lazily instead and a kid who starts a new season first
     * arrives at the real market with nothing, and we would have to invent
     * money for them, which is the one thing this product does not do.
     */
    if (portfolio.status === 'closed' && !live) {
      setLive(createLivePortfolio(totalValue(portfolio)));
    }
  }, [game, live, queueWords]);

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
    /*
     * Everything still queued belongs to the season that just ended.
     *
     * Found by playing a finished run through to a new season: a badge earned
     * on the last screen of season one arrives as a toast over the first
     * morning of season two, on top of a stand with no history and nothing to
     * do with it. Worse in the pathological case — a career restored out of
     * step with its save produced eleven of them in a row over the price dial.
     *
     * A reward for something that is over is not a reward, it is an
     * interruption, so the queues are emptied with the season.
     */
    setBadgeQueue([]);
    setWordQueue([]);
    setUnlockQueue([]);
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

  /**
   * A parent deleting their child's data.
   *
   * Nothing else in the product may call this. `restart` above is the game's
   * reset and deliberately keeps the trophy case; this is the privacy one and
   * deliberately does not, because a promise that a child's data is theirs is
   * not kept by a function that leaves most of it behind.
   *
   * The four in-memory slots are set to `null` rather than to fresh objects,
   * and that is load-bearing: each one has a save effect that writes on
   * change, so handing them `createGame()` here would re-create the keys we
   * had just removed and make the confirmation screen a lie. `board` is left
   * alone for the same reason from the other direction — its effect writes
   * unconditionally, and not touching the state means it does not re-run.
   *
   * Then the page reloads rather than navigating on, so what a parent gets
   * back is a process that booted from empty storage instead of one we have
   * talked into looking empty.
   */
  const eraseAll = useCallback(() => {
    setErasedKeys(eraseEverything());
    setGame(null);
    setCareer(null);
    setLive(null);
    setGuideSeen(null);
    setHasSave(false);
    setPhase('erased');
  }, []);

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

      // Through `career.ts` rather than by reaching into the fields. Both
      // helpers existed and both were dead, because this incremented the
      // counters itself — so the only place that knew a club week had happened
      // was a component, and the function named for it was never called.
      if (next && before && next.portfolio.week > before.portfolio.week) {
        updatedCareer = recordClubWeek(updatedCareer);
      }
      const passedByMe = (club: ClubState | null) =>
        club?.proposals.filter((p) => p.by === me && p.status === 'passed').length ?? 0;
      const gained = passedByMe(next) - passedByMe(before);
      for (let i = 0; i < gained; i += 1) {
        updatedCareer = recordClubWin(updatedCareer);
      }

      if (updatedCareer !== career) setCareer(updatedCareer);
      setGame({ ...game, club: next });
    },
    [game, career],
  );

  /* ---------------- Render ---------------- */

  /*
   * The one screen that renders with no game and no career, because that is
   * precisely the state it reports. It sits above the guard for the same
   * reason: after a deletion there is nothing to fall back to, and the blue
   * rectangle below is not an acceptable receipt for a destructive action.
   */
  if (phase === 'erased') {
    return <ErasedScreen removed={erasedKeys} onStart={() => window.location.reload()} />;
  }

  if (!game || !career) return <div className="min-h-[100dvh] bg-[#8ED6F6]" />;

  /**
   * Opening the live account.
   *
   * Creating it is a one-off: the money is whatever they walked out of the
   * twelve weeks with, cashed out at the prices of that final week. Same
   * principle as Act 4 being seeded from the sale — it is their money the
   * whole way, and a kid who sold badly starts with less.
   *
   * After that, every open is a catch-up. The weeks that passed are run
   * through the ordinary `advanceWeek`, so holding through a fall counts
   * exactly as much as it would have done had they sat and watched it.
   */
  const openLive = () => {
    const existing =
      live ?? createLivePortfolio(game.portfolio ? totalValue(game.portfolio) : 0);
    const stepped = catchUp(existing);
    setLive(stepped.portfolio);
    setCatchUpReport(stepped.report);
    setReturnPhase('title');
    setPhase('live-open');
  };

  const openParent = () => {
    setReturnPhase(phase);
    setPhase('parent');
  };

  const held = badgesHeld(game, career);
  const me = career.name || 'You';
  const firstRun = isFirstRun(game, career);

  /**
   * What Pip has to say right now, if anything.
   *
   * The beat is chosen from the run rather than from the screen, and then each
   * screen opts in to the beats that belong on it via `guideOn`. Choosing
   * centrally is what keeps Pip to one line at a time; opting in per screen is
   * what keeps the act handoff from turning up on the stand.
   */
  const guideLine: GuideLine | null =
    guideSeen === null
      ? null
      : nextBeat(
          {
            act: game.act,
            daysPlayed: game.stand.history.length,
            act2Day: stageDay,
            hasManager: game.business.staff.manager,
            inMarket: phase === 'market',
            listed: game.listing.listed,
          },
          guideSeen,
        );

  const guideOn = (...ids: Beat[]) =>
    guideLine && ids.includes(guideLine.id)
      ? {
          lines: guideLine.says,
          onDismiss: () => {
            const id = guideLine.id;
            setGuideSeen((seen) => (seen?.includes(id) ? seen : [...(seen ?? []), id]));
          },
        }
      : null;
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
    /*
     * The reward cards carry the reset too.
     *
     * These return early, before the root fragment that mounts it, so they
     * were the two screens it was missing from — and one of them is the *first*
     * thing a new tester can see. Opening a link with somebody else's save on
     * it queued an unlock card ahead of the title, so a tester who needed the
     * reset most had to tap through a stranger's rewards to reach it.
     */
    if (wordQueue.length > 0) {
      return (
        <>
          <WordCard
            insight={wordQueue[0]}
            remaining={wordQueue.length - 1}
            onDone={() => setWordQueue((queue) => queue.slice(1))}
          />
          <ResetButton onReset={eraseAll} />
        </>
      );
    }
    if (unlockQueue.length > 0) {
      return (
        <>
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
        <ResetButton onReset={eraseAll} />
        </>
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
    const last = game.stand.history[game.stand.history.length - 1];
    const lastPrice = last?.price ?? 1.6;
    // At the recipe they are actually buying, or the yard prices its advice
    // off a lemon this child does not use.
    return projectDay(game.stand, 40, lastPrice, dayParams, last?.grade).marginPerCup;
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
      ? summarisePortfolio(game.portfolio, seededWith(game)).gainPercent * 100
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
  /*
   * The live market is the only extra that is not a place to look at things
   * they already did. It is the reason to be here on a Tuesday, so it goes
   * last, where the eye finishes.
   */
  if (isUnlocked('live-market', game, career)) {
    titleExtras.push({ emoji: '📈', label: 'Real market', onClick: openLive });
  }

  const screen = (() => {
    switch (phase) {
    case 'title':
      return (
        <TitleScreen
          guide={guideOn('welcome')}
          onStart={start}
          hasSave={hasSave && (game.stand.history.length > 0 || game.act > 1)}
          /* Never gated on having played.
             This was `firstRun ? undefined : openParent`, so the one screen
             built to show a grown-up what the game teaches did not exist
             until the kid had already finished a run and come back. A parent
             evaluating it cold — which is every parent, once — was shown a
             lemonade stand and no evidence of anything. The ladder in the
             report is written to be worth reading on day zero. */
          onParent={openParent}
          parentLabel={firstRun ? 'For a grown-up: what this teaches' : 'For a grown-up'}
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
          guide={guideOn('act2-open', 'act3-open', 'act4-open', 'act5-open')}
          wall={game.act === 5 ? marketWall(game) : (ACT_WALLS[game.act] ?? '')}
          cash={game.act === 5 ? (game.portfolio?.cash ?? 0) : game.stand.cash}
          /*
           * Every stage opens on the screen where its first decision lives.
           *
           * The stands and the shop both open on the yard, because both begin
           * with something to buy that is standing in the front garden already.
           * The listing stage opens on the deal board — three stands for sale
           * at three multiples — because a kid handed a multiple for their own
           * company without ever having ranked one has nothing to judge it
           * against.
           */
          onBegin={() => {
            if (game.act === 2 || game.act === 3) setPhase('invest');
            else if (game.act === 4) {
              setPhase(game.ownership.comparisonAnswered ? 'listing' : 'deals');
            } else setPhase('market');
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
          onConfirm={(cups, grade) => {
            setTargetCups(cups);
            setTargetGrade(grade);
            setPhase('price');
          }}
        />
      );

    case 'price':
      return (
        <PriceScreen
          state={game.stand}
          cupsMakeable={batchPlan(game.stand, targetCups, targetGrade).cupsMakeable}
          perCupCost={batchPlan(game.stand, targetCups, targetGrade).costPerCup}
          learned={game.learned}
          onBack={() => setPhase('shop')}
          onConfirm={(price) => openStand(price, targetCups, false, targetGrade)}
        />
      );

    /* ---- Acts 2 and 3: the cockpit ---- */
    case 'plan':
      return (
        <PlanScreen
          /*
           * The tour of the stand, once ever.
           *
           * Act 1 only, and only before it has been shown: this screen is
           * where the game stops being three guided screens with a slider
           * each and becomes a scene made of controls, and nothing had ever
           * said so. See `src/lib/coach.ts`.
           */
          /*
           * Not while a badge is still waiting to be tapped.
           *
           * Found in a browser, not by a test: the tour's dim panels sit over
           * the badge toast, so a child reaching for "tap to close" hit a
           * panel and skipped the tour instead. Two things asking for the same
           * tap, and the wrong one winning — the same shape as the toast that
           * swallowed taps on the button under it (PRODUCT.md §44).
           *
           * The badges go first. They are the reward for the day just played;
           * the tour is about the day about to be played.
           */
          tour={game.act === 1 && !game.weekend && showTour(STAND_TOUR.id)}
          onToured={() => markToured(STAND_TOUR.id)}
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
          /* The goal, on the screen the kid actually lives on.
             Act 1 derives its own; Acts 2 and 3 had none at all, which is why
             a real kid ground to day eighteen and quit three days short. Act
             2's line is the same string the shop has always shown — it was
             just only on the shop. */
          guide={guideOn('act2-stall')}
          stage={stage}
          note={
            game.weekend
              ? `$${WEEKEND_FLOAT.toFixed(2)} out of your investing money to buy lemons. Everything in the cash box goes back in tonight.`
              : undefined
          }
          /*
             The yard stays reachable for as long as the kid still runs the
             business — which is every stage before the market, not just the two
             with something new to buy. There is nothing left to *buy* at the
             listing, but there is still a helper to let go and a stand to shut,
             and a kid watching a rent bleed with no way to reach the controls is
             a dead end rather than a lesson.
          */
          onInvest={game.act >= 2 && game.act <= 4 ? () => setPhase('invest') : undefined}
          onOpen={(cups, price, grade) => {
            setTargetCups(cups);
            openStand(price, cups, false, grade);
          }}
        />
      );

    case 'invest':
      return (
        <InvestScreen
          goal={stage?.goal ?? ''}
          cash={game.stand.cash}
          business={game.business}
          marginPerCup={recentMargin}
          typicalCupsSold={typicalCupsSold}
          onBuyUpgrade={handleBuyUpgrade}
          onToggleStaff={handleToggleStaff}
          onMove={handleMove}
          onOpenStand={handleOpenStand}
          onCloseStand={handleCloseStand}
          tour={showTour(YARD_TOUR.id)}
          onToured={() => markToured(YARD_TOUR.id)}
          onOpenShop={() => setPhase('funding')}
          onShopStaff={handleShopStaff}
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
          /* Only when there is more than one counter to split the day across.
             The Saturday stand is a folding table again, so it does not get
             the business it was sold out of. */
          business={game.weekend ? undefined : game.business}
          managerAvailable={
            game.act >= 2 && game.act <= 4 && game.business.staff.manager && !game.weekend
          }
          onManagerRuns={letManagerRun}
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

    case 'classroom':
      return (
        <ClassroomScreen
          seed={board.seed}
          entries={board.entries}
          onChange={(entries) => setBoard({ ...board, entries })}
          onNewCode={() =>
            setBoard({ seed: Math.floor(Math.random() * 1_000_000), entries: [] })
          }
          onBack={() => setPhase('parent')}
        />
      );

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
          weekNumber={Math.floor(stageDay / 7)}
          regulars={game.business.regulars}
          expectedSignups={signUpRegulars(game.business, game.stand.history).added}
          onChoose={handleWeeklyChoice}
        />
      );

    /* ---- Stage 3: the shop ---- */
    case 'funding':
      return (
        <FundingScreen
          tour={showTour(FUNDING_TOUR.id)}
          onToured={() => markToured(FUNDING_TOUR.id)}
          cash={game.stand.cash}
          history={game.stand.history}
          weeklyProfit={trailingWeeklyProfit(game.stand.history)}
          alreadySold={game.ownership.equitySoldPct}
          onPayCash={handlePayCash}
          onBorrow={handleBorrow}
          onSellSlice={handleSellSliceForShop}
          onBack={() => setPhase('plan')}
        />
      );

    /* ---- Stage 4: going public ---- */
    case 'deals':
      return <DealBoardScreen onChoose={(choiceId) => handleDealChoice(choiceId)} />;

    case 'listing':
      return (
        <ListingScreen
          tour={showTour(LISTING_TOUR.id)}
          onToured={() => markToured(LISTING_TOUR.id)}
          offer={listingOffer(game.stand.history, game.ownership)}
          ownership={game.ownership}
          onList={handleList}
          onSellInstead={() => setPhase('buyout')}
          onBack={() => setPhase('plan')}
        />
      );

    case 'listed':
      return (
        <ListedScreen
          listing={game.listing}
          move={lastMove}
          onContinue={() => {
            // A week lived through is what ends the stage. Before that, back to
            // the shop — being public is something that happens while you are
            // still running the business, and the day loop is where that is.
            if (act4Complete(game.ownership, game.listing)) {
              handleLeaveForMarket();
              return;
            }
            setPhase('plan');
          }}
        />
      );

    case 'buyout':
      return (
        <BuyoutScreen
          offer={buyoutOffer(game.stand.history, game.ownership)}
          onAccept={() => handleBuyout(true)}
          onDecline={() => handleBuyout(false)}
        />
      );

    /* ---- Act 5: the market ---- */
    case 'market':
      return game.portfolio ? (
        <MarketScreen
          tour={showTour(MARKET_TOUR.id)}
          onToured={() => markToured(MARKET_TOUR.id)}
          portfolio={game.portfolio}
          guide={guideOn('market')}
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

    case 'live-open':
      return live ? (
        <LiveOpenScreen
          portfolio={live}
          report={catchUpReport}
          onEnter={() => setPhase('live')}
          onBack={() => setPhase('title')}
        />
      ) : null;

    case 'live':
      return live ? (
        <MarketScreen
          portfolio={live}
          /* The gate was passed to get here. Act 4 does not close until the
             twelve weeks are done, and the twelve weeks cannot be traded
             without it, so re-testing at the live door would be asking a kid
             to prove the same thing twice. */
          readiness={{ criteria: [], metCount: 0, canTrade: true }}
          knowsPE={knowsPE}
          badges={standing(career)}
          studied={career.companiesStudied}
          onResearch={(ticker) => {
            setLive((current) => (current ? markResearched(current, ticker) : current));
            setCareer((current) => (current ? recordStudied(current, [ticker]) : current));
          }}
          onStartBuy={(company) => {
            setThesisTarget(company);
            setTradingLive(true);
            setPhase('thesis');
          }}
          onSell={handleLiveSell}
          onOpenGate={() => setPhase('live')}
          onLeave={() => setPhase('title')}
          onPlaybook={
            isUnlocked('playbook', game, career)
              ? () => {
                  setReturnPhase('live');
                  setPhase('playbook');
                }
              : undefined
          }
        />
      ) : null;

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
          /*
           * Seeded with what the kid actually walked out with, whichever door
           * they came through. It was `buyoutProceeds` for everybody, so a
           * founder who listed was told they "started with $0.00" and shown a
           * flat return on a portfolio that had grown.
           */
          summary={summarisePortfolio(game.portfolio, seededWith(game))}
          portfolio={game.portfolio}
          ending={{
            stands: standCount(game.business),
            hadShop: game.business.shop.open,
            borrowed: game.business.loan !== null,
            listed: game.listing.listed,
            shares: game.listing.shares,
            sharePrice: game.listing.ipoPrice,
            floated: game.listing.floated,
            buyoutMultiple: game.ownership.buyoutMultiple,
          }}
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
          onClassroom={() => setPhase('classroom')}
          onEraseAll={eraseAll}
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
          today={today}
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

    case 'thesis': {
      const account = tradingLive ? live : game.portfolio;
      return thesisTarget && account ? (
        <ThesisScreen
          company={thesisTarget}
          price={currentPrice(account, thesisTarget.ticker)}
          asOf={currentDate(account)}
          maxDollars={Math.max(1, maxSpendOn(account, thesisTarget.ticker))}
          actionLabel="Buy"
          onCancel={() => {
            setThesisTarget(null);
            setTradingLive(false);
            setPhase(tradingLive ? 'live' : 'market');
          }}
          onConfirm={(quantId, qualId, dollars) =>
            tradingLive
              ? handleLiveBuy(thesisTarget, quantId, qualId, dollars)
              : handleThesisBuy(thesisTarget, quantId, qualId, dollars)
          }
        />
      ) : null;
    }
    }
  })();

  return (
    <>
      {screen}
      {/* Badges wait for 'run' *and* 'close'. A badge is a reward for the day's
          result, so putting it on top of the day's result is self-defeating —
          and on day one there are two of them plus a word, which between them
          covered the profit and loss entirely. They land on the next screen,
          one at a time.

          They also wait for 'parent' and 'classroom'. Those two screens are
          not the child's game — they are the thirty seconds in which an adult
          decides whether any of this teaches anything — and a gold rosette
          bouncing over the evidence is the exact impression we are trying not
          to give. The queue is not consumed, only held: the badge is still
          there when the kid comes back. */}
      {!KID_FREE_SCREENS.has(phase) && badgeQueue.length > 0 && (
        <BadgeToast
          badges={badgeQueue}
          onDismiss={() => setBadgeQueue((queue) => queue.slice(1))}
        />
      )}

      {/*
        The reset, on every screen, for as long as several testers share one
        link and there are no accounts.

        Deliberately outside the phase switch so there is no screen it is
        missing from — the one that matters most is the title, where a new
        tester is offered "Keep going" into somebody else's run.

        Not shown on `run`, because that screen is a twelve-second animation
        with nothing to decide and a floating button over it is just something
        to fiddle with; and not on `parent`, which has the full version of this
        with the same confirmation. A beta affordance — PRODUCT.md §61.
      */}
      {phase !== 'run' && phase !== 'parent' && <ResetButton onReset={eraseAll} />}
    </>
  );
}
