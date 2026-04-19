# 生财有迹代码实现梳理

## 1. 项目定位与整体架构

`wealth-tracker` 是一个 monorepo，当前包含三部分：

- `client/`：Svelte 4 + Vite 前端应用。
- `server/`：Fastify + Sequelize + SQLite 服务端。
- `desktop/`：Electron 桌面壳，复用同一套前后端。

核心运行方式是：

1. 前端页面加载后，通过相对路径 `/api/*` 调用后端。
2. 后端既提供 REST API，也托管前端构建后的静态文件。
3. Electron 不重写业务逻辑，只是在本地启动内嵌 Fastify 服务，再打开一个桌面窗口访问它。

这意味着项目本质上是“一套 Web 应用 + 一层桌面封装”，而不是三套独立实现。

## 2. 目录与职责

```text
.
├── client/   # Svelte 前端
├── server/   # Fastify + SQLite API
├── desktop/  # Electron 桌面壳
├── README.md
├── handoff.md
└── docs/
    └── code-implementation-overview.md
```

更细一点的职责分层：

- `client/src/routes`：页面级路由，如首页、明细、AI 建议、见解、资产状态。
- `client/src/components`：图表、弹窗、表格、设置面板等 UI 组件。
- `client/src/helper`：API 请求、鉴权、设置、汇率与 AI 流式请求等通用逻辑。
- `server/src/routes`：Fastify 路由声明，只负责 URL 到 handler 的映射。
- `server/src/controllers`：业务处理逻辑。
- `server/src/models`：Sequelize 模型定义，对应 SQLite 表。
- `desktop/src`：Electron 主进程、窗口、安全边界、嵌入式服务启动与运行时路径。

## 3. 启动与构建链路

根目录 `package.json` 统一管理工作区脚本：

- `yarn build`：先构建 `client`，再构建 `server`。
- `yarn desktop:dev`：先构建 Web，再启动 Electron。
- `yarn desktop:build`：构建桌面运行所需资源。

构建结果的关键关系：

- `client` 构建产物输出到 `server/public`。
- `server` 构建产物输出到 `server/dist`。
- `desktop` 启动时读取 `server/dist/index.js` 和 `server/public`。

所以这个项目的生产运行入口，其实始终是服务端；前端只是被服务端托管。

## 4. 前端实现

### 4.1 入口与应用外壳

- 入口文件：`client/src/main.ts`
- 应用壳：`client/src/App.svelte`

`main.ts` 很薄，只做三件事：

1. 引入全局样式。
2. 注册 SVG 图标能力。
3. 挂载 `App.svelte`。

`App.svelte` 承担真正的应用启动职责：

1. 初始化 i18n。
2. 用 Routify 创建路由。
3. `onMount` 时依次执行：
   - `initializeAuth()`：检查是否需要密码。
   - `loadUserSettings()`：加载用户设置。
   - `getCustomCurrencies()`：加载自定义货币。
4. 根据 `isLoading` 和 `isAuthenticated` 两个 store 决定：
   - 显示加载态；
   - 显示输入密码弹层；
   - 或渲染正式页面路由。

这意味着前端不是“直接开屏进页面”，而是先过一层“初始化网关”。

### 4.2 状态管理

集中在 `client/src/stores.ts`，使用 Svelte `writable`：

- 鉴权相关：`isAuthenticated`、`isLoading`、`isResettable`、`isPasswordAllowed`
- 提示相关：`alert`、`notice`
- 全局设置：`theme`、`language`
- 业务计算：`exchangeRates`、`targetCurrencyCode`、`totalAssetValue`
- 扩展数据：`customCurrencies`

这套 store 比较轻，适合单体应用；业务状态主要还是页面进入后按需拉取，而不是做复杂全局缓存。

### 4.3 API 封装

- 请求底座：`client/src/helper/ajax.ts`
- 业务 API：`client/src/helper/apis.ts`

实现风格比较直接：

- `ajax.ts` 基于 `axios`，统一包装 `get/post/put/delete`。
- `apis.ts` 只负责拼接 `/api/*` 地址，不夹杂业务逻辑。

