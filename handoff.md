# Electron Desktop App Handoff

## 目标与结论
- 目标：基于现有 `Node.js + Fastify + Svelte + SQLite` 架构，以最低改动成本交付跨平台桌面版。
- 桌面方案：采用 `Electron`，继续复用现有前端、后端和 SQLite，不在首期考虑 `Tauri`。
- 核心思路：Electron 只负责窗口、应用生命周期和打包；现有 Fastify 仍作为本地 API 服务运行；Svelte 前端继续通过相对路径 `/api/*` 访问服务端。
- 这样做的原因：当前前端已使用相对路径 API，客户端构建产物已直接输出到 `server/public`，服务端本身也负责静态资源托管，因此最适合做“本地内嵌服务 + Electron 壳”。

## 目标目录结构
```text
.
├── client/
├── server/
├── desktop/
│   ├── package.json
│   ├── tsconfig.json
│   ├── electron-builder.yml
│   ├── src/
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── paths.ts
│   │   ├── server.ts
│   │   └── window.ts
│   ├── scripts/
│   │   ├── prepare-server.mjs
│   │   └── clean.mjs
│   ├── assets/
│   │   ├── icon.icns
│   │   ├── icon.ico
│   │   └── icon.png
│   ├── dist/
│   ├── release/
│   └── .stage/
├── package.json
├── AGENTS.md
└── handoff.md
```

## 模块职责
- `desktop/src/main.ts`
  负责 Electron `app` 生命周期、单实例锁、窗口初始化、应用退出时清理本地服务进程。
- `desktop/src/preload.ts`
  预留桌面桥接能力；首期可以很薄，只暴露版本号、打开外链、选择文件等少量 API。
- `desktop/src/paths.ts`
  统一封装跨平台路径，如用户数据目录、日志目录、数据库文件路径、打包后服务端资源路径。
- `desktop/src/server.ts`
  启动、探活、关闭本地 Fastify 服务；建议使用 `child_process.fork` 启动编译后的 `server/dist/index.js`。
- `desktop/src/window.ts`
  创建 `BrowserWindow`，只加载 `http://127.0.0.1:<port>`，集中管理窗口安全选项。
- `desktop/scripts/prepare-server.mjs`
  在打包前准备桌面版运行时资源：复制 `server/dist`、`server/public`、服务端生产依赖与必要元数据到 `desktop/.stage/server/`。
- `desktop/electron-builder.yml`
  负责打包目标、产物命名、asar、原生模块解包、平台安装器配置。

## 关键改动点

### 1. 服务端入口改为可复用启动器
- 当前 `server/src/index.ts` 是“导入即启动”，桌面版不方便控制生命周期。
- 目标改法：
  - 导出 `createApp()`、`startServer(options)`、`stopServer()`。
  - 仅在 `require.main === module` 或等价判断下执行独立启动。
  - 启动参数支持 `host`、`port`、`publicDir`、`dbPath`。
- 收益：
  - Web 部署保留现状。
  - Electron 可显式控制何时启动、监听哪个端口、读写哪个数据库文件。

### 2. SQLite 路径改为可配置
- 当前数据库路径固定为 `server/data/wealth_tracker.sqlite`。
- 桌面版应改为优先读取环境变量或启动参数，例如：
  - `process.env.SQLITE_DB_PATH`
  - 若未传入则回退到现有默认值。
- 运行时建议分层：
  - 开发态：可以继续使用 `server/data/wealth_tracker.sqlite`，这样本地开发和现有工作流基本不受影响。
  - Electron 生产版：必须由主进程显式传入用户目录下的数据库路径，不应继续写回源码目录或安装目录。
- 推荐桌面版数据库位置：
  - macOS: `~/Library/Application Support/Wealth Tracker/wealth_tracker.sqlite`
  - Windows: `%AppData%/Wealth Tracker/wealth_tracker.sqlite`
  - Linux: `~/.local/share/Wealth Tracker/wealth_tracker.sqlite`
- 这样可避免把数据库写到安装目录，兼容升级、权限和沙箱限制。
- 换句话说，`server/data/**` 仍然可以保留为源码运行时默认目录，但不应作为桌面安装版正式数据目录。

### 3. 服务端静态目录改为可配置
- 当前服务端静态目录默认是 `server/public`。
- 桌面打包后，静态目录会位于应用资源区，因此需要支持：
  - `process.env.PUBLIC_DIR`
  - 或由 `startServer({ publicDir })` 传入。
- 前端仍保持现在的构建方式，继续输出到 `server/public`，桌面打包阶段再复制到 `desktop/.stage/server/public/`。

### 4. 服务监听地址改为桌面专用本地回环
- Web 部署可保留 `0.0.0.0`。
- Electron 内嵌服务建议仅监听 `127.0.0.1`。
- 端口不要写死为 `8888`，建议桌面端启动时动态分配空闲端口，避免冲突。
- Electron 窗口只访问本地地址，例如：`http://127.0.0.1:49623`。

### 5. 保持前端 API 层不变
- 现有前端 API 已全部使用相对路径 `/api/*`，这是桌面化最有利的条件。
- 首期不建议改 `client/src/helper/ajax.ts` 和 `client/src/helper/apis.ts` 的接口设计。
- 只要 Electron 窗口打开的是本地 Fastify 服务地址，前端逻辑即可原样工作。

