# 移动端 / 小程序接入指南

本文说明 CodeTutor AI 的架构现状，以及如何把前端复用到 **微信小程序** 和 **iOS（React Native）**。

---

## 一、当前架构：Next.js BFF（同仓），但已可分离

```
┌───────────────── 代码仓库（一个 Next.js 应用）─────────────────┐
│                                                                  │
│  页面层 (React)                    API 层 (Next Route Handlers)  │
│  app/page.tsx                     app/api/**/route.ts            │
│  app/learn/...                    app/api/auth/*                │
│  app/languages/...                app/api/ai  app/api/progress   │
│  components/*                     ...                            │
│         │                                  │                    │
│         └──────────► src/lib/client.ts ◄───┘                    │
│              （统一 API 客户端，可指向任意后端）                   │
│                                                                  │
│  数据层：src/lib/store.ts → Db 抽象 → SQLite(默认) / PostgreSQL(DATABASE_URL) │
└──────────────────────────────────────────────────────────────────┘
```

**结论**：

| 层 | 与 Next.js 耦合 | 能否复用到小程序/RN |
|---|---|---|
| API 客户端 `lib/client.ts` | 无（已支持 baseUrl + Bearer） | ✅ 直接复制 |
| 业务类型 `lib/types.ts` | 无 | ✅ 直接复制 |
| 课程数据 `data/courses/*` | 无 | ✅ 直接复制 |
| 预设/语言表 `lib/ai/presets.ts` | 无 | ✅ 直接复制 |
| 组件（ChatPanel / QuizTab / InterviewTab / CodeReview / ProblemBank / LanguageRoleplay / ReasoningBlock / SpeakButton / Markdown / TokenStatsCard） | 无 next/* 依赖 | ✅ 复制后换少量平台 API |
| `components/Nav.tsx` | next/link、next/navigation | ⚠️ 需替换为 RN 的 `Link`/自绘 |
| 页面 `app/**/page.tsx` | next/link、next/navigation | ⚠️ 需重写为 RN 页面 |
| API 路由 `app/api/**` | Next Route Handler | ⚠️ 需迁到独立服务（见下） |

> 结论：**UI 与业务逻辑约 90% 可直接复用**；需要替换的主要是路由与链接、以及依赖 DOM 的少数 API（剪贴板、`Audio`、Markdown 渲染）。

---

## 二、第一步：把后端拆成独立服务

### 2.1 现状
后端是 Next.js 的 Route Handlers（`app/api/**`），接口本身已是**标准 REST**（JSON in / JSON out，Cookie 或 Bearer 认证，SSE 流式），因此迁移成本低。

### 2.2 两种迁移路线

**路线 A：保留 Next.js 作为纯后端（推荐，改动最小）**
把 `app/` 目录下的 `page.tsx` 移除，只保留 `api/`，用 `next start` 或容器部署为纯 API 服务：

```bash
# 部署为独立 API（示例）
npm run build
PORT=4000 npm start
```

**路线 B：换成真正的独立后端（如 Express/NestJS/Hono）**
逐个搬运 `app/api/**/route.ts` 的处理逻辑即可 —— 每个文件只依赖：

- `src/lib/store.ts`（SQLite 读写）
- `src/lib/auth.ts`（认证）
- `src/lib/ai/provider.ts`（AI 调用）
- `src/lib/cache.ts`（内容缓存）

这些模块**不依赖 Next 运行时**（仅 `next/headers` 的 cookies 需要换成框架自带的等价物）。

### 2.3 跨域（CORS）
仓库已内置 `src/middleware.ts`，为 `/api/*` 自动添加 CORS 头。生产环境请用环境变量指定白名单：

```bash
# 逗号分隔；留空表示放行全部（仅内网/自建）
CORS_ORIGINS=https://your-miniprogram-host.com,https://app.example.com
```

---

## 三、第二步：小程序 / App 接入

### 3.1 签发 API Token
Web 端「设置 → 📱 移动端 / 小程序接入」生成 Token（明文仅显示一次，服务端只存 SHA-256 摘要，可随时撤销）。

也可直接调用：

```bash
curl -X POST https://your-api.example.com/api/auth/tokens \
  -H "Content-Type: application/json" \
  -b "ct_session=<你的会话Cookie>" \
  -d '{"action":"create","label":"我的 iPhone"}'
```

### 3.2 统一 API 客户端（跨端复用）
`src/lib/client.ts` 已抽象成工厂，复制到小程序/RN 项目即可：

```ts
import { createApiClient } from "./client";

const api = createApiClient({
  baseUrl: "https://your-api.example.com",
  token: "ct_xxxxxxxx",
});
```

可用方法一览：

| 分类 | 方法 |
|---|---|
| 账号 | `fetchUsage()` / `fetchSettings()` |
| 学习 | `fetchProgress()` `postProgress()` `fetchNotebook()` `addWrongQuestion()` `toggleFavorite()` `saveNote()` |
| 记忆 | `fetchChat()` `saveChatMemory()` `clearChatMemory()` |
| AI | `streamAi(body, {onContent, onReasoning})`（SSE 流式） `aiJson(body)` |
| 题库 | `fetchLeetCodeProblems()` `fetchHackerRankProblems()` |
| 朗读 | `speak(text, lang)` → Blob（MP3） |

### 3.3 微信小程序（Taro / uni-app / 原生）

小程序**不支持 `EventSource`**，但本项目的 SSE 是用 `fetch` + `ReadableStream` 实现的，所以在小程序里需要改用 `wx.request` 的 `enableChunked`：

```ts
// 小程序端流式示例
const task = wx.request({
  url: `${BASE_URL}/api/ai`,
  method: "POST",
  header: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  data: { task: "tutor", lang: "python", lessonId: "python-1-1",
          messages: [{ role: "user", content: "什么是变量？" }] },
  enableChunked: true,
  success: ({ headerReceived, dataReceived }) => {
    // dataReceived 为 NDJSON 分片，逐行 JSON.parse 后按 type 分发
    buffer += dataReceived;
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.type === "content") setText((p) => p + evt.text);
    }
  },
});
```

**小程序需要替换的组件**：

| Web 组件 | 小程序替代 |
|---|---|
| `Markdown.tsx`（react-markdown） | `mp-html` 或 `towxml` 渲染 markdown |
| `SpeakButton.tsx`（Web Audio） | `wx.createInnerAudioContext()` 播放 `/api/tts` 返回的 MP3（Blob → ArrayBuffer） |
| `Nav.tsx` | 小程序原生 `tabBar` / 自绘顶部导航 |
| 复制按钮 | `wx.setClipboardData` |
| `localStorage`（主题偏好） | `wx.setStorageSync` |

**可直接复制**：`client.ts`、`types.ts`、`data/courses/*`、`presets.ts`，以及 ChatPanel / QuizTab / InterviewTab 的**逻辑部分**（把 JSX 换成小程序模板即可）。

### 3.4 iOS / Android（React Native + Expo）

React Native 与 React 的组件模型一致，**大部分组件可直接复用**：

```tsx
// App.tsx
import { createApiClient } from "./src/lib/client";
const api = createApiClient({
  baseUrl: "https://your-api.example.com",
  token: await SecureStore.getItemAsync("ct_token"),
});
```

**需要替换的平台相关部分**：

| Web 能力 | React Native 替代 |
|---|---|
| `react-markdown` | `react-native-markdown-display` |
| `highlight.js`（HTML 高亮） | `react-native-syntax-highlighter` |
| `<audio>`（朗读） | `expo-av` 的 `Audio.Sound`（播放 MP3） |
| `navigator.clipboard` | `expo-clipboard` |
| `localStorage` | `@react-native-async-storage/async-storage` |
| `window.matchMedia`（深色检测） | `Appearance` API |
| `next/link` | `react-native` 的 `Link` / `navigation` |
| `document.querySelector` | `react-native` refs |

> 认证建议：小程序/RN 用 **Bearer Token**（`Authorization: Bearer ct_xxx`），Web 端继续用 HttpOnly Cookie 会话 —— 后端 `getCurrentUser()` 已同时支持两条通道。

---

## 四、移动端 Web（响应式 + 无障碍）现状

仓库已内置以下适配，可直接用手机浏览器访问：

- **响应式布局**：学习页双栏在窄屏自动堆叠为单列；仪表盘卡片自适应 1~2 列
- **移动端导航**：窄屏（< lg）折叠为 ☰ 汉堡菜单，支持点击外部/Esc 关闭
- **触摸目标**：粗指针设备（`pointer: coarse`）下按钮/链接最小 44×44px
- **无障碍**：
  - 「跳到主内容」跳转链接（键盘/读屏用户第一个 Tab 可见）
  - 全局 `:focus-visible` 焦点环
  - `main` 区域 `role="main"` + `tabIndex={-1}`
  - 导航 `aria-label`、当前页 `aria-current="page"`、汉堡按钮 `aria-expanded` / `aria-controls`
  - `prefers-reduced-motion` 自动关闭动效与位移动画
  - `.sr-only` 工具类（仅读屏可见的文本）

---

## 五、部署清单（云服务器）

```bash
# 1. 环境变量（凭据只从环境变量读取）
export PORT=3000
export CORS_ORIGINS="https://your-app.example.com"

# 2. 构建 & 启动
npm ci
npm run build
npm start
```

**需要持久化的数据**（容器部署时挂卷）：

| 路径 | 内容 |
|---|---|
| `data/app.db` | SQLite 主库（未配置 DATABASE_URL 时使用） |
| `data/auth-secret.json` | 会话签名密钥（**丢失则所有会话失效**） |
| PostgreSQL | 配置 `DATABASE_URL` 后数据全部存于 PG；用 `scripts/migrate-to-postgres.mjs` 可从 SQLite 搬迁 |

**备份**：`sqlite3 data/app.db ".backup backup.db"` 或直接拷贝 `data/` 目录。

---

## 六、常见问题

**Q：能用 PostgreSQL 吗？**
可以。把 `src/lib/store.ts` 的 SQL 换成 pg 驱动即可 —— 该文件是唯一的数据访问入口，其余代码零改动。表结构见 `src/lib/db.ts` 的 `SCHEMA` 数组。

**Q：小程序里 SSE 断流怎么办？**
`streamAi` 已把解析逻辑封装在客户端里；小程序用 `enableChunked` 手动实现时，注意按 `\n\n` 切分事件、`\n` 切分行（见 3.3 示例）。

**Q：移动端如何做本地通知/离线？**
服务端已提供 `/api/progress`、`/api/memory` 等全量接口，客户端可做本地缓存 + 联网同步；Token 用量与配额由服务端统一管控。
