/** @vitest-environment jsdom */
/**
 * The shell around the game: the document, the manifest, the service worker.
 *
 * All three were at zero percent, and all three carry a claim the product makes
 * out loud somewhere else:
 *
 *  - `layout.tsx` self-hosts its fonts, because `PRODUCT.md`, the README and
 *    `TEACHING.md` all tell a teacher that nothing leaves the device. That was
 *    once untrue — the fonts were two `<link>` tags to Google — and nothing but
 *    a comment stops it becoming untrue again.
 *  - `manifest.ts` is what puts an icon on a home screen, which is the whole
 *    retention argument in §15.
 *  - `OfflineReady` registers the worker in production and *unregisters* it in
 *    development, and the comment explains that the second half cost somebody
 *    an hour. Both halves are testable.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * `next/font/google` is a build-time transform, not a runtime module: the
 * bundler downloads the files and rewrites the call. Outside a Next build the
 * import is a stub, so it gets one here.
 *
 * Stubbed rather than avoided, because the point of the file is that the
 * layout self-hosts its fonts — and the only way to check that the layout does
 * what it claims is to load the layout.
 */
vi.mock('next/font/google', () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? '--font-test',
    className: 'font-test',
    style: { fontFamily: 'test' },
  });
  return { Bangers: font, Nunito: font };
});

const { default: RootLayout, metadata, viewport } = await import('@/app/layout');
import manifest from '@/app/manifest';
import { OfflineReady } from '@/components/OfflineReady';

describe('the document the game is served in', () => {
  it('describes itself well enough to be shared', () => {
    expect(metadata.title).toBeTruthy();
    expect(String(metadata.description).length).toBeGreaterThan(20);
    expect(metadata.applicationName).toBeTruthy();
    // Installable as an app, which is what `standalone` on the manifest needs
    // on the iOS side.
    expect(metadata.appleWebApp).toBeTruthy();
  });

  /*
   * Deliberately unindexed. Everything a child does lives in `localStorage` on
   * their own device, so there is nothing to index and nothing to preview —
   * and a game for nine-year-olds turning up in search results is a shape of
   * attention nobody asked for.
   */
  it('asks not to be indexed', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  /*
   * The claim that matters. A `<link>` to `fonts.googleapis.com` hands a
   * child's IP address and user agent to Google on every page load, and three
   * separate documents in this repo promise it does not happen. `next/font`
   * downloads at build time and serves from this origin — so the test is that
   * no external origin appears anywhere in the layout at all.
   */
  it('reaches no third-party origin', () => {
    const source = readLayoutSource();
    const origins = source.match(/https?:\/\/[\w.-]+/g) ?? [];
    const external = origins.filter(
      (url) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url),
    );
    expect(external, `the layout references ${external.join(', ')}`).toEqual([]);
  });

  it('locks the viewport the way a one-finger game needs', () => {
    // A game played with a thumb on a 375-pixel screen must not pinch-zoom
    // out from under the child mid-tap.
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
    expect(viewport.themeColor).toBeTruthy();
  });

  /*
   * `<html>` cannot be nested inside a `<div>`, so jsdom hoists it and the
   * container comes back empty. Rendering to a document fragment and reading
   * the tree is what actually checks the shell: the fonts get onto the html
   * element and the children survive into the body.
   */
  it('puts the fonts on the document and the children in the body', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>a folding table</p>
      </RootLayout>,
    );
    expect(html).toContain('a folding table');
    expect(html).toMatch(/<html[^>]*lang="en"/);
    // Both font variables, self-hosted, on the root element.
    expect(html).toMatch(/class="[^"]*--font/);
  });
});

describe('the home-screen manifest', () => {
  const built = manifest();

  it('is installable, standalone and portrait', () => {
    expect(built.name).toBeTruthy();
    expect(built.short_name!.length).toBeLessThanOrEqual(12);
    expect(built.start_url).toBe('/');
    // Without `standalone` it opens in a browser tab with an address bar and
    // stops looking like the other games on the screen.
    expect(built.display).toBe('standalone');
    expect(built.orientation).toBe('portrait');
  });

  it('has an icon big enough for a home screen', () => {
    expect(built.icons?.length, 'no icons at all').toBeGreaterThan(0);
    const biggest = Math.max(
      ...(built.icons ?? []).map((icon) => Number(String(icon.sizes).split('x')[0]) || 0),
    );
    expect(biggest, 'no icon large enough to install with').toBeGreaterThanOrEqual(192);
  });

  it('picks colours that exist in the game', () => {
    for (const colour of [built.background_color, built.theme_color]) {
      expect(colour, 'a manifest colour is not a colour').toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });
});

describe('the service worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubServiceWorker() {
    const register = vi.fn().mockResolvedValue({});
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    vi.stubGlobal('navigator', {
      ...window.navigator,
      serviceWorker: { register, getRegistrations },
    });
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['lemonade-v1', 'somebody-elses-cache']),
      delete: del,
    });
    return { register, unregister, getRegistrations, del };
  }

  // `process.env.NODE_ENV` is not a writable data property, so it is stubbed
  // rather than assigned.
  function setEnv(value: string) {
    vi.stubEnv('NODE_ENV', value as 'production' | 'development');
  }

  it('registers in production', async () => {
    setEnv('production');
    const { register } = stubServiceWorker();
    render(<OfflineReady />);
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
  });

  /*
   * And actively evicts in development, which is the half that is easy to
   * think of as belt-and-braces and is not: a worker left over from a
   * production build keeps serving stale chunks on `localhost`, and it
   * presents as an edit that compiled, passed its tests and is not on screen.
   */
  it('unregisters and clears its own caches in development', async () => {
    setEnv('development');
    const { register, unregister, del } = stubServiceWorker();
    render(<OfflineReady />);
    await waitFor(() => expect(unregister).toHaveBeenCalled());
    expect(register, 'registered a worker in development').not.toHaveBeenCalled();
    // Only its own caches. Deleting somebody else's would be rude and wrong.
    await waitFor(() => expect(del).toHaveBeenCalledWith('lemonade-v1'));
    expect(del).not.toHaveBeenCalledWith('somebody-elses-cache');
  });

  it('renders nothing at all', () => {
    setEnv('production');
    stubServiceWorker();
    const { container } = render(<OfflineReady />);
    expect(container.innerHTML).toBe('');
  });

  it('does nothing on a browser without service workers', async () => {
    setEnv('production');
    vi.stubGlobal('navigator', { userAgent: 'test' });
    expect(() => render(<OfflineReady />)).not.toThrow();
  });

  it('waits for load rather than competing with the first paint', async () => {
    setEnv('production');
    const { register } = stubServiceWorker();
    // A document still loading: registration has to be deferred.
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { unmount } = render(<OfflineReady />);
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(register).toHaveBeenCalled());
    unmount();
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  });
});

/** Read straight off disk, because the claim is about the source, not the render. */
function readLayoutSource(): string {
  return readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
}
