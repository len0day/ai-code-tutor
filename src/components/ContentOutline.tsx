"use client";

import { useEffect, useMemo, useState } from "react";
import { flattenOutline, parseOutline, type OutlineNode } from "@/lib/outline";

/**
 * 内容目录（讲解目录）
 *
 * AI 生成的讲解是一篇长文，这里从 markdown 标题抽出目录树，
 * 放在正文左侧；点击条目跳转到对应小节。目录可向左折叠成一条窄边，
 * 折叠后正文占满宽度，适合小屏与长文阅读。
 * 窄屏自动退化为「点开式」目录，避免挤压正文。
 */
export default function ContentOutline({
  markdown,
  scope = "",
  label = "目 录",
  children,
}: {
  markdown: string;
  /** 与 Markdown 渲染共用，保证锚点一致 */
  scope?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const tree = useMemo(() => parseOutline(markdown, scope), [markdown, scope]);
  const flat = useMemo(() => flattenOutline(tree), [tree]);
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // 滚动时高亮当前小节
  useEffect(() => {
    if (flat.length === 0) return;
    const els = flat
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [flat]);

  const jump = (node: OutlineNode) => {
    setActive(node.id);
    const el = document.getElementById(node.id);
    const target =
      el ??
      // 兜底：按标题文本匹配（极端情况下 id 不一致）
      Array.from(document.querySelectorAll("h1, h2, h3, h4")).find((h) =>
        h.textContent?.includes(node.title)
      );
    if (!target) return;

    const before = window.scrollY;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // 平滑滚动不可用时（如后台标签页节流动画）退化为即时跳转
    window.setTimeout(() => {
      if (Math.abs(window.scrollY - before) < 2) {
        const root = document.documentElement;
        const prev = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        target.scrollIntoView({ behavior: "auto", block: "start" });
        root.style.scrollBehavior = prev;
      }
    }, 180);

    // 同步地址栏锚点，便于分享 / 刷新后回到本节
    try {
      window.history.replaceState(null, "", `#${node.id}`);
    } catch {
      /* 忽略沙箱环境下的历史记录限制 */
    }
  };

  // 没有标题层级 → 不显示目录
  if (flat.length === 0) return <>{children}</>;

  return (
    <div className="flex gap-3 items-start">
      {/* ---------- 桌面端：左侧目录栏（可向左折叠） ---------- */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="展开目录"
          title="展开目录"
          className="outline-rail outline-rail-collapsed hidden lg:flex shrink-0"
        >
          <span className="vertical-title text-[11px] tracking-[0.3em]">
            {label.replace(/\s/g, "")}
          </span>
          <span className="text-[10px] opacity-60" aria-hidden="true">
            »
          </span>
        </button>
      ) : (
        <nav
          aria-label="内容目录"
          className="outline-rail hidden lg:block shrink-0 w-[190px] lg:sticky lg:top-24 lg:self-start"
        >
          <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-amber-900/15 dark:border-amber-100/10">
            <span className="serif-title text-[11px] tracking-[0.25em] text-amber-900/70 dark:text-amber-200/70">
              {label}
            </span>
            <button
              onClick={() => setCollapsed(true)}
              aria-label="折叠目录"
              title="折叠目录（向左收起）"
              className="text-slate-400 hover:text-rose-600 text-xs leading-none px-1"
            >
              «
            </button>
          </div>
          <ul className="space-y-0.5 max-h-[340px] overflow-y-auto pr-0.5">
            {tree.map((node) => (
              <OutlineItem
                key={node.id}
                node={node}
                active={active}
                onJump={jump}
              />
            ))}
          </ul>
        </nav>
      )}

      {/* ---------- 窄屏：点开式目录 ---------- */}
      <details className="lg:hidden w-full shrink-0 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-amber-900/15 dark:border-amber-100/10 pb-1.5 mb-2">
          <span className="serif-title tracking-[0.25em]">{label}</span>
          <span className="opacity-60 group-open:rotate-90 transition-transform">
            ▸
          </span>
        </summary>
        <ul className="space-y-0.5 mb-3">
          {tree.map((node) => (
            <OutlineItem
              key={`m-${node.id}`}
              node={node}
              active={active}
              onJump={jump}
            />
          ))}
        </ul>
      </details>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function OutlineItem({
  node,
  active,
  onJump,
  depth = 0,
}: {
  node: OutlineNode;
  active: string | null;
  onJump: (n: OutlineNode) => void;
  depth?: number;
}) {
  const isActive = active === node.id;
  return (
    <li>
      <button
        onClick={() => onJump(node)}
        aria-current={isActive ? "true" : undefined}
        className={`w-full text-left rounded-md px-2 py-1 text-[12px] leading-snug transition-colors ${
          isActive
            ? "bg-rose-600/90 text-white"
            : "text-slate-600 hover:bg-amber-900/10 dark:text-slate-300 dark:hover:bg-amber-100/10"
        } ${depth > 0 ? "pl-4" : ""}`}
      >
        <span className="line-clamp-2">{node.title}</span>
      </button>
      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <OutlineItem
              key={child.id}
              node={child}
              active={active}
              onJump={onJump}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
