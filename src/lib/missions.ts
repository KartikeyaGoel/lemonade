/**
 * Missions: things to go and say to a grown-up.
 *
 * The customer's Level 2 note asked for three, more or less verbatim — teach
 * your parent why you bought one of your stocks; explain today's market move
 * to someone at home; show your portfolio and say which holding you are most
 * confident about — and then "reward them".
 *
 * The reward is the easy part and the wrong part to design first. What makes
 * this work at all is that **the mission is generated from something the child
 * actually did**, so there is a real answer to give. "Explain today's market
 * move" is a homework question if the child has to invent the move; it is a
 * conversation if the app can hand them the week, the company and their own
 * written reason.
 *
 * So every mission below is built from the save. A mission with no material
 * behind it is not offered, which is why `missionsFor` can return an empty
 * list and why the screen has to cope with that rather than showing a locked
 * one. `unlocks.ts`: nothing exists until the child has done the thing that
 * gives it a meaning.
 *
 * ## Why the reward is for the telling, not for the reply
 *
 * `taught-a-grown-up` pays 20 credits when the child sends the message. It
 * does not wait for the grown-up to answer, and that is deliberate: a reward
 * that depends on somebody else turning up punishes the child whose grown-up
 * is busy, and the learning is in the *saying* — you do not know a thing until
 * you have had to explain it. §15's rule is that nothing is given for showing
 * up; writing an explanation of your own reasoning is not showing up.
 *
 * Pure module. No React, no I/O.
 */

import { journalLines, type Thesis } from './thesis';
import type { Company } from './companies';
import { MOVERS, type Story } from './checkin';

export type MissionId = 'why-i-bought' | 'what-moved' | 'most-confident';

export interface Mission {
  id: MissionId;
  /** What the child is being asked to go and do. One sentence. */
  ask: string;
  /**
   * A draft they can send as-is or change.
   *
   * Offered rather than required. A blank box in front of a nine-year-old who
   * has been told to explain something is where the whole feature dies; a
   * draft made of their own words is something they can read out loud.
   */
  draft: string;
}

export interface MissionInput {
  /** Every reason the child has written, newest last. */
  theses: readonly Thesis[];
  /** Names for tickers, so a draft says "Apple" rather than "AAPL". */
  companyFor: (ticker: string) => Company | undefined;
  /** Today's market story, when there is one. */
  story: Story | null;
  /** What each holding is worth now, so "most confident" can be about a real one. */
  valueOf?: (ticker: string) => number;
}

/**
 * The missions that have material behind them today.
 *
 * Ordered by how much of the child's own thinking they carry, which is also
 * the order of how much they teach: quoting your own written reason beats
 * describing a price move, which beats picking a favourite.
 */
export function missionsFor(input: MissionInput): Mission[] {
  const missions: Mission[] = [];
  const newest = input.theses.at(-1);

  if (newest) {
    const company = input.companyFor(newest.ticker);
    const name = company?.name ?? newest.ticker;
    /*
     * Their own journal, read back. Not a paraphrase and not a template with
     * the company name dropped in: the point of the mission is that a child
     * hears themselves being reasonable, which only works if the words are
     * the ones they picked.
     */
    missions.push({
      id: 'why-i-bought',
      ask: `Tell a grown-up why you bought ${name}.`,
      draft: journalLines(newest, name).join('. ') + '.',
    });
  }

  if (input.story) {
    const direction = input.story.change >= 0 ? 'up' : 'down';
    missions.push({
      id: 'what-moved',
      ask: 'Explain this week to somebody at home.',
      draft:
        `${input.story.name} went ${direction} this week. ` +
        `${MOVERS[input.story.because].kidLine} ` +
        `${input.story.owned ? 'I own some of it.' : 'I do not own any of it, so it does not change my money.'}`,
    });
  }

  if (input.theses.length > 1 && input.valueOf) {
    /*
     * "Most confident" is asked about the holding whose written reason held,
     * not the one that went up most.
     *
     * That distinction is the entire product. A child asked to name their best
     * holding will name the one that rose, which is the habit `thesis.ts`
     * exists to refuse — so the mission points at reasoning that survived, and
     * says so in the draft.
     */
    const sound = input.theses.filter((thesis) => thesis.quantHeld && !thesis.contradiction);
    const pick = sound.at(-1) ?? input.theses.at(-1)!;
    const name = input.companyFor(pick.ticker)?.name ?? pick.ticker;
    missions.push({
      id: 'most-confident',
      ask: 'Show a grown-up what you hold, and say which one you are surest about.',
      draft:
        `I am surest about ${name}. Not because it went up — because the reason ` +
        `I wrote down for it is still true.`,
    });
  }

  return missions;
}
