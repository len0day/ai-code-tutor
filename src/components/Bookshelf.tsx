"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, Progress } from "@/lib/types";
import { flatLessons } from "@/data/courses";
import { ChapterTree } from "@/components/BookReader";

/** 每门课程的书脊配色 */
const SPINE_COLORS: Record<string, [string, string]> = {
  python: ["#38bdf8", "#1d4ed8"],
  java: ["#fb923c", "#dc2626"],
  javascript: ["#fcd34d", "#ca8a04"],
  typescript: ["#60a5fa", "#4338ca"],
  html: ["#fb923c", "#e11d48"],
  docker: ["#38bdf8", "#0e7490"],
  linux: ["#cbd5e1", "#334155"],
  japanese: ["#fb7185", "#be185d"],
  go: ["#22d3ee", "#0369a1"],
  swift: ["#fb923c", "#dc2626"],
  nextjs: ["#d4d4d8", "#18181b"],
};

/** 书脊高度（略有高低，像真实的一排书） */
const HEIGHTS = [206, 228, 198, 216, 234, 202, 212, 222, 200, 214, 208];

/** 书脊微倾角（散落感，不随机抖动） */
const SPINE_TILTS = [-1.6, 0.8, -0.6, 1.4, 0, -1, 1.8, -0.9, 0.5, -1.4, 1];

/** 墙上功能海报（房间装饰 + 快捷入口） */
const WALL_POSTERS: Array<[string, string, string]> = [
  ["💬", "AI 导师答疑", "/learn/python"],
  ["📝", "练习测验", "/learn/python"],
  ["💻", "代码实操", "/learn/python"],
  ["🎤", "模拟面试", "/learn/python"],
  ["📚", "知识库", "/notebook"],
  ["🤖", "学习建议", "/advice"],
  ["📊", "学习报告", "/report"],
];

export interface BookshelfProps {
  courses: Course[];
  progress: Progress | null;
  /** 达到课程数上限的课程（显示锁） */
  lockedLangs?: string[];
}

/**
 * 书架四段式交互（书与书架同行，无需滚动）：
 *  1️⃣ 书架：每门课程一本立体书脊立在木板上
 *  2️⃣ 抽出：点一本书 → 书架退为暗色背景（同行左侧），书在右侧 3D 悬浮
 *  3️⃣ 翻开：再点一下 → 书加宽为左右两页对开（左=目录，右=扉页），封面沿书脊翻开
 *  4️⃣ 合上/放回：封面摆回动画 / 书飞回书架动画
 * 目录中点击任意一节 → 进入全屏图书页面开始阅读。
 */
