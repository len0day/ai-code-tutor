"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Progress } from "@/lib/types";

/** 语言学习增值包：非编程类课程（外语等） */
export default function LanguagesPage() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);

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
      return { course: c, done, total: all.length, nextId: next?.id ?? null };
    });
  }, [langCourses, progress]);

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="text-5xl mb-3">🌸</div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          语言学习<span className="grad-text">增值包</span>
        </h1>
        <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
          与编程课程不同的学习方式：以「场景对话」为核心，
          AI 扮演对话方，你用目标语言实战演练，结束后由<b className="text-rose-600">语言老师</b>逐句点评并给出改进建议。
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-full">
            🎭 真实场景模拟
          </span>
          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-full">
            👩‍🏫 语言老师逐句点评
          </span>
          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-full">
            🔊 纯正发音朗读
          </span>
          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-full">
            📝 例句 + 读音 + 翻译
          </span>
        </div>
      </section>

      {/* 课程列表 */}
      {stats.map(({ course, done, total, nextId }) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <section
            key={course.lang}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-5 p-6 bg-gradient-to-r from-rose-50/60 to-transparent dark:from-rose-950/30">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center text-4xl shrink-0 shadow-lg">
                {course.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-xl">{course.name}</h2>
                  <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                    增值包
                  </span>
                  <span className="text-xs text-slate-400">
                    {done}/{total} 课
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{course.tagline}</p>
                <div className="mt-3 h-1.5 bg-slate-100 dark:bg-card-2 rounded-full overflow-hidden max-w-md">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <Link
                href={nextId ? `/languages/${course.lang}/${nextId}` : `/languages/${course.lang}`}
                className="btn-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl shrink-0"
              >
                {done === 0 ? "开始学习" : nextId ? "继续学习" : "全部完成 🎉"}
              </Link>
            </div>

            {/* 等级与课时 */}
            <div className="p-5 pt-0">
              {course.levels.map((level) => (
                <div key={level.id} className="mb-4 last:mb-0">
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="font-semibold text-sm">
                      <span className="text-rose-400 mr-1.5">L{level.id}</span>
                      {level.name}
                    </h3>
                    <span className="text-xs text-slate-400">{level.description}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {level.lessons.map((lesson, i) => {
                      const doneLesson = progress?.lessons[lesson.id]?.completed;
                      return (
                        <Link
                          key={lesson.id}
                          href={`/languages/${course.lang}/${lesson.id}`}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            doneLesson
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-border hover:border-rose-300 hover:bg-rose-50/40"
                          }`}
                        >
                          <span
                            className={`shrink-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold ${
                              doneLesson
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {doneLesson ? "✓" : i + 1}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="text-xs text-slate-400 leading-relaxed bg-slate-50 dark:bg-card-2 rounded-xl p-4">
        <p className="font-medium text-slate-500 mb-1">💡 与编程课程的区别</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>编程课程：AI 导师问答 → 练习测验 → 代码实操（写+运行+AI 挑毛病）→ 模拟面试（技术面）</li>
          <li>语言课程：AI 导师问答 → 练习测验 → 场景模拟（对话实战 + 语言老师点评），不含代码实操</li>
          <li>语言课程同样支持错题本、收藏、笔记、进度与 XP 统计。</li>
        </ul>
      </section>
    </div>
  );
}
