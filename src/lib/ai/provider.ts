import "server-only";
import { PROVIDER_PRESETS } from "./presets";
import type { ChatMessage, Settings } from "../types";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** true = 服务商未返回 usage，按字符数估算 */
  estimated: boolean;
}

export interface ChatResult {
  text: string;
  usage: TokenUsage;
  model: string;
}

export interface AiError extends Error {
  status?: number;
}

export function aiError(message: string, status?: number): AiError {
  const e = new Error(message) as AiError;
  e.status = status;
  return e;
}

/** 校验配置是否可用，返回完整端点信息 */
export function resolveEndpoint(settings: Settings): {
  url: string;
  model: string;
  apiKey: string;
} {
  const preset = PROVIDER_PRESETS[settings.provider];
  if (!preset) throw aiError("未知的 AI 服务商");
  if (!settings.apiKey) {
    throw aiError("尚未配置 API Key，请前往「设置」页填写", 400);
  }

  let url: string;
  if (settings.provider === "custom") {
    const base = settings.baseUrl?.trim();
    if (!base) throw aiError("自定义服务需要填写 Base URL", 400);
    if (!settings.model) throw aiError("自定义服务需要填写模型名", 400);
    url = joinUrl(base, "/chat/completions");
  } else {
    url = preset.baseUrl + preset.chatPath;
  }

  const model = settings.model || preset.defaultModel;
  if (!model) throw aiError("未配置模型名", 400);
  return { url, model, apiKey: settings.apiKey };
}

/**
 * 宽容的 URL 拼接：
 * - 已以 /chat/completions 结尾 → 原样
 * - 以 /v1 /v4 等版本段结尾 → 直接追加 /chat/completions
 * - 其余 → 补全 /v1/chat/completions
 */
function joinUrl(base: string, suffix: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith(suffix)) return trimmed;
  if (/\/v\d+(beta)?$/i.test(trimmed)) return trimmed + suffix;
  return `${trimmed}/v1${suffix}`;
}

/** 请求体（OpenAI 格式，MiniMax chatcompletion_v2 亦兼容） */
function buildBody(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  stream: boolean
) {
  return JSON.stringify({
    model,
    messages,
    temperature,
    stream,
  });
}

async function assertOk(res: Response) {
  if (res.ok) return;
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  throw aiError(
    `AI 服务返回 ${res.status}${detail ? `：${detail}` : ""}`,
    res.status
  );
}

/** MiniMax 可能在 200 响应体中返回业务错误（base_resp.status_code != 0） */
function checkMiniMaxError(obj: Record<string, unknown>) {
  const baseResp = obj?.base_resp as
    | { status_code?: number; status_msg?: string }
    | undefined;
  if (baseResp && typeof baseResp.status_code === "number" && baseResp.status_code !== 0) {
    throw aiError(`MiniMax 错误 ${baseResp.status_code}：${baseResp.status_msg ?? "未知错误"}`);
  }
}

interface ChoiceShape {
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
  };
  message?: {
    content?: string | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
  };
}

/** 提取一段响应里的正文与思考内容（GLM/DeepSeek 用 reasoning_content，部分模型内联 <think>） */
function extractParts(obj: Record<string, unknown>): {
  content: string;
  reasoning: string;
} {
  const choices = obj?.choices as ChoiceShape[] | undefined;
  const part = choices?.[0]?.delta ?? choices?.[0]?.message ?? {};
  return {
    content: part.content ?? "",
    reasoning: part.reasoning_content ?? part.reasoning ?? "",
  };
}

/** 去掉内联的 <think>…</think> 思考段（非流式响应用） */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*<think>[\s\S]*$/i, "") // 未闭合的也整段丢弃
    .trim();
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

