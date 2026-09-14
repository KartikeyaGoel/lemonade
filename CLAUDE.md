# How to work on this

Notes for whoever picks this up next, including me. Everything here was learned
by getting it wrong first; the section numbers point at the write-up in
PRODUCT.md, which is the record.

## 1. Finish the thing, then finish the list

The customer's standing complaint, verbatim:

> not sure why you keep leaving things unfinished, we need to continually move
> forward so be proactive and do things ahead of time that you anticipate will
> come up in the future. we need to move fast

So:

- **A named hole is a task, not a disclaimer.** Ending a session with "and here
  is what is still weak" is only honest the first time. The second time it is a
  way of not doing the work. Write the list, then close it in the same session
  wherever closing it is possible at all.
- **Do the thing you can already see coming.** If a change will obviously need
  a gate, a migration, or a measurement, that is part of the change. Shipping
  the change and filing the gate for later is how §75 happened.
- **What genuinely cannot be closed gets said in one line, with the reason.**
  "Only a child can tell us whether it is fun" is that. "Nobody has measured
  the market yet" is not — that is just unmeasured.

## 2. One implementation, and a gate that says so

The reason bugs trickled in for a fortnight after every redesign was never
carelessness. It was **four implementations of a day** — the app, `demo.ts`, the
arc test, and the fixtures — each drifting on its own. §75.

- A day transition happens in `src/lib/day.ts` and nowhere else.
  `scripts/check-one-day.mjs` classifies every state-advancing export and fails
  on one it has never seen. Adding a function means classifying it.
- Two copies of a rule is a defect even when they agree today. `market-rules.mjs`
  exists because the gate and the test each had their own copy and disagreed for
  months (§55).
- **A fact belongs in one place.** Two sentences carrying the same number is the
  §62 class, and it has recurred five times.
- `scripts/check-duplicates.mjs` compares every function body in `src` and
  `scripts` by shape and fails on an unclassified pair. It is the general form
  of `check-one-day.mjs`: that gate closes the class for days, this one for
  everything else. See §11.

## 3. Gates are allowlists

A gate that fails on the known-bad closes one bug. A gate that fails on the
**unclassified** closes a class. §77 Hole 1 is the write-up: the first version of
the claim sweep knew three bad shapes and passed everything else, so a fourth
shape shipped two commits after the gate landed.

Every gate in `npm test` should be able to answer "what would I miss?" in a
sentence, and that sentence goes in the file.

## 4. Measure it; do not assemble it from caps

`ACT2_DAYS = 16` was set from a measurement taken with the competitor switched
off, and every test in the suite agreed with it. A child put the game down. The
fix was not a smaller number — it was `tests/arclength.test.ts`, which *plays*
the arc on ten seeds and fails if the length drifts. §76.

- A constant that costs a child time needs a run behind it, in a test, next to
  the number. `scripts/check-measured.mjs` enforces this: a progression constant
  with no measurement is a failing build.
- Never state a duration you computed by adding up the limits. §76 did that in
  the section documenting the sin.

## 5. Education is behaviour, not vocabulary

Counting glossary words measures delivery. Assert `readiness` (four criteria off
what the child did with money at stake) and `mastery` (skills detected from
sightings in their own history) instead. Words are a floor, last, and labelled
as weak.

And the promise is **tiered**: careful play is owed every word; careless play is
optimised for engagement and may lose some. Measure the two profiles separately
— an aggregate hides the distinction and produced a wrong conclusion once.

## 6. Verify in the browser, then say what you did not check

`npm run check` is the gate: `tsc --noEmit && eslint . && npm test`. Not
`next lint`, which skips `tests/`.

`tests/ui/soak.test.tsx` walks the real app, coverage-guided, from a set of
seeded deep states. It reports what it reached. **A walk is a net with a hole of
a known size** — measure the hole and write the number down rather than calling
the app covered.

Never write "bulletproof". Write what is gated, what is not, and the measurement
for each.

**And then play it.** A fortnight of gate-building was followed by one
playthrough that found ten defects on the paths a child walks first — see §83.
The gates found the second instance of every class; a person playing found the
first. Sentences and routes are what slip through, and they are exactly what a
child meets in the opening minutes.

Two practical notes from doing it: stop the dev server before `npm run build`,
because the production build overwrites `.next` and the dev server then 404s its
own chunks. And when reading a screen from the browser, use `textContent` and
skip `<script>` — `innerText` is undefined in jsdom, and joining child nodes with
a space invents whitespace the app never rendered. I reported both as product
bugs before checking the instrument.

## 7. `??` is the wrong operator for an environment variable

GitHub Actions substitutes an **empty string** for a secret that does not exist,
and `process.env.X ?? fallback` does not fall back on `''`. That sent the SEC an
empty User-Agent on every scheduled run for months, and would have turned both
data-staleness limits into `Number('')`, which is zero.

Use `envOr` from `scripts/env.mjs`, which treats blank as absent. A test reads
the scripts to make sure nothing goes back to `??`.

