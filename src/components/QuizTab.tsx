"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import { addWrongQuestion, aiJson, postProgress, toggleFavorite } from "@/lib/client";
import type { Lesson } from "@/lib/types";

interface ChoiceQ {
  id: string;
  type: "choice";
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface CodeQ {
  id: string;
  type: "code";
  question: string;
  starterCode: string;
  referenceAnswer: string;
  explanation: string;
}

type Question = ChoiceQ | CodeQ;

interface GradeResult {
  id: string;
  score: number;
  pass: boolean;
  feedback: string;
}

interface Props {
  lang: string;
  lesson: Lesson;
  onScored?: (score: number) => void;
  /** 通关状态变化时通知父级刷新解锁状态 */
  onGateChange?: () => void;
}

export default function QuizTab({ lang, lesson, onScored, onGateChange }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [codeResults, setCodeResults] = useState<Record<string, GradeResult>>({});
  const [favMap, setFavMap] = useState<Record<string, boolean>>({});
  const [fromCache, setFromCache] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");

  const generate = async (force = false) => {
    setLoading(true);
    setError("");
    setQuestions(null);
    setChoices({});
    setCodes({});
    setCodeResults({});
    setShowExplanations(false);
    setFinalScore(null);
    setFromCache(false);
    try {
      const data = await aiJson<{ questions: Question[]; cached?: boolean }>({
        task: "quiz",
        lang,
        lessonId: lesson.id,
        force,
      });
      const qs = data.questions.filter(
        (q) =>
          (q.type === "choice" && Array.isArray(q.options)) ||
          (q.type === "code" && typeof q.question === "string")
      );
      if (qs.length === 0) throw new Error("生成的题目无效，请重试");
      setQuestions(qs);
      setFromCache(data.cached === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出题失败");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!questions) return;
    setGrading(true);
    setError("");
    try {
      const codeQs = questions.filter((q): q is CodeQ => q.type === "code");
      const needGrading = codeQs.filter((q) => (codes[q.id] ?? "").trim());

      let results: Record<string, GradeResult> = {};
      if (needGrading.length > 0) {
        const payload = needGrading.map((q) => ({
          id: q.id,
          type: "code",
          question: q.question,
          referenceAnswer: q.referenceAnswer,
        }));
        const answers = needGrading.map((q) => ({
          id: q.id,
          answer: codes[q.id],
        }));
        const data = await aiJson<{ results: GradeResult[] }>({
          task: "grade",
          lang,
          lessonId: lesson.id,
          questions: payload,
          answers,
        });
        results = Object.fromEntries(data.results.map((r) => [r.id, r]));
      }
      setCodeResults(results);
      setShowExplanations(true);

      // 计算总分：选择题 20 分/题，编程题按 AI 评分折算 20 分/题
      const choiceQs = questions.filter((q): q is ChoiceQ => q.type === "choice");
      let score = 0;
      for (const q of choiceQs) {
        if (choices[q.id] === q.answer) score += 20;
      }
      for (const q of codeQs) {
        const r = results[q.id];
        if (r) score += Math.round((r.score / 100) * 20);
      }
      setFinalScore(score);

      const wrongIds = [
        ...choiceQs.filter((q) => choices[q.id] !== q.answer).map((q) => q.id),
        ...codeQs.filter((q) => results[q.id] && !results[q.id].pass).map((q) => q.id),
      ];
      await postProgress({
        type: "quizResult",
        lessonId: lesson.id,
        score,
        wrongIds,
      });
      onScored?.(score);
      onGateChange?.(); // 刷新闯关解锁状态

      // 错题自动归入知识库「错题本」
      for (const q of choiceQs) {
        if (choices[q.id] !== q.answer) {
          await addWrongQuestion({
            lessonId: lesson.id,
            lang,
            source: "quiz",
            kind: "choice",
            question: q.question,
            options: q.options,
            answerIndex: q.answer,
            explanation: q.explanation,
            userAnswer: choices[q.id],
          });
        }
      }
      for (const q of codeQs) {
        const r = results[q.id];
        if (r && !r.pass) {
          await addWrongQuestion({
            lessonId: lesson.id,
            lang,
            source: "quiz",
            kind: "code",
            question: q.question,
            explanation: `${r.feedback}\n\n**参考实现：**\n\`\`\`\n${q.referenceAnswer}\n\`\`\``,
            userAnswer: codes[q.id],
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "批改失败");
    } finally {
      setGrading(false);
    }
  };

  const favoriteQuestion = async (q: Question) => {
    const content =
      q.type === "choice"
        ? `正确答案 ${String.fromCharCode(65 + q.answer)}。${q.explanation}`
        : q.explanation;
    const added = await toggleFavorite({
      lessonId: lesson.id,
      lang,
      kind: "quiz-question",
      title: q.question,
      content,
    });
    setFavMap((p) => ({ ...p, [q.id]: added }));
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {!questions ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm text-slate-500 mb-4">
            AI 将根据「{lesson.title}」的知识点出 5 道题（3 选择 + 2 编程），
            提交后自动批改并讲解错因。
          </p>
          <button
            onClick={() => generate(false)}
            disabled={loading}
            className="btn-primary disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            {loading ? "AI 正在出题…" : "生成测验"}
          </button>
        </div>
      ) : (
        <>
          {fromCache && (
            <p className="text-xs text-slate-400 bg-slate-50 border border-border rounded-lg px-3 py-2">
              ♻️ 本套题复用了之前生成的缓存（不再调用 AI）——想换新题点下方「再来一套题」
            </p>
          )}
          {questions.map((q, qi) => (
            <div key={q.id} className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-start gap-2">
                <p className="font-medium text-sm mb-3 flex-1">
                  <span className="text-indigo-500 mr-1.5">{qi + 1}.</span>
                  {q.type === "choice" ? "【选择】" : "【实战】"}
                  {q.question}
                </p>
                {showExplanations && (
                  <button
                    onClick={() => favoriteQuestion(q)}
                    title={favMap[q.id] ? "已收藏，点击取消" : "收藏本题"}
                    className={`shrink-0 text-sm transition-colors ${
                      favMap[q.id] ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                    }`}
                  >
                    {favMap[q.id] ? "★" : "☆"}
                  </button>
                )}
              </div>

              {q.type === "choice" ? (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = choices[q.id] === oi;
                    const isCorrect = showExplanations && oi === q.answer;
                    const isWrongPick = showExplanations && selected && oi !== q.answer;
                    return (
                      <label
                        key={oi}
                        className={`flex items-center gap-2.5 text-sm rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50"
                            : isWrongPick
                              ? "border-red-300 bg-red-50"
                              : selected
                                ? "border-indigo-300 bg-indigo-50"
                                : "border-border hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={selected}
                          disabled={showExplanations}
                          onChange={() => setChoices((p) => ({ ...p, [q.id]: oi }))}
                          className="accent-indigo-600"
                        />
                        <span className="font-mono text-xs text-slate-400">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={codes[q.id] ?? ""}
                  onChange={(e) => setCodes((p) => ({ ...p, [q.id]: e.target.value }))}
                  disabled={showExplanations}
                  rows={6}
                  placeholder={q.starterCode || "// 在这里作答（代码 / 命令 / 例句）"}
                  className="w-full font-mono text-xs bg-[#0b1224] text-[#d8e2f5] border border-[#23304d] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}

              {/* 编程题 AI 批改结果 */}
              {q.type === "code" && codeResults[q.id] && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                    codeResults[q.id].pass
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  <span className="font-semibold">
                    AI 评分：{codeResults[q.id].score} 分
                    {codeResults[q.id].pass ? " ✅ 通过" : " ❌ 未通过"}
                  </span>
                  <div className="mt-1 text-slate-600">
                    <Markdown content={codeResults[q.id].feedback} />
                  </div>
                </div>
              )}

              {/* 解析 */}
              {showExplanations && (
                <div className="mt-3 text-sm bg-slate-50 rounded-lg px-3 py-2 text-slate-600">
                  <span className="font-medium text-slate-700">解析：</span>
                  {q.type === "choice" &&
                    `正确答案 ${String.fromCharCode(65 + q.answer)}。`}
                  <Markdown content={q.explanation} />
                  {q.type === "code" && q.referenceAnswer && !codeResults[q.id] && (
                    <pre className="mt-2 font-mono text-xs bg-[#0b1224] text-[#d8e2f5] rounded-lg p-2.5 overflow-x-auto">
                      {q.referenceAnswer}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {finalScore !== null && (
            <div
              className={`rounded-xl p-4 text-center ${
                finalScore >= 60 ? "bg-emerald-50" : "bg-amber-50"
              }`}
            >
              <p className="text-lg font-bold">
                {finalScore >= 60 ? "🎉" : "💪"} 得分 {finalScore} / 100
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {finalScore >= 60
                  ? "🎯 测验已达标！再完成「模拟面试 / 场景对话」即可通关并解锁下一课。"
                  : "别灰心，看看解析再试一次，或问问 AI 导师。"}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {!showExplanations ? (
              <button
                onClick={submit}
                disabled={grading}
                className="flex-1 btn-primary disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {grading ? "AI 批改中…" : "提交答案"}
              </button>
            ) : (
              <button
                onClick={() => generate(true)}
                className="flex-1 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                再来一套新题
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
