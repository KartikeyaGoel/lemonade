# Lemonade — product spec

Read this before writing code. It is the source of truth for what we are
building and why. If a request conflicts with **Non-negotiables**, say so
instead of quietly complying.

---

## 1. The one-line version

A browser game where a kid builds a lemonade stand into a chain, then a shop,
then a public company — and in doing so learns what a business is, what profit
is, what a share of a business is worth, and why anyone would buy one. Then they
take the proceeds and invest in the real stock market with simulated money.

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

**Progression is monotonic — until the market.** Bad decisions cost potential
gains, not accumulated ones. Cap downside hard, because a kid who loses
progress quits. **Act 5 deliberately breaks this**, for reasons in §8.

The floor that enforces it is a *number*, not magic: when it catches a loss the
close screen prints what it put in and says it is the game keeping you open. On
a one-table business the gap was pennies; with a rent and a loan it was most of
the day, and two figures that do not reconcile with the third is the one thing
this list does not allow.

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
| Marketing | A sign bought once, and the extra people it puts in front of the stand | 2 |
| Delegation | A wage buys the kid's own hands back. A second stand is what they do with them. | 2 |
| Cannibalisation | A second stand on a pitch you already work finds half a crowd | 2 |
| Fixed cost, felt | A shop's rent, owed on the day nobody comes in | 3 |
| Break-even | The rent restated as a number of cups you owe before you earn | 3 |
| Weather immunity | Indoors, a cold day is an ordinary day. That is what the rent bought. | 3 |
| Debt vs equity | The shop costs more than the business has. Wait, borrow, or sell a slice. | 3 |
| Interest | Borrow $400, hand back $500, and owe a slice of it on every bad day | 3 |
| Equity & dilution | Cash today for a slice of future profit, on a dial. Then watch it leave, daily. | 3 |
| Valuation multiple / PE | A buyout priced as a multiple of trailing weekly profit | 4 |
| Comparison shopping | Three stands at three multiples; pick the better deal | 4 |
| Growth premium | The growing stand costs more per dollar of profit. Work out why. | 4 |
| Price already reflects news | The obviously-better business is already priced higher | 4 |
| Shares | The company cut into a thousand pieces, and some of them sold | 4 |
| Share price | Company value over share count. Their own, before anybody else's. | 4 |
| Market value | Price times pieces, back the other way, so the two reconcile | 4 |
| Going public | Sell a slice to thousands at 11x, or the lot to one buyer at 8x | 4 |
| A price that moves | Profit against expectation re-rates the multiple. Both numbers on screen. | 4 |
| Public markets | Real companies presented exactly as the kid's own stand was | 5 |
| Earnings yield | Flip the multiple: 8x means 12.5% back a year. Compare to savings. | 5 |
| Diversification | A cap on any single position, which loosens as they hold more names | 5 |
| Drawdown discipline | Prices fall. Holding a good business through it is the rewarded move. | 5 |

## 6. Progression

Five stages, and it was four for a long time. The arc claimed to run from a
small business to a public company and stopped one step short, at a private
sale — so a child met their first share price on Apple, in the market, having
never once had one of their own. That is the wrong way round, and closing it is
what turned "Scale" into two stages and "Ownership" into a listing.

**Act 1 — One stand.** Set price, buy ingredients, run the day, read the P&L.
The whole act is finding the profit-maximising price. Ends after seven days
with a chart of their own price-vs-profit.

**Act 2 — More stands.** The wall: they found the best price and are still
capped at thirty cups by one pair of hands. Capacity upgrades, a helper, a
better pitch. A rival opens and undercuts. Then the manager — which is not a
way to get paid for doing nothing, it is *the kid's own hands back*, and there
is exactly one thing worth doing with a spare pair of hands. Ends on two
pitches, one price, and both of them paying. Growth as arithmetic: one more
stand, again.

**Act 3 — The shop.** The wall: three pitches, a manager and a helper, and the
rain still shuts all of it. A door does not care about the sky. It costs a
fit-out paid once, a rent owed on the day nobody comes, and staff owed whatever
happened — and it is the first thing in the game a kid cannot buy out of profit.
So this is where capital becomes a decision rather than a purchase: wait,
borrow, or sell a slice, with all three on one screen and none of them right.

**Act 4 — Go public.** Three stands for sale at three multiples, ranked, so a
multiple means something before the kid is handed one for their own company.
Then the two ways out: sell the whole thing to one buyer at 8x, or a slice of it
to a thousand people at 11x and keep running it. The gap between those two
numbers is stated as a reason and never as a rule — one buyer takes the whole
thing on, a thousand people are only buying the profit and are bidding against
each other for it. The company is cut into a thousand shares, the price is that
division, and then one week is *lived* as a public company: profit against
expectation, a re-rated multiple, and a price that moved for a reason printed
beside it. This is the emotional peak of the game and should be treated as such.

**Act 5 — Markets.** Simulated portfolio on real market data, seeded with the
proceeds — whichever door they came through. Each company presented the way
their stand was: revenue, profit, margin, and what multiple the market is
asking. Read-only research, then buy and hold. Position caps. No day trading,
no leverage, no options. Ever.

## 7. The readiness gate

"When is it time to trade?" is answered by evidence, never a day count or a
badge. The market stays **read-only research** — the kid can look at real
companies
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
into a wiped-out account. The market caps any single position as a visible, earned
mechanic. A kid should feel the constraint before they understand it.

**Competition and durability.** A kid who has never been undercut has never
asked "why can't someone just do this cheaper?" — and that question *is* moat
analysis. Hence the rival in Act 2.

**Behavioural discipline.** Acts 1–4 are monotonic, which is right for
retention but trains the belief that things only go up — the worst possible
prior to carry into a market. **Act 5 must let simulated positions fall**, and
must reward the kid who holds a good business through a drawdown. The parent
view should report "held through a 12% drop" as evidence, because it is the
best available predictor of real-world outcomes.

## 9. The bridge: where PE actually comes from

The continuity must be arithmetic, not analogy. The kid should see it is
literally the same sum.

```
Act 4   Someone offers $270 for your stand.
        Your stand makes $34 a week.
        270 / 34 = 8      "Eight times weekly profit."

        The public will pay 11 instead, so the company is worth $374.
        374 / 1000 pieces = $0.37 a piece.
        That is a share price, and it is theirs.

Act 5   A share costs $X. The company earns $Y a share a year.
        X / Y = 25        "Twenty-five times yearly profit."

Same division. Bigger numbers. That ratio is called PE.
```

The middle block is the part that used to be missing, and it is one division
rather than a new idea: the same sum the buyout produced, divided once more by a
share count. A kid who has done it on their own company is not meeting a share
price for the first time on Apple.

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
| Investment club | Act 5 | their own money in a real company |
| Seasons | after the finale | a finished run to start over from |

**It is made of the arc, not bolted beside it.** A badge is not "played 10
days" — it is *"held your price while somebody undercut you"*, which is a
business concept with a name. The words are the vocabulary the arc already
produced. The challenge is the same lemonade week on the same weather. The club
is the market with three friends and a vote. There is no second game here; there is a
record of the first one.

**Its only job is repetition.** Nothing durable is learned in forty-five
minutes. A kid who plays four times learns roughly four times as much, and the
fourth play has to come from somewhere. That is what the trophy case is for. It
is not the sugar around the lesson — it is what gets the lesson taught again.

So: during and after. Never before, and never instead.

## 15. Why they come back

The five stages run about an hour. A game that ends in an hour
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
Then a buyer prices the business, and a stand with punch-card customers earns a
**higher multiple on the same profit.** The kid discovers that predictable money
is worth more than the same amount of lumpy money, by being paid for it.

That is the exact reason Netflix and Coca-Cola are priced the way they are, so
every company in the market carries its model and one line about what the model does to
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
because it went up.* So in the market money does not move until the kid has written
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
always the kid's own* — and for a while the real-company figures were the one
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

**The market replays a real twelve weeks.** The kid's seed picks a window out of the
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
3. **The club, in the market.** A shared portfolio passed between phones, where a
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

A sequence has an end, and an end is a place people leave. Five stages, a finale
and a reckoning is the right shape for a story and the wrong shape for a
practice — a kid who finishes reads it as finished, and financial literacy is
not something you finish.

Clash Royale has no timeline. Clash of Clans *does* — every building is gated
behind a Town Hall level — but it never presents as one: it presents as a
village with tabs, where the sequence is invisible scaffolding and the loops sit
beside each other. That is the model, and three changes bring this product to
it.

**The road, on the title screen from the first launch.** Five stops with the
market visible and padlocked at the end. Not navigation — nothing on it is
somewhere you can go — a *picture*, because the problem it solves is
motivational, not navigational. A kid interested in finance used to open this,
see a lemonade stand, and have no way of knowing a stock market was in it. The
line underneath is the only place the product says out loud what it is for:
*learn it on lemonade, then do it with real companies.*

**The Saturday stand.** The stand does not die when it is sold. Once a week, in
the market, twenty dollars comes out of the investing account as working capital, the
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

This game had decisions but no deck. A kid could play the market well and still not
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

**They are wrong as written.** Five stages, seven days, a fortnight and twelve
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
| How do I sell more than my own two hands can? | Capacity, capital, hiring and competition |
| What do I owe on a day nobody comes? | Fixed costs, operating leverage, debt against equity |
| What is one piece of my company worth? | Valuation, ownership, shares and share price |
| Whose business do I want a piece of? | Public markets, and reading a filing |

`src/lib/curriculum.ts` groups the fifteen `mastery` skills under those five
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
history and the market runs twelve weeks forward from there. Real prices, real 10-K
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
same rule as the market being seeded from the sale, carried one step further, and
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

---

## 43. Pip, and the two things a real kid told us

The first middle schooler to play this quit on day eighteen, bored, and
described the end-of-day statement as so much text that he skipped it. Both
complaints turned out to be the same problem, and neither was a shortage of
things to do.

**He had no goal and no finish line.** The goal strip on the stand was wrapped
in `dayLabel === undefined` — true in Act 1, false in every act after it — so
the objective vanished on day eight and never came back, and the header dropped
its `/ 14` at the same moment. Day eighteen is Act 2, day eleven of fourteen:
three days from the sale the whole arc is built towards. Act 2's aim existed as
a finished string on the one screen he had no reason to open.

**He had nobody to talk to.** `grep -rn "<Coach"` found five speech bubbles, all
five in Act 1's first day, all five interface instruction. The game has a voice
for one day out of twenty-one.

So: Pip. Six moments, every one on a screen that already existed, no screen
added and nothing gated.

**The rule Pip exists under, which is not a style preference.** Pip may name
what happened. Pip may never say what to do next. *"You sold every cup. Sixty
people wanted one and you had thirty-two"* is observation, and it leaves the
decision where it belongs. *"Make more cups tomorrow"* is the game playing the
game: it destroys the demand curve the kid is here to discover, and it turns
every claim in the grown-up report into a measure of how well a child follows
instructions. A kid who did what the duck said has taught us nothing we can
honestly report to his mother. Stating the *objective* is not advice; naming a
cost line is not advice; suggesting a price, a batch or a purchase is.

