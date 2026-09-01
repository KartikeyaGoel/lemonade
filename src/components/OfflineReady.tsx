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
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

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