这种写法的价值在于：桌面版和 Web 版都能共享 API 层，因为路径始终是相对路径。

### 4.4 关键页面

#### 首页 `client/src/routes/Index.svelte`

首页是资产总览页，负责：

- 拉取当前资产 `getAssets()`
- 拉取资产变更记录 `getRecords()`
- 将当前资产追加成“今天的快照”，补到趋势图里
- 根据目标货币与汇率把资产金额转换后再渲染图表

首页上的主要能力：

- `OperatingArea`：新增资产入口
- `TableWidget`：当前资产列表
- `DonutChart`：资产分布
- `AreaChart`：资产趋势
- `BindingChart`：资产绑定/对比类图表
- `UpdateModal`：新增或编辑资产

首页体现了这个项目的核心建模思路：`assets` 保存“当前值”，`record` 保存“历史过程”。

#### 明细页 `client/src/routes/Detail.svelte`

明细页主要消费 `record` 表：

- 分页获取资产历史记录
- 支持对某条历史记录进行修改或删除
- 通过 URL query `page` 管理分页状态

这里可以看出项目把“账户当前状态”和“历史变更流水”拆成了两套表，而不是单表混用。

#### AI 建议页 `client/src/routes/Advice.svelte`

这是 AI 相关功能的前端入口，逻辑分三层：

1. 读取资产数据与用户设置。
2. 基于 `PROMPT_TEMPLATE` 拼装提示词。
3. 调用 `genAdviceWithStream()` 发起 SSE 流式请求。

实现细节：

- AI 配置包含 `apiKey`、`baseURL`、`model`、`temperature`
- 配置优先从服务端 `settings` 表加载，失败时回退到 `localStorage`
- 结果流通过 `@microsoft/fetch-event-source` 持续写入页面

因此这个页面不是“后端代管 AI 配置”，而是“前端保存 AI 配置，后端负责代调用模型接口并流式转发”。

#### 见解页 `client/src/routes/Insights.svelte`

这是用户记录投资思考的页面，包含两类能力：

- 列表式 CRUD：新增、编辑、删除、查看见解
- 日历热力图：按日期聚合见解数量

编辑器组件是 `Wysiwyg.svelte`，接口来自：

- `getInsights`
- `createInsights`
- `updateInsights`
- `destroyInsights`
- `getInsightsCalendarData`

#### 资产状态页 `client/src/routes/Status.svelte`

聚焦资产结构，不展示流水，而是：

- 拉取资产快照
- 结合汇率换算
- 渲染 `TreemapChart`

### 4.5 设置、汇率和兼容逻辑

这部分主要分散在：

- `client/src/components/Modal/Setting.svelte`
- `client/src/helper/settings.ts`
- `client/src/helper/utils.ts`

其中有几个关键点：

- 用户设置以服务端 `UserSettings` 为主存储。
- `localStorage` 被保留为兼容旧版本和失败兜底方案。
- 汇率使用外部 API 拉取，并缓存到 `sessionStorage`。
- 自定义货币与系统货币在前端合并后统一参与展示和换算。

所以“设置”在这个项目里不是纯前端功能，而是一个“前端优先体验 + 服务端持久化 + 浏览器本地兜底”的混合方案。

## 5. 服务端实现

### 5.1 服务端入口

入口文件是 `server/src/index.ts`，对外暴露了三个能力：

- `createApp()`
- `startServer()`
- `stopServer()`

启动流程大致是：

1. 应用运行时配置 `applyRuntimeOptions()`
2. 创建 Fastify 实例
3. 动态加载 `register`、`routes`、`models`
4. `sequelize.sync()`
5. 执行兼容迁移：
   - 给 `assets` 表补 `tags`
   - 给 `record` 表补 `tags`
6. 注册插件与路由
7. 托管静态资源
8. 设置 SPA 的兜底 404 逻辑

这个入口已经为桌面版做了适配，支持按参数覆盖：

- `host`
- `port`
- `publicDir`
- `dbPath`

### 5.2 运行时配置

在 `server/src/helper/runtime.ts` 中统一管理：

