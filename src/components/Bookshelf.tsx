"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Course } from "@/lib/types";
import type { Progress } from "@/lib/types";
import { flatLessons } from "@/data/courses";
import { ChapterTree } from "@/components/BookReader";

/** 每门课程的书脊配色 */
const SPINE_COLORS: Record<string, [string, string]> = {
  python: ["#38bdf8", "#1d4ed8"],
  java: ["#fb923c", "#dc2626"],
  javascript: ["#fcd34d", "#ca8a04"],
  typescript: ["#60a5fa", "#4338ca"],
  html: ["#fb923c", "#e11d48"],
  docker: ["#38bdf8", "#0e7490"],
  linux: ["#cbd5e1", "#334155"],
  japanese: ["#fb7185", "#be185d"],
  go: ["#22d3ee", "#0369a1"],
  swift: ["#fb923c", "#dc2626"],
  nextjs: ["#d4d4d8", "#18181b"],
};

/** 书脊高度（略有高低，像真实的一排书） */
const HEIGHTS = [206, 228, 198, 216, 234, 202, 212, 222, 200, 214, 208];

export interface BookshelfProps {
  courses: Course[];
  progress: Progress | null;
  /** 达到课程数上限的课程（显示锁） */
  lockedLangs?: string[];
  /** 初始选中的课程 */
  defaultLang?: string | null;
}

/**
 * 书架：每门课程是一本书立在架子上。
 * 点击书脊 → 把书「从书架抽出」，在下方阅读台展开成「封面 + 目录」两页。
 */
export default function Bookshelf({
  courses,
  progress,
  lockedLangs = [],
  defaultLang = null,
}: BookshelfProps) {
  const [selected, setSelected] = useState<string | null>(defaultLang);

  const stats = useMemo(() => {
    const map: Record<
      string,
      { done: number; total: number; passed: number; nextId: string | null; pct: number }
    > = {};
    for (const c of courses) {
      const all = c.levels.flatMap((l) => l.lessons);
      const done = all.filter((l) => progress?.lessons[l.id]?.completed).length;
      const passed = all.filter(
        (l) => progress?.gates?.[c.lang]?.[l.id]?.passed
      ).length;
      const next = all.find((l) => !progress?.lessons[l.id]?.completed);
      map[c.lang] = {
        done,
        total: all.length,
        passed,
        nextId: next?.id ?? null,
        pct: all.length ? Math.round((done / all.length) * 100) : 0,
      };
    }
    return map;
  }, [courses, progress]);

  const current = courses.find((c) => c.lang === selected) ?? null;
  const currentStats = current ? stats[current.lang] : null;

  return (
    <div className="space-y-10">
      {/* ---------- 书架 ---------- */}
      <div className="bookshelf book-stage">
        <div className="shelf-inner">
          <div className="shelf-row" role="group" aria-label="课程书架">
          {courses.map((c, i) => {
            const s = stats[c.lang];
            const [from, to] = SPINE_COLORS[c.lang] ?? ["#a1a1aa", "#4b5563"];
            const locked = lockedLangs.includes(c.lang);
            const isOut = selected === c.lang;
            return (
              <div key={c.lang} className="contents">
                <button
                  onClick={() => setSelected(isOut ? null : c.lang)}
                  aria-pressed={isOut}
                  aria-label={`打开《${c.name}》`}
                  title={`《${c.name}》${locked ? "（已达课程数上限）" : ""}`}
                  className={`book-spine ${isOut ? "is-out" : ""} ${
                    locked ? "is-locked" : ""
                  }`}
                  style={
                    {
                      "--spine-h": `${HEIGHTS[i % HEIGHTS.length]}px`,
                      "--spine-from": from,
                      "--spine-to": to,
                    } as React.CSSProperties
                  }
                >
                  <span className="spine-emoji">{c.emoji}</span>
                  <span
                    className={`vertical-title spine-title ${
                      c.name.length > 6 ? "is-long" : ""
                    }`}
                  >
                    {c.name}
                  </span>
                  <span className="spine-meta">
                    {locked ? "🔒" : `${s.done}/${s.total}`}
                  </span>
                  <span className="spine-bar" aria-hidden="true">
                    <span className="spine-bar-fill" style={{ height: `${s.pct}%` }} />
                  </span>
                </button>
              </div>
            );
          })}
          </div>
          <div className="shelf-board" aria-hidden="true" />
        </div>
      </div>

      {/* ---------- 阅读台：抽出的那本书 + 目录 ---------- */}
      {current && currentStats && (
        <div className="reading-stand page-enter">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
            {/* 抽出的书（封面） */}
            <div className="shrink-0 book-take-out">
              <div
                className="book-cover w-52 h-72 sm:w-60 sm:h-80 flex flex-col justify-between p-5 pl-11"
                style={
                  {
                    "--cover-from": SPINE_COLORS[current.lang]?.[0] ?? "#a1a1aa",
                    "--cover-mid": SPINE_COLORS[current.lang]?.[1] ?? "#6b7280",
                    "--cover-to": SPINE_COLORS[current.lang]?.[1] ?? "#4b5563",
                  } as React.CSSProperties
                }
              >
                <div>
                  <div className="text-[10px] tracking-[0.3em] opacity-75">
                    {current.kind === "language" ? "LANGUAGE" : "PROGRAMMING"}
                  </div>
                  <div className="mt-6">
                    <div className="text-4xl">{current.emoji}</div>
                    <h3 className="serif-title text-2xl font-bold mt-2">
                      {current.name}
                    </h3>
                    <div className="hand-note text-xs mt-1">{current.tagline}</div>
                  </div>
                </div>
                <div>
                  <div className="h-1 bg-black/25 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-amber-200 to-amber-100 rounded-full transition-all duration-700"
                      style={{ width: `${currentStats.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] opacity-80">
                    <span>已读 {currentStats.pct}%</span>
                    <span>
                      {current.levels.length} 章 · {currentStats.total} 页
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 目录页 */}
            <div className="flex-1 w-full paper book-page rounded-r-xl rounded-l-sm p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-3 mb-4">
                <span className="serif-title text-sm tracking-widest text-amber-900/70 dark:text-amber-200/70">
                  目 录
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentStats.passed} 页已通关 · {currentStats.pct}%
                </span>
              </div>

              <ChapterTree
                lang={current.lang}
                lessonId=""
                progress={progress}
                flat={flatLessons(current.lang)}
              />

              <div className="border-t border-amber-900/15 dark:border-amber-100/10 pt-3 mt-4 flex justify-between items-center gap-3 flex-wrap">
                <span className="text-[11px] text-slate-400">
                  共 {currentStats.total} 页 · {currentStats.passed} 页已通关
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="hand-note text-sm text-slate-400 hover:text-rose-600"
                  >
                    放回书架
                  </button>
                  <Link
                    href={
                      currentStats.nextId
                        ? current.kind === "language"
                          ? `/languages/${current.lang}/${currentStats.nextId}`
                          : `/learn/${current.lang}/${currentStats.nextId}`
                        : current.kind === "language"
                          ? `/languages/${current.lang}`
                          : `/learn/${current.lang}`
                    }
                    className="text-sm font-medium text-rose-600 hover:text-rose-700 hand-note"
                  >
                    翻开这一页 →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!current && (
        <p className="hand-note text-sm text-center text-slate-400">
          👆 点一本书，把它从书架上抽出来看看目录
        </p>
      )}
    </div>
  );
}
