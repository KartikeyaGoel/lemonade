/**
 * Types for `env.mjs`, alongside `market-rules.d.mts` and for the same reason:
 * the scripts are plain ESM so Node can run them with no build step, and the
 * tests are TypeScript, so the boundary needs declaring by hand.
 */

/**
 * Reads `.env.local` then `.env` into `process.env` without overwriting
 * anything already there. Returns the **names** it set, never the values.
 */
export function loadEnv(root?: URL): string[];

/**
 * Which file a variable was read out of, or null when it came from the real
 * environment or was never set.
 */
export function envSource(name: string): string | null;

/**
 * A setting, or the fallback when it is missing **or blank**. Use instead of
 * `??`: a GitHub Actions secret that does not exist arrives as an empty string.
 */
export function envOr(name: string, fallback: string): string;
