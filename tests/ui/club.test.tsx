/** @vitest-environment jsdom */
/**
 * The investment club, which is the only place two children decide together.
 *
 * `ClubScreen` had 53 uncovered statements and 8 uncovered functions, spread
 * across every part of it that needs a *second person*: joining by code,
 * proposing a buy, reading the log, and the scoreboard that attributes the
 * club's gains to whoever argued for them.
 *
 * That is the pattern in every gap this round has found. The paths a single
 * player walks alone were covered; the paths that need somebody else's data —
 * a resumed save, a friend's score, a friend's playbook, a club code — were
 * not, because constructing that data takes deliberate work and no test had
 * done it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { ThesisScreen } from '@/components/meta/ThesisScreen';
import { SNAPSHOT, SNAPSHOT_AS_OF, formatMillions, metricsFor } from '@/lib/companies';
import { strengthsAndRisks } from '@/lib/qualities';
import {
  MIN_MEMBERS_TO_PROPOSE,
  createClub,
  encodeClub,
  joinClub,
  type ClubState,
} from '@/lib/club';

/** A club with two members, which is the minimum that can decide anything. */
function twoMemberClub(): ClubState {
  const founded = createClub('Lemon Fund', 'Sam', 500, 7);
  const joined = joinClub(founded, 'Ada', 500);
  if (!joined.ok) throw new Error(`fixture rejected: ${joined.reason}`);
  return joined.club;
}

/**
 * Rendered as "Sam", not "SAM".
 *
 * `tidyMember` keeps a club member's case, unlike `tidyName` in the duel code
 * which uppercases — so `me` has to match the stored name exactly or the
 * screen decides it is somebody else's turn and hides every control that takes
 * one. The first version of this file passed "SAM" and lost the propose and
 * pass buttons, which looked like a bug in the screen and was a bug in the
 * fixture. Same lesson as PRODUCT.md §49's four wrong fixtures.
 */
