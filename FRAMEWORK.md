# FRAMEWORK.md — the Level 1 gameplay arc, and whether we actually built it

This document is the customer's framework for Level 1, written down so it can be
argued with, plus an honest audit of the shipped game against it.

`PRODUCT.md` says what we are building. This says **what Level 1 has to
deliver** and marks, concept by concept, whether the code delivers it.

> **Status: built.** This document was written as a gap analysis against a
> four-stage arc, and the gaps it found are now closed — five stages, twelve
> concepts with mechanics, and the listing as the Level 1 endpoint. §10 records
> what shipped against each finding, and `PRODUCT.md §44` is the account of
> doing it, including the eleven defects the restructure surfaced in parts of
> the game that had never had weight on them.
>
> **§2 to §9 are left as they were written**, in the present tense, describing
> the game as it stood before the build. They are the reasoning that justified
> the change, and rewriting them into the past tense would destroy the only
> record of why.

Read §2 for the original verdict, §10 for what happened, §11 for a later audit
of whether §10's claims are still true, and §12 for the game measured against
the refined two-loop / four-stage framework in §1.

---

## 1. The framework, as given

### Step 1 — construct the gameplay arc, in this order

1. Define the Level 1 learning arc — turn the learning outcomes into a
   progression from *small business* to *public company*.
2. Define the gameplay loop — the repeated actions as the player launches and
   scales.
3. Map concepts to gameplay moments — revenue, profit, hiring, capital,
   ownership, shares, valuation each experienced as a decision or a consequence.
4. Design the progression model — what unlocks as the business grows.
5. Choose the Level 1 endpoint / unlock condition — define exactly what "ready
   for Level 2 investing" means *in gameplay terms*.
6. Create one playable vertical slice — one business journey, specified enough
   to test whether the loop is fun and teaches.
7. **Only then** write the developer spec.

The order matters and we did it out of order: this repo has a developer spec and
eleven thousand lines of tested simulation in `src/lib`, and is only now writing
down the arc. That is not a reason to redo it. It is a reason to check it,
which is what §2 does.

### The eight lenses

| # | Lens | The question |
|---|---|---|
| 1 | Learning transformation | What should a kid understand intuitively after Level 1? |
| 2 | Player fantasy | Who does the child feel like they are becoming? |
| 3 | Player motivation | What makes them keep playing besides learning finance? |
| 4 | Core loop | What will they repeatedly do throughout Level 1? |
| 5 | Decisions & tradeoffs | What interesting decisions teach how companies work? |
| 6 | Progression | How does running a company get more sophisticated? |
| 7 | Economy & systems | What systems make the business behave realistically enough to teach? |
| 8 | Feedback & consequences | How does the child understand *why* something happened? |

### The stage ladder

> Single Stand → Multiple Stands → Retail → IPO

Each stage: introduce key concepts, give decisions around each concept, and
reinforce through consequence and feedback.

### The twelve concepts

revenue · marketing · capital · value · cost · margin · ownership · shares ·
profit · competition · growth · stock price

### The core loop, shortened

> Make product → set price → sell it → decide what to do next.

### The refinement (given later)

Added after §10 shipped. It does not replace anything above; it sharpens the
loop into two, and gives each stage an identity, a question and an unlock.

**The player-facing loop** — what the kid repeatedly does:

> Make → Price → Sell → Decide → **Grow**

**The progression loop** — what makes Level 1 progress:

> Run business → Make decisions → See consequences → Improve → **Unlock
> greater complexity**

The first is the turn. The second is the arc. The four-beat loop above is the
first one with its fifth beat left off, and the fifth beat is the one that
moves a kid between stages.

### The four stages, refined

| | Stage 1: Single Stand | Stage 2: Multiple Stands | Stage 3: Retail Company | Stage 4: IPO / Public Company |
|---|---|---|---|---|
| **Player identity** | Owner/operator | Business builder | Founder/CEO | CEO + shareholder |
| **Core concepts** | Revenue, costs, profit | Margin, marketing, competition, reinvestment | Growth, capital, ownership/equity | Company value, public shares, IPO, stock price |
| **Central question** | Can I make money? | Can I grow profitably? | How do I finance and manage growth? | What is my company worth, and what does ownership mean in a public company? |
| **New complexity** | Basic economics | Scale | Capital + ownership | Market valuation |
| **Natural unlock** | Build another stand | Become a larger company | Raise capital / establish ownership | Enter investing world |

### Stage 1, specified (given later still)

A row-by-row specification for the first stage, given after §13. Recorded
verbatim because §15 audits the build against it and the wording is the
standard.

| | Stage 1 — Single Stand |
|---|---|
| **Learning goal** | Understand how cost and selling price affect profit, and how customer willingness to pay depends partly on product quality. |
| **Core mental model** | A profitable business balances cost + customer value + selling price + demand. Highest price or lowest cost isn't automatically best. |
| **Primary objective** | Maximize profit / hit a defined profit target. |
| **Lever 1: Product / Cost** | 2–3 simple choices such as organic vs. regular, fresh vs. store-bought, bulk vs. day-by-day purchasing. |
| **Lever 2: Selling Price** | Player chooses the price per cup. Higher price can increase profit per sale but reduce demand. |
| **Demand system** | Driven only by price + quality at this stage. No weather, competition, location, etc. |
| **Quality effect** | Better quality costs more but can increase demand and support a higher selling price. Lower quality can reduce demand over time. |
| **Bulk-purchase lesson** | Buying in larger quantities lowers cost per cup but requires more spending upfront. |
| **Core loop** | Configure product → Set price → Sell → See results → Adjust → Replay |
| **Hero feedback** | Revenue + Profit |
| **Supporting feedback** | Total cost + Selling price |
| **Visual feedback** | Customers visibly buy, hesitate, or walk away depending on quality/price. |
| **Diagnostic feedback** | Short explanation such as "Customers liked the quality, but your price was too high." |
| **Failure model** | No harsh failure. Experiment, understand what happened, change variables, and retry. |
| **Opening** | 1–2 exploratory rounds without a target. |
| **Challenge** | Introduce a clear profit goal after exploration. |
| **Unlock** | Hit the profit goal in two separate rounds. |
| **Desired feeling** | Experiment → Notice patterns → Optimize → Challenge → Mastery |
| **Next unlock** | Multiple Stands |

---

## 2. The verdict

**Level 1 in the framework is a four-stage arc that ends with the kid taking
their company public. The shipped game is a three-act arc that ends with the kid
selling their company privately and walking away.** Those are different games
with a lot of shared parts.

What that means in numbers:

| | Built | Partial | Missing |
|---|---|---|---|
| **Stages** (4) | Single Stand | — | Multiple Stands, Retail, IPO |
| **Concepts** (12) | revenue, cost, margin, profit, capital, competition, value, growth | marketing, ownership | shares, stock price |

More precisely, the shipped Act 2 ("Scale") is a *deeper single stand*, not
multiple stands: [`moveTo`](src/lib/business.ts) relocates
the one stand between a sidewalk and a park gate. You never run two at once. And
the shipped Act 3 ("Ownership") ends at `buyoutAccepted`
([`act3Complete`](src/lib/progress.ts), as it then was) — a single private buyer, at a
multiple of trailing weekly profit. There is no share count, no price per share,
and the word *IPO* does not appear anywhere in `src/`.

So the customer is right, and more specifically right than "make it more of a
game arc." Three concrete things are absent, and two of them — **shares** and
**stock price** — are the two that the whole product is pointing at. A kid
currently meets a share price for the first time on Apple, in Level 2, having
never had one of their own. That is the seam the framework closes.