### 6. Electron 主进程安全基线
- `BrowserWindow` 建议配置：
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` 或按兼容性评估后开启
  - `preload` 指向单独预加载脚本
- 禁止前端直接获得 Node 权限。
- 所有文件系统、外链、系统能力都走 preload 暴露的白名单 API。

### 7. 原生依赖与打包注意项
- 当前服务端依赖 `sqlite3`，属于原生模块。
- 打包时需确保：
  - 只包含生产依赖；
  - `asar` 开启；
  - 原生 `.node` 文件通过 `asarUnpack` 解包；
  - 服务端运行时资源不要直接依赖开发环境路径。
- 若后续出现原生模块重编译问题，再补 `electron-builder install-app-deps` 或 `@electron/rebuild`。

### 8. 桌面版环境变量约定
- 建议由 Electron 在启动服务进程时统一注入：
  - `PORT`
  - `HOST`
  - `PUBLIC_DIR`
  - `SQLITE_DB_PATH`
  - `ALLOW_PASSWORD`
  - `CAN_BE_RESET`
- 桌面首版建议：
  - `HOST=127.0.0.1`
  - `ALLOW_PASSWORD=true`
  - `CAN_BE_RESET=true`
- `OPENAI_API_KEY`、`OPENAI_BASE_URL` 仍沿用现有设置逻辑，不在首期强制改造。

## 打包方案

### 打包工具选择
- 推荐：`electron-builder`
- 原因：
  - 支持 macOS、Windows、Linux 一次性配置；
  - 对 `dmg`、`nsis`、`AppImage` 支持成熟；
  - 对 `asar`、额外资源、原生模块处理更直接；
  - 上手成本低，适合当前“尽快产出桌面安装包”的目标。

### 推荐桌面构建流
1. 根目录构建 Web 产物。
2. 生成 `server/dist` 与 `server/public`。
3. 执行 `desktop/scripts/prepare-server.mjs`，把桌面运行时需要的服务端文件复制到 `desktop/.stage/server/`。
4. 构建 Electron 主进程与 preload 到 `desktop/dist/`。
5. 使用 `electron-builder` 将 `desktop/dist/` 与 `desktop/.stage/` 一起打包为安装器。

### `.stage` 目录建议内容
```text
desktop/.stage/
├── server/
│   ├── dist/
│   ├── public/
│   ├── package.json
│   └── node_modules/
└── metadata/
```

## 打包脚本清单

### 根目录 `package.json`
- `build:web`
  - 作用：构建现有前后端产物。
  - 建议命令：`yarn build`
- `desktop:dev`
  - 作用：本地调试桌面版。
  - 建议流程：先构建前后端，再启动 Electron。
- `desktop:build`
  - 作用：构建桌面版运行时资源，但不出安装包。
- `desktop:dist`
  - 作用：生成当前平台安装包。
- `desktop:dist:mac`
  - 作用：生成 macOS 安装包。
- `desktop:dist:win`
  - 作用：生成 Windows 安装包。
- `desktop:dist:linux`
  - 作用：生成 Linux 安装包。

### `desktop/package.json`
- `dev`
  - 作用：启动 Electron 本地开发模式。
  - 建议命令：`electron .`
- `build`
  - 作用：构建 `main.ts` 与 `preload.ts`。
  - 建议使用：`tsup` 或 `tsc`
- `prepare-server`
  - 作用：复制 `server/dist`、`server/public` 以及服务端生产依赖到 `.stage/server/`。
- `pack`
  - 作用：输出未封装目录，便于排查打包内容。
- `dist`
  - 作用：生成当前平台安装包。
- `dist:mac`
  - 作用：仅打 macOS。
- `dist:win`
  - 作用：仅打 Windows。
- `dist:linux`
  - 作用：仅打 Linux。

### 建议脚本示意
```json
{
  "scripts": {
    "build:web": "yarn build",
    "desktop:dev": "yarn build:web && cd desktop && npm run dev",
    "desktop:build": "yarn build:web && cd desktop && npm run build && npm run prepare-server",
    "desktop:dist": "yarn desktop:build && cd desktop && npm run dist",
    "desktop:dist:mac": "yarn desktop:build && cd desktop && npm run dist:mac",
    "desktop:dist:win": "yarn desktop:build && cd desktop && npm run dist:win",
    "desktop:dist:linux": "yarn desktop:build && cd desktop && npm run dist:linux"
  }
}
```

## 实施顺序
1. 新增 `desktop/` 包与基础打包配置。
2. 改造 `server/src/index.ts`，让服务端支持被 Electron 显式启动。
3. 改造数据库路径与静态资源目录为可配置。
4. 增加 `prepare-server.mjs`，把桌面运行时资源打到 `.stage/`。
5. 实现 Electron 启动本地服务、探活、打开窗口、退出清理。
6. 配置 `electron-builder`，先打通当前开发机平台。
7. 再逐步补齐 Windows、Linux 安装器与图标资源。

## 首期验收标准
- 双击安装包后可直接启动，无需 Node、PM2、Docker。
- 应用首次启动时，自动创建用户数据目录与 SQLite 文件。
- 应用升级后数据库仍保留。
- 所有现有前端页面可正常通过 `/api/*` 调用本地服务。
- 桌面版不依赖 `server/data/*.sqlite` 作为正式数据目录。
- 桌面版服务端仅监听 `127.0.0.1`。

## 暂不处理
- 不在首期将后端改写为 Rust。
- 不在首期切换到 Tauri。
- 不在首期接入自动更新。
- 不在首期重构现有前端请求层。

## 实现时的补充提醒
- 不要直接修改 `server/public/**` 里的生成产物；应继续通过 `client` 构建生成。
- 不要把用户数据库写入应用安装目录。
- 不要让 Electron 窗口直接拥有 Node.js 完整权限。
- 不要假设所有平台都能使用同一图标格式；至少准备 `icns`、`ico`、`png`。
- 若增加桌面专用配置项，优先由 Electron 主进程通过环境变量传给服务端，避免把桌面逻辑散落到前端。
