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
options, shorting. Live multiplayer of any kind — see §25 for why the
asynchronous version is not a compromise. Leaderboards. Streaks. Badges. Any screen
whose primary content is explanatory text. Copied assets, names or art from
other games — mechanics are not copyrightable and we borrow structure freely,
but expression and assets are off limits.

## 23. The interface is a place, not a form

The planning screen was, for a long time, a heading and two labelled sliders
with three summary cards under them. Everything on it was correct. It was also
a settings menu, and a kid reads a settings menu as homework.

Watching a middle schooler play a factory-builder made the gap obvious. In that
game nothing is a slider in a list. Every machine is an object on the floor with
its current setting written underneath it — `15 ×$0.50`, `20 / 1 of 2hrs` — and
you tap the object to go inside it and change it. Two things follow from that
which no form gets for free:

1. **The whole plan is legible at a glance.** You do not open four panels to
   find out what your factory is set to; you look at it.
2. **The interface teaches the topology.** You learn what is connected to what
   by looking at the floor, not by reading a description of it.

So the plan lives on the stand. The price is on the sign, because the sign is
what the customers read. The batch is in the crate of lemons, because that is
where the lemons are. The margin is in the cash box. Regulars are a board on a
post. The rival is across the road, small, because he is over there and not
here. Tapping a thing opens a sheet — the stand stays visible behind it, so a
kid is never navigating, only looking closer.

Every badge in the scene is a real figure from the kid's own state, the same one
the sheets and the statement use. A scene that showed a friendlier rounded
version of the truth would be worse than the form it replaced.

## 24. The bench, and the only honest way to teach a demand curve

Here is the measurement problem that Act 1 had and could not solve by trying
harder. A kid raises their price and earns less. Was it the price, or was it the
weather? Both moved. Seven days of noisy data will not separate them, and a kid
who cannot separate them learns the wrong lesson roughly half the time — which
is worse than learning nothing, because it is confidently wrong.

A scientist would hold the world still and change one thing. So the bench lets
them:

> **Try it on yesterday's crowd.**

The kid's current plan is replayed against the crowd that actually turned up
yesterday — same seed, same forecast, same weather, same people — and the result
is kept in a short list. Change one number, try again, and the two results are
compared with the gap decomposed into the decisions that caused it:

```
You charged more and sold fewer — and still came out ahead.   +$9.52
  Charging more        +$0.75 a cup on the 36 you were selling      +$27.00
  Selling fewer cups   11 cups fewer, at $1.75                      −$19.25
  Fewer lemons and sugar                                             +$1.77
```

Those lines sum to the gap exactly, and a test holds them to it. That paragraph
is the price elasticity of demand, discovered rather than defined, in a kid's own
numbers, from a decision they made on purpose.

Four rules keep it from becoming a cheat:

- **It is yesterday, and it says so.** Today's weather is unknown and stays
  unknown. Optimising hard against yesterday still loses money when it turns
  cold, which is the second lesson and the one no projection can teach.
- **It uses no data the kid does not have.** Every input is a day they lived
  through. Nothing about tomorrow leaks backwards.
- **Nothing is saved.** A rehearsal is read and thrown away; the real day is
  drawn fresh.
- **The list is six long.** Enough for a hypothesis, a control and a few
  variations. Not enough to grind a slider until the number peaks, which would
  turn a question into a search.

The one thing it still never shows is a prediction of today. That remains the
thing they are here to find out.

## 25. When other people arrive

The question was whether stretching single-player out risks boredom, given that
Clash Royale is multiplayer at minute one. Looking at what those games actually
do rather than what they are famous for:

| Game | First session | What actually retains |
| --- | --- | --- |
| Clash of Clans | Single-player goblin maps | The clan — gated at Town Hall 3, joined later |
| Clash Royale | Genuinely PvP immediately | But the *content* is the opponent; 3-minute matches |
| Minecraft | Alone, for days or weeks | Showing people. Servers come much later |
| Roblox (Adopt Me, Brookhaven) | Multiplayer by default | Parallel play, not co-op. Everyone in their own house |
| Good Pizza, Great Pizza | Alone, forever | Short loop, rising difficulty, a story |

