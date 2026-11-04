"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES, CODE_COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress, aiJson } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Progress } from "@/lib/types";

interface PathAdvice {
  advice: string;
  weakPoints?: string[];
  nextLessons?: string[];
}

const RING_COLORS: Record<string, [string, string]> = {
  python: ["#0ea5e9", "#2563eb"],
  java: ["#f97316", "#ef4444"],
  javascript: ["#fbbf24", "#eab308"],
  typescript: ["#2563eb", "#4f46e5"],
  html: ["#f97316", "#f43f5e"],
  docker: ["#3b82f6", "#06b6d4"],
  linux: ["#64748b", "#18181b"],
  japanese: ["#f43f5e", "#ec4899"],
};

function ProgressRing({
  value,
  total,
  lang,
}: {
  value: number;
  total: number;
  lang: string;
}) {
  const pct = total ? value / total : 0;
  const R = 26;
  const C = 2 * Math.PI * R;
  const [c1, c2] = RING_COLORS[lang] ?? ["#6366f1", "#8b5cf6"];
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={`url(#grad-${lang})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
        />
        <defs>
          <linearGradient id={`grad-${lang}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
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

  const totals = useMemo(() => {
    const map: Record<string, { done: number; total: number; nextId: string | null }> = {};
    for (const c of COURSES) {
      const all = c.levels.flatMap((l) => l.lessons);
      const done = all.filter((l) => progress?.lessons[l.id]?.completed).length;
      const next = all.find((l) => !progress?.lessons[l.id]?.completed);
      map[c.lang] = { done, total: all.length, nextId: next?.id ?? null };
    }
    return map;
  }, [progress]);

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
          Python · Java · JavaScript · TypeScript · HTML · Docker/K8s · Linux · 日语 —— 内置从入门到进阶的 192 节课，
          AI 全程陪学：讲解、答疑、出题、批改、模拟面试、规划路径。
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

      {/* 语言卡片（编程与运维） */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {CODE_COURSES.map((c) => {
          const t = totals[c.lang];
          const locked =
            usage !== null &&
            usage.courseLimit !== -1 &&
            !usage.unlocked.includes(c.lang) &&
            usage.unlocked.length >= usage.courseLimit;
          return (
            <div
              key={c.lang}
              className={`relative bg-card border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 card-glow ${
                locked ? "opacity-60 border-dashed" : "border-border hover:-translate-y-0.5"
              }`}
            >
              {locked && (
                <span
                  title="学习课程数已达上限，联系管理员扩容"
                  className="absolute top-3 right-3 text-sm"
                >
                  🔒
                </span>
              )}
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} grid place-items-center text-3xl shrink-0 shadow-lg self-start sm:self-auto`}
              >
                {c.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">{c.name}</h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {t.done}/{t.total} 课
                  </span>
                  <span className="ml-auto sm:ml-0">
                    <ProgressRing value={t.done} total={t.total} lang={c.lang} />
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
                  {c.tagline}
                </p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {locked ? (
                    <span className="text-sm font-medium text-slate-400">
                      🔒 已达课程数上限
                    </span>
                  ) : (
                    <Link
                      href={t.nextId ? `/learn/${c.lang}/${t.nextId}` : `/learn/${c.lang}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                    >
                      {t.done === 0 ? "开始学习 →" : t.nextId ? "继续学习 →" : "全部完成 🎉"}
                    </Link>
                  )}
                  {!locked && (
                    <Link
                      href={`/learn/${c.lang}`}
                      className="text-sm text-slate-400 hover:text-slate-600"
                    >
                      课程大纲
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 语言学习增值包 */}
      {LANGUAGE_COURSES.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                🌸 语言学习增值包
                <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                  {LANGUAGE_COURSES.length} 门
                </span>
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                场景对话实战 + 语言老师逐句点评（与编程课程不同的学习路径）
              </p>
            </div>
            <Link
              href="/languages"
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              进入增值包 →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {LANGUAGE_COURSES.map((c) => {
              const t = totals[c.lang];
              const locked =
                usage !== null &&
                usage.courseLimit !== -1 &&
                !usage.unlocked.includes(c.lang) &&
                usage.unlocked.length >= usage.courseLimit;
              return (
                <div
                  key={c.lang}
                  className={`relative bg-card border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 card-glow ${
                    locked
                      ? "opacity-60 border-dashed"
                      : "border-border hover:-translate-y-0.5"
                  }`}
                >
                  {locked && (
                    <span
                      title="学习课程数已达上限，联系管理员扩容"
                      className="absolute top-3 right-3 text-sm"
                    >
                      🔒
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center text-3xl shrink-0 shadow-lg self-start sm:self-auto">
                    {c.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {t.done}/{t.total} 课
                      </span>
                      <span className="ml-auto sm:ml-0">
                        <ProgressRing value={t.done} total={t.total} lang={c.lang} />
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
                      {c.tagline}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {locked ? (
                        <span className="text-sm font-medium text-slate-400">
                          🔒 已达课程数上限
                        </span>
                      ) : (
                        <Link
                          href={`/languages/${c.lang}${t.nextId ? `/${t.nextId}` : ""}`}
                          className="text-sm font-medium text-rose-600 hover:text-rose-700"
                        >
                          {t.done === 0 ? "开始学习 →" : t.nextId ? "继续学习 →" : "全部完成 🎉"}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