**Why Pip makes the ledger collapsible, and the risk in that.** From day four
the statement folds and Pip carries one line of it out front. Twenty-one
renders of a dozen rows were never twenty-one readings — they were three
readings and eighteen skips, so the exposure was already worth nothing. The
real risk is the opposite one: a summary good enough that the ledger is never
opened again would swap a fact the kid can check for an adult telling him he
did well, which is worse than the wall. Three things prevent it:

- Pip names a *line* of the statement and its real number, never the profit on
  its own, so the sentence is one number short and the missing number is in the
  ledger.
- The line follows whatever actually decided the day, so across the arc a kid
  who only reads Pip still meets revenue, ingredients, the costs owed anyway,
  spoilage and capacity — one at a time, which is the same decision this spec
  already made about vocabulary.
- `ledgerStartsOpen` overrides the fold on any day carrying a row he has never
  seen, and says so: *"Something new today: first losing day."* He can never
  miss a new line item. He only ever gets the folded version of a statement he
  has already read three times.

**The line nobody was saying.** *Every stock is somebody else's lemonade
stand* is the first line of this spec, the first line of the README and the
spine of the pitch — and until Pip it was never once said to the child playing.
It is now the payoff beat on the market screen, and the opening beat on the
title screen is its other half.

---

## 44. The stage the arc was missing, and what adding it found

The customer sat down to draw the Level 1 gameplay arc and said it should run
from a small business to a public company. Most of it already did. One stage did
not exist and one was doing two jobs, and the gap turned out to be the exact
place the product's own thesis pointed:

> A child met their first share price on **Apple**, in the market, having never
> once had one of their own.

`FRAMEWORK.md` is the audit that established it — eight lenses, four stages,
twelve concepts, each marked against the code. The short version was that
revenue, cost, margin, profit, capital, competition, value and growth all had
mechanics; marketing and ownership were partial; and **shares** and **stock
price** existed only for other people's companies.

### What changed

**Act 2 split in half, on the manager.** "Runs the stand without you" was sold
as a way to get paid for doing nothing, which is true and is the least
interesting thing about it. What a manager actually buys is *the kid's own hands
back*, and there is exactly one thing worth doing with a spare pair of hands. So
opening a stand is gated on having hired somebody, and the reason is not a rule
— it is that somebody has to be at the first one. A child who works out "I can't
be in two places at once" has worked out why companies hire, which is a better
lesson than any wage line. The act now ends on two pitches, one price, and both
of them paying.

The number that makes it a decision rather than a purchase: a second stand on a
pitch you already work finds **half a crowd**. Two stands on one pavement look
twice as good on the shop screen and are not, and the close screen prints both
stands' takings so the thin one is visible the next morning.

**A shop went in between.** The wall is the sky: three pitches, a manager and a
helper, and `WEATHER_MULTIPLIER.cold` still takes four customers in ten away
from all of it. A door does not care. What a door costs is the lesson — a
fit-out paid once, a rent owed on the day nobody comes, staff owed whatever
happened — and it is the first thing in the game a child cannot buy out of
profit. So this is where capital stops being a purchase and becomes a decision:
**wait, borrow, or sell a slice**, all three on one screen, none of them right.

Waiting is on that list deliberately. It is the option a game normally hides,
and it is genuinely the cheapest of the three — it just costs the one thing a
child feels most.

**The investor offer moved here from the ownership act.** It used to arrive
where the kid did not need the money, which made it something to read rather
than something to decide, and §4 is explicit that no concept goes in before the
wall that motivates it. It also became a **dial** rather than a fixed 20%: the
slice is the decision, and the three consequences — cash today, the piece kept,
and the profit a week that now belongs to somebody else — move as it moves.

**The ownership act became a listing.** The buyout did not go away and should
not; selling is a real outcome and it is the one the game used to have. It is
now one half of the decision that ends Level 1:

> Sell the whole thing to one buyer at 8x, or a slice of it to a thousand
> people at 11x and keep running it.

Both answers are defensible, which is what makes it worth asking. The gap
between the two multiples is stated as a *reason* and never as a rule: one buyer
takes the whole thing on — the lease, the staff, the early mornings — so they
want it cheap; a thousand people buying one piece each are only buying the
profit, and they are bidding against each other for it. That is why companies
list rather than sell up.

Then the arithmetic, one division further than §9 used to go: the company is cut
into a thousand shares and the price is `value / 1000`. And then — the part that
does the actual work — **one week is lived as a public company.** Profit against
what the market expected, a re-rated multiple, and a price that moved with both
causes printed beside it.

### Three numbers that had to be got right

**The price must move less than the profit did.** Two things move on one week's
news — what the market expects, and how many weeks of it the market will pay —
and they multiply. At the first sensitivity tried, a company that earned double
for one week saw its share price go up 124%, which teaches a child that a share
price is a scoreboard with a multiplier on it. That is worse than teaching them
nothing. A test now holds the invariant across the whole range.

**Every move is attributed.** Two numbers cause it, both are printed, and the
sentence names which one did the work. A price move a child cannot account for
teaches that prices are weather, and that is the belief that turns a market into
a slot machine.

**A fall is not dressed up.** Berry, downwards, with the earnings number that
caused it beside it, and the business stated to be the same business it was last
week. §8 calls behavioural discipline one of the three things that would cause a
bloodbath; this is the first place in the game a child can practise it on
something of their own, before they ever see it happen to a stranger's company
with fake money.

### What the restructure surfaced

Rebuilding the middle of the arc pushed on parts of the game that had never had
weight on them, and most of what follows was already broken — the new stages
just made it visible. Each of these was found by playing, in a browser, on a
phone-sized viewport.

- **The cash floor was inventing money silently.** The mercy rule is right and
  stays. But with a rent, a second pitch, a wage and a loan repayment, a bad day
  quietly printed most of a hundred dollars into the cash box behind a sentence
  that said only *"your original $20 is protected"* — so the two figures on the
  ledger's cash line did not reconcile with the profit above them, in the one
  screen a child is told they can check by hand. It is a line item now.
- **The rival was competing everywhere.** A boy with a folding table outside the
  kid's house was taking half the customers out of a shop on the high street and
  a stand at the park gate. The pitch-level answer was being applied to the whole
  business, which was the only sensible thing to do while the whole business was
  one table. It is weighted by crowd now, and he hurts less the bigger the rest
  of the business gets — which is what happens to a corner shop when somebody
  opens a stall outside one of its branches.
- **`dailyBurn` was a hand-rolled copy** of the day's cost lines, correct for one
  stand and silently short by a pitch fee, a minder, the rent and the loan the
  moment any of those existed — in the one number that tells a child whether a
  quiet day is survivable.
- **The parent report claimed a sale that never happened.** The public float was
  written into `ownership.equitySoldPct`, which half the game reads as "the slice
  Auntie Ro bought" — so a child who borrowed for the shop and then listed was
  reported as having *"taken $0.00 up front in exchange for 30% of every future
  profit"*. In the one screen whose entire job is to be trustworthy.
- **The finale told everybody they had sold up**, at a multiple of nothing, and
  told a founder who listed that they had *"started with $0.00"* while the
  account in front of them held the float. Six places worked out the portfolio's
  starting figure for themselves; there is one now.
- **A badge became unearnable.** `kept-the-whole-thing` reads `equityOfferSeen`,
  and when the offer moved into the three-way funding choice there was nothing
  left to set it. Same defect as the manager in §40, arrived at from the opposite
  direction — so `tests/reachable.test.ts` now asserts the property rather than
  the instance: every badge has some reachable state that earns it.
- **Three things were written, tested and wired to nothing.** Shop staff could
  never be hired, the per-stand takings were computed and never rendered, and the
  loan's interest was never named. All three are now reachable, and a dead-export
  sweep is part of the review.
- **The badge toast was eating taps on the button underneath it.** It lifts clear
  of a pinned action bar, and the lift was a fixed 128 pixels — right for a bar
  with one button, wrong the moment the planning screen grew a second. Worse, the
  padding that does the lifting is still part of the button, so it went on
  swallowing taps on the bar beneath it: a child aiming at "Open the stand!"
  dismissed a rosette and nothing happened. Invisible in a screenshot; only
  hit-testing finds it. The bar publishes its own height now and the frame does
  not capture pointer events.
- **`mint-deep` and `berry-light` were used in three places and defined in
  none.** Green for good and pink for bad had silently stopped being either.
  Both are real now and both are measured.
- **A 320-pixel phone wrapped the ledger.** The monospaced rows ran a few pixels
  past the card, so labels wrapped and left their own figures on the line above.
  A number that has come away from its label is worse than no label.

### What a first-time player asked

Two questions, both fair, and only one of them a bug.

> *"There is only a price slider — you're telling me I can adjust sweetness and
> lemons but I don't see a slider."*

There isn't one, and there should not be: the recipe is fixed, so the batch is
the single bet and a second and third dial for ingredients that follow from it
would be three taps to say one thing. But the question was fair, because the
receipt used the exact visual grammar of every *tappable* row in the game — bold
name left, price right, same as the plots in the yard and the companies in the
market. It reads as a receipt now, under a heading that names the slider as its
cause.

> *"Hiring a manager is part of expanding, not a separate thing."*

Yes — and that is now exactly what it is. See the first change above.

### The dead-code sweep, and the one thing it removed that we want back

Every export in `src/` was checked for a caller. Fourteen had none, all of them
predating this work, and each one turned out to be one of three things:

- **A live mechanic reached the long way round.** `recordClubWeek` and
  `recordClubWin` existed and `page.tsx` incremented the career counters itself,
  so the only place that knew a club week had happened was a component. Now
  routed through the functions named for it.
- **A number the product cared about and never printed.** `PRICES_SOURCE` was
  written for the provenance line on a company card, which credited the filings
  and left the prices as "real weekly closes" — a claim with no source attached.
  §21 makes a point of there being two sources; both are named now.
- **Genuinely superseded.** `openCompanies` duplicated the live tier logic,
  `suggestedShoppingList` predated `batchPlan`, `priceAtWeek` and `weeklyReturn`
  predated `currentPrice`, and `SNAPSHOT_IS_APPROXIMATE`'s own comment said it
  was vestigial. Deleted.

**And one gap worth naming rather than quietly deleting.** `clearEverything`
wiped the run *and* the trophy case, with a doc comment that said it was "only
reachable from the parent view, and only with a confirmation". It was reachable
from nowhere. The code went, because dead code with an aspirational comment is
exactly what §40 warns about — but the gap it described was real, and §45 is
what closing it took.

## 45. The one destructive control

