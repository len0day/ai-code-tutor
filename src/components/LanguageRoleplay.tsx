"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import SpeakButton from "./SpeakButton";
import { aiJson, postProgress, streamAi } from "@/lib/client";
import type { Lesson } from "@/lib/types";

interface Round {
  speaker: string;
  /** 对方说的话（该语言原文） */
  text: string;
  /** 中文翻译 */
  translation: string;
  /** 3 个候选回答（该语言原文） */
  options: string[];
  /** 正确选项下标 */
  answerIndex: number;
  hint?: string;
  /** 学生答对后对方的下一句 */
  followUp?: string;
  followUpTranslation?: string;
  followUpOptions?: string[];
}

interface Scenario {
  title: string;
  setting: string;
  myRole: string;
  otherRole: string;
  goal: string;
  difficulty: "easy" | "medium" | "hard";
  grammarFocus?: string;
  rounds: Round[];
  sample?: string;
}

interface Props {
  lang: string;
  lesson: Lesson;
  /** 通关状态变化时通知父级刷新解锁状态 */
  onGateChange?: () => void;
}

const DIFF_CN: Record<string, string> = {
  easy: "★☆☆ 简单",
  medium: "★★☆ 中等",
  hard: "★★★ 困难",
};

/**
 * 语言场景模拟：
 * - 题目/说明全部中文，学生看中文就知道要做什么
 * - 每轮从 3 个候选回答中选一个（考察同一语法点，答案有区分度）
 * - 答对后对方接话，进入下一轮 —— 构成连续对话
 * - 全部轮次结束后由「语言老师」逐句点评 + 改进建议
 */
