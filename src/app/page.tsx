'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WEEKLY_EVERY, afterDay, paramsForDay, settleDay, type AfterDay } from '@/lib/day';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  batchPlan,
  orderForTargetCups,
  projectDay,
  round2,
  runDay,
  type DayOutcome,
  type DayParams,
  type Decisions,
  type GameState,
  type DayProjection,
  type Insight,
  DEFAULT_GRADE,
  type LemonGrade,
} from '@/lib/simulation';
import {
  ACT2_DAYS,
  act2Progress,
  signUpRegulars,
  applyWeeklyChoice,
  buyUpgrade,
  closeStand as closeStandAt,
  cheapestUpgrade,
  managerBatch,
  managerPrice,
  moveTo,
  openStand as openStandAt,
  standCount,
  toggleStaff,
  trailingWeeklyProfit,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from '@/lib/business';
import {
  SHOP,
  hireShopStaff,
  letShopStaffGo,
  loanQuote,
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
} from '@/lib/ownership';
import {
  DIVERSIFIED_MIN_HOLDINGS,
  advanceWeek,
  buy as buyStock,
  currentDate,
  currentPrice,
  holdingValue,
  weeksHeld,
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
  heldThroughWorstDay,
  createChallengeGame,
  createGame,
  newSeason,
  readiness,
  seasonRecord,
  seededWith,
  whatsNext,
  type Game,
  type Act,
} from '@/lib/progress';
import { DEMO_STAGES, demoGame } from '@/lib/demo';
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
  loadInbox,
  loadLedger,
  loadNudgesShown,
  loadLive,
  saveBoard,
  saveGuideSeen,
  saveInbox,
  saveLedger,
  saveNudgesShown,
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
  multipleInsightFor,
  peRatioInsight,
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
  markFor,
  toured,
  type TourId,
} from '@/lib/coach';
import {
  announceable,
  isFirstRun,
  isUnlocked,
  newlyUnlocked,
  unlockedFeatures,
  type Unlock,
} from '@/lib/unlocks';
import { nextStop, road, roadLine } from '@/lib/journey';
import { desks } from '@/lib/friends';
import { cardFor } from '@/lib/table';
import { createPlaybook } from '@/lib/playbook';
import type { ChallengeSpec } from '@/lib/challenge';
import { buildThesis, drifted, quantClaim, qualClaim, scoreAll, type Thesis } from '@/lib/thesis';
import type { ClubState } from '@/lib/club';
import {
  boardForRound,
  dealRoundsTaken,
  judgeDealChoice,
  nextDealBoard,
} from '@/lib/ownership';
import { SNAPSHOT, type Company } from '@/lib/companies';

