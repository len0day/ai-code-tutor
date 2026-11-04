import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/store";
import { PROVIDER_PRESETS } from "@/lib/ai/presets";

/**
 * 自动获取可用模型列表。
 * 安全约束：目标主机必须命中内置白名单（内置服务商）或用户自定义 baseUrl 的主机，
 * 且仅使用 http/https；路径固定由服务端拼接，用户不可控。
 */

/** 内置服务商的模型列表端点（主机白名单） */
const BUILTIN_MODEL_ENDPOINTS: Record<string, string> = {
  glm: "https://open.bigmodel.cn/api/paas/v4/models",
  minimax: "https://api.minimax.chat/v1/models",
};

/** 允许用于自定义服务的公网主机后缀（防内网/环回探测） */
const ALLOWED_CUSTOM_HOST_SUFFIXES = [".com", ".cn", ".io", ".ai", ".net", ".org", ".dev", ".cloud"];

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  // IPv4 私有段
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function isAllowedHost(hostname: string): boolean {
  if (isPrivateHost(hostname)) return false;
  const h = hostname.toLowerCase();
  if (h === "open.bigmodel.cn" || h === "api.minimax.chat") return true;
  return ALLOWED_CUSTOM_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

/** 自定义 baseUrl → 模型列表端点（补全 /v1 与 /models） */
function customModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/models")) return trimmed;
  if (/\/v\d+(beta)?$/i.test(trimmed)) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const settings = await getSettings();
  const preset = PROVIDER_PRESETS[settings.provider];

  let url: string;
  if (settings.provider === "custom") {
    const base = settings.baseUrl?.trim();
    if (!base) {
      return NextResponse.json({ error: "自定义服务需要先填写 Base URL" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(base);
    } catch {
      return NextResponse.json({ error: "Base URL 格式不正确" }, { status: 400 });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "仅支持 http/https 协议" }, { status: 400 });
    }
    if (!isAllowedHost(parsed.hostname)) {
      return NextResponse.json(
        { error: "该主机不允许查询模型列表（仅支持公网域名）" },
        { status: 400 }
      );
    }
    url = customModelsUrl(base);
  } else {
    url = BUILTIN_MODEL_ENDPOINTS[settings.provider];
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();

    if (!res.ok) {
      let msg = `服务返回 ${res.status}`;
      try {
        const err = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
        const em =
          typeof err.error === "string" ? err.error : err.error?.message ?? err.message;
        if (em) msg = em;
      } catch {
        /* 非 JSON 错误体 */
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let ids: string[] = [];
    try {
      const data = JSON.parse(text) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string; model_id?: string }> };
      if (Array.isArray(data.data)) {
        ids = data.data.map((m) => m.id).filter((x): x is string => Boolean(x));
      } else if (Array.isArray(data.models)) {
        ids = data.models
          .map((m) => m.id ?? m.model_id)
          .filter((x): x is string => Boolean(x));
      }
    } catch {
      /* 非预期格式 */
    }

    if (ids.length === 0) {
      // 退回：内置预设模型
      return NextResponse.json({
        models: preset.models,
        source: "preset",
        message: "服务商未返回模型列表，以下为内置推荐",
      });
    }

    return NextResponse.json({
      models: ids.sort(),
      source: "api",
      count: ids.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `获取模型列表失败（${err instanceof Error ? err.message : "未知错误"}）` },
      { status: 502 }
    );
  }
}
