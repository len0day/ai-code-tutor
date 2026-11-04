"use client";

import { useEffect, useState } from "react";
import Markdown from "@/components/Markdown";

interface CacheEntry {
  cacheKey: string;
  task: string;
  lang: string | null;
  lessonId: string | null;
  content: string;
  createdAt: string;
  size: number;
}

const TASK_CN: Record<string, string> = {
  explain: "AI 深入讲解",
  "language-teach": "语言精讲",
  "interview-guide": "面试高频题讲解",
  quiz: "练习测验题",
  "interview-questions": "模拟面试题",
  tutor: "导师对话",
};

function fmtSize(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** 管理员：查看缓存下来的讲解 / 试题全文 */
export default function CacheViewer() {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [selected, setSelected] = useState<CacheEntry | null>(null);
  const [taskFilter, setTaskFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/cache")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setEntries(d.entries ?? []);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/cache")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setEntries(d.entries ?? []);
      })
      .catch(() => {
        if (alive) setError("加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const open = async (key: string) => {
    const res = await fetch(`/api/admin/cache?key=${encodeURIComponent(key)}`);
    const d = await res.json();
    if (!d.error) setSelected(d);
  };

  const filtered = taskFilter
    ? entries.filter((e) => e.task === taskFilter)
    : entries;
  const tasks = Array.from(new Set(entries.map((e) => e.task)));

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="font-bold text-sm">🗄 缓存内容查看器</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            已生成的讲解与试题全文（命中缓存不再调用 AI）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card"
          >
            <option value="">全部类型（{entries.length}）</option>
            {tasks.map((t) => (
              <option key={t} value={t}>
                {TASK_CN[t] ?? t}（{entries.filter((e) => e.task === t).length}）
              </option>
            ))}
          </select>
          <button onClick={load} className="text-xs text-slate-400 hover:text-indigo-600">
            ↻ 刷新
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {loading && <p className="text-xs text-slate-400 py-4">加载中…</p>}
      {!loading && filtered.length === 0 && !error && (
        <p className="text-xs text-slate-400 py-4">暂无缓存内容</p>
      )}

      {filtered.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {filtered.map((e) => (
            <button
              key={e.cacheKey}
              onClick={() => open(e.cacheKey)}
              className="w-full text-left flex items-center gap-2 text-xs border border-border rounded-lg px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded shrink-0">
                {TASK_CN[e.task] ?? e.task}
              </span>
              <span className="font-mono text-slate-500 truncate flex-1">
                {e.lessonId ?? e.cacheKey}
              </span>
              <span className="text-slate-400 shrink-0">{fmtSize(e.size)}</span>
              <span className="text-slate-400 shrink-0 w-28 text-right">
                {new Date(e.createdAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 详情弹层 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label="缓存内容详情"
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">
                  {TASK_CN[selected.task] ?? selected.task}
                </div>
                <div className="text-xs text-slate-400 font-mono truncate">
                  {selected.lessonId ?? selected.cacheKey}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-red-500 text-lg leading-none px-2"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto text-sm">
              <Markdown content={selected.content} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
