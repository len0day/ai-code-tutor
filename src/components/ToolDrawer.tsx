"use client";

/**
 * 右侧工具抽屉（课程学习页）
 *
 * AI 导师 / 代码实操 / 笔记 收纳在一个可随时展开、收起的抽屉里，
 * 不打断书本阅读。桌面端从右侧滑入，移动端占满全宽。
 */
export interface ToolTab {
  id: string;
  label: string;
  icon: string;
  content: React.ReactNode;
}

export default function ToolDrawer({
  open,
  onOpenChange,
  tab,
  onTabChange,
  tabs,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tab: string;
  onTabChange: (id: string) => void;
  tabs: ToolTab[];
}) {
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <>
      {open && (
        <div
          className="tool-drawer-backdrop lg:hidden"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`tool-drawer ${open ? "is-open" : ""}`}
        aria-label="学习工具栏"
        aria-hidden={!open}
      >
        {/* 抽屉头：页签 + 关闭 */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-2.5 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              aria-selected={tab === t.id}
              role="tab"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <button
            onClick={() => onOpenChange(false)}
            aria-label="收起工具栏"
            title="收起工具栏"
            className="ml-auto text-slate-400 hover:text-slate-600 text-lg leading-none px-2"
          >
            »
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="flex-1 min-h-0 overflow-y-auto">{active?.content}</div>
      </aside>

      {/* 收起时的把手（贴右边缘） */}
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="tool-drawer-handle"
          aria-label="展开学习工具栏"
          title="展开学习工具栏（AI 导师 / 代码实操 / 笔记）"
        >
          🧰 学习工具
        </button>
      )}
    </>
  );
}
