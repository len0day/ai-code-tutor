import "server-only";
import { getDb } from "./db";
import { getProgress } from "./store";
import { flatLessons } from "@/data/courses";
import { PASS_SCORE } from "./gateConstants";

/**
 * 闯关门槛：每节课需通过「练习测验」+「模拟面试 / 场景模拟」双项，
 * 才算通关并解锁下一节课。未解锁的课程可预览静态内容，但 AI 功能不可用。
 */

export { PASS_SCORE };

/** XP 奖励规则：测验首次达标 / 面试首次达标 / 双达标通关 */
export const XP_QUIZ_PASS = 15;
export const XP_INTERVIEW_PASS = 20;
export const XP_LESSON_CLEAR = 10;

export interface LessonGate {
  lessonId: string;
  /** 测验是否已达标（存在 ≥60 的成绩） */
  quizPassed: boolean;
  /** 面试 / 场景对话是否已达标 */
  interviewPassed: boolean;
  /** 本课是否通关（两项都达标） */
  passed: boolean;
  /** 本课是否已解锁（首课默认解锁；其余需上一课通关） */
  unlocked: boolean;
  /** 历史最高测验分 */
  quizScore: number;
  /** 历史最高面试/场景分 */
  interviewScore: number;
  /** 测验尝试次数 */
  quizAttempts: number;
  /** 面试/场景尝试次数 */
  interviewAttempts: number;
}

export interface GateMap {
  [lessonId: string]: LessonGate;
}

interface GateRow {
  lesson_id: string;
  quiz_passed: number;
  interview_passed: number;
  quiz_score: number;
  interview_score: number;
  attempts: number;
}

export interface GateResult {
  /** 本次实际发放的 XP（重复达标为 0） */
  xpGained: number;
  /** 本次是否首次双项达标（触发通关） */
  newlyPassed: boolean;
  /** 是否首次达到该单项的及格线 */
  firstPass: boolean;
}

/**
 * 计算某语言下全部课次的门槛状态。
 * 规则：
 *  - 该语言第一课默认解锁
 *  - 其余课次：上一课 passed → 解锁
 *  - passed = 测验达标 且 面试/场景达标
 */
export async function computeGates(userId: string, lang: string): Promise<GateMap> {
  const rows = await (await getDb()).all<GateRow>(
    `SELECT lesson_id, quiz_passed, interview_passed, quiz_score, interview_score, attempts
     FROM lesson_gates WHERE user_id = $userId`,
    { userId }
  );
  const rowMap = new Map(rows.map((r) => [r.lesson_id, r]));

  const progress = await getProgress(userId);
  const lessons = flatLessons(lang).map((x) => x.lesson);
  const gates: GateMap = {};

  let prevPassed = true; // 首课默认可解锁
  for (const lesson of lessons) {
    const row = rowMap.get(lesson.id);
    const lp = progress.lessons[lesson.id];

    // 以进度表里的历史成绩为准，gate 表只作为缓存与计数
    const quizScores = lp?.quizScores ?? [];
    const interviewScores = lp?.interviewScores ?? [];
    const quizScore = Math.max(0, ...quizScores, row?.quiz_score ?? 0);
    const interviewScore = Math.max(0, ...interviewScores, row?.interview_score ?? 0);
    const quizPassed = quizScore >= PASS_SCORE;
    const interviewPassed = interviewScore >= PASS_SCORE;
    const passed = quizPassed && interviewPassed;

    gates[lesson.id] = {
      lessonId: lesson.id,
      quizPassed,
      interviewPassed,
      passed,
      unlocked: prevPassed,
      quizScore,
      interviewScore,
      quizAttempts: quizScores.length,
      interviewAttempts: interviewScores.length,
    };

    // 下一课解锁取决于本课是否通关
    prevPassed = passed;
  }

  return gates;
}

/**
 * 记录一次成绩并刷新门槛状态。
 * XP 只在「首次达标」时发放，避免反复重考刷分。
 */
export async function recordGateResult(
  userId: string,
  lessonId: string,
  kind: "quiz" | "interview",
  score: number
): Promise<GateResult> {
  const db = await getDb();
  const existing = await db.get<{
    quiz_passed: number;
    interview_passed: number;
    quiz_score: number;
    interview_score: number;
    attempts: number;
  }>(
    `SELECT quiz_passed, interview_passed, quiz_score, interview_score, attempts
     FROM lesson_gates WHERE user_id = $userId AND lesson_id = $lessonId`,
    { userId, lessonId }
  );

  const oldQuizScore = existing?.quiz_score ?? 0;
  const oldInterviewScore = existing?.interview_score ?? 0;
  const wasPassed = Boolean(existing?.quiz_passed && existing?.interview_passed);

  const quizScore =
    kind === "quiz" ? Math.max(oldQuizScore, score) : oldQuizScore;
  const interviewScore =
    kind === "interview" ? Math.max(oldInterviewScore, score) : oldInterviewScore;
  const quizPassed = quizScore >= PASS_SCORE;
  const interviewPassed = interviewScore >= PASS_SCORE;
  const attempts = (existing?.attempts ?? 0) + 1;

  await db.run(
    `INSERT INTO lesson_gates
       (user_id, lesson_id, quiz_passed, interview_passed, quiz_score, interview_score, attempts, updated_at)
     VALUES ($userId, $lessonId, $quizPassed, $interviewPassed, $quizScore, $interviewScore, $attempts, $now)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       quiz_passed = excluded.quiz_passed,
       interview_passed = excluded.interview_passed,
       quiz_score = excluded.quiz_score,
       interview_score = excluded.interview_score,
       attempts = excluded.attempts,
       updated_at = excluded.updated_at`,
    {
      userId,
      lessonId,
      quizPassed: quizPassed ? 1 : 0,
      interviewPassed: interviewPassed ? 1 : 0,
      quizScore,
      interviewScore,
      attempts,
      now: new Date().toISOString(),
    }
  );

  // XP：仅首次达标发放
  let xpGained = 0;
  let firstPass = false;
  if (kind === "quiz" && oldQuizScore < PASS_SCORE && quizPassed) {
    xpGained += XP_QUIZ_PASS;
    firstPass = true;
  }
  if (kind === "interview" && oldInterviewScore < PASS_SCORE && interviewPassed) {
    xpGained += XP_INTERVIEW_PASS;
    firstPass = true;
  }
  const newlyPassed = quizPassed && interviewPassed && !wasPassed;
  if (newlyPassed) xpGained += XP_LESSON_CLEAR;

  return { xpGained, newlyPassed, firstPass };
}

/** 管理员：解除某课锁定（重置门槛） */
export async function resetGate(userId: string, lessonId: string): Promise<void> {
  await (await getDb()).run(
    "DELETE FROM lesson_gates WHERE user_id = $userId AND lesson_id = $lessonId",
    { userId, lessonId }
  );
}