The pattern is not "multiplayer early". It is **asynchronous social presence
early, synchronous co-operation late**. Kids need to feel observed and compared
in the first session — that is what makes it not-homework — but they do not need
a live partner, and a live partner is the one thing we cannot ship (no backend,
no accounts, no data belonging to a child on anybody's server).

So three tiers, all of them offline:

1. **The rival, from Act 2 day one.** A stand across the road with a price on
   its sign. Not a control — a fact about the street. Somebody to beat.
2. **The duel, from day two.** A short code that carries one day of weather.
   Both kids play the same Tuesday with the same twenty dollars and compare,
   and the comparison decomposes the gap the same way the bench does. Two
   minutes. This used to be a full week, which put the only other-people
   feature in the game forty minutes past the front door.
3. **The club, in Act 4.** A shared portfolio passed between phones, where a
   proposal needs a reason and a vote.

Day two rather than day one for the duel, deliberately: a kid whose entire
experience is one day does not yet know the weather moves, so the comparison
would read as luck rather than as decisions.

## 26. Is this too much?

Honest audit. The game now contains: a stand, a bench, upgrades, staff,
locations, a rival, a round of regulars, deals, a buyout, an equity offer, a
market, a portfolio, a thesis gate, a reckoning, a trophy case, a glossary,
duels, a club, seasons and a parent view. That is more systems than Clash of
Clans has, and Clash of Clans is not a game anybody calls simple.

The count is not the problem. Clash of Clans introduces thirty systems and
nobody is overwhelmed, because at any given moment there is **one thing lit up
and a finger pointing at it**. The problem is under-teaching at the moment of
arrival, and playing our own first ten minutes with fresh eyes found exactly
that:

- The game never stated its own objective. A kid got a forecast, a shopping list
  and a price dial, and had to infer that the point was to end the week with
  more than twenty dollars. Fixed: the goal is on screen, permanently, from the
  first morning.
- Day one handed over three new words in three stacked panels of italic
  explanation, under the first profit and loss a kid has ever read. Fixed: one
  word a day, the rest queue.
- Two badges and a word landed on top of that statement as overlays, covering
  it completely. Fixed: badges wait until the statement has been read, then
  arrive one at a time, and never over a pinned button.
- The new stand scene is a kind of screen nobody has seen before, so a kid who
  does not know it is touchable reads it as a picture. Fixed: a finger, once.

The rules that keep it in hand, and they are load-bearing:

- **One card a day.** Day one announces the trophy case. Day two announces the
  duel. Never two at once. `announceable()` enforces it; a test holds it.
- **One word a day.** `Game.pendingInsights` queues the rest.
- **One finger.** A hint is one sentence and one arrow, it points at exactly one
  thing, and it goes away when the kid *does the thing* — never when they tap
  "Got it!", because tapping "Got it!" teaches nothing. Nothing is ever blocked
  while a hint is up.
- **Nothing exists until it has a meaning.** Every gate in `unlocks.ts` has the
  moment that justifies it written next to it, and the rule is always "what has
  just happened makes this obvious", never "they have played long enough".

## 27. Text is the enemy, and it is not the same as rigour

A twelve-year-old scrolls past a paragraph. This is not a reason to teach less;
it is a reason to stop using prose as the delivery mechanism for things that are
not prose.

Concretely, and each of these was a real paragraph that is now not one:

- The ingredient breakdown was `7 lemons $3.50 + sugar $1.12 + cups $0.84`,
  followed by a sentence about the per-cup cost. It is now `🍋 7 · $3.50   🥄
  $1.12   🥤 $0.84   ≈ $0.20 a cup`. Same four figures, a third of the words.
- Every new word had two paragraphs: what just happened, and why it will matter
  with real companies. The first is the lesson and stays visible. The second is
  real and worth keeping, so it waits behind **Why this matters ›**. Curiosity
  opens it; nobody is made to read it.
- "Next up" was three goals with an instruction under each — six lines of small
  print at the bottom of a long screen. Now it is three titles with a chevron.
- The plan screen's numbers moved onto the objects they belong to, which
  deleted every label that existed only to say which slider was which.

What is never compressed: the profit and loss. It is a table of the kid's own
figures that reconcile on paper, and it is the one screen in the game allowed to
look precise and grown-up. Numbers are not text.

## 28. The shape of the thing: a campaign that stopped being one

A sequence has an end, and an end is a place people leave. Four acts, a finale
and a reckoning is the right shape for a story and the wrong shape for a
practice — a kid who finishes reads it as finished, and financial literacy is
not something you finish.

Clash Royale has no timeline. Clash of Clans *does* — every building is gated
behind a Town Hall level — but it never presents as one: it presents as a
village with tabs, where the sequence is invisible scaffolding and the loops sit
beside each other. That is the model, and three changes bring this product to
it.

**The road, on the title screen from the first launch.** Four stops with the
market visible and padlocked at the end. Not navigation — nothing on it is
somewhere you can go — a *picture*, because the problem it solves is
motivational, not navigational. A kid interested in finance used to open this,
see a lemonade stand, and have no way of knowing a stock market was in it. The
line underneath is the only place the product says out loud what it is for:
*learn it on lemonade, then do it with real companies.*

**The Saturday stand.** The stand does not die when it is sold. Once a week, in
Act 4, twenty dollars comes out of the investing account as working capital, the
kid runs a day, and everything in the cash box goes back in. Two loops side by
side rather than one after the other: a two-minute one that makes money out of
unit economics, and a twelve-week one that turns money into ownership. Each week
the kid sees exactly what a Saturday buys, which is the clearest statement this
product can make about why any of it matters.

**Collections that grow with the content.** Rank used to run on badges, of which
there are thirty, with the last rung at twenty-four — a ladder that ends.
Standing is now badges plus words plus companies whose accounts the kid has
actually opened, and all three grow when the game does. Still not experience
points: nothing counts time, sessions or taps, and every point is a thing
demonstrated once and kept.

## 29. The playbook, which is the deck

Clash Royale is a game about war, which is not a subject an eleven-year-old has
any business being good at, and they get good at it anyway. The mechanism is not
the battles. It is the **deck** — eight cards you choose, name, save, copy off
somebody better, tweak and test. The strategy is an object you own, and owning
it is what turns "I like this game" into forty minutes of deck guides on
YouTube. That is self-directed learning, and nobody assigned it.

This game had decisions but no deck. A kid could play Act 4 well and still not
be able to say what their strategy *was*, because there was nowhere for a
strategy to live.

A playbook is up to four rule cards with a name: what you will buy, how much
goes in each, and what you do when it falls. Twelve cards, and **none of them is
right** — every one is a trade that costs something. Refusing loss-makers means
never owning a young company. Selling on a 20% fall caps the damage and sells
the bottom every time. Spreading wide means nothing can ruin you and nothing can
save you.

Two properties make it teach rather than decorate:

1. **It runs.** The rules are executable and the game plays them out over real
   history without the kid touching anything.
2. **It runs everywhere.** Not on one twelve-week stretch — on all 224 of them.
   So the answer is never "your rules made 8%", it is:

   > Across 224 real twelve-week stretches — **59% of them ended ahead.**
   > Typical +3%. Best +32%. Worst −27%.

That single change is the difference between a game that teaches investing and a
game that teaches gambling. It makes the *shape* of a strategy visible instead
of the result of one roll of it, and a kid who has internalised "one good result
is not evidence" has learned the most valuable thing in this entire product — by
tinkering with a deck.

## 30. Competition without a leaderboard

Friendly competition is what keeps a group playing, and the obvious version — a
leaderboard of returns — is the single most harmful thing this product could
ship. Over twelve weeks the difference between the best and worst kid in a
friend group is almost entirely which twelve weeks they got. Ranking them by it
teaches, with a big number and a gold medal, that the luckiest person is the
best investor.

So the table has no overall winner. It has five honours:

| Honour | Measures | Skill? |
| --- | --- | --- |
| 🍋 Best operator | Biggest week ever run at a stand | Yes — dozens of decisions, noise cancels |
| 🧠 Best thinking | Buys that were right *for the reason written down* | Yes — scored by the thesis machinery |
| 📓 Best playbook | Whose rules win most often over the *same* 224 stretches | Yes — identical history for everyone |
| 🏆 Biggest collection | Badges, words, companies read | Effort, and winnable by carrying on |
| 🎲 Most money made | Portfolio return | **No. Labelled "mostly luck", and placed last.** |

Tested with three kids: one took the money honour and came last on both thinking
and playbook; another swept three skill honours while losing money. The table
says so in a sentence. That is the lesson, delivered by the data rather than by
a warning.

## 31. The market is a collection now

Eight companies was right for a first visit and wrong for a game somebody keeps
playing — and a kid who wants to look up a company they care about and cannot
find it has been told the market is a fixed menu.

Twenty-four companies, in three tiers that open on standing:

1. **Things you use** — Apple, Costco, Chipotle, Nike, Coca-Cola, Roblox,
   Netflix, Disney. You can form a view by looking round your own house.
2. **Where the money goes** — McDonald's, Starbucks, Amazon, Walmart, DoorDash,
   Domino's, Lululemon, Take-Two.
3. **You have to read about these** — Nvidia, Microsoft, Alphabet, PayPal,
   Duolingo, Airbnb, Uber, Crocs. Businesses you cannot see from the street,
   where reading the accounts stops being optional.

Three new business models came with them, and they are the best teaching frames
in the set: **advertising** ("letting the ice-cream van pin a flyer to your
table — the person drinking is not the one paying you"), **toll booth** ("two
cents every time anyone on the street buys anything"), and **picks and shovels**
("selling lemons and cups to every other stand on the road — you do not have to
pick the winner").

A company that was not listed yet in the week being replayed is simply absent,
rather than shown with accounts nobody had seen.

And the same verb as the Act 1 bench: **⚖️ Compare**. Pick two, and the
differences are named — with an explicit rule that green means *more*, never
*better*, and a trade-off sentence at the top. A game that teaches a kid "low
P/E good" has taught them something false.

## 32. Sound, and why a coin is curriculum

The most obvious thing missing from a game aimed at eleven-year-olds. Every game
in the reference set is loud, and not for atmosphere: **the coin sound is the
reward**. In a game about money the chink of a coin is doing curriculum work,
because it attaches a feeling to the exact instant a cup sells at a profit,
forty times a day, which is how a kid comes to *want* the number to go up before
anybody has explained why it should.

No audio files. Every cue is synthesised from a table of frequencies by the Web
Audio API, so the entire sound design costs about two kilobytes, works offline,
and — because the pitches are data — can be unit-tested rather than eyeballed.
The tests hold four properties that matter: nothing outlasts the tap that caused
it, nothing sums past full scale at any instant, the sounds that fire dozens of
times a row are the shortest, and **everything that means good rises through a
major triad while everything that means no falls**. That last one is the only
thing about the sound design a kid has to learn, and they learn it without being
told.

Off is a real option, on the first screen, and it survives a reload — a kid
playing under a desk in a classroom needs a mute that works before the first
sound.

The end-of-day profit counts up rather than appearing, capped at three quarters
of a second so a good day feels bigger without taking longer to read. Only the
headline moves. The profit and loss underneath is the thing a kid is supposed to
check on paper, and a ledger whose figures are still settling is a ledger nobody
trusts.

## 33. Act 2 is a plot of land, not a shop

Act 2's screen was three lists of rows under two headings — "buy once, keep
forever" against "pay every single day" — and those headings were carrying the
entire lesson of the act in eleven-pixel type. Nobody reads a heading.

Now it is a place, and **where a thing stands is what kind of spending it is**:

- **Kit sits on the stand.** Bought once, then simply part of the picture. Its
  badge says `yours` and never mentions money again, because it never costs
  anything again.
- **Crew stand beside it wearing a wage**, in red, for as long as they work
  there. A helper hired three weeks ago still has `$12/day` pinned to them.
- **The pitch is the ground and the backdrop.** Move to the park and the houses
  become trees.

Everything unbought is a dashed circle with a price on it, visible every
morning. That is what makes tomorrow's profit feel like it is *for* something —
the kid already knows what they are saving up for, because it has been standing
in their front garden all week.

The sheet behind each plot is where the arithmetic lives, and the arithmetic is
what turns a purchase into a decision. A helper is not "$12 a day", a helper is
**"sells 8 cups a day, every day, before it has paid for itself"**. A cooler is
not "$35", it is **"23 cups once, and then it is free forever"**.

One warning fires before the money moves, never after: *you can already serve 30
a day and you have been selling about 15 — 15 cups of room going spare*. The
test is simply "is the queue longer than the stand", not "does this add more room
than I am already wasting" — getting that backwards means the warning goes quiet
on exactly the biggest, most expensive mistakes.

## 34. One door for everything with somebody else behind it

Three social systems had grown up independently and each had arrived as its own
pill on the title screen. By the end that was five buttons under the one that
starts the game, which is precisely the menu §26 exists to prevent, arrived at by
accretion rather than by decision.

They also belong together for a better reason than tidiness: they are one loop
rather than three features. You **race** a friend on the same week, you **argue**
with them about what to buy, and you **stand next to** them afterwards. Split
across three entry points, a kid who found one never discovered the other two.

So: 🏆 Your stuff · 🧑‍🤝‍🧑 Friends · 📓 Playbook. Three, and never more.

The friends desk leads with what is *happening* rather than what a thing is,
because a status is a reason to open something and a description is not — "3
played · 2 won, 1 lost", "4 members · $612.40 pooled". A club waiting on this
kid's vote is the only genuinely urgent thing in the game and the only thing
allowed to shout. Locked desks are shown, greyed, with what opens them, for the
same reason the road shows a padlocked stock market on the title screen.

## 35. The collection, and the oldest reason in games to do it again

`companiesStudied` had been accumulating since the market opened, feeding the
kid's standing and therefore their rank, and it had **never once been shown to
them**. A collection nobody can look at is a counter, and a counter is not a
reason to go and read another set of accounts.

Every long-lived game the target audience plays has a completion set with a hole
in it. The mechanic works because it converts "learn more" into "fill that in",
and the thing it makes a kid do here happens to be exactly the thing this product
exists to make them do: open a company's accounts and read them.

Twenty-four slots, always all visible, on three shelves. Reading a company's
accounts is the only way to fill one and there is no way to fill one by accident.
The line under it names the next thing to do rather than a score — "13 you can
reach and have not read yet", never "54%". The same strip sits in the market
itself, next to the companies, because the trophy case was a long way from the
moment the slot fills.

### The two-currency bug this turned up

The shelves open on **standing** — badges plus words plus companies read — and
the trophy case was gating the same shelves on the raw badge count. So the case
showed a padlock on a shelf the market had already opened. The rank card had the
same fault in a worse place: rank was computed from standing and the line
underneath quoted badges, so a kid one company short of Operator was told they
needed **nine more badges**.

Both now count in one currency, and it has a name and a symbol the kid can see:
**⭐ — a badge, a word, or a company you have read.**

## 36. Evidence, not exposure

The parent report said "Knows the difference between buying a thing once and
paying wages every day". The condition for saying it was
`game.learned.includes('capex-vs-opex')`, which becomes true the moment the game
has *displayed a card with those words on it*. That is a claim about what the
software did, presented as a claim about what a child knows — in the one screen
whose entire job is to be trustworthy.

The honest alternative is not a quiz. A quiz measures whether a kid can
recognise a definition ten minutes after reading it, and it is the thing this
product promised never to build. The alternative is **behaviour**: a skill
counts when the kid did something that only makes sense if they understand it,
with their own money at stake and nobody asking them to.

`src/lib/mastery.ts` holds ten of them, and three rules:

1. **Every sighting is an action, never an exposure.** Nothing fires because a
   word was shown, a screen was opened, or a day elapsed.
2. **Every sighting is citable.** It carries the day and the kid's own figures.
   *"Day 4: sold all 24 cups with 16 people turned away, then put the price up to
   $1.75."* A claim nobody can audit is a claim nobody should believe.
3. **Once is a coincidence.** Most skills need two separate occasions.

### The test that matters

Three synthetic players, each understanding exactly one thing:

| Player | Behaviour | Reads the queue | Reads the sky |
|---|---|---|---|
| **Pricer** | Adjusts price on yesterday; fixed batch | held | — |
| **Forecaster** | Adjusts batch on the forecast; fixed price | — | held |
| **Oblivious** | $1.50 and 20 cups, every day, 16 days | — | — |

The oblivious player ends sixteen days with a stand full of money and scores
**nothing at all**. That refusal is the whole point: if a game cannot tell a
child who is adjusting from a child who is merely busy, it is not teaching
anything, and no amount of vocabulary on the screen changes that.

The kid sees the same list as the first tab of their own case — not a report
card, but a list of things nobody has told them to try, each with the receipt
attached.

Recording `cupsMade` on a day is what makes any of it possible. Without it,
selling twenty-four cups looks identical whether twenty-four was the demand or
the supply, and that difference is the whole of the pricing lesson.

## 37. Two things that were never measured

### Reading level

A game pitched at eleven-year-olds whose copy sits at a fifteen-year-old's
reading level has locked out half its audience before anybody presses a button,
and it will look exactly like a game that "did not engage them". Nobody had
checked. `scripts/check-reading-level.mjs` now runs on every test:

- **average grade 4.9** against a target of 6
- **no sentence over 22 words**

Eight sentences were rewritten. Building the checker was itself instructive:
the first version scored code as prose and ranked short headlines at grade 21,
because Flesch–Kincaid is meaningless below about eight words — it would have
sent me rewriting perfectly readable copy. It now applies the formula only where
the formula means something, and reports hard vocabulary as a list to read
rather than a test to pass, because no formula can tell "capacity", which this
game exists to teach, from a word that slipped in.

The glossary's grown-up gloss is excluded by a naming convention: any field
called `grownUp…` is adult copy.

### Contrast

Berry is the colour of every loss and every negative figure in the game, which
makes it the text a kid most needs to be able to read. It was at **3.1:1 on
white** against a 4.5:1 bar, and **2.75:1 on the lemon sign** — the most
looked-at number in the product.

The first fix kept the bright pink for large display type on the grounds that
large text only needs 3:1. It did not survive the check. There is now one pink,
it passes everywhere at 4.58:1 or better, and green-for-good stays separable
from pink-for-bad under both common forms of colour blindness.
`scripts/check-contrast.mjs` runs on every test.

## 38. One teacher is thirty children

Everything above is internal quality, and impact is quality multiplied by reach.
Reach was one child, on one device, who had to find the game first.

There is no backend and there is not going to be one, so this cannot be a class
roster with logins. What it can be is what a good lesson actually needs, which
is smaller:

1. The teacher writes **one code** on the board.
2. Every child plays the **same week** — same forecasts, same weather, same
   twenty dollars.
3. Each child ends with **two numbers**: what they charged and what they made.
   Two numbers is what a class of thirty can report in the five minutes a lesson
   has for it.
4. Those sixty numbers go on one chart.

**And the chart is a demand curve.** Not one drawn by a teacher on a whiteboard,
and not one revealed by the software — one the class measured, by each doing a
different experiment on the same world. Twelve children produced a hill peaking
at exactly the price the simulation says is optimal.

Then, and only when the teacher asks, the real curve goes over the top: the same
week played at every price from 50c to $4. The order is the lesson. Showing the
answer before the measurement turns thirty experiments into thirty guesses at
something the computer already knew.

The board never names a child — same argument as §30. `TEACHING.md` is the
forty-minute lesson plan, written so a teacher who knows no economics can run it.

### The invariant it all rests on

"Same weather, whatever you decide" is true because `buildCustomers` generates
the whole footfall first and lets each person decide, so **the number of random
draws in a day depends on the weather and nothing else**. That is not obvious
from reading the function, and a plausible optimisation — only generate the
people who might buy — would break the challenge system, the club and the
classroom board silently and at once. `tests/challenge.test.ts` now pins it.

## 39. Offline, because the classroom is where this matters most

The game has no backend, makes no network calls from a child's device, and keeps
every save in `localStorage`. There was never a reason for it to stop working
when the wifi did — except that a web page needs the network to load itself.

`public/sw.js` fixes that, and the strategy is deliberately boring. Hashed build
assets are immutable by construction, so cache-first with no revalidation.
Navigations are network-first with a cached fallback, so a child on a good
connection always gets the newest build and a child on none still gets the game.
Nothing cross-origin is touched at all, because nothing should be going there.

Two details that were not obvious:

- **The install warms the cache by reading the shell.** Relying on the fetch
  handler alone leaves a hole: the browser only downloads what it needs, so a
  modern browser never fetches the polyfill bundle, and it is therefore missing
  when an older browser comes to the same device offline. The worker fetches
  `/`, pulls every `/_next/static/…` URL out of the HTML, and caches the lot.
  Verified: eight referenced, eight cached, none missing.
- **No `skipWaiting`, and not in development.** A new worker takes over on the
  next load rather than swapping assets under a child halfway through a day. And
  in development a cache-first worker cheerfully stores hot-update chunks and
  serves stale ones back, which presents as an edit that did not take.

Haptics came with it, on the same switch as the sound. Only cues that mark
something *finishing* buzz — the till, a badge, an unlock, the finale, a bad
day. A buzz on every cup would fire forty times a day, drain a battery, and stop
meaning anything by the fourth one. Held to that by a test, because it is
exactly the sort of rule that erodes.

## 40. The audit: what a lint config found that five hundred tests did not

Three lenses, gone over deliberately rather than by feel.

### Game design

One hole, and it was a bad one. Act 2's goal strip says **"three more profitable
days run by your manager"**. The function that runs a manager day existed. The
counter it feeds existed. The badge for reaching three existed. Nothing anywhere
in the game called any of it — the close screen had the sentence *"Your manager
can run tomorrow without you"* rendered as a **paragraph** instead of a button.

So a kid who hired a manager was told to do something the interface provided no
way to do, and went looking for a control that was not there. The act still
ended, on a fourteen-day fallback, which is exactly why it survived: the game
moved on and only an attentive player would have noticed they had been asked for
something impossible.

Found by the linter — `letManagerRun` was assigned and never used. Now a real
button, and the manager reads the forecast when sizing a batch, because a
manager who makes twenty-eight cups into a cold morning loses money and the
streak never builds.

`tests/arc.test.ts` now walks the whole thing the way a player does and asserts
each act ends **the way the game says it will** rather than merely ending —
including that the hands-off goal is reachable *before* the fallback fires.

The other game-design gap was the daily challenge. `skyOfTheDay` derives a week
from the date alone, so every player in the world gets the same seven days. It
was written, tested, and wired to nothing. It is the cheapest retention mechanic
there is and the only thing in the game two children who have never met can
compare without arranging anything first.

### Product

- **No licence.** A school that wanted to use this could not know whether they
  were allowed to. MIT now.
- **No privacy statement.** The strongest thing about this product is that it
  collects nothing, and that fact lived only in source comments. `PRIVACY.md`
  states it in a form a teacher can hand to a school, lists the three
  `localStorage` keys by name, and ends with three ways to verify it without
  taking our word for anything.

And the claim turned out not to be true. Every page load made **three requests
to `fonts.googleapis.com` and `fonts.gstatic.com`**, handing a child's IP
address and user agent to Google — while the README, PRODUCT.md and TEACHING.md
all said nothing leaves the device. The comment above those tags claimed they
were done that way "so an offline build still works", which is backwards:
`next/font` downloads the files at build time and serves them from this origin.
Verified after the change — the served HTML contains no external URL at all.

### Code

- **No CI.** Five hundred and seventy-nine tests, a reading-level check, a
  contrast check and a data-integrity check, all of which ran only when somebody
  remembered. A check nobody runs is a comment.
- **No lint config**, so `npm run lint` dropped into an interactive wizard and
  had never been run. Three rules earn their place: `exhaustive-deps` as an
  error, `no-unused-vars` as an error (it is what found the manager bug), and
  `no-explicit-any`. It also caught a local function called `useTry`, which
  React reads as a hook and which was silently disabling hook checking across
  the whole planning screen.
- **No component tests.** All five hundred and seventy-nine were pure-library,
  and *every defect ever found by playing this game was in a component*: three
  overlays stacked over the first profit and loss, three vocabulary words on day
  one, a toast landing on the primary button, eleven badges from a finished
  season arriving over the next season's first morning. Thirty-five UI tests
  now cover the reward layer, the place screens and the classroom board.
- **No error boundary.** A thrown component in production was a blank white
  page. Now: one sentence, the promise that their save is intact, and a button.

## 41. The first customer, and the difference between a symptom and a fix

A parent played the deployed build and sent back five things. Two of them were
about pacing:

> Things I am thinking of are slowing this down to incorporate key lessons
> along the way and then a recap in the end. Instead of days we can have stages
> based on concepts. Like financial concepts.

Both are wrong as written, and both are right about something.

**They are wrong as written.** Four acts, seven days, a fortnight and twelve
market weeks is not a fast game — it is a long one, and the recap she asked for
already existed at the end of it, which is precisely why she never saw it.
"Stage 2: Fixed and Variable Costs" on a child's screen is a chapter heading,
and a child who reads a chapter heading knows they have been handed homework.
Shipping her prescription would have made the game worse for the player in
order to reassure the buyer, which is the standard way this category dies.

**They are right about the thing underneath.** She could not see the learning.
Not "the learning was thin" — she could not *see* it, because:

- `onParent` on the title screen was `firstRun ? undefined : openParent`. The
  one screen in the product built to show an adult what the game teaches did
  not render until the child had finished a run and come back to a save. Every
  parent evaluating it cold — which is every parent, once — was shown a
  lemonade stand and no evidence of anything at all.
- There was no route to it during play. Not from the stand, not from the yard,
  not from the market. Title screen and finale, and nothing else.
- Nothing anywhere named the idea a child was currently inside. The acts *are*
  organised by concept — price and margin, capacity and fixed cost, valuation,
  markets — and the only label on any of it was "Day 3 of 7".

So the customer reported the symptom accurately and guessed at the cause. That
is the normal division of labour, and taking the guess literally would have
been the mistake.

### Two registers, one stage

`ACT_TITLES` now carries four fields where it carried two. The child gets
`question`; the grown-up gets `grownUpConcept` and `grownUpWhy`. Same stage,
and only the register changes with the reader.

| The child reads | The grown-up reads |
| --- | --- |
| What is a cup worth to them? | Price, cost and margin |
| What is worth spending on? | Capacity, fixed cost and competition |
| What is the whole thing worth? | Valuation, and price against earnings |
| Whose business do I want a piece of? | Public markets, and reading a filing |

`src/lib/curriculum.ts` groups the ten `mastery` skills under those four
headings and hands the result to the parent view. A test asserts that no
concept noun — margin, capital, valuation, equity, earnings, unit economics,
fixed cost — ever appears in a kid-facing field, because the whole argument for
two registers collapses the first time one leaks.

### What a parent now sees before their child has played

The ladder is deliberately the *whole* syllabus, including the stages that have
not opened. A syllabus with the future cut off is a progress bar, and a
progress bar says nothing about what is being taught.

Two things came out of building the empty state honestly:

- The career card was rendering `0 seasons · 0 days · 0 of 30 badges · 0 of 26
  words` at the top of the screen. A scoreboard of nothing, as the answer to
  "what is my child learning". It is hidden until there is a record.
- `notYet` contained *"Reacts strongly to one bad day"* on a fresh save,
  because the readiness criteria are unmet by default. The first thing a parent
  read about their child was a character judgement the software had invented.
  `Not yet` is for things not shown, never for things not attempted.

### The badge over the evidence

Verifying the above in a browser turned up a kid's badge toast bouncing over
the parent's report. `run` and `close` were already excluded, for the reason
that a rosette on top of a profit and loss hides the thing it is rewarding.
`parent` and `classroom` are now excluded for the opposite reason: an adult is
reading, and nothing on those screens is addressed to a child. The queue is
held rather than consumed — the badge is still there when the kid comes back.

### What this does not answer

Her other three points stand, and two of them are not code. Nobody has still
played this. `TEACHING.md` has still never been run in a classroom. And the
falsifiable part of the reframe above is simple: if she reads the ladder and
still says *slow it down*, then she meant the clock and this was the wrong fix.

## 42. The market they were promised

The original pitch was that a child learns business on a lemonade stand and
then trades **the real market**. What shipped was subtly less than that, and it
took a customer conversation to see it.

`windowStartFor(seed)` picks a start point uniformly across 263 weeks of real
history and Act 4 runs twelve weeks forward from there. Real prices, real 10-K
filings, genuinely honest data — **and it already happened.** A child was
replaying a recording at high speed.

That single fact is why the product had no reason to be opened on a Tuesday.
You cannot be surprised by a Tuesday that is already in the file.

### Two modes, because one thing cannot be both

The twelve-week replay is not a mistake and is not going away. It is
deterministic, which is what makes challenge codes, the club and the classroom
demand curve work at all; and it finishes in a sitting, which is what lets the
arc have an ending you can demonstrate.

So the arc stays exactly as it is, and a second door opens beside it:

| | The arc | The live market |
| --- | --- | --- |
| Weeks | Twelve, then a finale | No last week |
| Clock | A button | The calendar |
| Window | A random twelve from five years | Anchored to the newest close |
| Ends | Yes — it is a story | No — it is a practice |

The machinery is shared. `advanceWeek` does the marking in both, so drawdown,
"held through it" and every other behavioural fact are recorded identically.
The only two differences in the whole implementation are that a live account
anchors to the newest week and that it never closes.

### The stake is still their own money

A live account is opened once, at the moment the twelve weeks close, with
whatever the kid walked out with at that final week's real prices. Sell the
lemonade stand badly and you arrive in the real market with less. That is the
same rule as Act 4 being seeded from the buyout, carried one step further, and
it is the reason the account is created at the close rather than lazily — do it
later and a kid who starts a new season first arrives with nothing, and we
would have to invent money for them.

### Weekly is the right cadence, not a limitation

The obvious objection is that a week is a slow heartbeat for a habit loop. Two
answers. The daily reason to return is the stand — `skyOfTheDay` gives every
child on Earth the same three minutes of weather, one screen away. And a market
a child is invited to check hourly teaches the single most expensive habit
there is. Once a week is what we would pick with unlimited data.

### It has to be real on the first visit

A live account opened today has done nothing, and a customer being shown this
cannot wait until Monday. The screen says **"Nothing has happened yet"** and
then shows what the market actually did last week — real closes, nothing held,
no invented number. Manufacturing a gain there would undo everything the
mastery layer is for.

### What this is not

Not "all the tickers". Twenty-four recognisable operating companies, and that
is a deliberate safety rail as much as a data limit: an open universe hands a
ten-year-old leveraged products and meme microcaps, reopening through the back
door exactly what "no leverage, no shorting, no options, ever" closes at the
front. Widening to a few hundred consumer-facing companies is a data-pipeline
job and needs the Alpha Vantage key; the shape of the code does not change.

Nor is the data feed what a phone app would ship. `market-data.json` is
refreshed by a weekday cron and committed, so nothing on a child's device calls
a data provider and there is no key in the browser. A phone app would put a
server behind this. **The experience it produces is identical**, which is the
whole job of a prototype.
