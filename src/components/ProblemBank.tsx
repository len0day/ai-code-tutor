"use client";

import { useEffect, useState } from "react";
import {
  availableBanks,
  fetchHackerRankProblems,
  fetchLeetCodeProblems,
  HR_TRACKS,
  lessonToLcTags,
  type BankSource,
} from "@/lib/client";
import type { LeetCodeProblem } from "@/lib/types";

const DIFF_COLOR: Record<string, string> = {
  Easy: "text-emerald-600 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Hard: "text-red-600 bg-red-50 border-red-200",
};
const DIFF_CN: Record<string, string> = { Easy: "简单", Medium: "中等", Hard: "困难" };

const LC_TOPICS = [
  "", "array", "string", "hash-table", "linked-list", "stack", "queue",
  "tree", "graph", "sorting", "binary-search", "two-pointers",
  "dynamic-programming", "greedy", "recursion", "design", "math",
];
const HR_TRACK_LABELS: Record<string, string> = {
  python: "Python",
  java: "Java",
  algorithms: "算法 Algorithms",
  "data-structures": "数据结构",
  shell: "Linux Shell",
};

interface ProblemRow {
  key: string;
  idLabel: string;
  title: string;
  url: string;
  difficulty: "Easy" | "Medium" | "Hard";
  rate: string | null;
  source: string;
}

interface Props {
  /** 课程语言：决定可用题库源与默认标签 */
  lang: string;
  lessonTitle?: string;
  lessonSummary?: string;
  limit?: number;
  title?: string;
  /** 组件级强制刷新键 */
  refreshKey?: number;
}

/**
 * 双题库面板：LeetCode / HackerRank 源切换。
 * 编程语言课两库可用；Linux 用 Shell track；其余课程不渲染本组件。
 */