import { TitleScreen } from '@/components/TitleScreen';
import { MorningScreen } from '@/components/MorningScreen';
import { ShopScreen } from '@/components/ShopScreen';
import { PriceScreen } from '@/components/PriceScreen';
import { PlanScreen } from '@/components/PlanScreen';
import { RunDayScreen } from '@/components/RunDayScreen';
import { middayCall } from '@/lib/midday';
import { createLedger, hasAnything, localDay, type Deed, type Ledger } from '@/lib/ledger';
import { balance as balanceOf, streak as streakOf } from '@/lib/ledger';
import { CheckInScreen } from '@/components/meta/CheckInScreen';
import { CreditsScreen } from '@/components/meta/CreditsScreen';
import { MessagesScreen } from '@/components/meta/MessagesScreen';
import { ScoutScreen } from '@/components/meta/ScoutScreen';
import { scoutable } from '@/lib/scout';
import { nudges as nudgesFor, roomLeftToday, unshown } from '@/lib/notify';
import {
  ask as askForNoticePermission,
  permission as noticePermission,
  show as showNotice,
  type NoticePermission,
} from '@/lib/systemNotice';
import {
  asCode,
  block as blockThread,
  createInbox,
  grownUpThread,
  inboxLine,
  openThread,
  receive as receiveMessage,
  report as reportThread,
  send as sendMessage,
  type Inbox,
} from '@/lib/messages';
import { missionsFor } from '@/lib/missions';
import { HELD_A_WHILE_WEEKS, topUp } from '@/lib/credits';
import { checkIn as buildCheckIn, storyFor, type Answers } from '@/lib/checkin';
import { awardFor } from '@/lib/credits';
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
  | 'checkin'
  | 'credits'
  | 'messages'
  | 'scout'
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
  /**
   * The deed ledger. Loaded with everything else, saved on every change.
   *
   * Not folded into `career`, because a new season clears the run and must not
   * clear the record of which days a child turned up and thought — see the note
   * on `LEDGER_KEY` in storage.ts.
   */
  const [ledger, setLedger] = useState<Ledger>(createLedger);
  const [inbox, setInbox] = useState<Inbox>(createInbox);
  /** The last code made for a friend, and whatever the last paste had to say. */
  const [messageCode, setMessageCode] = useState<string | null>(null);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [codeThread, setCodeThread] = useState<string | null>(null);
  /** Nudge ids already said, so nothing fires twice and the daily cap holds. */
  const [nudgesShown, setNudgesShown] = useState<string[]>([]);
  /**
   * What the browser will let us put on this device.
   *
   * `permission()` never prompts and never throws, so it is safe to read — but
   * it is read in an effect rather than as the initial state, because on the
   * server there is no `Notification` and the two renders would disagree.
   */
  const [noticeState, setNoticeState] = useState<NoticePermission>('unsupported');

  /**
   * Write a deed down, at the moment it happens.
   *
   * One function rather than a `setLedger` at each site, because the day a deed
   * is filed under has to come from one place. `localDay` is the child's own
   * calendar day — deliberately not the `today` state below it, which is the
   * *UTC* date the Same-Sky Challenge needs so that everybody in the world gets
   * one sky. Two facts that both look like "the date"; see `localDay`.
   */
  const noteDeed = useCallback((deed: Deed, what?: string) => {
    setLedger((current) => awardFor(current, deed, localDay(), what).ledger);
  }, []);
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
  /**
   * Enough of today to run it again.
   *
   * The day stopped being decided at the moment it starts: a child is asked
   * once, at lunchtime, whether to move the sign. Answering re-runs `runDay`
   * from the same stand, the same decisions and the same seed with an
   * `afternoonPrice` added — so the morning is reproduced exactly and only the
   * second half of the crowd sees anything different.
   *
   * Held here rather than recomputed because `params` depends on the business
   * as it was this morning and on the price the day opened at, and rebuilding
   * it from a `game` that has since moved on would be a different day.
   */
  const [dayPlan, setDayPlan] = useState<{
    state: GameState;
    decisions: Decisions;
    params: Partial<DayParams>;
    ranByManager: boolean;
  } | null>(null);

  /**
   * Which day of the stage the last banked day was, counting itself.
   *
   * Captured when the day is banked rather than recomputed when the close
   * screen is dismissed, because `actDay` reads `stand.history.length` and
   * banking appends to it. Every routing decision below — the act boundaries
   * and the weekly fork — is about the day just played, so it reads this.
   * This is the off-by-one that used to be implicit in the stand being
   * advanced in one callback and the counters in another.
   */
  const [settledStageDay, setSettledStageDay] = useState(1);
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
    setLedger(loadLedger());
    setInbox(loadInbox());
    setNudgesShown(loadNudgesShown());
    setNoticeState(noticePermission());
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
    // Only once there is something in it. See `hasAnything`: an unconditional
    // save re-created the key one tick after the reset had deleted it.
    if (hasAnything(ledger)) saveLedger(ledger);
  }, [ledger]);

  useEffect(() => {
    // Same rule as the ledger, for the same reason: an unconditional save
    // would re-create the key one tick after the reset deleted it.
    if (inbox.threads.length > 0) saveInbox(inbox);
  }, [inbox]);

  useEffect(() => {
    if (nudgesShown.length > 0) saveNudgesShown(nudgesShown);
  }, [nudgesShown]);
  /**
   * Show one notification, if we are allowed and have not used today's two.
   *
   * Up here with the other effects rather than next to the nudge list, because
   * that list is computed after the early returns for the reward cards — and a
   * hook after an early return is a hook that sometimes does not run. So the
   * inputs are rebuilt here from state, the same way `handleCheckIn` does it.
   *
   * The recording is the careful part. `showNotice` returns whether it
   * actually appeared, and the id is marked said only when it did — otherwise
   * a browser that refused, or threw, would silently burn a child's two-a-day
   * on notifications nobody saw.
   *
   * One per commit rather than a loop: two arriving together is the failure
   * mode that gets an app uninstalled, and §26's rule about one thing at a
   * time does not stop applying at the lock screen.
   */
  useEffect(() => {
    if (noticeState !== 'granted') return;
    const today = localDay();
    if (roomLeftToday(nudgesShown, today) <= 0) return;

    const portfolio = live ?? game?.portfolio;
    if (!portfolio || !career) return;

    const context = {
      ledger,
      today,
      checkIn: buildCheckIn(
        portfolio,
        career,
        ledger,
        today,
        portfolio.standEarnings + totalValue(portfolio),
      ),
      drifts: game?.portfolio
        ? drifted(
            game.theses,
            (ticker) => SNAPSHOT.find((company) => company.ticker === ticker),
            (ticker) => currentPrice(game.portfolio!, ticker),
            currentDate(game.portfolio),
          )
        : [],
      fromGrownUp:
        grownUpThread(inbox)?.messages.filter((message) => message.author === 'grown-up').length ??
        0,
      canSpend: true,
    };

    const next = unshown(context, nudgesShown)[0];
    if (!next) return;

    let alive = true;
    void showNotice(next.title, next.body, next.kind).then((shown) => {
      if (alive && shown) setNudgesShown((current) => [...current, next.id].slice(-60));
    });
    return () => {
      alive = false;
    };
  }, [noticeState, nudgesShown, ledger, inbox, live, game, career]);


  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  useEffect(() => {
    if (guideSeen) saveGuideSeen(guideSeen);
  }, [guideSeen]);

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
    if (!game || !career) return;
    const earned = earnedBadges(badgeContext(game, career));
    const fresh = newlyEarned(career, earned);

    let next = recordWords(career, game.learned);
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
  }, [game, career]);

  /** Announce each new system exactly once, the moment it becomes real. */
  useEffect(() => {
    if (!game || !career) return;
    const fresh = newlyUnlocked(game, career, career.announced);
    if (fresh.length === 0) return;
    // Everything is marked seen; only the non-silent ones get a card.
    setUnlockQueue((queue) => {
      const have = new Set(queue.map((unlock) => unlock.feature));
      const add = announceable(fresh).filter((unlock) => !have.has(unlock.feature));
      return add.length > 0 ? [...queue, ...add] : queue;
    });
    setCareer(recordAnnounced(career, fresh.map((unlock) => unlock.feature)));
  }, [game, career]);

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
   * Today's rules, for the screens that only *read* them.
   *
   * The planning screen shows the capacity, the rent and the share of the
   * street, so it needs the same parameters the day will be run with — priced
   * off yesterday's sign, because today's has not been set yet. One function
   * answers this for every caller; see `paramsForDay`.
   */
  const dayParams = useMemo(() => {
    if (!game) return DEFAULT_DAY_PARAMS;
    const price = game.stand.history[game.stand.history.length - 1]?.price ?? 1.6;
    return paramsForDay(game, price);
  }, [game]);


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
    (id: TourId, finished: boolean) =>
      setCareer((current) =>
        current ? recordCoached(current, markFor(current.coached, id, finished)) : current,
      ),
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

      // What kind of day this is, economically. One answer, in `day.ts`.
      const params = paramsForDay(game, price);

      const order = orderForTargetCups(game.stand, cups);
      const decisions = { ...order, price, grade };
      const result = runDay(game.stand, decisions, params);

      /*
       * Projected at the recipe the day was actually played with.
       *
       * At the normal lemon this said a perfect day had "planned $17.54"
       * against an actual $14.74 — a $2.80 shortfall on a day where every cup
       * planned was a cup sold. The comparison screen exists to show a child
       * where a plan went wrong, so a phantom gap is worse than no gap.
       */
      setPlanned(projectDay(game.stand, cups, price, params, grade));
      /*
       * Everything needed to run this exact day again.
       *
       * Kept because the day is no longer decided when it starts: the child is
       * asked once, at lunchtime, whether to move the sign, and answering
       * re-runs the day from the same state and the same seed with an
       * `afternoonPrice` added. Same weather, same footfall, same draws — only
       * the second half of the crowd faces a different number. See
       * `buildCustomers`.
       */
      setDayPlan({ state: game.stand, decisions, params, ranByManager });
      setOutcome(result);
      setPhase('run');
    },
    [game],
  );

  /**
   * The one decision inside a day.
   *
   * Re-runs the same day from the same stand with an afternoon price on it.
   * Same seed, same weather, same footfall, same draws — `buildCustomers` only
   * re-reads the reservation prices it had already drawn, so the morning the
   * child has just watched is reproduced exactly and only the second half of
   * the crowd sees a different number.
   *
   * See PRODUCT.md §68 for why the day needed a decision in it at all.
   */
  const changeMiddayPrice = useCallback(
    ({ price, topUp }: { price: number; topUp: number }) => {
      if (!dayPlan) return;
      setOutcome(
        runDay(
          dayPlan.state,
          { ...dayPlan.decisions, afternoonPrice: price, afternoonTopUp: topUp },
          dayPlan.params,
        ),
      );
    },
    [dayPlan],
  );

  /**
   * The day is over. Work out what it taught and what it changed.
   *
   * This used to run inside `openStand`, the instant the day was computed and
   * before a single customer had walked on screen. That was fine while a day
   * was wholly decided by the two dials pressed before it started. It is not
   * fine now: the child is asked at lunchtime whether to move the sign, and
   * answering re-runs the day — so a day settled on the way in would have
   * banked the morning's insights, the morning's hands-off streak and the
   * morning's profit, and then quietly disagreed with the close screen.
   *
   * So nothing is banked until the crowd has gone home. Everything here is
   * computed from the *pre-day* game and the final outcome, which is what makes
   * it safe to be called once at the end rather than incrementally.
   */
  const bankDay = useCallback(
    (result: DayOutcome, ranByManager: boolean) => {
      if (!game) return;

      /*
       * Everything the day changes, in `src/lib/day.ts`.
       *
       * This function used to hold half of it and `closeDay` held the other
       * half — the streaks and the words here, the stand and the competitor
       * there — and `src/lib/demo.ts` held a third copy of the same idea for
       * the tests to walk. They drifted, and the drift is why the finishability
       * proof ran Stage 2 with no competitor in it for however long. There is
       * one function now and all three callers use it.
       *
       * The stage day is captured here rather than recomputed at close,
       * because `actDay` reads `stand.history.length` and the settle appends
       * to it. See `SettleOptions.stageDay`.
       */
      const settled = settleDay(game, result, { ranByManager, stageDay });
      setNewInsights(settled.handedOver);
      setSettledStageDay(stageDay);
      setGame(settled.game);
    },
    [game, stageDay],
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

  /**
   * Maps the routing decision onto a screen.
   *
   * The decision itself is `afterDay`, in `src/lib/day.ts`, where it can be
   * tested without playing to the day in question. This half is the part that
   * genuinely needs React: setting a phase, and calling the right `beginActN`
   * for a boundary.
   *
   * `from` is required and has no default, which is deliberate. It read `game`
   * off the closure for about an hour and that was a bug with teeth: the weekly
   * fork calls `setGame` with the child's choices and then routes, React has
   * not flushed by then, so `beginAct3` ran against the *pre-fork* game and
   * silently discarded the sixteen neighbours they had just signed up. Found by
   * ticking the box in the browser and reading the save.
   *
   * A default would have hidden it again. Every caller now has to say which
   * game it means, and the one that has just changed it says so.
   */
  const goWhere = useCallback(
    (where: AfterDay, from: Game) => {
      const game = from;
      switch (where) {
        case 'week-end':
          setPhase('week-end');
          return;
        case 'weekly-choice':
          setPhase('weekly-choice');
          return;
        case 'next-act':
          setGame(game.act === 2 ? beginAct3(game) : beginAct4(game));
          setPhase('act-intro');
          return;
        case 'deals':
          setPhase('deals');
          return;
        case 'listing':
          setPhase('listing');
          return;
        case 'mark-week':
          markTheWeek(game);
          return;
        default:
          setPhase('plan');
      }
    },
    [markTheWeek],
  );

  /**
   * The close screen is dismissed. Decide where the child goes.
   *
   * Routing only. This used to advance the stand, the competitor and the day
   * count as well, which is half of a day's state transition living in a React
   * callback while the other half lived in `bankDay` and a third copy lived in
   * `src/lib/demo.ts`. All of it is in `settleDay` now and the day is already
   * banked by the time this runs — see `src/lib/day.ts` for what that drift
   * cost.
   *
   * Every decision below is about **the day just played**, so every one of
   * them reads `settledStageDay` rather than `stageDay`. `stageDay` is derived
   * from the history and the history now includes today, so it is one greater
   * here than it was when the day was banked.
   */
  const closeDay = useCallback(() => {
    if (!game || !outcome) return;

    // Sunday. The float and the day's takings go back into the account, and the
    // kid lands back where the money is for.
    if (game.weekend) {
      setGame(endWeekend(game));
      setCareer((current) => (current ? recordDay(current, outcome.profit) : current));
      noteDeed('ran-a-day');
      if (outcome.profit >= ECON.ACT1_PROFIT_TARGET) noteDeed('hit-the-goal');
      setOutcome(null);
      setPlanned(null);
      setNewInsights([]);
      setPhase('market');
      return;
    }

    // Banked now rather than at the end of a season, because most runs are
    // abandoned rather than finished and the parent view reads this number.
    setCareer((current) => (current ? recordDay(current, outcome.profit) : current));
    noteDeed('ran-a-day');
    if (outcome.profit >= ECON.ACT1_PROFIT_TARGET) noteDeed('hit-the-goal');
    /*
     * Keeping their nerve, judged by the function that already judges it.
     *
     * `heldThroughWorstDay` is one of the four readiness criteria, so the
     * definition of "did not panic" lives in exactly one place and this reads
     * it rather than inventing a second one. Read off the settled history,
     * which has today in it, because holding is only visible in the day after
     * the loss.
     */
    if (heldThroughWorstDay([...game.stand.history]).met) noteDeed('held-through-a-loss');
    setOutcome(null);
    setPlanned(null);
    setNewInsights([]);

    goWhere(afterDay(game, settledStageDay, { forkTaken: false }), game);
  }, [game, outcome, settledStageDay, goWhere, noteDeed]);

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
      /*
       * The choices, applied once, and then routed *from the result*.
       *
       * Both halves read `chosen` rather than `game`. Routing from `game` is
       * the bug described on `goWhere`: it threw away the regulars.
       */
      const chosen: Game = {
        ...game,
        stand: { ...game.stand, cash: result.cash },
        business: result.business,
      };
      setGame(chosen);
      /*
       * Back through the same decision, with the fork marked as taken.
       *
       * This used to go straight to the planning screen, which was fine while
       * the fork could only fire mid-stage. It now also fires on a stage's last
       * day — see `afterDay` for why — so dismissing it has to be able to land
       * on the next act's introduction instead.
       */
      goWhere(afterDay(chosen, settledStageDay, { forkTaken: true }), chosen);
    },
    [game, settledStageDay, goWhere],
  );

  /* ---------------- Act 3 actions ---------------- */

  const handleDealChoice = useCallback(
    (choiceId: string) => {
      if (!game) return;
      const chosen: Game = { ...game, ownership: recordDealChoice(game.ownership, choiceId) };
      /*
       * The best-paying deed in the whole table, filed where it happens.
       *
       * `recordDealChoice` is the only place `passedOnOverpriced` is ever set,
       * so this is the only moment it can be recorded — and it is the moment
       * the readiness gate already calls "the hard one".
       *
       * On the *transition* rather than on the value, now that there is more
       * than one board. `passedOnOverpriced` is monotonic, so a child on their
       * second board who declines the overpriced stand again would otherwise
       * file the same deed twice for one piece of evidence.
       */
      if (chosen.ownership.passedOnOverpriced && !game.ownership.passedOnOverpriced) {
        noteDeed('passed-on-price', choiceId);
      }
      /* Built from the board they actually answered — see `multipleInsightFor`. */
      setGame(queueWords(chosen, [multipleInsightFor(choiceId)]));
      /*
       * Back where they came from — or straight at the next board.
       *
       * Stage four reaches the board on the way to the listing. A child in the
       * market reaches it from the readiness gate, and sending them to the
       * listing screen for a company they floated forty days ago would be a
       * non-sequitur — they came to tick a box, so they go back to the box.
       *
       * The one case that is neither: a wrong answer on their **first** board
       * in stage four. They have just been shown three columns of arithmetic
       * and the reason the middle one won, and that is the best moment in the
       * whole run to hand them another three — so the phase does not change
       * and `nextDealBoard` serves the next one. Exactly one follow-up, so the
       * stage cannot become a loop; any further goes are reached from the gate,
       * where the child is asking for them.
       */
      const rightNow = judgeDealChoice(choiceId).correct;
      const firstGo = dealRoundsTaken(game.ownership) === 0;
      if (game.act === 4 && !rightNow && firstGo) return;
      setPhase(game.act === 5 ? 'gate' : 'listing');
    },
    [game, queueWords, noteDeed],
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
    (
      company: Company,
      quantId: string,
      qualId: string,
      dollars: number,
      riskId?: string,
      exitId?: string,
    ) => {
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
        riskId,
        exitId,
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
      /*
       * Both deeds, in the order they happened: the reason was written before
       * the money moved, and the money moving is what made the portfolio
       * spread. `sized-a-position` too, because choosing the amount is a
       * separate decision from choosing the company and the note asks for it
       * by name.
       */
      noteDeed('wrote-a-thesis', thesis.ticker);
      noteDeed('sized-a-position', thesis.ticker);
      if (holdings.length >= DIVERSIFIED_MIN_HOLDINGS) noteDeed('diversified');
      setThesisTarget(null);
      setPhase('market');
    },
    [game, queueWords, noteDeed],
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

    /*
     * Patience, paid once per holding.
     *
     * "Staying invested over time" from the customer's credit list, and the
     * one their example was about. Checked here because advancing the week is
     * the only moment `weeksHeld` can change — and gated on the ledger not
     * already carrying this ticker, because paying every week would turn
     * patience into a salary rather than a decision.
     */
    for (const ticker of Object.keys(portfolio.holdings)) {
      if (weeksHeld(portfolio, ticker) < HELD_A_WHILE_WEEKS) continue;
      const alreadyPaid = ledger.entries.some(
        (entry) => entry.deed === 'held-a-while' && entry.what === ticker,
      );
      if (!alreadyPaid) noteDeed('held-a-while', ticker);
    }

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
  }, [game, live, queueWords, ledger.entries, noteDeed]);

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

  /**
   * The admin shortcut: hand the app a save that starts part-way through.
   *
   * Asked for as a way to shortcut to the market for a demo. It unlocks
   * nothing — `unlocks.ts` and `readiness` are untouched, and `demoGame` gets
   * past both by playing the game forward with the same functions this file
   * uses. So the gated path a child plays is exactly the gated path a child
   * plays, with or without this button existing.
   *
   * The club and the playbook are carried for the same reason `restart` carries
   * them: one belongs to a group of people and the other is the kid's own
   * thinking, and neither is this button's to destroy. The career is left
   * alone, which means the badge effect will award the jumped save whatever its
   * own history deserves rather than this handing any out.
   */
  const jumpToStage = useCallback(
    (act: Act) => {
      const stage = DEMO_STAGES.find((entry) => entry.act === act);
      if (!stage) return;
      const next: Game = {
        ...demoGame(act),
        club: game?.club ?? null,
        playbook: game?.playbook ?? createPlaybook(),
      };
      setGame(next);
      /*
       * Bank what the save earned, and mark it as already celebrated.
       *
       * Without this the jump lands on a stack of full-screen cards — the
       * trophy case, Friends, the club — each announcing a system as new when
       * the save has had it for a fortnight. That is the one-card rule working
       * correctly on a save that lied to it: the features did all become real
       * in the same instant.
       *
       * The badges themselves are still `earnedBadges` over the save's own
       * history, so §16 holds and nothing is handed out. Only the party is
       * skipped, which is right — a week that was played off-screen had its
       * party off-screen too.
       */
      setCareer((current) => {
        if (!current) return current;
        const banked = recordBadges(current, earnedBadges(badgeContext(next, current)));
        return recordAnnounced(banked, unlockedFeatures(next, banked));
      });
      // Everything mid-day is about a day that no longer exists.
      setOutcome(null);
      setPlanned(null);
      setNewInsights([]);
      setHasSave(true);
      setReturnPhase(stage.phase);
      setPhase(stage.phase);
    },
    [game],
  );

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
  /**
   * Pay for the check-in, then send them where the answer points.
   *
   * Three deeds can come out of one ritual and each is its own row in the
   * table, because they are three different things a child got right: naming
   * why the market moved, telling company news from noise, and judging that
   * nothing needed doing. `awardFor` caps each per day, so a child who reopens
   * the ritual is not paid twice — the screen says so rather than silently
   * paying nothing.
   */
  const handleCheckIn = useCallback(
    (answers: Answers, allRight: boolean) => {
      /*
       * Rebuilt here rather than closed over.
       *
       * The render-time `checkInState` is defined further down the body, past
       * the point where hooks have to be declared — closing over it made this
       * a use-before-declaration. Rebuilding is cheap and has the better
       * property anyway: the marking is done against the state as it is at the
       * moment of collection, not as it was when the screen first opened.
       */
      const portfolio = live ?? game?.portfolio;
      if (!portfolio || !career) return;
      const state = buildCheckIn(
        portfolio,
        career,
        ledger,
        localDay(),
        portfolio.standEarnings + totalValue(portfolio),
      );

      if (!state.doneToday) {
        noteDeed('answered-the-check-in');
        if (answers.because === state.because) noteDeed('named-the-mover');
        if (answers.because !== undefined && state.because === 'market' && allRight) {
          noteDeed('told-news-from-noise');
        }
        if (answers.needed === 'nothing' && state.needed === 'nothing') {
          noteDeed('held-when-nothing-changed');
        }
        /*
         * "Identifying excessive concentration", which is the note's phrase.
         *
         * Awarded for the *right* answer on a portfolio that really is
         * concentrated, not for picking the option. `neededToday` decides
         * whether it is true, and it is only true at fewer than three holdings
         * — the market refuses any single position over 35%, so the concentration
         * a child can actually create is the two-holding kind.
         */
        if (answers.needed === 'spread-out' && state.needed === 'spread-out') {
          noteDeed('trimmed-concentration');
        }
      }
      setPhase(returnPhase);
    },
    [live, game?.portfolio, career, ledger, noteDeed, returnPhase],
  );

  /**
   * Turn credits into money to invest with.
   *
   * The dollars land in whichever account the child actually has — the live
   * practice portfolio if it exists, the in-game one otherwise — and the
   * credits only leave the ledger if the top-up succeeded. `topUp` refuses
   * rather than clamping, so a partial purchase is impossible; see §54 for the
   * time a clamp banked the cash and did not deliver the goods.
   */
  const handleTopUp = useCallback(
    (dollars: number) => {
      const result = topUp(ledger, dollars);
      if (result.dollars <= 0) return;
      setLedger(result.ledger);
      if (live) {
        setLive((current) => (current ? { ...current, cash: round2(current.cash + result.dollars) } : current));
      } else {
        setGame((current) =>
          current?.portfolio
            ? {
                ...current,
                portfolio: { ...current.portfolio, cash: round2(current.portfolio.cash + result.dollars) },
              }
            : current,
        );
      }
    },
    [ledger, live],
  );

  /**
   * Send a message, and pay for the ones that are a child explaining
   * themselves.
   *
   * `taught-a-grown-up` is awarded on *sending*, not on a reply arriving. A
   * reward that waits for somebody else punishes the child whose grown-up is
   * busy, and the learning is in the saying — you do not know a thing until
   * you have had to explain it out loud.
   *
   * The credit is only for a mission, though. Any old message would make this
   * a row that pays for typing, and §16's whole objection to XP is activity
   * mistaken for skill.
   */
  const handleSendMessage = useCallback(
    (threadId: string, text: string, missionId?: string) => {
      const result = sendMessage(inbox, threadId, 'child', text, localDay());
      setInbox(result.inbox);
      if (result.message && missionId) noteDeed('taught-a-grown-up', missionId);
    },
    [inbox, noteDeed],
  );

  /** The grown-up's side of the conversation, from behind the grown-up screen. */
  const handleGrownUpReply = useCallback(
    (text: string) => {
      const thread = grownUpThread(inbox);
      if (!thread) return;
      setInbox(sendMessage(inbox, thread.id, 'grown-up', text, localDay()).inbox);
    },
    [inbox],
  );

  /**
   * Turn a held friend message into a code, and mark it handed over.
   *
   * `asCode` calls `deliver()` — the seam that used to be wired to nothing is
   * now wired to this. Producing a code *is* the act of sending, in the only
   * sense this product can observe.
   */
  const handleMakeCode = useCallback(
    (messageId: string) => {
      const result = asCode(inbox, messageId, career?.name || 'A friend');
      setInbox(result.inbox);
      setMessageCode(result.code);
      setCodeNote(result.code ? null : 'That one cannot be turned into a code.');
    },
    [inbox, career?.name],
  );

  /** Take a code from a friend. Filtered again on the way in — see `receive`. */
  const handlePasteCode = useCallback(
    (code: string) => {
      const result = receiveMessage(inbox, code, localDay());
      setInbox(result.inbox);
      setCodeNote(result.note ?? null);
      setCodeThread(result.threadId ?? null);
      setMessageCode(null);
    },
    [inbox],
  );

  const askForNotices = useCallback(() => {
    void askForNoticePermission().then(setNoticeState);
  }, []);

  const eraseAll = useCallback(() => {
    setErasedKeys(eraseEverything());
    setGame(null);
    setCareer(null);
    setLive(null);
    setGuideSeen(null);
    /*
     * The ledger goes back to empty in memory too, not just on disk.
     *
     * Every other slot here is nulled for a reason worth restating: the erase
     * clears `localStorage`, and a piece of state left sitting in React would
     * be written straight back out by its own save effect a tick later. The
     * ledger has such an effect, so without this line the next tester would
     * inherit the previous one's streak and credits — the exact bug §61's
     * reset button exists to prevent, in a slot that did not exist when it was
     * written.
     */
    setLedger(createLedger());
    setInbox(createInbox());
    setNudgesShown([]);
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
            /*
             * The rival, and whether anything has been done about him.
             *
             * Read off `dayParams`, which is the same `paramsForDay` the day
             * itself runs on — so the share Pip mentions is the share the
             * queue actually split by, rather than a second opinion about it.
             */
            marketShare: dayParams.marketShare,
            differentiated:
              game.business.upgrades.freshSqueeze || game.business.upgrades.bigSign,
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
   * Written reasons that have stopped being true.
   *
   * Re-runs each thesis's own number claim against the company as it stands
   * this week. Nothing is generated: it is the same `holds()` function, twice,
   * at two prices. Only a claim that held when the money went in and does not
   * now — a claim that never held is already recorded as a mismatch and graded
   * at the end, and telling a child again now would be nagging about a
   * decision they have already been shown.
   */
  const drifts = game.portfolio
    ? drifted(
        game.theses,
        (ticker) => SNAPSHOT.find((company) => company.ticker === ticker),
        (ticker) => currentPrice(game.portfolio!, ticker),
        currentDate(game.portfolio),
      )
    : [];

  /**
   * The next company to scout, and it is derived rather than stored.
   *
   * Which companies have been rated is already in the ledger — every rating
   * writes `rated-a-business` with the ticker on it — so a second list would
   * be the same fact in two homes, which is §62's defect class. Twenty-four
   * companies against a 400-entry log leaves plenty of room.
   */
  const rated = ledger.entries
    .filter((entry) => entry.deed === 'rated-a-business' && entry.what)
    .map((entry) => entry.what!);
  const toScout = scoutable(SNAPSHOT, rated);

  /**
   * Things to go and tell a grown-up, built from what the child actually did.
   *
   * An empty list is a real answer: a mission with no material behind it is a
   * homework question rather than a conversation, so `missionsFor` returns
   * only the ones it can fill a draft for. See `missions.ts`.
   */
  const missions = game.portfolio
    ? missionsFor({
        theses: game.theses,
        companyFor: (ticker) => SNAPSHOT.find((company) => company.ticker === ticker),
        story: storyFor(game.portfolio),
        worthOf: (ticker) => holdingValue(game.portfolio!, ticker),
      })
    : [];

  /**
   * Today's check-in, built from whichever portfolio the child is living in.
   *
   * The live practice account first, because once it exists it is the one with
   * their real money in it. Falls back to the in-game portfolio, which replays
   * the same price history — so a child who has not passed the readiness gate
   * still gets a ritual with a true story in it rather than a locked door.
   */
  const checkInPortfolio = live ?? game.portfolio;
  const checkInState = checkInPortfolio
    ? buildCheckIn(
        checkInPortfolio,
        career,
        ledger,
        localDay(),
        checkInPortfolio.standEarnings + totalValue(checkInPortfolio),
      )
    : null;

  /**
   * Everything worth saying today, computed exactly as it would be in
   * production — the policy half of notifications, which needs no server.
   */
  const nudgeContext = {
    ledger,
    today: localDay(),
    checkIn: checkInState,
    drifts,
    fromGrownUp: grownUpThread(inbox)?.messages.filter((m) => m.author === 'grown-up').length ?? 0,
    canSpend: Boolean(live ?? game.portfolio),
  };
  const waiting = nudgesFor(nudgeContext);



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
   * The check-in, gated on there being a market to check.
   *
   * Not on having played N days: §26's rule is "what has just happened makes
   * this obvious", never "they have played long enough". What makes a daily
   * market ritual obvious is owning a portfolio that a market can move, which
   * is exactly what `game.portfolio` existing means.
   *
   * Above the market rather than below it, because the point of the ritual is
   * that it comes *before* you touch anything — read what happened, work out
   * whether it matters, and most days do nothing.
   */
  if (checkInState) {
    titleExtras.push({
      emoji: checkInState.doneToday ? '✅' : '🗓️',
      label: checkInState.doneToday ? 'Checked in' : 'Check in',
      onClick: openFrom('title', 'checkin'),
    });
  }
  /*
   * Credits, once there are any.
   *
   * Gated on having earned something rather than on a stage, because that is
   * the moment the word means anything: a child who has just been paid for a
   * decision has a reason to look at what else pays. An empty credits screen
   * shown before the first award is a menu item, which `unlocks.ts` exists to
   * prevent.
   */
  if (ledger.earned > 0) {
    titleExtras.push({
      emoji: '🎟️',
      label: `${balanceOf(ledger)} credits`,
      onClick: openFrom('title', 'credits'),
    });
  }
  /*
   * Stock Scout, from the moment there is a market at all.
   *
   * The earliest of the Level 2 doors on purpose: it is the stage that teaches
   * the framework the rest of the market screens assume. A child who has not
   * done this is being asked to buy things using a framework nobody showed
   * them, which is what FRAMEWORK.md §16 found was actually missing.
   */
  if (game.portfolio && toScout.length > 0) {
    titleExtras.push({
      emoji: '🔎',
      label: rated.length === 0 ? 'Rate a company' : `Rated ${rated.length}`,
      onClick: openFrom('title', 'scout'),
    });
  }

  /*
   * Messages, once there is something to say.
   *
   * Gated on a written reason existing, not on a stage: the missions are all
   * built from the child's own journal, so before the first thesis there is
   * nothing to tell anybody and the screen would be a blank box with an
   * instruction over it — which is where this feature would die.
   *
   * Opening the grown-up thread is done here, on the way in, rather than at
   * install. A child who never writes to anybody keeps an empty Messages
   * screen instead of an empty conversation.
   */
  if (game.theses.length > 0) {
    titleExtras.push({
      emoji: '✉️',
      // Names what is waiting rather than how long it has been. §15.
      label: grownUpThread(inbox) ? inboxLine(inbox) : 'Messages',
      onClick: () => {
        setInbox((current) => {
          let next = grownUpThread(current)
            ? current
            : openThread(current, 'grown-up', 'A grown-up');
          /*
           * A thread per club member, opened on the way in.
           *
           * This is where "friends" actually exist in this product: a club is
           * the only place another child's name is known, so it is the only
           * honest source for a friend thread. Opening one from a name the app
           * has never seen would be inventing a person.
           *
           * They are `held` threads and the screen says so. That is the whole
           * of what can be built without a server, and it is why the model
           * carries a delivery state at all — see `deliver()`.
           */
          for (const member of game.club?.members ?? []) {
            if (member.name === career.name) continue;
            next = openThread(next, 'friend', member.name);
          }
          return next;
        });
        setReturnPhase('title');
        setPhase('messages');
      },
    });
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
          waiting={waiting}
          onWaiting={(goTo) => {
            setReturnPhase('title');
            setPhase(goTo as Phase);
          }}
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
          onToured={(finished) => markToured(STAND_TOUR.id, finished)}
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
          onToured={(finished) => markToured(YARD_TOUR.id, finished)}
          onOpenShop={() => setPhase('funding')}
          onShopStaff={handleShopStaff}
          onDone={() => setPhase('plan')}
        />
      );

    case 'run':
      return outcome ? (
        /*
         * Stage 1 lets the child open the stand; every stage after runs itself.
         *
         * The pace is handed over exactly where the scene is the lesson. In the
         * first stage a day *is* the street — one price, one sign, and people
         * deciding in front of it — so tapping the crowd in is the child causing
         * the thing they are being taught to read. By stage 2 a day is one line
         * in a week across several stands, and asking for eight taps a day
         * against that would be a toll, not a game.
         */
        <RunDayScreen
          outcome={outcome}
          interactive={game.act === 1}
          /*
           * Asked in every stage, unlike the tap-to-admit pacing above.
           *
           * The pacing is handed over only where the scene is the lesson. The
           * lunchtime question is the opposite case: it is the *decision*, and
           * the stages that need it most are the long ones — the pilot's
           * complaint was "lemonade stand is 40 days ... just next next next",
           * and stages two and three are where most of those forty days are.
           */
          /*
           * Nobody is asked to price an afternoon they are not working.
           *
           * A manager-run day exists so a child can step away — it is what
           * earns the hands-off streak and the `delegation` word — and this
           * screen was stopping halfway to ask them to move the sign. Found by
           * checking the path rather than by a test: `letManagerRun` routes
           * through the same `openStand`, so the beat came along for the ride.
           */
          midday={dayPlan?.ranByManager ? null : middayCall(outcome)}
          onMidday={changeMiddayPrice}
          onDone={() => {
            /*
             * Settled here rather than on the way in.
             *
             * The day is not decided until the crowd has gone home, so the
             * insights, the streaks and the business updates are worked out
             * from the *final* outcome. Settling on the way in — which is what
             * `openStand` used to do — would have banked the morning's figures
             * and then disagreed with the close screen.
             */
            bankDay(outcome, dayPlan?.ranByManager ?? false);
            setPhase('close');
          }}
        />
      ) : null;

    case 'close':
      return outcome ? (
        <CloseScreen
          outcome={outcome}
          insights={newInsights}
          planned={planned}
          /*
           * The goal and the next padlock, on the screen where a child decides
           * whether to play another day. `stage.goal` is the same single source
           * the planning screen and the yard read, so there is no second
           * opinion about what is being aimed at.
           */
          whatsNext={{
            goal: stage?.goal,
            stop: nextStop(game),
            /*
             * Only in the first stage, which is the only place the money has
             * nowhere to go. From stage two onwards the yard is open and every
             * dollar already has a use, so saying this would be telling a child
             * something they can see.
             */
            buys:
              game.act === 1
                ? { ...cheapestUpgrade(), cash: outcome.nextState.cash }
                : undefined,
          }}
          /*
           * The close screen's question needs today and yesterday to be the
           * same business, run by the same person. See `comparable`.
           */
          comparable={!dayPlan?.ranByManager && !game.weekend}
          /* Only when there is more than one counter to split the day across.
             The Saturday stand is a folding table again, so it does not get
             the business it was sold out of. */
          business={game.weekend ? undefined : game.business}
          managerAvailable={
            game.act >= 2 && game.act <= 4 && game.business.staff.manager && !game.weekend
          }
          onManagerRuns={letManagerRun}
          nextUp={
            isUnlocked('whats-next', game, career) ? (
              <div className="mt-4">
                <NextUp
                  things={whatsNext(game, career)}
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
          /* A stage's last day is an end-of-week whatever its number says, so
             this can no longer be a seventh of the day count — that read
             "week 0" on a stage that finished on day five. */
          weekNumber={Math.max(1, Math.ceil(settledStageDay / WEEKLY_EVERY))}
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
          onToured={(finished) => markToured(FUNDING_TOUR.id, finished)}
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
      return (
        <DealBoardScreen
          /*
           * Keyed on the go, so the second board arrives with nothing picked
           * and nothing revealed. Without it React keeps the component mounted
           * and a child would land on board two already looking at board one's
           * answer.
           */
          key={dealRoundsTaken(game.ownership)}
          /*
           * Whichever board they have not answered yet. `nextDealBoard`
           * returns null once one has been got right, and nothing routes here
           * in that case — but the fallback is the first board rather than a
           * crash, because a phase reached by a stale deep link must still
           * render something.
           */
          stands={nextDealBoard(game.ownership) ?? boardForRound(0)}
          round={dealRoundsTaken(game.ownership)}
          againLabel={
            game.act === 4 && dealRoundsTaken(game.ownership) === 0
              ? 'Try another three →'
              : game.act === 5
                ? 'Back to the list →'
                : 'Next →'
          }
          /*
           * A child who reached the board from the readiness gate sold their
           * stand forty days ago. Found in the browser: the verdict offered
           * them "Back to your own stand →", which is both the wrong
           * destination and a sentence about a business they no longer have.
           */
          doneLabel={game.act === 5 ? 'Back to the list →' : 'Back to your own stand →'}
          onChoose={(choiceId) => handleDealChoice(choiceId)}
        />
      );

    case 'listing':
      return (
        <ListingScreen
          tour={showTour(LISTING_TOUR.id)}
          onToured={(finished) => markToured(LISTING_TOUR.id, finished)}
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
          drifts={drifts}
          onChecked={(ticker) => noteDeed('checked-a-thesis', ticker)}
          tour={showTour(MARKET_TOUR.id)}
          onToured={(finished) => markToured(MARKET_TOUR.id, finished)}
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
            noteDeed('read-accounts', ticker);
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
      return (
        <GateScreen
          readiness={readiness(game)}
          onBack={() => setPhase('market')}
          onRetry={(where) => setPhase(where)}
        />
      );

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
            noteDeed('read-accounts', ticker);
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

    case 'checkin':
      /*
       * Reads the live practice portfolio when there is one, and the in-game
       * one otherwise.
       *
       * A child reaches the ritual before they reach the real market, and a
       * check-in with nothing to check would be a screen that opens on an
       * apology. The in-game portfolio has the same replayed price history, so
       * the story is the same shape either way.
       */
      return checkInState ? (
        <CheckInScreen
          state={checkInState}
          streak={streakOf(ledger, localDay())}
          // Back where they came from, like every other extra. Opened from the
          // title, "back" has to mean the title.
          onBack={() => setPhase(returnPhase)}
          onDone={handleCheckIn}
        />
      ) : null;

    case 'scout':
      /*
       * Rated at the price of the week being replayed, not at today's close.
       * The market's own rule: a child judges the price they would actually be
       * paying, against the accounts that were public then.
       */
      return toScout.length > 0 && game.portfolio ? (
        <ScoutScreen
          company={toScout[0]}
          price={currentPrice(game.portfolio, toScout[0].ticker)}
          asOf={currentDate(game.portfolio)}
          onBack={() => setPhase(returnPhase)}
          onDone={(rating) => {
            noteDeed('rated-a-business', rating.ticker);
            setPhase(returnPhase);
          }}
        />
      ) : null;

    case 'messages':
      return (
        <MessagesScreen
          inbox={inbox}
          missions={missions}
          onSend={handleSendMessage}
          onMakeCode={handleMakeCode}
          code={messageCode}
          onPasteCode={handlePasteCode}
          codeNote={codeNote}
          focusThread={codeThread}
          onBlock={(id) =>
            setInbox((current) => {
              const thread = current.threads.find((t) => t.id === id);
              return blockThread(current, id, !thread?.blocked);
            })
          }
          onReport={(id, reason) =>
            setInbox((current) => reportThread(current, id, reason, localDay()))
          }
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'credits':
      return (
        <CreditsScreen
          ledger={ledger}
          streak={streakOf(ledger, localDay())}
          today={localDay()}
          canSpend={Boolean(live ?? game.portfolio)}
          onTopUp={handleTopUp}
          onBack={() => setPhase(returnPhase)}
        />
      );

    case 'reckoning':
      return game.portfolio ? (
        <ReckoningScreen
          onReviewed={(ticker) => noteDeed('reviewed-a-mistake', ticker)}
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
          onJump={jumpToStage}
          fromChild={grownUpThread(inbox)?.messages ?? []}
          notices={{ state: noticeState, onAsk: askForNotices }}
          onReply={handleGrownUpReply}
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
          onConfirm={(quantId, qualId, dollars, riskId, exitId) =>
            tradingLive
              ? handleLiveBuy(thesisTarget, quantId, qualId, dollars)
              : handleThesisBuy(thesisTarget, quantId, qualId, dollars, riskId, exitId)
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
