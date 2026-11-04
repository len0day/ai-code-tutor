# ⚡ CodeTutor AI — 编程·运维·外语 AI 学习应用

用 AI 导师快速学习 **Python / Java / JavaScript / TypeScript / HTML / Docker·K8s / Linux / 日语** 八门课程：内置从入门到进阶共 192 节课，AI 全程陪学 —— 讲解、答疑、出题、批改、代码审查、模拟面试、规划路径。日语课程覆盖五十音到 N2 语法，例句带读音标注，TTS 自动切换日语语音朗读。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 （如被占用会自动换端口，以终端提示为准）。

**首次使用**：注册账号——第一个注册的用户自动成为管理员，并自动继承升级前 `data/` 下的旧学习数据。登录后管理员在「设置」页配置 AI 服务商与 API Key。

## 账号与权限

- **注册 / 登录**：用户名 + 密码（scrypt 加盐哈希存储，任何人都看不到明文）；会话为 HMAC 签名的 HttpOnly Cookie（7 天有效，重启服务不掉线）
- **数据隔离**：学习进度、错题本、收藏、笔记、对话记忆全部按用户独立存放于 `data/users-data/{userId}/`；AI 配置与内容缓存全局共享
- **管理员后台**（导航「后台」）：用户列表（XP/完成课/错题概览）、提权降级、禁用启用、重置密码、删除用户（连带清除其数据）、系统统计与缓存管理
- **权限边界**：AI 调用/朗读/题库需登录；AI 配置、用户管理、缓存管理仅管理员；管理员不能对自己降级/禁用/删除

## 功能

