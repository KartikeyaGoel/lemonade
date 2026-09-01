/**
 * The company collection.
 *
 * `Career.companiesStudied` has been accumulating since the market opened — it
 * feeds the kid's standing, which sets their rank — and it has never once been
 * shown to them. A collection nobody can look at is a counter, and a counter is
 * not a reason to go and read another set of accounts.
 *
 * Every long-lived game the target audience plays has a completion set with a
 * hole in it: the Pokédex, the card collection, the achievement grid. The
 * mechanic works because it converts "learn more" into "fill that in", and the
 * thing it makes people do here happens to be exactly the thing this product
 * exists to make them do — open a company's accounts and read them.
 *
 * So the set is all twenty-four, always visible. A tier the kid has not opened
 * yet shows its silhouettes and what unlocks it, for the same reason the road
 * shows a padlocked stock market on the title screen.
 *
 * Nothing here is scored and nothing is timed. Reading a company's accounts is
 * the only way to fill a slot, and there is no way to fill one by accident.
 *
 * Pure module. No React, no I/O.
 */

import {
  SNAPSHOT,
  TIERS,
  tierUnlocked,
  type Company,
  type Tier,
} from './companies';

export interface Slot {
  ticker: string;
  name: string;
  /** Their accounts have been opened at least once, in any season. */
  read: boolean;
  /** The tier is open, so this can be read now. */
  reachable: boolean;
  company: Company;
}

export interface Shelf {
  tier: Tier;
  name: string;
  blurb: string;
  /** Empty once the shelf is open. */
  opensWhen: string;
  open: boolean;
  slots: Slot[];
  read: number;
}

export function shelves(studied: string[], standing: number): Shelf[] {
  const done = new Set(studied);
  return ([1, 2, 3] as Tier[]).map((tier) => {
    const open = tierUnlocked(tier, standing);
    const slots = SNAPSHOT.filter((company) => company.tier === tier).map((company) => ({
      ticker: company.ticker,
      name: company.name,
      read: done.has(company.ticker),
      reachable: open,
      company,
    }));
    return {
      tier,
      name: TIERS[tier].name,
      blurb: TIERS[tier].blurb,
      open,
      opensWhen: open ? '' : `⭐ ${TIERS[tier].opensAt}`,
      slots,
      read: slots.filter((slot) => slot.read).length,
    };
  });
}

export interface Progress {
  read: number;
  total: number;
  /** How many are readable right now, which is the only reachable target. */
  reachable: number;
}

export function progress(studied: string[], standing: number): Progress {
  const list = shelves(studied, standing);
  return {
    read: list.reduce((sum, shelf) => sum + shelf.read, 0),
    total: SNAPSHOT.length,
    reachable: list
      .filter((shelf) => shelf.open)
      .reduce((sum, shelf) => sum + shelf.slots.length, 0),
  };
}

/**
 * The one line under the collection.
 *
 * Deliberately never a percentage and never a rank. It names the next thing to
 * do, because "9 of 24" is a score and "eight left on this shelf" is an
 * afternoon.
 */
export function collectionLine(studied: string[], standing: number): string {
  const here = progress(studied, standing);
  if (here.read === 0) {
    return 'Open a company and read its accounts. That fills one in.';
  }
  if (here.read >= here.total) {
    return 'Every company in the game, read. There is nothing left in here you have not seen.';
  }
  const leftHere = here.reachable - here.read;
  if (leftHere <= 0) {
    const shut = shelves(studied, standing).find((shelf) => !shelf.open);
    return shut
      ? `Every company you can reach, read. ${shut.opensWhen} opens ${shut.slots.length} more.`
      : 'Every company you can reach, read.';
  }
  return `${leftHere} you can reach and have not read yet.`;
}

/**
 * Which company to suggest next.
 *
 * The cheapest one that is open and unread, because price is the only property
 * of a company a kid can act on before they have read anything about it, and a
 * suggestion they cannot afford is not a suggestion.
 */
export function suggestNext(studied: string[], standing: number, cash: number): Company | null {
  const done = new Set(studied);
  const affordable = SNAPSHOT.filter(
    (company) =>
      tierUnlocked(company.tier, standing) && !done.has(company.ticker) && company.price <= cash,
  );
  const pool = affordable.length > 0 ? affordable : [];
  if (pool.length === 0) return null;
  return pool.reduce((cheapest, company) => (company.price < cheapest.price ? company : cheapest));
}
