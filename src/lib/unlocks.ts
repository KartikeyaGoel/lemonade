/**
 * What exists yet.
 *
 * This module is here because of a specific failure mode. Everything added in
 * the last pass — a trophy case, a word collection, challenges, a club, seasons
 * — is good for the kid who has played for a week, and *ruinous* for the kid
 * opening it for the first time. Six buttons on the title screen is a menu, and
 * a menu is a decision you have to make before you have any way of making it.
 *
 * Clash of Clans opens with one thing to tap. Minecraft opens with a world and
 * a hand. The systems arrive later, one at a time, each introduced by the
 * moment that makes it make sense — and each arriving as a reward rather than
 * as an option.
 *
 * So: a feature does not exist until the kid has done the thing that gives it a
 * meaning. Every gate below has that thing written next to it, and the rule is
 * always "what has just happened makes this obvious", never "they have played
 * long enough to handle it".
 *
 * Unlocks never reverse. Progression is monotonic.
 *
 * Pure module. No React, no I/O.
 */

import type { Game } from './progress';
import type { Career } from './career';

export type Feature =
  | 'trophies'
  | 'words'
  | 'identity'
  | 'whats-next'
  | 'challenge'
  | 'club'
  | 'playbook'
  | 'seasons'
  | 'live-market';

export interface Unlock {
  feature: Feature;
  /** How it is announced the first time. */
  title: string;
  /** Why this is the right moment, in the kid's terms. */
  because: string;
  emoji: string;
  /**
   * Arrives without a card.
   *
   * Playing this revealed the obvious mistake: four systems come true at the
   * end of day one, and announcing each one meant four full-screen cards
   * between the kid and their second day. So the ones that explain themselves
   * where they appear — the suggestions on the close screen, the words tab
   * inside the trophy case, the name field on the trophy card — say nothing.
   *
   * The result is exactly one card at the end of day one.
   */
  silent?: boolean;
}

export const UNLOCK_COPY: Record<Feature, Unlock> = {
  trophies: {
    feature: 'trophies',
    title: 'Trophy case',
    because: 'You earned something. Now there is somewhere to keep it — and a name to put on it.',
    emoji: '🏆',
  },
  words: {
    feature: 'words',
    title: 'Words you earned',
    because: 'You learned a real word by doing the thing it describes. They collect.',
    emoji: '📚',
    // Lives as a tab inside the trophy case, which is announced.
    silent: true,
  },
  identity: {
    feature: 'identity',
    title: 'Put your name on it',
    because: 'A trophy with nobody on it is a bit sad.',
    emoji: '🧢',
    // Folded into the trophy card, because that is the thing being named.
    silent: true,
  },
  'whats-next': {
    feature: 'whats-next',
    title: 'Next up',
    because: 'You have run a day. Here are three things worth trying.',
    emoji: '🎯',
    // Appears inline at the bottom of the close screen and needs no preamble.
    silent: true,
  },
  challenge: {
    feature: 'challenge',
    title: 'Friends',
    because:
      'Send somebody a day you have played. Same weather, same money — the only difference is what you each decide. You will find it under Friends, with everything else you do with other people.',
    emoji: '🧑‍🤝‍🧑',
  },
  club: {
    feature: 'club',
    title: 'Investment club',
    because:
      'You have your own money in the market. Pooling it with friends is the next thing — it is waiting at the Friends desk.',
    emoji: '🧑‍🤝‍🧑',
  },
  playbook: {
    feature: 'playbook',
    title: 'Your playbook',
    because:
      'Four rules, decided in advance, tested against every twelve weeks of real history there is. This is where you find out whether you have a strategy or a hunch.',
    emoji: '📓',
  },
  'live-market': {
    feature: 'live-market',
    title: 'The real market, live',
    because:
      'You have traded twelve weeks that already happened. Now trade the ones that have not: real prices, this week, and nobody knows what Monday does.',
    emoji: '\ud83d\udcc8',
  },
  seasons: {
    feature: 'seasons',
    title: 'A new season',
    because: 'You finished the whole thing. Start again on a different street, keep everything you earned.',
    emoji: '🔁',
  },
};

/**
 * Is this feature real yet?
 *
 * Deliberately reads only from state a kid produced. Nothing here unlocks on a
 * timer, and nothing unlocks because a screen was opened.
 */