`PRIVACY.md` tells a parent that their child's data is theirs, lives in their
own browser, and can be deleted. Until §44's sweep found the dead function that
claimed to do it, the whole of that last clause was *"clear the browser's site
data"* — which is true, and is a shrug. A promise you can only keep by talking
somebody through a settings menu they have never opened is not a promise.

So there is now one place in the product that destroys something, and every
decision about it runs the other way from the rest of the design.

**It contradicts the game on purpose.** Everything else in `storage.ts` is
built around keeping the two slots apart: the run is disposable and the career
is not, and that separation is the only reason a new season is safe to press. A
child who thought "start again" might cost them their badges would never press
it, and the replay is where the learning actually sticks. This function takes
the trophy case. It is the sole exception, it says so in its own doc comment,
and nothing else in the codebase may call it.

**It is small print, not a button.** Bottom of the grown-up document, below the
dinner question, styled as a line of underlined text rather than as an action —
because it has to be genuinely findable by the one person looking for it and
genuinely uninteresting to everybody else. There is no route to it from the
child's side of the app at all.

**It counts what it is about to take.** *"12 badges and 9 words earned, 3
seasons of play, the name Ada"* is a sentence a parent can weigh. *"All
progress"* is not, and a confirmation nobody can weigh is a speed bump rather
than a question. The way out is the ghost button above the destructive one, so
the tap that does the damage is never the tap already under a thumb.

**It reports what it actually removed**, from the keys the storage layer says
it deleted rather than from the list we meant to delete. Same principle as §36:
what the software displayed is not evidence of anything, and "we deleted six
things" is a claim.

### The trap underneath it

Deleting the keys is the easy half. The hard half is that `page.tsx` writes
every slot back on any state change — so the obvious implementation, which
hands the game a fresh `createGame()` and `createCareer()` afterwards, re-creates
four of the six keys within a tick and leaves the confirmation screen asserting
a deletion that partly un-happened. The in-memory slots are set to `null`
instead, which is the state their save effects skip; the class board is left
untouched so its unconditional effect never re-runs; and then the page reloads,
so what the parent gets back is a process that booted from empty storage rather
than one talked into looking empty.

`tests/erase.test.ts` lists all six keys by hand rather than importing them
from the module under test, because a list that comes from the same place as the
code cannot catch a seventh slot that forgot about the deletion. It also makes
the re-creation mistake on purpose, so the reason for the nulls is written down
somewhere a refactor will read it.

## 46. Two more found by playing it

The sweep that built §45 walked the arc again end to end — a player who buys
nothing, and a player who hires, opens a second pitch, borrows for the shop and
then sells the lot — at 375 and 320 pixels. Two defects, both pre-existing,
both invisible to the test suite and to a screenshot.

**The cash box did not close.** A $10.02 loss took the cash box from $250.00 to
$240.90, and nothing on the screen accounted for the ninety-two cents. The
cause is real and is not a bug: profit charges the lemons a child *used*, cash
pays for the lemons they *bought*, and those differ on any day the pantry is
not empty at both ends. Cash-is-not-profit is one of the things this game
exists to teach.

But §4 does not say the two figures may differ — it says any two figures shown
together must reconcile with the third on paper, and this is the one screen a
child is told they can check by hand. On a single folding table the gap was
pennies. With three pitches, a wage, a rent and a loan repayment it was a
visible number sitting in a ledger with no name on it, one line under a
"Profit" figure it contradicted.

So the pantry has a line now — *"From the pantry, +$0.78"*, with the reason
underneath — and `tests/pnl.test.ts` holds the identity across a week of
deliberately erratic shopping, including days that buy nothing at all.

The first attempt at that line spelled itself out in full and **wrapped**,
leaving `+$0.78` attached to the first half of its own label. Same defect §44
found in the ledger at 320 pixels, reintroduced by the fix for something else.
It uses the short-label-long-reason grammar every other row in the ledger uses,
which is the only shape that survives the narrow case.

**Every sheet in the game closed through a 24-pixel button.** `Sheet`'s "Done"
chip was `px-2.5 py-0.5` — 57 by 24, against a 44-pixel minimum, on a control
belonging to a nine-year-old's thumb. The chip is unchanged; the *button* is 44
now, with the extra height pulled back out by a negative margin so the header
is the same size it was. One component, so every sheet in the product.

### On false positives

The sweep was automated — a driver that walks the arc clicking primaries and
audits each screen for horizontal overflow, small tap targets and covered
buttons. Three of its findings were not defects, and they are worth naming
because each looks exactly like a real one:

- **The badge toast reported itself as covered**, on every screen. Its rect
  includes the transparent padding that lifts it clear of the action bar, and
  at the centre of that padding the thing on top *is* the bar — which is the
  §44 fix working. Settled by hit-testing the visible rosette: the card
  dismisses on a real tap, and the primary button underneath is reachable at
  the same moment.
- **The first company card in the market** sat under the bottom bar at scroll
  zero. It is below the fold, not covered, and the list scrolls 1,909 pixels.
- **"Count up the money" measured 26 pixels tall** — the first frame of the
  `popIn` keyframe, which starts at `scale(0.4)`.

An audit that cannot tell an intentional overlay from an accidental one will
report both. The rule that came out of it: a covered button is only a defect if
it *starts* above the bar, and the only proof is a dispatched pointer event.

## 47. Why every UI pass kept finding bugs

Two sweeps in a row found new defects, which is a bad sign about the sweeps
rather than a good sign about the diligence. The cause was the method: both
walked the game and audited whatever screen they landed on, so coverage was a
side effect of which route the driver happened to take. Each pass reached
screens the last one had not, and each new screen had something wrong with it.
That is not converging on zero. It is crawling.

So this pass changed the question from *"are there bugs left"* — which cannot
be answered — to two that can:

**Which screens have never been looked at?** There are 33 phases in
`page.tsx`. Roughly twenty had been audited; the entire meta-game had not — the
trophy case and its five tabs, the club and its four, friends, the table, the
challenge screen, the playbook, the classroom, the thesis flow, the reckoning,
the live market, the readiness gate and the finale. Reaching them by playing is
impractical, so the fixture is now built by the app's own modules: a save at
Act 5 with a listing, a portfolio mid-run, a real club, every badge and every
word. All 33 phases have now been measured at 375 and 320 pixels, plus the
sheet, the toast, the announcement cards, a company card and the crash screen.

**Which bug classes have been found once and therefore exist elsewhere?** Every
defect so far has been one of two kinds, and both are greppable.

### The class that was on eleven screens

`ParentScreen` padded its content with `pb-28` under a bar that measured 218
pixels. The fix at the time was local. The grep afterwards found **eleven more
screens with the same hand-guessed number**, and one of them was broken in a
way nothing would ever have reported: on the live-market catch-up screen the
last row of the week's prices sat **47 pixels under the bar with 2 pixels of
scroll available to reach it.** Not clipped, not faint — unreachable, behind a
gradient that makes it look deliberate.

`PinnedBar` now imposes only the pinning, so each screen keeps its own
z-index, padding and background; `clearsBar()` is the one place the arithmetic
happens; and `tests/layout.test.ts` fails if a component pins a bar itself, or
renders a `PinnedBar` without using the measurement, or leaves a guessed
`pb-2x` behind. The class is extinct rather than patched.

### The class that was on three more

A 24-pixel "Done" chip closed every sheet in the game. The grep found the
`Cancel` on the thesis screen at 26 — the way out of a decision about money —
and *"or go back to the start"* on the crash screen at **16**, which is the
escape hatch on the one screen a child reaches when everything else has already
failed. It was the smallest tap target in the product. Also caught: the delete
link added in §45, at 18.

The threshold is deliberately not 44. A row of five navigation chips on the
title screen is 38 and should be; WCAG 2.5.8 asks for 24. The test flags a
button whose *padding alone* puts it near 28 or below, and exempts anything
with an explicit height, because that is what the fix looks like.

### The one crash, and what it was really about

The Friends screen threw `Cannot read properties of undefined (reading 'cash')`
on the fully-unlocked fixture. The immediate cause was the fixture's own
malformed club, so it is not a bug a child could hit today — but it pointed at
one. `decodeClub` validates a club arriving from **another kid's typed code**,
with a comment about doctored tickers explaining exactly why. A club arriving
from **this kid's own `localStorage`** was `game.club ?? null`: no check at all,
in a file where the portfolio, the career, the class board and the live account
are each validated and each say why.

A stored club missing its `portfolio` takes the friends screen down with
`totalValue(undefined)` — the error boundary, on a screen reachable from the
title, with nothing to do about it but clear the browser's site data. Both
doors go through `reviveClub` now, and it drops rather than repairs, for the
same reason the live account does: a half-restored club would print a pot and a
vote count that are not true.

### What this still does not prove

Coverage of screens is not coverage of states. Every screen has now been
measured in at least one state at two widths, and the two bug classes are held
shut by tests — but a screen has many states, and the fixture is one of them. A
third viewport, a landscape phone, a real device with a notch, and an actual
child's thumb would all still find things. The honest claim is narrower than
"no UI bugs": **every screen has been reached and measured, and the two defect
classes found so far can no longer recur silently.**

## 48. Covering the states, and attacking the code

§47 covered every *screen*. The honest caveat at the end of it was that
coverage of screens is not coverage of states, so this is that — plus the
adversarial half, which is a different activity and found different things.

The first move was to stop guessing and measure. Coverage, per layer:

| Layer | Before | After |
|---|---|---|
| `src/lib` statements | 91.1% | 91.8% |
| `src/lib` branches | 86.6% | 88.4% |
| `src/components` statements | **26.1%** | **79.1%** |
| `src/components` branches | — | 80.5% |

Eighteen screens were at exactly zero. Everything that had ever been tested was
a screen somebody had happened to walk through, which is precisely how a crash
sat unnoticed on the friends screen.

### What the state matrix is, and is not

`tests/ui/states.test.tsx` renders every screen across the branches its own
code takes and asks three things: it does not throw, it puts something readable
on screen, and **no figure shown to a child is `NaN`, `Infinity`, `undefined`
or `null`**. That third one is the one that earns its keep. A React component
handed a bad number renders happily and prints `$NaN`, and a coverage
percentage is delighted.

It does not assert layout. §47 holds the layout rules as source facts, a
browser holds the rest, and a jsdom test that claimed to know pixel positions
would be lying.

Where a screen's states live behind a tap rather than a prop, the tests tap:
the trophy case's five tabs, the club's four sub-screens, the playbook's rule
picker, a company card for **every** company in the snapshot, and both dials on
the planning screen at each end of their range. `PlanScreen` is 850 lines with
the game's two most important controls and sat at 23%; two thirds of it only
exists after a tap.

### Four defects, and the fuzz found the worst one

`tests/fuzz.test.ts` runs three thousand randomised days — prices, orders,
upgrades, staff, rents, loans, investors, subscribers, skies — and asserts
invariants rather than answers: the P&L closes, the cash box closes, nothing
shown is non-finite, the same seed gives the same day, and the crowd is the same
size whatever the price.

