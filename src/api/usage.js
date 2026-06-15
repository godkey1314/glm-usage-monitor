'use strict';
// GLM Coding Plan 用量数据层
// 纯数据获取：接收 {token, baseUrl}，调用智谱官方 monitor 接口，返回规整结构。
// 不读取任何本地配置文件——配置由调用方（main 进程 config.js）提供。
// 所有响应字段均经 scripts/probe-api.js 实测确认。

const https = require('https');

const SUPPORTED_HOSTS = /(?:open|dev)\.bigmodel\.cn|^api\.z\.ai/;

/** HTTPS GET，返回解析后的 JSON */
function httpGet(fullUrl, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        Authorization: token,
        'Accept-Language': 'en-US,en',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          reject(new Error('响应 JSON 解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * 把 unit+number 映射成可读窗口名。
 * 实测枚举：3=小时, 4=天, 5=月, 6=周
 */
function describeWindow(unit, number) {
  const unitMap = { 3: '小时', 4: '天', 5: '月', 6: '周' };
  return `${number} ${unitMap[unit] || ('unit' + unit)}`;
}

/** 规整为渲染层结构 */
function normalize(modelRes, toolRes, quotaRes) {
  const model = (modelRes && modelRes.data) || modelRes || {};
  const tool = (toolRes && toolRes.data) || toolRes || {};
  const quota = (quotaRes && quotaRes.data) || quotaRes || {};

  const modelTotal = model.totalUsage || {};
  const toolTotal = tool.totalUsage || {};

  // 各模型 Token 明细。total.tokens 必须与之同源同口径（取其求和）。
  const modelSummary = (modelTotal.modelSummaryList || []).map((m) => ({ name: m.modelName, tokens: m.totalTokens || 0 }));

  const limits = (quota.limits || []).map((l) => {
    const window = describeWindow(l.unit, l.number);
    const item = {
      kind: l.type,
      window,
      label: l.type === 'TIME_LIMIT' ? `MCP 工具（${window}）` : `Token 用量（${window}）`,
      percentage: l.percentage || 0,
      nextReset: l.nextResetTime || null
    };
    if (l.type === 'TIME_LIMIT') {
      item.used = l.currentValue;
      item.total = l.usage;
      item.remaining = l.remaining;
      item.details = (l.usageDetails || []).map((d) => ({ code: d.modelCode, usage: d.usage }));
    }
    return item;
  });

  return {
    model: {
      xTime: model.x_time || [],
      callCount: model.modelCallCount || [],
      tokens: model.tokensUsage || [],
      byModelData: (model.modelDataList || []).map((m) => ({ name: m.modelName, tokens: m.tokensUsage || [] })),
      total: {
        calls: modelTotal.totalModelCallCount || 0,
        // 总 Token = 各模型明细之和，与 byModel 同源同口径，保证 ≥ 任一单模型。
        // 注：totalUsage.totalTokensUsage 字段口径不同（实测 389M < 单模型 GLM-5.2 的 685M），
        // 直接用作"总 Token"会与下方模型明细自相矛盾，故弃用。
        tokens: modelSummary.reduce((sum, m) => sum + (m.tokens || 0), 0),
        byModel: modelSummary
      }
    },
    tool: {
      xTime: tool.x_time || [],
      series: {
        search: tool.networkSearchCount || [],
        webRead: tool.webReadMcpCount || [],
        zread: tool.zreadMcpCount || []
      },
      total: {
        search: toolTotal.totalNetworkSearchCount || 0,
        webRead: toolTotal.totalWebReadMcpCount || 0,
        zread: toolTotal.totalZreadMcpCount || 0,
        sum: toolTotal.totalSearchMcpCount || 0,
        byTool: (toolTotal.toolSummaryList || []).map((t) => ({ name: t.toolName || t.toolCode, count: t.totalUsageCount }))
      }
    },
    quota: {
      level: quota.level || '-',
      limits
    },
    fetchedAt: Date.now()
  };
}

/**
 * 主查询：并发请求三个接口，返回规整数据
 * @param {{token:string, baseUrl:string}} config 认证配置
 * @param {number} windowHours 时间窗口小时数（默认 25）
 */
async function queryUsage(config, windowHours = 25) {
  const token = config && config.token;
  const baseUrl = config && config.baseUrl;
  if (!token) throw new Error('未配置 Token，请先在设置中填写');
  if (!baseUrl) throw new Error('未配置端点');
  if (!SUPPORTED_HOSTS.test(baseUrl)) throw new Error('不支持的端点：' + baseUrl);

  const origin = new URL(baseUrl).origin;
  const now = new Date();
  const start = new Date(now.getTime() - windowHours * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const qp = `?startTime=${encodeURIComponent(fmt(start))}&endTime=${encodeURIComponent(fmt(now))}`;

  const [model, tool, quota] = await Promise.all([
    httpGet(`${origin}/api/monitor/usage/model-usage${qp}`, token),
    httpGet(`${origin}/api/monitor/usage/tool-usage${qp}`, token),
    httpGet(`${origin}/api/monitor/usage/quota/limit`, token)
  ]);

  return normalize(model, tool, quota);
}

module.exports = { queryUsage };