- Web 部署默认监听 `0.0.0.0:8888`
- 数据库默认在 `server/data/wealth_tracker.sqlite`
- 也支持从环境变量或桌面启动参数覆盖

这是 Web 与 Electron 共用同一套服务端的关键。

### 5.3 插件与中间件

`server/src/register.ts` 注册了：

- `@fastify/helmet`
- `@fastify/cookie`
- `@fastify/rate-limit`
- `fastify-xml-body-parser`
- `@fastify/multipart`
- `./middleware/auth`

`server/src/middleware/auth.ts` 做的是 API 级密码保护：

- 白名单接口可直接访问
- 其他 `/api/*` 请求会走 `checkPassword()`
- 若当前会话未认证，则返回 `401`

因此“密码保护”不是登录页体系，而是一个很轻量的会话门禁层。

### 5.4 路由与控制器映射

| 模块 | 路由文件 | 控制器文件 | 作用 |
| --- | --- | --- | --- |
| 资产 | `server/src/routes/assets.ts` | `server/src/controllers/assets.ts` | 当前资产 CRUD |
| 记录 | `server/src/routes/records.ts` | `server/src/controllers/records.ts` | 历史记录分页、修改、删除 |
| AI 建议 | `server/src/routes/advice.ts` | `server/src/controllers/advice.ts` | 调模型并把流式结果转发给前端 |
| 见解 | `server/src/routes/insights.ts` | `server/src/controllers/insights.ts` | 见解 CRUD 和日历热力图数据 |
| 密码 | `server/src/routes/password.ts` | `server/src/controllers/password.ts` | 检查密码状态、校验密码、设置密码 |
| 用户设置 | `server/src/routes/userSettings.ts` | `server/src/controllers/userSettings.ts` | 主题/语言/AI 配置持久化 |
| 自定义货币 | `server/src/routes/customCurrency.ts` | `server/src/controllers/customCurrency.ts` | 自定义币种管理 |

`server/src/routes/index.ts` 负责把这些路由汇总起来，并附带：

- `/api/heart`：健康检查
- `/api/reset`：重置资产与记录数据

### 5.5 数据模型

#### `Assets`

文件：`server/src/models/assets.ts`

表示“当前资产快照”，主键是 `type`。主要字段：

- `type`
- `alias`
- `amount`
- `currency`
- `risk`
- `liquidity`
- `tags`
- `datetime`
- `created`
- `updated`

#### `Record`

文件：`server/src/models/records.ts`

表示资产历史记录，每次新增资产或修改资产时都会写一条。这样就能支撑趋势分析和历史分页。

#### `Insight`

文件：`server/src/models/insights.ts`

用于保存用户的财富见解、复盘和笔记。

#### `UserSettings`

文件：`server/src/models/userSettings.ts`

保存用户设置，包括：

- 主题
- 语言
- 目标货币
- 汇率 API Key
- 比特币 API Key
- AI API Key / Base URL / Model / Temperature

#### `CustomCurrency`

文件：`server/src/models/customCurrency.ts`

保存自定义货币的：

- 代码
- 符号
- 名称
- 汇率
- 启用状态

#### `Password` 与 `Session`

文件：

- `server/src/models/password.ts`
- `server/src/models/session.ts`

密码使用 `bcrypt` + `PEPPER_SECRET` 进行处理；认证成功后生成一条短期 `session`，通过 cookie 维持登录态。

### 5.6 关键业务流

#### 资产新增/修改

1. 前端调用 `/api/assets`
2. `Assets` 表写当前值
3. 同时向 `Record` 表写一条历史记录

这样首页看的是最新资产，趋势页和明细页看的是历史轨迹。

#### AI 建议生成

1. 前端拼好 prompt 和模型配置
2. 服务端 `generateAdvice` 创建 OpenAI 客户端
3. 服务端用 `chat.completions.create(..., stream: true)` 调模型
4. 将模型 chunk 转成 SSE 格式逐段推给前端

所以服务端在这里扮演的是“流式代理层”。

#### 密码校验

