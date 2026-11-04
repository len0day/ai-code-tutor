import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureCourseUnlock,
  getProgress,
  getQuotaConfig,
  saveProgress,
  touchStreak,
} from "@/lib/store";
import { computeGates, recordGateResult } from "@/lib/gates";
import { LANG_IDS } from "@/data/courses";
import type { LessonProgress, Progress } from "@/lib/types";

// 学习进度属于当前登录用户
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const progress = await getProgress(user.id);
  // 全部语言的门槛状态
  const gates: Record<string, unknown> = {};
  for (const lang of LANG_IDS) {
    gates[lang] = await computeGates(user.id, lang);
  }
  return NextResponse.json({ ...progress, gates });
}

type Ops =
  | { type: "visit"; lessonId: string }
  | { type: "quizResult"; lessonId: string; score: number; wrongIds?: string[] }
  | { type: "interviewResult"; lessonId: string; score: number }
  | { type: "reset" };

// XP 由门槛系统统一发放（见 lib/gates.ts），此处不再单独计分

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let op: Ops;
  try {
    op = (await req.json()) as Ops;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (op.type === "reset") {
    await saveProgress(user.id, { lessons: {}, xp: 0, streak: 0 });
    return NextResponse.json(await getProgress(user.id));
  }

  // 课程解锁：普通用户受课程数配额限制（首次进入自动占用名额）
  const lang = LANG_IDS.find((l) => op.lessonId.startsWith(`${l}-`));
  if (lang) {
    const limit =
      user.role === "admin" ? Number.MAX_SAFE_INTEGER : (await getQuotaConfig()).courseLimit;
    const unlock = await ensureCourseUnlock(user.id, lang, limit);
    if (!unlock.ok) {
      return NextResponse.json(
        {
          error: `学习课程数已达上限（${unlock.limit} 门）。可在「设置」查看已解锁课程，联系管理员扩容。`,
          courseLimitReached: true,
        },
        { status: 403 }
      );
    }
  }

  const p: Progress = touchStreak(await getProgress(user.id));
  const lp: LessonProgress = (p.lessons[op.lessonId] ??= {
    completed: false,
    quizScores: [],
    wrongQuestionIds: [],
  });

  switch (op.type) {
    case "visit":
      lp.visitedAt = new Date().toISOString();
      break;
    case "quizResult": {
      lp.quizScores.push(op.score);
      if (op.wrongIds?.length) {
        lp.wrongQuestionIds = Array.from(new Set([...lp.wrongQuestionIds, ...op.wrongIds]));
      }
      // XP 与「自动完成」仅由达标触发（不可手动标记）
      const gate = await recordGateResult(user.id, op.lessonId, "quiz", op.score);
      p.xp += gate.xpGained;
      if (gate.newlyPassed) {
        lp.completed = true;
        lp.completedAt = new Date().toISOString();
      }
      break;
    }
    case "interviewResult": {
      lp.interviewScores ??= [];
      lp.interviewScores.push(op.score);
      const gate = await recordGateResult(user.id, op.lessonId, "interview", op.score);
      p.xp += gate.xpGained;
      if (gate.newlyPassed) {
        lp.completed = true;
        lp.completedAt = new Date().toISOString();
      }
      break;
    }
    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  await saveProgress(user.id, p);
  const gates: Record<string, unknown> = {};
  for (const lang of LANG_IDS) {
    gates[lang] = await computeGates(user.id, lang);
  }
  return NextResponse.json({ ...p, gates });
}
