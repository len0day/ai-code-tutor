import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getRecentTokenUsage,
  getTokenByTask,
  getTokenByUser,
  getTokenTotals,
} from "@/lib/store";

/** Token 用量统计（管理员）：总量 / 近 7 天 / 按任务 / 按用户 / 最近明细 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  return NextResponse.json({
    total: await getTokenTotals(),
    last7Days: await getTokenTotals(undefined, weekAgo),
    today: await getTokenTotals(undefined, dayAgo),
    byTask: await getTokenByTask(),
    byUser: await getTokenByUser(),
    recent: await getRecentTokenUsage(20),
  });
}
