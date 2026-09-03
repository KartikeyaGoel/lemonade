/**
 * Act 2's shop, described as a plot of land rather than as three lists.
 *
 * The old screen was correct and it was a form: "buy once, keep forever",
 * "pay every single day", "where you trade", each a list of rows with a price
 * on the right. A kid reads that the way they read a settings menu, which is to
 * say they read the prices and none of the headings — and the headings *were*
 * the lesson. Capital and running costs is the single most useful idea in
 * Act 2, and it was being carried by two lines of eleven-pixel text.
 *
 * So the same seven decisions become seven places on a plot of land, and the
 * distinction is carried by where they stand rather than by a caption:
 *
 *  - **Things you own** sit *on* the stand. They are bought once and then they
 *    are simply part of the picture forever. Their badge says `$35 once`.
 *  - **People you employ** stand *next to* the stand, and they are wearing a
 *    wage. Their badge says `$12 a day`, in red, and it is still there
 *    tomorrow. Letting somebody go removes them from the picture.
 *  - **The pitch** is the ground everything is standing on, so it is the
 *    signpost at the edge and the backdrop behind.
 *
 * An unbought thing is not hidden and it is not a row in a list: it is an empty
 * dashed plot with a price on it, which is how every builder game the target
 * audience plays shows you what you cannot afford yet. Seeing the empty cooler
 * plot every morning is what turns a profitable day into wanting another one.
 *
 * This module is the pure half: what the plots are, what they cost, what each
 * one is doing for you right now, and whether the money is there. Pure module,
 * no React, no I/O.
 */

import {
  COOLER_CAPACITY,
  HELPER_CAPACITY,
  LOCATIONS,
  MANAGER_CAPACITY,
  STAFF,
  UPGRADES,
  dailyFixedCosts,
  serviceCapacity,
  standLines,
  standOpening,
  type BusinessState,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from './business';
import { SHOP, shopDailyCost } from './retail';
import { totalFixedCost } from './simulation';
import { plural } from './copy';

/** Where a plot sits, which is also what kind of spending it is. */
export type PlotKind =
  /** On the stand. Bought once. */
  | 'kit'
  /** Beside the stand, wearing a wage. */
  | 'crew'
  /** The ground itself. */
  | 'pitch'
  /**
   * A whole other place, down the road.
   *
   * The fourth kind of spending, and it arrives with the fourth kind of wall.
   * Kit makes this stand better, crew makes it faster, a pitch moves it — and
   * a site is the first purchase that is somewhere *else*, which is why it is
   * drawn along the horizon rather than on the table.
   */
  | 'site';

/** The plots that are not kit, crew or a pitch. */
export type SiteId = 'stand-sidewalk' | 'stand-park' | 'shop';

export interface Plot {
  id: UpgradeId | StaffId | LocationId | SiteId;
  kind: PlotKind;
  name: string;
  emoji: string;
  /** Already yours: on the stand, on the payroll, or under your feet. */
  owned: boolean;
  /** What it costs to get it. Zero for a pitch you are already standing on. */
  cost: number;
  /** Whether that cost lands once or every single day, in the kid's words. */
  costLabel: string;
  /**
   * What it goes on owing every day *after* the one-off, or null.
   *
   * Only a site has both, and leaving this out was a straight falsehood on the
   * screen: a second stand costs $40 once and $14 a day for the pitch, and the
   * sheet — which knew only about "once" and "a day" — printed *"after that it
   * is free forever"* under it. PRODUCT.md §4 says every number on screen is
   * true and reconciles. A plot that is both kinds of spending at once has to
   * be able to say so.
   */
  dailyAfter: number | null;
  /** Can they pay for it right now? Always false for something already owned. */
  affordable: boolean;
  /** One line, in effects the kid can check tonight. */
  what: string;
  /**
   * What it is doing *right now*, for something already owned. This is the
   * thing a list of rows cannot show: a cooler that is not being used because
   * the kid never makes more than thirty cups is a cooler that was a mistake,
   * and the kid should be able to find that out by tapping it.
   */
  doing: string | null;
}

/**
 * Everything on the plot, in the order it is built up in real life: the pitch
 * you stand on, the kit you put on the table, then the people.
 */
export function plots(business: BusinessState, cash: number): Plot[] {
  const capacity = serviceCapacity(business);

  const kit = (Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
    const item = UPGRADES[id];
    const owned = business.upgrades[id];
    return {
      id,
      kind: 'kit' as const,
      name: item.name,
      emoji: item.emoji,
      owned,
      cost: item.cost,
      costLabel: 'once',
      dailyAfter: null,
      affordable: !owned && cash >= item.cost,
      what: item.blurb,
      doing: owned ? kitDoing(id, capacity) : null,
    };
  });

  const crew = (Object.keys(STAFF) as StaffId[]).map((id) => {
    const item = STAFF[id];
    const owned = business.staff[id];
    return {
      id,
      kind: 'crew' as const,
      name: item.name,
      emoji: item.emoji,
      owned,
      cost: item.wage,
      costLabel: 'a day',
      dailyAfter: null,
      // A wage is owed tomorrow too, so the bar is a day's wage in hand.
      affordable: !owned && cash >= item.wage,
      what: item.blurb,
      doing: owned ? crewDoing(id, business) : null,
    };
  });

  const pitch = (Object.keys(LOCATIONS) as LocationId[]).map((id) => {
    const spot = LOCATIONS[id];
    const here = business.location === id;
    return {
      id,
      kind: 'pitch' as const,
      name: spot.name,
      emoji: spot.emoji,
      owned: here,
      cost: spot.fee,
      costLabel: 'a day',
      dailyAfter: null,
      affordable: !here && cash >= spot.fee,
      what:
        spot.demandMultiplier > 1
          ? `${spot.blurb} ${Math.round((spot.demandMultiplier - 1) * 100)}% more people walk past.`
          : spot.blurb,
      doing: here ? `You are here. ${pitchDoing(id)}` : null,
    };
  });

  return [...pitch, ...kit, ...crew, ...sites(business, cash)];
}

