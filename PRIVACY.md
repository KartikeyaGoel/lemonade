# What this game does with your child's data

Nothing. That is the whole answer, and this page exists so that a teacher or a
parent can check it rather than take our word for it.

## The short version

- **No accounts.** There is nothing to sign up for and no way to.
- **No servers.** There is no backend. Nobody receives anything, because there
  is nobody to receive it.
- **No analytics, no tracking, no advertising.** Not "anonymised" analytics.
  None.
- **No third parties.** The page loads nothing from anybody else's domain —
  no fonts, no scripts, no images, no beacons.
- **No real money.** At no point, in any part of the game, is real money
  involved. The stock market act uses real historical prices and real filed
  accounts to move a simulated portfolio.
- **Free text between children travels only as a code they hand over.** There
  is no server and no delivery: a message becomes a `MSG-…` string the child
  gives to their friend, exactly like the challenge and club codes. The
  Messages section below says what that means, including what it does not
  protect against.

## Where the child's progress is stored

In their own browser, in `localStorage`, on their own device. Ten keys, and
this is all of them:

| Key | What is in it |
|---|---|
| `lemonade.save.v2` | The run in progress: the stand, the money, the days played |
| `lemonade.career.v1` | Badges, words, companies read, and a first name if they typed one |
| `lemonade.class.v1` | A teacher's class board, on the teacher's device only |
| `lemonade.live.v1` | The practice portfolio: which companies were bought, at which week |
| `lemonade.guide.v1` | Which of the guide's lines have already been said |
| `lemonade.act1.v1` | A save from an early build, read once and then migrated |
| `lemonade.muted.v1` | Whether the sound is switched off |
| `lemonade.ledger.v1` | What they did and on which day, so a streak can be counted |
| `lemonade.inbox.v1` | Notes between the child and a grown-up on this device |
| `lemonade.nudges.v1` | Which reminders have already been shown, so none repeats |

## How to delete it

Open **For a grown-up** from the title screen, scroll to the foot of the
report, and press **Delete it from this device**. It asks once, tells you what
it is about to remove, and then removes all ten keys and lists them back to
you. Clearing the browser's site data does the same thing.

Either way it is permanent, including the badges and the words, and there is no
copy anywhere else — so there is nothing we could restore even if you asked us
to.

## The one name we ask for

The game offers a child the chance to put a name on their trophy card. It is
optional, it is capped at twelve characters, it never leaves the device unless
the child chooses to share a code with a friend, and a first name or a nickname
is what the prompt asks for.

## Messages

The game has a messages screen. It is worth being precise about it, because
"my child can send messages in an app" is the sentence a parent most wants a
straight answer to.

**A child can write to a grown-up, and it works.** Both ends are on this
device: the child writes on their messages screen, and the grown-up replies
from inside **For a grown-up**. It is a note left on a shared tablet. Nothing
is sent anywhere, because there is nowhere to send it and nobody to send it to.

**A child can write to another child, and hand it over as a code.** There is
still no server. The message becomes a `MSG-…` string; the child gives it to
their friend, who pastes it in. Until a code has been made the message reads
*not sent yet* and never *sent*, because telling a child their friend has read
something they have not would be the worst thing this feature could do.

This is the same mechanism as the challenge and club codes, and the same trust
model: **a code is a note passed across a table.** Whoever holds it can read
it. It is not encrypted and does not pretend to be.

**What that does not protect against, stated plainly.** The filter catches
identifiers. It does not catch unkindness, and there is no human moderation —
there cannot be without somebody employed to do it. What a child has instead
is block and report, on every conversation, reachable from inside it, and a
grown-up on the same device who can read the whole thread. Before this becomes
a feature that reaches children who do not already know each other, it needs
moderation by a person, and that is an operating commitment rather than a
release.

**Every message is filtered on the way out *and* on the way in.** The second
one matters: a code might have been written on an older build whose filter knew
about less than this one does, so the receiving device applies its own rules
rather than trusting the sender's.

**The filter, whoever wrote it.** The filter
is aimed at identifiers rather than at rude words: email addresses, phone
numbers, links, street addresses, the name of a school, and the names of other
apps a conversation might be moved to. Anything it finds is replaced, and the
child is told what came out and why. It runs again every time the game loads,
so a message stored before the filter knew about something is not displayed
afterwards.

**A child can block or report any conversation, from the conversation.**
Reporting blocks at the same time. A blocked conversation accepts nothing in
either direction.

**If this ever becomes a real messaging feature, this page changes first.**
Delivering a message between two children needs a server, an account for each
child, and a grown-up's consent — and it needs moderation by a person, not just
a filter. None of that exists, and none of it will arrive quietly.

## Reminders

The game can put a reminder on this device — and the switch for it is inside
**For a grown-up**, never on a screen a child is looking at.

- **At most two a day.** Never more, whatever is going on.
- **Never a telling-off.** Nothing a reminder says names how long it has been
  since the child last played. They say what is waiting, not what was missed.
- **They only arrive while the game is open on this device.** Reaching a closed
  app needs a server holding a subscription, and there is no server. There is
  nothing to switch off remotely because there is nothing switched on remotely.
- **Refusing costs nothing.** Everything a reminder would have said is shown
  inside the game anyway, on the first screen.

A browser permission granted on a shared device is **not** verifiable parental
consent, and this page will not pretend it is. It is the closest a build with
no accounts can get. If reminders ever reach a closed app, that needs an
account, a server, and a real consent flow — and this page changes before any
of it ships.

## What travels when children share

A challenge code and a result code, both short strings of letters and numbers.
A result code carries what the child typed as their name, their profit, cups
sold, average price and lemons wasted. It carries nothing else — no device
identifier, no location, no timestamp, no address.

Children pass these codes to each other directly. They do not pass through us,
because there is no us to pass through.

## The data the game ships with

Company accounts come from the U.S. Securities and Exchange Commission's public
XBRL filings, and prices from public market history. Both are fetched **when the
game is built**, by a maintainer, and shipped inside the bundle. A child's
device never contacts a data provider.

The one identifier in that process is a maintainer's email address, which the
SEC requires in the `User-Agent` header of anyone using their API. It belongs to
the maintainer, not to any player.

## Verifying any of this

The whole game is a static bundle and the source is public.

- Open your browser's developer tools, go to the Network tab, and reload. Every
  request goes to the address the game is served from and nowhere else.
- Turn the wifi off and reload. It still works.
- Search the source for `fetch(` — the only network call in the application code
  is the one the service worker makes to cache the game for offline use. That
  includes messages: there is no code anywhere that sends one.

## Contact

Open an issue on the repository. There is no support address to write to,
because there is no account to be locked out of.
