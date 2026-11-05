"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getCourse, flatLessons } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import { ChapterTree } from "@/components/BookReader";
import type { Progress } from "@/lib/types";
import "../../languages/book.css";

export default function CourseOutline() {
  const me = useRequireUser();
  return (
    <Suspense
      fallback={<p className="text-center text-slate-400 py-20">加载课程…</p>}
    >
      <OutlineContent me={me} />
    </Suspense>
  );
}

function OutlineContent({ me }: { me: ReturnType<typeof useRequireUser> }) {
  const params = useParams<{ lang: string }>();
  const lang = params.lang;
  const course = getCourse(lang);

  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
  }, [lang, me]);

  const stats = useMemo(() => {
    if (!course) return { done: 0, total: 0 };
    const all = course.levels.flatMap((l) => l.lessons);
    return {
      done: all.filter((l) => progress?.lessons[l.id]?.completed).length,
      total: all.length,
    };
  }, [course, progress]);

  // 登录门禁：所有 Hooks 之后才能早退
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-20">鉴权检查中…</p>;
  }
  if (me === null) return null;

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到课程「{lang}」</p>
        <Link href="/" className="text-indigo-600 mt-4 inline-block">
          返回首页
        </Link>
      </div>
    );
  }

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* 课程头 */}
      <header>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← 返回首页
        </Link>
      </header>

      {/* 书本：封面 + 目录页 */}
      <div className="book-spread paper rounded-r-xl rounded-l-lg border-x border-amber-900/10 dark:border-amber-100/10 shadow-lg">
        {/* 左：书封 */}
        <div className="book-page relative p-6 sm:p-8 flex flex-col justify-center items-center text-center">
          <div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${course.gradient} grid place-items-center text-4xl shadow-lg mb-4`}
          >
            {course.emoji}
          </div>
          <h1 className="text-3xl serif-title font-bold">{course.name}</h1>
          <p className="hand-note text-sm mt-1">{course.tagline}</p>

          <div className="w-full mt-6">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>
                已读 {stats.done} / {stats.total} 页
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-card-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${course.gradient} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
            💡 目录在右页，点击任意一节即可翻开。
            <br />
            🔒 标记的章节需先通过前置考核。
          </p>
        </div>

        {/* 书脊 */}
        <div
          aria-hidden="true"
          className="relative w-0 lg:w-3 border-x border-amber-900/10 dark:border-amber-100/10 bg-gradient-to-r from-transparent via-amber-900/10 to-transparent dark:via-black/30"
        />

        {/* 右：目录页 */}
        <div className="book-page relative p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-3">
            <span className="serif-title text-sm tracking-[0.3em] text-amber-900/70 dark:text-amber-200/70">
              目 录
            </span>
            <span className="text-[11px] text-slate-400">
              {course.levels.length} 章 · {stats.total} 页
            </span>
          </div>
          <ChapterTree
            lang={course.lang}
            lessonId=""
            progress={progress}
            flat={flatLessons(course.lang)}
          />
        </div>
      </div>
    </div>
  );
}
