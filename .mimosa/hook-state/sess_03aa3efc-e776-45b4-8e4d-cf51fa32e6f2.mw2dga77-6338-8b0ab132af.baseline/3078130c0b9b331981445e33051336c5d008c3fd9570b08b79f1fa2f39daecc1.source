import type { ProviderId } from "../types";

export interface ProviderPreset {
  id: ProviderId;
  name: string;
  description: string;
  baseUrl: string;
  /** 聊天补全路径，拼在 baseUrl 后 */
  chatPath: string;
  defaultModel: string;
  /** 设置页展示的候选模型 */
  models: string[];
  /** 自定义服务时允许用户填写 baseUrl */
  allowCustomBaseUrl: boolean;
  keyHint: string;
  docsUrl: string;
}

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  glm: {
    id: "glm",
    name: "GLM · 智谱",
    description: "智谱 BigModel 开放平台，glm-4-flash 免费额度充足，注册即用。",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    chatPath: "/chat/completions",
    defaultModel: "glm-4-flash",
    models: ["glm-4-flash", "glm-4-flashx", "glm-4.5-air", "glm-4.5", "glm-4.6"],
    allowCustomBaseUrl: false,
    keyHint: "在 open.bigmodel.cn 控制台「API Keys」创建，形如 id.secret",
    docsUrl: "https://open.bigmodel.cn/dev/api",
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax 开放平台，/v1/text/chatcompletion_v2 与 OpenAI 格式兼容。",
    baseUrl: "https://api.minimax.chat",
    chatPath: "/v1/text/chatcompletion_v2",
    defaultModel: "MiniMax-Text-01",
    models: ["MiniMax-Text-01", "MiniMax-M2", "MiniMax-M1", "abab6.5s-chat"],
    allowCustomBaseUrl: false,
    keyHint: "在 platform.minimaxi.com「账户管理 → API Keys」创建",
    docsUrl: "https://platform.minimaxi.com/document/ChatCompletion%20v2",
  },
  custom: {
    id: "custom",
    name: "自定义 OpenAI 兼容服务",
    description: "DeepSeek / Kimi / OpenAI / Ollama / OneAPI 中转等任何 OpenAI 兼容接口。",
    baseUrl: "",
    chatPath: "/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: [],
    allowCustomBaseUrl: true,
    keyHint: "填入目标服务的 API Key（本地 Ollama 可随意填写）",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
  },
};

export const LANGUAGE_META: Record<
  string,
  { name: string; emoji: string; gradient: string }
> = {
  python: { name: "Python", emoji: "🐍", gradient: "from-sky-500 to-blue-600" },
  java: { name: "Java", emoji: "☕", gradient: "from-orange-500 to-red-500" },
  javascript: { name: "JavaScript", emoji: "🟨", gradient: "from-amber-400 to-yellow-500" },
  typescript: { name: "TypeScript", emoji: "🔷", gradient: "from-blue-600 to-indigo-600" },
  html: { name: "HTML", emoji: "🌐", gradient: "from-orange-500 to-rose-500" },
  docker: { name: "Docker/K8s", emoji: "🐳", gradient: "from-blue-500 to-cyan-500" },
  linux: { name: "Linux", emoji: "🐧", gradient: "from-slate-600 to-zinc-800" },
  japanese: { name: "日语", emoji: "🌸", gradient: "from-rose-500 to-pink-600" },
};

/** TTS 语音映射：不同课程用合适的发音人 */
export const TTS_VOICE: Record<string, string> = {
  japanese: "ja-JP-NanamiNeural",
};
export const DEFAULT_TTS_VOICE = "zh-CN-XiaoxiaoNeural";

/** 有 LeetCode 题库的语言（其余课程隐藏 LC 推荐） */
export const LC_LANGS: ReadonlySet<string> = new Set([
  "python",
  "java",
  "javascript",
  "typescript",
]);
