import { describe, expect, it } from 'vitest';
import { SCORES, cueLength, type Cue } from '../src/lib/sound';

const CUES = Object.keys(SCORES) as Cue[];

describe('the score', () => {
  it('has every cue', () => {
    expect(CUES).toContain('coin');
    expect(CUES).toContain('cash');
    expect(CUES).toContain('sad');
  });

  it('never lets a cue outlast the tap that caused it', () => {
    // A cue longer than a second reads as lag rather than feedback. The
    // fanfare is the deliberate exception and gets exactly one second.
    for (const cue of CUES) {
      expect(cueLength(cue), cue).toBeLessThanOrEqual(1);
    }
    expect(cueLength('fanfare')).toBeGreaterThan(cueLength('unlock'));
  });

  it('keeps the sounds that fire many times a row the shortest', () => {
    // A coin plays once per cup and a tick once per counted dollar. If either
    // is long enough to overlap itself the day turns into a buzz.
    expect(cueLength('coin')).toBeLessThan(0.2);
    expect(cueLength('tick')).toBeLessThan(0.05);
    expect(cueLength('tap')).toBeLessThan(0.1);
  });

  it('never clips: nothing sums past full scale at any instant', () => {
    // Every note goes to the same destination, so simultaneous notes add. The
    // master gain is 0.5, so the loudest instant must stay under 2.
    for (const cue of CUES) {
      const edges = SCORES[cue].flatMap((note) => [note.at, note.at + note.secs / 2]);
      for (const t of edges) {
        const stacked = SCORES[cue]
          .filter((note) => t >= note.at && t < note.at + note.secs)
          .reduce((sum, note) => sum + (note.gain ?? 0.12), 0);
        expect(stacked, `${cue} at ${t}`).toBeLessThan(2);
      }
    }
  });

  it('makes good news rise and bad news fall', () => {
    // This is the only thing about the sound design a kid has to learn, and
    // they should learn it without being told. Pitch direction carries it.
    const direction = (cue: Cue) => {
      const pitches = SCORES[cue]
        .filter((note) => !note.noise)
        .flatMap((note) => (Array.isArray(note.hz) ? note.hz : [note.hz]));
      return Math.sign(pitches[pitches.length - 1] - pitches[0]);
    };
    for (const good of ['coin', 'cash', 'badge', 'unlock'] as Cue[]) {
      expect(direction(good), good).toBe(1);
    }
    expect(direction('sad')).toBe(-1);
  });

  it('stays inside what a phone speaker can actually produce', () => {
    for (const cue of CUES) {
      for (const note of SCORES[cue]) {
        if (note.noise) continue;
        for (const hz of Array.isArray(note.hz) ? note.hz : [note.hz]) {
          expect(hz, cue).toBeGreaterThan(100);
          expect(hz, cue).toBeLessThan(5000);
        }
      }
    }
  });

  it('never asks for a zero-length note', () => {
    // An exponential ramp to the same instant it started at is a click.
    for (const cue of CUES) {
      for (const note of SCORES[cue]) {
        expect(note.secs, cue).toBeGreaterThan(0.01);
        expect(note.at, cue).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
