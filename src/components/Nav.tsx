"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { logout, useMe } from "@/lib/useMe";
import type { Progress } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [stats, setStats] = useState<
    { xp: number; streak: number; done: number } | null
  >(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);

  // 路由变化时关闭移动端菜单（渲染期派生状态，避免 effect 内 setState）
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  // 点击菜单外部 / Esc 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.user || d.user.role !== "admin") return;
        return fetch("/api/settings")
          .then((r) => r.json())
          .then((s) => alive && setStatus(s))
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  // 个人学习数据（XP / 连击 / 完成课），展示在用户名旁
  useEffect(() => {
    if (!me) {
      setStats(null);
      return;
    }
    let alive = true;
    fetchProgress()
      .then((d: Progress) => {
        if (!alive) return;
        setStats({
          xp: d.xp,
          streak: d.streak,
          done: Object.values(d.lessons).filter((l) => l.completed).length,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [me, pathname]);

  const isAdmin = me?.role === "admin";

  const linkCls = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-indigo-50 text-indigo-600"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    }`;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  };

  const navItems = (
    <>
      <Link href="/" className={linkCls(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}>
        首页
      </Link>
      <details className="relative">
        <summary
          className={`${linkCls(pathname.startsWith("/learn") || pathname.startsWith("/languages"))} list-none cursor-pointer`}
          aria-label="课程列表"
        >
          课程 ▾
        </summary>
        <div className="absolute right-0 lg:left-0 top-full mt-1 w-56 max-h-[70vh] overflow-y-auto bg-white dark:bg-card border border-border rounded-xl shadow-2xl py-1.5 z-50">
          <div className="px-4 pt-1.5 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            编程与运维
          </div>
          {COURSES.filter((c) => c.kind !== "language").map((c) => (
            <Link
              key={c.lang}
              href={`/learn/${c.lang}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <span>{c.emoji}</span>
              {c.name}
            </Link>
          ))}
          {LANGUAGE_COURSES.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide border-t border-border mt-1">
                增值包
              </div>
              {LANGUAGE_COURSES.map((c) => (
                <Link
                  key={c.lang}
                  href={`/languages/${c.lang}`}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                >
                  <span>{c.emoji}</span>
                  {c.name}
                  <span className="ml-auto text-[10px] text-rose-400">增值包</span>
                </Link>
              ))}
            </>
          )}
        </div>
      </details>
      <Link href="/notebook" className={linkCls(pathname === "/notebook")}>
        知识库
      </Link>
      <Link href="/report" className={linkCls(pathname === "/report")}>
        学习报告
      </Link>
      <Link href="/advice" className={linkCls(pathname === "/advice")}>
        🤖 学习建议
      </Link>
      {LANGUAGE_COURSES.length > 0 && (
        <Link href="/languages" className={linkCls(pathname.startsWith("/languages"))}>
          🌸 增值包
        </Link>
      )}
      {isAdmin && (
        <>
          <Link href="/admin" className={linkCls(pathname === "/admin")}>
            后台
          </Link>
          <Link
            href="/settings"
            className={`${linkCls(pathname === "/settings")} flex items-center gap-1.5`}
          >
            设置
            {status && (
              <span
                title={status.configured ? `已配置（${status.provider}）` : "未配置 API Key"}
                className={`w-2 h-2 rounded-full ${
                  status.configured ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
                }`}
              />
            )}
          </Link>
        </>
      )}
    </>
  );

  return (
    <header ref={navRef} className="sticky top-0 z-40 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg shrink-0"
          aria-label="CodeTutor AI 首页"
        >
          <span className="text-xl drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" aria-hidden="true">
            ⚡
          </span>
          <span>
            CodeTutor <span className="grad-text">AI</span>
          </span>
        </Link>

        {/* 桌面导航 */}
        <nav aria-label="主导航" className="hidden lg:flex items-center gap-1">
          {navItems}
        </nav>

        {/* 个人学习数据 + 用户名 */}
        <div className="flex items-center gap-1.5">
          {stats && (
            <span
              className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
              title="我的学习数据：XP 经验值 · 连续学习天数 · 已完成课程"
            >
              <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-full px-2 py-0.5">
                ⚡ {stats.xp}
              </span>
              <span className="bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 rounded-full px-2 py-0.5">
                🔥 {stats.streak}
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-full px-2 py-0.5">
                ✅ {stats.done}
              </span>
            </span>
          )}
          <ThemeToggle compact />
          {me === undefined ? null : me === null ? (
            <Link
              href="/login"
              className="text-sm font-medium btn-primary text-white px-3 py-1.5 rounded-lg"
            >
              登录
            </Link>
          ) : (
            <>
              {stats && (
                <span
                  className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
                  title="我的学习数据：XP 经验值 · 连续学习天数 · 已完成课程"
                >
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-full px-2 py-0.5">
                    ⚡ {stats.xp}
                  </span>
                  <span className="bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 rounded-full px-2 py-0.5">
                    🔥 {stats.streak}
                  </span>
                  <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-full px-2 py-0.5">
                    ✅ {stats.done}
                  </span>
                </span>
              )}
              <span className="hidden sm:inline text-sm text-slate-600 max-w-[90px] truncate">
                {me.role === "admin" ? "👑 " : "👤 "}
                {me.username}
              </span>
              <button
                onClick={handleLogout}
                title="退出登录"
                aria-label="退出登录"
                className="hidden sm:inline px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                ⏻
              </button>
            </>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            className="lg:hidden px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="移动端导航"
          className="lg:hidden border-t border-border bg-card dark:bg-card px-4 py-3 max-h-[calc(100vh-3.5rem)] overflow-y-auto"
        >
          <div className="flex flex-col gap-1">{navItems}</div>
          {me && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-slate-600">
                {me.role === "admin" ? "👑 " : "👤 "}
                {me.username}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-500 px-3 py-2 rounded-lg"
              >
                退出登录
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}

interface SettingsStatus {
  configured: boolean;
  provider: string;
}
