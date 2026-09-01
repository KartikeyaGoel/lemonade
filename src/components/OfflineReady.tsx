'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, and does nothing else.
 *
 * Deliberately not part of any screen: offline support is infrastructure, and
 * a component that renders nothing is easier to reason about than a `useEffect`
 * buried in the page. See `public/sw.js` for the strategy and for why a
 * classroom is the reason this exists.
 *
 * Registration is deferred until after load so it never competes with the first
 * paint, and every failure is swallowed — a browser with service workers
 * disabled, or a page served over plain http, should get the game and no
 * console noise.
 */
export function OfflineReady() {
  useEffect(() => {
    /*
     * Production only.
     *
     * In development the build emits hot-update chunks on every save, and a
     * cache-first worker happily stores them and then serves a stale one back —
     * which presents as an edit that did not take. Debugging your own service
     * worker instead of your own game is a bad afternoon.
     */
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      /*
       * Declining to register is not enough.
       *
       * A worker installed by a production build keeps controlling the origin
       * afterwards, and `localhost:3000` is the same origin whichever build
       * put it there. Dev chunk paths start with `/_next/static/` but are not
       * content-hashed, so the cache-first branch in `sw.js` matches them and
       * serves the same stale chunk back for ever. It presents as an edit that
       * compiled, passed its tests, and simply is not on the screen — which
       * cost an hour once and would cost anyone cloning this repo the same
       * hour. So development actively evicts.
       */
      void navigator.serviceWorker
        .getRegistrations()
        .then((all) => Promise.all(all.map((one) => one.unregister())))
        .then(() => caches?.keys())
        .then((names) =>
          Promise.all((names ?? []).filter((n) => n.startsWith('lemonade-')).map((n) => caches.delete(n))),
        )
        .catch(() => undefined);
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
