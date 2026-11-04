"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Progress } from "@/lib/types";
import "./book.css";

/** 语言学习增值包：书本封面陈列馆 */
export default function LanguagesPage() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
  }, [me]);

  const langCourses = useMemo(() => COURSES.filter((c) => c.kind === "language"), []);

  const stats = useMemo(() => {
    return langCourses.map((c) => {
      const all = c.levels.flatMap((l) => l.lessons);
      const done = all.filter((l) => progress?.lessons[l.id]?.completed).length;
      const next = all.find((l) => !progress?.lessons[l.id]?.completed);
      const passed = all.filter((l) => progress?.gates?.[c.lang]?.[l.id]?.passed).length;
      return { course: c, done, total: all.length, nextId: next?.id ?? null, passed };
    });
  }, [langCourses, progress]);

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-10">
      {/* Hero：书架氛围 */}
      <section className="text-center py-10 book-stage" key={flipKey}>
        <p className="hand-note text-lg mb-1">—— 学语言，像读一本书 ——</p>
        <h1 className="text-4xl font-extrabold serif-title">
          语言学习<span className="grad-text">增值包</span>
        </h1>
        <p className="mt-4 text-slate-500 max-w-xl mx-auto leading-relaxed">
          每一门语言都是一本书：翻开封面，从第一页读到最后一页。
          场景对话是「对话练习」，老师批注是「页边笔记」，读完一章，翻向下一章。
        </p>
      </section>

      {/* 书本陈列 */}
      <section className="space-y-14">
        {stats.map(({ course, done, total, nextId, passed }) => {
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div key={course.lang} className="book-stage">
              {/* 章节进度条：像书签 */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <span className="hand-note text-base">{course.emoji} {course.name}</span>
                  <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                    增值包
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 tabular-nums">
                    读完 {done}/{total} 页
                  </span>
                  <button
                    onClick={() => setFlipKey((k) => k + 1)}
                    className="text-xs text-slate-400 hover:text-rose-500"
                    title="重播翻书动画"
                  >
                    ↻
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
                {/* 书本封面（3D） */}
                <Link
                  href={nextId ? `/languages/${course.lang}/${nextId}` : `/languages/${course.lang}`}
                  aria-label={`打开《${course.name}》`}
                  className="shrink-0 block"
                >
                  <div className="book-cover book-hover w-56 h-80 sm:w-64 sm:h-96 flex flex-col justify-between p-5 pl-12">
                    <div>
                      <div className="vertical-title text-[11px] opacity-70 absolute right-4 top-12 tracking-widest">
                        {course.lang === "japanese" ? "にほんご" : course.name}
                      </div>
                      <div className="text-[10px] tracking-[0.3em] opacity-75 mt-1">
                        LANGUAGE · 增值包
                      </div>
                      <div className="mt-8">
                        <div className="text-5xl">{course.emoji}</div>
                        <h2 className="serif-title text-3xl font-bold mt-3">{course.name}</h2>
                        <div className="hand-note text-sm mt-1">
                          五十音から N2 まで
                        </div>
                      </div>
                    </div>
                    <div>
                      {/* 阅读进度：像书签线 */}
                      <div className="h-1 bg-black/25 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-amber-200 to-amber-100 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] opacity-80">
                        <span>已读 {pct}%</span>
                        <span>{course.levels.length} 章 · {total} 页</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 目录内页 */}
                <div className="flex-1 w-full page-flip paper book-page rounded-r-xl rounded-l-sm p-6 sm:p-8">
                  {/* 页眉 */}
                  <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-3 mb-4">
                    <span className="serif-title text-sm tracking-widest text-amber-900/70 dark:text-amber-200/70">
                      目 录
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {passed} 页已通关 · {pct}%
                    </span>
                  </div>

                  {/* 章节目录 */}
                  <div className="space-y-1">
                    {course.levels.map((level) => (
                      <div key={level.id} className="mb-3">
                        <div className="serif-title text-sm text-amber-900/80 dark:text-amber-200/80 mb-1.5">
                          第{["一", "二", "三", "四"][Number(level.id) - 1] ?? level.id}章 ·{" "}
                          {level.name}
                          <span className="text-xs text-slate-400 ml-2 font-sans">
                            {level.description}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {level.lessons.map((lesson, i) => {
                            const lp = progress?.lessons[lesson.id];
                            const gate = progress?.gates?.[course.lang]?.[lesson.id];
                            const doneLesson = lp?.completed;
                            const locked = gate ? !gate.unlocked : false;
                            return (
                              <Link
                                key={lesson.id}
                                href={`/languages/${course.lang}/${lesson.id}`}
                                className="group flex items-center gap-2.5 rounded px-2.5 py-2 hover:bg-amber-900/5 dark:hover:bg-amber-100/5 transition-colors"
                              >
                                {/* 页码点 */}
                                <span
                                  className={`shrink-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold ${
                                    doneLesson
                                      ? "bg-emerald-600 text-white"
                                      : locked
                                        ? "bg-amber-900/15 text-amber-900/50 dark:bg-amber-100/10 dark:text-amber-200/40"
                                        : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
                                  }`}
                                >
                                  {doneLesson ? "✓" : locked ? "🔒" : i + 1}
                                </span>
                                <span className="text-sm flex-1 truncate group-hover:text-rose-700">
                                  {lesson.title}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ······ P{Number(level.id) * 10 + i}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 页脚 */}
                  <div className="border-t border-amber-900/15 dark:border-amber-100/10 pt-3 mt-4 flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">
                      共 {total} 页 · {passed} 页已通关
                    </span>
                    <Link
                      href={nextId ? `/languages/${course.lang}/${nextId}` : `/languages/${course.lang}`}
                      className="text-sm font-medium text-rose-600 hover:text-rose-700 hand-note"
                    >
                      翻开这一页 →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 与编程课的区别说明 */}
      <section className="paper book-page rounded-r-xl rounded-l-sm p-5 sm:p-6">
        <h2 className="serif-title font-bold mb-2">📖 与编程课程有什么不同？</h2>
        <ul className="text-sm space-y-1.5 text-slate-600 dark:text-slate-300">
          <li>
            <b>编程课程</b>：AI 导师问答 → 练习测验 → 代码实操（写+运行+AI 挑毛病）→ 模拟面试（技术面）
          </li>
          <li>
            <b>语言课程</b>：AI 导师问答 → 练习测验 → 场景模拟（对话实战 + 语言老师点评），无代码实操
          </li>
          <li>
            两者共用闯关制：测验与场景对话双达标才能翻向下一页；进度、错题本、收藏、笔记完全互通
          </li>
        </ul>
      </section>
    </div>
  );
}
