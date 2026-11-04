import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/store";
import { testConnection } from "@/lib/ai/provider";
import type { ProviderId } from "@/lib/types";

/**
 * 测试 AI 连通性（管理员）：支持直接带上未保存的表单配置来测试。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      provider?: ProviderId;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      temperature?: number;
      persist?: boolean;
    };

    const saved = await getSettings();
    const candidate = {
      provider: body.provider ?? saved.provider,
      apiKey: body.apiKey?.trim() ? body.apiKey.trim() : saved.apiKey,
      baseUrl: body.provider === "custom" ? body.baseUrl?.trim() ?? saved.baseUrl : saved.baseUrl,
      model: body.model?.trim() || saved.model,
      temperature: body.temperature ?? saved.temperature,
    };

    if (!candidate.apiKey) {
      return NextResponse.json(
        { ok: false, error: "请先填写 API Key" },
        { status: 400 }
      );
    }

    // 测试成功后再落盘，避免把无效配置存进去
    const result = await testConnection(candidate);
    if (body.persist) await saveSettings(candidate);
    return NextResponse.json({ ...result, provider: candidate.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
