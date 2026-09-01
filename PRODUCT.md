# Lemonade — product spec

Read this before writing code. It is the source of truth for what we are
building and why. If a request conflicts with **Non-negotiables**, say so
instead of quietly complying.

---

## 1. The one-line version

A browser game where a kid builds, scales, and sells a lemonade stand, and in
doing so learns what a business is, what profit is, what a share of a business
is worth, and why anyone would buy one. Then they take the proceeds and invest
in the real stock market with simulated money.

The thesis the entire product hangs on: **every stock is somebody else's
lemonade stand.** A kid who has priced lemons, watched customers walk away
from a $3 cup, hired a manager, been undercut by a rival, and been offered a
buyout for eight times their weekly profit already understands revenue,
margin, elasticity, competition, dividends and valuation multiples. They just
don't know the words yet. Handing them the words is the easy part.

## 2. Who this is for

The user is a middle schooler, roughly 10 to 14. The buyer is their parent.

Financial education for kids comes in two flavours and both are bad for
opposite reasons. **Content** — videos, quizzes, streaks, badges (Greenlight,
Zogo) — is boring for structural reasons: those companies earn on interchange
or bank partnerships, so the learning layer is customer acquisition, and
nobody there is measured on whether a kid wants to open it. **Games** — the
dozens of Roblox lemonade tycoons with tens of millions of plays — are
genuinely fun and teach nothing, because they have no reason to name what the
kid is doing or connect it to how real markets work.

We are the third thing: a game good enough that the kid chooses it over the
free alternatives, with the learning load-bearing rather than bolted on, and a
parent-facing view that makes the value legible to the person paying.

The parent is not buying a game. They are buying evidence that their kid
understands money. Design accordingly.

## 3. The bar we are actually held to

Not "did they finish." The two questions:

1. **Does a real middle schooler open it a second time without being asked?**
   If they don't, the loop is not fun and no amount of learning design fixes
   it.
2. **Could this kid look at a real company and reason about it without getting
   taken?** If not, we have built a toy that flatters us.

Engagement is not the opposite of rigour here — it is the *delivery mechanism*
for rigour. A kid who quits learns nothing. A kid who is entertained but never
challenged learns nothing either. Both failures are equally fatal.

## 4. Non-negotiables

Design constraints, not preferences. Violating any of them breaks the product.

**No quizzes. No lessons. No explainer videos. No text walls.** If the kid can
skip it, it isn't teaching. Every concept is learned by making a decision with
consequences.

**Vocabulary comes after the experience, never before.** The kid discovers
that raising the price loses customers. *Later*, the game tells them that
thing has a name. The word is a reward for competence already earned, never a
gate in front of it.

**No concept before the wall that motivates it.** Don't teach margin on day
one. Wait until they are selling a hundred cups and still not getting richer,
then let margin be the thing that explains it.

**Numbers on screen are always real and always the kid's own.** No fake
dashboards, no mocked charts, no invented statistics. Any two figures shown
together must reconcile with the third on paper. If we show cost per cup and
price, their difference *must* equal the margin we print.

**Simplicity in the interface, never in the concepts.** The on-ramp is
Minecraft: you spawn and punch a tree, nobody explains anything. The ceiling
is also Minecraft: redstone. Reduce taps, defaults, and screens
aggressively. Never reduce the rigour of what is being taught. When those
conflict, add progressive disclosure, not simplification.

**The kid must be able to fiddle.** Dials and their consequences live on the
same screen, updating live, so a kid can form a hypothesis, commit, and see
the result. A one-way wizard with a single confirm at the end is not a
feedback loop.

**Never project the answer.** The game may show anything the kid could work
out for themselves (cost, margin, break-even, scenarios). It must never
project demand, or the discovery collapses into reading a slider.

**Progression is monotonic — until Act 4.** Bad decisions cost potential
gains, not accumulated ones. Cap downside hard, because a kid who loses
progress quits. **Act 4 deliberately breaks this**, for reasons in §8.

