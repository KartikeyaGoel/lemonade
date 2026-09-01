/**
 * The table.
 *
 * Clash Royale clans have a standings list and it is most of why anybody stays
 * in one. The obvious version here is a leaderboard of returns, and it is the
 * single most harmful thing this product could ship.
 *
 * Over twelve weeks, the difference between the best and worst kid in a group
 * of friends is almost entirely which twelve weeks they got and which company
 * happened to run. Ranking them by it would teach, with a big number and a gold
 * medal, that the luckiest person is the best investor. That belief is exactly
 * what the rest of the game is built to prevent, and no amount of small print
 * underneath undoes a leaderboard.
 *
 * So there is no overall winner. There are four separate honours, each for a
 * different thing, awarded to different people:
 *
 *  - **Best operator** — the biggest week ever run at the stand. Same weather is
 *    not guaranteed, but a week of trading is dozens of decisions and the noise
 *    mostly cancels. Close to pure skill.
 *  - **Best thinking** — buys that were right *for the reason given*. Scored by
 *    the thesis machinery, which already separates "good call" from "lucky".
 *  - **Biggest collection** — badges, words and companies read. Pure effort, and
 *    the only honour anybody can win by simply carrying on.
 *  - **Best playbook** — a strategy's win rate over every twelve-week stretch in
 *    the data. Every kid's playbook is run over the *same* two hundred-odd
 *    stretches, so this one is genuinely comparable and genuinely skill.
 *
 * And then, last and smallest, the returns — labelled out loud as mostly luck,
 * because it is, and because a kid who wins it should be told.
 *
 * Pure module. No React, no I/O.
 */

import { ByteReader, ByteWriter, decodeShort, encodeShort } from './sharecode';
import { tidyName } from './challenge';
import { record, type Playbook } from './playbook';

export const CARD_PREFIX = 'CARD';

/** Everything one kid brings to the table. All of it real, all of it theirs. */
export interface TableCard {
  who: string;
  /** Badges + words + companies read. */
  standing: number;
  /** Best seven-day profit ever run at the stand, in dollars. */
  bestWeek: number;
  /** Buys that turned out right for the reason written down. */
  goodCalls: number;
  /** Reasons written down before money moved, right or wrong. */
  callsMade: number;
  /** Their playbook's win rate over every stretch, as a percentage. */
  playbookWinRate: number;
  /** Portfolio return, as a percentage. Deliberately last. */
  returnPct: number;
}

export function cardFor(
  who: string,
  standing: number,
  bestWeek: number,
  goodCalls: number,
  callsMade: number,
  playbook: Playbook,
  returnPct: number,
): TableCard {
  return {
    who: tidyName(who),
    standing,
    bestWeek,
    goodCalls,
    callsMade,
    playbookWinRate: playbook.ruleIds.length > 0 ? record(playbook).winRate * 100 : 0,
    returnPct,
  };
}

/* ------------------------------------------------------------------ *
 * The honours
 * ------------------------------------------------------------------ */

export interface Honour {
  id: 'operator' | 'thinking' | 'collection' | 'playbook' | 'returns';
  title: string;
  emoji: string;
  /** What it is actually measuring. */
  measures: string;
  /** Whether the thing it measures is mostly skill. Shown, not hidden. */
  mostlyLuck: boolean;
  /** Everybody, best first, with the figure that got them there. */
  standings: Array<{ who: string; figure: string; value: number }>;
}

function rank(
  cards: TableCard[],
  value: (card: TableCard) => number,
  figure: (card: TableCard) => string,
) {
  return cards
    .map((card) => ({ who: card.who, figure: figure(card), value: value(card) }))
    .sort((a, b) => b.value - a.value);
}

