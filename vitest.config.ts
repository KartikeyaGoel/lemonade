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
  },
});