**Every session has a finishable arc.** A day of business resolves in two to
four minutes. The kid puts it down feeling done, not interrupted.

**Real money is never involved.** Simulated portfolio, real price data.

## 5. Concept to mechanic map

If a concept has no mechanic, it does not go in the game.

| Concept | The mechanic that teaches it | Act |
|---|---|---|
| Revenue | Cups sold times price. Shown as that multiplication, not a total. | 1 |
| Unit cost | Lemons, sugar, cups bought in units; per-cup cost derived and displayed | 1 |
| Gross margin | Price minus unit cost, per cup, live on the dial | 1 |
| Fixed costs | A daily stand fee that doesn't scale with volume | 1 |
| Break-even | Cups you must sell to cover the fee at this margin | 1 |
| Profit | The single number the day resolves to | 1 |
| Price elasticity | Raise price, watch customers visibly walk past | 1 |
| Variance vs signal | Weather swings demand; one bad day means nothing, seven mean something | 1 |
| Calibration | Batch size is a bet on demand; the game scores the bet | 1 |
| Inventory & spoilage | Lemons expire after three days; over-buying destroys money | 1 |
| Capex vs opex | A cooler costs once and raises capacity; a helper costs every day | 2 |
| Operating leverage | The same fixed cost spread over more cups | 2 |
| Competition & moat | A rival stand opens and undercuts. Price is not the only lever. | 2 |
| Differentiation | Quality and location let you hold a higher price than the rival | 2 |
| Reinvest vs cash out | Weekly: pull profit to savings, or buy capacity. Compounding is felt. | 2 |
| Dividends | Hire a manager; the stand pays you daily while you do something else | 2 |
| Equity & dilution | Cash today for 20% of future profit. Then watch 20% leave, daily. | 3 |
| Valuation multiple / PE | A buyout priced as a multiple of trailing weekly profit | 3 |
| Comparison shopping | A second stand at a different multiple; pick the better deal | 3 |
| Growth premium | The growing stand costs more per dollar of profit. Work out why. | 3 |
| Price already reflects news | The obviously-better business is already priced higher | 3 |
| Public markets | Real companies presented exactly as the kid's own stand was | 4 |
| Earnings yield | Flip the multiple: 8x means 12.5% back a year. Compare to savings. | 4 |
| Diversification | A cap on any single position, which loosens as they hold more names | 4 |
| Drawdown discipline | Prices fall. Holding a good business through it is the rewarded move. | 4 |

## 6. Progression

**Act 1 — One stand.** Set price, buy ingredients, run the day, read the P&L.
The whole act is finding the profit-maximising price. Ends after seven days
with a chart of their own price-vs-profit.

**Act 2 — Scale.** The wall: they found the best price and are still capped.
Capacity upgrades, a second location, a helper, a manager. A rival opens and
undercuts. Weekly reinvest-or-cash-out. Ends when the stand runs profitably
without the kid touching it daily.

**Act 3 — Ownership.** An equity offer, then a buyout offer, then a
comparison against another stand at a different multiple. The kid sells and
walks away with cash. This is the emotional peak of the game and should be
treated as such. The critical beat: the better business is *already* more
expensive, so spotting a good thing is not the same as getting a good deal.

**Act 4 — Markets.** Simulated portfolio on real market data, seeded with the
proceeds. Each company presented the way their stand was: revenue, profit,
margin, and what multiple the market is asking. Read-only research, then buy
and hold. Position caps. No day trading, no leverage, no options. Ever.

## 7. The readiness gate

"When is it time to trade?" is answered by evidence, never a day count or a
badge. Act 4 stays **read-only research** — the kid can look at real companies
and compute the same ratios they computed for their stand, but cannot commit
simulated money — until they have demonstrated, through decisions already made
in-game:

1. Stated their own margin unaided, from price and unit cost.
2. Held a strategy through a losing day rather than reacting to one day's noise.
3. Correctly ranked two businesses by multiple, and not assumed cheaper is better.
4. **Passed on a deal because the price was too high, not because the business
   was bad.** The hardest and most important one.

