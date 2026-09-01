import { describe, it, expect } from 'vitest';
import {
  ByteReader,
  ByteWriter,
  decodeLong,
  decodeShort,
  encodeLong,
  encodeShort,
} from '../src/lib/sharecode';

describe('byte packing', () => {
  it('round-trips unsigned integers of each width', () => {
    const bytes = new ByteWriter().u8(200).uint(65_535, 2).uint(16_777_215, 3).uint(4_000_000_000, 4).done();
    const reader = new ByteReader(bytes);
    expect(reader.u8()).toBe(200);
    expect(reader.uint(2)).toBe(65_535);
    expect(reader.uint(3)).toBe(16_777_215);
    expect(reader.uint(4)).toBe(4_000_000_000);
  });

  it('clamps a byte rather than wrapping it', () => {
    const bytes = new ByteWriter().u8(999).u8(-4).done();
    const reader = new ByteReader(bytes);
    expect(reader.u8()).toBe(255);
    expect(reader.u8()).toBe(0);
  });
});

describe('short codes', () => {
  const payload = new ByteWriter().uint(3_141_592_653, 4).u8(7).done();

  it('round-trips through a code', () => {
    const code = encodeShort('SKY', payload);
    const back = decodeShort('SKY', code, 5);
    expect(back).not.toBeNull();
    const reader = new ByteReader(back!);
    expect(reader.uint(4)).toBe(3_141_592_653);
    expect(reader.u8()).toBe(7);
  });

  it('is grouped and prefixed so it can be read out loud', () => {
    const code = encodeShort('SKY', payload);
    expect(code.startsWith('SKY-')).toBe(true);
    expect(code.split('-').length).toBeGreaterThan(2);
  });

  it('accepts lower case and stray spaces, because kids type', () => {
    const code = encodeShort('SKY', payload);
    const messy = ` ${code.toLowerCase()} `;
    expect(decodeShort('SKY', messy, 5)).not.toBeNull();
  });

  it('forgives the characters Crockford says to forgive', () => {
    const code = encodeShort('SKY', payload);
    // O for 0 and I or L for 1 are the classic misreadings.
    const misread = code.replace(/0/g, 'O').replace(/1/g, 'I');
    expect(decodeShort('SKY', misread, 5)).toEqual(decodeShort('SKY', code, 5));
  });

  it('rejects a single mistyped character rather than silently decoding it', () => {
    const code = encodeShort('SKY', payload);
    // Walk every position and flip it to a different valid base32 digit.
    let rejected = 0;
    let tried = 0;
    for (let i = 4; i < code.length; i++) {
      if (code[i] === '-') continue;
      const replacement = code[i] === 'Z' ? 'Y' : 'Z';
      const broken = code.slice(0, i) + replacement + code.slice(i + 1);
      tried++;
      if (decodeShort('SKY', broken, 5) === null) rejected++;
    }
    expect(tried).toBeGreaterThan(4);
    expect(rejected).toBe(tried);
  });

  it('rejects the wrong prefix', () => {
    const code = encodeShort('SKY', payload);
    expect(decodeShort('RUN', code, 5)).toBeNull();
  });

  it('rejects a truncated code', () => {
    const code = encodeShort('SKY', payload);
    expect(decodeShort('SKY', code.slice(0, code.length - 4), 5)).toBeNull();
  });
});

describe('long codes', () => {
  const data = {
    name: 'The club',
    members: ['Ada', 'Kai', 'Yusuf'],
    cash: 1234.56,
    holdings: { AAPL: { shares: 3.21 } },
    note: 'punctuation, dashes-and_underscores, 100%',
  };

  it('round-trips a whole object', () => {
    const code = encodeLong('CLUB', data);
    expect(decodeLong('CLUB', code)).toEqual(data);
  });

  it('survives every byte length, so no padding case is broken', () => {
    for (let length = 0; length < 40; length++) {
      const payload = { s: 'x'.repeat(length) };
      expect(decodeLong('CLUB', encodeLong('CLUB', payload))).toEqual(payload);
    }
  });

  it('handles characters outside ASCII', () => {
    const payload = { name: 'Zoë 🍋 café' };
    expect(decodeLong('CLUB', encodeLong('CLUB', payload))).toEqual(payload);
  });

  it('rejects a corrupted body', () => {
    const code = encodeLong('CLUB', data);
    const broken = `${code.slice(0, code.length - 3)}${code.endsWith('A') ? 'B' : 'A'}${code.slice(code.length - 2)}`;
    expect(decodeLong('CLUB', broken)).toBeNull();
  });

  it('rejects a code with no checksum section', () => {
    expect(decodeLong('CLUB', 'CLUB-nochecksumhere')).toBeNull();
    expect(decodeLong('CLUB', 'notaclub')).toBeNull();
  });
});
