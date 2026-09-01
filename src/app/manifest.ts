import type { MetadataRoute } from 'next';

/**
 * Add-to-home-screen support.
 *
 * Not decoration. The whole retention argument in PRODUCT.md §15 rests on a kid
 * opening this again on Thursday, and on a phone that means an icon on the home
 * screen rather than a bookmark in a browser they never reopen. `standalone`
 * drops the address bar so it looks like the other games on the screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lemonade Stand',
    short_name: 'Lemonade',
    description:
      'Run a lemonade stand, find the price that actually makes money, then buy slices of real companies with the proceeds.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#3FA9E8',
    theme_color: '#3FA9E8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