| 功能 | 说明 |
|---|---|
| 📚 内置课程 | 八门课程 × 4 难度等级 × 6 课 = 192 课：编程语言 4 门 + HTML + Docker/K8s + Linux 常用操作 + 日语（五十音→N2，例句含读音与翻译，TTS 自动用日语语音朗读） |
| 💬 AI 导师 | 每节课的对话面板，苏格拉底式引导答疑，流式输出，代码高亮 |
| 🤔 思考过程 | 支持思考型模型（GLM-4.5+ / DeepSeek-R1 / MiniMax-M 系列等），思考内容默认折叠，点击展开 |
| 🔊 Edge TTS 朗读 | AI 讲解与导师回复可一键朗读（微软 Edge「大声朗读」同款服务，无需 Key），自动分句合成 |
| 🤖 AI 深入讲解 | 一键生成类比讲解、进阶示例与常见坑 |
| 📝 练习测验 | AI 按本课知识点出题（3 选择 + 2 编程），选择题本地判分，编程题 AI 批改讲错因 |
| 💻 代码实操 | 动手写代码 → **「▶ 运行」在本机沙箱执行**看真实 stdout 与错误原文 → **「🤖 AI 讲解与找 Bug」**逐行讲解；运行失败时一键「让 AI 分析这个报错」 |
| 🎤 模拟面试 | AI 面试官出 5 道题（概念/场景/编码）逐题问答，每题打分点评，结束生成含录用建议的报告；也可直接看 AI 讲解的本课高频面试题 |
| 📚 知识库 | 错题自动归集（测验/面试答错即入本）、课程/知识点/题目收藏、课程笔记，全部支持按语言筛选 |
| 💻 在线题库 | 双源切换：**LeetCode**（leetcode.cn GraphQL，按语言/主题/难度/关键词）+ **HackerRank**（官方练习区接口，Python/Java/算法/**Linux Shell** 等 track）；学习页自动按课程推荐相关练习（日语等无对应题库的课程不显示） |
| 🗺 个性化路径 | 基于进度/成绩/错题，AI 推荐下一步学什么、薄弱点在哪 |
| 🏆 学习激励 | XP 经验值、连续学习天数、进度环 |

### 朗读功能（Edge TTS）

- 点击 AI 回复下方的 🔊 或「AI 深入讲解」旁的「朗读」即可收听；播放中按钮变为 ⏹，再次点击停止
- 服务端通过 [msedge-tts](https://www.npmjs.com/package/msedge-tts) 连接微软语音服务合成 MP3（默认音色 `zh-CN-XiaoxiaoNeural` 晓晓），**不需要任何 API Key**
- **按课程语言自动切换发音人**：日语课程用 `ja-JP-NanamiNeural`（花）朗读例句，中文课程用晓晓
- 超长文本自动按句分段合成后无缝拼接；Markdown 的代码块会自动转为「（代码示例略）」
- 可通过 `/api/tts` 的 `voice` / `rate` 参数更换音色与语速（如 `zh-CN-YunxiNeural` 云希、`+20%`）

### 模拟面试

每节课的「🎤 模拟面试」Tab 提供两种模式：

- **📖 AI 讲解**：流式生成与本课知识点直接相关的 6~8 道真实面试高频题，每题含考察点、参考答案要点与可能的追问，可朗读
- **🎤 模拟面试**：AI 面试官出 5 道题（概念 → 场景 → 编码，难度递进）逐题问答；每题按「正确性 40% + 完整性 30% + 深度 20% + 表达 10%」打分并点评，可对照参考答案；结束后生成面试报告（总分、等级、录用建议、亮点与待改进），成绩计入学习进度，≥60 分 +20 XP

### 知识库（错题本 / 收藏 / 笔记 / LeetCode）

导航栏「知识库」进入，四个板块，右上角可按语言筛选：

- **❌ 错题本**：测验答错的选择/编程题、面试未通过（<60 分）的题自动入库，去重合并；展示我的回答、正确答案与解析，可标记「已掌握」或一键回炉原课程
- **⭐ 收藏**：课程（☆ 收藏按钮）、知识点（每条右侧 ☆）、测验题（判卷后 ☆）、面试题（答题卡 ☆）均可收藏，集中复习
- **📝 笔记**：每节课左侧「我的笔记」随手记（便签样式），集中查看与删除
- **💻 在线题库（双源）**：LeetCode 与 HackerRank 一键切换。
  - LeetCode：经本地代理读取 leetcode.cn GraphQL（仅允许 leetcode.cn / leetcode.com 白名单域名，杜绝 SSRF）
  - HackerRank：读取官方练习区接口（白名单 www.hackerrank.com），映射 Python/Java/算法/**Linux Shell** 等 track
  - 学习页底部按课程自动推荐（Python/Java/JS/TS → 双源；Linux → HackerRank Shell）；知识库「在线题库」Tab 可按语言自由刷题

## 智能缓存与记忆

## 配额与权限

- **普通用户**：每日 AI 交互次数受限（管理员可调，默认 30 次；成功调用计数、缓存命中不计）；可解锁学习的课程数受限（默认 2 门，首次进入自动占用名额）；AI 配置不可见不可改
- **管理员**：全部功能不受限；后台「⚖️ 普通用户配额」卡实时调整两类限制；用户管理支持「重置课程」（清空解锁名额，保留学习数据）
- **设置页分角色**：普通用户 = 账号信息 + 用量进度条 + 已解锁课程 + 个人 Token 用量；管理员 = 完整 AI 服务配置 + 缓存管理

## Token 用量统计

- **采集**：每次 AI 调用读取服务商返回的 `usage`（prompt/completion/total）；服务商未返回时按字符数估算（CJK 1 字≈1 token，其余 4 字符≈1 token），明细中标记「估」字区分
- **入库**：新表 `token_usage`（user_id / task / model / lang / 三类 token 数 / estimated / 时间），失败调用不入库
- **管理员视图**（后台「🔢 Token 用量统计」）：累计 tokens、近 7 天、今日、调用次数四卡概览 + 按任务条形分布 + 按用户消耗 Top + 最近调用明细（含模型名与时间）
- **普通用户视图**（设置页「累计 Token 用量」）：自己的输入/输出/调用次数三栏 + 今日消耗

## 课程体系

- **编程与运维**（`/learn/{lang}`）：Python · Java · JavaScript · TypeScript · HTML · Docker/K8s · Linux —— 7 门 × 24 课 = 168 课
  - 四个 AI 面板：💬 AI 导师 · 📝 练习测验 · 💻 代码实操 · 🎤 模拟面试（技术面，逐题打分 + 录用建议）
- **语言学习增值包**（`/languages/{lang}`）：🌸 日语 —— 五十音到 N2，24 课
  - **书本化阅读体验**：3D 烫金封面（悬浮翻开）、纸张内页（装订线/卷页角）、目录带页码、翻页动画、手写批注
  - 三个 AI 面板：💬 AI 导师 · 📝 练习测验 · 🎭 **场景模拟**（无代码实操）
  - **👩‍🏫 语言精讲**（语言课专属的内容生成方式，区别于编程课的「深入讲解」）：核心语法点 → 核心单词表 → 句子拆解 → 常见错误 → 随堂练习，全部由语言老师按本课水平生成
  - **🎭 场景模拟**：题目与说明**全部中文**（初学者只看中文就懂要做什么）→ 每轮从 **3 个候选回答**中选一个（考察同一语法点、答案有区分度）→ 答对后对方接话，**构成连续多轮对话**（实测 3~4 轮）→ 结束后**语言老师逐句点评**（修正写法 + 语法原因 + 读音 + 翻译 + 4 项评分 + 改进建议）
  - 场景与选项**严格匹配当前课程**的语法与词汇（由课程知识点驱动生成）
  - 例句一律「原文 + 読み（假名）+ 中文翻译」三行式；朗读分两个按钮：**🔊 日语**用日语发音（`ja-JP-NanamiNeural`），**🔊 中文**用中文发音，读音行不重复朗读

## 移动端 / 小程序 / iOS 接入

- **架构**：Next.js BFF 同仓模式，但 **API 层是标准 REST**、UI 与业务逻辑约 **90% 与 Next 解耦**（`client.ts` / `types.ts` / 课程数据 / 大部分组件无 `next/*` 依赖）
- **API 客户端工厂**：`createApiClient({ baseUrl, token })` —— 同一份代码跑在 Web（Cookie 会话）、小程序 / React Native（Bearer Token）
- **Bearer Token 认证**：设置页「📱 移动端 / 小程序接入」可签发/撤销 Token（明文只显示一次，服务端仅存 SHA-256 摘要）
- **CORS**：`src/middleware.ts` 为 `/api/*` 自动加跨域头，生产用环境变量 `CORS_ORIGINS` 指定白名单
- **移动端 Web**：响应式布局（窄屏单列 + 汉堡菜单）、触摸目标 ≥44px、完整无障碍（跳转链接 / `:focus-visible` 焦点环 / `aria-*` / `prefers-reduced-motion` 降级）
- 详细迁移步骤见 **[docs/MOBILE.md](docs/MOBILE.md)**

## 闯关制与学习报告

- **双门槛通关**：每节课需「练习测验」与「模拟面试 / 场景对话」**均达到 60 分**才算通关，并自动解锁下一节课
- **不可手动完成**：没有「标记完成」按钮；课程完成状态与 XP **完全由达标判定**，服务端也会拒绝手动完成请求
- **XP 规则**（仅首次达标发放，重复练习不再加分，防刷分）：
  | 事件 | XP |
  |---|---|
  | 测验首次达到 60 分 | +15 |
  | 面试 / 场景对话首次达到 60 分 | +20 |
  | 双项达标（通关本课） | 额外 +10 |
- **预览模式**：未解锁的课程仍可进入浏览静态内容（知识点、例句、笔记），但 AI 深入讲解、测验、面试/场景模拟全部禁用（服务端同步校验，不只是前端置灰）
- **成绩全记录**：每次测验/面试成绩都写入 `user_progress`（测验与面试分列），另存 `lesson_gates` 表记录最高分、达标状态与尝试次数
- **学习报告**（导航「学习报告」）：全课程每课的测验成绩、面试/场景成绩、达标/通关/未解锁状态一览，可按语言筛选；大纲页与学习页同步显示分数徽章
- 编程课的门槛是「测验 + 模拟面试」，语言课的门槛是「测验 + 场景对话」

## 数据库与部署

- **双引擎自动切换**：设置 `DATABASE_URL` → PostgreSQL；不设置 → 内置 SQLite（`data/app.db`，零配置）
- **统一 SQL 层**：`src/lib/db/` 提供 `Db` 抽象接口 + 两套实现
  - 占位符统一用 **`$name` 具名形式** —— SQLite 与 PostgreSQL **均原生支持**，对象绑定、零字符串改写，杜绝 SQL 注入
  - 写入统一用 `INSERT ... ON CONFLICT (...) DO UPDATE`（两端通用）
- **表结构**（两端一致）：users / user_progress / user_stats / wrong_questions / favorites / notes / memory_chats / settings / content_cache / ai_usage / course_unlocks / app_config / api_tokens / lesson_gates / token_usage
- **切换到 PostgreSQL**：
  ```bash
  # 1) 起一个 PG
  docker compose up -d postgres
  # 2) 迁移现有数据（幂等）
  DATABASE_URL=postgresql://codetutor:change-me@127.0.0.1:5432/codetutor \
    node scripts/migrate-to-postgres.mjs
  # 3) 配置并重启
  echo "DATABASE_URL=postgresql://codetutor:change-me@127.0.0.1:5432/codetutor" >> .env.local
  npm run build && npm start
  ```
- 环境变量说明见 `.env.example`（`DATABASE_URL` / `PORT` / `CORS_ORIGINS` / `PGSSL`）

## 内容缓存与管理员查看

- 已生成的**深入讲解、语言精讲、测验题、面试题**全部落库复用，命中缓存不再调用大模型
- **已完成课程的讲解长期保留**：重新进入该课自动加载缓存内容并展示（可朗读），不消耗任何 AI 配额
- **管理员后台「🗄 缓存内容查看器」**：按类型筛选，点开即可查看讲解/试题全文（Markdown 渲染），含生成时间与体积
- 讲解内容也可直接调 `GET /api/ai/cached?task=explain&lang=python&lessonId=python-1-1` 获取

## 代码实操沙箱

学习页「💻 代码实操」Tab 的闭环：**动手写 → 跑起来 → AI 帮你挑毛病 → 改 → 再跑**。

- **▶ 运行**：在本机沙箱执行代码，直接看到 stdout 与错误原文（Traceback / 堆栈完整输出）
- **🤖 AI 讲解与找 Bug**：逐行讲解代码、找 Bug、给改进建议
- **🔍 让 AI 分析这个报错**：运行失败时一键把「代码 + stderr 原文」一起交给 AI，定位更准
- **解释器白名单**：仅 Python 3（`python3 -I` 隔离模式）与 Node.js；其他语言给出明确提示，AI 讲解仍可用
- **防护**：参数数组传参（不经 shell，无命令注入面）、8 秒超时强制 SIGKILL、128MB 内存上限、独立临时目录执行完即删、输出截断 64KB、需登录

> ⚠️ 该能力会在服务器上执行用户代码，仅建议部署在**受信任的内网或自己的服务器**；公网部署请自行加容器隔离或改用在线判题服务。

## 开发约定

- **数据层全部 async**：调用必须 `await`。漏写不会被 TypeScript 拦截（Promise 与普通值比较不报错），但会表现为 `[object Promise]`、空对象或静默失效
- 因此仓库内置**构建闸门**：`npm run build` 前自动执行 `scripts/check-async-calls.mjs`，扫描全部数据层调用点，发现漏 `await` 即**阻断构建**（也可单独运行 `npm run check:await`）

## 🚀 部署到云服务器

完整流程见 **[docs/DEPLOY.md](docs/DEPLOY.md)**：云服务器选购 → 域名/备案 → HTTPS → systemd 守护 → 备份 → 安全清单，全程约 1~2 小时（域名备案除外）。

**Docker 一键部署**（含 PostgreSQL）：

```bash
docker compose up -d --build   # 应用 + PostgreSQL 一起起
# 访问 http://服务器IP:3000，注册首个账号（管理员）
```

## 智能缓存与记忆（存于数据库）

- **🌗 主题三态**：浅色 / 深色 / 跟随系统，导航栏 ☀️/🌙/💻 一键循环切换，偏好保存在浏览器本地；首屏渲染前应用主题，深色下无白屏闪烁；代码块保持终端质感深色（明暗主题通用）
- **♻️ 内容缓存**：深入讲解、测验题、面试题、面试讲解首次生成后落盘（同课程再次进入**直接复用，不再调用大模型**）；「重新讲解 / 再来一套新题 / 再来一场（换新题）」会忽略缓存重新生成并覆盖。设置页可查看缓存统计与一键清空
- **🔁 模型自动获取**：设置页「⟳ 自动获取模型列表」实时向服务商拉取可用模型（GLM `/api/paas/v4/models`、MiniMax `/v1/models`、自定义 OpenAI 兼容服务），点选即切换；仅管理员可用，目标主机受白名单与 SSRF 校验
- **🧠 对话记忆**：每节课与 AI 导师的对话持久化（`data/memory.json`），重启应用后导师依然记得之前聊过的内容，可一键清空本课记忆
- **👤 学生画像**：每次对话自动注入长期记忆（XP、连击、已完成课程、未掌握错题、笔记情况），导师能个性化呼应你的学习状态
- **📡 SSE 流式**：所有流式任务采用标准 SSE（`data:` 事件帧），缓存命中时按块回放保持打字机体验

## AI 服务商配置（设置页）

| 预设 | 默认接口 | 备注 |
|---|---|---|
| GLM · 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` 有免费额度 |
| MiniMax | `https://api.minimax.chat`（`/v1/text/chatcompletion_v2`） | 与 OpenAI 格式兼容 |
| 自定义 | 任意 OpenAI 兼容服务 | DeepSeek / Kimi / OpenAI / Ollama / 中转站等，填 Base URL + 模型名 |

## 项目结构

```
src/
├── app/
│   ├── page.tsx                 # 仪表盘（进度、AI 学习建议）
│   ├── settings/                # API Key 后台配置
│   ├── learn/[lang]/            # 课程大纲 + 学习页
│   └── api/
│       ├── ai/                  # 统一 AI 端点（NDJSON 流：reasoning/content 事件）
│       ├── tts/                 # Edge TTS 朗读（文本 → MP3）
│       ├── settings/            # 配置读写 + 连接测试（Key 掩码返回）
│       └── progress/            # 学习进度（完成/测验/错题/XP/连击）
├── data/courses/                # 四门语言课程数据（96 课）
├── lib/
│   ├── ai/provider.ts           # OpenAI 兼容客户端（GLM/MiniMax/自定义，思考/正文分流）
│   ├── tts.ts                   # Edge TTS 服务端客户端
│   ├── prompts.ts               # 六类任务的系统提示词
│   ├── store.ts                 # 本地 JSON 存储
│   └── client.ts                # 前端 API 封装
└── components/                  # Nav / Markdown / ChatPanel / QuizTab / CodeReview
```

## 数据与隐私

- 所有数据保存在本机 `data/` 目录（已 gitignore）：`settings.json` 存 Key，`progress.json` 存进度
- API Key 只存在于本地服务端，浏览器通过后端转发调用 AI，前端永远拿不到明文 Key
- 想重置学习进度：删除 `data/progress.json` 或调 `POST /api/progress {"type":"reset"}`

## 技术栈

Next.js 16 (App Router + Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · react-markdown + highlight.js

## 常见问题

- **测试连接报 401**：Key 错误或过期；GLM 的 Key 形如 `id.secret`，从开放平台控制台重新生成
- **自定义服务连接失败**：确认 Base URL 填到版本号（如 `https://api.deepseek.com/v1`），应用会自动拼接 `/chat/completions`
- **AI 回复为空**：检查模型名是否与平台一致（部分平台旧模型已下线）
