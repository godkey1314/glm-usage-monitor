'use strict';
// 从 OIP-C.webp 生成多尺寸标准 ICO（exe 图标）+ 256 PNG（托盘/窗口图标）。
// sharp 解码 webp + 多尺寸缩放，png-to-ico 转标准 BMP ICO（electron-builder 认）。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

(async () => {
  const src = path.join(__dirname, '..', 'OIP-C.webp');
  if (!fs.existsSync(src)) { console.error('找不到源图:', src); process.exit(1); }

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngs = [];
  for (const s of sizes) {
    const buf = await sharp(src)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    pngs.push(buf);
  }

  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);
  fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), pngs[0]);

  console.log('生成: icon.ico (' + ico.length + 'B), tray-icon.png (' + pngs[0].length + 'B)');
})().catch((e) => { console.error('失败:', e.message); process.exit(1); });
