'use strict';
// 生成 256x256 高清图标：绿色渐变球 + 白色描边 + 左上高光。
// 同时输出 PNG（托盘/窗口用）与 ICO（exe 打包用，PNG 嵌入格式）。
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 256;
const cx = S / 2, cy = S / 2;
const Router = S / 2 - 2;
const Rin = S / 2 - 18; // 白边宽约 16px
const raw = Buffer.alloc((S * 4 + 1) * S);

for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    const dx = x - cx + 0.5, dy = y - cy + 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    const o = y * (S * 4 + 1) + 1 + x * 4;
    let r = 0, g = 0, b = 0, a = 0;

    if (d <= Router) {
      if (d <= Rin) {
        const t = (dx + dy) / (2 * Rin);
        r = Math.round(72 + (16 - 72) * (t * 0.5 + 0.5));
        g = Math.round(221 + (131 - 221) * (t * 0.5 + 0.5));
        b = Math.round(163 + (90 - 163) * (t * 0.5 + 0.5));
        const hl = Math.max(0, (-dx - dy) / (2 * Rin));
        r = Math.min(255, r + Math.round(hl * 70));
        g = Math.min(255, g + Math.round(hl * 70));
        b = Math.min(255, b + Math.round(hl * 70));
        a = 255;
      } else {
        r = 255; g = 255; b = 255; a = 255; // 白色描边
      }
      if (d > Router - 1.5) a = Math.max(0, Math.round(255 * (Router - d) / 1.5));
    }
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]);

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'tray-icon.png'), png);

// 构造 ICO（PNG 嵌入格式，单尺寸 256）
const ico = Buffer.alloc(6 + 16 + png.length);
ico.writeUInt16LE(0, 0);    // reserved
ico.writeUInt16LE(1, 2);    // type: icon
ico.writeUInt16LE(1, 4);    // count
ico[6] = 0;                 // width 256 (0 表示 256)
ico[7] = 0;                 // height 256
ico[8] = 0;                 // colorCount
ico[9] = 0;                 // reserved
ico.writeUInt16LE(1, 10);   // planes
ico.writeUInt16LE(32, 12);  // bitCount
ico.writeUInt32LE(png.length, 14); // bytesInRes
ico.writeUInt32LE(22, 18);  // imageOffset
png.copy(ico, 22);
fs.writeFileSync(path.join(dir, 'icon.ico'), ico);

console.log('生成: tray-icon.png (' + png.length + 'B), icon.ico (' + ico.length + 'B)');
