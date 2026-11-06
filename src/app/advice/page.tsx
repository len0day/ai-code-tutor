"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COURSES } from "@/data/courses";
import { aiJson, fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Progress } from "@/lib/types";

interface PathAdvice {
  advice: string;
  weakPoints?: string[];
  nextLessons?: string[];
}

/** 🤖 AI 个性化学习建议：基于进度、测验成绩与错题，规划下一步 */
export default function AdvicePage() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [adviceLang, setAdviceLang] = useState<string>("python");
  const [advice, setAdvice] = useState<PathAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
  }, [me]);

  const getAdvice = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await aiJson<PathAdvice>({ task: "path", lang: adviceLang });
      setAdvice(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取建议失败");
    } finally {
      setLoading(false);
    }
  };

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-8">
      <section className="text-center py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          🤖 AI <span className="grad-text">个性化学习建议</span>
        </h1>
        <p className="mt-2 text-slate-500 max-w-xl mx-auto">
          基于你的学习进度、测验成绩与错题，AI 规划下一步学什么、薄弱点在哪。
        </p>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 card-glow">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="advice-course" className="text-sm text-slate-500">
              选择课程
            </label>
            <select
              id="advice-course"
              value={adviceLang}
              onChange={(e) => setAdviceLang(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
            >
              {COURSES.map((c) => (
                <option key={c.lang} value={c.lang}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={getAdvice}
            disabled={loading}
            className="btn-primary disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? "AI 思考中…" : "获取建议"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {advice && (
          <div className="mt-5 space-y-4">
            <p className="text-slate-700 leading-relaxed">{advice.advice}</p>
            {advice.weakPoints && advice.weakPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {advice.weakPoints.map((w, i) => (
                  <span
                    key={i}
                    className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full"
                  >
                    薄弱点: {w}
                  </span>
                ))}
              </div>
            )}
            {advice.nextLessons && advice.nextLessons.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-600">
                  建议接下来学：
                </div>
                {advice.nextLessons.map((id) => {
                  const course = COURSES.find((c) =>
                    c.levels.some((l) => l.lessons.some((ls) => ls.id === id))
                  );
                  const lesson = course?.levels
                    .flatMap((l) => l.lessons)
                    .find((ls) => ls.id === id);
                  if (!course || !lesson) return null;
                  return (
                    <Link
                      key={id}
                      href={
                        course.kind === "language"
                          ? `/languages/${course.lang}/${id}`
                          : `/learn/${course.lang}/${id}`
                      }
                      className="flex items-center gap-3 bg-slate-50 hover:bg-indigo-50 border border-border rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <span>{course.emoji}</span>
                      <span className="text-sm font-medium">{lesson.title}</span>
                      <span className="text-xs text-slate-400 ml-auto">{id}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!advice && !loading && !error && (
          <p className="mt-5 text-sm text-slate-400">
            选择一门课程，点击「获取建议」—— AI 会结合你的进度与成绩给出下一步规划。
          </p>
        )}
      </section>

      {progress && (
        <p className="text-xs text-slate-400 text-center">
          当前数据：XP {progress.xp} · 连续学习 {progress.streak} 天 · 已完成{" "}
          {Object.values(progress.lessons).filter((l) => l.completed).length} 课
        </p>
      )}
    </div>
  );
}
