'use strict';
// 悬浮球：显示 5h 窗口百分比，配色随额度。
// 拖动：手动 mousedown/move/up + requestAnimationFrame 节流合并 IPC
//       （transparent 窗口 CSS drag 不工作；节流避免 mousemove 高频 IPC 卡顿）。
// 点击：mouseup 时若几乎没移动则视为点击 → 展开大屏。
const ball = document.getElementById('ball');
const pctEl = document.getElementById('pct');

function applyColor(pct) {
  ball.classList.remove('warn', 'danger');
  if (pct == null) return;
  if (pct >= 85) ball.classList.add('danger');
  else if (pct >= 60) ball.classList.add('warn');
}

window.api.onUsage((d) => {
  if (!d) return;
  if (d.needConfig) { pctEl.textContent = '?'; applyColor(null); return; }
  if (d.error) { pctEl.textContent = '!'; applyColor(null); return; }
  if (typeof d.pct === 'number') {
    pctEl.textContent = d.pct;
    applyColor(d.pct);
  }
});

let dragging = false, lastX = 0, lastY = 0, moved = 0;
let pendDx = 0, pendDy = 0, rafScheduled = false;

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true; lastX = e.screenX; lastY = e.screenY; moved = 0;
  pendDx = 0; pendDy = 0;
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - lastX, dy = e.screenY - lastY;
  lastX = e.screenX; lastY = e.screenY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 3) {
    // 累积位移，rAF 每帧合并发一次 IPC，避免高频卡顿
    pendDx += dx; pendDy += dy;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        if (pendDx || pendDy) { window.api.drag(pendDx, pendDy); pendDx = 0; pendDy = 0; }
      });
    }
  }
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  if (moved <= 3) window.api.expand(); // 几乎没移动=点击展开
});

document.addEventListener('contextmenu', (e) => { e.preventDefault(); window.api.showMenu(); });
document.addEventListener('dblclick', () => window.api.expand());
