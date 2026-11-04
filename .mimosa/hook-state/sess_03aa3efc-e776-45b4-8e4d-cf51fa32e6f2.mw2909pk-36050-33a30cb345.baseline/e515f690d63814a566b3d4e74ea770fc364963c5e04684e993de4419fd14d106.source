import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getQuotaConfig,
  getAiUsageToday,
  getUnlockedCourses,
  getProgress,
  getSettings,
  getTokenTotals,
} from "@/lib/store";
import { COURSES } from "@/data/courses";

/** 当前用户设置页数据：账号信息 + 配额用量（普通用户/管理员通用） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const quota = await getQuotaConfig();
  const isAdmin = user.role === "admin";
  const progress = await getProgress(user.id);
  const configured = Boolean((await getSettings()).apiKey);
  const tokens = await getTokenTotals(user.id);
  const tokensToday = await getTokenTotals(
    user.id,
    new Date(Date.now() - 86400_000).toISOString()
  );

  return NextResponse.json({
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    configured,
    // 普通用户受配额限制；管理员无限制（返回 -1 表示不限）
    aiUsed: await getAiUsageToday(user.id),
    aiLimit: isAdmin ? -1 : quota.aiDailyLimit,
    unlocked: isAdmin ? COURSES.map((c) => c.lang) : await getUnlockedCourses(user.id),
    courseLimit: isAdmin ? -1 : quota.courseLimit,
    totalCourses: COURSES.length,
    xp: progress.xp,
    completedLessons: Object.values(progress.lessons).filter((l) => l.completed).length,
    streak: progress.streak,
    tokens: {
      total: tokens.totalTokens,
      prompt: tokens.promptTokens,
      completion: tokens.completionTokens,
      calls: tokens.calls,
      today: tokensToday.totalTokens,
      estimated: tokens.estimatedCalls > 0,
    },
  });
}