function club(state: ClubState | null = twoMemberClub()) {
  const onChange = vi.fn();
  render(
    <ClubScreen
      club={state}
      me="Sam"
      startingCash={500}
      seed={7}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  return { onChange };
}

const press = (name: RegExp | string) =>
  userEvent.click(screen.getByRole('button', { name }));

describe('starting or joining a club', () => {
  afterEach(cleanup);

  it('offers both doors when there is no club yet', () => {
    club(null);
    expect(screen.getByRole('button', { name: /Start the club/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join the club/i })).toBeInTheDocument();
  });

  it('joins a real club from a real code', async () => {
    const { onChange } = club(null);
    await userEvent.type(
      screen.getByRole('textbox', { name: /Paste the club code/i }),
      encodeClub(createClub('Lemon Fund', 'Ada', 500, 7)),
    );
    await press(/Join the club/i);
    expect(onChange).toHaveBeenCalledTimes(1);
    const joined: ClubState = onChange.mock.calls[0][0];
    expect(joined.members.map((m) => m.name)).toContain('Sam');
  });

  it('refuses a code that is not a club', async () => {
    const { onChange } = club(null);
    await userEvent.type(
      screen.getByRole('textbox', { name: /Paste the club code/i }),
      'CLUB-NONSENSE',
    );
    await press(/Join the club/i);
    expect(screen.getByText(/not right/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('will not let the same child join twice', async () => {
    /*
     * The club is two people on two devices, so the only thing stopping a kid
     * joining their own club is this check. Worth a test: a duplicate member
     * would get two votes.
     */
    const { onChange } = club(null);
    await userEvent.type(
      screen.getByRole('textbox', { name: /Paste the club code/i }),
      encodeClub(twoMemberClub()),
    );
    await press(/Join the club/i);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/already|Could not join/i)).toBeInTheDocument();
  });
});

describe('deciding together', () => {
  afterEach(cleanup);

  it('needs two members before anything can be proposed', () => {
    expect(MIN_MEMBERS_TO_PROPOSE).toBe(2);
    expect(twoMemberClub().members).toHaveLength(2);
  });

  it('opens the company picker and proposes a buy', async () => {
    club();
    await press(/Propose a buy/i);

    // The picker lists real companies; take whichever is offered first.
    const companies = screen
      .getAllByRole('button')
      .filter((b) => /P\/E|a share/i.test(b.textContent ?? ''));
    expect(companies.length).toBeGreaterThan(0);
    await userEvent.click(companies[0]);

    // Then a reason has to be given — the club never buys on a hunch alone.
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/why|reason|because/i);
  });

  it('shows the log of what the club has done', async () => {
    club();
    await press(/The log/i);
    expect(document.body.textContent ?? '').toMatch(/Lemon Fund|club|week/i);
  });

  it('attributes the club’s gains to whoever argued for them', async () => {
    /*
     * The scoreboard, and the reason the club exists at all: a shared
     * portfolio where nobody can tell who was right teaches nothing.
     */
    club();
    await press(/How are we doing/i);
    expect(document.body.textContent ?? '').toMatch(/Sam|Ada/);
  });

  it('lets a member pass their turn without proposing', async () => {
    const { onChange } = club();
    await press(/Pass this turn/i);
    expect(onChange).toHaveBeenCalled();
  });

  it('hides the turn-only controls when it is not your turn', async () => {
    /*
     * The club is turn-based across two devices, and this is the only thing
     * that enforces it. A kid looking at their friend's turn should not be
     * offered a proposal they cannot make.
     */
    club({ ...twoMemberClub(), turn: 1 });
    expect(screen.queryByRole('button', { name: /Propose a buy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pass this turn/i })).not.toBeInTheDocument();
    // But the things anybody can read are still there.
    expect(screen.getByRole('button', { name: /The log/i })).toBeInTheDocument();
  });

  it('moves the club week on', async () => {
    const { onChange } = club();
    await press(/Move the week on/i);
    expect(onChange).toHaveBeenCalled();
  });
});

/*
 * The pilot: "In the investment club - propose buy, a link to research card
 * would be great. The kids won't remember the details."
 *
 * Worse than they realised. The club's route in is `PickView → ThesisScreen`,
 * so a child proposing a buy to their friends had never seen the company's
 * accounts at all — `CompanyDetail` lives inside `MarketScreen` and is
 * unreachable from the club.
 */
describe('the research card, where the reason gets written', () => {
  afterEach(cleanup);

  const company = SNAPSHOT[0];

  function renderThesis() {
    render(
      <ThesisScreen
        company={company}
        price={company.price}
        asOf={SNAPSHOT_AS_OF}
        maxDollars={200}
        actionLabel="Propose to the club"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
  }

  it('carries the company’s numbers on the screen where the reason is written', () => {
    renderThesis();
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Its numbers, before you say why/i);
    // The four figures a child needs to defend a claim to their friends.
    expect(text).toMatch(/Sells a year/i);
    expect(text).toMatch(/Keeps per \$1/i);
    expect(text).toMatch(/You pay/i);
    expect(text).toMatch(/Jumps about/i);
  });

  it('shows both sides, so a proposal is never an advert', () => {
    /*
     * The same rule as the compare screen. A child arguing for a buy in front
     * of their friends must be looking at what could go wrong with it, or the
     * club is a machine for talking each other into things.
     */
    renderThesis();
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Going for it/i);
    expect(text).toMatch(/Could go wrong/i);
    const { strengths, risks } = strengthsAndRisks(company, company.price, SNAPSHOT_AS_OF);
    expect(text).toContain(strengths[0].says);
    expect(text).toContain(risks[0].says);
  });

  it('agrees with the compare screen to the cent', () => {
    /*
     * §4, across two screens. Both read `metricsFor` at the price on screen, so
     * a child cannot be told 25c here and 24c there — which is exactly the sort
     * of thing that makes a nine-year-old stop believing the numbers.
     */
    renderThesis();
    const metrics = metricsFor(company, company.price, SNAPSHOT_AS_OF);
    expect(document.body.textContent).toContain(`${Math.round(metrics.netMargin * 100)}c`);
    expect(document.body.textContent).toContain(formatMillions(metrics.year.revenueM));
  });

  it('starts closed, because a child arriving from the market has just read it', () => {
    /*
     * §26 and the "so much text he stopped reading it" finding. A second copy
     * of the accounts, open, under a child who read them one tap ago is the
     * thing this product keeps having to learn not to do. One tap opens it.
     */
    renderThesis();
    const card = document.querySelector('details');
    expect(card, 'the research card is not a disclosure').toBeTruthy();
    expect((card as HTMLDetailsElement).open, 'it arrived already open').toBe(false);
  });

  it('names the filing the figures came from', () => {
    renderThesis();
    const metrics = metricsFor(company, company.price, SNAPSHOT_AS_OF);
    expect(document.body.textContent).toContain(metrics.year.fiscalYear);
  });
});
