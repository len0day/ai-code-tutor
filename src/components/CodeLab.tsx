"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import ReasoningBlock from "./ReasoningBlock";
import SpeakButton from "./SpeakButton";
import { streamAi } from "@/lib/client";
import type { Lesson } from "@/lib/types";

interface Props {
  lang: string;
  lesson: Lesson;
}

interface RunResult {
  ok: boolean;
  label: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  notice?: string;
}

/** 可直接运行的语言（本机已内置解释器） */
const RUNNABLE = new Set(["python", "javascript", "typescript", "nextjs", "go"]);

const SAMPLE = `// 在这里动手写代码
// 可以先点右上角「填入本课示例」有个起点
// 写完点「▶ 运行」看真实结果`;

export default function CodeLab({ lang, lesson }: Props) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  const canRun = RUNNABLE.has(lang);

  /** 在本机运行代码，展示 stdout / stderr 原文 */
  const run = async () => {
    if (!code.trim() || running) return;
    setRunning(true);
    setRunResult(null);
    setError("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, lang }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "运行失败");
        return;
      }
      setRunResult(data as RunResult);
    } catch {
      setError("运行请求失败");
    } finally {
      setRunning(false);
    }
  };

  /** 把代码（可选连同运行报错）交给 AI 讲解与诊断 */
  const askAi = async (withError: boolean) => {
    if (!code.trim() || streaming) return;
    const payload = {
      task: "code-review",
      lang,
      lessonId: lesson.id,
      code: withError && runResult?.stderr
        ? `${code}\n\n【运行时的错误输出】\n${runResult.stderr}`
        : code,
    };
    setResult("");
    setReasoning("");
    setError("");
    setStreaming(true);
    try {
      await streamAi(payload, {
        onContent: (delta) => setResult((prev) => prev + delta),
        onReasoning: (delta) => setReasoning((prev) => prev + delta),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 分析失败");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-sm font-medium text-slate-600">
            动手写 → 跑起来 → AI 帮你挑毛病
          </label>
          {lesson.example && (
            <button
              onClick={() => setCode(lesson.example!.code)}
              className="text-xs text-indigo-600 hover:underline shrink-0"
            >
              填入本课示例
            </button>
          )}
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={10}
          placeholder={SAMPLE}
          spellCheck={false}
          className="w-full font-mono text-xs bg-[#0b1224] text-[#d8e2f5] border border-[#23304d] rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {!canRun && (
          <p className="text-[11px] text-amber-600 mt-1.5">
            ⚠️ 当前语言（{lang}）未内置解释器，可让 AI 讲解代码，但无法直接运行。
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={run}
          disabled={running || !code.trim() || !canRun}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          title={canRun ? "在本机运行这段代码" : "当前语言未内置解释器"}
        >
          {running ? "运行中…" : "▶ 运行"}
        </button>
        <button
          onClick={() => askAi(false)}
          disabled={streaming || !code.trim()}
          className="flex-1 btn-primary disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {streaming ? "AI 分析中…" : "🤖 AI 讲解与找 Bug"}
        </button>
      </div>

      {runResult && (
        <div
          className={`rounded-xl border p-3.5 ${
            runResult.ok
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-red-200 bg-red-50/60"
          }`}
        >
          <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
            <span
              className={`font-semibold ${
                runResult.ok ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {runResult.ok ? "✓ 运行成功" : "✗ 运行失败"}
            </span>
            <span className="text-slate-400">{runResult.label}</span>
            {runResult.exitCode !== null && (
              <span className="text-slate-400">退出码 {runResult.exitCode}</span>
            )}
            <span className="text-slate-400">{runResult.durationMs} ms</span>
            {!runResult.ok && !runResult.notice && (
              <button
                onClick={() => askAi(true)}
                disabled={streaming}
                className="ml-auto text-red-600 hover:underline disabled:opacity-50"
              >
                {streaming ? "AI 分析中…" : "🔍 让 AI 分析这个报错"}
              </button>
            )}
          </div>

          {runResult.notice && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              {runResult.notice}
            </p>
          )}

          {runResult.timedOut && (
            <p className="text-xs text-red-600 mb-2">
              ⏱ 执行超时（超过 8 秒已被强制终止）
            </p>
          )}

          {runResult.stdout && (
            <div className="mb-2">
              <div className="text-[11px] font-medium text-slate-500 mb-1">
                标准输出 stdout
              </div>
              <pre className="text-[11px] font-mono bg-[#0b1224] text-[#d8e2f5] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
                {runResult.stdout}
              </pre>
            </div>
          )}

          {runResult.stderr && (
            <div>
              <div className="text-[11px] font-medium text-red-600 mb-1">
                错误输出 stderr（原文）
              </div>
              <pre className="text-[11px] font-mono bg-[#0b1224] text-[#ffb4a8] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
                {runResult.stderr}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      {(reasoning || streaming) && (
        <ReasoningBlock reasoning={reasoning} thinking={streaming && !result} />
      )}

      {result && (
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="text-xs font-semibold text-slate-500 mb-2">
            🤖 AI 教练点评
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Markdown content={result} />
            </div>
            {!streaming && (
              <SpeakButton id={`lab-${lesson.id}`} text={result} lang={lang} compact />
            )}
          </div>
          {streaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  );
}
