import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="en">
      <head>
        {/* Loaded by link rather than next/font so an offline build still works;
            the fallback stack in globals.css keeps the look close. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
