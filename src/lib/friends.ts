/**
 * Everything that involves somebody else, in one place.
 *
 * Three separate systems had grown up independently — a same-sky challenge, an
 * investment club, and a table of honours — and each had arrived as its own pill
 * on the title screen. Five pills is a menu, which is the exact failure
 * `src/lib/unlocks.ts` was written to prevent, and it had crept back in by
 * accretion rather than by decision.
 *
 * They also belong together for a better reason than tidiness. The three of them
 * are one loop: you *race* a friend on the same week, you *argue* with them about
 * what to buy, and you *stand next to* them afterwards. Splitting them across
 * three entry points meant a kid who found one never discovered the other two.
 *
 * The status lines below are why this is a place rather than a folder. A folder
 * of three buttons is worse than three buttons. A place that says "Ada is
 * waiting on your vote" is a reason to open the app.
 *
 * Pure module. No React, no I/O.
 */

import type { Career } from './career';
import type { ClubState } from './club';
import { totalValue } from './market';
import { honours, type TableCard } from './table';

export type DeskId = 'challenge' | 'club' | 'table';

export interface Desk {
  id: DeskId;
  name: string;
  emoji: string;
  /** What this is for, in the kid's terms. One line. */
  what: string;
  /**
   * What is happening here right now. Null when nothing has happened yet, so
   * the card can say what it is for instead of pretending to have news.
   */
  status: string | null;
  /** Something is waiting on the kid. Draws the eye and nothing else does. */
  waiting: boolean;
  /**
   * Not yet. Shown anyway, greyed, with what opens it.
   *
   * Same argument as the road on the title screen: a padlock you can see is a
   * promise, and a thing that simply is not there yet is a thing nobody knows
   * to look forward to. A kid on day two should already know a club exists.
   */
  locked: boolean;
  opensWhen: string;
}

export function desks({
  career,
  club,
  me,
  cards,
  unlocked,
}: {
  career: Career;
  club: ClubState | null;
  me: string;
  /** Every card at the table, the kid's own included. */
  cards: TableCard[];
  /** Which of the three the kid has earned so far. */
  unlocked: Record<DeskId, boolean>;
}): Desk[] {
  return [
    {
      id: 'challenge',
      name: 'Same sky',
      emoji: '⚔️',
      what: 'Send a friend your exact week. Same weather, same money — the only difference is what you each decided.',
      status: unlocked.challenge ? challengeStatus(career) : null,
      waiting: false,
      locked: !unlocked.challenge,
      opensWhen: 'Play two days at your stand.',
    },
    {
      id: 'club',
      name: 'Investment club',
      emoji: '🧑‍🤝‍🧑',
      what: 'Put your money in together. Nothing gets bought unless the others say yes.',
      status: unlocked.club ? clubStatus(club) : null,
      // The only genuinely time-sensitive thing in the game: somebody else is
      // stuck until this kid votes.
      waiting: unlocked.club && club !== null && whoseTurnName(club) === me,
      locked: !unlocked.club,
      opensWhen: 'Reach the market with your own money in it.',
    },
    {
      id: 'table',
      name: 'The table',
      emoji: '📊',
      what: 'Where everyone stands. Five different things to be best at, and money is only one of them.',
      status: unlocked.table ? tableStatus(cards, me) : null,
      waiting: false,
      locked: !unlocked.table,
      opensWhen: 'Buy your first share.',
    },
  ];
}

function challengeStatus(career: Career): string | null {
  if (career.challengesPlayed === 0) return null;
  const lost = career.challengesPlayed - career.challengesWon;
  return `${career.challengesPlayed} played · ${career.challengesWon} won, ${lost} lost`;
}

function clubStatus(club: ClubState | null): string | null {
  if (!club) return null;
  const pot = totalValue(club.portfolio);
  const open = club.proposals.filter((proposal) => proposal.status === 'open').length;
  const size = `${club.members.length} ${club.members.length === 1 ? 'member' : 'members'}`;
  if (open > 0) {
    return `${size} · ${open} ${open === 1 ? 'idea' : 'ideas'} on the table`;
  }
  return `${size} · $${pot.toFixed(2)} pooled`;
}

function whoseTurnName(club: ClubState): string {
  return club.members[club.turn % club.members.length]?.name ?? '';
}

/**
 * What the table has to say about this kid.
 *
 * Leads first, because that is the reason to open it. If they lead nothing, it
 * says how many people are at the table rather than "you are last" — the whole
 * argument in `src/lib/table.ts` is that there is no such thing as last here.
 */
function tableStatus(cards: TableCard[], me: string): string | null {
  if (cards.length <= 1) return null;
  const leading = honours(cards).filter((honour) => honour.standings[0]?.who === me);
  if (leading.length === 0) {
    return `${cards.length} at the table`;
  }
  return `You lead on ${leading.map((honour) => honour.title.toLowerCase()).join(' and ')}`;
}