The good news is that nothing built is wasted. The unit economics, the rival,
the capex/opex split, the multiple, the growth premium and the readiness gate all
survive intact; two new stages slot in between what exists, and the Act 3 buyout
becomes one half of the decision that ends Level 1 rather than the end itself.

---

## 3. The eight lenses, answered for this game

### 1. Learning transformation

After Level 1 a kid should be able to say, unprompted, to a parent:

- Revenue is not profit. Selling more can make you poorer.
- Every business has costs, and some of them you owe whether or not anyone buys.
- You spend money to make money, and buying a thing once is a different kind of
  risk from owing a wage every day.
- A business is worth some number times what it earns, and the same business is
  a good buy at one price and a bad buy at another.
- Owning a company is owning a *fraction* of it, and that fraction can be cut
  into shares.
- A share has a price, the price moves, and it moves because people change their
  minds about what the company will earn later.
- A company can end up owned by strangers, and that is what "public" means.

The last three are the new ones. The first four ship today, and
[LEARNING.md](LEARNING.md) is the honest account of how well.

### 2. Player fantasy

**Lemonade seller → owner → founder → CEO of a public company.**

The shipped fantasy ends one step earlier and in a different direction:
*founder who sold up*. Selling is a real and respectable outcome, and the
buyout is currently called the emotional peak of the game
([PRODUCT.md §6](PRODUCT.md)). But "I sold it and left" is a worse hook for a
twelve-year-old than "I still run it and now it's on the stock market," and it
is a worse hook for Level 2, where the kid is about to spend an hour reading
companies that are all still going. Keep the buyout on the table; move the peak
to the listing.

### 3. Player motivation

What makes them say one more round, in the order they'll feel it:

- Beat the rival across the road (built — [`advanceRival`](src/lib/business.ts)).
- Watch a number compound because they left it in (built — weekly reinvest).
- Get to the next stage: a second stand, then a shop with a door.
- **Hit a valuation.** A headline number for the whole company, visible early
  and always, which every good day nudges. This is the motivational spine the
  game is missing, and it is what makes the IPO feel like a finish line rather
  than an event that happens to you.
- **See their own share price move**, and be able to show a friend a number that
  looks exactly like the ones grown-ups talk about.
- Collections and words (built — [collection.ts](src/lib/collection.ts),
  [glossary.ts](src/lib/glossary.ts)).

### 4. Core loop

The framework's shortened loop is right and the shipped loop is longer than it:

```
shipped     morning → shop (buy lemons) → price → plan → run → close → (week-end)
framework   make → price → sell → decide
```

Six screens to get one day done. That is defensible in Stage 1, where buying
ingredients *is* the lesson about unit cost and spoilage, and it is indefensible
by Stage 3, where a kid running four locations will tap it a hundred times.

**Resolution: the loop stays four beats and gets faster per stage, not shorter.**

| Stage | Make | Price | Sell | Decide |
|---|---|---|---|---|
| Single stand | buy lemons, choose batch | one price | watch the street | spend or save |
| Multiple stands | batch per stand (defaulted) | one price, or per stand | all stands at once | open another, or upgrade |
| Retail | order stock for the week | shelf price | a week at a time | staff, marketing, or loan |
| IPO | — | price the *company* | sell shares | how much to sell |

Same four verbs the whole way up. The time unit stretches — a day, then a day
across several stands, then a week — which is exactly how running a bigger
business actually feels, and it keeps a session finishable
(§4 of [PRODUCT.md](PRODUCT.md): every session has a finishable arc).

### 5. Decisions & tradeoffs

The framework asks for **two or three real decisions per stage**, each with two
reasonable answers, and the loop repeated around them. Audited:

| Stage | Decision | Two reasonable answers | Built? |
|---|---|---|---|
| Single stand | What do I charge? | $1 sells 40, $2 sells 20 | ✅ [PriceScreen](src/components/PriceScreen.tsx) |
| | How many cups do I make? | short and sell out, or long and pour it away | ✅ spoilage in [simulation.ts](src/lib/simulation.ts) |
| Multiple stands | Second stand, or upgrade this one? | more places, or more per place | ❌ no second stand |
| | Am I fighting on price or on quality? | undercut back, or be worth more | ✅ [`standAppeal`](src/lib/business.ts) |
| Retail | Rent the shop, or stay outside? | fixed rent is scary and weatherproof | ❌ |
| | Spend on marketing, or on stock? | demand, or the ability to serve it | ⚠️ one-off sign only |
| | Loan, or investor? | pay it back, or give a piece away | ⚠️ investor only, no loan |
| IPO | Sell the whole thing to one buyer, or a slice to the public? | cash and freedom, or upside and a job | ❌ buyout only |
| | How much of the company do I sell? | more cash, less ownership | ⚠️ fixed 20% slice |

Five of nine. The three ❌ rows are the three missing stages, which is the
expected shape of this table given §2 — but note that **two ⚠️ rows are cheap
fixes with high learning value**: making the equity slice a *dial* instead of a
fixed 20% ([`createOwnershipState`](src/lib/ownership.ts)) turns a card the kid reads
into a decision the kid makes, and it is the natural home for the word *shares*.

### 6. Progression

```
Stage 1  Single stand    price · cost · margin · revenue · profit
Stage 2  Multiple stands capital · competition · growth · marketing
Stage 3  Retail          fixed cost · operating leverage · debt vs equity
Stage 4  IPO             value · ownership · shares · stock price
                                                            ↓
Level 2  The market      real companies, same four numbers
```

Each stage exists because the previous one hit a wall the kid can feel:

- **Stage 1 → 2.** Best price found, and still capped at thirty cups by one pair
  of hands. Built, and the wall is real ([`BASE_SERVICE_CAPACITY`](src/lib/business.ts)).
- **Stage 2 → 3.** Several stands, and every one of them shuts when it rains.
  Weather owns you. A room with a door does not care about weather.
- **Stage 3 → 4.** The shop works, and the next one costs more than the business
  makes in a season. You cannot get there out of profit. Somebody else's money
  is the only way up, and there is more of it in public than in one buyer's
  pocket.

That last wall is the one that makes an IPO make sense to a child, and it is
worth stating plainly because it is the hardest thing in this document to design
well: **a kid must want outside money before we explain what selling shares is.**
No concept before the wall that motivates it.

### 7. Economy & systems

Shipped and load-bearing ([PRODUCT.md §11](PRODUCT.md), 668 tests):
demand falls with price; weather swings it; capacity caps sales; lemons spoil;
capex raises the ceiling once, wages cost daily; quality flattens the demand
curve (pricing power); a rival splits the street; leaving profit in compounds.

New systems the missing stages need, kept as small as they can be without
teaching something false:

- **Per-stand demand.** Each location has its own crowd and its own rival
  exposure. Opening a second stand near the first should *split* the crowd, or
  the kid learns that growth is free.
- **Fixed rent, and weather immunity.** A shop trades a big monthly number for a
  demand floor. This is the only honest way to make operating leverage felt.
- **Marketing as a repeatable spend with diminishing returns.** Not a one-off
  sign. Spend $X this week, demand rises this week, and the second $X does less
  than the first.
- **Company value, recomputed continuously.** `trailingWeeklyProfit × multiple`
  already exists ([`trailingWeeklyProfit`](src/lib/business.ts),
  [`buyoutOffer`](src/lib/ownership.ts)). Surface it as a live headline
  number from Stage 2 onward instead of revealing it once in Act 3.
