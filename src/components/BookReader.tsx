"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { flatLessons } from "@/data/courses";
import { gateOf } from "@/lib/client";
import type { Progress } from "@/lib/types";

/**
 * 书本阅读器：双页对开
 *  - 左页 = 目录树（章节 + 小节，含锁定/通关状态，当前页高亮）
 *  - 右页 = 内容页（多「页签」翻页：要点 / 例句 / 深入讲解…）
 *  - 翻页动画、上一页/下一页、键盘 ←/→
 * 移动端退化为单页堆叠（目录折叠为可展开面板）。
 */

export interface BookSection {
  id: string;
  /** 页签名，如「要点」「例句」「深入讲解」 */
  label: string;
  icon?: string;
  content: React.ReactNode;
}

interface BookReaderProps {
  lang: string;
  courseName: string;
  courseEmoji: string;
  lessonId: string;
  lessonTitle: string;
  levelName: string;
  index: number;
  total: number;
  progress?: Progress | null;
  /** 书的正文页（2~4 页最佳） */
  sections: BookSection[];
}
export default function BookReader({
  lang,
  courseName,
  courseEmoji,
  lessonId,
  lessonTitle,
  levelName,
  index,
  total,
  progress,
  sections,
}: BookReaderProps) {
  const [page, setPage] = useState(0);
  const [flipKey, setFlipKey] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  /** 目录向左折叠成窄边（桌面端） */
  const [tocCollapsed, setTocCollapsed] = useState(false);

  const flat = useMemo(() => flatLessons(lang), [lang]);

  // 键盘 ←/→ 翻页（输入框聚焦时不干扰）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") flipTo(Math.max(0, page - 1));
      if (e.key === "ArrowRight") flipTo(Math.min(sections.length - 1, page + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function flipTo(n: number) {
    if (n === page || n < 0 || n >= sections.length) return;
    setPage(n);
    setFlipKey((k) => k + 1);
  }

  const current = sections[page] ?? sections[0];

  return (
    <div className="space-y-4">
      {/* 书本：双页对开 */}
      <div
        className={`book-spread paper rounded-r-xl rounded-l-lg border-x border-amber-900/10 dark:border-amber-100/10 shadow-lg ${
          tocCollapsed ? "toc-collapsed" : ""
        }`}
      >
        {/* ---- 左页：目录树（可向左折叠） ---- */}
        <div className="book-page relative p-5 sm:p-6 min-h-[460px]">
          {tocCollapsed ? (
            /* 折叠态：收成一条窄边 */
            <button
              onClick={() => setTocCollapsed(false)}
              aria-label="展开目录"
              title="展开目录"
              className="hidden lg:flex h-full min-h-[460px] w-full flex-col items-center justify-start gap-3 pt-6 text-slate-500 hover:text-rose-600 transition-colors"
            >
              <span className="vertical-title serif-title text-[11px] tracking-[0.35em]">
                目 录
              </span>
              <span className="text-xs opacity-60" aria-hidden="true">
                »
              </span>
            </button>
          ) : (
            <>
              <div className="hidden lg:flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-3">
                <span className="serif-title text-sm tracking-[0.3em] text-amber-900/70 dark:text-amber-200/70">
                  目 录
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {courseEmoji} {courseName}
                  </span>
                  <button
                    onClick={() => setTocCollapsed(true)}
                    aria-label="折叠目录"
                    title="折叠目录（向左收起）"
                    className="text-slate-400 hover:text-rose-600 text-xs leading-none px-1"
                  >
                    «
                  </button>
                </div>
              </div>

              {/* 移动端：目录折叠面板 */}
              <button
                onClick={() => setTocOpen((v) => !v)}
                aria-expanded={tocOpen}
                aria-controls="book-toc-mobile"
                className="lg:hidden w-full flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-2"
              >
                <span className="serif-title tracking-widest">目 录</span>
                <span aria-hidden="true">{tocOpen ? "▾" : "▸"}</span>
              </button>
              <div
                id="book-toc-mobile"
                className={`${tocOpen ? "block" : "hidden"} lg:block`}
              >
                <ChapterTree
                  lang={lang}
                  lessonId={lessonId}
                  progress={progress ?? null}
                  flat={flat}
                />
              </div>

              <p className="hidden lg:block text-[11px] text-slate-400 mt-4 leading-relaxed border-t border-amber-900/15 dark:border-amber-100/10 pt-3">
                💡 键盘 ← → 可翻页。
                <br />
                🔒 的章节需先通过前置课程的测验与考核。
              </p>
            </>
          )}
        </div>

        {/* ---- 书脊 ---- */}
        <div
          aria-hidden="true"
          className="relative w-0 lg:w-3 border-x border-amber-900/10 dark:border-amber-100/10 bg-gradient-to-r from-transparent via-amber-900/10 to-transparent dark:via-black/30"
        />

        {/* ---- 右页：内容（可翻） ---- */}
        <div className="book-page relative p-5 sm:p-7 min-h-[460px] flex flex-col">
          {/* 页眉 */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-amber-900/15 dark:border-amber-100/10">
            <div className="min-w-0">
              <div className="serif-title text-lg font-bold truncate">
                {lessonTitle}
              </div>
              <div className="text-[11px] text-slate-400">
                {levelName} · 第 {index + 1} 页 / 共 {total} 页
              </div>
            </div>
            <div className="flex gap-1 shrink-0" role="tablist" aria-label="书页切换">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={page === i}
                  onClick={() => flipTo(i)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    page === i
                      ? "bg-rose-600 text-white"
                      : "text-slate-500 hover:bg-amber-900/10 dark:hover:bg-amber-100/10"
                  }`}
                >
                  {s.icon ? `${s.icon} ` : ""}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 页内容（翻页动画） */}
          <div
            key={`${flipKey}-${current.id}`}
            className="page-flip flex-1 min-h-[320px]"
          >
            {current.content}
          </div>

          {/* 页脚翻页 */}
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-amber-900/15 dark:border-amber-100/10">
            <button
              onClick={() => flipTo(page - 1)}
              disabled={page === 0}
              className="hand-note text-sm text-slate-500 disabled:opacity-30 hover:text-rose-600 px-2"
            >
              ← {page > 0 ? sections[page - 1].label : "封面"}
            </button>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {page + 1} / {sections.length}
            </span>
            <button
              onClick={() => flipTo(page + 1)}
              disabled={page === sections.length - 1}
              className="hand-note text-sm text-slate-500 disabled:opacity-30 hover:text-rose-600 px-2"
            >
              {page < sections.length - 1 ? sections[page + 1].label : "封底"} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 目录树：章节 → 小节，含锁定/通关状态（供大纲页复用） */
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