The lock is what makes the unlock feel earned. This is good pedagogy and good
product at the same time.

## 8. The three things that would cause a bloodbath

Named explicitly because they are easy to leave out and fatal to omit.

**Diversification and position sizing.** The gap that turns a wrong opinion
into a wiped-out account. Act 4 caps any single position as a visible, earned
mechanic. A kid should feel the constraint before they understand it.

**Competition and durability.** A kid who has never been undercut has never
asked "why can't someone just do this cheaper?" — and that question *is* moat
analysis. Hence the rival in Act 2.

**Behavioural discipline.** Acts 1–3 are monotonic, which is right for
retention but trains the belief that things only go up — the worst possible
prior to carry into a market. **Act 4 must let simulated positions fall**, and
must reward the kid who holds a good business through a drawdown. The parent
view should report "held through a 12% drop" as evidence, because it is the
best available predictor of real-world outcomes.

## 9. The bridge: where PE actually comes from

The continuity must be arithmetic, not analogy. The kid should see it is
literally the same sum.

```
Act 3   Someone offers $270 for your stand.
        Your stand makes $34 a week.
        270 / 34 = 8      "Eight times weekly profit."

Act 4   A share costs $X. The company earns $Y a share a year.
        X / Y = 25        "Twenty-five times yearly profit."

Same division. Bigger numbers. That ratio is called PE.
```

Then the two moves that make it usable: **flip it** (8x means 12.5% of your
money back a year; 25x means 4% — now comparable to a savings account), and
**ask why two companies differ** (same earnings, different price, means the
market disagrees about the future).

## 10. The parent view

A weekly summary readable in thirty seconds. Not analytics. Evidence.

What the kid did: businesses run, weeks operated, the buyout they accepted and
the multiple it represented, whether they held through a drawdown. What they
demonstrably understand, tied to decisions rather than quiz scores: "found the
profit-maximising price within four days", "chose the growing business over
the cheaper one", "passed on an overpriced deal".

One conversation starter per week, phrased so a parent can ask at dinner. The
parent's pain is not a missing curriculum; it is having no fun way to teach
this and no way to know if it landed. Solve the second half explicitly.

## 11. Economics

Act 1 constants, tuned to produce a clean discoverable optimum. Load-bearing.

- Starting cash: $20
- Lemons $0.50 each, 4 cups per lemon
- Sugar $0.40 per 10 cups; cups $0.30 per 10
- Per-cup ingredient cost: ~$0.195
- Daily stand fee: $5.00
- `cups_wanted = max(0, 60 - 20 * price) * weather`
- Weather: cold 0.6, mild 1.0, hot 1.5, drawn from a forecast that hints but
  never promises
- `cups_sold = min(cups_wanted, cups_you_can_make)`

On a mild day this puts the optimum at **$1.60 → 28 cups → $34.34 profit**,
while $0.75 sells 45 cups for $19.60. Selling more for less is the lesson.
Verify this holds before shipping any change to these numbers.

Unsold lemonade is discarded daily. Unused lemons last three days.

## 12. Technical

Next.js on Vercel. TypeScript. Tailwind. Client-side only: no backend, no
auth, no database. State in React, persisted to localStorage. Simulation lives
in pure modules with no React imports, exporting testable functions, so it can
move to a server without a rewrite. Tests for every demand curve and every
P&L arithmetic path.

Mobile first. Kids open this on a phone.

## 13. Visual direction

The audience has Roblox and Clash Royale on the same device. This has to look
like a game, not a fintech dashboard and not a worksheet. Avoid cream
backgrounds, serif display type, rounded SaaS cards with soft grey shadows,
all-caps labels, muted professional palettes. Those read as homework.

Ground the look in the subject: a hand-built stand on a hot sidewalk.
Hand-lettered signage, saturated colour, chunky physical buttons, real weather
and time of day. The signature moment is the day running — customers walking
up, reading the price, buying or moving on. Spend the visual budget there.

The P&L is the one place that should feel precise and grown-up, because a kid
earning a readable financial statement is the reward.

