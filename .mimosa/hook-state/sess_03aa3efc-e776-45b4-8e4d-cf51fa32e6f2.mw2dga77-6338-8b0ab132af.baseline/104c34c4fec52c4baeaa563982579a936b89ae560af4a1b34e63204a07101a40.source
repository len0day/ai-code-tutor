"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProgress, gateOf, isLessonUnlocked } from "@/lib/client";
import type { LessonGate, Progress } from "@/lib/types";
import { PASS_SCORE } from "@/lib/gateConstants";

interface Props {
  lang: string;
  lessonId: string;
  /** 渲染期间由页面提供的进度（避免重复请求） */
  progress?: Progress | null;
}

/**
 * 闯关守卫：未解锁的课程进入「预览模式」——
 * 静态内容（知识点/例句/笔记）可看，AI 功能（深入讲解/测验/面试）不可用。
 */
export default function LessonGateGuard({
  lang,
  lessonId,
  progress,
}: Props) {
  const [p, setP] = useState<Progress | null>(progress ?? null);
  const [loading, setLoading] = useState(!progress);

  useEffect(() => {
    let alive = true;
    const apply = (d: Progress | null) => {
      if (!alive) return;
      // 微任务中更新，避免 effect 内同步 setState
      Promise.resolve().then(() => {
        if (!alive) return;
        setP(d);
        setLoading(false);
      });
    };
    if (progress) {
      apply(progress);
      return;
    }
    fetchProgress().then(apply).catch(() => apply(null));
    return () => {
      alive = false;
    };
  }, [progress, lessonId]);

  if (loading) {
    return (
      <p className="text-center text-slate-400 py-10 text-sm">正在检查课程解锁状态…</p>
    );
  }

  const gate = gateOf(p, lang, lessonId);
  const unlocked = isLessonUnlocked(p, lang, lessonId);
  if (unlocked) return null;

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden="true">
          🔒
        </span>
        <div className="flex-1">
          <div className="font-bold text-amber-800 dark:text-amber-300">
            本课尚未解锁 —— 当前为预览模式
          </div>
          <p className="text-sm text-amber-700/90 dark:text-amber-200/80 mt-1 leading-relaxed">
            需要先通过上一节课的「练习测验」与「模拟面试 / 场景对话」（均需 {PASS_SCORE} 分以上）才能解锁本节的 AI 功能。
            你可以先浏览下面的知识点与例句预习。
          </p>
          {gate && (
            <p className="text-xs text-amber-600/90 mt-2">
              本课当前成绩：测验 {gate.quizScore} 分 · 面试/场景 {gate.interviewScore} 分
            </p>
          )}
          <Link
            href={`/learn/${lang}`}
            className="inline-block mt-3 text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline"
          >
            ← 返回课程大纲，先通过上一课
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 通关状态徽章（测验/面试双达标） */
export function GateBadge({ gate }: { gate?: LessonGate }) {
  if (!gate) return null;
  const bothPassed = gate.quizPassed && gate.interviewPassed;
  return (
    <span
      title={`测验 ${gate.quizScore} 分 · 面试/场景 ${gate.interviewScore} 分`}
      className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
        bothPassed
          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
          : "bg-slate-50 text-slate-500 border-slate-200"
      }`}
    >
      {bothPassed
        ? "✓ 已通关"
        : `${gate.quizPassed ? "测验✓" : "测验✗"} ${gate.interviewPassed ? "面试✓" : "面试✗"}`}
    </span>
  );
}
