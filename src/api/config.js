'use strict';
// 配置管理：读写应用自己的 userData/config.json。
// 存：token、endpoint、悬浮球位置、主题（light/glass）。
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const ENDPOINTS = {
  zhipu: { label: '智谱国内 (open.bigmodel.cn)', baseUrl: 'https://open.bigmodel.cn/api/anthropic' },
  zai: { label: 'Z.ai 国际 (api.z.ai)', baseUrl: 'https://api.z.ai/api/anthropic' }
};
const THEMES = ['light', 'glass'];

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  let token = '';
  let endpoint = 'zhipu';
  let ballPosition = null;
  let theme = 'light';
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const c = JSON.parse(raw);
    token = c.token || '';
    endpoint = c.endpoint || 'zhipu';
    ballPosition = c.ballPosition || null;
    theme = THEMES.indexOf(c.theme) !== -1 ? c.theme : 'light';
  } catch (_) { /* 首次使用，文件不存在 */ }
  const ep = ENDPOINTS[endpoint] || ENDPOINTS.zhipu;
  return { token, endpoint, baseUrl: ep.baseUrl, ballPosition, theme };
}

function writeConfig(cfg) {
  const prev = readConfig();
  const endpoint = ENDPOINTS[cfg && cfg.endpoint] ? cfg.endpoint : prev.endpoint;
  const theme = THEMES.indexOf(cfg && cfg.theme) !== -1 ? cfg.theme : prev.theme;
  // 关键：未提供 token 时保留旧值，绝不能存空——否则 fetchAndBroadcast 判 needConfig
  // 会重新 openSettings，导致"点了关闭又被自动撕开"
  const token = (cfg && cfg.token) ? cfg.token : prev.token;
  const data = { token, endpoint, ballPosition: prev.ballPosition, theme };
  fs.writeFileSync(configPath(), JSON.stringify(data, null, 2), 'utf8');
  const ep = ENDPOINTS[endpoint];
  return { token, endpoint, baseUrl: ep.baseUrl, theme };
}

function setBallPosition(x, y) {
  const c = readConfig();
  const data = { token: c.token, endpoint: c.endpoint, ballPosition: { x, y }, theme: c.theme };
  fs.writeFileSync(configPath(), JSON.stringify(data, null, 2), 'utf8');
  return data.ballPosition;
}

function isConfigured() {
  return !!readConfig().token;
}

module.exports = { readConfig, writeConfig, isConfigured, setBallPosition, ENDPOINTS, THEMES };
