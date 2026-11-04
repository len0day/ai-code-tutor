"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProblemBank from "@/components/ProblemBank";
import Markdown from "@/components/Markdown";
import {
  availableBanks,
  fetchNotebook,
  removeFavorite,
  removeNote,
  removeWrong,
  toggleResolved,
} from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import { LANGUAGE_META } from "@/lib/ai/presets";
import type { Notebook } from "@/lib/types";

type Tab = "wrong" | "favorites" | "notes" | "leetcode";

/** 有可用题库源的课程语言 */
const BANK_LANGS = ["python", "java", "javascript", "typescript", "linux"];

const KIND_LABEL: Record<string, string> = {
  lesson: "课程",
  keypoint: "知识点",
  "quiz-question": "测验题",
  "interview-question": "面试题",
};

export default function NotebookPage() {
  const me = useRequireUser();
  const [tab, setTab] = useState<Tab>("wrong");
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [langFilter, setLangFilter] = useState("");
  const [bankLang, setBankLang] = useState("python");

  useEffect(() => {
    if (!me) return;
    fetchNotebook().then(setNotebook).catch(() => {});
  }, [me]);

  const wrongQuestions = useMemo(
    () =>
      (notebook?.wrongQuestions ?? []).filter(
        (w) => !langFilter || w.lang === langFilter
      ),
    [notebook, langFilter]
  );
  const favorites = useMemo(
    () =>
      (notebook?.favorites ?? []).filter(
        (f) => !langFilter || f.lang === langFilter
      ),
    [notebook, langFilter]
  );
  const notes = useMemo(
    () =>
      Object.values(notebook?.notes ?? {})
        .filter((n) => !langFilter || n.lang === langFilter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notebook, langFilter]
  );

  const tabBtn = (id: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        tab === id
          ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  const langBadge = (lang: string) => (
    <span className="text-xs text-slate-400">
      {LANGUAGE_META[lang]?.emoji ?? ""} {LANGUAGE_META[lang]?.name ?? lang}
    </span>
  );

  // 登录门禁：所有 Hooks 之后才能早退
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">📚 我的知识库</h1>
          <p className="text-slate-500 mt-1 text-sm">
            错题自动归集、收藏重点内容、随手记笔记，配套 LeetCode / HackerRank 在线题库
          </p>
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
        >
          <option value="">全部语言</option>
          {Object.entries(LANGUAGE_META).map(([id, m]) => (
            <option key={id} value={id}>
              {m.emoji} {m.name}
            </option>
          ))}
        </select>
      </header>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabBtn("wrong", "❌ 错题本", notebook?.wrongQuestions.filter((w) => !w.resolved).length)}
          {tabBtn("favorites", "⭐ 收藏", notebook?.favorites.length)}
          {tabBtn("notes", "📝 笔记", Object.keys(notebook?.notes ?? {}).length)}
          {tabBtn("leetcode", "🔗 在线题库")}
        </div>

        {/* ---------- 错题本 ---------- */}
        {tab === "wrong" && (
          <div className="p-4 space-y-3">
            {wrongQuestions.length === 0 && (
              <p className="text-center text-slate-400 py-12 text-sm">
                还没有错题。做测验或模拟面试时答错的题会自动收进来 💪
              </p>
            )}
            {wrongQuestions.map((w) => (
              <div
                key={w.id}
                className={`border rounded-xl p-4 ${
                  w.resolved ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {w.source === "quiz" ? "练习测验" : "模拟面试"}
                  </span>
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {w.kind === "choice" ? "选择题" : w.kind === "code" ? "编程题" : "面试题"}
                  </span>
                  {langBadge(w.lang)}
                  {w.resolved && (
                    <span className="text-emerald-600">✓ 已掌握</span>
                  )}
                  <Link
                    href={`/learn/${w.lang}/${w.lessonId}`}
                    className="ml-auto text-indigo-500 hover:underline"
                  >
                    回炉本课 →
                  </Link>
                </div>
                <div className="text-sm font-medium">
                  <Markdown content={w.question} />
                </div>
                {w.kind === "choice" && w.options && (
                  <div className="mt-2 space-y-1">
                    {w.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={`text-sm rounded-lg px-2.5 py-1 ${
                          oi === w.answerIndex
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                        {oi === w.answerIndex ? " ✓" : ""}
                      </div>
                    ))}
                  </div>
                )}
                {typeof w.userAnswer === "string" && w.userAnswer && w.kind !== "choice" && (
                  <div className="mt-2 text-sm text-red-500/80 bg-red-50/60 rounded-lg px-3 py-2">
                    <span className="font-medium">我的回答：</span>
                    <span className="whitespace-pre-wrap">{w.userAnswer.slice(0, 300)}</span>
                  </div>
                )}
                {(w.explanation || w.idealAnswer) && (
                  <details className="mt-2 border-t border-border pt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-indigo-500">
                      参考答案 / 解析
                    </summary>
                    <div className="mt-1.5 text-sm text-slate-600">
                      <Markdown content={w.idealAnswer || w.explanation || ""} />
                    </div>
                  </details>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={async () => {
                      await toggleResolved(w.id);
                      setNotebook(await fetchNotebook());
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      w.resolved
                        ? "border-slate-200 text-slate-500"
                        : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {w.resolved ? "标为未掌握" : "✓ 标记已掌握"}
                  </button>
                  <button
                    onClick={async () => {
                      await removeWrong(w.id);
                      setNotebook(await fetchNotebook());
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- 收藏 ---------- */}
        {tab === "favorites" && (
          <div className="p-4 space-y-2.5">
            {favorites.length === 0 && (
              <p className="text-center text-slate-400 py-12 text-sm">
                还没有收藏。课程、知识点、测验题、面试题都可以点 ⭐ 收藏到这里
              </p>
            )}
            {favorites.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 border border-border rounded-xl px-4 py-3 bg-card"
              >
                <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                  {KIND_LABEL[f.kind] ?? f.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    <Markdown content={f.title} />
                  </div>
                  {f.content && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                      <Markdown content={f.content} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    {langBadge(f.lang)}
                    <span>{new Date(f.addedAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      await removeFavorite(f.id);
                      setNotebook(await fetchNotebook());
                    }}
                    className="text-xs text-slate-300 hover:text-red-500"
                    title="取消收藏"
                  >
                    ✕
                  </button>
                  <Link
                    href={`/learn/${f.lang}/${f.lessonId}`}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    去复习 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- 笔记 ---------- */}
        {tab === "notes" && (
          <div className="p-4 space-y-3">
            {notes.length === 0 && (
              <p className="text-center text-slate-400 py-12 text-sm">
                还没有笔记。在课程页左侧的「📝 我的笔记」随手记录，会自动保存在这里
              </p>
            )}
            {notes.map((n) => (
              <div key={n.lessonId} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  {langBadge(n.lang)}
                  <span>更新于 {new Date(n.updatedAt).toLocaleString("zh-CN")}</span>
                  <Link
                    href={`/learn/${n.lang}/${n.lessonId}`}
                    className="ml-auto text-indigo-500 hover:underline"
                  >
                    打开课程 →
                  </Link>
                  <button
                    onClick={async () => {
                      await removeNote(n.lessonId);
                      setNotebook(await fetchNotebook());
                    }}
                    className="text-slate-300 hover:text-red-500"
                    title="删除笔记"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {n.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- 在线题库（LeetCode / HackerRank） ---------- */}
        {tab === "leetcode" && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bankLang}
                onChange={(e) => setBankLang(e.target.value)}
                className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
              >
                {BANK_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_META[l]?.emoji ?? ""} {LANGUAGE_META[l]?.name ?? l}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">
                可用源：{availableBanks(bankLang).join(" / ") || "—"}
              </span>
            </div>
            <ProblemBank
              key={bankLang}
              lang={bankLang}
              limit={12}
              title="🔗 题目列表"
            />
          </div>
        )}
      </div>
    </div>
  );
}