**It caught the fix from §46 being wrong.** The pantry line closed the cash box
on every day *except one with spoiled lemons*, where it was short by exactly the
value of the fruit thrown away. The reconciliation needs three terms — what
today's cups drank, what went in the bin, and what actually left the cash box —
and it shipped with two. Nothing would have noticed: the case is uncommon, the
figure is small, and it looks like rounding. It failed on the eighth randomised
day. `tests/pnl.test.ts` now also pins the case by name, including an assertion
that the two-term version *does not* close, so nobody simplifies it back.

**A mistyped order could poison the whole day.** `Math.max(0, Math.floor(x))`
is `NaN` for `NaN`, one line under a comment promising a mistyped order could
not hurt anything. One `NaN` in the order makes the ingredients `NaN`, then the
profit, then the cash, and the close screen prints `You made $NaN` over a ledger
of blanks. Nothing in the UI can produce it — every dial is numeric — but a
decoded share code and a hand-edited save both can. It also now caps the count,
because `1e12` lemons is not an overdraft, it is a hang: the purchase clamp
walks an order down one unit at a time.

**Buying at a price of zero bought infinity.** `shares = spend / price`,
unguarded. The holding was then permanently unprintable, worth `Infinity`, and
poisoned every total on the screen. Real closes are never zero, which is why
nothing had tried it; a restored save this program did not write, and a ticker
whose week is missing from the data, both are. Refusing is the only honest
answer — there is no number of shares that `$100` buys at a price of nothing.

**The live market's first week was priced in fractions of a cent.**
`createLivePortfolio` seeded week 0 straight from the file while every week
after it went through `realClose`, which rounds. So a child's first weekly
report showed a fraction-of-a-percent move on a week the data says nothing
happened in — in the one list whose entire job is to say what actually moved.
An existing test had pinned the unrounded value; its *intent* was about which
week the account sits on, and that is unchanged.

### The adversarial pass

Three surfaces, attacked rather than demonstrated.

**The codes.** `PRIVACY.md` boasts that there is no backend, so nothing a child
does can reach another device — except through one door: the short codes
children type out loud to each other. That is the whole untrusted-input surface,
and the thing on the other end is another nine-year-old who will eventually
work out that the code means something. `decodeClub` already had a comment
about doctored codes; `tests/adversarial.test.ts` asks the same question of all
six decoders against twenty-eight hostile strings — empty, a hundred thousand
characters, unpaired surrogates, right-to-left overrides, `__proto__` payloads,
lookalike prefixes — plus **every truncation** of a real code (the likeliest
real failure: a child reads one out and drops a character) and every
single-character substitution, because a typo silently becoming a *different
week* is worse than a rejection: the two children then compare results from
different skies and the feature is quietly lying to them. All six hold.

**The save.** Fifteen malformed saves, and two got through. `migrateAct` was
`game.act ?? 1`, which defends against a missing act and passes `-3`, `999` and
`"five"` straight into a stage that does not exist — `ACT_TITLES[act]` is then
`undefined` and the act-intro screen reads its `.name`. And `??` is the wrong
tool for anything that gets arithmetic done to it: `learned: 7` survived into a
field on which `.includes` is called in about thirty places. Every numeric field
in a save is read from a file this program did not write, so they are coerced
now rather than defaulted.

**The clock.** The live market is the one part of the product that ages: it
replays a bundled snapshot of 263 real weeks and then invites a child to trade
the ones nobody has seen. `tests/clock.test.ts` covers both futures — the file
going stale for a year, and the file rolling under a saved account — plus dates
before the window, after it, and malformed. This part turned out to be
genuinely well built: it anchors on a *date* rather than an index, re-seats on
roll, and clamps at both ends. Only the seed-rounding was wrong.

`tests/degenerate.test.ts` is the other half: an audit found about a dozen
divisions with no guard on the denominator, so every one of them is now called
with its degenerate input — a business with no days, a company with no revenue,
a holding that cost nothing, a listing with no shares, a classroom board nobody
has typed into, a playbook whose rules exclude every company. Eleven of twelve
were already guarded. The author had been careful; `buy` was the exception.

### What is proved, and what is not

926 tests. Every screen reached and measured, every screen rendered across its
prop states and its tap states, three thousand randomised days against five
invariants, six decoders against twenty-eight hostile inputs, fifteen malformed
saves, and every unguarded division called with the input that would break it.

Not proved: **85% is not 100%.** `page.tsx` — 2,174 lines of state machine — is
still only exercised through a browser, and the remaining uncovered branches in
`MarketScreen`, `ClubScreen` and `PlanScreen` are mostly deep interaction paths.
A property test is only as good as the invariants somebody thought to write
down; the cash-box identity existed for one day before the fuzz proved it
incomplete. And no amount of this replaces a nine-year-old with a real phone.

## 49. Coverage, from 78% to 95%

The instruction was to cover every state, so the first job was to make "every
state" a number. Coverage, by layer:

| | Before | After |
|---|---|---|
| **All of `src`** | 78.1% statements | **95.2%** |
| Branches | 84.7% | **89.0%** |
| Functions | — | **91.6%** |
| `src/lib` | 91.1% | **97.6%** |
| `src/components` | 26.1% | **93.4%** |
| `src/app/page.tsx` | **0%** | **89.8%** |
| Tests | 926 | **1081** |

`npm run coverage` reports it, and `vitest.config.ts` now fails the build below
93/86/89. That threshold is the durable part: the component layer was once at
26% with eighteen screens at zero, and nothing noticed because nothing was
measuring.

### `page.tsx` was the whole argument

2,174 lines at zero. Not a screen — the state machine: thirty-three phases,
forty-odd handlers, and every wire between the pure modules and the components.
Which makes it precisely where §40's defect class lives, and both instances
this project has found were in it.

It is driven now the way a child drives it: click the thing, see what happens.
Four suites, and the distinction between them matters more than the count.

**`journey`** plays the arc — a whole first week, each stage resumed, every door
off the title screen opened and closed, and a boot from a corrupt save.

**`handlers`** presses one control per handler and then reads *the save on
disk*. Every assertion in it is hard, and that is the point: the first pass used
`if (await tap(...))`, which passes happily when the button is not there — so a
handler that had quietly stopped being reachable produced a green test and no
coverage, **which is the exact failure the file exists to catch.**

**`pacing`** counts cards. `handOverOne` is the enforcement of §26 — the listing
earns four words at once, and putting four through the full-screen card is the
stacked-panels failure §26 already records and fixed once. A pacing rule is
invisible in a unit test and invisible in a screenshot; it is only visible in a
sequence. So the assertion is a count taken at every step: never two cards at
once, nothing silently dropped.

**`deep`** opens the screens hiding inside other screens — `FaceoffView`,
`CompareView`, the playbook's backtest, the club's proposal card. Half a dozen
components here are two or three screens wearing one export, and the *second*
screen is usually where the teaching is: the deal board's first screen asks
which stand is the best buy, and its second explains why. None of those had
ever rendered.

### Three things worth keeping from the exercise

**A whole module was untested and it was the one keeping a rule.**
`facedown.ts` sat at 1.9%. Its own doc comment states the rule it exists for —
*"it never says which one to buy [...] a kid who leaves the market believing
'low P/E good' has learned something false, and would have been better off
learning nothing"* — and nothing was checking it. Every pair of companies in
the snapshot now goes through it and the assertion is that no row and no
summary ever recommends one.

**Two more save-loading holes, same class as §48's.** A save carrying
`history: "lots"` reached the running game and the first `.reduce` took the app
down; `portfolio: "none"` spread a string into an object and died inside
`Object.entries(undefined)`. `reviveStand` and `revivePortfolio` rebuild both
field by field — *per field*, not all-or-nothing, because throwing away a
child's fortnight over one bad field is the worse outcome. A nested half-loan
gets the same treatment, since the parent report prints it.

**`Infinity` on a screen.** `DEFAULT_DAY_PARAMS.serviceCapacity` is
`Number.POSITIVE_INFINITY` — correct, nothing caps a folding table but the
pantry — and `Math.floor` of it is still `Infinity`, printed into a row as
*"Cups you can serve in a day: Infinity"*. Not reachable today: Act 1 does not
render that sheet and every act that does passes a finite capacity. One omitted
prop from being reachable, and *"as many as you can pour"* is a better answer
than a number anyway.

### And four fixtures the app was right to refuse

