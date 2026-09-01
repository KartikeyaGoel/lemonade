/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nothing about the build needs to advertise itself.
  poweredByHeader: false,

  /**
   * The app is entirely client-side — no backend, no accounts, no network calls
   * from the device. These headers just make that hard to abuse: nobody should
   * be able to frame a children's game inside their own page, and there is no
   * reason for a referrer to leak anywhere.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
