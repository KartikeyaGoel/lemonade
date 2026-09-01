import { describe, expect, it } from 'vitest';
import { createCareer } from '../src/lib/career';
import { createClub, joinClub, propose } from '../src/lib/club';
import { SNAPSHOT } from '../src/lib/companies';
import { claimsThatHold } from '../src/lib/thesis';
import { desks } from '../src/lib/friends';
import { createPlaybook } from '../src/lib/playbook';
import { cardFor } from '../src/lib/table';

const ALL = { challenge: true, club: true, table: true };
const NONE = { challenge: false, club: false, table: false };

const card = (who: string, standing = 10, gain = 0) =>
  cardFor(who, standing, 40, 2, 3, createPlaybook(), gain);

describe('the friends desk', () => {
  it('has exactly three things on it', () => {
    const list = desks({ career: createCareer(), club: null, me: 'SAM', cards: [], unlocked: ALL });
    expect(list.map((desk) => desk.id)).toEqual(['challenge', 'club', 'table']);
  });

  it('shows what is locked instead of hiding it', () => {
    // Same argument as the road: a padlock you can see is a promise. A kid on
    // day two should already know a club exists.
    const list = desks({ career: createCareer(), club: null, me: 'SAM', cards: [], unlocked: NONE });
    expect(list.every((desk) => desk.locked)).toBe(true);
    expect(list.every((desk) => desk.opensWhen.length > 0)).toBe(true);
    expect(list.every((desk) => desk.status === null)).toBe(true);
  });

  it('says what a thing is for until it has news', () => {
    const fresh = desks({ career: createCareer(), club: null, me: 'SAM', cards: [], unlocked: ALL });
    expect(fresh.find((desk) => desk.id === 'challenge')?.status).toBeNull();

    const played = { ...createCareer(), challengesPlayed: 3, challengesWon: 2 };
    const after = desks({ career: played, club: null, me: 'SAM', cards: [], unlocked: ALL });
    expect(after.find((desk) => desk.id === 'challenge')?.status).toBe('3 played · 2 won, 1 lost');
  });

  it('shouts only when somebody else is stuck waiting', () => {
    const club = createClub('The club', 'SAM', 500, 7);
    const mine = desks({ career: createCareer(), club, me: 'SAM', cards: [], unlocked: ALL });
    expect(mine.find((desk) => desk.id === 'club')?.waiting).toBe(true);

    const theirs = desks({ career: createCareer(), club, me: 'ADA', cards: [], unlocked: ALL });
    expect(theirs.find((desk) => desk.id === 'club')?.waiting).toBe(false);
  });

  it('never shouts about a club that is locked', () => {
    const club = createClub('The club', 'SAM', 500, 7);
    const list = desks({ career: createCareer(), club, me: 'SAM', cards: [], unlocked: NONE });
    expect(list.find((desk) => desk.id === 'club')?.waiting).toBe(false);
  });

  it('leads with an open idea over the size of the pot', () => {
    // An idea on the table is something to do. A balance is not.
    const founded = joinClub(createClub('The club', 'SAM', 500, 7), 'ADA');
    expect(founded.ok).toBe(true);
    const club = founded.club;
    const status = (state: typeof club, me: string) =>
      desks({ career: createCareer(), club: state, me, cards: [], unlocked: ALL }).find(
        (desk) => desk.id === 'club',
      )?.status;

    expect(status(club, 'SAM')).toContain('pooled');

    const company = SNAPSHOT[0];
    const [claim] = claimsThatHold(company);
    const proposed = propose(club, 'SAM', company, 100, claim.id, 'everyone-i-know');
    if (proposed.ok) {
      expect(status(proposed.club, 'SAM')).toContain('on the table');
    } else {
      // The club rules changed under this test rather than the status line
      // being wrong; fail loudly rather than passing quietly.
      throw new Error(proposed.reason);
    }
  });

  it('says nothing about the table until somebody else is at it', () => {
    const alone = desks({
      career: createCareer(),
      club: null,
      me: 'SAM',
      cards: [card('SAM')],
      unlocked: ALL,
    });
    expect(alone.find((desk) => desk.id === 'table')?.status).toBeNull();
  });

  it('names what the kid leads on, and never names anyone as last', () => {
    // The whole argument in table.ts is that there is no such thing as last
    // here, so the status line has no way of saying it.
    const cards = [card('SAM', 40), card('ADA', 5, 90)];
    const leading = desks({ career: createCareer(), club: null, me: 'SAM', cards, unlocked: ALL });
    expect(leading.find((desk) => desk.id === 'table')?.status).toMatch(/^You lead on /);

    // ADA is behind on every skill honour and still leads the money one, which
    // is the point of having five: there is no such thing as last here, and the
    // status line has no way of saying it.
    const behind = desks({ career: createCareer(), club: null, me: 'ADA', cards, unlocked: ALL });
    const status = behind.find((desk) => desk.id === 'table')?.status ?? '';
    expect(status).toBe('You lead on most money made');
    expect(status.toLowerCase()).not.toContain('last');

    // Somebody genuinely leading nothing is told how many are at the table.
    const middling = [card('SAM', 40), card('ADA', 5, 90), card('LEE', 20, 40)];
    const lee = desks({ career: createCareer(), club: null, me: 'LEE', cards: middling, unlocked: ALL });
    expect(lee.find((desk) => desk.id === 'table')?.status).toBe('3 at the table');
  });
});
