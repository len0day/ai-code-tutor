"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, Progress } from "@/lib/types";
import { flatLessons } from "@/data/courses";
import { ChapterTree } from "@/components/BookReader";
import AquariumModal from "@/components/AquariumModal";

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

/** 墙上功能刻字（房间装饰 + 快捷入口） */
const WALL_POSTERS: Array<[string, string]> = [
  ["知识库", "/notebook"],
  ["学习建议", "/advice"],
  ["学习报告", "/report"],
];

/** 鱼的 species → emoji（与 /api/aquarium 的 FISH_SPECIES 对应） */
const FISH_EMOJI: Record<string, string> = {
  guppy: "🐠",
  goldfish: "🐟",
  puffer: "🐡",
  shark: "🦈",
  whale: "🐋",
};

export interface BookshelfProps {
  courses: Course[];
  progress: Progress | null;
  /** 达到课程数上限的课程（显示锁） */
  lockedLangs?: string[];
  /** 书架旁的礼物盒（增值包入口） */
  giftBox?: { href: string; label: string; sub: string };
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
  giftBox,
}: BookshelfProps) {
  /** 抽出的那本书（null = 书架状态） */
  const [picked, setPicked] = useState<string | null>(null);
  /** 封面已翻开 */
  const [opened, setOpened] = useState(false);
  /** 放回中（书本飞回书架动画） */
  const [returning, setReturning] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // ---- 3D 房间模式：进入开门动画 + 2D/3D 视角切换 ----
  const [mode3d, setMode3d] = useState(true);
  type DoorState = "closed" | "opening" | "open" | "closing";
  const [doors, setDoors] = useState<DoorState>("closed");
  const doorTimers = useRef<number[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);
  /** 点击物件的镜头拉近：'' | 'tub' | 'plant' */
  const [zoom, setZoom] = useState<"" | "tub" | "plant">("");

  // 读取上次的视角偏好（默认 3D）
  useEffect(() => {
    try {
      if (localStorage.getItem("ct-room3d") === "0") setMode3d(false);
    } catch {
      /* 忽略 */
    }
  }, []);

  // 进入页面：双开木门缓缓打开
  useEffect(() => {
    const t1 = window.setTimeout(() => setDoors("opening"), 300);
    const t2 = window.setTimeout(() => setDoors("open"), 1700);
    doorTimers.current.push(t1, t2);
    return () => {
      doorTimers.current.forEach((t) => window.clearTimeout(t));
      doorTimers.current = [];
    };
  }, []);

  /** 2D/3D 切换：先关门遮住场景 → 换模式 → 再开门 */
  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (doors !== "open") return;
    setDoors("closing");
    doorTimers.current.push(
      window.setTimeout(() => {
        setMode3d((m) => {
          const next = !m;
          try {
            localStorage.setItem("ct-room3d", next ? "1" : "0");
          } catch {
            /* 忽略 */
          }
          return next;
        });
        setDoors("opening");
        doorTimers.current.push(window.setTimeout(() => setDoors("open"), 1300));
      }, 540)
    );
  };

  /** 3D 模式：鼠标视差 —— 房间随光标轻微转动，产生纵深感 */
  const onSceneMouseMove = (e: React.MouseEvent) => {
    if (!mode3d) return;
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--room-ry", `${(px * 11).toFixed(2)}deg`);
    el.style.setProperty("--room-rx", `${(-py * 7).toFixed(2)}deg`);
  };
  const onSceneMouseLeave = () => {
    const el = sceneRef.current;
    if (!el) return;
    el.style.setProperty("--room-ry", "0deg");
    el.style.setProperty("--room-rx", "0deg");
  };

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
  /** 挂历：当月日期 + 今日高亮 */
  const nowMonth = now ? now.getMonth() : -1;
  const nowYear = now ? now.getFullYear() : 0;
  const today = now ? now.getDate() : 0;
  const calDays =
    nowMonth >= 0
      ? Array.from(
          { length: new Date(nowYear, nowMonth + 1, 0).getDate() },
          (_, i) => i + 1
        )
      : [];
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

  // ---- 鱼缸：拉一次，缸里游自己买的鱼（未登录时请求失败即保持默认鱼） ----
  const [tankOpen, setTankOpen] = useState(false);
  interface TankFish {
    id: string;
    species: string;
  }
  const [tankFish, setTankFish] = useState<TankFish[]>([]);
  const [plantSize, setPlantSize] = useState(1);
  const [watering, setWatering] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/aquarium")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (d.fish) setTankFish(d.fish.slice(0, 4));
        if (typeof d.plantSize === "number") setPlantSize(d.plantSize);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tankOpen]);

  const pick = (lang: string) => {
    clearTimers();
    setZoom("");
    setPicked(lang);
    setOpened(false);
    setReturning(false);
  };
  /** 翻开封面 */
  const openBook = () => {
    if (returning || opened) return;
    setOpened(true);
  };
  /** 放回书架（飞回动画后卸载） */
  const putBack = () => {
    clearTimers();
    setReturning(true);
    timers.current.push(
      window.setTimeout(() => {
        setPicked(null);
        setReturning(false);
        setOpened(false);
      }, 460)
    );
  };
  /** 给树苗浇水（桌面端盆栽 / 移动端工具条共用）；3D 模式下镜头拉近 */
  const waterPlant = async () => {
    if (watering || plantSize >= 5) return;
    setWatering(true);
    setZoom((z) => z || "plant");
    try {
      const r = await fetch("/api/aquarium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "water" }),
      });
      const d = await r.json();
      if (r.ok && typeof d.plantSize === "number") setPlantSize(d.plantSize);
    } catch {
      /* 忽略 */
    } finally {
      window.setTimeout(() => {
        setWatering(false);
        setZoom((z) => (z === "plant" ? "" : z));
      }, 1500);
    }
  };

  /** 点击书以外的任意区域 = 放回书架 / 退出镜头拉近 */
  const handleSceneClick = (e: React.MouseEvent) => {
    setZoom("");
    if (!picked || returning) return;
    const t = e.target as HTMLElement;
    if (t.closest(".focus-book") || t.closest(".focus-actions")) return;
    putBack();
  };

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
    <>
      <div
        ref={sceneRef}
        data-zoom={zoom || undefined}
        className={`shelf-scene ${picked ? "has-book" : ""} ${
          opened ? "is-open-book" : ""
        } ${mode3d ? "is-3d" : ""}`}
        onClick={handleSceneClick}
        onMouseMove={onSceneMouseMove}
        onMouseLeave={onSceneMouseLeave}
      >
        {/* 3D 房间层：桌面在 3D 模式下整体微转（视差），地板与侧墙向远处铺开 */}
        <div className="room-stage">
          {mode3d && (
            <>
              <div className="room3d-floor" aria-hidden="true" />
              <div className="room3d-wall wall-l" aria-hidden="true" />
              <div className="room3d-wall wall-r" aria-hidden="true" />
              <div className="room3d-light" aria-hidden="true" />
            </>
          )}
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
        <div className="wall-scroll">
          <span className="scroll-cord" aria-hidden="true" />
          <span className="scroll-rod" aria-hidden="true" />
          <span className="scroll-silk silk-a">
            <span className="scroll-num">{roomStats.xp}</span>
            <span className="scroll-label">XP 经验</span>
          </span>
          <span className="scroll-rod" aria-hidden="true" />
        </div>
        <div className="wall-scroll">
          <span className="scroll-cord" aria-hidden="true" />
          <span className="scroll-rod" aria-hidden="true" />
          <span className="scroll-silk silk-b">
            <span className="scroll-num">{roomStats.streak}</span>
            <span className="scroll-label">连续天数</span>
          </span>
          <span className="scroll-rod" aria-hidden="true" />
        </div>
        <div className="wall-scroll">
          <span className="scroll-cord" aria-hidden="true" />
          <span className="scroll-rod" aria-hidden="true" />
          <span className="scroll-silk silk-c">
            <span className="scroll-num">{roomStats.done}</span>
            <span className="scroll-label">完成课程</span>
          </span>
          <span className="scroll-rod" aria-hidden="true" />
        </div>
      </div>

      {/* 挂历：当月日历，今日标红 */}
      <div className="room-decor wall-calendar" aria-hidden="true">
        <span className="cal-cord" />
        <span className="cal-rod" />
        <div className="cal-sheet">
          <div className="cal-head">
            <b>{nowMonth + 1} 月</b>
            <span>{nowYear}</span>
          </div>
          <div className="cal-grid">
            {calDays.map((d) => (
              <span key={d} className={d === today ? "is-today" : ""}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="room-decor wall-sign">
        <p className="sign-title">
          CodeTutor AI —— 用 AI 导师 学编程、运维与外语
        </p>
      </div>

      <nav className="room-decor wall-tags" aria-label="功能快捷入口">
        {WALL_POSTERS.map(([label, href]) => (
          <Link key={label} href={href} className="wall-tag">
            <span className="tag-cord" aria-hidden="true" />
            <span className="tag-board">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="room-floor" aria-hidden="true" />

      {/* 移动端工具条：鱼缸 / 树苗 / 礼包（桌面端由房间里的实体呈现） */}
      {!picked && (
        <div className="mobile-tools">
          <button
            className="mt-btn"
            onClick={(e) => {
              e.stopPropagation();
              setTankOpen(true);
            }}
            aria-label="打开鱼缸：查看和喂养你的鱼"
          >
            <span className="mt-fish" aria-hidden="true">
              🐠
            </span>
            <span className="mt-label">鱼缸</span>
            {tankFish.length > 0 && <span className="mt-count">{tankFish.length}</span>}
          </button>
          <button
            className={`mt-btn ${watering ? "is-watering" : ""}`}
            onClick={async (e) => {
              e.stopPropagation();
              await waterPlant();
            }}
            aria-label={`给树苗浇水（当前 ${plantSize} 号，最大 5 号）`}
          >
            <span className="mt-plant-icon" aria-hidden="true">
              {["🌱", "🌱", "🌿", "🪴", "🌳"][plantSize - 1] ?? "🌱"}
            </span>
            <span className="mt-label">树苗</span>
            <span className="mt-count">{plantSize}/5</span>
          </button>
          {giftBox && (
            <Link href={giftBox.href} className="mt-btn" aria-label={`打开礼物：${giftBox.label}`}>
              <span aria-hidden="true">🎁</span>
              <span className="mt-label">{giftBox.label}</span>
            </Link>
          )}
        </div>
      )}

      {/* 鱼缸浴缸：小鱼游动，点击放大查看 + 用 XP 养鱼（3D 模式先拉近镜头再开弹窗） */}
      <button
        className="room-tub"
        onClick={(e) => {
          e.stopPropagation();
          if (mode3d) {
            setZoom("tub");
            window.setTimeout(() => setTankOpen(true), 430);
          } else {
            setTankOpen(true);
          }
        }}
        aria-label="打开鱼缸：查看和喂养你的鱼"
        title="点开鱼缸 —— 用 XP 买鱼、买鱼食、喂食"
      >
        <span className="tub-rim" aria-hidden="true">
          <span className="tub-water">
            {tankFish.map((f, i) => (
              <i
                key={f.id}
                className={`tub-fish tf-${i % 3}`}
                style={
                  {
                    "--dur": `${7 + (i * 3)}s`,
                    "--dist": "110px",
                    top: `${18 + i * 22}%`,
                    animationDelay: `${-i * 2.5}s`,
                  } as React.CSSProperties
                }
              >
                {FISH_EMOJI[f.species] ?? "🐟"}
              </i>
            ))}
            {tankFish.length === 0 && (
              <>
                <i className="tub-fish tf-0" style={{ "--dur": "9s", top: "20%" } as React.CSSProperties}>
                  🐠
                </i>
                <i className="tub-fish tf-1" style={{ "--dur": "12s", top: "55%" } as React.CSSProperties}>
                  🐟
                </i>
              </>
            )}
          </span>
        </span>
        <span className="tub-body" aria-hidden="true" />
        {/* 3D 玻璃侧板与水面（仅 3D 模式显示） */}
        <span className="tub3d-side side-l" aria-hidden="true" />
        <span className="tub3d-side side-r" aria-hidden="true" />
        <span className="tub3d-top" aria-hidden="true" />
        <span className="tub-foot foot-l" aria-hidden="true" />
        <span className="tub-foot foot-r" aria-hidden="true" />
        <span className="tub-caption">我的鱼缸</span>
      </button>

      {/* 书架旁的礼物盒（增值包） */}
      {giftBox && (
        <Link href={giftBox.href} className="gift-box" aria-label={`打开礼物：${giftBox.label}`}>
          <span className="gift-bow" aria-hidden="true">
            <span className="bow-loop bow-loop-l" />
            <span className="bow-loop bow-loop-r" />
            <span className="bow-knot" />
          </span>
          <span className="gift-lid" aria-hidden="true">
            <span className="gift-lid-band" />
          </span>
          <span className="gift-body" aria-hidden="true">
            <span className="gift-ribbon-v" />
            <span className="gift-print">{giftBox.label}</span>
          </span>
          <span className="gift-shadow" aria-hidden="true" />
          {/* 3D 侧面与盒盖顶面（仅 3D 模式显示） */}
          <span className="gift3d-side" aria-hidden="true" />
          <span className="gift3d-top" aria-hidden="true" />
          <span className="gift-sparkle sparkle-a" aria-hidden="true">
            ✦
          </span>
          <span className="gift-sparkle sparkle-b" aria-hidden="true">
            ✦
          </span>
          <span className="gift-caption">{giftBox.sub}</span>
        </Link>
      )}

      {/* 树苗：点击浇水，慢慢长大 */}
      <button
        className={`room-plant stage-${plantSize} ${watering ? "is-watering" : ""} ${
          plantSize >= 5 ? "is-full" : ""
        }`}
        onClick={async (e) => {
          e.stopPropagation();
          await waterPlant();
        }}
        title="点一点浇水，树苗会慢慢长大"
        aria-label={`给树苗浇水（当前 ${plantSize} 号，最大 5 号）`}
      >
        {watering && <span className="plant-can" aria-hidden="true">🚿</span>}
        {watering && (
          <>
            <i className="plant-drop d1" aria-hidden="true">💧</i>
            <i className="plant-drop d2" aria-hidden="true">💧</i>
            <i className="plant-drop d3" aria-hidden="true">💧</i>
          </>
        )}
        <span className="plant-body" aria-hidden="true">
          {["🌱", "🌱", "🌿", "🪴", "🌳"][plantSize - 1] ?? "🌱"}
        </span>
      </button>

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

      {/* ---------- 2️⃣/3️⃣ 展示台：悬浮的书 → 封面独立 3D + 目录两页铺开 ---------- */}
      {current && currentStats && (
        <div
          className={`focus-stage ${returning ? "is-returning" : ""}`}
          aria-live="polite"
        >
          <div className="focus-actions">
            <button onClick={putBack} disabled={returning} className="return-btn">
              ↩ 放回书架
            </button>
          </div>

          <div
            className={`focus-book ${opened ? "is-open" : ""}`}
            data-course={current.lang}
          >
            {/* 封面：真 3D 书体（封面 + 书脊 + 书页 + 封底），每本有专属装饰与烫金排版 */}
            <button
              onClick={openBook}
              aria-label={opened ? undefined : `翻开《${current.name}》`}
              tabIndex={opened ? -1 : 0}
              className={`focus-book-cover cover-v${courseIndex[current.lang] % 4}`}
              style={
                {
                  "--cover-from": SPINE_COLORS[current.lang]?.[0] ?? "#a1a1aa",
                  "--cover-mid": SPINE_COLORS[current.lang]?.[1] ?? "#6b7280",
                  "--cover-to": SPINE_COLORS[current.lang]?.[1] ?? "#4b5563",
                } as React.CSSProperties
              }
            >
              <span className="book3d" aria-hidden="true">
                {/* 封底 */}
                <span className="book3d-face b3-back" />
                {/* 书脊 */}
                <span className="book3d-face b3-spine" />
                {/* 书页侧面与顶面 */}
                <span className="book3d-face b3-pages-r" />
                <span className="book3d-face b3-pages-t" />
                {/* 正面：专属徽标 + 烫金排版 */}
                <span className="book3d-face b3-front">
                  <span className="focus-book-inner">
                    <span className="cover-emblem" aria-hidden="true">
                      {current.emoji}
                    </span>
                    <span className="cover-label foil">
                      {current.kind === "language" ? "LANGUAGE" : "PROGRAMMING"}
                    </span>
                    <span className="cover-title serif-title foil">
                      {current.name}
                    </span>
                    <span className="cover-divider" aria-hidden="true">
                      ❦
                    </span>
                    <span className="cover-tagline">{current.tagline}</span>
                    <span className="mt-auto mb-6 w-52">
                      <span className="block h-1.5 bg-black/30 rounded-full overflow-hidden mb-2">
                        <span
                          className="block h-full bg-gradient-to-r from-amber-200 to-amber-100 rounded-full transition-all duration-700"
                          style={{ width: `${currentStats.pct}%` }}
                        />
                      </span>
                      <span className="cover-meta">
                        已读 {currentStats.pct}% · {current.levels.length} 章 ·{" "}
                        {currentStats.total} 页
                      </span>
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
      {/* /room-stage */}

      {/* 视角切换：2D 平面 ↔ 3D 房间（切门时先关门再开门） */}
      <button
        className="room-mode-toggle"
        onClick={toggleMode}
        aria-pressed={mode3d}
        title={mode3d ? "切换到 2D 平面视图" : "切换到 3D 房间视图"}
      >
        <span aria-hidden="true">{mode3d ? "🧊" : "🖼️"}</span>
        {mode3d ? "3D 视角" : "2D 平面"}
      </button>
      </div>
      {/* /shelf-scene */}

      {/* 鱼缸弹窗：fixed 定位，必须在带 perspective 的场景外；关闭后保持拉近，点空白处退出 */}
      <AquariumModal open={tankOpen} onClose={() => setTankOpen(false)} />

      {/* 镜头拉近提示 */}
      {zoom && (
        <div className="zoom-hint" aria-hidden="true">
          ↩ 点击空白处返回全景
        </div>
      )}

      {/* 3D 开门进场：双开木门（进入页面 / 切换视角时播放） */}
      <div className={`room-door is-${doors}`} aria-hidden={doors === "open"}>
        <div className="door-panel door-l">
          <span className="door-molding" aria-hidden="true" />
          <span className="door-knob" aria-hidden="true" />
        </div>
        <div className="door-panel door-r">
          <span className="door-molding" aria-hidden="true" />
          <span className="door-knob" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}