1. 前端启动时先请求 `/api/password/check`
2. 如果已有有效 session cookie，则直接放行
3. 否则页面展示密码输入层
4. 校验成功后服务端写入 `sessionId` cookie

这是一套单用户、本地优先的访问保护机制。

## 6. 桌面端实现

### 6.1 设计原则

桌面版没有重新做渲染层，而是复用 Web 产物：

- Electron 主进程负责生命周期和安全边界
- 本地 Fastify 服务负责 API 和静态页面
- BrowserWindow 只访问本地 `127.0.0.1:<port>`

### 6.2 核心文件

#### `desktop/src/main.ts`

负责：

- 单实例锁
- 应用就绪后启动内嵌服务
- 创建主窗口
- 注册 IPC
- 退出前关闭服务子进程

#### `desktop/src/server.ts`

负责：

- 寻找空闲端口
- `fork` 启动 `server/dist/index.js`
- 注入桌面环境变量
- 探活 `/api/heart`
- 应用退出时优雅关闭服务

注入的关键环境变量包括：

- `HOST=127.0.0.1`
- `PORT=<动态端口>`
- `PUBLIC_DIR=<桌面运行时静态资源目录>`
- `SQLITE_DB_PATH=<用户目录下的 sqlite 文件>`

#### `desktop/src/paths.ts`

负责路径统一：

- 用户数据目录
- 日志目录
- SQLite 文件路径
- 打包后服务端入口
- 打包后静态资源目录

这保证桌面版不会把数据写回源码目录或安装目录。

#### `desktop/src/window.ts`

负责窗口与安全设置：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- 拦截外部链接，统一走系统浏览器打开

这部分是桌面应用安全边界的核心。

## 7. 代码里的几个设计特点

### 7.1 当前值和历史值分表

这是项目最重要的建模决策：

- `assets` 追踪“现在有多少”
- `record` 追踪“曾经如何变化”

好处是首页读取轻，趋势分析也有数据来源。

### 7.2 设置从本地存储迁移到服务端存储

代码里能看到明显的兼容期痕迹：

- 新方案：服务端 `UserSettings`
- 旧方案：`localStorage`

很多逻辑都是“先请求服务端，失败再回退本地”。

### 7.3 桌面与 Web 共用同一条 API 链路

前端坚持使用相对路径 `/api/*`，是整个架构复用成功的关键。这样：

- 浏览器部署时，直接请求当前站点
- 桌面部署时，请求本地 Fastify

前端完全不需要分平台分支。

### 7.4 服务端存在轻量迁移逻辑

`server/src/index.ts` 里手动检查并补 `tags` 字段，说明这个项目目前没有独立 migration 体系，而是采用启动时兼容修补的方式维护 SQLite 老数据。

## 8. 继续阅读代码时的建议顺序

如果要继续深入，建议按这个顺序看：

1. `client/src/App.svelte`
2. `client/src/routes/Index.svelte`
3. `client/src/helper/apis.ts`
4. `server/src/index.ts`
5. `server/src/routes/index.ts`
6. `server/src/controllers/assets.ts`
7. `server/src/controllers/records.ts`
8. `server/src/controllers/advice.ts`
9. `server/src/controllers/password.ts`
10. `desktop/src/main.ts`
11. `desktop/src/server.ts`

这条路径最容易把“页面 -> API -> 数据 -> 桌面封装”串起来。

## 9. 总结

这个项目的实现思路可以概括成一句话：

> 用 Svelte 做一个单用户资产管理前端，用 Fastify + SQLite 承载本地化数据和轻量 API，再用 Electron 把整套 Web 应用桌面化。

它最核心的工程价值不在复杂架构，而在复用做得很彻底：

- 同一套前端，跑 Web 和桌面
- 同一套服务端，同时负责 API 和静态资源
- 同一套 SQLite 模型，服务浏览器部署和本地桌面部署

如果后续要继续扩展，最值得优先关注的地方通常会是：

- 更规范的数据库迁移
- 更严格的设置与密钥管理
- AI 能力的抽象与 provider 解耦
- 前端页面逻辑进一步组件化
