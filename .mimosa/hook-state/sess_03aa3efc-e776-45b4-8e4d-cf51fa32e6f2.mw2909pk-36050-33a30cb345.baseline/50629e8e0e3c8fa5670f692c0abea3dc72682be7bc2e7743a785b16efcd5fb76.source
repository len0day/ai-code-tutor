import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, saveSettings, maskKey } from "@/lib/store";
import { PROVIDER_PRESETS } from "@/lib/ai/presets";
import type { Settings } from "@/lib/types";

/** AI 全局配置属于管理员，全体用户共享 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const guard = await requireAdmin();
  const s = await getSettings();
  // 管理员：完整配置（Key 掩码）；普通用户：仅返回是否已配置等基础信息
  if (guard.error) {
    const me = await getCurrentUser();
    if (!me) return guard.error;
    return NextResponse.json({
      provider: s.provider,
      configured: Boolean(s.apiKey),
      restricted: true,
    });
  }
  return NextResponse.json({
    provider: s.provider,
    apiKeyMasked: maskKey(s.apiKey),
    baseUrl: s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    configured: Boolean(s.apiKey),
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  try {
    const body = (await req.json()) as Partial<Settings> & { apiKey?: string };
    const preset = PROVIDER_PRESETS[body.provider ?? "glm"];

    const patch: Partial<Settings> = {};
    if (body.provider && body.provider in PROVIDER_PRESETS) patch.provider = body.provider;
    // apiKey 为空字符串/undefined = 保留旧 Key
    if (typeof body.apiKey === "string" && body.apiKey.trim()) {
      patch.apiKey = body.apiKey.trim();
    }
    if (body.provider === "custom") {
      patch.baseUrl = body.baseUrl?.trim() ?? "";
    }
    patch.model = typeof body.model === "string" ? body.model.trim() : preset.defaultModel;
    if (typeof body.temperature === "number") {
      patch.temperature = Math.min(1, Math.max(0, body.temperature));
    }

    await saveSettings(patch);
    const s = await getSettings();
    return NextResponse.json({ ok: true, apiKeyMasked: maskKey(s.apiKey) });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