export function honours(cards: TableCard[]): Honour[] {
  return [
    {
      id: 'operator',
      title: 'Best operator',
      emoji: '🍋',
      measures: 'The biggest week anybody has run at a stand.',
      mostlyLuck: false,
      standings: rank(cards, (c) => c.bestWeek, (c) => `$${c.bestWeek.toFixed(2)}`),
    },
    {
      id: 'thinking',
      title: 'Best thinking',
      emoji: '🧠',
      measures: 'Buys that turned out right for the reason that was written down.',
      mostlyLuck: false,
      standings: rank(
        cards,
        (c) => c.goodCalls,
        (c) => `${c.goodCalls} of ${c.callsMade}`,
      ),
    },
    {
      id: 'playbook',
      title: 'Best playbook',
      emoji: '📓',
      measures: 'Whose rules come out ahead most often, over the same stretches of history.',
      mostlyLuck: false,
      standings: rank(
        cards,
        (c) => c.playbookWinRate,
        (c) => (c.playbookWinRate > 0 ? `${c.playbookWinRate.toFixed(0)}%` : 'no playbook yet'),
      ),
    },
    {
      id: 'collection',
      title: 'Biggest collection',
      emoji: '🏆',
      measures: 'Badges, words and companies read. The one you can win by keeping going.',
      mostlyLuck: false,
      standings: rank(cards, (c) => c.standing, (c) => `${c.standing}`),
    },
    {
      id: 'returns',
      title: 'Most money made',
      emoji: '🎲',
      measures:
        'Twelve weeks is not long enough for this to be about skill. Whoever wins it got the better weeks.',
      mostlyLuck: true,
      standings: rank(
        cards,
        (c) => c.returnPct,
        (c) => `${c.returnPct >= 0 ? '+' : '−'}${Math.abs(c.returnPct).toFixed(1)}%`,
      ),
    },
  ];
}

/**
 * How the honours landed, in one sentence.
 *
 * Written to make the split visible: the point of five honours is that they go
 * to different people, and when they do not, that is worth saying too.
 */
export function tableLine(cards: TableCard[]): string {
  if (cards.length < 2) return 'Add a friend’s card to see how you stack up.';
  const list = honours(cards).filter((h) => !h.mostlyLuck);
  const winners = new Set(list.map((h) => h.standings[0]?.who).filter(Boolean));

  if (winners.size === 1) {
    return `${[...winners][0]} has taken every honour going. Somebody take a card off them and find out which one is doing the work.`;
  }
  if (winners.size === list.length) {
    return 'Four honours, four different people. That is what a table of friends who are good at different things looks like.';
  }
  return `${winners.size} different people hold the four honours. Nobody here is simply "the best" — you are good at different things.`;
}

/* ------------------------------------------------------------------ *
 * The card code
 * ------------------------------------------------------------------ */

const NAME_LETTERS = 8;
const CARD_BYTES = 1 + NAME_LETTERS + 2 + 3 + 1 + 1 + 1 + 2;
/** Returns are signed and can be large; carried as an offset percentage. */
const RETURN_OFFSET = 30_000;

export function encodeCard(card: TableCard): string {
  const letters = tidyName(card.who).padEnd(NAME_LETTERS, ' ');
  const writer = new ByteWriter().u8(1);
  for (const character of letters) writer.u8(character.charCodeAt(0));
  writer
    .uint(Math.max(0, Math.min(65_535, Math.round(card.standing))), 2)
    .uint(Math.max(0, Math.min(16_777_215, Math.round(card.bestWeek * 100))), 3)
    .u8(Math.max(0, Math.min(255, card.goodCalls)))
    .u8(Math.max(0, Math.min(255, card.callsMade)))
    .u8(Math.max(0, Math.min(100, Math.round(card.playbookWinRate))))
    .uint(
      Math.max(0, Math.min(65_535, Math.round(card.returnPct * 100) + RETURN_OFFSET)),
      2,
    );
  return encodeShort(CARD_PREFIX, writer.done());
}

export function decodeCard(code: string): TableCard | null {
  const bytes = decodeShort(CARD_PREFIX, code, CARD_BYTES);
  if (!bytes) return null;
  const reader = new ByteReader(bytes);
  if (reader.u8() !== 1) return null;

  let who = '';
  for (let i = 0; i < NAME_LETTERS; i++) who += String.fromCharCode(reader.u8());

  const card: TableCard = {
    who: tidyName(who.trim()),
    standing: reader.uint(2),
    bestWeek: reader.uint(3) / 100,
    goodCalls: reader.u8(),
    callsMade: reader.u8(),
    playbookWinRate: reader.u8(),
    returnPct: (reader.uint(2) - RETURN_OFFSET) / 100,
  };
  // More good calls than calls made is not a card this build produced.
  if (card.goodCalls > card.callsMade) return null;
  return card;
}
