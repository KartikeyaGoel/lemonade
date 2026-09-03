/**
 * Sound.
 *
 * The most obvious thing missing from a game aimed at eleven-year-olds. Every
 * game in the reference set — Clash Royale, Roblox, Minecraft — is loud, and
 * not for atmosphere: the coin sound *is* the reward. In a game about money the
 * chink of a coin is doing curriculum work, because it attaches a feeling to
 * the exact instant a cup is sold at a profit, which is the thing we want the
 * kid to want.
 *
 * Two constraints shaped the implementation.
 *
 * **No files.** Audio assets are the heaviest thing you can put in a bundle,
 * and this app ships to a phone on a school network. Every sound here is
 * synthesised by the Web Audio API from a handful of numbers, so the whole
 * sound design costs about two kilobytes and works offline. It also means the
 * pitches are *data*, which is why the scores below are a pure table and are
 * unit-tested rather than eyeballed.
 *
 * **Off is a real option.** A kid playing under a desk in a classroom needs a
 * mute that works before the first sound, and their choice has to survive a
 * reload. Muting is checked at the moment of playing, not at setup.
 *
 * Browsers will not start an AudioContext until the user has touched the page,
 * so the context is created lazily on the first `play` and resumed if a
 * previous one got suspended. A failure anywhere in here is swallowed: a game
 * must never fail to run a day because the speaker is busy.
 */

/** One tone in a cue. Times are seconds from the start of the cue. */
export interface Note {
  /** Hertz. A second entry sweeps to that pitch across the note. */
  hz: number | [number, number];
  at: number;
  secs: number;
  /** 0–1, before the master gain. */
  gain?: number;
  wave?: OscillatorType;
  /** Filtered white noise instead of an oscillator: fizz, pour, paper. */
  noise?: boolean;
}

export type Cue =
  | 'tap'
  | 'open'
  | 'close'
  | 'coin'
  | 'cash'
  | 'pour'
  | 'sad'
  | 'badge'
  | 'unlock'
  | 'fanfare'
  | 'bell'
  | 'tick';

/**
 * The score.
 *
 * Kept deliberately short: nothing here is longer than a second, because a cue
 * that outlasts the tap that caused it feels like lag rather than feedback.
 *
 * The pitches are not arbitrary. Everything that means *good* rises through a
 * major triad, everything that means *no* falls, and the two are far enough
 * apart that a kid learns the difference without being told — which is the
 * whole point of having sound at all.
 */
export const SCORES: Record<Cue, Note[]> = {
  /** A blip. Every touchable thing in the scene answers with this. */
  tap: [{ hz: 660, at: 0, secs: 0.05, gain: 0.16, wave: 'square' }],

  /** A sheet coming up over the scene. */
  open: [{ hz: [420, 760], at: 0, secs: 0.11, gain: 0.14, wave: 'sine' }],

  /** And going back down. */
  close: [{ hz: [700, 400], at: 0, secs: 0.1, gain: 0.12, wave: 'sine' }],

  /** One cup sold. B5 into E6 — small, bright, repeatable forty times a day. */
  coin: [
    { hz: 988, at: 0, secs: 0.06, gain: 0.13, wave: 'triangle' },
    { hz: 1319, at: 0.05, secs: 0.1, gain: 0.11, wave: 'triangle' },
  ],

  /** The till at the end of a day. Cha-ching, with the drawer. */
  cash: [
    { hz: 1319, at: 0, secs: 0.09, gain: 0.16, wave: 'triangle' },
    { hz: 1760, at: 0.07, secs: 0.26, gain: 0.14, wave: 'triangle' },
    { hz: 2200, at: 0.07, secs: 0.22, gain: 0.05, wave: 'sine' },
    { hz: 0, at: 0.0, secs: 0.09, gain: 0.05, noise: true },
  ],

  /** Lemonade going into a cup: filtered noise, no pitch. */
  pour: [{ hz: 0, at: 0, secs: 0.34, gain: 0.07, noise: true }],

  /** A customer walks away, or the day ends down. Falls, and stays low. */
  sad: [
    { hz: [330, 247], at: 0, secs: 0.16, gain: 0.12, wave: 'sawtooth' },
    { hz: [247, 165], at: 0.14, secs: 0.24, gain: 0.1, wave: 'sawtooth' },
  ],

  /** A badge. Three steps up, quick enough not to hold up the screen. */
  badge: [
    { hz: 784, at: 0, secs: 0.09, gain: 0.14, wave: 'triangle' },
    { hz: 988, at: 0.08, secs: 0.09, gain: 0.14, wave: 'triangle' },
    { hz: 1319, at: 0.16, secs: 0.22, gain: 0.14, wave: 'triangle' },
  ],

  /** A whole system arriving. A C major arpeggio, landing on the octave. */
  unlock: [
    { hz: 523, at: 0, secs: 0.1, gain: 0.13, wave: 'triangle' },
    { hz: 659, at: 0.09, secs: 0.1, gain: 0.13, wave: 'triangle' },
    { hz: 784, at: 0.18, secs: 0.1, gain: 0.13, wave: 'triangle' },
    { hz: 1047, at: 0.27, secs: 0.34, gain: 0.15, wave: 'triangle' },
  ],

  /** The end of an act. The only cue allowed to take a whole second. */
  fanfare: [
    { hz: 523, at: 0, secs: 0.12, gain: 0.13, wave: 'square' },
    { hz: 659, at: 0.1, secs: 0.12, gain: 0.13, wave: 'square' },
    { hz: 784, at: 0.2, secs: 0.12, gain: 0.13, wave: 'square' },
    { hz: 1047, at: 0.3, secs: 0.16, gain: 0.15, wave: 'square' },
    { hz: 784, at: 0.46, secs: 0.1, gain: 0.11, wave: 'square' },
    { hz: 1047, at: 0.56, secs: 0.44, gain: 0.16, wave: 'triangle' },
    { hz: 1319, at: 0.56, secs: 0.44, gain: 0.09, wave: 'sine' },
  ],

  /**
   * The opening bell, for the one moment in the game that has a real one.
   *
   * A bell rather than another triad, because a listing is not the same kind of
   * event as an act ending and should not sound like one. It still rises — the
   * rule in PRODUCT.md §32 is that everything meaning good rises and everything
   * meaning no falls, and the one thing a child has to learn about this sound
   * design is the thing they should not have to be told.
   */
  bell: [
    { hz: 880, at: 0, secs: 0.5, gain: 0.15, wave: 'sine' },
    { hz: 1318, at: 0.02, secs: 0.48, gain: 0.07, wave: 'sine' },
    { hz: 1760, at: 0.06, secs: 0.44, gain: 0.05, wave: 'sine' },
    { hz: [880, 1760], at: 0.34, secs: 0.36, gain: 0.1, wave: 'triangle' },
  ],

  /** A number counting up. Quiet on purpose: it fires many times in a row. */
  tick: [{ hz: 1200, at: 0, secs: 0.02, gain: 0.05, wave: 'square' }],
};

