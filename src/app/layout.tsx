import type { Metadata, Viewport } from 'next';
import { Bangers, Nunito } from 'next/font/google';
import './globals.css';
import { OfflineReady } from '@/components/OfflineReady';

/*
 * Self-hosted, and that is the whole point.
 *
 * These were two `<link>` tags to fonts.googleapis.com, with a comment saying
 * they were done that way "so an offline build still works". That was backwards
 * twice over. `next/font` downloads the files at build time and serves them
 * from this origin, so it is the version that works offline — and the version
 * that was supposed to was making three requests to Google on every single page
 * load, from a child's device, handing over an IP address and a user agent.
 *
 * The product tells teachers that nothing leaves the device. That claim is in
 * PRODUCT.md, in the README and in TEACHING.md, and until now it was not true.
 * A school that checks would have been right to block it.
 */
const sign = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-sign-loaded',
  display: 'swap',
});

const body = Nunito({
  weight: ['700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lemonade Stand',
  description:
    'Run a lemonade stand, find the price that actually makes money, then buy slices of real companies with the proceeds. No real money, ever.',
  applicationName: 'Lemonade Stand',
  // Everything lives in localStorage on the device. Nothing to index and
  // nothing to share, so keep it out of search results and previews.
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'Lemonade',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: 'Lemonade Stand',
    description:
      'Every stock is somebody else\'s lemonade stand. Run one, sell it, then go and buy other people\'s.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3FA9E8',
  // The game draws its own full-bleed sky, so let it run under the notch.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sign.variable} ${body.variable}`}>
      <body className="min-h-full antialiased">
        {children}
        <OfflineReady />
      </body>
    </html>
  );
}
