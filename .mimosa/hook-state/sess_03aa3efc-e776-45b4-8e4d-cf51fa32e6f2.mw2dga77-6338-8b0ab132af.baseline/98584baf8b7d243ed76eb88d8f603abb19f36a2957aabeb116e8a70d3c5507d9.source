"use client";

import type {
  ChatMessage,
  LeetCodeProblem,
  LessonGate,
  Notebook,
  Progress,
  PublicSettings,
  ProviderId,
} from "@/lib/types";
import { LC_LANGS } from "@/lib/ai/presets";

/**
 * 统一 API 客户端。
 *
 * 同一份代码可运行在：
 * - Next.js Web（默认相对路径，走同源 Cookie 会话）
 * - 微信小程序 / React Native / 独立前端（传入 baseUrl + Bearer Token）
 *
 * 用法：
 *   const api = createApiClient({ baseUrl: "https://api.example.com", token: "ct_xxx" });
 *   await api.getProgress();
 */

export interface ApiClientOptions {
  /** 后端地址，如 https://api.example.com（留空表示同源） */
  baseUrl?: string;
  /** Bearer Token（移动端/小程序用；Web 端用 Cookie 会话即可） */
  token?: string;
  /** 自定义 fetch（React Native 可注入） */
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  readonly baseUrl: string;
  readonly hasToken: boolean;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  // ---- 业务方法 ----
  fetchSettings(): Promise<PublicSettings>;
  saveSettings(payload: SaveSettingsPayload): Promise<unknown>;
  testSettings(payload: SaveSettingsPayload & { persist?: boolean }): Promise<TestResult>;
  fetchProgress(): Promise<Progress>;
  postProgress(op: ProgressOp): Promise<Progress>;
  fetchNotebook(): Promise<Notebook>;
  addWrongQuestion(item: WrongQuestionInput): Promise<void>;
  toggleFavorite(item: FavoriteInput): Promise<boolean>;
  removeFavorite(id: string): Promise<void>;
  toggleResolved(id: string): Promise<void>;
  removeWrong(id: string): Promise<void>;
  saveNote(lessonId: string, lang: string, content: string): Promise<void>;
  removeNote(lessonId: string): Promise<void>;
  fetchChat(lessonId: string): Promise<AiChatMessage[]>;
  saveChatMemory(lessonId: string, messages: ChatMessage[]): Promise<void>;
  clearChatMemory(lessonId: string): Promise<void>;
  fetchUsage(): Promise<UsageInfo>;
  streamAi(
    body: Record<string, unknown>,
    handlers: StreamHandlers
  ): Promise<{ content: string; reasoning: string }>;
  aiJson<T>(body: Record<string, unknown>): Promise<T>;
  fetchLeetCodeProblems(body: {
    tags?: string[];
    search?: string;
    difficulty?: string;
    limit?: number;
  }): Promise<{ problems: LeetCodeProblem[]; total: number; source: string }>;
  fetchHackerRankProblems(body: {
    track: string;
    search?: string;
    limit?: number;
  }): Promise<{ problems: BankProblem[]; source: string }>;
  fetchModels(): Promise<{ models: string[]; source?: string }>;
  speak(text: string, lang?: string): Promise<Blob>;
}

