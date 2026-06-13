# GLM 用量监控 (GLM Usage Monitor)

实时查看 **GLM Coding Plan** 配额与使用统计的开源桌面小工具（Windows）。

任何购买了智谱 / Z.ai GLM Coding Plan 的用户，填入自己的 Token 即可使用——**不依赖 Claude Code，不读取任何本地配置文件**。

## ✨ 功能

- 📊 **总览卡片**：总 Token、调用次数、套餐等级、MCP 工具调用
- 📈 **24 小时趋势折线**：Token + 调用次数双轴
- 📉 **时段柱状图**：逐小时用量分布，一眼看出使用时段
- 🍩 **配额进度环**：精确区分「5 小时窗口 / 1 周窗口 / MCP 月度」，带**下次重置倒计时**
- 🔄 **自动刷新**（60s）+ 手动刷新 + 系统托盘
- 🔐 **Token 仅存本机**（应用 userData 目录），不上传任何服务器
- 🎨 深色毛玻璃界面，ECharts 渐变图表，配额按用量变色（绿→黄→红）

## 🚀 快速开始（普通用户）

1. 下载 [Releases](../../releases) 中的便携 exe（`GLM用量监控 x.x.x.exe`）
2. 双击运行
3. 首次打开会弹出**设置**，填入你的 GLM Coding Plan Token（获取方式见下）
4. 即可实时查看用量

> 便携版无需安装，双击即用。Token 保存在 `%AppData%\GLM用量监控\config.json`。

## 🔑 如何获取 Token

1. 访问智谱开放平台 [open.bigmodel.cn](https://open.bigmodel.cn)（国内）或 [z.ai](https://z.ai)（国际）
2. 开通 **GLM Coding Plan** 套餐
3. 在控制台/API Keys 页面创建或查看你的 API Key
   - 格式形如 `xxxxxxxxxxxx.yyyyyyyyyyyy`
4. 把这个 Key 粘贴进应用的「设置 → Token」即可

> 端点选择：国内用户选「智谱国内」，国际用户选「Z.ai 国际」。

## 🛠 开发

```bash
npm install        # 安装依赖（自动拷贝 echarts 到 renderer/lib）
npm start          # 本地运行
npm run dist       # 打包便携 exe（输出到 build/）
```

### 技术栈

| 层 | 技术 |
|----|------|
| 主进程 | Electron（Node.js） |
| 安全桥接 | preload + contextBridge（contextIsolation） |
| 渲染层 | 原生 HTML/CSS/JS，无框架 |
| 图表 | ECharts 5 |
| 打包 | electron-builder（portable target） |

### 目录结构

```
src/
├── main.js            # 主进程：窗口、托盘、IPC
├── preload.js         # 安全暴露 API 给渲染层
├── api/
│   ├── usage.js       # 数据层：调用智谱 monitor 接口，规整数据
│   └── config.js      # 配置管理：读写 userData/config.json
└── renderer/
    ├── index.html     # 界面结构
    ├── styles.css     # 深色毛玻璃样式
    ├── renderer.js    # 渲染逻辑 + ECharts
    └── lib/           # echarts.min.js（postinstall 自动拷贝）
```

## 📡 数据源

直接调用智谱官方监控接口（与官方 `glm-plan-usage` 插件同一套接口，但本工具独立实现、不依赖该插件）：

- `https://open.bigmodel.cn/api/monitor/usage/model-usage`
- `https://open.bigmodel.cn/api/monitor/usage/tool-usage`
- `https://open.bigmodel.cn/api/monitor/usage/quota/limit`

认证头：`Authorization: <你的Token>`

## 🔒 隐私

- Token 仅保存在本机 `%AppData%\GLM用量监控\config.json`，**绝不上传**
- 工具只向你选择的智谱/Z.ai 端点发起请求，无任何第三方上报
- 主进程通过 `contextBridge` 严格隔离，渲染层无法直接访问文件/网络

## 📄 License

[MIT](LICENSE)，欢迎自行修改、分发、二次开发。
