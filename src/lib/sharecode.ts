/**
 * Share codes.
 *
 * Multiplayer here works the way a Minecraft seed works: a short string that
 * two people can both put into their own copy of the game and get the same
 * world. There is no server, no account and no network call — a code carries
 * everything the other device needs.
 *
 * Two kinds:
 *
 *  - **Short codes** (`SKY-...`, `RUN-...`) are packed by hand into a handful
 *    of bytes so they can be read out loud across a lunch table. Crockford
 *    base32, so there is no I/L/O/U to mistype and no case to get wrong.
 *  - **Long codes** (`CLUB-...`) carry a whole club's state, which is too big
 *    to read out, so they are base64url of JSON and meant to be pasted.
 *
 * Every code carries a checksum. A kid who mistypes one character is told the
 * code is wrong rather than silently dropped into a different world, which
 * would be far more confusing than an error.
 *
 * Pure module. No React, no I/O, no network.
 */

/** Crockford base32: no I, L, O or U, so nothing looks like anything else. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const DECODE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;
  // The forgiving substitutions Crockford specifies.
  map['I'] = 1;
  map['L'] = 1;
  map['O'] = 0;
  map['U'] = map['V'];
  return map;
})();

/* ------------------------------------------------------------------ *
 * Bytes
 * ------------------------------------------------------------------ */

export class ByteWriter {
  private bytes: number[] = [];

  u8(value: number): this {
    this.bytes.push(Math.max(0, Math.min(255, Math.round(value))) & 0xff);
    return this;
  }

  uint(value: number, width: number): this {
    const clamped = Math.max(0, Math.round(value));
    for (let i = width - 1; i >= 0; i--) {
      this.bytes.push((clamped / 256 ** i) & 0xff);
    }
    return this;
  }

  done(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export class ByteReader {
  private at = 0;
  constructor(private bytes: Uint8Array) {}

  u8(): number {
    return this.bytes[this.at++] ?? 0;
  }

  uint(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) value = value * 256 + (this.bytes[this.at++] ?? 0);
    return value;
  }

  get remaining(): number {
    return Math.max(0, this.bytes.length - this.at);
  }
}

/** FNV-1a, truncated to a byte. Enough to catch a single mistyped character. */
function checksum(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash ^ (hash >>> 8) ^ (hash >>> 16) ^ (hash >>> 24)) & 0xff) >>> 0;
}

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const digit = DECODE_MAP[char];
    if (digit === undefined) return null;
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/* ------------------------------------------------------------------ *
 * Short codes
 * ------------------------------------------------------------------ */

/** Groups of four, so a kid can read it out without losing their place. */
function group(text: string, size = 4): string {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.join('-');
}

export function encodeShort(prefix: string, payload: Uint8Array): string {
  const withSum = new Uint8Array(payload.length + 1);
  withSum.set(payload, 0);
  withSum[payload.length] = checksum(payload);
  return `${prefix}-${group(toBase32(withSum))}`;
}

/**
 * Reads a short code back. Returns null for the wrong prefix, an unreadable
 * character, or a failed checksum — the caller shows one "that code is not
 * right" message rather than trying to guess what was meant.
 */
export function decodeShort(prefix: string, code: string, payloadBytes: number): Uint8Array | null {
  const cleaned = code.trim().toUpperCase().replace(/\s/g, '');
  const head = `${prefix.toUpperCase()}-`;
  if (!cleaned.startsWith(head)) return null;

  const body = cleaned.slice(head.length).replace(/-/g, '');
  const bytes = fromBase32(body);
  if (!bytes || bytes.length !== payloadBytes + 1) return null;

  const payload = bytes.slice(0, payloadBytes);
  if (bytes[payloadBytes] !== checksum(payload)) return null;

  // Re-encode and insist on an exact match.
  //
  // Without this, a mistyped *last* character slips through: base32 does not
  // divide evenly into bytes, so the final character of a short code carries
  // some bits that are discarded on the way back. Changing only those bits
  // leaves the payload and the checksum intact. Requiring the code to be in
  // canonical form closes that hole, so "one wrong character" always means
  // "that code is not right" rather than silently the same world.
  if (toBase32(bytes) !== body.replace(/[ILOU]/g, (char) => (char === 'O' ? '0' : char === 'U' ? 'V' : '1'))) {
    return null;
  }

  return payload;
}

/* ------------------------------------------------------------------ *
 * Long codes
 * ------------------------------------------------------------------ */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += B64[c & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of text) {
    const digit = B64.indexOf(char);
    if (digit < 0) return null;
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function encodeLong(prefix: string, data: unknown): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const sum = checksum(bytes);
  return `${prefix}-${toBase32(new Uint8Array([sum]))}-${toBase64Url(bytes)}`;
}

export function decodeLong<T>(prefix: string, code: string): T | null {
  const cleaned = code.trim().replace(/\s/g, '');
  const head = `${prefix}-`;
  if (!cleaned.startsWith(head)) return null;

  const rest = cleaned.slice(head.length);
  const split = rest.indexOf('-');
  if (split < 0) return null;

  const sumBytes = fromBase32(rest.slice(0, split).toUpperCase());
  const bytes = fromBase64Url(rest.slice(split + 1));
  if (!sumBytes || sumBytes.length < 1 || !bytes) return null;
  if (sumBytes[0] !== checksum(bytes)) return null;

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}