/* ------------------------------------------------------------------ *
 * Sites: another stand, and then a shop
 * ------------------------------------------------------------------ */

/**
 * The places down the road, opened or not.
 *
 * Both are visible from the first day of the act they belong to, greyed with a
 * price on them, for the same reason every unbought plot is: PRODUCT.md §33 —
 * a kid saves up for a thing that has been standing in their front garden all
 * week. A padlocked shop on the horizon is what makes the second stand feel
 * like a step rather than the end.
 */
export function sites(business: BusinessState, cash: number): Plot[] {
  const out: Plot[] = [];

  for (const location of Object.keys(LOCATIONS) as LocationId[]) {
    const opening = standOpening(business, location, cash);
    const mine = business.stands.filter((stand) => stand.location === location).length;
    const spot = LOCATIONS[location];
    out.push({
      id: (location === 'park' ? 'stand-park' : 'stand-sidewalk') as SiteId,
      kind: 'site',
      name: `Another stand · ${spot.name.toLowerCase()}`,
      /*
       * Deliberately not the pitch's own emoji.
       *
       * It was, and in the scene that put two identical trees side by side —
       * one meaning "move to the park for $14 a day" and one meaning "open a
       * second stand at the park for $40 once". Two different decisions with
       * the same picture on them, touching, is worse than no picture: a kid who
       * taps the wrong one has been misled by us rather than by the game.
       */
      emoji: '\u{26F1}\u{FE0F}',
      owned: mine > 0,
      cost: opening.setup,
      costLabel: 'once',
      dailyAfter: opening.daily,
      affordable: opening.blocked === null,
      what:
        opening.blocked ??
        `Serves ${opening.capacity} more cups a day. $${opening.daily.toFixed(2)} a day for the pitch${opening.runBy === 'minder' ? ' and a minder' : ''}.`,
      doing: mine > 0 ? standDoing(business, location) : null,
    });
  }

  const shopOpen = business.shop.open;
  out.push({
    id: 'shop',
    kind: 'site',
    name: SHOP.name,
    emoji: SHOP.emoji,
    owned: shopOpen,
    cost: SHOP.fitOut,
    costLabel: 'once',
    dailyAfter: shopOpen ? shopDailyCost(business.shop) : SHOP.rent,
    /*
     * Openable whether or not the money is in the cash box, and that is the
     * whole point of the stage.
     *
     * Every other plot in the yard is a straight purchase, so `affordable`
     * means "can they pay for it". The shop is the first thing in the game a
     * kid cannot buy out of profit, and tapping it opens the three-way choice
     * about *how* to pay — borrow, sell a slice, or wait. Gating the tap on
     * having the cash made the one screen that answers that question
     * unreachable by the only kid who needs it.
     */
    affordable: !shopOpen,
    what: `Serves ${SHOP.capacity} cups a day indoors, and the weather stops mattering. $${SHOP.rent} a day in rent, owed when nobody comes.`,
    doing: shopOpen
      ? `Open. $${shopDailyCost(business.shop).toFixed(2)} a day owed before the door does anything.`
      : null,
  });

  return out;
}