export default function ProblemBank({
  lang,
  lessonTitle,
  lessonSummary,
  limit = 6,
  title,
  refreshKey = 0,
}: Props) {
  const banks = availableBanks(lang);
  const [source, setSource] = useState<BankSource>(banks[0] ?? "leetcode");
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // LC 参数
  const [lcTopic, setLcTopic] = useState("");
  const [lcSearch, setLcSearch] = useState("");
  // HR 参数
  const [hrTrack, setHrTrack] = useState(HR_TRACKS[lang] ?? "algorithms");
  const [hrSearch, setHrSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (source === "leetcode") {
        const tags = Array.from(
          new Set([
            ...lessonToLcTags(lang, lessonTitle ?? "", lessonSummary ?? "").filter(
              (t) => !lcTopic || t !== lang || t === lcTopic
            ),
            ...(lcTopic ? [lcTopic] : []),
          ])
        );
        const d = await fetchLeetCodeProblems({
          tags: tags.length ? tags : undefined,
          search: lcSearch || undefined,
          limit,
        });
        setRows(
          d.problems.map((p: LeetCodeProblem) => ({
            key: p.titleSlug,
            idLabel: `#${p.frontendQuestionId}`,
            title: p.titleCn,
            url: `https://leetcode.cn/problems/${p.titleSlug}/description/`,
            difficulty: p.difficulty,
            rate: `${p.acRate}%`,
            source: "leetcode.cn",
          }))
        );
        setMeta(`共 ${d.total} 道匹配 · ${d.source} · 标签: ${Array.from(new Set(tags)).join(" / ") || "—"}`);
      } else {
        const d = await fetchHackerRankProblems({
          track: hrTrack,
          search: hrSearch || undefined,
          limit,
        });
        setRows(
          d.problems.map((p) => ({
            key: p.id,
            idLabel: "HR",
            title: p.title,
            url: p.url,
            difficulty: p.difficulty,
            rate: p.acRate === null ? null : `${p.acRate}%`,
            source: d.source,
          }))
        );
        setMeta(`${d.source} · ${HR_TRACK_LABELS[hrTrack] ?? hrTrack}${hrSearch ? ` · 搜索"${hrSearch}"` : ""}`);
      }
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取失败");
    } finally {
      setLoading(false);
    }
  };

  // 源/参数变化自动拉取（事件处理里的手动刷新走 load）
  useEffect(() => {
    if (!source) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (source === "leetcode") {
          const tags = lessonToLcTags(lang, lessonTitle ?? "", lessonSummary ?? "");
          const d = await fetchLeetCodeProblems({
            tags,
            search: lcSearch || undefined,
            limit,
          });
          if (!alive) return;
          setRows(
            d.problems.map((p) => ({
              key: p.titleSlug,
              idLabel: `#${p.frontendQuestionId}`,
              title: p.titleCn,
              url: `https://leetcode.cn/problems/${p.titleSlug}/description/`,
              difficulty: p.difficulty,
              rate: `${p.acRate}%`,
              source: "leetcode.cn",
            }))
          );
          setMeta(`共 ${d.total} 道匹配 · ${d.source} · 标签: ${tags.join(" / ") || "—"}`);
        } else {
          const d = await fetchHackerRankProblems({
            track: hrTrack,
            search: hrSearch || undefined,
            limit,
          });
          if (!alive) return;
          setRows(
            d.problems.map((p) => ({
              key: p.id,
              idLabel: "HR",
              title: p.title,
              url: p.url,
              difficulty: p.difficulty,
              rate: p.acRate === null ? null : `${p.acRate}%`,
              source: d.source,
            }))
          );
          setMeta(`${d.source} · ${HR_TRACK_LABELS[hrTrack] ?? hrTrack}`);
        }
        setLoaded(true);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "获取失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, lang, refreshKey]);

  if (banks.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium">{title ?? "🔗 在线题库实战"}</div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-indigo-600 disabled:opacity-50"
        >
          {loading ? "拉取中…" : "↻ 换一批"}
        </button>
      </div>

      {/* 源切换 */}
      {banks.length > 1 && (
        <div className="flex text-xs font-medium border border-border rounded-lg overflow-hidden w-fit">
          {banks.map((b) => (
            <button
              key={b}
              onClick={() => setSource(b)}
              className={`px-3 py-1.5 transition-colors ${
                source === b
                  ? "bg-indigo-600 text-white"
                  : "bg-card text-slate-500 hover:bg-slate-50"
              }`}
            >
              {b === "leetcode" ? "LeetCode" : "HackerRank"}
            </button>
          ))}
        </div>
      )}

      {/* 参数区 */}
      {source === "leetcode" ? (
        <div className="flex flex-wrap gap-2">
          <select
            value={lcTopic}
            onChange={(e) => setLcTopic(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card"
          >
            <option value="">按课程推荐</option>
            {LC_TOPICS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={lcSearch}
            onChange={(e) => setLcSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="关键词…"
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card flex-1 min-w-[120px]"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select
            value={hrTrack}
            onChange={(e) => setHrTrack(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card"
          >
            {Object.entries(HR_TRACK_LABELS).map(([t, label]) => (
              <option key={t} value={t}>{label}</option>
            ))}
          </select>
          <input
            value={hrSearch}
            onChange={(e) => setHrSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="关键词…"
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card flex-1 min-w-[120px]"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {loaded && rows.length === 0 && !error && (
        <p className="text-xs text-slate-400">没有找到匹配的题目</p>
      )}

      {rows.map((p) => (
        <a
          key={p.key}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 bg-slate-50 hover:bg-indigo-50 border border-border rounded-xl px-3.5 py-2.5 transition-colors"
        >
          <span className="text-xs text-slate-400 w-9 shrink-0">{p.idLabel}</span>
          <span className="text-sm font-medium truncate flex-1">{p.title}</span>
          {p.rate && <span className="text-xs text-slate-400 shrink-0">{p.rate}</span>}
          <span
            className={`text-xs px-1.5 py-0.5 rounded-md border shrink-0 ${DIFF_COLOR[p.difficulty]}`}
          >
            {DIFF_CN[p.difficulty]}
          </span>
        </a>
      ))}

      {loaded && rows.length > 0 && (
        <p className="text-[11px] text-slate-400">{meta}</p>
      )}
    </div>
  );
}
