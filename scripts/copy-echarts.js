'use strict';
// 将 echarts.min.js 拷贝到 renderer/lib，供离线打包使用（exe 不依赖 CDN）。
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'echarts', 'dist', 'echarts.min.js');
const dstDir = path.join(__dirname, '..', 'src', 'renderer', 'lib');
const dst = path.join(dstDir, 'echarts.min.js');

if (!fs.existsSync(src)) {
  console.log('[copy-echarts] echarts 尚未安装，跳过');
  process.exit(0);
}
try {
  fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('[copy-echarts] 已拷贝 echarts.min.js -> src/renderer/lib/');
} catch (e) {
  console.warn('[copy-echarts] 拷贝失败:', e.message);
}
