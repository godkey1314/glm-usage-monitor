'use strict';
// 主进程：单例 + 悬浮球(常驻/可关) + 大屏(启动直接显示) + 系统托盘(真退出) + 定时推送 + 阈值通知
const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, screen, nativeImage } = require('electron');
const path = require('path');
const { queryUsage } = require('./api/usage');
const { readConfig, writeConfig, setBallPosition } = require('./api/config');

let ballWindow = null, mainWindow = null, tray = null, refreshTimer = null;
let isQuitting = false;
const notifiedLimits = new Set();
const REFRESH_INTERVAL = 60 * 1000;
const ALERT_THRESHOLD = 80;
const BALL_SIZE = 64;
const ICON_PATH = path.join(__dirname, '..', 'assets', 'tray-icon.png');

function defaultBallPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return { x: workArea.x + workArea.width - BALL_SIZE - 26, y: workArea.y + 20 };
}

function createBallWindow() {
  const cfg = readConfig();
  const pos = cfg.ballPosition || defaultBallPosition();
  ballWindow = new BrowserWindow({
    width: BALL_SIZE, height: BALL_SIZE,
    x: Math.round(pos.x), y: Math.round(pos.y),
    frame: false, transparent: true, resizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      additionalArguments: ['ball']
    }
  });
  ballWindow.loadFile(path.join(__dirname, 'renderer', 'ball.html'));
  ballWindow.on('move', () => {
    if (!ballWindow) return;
    const [x, y] = ballWindow.getPosition();
    setBallPosition(x, y);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 880, minWidth: 900, minHeight: 720,
    title: 'GLM 用量监控', backgroundColor: '#0f1729', autoHideMenuBar: true,
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      additionalArguments: ['main']
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow.hide(); } });
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[main-win:${level}] ${message} (${sourceId}:${line})`);
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '显示大屏', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '显示悬浮球', click: () => {
      if (ballWindow && !ballWindow.isDestroyed()) ballWindow.show();
      else createBallWindow();
    } },
    { label: '立即刷新', click: () => fetchAndBroadcast() },
    { label: '设置 Token', click: () => { if (mainWindow) { mainWindow.show(); safeSend(mainWindow, 'open-settings', null); } } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() } // 托盘退出 = 真正退出整个应用
  ]);
  tray.setToolTip('GLM 用量监控');
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

function safeSend(win, ch, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(ch, payload);
}
function findLimit(limits, windowKey) {
  const l = (limits || []).find((x) => x.window === windowKey);
  return l ? l.percentage : null;
}
function checkAlerts(limits) {
  (limits || []).forEach((l) => {
    if (l.percentage >= ALERT_THRESHOLD && !notifiedLimits.has(l.label)) {
      notifiedLimits.add(l.label);
      try { new Notification({ title: 'GLM 额度提醒', body: `${l.label} 已用 ${l.percentage}%，注意控制用量` }).show(); } catch (_) {}
    }
    if (l.percentage < ALERT_THRESHOLD - 10) notifiedLimits.delete(l.label);
  });
}

async function fetchAndBroadcast() {
  const config = readConfig();
  if (!config.token) {
    safeSend(ballWindow, 'usage:update', { needConfig: true });
    safeSend(mainWindow, 'usage:update', { needConfig: true });
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
    return;
  }
  try {
    const data = await queryUsage(config);
    const pct5h = findLimit(data.quota.limits, '5 小时');
    safeSend(ballWindow, 'usage:update', { pct: pct5h });
    safeSend(mainWindow, 'usage:update', { data });
    checkAlerts(data.quota.limits);
  } catch (e) {
    safeSend(mainWindow, 'usage:update', { error: e.message });
    safeSend(ballWindow, 'usage:update', { error: true });
  }
}

function startTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchAndBroadcast, REFRESH_INTERVAL);
}

function showBallMenu() {
  const menu = Menu.buildFromTemplate([
    { label: '显示大屏', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '立即刷新', click: () => fetchAndBroadcast() },
    { label: '设置 Token', click: () => { if (mainWindow) { mainWindow.show(); safeSend(mainWindow, 'open-settings', null); } } },
    { type: 'separator' },
    { label: '退出悬浮球', click: () => { if (ballWindow) ballWindow.hide(); } } // 仅关球，应用继续
  ]);
  if (ballWindow) menu.popup(ballWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    else if (ballWindow) { ballWindow.show(); }
  });
  app.on('before-quit', () => { isQuitting = true; });

  app.whenReady().then(() => {
    createBallWindow();
    createMainWindow();
    mainWindow.show(); // 启动直接显示大屏
    createTray();

    ipcMain.handle('usage:refresh', async () => { fetchAndBroadcast(); });
    ipcMain.handle('config:get', () => readConfig());
    ipcMain.handle('config:save', (_e, cfg) => { const r = writeConfig(cfg); fetchAndBroadcast(); return r; });
    ipcMain.on('ball:expand', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
    ipcMain.on('ball:menu', () => showBallMenu());
    ipcMain.on('ball:drag', (_e, dx, dy) => {
      if (!ballWindow) return;
      const [x, y] = ballWindow.getPosition();
      ballWindow.setPosition(x + dx, y + dy);
    });
    ipcMain.on('main:collapse', () => { if (mainWindow) mainWindow.hide(); });

    // 等两个窗口 renderer 就绪后再首次推送，确保大屏立即拿到数据
    const ready = (wc) => new Promise((r) => {
      if (!wc || wc.isLoading === undefined) return r();
      wc.once('did-finish-load', r);
    });
    Promise.all([ready(mainWindow.webContents), ready(ballWindow.webContents)]).then(() => {
      fetchAndBroadcast();
      startTimer();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) { createBallWindow(); createMainWindow(); }
    });
  });

  app.on('window-all-closed', () => {});
}
