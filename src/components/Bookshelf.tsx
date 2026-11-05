"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Course, Progress } from "@/lib/types";
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
}

/**
 * 书架三段式交互：
 *  1️⃣ 书架：每门课程一本立体书脊立在木板上
 *  2️⃣ 抽出：点一本书 → 书架退为暗色背景，书在展示台上 3D 悬浮
 *  3️⃣ 翻开：再点一下 → 封面沿书脊 3D 翻开，露出课程目录页
 * 目录中点击任意一节 → 进入全屏图书页面开始阅读。
 */
export default function Bookshelf({
  courses,
  progress,
  lockedLangs = [],
}: BookshelfProps) {
  /** 抽出的那本书（null = 书架状态） */
  const [picked, setPicked] = useState<string | null>(null);
  /** 封面是否已翻开 */
  const [opened, setOpened] = useState(false);

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

  const current = courses.find((c) => c.lang === picked) ?? null;
  const currentStats = current ? stats[current.lang] : null;

  const pick = (lang: string) => {
    setPicked(lang);
    setOpened(false);
  };
  const putBack = () => {
    setPicked(null);
    setOpened(false);
  };

  const lessonHref = (c: Course, id: string | null) =>
    id
      ? c.kind === "language"
        ? `/languages/${c.lang}/${id}`
        : `/learn/${c.lang}/${id}`
      : c.kind === "language"
        ? `/languages/${c.lang}`
        : `/learn/${c.lang}`;

  return (
    <div className="shelf-scene">
      {/* ---------- 1️⃣ 书架（抽出后退为背景） ---------- */}
      <div
        className={`shelf-wrap ${picked ? "shelf-dimmed" : ""}`}
        aria-hidden={picked ? true : undefined}
      >
        <div className="shelf-inner">
          <div className="shelf-row" role="group" aria-label="课程书架">
            {courses.map((c, i) => {
              const s = stats[c.lang];
              const [from, to] = SPINE_COLORS[c.lang] ?? ["#a1a1aa", "#4b5563"];
              const locked = lockedLangs.includes(c.lang);
              return (
                <div key={c.lang} className="contents">
                  <button
                    onClick={() => pick(c.lang)}
                    aria-label={`抽出《${c.name}》`}
                    title={`《${c.name}》${locked ? "（已达课程数上限）" : ""}`}
                    className={`book-spine ${locked ? "is-locked" : ""}`}
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
                      <span
                        className="spine-bar-fill"
                        style={{ height: `${s.pct}%` }}
                      />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="shelf-board" aria-hidden="true" />
        </div>
      </div>

      {/* ---------- 2️⃣/3️⃣ 展示台：悬浮的书 → 翻开 ---------- */}
      {current && currentStats && (
        <div className="focus-stage page-enter">
          <div className="flex items-center gap-3">
            <span className="hand-note text-base">
              {opened
                ? "📖 点击目录任意一节，进入全屏阅读"
                : "👆 再点一下，翻开这本书"}
            </span>
            <button
              onClick={putBack}
              className="text-xs text-slate-400 hover:text-rose-500 border border-border rounded-full px-3 py-1 transition-colors"
            >
              ↩ 放回书架
            </button>
          </div>

          <div
            className={`focus-book ${opened ? "is-open" : ""}`}
            data-course={current.lang}
          >
            {/* 封面（翻开后转向左侧） */}
            <button
              onClick={() => !opened && setOpened(true)}
              aria-label={opened ? undefined : `翻开《${current.name}》`}
              tabIndex={opened ? -1 : 0}
              className="focus-book-cover book-cover"
              style={
                {
                  "--cover-from": SPINE_COLORS[current.lang]?.[0] ?? "#a1a1aa",
                  "--cover-mid": SPINE_COLORS[current.lang]?.[1] ?? "#6b7280",
                  "--cover-to": SPINE_COLORS[current.lang]?.[1] ?? "#4b5563",
                } as React.CSSProperties
              }
            >
              <span className="focus-book-inner">
                <span className="text-[10px] tracking-[0.3em] opacity-75">
                  {current.kind === "language" ? "LANGUAGE" : "PROGRAMMING"}
                </span>
                <span className="text-5xl mt-6">{current.emoji}</span>
                <h3 className="serif-title text-3xl font-bold mt-3">
                  {current.name}
                </h3>
                <span className="hand-note text-sm mt-1 text-left px-6">
                  {current.tagline}
                </span>
                <span className="mt-auto mb-5 w-40">
                  <span className="block h-1 bg-black/25 rounded-full overflow-hidden mb-1.5">
                    <span
                      className="block h-full bg-gradient-to-r from-amber-200 to-amber-100 rounded-full transition-all duration-700"
                      style={{ width: `${currentStats.pct}%` }}
                    />
                  </span>
                  <span className="flex justify-between text-[11px] opacity-80">
                    <span>已读 {currentStats.pct}%</span>
                    <span>
                      {current.levels.length} 章 · {currentStats.total} 页
                    </span>
                  </span>
                </span>
              </span>
            </button>

            {/* 目录内页（翻开后显现） */}
            <div className="focus-book-toc paper book-page">
              <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-3">
                <span className="serif-title text-sm tracking-[0.3em] text-amber-900/70 dark:text-amber-200/70">
                  {current.name} · 目 录
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentStats.passed} 页已通关
                </span>
              </div>
              <ChapterTree
                lang={current.lang}
                lessonId=""
                progress={progress}
                flat={flatLessons(current.lang)}
              />
              <div className="border-t border-amber-900/15 dark:border-amber-100/10 pt-3 mt-3 flex justify-between items-center">
                <button
                  onClick={() => setOpened(false)}
                  className="hand-note text-sm text-slate-400 hover:text-rose-600"
                >
                  « 合上封面
                </button>
                <Link
                  href={lessonHref(current, currentStats.nextId)}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 hand-note"
                >
                  从上次读到的地方继续 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
