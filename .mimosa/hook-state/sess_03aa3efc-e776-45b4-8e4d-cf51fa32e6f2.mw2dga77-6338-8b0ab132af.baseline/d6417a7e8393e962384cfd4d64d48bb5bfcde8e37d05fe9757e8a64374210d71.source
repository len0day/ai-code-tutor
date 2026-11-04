import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cacheStats, cacheClear } from "@/lib/cache";

/** 内容缓存管理（管理员）：GET 统计 / DELETE 清空 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  return NextResponse.json(await cacheStats());
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  await cacheClear();
  return NextResponse.json({ ok: true, ...(await cacheStats()) });
}
