"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { LessonGate, Progress } from "@/lib/types";
import { PASS_SCORE } from "@/lib/gateConstants";

interface Row {
  lang: string;
  langName: string;
  emoji: string;
  lessonId: string;
  title: string;
  levelName: string;
  gate?: LessonGate;
  quizScores: number[];
  interviewScores: number[];
}

/** 学习报告：每节课的测验 / 面试（场景）分数与通关状态 */
export default function ReportPage() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [langFilter, setLangFilter] = useState("");

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
  }, [me]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of COURSES) {
      if (langFilter && c.lang !== langFilter) continue;
      for (const level of c.levels) {
        for (const lesson of level.lessons) {
          const lp = progress?.lessons[lesson.id];
          out.push({
            lang: c.lang,
            langName: c.name,
            emoji: c.emoji,
            lessonId: lesson.id,
            title: lesson.title,
            levelName: level.name,
            gate: progress?.gates?.[c.lang]?.[lesson.id],
            quizScores: lp?.quizScores ?? [],
            interviewScores: lp?.interviewScores ?? [],
          });
        }
      }
    }
    return out;
  }, [progress, langFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.gate?.passed).length;
    const unlocked = rows.filter((r) => r.gate?.unlocked).length;
    const attempted = rows.filter((r) => r.quizScores.length || r.interviewScores.length).length;
    return { total, passed, unlocked, attempted };
  }, [rows]);

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">📈 学习报告</h1>
          <p className="text-slate-500 mt-1 text-sm">
            每节课的测验与面试 / 场景对话成绩记录（通过线 {PASS_SCORE} 分）
          </p>
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
        >
          <option value="">全部课程</option>
          {COURSES.map((c) => (
            <option key={c.lang} value={c.lang}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </header>

      {/* 概览 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600 tabular-nums">{stats.passed}</div>
          <div className="text-xs text-slate-500 mt-1">已通关</div>
        </div>
        <div className="glass border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-cyan-600 tabular-nums">{stats.unlocked}</div>
          <div className="text-xs text-slate-500 mt-1">已解锁</div>
        </div>
        <div className="glass border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-500 tabular-nums">{stats.attempted}</div>
          <div className="text-xs text-slate-500 mt-1">已测评</div>
        </div>
        <div className="glass border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">课程总数</div>
        </div>
      </section>

      {/* 明细表 */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-card-2 text-slate-500 text-xs">
                <th className="text-left px-4 py-2.5 font-medium">课程</th>
                <th className="text-left px-3 py-2.5 font-medium">测验成绩</th>
                <th className="text-left px-3 py-2.5 font-medium">面试 / 场景成绩</th>
                <th className="text-left px-3 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = r.gate;
                const passed = g?.passed ?? false;
                const locked = g ? !g.unlocked : false;
                return (
                  <tr
                    key={`${r.lang}-${r.lessonId}`}
                    className="border-t border-border hover:bg-slate-50/60 dark:hover:bg-card-2/50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`${
                          COURSES.find((c) => c.lang === r.lang)?.kind === "language"
                            ? "/languages"
                            : "/learn"
                        }/${r.lang}/${r.lessonId}`}
                        className="flex items-center gap-2 hover:text-indigo-600"
                      >
                        <span>{r.emoji}</span>
                        <span className="font-medium truncate max-w-[220px]">{r.title}</span>
                      </Link>
                      <span className="text-[11px] text-slate-400 ml-6">{r.levelName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.quizScores.length ? (
                        <span className="flex flex-wrap gap-1">
                          {r.quizScores.map((s, i) => (
                            <span
                              key={i}
                              className={`text-xs px-1.5 py-0.5 rounded tabular-nums ${
                                s >= PASS_SCORE
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.interviewScores.length ? (
                        <span className="flex flex-wrap gap-1">
                          {r.interviewScores.map((s, i) => (
                            <span
                              key={i}
                              className={`text-xs px-1.5 py-0.5 rounded tabular-nums ${
                                s >= PASS_SCORE
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {passed ? (
                        <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ 已通关
                        </span>
                      ) : locked ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          🔒 未解锁
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          进行中
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-400 leading-relaxed">
        闯关规则：完成本节「练习测验」与「模拟面试 / 场景对话」且均达到 {PASS_SCORE} 分，
        本节标记为已通关并解锁下一节；未解锁的课程可预览静态内容，AI 功能不可用。
      </p>
    </div>
  );
}