/** How long a cue lasts, in seconds. Used by the tests and by the ducking. */
export function cueLength(cue: Cue): number {
  return SCORES[cue].reduce((end, note) => Math.max(end, note.at + note.secs), 0);
}

/* ------------------------------------------------------------------ *
 * The player
 * ------------------------------------------------------------------ */

const MUTE_KEY = 'lemonade.muted.v1';
/**
 * Everything goes through this. Set once, low, because the alternative is a
 * kid turning the game off rather than turning it down.
 */
const MASTER = 0.5;

let ctx: AudioContext | null = null;
let muted: boolean | null = null;
const listeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  if (muted !== null) return muted;
  if (typeof window === 'undefined') return true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // A kid in private browsing still gets the setting for this session.
  }
  for (const listener of listeners) listener(next);
}

/** Lets the mute button re-render when the setting changes anywhere. */
export function onMuteChange(listener: (muted: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // Safari suspends the context when the tab is backgrounded and does not
    // resume it on its own.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** ~0.4s of white noise, made once and reused. */
let noiseBuffer: AudioBuffer | null = null;
function noise(audio: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const frames = Math.floor(audio.sampleRate * 0.4);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Fades across the buffer so a noise burst has a shape rather than a wall.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * How long the phone buzzes for a cue, in milliseconds.
 *
 * Only the cues that mark something *finishing* get one. A buzz on every cup
 * would fire forty times a day, which drains a battery and stops meaning
 * anything by the fourth one — and a phone that will not stop vibrating is a
 * phone a parent takes away.
 *
 * It rides the same mute switch as the sound rather than getting a setting of
 * its own. A child who turned the game silent because they are in a lesson does
 * not want it buzzing on the desk either, and two toggles for "be quiet" is one
 * too many.
 */
export const BUZZ_MS: Partial<Record<Cue, number | number[]>> = {
  cash: [14, 40, 22],
  badge: 18,
  unlock: [18, 60, 18],
  fanfare: [24, 60, 24, 60, 40],
  bell: [30, 80, 30],
  sad: 32,
};

/** The cues that get one, so the rule can be tested rather than trusted. */
export const BUZZABLE = Object.keys(BUZZ_MS) as Cue[];

function buzz(cue: Cue): void {
  const pattern = BUZZ_MS[cue];
  if (pattern === undefined) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Desktop, an unsupported browser, or a user who has switched it off at the
    // system level. None of those is a reason to stop.
  }
}

/**
 * Play a cue. Never throws, never awaits, safe to call from a render handler
 * and safe to call on a server (where it does nothing).
 */
export function play(cue: Cue): void {
  if (isMuted()) return;
  buzz(cue);
  const audio = context();
  if (!audio) return;

  try {
    const start = audio.currentTime + 0.001;
    for (const note of SCORES[cue]) {
      const at = start + note.at;
      const gain = audio.createGain();
      const peak = (note.gain ?? 0.12) * MASTER;

      // A short ramp in and an exponential ramp out. Without the ramp in, every
      // note starts with a click, which on a phone speaker is the loudest part
      // of the sound.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.secs);
      gain.connect(audio.destination);

      if (note.noise) {
        const source = audio.createBufferSource();
        source.buffer = noise(audio);
        const filter = audio.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        filter.Q.value = 0.7;
        source.connect(filter).connect(gain);
        source.start(at);
        source.stop(at + note.secs);
        continue;
      }

      const osc = audio.createOscillator();
      osc.type = note.wave ?? 'sine';
      if (Array.isArray(note.hz)) {
        osc.frequency.setValueAtTime(note.hz[0], at);
        osc.frequency.exponentialRampToValueAtTime(note.hz[1], at + note.secs);
      } else {
        osc.frequency.setValueAtTime(note.hz, at);
      }
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + note.secs);
    }
  } catch {
    // Autoplay policy, an exhausted context, a locked device. Not worth a crash.
  }
}