function standDoing(business: BusinessState, location: LocationId): string {
  const lines = standLines(business).filter((line) => line.location === location);
  const mine = lines.filter((line) => line.id !== 0);
  const doubled = lines.length > 1;
  const cups = mine.reduce((sum, line) => sum + line.capacity, 0);
  return doubled
    ? `${cups} more cups a day here — but you already trade this pitch, so a new stand on it only finds about half a crowd.`
    : `${cups} more cups a day, on a crowd that was not yours before.`;
}

function kitDoing(id: UpgradeId, capacity: number): string {
  switch (id) {
    case 'cooler':
      return `Part of the ${plural(capacity, 'cup')} a day you can serve. Worth nothing on a day you make fewer.`;
    case 'bigSign':
      return 'More people notice the stand, whatever you are charging.';
    case 'freshSqueeze':
      return 'People pay more without walking off. Paid for itself the first time you raised the price.';
  }
}

function crewDoing(id: StaffId, business: BusinessState): string {
  switch (id) {
    case 'helper':
      return `${HELPER_CAPACITY} more cups a day, and $${STAFF.helper.wage} owed whether or not it rains.`;
    case 'manager':
      return business.handsOffDays > 0
        ? `Has run the stand ${business.handsOffDays} profitable ${business.handsOffDays === 1 ? 'day' : 'days'} without you.`
        : 'Can run the stand without you. Nothing has been proved yet.';
  }
}

function pitchDoing(id: LocationId): string {
  return id === 'park'
    ? 'The rent is owed on a rainy Tuesday too.'
    : 'Cheap, and it is the cheapness you are paying for.';
}

/**
 * The cost of a day before a single cup is sold — the number that decides
 * whether a quiet day is survivable.
 */
export function dailyBurn(business: BusinessState): number {
  // Derived from the same lines the day is actually charged, rather than a
  // hand-rolled copy of them. The copy was correct for one stand and no shop,
  // and would have quietly under-reported the burn by a second pitch fee, a
  // minder's wage, the rent and the loan the moment any of those existed —
  // in the one number on the screen that tells a kid whether a quiet day is
  // survivable.
  return totalFixedCost(dailyFixedCosts(business));
}

/**
 * How much of the capacity the kid has bought is going unused.
 *
 * Act 2's real trap is buying capacity you have no demand for, and nothing in
 * the old screen could tell you that had happened. A cooler plus a helper is
 * 105 cups a day; a kid selling 38 has spent $35 and owes $12 a day for 67 cups
 * nobody wanted.
 */
export function idleCapacity(business: BusinessState, typicalCupsSold: number): number {
  return Math.max(0, serviceCapacity(business) - Math.round(typicalCupsSold));
}

/** Sales have to be pressing against the ceiling before more room is worth anything. */
const AT_THE_CEILING = 3;

/**
 * Is more capacity pointless right now?
 *
 * The test is not "does this add more than I am wasting" — it is simply
 * "am I turning anyone away". If the queue is not longer than the stand, a
 * bigger stand sells nothing, and that is true whether the purchase adds five
 * cups of room or fifty. Getting this backwards means the warning never fires
 * on exactly the biggest, most expensive mistakes.
 *
 * Needs a day of history: with nothing to go on, the game does not get to
 * second-guess the kid.
 */
export function roomGoingSpare(
  business: BusinessState,
  typicalCupsSold: number,
): boolean {
  if (typicalCupsSold <= 0) return false;
  return idleCapacity(business, typicalCupsSold) >= AT_THE_CEILING;
}

/** Extra cups a day this purchase would unlock. Zero for anything else. */
export function capacityAdded(id: UpgradeId | StaffId): number {
  if (id === 'cooler') return COOLER_CAPACITY;
  if (id === 'helper') return HELPER_CAPACITY;
  if (id === 'manager') return MANAGER_CAPACITY;
  return 0;
}

/**
 * How many cups a day this has to sell to be worth its wage.
 *
 * Only meaningful for the daily costs, and it is the most useful number in
 * Act 2: it converts "the helper costs twelve dollars" into "the helper has to
 * sell nine more cups", which is a thing a kid can look at the sign and judge.
 */
export function cupsToCoverWage(wage: number, marginPerCup: number): number | null {
  if (marginPerCup <= 0) return null;
  return Math.ceil(wage / marginPerCup);
}
