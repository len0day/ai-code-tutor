import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getQuotaConfig, setQuotaConfig } from "@/lib/store";

/** 配额设置（管理员）：普通用户每日 AI 交互次数与可学课程数 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  return NextResponse.json(await getQuotaConfig());
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { aiDailyLimit?: number; courseLimit?: number };
    const clamp = (v: unknown, max: number) =>
      Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const next = await setQuotaConfig({
      aiDailyLimit:
        body.aiDailyLimit !== undefined ? clamp(body.aiDailyLimit, 10000) : undefined,
      courseLimit:
        body.courseLimit !== undefined ? clamp(body.courseLimit, 8) : undefined,
    });
    return NextResponse.json({ ok: true, ...next });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
