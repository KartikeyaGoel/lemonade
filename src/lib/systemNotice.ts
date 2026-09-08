/**
 * The browser's own notification, for the part that works without a server.
 *
 * Everything about *what to say* lives in `notify.ts`, which is pure. This is
 * the only file that touches the Notification API, and it is deliberately
 * thin: three functions, every one of them safe to call on a device that has
 * never heard of notifications.
 *
 * ## What this can and cannot do, precisely
 *
 * A page can show a system notification with no server at all, once permission
 * is granted. So a nudge that becomes true **while the app is open** — a new
 * day starting, a grown-up replying on the same device — is a real
 * notification, on the lock screen, today.
 *
 * A page cannot show one when it is closed. That needs Web Push: the browser
 * hands you a subscription, and something has to POST to it. There is no
 * client-only way round this, and the one API that would have been — Chrome's
 * Notification Triggers, with `showTrigger` and a `TimestampTrigger` — was an
 * origin trial and never shipped. It is not available and should not be
 * planned around.
 *
 * ## Permission is asked for by a grown-up, never by a child
 *
 * `ask()` is called from one place: the grown-up screen. Not from the title,
 * not from the check-in, and not on first load.
 *
 * Partly because a permission prompt in front of a nine-year-old is a prompt
 * that gets tapped rather than read. Mostly because the audience is under 13,
 * and while a browser permission is **not** verifiable parental consent in the
 * COPPA sense — nothing on a shared device can be — putting the switch behind
 * the grown-up screen is the closest a local-only build can get, and it is the
 * shape the real consent flow will need anyway.
 */

export type NoticePermission = 'unsupported' | 'default' | 'granted' | 'denied';

/** What the browser will currently let us do. Never throws, never prompts. */
export function permission(): NoticePermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return Notification.permission as NoticePermission;
  } catch {
    return 'unsupported';
  }
}

/**
 * Ask once. Resolves to whatever the answer was, including a refusal.
 *
 * A refusal is a real answer and is not treated as a failure: the same nudges
 * are shown inside the app either way, so a parent who says no loses the lock
 * screen and nothing else. That is the property that makes it safe to ask at
 * all.
 */
export async function ask(): Promise<NoticePermission> {
  const now = permission();
  if (now !== 'default') return now;
  try {
    return (await Notification.requestPermission()) as NoticePermission;
  } catch {
    return 'denied';
  }
}

/**
 * Show one, if we are allowed to.
 *
 * Returns whether it was shown, so a caller can record the nudge as said only
 * when it actually was. Recording it either way would silently burn the daily
 * allowance on a device that showed nothing.
 *
 * Through the service worker when there is one, because a notification shown
 * from a registration survives the tab being closed a moment later and can
 * carry a tag — and falling back to the page constructor for browsers where
 * the registration is not ready yet.
 */
export async function show(
  title: string,
  body: string,
  tag: string,
): Promise<boolean> {
  if (permission() !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, {
        body,
        tag,
        // Replaces rather than stacks. Two notifications about the same thing
        // is the failure mode that gets an app uninstalled.
        renotify: false,
        icon: '/icon.png',
        badge: '/icon.png',
      } as NotificationOptions);
      return true;
    }
    new Notification(title, { body, tag, icon: '/icon.png' });
    return true;
  } catch {
    return false;
  }
}