Worth recording because it is the same lesson four times: a `$300` buy out of
`$800` was refused by the position cap (37% of an account, and no single company
gets a quarter of a child's money); a club with no `portfolio` was refused by
`reviveClub`; a loan built by hand instead of by `loanQuote` produced the `NaN`
I briefly took for a bug; and `deriveAct2Insights` declined to hand over
"compounding" to a business that had never bought anything, which is right —
*"profit bought capacity that made more profit"* is not a true sentence about a
stand with no cooler. **Every one was my fixture, and `as never` hid three of
them.** Build fixtures from the real constructors.

### The residue, counted honestly

**746 uncovered statements, and they are not 746 unexamined ones.** Classified:

- **4** are guards TypeScript requires and the render path makes unreachable —
  `if (!game) return` inside a handler that only exists below the guard which
  already returned.
- **1** is a storage refusal already covered from the other direction.
- **64** are one-off copy branches: the third variant of a sentence that
  changes with the weather, the plural of a word.
- **677** are a genuine long tail, concentrated in five files —
  `page.tsx` (128), `PlanScreen` (108), `ChallengeScreen` (88), `ClubScreen`
  (46), `PlaybookScreen` (42).

So: **not 100%.** The last five points are reachable, and each further point
costs more than the one before it while buying less. What is worth saying about
them is that they are now *enumerated* rather than unknown, the floor stops them
growing, and none of them is a screen or a handler that has never been looked
at — which is what the number meant before this.

The deeper caveat from §48 stands and this work sharpened it: coverage is a
measure of what ran, not of what is right. Every defect this project has found
was found by an assertion somebody thought to write. The cash-box identity
existed for one day before a fuzz proved it incomplete, and 100% coverage would
not have caught it either.


## 50. The bricked save, and what a browser found that 1,081 tests did not

§49 ended by claiming the residue was enumerated rather than unknown. That was
true about *coverage*. It was not a claim about correctness, and the next thing
that happened proves the difference is not academic.

Three things were asked for: a dead code sweep, a full browser playthrough, and
an adversarial review. The adversarial pass was already done (§45–§48). The
other two were not, and one of them found a bug that cost a child their run.

### The bug: closing the game at the end of a week destroyed it

Reproduced from a cold load, pressing only real buttons:

1. Finish the seventh day. The week screen says the week is over.
2. Close the app. This is the most natural moment in the entire product to put
   it down — the game has just told you that you are finished.
3. Reopen. Press **Keep going**.
4. You are on the morning screen of day 6 of a week that is already over.
5. Open up shop → set my price → **Open the stand!**
6. Nothing happens. Ever.

`start` — the resume — routed every Act 1 save to `'morning'` with no check on
`stand.status`. Three taps later the primary button calls `runDay`, which
enforces "a week is seven days" by throwing. **React does not route a throw
from an event handler to an error boundary.** So `error.tsx` never appeared,
the console error was invisible to the player, and the button was simply dead.
There was no way out from inside the game.

Only Act 1 and a duel can reach it: every later stage passes `lastDay: null`
and never finishes a week. Which places it on **the first week every child
plays**.

Two fixes, and the second one matters more than it looks:

- `start` sends a finished week to the week screen.
- `openStand` refuses a finished week towards that screen instead of calling
  `runDay`. Now redundant, and kept anyway — because the lesson is not "guard
  this state", it is **a lib guard that throws, called from an event handler,
  produces silence**. A dead button is indistinguishable, to a nine-year-old,
  from a game that has stopped working.

**Why 1,081 tests missed it.** Every one of them reached the week screen by
pressing through the close screen, which is the only route that cannot hit
this. The bug lived in the gap between "the game can reach this screen" and
"the game can *resume* onto this screen", and nothing had ever resumed from a
save left on disk. `tests/ui/resume.test.tsx` now asserts the general property:
whatever screen a resume lands on, its controls must do something.

### The dead code sweep found nothing, which is the useful result

`scripts/check-dead-code.mjs` is now a build gate. It reports zero exports that
nothing names — the `clearEverything` class of §44 does not exist anywhere
else. 83 exports are used only inside their own file and are tolerated: a
return type of a public function is part of the surface even when no caller
spells it out.

It also found one thing a symbol-level sweep cannot: `setPhase(x ? 'plan' :
'plan')`, a ternary whose branches were identical, left behind when the equity
offer moved into the funding choice and `EquityOfferScreen` was deleted. There
is no offer phase to route to any more, so it is now unconditional. Whether an
unanswered comparison should resume on the deal board instead is a design
question, recorded here rather than decided in a diff.

### "1 days left"

Read off the goal strip on the seventh morning. Fixing that line would have
been the wrong size of fix: a scan found **forty more** of the same shape, and
most were reachable rather than theoretical — one cup left is on screen near
the end of almost every day, one lemon spoils constantly, "1 people looked at
$1.00 and kept walking" is an ordinary Tuesday.

`plural()` lives in `src/lib/copy.ts` rather than in `ui.tsx`, because most of
the sentences a child reads are not written in components at all — they are the
evidence strings built by `simulation.ts`, `guide.ts`, `mastery.ts` and
`parent.ts`, none of which may import React. A helper those modules cannot
reach would have fixed half the product.

`tests/plural.test.ts` scans `src` and fails on a bare plural after a count, so
the class is extinct rather than fixed. Constants that can never be 1 are
listed explicitly, so changing one of them to 1 fails the test instead of
quietly shipping "1 cups each".

It is a small defect with a specific cost. This product is read aloud by people
who are learning to read, and every screen is an argument that its numbers can
be trusted. A child sounding out "one cups" has been handed a reason to doubt
the sentence.

### The sliders were smaller than they looked

Range inputs are the primary control in the game. The thumb draws at 40px; the
input's box — the thing that receives the drag — was 34px. Six of the pixels a
child aims at did nothing, and **a screenshot cannot show that**. Both sliders
are now 44px of hit area with the track and thumb visually unchanged.

A drag deserves the guideline more than a tap does: it has to stay inside the
box for the whole journey, not just land in it once.

### What the instrument taught me about instruments

The first browser auditor reported 1,887 problems across 165 screens. Almost
all of them were false:

- **OFF-RIGHT (1,887)** — children of horizontal scrollers, which are supposed
  to extend past the fold. The page's own `scrollWidth` never overflowed once,
  which is the measurement that actually answers the question.
- **TRAPPED (74)** — the badge toast is `fixed`, full width and bottom-anchored,
  so it looked like an action bar; its frame is `pointer-events-none` with only
  the card live, and treating it as a bar reported every footer button on every
  screen as buried under it.
- **COVERED (88)** — `elementFromPoint` sampled mid-animation on the day screen.

An instrument that cries wolf 1,887 times is worse than no instrument, because
the one real finding drowns. Rewritten to ignore pointer-transparent overlays,
scroller children and full-height sheets, and to confirm a control is genuinely
unhittable before calling it trapped, the same sweep reports **one** class:
seven controls in the 30–43px band. All pass WCAG 2.5.8's 24px minimum; all sit
below Apple's 44px guideline. Two were the sliders and are fixed. The other
five — a 32.5px "trophy case" link, a 36px mute button, "SEE EVERY NUMBER",
"For a grown-up", "Tap to speed up" — are below guideline, not defective, and
listed here so the next person decides on purpose.

The driver deserves its own note, because three of its stalls were mine and not
the product's: it clicked a button behind a modal backdrop (modality, working
correctly), it never scrolled to a control below the fold (a child scrolls),
and a timed-out `preview_eval` left an orphaned loop running that fought the
next one for the same buttons. The final version models a finger — scroll to
the control, hit-test it, then tap — and only that version got past Act 1.

### The runway, which nobody was counting

Spotted in passing, off a sweep for something else: **"Start day 41"**. If the
argument for the stand stages is that they make a share price mean something,
the cost of that argument had never been measured.

| Stage | Objective exit | Cap |
|---|---|---|
| Act 1 · the stand | 7 days, fixed | 7 |
| Act 2 · more stands | ~10 days, measured | 16 → **13** |
| Act 3 · the shop | ~6 days | 12 → **8** |
| Act 4 · going public | event-driven, ~3 | none |
| **To the market** | **~23 days** | ~38 → **~31** |

The caps were the wrong shape, and that is the more interesting half. A cap is
the fallback for a child who has **not** met the goal — so every day of slack
in it is a day spent only by whoever is already struggling. Act 2 handed that
child six spare days and Act 3 six more: the reward arrived last for the player
who needed it soonest.

Cutting Act 2 to ten was the obvious move and was wrong. `tests/arc.test.ts`
measures the objective landing on **day ten exactly**, so a cap of ten ends the
stage by timeout at the moment the goal completes — the kid does the work and
the game takes the credit away. Thirteen keeps three days of headroom.

One assertion had to change to allow any of this: `expect(days).toBeLessThan(
ACT2_DAYS / 2)`. It read as caution and behaved as a constraint — the manager
gate lands on day seven, so `/2` silently pinned the cap at sixteen or more,
and shortening the stage failed the assertion rather than the player. It now
states the margin it actually needs: room to open a second stand and run it
profitably twice.

`tests/runway.test.ts` owns the total, so pacing changes are a decision
somebody makes rather than a number that drifts one stage at a time. It also
keeps the argument honest: if the stand stages ever outgrow the market they
exist to explain, the ladder has stopped being a ladder and become the product.

And the caveat that survives all of it: **the caps are not what makes the
runway long — the objectives are.** A kid who does everything right still plays
about twenty-three days before a share price appears. No cap can shorten that;
only the gates can, and that is a change to what the game teaches rather than
to how long it waits.

## 51. Measuring what a shorter stage costs, and finishing the playthrough

§50 tightened two stage caps on an argument. This section replaces the argument
with a measurement, and the measurement reversed half of it.

### The caps, measured

The mechanism that makes pacing and learning the same question is
`WORDS_PER_DAY = 1`. A day hands over exactly one word and queues the rest, so
**the number of days in a stage is a ceiling on how many words that stage can
deliver.** Shortening a stage is arithmetic on the syllabus whether or not
anybody intended it.

`tests/wordbudget.test.ts` plays the whole ladder with the real derivers and
the real one-a-day drain, over ten seeds and two levels of play — careful, and
careless in the way a real child is careless: one flat price all week, the
cooler filled whatever the sky says, the manager hired late.

**The shop stage: the slack was real slack.** The objective completes on day
five in *every* run, careless included, because the shop's capacity makes a
good day easy once the door is open. Words delivered are identical at caps of
twelve, eight, six and five. So twelve was six spare days that no child ever
spent well, and `ACT3_DAYS` is now **six** — the worst observed run plus one.

**The stands stage: the slack was load-bearing, and cutting it was wrong.**

| cap | careless runs that lose a word | word lost |
| --- | --- | --- |
| 16 | 0/10 | — |
| 15 | 1/10 | `delegation` |
| 14 | 1/10 | `delegation` |
| 13 | 2/10 | `delegation` |
| 12 | 3/10 | `delegation` |
| 11 | 5/10 | `delegation`, `spoilage` |

Careful play is untouched at any of these — it finishes by day eleven. The cost
falls entirely on the child who plays badly, takes a while to afford a manager,
and needs the tail of the stage to get there. And the word it takes from them
is the one the stage exists to teach: the manager, the business that runs
without you, the difference between owning a job and owning a business.

So `ACT2_DAYS` went back to **sixteen**. The §50 argument — that a cap's slack
is spent only by whoever is already struggling — is true, and the conclusion
drawn from it was exactly backwards for this stage: that child is not wasting
those days, they are using them to arrive.

Worst case to the market is **32 days**, down from 38, all of it from the shop.
Best case is **26**, and §50's "about twenty-three" was wrong — it summed the
thresholds, and 1+3+1+2 = 7 is not reachable when a loss ticks the hands-off
streak back down. Measured, the stands stage takes eleven days. The runway test
now uses measured numbers and says so, having previously understated the thing
it existed to pin down.

**The lever, if the runway should be shorter.** Not the clock. The caps are not
what makes it long — the objectives are, and a child who does everything right
still plays about twenty-six days before a share price appears. Making
`delegation` reachable sooner would shorten the stage honestly; taking its days
away just removes the word.

### The playthrough, finished

§50 reported a browser sweep. It was not a playthrough: Act 1 clean, Acts 2–4
on a save left corrupt by an earlier driver, Act 5 never reached.

Now finished, twice. An exploratory pass covered **229 distinct screens** across
all five acts through to the market, and found one class. A verification pass
after fixing it covered **166 screens**, again all five acts, and found
**nothing**: no `NaN`, no `Infinity`, no bare plural, no horizontal overflow, no
clipped text, no trapped control, no target under the guideline.

### Every control now meets 44px

The one class the exploratory pass found was ten controls between 30 and 43
pixels. All passed WCAG 2.5.8's 24px minimum, which is why earlier sections
recorded them as "below guideline, not defective" and left them. Raised anyway,
each one visually identical, using the pattern this project already had:
`flex min-h-11 items-center`, keeping the type small and growing only the box.

Two deserve their own note, because they are the same mistake twice:

- The **sliders** had a 40px thumb drawn inside a 34px input (§50).
- The **float chips** — nine of them, the choice being how much of the company
  a child sells — carried `min-w-[44px]` and no `min-h`. 47 wide, 38 tall. The
  guideline met on the axis somebody pictured and missed on the axis that falls
  out of the line-height.