- **Shares.** A share count, a price per share, and the identity
  `price × shares = value` shown as that multiplication, never as a total.
- **A share price that moves for a reason.** Weekly: profit changes → the market
  re-rates → the price moves. The kid must be able to attribute every move.

Hidden, still: the demand curve's coefficients. We never project demand
([PRODUCT.md §4](PRODUCT.md)) and an IPO must not become a slider you read.

### 8. Feedback & consequences

The shipped feedback is the strongest part of the game and the model for the new
stages: customers visibly walk past a $3 cup
([Customer.tsx](src/components/Customer.tsx)), the P&L reconciles on paper, and
words arrive *after* the thing they name, one a day
([`Game.pendingInsights`](src/lib/progress.ts)).

What the new stages owe the same treatment:

| Decision | Consequence the kid should see, and when |
|---|---|
| Open a second stand | Both stands' takings on one screen the next day; the first one's crowd is visibly thinner |
| Rent the shop | The rent line appears in the P&L on a day nobody comes, and it still has to be paid |
| Spend on marketing | More people on the street that week, fewer the week after you stop |
| Take a loan | A repayment line every week, whatever happened |
| Sell 30% at IPO | The cash lands, and then **30% of every week's profit leaves, on screen, forever** |
| A bad week after listing | Their own share price falls, with the earnings number that caused it next to it |

That last row is the single most valuable new piece of feedback in the game,
because it is the thing Level 2 asks the kid to sit through
([PRODUCT.md §8](PRODUCT.md): behavioural discipline). Right now they first
experience a falling price on a stranger's company with fake money. They should
first experience it on their own.

---

## 4. Concept-by-concept audit

Twelve concepts, against the code. "Mechanic" is where a kid *makes a decision
or takes a consequence* — not where a word is displayed.

| Concept | Stage | Mechanic | Status |
|---|---|---|---|
| **revenue** | 1 | Cups × price, shown as the multiplication | ✅ [simulation.ts](src/lib/simulation.ts) |
| **cost** | 1 | Lemons/sugar/cups bought in units; $5 stand fee | ✅ [ShopScreen](src/components/ShopScreen.tsx) |
| **margin** | 1 | Price − unit cost, live on the price dial | ✅ [PriceScreen](src/components/PriceScreen.tsx) |
| **profit** | 1 | The one number the day resolves to | ✅ [CloseScreen](src/components/CloseScreen.tsx) |
| **competition** | 2 | Rival opens on day 3, undercuts to a floor, follows you | ✅ [`advanceRival`](src/lib/business.ts) |
| **capital** | 2 | Capex (cooler/sign/quality) vs opex (helper/manager) | ✅ [`UPGRADES` / `STAFF`](src/lib/business.ts) |
| **growth** | 2 | Reinvest-or-withdraw weekly; 7-day growth rate prices the exit | ✅ [`growthRate`](src/lib/business.ts) |
| **value** | 4 | Buyout at 8× / 11× / 6× trailing weekly profit | ✅ [`buyoutOffer`](src/lib/ownership.ts) |
| **marketing** | 2–3 | One-off `bigSign` capex that raises awareness | ⚠️ **partial** — not repeatable, no spend-vs-return decision, no diminishing returns, no word in the glossary |
| **ownership** | 4 | Investor buys a fixed 20% slice; the cut leaves daily | ⚠️ **partial** — the *consequence* is excellent; the *decision* is missing (20% is not a dial), and it is only ever a percentage, never a count of anything |
| **shares** | 4 | — | ❌ **missing.** Real companies have share counts in [market.ts](src/lib/market.ts); the kid's own company never does |
| **stock price** | 4 | — | ❌ **missing.** No price per share for the kid's company, and nothing that moves |

### Where the concepts sit relative to the code today

The four Level-1 stages do not map onto the four shipped acts. Mapping them
explicitly, because every estimate in §7 depends on it:

| Framework stage | Shipped act | Relationship |
|---|---|---|
| Single stand | Act 1 | Same thing. Ships. |
| Multiple stands | Act 2 (part) | Act 2 has the *capital* half and the *competition* half. It does not have multiple stands. |
| Retail | — | New. |
| IPO | Act 3 (part) | Act 3 has valuation, the multiple, the growth premium and comparison shopping. It does not have a listing. |
| **Level 2** | Act 4 | Ships, and is the reason the rest exists. |

So Level 1 is roughly "Acts 1–3, split into four, with a retail stage inserted
and the ending changed."

---

## 5. The Level 1 endpoint, and what unlocks Level 2

The framework asks for this to be defined *in gameplay terms*. It already is,
and this is the part of the shipped game that is ahead of the framework rather
than behind it.

**Today** two things gate Level 2, and they are deliberately different:

1. **The stage gate** — `act3Complete` = the buyout was accepted
   ([`act3Complete`](src/lib/progress.ts), as it then was). Progression.
2. **The readiness gate** — four demonstrated behaviours
   ([`readiness`](src/lib/progress.ts)). Until all four are met, Level 2
   is *read-only research*: real companies, real accounts, no money committed.
   - Stated their own margin unaided.
   - Held a strategy through a losing day.
   - Ranked two businesses by multiple correctly.
   - **Passed on a good business because the price was too high.**

Keep the readiness gate exactly as it is. It is the honest answer to "when is a
kid ready to invest," it is what makes the unlock feel earned, and no stage
ladder replaces it.

**Change the stage gate to the listing:**

> Level 1 is complete when the kid has priced their own company, chosen how much
> of it to sell, sold those shares, and seen their own share price move at least
> once.

That last clause is doing real work. Reaching an IPO teaches valuation. *Living
one week as a public company* teaches what a stock price is — and a kid who has
never watched their own price move has no business being handed eight real ones.

---

## 6. The vertical slice to test first

The framework says: pick one journey, specify it enough to find out whether the
loop is fun, before writing any spec. Stages 1 and 2 are already playable, so
the slice worth building next is the one nothing is known about:

**Slice: the listing week.** Starting state is a hand-authored save — a shop
doing ~$400 a week, growing, with a manager. Then:

1. A buyer offers 8× weekly profit for the whole thing. (Exists.)
2. A banker offers to sell *part* of it to the public at 11×, because the public
   pays more for growth than one buyer does.
3. The kid picks a percentage. The game shows, live: cash raised, ownership kept,
   and profit-per-week given up. Three numbers, one dial, no advice.
4. The company is cut into 1,000 shares. Price per share = value ÷ 1,000, shown
   as that division with their own numbers in it.
5. Shares sell. Cash lands. Ownership drops.
6. One week passes. Profit comes in above or below expectation, the multiple
   re-rates, and the price per share moves. The kid's remaining stake is worth
   more or less than it was, and the reason is on screen next to it.
7. The road unlocks Level 2, gated on readiness as before.

If step 3 is not a decision a twelve-year-old wants to think about for thirty
seconds, and step 6 does not make them want to run another week, the design is
wrong and no amount of developer spec fixes it. **Test that before building
Stages 2 and 3.**

---

## 7. What to build, in order

Ordered by learning value per unit of work, not by stage number.

### Tier 1 — closes the two missing concepts

1. **The equity slice becomes a dial.** `EQUITY_SLICE = 0.2`
   ([`createOwnershipState`](src/lib/ownership.ts)) becomes a range the kid picks
   from, with cash / ownership / weekly-profit-given-up updating live. Turns a
   card into a decision. Small change, large payoff.