export default function Bookshelf({
  courses,
  progress,
  lockedLangs = [],
}: BookshelfProps) {
  /** 抽出的那本书（null = 书架状态） */
  const [picked, setPicked] = useState<string | null>(null);
  /** 封面已翻开 */
  const [opened, setOpened] = useState(false);
  /** 合上中（封面摆回动画） */
  const [closing, setClosing] = useState(false);
  /** 放回中（书本飞回书架动画） */
  const [returning, setReturning] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const stats = useMemo(() => {
    const map: Record<
      string,
      { done: number; total: number; passed: number; nextId: string | null; pct: number }
    > = {};
    for (const c of courses) {
      const all = c.levels.flatMap((l) => l.lessons);
      const done = all.filter((l) => progress?.lessons[l.id]?.completed).length;
      const passed = all.filter(
        (l) => progress?.gates?.[c.lang]?.[l.id]?.passed
      ).length;
      const next = all.find((l) => !progress?.lessons[l.id]?.completed);
      map[c.lang] = {
        done,
        total: all.length,
        passed,
        nextId: next?.id ?? null,
        pct: all.length ? Math.round((done / all.length) * 100) : 0,
      };
    }
    return map;
  }, [courses, progress]);

  const current = courses.find((c) => c.lang === picked) ?? null;
  const currentStats = current ? stats[current.lang] : null;

  /** 书分散到多层书柜：轮转分配 + 记录每本书的全局序号（用于错落样式） */
  const rows = useMemo(() => {
    const rowCount = courses.length <= 4 ? 1 : courses.length <= 8 ? 2 : 3;
    const out: Course[][] = Array.from({ length: rowCount }, () => []);
    courses.forEach((c, i) => out[i % rowCount].push(c));
    return out;
  }, [courses]);
  const courseIndex = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach((c, i) => (map[c.lang] = i));
    return map;
  }, [courses]);

  // ---- 房间装饰：挂钟实时走时 + 墙上进度挂牌 ----
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const hourDeg = now ? (now.getHours() % 12 + now.getMinutes() / 60) * 30 : 0;
  const minDeg = now ? now.getMinutes() * 6 : 0;
  const roomStats = useMemo(
    () => ({
      xp: progress?.xp ?? 0,
      streak: progress?.streak ?? 0,
      done: progress
        ? Object.values(progress.lessons).filter((l) => l.completed).length
        : 0,
    }),
    [progress]
  );

  const pick = (lang: string) => {
    clearTimers();
    setPicked(lang);
    setOpened(false);
    setClosing(false);
    setReturning(false);
  };
  /** 翻开封面 */
  const openBook = () => {
    if (closing || returning || opened) return;
    setOpened(true);
  };
  /** 合上封面（摆回动画后复位） */
  const closeBook = () => {
    if (!opened || closing || returning) return;
    setClosing(true);
    timers.current.push(
      window.setTimeout(() => {
        setClosing(false);
        setOpened(false);
      }, 820)
    );
  };
  /** 放回书架（飞回动画后卸载） */
  const putBack = () => {
    clearTimers();
    setReturning(true);
    setClosing(false);
    timers.current.push(
      window.setTimeout(() => {
        setPicked(null);
        setReturning(false);
        setOpened(false);
      }, 460)
    );
  };

  const lessonHref = (c: Course, id: string | null) =>
    id
      ? c.kind === "language"
        ? `/languages/${c.lang}/${id}`
        : `/learn/${c.lang}/${id}`
      : c.kind === "language"
        ? `/languages/${c.lang}`
        : `/learn/${c.lang}`;

  /** 翻开后目录按章对半分到左右两页（像大纲页一样铺开） */
  const flatAll = current ? flatLessons(current.lang) : [];
  const halfLevelIdx = current ? Math.ceil(current.levels.length / 2) : 0;
  const boundary =
    current && halfLevelIdx < current.levels.length
      ? flatAll.findIndex((x) => x.level.id === current.levels[halfLevelIdx].id)
      : -1;
  const flatL = boundary > 0 ? flatAll.slice(0, boundary) : flatAll;
  const flatR = boundary > 0 ? flatAll.slice(boundary) : [];

  return (
    <div
      className={`shelf-scene ${picked ? "has-book" : ""} ${
        opened || closing ? "is-open-book" : ""
      }`}
    >
      {/* ---------- 房间装饰（挂在墙上，不参与布局） ---------- */}
      <div className="room-decor pendant-lamp" aria-hidden="true">
        <span className="lamp-cord" />
        <span className="lamp-shade" />
        <span className="lamp-glow" />
      </div>

      <div className="room-decor wall-clock" aria-hidden="true">
        {now && (
          <>
            <span
              className="clock-hand clock-hand-hour"
              style={{ transform: `rotate(${hourDeg}deg)` }}
            />
            <span
              className="clock-hand clock-hand-min"
              style={{ transform: `rotate(${minDeg}deg)` }}
            />
            <span className="clock-pin" />
          </>
        )}
      </div>

      <div className="room-decor wall-plaques">
        <div className="wall-plaque" title="XP 经验值">
          <span className="plaque-num">{roomStats.xp}</span>
          <span className="plaque-label">⚡ XP 经验</span>
        </div>
        <div className="wall-plaque" title="连续学习天数">
          <span className="plaque-num">{roomStats.streak}</span>
          <span className="plaque-label">🔥 连续天数</span>
        </div>
        <div className="wall-plaque" title="已完成课程">
          <span className="plaque-num">{roomStats.done}</span>
          <span className="plaque-label">✅ 完成课程</span>
        </div>
      </div>

      <div className="room-decor wall-sign">
        <p className="sign-title">
          ⚡ CodeTutor AI —— 用 AI 导师 学编程、运维与外语
        </p>
        <p className="sign-sub">
          11 门课 · 259 节 —— AI 全程陪学：讲解、答疑、出题、批改、模拟面试、规划路径
        </p>
      </div>

      <nav className="room-decor wall-posters" aria-label="功能快捷入口">
        {WALL_POSTERS.map(([icon, label, href]) => (
          <Link key={label} href={href} className="wall-poster">
            <span aria-hidden="true">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="room-floor" aria-hidden="true" />
      <div className="room-plant" aria-hidden="true">
        🪴
      </div>

      {/* ---------- 1️⃣/2️⃣ 多层书柜：书高低错落散落在不同层板上 ---------- */}
      <div
        className={`shelf-wrap ${picked ? "shelf-dimmed" : ""}`}
        aria-hidden={picked ? true : undefined}
      >
        <div className="bookcase">
          <div className="bookcase-cap" aria-hidden="true" />
          {rows.map((row, ri) => (
            <div className="shelf-row" key={ri} role="group" aria-label={`书架第 ${ri + 1} 层`}>
              {row.map((c) => {
                const s = stats[c.lang];
                const gi = courseIndex[c.lang];
                const [from, to] = SPINE_COLORS[c.lang] ?? ["#a1a1aa", "#4b5563"];
                const locked = lockedLangs.includes(c.lang);
                // 散落感：间距 / 倾斜 / 偶尔斜靠，全部由索引确定（无随机抖动）
                const gap = 6 + ((gi * 7) % 14);
                const tilt = SPINE_TILTS[gi % SPINE_TILTS.length];
                const lean = gi % 7 === 3;
                return (
                  <div key={c.lang} className="contents">
                    <button
                      onClick={() => pick(c.lang)}
                      aria-label={`抽出《${c.name}》`}
                      title={`《${c.name}》${locked ? "（已达课程数上限）" : ""}`}
                      className={`book-spine variant-${gi % 3} ${locked ? "is-locked" : ""} ${
                        lean ? "is-lean" : ""
                      }`}
                      style={
                        {
                          "--spine-h": `${HEIGHTS[gi % HEIGHTS.length]}px`,
                          "--spine-from": from,
                          "--spine-to": to,
                          "--spine-gap": `${lean ? -6 : gap}px`,
                          "--spine-tilt": `${tilt}deg`,
                          "--spine-z": lean ? gi : 0,
                        } as React.CSSProperties
                      }
                    >
                      <span className="spine-plate">{c.emoji}</span>
                      <span
                        className={`vertical-title spine-title ${
                          c.name.length > 5 ? "is-long" : ""
                        }`}
                      >
                        {c.name}
                      </span>
                      <span className="spine-div" aria-hidden="true">
                        ❦
                      </span>
                      <span className="spine-meta">
                        {locked ? "🔒" : `${s.done}/${s.total}`}
                      </span>
                      <span className="spine-bar" aria-hidden="true">
                        <span
                          className="spine-bar-fill"
                          style={{ height: `${s.pct}%` }}
                        />
                      </span>
                    </button>
                  </div>
                );
              })}
              <div className="shelf-board" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>

      {/* ---------- 2️⃣/3️⃣ 展示台：悬浮的书 → 封面立最左 + 目录两页铺开 ---------- */}
      {current && currentStats && (
        <div
          className={`focus-stage ${returning ? "is-returning" : ""}`}
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="hand-note text-sm">
              {returning
                ? "📕 放回书架…"
                : closing
                  ? "📓 合上封面…"
                  : opened
                    ? "📖 点击目录任意一节，进入全屏阅读"
                    : "👆 再点一下，翻开这本书"}
            </span>
            <div className="flex items-center gap-2">
              {opened && !closing && !returning && (
                <>
                  <Link
                    href={lessonHref(current, currentStats.nextId)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 border border-rose-200 dark:border-rose-500/40 rounded-full px-3 py-1 transition-colors"
                  >
                    翻开这一页 →
                  </Link>
                  <button
                    onClick={closeBook}
                    className="text-xs text-slate-400 hover:text-rose-500 border border-border rounded-full px-3 py-1 transition-colors"
                  >
                    合上封面
                  </button>
                </>
              )}
              <button
                onClick={putBack}
                disabled={returning}
                className="text-xs text-slate-400 hover:text-rose-500 border border-border rounded-full px-3 py-1 transition-colors disabled:opacity-40"
              >
                ↩ 放回书架
              </button>
            </div>
          </div>

          <div
            className={`focus-book ${opened && !closing ? "is-open" : ""} ${
              closing ? "is-closing" : ""
            }`}
            data-course={current.lang}
          >
            {/* 封面：合上时盖住全书悬浮展示；翻开后立于最左 */}
            <button
              onClick={openBook}
              aria-label={opened ? undefined : `翻开《${current.name}》`}
              tabIndex={opened ? -1 : 0}
              className="focus-book-cover book-cover"
              style={
                {
                  "--cover-from": SPINE_COLORS[current.lang]?.[0] ?? "#a1a1aa",
                  "--cover-mid": SPINE_COLORS[current.lang]?.[1] ?? "#6b7280",
                  "--cover-to": SPINE_COLORS[current.lang]?.[1] ?? "#4b5563",
                } as React.CSSProperties
              }
            >
              <span className="focus-book-inner">
                <span className="text-[11px] tracking-[0.3em] opacity-75">
                  {current.kind === "language" ? "LANGUAGE" : "PROGRAMMING"}
                </span>
                <span className="text-6xl mt-8">{current.emoji}</span>
                <h3 className="serif-title text-4xl font-bold mt-4">
                  {current.name}
                </h3>
                <span className="hand-note text-sm mt-2 text-left px-8 leading-relaxed">
                  {current.tagline}
                </span>
                <span className="mt-auto mb-6 w-52">
                  <span className="block h-1.5 bg-black/25 rounded-full overflow-hidden mb-2">
                    <span
                      className="block h-full bg-gradient-to-r from-amber-200 to-amber-100 rounded-full transition-all duration-700"
                      style={{ width: `${currentStats.pct}%` }}
                    />
                  </span>
                  <span className="flex justify-between text-xs opacity-80">
                    <span>已读 {currentStats.pct}%</span>
                    <span>
                      {current.levels.length} 章 · {currentStats.total} 页
                    </span>
                  </span>
                </span>
              </span>
            </button>

            {/* 目录：对开两页（与封面分离的独立书本，翻页动画显现） */}
            <div className="focus-book-pages">
              {/* 左页：前半章节 */}
              <div className="focus-book-toc paper book-page">
                <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-2.5">
                  <span className="serif-title text-sm tracking-[0.25em] amber-head">
                    {current.name} · 目 录
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {currentStats.passed}/{currentStats.total} 页通关
                  </span>
                </div>
                <ChapterTree
                  lang={current.lang}
                  lessonId=""
                  progress={progress}
                  flat={flatL}
                />
              </div>

              {/* 右页：后半章节 */}
              <div className="focus-book-toc-b paper book-page">
                <div className="flex items-center justify-between border-b border-amber-900/15 dark:border-amber-100/10 pb-2.5 mb-2.5">
                  <span className="serif-title text-sm tracking-[0.25em] amber-head">
                    目 录 <span className="text-xs">（续）</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {current.levels.length} 章 · {currentStats.total} 页
                  </span>
                </div>
                {flatR.length > 0 ? (
                  <ChapterTree
                    lang={current.lang}
                    lessonId=""
                    progress={progress}
                    flat={flatR}
                    chapterOffset={halfLevelIdx}
                  />
                ) : (
                  <p className="hand-note text-sm text-slate-400">
                    目录都在第 1 页 →
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
