/**
 * The `.env` loader, which holds an API key and so gets read carefully.
 *
 * ## Why this is tested at all
 *
 * It is twenty lines and it decides whether the price feed is the official one.
 * A parser that quietly mangles a key does not fail loudly — it falls back to
 * the undocumented endpoint and the build goes green, which is the exact shape
 * of the defect PRODUCT.md §79 is about.
 *
 * Two of the rules are load-bearing rather than cosmetic:
 *
 *  - **the real environment wins over the file**, so a repository secret in CI
 *    is never overwritten by a stale line in somebody's local copy
 *  - **`.env.local` wins over `.env`**, matching what Next.js does for the app
 *
 * Get either backwards and the behaviour depends on which ran last.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { envOr, loadEnv } from '../scripts/env.mjs';

/** A throwaway directory standing in for a repo root. */
function repo(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'lemonade-env-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), body);
  }
  /* A trailing slash, or `new URL('.env', root)` resolves against the parent. */
  return { dir, url: pathToFileURL(`${dir}/`) };
}

const TOUCHED = ['A_KEY', 'B_KEY', 'QUOTED', 'SPACED', 'WITH_EQUALS', 'HASHED', 'EXPORTED', 'EMPTY'];
const saved: Record<string, string | undefined> = {};

describe('reading a .env file', () => {
  beforeEach(() => {
    for (const key of TOUCHED) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TOUCHED) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('reads the plain case and says which names it set', () => {
    const { dir, url } = repo({ '.env': 'A_KEY=abc123\nB_KEY=def\n' });
    expect(loadEnv(url).sort()).toEqual(['A_KEY', 'B_KEY']);
    expect(process.env.A_KEY).toBe('abc123');
    expect(process.env.B_KEY).toBe('def');
    rmSync(dir, { recursive: true, force: true });
  });

  it('never overwrites what is already in the environment', () => {
    /*
     * The rule that matters in CI. A repository secret is set before this runs,
     * and a local `.env` that happened to be committed by accident must not be
     * able to replace it with a dead key.
     */
    process.env.A_KEY = 'from-the-secret';
    const { dir, url } = repo({ '.env': 'A_KEY=from-the-file\n' });
    expect(loadEnv(url)).toEqual([]);
    expect(process.env.A_KEY).toBe('from-the-secret');
    rmSync(dir, { recursive: true, force: true });
  });

  it('lets .env.local win over .env, the way the app does', () => {
    const { dir, url } = repo({
      '.env': 'A_KEY=plain\nB_KEY=only-in-plain\n',
      '.env.local': 'A_KEY=local\n',
    });
    loadEnv(url);
    expect(process.env.A_KEY).toBe('local');
    expect(process.env.B_KEY).toBe('only-in-plain');
    rmSync(dir, { recursive: true, force: true });
  });

  it('handles what people actually paste', () => {
    const { dir, url } = repo({
      '.env': [
        '# a comment',
        '',
        '   ',
        'export EXPORTED=out-of-a-shell',
        'QUOTED="keeps the spaces "',
        "SPACED  =  trimmed  ",
        'WITH_EQUALS=a=b=c',
        'HASHED=value # trailing comment',
        'EMPTY=',
        'not a pair',
        '=no-name',
        '1BAD=starts-with-a-digit',
      ].join('\n'),
    });
    const set = loadEnv(url);
    expect(process.env.EXPORTED).toBe('out-of-a-shell');
    expect(process.env.QUOTED).toBe('keeps the spaces ');
    expect(process.env.SPACED).toBe('trimmed');
    /* An API key can contain `=`; splitting on every one of them would eat it. */
    expect(process.env.WITH_EQUALS).toBe('a=b=c');
    expect(process.env.HASHED).toBe('value');
    /*
     * A blank value is *not* set, and this is the one that had teeth.
     *
     * `.env.example` is a template of empty lines. Copying it and filling in
     * one of them leaves the rest blank — and `process.env.X ?? fallback` does
     * not fall back on `''`. That set the SEC's User-Agent to nothing and both
     * staleness limits to `Number('')`, which is zero. See `envOr`.
     */
    expect(process.env.EMPTY).toBeUndefined();
    expect(set).not.toContain('EMPTY');
    expect(set).not.toContain('1BAD');
    expect(set).toHaveLength(5);
    rmSync(dir, { recursive: true, force: true });
  });

  it('is silent and safe when there is nothing there', () => {
    /* A fresh clone has no env file and must not be an error — which is why
       this is twenty lines rather than Node's `--env-file`, which throws. */
    const { dir, url } = repo({});
    expect(loadEnv(url)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the example file names every setting the scripts read', () => {
  it('has an entry for each variable, so nothing is undiscoverable', () => {
    /*
     * The §40 class applied to configuration: a setting the code reads and no
     * document mentions is a setting nobody will ever set. The customer's
     * words were "I dont see a .env to add an api key", which is that defect
     * reported from outside.
     *
     * Scanned out of the scripts rather than listed here, so a new
     * `process.env.WHATEVER` fails this until `.env.example` explains it.
     */
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const read = new Set<string>();
    for (const file of readdirSync(new URL('../scripts', import.meta.url))) {
      if (!file.endsWith('.mjs')) continue;
      const source = readFileSync(new URL(`../scripts/${file}`, import.meta.url), 'utf8');
      for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        read.add(match[1]);
      }
    }
    expect(read.size).toBeGreaterThan(2);
    const missing = [...read].filter((name) => !example.includes(name));
    expect(missing, 'read by a script and not named in .env.example').toEqual([]);
  });

  it('holds no values, because it is the one committed', () => {
    /* The whole point of an example file is that it can be read by anybody. A
       value in here is a leaked credential. */
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    for (const line of example.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      expect(trimmed, 'a committed example file has a value in it').toMatch(/^[A-Z][A-Z0-9_]*=$/);
    }
  });
});

describe('a setting that is present but blank', () => {
  /*
   * The trap this whole helper exists for, and it was live in CI rather than
   * hypothetical: GitHub Actions substitutes an **empty string** for a secret
   * that has never been created, and the workflow passes
   * `SEC_USER_AGENT: ${{ secrets.SEC_USER_AGENT }}`. So every scheduled run
   * sent the SEC an empty User-Agent — the one thing they ask you not to do —
   * because `'' ?? fallback` is `''`.
   */
  const KEY = 'ENVOR_PROBE';
  afterEach(() => {
    delete process.env[KEY];
  });

  it('falls back on empty, on whitespace and on missing', () => {
    delete process.env[KEY];
    expect(envOr(KEY, 'fallback')).toBe('fallback');
    process.env[KEY] = '';
    expect(envOr(KEY, 'fallback')).toBe('fallback');
    process.env[KEY] = '   ';
    expect(envOr(KEY, 'fallback')).toBe('fallback');
  });

  it('uses a real value, including one that looks falsy', () => {
    process.env[KEY] = 'actual';
    expect(envOr(KEY, 'fallback')).toBe('actual');
    /* "0" is a real answer for a day limit and must survive. */
    process.env[KEY] = '0';
    expect(envOr(KEY, '14')).toBe('0');
  });

  it('is what the scripts use, so the trap cannot come back', () => {
    /*
     * Read out of the source rather than trusted, because the defect was one
     * `??` in one line and the fix is only a fix while nothing reintroduces it.
     * Every script that reads an optional setting has to go through `envOr`.
     */
    for (const file of ['fetch-market-data.mjs', 'check-market-data.mjs']) {
      const source = readFileSync(new URL(`../scripts/${file}`, import.meta.url), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
      const risky = [...code.matchAll(/process\.env\.[A-Z][A-Z0-9_]*\s*\?\?/g)].map((m) => m[0]);
      expect(risky, `${file} reads an optional setting with ?? instead of envOr`).toEqual([]);
    }
  });
});