/** buf 末尾与 tag 前缀重合的最长长度（跨 chunk 的标签安全切分） */
function partialTagSuffix(buf: string, tag: string): number {
  const max = Math.min(tag.length - 1, buf.length);
  for (let len = max; len > 0; len--) {
    if (buf.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

/**
 * 把流式正文中的 <think>…</think> 实时拆分为思考/正文两路，
 * 正确处理标签被网络分块截断的情况。
 */
export class ThinkSplitter {
  private buf = "";
  private inThink = false;

  push(delta: string): { reasoning: string; content: string } {
    this.buf += delta;
    let reasoning = "";
    let content = "";

    while (this.buf) {
      if (this.inThink) {
        const idx = this.buf.indexOf(THINK_CLOSE);
        if (idx !== -1) {
          reasoning += this.buf.slice(0, idx);
          this.buf = this.buf.slice(idx + THINK_CLOSE.length);
          this.inThink = false;
          continue;
        }
        const hold = partialTagSuffix(this.buf, THINK_CLOSE);
        if (hold < this.buf.length) {
          reasoning += this.buf.slice(0, this.buf.length - hold);
          this.buf = this.buf.slice(this.buf.length - hold);
        }
        break; // 其余等待更多数据
      }

      const idx = this.buf.indexOf(THINK_OPEN);
      if (idx !== -1) {
        content += this.buf.slice(0, idx);
        this.buf = this.buf.slice(idx + THINK_OPEN.length);
        this.inThink = true;
        continue;
      }
      const hold = partialTagSuffix(this.buf, THINK_OPEN);
      if (hold < this.buf.length) {
        content += this.buf.slice(0, this.buf.length - hold);
        this.buf = this.buf.slice(this.buf.length - hold);
      }
      break;
    }
    return { reasoning, content };
  }

  /** 流结束时冲刷残留缓冲 */
  flush(): { reasoning: string; content: string } {
    const out = this.inThink
      ? { reasoning: this.buf, content: "" }
      : { reasoning: "", content: this.buf };
    this.buf = "";
    return out;
  }
}

/** 估算 token：CJK 字符约 1 token/字，其他按 4 字符/token */
export function estimateTokens(text: string): number {
  let cjk = 0;
  for (const ch of text) {
    if (ch >= "\u3000" && ch <= "\u9fff") cjk++;
    else if (ch >= "\uff00" && ch <= "\uffef") cjk++;
  }
  const other = text.length - cjk;
  return cjk + Math.ceil(other / 4);
}

/** 从 OpenAI 兼容响应中提取 usage 字段 */
function extractUsage(obj: Record<string, unknown>): { p: number; c: number; t: number } | null {
  const u = obj?.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;
  if (!u || typeof u.total_tokens !== "number") return null;
  const p = u.prompt_tokens ?? 0;
  const c = u.completion_tokens ?? 0;
  return { p, c, t: u.total_tokens ?? p + c };
}

function buildUsage(
  collected: { p: number; c: number; t: number } | null,
  promptText: string,
  completionText: string
): TokenUsage {
  if (collected && collected.t > 0) {
    return {
      promptTokens: collected.p,
      completionTokens: collected.c,
      totalTokens: collected.t,
      estimated: false,
    };
  }
  const p = estimateTokens(promptText);
  const c = estimateTokens(completionText);
  return { promptTokens: p, completionTokens: c, totalTokens: p + c, estimated: true };
}

function promptTextOf(messages: ChatMessage[]): string {
  return messages.map((m) => m.content).join("\n");
}

/**
 * 调用聊天补全。传 onDelta 则走 SSE 流式：回调参数为
 * (正文增量, 思考增量)，二者都可能为空串；不传则等待完整正文返回。
 * 返回值含 token 用量（优先取服务商 usage，缺失时估算）。
 */
export async function chatComplete(
  settings: Settings,
  messages: ChatMessage[],
  onDelta?: (content: string, reasoning: string) => void,
  temperatureOverride?: number
): Promise<ChatResult> {
  const { url, model, apiKey } = resolveEndpoint(settings);
  const stream = Boolean(onDelta);
  const temperature = temperatureOverride ?? settings.temperature ?? 0.7;
  const prompt = promptTextOf(messages);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildBody(model, messages, temperature, stream),
  });
  await assertOk(res);

  if (!stream) {
    const data = (await res.json()) as Record<string, unknown>;
    checkMiniMaxError(data);
    const usageRaw = extractUsage(data);
    const text = stripThink(extractParts(data).content);
    if (!text) {
      throw aiError("AI 服务返回了空响应，请检查模型名是否正确");
    }
    return {
      text,
      usage: buildUsage(usageRaw, prompt, text),
      model,
    };
  }

  // ---- SSE 流式解析 ----
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const splitter = new ThinkSplitter();
  let buffer = "";
  let fullContent = "";
  let fullReasoning = "";
  let usageRaw: { p: number; c: number; t: number } | null = null;

  const emit = (content: string, reasoning: string) => {
    if (!content && !reasoning) return;
    fullContent += content;
    fullReasoning += reasoning;
    onDelta!(content, reasoning);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 SSE 事件切分（兼容 \n\n 与 \r\n\r\n）
    let sep: string | undefined;
    while (
      (sep = ["\n\n", "\r\n\r\n"].find((s) => buffer.includes(s))) !== undefined
    ) {
      const idx = buffer.indexOf(sep);
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sep.length);

      for (const line of rawEvent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as Record<string, unknown>;
          checkMiniMaxError(obj);
          const frameUsage = extractUsage(obj);
          if (frameUsage) usageRaw = frameUsage; // 通常在最后一帧
          const parts = extractParts(obj);
          const split = splitter.push(parts.content);
          emit(split.content, parts.reasoning + split.reasoning);
        } catch {
          // 忽略无法解析的行（如注释、心跳）
        }
      }
    }
  }

  const tail = splitter.flush();
  emit(tail.content, tail.reasoning);

  if (!fullContent) {
    throw aiError(
      fullReasoning
        ? "AI 只返回了思考内容没有正文，请重试或更换模型"
        : "AI 服务未返回任何内容，请检查模型名与 Key 是否匹配"
    );
  }
  return {
    text: fullContent,
    usage: buildUsage(usageRaw, prompt, fullContent),
    model,
  };
}

/** 快速连通性测试：发一条极短请求 */
export async function testConnection(settings: Settings): Promise<{ ok: true; model: string; reply: string }> {
  const { text, model } = await chatComplete(
    settings,
    [{ role: "user", content: "回复「连接成功」四个字" }],
    undefined
  );
  return { ok: true, model, reply: text };
}
