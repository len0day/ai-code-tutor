"use client";

/**
 * 思考过程折叠块 —— 默认收起，点击展开。
 * 思考中（尚无正文）时摘要显示「思考中…」。
 */
export default function ReasoningBlock({
  reasoning,
  thinking,
}: {
  reasoning: string;
  /** 是否仍在思考中（流式未出正文） */
  thinking?: boolean;
}) {
  if (!reasoning && !thinking) return null;
  return (
    <details className="mb-2 group/think">
      <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-indigo-500 transition-colors flex items-center gap-1">
        <span className={thinking ? "animate-pulse" : ""}>🤔</span>
        {thinking ? "思考中…" : "思考过程"}
      </summary>
      {reasoning && (
        <div className="mt-1.5 text-xs text-slate-500 leading-relaxed whitespace-pre-wrap border-l-2 border-indigo-100 pl-2.5 max-h-48 overflow-y-auto">
          {reasoning}
        </div>
      )}
    </details>
  );
}
