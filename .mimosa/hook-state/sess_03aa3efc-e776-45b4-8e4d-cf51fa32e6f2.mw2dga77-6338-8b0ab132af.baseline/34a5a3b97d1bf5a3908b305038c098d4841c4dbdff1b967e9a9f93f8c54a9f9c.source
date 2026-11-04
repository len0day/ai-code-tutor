"use client";

import { useState } from "react";
import { useTts } from "@/lib/ttsClient";

/**
 * Markdown → 适合朗读的纯文本。
 * - 去掉代码块、链接、格式符号
 * - 语言课程（lang 传入）支持按「译：」标记切分原文 / 翻译，
 *   以实现「日语读日语、中文读中文」
 */
export function mdToSpeechText(
  md: string,
  opts?: { part?: "all" | "foreign" | "translation" }
): string {
  const part = opts?.part ?? "all";

  // 先按「译：」行切分
  const lines = md.split("\n");
  const foreign: string[] = [];
  const translation: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(译|翻译|中文)[:：]/.test(t)) {
      translation.push(t.replace(/^(译|翻译|中文)[:：]\s*/, ""));
    } else {
      foreign.push(line);
    }
  }

  const clean = (text: string) =>
    text
      .replace(/```[\s\S]*?```/g, "（代码示例略）")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\|/g, " ")
      .replace(/^-{3,}$/gm, "")
      .replace(/^\s*読み[:：].*$/gm, "") // 读音行不单独念（假名与原文重复）
      .replace(/\n{2,}/g, " ")
      .replace(/\n/g, " ")
      .trim();

  if (part === "foreign") return clean(foreign.join("\n"));
  if (part === "translation") return clean(translation.join(" "));
  return clean(md);
}

interface Props {
  /** 全局唯一键，用于标记当前播放中的按钮 */
  id: string;
  /** 要朗读的 Markdown 文本（自动转纯文本） */
  text: string;
  /** 课程语言：用于选择对应的 TTS 语音（日语 → ja-JP-NanamiNeural） */
  lang?: string;
  /** 朗读内容范围：foreign=只读原文 / translation=只读翻译 / all=全部 */
  part?: "all" | "foreign" | "translation";
  compact?: boolean;
  className?: string;
  label?: string;
}

export default function SpeakButton({
  id,
  text,
  lang,
  part = "all",
  compact,
  className,
  label,
}: Props) {
  const { speak, stop, activeKey, loadingKey } = useTts();
  const [error, setError] = useState("");

  const isLoading = loadingKey === id;
  const isPlaying = activeKey === id;
  const speechText = mdToSpeechText(text, { part });

  if (!speechText) return null;

  const handle = () => {
    if (isPlaying) {
      stop();
      return;
    }
    setError("");
    speak(id, speechText, lang).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "朗读失败";
      setError(msg);
      setTimeout(() => setError(""), 4000);
    });
  };

  const icon = isPlaying ? "⏹" : isLoading ? "⏳" : "🔊";
  const title = isPlaying ? "停止朗读" : isLoading ? "合成中…" : label ?? "朗读";
  const cls = compact
    ? "text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-200 transition-colors"
    : "text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-indigo-50 transition-colors";

  return (
    <button
      onClick={handle}
      title={error || title}
      className={`${cls} ${error ? "text-red-500" : isPlaying ? "text-indigo-600" : "text-slate-400"} ${className ?? ""}`}
    >
      {icon}
      {!compact && <span className="ml-1">{label ?? "朗读"}</span>}
    </button>
  );
}
