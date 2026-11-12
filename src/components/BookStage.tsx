"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 全屏图书阅读器（课程学习页）
 *
 *  - 左页 = 本书页目录：要点 / 示例 / 讲解（+ 讲解分节小页）/ 题库 / 练习测验 / 模拟面试
 *  - 右页 = 当前页正文，翻页动画、键盘 ←/→
 *  - pages 支持 children（AI 讲解按段落拆出的分节小页，挂在「讲解」下面）
 *  - 笔记不在书里：由外部工具抽屉（ToolDrawer）承载，页眉放快捷按钮
 */

export interface BookPageChild {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface BookPageDef {
  id: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
  children?: BookPageChild[];
}

interface FlatEntry {
  key: string;
  label: string;
  icon?: string;
  depth: 0 | 1;
  content: React.ReactNode;
}

interface BookStageProps {
  courseName: string;
  courseEmoji: string;
  lessonTitle: string;
  levelName: string;
  index: number;
  total: number;
  /** 书页定义（顺序即目录顺序） */
  pages: BookPageDef[];
  /** 页眉右侧动作（收藏 / 笔记按钮等） */
  headerRight?: React.ReactNode;
  /** 外部希望跳转到的页 id（如讲解生成完成后跳到第一节） */
  focusPageId?: string | null;
}

export default function BookStage({
  courseName,
  courseEmoji,
  lessonTitle,
  levelName,
  index,
  total,
  pages,
  headerRight,
  focusPageId,
}: BookStageProps) {
  const flat = useMemo<FlatEntry[]>(
    () =>
      pages.flatMap((p) => [
        { key: p.id, label: p.label, icon: p.icon, depth: 0 as const, content: p.content },
        ...(p.children ?? []).map((c) => ({
          key: c.id,
          label: c.label,
          icon: undefined,
          depth: 1 as const,
          content: c.content,
        })),
      ]),
    [pages]
  );

  const [key, setKey] = useState(flat[0]?.key ?? "");
  const [flipKey, setFlipKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; ok: boolean } | null>(null);

  // pages 变化（如讲解分节生成）后当前页可能消失 → 回退到最近的有效页
  useEffect(() => {
    if (!flat.some((e) => e.key === key)) {
      setKey(flat[0]?.key ?? "");
    }
  }, [flat, key]);

  // 外部聚焦（讲解生成完成 → 打开第一节）
  useEffect(() => {
    if (focusPageId && flat.some((e) => e.key === focusPageId)) {
      setKey(focusPageId);
      setFlipKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPageId]);

  const idx = Math.max(
    0,
    flat.findIndex((e) => e.key === key)
  );
  const current = flat[idx] ?? flat[0];

  /** 当前页所属的顶级页（移动端页签第二行显示它的子页） */
  const activeGroup = pages.find(
    (p) => p.id === current.key || (p.children ?? []).some((c) => c.id === current.key)
  );

  /** 移动端滑动翻页：横向滑动切上一/下一页（避开代码块与可横向滚动区） */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      ok: !t.closest("pre, code, input, textarea, select, .no-swipe"),
    };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s?.ok) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 56) {
      if (dx < 0) flipTo(idx + 1);
      else flipTo(idx - 1);
    }
  };

  function flipTo(n: number) {
    if (n < 0 || n >= flat.length || n === idx) return;
    setKey(flat[n].key);
    setFlipKey((k) => k + 1);
    // 长文分页：切页后回到书本顶部，避免停在上一页的滚动位置
    const root = rootRef.current;
    if (root) {
      const top = root.getBoundingClientRect().top + window.scrollY;
      if (top < window.scrollY - 60) {
        window.scrollTo(0, Math.max(0, top - 8));
      }
    }
  }

  // 键盘 ←/→ 翻页（输入框聚焦时不干扰）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") flipTo(idx - 1);
      if (e.key === "ArrowRight") flipTo(idx + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return null;

  return (
    <div
      ref={rootRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="book-spread book-fullscreen paper rounded-r-xl rounded-l-lg border-x border-amber-900/10 dark:border-amber-100/10 shadow-lg"
    >
      {/* ---- 左页：本书页目录（移动端隐藏，页签并入正文页） ---- */}
      <div className="book-page relative p-4 sm:p-5 hidden lg:block">
        <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-3">
          <span className="serif-title text-sm tracking-[0.3em] amber-head">
            本 书 页
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {courseEmoji} {courseName}
          </span>
        </div>

        <nav aria-label="本书页目录" className="hidden lg:block">
          <ul className="space-y-1">
            {flat.map((e) => (
              <li key={e.key}>
                <button
                  onClick={() => flipTo(flat.findIndex((x) => x.key === e.key))}
                  aria-current={key === e.key ? "page" : undefined}
                  className={`w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    key === e.key
                      ? "bg-rose-600/90 text-white font-medium"
                      : "text-slate-600 hover:bg-amber-900/10 dark:hover:bg-amber-100/10"
                  } ${e.depth ? "pl-5" : ""}`}
                >
                  {e.icon ? (
                    <span className="shrink-0" aria-hidden="true">
                      {e.icon}
                    </span>
                  ) : (
                    <span
                      className="shrink-0 amber-soft"
                      aria-hidden="true"
                    >
                      ├
                    </span>
                  )}
                  <span className="truncate">{e.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed border-t border-amber-900/15 dark:border-amber-100/10 pt-3">
            💡 键盘 ← → 可翻页。
            <br />
            💬 导师 / 实操 / 笔记在右侧工具栏，随时展开。
          </p>
        </nav>
      </div>

      {/* ---- 书脊 ---- */}
      <div
        aria-hidden="true"
        className="relative w-0 lg:w-3 border-x border-amber-900/10 dark:border-amber-100/10 bg-gradient-to-r from-transparent via-amber-900/10 to-transparent dark:via-black/30"
      />

      {/* ---- 右页：正文 ---- */}
      <div className="book-page relative p-4 sm:p-6 flex flex-col">
        {/* 页眉 */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-amber-900/15 dark:border-amber-100/10">
          <div className="min-w-0">
            <div className="serif-title text-lg font-bold truncate flex items-center gap-2">
              {current.icon && (
                <span aria-hidden="true" className="text-base">
                  {current.icon}
                </span>
              )}
              {current.label}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {lessonTitle} · {levelName} · 第 {index + 1} 课 / 共 {total} 课
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">{headerRight}</div>
        </div>

        {/* 移动端：两级页签（吸顶；顶级页一行，当前组的子页一行） */}
        <div className="lg:hidden chip-strip sticky top-14 z-20 -mx-4 px-4 pt-2 pb-2.5 mb-3 no-swipe">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {pages.map((p) => {
              const groupActive = p.id === activeGroup?.id;
              const exact = key === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => flipTo(flat.findIndex((x) => x.key === p.id))}
                  aria-current={exact ? "page" : undefined}
                  className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                    exact
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30"
                      : groupActive
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30"
                        : "bg-transparent text-slate-600 border-amber-900/15 dark:text-amber-100/70 dark:border-amber-100/15"
                  }`}
                >
                  {p.icon && (
                    <span aria-hidden="true" className="text-[13px]">
                      {p.icon}
                    </span>
                  )}
                  {p.label}
                </button>
              );
            })}
          </div>
          {(activeGroup?.children?.length ?? 0) > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1.5 -mx-1 px-1">
              {activeGroup!.children!.map((c) => (
                <button
                  key={c.id}
                  onClick={() => flipTo(flat.findIndex((x) => x.key === c.id))}
                  aria-current={key === c.id ? "page" : undefined}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] whitespace-nowrap border transition-colors ${
                    key === c.id
                      ? "bg-rose-600/90 text-white border-rose-600"
                      : "bg-transparent text-slate-500 border-dashed border-amber-900/25 dark:text-amber-100/60 dark:border-amber-100/20"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 页内容 */}
        <div key={`${flipKey}-${current.key}`} className="page-flip flex-1">
          {current.content}
        </div>

        {/* 页脚翻页 */}
        <div className="flex items-center justify-between pt-3 mt-4 border-t border-amber-900/15 dark:border-amber-100/10">
          <button
            onClick={() => flipTo(idx - 1)}
            disabled={idx === 0}
            className="hand-note text-sm text-slate-500 disabled:opacity-30 hover:text-rose-600 px-2 py-1.5 truncate max-w-[38%]"
          >
            ← {idx > 0 ? flat[idx - 1].label : "封面"}
          </button>
          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
            {idx + 1} / {flat.length}
          </span>
          <button
            onClick={() => flipTo(idx + 1)}
            disabled={idx === flat.length - 1}
            className="hand-note text-sm text-slate-500 disabled:opacity-30 hover:text-rose-600 px-2 py-1.5 truncate max-w-[38%]"
          >
            {idx < flat.length - 1 ? flat[idx + 1].label : "封底"} →
          </button>
        </div>
      </div>
    </div>
  );
}
