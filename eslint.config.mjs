import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

/**
 * There was no lint config at all, which meant `npm run lint` dropped into an
 * interactive setup wizard and nobody had ever run it. Nothing here is a style
 * preference — the whole config exists to catch three things that a type
 * checker does not and that this codebase is specifically prone to.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommended,
  {
    rules: {
      /*
       * A stale dependency array in a game whose whole state is one object is
       * how a screen ends up showing yesterday's numbers. Next only warns.
       */
      'react-hooks/exhaustive-deps': 'error',

      /*
       * Unused code is the tell for a half-finished refactor. `skyOfTheDay` sat
       * fully written, fully tested and wired to nothing for weeks, and this is
       * the check that would have said so.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      /*
       * `any` is how a wrong number reaches a child's screen without anybody
       * having to be careless anywhere in particular.
       */
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