Three others (`trophy case`, `⚖️ Compare`, the grown-up link) already had
comments explaining a *previous* raise — 17px to 33, 25px to 33 — so each had
been noticed, moved, and left short. Which is the useful pattern here: this
class does not get fixed by looking, because looking is what produced the near
misses. It got fixed by measuring every control on every screen.

And that is also its limit, honestly stated: **there is no gate on it.** jsdom
has no layout engine, so a unit test cannot measure a tap target. The reading
level, the contrast and the dead code all have scripts that fail the build. This
one has a browser sweep and this paragraph.

### So, is it at 100%?

No, and the two things that question could mean have different answers.

- **Coverage: 95.28%.** Unchanged in substance from §49, where the remaining
  746 statements are enumerated by category.
- **Known defects: zero.** Every finding from this round is fixed and the
  verification sweep is clean across all five acts.

The second number is the one that moved, and §50 is the reason to distrust it
anyway: 1,081 tests at 95% coverage did not catch a save that bricked on the
most ordinary action in the product. "Zero known defects" is a statement about
what has been looked for. The list of things looked for is now long — five acts
in a browser, ten seeds of pacing, a fuzz, an adversarial pass, a dead code
sweep, a plural scan — and it is still a list.

## 52. Why coverage was not 100%, and what the last 3% actually is

The answer turned out to be more specific, and more damning, than §49's
"enumerated residue". Coverage was not 100% because **whole features had never
been rendered** — and they shared a property worth naming.

### The pattern: everything that needs somebody else's data

Every large gap was a path that requires a second person, or a second session:

| Gap | What it needed | Statements |
| --- | --- | --- |
| `PlanScreen` panels | a rival, regulars, and two bench tries | 117 |
| `ChallengeScreen` `CompareView` | a friend's score code | 90 |
| `ClubScreen` | a club code, two members, a turn | 53 |
| `PlaybookScreen` | a friend's deck, and a backtest | 46 |
| `page.tsx` rooms | a classroom, a club, a settled duel, a Saturday stand | 126 |

A single player walking the arc alone reaches none of them. Which is exactly
the shape of the bricked save in §50 — a screen the game can reach that no test
had ever reached, because reaching it takes deliberate setup that nobody had
bothered to do. Coverage had been measuring the linear path and calling it the
product.

The fix was five test files and no production changes: 95.33% → **97.06%**,
`PlanScreen` 80% → 98%, `ChallengeScreen` and `PlaybookScreen` to 100%,
`page.tsx` functions 61% → 93%. The floor moved with it, to 96/88/92/96.

Three of the five files failed first for the *same* reason, which is now three
for three on the lesson: a hand-written fixture. `record().hitRate` does not
exist (it is `winRate`); `tidyMember` keeps a club member's case while
`tidyName` uppercases, so `me="SAM"` made the club decide it was somebody
else's turn; and a hand-written `DayRecord` carried a `turnedAway` field the
type does not have and omitted the `cashAfter` it requires. Each looked like a
bug in the screen. Each was a bug in the test.

One of them is worth its own line: the first version of the duel test had
`if (!duel) return;`. That is the vacuous-pass pattern §49 records — in a file
whose own header warns about it. It passed, and covered nothing. Only the
coverage number moving revealed it.

### So can it get to 100%?

Yes, and — this is the part that changed — **almost nothing stands in the way
that a test cannot reach.** Classifying all 459 remaining uncovered statements
by what is on the line:

- **0** are SSR guards. `typeof window === 'undefined'` is reachable, because
  vitest's default environment is node, and those branches are already covered.
- **1** is a `catch` block.
- **7** are defensive fallbacks (`??`, `|| 0`).
- **451** are ordinary reachable code.

§49 claimed "4 unreachable TypeScript guards" and implied literal 100% would
need `/* v8 ignore */` or contorted tests. That was wrong. The remaining 3% is
not a wall of impossible branches — it is more of the work above: the weekend
day played through to its close screen, the club counters that move when a
proposal passes, a few dozen copy branches that fire on the third weather
variant.

What has not changed is what the number is worth. §50 remains the argument
against it: 1,081 tests at 95% did not catch a save that bricked on the most
ordinary action in the product, and the five files in this section found no
defects at all — they found *features nobody had looked at*, which is a
different and lesser kind of finding. Coverage measures what ran. Getting it to
100 would mean everything has run once. It would still not mean anything is
right.

## 53. A word no child can earn

Asked whether the recent work was surfacing issues or just moving numbers, the
honest answer was: mostly the latter. Coverage, tap targets and plurals are
process. §52 says outright that its five test files found no defects.

So the guard that §52's own measurement implied got written, and it found one.

### The defect: `unit-cost`

`reachable.test.ts` asks "can every badge and every mastery skill be produced
by playing?" — the question §40 was written in blood over. It has never asked
it of **words**, which are the other reward currency and the one §26 paces at
one a day.

`tests/wordsreachable.test.ts` now asks it. Every glossary word has a producer
except one:

- **`unit-cost`** is a full glossary entry — word, kid line, grown-up line.
- It is counted in `words.total`, which the trophy case, the parent report and
  the "N of 34 still to earn" line all show.
- It is a member of the `InsightId` union.
- `PriceScreen` *reads* it: `learned.includes('margin') || learned.includes('unit-cost')`.
- **Nothing anywhere constructs it.**

Two things a child can see follow from that. The words tab can never reach 34
of 34, however well they play, and the "still to earn" line permanently reads
at least 1. And that `|| learned.includes('unit-cost')` clause is dead, so the
margin row depends on `margin` alone.

The intent is on record, which is what makes it §40 rather than a design
choice. `ShopScreen`'s own comment reads: *"on day one the receipt **is** the
unit-cost lesson."* It was meant to be handed over from the receipt. It never
was.

Third instance of the class, after `letManagerRun` and the
kept-the-whole-thing badge. No badge is blocked — the vocabulary badge needs 28
of 34 and 33 are earnable — so nothing is unwinnable. It is a permanent
off-by-one in a number the product shows a child and a parent.

**Two ways out, and it is a content decision rather than a wiring one.** Award
it from the shop receipt on day one, which needs a line of child-facing
evidence copy written; or drop it from `GLOSSARY`, which makes the total 33 and
admits the lesson is taught by the receipt without being named. The guard
asserts the gap *exactly*, so fixing it either way fails the test and whoever
fixes it deletes the entry — and any **new** unearnable word fails immediately.

### Two more that were already measured and under-reported

- **Half of struggling players never finish the stands stage.** §51's table
  showed careless play missing the Act 2 objective in 5 runs of 10 *even with
  all sixteen days*. That was presented as an argument about caps. Read as a
  product fact it says: half the children who most need the payoff never see
  "two stands, one price, both paying", and never earn its two gold badges. The
  cap is not the cause and lengthening it barely helps — 16 days misses 5, and
  the fix is the gate, not the clock.
- **The tap-target work has no gate.** §51 said so and it is still true: jsdom
  has no layout engine, so nothing fails the build if a control shrinks below
  44px again. Reading level, contrast and dead code all have scripts. This has
  a browser sweep and a paragraph.

### One false alarm, closed

The reading-level gate extracts 2,471 strings as child-facing copy and 398 of
them — 16% — are not copy at all: import paths, CSS variables, meta values. It
looked like a load-bearing gate running on 16% noise, in a project whose whole
method is that the gate is the argument.

It is not. Patching the extractor to drop every string without a space changed
the reported grade, the long-sentence count and the hard-word count by exactly
nothing, because `sentences()` already discards them downstream. And
`freshsqueezed` in the hard-word list is not an identifier leak — it is
"fresh-squeezed" with the hyphen stripped by the word normaliser. Chased,
measured, wrong, closed.

### And the fixtures, again

Five fixture mistakes in a row now, across this section and §52: `hitRate` for
`winRate`; `me="SAM"` against a `tidyMember` that keeps case; a `DayRecord`
with a field the type lacks and without one it requires; a week-old stand asked
to produce the words Act 1 teaches on day one; and a business paying a manager,
a helper and rent asked to show `compounding`, which needs its early days to be
*profitable*.

Every one presented as a bug in the product. Every one was a bug in the test.
The rule from §49 keeps earning its place: build fixtures from the real
constructors, and when a fixture and the product disagree, suspect the fixture.

## 54. Paid twice for less: the slice that shrank

Coverage was at 97% and every gate was green when the brief changed from
"cover the code" to "check the arithmetic". That is a different question, and
it found something coverage never could: every line involved was already
executed by a passing test.

### The defect

An investor buys a slice of the business for cash today. The kid picks the
slice on a dial — 10%, 15%, 20%, 25%, 30% — and the funding screen filters
that list so the total can never pass half:

```
EQUITY_SLICES.filter((option) => option + alreadySold <= 0.5)
```

That line reads the stored slice as something to **add to**. `acceptEquity`
read it as something to **replace**:

```
equitySoldPct: offer.slice,
equityCashReceived: round2(ownership.equityCashReceived + offer.cash),
```

The cash accumulated. The obligation did not. Two files modelling one rule,
and only one of them right.

Measured on a modest week:

| | investor holds | kid has been paid |
|---|---|---|
| sells 30% | 30% | $36.35 |
| comes back, sells 20% | **20%** | **$60.55** |

The kid was paid for half the business and gave up a fifth. Handing over more
of the company made the investor's daily cut *smaller* — which is not merely
wrong arithmetic, it is the exact inverse of the lesson the beat exists to
teach.

### Why it was reachable, not theoretical

The tempting dismissal is that nobody sells twice. The numbers say otherwise:
the shop's fit-out is **$600**, and the largest slice of a modest week raises
**$36**. One sale cannot buy the door. Coming back is not the edge case, it is
the only path — and `page.tsx` says so in its own comment, that the kid should
"come back, which is the honest answer and is a better lesson than a disabled
button".

The one thing standing between a child and this was the shop plot hiding its
buy button once `plot.owned` — and the shop is only created *if the slice
raised enough*, which is precisely the case where it did not.

### The fix, and the fix's own version of the bug

First attempt clamped the total to the ceiling. The test written to guard the
property failed immediately, on a case the original bug did not have: at the
ceiling the slice stopped and the cash carried on, so the kid was paid for a
slice nobody received. The same defect wearing the other face.

So a slice that will not fit is now **refused outright** rather than trimmed:

- `MAX_EQUITY_SOLD` is exported from `ownership.ts`, and the funding screen's
  `0.5` literal is gone. The ceiling now has one home instead of two, which is
  the actual root cause rather than the symptom.
- `acceptEquity` adds to the stored slice, and returns the state untouched if
  the sale would breach the ceiling. **The two ledgers move together or
  neither moves.**
- `canSellSlice` is exported and checked in `page.tsx` *before* the cash goes
  in the box — because `page.tsx` banks `offer.cash` and then calls this
  module, so a sale silently declined downstream would have left the kid
  holding money for nothing.