More generally: **a tolerance is a place to hide a bug.** Three fixes in three
sessions had a defect inside them that the fix's own gate caught only once the
gate was made exact — the `?? data.fetchedAt` fallback in §79, a guard on a
field that did not exist in §80, and a claim check with a one-penny tolerance
that was exactly the width of the defect it let through. Default to exact.

## 8. Measure the instrument, not just the thing

Half the metrics in this project were wrong the first time, and always in the
same direction — measuring the harness and reporting it as a fact about the app.
The soak's coverage number was 57%, then 33%, before the unit of coverage was
right. An engagement metric came out at 100% because "a choice" was read off the
DOM. A covering array reported full coverage of dimensions whose mutators were
silently declining to apply.

So: when a number comes out suspiciously clean or suspiciously bad, suspect the
instrument first. And make every generated fixture **assert that it actually
took** — a mutator that quietly does nothing is worse than no fixture, because
it reports coverage.

Three specific traps, all hit in one session:

- **`vi.useFakeTimers()` fakes `Date.now` and `process.hrtime`.** Timings taken
  inside a test with fake timers are the virtual clock. Get wall time from
  vitest's own reported duration instead.
- **jsdom has no `innerText`** — it is `undefined`, not `''`. Use `textContent`.
  A check reading `innerText` passes on nothing, silently.
- **A gate whose input has gone empty reports a pass.** Print how much every
  gate looked at, so a collapse to nearly nothing is visible in the log.
- **A DOM reader that joins text nodes with nothing** welds `$208.16` and
  `202 cups` into `$208.16202`. Joining with a space invents `5 cups .`
  instead. Put a separator between *element* boundaries and none inside one.
- **A count-up animation is not the final figure.** `useCountUp` had a
  headline reading "You lost $2.00" next to a profit line of `-$5.00`, which
  is a §4 violation for about a second. Wait for it to settle before reading.
- **The measuring device can encode the bug.** `tests/claims.test.ts` built
  every shape on a `FIGURE` regex that matched `$-3.78` and not `-$3.78` —
  so the only negative it could read was the malformed one, and fixing the
  copy turned the whole file red. §84.

## 9. Count the space before approximating it

A t-way covering array is what you build when the state space is too big to
enumerate. Check whether it is. `tests/ui/combos.test.tsx` spent two sessions
arguing pairwise vs three-way vs four-way over a space whose **labels** said
7,776 and whose distinct states numbered 1,188 — because most combinations are
the same save reached twice, a mutator finding its work already done. Exhaustive
turned out to cost 28 seconds and to subsume every t.

And a ratio with a moving denominator never reaches 100%. The soak's control
coverage rises *and* its denominator rises as it explores, so it converges near
95% whatever the policy. When something has to be complete, enumerate it
(`tests/ui/lists.test.tsx`); when it cannot be, report the ratio and name the
residue.

## 10. The world is not in the repo

Every other gate checks the code. The refresh workflow failed silently on every
weekday for a fortnight while `npm run check` stayed green, because nothing read
its output — so the live market, the part that is supposed to never end, was
marking holdings against dead prices. §79.

- A scheduled job is only a signal if something fails the build when its output
  goes stale. `check-market-data.mjs` is in `npm test` for that reason.
- A deployed bundle ages after the gate has passed. `dataAge` puts that on the
  screen, because a check in CI cannot reach a phone.

## 11. Fixing the instance is not fixing the class

The playthrough in §83 found `$-4.16` in `listing.ts` and fixed it *there*, by
importing `money` into the file — and left the file's other private copy, 428
lines further down, shadowing the import. §84 found nine copies of `money`, six
of them wrong, one of them on the profit card of a losing first day.

So, when a defect is found by looking rather than by a gate:

- **Count the instances before fixing one.** `grep` for the shape, not for the
  line. Nine is a different problem from one and wants a different fix.
- **Ask what the one home is, and whether anything imports it.** `copy.ts` had
  exported the correct `money` for months with a comment explaining §62. One
  file imported it. An abstraction nobody uses is not a fix, it is a comment.
- **Then write the gate**, in the same session, before the next thing.

And when you cannot think what else might be duplicated, that is the signal to
stop grepping and write a detector. `check-duplicates.mjs` normalises every
function body in the repo and fails on an unclassified pair. Three of the five
duplicates it has found — two `localStorage` writers, two act transitions, two
clipboard handlers with different flash durations — are ones nobody would have
searched for. **You cannot grep for the duplicate you have not thought of.**

## 12. Conventions

- **"Push" means commit and push to `main`.** No PRs, no branches.
- **Write it up.** A decision or a defect worth remembering goes in PRODUCT.md as
  a numbered section, in prose, with the measurement. The customer reads it.
- **Completeness claims need an inventory.** "I checked everywhere" needs the
  list and the generalised bug class, not another walkthrough.
- Pure logic in `src/lib/`, no React imports. Screens are components. The
  `localStorage` schema is versioned and migrated — `SAVE_VERSION` and
  `migrateAct` in `storage.ts`, with a test per hop.