2. **Shares and a share price for the kid's company.** A fixed share count,
   `price = value ÷ shares`, and `value = price × shares` shown as arithmetic.
   New pure module, mirroring [market.ts](src/lib/market.ts) so both sides of
   the bridge compute a price the same way.
3. **A share price that moves weekly, for a stated reason.** Profit vs
   expectation → re-rate → new price, with the cause on screen.
4. **The IPO-vs-buyout decision** replaces the bare buyout as the Level 1
   ending, with `act3Complete` re-pointed at the listing (§5).

### Tier 2 — closes the missing stages

5. **Multiple stands.** `BusinessState` grows a list of stands;
   [`moveTo`](src/lib/business.ts) becomes `openStand`; per-stand
   demand with crowd-splitting; one close screen showing every stand.
6. **Retail.** A location with a large fixed rent and a weather floor. This is
   where operating leverage stops being a word in the glossary and starts being
   a bad week the kid remembers.
7. **Marketing as a weekly spend** with diminishing returns, and a glossary word
   behind it.
8. **A loan**, so "debt or equity" is a decision and not a lecture. Weekly
   repayment, owed regardless.

### Tier 3 — the frame around it

9. **Company value as a live headline** from Stage 2 on, so the IPO is a finish
   line the kid was already running towards.
10. **Five stops on the road.** `Act` widens past `1|2|3|4`
    ([`Act`](src/lib/progress.ts)), `STOPS` gains a stage
    ([journey.ts](src/lib/journey.ts)), `SAVE_VERSION` bumps with a migration for
    saves in the old Act 3.
11. **New words:** shares, stock price, market cap, going public, marketing,
    interest. Same rule as every other word — after the experience, never
    before ([PRODUCT.md §4](PRODUCT.md)).
12. **Parent view** gains the listing: what the kid priced their company at,
    what fraction they sold, and whether they held through their own first
    drawdown ([parent.ts](src/lib/parent.ts)).

---

## 8. Open questions for the customer

Four places where the framework is genuinely ambiguous and the answer changes
what gets built.

1. **Does the buyout survive?** Recommendation: yes, as the *other* option at
   the listing. "Sell all of it to one person at 8×, or a third of it to
   thousands of people at 11×" is the single best decision in the game and it is
   how going public actually differs from selling up. If the buyout is cut, we
   lose the arithmetic bridge in [PRODUCT.md §9](PRODUCT.md) that Level 2 stands on.

2. **How long is Level 1 now?** Today it is one sitting: seven days, then
   fourteen, then an exit ([ECON.TOTAL_DAYS](src/lib/simulation.ts),
   [`ACT2_DAYS`](src/lib/business.ts)). Four stages plus a public week is
   plausibly two to three sittings. That is a retention *feature* if the road
   makes it legible and a churn *risk* if the ending recedes as the kid walks
   towards it. Needs a number before Tier 2 is built.

3. **Does "Retail" mean a shop, or a second kind of product?** This document
   assumes a shop — one location, fixed rent, weatherproof — because that is
   what teaches operating leverage. If the intent was a product line (bottles on
   a supermarket shelf, wholesale margin, a buyer who is a business rather than a
   person), that is a different and also good stage, and it teaches different
   things.

4. **Is Level 2 still the same Act 4?** Nothing in the framework contradicts the
   shipped market, the readiness gate, or the live weekly mode
   ([PRODUCT.md §42](PRODUCT.md)). Confirming that keeps this a Level 1 change
   and keeps the largest tested surface in the repo untouched.

---

## 9. What this document does not change

- Every non-negotiable in [PRODUCT.md §4](PRODUCT.md). No quizzes, vocabulary
  after experience, no concept before its wall, numbers always real and always
  the kid's own, never project demand.
- The Act 1 constants in [PRODUCT.md §11](PRODUCT.md). The $1.60 optimum is
  load-bearing and tested; nothing here touches it.
- The readiness gate (§5).
- Act 4 / Level 2, pending question 4.
- Privacy: no accounts, no backend, no analytics
  ([PRIVACY.md](PRIVACY.md)). An IPO is arithmetic, not a server.

---

## 10. What shipped

Written after building it. §2–§9 above are the analysis; this is the outcome.

### The stage ladder

| Framework stage | Shipped as | How it ends |
|---|---|---|
| Single Stand | **Act 1 — One stand** | Seven days, and a chart of their own price against profit |
| Multiple Stands | **Act 2 — More stands** | Two pitches, one price, both paying for two days ([business.ts](src/lib/business.ts)) |
| Retail | **Act 3 — The shop** | Five good days with the door open ([retail.ts](src/lib/retail.ts)) |
| IPO | **Act 4 — Go public** | Listed, and one week lived through it ([listing.ts](src/lib/listing.ts)) |
| — (Level 2) | **Act 5 — Markets** | Unchanged. Twelve weeks, then the live market with no last week. |

### The twelve concepts

All twelve have a mechanic now. The four that did not:

| Concept | Was | Is |
|---|---|---|
| **shares** | Missing | The company cut into 1,000 pieces, some of them sold, at a price the kid divided out themselves |
| **stock price** | Missing | `value / shares` on their own company, then re-rated once a week against what the market expected — with both causes printed |
| **marketing** | A one-off sign with no word behind it | Same sign, and the word arrives with the number of extra people it put in front of the stand |
| **ownership** | A fixed 20% on a card | A dial, twice: the investor's slice in Act 3 and the float in Act 4, each with cash-today against profit-given-up-forever |

### The four open questions, answered

1. **Does the buyout survive?** Yes, as the other half of the listing decision.
   Sell the lot to one buyer at 8x, or a slice to a thousand people at 11x. Both
   endings are supported end to end, including the finale, the parent report and
   what the market gets seeded with.
2. **How long is Level 1?** Act 2 runs to 16 days and Act 3 to 6, both with a
   condition that ends them sooner and a clock that ends them regardless — an
   arc with only one exit is an arc somebody gets stuck in. Walked by a player
   who buys nothing: reachable, and the fallbacks fire.

   Worst case is **36 days**: 7 + 16 + 6 + a week lived through as a listed
   company. It was 42 when this section was first written, and the caps were
   cut after the customer read "Start day 41" off a sweep and asked whether
   forty days was a long time to spend before the part the game is actually
   about. See §11 — the cut was measured against the vocabulary rather than
   guessed, and one of the two proposed cuts was reverted for costing a word.
3. **Does "Retail" mean a shop?** A shop. One location, a fit-out paid once, a
   rent owed on the day nobody comes, staff at a wage, and a demand floor under
   the weather — which is the mechanic that makes the rent worth owing.
4. **Is Level 2 still the same Act 4?** Yes, and it is Act 5 now. The market,
   the live weekly account, the club, the playbook, the thesis engine, the
   reckoning and seasons are all untouched apart from the gate number.

### The Level 1 endpoint

As proposed in §5, and both halves matter:

> Level 1 is complete when the kid has priced their own company, chosen how much
> of it to sell, sold those shares, and **seen their own share price move at
> least once**.

The readiness gate is unchanged: four demonstrated behaviours, and the market
stays read-only research until all four are met.

### What it cost

Eleven defects in existing code, every one found by playing it in a browser on a
phone-sized viewport rather than by reading it. `PRODUCT.md §44` lists them. The
two worth repeating here because they are the kind that survive a green test
suite:

- The badge toast's transparent padding was **swallowing taps** on the primary
  button underneath it. Visually clear, functionally dead, invisible in a
  screenshot — only hit-testing finds it.
