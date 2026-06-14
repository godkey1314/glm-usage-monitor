'use strict';
// 自动截图：启动大屏窗口，查真实用量数据，capturePage 存 docs/screenshot-<theme>.png
// 用法: npx electron scripts/screenshot.js [light|glass]
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { queryUsage } = require('../src/api/usage');
const { readConfig } = require('../src/api/config');

const THEME = (process.argv[2] === 'light' || process.argv[2] === 'glass') ? process.argv[2] : 'glass';
let win;

app.whenReady().then(async () => {
  ipcMain.handle('config:get', () => Object.assign(readConfig(), { theme: THEME }));

  win = new BrowserWindow({
    width: 1100, height: 880,
    backgroundColor: THEME === 'glass' ? '#2a2040' : '#f6f7f9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      additionalArguments: ['main']
    }
  });
  win.removeMenu();
  await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));

  // 推送真实数据
  try {
    const config = readConfig();
    if (config.token) {
      const data = await queryUsage(config);
      win.webContents.send('usage:update', { data });
    }
  } catch (e) { console.log('查询失败(将截空数据页):', e.message); }

  await new Promise((r) => setTimeout(r, 3500)); // 等 ECharts 渲染

  const img = await win.webContents.capturePage();
  const out = path.join(__dirname, '..', 'docs', `screenshot-${THEME}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log('截图保存:', out, '(' + img.toPNG().length + ' bytes)');
  app.quit();
});
