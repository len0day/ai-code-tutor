"use client";

import { useEffect, useState } from "react";

interface TokenData {
  total: { promptTokens: number; completionTokens: number; totalTokens: number; calls: number; estimatedCalls: number };
  last7Days: { totalTokens: number; calls: number };
  today: { totalTokens: number; calls: number };
  byTask: Array<{ task: string; totalTokens: number; calls: number }>;
  byUser: Array<{ userId: string; username: string; totalTokens: number; calls: number }>;
  recent: Array<{ username: string; task: string; model: string; totalTokens: number; estimated: number; createdAt: string }>;
}

const TASK_CN: Record<string, string> = {
  tutor: "AI 导师对话",
  explain: "深入讲解",
  quiz: "练习测验",
  grade: "作业批改",
  "code-review": "代码实操分析",
  "interview-guide": "面试讲解",
  "interview-questions": "面试出题",
  "interview-grade": "面试评分",
  "interview-report": "面试报告",
  path: "学习规划",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TokenStatsCard() {
  const [data, setData] = useState<TokenData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/tokens")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("加载失败"));
  }, []);

  if (error) {
    return <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>;
  }
  if (!data) {
    return <p className="text-xs text-slate-400">Token 统计加载中…</p>;
  }

  const maxTask = Math.max(1, ...data.byTask.map((t) => t.totalTokens));

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">🔢 Token 用量统计</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            累计消耗 {fmt(data.total.totalTokens)} tokens · {data.total.calls} 次调用
            {data.total.estimatedCalls > 0 && "（含估算值）"}
          </p>
        </div>
      </div>

      {/* 概览四卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-card-2 rounded-xl p-3">
          <div className="text-lg font-bold text-indigo-600 tabular-nums">
            {fmt(data.total.totalTokens)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">累计 tokens</div>
        </div>
        <div className="bg-slate-50 dark:bg-card-2 rounded-xl p-3">
          <div className="text-lg font-bold text-cyan-600 tabular-nums">
            {fmt(data.last7Days.totalTokens)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">近 7 天</div>
        </div>
        <div className="bg-slate-50 dark:bg-card-2 rounded-xl p-3">
          <div className="text-lg font-bold text-emerald-600 tabular-nums">
            {fmt(data.today.totalTokens)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">今日</div>
        </div>
        <div className="bg-slate-50 dark:bg-card-2 rounded-xl p-3">
          <div className="text-lg font-bold text-orange-500 tabular-nums">
            {data.total.calls}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">调用次数</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 按任务 */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">按任务分布</div>
          <div className="space-y-1.5">
            {data.byTask.slice(0, 6).map((t) => (
              <div key={t.task} className="text-xs">
                <div className="flex justify-between mb-0.5">
                  <span className="text-slate-500">{TASK_CN[t.task] ?? t.task}</span>
                  <span className="text-slate-400 tabular-nums">
                    {fmt(t.totalTokens)} · {t.calls} 次
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-card-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                    style={{ width: `${(t.totalTokens / maxTask) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.byTask.length === 0 && (
              <p className="text-xs text-slate-400">暂无数据</p>
            )}
          </div>
        </div>

        {/* 按用户 */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">按用户（消耗 Top）</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.byUser.slice(0, 8).map((u) => (
              <div key={u.userId} className="flex justify-between text-xs">
                <span className="text-slate-600 truncate">{u.username}</span>
                <span className="text-slate-400 tabular-nums shrink-0 ml-2">
                  {fmt(u.totalTokens)} · {u.calls} 次
                </span>
              </div>
            ))}
            {data.byUser.length === 0 && (
              <p className="text-xs text-slate-400">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 最近明细 */}
      {data.recent.length > 0 && (
        <details className="border-t border-border pt-3">
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-indigo-500">
            最近 {data.recent.length} 条调用明细
          </summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {data.recent.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[11px] text-slate-500 border-b border-border/50 pb-1"
              >
                <span className="text-slate-400 w-20 shrink-0 truncate">{r.username}</span>
                <span className="w-24 shrink-0 truncate">{TASK_CN[r.task] ?? r.task}</span>
                <span className="font-mono text-slate-400 truncate flex-1">{r.model}</span>
                <span className="tabular-nums shrink-0">{fmt(r.totalTokens)}</span>
                {r.estimated ? (
                  <span className="shrink-0 text-amber-500" title="服务商未返回 usage，此为估算值">
                    估
                  </span>
                ) : null}
                <span className="text-slate-400 shrink-0 w-16 text-right">
                  {new Date(r.createdAt).toLocaleString("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
