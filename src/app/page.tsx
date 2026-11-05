"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES, CODE_COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress, aiJson } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import Bookshelf from "@/components/Bookshelf";
import type { Progress } from "@/lib/types";
import "./languages/book.css";

interface PathAdvice {
  advice: string;
  weakPoints?: string[];
  nextLessons?: string[];
}

export default function Dashboard() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [advice, setAdvice] = useState<PathAdvice | null>(null);
  const [adviceLang, setAdviceLang] = useState<string>("python");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{
    unlocked: string[];
    courseLimit: number;
    aiUsed: number;
    aiLimit: number;
    configured?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
    fetch("/api/me/usage")
      .then((r) => r.json())
      .then((d) => {
        setUsage(d);
        setConfigured(Boolean(d.configured));
      })
      .catch(() => {});
  }, [me]);

  /** 达到课程数上限的课程（书架上显示锁） */
  const lockedLangs = useMemo(() => {
    if (!usage || usage.courseLimit === -1) return [];
    if (usage.unlocked.length < usage.courseLimit) return [];
    return COURSES.filter((c) => !usage.unlocked.includes(c.lang)).map((c) => c.lang);
  }, [usage]);

  const getAdvice = async () => requestAdvice();

  // 登录门禁：所有 Hooks 之后才能早退
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) {
    return null; // 未登录，已跳转 /login
  }

  async function requestAdvice() {
    setAdviceLoading(true);
    setAdviceError("");
    try {
      const data = await aiJson<PathAdvice>({ task: "path", lang: adviceLang });
      setAdvice(data);
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : "获取建议失败");
    } finally {
      setAdviceLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
          用 <span className="grad-text">AI 导师</span> 学编程、运维与外语
        </h1>
        <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
          Python · Java · JavaScript · TypeScript · Go · Swift · Next.js · HTML · Docker · Linux · 日语 ——
          内置从入门到进阶的 259 节课，AI 全程陪学：讲解、答疑、出题、批改、模拟面试、规划路径。
        </p>
        {configured === false && (
          <div className="mt-5 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2 rounded-xl">
            ⚠️ 还未配置 AI 的 API Key，
            <Link href="/settings" className="font-semibold underline">
              前往设置
            </Link>
          </div>
        )}
      </section>

      {/* 学习数据 */}
      <section className="grid grid-cols-3 gap-4 max-w-xl mx-auto text-center">
        <div className="glass border border-border rounded-2xl p-4 card-glow">
          <div className="text-2xl font-bold text-indigo-600 tabular-nums">{progress?.xp ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">XP 经验值</div>
        </div>
        <div className="glass border border-border rounded-2xl p-4 card-glow">
          <div className="text-2xl font-bold text-orange-500 tabular-nums">🔥 {progress?.streak ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">连续学习天数</div>
        </div>
        <div className="glass border border-border rounded-2xl p-4 card-glow">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">
            {progress ? Object.values(progress.lessons).filter((l) => l.completed).length : 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">已完成课程</div>
        </div>
      </section>

      {/* 书架：图书馆场景，编程与运维课程（语言课在增值包书架） */}
      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              📚 我的书架
              <span className="text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {CODE_COURSES.length} 本
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              点一本书把它从书架上抽出来，再点一下翻开封面，从目录进入全屏阅读。
            </p>
          </div>
        </div>

        <div className="shelf-scene">
          <Bookshelf
            courses={CODE_COURSES}
            progress={progress}
            lockedLangs={lockedLangs}
          />
        </div>
      </section>

      {/* 语言学习增值包入口 */}
      {LANGUAGE_COURSES.length > 0 && (
        <section className="flex items-center gap-5 bg-card border border-border rounded-2xl p-5 card-glow">
          <Link
            href="/languages"
            aria-label="进入语言学习增值包"
            className="shrink-0 book-cover w-20 h-28 flex flex-col items-center justify-center gap-1"
            style={
              {
                "--cover-from": "#fb7185",
                "--cover-mid": "#db2777",
                "--cover-to": "#be185d",
              } as React.CSSProperties
            }
          >
            <span className="text-2xl">🌸</span>
            <span className="serif-title text-xs text-white">日语</span>
          </Link>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold flex items-center gap-2">
              🌸 语言学习增值包
              <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                {LANGUAGE_COURSES.length} 门
              </span>
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              场景对话实战 + 语言老师逐句点评（与编程课程不同的学习路径，有独立的书架）
            </p>
          </div>
          <Link
            href="/languages"
            className="shrink-0 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            进入增值包书架 →
          </Link>
        </section>
      )}

      {/* AI 学习建议 */}
      <section className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg">🤖 AI 个性化学习建议</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              基于你的学习进度、测验成绩与错题，AI 规划下一步
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={adviceLang}
              onChange={(e) => setAdviceLang(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
            >
              {COURSES.map((c) => (
                <option key={c.lang} value={c.lang}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={getAdvice}
              disabled={adviceLoading}
              className="btn-primary disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {adviceLoading ? "AI 思考中…" : "获取建议"}
            </button>
          </div>
        </div>

        {adviceError && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
            {adviceError}
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
                <div className="text-sm font-medium text-slate-600">建议接下来学：</div>
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
                      href={`/learn/${course.lang}/${id}`}
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
      </section>
    </div>
  );
}