export function isUnlocked(feature: Feature, game: Game, career: Career): boolean {
  const badges = career.badges.length;
  const words = career.words.length + game.learned.length;
  const daysPlayed = game.stand.history.length;

  switch (feature) {
    // A case with nothing in it is a chore. The first badge creates it.
    case 'trophies':
      return badges >= 1;

    // Same for the glossary: the first word is what makes a list of words a
    // thing worth having.
    case 'words':
      return words >= 1;

    // Asked for exactly once, at the moment a name would be going on something.
    case 'identity':
      return badges >= 1;

    // After one day they have a frame of reference for a suggestion. Before it,
    // "try charging more" means nothing.
    case 'whats-next':
      return daysPlayed >= 1;

    /**
     * Two days.
     *
     * This used to be a whole week, which put the only other-people feature in
     * the game forty minutes past the front door. Every game a kid actually
     * plays — Clash Royale, Roblox, Clash of Clans — has somebody else in it
     * inside the first session, and the reason is not social: it is that a
     * rival is the only opponent who makes your own decisions feel like
     * decisions.
     *
     * Two days rather than one, for two reasons. You cannot send a day you
     * have not played, and a kid whose entire experience is one day has no
     * idea yet that the weather moves — so the comparison would read as luck.
     * By day two they have seen two different skies, which is exactly what
     * makes "same sky, different choices" mean something.
     *
     * It also keeps the one-card rule: day one announces the trophy case, day
     * two announces this. Never two at once.
     */
    case 'challenge':
      return daysPlayed >= 2 || career.challengesPlayed > 0;

    // Arguing about what a company is worth requires having your own money in
    // one. the market is the first moment that is true.
    //
    // The third clause is not decoration. A club is carried across seasons, so
    // a kid who started one and then began season 2 before the first week had
    // advanced would have had it orphaned — created, saved, and unreachable.
    case 'club':
      return game.act >= 5 || career.clubWeeks > 0 || game.club !== null;

    /*
     * The moment there is money in the market and a first trade behind them.
     *
     * Not before: a deck of rules about what to buy means nothing to somebody
     * who has never bought anything, and it would arrive as homework. One trade
     * later it arrives as "there is a way to think about this".
     */
    case 'playbook':
      return game.act >= 5 && (game.portfolio?.trades.length ?? 0) > 0;

    // Offered when there is a finished run to start again from.
    case 'seasons':
      return game.portfolio?.status === 'closed' || career.seasons > 1;

    /*
     * The same moment, and deliberately so.
     *
     * Both doors open when the twelve weeks finish, and they are the two honest
     * answers to "now what": go round again on a different street, or stop
     * replaying and trade the weeks nobody has seen yet. Gating the live market
     * any later would be pretending a kid who has read eight sets of accounts
     * and held through a real fall is not ready for prices that have not
     * happened. Gating it any earlier would hand them the real thing before the
     * readiness gate has ever been passed.
     */
    case 'live-market':
      return game.portfolio?.status === 'closed' || career.seasons > 1;
  }
}

export function unlockedFeatures(game: Game, career: Career): Feature[] {
  return (Object.keys(UNLOCK_COPY) as Feature[]).filter((feature) =>
    isUnlocked(feature, game, career),
  );
}

/**
 * Which unlocks are new since last time.
 *
 * Returns the silent ones too, so the caller can mark them as seen — they just
 * must not be put on screen. Use `announceable` for what to actually show.
 */
export function newlyUnlocked(
  game: Game,
  career: Career,
  alreadyAnnounced: string[],
): Unlock[] {
  const seen = new Set(alreadyAnnounced);
  return unlockedFeatures(game, career)
    .filter((feature) => !seen.has(feature))
    .map((feature) => UNLOCK_COPY[feature]);
}

/** The subset that gets a card. Never more than one thing at a time. */
export function announceable(unlocks: Unlock[]): Unlock[] {
  return unlocks.filter((unlock) => !unlock.silent);
}

/**
 * The first-run rule, stated in one place so it cannot drift.
 *
 * On a first launch there is exactly one thing on screen. Not a menu with one
 * item highlighted — one thing.
 */
export function isFirstRun(game: Game, career: Career): boolean {
  return game.stand.history.length === 0 && career.badges.length === 0 && career.seasons === 1;
}