## 14. Where the meta-game sits

Before anything else in this section: the arc is the product. Stand → scale →
ownership → market, in that order, teaching what a price is, what a margin is,
what a business is worth and why. None of that changes. Everything in §15–§20 is
**subordinate to it**, and if any of it ever competes with it, the meta-game
loses.

Three rules keep that true.

**Nothing meta happens before the lemonade.** A first launch has one button on
it. No name, no avatar, no menu, no mode select. The kid is pouring lemonade
inside ten seconds, exactly as they are in Minecraft's first ten seconds. Every
system in the next six sections is invisible until the kid has done the thing
that gives it meaning — and the gate for each one is written down in
`src/lib/unlocks.ts` next to the reason.

| System | Appears | Because by then they have |
| --- | --- | --- |
| Trophy case, name | end of day 1 | earned something worth keeping |
| Words you earned | first word handed over | learned a term by doing it |
| Next up | end of day 1 | a day to compare a suggestion against |
| Same-Sky Challenge | end of Act 1 | a whole week they can send somebody |
| Investment club | Act 4 | their own money in a real company |
| Seasons | after the finale | a finished run to start over from |

**It is made of the arc, not bolted beside it.** A badge is not "played 10
days" — it is *"held your price while somebody undercut you"*, which is a
business concept with a name. The words are the vocabulary the arc already
produced. The challenge is the same lemonade week on the same weather. The club
is Act 4 with three friends and a vote. There is no second game here; there is a
record of the first one.

**Its only job is repetition.** Nothing durable is learned in forty-five
minutes. A kid who plays four times learns roughly four times as much, and the
fourth play has to come from somewhere. That is what the trophy case is for. It
is not the sugar around the lesson — it is what gets the lesson taught again.

So: during and after. Never before, and never instead.

## 15. Why they come back

The four acts are about forty-five minutes long. A game that ends in forty-five
minutes is a nice toy. It is not a product, and it will not teach anybody
anything durable, because nothing durable is learned in one sitting.

So the honest question is not "is Act 1 good?" It is "why does a twelve year old
open this again on Thursday?" The games this audience actually plays answer that
question deliberately:

| Game | Why you open it again |
| --- | --- |
| Minecraft | The world is still there, and it is *yours*. Progress is a place, not a score. |
| Clash Royale | A ladder with your name on it, and a friend one rank above you. |
| Roblox | Your friends are in it right now, and there is a new thing every week. |
| Pokémon | An incomplete collection is unbearable. |

None of those is "the content was educational." Engagement is not the sugar we
hide the lesson in — it is the *delivery mechanism for repetition*, and
repetition is the only thing that turns a concept into an instinct. A kid who
plays four times learns four times as much as a kid who plays once, and the only
way to get the fourth play is to earn it.

Four engines, in the order they matter:

1. **A record of you.** A trophy case, a list of words you earned, and a career
   ledger that survives every reset. Nothing in it is given for showing up.
2. **Mastery of a fixed world.** The weather is seeded. The same seed is the
   same fortnight, every time. That turns the stand from a slot machine into a
   puzzle you can get *better* at, and it is what makes a score comparable.
3. **Peers.** See §20.
4. **A next thing.** Seasons. The stand resets with a new sky; the trophy case,
   the glossary and the career ledger do not.

## 16. The trophy case, and why it is not XP

XP is the obvious move and it is the wrong one. XP rewards time spent, so it
rewards grinding, so the fastest way to the top is to stop thinking. We would be
building the exact habit that ruins people in markets: activity mistaken for
skill.

Every badge is therefore awarded for a **specific decision that can only be made
by someone who understood something.** Not "played 10 days" — *"raised your price
after the fresh-squeezed upgrade and sold more cups anyway."* You cannot do that
by accident, and you cannot do it twice without knowing why it worked.

Rules for badges:

