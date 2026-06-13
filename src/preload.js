'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// 通过 additionalArguments 区分悬浮球 / 大屏，暴露不同能力
const isBall = process.argv.indexOf('ball') !== -1;

if (isBall) {
  // 悬浮球：接收百分比更新、点击展开、右键菜单
  contextBridge.exposeInMainWorld('api', {
    onUsage: (cb) => ipcRenderer.on('usage:update', (_e, d) => cb(d)),
    expand: () => ipcRenderer.send('ball:expand'),
    showMenu: () => ipcRenderer.send('ball:menu'),
    drag: (dx, dy) => ipcRenderer.send('ball:drag', dx, dy)
  });
} else {
  // 大屏：接收完整数据、手动刷新、配置、折叠、托盘刷新触发
  contextBridge.exposeInMainWorld('api', {
    onUsage: (cb) => ipcRenderer.on('usage:update', (_e, d) => cb(d)),
    refresh: () => ipcRenderer.invoke('usage:refresh'),
    getConfig: () => ipcRenderer.invoke('config:get'),
    saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
    collapse: () => ipcRenderer.send('main:collapse'),
    onOpenSettings: (cb) => ipcRenderer.on('open-settings', () => cb()),
    onTriggerRefresh: (cb) => {
      const h = () => cb();
      ipcRenderer.on('trigger-refresh', h);
      return () => ipcRenderer.removeListener('trigger-refresh', h);
    }
  });
}
