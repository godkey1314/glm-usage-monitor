'use strict';
// GLM 用量监控 - 大屏渲染层（支持双皮肤切换）
const charts = { trend: null, hour: null };
let quotaCharts = [];
let lastData = null;
let currentTheme = 'light';

const $ = (id) => document.getElementById(id);

// 两套皮肤的 ECharts 配色
const THEMES = {
  light: { token: '#6366f1', calls: '#818cf8', plan: '#10b981', mcp: '#f59e0b', axis: '#d4d4d8', label: '#71717a', split: 'rgba(0,0,0,0.06)' },
  glass: { token: '#f0abfc', calls: '#a78bfa', plan: '#34d399', mcp: '#fbbf24', axis: 'rgba(255,255,255,0.2)', label: '#c0c0cc', split: 'rgba(255,255,255,0.08)' }
};
let COLOR = THEMES.light;

function applyTheme(theme) {
  currentTheme = THEMES[theme] ? theme : 'light';
  COLOR = THEMES[currentTheme];
  document.documentElement.dataset.theme = currentTheme;
  const sel = $('themeSelect');
  if (sel) sel.value = currentTheme;
  if (lastData) render(lastData); // 主题变了，重绘图表配色
}

// ---------- 格式化 ----------
function fmtTokens(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtNum(n) { return (Number(n) || 0).toLocaleString('en-US'); }
function fmtCountdown(ms) {
  if (!ms) return '';
  const diff = ms - Date.now();
  if (diff <= 0) return '即将重置';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return Math.floor(h / 24) + '天' + (h % 24) + '小时后重置';
  return h + '小时' + m + '分后重置';
}
function shortTime(ts) { const s = String(ts || ''); return s.length >= 10 ? s.slice(5) : s; }

// ---------- 渲染 ----------
function renderCards(d) {
  $('totalTokens').textContent = fmtTokens(d.model.total.tokens);
  $('totalCalls').textContent = fmtNum(d.model.total.calls);
  $('planLevel').textContent = String(d.quota.level || '-').toUpperCase();
  $('mcpTotal').textContent = fmtNum(d.tool.total.sum);
  $('tokenModels').textContent = d.model.total.byModel.map((m) => `${m.name} ${fmtTokens(m.tokens)}`).join('　');
  const byTool = d.tool.total.byTool.map((t) => `${t.name} ${t.count}`).join('　');
  $('mcpDetail').textContent = byTool || '近 25 小时';
}

function renderTrend(d) {
  const x = d.model.xTime.map(shortTime);
  if (!charts.trend) charts.trend = echarts.init($('trendChart'));
  charts.trend.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,20,30,0.92)', borderColor: 'rgba(120,120,140,0.2)', textStyle: { color: '#e4e4e7' } },
    legend: { data: ['Token', '调用次数'], textStyle: { color: COLOR.label }, top: 0, right: 8, itemWidth: 12, itemHeight: 8 },
    grid: { left: 56, right: 52, top: 36, bottom: 52 },
    xAxis: { type: 'category', data: x, boundaryGap: false, axisLabel: { color: COLOR.label, fontSize: 10, rotate: 40, interval: 2 }, axisLine: { lineStyle: { color: COLOR.axis } } },
    yAxis: [
      { type: 'value', name: 'Token', nameTextStyle: { color: COLOR.label, fontSize: 11 }, axisLabel: { color: COLOR.label, fontSize: 10, formatter: (v) => fmtTokens(v) }, splitLine: { lineStyle: { color: COLOR.split } } },
      { type: 'value', name: '次数', nameTextStyle: { color: COLOR.label, fontSize: 11 }, axisLabel: { color: COLOR.label, fontSize: 10 }, splitLine: { show: false } }
    ],
    series: [
      { name: 'Token', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: d.model.tokens, yAxisIndex: 0, lineStyle: { color: COLOR.token, width: 2.5 }, itemStyle: { color: COLOR.token }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLOR.token + '66' }, { offset: 1, color: COLOR.token + '00' }]) } },
      { name: '调用次数', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: d.model.callCount, yAxisIndex: 1, lineStyle: { color: COLOR.calls, width: 2.5 }, itemStyle: { color: COLOR.calls } }
    ]
  });
}

function renderHour(d) {
  const x = d.model.xTime.map(shortTime);
  if (!charts.hour) charts.hour = echarts.init($('hourChart'));
  charts.hour.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,20,30,0.92)', borderColor: 'rgba(120,120,140,0.2)', textStyle: { color: '#e4e4e7' }, formatter: (p) => `${p[0].name}<br/>Token: <b>${fmtNum(p[0].value)}</b>` },
    grid: { left: 56, right: 20, top: 16, bottom: 52 },
    xAxis: { type: 'category', data: x, axisLabel: { color: COLOR.label, fontSize: 10, rotate: 40, interval: 2 }, axisLine: { lineStyle: { color: COLOR.axis } } },
    yAxis: { type: 'value', axisLabel: { color: COLOR.label, fontSize: 10, formatter: (v) => fmtTokens(v) }, splitLine: { lineStyle: { color: COLOR.split } } },
    series: [{ type: 'bar', data: d.model.tokens, barWidth: '62%', itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLOR.calls }, { offset: 1, color: COLOR.token }]), borderRadius: [4, 4, 0, 0] } }]
  });
}

