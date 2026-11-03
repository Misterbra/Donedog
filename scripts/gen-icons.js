// Génère les icônes PNG (tray + installeur) sans aucune dépendance :
// encodeur PNG minimal (zlib natif de Node + CRC32 maison).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PALETTE = {
  o: [59, 43, 31, 255],
  b: [217, 154, 85, 255],
  c: [246, 231, 201, 255],
  k: [28, 28, 28, 255],
  '.': [0, 0, 0, 0]
};

// Tête de chien de face, 16x16
const FACE = [
  '....oo....oo....',
  '...obbo..obbo...',
  '...obbboobbbo...',
  '..obbbbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..obkbbbbbbkbo..',
  '..obbbbbbbbbbo..',
  '..obbbccccbbbo..',
  '..obbccccccbbo..',
  '...obcckkccbo...',
  '...obccccccbo...',
  '....obbccbbo....',
  '.....oooooo.....',
  '................',
  '................',
  '................'
];

// --- Encodeur PNG minimal ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function pngFromRGBA(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // filtre 0 devant chaque scanline
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderFace(scale) {
  const size = 16 * scale;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = FACE[Math.floor(y / scale)][Math.floor(x / scale)];
      const [r, g, b, a] = PALETTE[ch] || PALETTE['.'];
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return pngFromRGBA(size, size, rgba);
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.mkdirSync(path.join(root, 'build'), { recursive: true });

const png256 = renderFace(16);   // 256x256
fs.writeFileSync(path.join(root, 'assets', 'tray.png'), renderFace(2));    // 32x32
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png256);

// ICO wrapper around the same PNG (no re-encoding, no conversion tool):
// ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + raw PNG data.
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0);          // reserved
ico.writeUInt16LE(1, 2);          // type: icon
ico.writeUInt16LE(1, 4);          // 1 image
ico[6] = 0;                       // width 256 -> 0
ico[7] = 0;                       // height 256 -> 0
ico[8] = 0;                       // palette
ico[9] = 0;                       // reserved
ico.writeUInt16LE(1, 10);         // planes
ico.writeUInt16LE(32, 12);        // bpp
ico.writeUInt32LE(png256.length, 14);
ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, 'build', 'icon.ico'),
  Buffer.concat([ico, png256]));

console.log('Icons generated: assets/tray.png (32px), build/icon.png (256px), build/icon.ico');
