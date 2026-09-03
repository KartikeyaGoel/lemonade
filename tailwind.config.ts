import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sign: ['var(--font-sign)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        ledger: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        lemon: { light: '#FFF3A0', DEFAULT: '#FFE14D', deep: '#FFC61A', rind: '#E0A200' },
        sky: { cold: '#7FA8C9', mild: '#5FBFF0', hot: '#FFD27A' },
        grass: { DEFAULT: '#5FBF5F', deep: '#3D9440' },
        wood: { DEFAULT: '#C97B3C', deep: '#9A5526', dark: '#6E3B18' },
        ink: { DEFAULT: '#2B2118', soft: '#5A4A38' },
        /*
         * Two pinks, and the readable one is the default.
         *
         * `berry` is the colour of every loss and every negative figure in the
         * game, which makes it the text a kid most needs to be able to read —
         * and at #FF5470 it sat at 3.1:1 on white, well under the 4.5:1 that
         * body text needs. Measured by `scripts/check-contrast.mjs`.
         *
         * The first attempt kept the bright pink for the four hand-painted
         * prices, on the grounds that large type only needs 3:1. It does not
         * survive contact with the check: bright pink on the lemon sign is
         * 2.75:1, and that sign carries the single most-looked-at number in the
         * game. So there is one pink, it passes everywhere, and nobody has to
         * remember which to reach for.
         */
        /*
         * Two berries and two mints, and each pair is one colour for light
         * backgrounds and one for dark.
         *
         * `mint-deep` and `berry-light` were already being used in three places
         * — the reckoning verdict and two lines of the challenge comparison —
         * and neither existed in this file, so Tailwind emitted nothing and the
         * figures rendered in the inherited body colour. Green for good and
         * pink for bad had silently stopped being either. Both are now real,
         * both are measured by `scripts/check-contrast.mjs` against the
         * backgrounds they actually sit on, and both stay separable from their
         * opposite under the two common forms of colour blindness.
         */
        /*
         * The panel the night screens put their figures on.
         *
         * Solid rather than `bg-white/10` over the gradient, and that is not a
         * style choice: the night sky runs from #1E2A4A at the top to #6B7BA8
         * at the bottom, so a tinted figure that reads at 5:1 against the top
         * of the screen reads at 2.5:1 against the bottom of it. A fixed panel
         * is the only surface a coloured number on a gradient can be measured
         * against, which is why `check-contrast.mjs` measures this one.
         */
        night: { panel: '#3A4363' },
        berry: { DEFAULT: '#BF3F54', light: '#FF9DAE' },
        mint: { DEFAULT: '#2ED9A0', deep: '#0B7A59' },
      },
      boxShadow: {
        chunk: '0 6px 0 0 var(--chunk-shadow, rgba(0,0,0,0.28))',
        'chunk-sm': '0 4px 0 0 var(--chunk-shadow, rgba(0,0,0,0.28))',
        sign: '0 8px 0 0 #9A5526, 0 14px 22px rgba(0,0,0,0.28)',
      },
      keyframes: {
        stroll: {
          '0%': { transform: 'translateX(0) scaleX(1)' },
          '100%': { transform: 'translateX(var(--walk-to)) scaleX(1)' },
        },
        bob: {
          '0%,100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%': { transform: 'translateY(-5px) rotate(1deg)' },
        },
        popIn: {
          '0%': { transform: 'scale(0.4) translateY(8px)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        coin: {
          '0%': { transform: 'translate(0,0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translate(var(--coin-x,0), var(--coin-y,-60px)) scale(1.1)', opacity: '0' },
        },
        riseFade: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        sway: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
        shimmer: { '0%,100%': { opacity: '0.75' }, '50%': { opacity: '1' } },
      },
      animation: {
        bob: 'bob 1.6s ease-in-out infinite',
        popIn: 'popIn 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        riseFade: 'riseFade 420ms ease-out both',
        sway: 'sway 3s ease-in-out infinite',
        shimmer: 'shimmer 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
