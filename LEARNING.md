# Does a kid who finishes this game know how to invest?

A working answer to the question "at what point do we say it's time to trade?",
and what has to be true of the game before we're allowed to say it.

---

## 1. The honest answer, act by act

| After | They genuinely understand | They would still get hurt by |
|---|---|---|
| **Act 1** (shipped) | What a business is. Revenue vs profit. Unit cost, margin, fixed cost, break-even. That one day's result is noise. | Everything else. Act 1 is a business literacy act, not an investing act. |
| **Act 2** | Capacity, capex vs opex, compounding, opportunity cost, ownership without labour. | Valuation. They know how to *run* a business, not how to *price* one. |
| **Act 3** | Multiples. Why a growing business costs more per dollar of profit. Comparison shopping between two businesses. | Diversification. Behavioural discipline. Competition. |
| **Act 4** | How to read a real company the way they read their own stand. | Nothing structural — *if* the three gaps in section 4 are closed. |

So: **Act 1 alone, no.** The full four-act ladder, yes — but only with the
additions in section 4. As specced today, there are three holes big enough to
produce exactly the bloodbath we're trying to prevent.

---

## 2. What Act 1 actually installs

Every row is a mechanic that already ships, not an aspiration.

| Skill | How Act 1 teaches it | Why it transfers |
|---|---|---|
| Revenue ≠ profit | The P&L resolves to one number after costs | The single most common beginner error is admiring revenue growth |
| Unit cost | The shopping receipt derives cost per cup | This is COGS |
| Gross margin | Price − cost per cup, shown on the dial live | The difference between a good and bad business at the same revenue |
| Fixed cost & break-even | The $5 stand fee never moves; the cockpit shows cups-to-break-even | Operating leverage; why a slow quarter hurts disproportionately |
| Elasticity | Customers visibly walk past a high price | Pricing power, which is most of what a moat *is* |
| Signal vs noise | Weather swings daily profit; the game shows a 7-day average | Stops a kid selling a good business after one bad month |
| Inventory risk | Lemons rot; unsold cups were already paid for | Working capital, write-downs |
| Return on money in | End of week: money put in vs money back | The only question an investor asks |
| **Calibration** | The batch size is a bet on demand, and the game scores it | See section 3 — this is the qualitative bridge |

---

## 3. The qualitative half, and why it's the harder half

The reasoning "the iPhone is getting Apple Intelligence, so Apple goes up" is
a real skill — forming a view about the future — attached to a real trap.

**The skill:** noticing something about the world and committing to it.
**The trap:** everyone else noticed too, and the price already says so.

That second half is the difference between a kid who invests and a kid who
gets taken. It cannot be taught by explanation; it has to be *felt* as a loss
of potential gain. Act 1 already contains the primitive form of both halves:

- The forecast is a hint, not a promise. The kid reads it, decides how much to
  make, and commits money before knowing the answer. That is a thesis.
- The game now scores that thesis explicitly ("your call was too optimistic —
  you made 60 cups on a hot forecast and sold 22"). Being right about the
  weather is not the same as making money, because the price also had to be
  right.

**The missing piece, and where it goes:** in Act 3, when the kid is shown a
growing stand and a flat stand, the growing one must *already cost more*. The
lesson lands when they realise the thing they spotted was already in the price,
and the only way to win is to be right about something the price doesn't yet
say. That is the exact correction to the Apple Intelligence reasoning, and it
should be the emotional peak of Act 3 — not a footnote.

---

## 4. The three gaps that would cause a bloodbath

These are not in PRODUCT.md today. I think they're load-bearing.

### Gap 1 — Diversification and position sizing
Nowhere in Acts 1–4 does a kid learn not to put everything in one thing. This
is the highest-consequence omission on the list, because it's the one that
turns a wrong opinion into a wiped-out account.

*Fix:* Act 4 seeds the portfolio with the buyout proceeds and caps any single
position at a fraction of it. Make the cap a visible, earned mechanic — the
cap loosens as they hold more names. They should feel the concentration limit
before they understand it.

### Gap 2 — Competition and durability
Act 1's kid is the only lemonade stand on the street. So "why can't someone
just undercut you?" never comes up — and that question *is* moat analysis,
which is most of qualitative investing.

*Fix:* a rival stand appears in Act 2. It undercuts. The kid discovers that
price isn't the only lever (location, quality, being the only stand at the
park). That's differentiation, learned by being attacked.

### Gap 3 — Behavioural discipline
Nothing in the current design ever tempts a kid to panic. But Act 1's
monotonic-progression rule (which is right for retention) actively trains the
belief that *things only go up* — which is the worst possible prior to carry
into a real market.