export interface SaveSettingsPayload {
  provider: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface TestResult {
  ok: boolean;
  error?: string;
  reply?: string;
  model?: string;
}

export type ProgressOp =
  | { type: "visit" | "complete"; lessonId: string }
  | { type: "quizResult"; lessonId: string; score: number; wrongIds?: string[] }
  | { type: "interviewResult"; lessonId: string; score: number }
  | { type: "reset" };

export interface WrongQuestionInput {
  lessonId: string;
  lang: string;
  source: "quiz" | "interview";
  kind: "choice" | "code" | "interview";
  question: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  idealAnswer?: string;
  userAnswer?: string | number;
}

export interface FavoriteInput {
  lessonId: string;
  lang: string;
  kind: string;
  title: string;
  content?: string;
}

export interface UsageInfo {
  username: string;
  role: "admin" | "user";
  aiUsed: number;
  aiLimit: number;
  unlocked: string[];
  courseLimit: number;
  totalCourses: number;
  xp: number;
  completedLessons: number;
  streak: number;
  tokens?: {
    total: number;
    prompt: number;
    completion: number;
    calls: number;
    today: number;
    estimated: boolean;
  };
}

export type BankSource = "leetcode" | "hackerrank";

export interface BankProblem {
  id: string;
  title: string;
  url: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acRate: number | null;
  source: BankSource;
}

/** 与 types.ts 的 ChatMessage 同义（role 已窄化为对话角色） */
export type AiChatMessage = ChatMessage & { role: "user" | "assistant" };

export interface StreamHandlers {
  onContent?: (text: string) => void;
  onReasoning?: (text: string) => void;
}

/** 创建 API 客户端：Web 端直接用默认实例，小程序/RN 传 baseUrl + token */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
  const token = options.token;
  const doFetch = options.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await doFetch(`${baseUrl}${path}`, { ...init, headers });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(data?.error ?? `请求失败（${res.status}）`);
    return data;
  }

  return {
    baseUrl,
    hasToken: Boolean(token),
    request,

    fetchSettings: () => request<PublicSettings>("/api/settings"),
    saveSettings: (payload) =>
      request("/api/settings", { method: "POST", body: JSON.stringify(payload) }),
    testSettings: (payload) =>
      request<TestResult>("/api/settings/test", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    fetchProgress: () => request<Progress>("/api/progress"),
    postProgress: (op) =>
      request<Progress>("/api/progress", {
        method: "POST",
        body: JSON.stringify(op),
      }),

    fetchNotebook: () => request<Notebook>("/api/notebook"),
    addWrongQuestion: (item) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "addWrong", item }),
      }),
    toggleFavorite: async (item) => {
      const res = await request<{ added?: boolean }>("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "addFavorite", item }),
      });
      return Boolean(res.added);
    },
    removeFavorite: (id) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "removeFavorite", id }),
      }),
    toggleResolved: (id) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "toggleResolved", id }),
      }),
    removeWrong: (id) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "removeWrong", id }),
      }),
    saveNote: (lessonId, lang, content) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "saveNote", lessonId, lang, content }),
      }),
    removeNote: (lessonId) =>
      request("/api/notebook", {
        method: "POST",
        body: JSON.stringify({ type: "removeNote", lessonId }),
      }),

    fetchChat: async (lessonId) => {
      const res = await request<{ messages?: ChatMessage[] }>(
        `/api/memory?lessonId=${encodeURIComponent(lessonId)}`
      );
      return ((res.messages ?? []) as ChatMessage[])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          reasoning: m.reasoning,
        }));
    },
    saveChatMemory: (lessonId, messages) =>
      request("/api/memory", {
        method: "POST",
        body: JSON.stringify({ type: "save", lessonId, messages }),
      }),
    clearChatMemory: (lessonId) =>
      request("/api/memory", {
        method: "POST",
        body: JSON.stringify({ type: "clear", lessonId }),
      }),

    fetchUsage: () => request<UsageInfo>("/api/me/usage"),

    streamAi: async (body, handlers) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await doFetch(`${baseUrl}/api/ai`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `请求失败（${res.status}）`;
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch {
          /* 非 JSON */
        }
        throw new Error(msg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let content = "";
      let reasoning = "";

      const handleEvent = (raw: string) => {
        const data = raw
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("");
        const trimmed = data.trim();
        if (!trimmed || trimmed === "[DONE]") return;
        try {
          const ev = JSON.parse(trimmed) as { type: string; text: string };
          if (ev.type === "content" && ev.text) {
            content += ev.text;
            handlers.onContent?.(ev.text);
          } else if (ev.type === "reasoning" && ev.text) {
            reasoning += ev.text;
            handlers.onReasoning?.(ev.text);
          }
        } catch {
          /* 忽略无法解析的事件 */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const ev = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          handleEvent(ev);
        }
      }
      if (buf.trim()) handleEvent(buf);
      return { content, reasoning };
    },

    aiJson: <T,>(body: Record<string, unknown>) =>
      request<T>("/api/ai", { method: "POST", body: JSON.stringify(body) }),

    fetchLeetCodeProblems: (body) =>
      request("/api/leetcode", { method: "POST", body: JSON.stringify(body) }),
    fetchHackerRankProblems: (body) =>
      request("/api/hackerrank", { method: "POST", body: JSON.stringify(body) }),
    fetchModels: () => request<{ models: string[]; source?: string }>("/api/models"),

    speak: async (text: string, lang?: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await doFetch(`${baseUrl}/api/tts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error("语音合成失败");
      return res.blob();
    },
  };
}

/** Web 端默认客户端（同源 + Cookie 会话） */
export const api = createApiClient();

/** ---- Web 端便捷函数（内部复用 api 实例） ---- */
export const fetchSettings = () => api.fetchSettings();
export const saveSettings = (p: SaveSettingsPayload) => api.saveSettings(p);
export const testSettings = (p: SaveSettingsPayload & { persist?: boolean }) =>
  api.testSettings(p);
export const fetchProgress = () => api.fetchProgress();

/** 取某语言某课的门槛状态（未解锁/未达标返回 undefined） */
export function gateOf(
  progress: Progress | null,
  lang: string,
  lessonId: string
): LessonGate | undefined {
  return progress?.gates?.[lang]?.[lessonId];
}

/** 该课是否已解锁（无 gates 数据时视为解锁，兼容旧数据） */
export function isLessonUnlocked(
  progress: Progress | null,
  lang: string,
  lessonId: string
): boolean {
  const g = gateOf(progress, lang, lessonId);
  if (!g) return true; // 尚未加载 gates 时不阻断
  return g.unlocked;
}
export const postProgress = (op: ProgressOp) => api.postProgress(op);
export const fetchNotebook = () => api.fetchNotebook();
export const addWrongQuestion = (item: WrongQuestionInput) =>
  api.addWrongQuestion(item);
export const toggleFavorite = (item: FavoriteInput) => api.toggleFavorite(item);
export const removeFavorite = (id: string) => api.removeFavorite(id);
export const toggleResolved = (id: string) => api.toggleResolved(id);
export const removeWrong = (id: string) => api.removeWrong(id);
export const saveNote = (lessonId: string, lang: string, content: string) =>
  api.saveNote(lessonId, lang, content);
export const removeNote = (lessonId: string) => api.removeNote(lessonId);
export const fetchChat = (lessonId: string) => api.fetchChat(lessonId);
export const saveChatMemory = (lessonId: string, messages: ChatMessage[]) =>
  api.saveChatMemory(lessonId, messages);
export const clearChatMemory = (lessonId: string) => api.clearChatMemory(lessonId);
export const streamAi = (
  body: Record<string, unknown>,
  handlers: StreamHandlers
) => api.streamAi(body, handlers);
export const aiJson = <T,>(body: Record<string, unknown>) => api.aiJson<T>(body);
export const fetchLeetCodeProblems = (body: {
  tags?: string[];
  search?: string;
  difficulty?: string;
  limit?: number;
}) => api.fetchLeetCodeProblems(body);
export const fetchHackerRankProblems = (body: {
  track: string;
  search?: string;
  limit?: number;
}) => api.fetchHackerRankProblems(body);

/** 课程语言 → HackerRank track（无对应为 undefined） */
export const HR_TRACKS: Record<string, string> = {
  python: "python",
  java: "java",
  javascript: "algorithms",
  typescript: "algorithms",
  linux: "shell",
};

/** 该语言可用的题库源 */
export function availableBanks(lang: string): BankSource[] {
  const banks: BankSource[] = [];
  if (LC_LANGS.has(lang)) banks.push("leetcode");
  if (HR_TRACKS[lang]) banks.push("hackerrank");
  return banks;
}

/** 课程知识点 → LeetCode topic 标签（仅 LC 支持的语言才带语言标签） */
export function lessonToLcTags(lang: string, title: string, summary: string): string[] {
  const text = title + summary;
  const map: Array<[RegExp, string]> = [
    [/数组|列表|list|array/i, "array"],
    [/字符串|string/i, "string"],
    [/字典|哈希|映射|dict|hash|集合/i, "hash-table"],
    [/链表|linked/i, "linked-list"],
    [/栈|stack/i, "stack"],
    [/队列|queue/i, "queue"],
    [/树|tree/i, "tree"],
    [/排序|sort/i, "sorting"],
    [/二分|binary/i, "binary-search"],
    [/递归|recursion/i, "recursion"],
    [/动态规划/i, "dynamic-programming"],
    [/贪心/i, "greedy"],
    [/对象|类|面向对象|design/i, "design"],
    [/正则|regex/i, "regex"],
  ];
  const tags = new Set<string>();
  if (LC_LANGS.has(lang)) tags.add(lang);
  for (const [re, tag] of map) {
    if (re.test(text)) tags.add(tag);
  }
  return [...tags];
}