- The parent report described **a sale that never happened**, because the public
  float was written into the field that means "the slice the investor bought".
  In the one screen whose entire job is to be trustworthy.

`tests/reachable.test.ts` exists because of a third: restructuring the arc made
a badge unearnable and nothing noticed. It now asserts the property rather than
the instance — every badge has some reachable state that earns it.

---

## 11. Checking §10's claims, rather than trusting them

§10 was written the day the ladder shipped. This section is a later audit of
whether it is still true, prompted by the customer asking exactly that. The
short answer is yes on substance — every stage, every concept and the Level 1
endpoint hold up — with one stale number, now corrected above, and one class
of claim that had never been tested at all.

### The stage ladder

Four framework stages, four shipped acts, each with a real end condition in
code: `ECON.TOTAL_DAYS` (7), `ACT2_DAYS` (16), `ACT3_DAYS` (6), and a listing
that ends only once a week has been lived through as a public company. All
four transitions are walked end to end by `tests/arc.test.ts`, including the
two fallbacks and both endings — sold to one buyer, or floated.

### The twelve concepts

All twelve still have a glossary word behind them. Five are taught under a
name a nine-year-old can use rather than the framework's own term, and that
mapping had only ever existed in this document's prose:

| Framework concept | Taught as |
|---|---|
| capital | `capex-vs-opex`, `return-on-cash` |
| value | `market-cap`, `multiple` |
| ownership | `equity`, `going-public` |
| growth | `compounding`, `operating-leverage` |
| stock price | `share-price` |

`tests/frameworkwords.test.ts` now asserts that mapping, so renaming a
glossary id cannot quietly disconnect a framework concept from the word that
teaches it.

### The claim that had never been tested

`wordsreachable.test.ts` proves every Act 1–3 word has a state that produces
it. It says plainly why it stops there — Acts 4 and 5 "earn their words from
the listing, the buyout, the thesis and the market — none of which run a day —
and those are covered where they happen."

They were not. Of the twelve Act 4/5 words, **`going-public` and `market-cap`
were produced in `listing.ts` and named by no test anywhere.** That is the
same signature as the `unit-cost` defect in PRODUCT.md §53: a full glossary
entry, counted in the total a child is shown, with a reader and no proof its
producer ever fires.

This matters more here than anywhere else in the glossary, because §2 of this
document argues that **shares** and **stock price** are "the two that the whole
product is pointing at" — the seam where a kid stops meeting share prices only
on Apple and gets one of their own. The claim that the seam is closed rested
on two untested words either side of it.

Neither was broken. Both fire, from a company really taken public. That is the
point: *"nothing asserts it"* and *"it does not work"* are indistinguishable
from outside, and only one of them is acceptable in the concepts the product
exists to teach. Six tests now cover it, including that the listing words
survive `markListedWeek` — the event that satisfies the Level 1 endpoint — and
that none of them arrive before the company is listed.

### The stale number

§10 answer 2 said Act 3 runs to 12 days. It runs to 6. The cut came out of the
customer reading "Start day 41" off a sweep and asking whether forty days was
a long time to spend before the part the game is about — a fair question, and
the honest answer was no.

Worth recording *how* it was cut, because the instruction was to tighten "as
much as possible without compromising on learning" and those pull against each
other. `WORDS_PER_DAY` is 1, so days are a hard ceiling on vocabulary: cutting
a cap can only be free if the words still land. Measured by replaying the
ladder ten times at two skill levels and diffing the words delivered:

- **Act 3, 12 → 6.** Worst measured run is 5 days at both skill levels, and
  the words delivered are byte-identical at every cap down to 5. Free.
- **Act 2, 16 → 13.** Not free. It costs careless players `delegation`.
  **Reverted to 16.**

A tightening that costs a word is not a tightening, and the second one was
only caught by measuring instead of reasoning about it. PRODUCT.md §51 has the
tables.

### What this audit did not check

Two of §10's claims are still taken on the word of the browser playthrough
that produced them, because no automated check can hold them:

- that the arc *reads* as four stages to a child, rather than as one stand
  with three sets of extra buttons;
- that an hour is the right length. 36 days is measured; whether 36 days is
  **fun** is not the kind of thing a test knows, and §41 records that the one
  piece of real pacing feedback the project has came from a parent, not a
  spreadsheet.

---

## 12. The shipped game against the refinement

§1's refinement arrived after §10 shipped, so it is a second, sharper ruler
held against the same build. It mostly matches, and where it does not it is
worth being precise about which one is wrong.

### The two loops

Both are in the game, and the second one is the reason the first has a fifth
beat.

| Beat | Where it lives |
|---|---|
| **Make** | `batchPlan` and the shopping list — a batch size the kid slides, with the receipt itemised |
| **Price** | `PriceScreen`, where the dial and the consequence share a screen (`PRODUCT.md §4`) |
| **Sell** | `runDay`, watched rather than skipped, one passer-by at a time |
| **Decide** | `CloseScreen` — what happened, why, and what it means for tomorrow |
| **Grow** | `InvestScreen` — the yard. Kit, crew, pitches, another stand, a shop |

The progression loop is the ladder itself: `act1Complete` → `act2Complete` →
`act3Complete` → `act4Complete`, each with a real condition and a clock behind
it. **Improve → Unlock greater complexity** is not a metaphor here — it is the
readiness gate, four demonstrated behaviours (`progress.ts`), and the market
stays read-only research until all four are met.

One honest note on **Grow**: it is the fifth beat of the loop but not of every
turn. Act 1 has no yard, deliberately — a kid who can buy a cooler on day two
has not yet had to find a price. Growth arrives as the beat that opens Stage 2,
which is exactly what the refinement's "natural unlock" column says should
happen.

### Player identity

Not a mechanic, so not testable, but it is *stated* rather than implied —
`ACT_TITLES` carries a name and a promise per stage, and the arc gives the kid
a different thing to be at each rung:

| Refinement | Shipped as |
|---|---|
| Owner/operator | **One stand** — "Find the price that actually makes money." |
| Business builder | **More stands** — "Spend money to make money. Then be in two places at once." |
| Founder/CEO | **The shop** — a fit-out, a rent, staff at a wage |
| CEO + shareholder | **Go public**, then **Markets** — the float carries into the market, so a kid who stayed a founder invests *as* one |

That last one is the refinement's sharpest observation and the game already
turns on it: `beginAct5` carries the float across, so an Act 5 kid holds
shares in their own company while buying shares in Apple. §10 records the same
thing from the other direction — the parent report and the market seed both
support either ending.

### Central question

The game asks a question per stage already, in `ACT_TITLES[act].question`, and
it is kid-facing rather than a design note:

| Refinement asks | The game asks a child |
|---|---|
| Can I make money? | *What is a cup worth to them?* |
| Can I grow profitably? | *How do I sell more than my own two hands can?* |
| How do I finance and manage growth? | *What do I owe on a day nobody comes?* |
| What is my company worth, and what does ownership mean in a public company? | *What is one piece of my company worth?* |

All four are the same question in a nine-year-old's words, **including Stage
3** — which this section originally got wrong, and the customer corrected:

> *"well both no, one uses a more grown up language, the other is a
> child-friendly language. so its the same just from different perspectives?"*

That is right, and the code is explicit about it. `curriculum.ts` says the
child's version *is* the grown-up stage restated — "the child gets
`ACT_TITLES[act].question`, which is the same stage asked as a question worth
answering" — and every act carries both registers deliberately: `question` for
the kid, `grownUpConcept` and `grownUpWhy` for the adult.