- Derived from saved state, never from a flag we set when a screen was viewed.
- Each names the concept it proves, in one line, in kid language.
- Some are **hard**. A trophy case with everything filled in is worthless.
- A badge is never taken away. Progression is monotonic (§4).
- Ranks (jug → stand → corner → operator → owner → investor → analyst) are
  derived from badges held. There is no way to rank up except to demonstrate
  something.

## 17. Words you earned

This is a gap I got wrong in the first build, and it is worth stating plainly
because the failure was subtle. The rule *"vocabulary only after experience"*
made me teach the P/E ratio as arithmetic — price divided by yearly profit,
years to pay it back — and then never say the words "P/E ratio" at all.

That is not restraint, it is a missing feature. The kid who prompted this
product knew the term *and* the intuition, and the term is what let him say the
thing out loud to another person. Concepts you cannot name are concepts you
cannot discuss, defend, or be corrected on. Half of financial literacy is being
able to join the conversation.

So the loop is four steps, and it always ends with the word:

> **do** it → **see** the number → **name** it → **use** it back

The naming is a reward, not a lesson. It fires the moment after the kid's own
arithmetic produced the number, it uses their own figures in the sentence, and
it lands in a collection called **Words you earned** — which is a Pokédex, and
works for exactly the same reason.

| Word | Earned the moment they… |
| --- | --- |
| Revenue | see cups × price for the first time |
| Margin | work out what they keep per cup |
| Fixed cost | pay the stand fee on a day they sold almost nothing |
| Elasticity | raise the price and watch the queue shorten |
| Operating leverage | see a good day get *much* better after hiring |
| Capex / opex | buy a cooler once and a helper daily |
| Moat | keep their price up while the rival undercuts, and keep customers |
| Recurring revenue | sell their first punch card |
| Equity | sell a slice of the stand |
| Multiple | rank the three stands for sale by payback |
| **P/E ratio** | see their own buyout multiple restated in years |
| Diversification | hold three companies through a scare |
| Drawdown | watch a holding fall and not sell it |

## 18. Business models

"They sell things" is where most kids stop, and it is why a P/E of 12 and a P/E
of 45 look like the same kind of fact to them. The missing idea is that *how*
money arrives changes what the business is worth.

The stand teaches it directly. Act 2 adds a **punch card**: ten cups, prepaid,
at a discount. The kid gets cash today, gives up margin, and — the point —
those customers show up whatever the weather. Their revenue gets *less jumpy*.
Then Act 3 prices the business, and a stand with punch-card customers earns a
**higher multiple on the same profit.** The kid discovers that predictable money
is worth more than the same amount of lumpy money, by being paid for it.

That is the exact reason Netflix and Coca-Cola are priced the way they are, so
every Act 4 company carries its model and one line about what the model does to
the numbers:

| Model | Stand version | Company | What it does to the numbers |
| --- | --- | --- | --- |
| One-off sale | a cup to a stranger | Apple | Big margin, but you must win them again |
| Subscription | punch card | Netflix | Money arrives whether or not they show up |
| Membership | season pass to the park pitch | Costco | Tiny margin on goods, real profit on the fee |
| Platform | letting someone else sell from your table | Roblox | Grows fast, spends more than it earns |
| Brand | the sign nobody else can copy | Nike, Coca-Cola | Charge more for the identical thing |
| Many copies | a second stand in the park | Chipotle | Growth is arithmetic: one more stand, again |

## 19. Thesis before money

The single most dangerous habit we could accidentally teach is *bought it
because it went up.* So in Act 4 money does not move until the kid has written
one sentence, in two halves:

- **A number reason**, chosen from the company's actual metrics, and **checked
  against them.** You may not claim "cheap for how fast it grows" about a
  company whose P/E is triple its growth rate — the game will say so, using its
  own figures, and let you pick again or buy anyway with the mismatch recorded.
- **A story reason**, in their own words from a short list of real ones — a new
  product, more shops opening, people switching away, everyone I know uses it.

Twelve weeks later, every thesis is scored on the axis that matters, which is
not "did you make money":

