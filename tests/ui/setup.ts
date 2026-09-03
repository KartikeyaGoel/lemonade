import { afterEach, vi } from 'vitest';

/**
 * Runs for every test file, including the pure ones.
 *
 * Vitest applies `setupFiles` globally, and the lib suite runs in node where
 * there is no `window` to set up. Bailing out early is cheaper and clearer than
 * splitting the config into two projects for the sake of one `if`.
 */
const HAS_DOM = typeof window !== 'undefined';

/**
 * What a jsdom does not have.
 *
 * Every stub here is something the game genuinely calls, and each one is
 * stubbed rather than removed because "does this crash without a speaker" is a
 * thing worth testing: a child on a locked-down school device should still get
 * a game.
 */

// Web Audio. `src/lib/sound.ts` swallows failures already, so this only exists
// to keep the console quiet and to let a test assert that a cue was attempted.
class SilentAudio {
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate = 44100;
  resume() {}
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(8) };
  }
  createBufferSource() {
    return { buffer: null, connect: () => ({ connect() {} }), start() {}, stop() {} };
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: () => ({ connect() {} }) };
  }
}
if (HAS_DOM) vi.stubGlobal('AudioContext', SilentAudio);

// jsdom has no matchMedia, and `useCountUp` asks it whether the user has turned
// animation off. Answering "no" keeps the count-up under test.
if (HAS_DOM) {
  vi.stubGlobal(
  'matchMedia',
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })),
  );
}

/*
 * jsdom has no ResizeObserver, and `PinnedBar` uses one to publish its height
 * so the badge toast can clear it. The component already tolerates its absence,
 * but a stub that actually fires once is better than a no-op: it means the
 * measurement path is the one under test rather than the fallback.
 */
if (HAS_DOM && typeof ResizeObserver === 'undefined') {
  class ImmediateResizeObserver {
    constructor(private readonly callback: () => void) {}
    observe() {
      this.callback();
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

afterEach(async () => {
  if (!HAS_DOM) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  window.localStorage.clear();
});

if (HAS_DOM) {
  await import('@testing-library/jest-dom/vitest');
}