Act 3's grown-up register is the refinement's question almost word for word:

| | |
|---|---|
| Refinement | *How do I finance and manage growth?* |
| `grownUpConcept` | Fixed costs, operating leverage, **debt against equity** |
| `grownUpWhy` | "...the first thing they cannot buy out of profit, which is where **borrowing and selling a slice become two real answers**." |
| `question` (kid) | *What do I owe on a day nobody comes?* |

"Manage growth" is the fixed cost the child feels; "finance growth" is the
three-way funding screen, named in the adult line. Both halves are in the
stage, in the register each audience reads.

The error was comparing a grown-up-register question against a child-register
one and calling the difference a design gap. There was nothing to reconcile —
which makes this the fourth instance of the pattern §12 closes with, and the
first where the wrong claim was in this document rather than in the code.

### Core concepts, stage by stage

All twelve concepts exist (§11 proves each has a reachable word). Where the
refinement and the build disagree is on *which stage* teaches two of them:

| Concept | Refinement puts it | Game teaches it |
|---|---|---|
| **margin** | Stage 2 | Act 1 |
| **growth** (`compounding`) | Stage 3 | Act 2 |

Both are taught **earlier** than the refinement asks, and neither looks like a
mistake. Margin is the number a price is chosen against, so a kid who sets a
price on day one has already met it — deferring the word by a whole stage would
mean withholding the name of something they had been doing all week.
`compounding` needs eight days of history and a business that reinvested, which
is Act 2's shape, not Act 3's.

No concept is taught later than the refinement asks, which is the direction
that would actually cost something.

### What the refinement found

Holding the new ruler against the build turned up one real, child-visible
defect, in the row where the refinement is most emphatic — **ownership/equity
belongs to Stage 3**.

The game agreed in its gameplay and disagreed in its data. `equity` is awarded
by `equityInsight` from the shop's funding screen, which is Act 3. The glossary
entry was tagged `act: 4`. The trophy case prints `Act {word.act}` against
every word, so a child who had just sold a slice to fund their shop saw the
word they had earned **filed under a stage they had not reached** — and
`wordsByAct` counted it against Act 4, leaving Act 3 reading two words when it
teaches three.

`interest` — taught by the *borrow* option on that same screen, in the same
decision — was already tagged 3. Only `equity` said 4. And §10 of this document
had said the right thing in prose all along: "the investor's slice in Act 3 and
the float in Act 4". The document was right and the data was wrong.

Retagged to 3. The fix moved the word into `wordsreachable.test.ts`'s remit —
Acts 1 to 3 — where it promptly failed, correctly, because `equity` comes from
a named producer rather than a day deriver. It is now collected there the same
way `recurring-revenue` is, so the word is proven earnable at the stage it is
now labelled.

Worth naming the shape: this is the third instance of a **claim living in prose
and contradicted by data**, after §11's stale day count and the concept mapping
that existed only in this document until `frameworkwords.test.ts` asserted it.
A document that describes the build is only as good as the checks that keep it
honest.

---

## 13. Two research questions: the clock, and the rule of three

Both came from the customer, and both are asked as questions rather than
asserted — which is the right instinct, because one of them is a real
principle wearing a wrong number, and the other is a real principle about
something other than what it is usually quoted about.

### "A Clash Royale match is about two minutes. Is that a design principle?"

**The principle is real. The number is not the principle.**

What is solidly established is narrower and older than any particular game:
flow states require *immediate, unambiguous feedback*, and formative feedback
is among the largest single effects in the learning-research literature. The
claim worth defending is **the consequence arrives while the decision is still
in mind** — not any specific duration.

The two-to-three minute figure in Clash Royale and Clash of Clans is a
*session-length* decision, driven by things that have nothing to do with
cognition: matchmaking queues, a commute, a bus stop, the length of time a
phone is out of a pocket. Useful to copy, but copy it for the right reason.

The more transferable observation is that those games run **two nested loops**,
which is exactly the structure §1's refinement describes:

| | Clash Royale | lemonade |
|---|---|---|
| Decision cadence | seconds — elixir ticks, a card is played or held | the price dial, the batch slider |
| Feedback unit | the match, a few minutes | **the day** |
| Progression unit | the ladder, weeks | the stage, and the arc |

The mistake would be to read "two minutes" as applying to the *progression*
loop. It applies to the feedback unit. In this game that unit is the day —
plan, price, watch, and a close screen carrying the P&L and up to one new word
— and a stage is an hour, which is the right length for a stage and would be
absurd for a feedback loop.

**Measured.** The only part of a day the code controls is the watched portion;
the rest is a child reading, which no test can time.

| Crowd | Watched day |
|---|---|
| 10 | 4.7s |
| 37–109 | 13.5s |
| 150 | 13.5s |
| 284 (the biggest the simulation produces) | 13.5s |

The right-hand column is flat, and it had to be fixed to become flat. It read
4.7 / 13.5 / **18.0** / **32.7** — because the per-customer legibility floor
(`MIN_TICK_MS`) stretched the day instead of being absorbed, so past about a
hundred customers the arithmetic stopped fitting. `RunDayScreen`'s own comment
promised "roughly ten seconds regardless of how big the crowd is" and had been
wrong by two and a half times, on the screen the same file calls "the signature
moment of the product".

Worse, it went wrong in the direction that punishes engagement: the 284-customer
day is a loaded late-game business selling at 25c — the cheap price an
experimenting child tries first, on their best day. The fix divides a large
crowd into groups and walks a whole group on per tick, so the day stays bounded
and a sprite stays legible. `tests/pacing.test.ts` holds it, across every crowd
size the simulation can produce.

**What is still a risk.** Act 2 runs to 16 days, so its *stage* reward is a
long way off. Two things stand between that and boredom, and they were designed
for it: a word a day (§26), and the reinvest-or-take-it-out fork every seventh
day. Whether that is enough is not a question measurement can answer.

### "Human brains can't handle more than three things — but Clash Royale shows me dozens?"

**The scepticism is correct, and the observation is the answer.**

Three things are being conflated:

1. **The rule of three** is a rhetorical and marketing device — a tricolon.
   It is about *memorability and persuasion in a message*. It is real, and it
   is about copywriting, not comprehension capacity.
2. **Miller (1956)**, "the magical number seven, plus or minus two", is the
   cognitive claim usually being reached for. It is about *chunks* held in
   working memory, and the number is seven, not three.
3. **Cowan (2001)** revised the practical working-memory limit down to about
   **four** chunks. Still not three.

So no serious version of the claim says three, and none of them says anything
at all about how many objects may be *on a screen*.

The Clash Royale observation is exactly right and resolves it: that screen
holds two towers, a river, dozens of troops, an elixir bar, a timer and a
trophy count — and **the hand is four cards.** The information set is huge; the
*decision set* is four. What has to be bounded is the number of choices in
front of a player at the moment they choose, not the number of things drawn.

The other half is **chunking and progressive disclosure**: Clash Royale has
over a hundred cards, a deck is eight, a hand is four, and the hundred are
learned over months. A chunk can contain arbitrarily much once it has been
learned — which is why "how many things" is the wrong question and "how many
*decisions*" is the right one.

**Measured, for this game.** Counting decisions, not drawn elements — and a
dial is one decision however many stops it has, which is why the price slider
counts as one and not as a continuum:

| Screen | Simultaneous decisions |
|---|---|
| Price | 1 dial |
| Batch / shopping list | 1 dial |
| Shop funding | **3** — pay cash, borrow, sell a slice |
| Deal board | **3** stands to rank |
| Investor's slice | 1 dial, 5 stops |
| The float | 1 dial, 9 stops |
| The market | **8** companies at tier 1, of 24 in the data |
| The yard | 10 plots, in **4 groups**: pitch (2), kit (3), crew (2), site (3) |

Every one lands at four or fewer, on the measure that matters. The yard is the
only screen that shows ten of anything, and it shows them as four labelled
groups of two or three — which is chunking, done by hand, before anyone went
looking for a principle to justify it. The market is the clearest case of
progressive disclosure in the product: a child meets eight companies, not
twenty-four, and the other sixteen arrive by tier.

**One thing this found.** The single place the codebase asserted a "three" was
stale. `InvestScreen` carried a comment reading *"Three numbers, and they are
the three that decide everything"* directly above code that renders two chips —
a superseded comment sitting beside the change that superseded it, which is the
same class as everything in §12. Removed, with the history kept.

### What neither of these settles

**No child has played this.** Everything above is design reasoning plus
measurement of the build, and measurement can only ever say that the day is
bounded at 13.5 seconds and the yard is four chunks. Whether a nine-year-old
finds the day satisfying and the yard legible is the one question that needs a
nine-year-old, and `PITCH.md` is right to list it as the single biggest open
risk.

---

## 14. Stage 1 against its own specification

§1's Stage 1 table is the most specific thing this document has ever been given
— nineteen rows, most of them checkable. Checked one at a time against the
build, thirteen hold and six do not, and the six are not a scattering of
polish. They are one coherent piece of the design that was never built.

### What holds

| Row | Where it lives |
|---|---|
| **Lever 2: Selling Price** | The price dial, and it is the first decision in the game |
| **Core loop** | plan → price → run → close, and **Replay** is the rehearsal button — "try it on yesterday's crowd" |
| **Hero feedback** | Revenue and Profit, the two largest numbers on the close screen |
| **Supporting feedback** | Total cost and selling price, itemised on the receipt |
| **Visual feedback** | Real sprites walk up, read the real sign, and buy or keep walking. One sprite per simulated customer, never decorative |
| **Failure model** | Explicitly no harsh failure: the cash box is topped up to the floor with the top-up shown as its own line, and the screen says "you never go below $20, so there is always a tomorrow" |
| **Opening** | No target — see below, because this one holds by accident |
| **Next unlock** | Multiple Stands, as Act 2 |

The visual-feedback row is worth singling out because it is the row most
products fake. Every walking figure is one customer from the simulation, and
the counters are that day's real result arriving in real time.

### What does not

**1. There is no product or cost lever.** The specification asks for two or
three choices — organic versus regular, fresh versus store-bought, bulk versus
day-by-day. Act 1 has one lever besides price: how many cups to make.
`freshSqueeze` exists, and it is an **Act 2** upgrade, so the one quality choice
in the game arrives a whole stage after the stage that is supposed to teach it.

**2. There is no quality at all in Act 1's demand.** `DEFAULT_DAY_PARAMS`
carries `demandIntercept`, `demandSlope`, `demandMultiplier`, `fixedCosts`,
`serviceCapacity`, `marketShare`, `equityShare`, `subscribers`,
`subscriberDiscount` and `indoorShare`. There is no quality term. So "willingness
to pay depends partly on product quality" — half of the stage's stated learning
goal — has no mechanic behind it.

**3. There is no bulk-purchase lesson.** Measured, at $1.50 a cup:

| Cups | Total cost | Cost per cup |
|---|---|---|
| 8 | $1.70 | $0.2125 |
| 20 | $3.90 | $0.1950 |
| 40 | $7.80 | $0.1950 |
| 80 | $15.60 | $0.1950 |

Flat from twenty cups upward. The higher figure at eight cups is not a volume
discount working in reverse — it is pack lumpiness, because lemons and sugar
come in whole units and a small batch wastes part of one. A child cannot
discover "bigger orders make each cup cheaper" here, because it is not true.

**4. Weather is in Stage 1, and the specification says it should not be.** The
demand system is meant to be "driven only by price + quality at this stage. No
weather, competition, location." Act 1 has a forecast on the planning screen,
weather art on every screen, and a close screen that opens with "it turned out
cool". This is the one divergence where the build is *more* complex than asked
rather than less, and it is load-bearing elsewhere: the Same-Sky Challenge
exists because two children get identical weather so the whole difference is
decisions, and `signal-vs-noise` and `demand-bet` are Act 1 words that only
mean anything because the weather can betray a good plan.

So this one is a real conflict rather than a gap, and it is the customer's call.
Removing weather from Stage 1 would cost two words, the forecast, and the
premise of the challenge feature.

**5. There is no profit target, and therefore no challenge.** This is the big
one. The specification asks for a clear objective, introduced after one or two
exploratory rounds. The build has:

- a goal strip reading `N days left · $33.40 of $20.00 start` — a clock and a
  comparison, not a target;
- `act1Complete`, which is `stand.history.length >= 7`.

Seven days pass and the stage ends. Nothing is aimed at, nothing is hit, and
nothing is missed. The **Opening** row holds only because there is never a
target to withhold, which means the "1–2 exploratory rounds" are indistinguishable
from the other five.

**6. The unlock is not "hit the profit goal in two separate rounds".** It is
"seven days elapsed". There is no repetition requirement, so the **Desired
feeling** — Experiment → Notice patterns → Optimize → Challenge → Mastery —
stops after the third arrow. Experimenting, noticing and optimising are all
supported. Challenge and mastery have nothing to attach to.

### Why this is the same finding as the onboarding problem

The customer's report was *"i think the onboarding experience is a broader
symptom of me just being confused on how to play the game"*, and PRODUCT.md §57
records the structural cause on the interaction side: day one is three guided
screens and day two is a scene made of hotspots.

Gap 5 is the same complaint on the *goal* side. A child who does not know what
they are trying to achieve cannot tell whether what they just did was good.
Seven days of sandbox with a clock is not a level; it is a toy with a timer.
The spotlight tour now teaches *how to press things* — it cannot teach what to
press them **for**, because the game does not currently say.

That is why these six gaps are one piece and not six. Quality gives the
product lever something to trade against price, bulk gives the batch slider a
reason to be interesting above "enough", and the profit target gives all of it
a scoreboard. Built separately they are three features; built together they are
Stage 1 as specified.

### The one deliberate divergence

**Diagnostic feedback** is not missing — it was decided against. The
specification asks for "Customers liked the quality, but your price was too
high." `guide.ts`'s `closingLine` is explicit in its own comment:

> Observation only, and never the profit on its own — that number is already
> the largest thing on the screen, and repeating it would make Pip a substitute
> for the ledger rather than a door into it.

So Pip names a *line of the statement* with its real number — "nobody bought a
cup at $3.00; the stand still cost you $5.00" — and lets the child draw the
conclusion. The reasoning is that a duck who says "your price was too high"
teaches the child to read the duck, and a duck who says "nobody bought a cup at
$3.00" teaches them to read the day.

Both positions are defensible and this is a real fork, not an oversight.
Flagged rather than changed.

### What implementing the six would cost

Not offered as an argument against, only as the honest price. This is not a
copy change:

- **The word budget.** `WORDS_PER_DAY` is 1 and Act 1 owns ten words across
  seven days. A quality lever wants a word; so does bulk. There is room for
  two, and `tests/wordbudget.test.ts` is what would say so.