| | reason held up | reason did not |
| --- | --- | --- |
| **made money** | Good call. | **Lucky.** Say it out loud. |
| **lost money** | Right idea, wrong time — this happens. | Now you know why. |

The top-right box is the whole point. A game that congratulates a kid for a
lucky win has taught them the most expensive lesson in finance backwards.

## 20. Single player to multiplayer

Everyone runs their own stand alone, first. This is not a technical
convenience — it is the pedagogy. You cannot argue about whether a company is
expensive until you have personally set a price, and you cannot be a useful
member of an investment club until you have been wrong on your own money.
Solo lemonade is the tutorial for having an opinion.

Three tiers. Two are built and work with no server at all; the third cannot be.

**Tier 1 — Same-Sky Challenge (built).** A short code carries a seed and a rule
set. Both kids get *the identical fortnight* — the same weather, the same rival,
the same forecasts — so the only difference in the result is the decisions. The
comparison screen never just shows who won. It shows the decision diff: average
price, average batch, cups spoiled, what you bought. "You beat me because you
priced twenty cents higher and threw away nine fewer cups" is a sentence a kid
can learn from. "You won" is not.

**Tier 2 — Investment Club (built).** A code carries a pooled portfolio: the
cash, the holdings, and the decision log. It passes between phones. On your
turn, you may propose one buy, and a proposal without a thesis (§19) cannot be
submitted. The next member sees the thesis and votes it up or down before the
week advances. At the end, gains are attributed *by proposer and by reason*, so
the club finds out whose thinking was actually good — which is different from
whose picks went up, and the screen says so.

This is the highest-value mechanic in the product. Defending a number to a
friend who can vote you down is how people actually learn to value things, and
it is the part a video cannot do.

**Tier 3 — Live league (specified, not built).** Simultaneous clubs, a real
ladder, seasonal resets, friend lists. This needs a server, accounts, and — for
minors talking to each other — moderation, parental consent, and a considered
answer on data retention. Building a chat-shaped surface for children over a
weekend would be irresponsible, so it is deliberately not here. What is here is
designed so the codes become API calls and nothing else changes.

**What we will not do, even with a server:** no real money, ever; no
kid-to-kid free text; no leaderboard that ranks by returns alone, because that
is a machine for teaching kids to gamble. Ladders rank by *badges earned* — by
demonstrated understanding, which cannot be won with a lucky week.

## 21. Where the numbers come from

The product rests on one claim — *the numbers on screen are always real and
always the kid's own* — and for a while the Act 4 company figures were the one
place that was not true. They were rounded approximations typed into a file.

They are now fetched:

- **Fundamentals: SEC EDGAR XBRL** (`data.sec.gov`). Revenue, net income and
  diluted share count straight from each company's 10-K. Free, official, no API
  key, no terms problem.
- **Prices: five years of real weekly adjusted closes**, on one shared date axis
  so a market-wide fall lands on everybody in the same week.

Both are fetched **at build time** by `scripts/fetch-market-data.mjs` and
committed. That is the whole architecture decision: no API key in the browser,
no request from a child's device to a data provider, the app stays a static
bundle, and a scheduled build keeps it current.

**Act 4 replays a real twelve weeks.** The kid's seed picks a window out of the
five years and they are never told which one. Every dip and recovery genuinely
happened. Windows are uniform over what is available and deliberately not
filtered to ones containing a crash — 88% of them contain a fall of 10% or more
anyway, and teaching that markets always fall in three months would be its own
kind of lie.

**No hindsight.** Each fiscal year is stored with the date its 10-K became
public, and the game shows whichever accounts were actually public on the week
being replayed. A price from one year over earnings from another is a multiple
nobody ever quoted; showing it would flatter or damn a company on information
the kid could not have had.

## 22. Out of scope, permanently

Real money or brokerage integration of any kind. Day trading, leverage,
options, shorting. Multiplayer. Leaderboards. Streaks. Badges. Any screen
whose primary content is explanatory text. Copied assets, names or art from
other games — mechanics are not copyrightable and we borrow structure freely,
but expression and assets are off limits.
