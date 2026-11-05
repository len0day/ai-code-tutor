"use client";

import Link from "next/link";
import { useMemo } from "react";
import { flatLessons } from "@/data/courses";
import { gateOf } from "@/lib/client";
import type { Progress } from "@/lib/types";

/**
 * 课程目录树（章节 → 小节）：书架翻开的目录页 / 课程大纲页共用。
 * ✓ 已通关 / 🔒 未解锁 / 当前页高亮。
 * 课程学习页的全屏书本见 BookStage。
 */
export function ChapterTree({
  lang,
  lessonId,
  progress,
  flat,
}: {
  lang: string;
  lessonId: string;
  progress: Progress | null;
  flat: Array<{
    lesson: { id: string; title: string };
    level: { id: string; name: string };
  }>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { name: string; lessons: Array<{ id: string; title: string }> }
    >();
    for (const item of flat) {
      if (!map.has(item.level.id)) {
        map.set(item.level.id, { name: item.level.name, lessons: [] });
      }
      map.get(item.level.id)!.lessons.push(item.lesson);
    }
    return Array.from(map.entries());
  }, [flat]);

  const cnNum = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  return (
    <nav
      aria-label="本书目录"
      className="space-y-3 max-h-[420px] lg:max-h-[470px] overflow-y-auto pr-1"
    >
      {grouped.map(([levelId, group], gi) => (
        <div key={levelId}>
          <div className="serif-title text-xs font-semibold text-amber-900/70 dark:text-amber-200/70 mb-1 tracking-wider">
            第{cnNum[gi] ?? levelId}章 · {group.name}
          </div>
          <ul className="space-y-0.5">
            {group.lessons.map((lesson, li) => {
              const current = lesson.id === lessonId;
              const gate = gateOf(progress, lang, lesson.id);
              const locked = gate ? !gate.unlocked : false;
              const passed = gate?.passed ?? false;
              return (
                <li key={lesson.id}>
                  <Link
                    href={
                      lang === "japanese"
                        ? `/languages/${lang}/${lesson.id}`
                        : `/learn/${lang}/${lesson.id}`
                    }
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      current
                        ? "bg-rose-600/90 text-white font-medium"
                        : "text-slate-600 hover:bg-amber-900/10 dark:text-slate-300 dark:hover:bg-amber-100/10"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold ${
                        passed
                          ? "bg-emerald-600 text-white"
                          : current
                            ? "bg-white/40"
                            : locked
                              ? "bg-slate-400/40"
                              : "bg-rose-100 text-rose-600"
                      }`}
                      aria-hidden="true"
                    >
                      {passed ? "✓" : locked ? "🔒" : li + 1}
                    </span>
                    <span className="truncate">{lesson.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
