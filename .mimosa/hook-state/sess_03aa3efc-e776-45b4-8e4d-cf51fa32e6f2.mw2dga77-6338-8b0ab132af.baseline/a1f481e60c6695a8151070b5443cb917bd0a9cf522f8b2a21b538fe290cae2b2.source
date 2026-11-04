"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import ReasoningBlock from "./ReasoningBlock";
import SpeakButton from "./SpeakButton";
import {
  streamAi,
  fetchChat,
  saveChatMemory,
  clearChatMemory,
  type AiChatMessage,
} from "@/lib/client";
import type { Lesson } from "@/lib/types";

interface Props {
  lang: string;
  langName: string;
  lesson: Lesson;
}

const QUICK_ASKS = [
  "用最简单的话解释这个概念",
  "多给我几个例子",
  "初学者容易犯哪些错？",
  "出两道题考考我",
];

function greetingFor(lesson: Lesson): AiChatMessage {
  return {
    role: "assistant",
    content: `你好！我是本课的 AI 导师 👋 当前课程：**${lesson.title}**。\n可以直接问我任何问题，比如"什么是${lesson.keyPoints[0] ?? "本课内容"}？"`,
  };
}

export default function ChatPanel({ lang, langName, lesson }: Props) {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => [greetingFor(lesson)]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  /** 从长期记忆恢复的历史条数（用于提示） */
  const [restored, setRestored] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 切换课程时先重置为问候语（渲染期调整状态）
  const [prevLessonId, setPrevLessonId] = useState(lesson.id);
  if (prevLessonId !== lesson.id) {
    setPrevLessonId(lesson.id);
    setMessages([greetingFor(lesson)]);
    setInput("");
    setError("");
    setRestored(null);
  }

  // 从长期记忆恢复本课历史对话（异步回调中更新状态）
  useEffect(() => {
    let alive = true;
    fetchChat(lesson.id)
      .then((history) => {
        if (!alive || history.length === 0) return;
        setMessages(history);
        setRestored(history.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lesson.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const clearHistory = async () => {
    await clearChatMemory(lesson.id);
    setMessages([greetingFor(lesson)]);
    setRestored(null);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;

    const history: AiChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "", reasoning: "" }]);
    setInput("");
    setStreaming(true);
    setError("");

    // 本地累积，流结束后一次性持久化
    let accContent = "";
    let accReasoning = "";

    try {
      await streamAi(
        { task: "tutor", lang, lessonId: lesson.id, messages: history },
        {
          onContent: (delta) => {
            accContent += delta;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + delta };
              return next;
            });
          },
          onReasoning: (delta) => {
            accReasoning += delta;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                reasoning: (last.reasoning ?? "") + delta,
              };
              return next;
            });
          },
        }
      );
      // 流结束 → 写入长期记忆
      const finalMsgs: AiChatMessage[] = [
        ...history,
        { role: "assistant", content: accContent, reasoning: accReasoning || undefined },
      ];
      setMessages(finalMsgs);
      saveChatMemory(lesson.id, finalMsgs).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
      // 移除空的占位回复
      setMessages((prev) =>
        prev[prev.length - 1].content || prev[prev.length - 1].reasoning
          ? prev
          : prev.slice(0, -1)
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 记忆状态栏 */}
      <div className="flex items-center justify-end gap-2 px-4 pt-2.5 text-[11px] text-slate-400 shrink-0">
        {restored !== null && restored > 0 && (
          <span className="mr-auto">🧠 已从记忆恢复 {restored} 条历史对话</span>
        )}
        {messages.length > 1 && (
          <button
            onClick={clearHistory}
            className="hover:text-red-500 transition-colors"
            title="清空本课的对话记忆（不影响错题本）"
          >
            🧹 清空对话记忆
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px]">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          return (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                }`}
              >
                {m.role === "assistant" && (
                  <ReasoningBlock
                    reasoning={m.reasoning ?? ""}
                    thinking={streaming && isLast && !m.content}
                  />
                )}
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : m.content ? (
                  <Markdown content={m.content} />
                ) : streaming && isLast ? (
                  <span className="streaming-cursor text-slate-400" />
                ) : null}
                {m.role === "assistant" && m.content && !streaming && (
                  <div className="flex justify-end mt-1 -mb-1">
                    <SpeakButton
                      id={`chat-${lesson.id}-${i}`}
                      text={m.content}
                      lang={lang}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="mx-4 mb-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 快捷提问 */}
      {messages.length <= 1 && !streaming && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {QUICK_ASKS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t border-border p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={`向 ${langName} 导师提问…（Enter 发送，Shift+Enter 换行）`}
          className="flex-1 resize-none text-sm border border-border rounded-xl px-3.5 py-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 max-h-32"
        />
        <button
          onClick={() => send(input)}
          disabled={streaming || !input.trim()}
          className="btn-primary disabled:opacity-40 text-white text-sm font-medium px-4 rounded-xl transition-colors shrink-0"
        >
          {streaming ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
