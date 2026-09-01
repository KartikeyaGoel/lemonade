/**
 * Offline.
 *
 * The game has no backend, makes no network calls from a child's device, and
 * keeps every save in localStorage — so there is no reason at all for it to
 * stop working when the wifi does. It did anyway, because a web page needs the
 * network to load itself.
 *
 * That matters more than it sounds. The place this is most likely to be used at
 * scale is a classroom, thirty devices on one access point, and the lesson in
 * TEACHING.md dies if the page will not load for six of them. It matters on a
 * bus, in a car, and in a house where the internet is metered.
 *
 * Strategy, deliberately boring:
 *
 *  - **Hashed build assets** (`/_next/static/...`) are immutable by
 *    construction, so cache-first with no revalidation. A new build has new
 *    filenames.
 *  - **Navigations** are network-first with a cached fallback, so a child on a
 *    good connection always gets the newest build and a child on no connection
 *    still gets the game.
 *  - **Everything else same-origin** is stale-while-revalidate.
 *  - **Nothing cross-origin is touched at all.** Nothing should be going there.
 *
 * No `skipWaiting`. A new worker takes over on the next load rather than
 * swapping assets under a child who is halfway through a day.
 */

const VERSION = 'v1';
const SHELL = `lemonade-shell-${VERSION}`;
const ASSETS = `lemonade-assets-${VERSION}`;

/**
 * Fetches the entry point and everything it references.
 *
 * Relying on the fetch handler alone to fill the cache leaves a hole: the
 * browser only asks for what it needs, so a modern browser never downloads the
 * polyfill bundle and it is therefore missing from the cache when an older one
 * comes to the same device offline. Reading the URLs straight out of the shell
 * HTML is crude and covers exactly the set that matters.
 */
async function warm() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);

  const response = await fetch('/', { cache: 'reload' });
  if (!response.ok) return;
  await shell.put('/', response.clone());

  const html = await response.text();
  const referenced = new Set(
    [...html.matchAll(/\/_next\/static\/[A-Za-z0-9._\/-]+/g)].map((match) => match[0]),
  );
  await Promise.all(
    [...referenced].map((path) =>
      assets.add(path).catch(() => undefined),
    ),
  );
}

self.addEventListener('install', (event) => {
  // Never let one 404 fail the install: a game that half-works offline beats a
  // worker that never activates.
  event.waitUntil(warm().catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('lemonade-') && !name.endsWith(VERSION))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  const immutable = url.pathname.startsWith('/_next/static/');

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit && immutable) return hit;

      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit ?? Response.error());

      return hit ?? fresh;
    }),
  );
});