*Fix:* Act 4 must break the floor. Simulated positions have to be allowed to
fall, and the reward has to go to the kid who held a good business through a
drawdown. The parent view should report "held through a 15% drop" as evidence,
because it is the single best predictor of real-world outcomes.

---

## 5. The bridge: where PE actually comes from

The continuity has to be arithmetic, not analogy. A kid should be able to see
it's literally the same sum.

```
Act 3   Someone offers $270 for your stand.
        Your stand makes $34 a week.
        270 / 34 = 8.   "Eight times weekly profit."

Act 4   Chipotle costs $X a share.
        Chipotle earns $Y a share per year.
        X / Y = 25.     "Twenty-five times yearly profit."

Same division. Bigger numbers. That ratio is called PE.
```

Then the two moves that make it usable:

- **Flip it.** 8x means 12.5% of your money back per year. 25x means 4%. Now
  it's comparable to a savings account, which a kid already understands.
- **Ask why they differ.** Same earnings, different price, means the market
  disagrees about the future. That's the growth premium, and it's the door to
  every interesting question in investing.

---

## 6. The readiness gate

"When is it time to trade?" should be answered by evidence, never by a day
count or a completion badge. Proposed criteria — all demonstrated by decisions
already made in-game:

1. Can state their own margin, unaided, from price and unit cost.
2. Has held a strategy through a losing day rather than changing it on one
   day's noise. *(Act 1 can already measure this.)*
3. Has correctly ranked two businesses by multiple and explained the cheaper
   one wasn't automatically better. *(Act 3)*
4. Has passed on a deal because the price was too high — not because the
   business was bad. *(Act 3; this is the hardest and most important.)*
5. Has sized a position below the cap voluntarily. *(Act 4)*

Until 1–4 are true, Act 4 stays read-only research. A kid can look at real
companies and compute the same ratios they computed for their stand, but
cannot commit simulated money. That's a defensible gate, and it's also good
product: the lock is what makes the unlock feel earned.

---

## 7. Status

**Built and tested — all four acts.**

| Act | Mechanics shipped |
|---|---|
| 1 | Day loop, two-dial cockpit, verifiable P&L, earned vocabulary, calibration scoring, 7-day price/profit chart |
| 2 | Capex (cooler, sign, fresh-squeezed) vs opex (helper, manager), park location, an undercutting rival with a price floor, weekly reinvest-or-cash-out, manager-run days |
| 3 | Equity offer with visible payback, three stands for sale at different multiples, buyout priced on trailing weekly profit with a growth premium, PE bridge generated from the kid's own sale |
| 4 | Real-company research cards, 35% position cap, 12 weeks of price movement with a scripted market scare, drawdown/panic-sale bookkeeping, finale |
| — | Parent view, readiness gate, save migration |
| Meta | Trophy case (30 badges, all state-derived), earned-word glossary (26 words), rank ladder, career record across seasons, Same-Sky Challenge, investment club, thesis engine, reckoning screen, seasons |

**Gaps 1 and 2 from section 4 are now closed** (position cap in Act 4; rival in
Act 2). **Gap 3 is closed in mechanism** — Act 4 lets prices fall, the week-5
scare is scripted so it always happens, and holding through it is measured and
reported. Verified across 25 seeds: every diversified player experiences at
least one holding down 10% or more.

## 8. The retention question, which is a learning question

Nothing durable is learned in forty-five minutes. The four acts are about that
long, so the first build could teach a kid something on a Tuesday and have no
answer at all for why they would open it again on Thursday — which means the
concept never got the repetition that turns it into an instinct. A kid who
plays four times learns roughly four times as much, and the fourth play has to
come from somewhere.

What was added for that, and what each thing is actually for:

| Mechanic | The learning it serves |
|---|---|
| **Trophy case** (30 badges) | Every badge names a business concept and is awarded only for a decision that demonstrates it. No badge exists for time played. Rank derives from badges, so the only way up is to demonstrate something new. |
| **Words you earned** (26 words) | Closes a real gap: the first build taught the P/E ratio as arithmetic and never said the words. Concepts you cannot name are concepts you cannot discuss or be corrected on. |
| **The round** (Act 2) | Recurring revenue, felt from the inside — give up margin, get customers who turn up in the cold — and then *paid for* in Act 3 as extra weeks of profit on the multiple. Business model → valuation, in one loop. |
| **Same-Sky Challenge** | The seed is the week, so two kids get identical weather and the entire difference is decisions. The screen decomposes the gap into price, volume, fixed costs and waste, and the four lines sum to the gap. |
| **Investment club** | You cannot spend the pot without a written thesis, and a tie fails. Defending a number to a peer who can vote you down is how people learn to value things. Attribution reports money made and reasoning-that-held-up as two separate boards. |
| **Thesis + reckoning** | The anti-bloodbath mechanism. A quantitative claim checked against the company's real metrics, a qualitative claim in their own words, then a 2×2 twelve weeks later. The box that matters is *made money, reason was wrong* — the game says "that was luck" out loud. |
| **Seasons** | A new stand, a new seed, every badge and word kept. Safe to press, which is the only reason anyone presses it. |

