"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "ct-theme";

function apply(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** 深色/浅色/跟随系统 三态切换按钮 */
export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let alive = true;
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
    // 挂载后于微任务中同步状态，避免 effect 内同步 setState
    Promise.resolve().then(() => {
      if (!alive) return;
      setMode(saved);
      setMounted(true);
    });
    // 跟随系统时监听系统主题变化
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as ThemeMode | null) === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => {
      alive = false;
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const cycle = () => {
    const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  };

  const icon = mode === "light" ? "☀️" : mode === "dark" ? "🌙" : "💻";
  const label = mode === "light" ? "浅色" : mode === "dark" ? "深色" : "跟随系统";

  if (compact) {
    return (
      <button
        onClick={cycle}
        title={`主题：${label}（点击切换）`}
        aria-label={`主题：${label}`}
        className="px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
      >
        {mounted ? icon : "🌙"}
      </button>
    );
  }

  return (
    <button
      onClick={cycle}
      title={`主题：${label}（点击切换 浅色→深色→跟随系统）`}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-slate-500 hover:text-primary hover:border-primary/40 transition-colors"
    >
      <span>{mounted ? icon : "🌙"}</span>
      {label}
    </button>
  );
}

/** 供 layout 头部内联使用的初始化脚本（防主题闪烁） */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
