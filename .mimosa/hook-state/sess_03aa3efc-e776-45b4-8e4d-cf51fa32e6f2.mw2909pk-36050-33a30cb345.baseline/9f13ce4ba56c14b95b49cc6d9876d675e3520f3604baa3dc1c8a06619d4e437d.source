"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getCourse } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Progress } from "@/lib/types";

/** 语言课程大纲（增值包路径 /languages/[lang]） */
export default function LanguageOutline() {
  const me = useRequireUser();
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-20">加载课程…</p>}>
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

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-20">鉴权检查中…</p>;
  }
  if (me === null) return null;
  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到课程「{lang}」</p>
        <Link href="/languages" className="text-rose-600 mt-4 inline-block">
          返回增值包
        </Link>
      </div>
    );
  }

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <header>
        <Link href="/languages" className="text-sm text-slate-400 hover:text-rose-500">
          ← 返回语言增值包
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${course.gradient} grid place-items-center text-4xl shrink-0 shadow-lg`}
          >
            {course.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold">{course.name} 学习路线</h1>
            <p className="text-slate-500 mt-1">{course.tagline}</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm text-slate-500 mb-1.5">
            <span>
              已完成 {stats.done} / {stats.total} 课
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-card-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${course.gradient} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {course.levels.map((level) => {
        const levelDone = level.lessons.filter(
          (l) => progress?.lessons[l.id]?.completed
        ).length;
        return (
          <section key={level.id}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xl font-bold">
                <span className="text-rose-400 mr-2">L{level.id}</span>
                {level.name}
              </h2>
              <span className="text-sm text-slate-400">{level.description}</span>
              <span className="ml-auto text-xs text-slate-400">
                {levelDone}/{level.lessons.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {level.lessons.map((lesson, i) => {
                const doneLesson = progress?.lessons[lesson.id]?.completed;
                return (
                  <Link
                    key={lesson.id}
                    href={`/languages/${course.lang}/${lesson.id}`}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                      doneLesson
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-border bg-card hover:border-rose-300 hover:shadow-md"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold mt-0.5 ${
                        doneLesson
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-rose-100"
                      }`}
                    >
                      {doneLesson ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium block">{lesson.title}</span>
                      <span className="text-sm text-slate-500 line-clamp-1 mt-0.5 block">
                        {lesson.summary}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