function renderQuota(d) {
  const grid = $('quotaGrid');
  quotaCharts.forEach((c) => c.dispose());
  quotaCharts = [];
  grid.innerHTML = '';
  d.quota.limits.forEach((l, i) => {
    const pct = Math.min(100, Math.max(0, l.percentage || 0));
    const color = pct >= 85 ? '#f87171' : pct >= 60 ? '#fbbf24' : COLOR.plan;
    let info = '';
    if (l.kind === 'TIME_LIMIT') info = `${fmtNum(l.used)} / ${fmtNum(l.total)}　剩余 ${fmtNum(l.remaining)}`;
    const reset = fmtCountdown(l.nextReset);
    const card = document.createElement('div');
    card.className = 'quota-card';
    const chartId = 'quota-chart-' + i;
    card.innerHTML = `<div class="quota-label">${l.label}</div><div id="${chartId}" class="quota-chart"></div><div class="quota-info">${info}${reset ? '<br>' + reset : ''}</div>`;
    grid.appendChild(card);
    const c = echarts.init($(chartId));
    c.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', startAngle: 90, endAngle: -270, radius: '92%', pointer: { show: false },
        progress: { show: true, overlap: false, roundCap: true, clip: false, width: 13, itemStyle: { color } },
        axisLine: { lineStyle: { width: 13, color: [[1, 'rgba(120,120,140,0.12)']] } },
        splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
        data: [{ value: pct }], detail: { valueAnimation: true, offsetCenter: [0, 0], formatter: '{value}%', fontSize: 26, fontWeight: 700, color }
      }]
    });
    quotaCharts.push(c);
  });
}

function render(d) {
  lastData = d;
  renderCards(d);
  renderTrend(d);
  renderHour(d);
  renderQuota(d);
}

function showError(msg) { const box = $('errorBox'); box.textContent = '⚠ ' + msg; box.classList.remove('hidden'); }
function hideError() { $('errorBox').classList.add('hidden'); }
function updateTimestamp() { $('updatedAt').textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }); }

// ---------- 设置弹窗 ----------
function openSettings() {
  window.api.getConfig().then((c) => {
    $('themeSelect').value = (c && c.theme) || 'light';
    $('endpointSelect').value = (c && c.endpoint) || 'zhipu';
    $('tokenInput').value = (c && c.token) || '';
    $('tokenInput').type = 'password';
    $('showToken').checked = false;
    $('settingsError').classList.add('hidden');
    $('settingsModal').classList.remove('hidden');
    setTimeout(() => $('tokenInput').focus(), 50);
  });
}
function closeSettings() { $('settingsModal').classList.add('hidden'); }
async function saveSettings() {
  const cfg = { theme: $('themeSelect').value, endpoint: $('endpointSelect').value, token: $('tokenInput').value.trim() };
  const err = $('settingsError');
  if (!cfg.token) { err.textContent = '请填写 Token'; err.classList.remove('hidden'); return; }
  try { await window.api.saveConfig(cfg); } catch (e) { err.textContent = '保存失败: ' + e.message; err.classList.remove('hidden'); return; }
  closeSettings();
  hideError();
}

function handleUsage(d) {
  if (!d) return;
  if (d.needConfig) { showError('尚未配置 Token，请点击"设置"填写'); openSettings(); return; }
  if (d.error) { showError(d.error); return; }
  if (d.data) { hideError(); render(d.data); updateTimestamp(); }
}

window.addEventListener('resize', () => { [charts.trend, charts.hour, ...quotaCharts].forEach((c) => c && c.resize()); });

document.addEventListener('DOMContentLoaded', () => {
  // 先应用配置里的主题，再渲染
  window.api.getConfig().then((c) => applyTheme((c && c.theme) || 'light'));

  $('refreshBtn').addEventListener('click', () => window.api.refresh());
  $('settingsBtn').addEventListener('click', openSettings);
  $('settingsCancel').addEventListener('click', closeSettings);
  $('settingsSave').addEventListener('click', saveSettings);
  // 主题即时切换
  $('themeSelect').addEventListener('change', (e) => {
    applyTheme(e.target.value);
    window.api.saveConfig({ theme: e.target.value, endpoint: $('endpointSelect').value, token: $('tokenInput').value.trim() });
  });
  $('collapseBtn').addEventListener('click', () => window.api.collapse());
  $('showToken').addEventListener('change', (e) => { $('tokenInput').type = e.target.checked ? 'text' : 'password'; });
  $('settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
  window.api.onOpenSettings(openSettings);
  window.api.onUsage(handleUsage);
});