Five tests guard it, and four of them assert the property rather than the
instance: that no sale can ever make the investor's share smaller, across
every ordering of every pair of slices; that the cash ledger and the slice
ledger always move together; that twelve sales cannot cost the kid their
majority; and that nothing the screen offers can be refused, which is the
assertion that stops the screen and the ceiling drifting apart again.

### What this says about the other four acts

The audit that found it started by asking which arithmetic identities were
already guarded. Act 1 was thorough — 20-odd identities in `pnl.test.ts` and
nine invariants under fuzz. The later acts were better than expected too:
portfolio round-trips conserve money to the cent, the club pools stakes into
one pot, the listing prices a float off the real valuation.

And the listing had already got *this very rule* right:

```
cap = Math.min(MAX_FLOAT, Math.max(0, 1 - alreadySold - MIN_FLOAT))
```

It reads what was already sold and reserves a floor for the kid. Same
question, same file family, correct answer. So the defect was not a gap in
the model — the model existed, one module just did not consult it.

### The lesson worth keeping

Coverage asks whether a line ran. Every line of `acceptEquity` ran, in two
passing tests, on every full-suite run for weeks. Neither test sold a slice
twice, because both built their ownership state fresh from
`createOwnershipState()` — and against a zero, adding and replacing are the
same operation.

That is the shape to watch for: **a test whose fixture makes two different
implementations indistinguishable.** It is not a coverage hole and no
threshold will find it. Only asking "what must always be true?" does.

## 55. The gate that failed on the truth

CI failed on "Market data is sane". Six companies, all flagged as possibly
carrying an unadjusted stock split:

```
RBLX: shares went 182M → 506M between 2020 and 2021 (2.8x)
DASH: shares went  62M → 337M between 2020 and 2021 (5.4x)
DUOL: shares went  13M →  23M between 2020 and 2021 (1.8x)
DUOL: shares went  23M →  39M between 2021 and 2022 (1.7x)
ABNB: shares went 284M → 616M between 2020 and 2021 (2.2x)
UBER: shares went 479M → 1248M between 2018 and 2019 (2.6x)
```

The check was right to look and wrong to conclude. Uber listed in May 2019.
Airbnb and DoorDash in December 2020. Roblox in March 2021. Duolingo in July
2021. At a flotation the share count genuinely multiplies, because preferred
stock converts to common and a pre-IPO 10-K counts only the common. Every
figure above is correct.

### It had been failing since the data arrived

Neither the script nor `market-data.json` was in the branch under review; the
gate fails identically on `main`. So this was not a regression, it was a gate
that had never passed on this data and had been red long enough to stop being
read — which is worse than no gate, because a permanently red check trains
everybody to merge past it.

The cause was in the check's own comment, which was honest about what it was:

> A real company changing its share count by half in one year would also trip
> this, and that is fine: **it is exactly as worth a human look.**

That is a fair description of a heuristic. It is not a description of
something that should `exit 1` in CI. A rule written to prompt a look had been
wired up as a blocking gate, and blocking gates have to be right, not
suggestive.

### One rule, two files, two answers

`tests/market.test.ts` asserted the same property — and already knew:

> The first two transitions of a company's series are skipped, because a
> flotation moves a share count by more than any split does and is not a
> mistake: Roblox went from 182M shares to 506M the year it listed.

The test started at `i = 3`. The gate started at `i = 1`. **The same rule was
written out twice and the two copies disagreed**, which is precisely the root
cause behind §54's equity bug, found two hours earlier, in the same session.
There it was a `0.5` ceiling living in `ownership.ts` and again as a literal in
`FundingScreen`. Here it is a split heuristic living in a CI script and again
in a test. Same shape, same fix: give the rule one home
(`scripts/market-rules.mjs`) and have both callers import it.

### The allowance was a proxy, and proxies drift

`i >= 3` is not the rule. It is a positional stand-in for "this company had
recently floated", and it is wrong in both directions: it waves through a
genuine split in year four of a series, and it does not cover Duolingo's
second jump, a lockup expiry sitting at index 2. §51 records the same mistake
in `arc.test.ts`, where `days < ACT2_DAYS / 2` was written as caution and
behaved as a constraint.

The real discriminator is the definition of a split: **a split does not change
revenue.** It re-slices one company into more pieces, so shares multiply and
every income-statement line stays exactly where it was. A business that grew
moves both.

Measured against the six:

| | shares | revenue |
|---|---|---|
| RBLX 2020→21 | 2.78x | 2.08x |
| DASH 2020→21 | 5.44x | 1.69x |
| DUOL 2020→21 | 1.77x | 1.55x |
| DUOL 2021→22 | 1.70x | 1.47x |
| ABNB 2020→21 | 2.17x | 1.77x |
| UBER 2018→19 | 2.61x | 1.26x |
| *an unadjusted split* | *any* | **1.00x** |

Uber's 1.26x is the closest any real listing comes, and the threshold sits at
1.15x — inside a gap with real room in it, rather than tuned to the data.

### Proving a relaxed gate still bites

Relaxing a gate and relaxing it into uselessness look identical from a green
pipeline, so neither is allowed to be taken on trust. Two things now hold it
shut:

- a test that plants a 4-for-1 split — shares x4, revenue untouched — in real
  company history and requires the rule to catch it;
- the same fault planted directly in `market-data.json` and run through the
  actual CI script, which reported
  `AAPL: shares went 15408M → 61632M ... while revenue moved 1.00x` and exited
  1.

The gate's message now carries the revenue figure, because the evidence for
the verdict is the thing a human needs to see when the gate is the one that
is wrong.

And the six real listings are asserted individually by ticker rather than as
a count, so a data refresh that genuinely does drop a split adjustment on
Uber cannot hide behind "still six".

### The lesson worth keeping

A gate that cannot distinguish the fault from the ordinary case is not a
strict gate, it is a broken one, and its cost is not the false alarm — it is
that everything it says gets discounted. **If a check is a heuristic, it
belongs in a report a human reads. If it exits non-zero, it has to encode the
actual rule.** The way to tell which you have is to ask what the fault does
that the legitimate case does not, and assert *that*: not the share count, but
the revenue standing still beside it.

## 56. A word filed under a stage the child had not reached

The customer sent a refinement of the Level 1 framework — the player loop
sharpened to five beats, and a table giving each stage an identity, a central
question and an unlock. One row of that table was emphatic in a way the build
could be checked against: **ownership/equity belongs to Stage 3.**

The game agreed in its gameplay and disagreed in its data.

`equity` is awarded by `equityInsight`, called from the shop's three-way
funding screen — pay cash, borrow, or sell the investor a slice — which is
Act 3. The glossary entry said `act: 4`.

`TrophyScreen` prints `Act {word.act}` against every word, so a child who had
just funded their shop by selling a slice saw the word they had earned filed
under a stage they had not reached. `wordsByAct` counted it there too, leaving
Act 3's tally reading two words when it teaches three.

The same screen's *other* branch was already right: `interest`, taught by the
borrow option, in the same decision, on the same screen, was tagged 3. Only
`equity` said 4. And FRAMEWORK.md §10 had described it correctly in prose since
the day it shipped — "the investor's slice in Act 3 and the float in Act 4".
The document was right; the data disagreed with it.

### The fix, and the test that objected

Retagging to 3 moved the word into `wordsreachable.test.ts`'s remit, which
covers Acts 1 to 3 — and it failed immediately, correctly. That file collects
words by running real days through the derivers, and `equity` does not come
from a deriver; it comes from a named producer invoked by a decision. Exactly
like `recurring-revenue`, which that file already handled as a special case for
the same reason. It is now collected the same way, from an offer priced off a
real week, so the word is proven earnable at the stage it is now labelled.

### The shape worth naming

Three defects in two sessions have now had the same signature: **a claim living
in prose, contradicted by data, with no check between them.**

- FRAMEWORK.md §10 said Act 3 runs to 12 days. It runs to 6 (§11).
- The mapping from the framework's twelve concepts to the glossary ids that
  teach them existed *only* in FRAMEWORK.md's prose until
  `tests/frameworkwords.test.ts` asserted it.
- §10 said the investor's slice is Act 3. The glossary said 4.

None was a crash and none would ever fail a test suite, because in each case
nothing was asserting the sentence. The lesson is narrower than "documents go
stale": **a document that makes a checkable claim about the build should have a
test that fails when the claim stops being true.** Where that is cheap — a day
count, an id mapping, an act tag — it is close to free, and it is the only
thing that stops the write-up quietly becoming fiction.

## 57. The day the game changes how it is played

The customer played the first day, reached the second, and reported that the
stand had tappable objects on it that he had not known were there. Then he
named the real problem, which was bigger:

> i think the onboarding experience is a broader symptom of me just being
> confused on how to play the game

He is right, and the cause is structural.

### Two games, one arc

**Day one** runs `morning → shop → price`. Three screens, one decision each, a
slider in the middle and a button at the bottom. Guided, linear, impossible to
get lost in.

**Day two** goes straight to the stand — and the same two decisions are now
hotspots on a picture of a lemonade stand. `ShopScreen`'s own comment records
the split without noticing what it costs:

