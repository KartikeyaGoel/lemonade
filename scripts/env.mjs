/**
 * Reads `.env.local` and `.env` into `process.env`, with no dependency.
 *
 * ## Why this exists
 *
 * `fetch-market-data.mjs` wants `ALPHAVANTAGE_KEY`, and the only two ways it
 * could ever be given one were a repository secret or typing it in front of the
 * command. Asked where to put it, the honest answer was "there is nowhere",
 * which is a silly answer for the one setting in the project that decides
 * whether the price feed is official.
 *
 * Next.js loads `.env.local` for the *app*. These scripts are plain Node and
 * never see it. Node 20.6 added `--env-file`, and it throws when the file is
 * absent — so it cannot be put in an npm script that has to work on a fresh
 * clone. Hence twenty lines here.
 *
 * ## The rules, and why each one
 *
 *  - **The real environment always wins.** A value already in `process.env` is
 *    never overwritten, so a repository secret in CI beats a stale line in
 *    somebody's local file. The alternative loses to whichever ran last.
 *  - **`.env.local` beats `.env`**, matching what Next.js does for the app, so
 *    the two halves of the project read the same file in the same order.
 *  - **Missing files are not an error.** Nothing here is required; a run with no
 *    key falls back to the keyless price source and says so.
 *  - **A blank value counts as unset.** `.env.example` is a template of empty
 *    lines, so copying it and filling in one of them leaves the rest blank —
 *    and `process.env.X ?? fallback` does *not* fall back on `''`. Left alone,
 *    copying the example set the SEC's User-Agent to nothing and both staleness
 *    limits to `Number('')`, which is zero: the gate would have failed on data
 *    fetched the same day. See `envOr`.
 *  - **Nothing is printed.** A loader that echoes what it found is a loader that
 *    puts an API key in a CI log.
 */
import { readFileSync } from 'node:fs';

/** One file's worth of `KEY=value`, as pairs. Never throws. */
function parse(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const pairs = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    /* `export KEY=value` is what people paste out of a shell. */
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const split = body.indexOf('=');
    if (split <= 0) continue;
    const key = body.slice(0, split).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = body.slice(split + 1).trim();
    /* Quoted values keep their spaces and may contain `=` and `#`. */
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    } else {
      /* An unquoted trailing comment is a comment, not part of the key. */
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Loads the files, returning the names of the variables it set.
 *
 * Names, never values, so a caller can say "read ALPHAVANTAGE_KEY from
 * .env.local" without putting the key anywhere.
 */
const cameFrom = new Map();

/**
 * Which file a variable was read out of, or null when it came from the real
 * environment (or was never set).
 *
 * So a run can say "key from .env" and be right about which one. The first
 * version of that line assumed `.env.local` for anything the loader set, and
 * said `.env.local` about a key that was in `.env` — a small wrongness in the
 * one message whose job is telling somebody where their setting came from.
 */
export function envSource(name) {
  return cameFrom.get(name) ?? null;
}

export function loadEnv(root = new URL('..', import.meta.url)) {
  const set = [];
  for (const file of ['.env.local', '.env']) {
    for (const [key, value] of parse(new URL(file, root))) {
      if (process.env[key] !== undefined) continue;
      /* A blank line in a filled-in template means "I did not set this". */
      if (value.trim() === '') continue;
      process.env[key] = value;
      cameFrom.set(key, file);
      set.push(key);
    }
  }
  return set;
}

/**
 * A setting, or the fallback when it is missing **or blank**.
 *
 * Exists because `??` is the wrong operator for environment variables and the
 * difference is not academic. GitHub Actions substitutes an *empty string* for
 * a secret that does not exist, so
 *
 *     const UA = process.env.SEC_USER_AGENT ?? 'lemonade-edu-game (contact: ...)';
 *
 * sent the SEC an **empty User-Agent on every scheduled run**, because
 * `secrets.SEC_USER_AGENT` has never been set and `'' ?? x` is `''`. The SEC
 * asks for a real address specifically so they can refuse requests without one.
 * PRODUCT.md §79 concluded the 403s were the runner's IP address, on the
 * evidence that the same request succeeded from a laptop — but the laptop was
 * sending the default agent and the runner was sending nothing, so that
 * comparison did not hold the header constant and the conclusion was not
 * established.
 *
 * Same shape for the two staleness limits: `Number('')` is `0`, so a blank line
 * turned "fail if the prices are over a fortnight old" into "fail if they are
 * not from today".
 *
 * One helper rather than three careful call sites, because the next variable
 * somebody adds will have the same trap in it.
 */
export function envOr(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}
