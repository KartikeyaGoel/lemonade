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

Three of four are the same question in a nine-year-old's words. **Stage 3 is
not.** The refinement leads with financing; the game leads with fixed costs.

Both are in the stage — Act 3's `grownUpConcept` is "Fixed costs, operating
leverage, debt against equity", and the shop's funding screen is a real
three-way decision between cash, a loan and an investor's slice. So nothing is
missing. But the *headline* differs, and the game's choice is deliberate and
worth defending: a rent owed on a day nobody comes is the thing that makes
financing matter. Ask a child how to finance growth before they have felt a
fixed cost and the question has no weight behind it. Financing is the second
beat of Stage 3 because the first beat is what creates the need for it.

Flagged rather than changed, because it is a judgement call the customer may
want to overrule.

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
