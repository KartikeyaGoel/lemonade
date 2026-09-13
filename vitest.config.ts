import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Two environments, on purpose.
 *
 * The simulation modules are pure and have no business paying for a DOM, so
 * they run in node. Component tests ask for one with a `@vitest-environment
 * jsdom` docblock at the top of the file, which keeps the fast suite fast — the
 * whole lib suite runs in under a second and that is worth protecting.
 */
export default defineConfig({
  // The components use the automatic JSX runtime, same as the app.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/ui/setup.ts'],
    /*
     * Thirty seconds, not vitest's default five.
     *
     * The default is a limit on *correct* tests as much as on hung ones, and
     * this suite has several that are deliberately large — sweeps that play
     * thousands of days or boot the app a thousand times. The claim sweep took
     * 2.2 seconds on a laptop, went over five on a CI runner, and failed a
     * green build for being slow rather than for being wrong. Two other files
     * were sitting at 2 seconds with no timeout of their own, one runner
     * hiccup away from the same thing.
     *
     * The deliberate sweeps still carry their own, longer, limits — a number
     * next to the test is documentation about how big that test is meant to
     * be. This is the floor under everything else, and 30s is far above any
     * honest test here while still failing a genuine hang inside a suite that
     * finishes in forty seconds.
     */
    testTimeout: 30_000,
    /*
     * A floor, not a target.
     *
     * Coverage went from 78% to 95% by writing the tests that were missing,
     * and the point of a threshold is that it cannot quietly go back: the
     * component layer was once at 26% with eighteen screens at zero, and
     * nothing noticed because nothing was measuring.
     *
     * Set a couple of points under where the suite actually sits, so an
     * honest refactor that moves a few lines does not fail the build while a
     * new screen with no tests does. Raise it when the number rises.
     */
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 96,
        branches: 88,
        functions: 92,
        lines: 96,
      },
    },
  },
});
