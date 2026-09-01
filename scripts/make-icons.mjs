#!/usr/bin/env node
/**
 * Draws the app icons as real PNGs and writes them into `src/app/`.
 *
 * Why generate rather than use Next's `ImageResponse`: that pulls a WASM
 * renderer into the build, and if it ever fails the whole deploy fails for the
 * sake of an icon. Rasterising a lemon is a hundred lines of arithmetic and
 * zlib, has no dependencies, and produces a file that is simply committed.
 *
 * `apple-icon.png` is the one that matters — it is what iOS uses when a kid adds
 * the game to their home screen, which is how a phone game actually gets opened
 * a second time. `icon.png` is the favicon fallback for browsers that would
 * rather have a raster than the SVG.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

const SKY = [63, 169, 232];
const LEMON = [255, 198, 26];
const HIGHLIGHT = [255, 233, 160];
const INK = [43, 33, 24];
const LEAF = [46, 217, 160];

/** Signed distance to a rounded rectangle, for anti-aliased corners. */
function roundedRectDistance(x, y, w, h, radius) {
  const dx = Math.abs(x - w / 2) - (w / 2 - radius);
  const dy = Math.abs(y - h / 2) - (h / 2 - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Signed distance to an ellipse, approximated well enough for an icon. */
function ellipseDistance(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const scale = Math.min(rx, ry);
  return (Math.hypot(nx, ny) - 1) * scale;
}

function mix(under, over, alpha) {
  return [
    Math.round(under[0] * (1 - alpha) + over[0] * alpha),
    Math.round(under[1] * (1 - alpha) + over[1] * alpha),
    Math.round(under[2] * (1 - alpha) + over[2] * alpha),
  ];
}

/** Coverage of a shape at a pixel, from its signed distance. 1px feather. */
function coverage(distance) {
  return Math.max(0, Math.min(1, 0.5 - distance));
}

function render(size) {
  const s = size / 64; // the SVG is authored on a 64-unit grid
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(size * 4);
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      const bg = coverage(roundedRectDistance(px, py, size, size, 14 * s));
      let colour = SKY;
      let alpha = bg;

      // Lemon body, with its outline drawn as a slightly larger ellipse.
      const outline = coverage(ellipseDistance(px, py, 32 * s, 35 * s, 22.8 * s, 18.8 * s));
      const body = coverage(ellipseDistance(px, py, 32 * s, 35 * s, 21 * s, 17 * s));
      colour = mix(colour, INK, outline * bg);
      colour = mix(colour, LEMON, body * bg);

      // A soft highlight, so it reads as round rather than flat.
      const shine = coverage(ellipseDistance(px, py, 24 * s, 29 * s, 6 * s, 4 * s));
      colour = mix(colour, HIGHLIGHT, shine * body * 0.85);

      // Leaf: a wedge above the lemon, outlined the same way.
      const leafOutline = coverage(ellipseDistance(px, py, 37 * s, 14 * s, 8 * s, 5.6 * s));
      const leaf = coverage(ellipseDistance(px, py, 37 * s, 14 * s, 6.6 * s, 4.2 * s));
      colour = mix(colour, INK, leafOutline * bg);
      colour = mix(colour, LEAF, leaf * bg);

      row[x * 4 + 0] = colour[0];
      row[x * 4 + 1] = colour[1];
      row[x * 4 + 2] = colour[2];
      row[x * 4 + 3] = Math.round(alpha * 255);
    }
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * Minimal PNG writer
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(rows, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  // 10..12 stay zero: deflate, no filter, no interlace.

  // Filter type 0 on every scanline. Good enough; these are tiny files.
  const raw = Buffer.concat(rows.map((row) => Buffer.concat([Buffer.from([0]), Buffer.from(row)])));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['src/app/apple-icon.png', 180],
  ['src/app/icon.png', 192],
];

for (const [path, size] of targets) {
  const file = new URL(`../${path}`, import.meta.url);
  await writeFile(file, png(render(size), size));
  console.log(`wrote ${path} (${size}×${size})`);
}
