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
- **No free text between children.** Everything shared between players travels
  as a short code the child types out loud or writes down.

## Where the child's progress is stored

In their own browser, in `localStorage`, on their own device. Six keys, and
this is all of them:

| Key | What is in it |
|---|---|
| `lemonade.save.v2` | The run in progress: the stand, the money, the days played |
| `lemonade.career.v1` | Badges, words, companies read, and a first name if they typed one |
| `lemonade.class.v1` | A teacher's class board, on the teacher's device only |
| `lemonade.live.v1` | The practice portfolio: which companies were bought, at which week |
| `lemonade.guide.v1` | Which of the guide's lines have already been said |
| `lemonade.act1.v1` | A save from an early build, read once and then migrated |

## How to delete it

Open **For a grown-up** from the title screen, scroll to the foot of the
report, and press **Delete it from this device**. It asks once, tells you what
it is about to remove, and then removes all six keys and lists them back to
you. Clearing the browser's site data does the same thing.

Either way it is permanent, including the badges and the words, and there is no
copy anywhere else — so there is nothing we could restore even if you asked us
to.

## The one name we ask for

The game offers a child the chance to put a name on their trophy card. It is
optional, it is capped at twelve characters, it never leaves the device unless
the child chooses to share a code with a friend, and a first name or a nickname
is what the prompt asks for.

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
  is the one the service worker makes to cache the game for offline use.

## Contact

Open an issue on the repository. There is no support address to write to,
because there is no account to be locked out of.