export default function LanguageRoleplay({ lang, lesson, onGateChange }: Props) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [score, setScore] = useState<{
    score: number;
    detail: string;
    dimensions: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [showSample, setShowSample] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    setScenario(null);
    setRoundIdx(0);
    setChosen(null);
    setHistory([]);
    setReview("");
    try {
      const data = await aiJson<Scenario>({
        task: "language-scenario",
        lang,
        lessonId: lesson.id,
      });
      if (!data.rounds || data.rounds.length === 0) {
        throw new Error("AI 未生成有效场景，请重试");
      }
      setScenario(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成场景失败");
    } finally {
      setLoading(false);
    }
  };

  const pick = (optIdx: number) => {
    if (!scenario || chosen !== null) return;
    const round = scenario.rounds[roundIdx];
    setChosen(optIdx);
    setHistory((h) => [...h, `学生：${round.options[optIdx]}`]);
    if (optIdx === round.answerIndex) {
      if (round.followUp) {
        setHistory((h) => [...h, `对方：${round.followUp}`]);
      }
    }
  };

  const nextRound = () => {
    if (!scenario) return;
    if (roundIdx < scenario.rounds.length - 1) {
      setRoundIdx((i) => i + 1);
      setChosen(null);
    } else {
      finish();
    }
  };

  const finish = async () => {
    if (!scenario) return;
    setReviewing(true);
    setError("");
    setReview("");
    const dialog = history.join("\n");
    try {
      // ① 先评分（决定闯关是否通过）
      const scoreData = await aiJson<{
        score: number;
        detail: string;
        dimensions: Record<string, number>;
      }>({
        task: "language-score",
        lang,
        lessonId: lesson.id,
        code: dialog,
      });
      setScore(scoreData);
      await postProgress({
        type: "interviewResult",
        lessonId: lesson.id,
        score: scoreData.score,
      });
      onGateChange?.();

      // ② 再生成逐句点评
      await streamAi(
        { task: "language-review", lang, lessonId: lesson.id, code: dialog },
        { onContent: (d) => setReview((p) => p + d) }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成点评失败");
    } finally {
      setReviewing(false);
    }
  };

  // ---------- 空态 ----------
  if (!scenario) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center pt-4">
          <div className="text-4xl mb-2">🎭</div>
          <p className="text-sm text-slate-500 leading-relaxed">
            AI 老师按<b className="text-rose-600">当前课程</b>的语法与词汇水平设计一个真实场景
            （点单、问路、面试、看病…）。<br />
            每轮对方说一句，你从 3 个候选回答中选出最恰当的那个，
            答对就能接上下一句 —— 构成一段连续对话。
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="w-full btn-primary text-white font-medium py-3 rounded-xl"
        >
          {loading ? "老师正在设计场景…" : "🎭 开始场景模拟"}
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          场景与选项只考「{lesson.title}」这一课学过的语法和单词
        </p>
      </div>
    );
  }

  const round = scenario.rounds[roundIdx];
  const isLast = roundIdx === scenario.rounds.length - 1;
  const answered = chosen !== null;
  const correct = answered && chosen === round.answerIndex;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 场景信息（中文） */}
      <div className="px-4 py-3 border-b border-border bg-rose-50/40 dark:bg-rose-950/20 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm">{scenario.title}</span>
              <span className="text-xs text-slate-400">
                {DIFF_CN[scenario.difficulty]}
              </span>
              <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">
                第 {roundIdx + 1}/{scenario.rounds.length} 轮
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{scenario.setting}</p>
            <p className="text-xs text-slate-500 mt-1">
              <b>你扮演</b>：{scenario.myRole} · <b>对方</b>：{scenario.otherRole}
            </p>
            <p className="text-xs text-rose-600/90 mt-1">🎯 {scenario.goal}</p>
            {scenario.grammarFocus && (
              <p className="text-xs text-slate-500 mt-0.5">
                📎 重点语法：{scenario.grammarFocus}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={generate}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-rose-500 disabled:opacity-50"
            >
              {loading ? "生成中…" : "换场景"}
            </button>
            {scenario.sample && (
              <button
                onClick={() => setShowSample((v) => !v)}
                className="text-xs text-slate-400 hover:text-rose-500"
              >
                {showSample ? "收起示范" : "看示范"}
              </button>
            )}
          </div>
        </div>

        {showSample && scenario.sample && (
          <pre className="mt-2 text-xs bg-card border border-border rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed">
            {scenario.sample}
          </pre>
        )}
      </div>

      {/* 对话记录 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {history.map((line, i) => {
          const isMe = line.startsWith("学生");
          const text = line.slice(line.indexOf("：") + 1);
          return (
            <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  isMe
                    ? "bg-rose-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap">{text}</p>
                {!isMe && (
                  <div className="flex justify-end mt-0.5">
                    <SpeakButton
                      id={`lang-${lesson.id}-${i}`}
                      text={text}
                      lang={lang}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {review && (
          <div className="border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl p-4">
            <div className="text-sm font-bold mb-2">👩‍🏫 语言老师点评</div>
            <Markdown content={review} />
            {reviewing && <span className="streaming-cursor" />}
          </div>
        )}
        {score && (
          <div className="border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                {score.score}
              </span>
              <span className="text-sm font-medium">本次场景对话得分</span>
              {score.score >= 60 ? (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-auto">
                  ✓ 已达标
                </span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-auto">
                  未达 60 分，再练一次
                </span>
              )}
            </div>
            {score.detail && (
              <p className="text-sm text-slate-600 mt-2">{score.detail}</p>
            )}
            {score.dimensions && Object.keys(score.dimensions).length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                {(
                  [
                    ["fluency", "流利度"],
                    ["grammar", "语法"],
                    ["vocabulary", "用词"],
                    ["taskCompletion", "任务达成"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="bg-card border border-border rounded-lg py-1.5">
                    <div className="text-sm font-semibold text-slate-700 tabular-nums">
                      {score.dimensions[k] ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 当前轮次 */}
      {!review && (
        <div className="px-4 pb-3 border-t border-border pt-3 shrink-0">
          {/* 对方的话 + 中文翻译 */}
          <div className="bg-slate-100 dark:bg-card-2 rounded-xl px-3.5 py-2.5 mb-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{round.text}</p>
              <SpeakButton
                id={`lang-line-${lesson.id}-${roundIdx}`}
                text={round.text}
                lang={lang}
                compact
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">💬 {round.translation}</p>
          </div>

          {/* 中文提示：该选什么 */}
          <p className="text-xs text-slate-500 mb-2">
            ✍️ 请选择最恰当的回应（考察：{scenario.grammarFocus ?? "本课语法"}）
          </p>

          <div className="space-y-2">
            {round.options.map((opt, i) => {
              const picked = chosen === i;
              const isAnswer = round.answerIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={answered}
                  className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                    answered
                      ? isAnswer
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : picked
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-border text-slate-500 opacity-60"
                      : "border-border hover:border-rose-300 hover:bg-rose-50/50 text-slate-700"
                  }`}
                >
                  <span className="font-mono text-xs text-slate-400 mr-2">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                  {answered && isAnswer && <span className="ml-2">✓ 正确</span>}
                  {answered && picked && !isAnswer && <span className="ml-2">✗ 再想想</span>}
                </button>
              );
            })}
          </div>

          {answered && !correct && round.hint && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              💡 {round.hint}
            </p>
          )}
          {answered && correct && (
            <p className="mt-2 text-xs text-emerald-600">
              ✓ 很棒！对方会这样接话↓
            </p>
          )}

          {answered && (
            <button
              onClick={nextRound}
              className="mt-3 w-full btn-primary text-white text-sm font-medium py-2.5 rounded-xl"
            >
              {isLast ? "结束对话，让老师点评 →" : "下一轮 →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