> this screen is only ever reached on a run's first day — `morning → shop →
> price` runs at the start of a run and every later day goes straight to the
> stand

So a child learns one way to play on Tuesday and is handed a different one on
Wednesday, with nothing connecting them. The interaction model changes
underneath them at the exact moment the training wheels come off.

### The mitigation that was already there, and was not enough

This was anticipated. `StandScene` renders "tap the sign" under the price.
`PlanScreen` adds a Pip bubble reading "Tap the sign to change your price. Tap
the lemons to make more." There is even a comment saying why:

> The scene is a new kind of screen — a kid who does not know it is touchable
> will read it as a picture and go looking for the sliders that are no longer
> there.

Both were on screen. The customer played through and still did not know the
stand was touchable. **That is the evidence: a line of text beside a new
interaction model does not teach the model.** The text competes with everything
else on a busy screen and loses, because nothing marks it as the one thing to
read first.

### The spotlight

Three steps. Everything dims except the thing being talked about, Pip says one
sentence beside it, and the copy *bridges* rather than explains: "Yesterday you
picked a price on its own screen. Now it lives on your sign. Tap it to change
it." The third step is the rehearsal button — the mechanic that makes this a
game a child can be curious in, and a button nobody pressed because nobody knew
what it did.

Three, and no more. The point is not to explain the stand; it is to establish
that the stand is *made of controls*, after which a child finds the other four
hotspots themselves. FRAMEWORK.md §13 is the argument for bounding the number
of things asked of a child rather than the number drawn.

### Four panels, not a hole

Built as four dim panels *around* the target rather than one overlay with a
hole cut in it, and the reason is this project's own history:

- §44 shipped a badge toast whose transparent padding **swallowed taps on the
  primary button underneath it** — visually clear, functionally dead, invisible
  in a screenshot.
- §50 lost most of a day to an auditor that could not tell a pointer-transparent
  overlay from a real one, and reported 1,887 false positives.

With four panels the target is never covered, so it stays tappable with no
`pointer-events` reasoning at all. And a child who ignores the words and just
taps the lit-up thing gets exactly what they expected — at which point the tour
ends, because that *is* the lesson landing. `Pip.tsx` is explicit that a mascot
must never stand between a kid and the button they were reaching for; a
spotlight is the one shape that insists without blocking.

### Three bugs, two of them mine

- **A tour step pointing at nothing.** `ChunkyButton`'s props are a closed type
  and it does not spread the rest, so `{...{'data-coach': 'try'}}` type-checked
  and **silently dropped the attribute**. The last step would have highlighted
  nothing. Caught by reading the component, which is the definition of a gap —
  so `tests/ui/coach.test.tsx` now asserts every step has a real element to
  point at. §40's defect class again: wired to nothing.
- **A tour that could never start.** `tour` was read as initial state, and it is
  false while a badge is waiting. A child who earned a badge on day one — which
  is all of them — would never have seen the tour. Now started by an effect.
- **Two things wanting the same tap.** Found in a browser and by nothing else:
  the dim panels sat over the badge toast, so a child reaching for "tap to
  close" hit a panel and skipped the tour instead. Badges go first now. They are
  the reward for the day just played; the tour is about the day about to be
  played.

The dim also exposed a redundancy that had been invisible: the old Pip bubble
saying the same sentence at the same time. Kept for afterwards, because a child
who skips still needs to know the scene is touchable.

### What it does not fix

The tour teaches *how to press things*. It cannot teach what to press them
**for**, and FRAMEWORK.md §14 is the finding that the game does not currently
say: Act 1 has no profit target, and `act1Complete` is seven days elapsed.
Seven days of sandbox with a clock is not a level, it is a toy with a timer.

Half of "I don't know how to play" was the interaction model, and that half is
now addressed. The other half is that there is nothing to aim at.

## 58. A lever, a discount and a goal, without moving a single identity

FRAMEWORK.md §15 is the design record of building Stage 1's six missing rows.
This is the engineering account, and there is one decision the whole thing
turned on.

### The default that made it safe

Act 1 gained a product choice — cheap, normal or posh lemons — and volume
pricing on the order. Both change what a cup costs, and a cup's cost is the
subject of roughly thirty arithmetic identities: `tests/pnl.test.ts` holds
twenty-odd, `tests/fuzz.test.ts` nine more, and several are phrased in terms of
*a* per-cup ingredient cost.

**Normal is exactly ×1.0 on cost and ×1.0 on demand, and it is what every
caller gets if it does not choose.** So a run that passes no grade reproduces
the previous economy to the cent, and all thirty identities kept passing without
being touched. A test asserts it directly rather than trusting it — a plain run
and an explicit `regular` run, compared day by day on profit, revenue and
ingredient total.

That is the general move worth keeping: **when adding a dimension to a system
under identity tests, give the new dimension an identity element and default to
it.** The alternative is editing thirty assertions and hoping.

### The part that was genuinely invasive

Cost of goods sold used to be `lemonsUsed × ECON.LEMON_COST` — a count times a
constant, computable from a number. That stops being true the moment two lemons
can cost different amounts:

- `LemonLot` now carries `unitCost` (optional, so an old save reads back as
  lemons bought at the plain price, which is what they were).
- `consumeAndAge` walks the lots oldest-first and reports **what it spent**, not
  just how many it took.
- `runDay` had to be **reordered**: consumption now happens *before* costing,
  because only the pantry knows which lemons were poured.
- Spoilage is costed from the lots too, so a lemon thrown away is a loss at what
  it actually cost.

Without that, the receipt and the profit and loss would have disagreed about the
same day — §4's line in the sand.

### Three bugs, all caught by existing guards

Nothing here was found by reading it back:

1. **`tests/round.test.ts`** compared `outcome.ingredients.total` against
   `ingredientCostOf(8)`, which prices lemons flat. Its order clears a bulk
   tier, so the day came out at $1.46 against the helper's $1.56. The test was
   right until the day two lemons could cost different amounts; it now asserts
   the identity instead of the number.
2. **`tests/plural.test.ts`** flagged the new picker. `<GradePicker grade={g}
   lemons={n} />` closes a brace and is followed by the word "lemons" — a JSX
   *attribute name*, which no child will ever read. The scanner now excludes a
   noun followed by `=`; prose never contains `lemons=`, so the exclusion cannot
   hide a real offender.
3. **`tests/wordsreachable.test.ts`** reported both new words unearnable —
   correctly. Its sweep varied price and batch but always bought normal lemons
   in modest quantities, so nothing in it could produce `quality` or
   `bulk-discount`. Fixture fixed to sweep grades; the sixth fixture mistake of
   §49's kind, and the first the file caught on the same day the mechanic
   landed.

### The bug that was mine, and the flake that followed

The profit target counted qualifying days across the **whole** history. Two
exploratory days that both happened to clear $25 therefore completed the stage
on day two — **the challenge won before it was ever set.** Hits are now counted
from after the exploration window, and a test plays two good exploratory days
and asserts the count is zero.

Then `tests/ui/journey.test.tsx` began failing **intermittently**: "plays a full
week and reaches the end of it" asserted five days played, and a run that priced
well now finishes in four, depending on the weather it drew. The number five had
been a proxy for "got through the week" and had quietly become the thing under
test — §51 records the same mistake in `arc.test.ts`, where `days <
ACT2_DAYS / 2` was written as caution and behaved as a constraint.

My first fix over-reached: I asserted the stage had *finished*, which pulled
stage-transition logic into a smoke test that breaks out of its loop on copy and
can stop anywhere, including partway into Act 2. That failed intermittently too,
for a different reason. Removed; the boundary has its own test.

### What did not have to change

The Same-Sky Challenge. `buildCustomers` requires that the number of random
draws depend only on the weather and the day's parameters, never on a decision,
or two children on one code stop getting the same week. Quality is a decision,
so it multiplies **`cupsWanted`** — who buys — and never **`passersby`** — who
walks by. Three tests hold it: same weather, same footfall, same seed carried
forward, at every grade.

Getting that wrong would have broken the classroom board and the challenge
codes, silently, in a way no arithmetic test would have noticed.

## 59. Seven bugs from one browser playthrough, six of them one bug

A full play of Act 1 on a phone-sized viewport, after §58 shipped. Seven
defects, and six were the same defect wearing different clothes.

### The class: a cost quoted at the wrong recipe

Grade and volume pricing made "what does a cup cost" a question with an
argument. Six places answered it without passing the argument, so all six
quoted the *normal* lemon:

| Where | What a child was told | The truth |
|---|---|---|
| The price screen's floor | "a cup costs you **$0.20** — charge more than that" | 29c, so 25c looked like a profit and lost money on every cup |
| The rehearsal bench | this plan makes **$23.98** | $20.38, on the screen whose whole job is being wrong for free |
| Planned-versus-actual | "planned **$31.54**" vs actual $28.74 | equal — a $2.80 shortfall on a day where every cup planned was sold |
| The "you keep" chip | **$0.81** a cup | 70c |
| `profitIfSold` — "if all sells" | **$42.00** | $38.38 |
| The challenge summary | a posh week costed as a cheap one | the figure two children compare side by side |

Every one was a call site that built a plan or a projection and left `grade`
out, so it silently took the default. The worst two are the price floor and the
bench, because both actively advise: one names the number a price has to beat,
the other is the game's only planning tool.

**The default that made §58 safe is what made these possible.** `grade`
defaults to `regular`, which is exactly the old economy — so a forgotten
argument does not crash, does not fail a type check, and produces a plausible
number. That is the trade: an identity element buys a safe migration and pays
for it in silent-wrongness at every call site that forgets.

Two structural fixes rather than six patches:

- **`DayRecord` now records `ingredientCost`.** Anything summarising a past day
  used to recompute it, and the bulk discount depends on how many lemons were
  bought *that morning*, which no later reader can recover. The day is the only
  correct source.
- **`projectDay` takes the grade and hands it down**, and every figure it
  produces comes from the plan it already built. The old code built a plan with
  the recipe on one line and then priced the cup flat three lines later.

`tests/stage1.test.ts` now asserts the *class*: every figure describing a day
has to move when the recipe does. A new call site that forgets fails there
rather than in a browser.

### The one that was not that

**A rival appeared in Act 1.** `closeDay` called `advanceRival` with no act
guard and `RIVAL_APPEARS_ON_DAY` is 3, so on day three a competitor turned up
on the stand with a price — and did nothing at all, because Act 1 runs on
`DEFAULT_DAY_PARAMS` and never consults `deriveDayParams`. A child watched
somebody undercut them and nothing happened.

Wrong twice: a mechanic wired to nothing (§40, again), and `competition` is an
Act 2 word — FRAMEWORK.md §1 says Stage 1's demand is "driven only by price +
quality ... No weather, competition, location".

Pre-existing, and it took a playthrough to find because no test asserted the
absence of something. The guard went into `advanceRival` itself rather than the
call site, because the call site is what forgot; and the test was checked by
deleting the guard and watching it fail with *"a rival turned up on Act 1 day
3"*.

### Three that were mine, from §58's own changes

- **The day-one goal strip** still read "7 days to grow $20.00" — a third
  objective, next to a stage that now ends on two good days and a plan screen
  that names "$25 in a day, twice" from day three. Now "Two days to try things
  out", which is what those days are actually for.
- **The header disagreed with the title**: "Day 1 / 7" above a screen headed
  "Day 2". `PlanScreen` reads `stage?.day ?? history.length + 1`; Act 1 had no
  stage entry until the goal arrived and so took the correct fallback. The new
  entry passed days *banked* rather than the day about to be played.
- **A reload switched the recipe back to normal.** `ShopScreen` defaulted the
  grade instead of carrying it, and its own comment claimed it "is only ever
  reached on a run's first day" — which a resumed Act 1 save disproves, because
  `morning → shop → price` is exactly the path a resume takes. Worse than a
  reset: word of mouth reads *yesterday's* grade, so demand would have moved
  for a decision the child never made.

### And two pieces of copy that assumed a seven-day week

`WeekEndScreen`'s `short` branch was written for a one-day duel and keyed on
`days < TOTAL_DAYS`, so a four-day run that hit the goal twice was told "that
was your day" and denied "you figured out pricing" — the run that had most
obviously figured out pricing. And the chart was labelled "your 7 days" over
four columns.

### What the playthrough could not cover

Two of the five tours were driven in a browser: the stand and the yard, which
are the two most different screens in the product, and the `Spotlight` geometry
is shared. Funding, listing and market are covered only by the static anchor
test — that every step points at an element that exists. Reaching Act 3, 4 and
5 honestly takes another twenty-odd days of play, and the honest statement is
that their *layout* has not been looked at on a phone.