### Entry has to stay a single button

The risk of all of the above is obvious: six systems is a menu, and a menu is a
decision a kid has to make before they have any way of making it. So every one
of them is gated in `src/lib/unlocks.ts`, each with its reason written next to
it, and the invariant is enforced by test:

- A first launch has **one button** on it. No name, no avatar, no mode select.
- At the end of day one, **exactly one** card appears — the trophy case, with
  the name field folded into it. Three other systems come true at the same
  moment and stay silent, because they explain themselves where they appear.
- The challenge arrives at the end of Act 1 (there is now a week to send), the
  club in Act 4 (there is now money in a real company), seasons after the
  finale.
- Rewards never arrive in front of a result. Playing it revealed both halves of
  that: an unlock card appeared instead of the kid's first profit and loss
  statement, and the badge toast covered the day's headline profit.

## 9. The data is real now

This was the outstanding item, and it is closed.

**Fundamentals come from SEC EDGAR.** Revenue, net income and diluted share
count for all eight companies are read from their own 10-K filings via
`data.sec.gov`. No API key, no signup, no terms problem — these are the numbers
the company told the regulator. `scripts/fetch-market-data.mjs` fetches them,
and `.github/workflows/refresh-market-data.yml` re-runs it on a schedule and
commits the result, so the app stays a static bundle with no key in the browser
and nothing on a child's device ever calls a data provider.

**Prices are real weekly closes**, five years of them, on one shared date axis
so a market-wide fall lands on every company in the same week.

**Act 4 replays a real stretch of history.** The kid's own seed picks twelve
weeks out of the five years and they are not told which. This replaced a random
walk with a scripted week-5 crash, and it is a straight upgrade:

| | scripted | real history |
|---|---|---|
| Where the prices come from | a tuned RNG | actual weekly closes |
| Drawdown the kid experiences | always, by construction | 88% of windows have a ≥10% fall in a held name; median worst is −21% |
| When the bad week lands | always week 5 | whenever it actually landed |
| Volatility | a per-company constant we chose | the observed standard deviation |

Windows are drawn uniformly. They are deliberately **not** filtered to ones
containing a crash — curating for drama would teach a kid that markets always
fall in three months, which is its own kind of lie. It turns out not to be
necessary.

### Four things this got wrong before it got right

Every one of these produced a plausible, wrong number rather than an error,
which is exactly why they are worth writing down:

1. **Trusting the SEC's `CY####` frames.** They stop being assigned for some
   filers. Chipotle has none after 2020, so "the latest framed row" returned a
   five-year-old figure and reported it as this year's — a P/E of 143 against a
   true 33. Annual periods are now identified by a reported duration of roughly
   a year, which is the only definitional test.
2. **Letting the three concepts land on different years.** Revenue from 2025
   and net income from 2020 divide perfectly well. Now the latest fiscal year
   *all three* report is chosen, or the company is skipped.
3. **Year-on-year growth.** Disney's recovery year read as "growing 149% a
   year" and Chipotle's two flat years as 0% despite nearly doubling over
   three. Both are now three-year compound rates, and loss-makers are judged on
   revenue growth because a widening loss has no growth rate.
4. **Mixing a historical price with today's earnings.** The replay made this
   obvious: a 2022 price over 2025 earnings is a multiple nobody ever quoted,
   and it hands the kid hindsight. Every fiscal year is now stored with the date
   its 10-K became public — taken from the *first* filing that reported it, not
   the latest, because a 10-K restates two prior years — and the game shows
   whichever accounts were actually public on the week being replayed. Weeks
   before every company has filed anything are not offered at all.

### What is still worth doing

- **Prices via an official provider.** The fetch prefers Alpha Vantage when
  `ALPHAVANTAGE_KEY` is set (free tier, 25 requests a day, this uses eight) and
  falls back to an unofficial endpoint otherwise. Set the secret before relying
  on the scheduled refresh.
- **Quarterly fundamentals.** Only 10-K figures are used, so the accounts can be
  up to a year stale relative to the week being replayed. That is exactly what a
  real investor between filings has, so it is defensible — but 10-Qs would be
  closer.
