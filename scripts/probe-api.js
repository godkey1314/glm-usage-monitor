// 临时探查脚本：打印 GLM monitor API 原始响应结构
// 用于精确编写数据层 normalize（不猜接口字段）。验证完可删。
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const settings = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'));
const token = settings.env.ANTHROPIC_AUTH_TOKEN;
const baseUrl = settings.env.ANTHROPIC_BASE_URL;
const baseDomain = new URL(baseUrl).origin;

function get(p, qp = '') {
  return new Promise((resolve, reject) => {
    const u = new URL(baseDomain + p + qp);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { Authorization: token, 'Content-Type': 'application/json', 'Accept-Language': 'en-US,en' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

(async () => {
  const now = new Date();
  const start = new Date(now.getTime() - 25 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const qp = `?startTime=${encodeURIComponent(fmt(start))}&endTime=${encodeURIComponent(fmt(now))}`;

  for (const [name, pp, q] of [
    ['MODEL', '/api/monitor/usage/model-usage', qp],
    ['TOOL', '/api/monitor/usage/tool-usage', qp],
    ['QUOTA', '/api/monitor/usage/quota/limit', '']
  ]) {
    const r = await get(pp, q);
    console.log(`\n===== ${name} (HTTP ${r.status}) =====`);
    // 只打印结构骨架（数组只看首元素，避免刷屏）
    try {
      const j = JSON.parse(r.body);
      console.log(JSON.stringify(j, null, 2).slice(0, 3000));
    } catch (e) {
      console.log(r.body.slice(0, 1000));
    }
  }
})();