- **Every economic invariant.** `tests/pnl.test.ts` holds twenty-odd identities
  and `tests/fuzz.test.ts` nine, several of which — margin never above price,
  ingredients summing to the total, per-cup display reconciling — are stated in
  terms of a single ingredient cost per cup. Quality tiers and bulk pricing both
  change that arithmetic.
- **The arc.** `tests/arc.test.ts` walks the whole ladder, and a profit target
  in Act 1 adds a gate that a careless player has to be able to pass — §51
  records that 5 of 10 careless runs already fail to finish Act 2's objective
  even at 16 days, and a target is only a challenge if failing it is survivable.
- **The pacing.** §11's measurement is against the current seven days. A target
  that must be hit twice may need more of them.

The right order is the specification's own: the levers first, because a target
with only one dial behind it is a guessing game, and the target last, once
there is something to optimise.

---

## 15. Building the six

§14 audited Stage 1 against §1's table and found six rows with no mechanic. All
six are now built, plus a tour per stage. §14 stays as written — it is the gap
analysis that justified the work, and rewriting it into the past tense would
destroy the only record of why.

### Lever 1 — the product

Three lemons: **cheap**, **normal**, **posh**. The row asked for "2–3 simple
choices such as organic vs. regular", and this is that axis. `fresh vs.
store-bought` was left alone deliberately, because `freshSqueeze` already owns
it in Act 2 and two mechanics for one idea is worse than one.

| | Cost per lemon | Demand |
|---|---|---|
| Cheap | ×0.6 | ×0.85 |
| Normal | ×1.0 | ×1.0 |
| Posh | ×1.8 | ×1.25 |

**Normal is exactly 1.0 on both axes, and it is the default for every caller
that does not choose.** That single decision is what let this land without
touching a single arithmetic identity: `tests/pnl.test.ts`'s twenty-odd
assertions and `tests/fuzz.test.ts`'s nine invariants all still pass untouched,
because a run that chooses nothing is bit-identical to the game as it was.
`tests/stage1.test.ts` asserts that identity directly, day for day.

The trade is real rather than a free win, which the row insists on — "highest
price or lowest cost isn't automatically best". Measured over the week:

| Recipe | Best day |
|---|---|
| Posh @ $2 | **$59** |
| Normal @ $2 | $49 |
| Cheap @ $1.50 | $46 |
| Cheap @ $2.50 | $25 |

Posh wins at $2 and loses at $0.75; cheap wins where the crowd is
price-sensitive and collapses at $2.50. A test asserts that no single grade wins
at every price, so a tuning pass cannot quietly make the decision a formality.

### The quality effect, and word of mouth

Demand answers to today's grade *and* yesterday's, half each. That is the
smallest mechanic that makes the row's second sentence true — "lower quality can
reduce demand over time" — and it means cheapening the recipe produces a
normal-ish day followed by a worse one, which is what a reputation is. Day one
has nothing to remember, so it is judged only on its own choice.

**The constraint that shaped this.** `buildCustomers` insists the number of
random draws depends "only on the weather and the day's parameters — never on
the price or the batch", because two children on one challenge code must get
the same week. Grade is a decision, so it had to land on the same side of that
line as price: it changes **who buys**, not **who walks past**. Three tests hold
it — same weather, same footfall, same seed carried into tomorrow, whatever the
recipe.

### Bulk

A dozen earns 10% off, two dozen 20%. Tiers rather than a curve because a child
has to be able to *see* the moment it gets cheaper, and a step at a round number
is findable by sliding a slider — twelve and twenty-four are also how lemons are
actually sold.

Both halves of the row are true: each one is cheaper **and** the total is
larger. And the counterweight was already in the game — a lemon lasts three
days, so buying two dozen for the discount and pouring eight of them is a loss
at the price actually paid. A test asserts over-buying still costs money, or
"always buy the maximum" would be the correct answer and the lesson would be a
discount rather than a trade.

**This was the invasive part.** Cost of goods sold used to be
`lemonsUsed × LEMON_COST` — a count times a constant. With grades and volume,
two lots bought on different days cost different amounts per lemon, and only the
pantry knows which ones were poured. So `LemonLot` now carries what was paid,
FIFO consumption reports what it spent, and `runDay` costs the day *after*
consuming rather than before. Spoilage is costed the same way. Without that the
receipt and the profit and loss would have disagreed, which is PRODUCT.md §4's
line in the sand.

### The challenge, and the two rounds

- Two exploratory days with no target at all. The goal strip says "Try things
  out. Nothing to hit yet."
- Then: **make $25 in a day, twice.** The strip names the figure, because a goal
  a child cannot restate is not a goal.
- $25 is measured, not guessed: across three grades and four prices, eleven of
  twelve strategies clear it twice and the twelfth clears it once.
- The seven-day clock stays as the fallback, exactly as it does for the two
  stages after this one. Stage 1's failure model is "no harsh failure", and an
  arc with one exit is an arc somebody gets stuck in. A test plays badly on
  purpose and checks the clock still releases them.

**A bug worth recording.** The first version counted hits across the whole
history, so a child whose two exploratory days both happened to clear $25 would
complete the stage on day two — **the challenge won before it was set.** Hits
are now counted from after the exploration window, and a test plays two good
exploratory days and asserts the count is still zero.

**What it cost, and what it did not.** Competent play now finishes Stage 1 in
four or five days instead of seven. That looked like it would cost vocabulary —
§51's rule is that a tightening which costs a word is not a tightening — but
`deriveInsights` runs on *every* day regardless of stage, so Act 1's words keep
arriving during Act 2. `tests/wordbudget.test.ts` and `tests/arc.test.ts` both
pass unchanged. Nothing is lost; some of it arrives later.

Two words were added for the two new mechanics, `quality` and `bulk-discount`,
which took the glossary from 34 to 36. `tests/wordsreachable.test.ts` failed
until its fixture swept grades as well as prices — correctly, which is what that
file is for.

### The weather row, not built

§1 says Stage 1's demand should be "driven only by price + quality at this
stage. No weather, competition, location." **Weather is still there, and that is
a decision rather than an omission.**

Removing it would cost: the forecast, the weather art, two Act 1 words
(`signal-vs-noise` and `demand-bet`, both of which exist because a good plan can
be betrayed by a cold day), and the premise of the Same-Sky Challenge — whose
entire claim is that two children get identical weather so the whole difference
is decisions.

The row is the one place the build is deliberately *more* complex than the
specification asks. Flagged rather than actioned, and it is the customer's call.

### Onboarding, every stage

The customer asked whether the tour covered new mechanics at every stage or only
the first, and the answer at the time was four of five. There are now five:

| Stage | Tour | Points at |
|---|---|---|
| 1 — One stand | `the-stand` | The sign, the lemons, the free rehearsal |
| 2 — More stands | `the-yard` | Buy-once kit, people paid daily, a second pitch |
| 3 — The shop | `the-funding` | Pay cash, borrow, sell a slice |
| 4 — Go public | `the-listing` | The float dial, and the single-buyer alternative |
| 5 — Markets | `the-market` | A real company's card, and the gate that opened it |

Act 4 was the one with none, and it is the least familiar screen in the game —
cutting a company into a thousand pieces has no real-world shape a nine-year-old
has met. A test now asserts **every stage has a tour**, so adding a sixth fails
rather than shipping a room nobody explains. Three steps maximum each, for §13's
reason.
