/**
 * The road, and why it is not a bottom navigation bar.
 *
 * Clash Royale puts five tabs along the bottom from the first second, several
 * of them locked, and it works: you can see the whole game before you can play
 * it, and the locked tabs are a promise rather than a wall. It is worth being
 * precise about *why* it works there, because copying the tabs into this game
 * would be a mistake.
 *
 * Clash Royale is a live service. It has no ending, its content is a repeatable
 * three-minute match, and its systems sit beside each other — Battle, Cards,
 * Shop, Clan — so a hub with spokes is the honest shape of it. This game is a
 * campaign: four acts, in order, with a finish. Its systems sit *after* each
 * other. A tab bar would misrepresent the product, and a tab bar on a screen
 * whose first-run job is "one thing to tap" would undo the entry.
 *
 * But the diagnosis behind the question is right, and it is the most expensive
 * problem left on the title screen: a kid who opens this sees a lemonade stand
 * and has no idea a stock market is in it. The promise of the whole product —
 * *this teaches you to read a business so you can read a company* — is
 * invisible at the exact moment they are deciding whether to care.
 *
 * The mechanism Clash of Clans actually uses for that is not the navigation. It
 * is the **visible locked thing**: the Town Hall levels you have not reached,
 * the greyed-out buildings, the "unlocks at TH5" label. Candy Crush shows the
 * map. Duolingo shows the path. You do not need a way to *go* there; you need
 * to *see* it.
 *
 * So: a road with four stops, one line, always on the title screen including
 * the first run. It is a picture, not a menu. Nothing on it is a place you can
 * jump to and nothing on it is a decision — tapping a stop says what it is and
 * what opens it, which is exactly what a padlock in Clash of Clans does.
 *
 * Pure module. No React, no I/O.
 */

import type { Game } from './progress';
import type { Career } from './career';

export type StopState = 'done' | 'here' | 'locked';

export interface Stop {
  id: 1 | 2 | 3 | 4;
  /** Two words at most: this is read at a glance, at eleven pixels. */
  name: string;
  emoji: string;
  state: StopState;
  /** What happens here, in the kid's terms. Shown when a stop is tapped. */
  what: string;
  /** How you get here from where you are standing. Empty once you have. */
  opensWhen: string;
}

const STOPS: Array<Omit<Stop, 'state'>> = [
  {
    id: 1,
    name: 'Your stand',
    emoji: '🍋',
    what: 'One table, twenty dollars, and the only question that matters: what do you charge?',
    opensWhen: '',
  },
  {
    id: 2,
    name: 'Grow it',
    emoji: '📈',
    what: 'Spend money to make money. A cooler, a helper, a better pitch — and somebody opens up across the road.',
    opensWhen: 'Finish your first week.',
  },
  {
    id: 3,
    name: 'Sell it',
    emoji: '🤝',
    what: 'Find out what your business is worth, and to whom. Somebody will offer to buy it.',
    opensWhen: 'Build something worth buying.',
  },
  {
    id: 4,
    name: 'The market',
    emoji: '💹',
    what: 'Real companies, real prices, real accounts. Apple and Nike are lemonade stands with more zeros — and now you can read one.',
    opensWhen: 'Sell your stand and take the money with you.',
  },
];

/**
 * Where the kid is on the road.
 *
 * Read from the act alone. A stop is never "done" because a screen was opened,
 * and the road never goes backwards — starting a new season resets the act, and
 * that is correct: the road is this run, and the trophy case is the career.
 */
export function road(game: Game): Stop[] {
  return STOPS.map((stop) => ({
    ...stop,
    state: stop.id < game.act ? 'done' : stop.id === game.act ? 'here' : 'locked',
  }));
}

/**
 * The single line under the road.
 *
 * On a first run this is the pitch, and it is the only place in the product
 * that says out loud what the game is for. After that it is a progress
 * report, because by then the kid knows.
 */
export function roadLine(game: Game, career: Career): string {
  if (game.stand.history.length === 0 && career.seasons === 1) {
    return 'Learn it on lemonade. Then do it with real companies.';
  }
  const reached = road(game).filter((stop) => stop.state !== 'locked').length;
  if (game.act === 4) return 'You made it to the market. This is what it was all for.';
  return `${reached} of 4 · next up: ${STOPS[game.act]?.name.toLowerCase() ?? 'the market'}`;
}
