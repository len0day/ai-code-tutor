"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, Progress } from "@/lib/types";
import { flatLessons } from "@/data/courses";
import { ChapterTree } from "@/components/BookReader";
import AquariumModal from "@/components/AquariumModal";
import TankFish from "@/components/TankFish";
import PlantSvg from "@/components/PlantSvg";
import AuthModal from "@/components/AuthModal";
import { fetchNotebook } from "@/lib/client";

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

const Room3DGl = dynamic(() => import("@/components/Room3D"), { ssr: false });

/** 墙上挂牌 → 悬浮面板内容 */
const TAG_PANELS: Record<
  string,
  { icon: string; title: string; desc: string; href: string; cta: string }
> = {
  learn: {
    icon: "📚",
    title: "课程大厅",
    desc: "10+ 门编程与运维课程，闯关制学习：练习测验 + 模拟面试双达标才能解锁下一课。",
    href: "/learn",
    cta: "进入课程大纲",
  },
  notebook: {
    icon: "🗂️",
    title: "知识库",
    desc: "你的收藏、错题本与课堂笔记都收录在这里，随时翻出来复习。",
    href: "/notebook",
    cta: "进入知识库",
  },
  advice: {
    icon: "🤖",
    title: "学习建议",
    desc: "AI 会结合你的学习数据，告诉你下一步该学什么、怎么学最有效。",
    href: "/advice",
    cta: "查看学习建议",
  },
  report: {
    icon: "📊",
    title: "学习报告",
    desc: "学习时长、课程完成度、测验与面试成绩的趋势一览。",
    href: "/report",
    cta: "查看学习报告",
  },
  settings: {
    icon: "⚙️",
    title: "设置",
    desc: "AI 提供商与 API Key 配置、系统偏好（仅管理员可见）。",
    href: "/settings",
    cta: "打开设置",
  },
  admin: {
    icon: "🛠️",
    title: "后台管理",
    desc: "用户管理、全局配置与数据统计（仅管理员可见）。",
    href: "/admin",
    cta: "进入后台",
  },
};

export interface BookshelfProps {
  courses: Course[];
  progress: Progress | null;
  /** 达到课程数上限的课程（显示锁） */
  lockedLangs?: string[];
  /** 书架旁的礼物盒（增值包入口） */
  giftBox?: { href: string; label: string; sub: string };
  /** 访客模式：点击场景物件时弹出注册引导而非直接使用 */
  guest?: boolean;
  /** 当前用户是否管理员（决定 3D 场景里的后台入口） */
  isAdmin?: boolean;
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
  guest = false,
  isAdmin = false,
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
  const [zoom, setZoom] = useState<"" | "tub" | "plant" | "shelf" | "window">("");

  // ---- 全局轻提示（浇水结果等；不用 alert，也不打断场景） ----
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "warn" } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (text: string, kind: "ok" | "warn" = "ok") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  // 读取上次的视角偏好（默认 3D）
  useEffect(() => {
    try {
      if (localStorage.getItem("ct-room3d") === "0") setMode3d(false);
    } catch {
      /* 忽略 */
    }
  }, []);

  // 进入页面：首访门关着等推门（点击后开门 + 魔法入场）；老访客自动开门
  const [revealAt, setRevealAt] = useState(0);
  useEffect(() => {
    const seen = localStorage.getItem("ct-door-intro");
    if (seen) {
      const t1 = window.setTimeout(() => setDoors("opening"), 300);
      const t2 = window.setTimeout(() => setDoors("open"), 1700);
      doorTimers.current.push(t1, t2);
    }
    return () => {
      doorTimers.current.forEach((t) => window.clearTimeout(t));
      doorTimers.current = [];
    };
  }, []);
  /** 首访：点击门 → 推门而入 + 魔法入场 */
  const enterRoom = () => {
    if (doors !== "closed") return;
    setDoors("opening");
    doorTimers.current.push(window.setTimeout(() => setDoors("open"), 1400));
    localStorage.setItem("ct-door-intro", "1");
    setRevealAt(Date.now());
  };

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

  // 3D 模式：Three.js 房间全端渲染（桌面 + 移动端），2D 平面可切换
  const router = useRouter();
  const sceneCls = mode3d ? "is-gl" : "";

  // ---- 访客模式：点击场景物件 → 弹出注册引导 ----
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const openAuth = (reason: string): boolean => {
    if (!guest) return false;
    setAuthReason(reason);
    setAuthOpen(true);
    return true;
  };

  // ---- 墙上挂牌 → 悬浮面板 ----
  const [panel, setPanel] = useState<string | null>(null);
  const [nbCounts, setNbCounts] = useState<{ fav: number; wrong: number; notes: number } | null>(null);
  useEffect(() => {
    if (panel !== "notebook" || guest) return;
    fetchNotebook()
      .then((nb) => {
        setNbCounts({
          fav: nb.favorites.length,
          wrong: nb.wrongQuestions?.length ?? 0,
          notes: Object.keys(nb.notes ?? {}).length,
        });
      })
      .catch(() => {});
  }, [panel, guest]);

  /** GL 房间回调：点书 → 抽书；点鱼缸 → 推近后开弹窗；点空处 → 放回/退出拉近 */
  const glOpenTub = () => {
    if (openAuth("打开鱼缸，看看你的鱼")) return;
    setZoom("tub");
    window.setTimeout(() => setTankOpen(true), 700);
  };
  const glEmptyClick = () => {
    setZoom("");
    if (picked && !returning) putBack();
  };

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
        if (d.fish) setTankFish(d.fish.slice(0, 12));
        if (typeof d.plantSize === "number") setPlantSize(d.plantSize);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tankOpen]);

  // ---- 鱼儿的知识点泡泡：定期从课程要点里抽一条浮出水面，帮用户巩固所学 ----
  interface FishTip {
    lang: string;
    lessonId: string;
    courseName: string;
    lessonTitle: string;
    text: string;
  }
  const tipsPool = useMemo<FishTip[]>(() => {
    const pool: FishTip[] = [];
    for (const c of courses) {
      for (const { lesson } of flatLessons(c.lang)) {
        for (const kp of lesson.keyPoints.slice(0, 4)) {
          pool.push({
            lang: c.lang,
            lessonId: lesson.id,
            courseName: c.name,
            lessonTitle: lesson.title,
            text: kp,
          });
        }
      }
    }
    return pool;
  }, [courses]);

  const [tip, setTip] = useState<FishTip | null>(null);
  const [tipShown, setTipShown] = useState(false);
  useEffect(() => {
    if (tipsPool.length === 0) return;
    let alive = true;
    let hideTimer = 0;
    const rotate = () => {
      if (!alive) return;
      // 70% 概率优先从学过/看过的课里抽，帮记忆；没学过就全网抽
      const learned = tipsPool.filter(
        (t) =>
          progress?.lessons[t.lessonId]?.completed ||
          progress?.lessons[t.lessonId]?.visitedAt
      );
      const pool = learned.length > 0 && Math.random() < 0.7 ? learned : tipsPool;
      setTip(pool[Math.floor(Math.random() * pool.length)]);
      setTipShown(true);
      hideTimer = window.setTimeout(() => alive && setTipShown(false), 9500);
    };
    const first = window.setTimeout(rotate, 5200);
    const iv = window.setInterval(rotate, 26000);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(iv);
      window.clearTimeout(hideTimer);
    };
  }, [tipsPool, progress]);

  const tipLink =
    tip && (
      <Link
        href={`/learn/${tip.lang}/${tip.lessonId}`}
        onClick={(e) => {
          e.stopPropagation();
          if (openAuth("去复习这个知识点")) e.preventDefault();
        }}
        className={`fish-tip ${tipShown ? "is-show" : ""}`}
        title="鱼儿想起的知识点 —— 点击去复习"
      >
        <span className="fish-tip-cord" aria-hidden="true" />
        <span className="fish-tip-bubble">
          <span className="fish-tip-meta">
            🐟 {tip.courseName} · {tip.lessonTitle}
          </span>
          <span className="fish-tip-text">💡 {tip.text}</span>
          <span className="fish-tip-go">去复习 →</span>
        </span>
      </Link>
    );

  const pick = (lang: string) => {
    if (openAuth(`抽出《${courses.find((c) => c.lang === lang)?.name ?? "一本书"}》`)) return;
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
  /** 给树苗浇水（桌面端盆栽 / 移动端工具条共用）；3D 模式下镜头拉近。
   *  每次点击都给出可见反馈：浇水动画 + 结果轻提示（满级/失败不再无声无息） */
  const waterPlant = async () => {
    if (openAuth("给树苗浇水，看它慢慢长大")) return;
    if (watering) return;
    if (plantSize >= 5) {
      showToast("🌳 树苗已经长成大树啦，明天再来看它吧");
      return;
    }
    setWatering(true);
    setZoom((z) => z || "plant");
    const before = plantSize;
    try {
      const r = await fetch("/api/aquarium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "water" }),
      });
      const d = await r.json();
      if (r.ok && typeof d.plantSize === "number") {
        setPlantSize(d.plantSize);
        showToast(
          d.plantSize > before
            ? "💧 浇水成功，树苗长大了一点！"
            : "💧 浇好了～树苗正在慢慢吸收"
        );
      } else {
        showToast(d?.error ?? "浇水没成功，稍后再试试", "warn");
      }
    } catch {
      showToast("网络开小差了，浇水没成功", "warn");
    } finally {
      window.setTimeout(() => {
        setWatering(false);
        setZoom((z) => (z === "plant" ? "" : z));
      }, 1500);
    }
  };

  /** 点击书以外的任意区域 = 放回书架 / 退出镜头拉近 */
  const handleSceneClick = (e: React.MouseEvent) => {
    // GL 房间模式：画布内部点击已由 Room3D 自行处理，这里不重复响应
    if ((e.target as HTMLElement).closest(".room-gl-wrap")) return;
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
        className={`shelf-scene ${sceneCls} ${picked ? "has-book" : ""} ${
          opened ? "is-open-book" : ""
        }`}
        onClick={handleSceneClick}
        onMouseMove={onSceneMouseMove}
        onMouseLeave={onSceneMouseLeave}
      >
        {/* 3D 房间层：Three.js 真实 3D（全端）；2D 模式为旧平面布局 */}
        <div className="room-stage">
          {mode3d && (
            <Room3DGl
              courses={courses}
              stats={stats}
              lockedLangs={lockedLangs}
              plantSize={plantSize}
              watering={watering}
              tankFish={tankFish}
              tip={tip}
              tipShown={tipShown}
              dimmed={!!picked}
              focus={zoom}
              roomStats={roomStats}
              isAdmin={isAdmin}
              onTagPanel={(id) => {
                if (openAuth(`打开「${TAG_PANELS[id]?.title ?? "功能"}」`)) return;
                setPanel(id);
              }}
              onSceneTheme={(night) => {
                // 吊灯切换日夜时，同步站点主题（与导航栏主题按钮同一套存储）
                document.documentElement.classList.toggle("dark", night);
                localStorage.setItem("ct-theme", night ? "dark" : "light");
              }}
              revealAt={revealAt}
              onPickBook={pick}
              onOpenTub={glOpenTub}
              onWaterPlant={waterPlant}
              onFocusShelf={() => setZoom("shelf")}
              onFocusWindow={() => setZoom("window")}
              onNavigate={(href) => {
                if (openAuth("这个入口需要注册后访问")) return;
                router.push(href);
              }}
              onEmptyClick={glEmptyClick}
            />
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
          <Link
            key={label}
            href={href}
            className="wall-tag"
            onClick={(e) => {
              if (openAuth(`打开「${label}」`)) e.preventDefault();
            }}
          >
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
              if (openAuth("打开鱼缸，看看你的鱼")) return;
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
            <Link
              href={giftBox.href}
              className="mt-btn"
              aria-label={`打开礼物：${giftBox.label}`}
              onClick={(e) => {
                if (openAuth(`打开${giftBox.label}`)) e.preventDefault();
              }}
            >
              <span aria-hidden="true">🎁</span>
              <span className="mt-label">{giftBox.label}</span>
            </Link>
          )}
          {/* 移动端知识点泡泡：放在工具条上，点击跳去复习 */}
          {tip && (
            <Link
              href={`/learn/${tip.lang}/${tip.lessonId}`}
              onClick={(e) => e.stopPropagation()}
              className={`fish-tip-m ${tipShown ? "is-show" : ""}`}
              title={`${tip.courseName} · ${tip.lessonTitle}`}
            >
              💡 {tip.text}
            </Link>
          )}
        </div>
      )}

      {/* 鱼缸浴缸：小鱼游动，点击放大查看 + 用 XP 养鱼（3D 模式先拉近镜头再开弹窗） */}
      <button
        className="room-tub"
        onClick={(e) => {
          e.stopPropagation();
          if (openAuth("打开鱼缸，看看你的鱼")) return;
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
            {/* 缸内装饰：水草 + 上升的气泡 */}
            <i className="tub-weed w1" aria-hidden="true" />
            <i className="tub-weed w2" aria-hidden="true" />
            <i className="tub-bubble b1" aria-hidden="true" />
            <i className="tub-bubble b2" aria-hidden="true" />
            <i className="tub-bubble b3" aria-hidden="true" />
            {tankFish.map((f, i) => (
              <i
                key={f.id}
                className={`tub-fish tf-${i % 3}`}
                style={
                  {
                    "--dur": `${8 + (i % 5) * 2.4}s`,
                    "--dist": "104px",
                    "--bob-delay": `${-i * 1.4}s`,
                    top: `${16 + (i % 4) * 21}%`,
                    animationDelay: `${-i * 2.7}s`,
                  } as React.CSSProperties
                }
              >
                <span className="fish-bob">
                  <TankFish species={f.species} size={0.72 + (i % 3) * 0.13} />
                </span>
              </i>
            ))}
            {tankFish.length === 0 && (
              <>
                <i className="tub-fish tf-0" style={{ "--dur": "9.5s", top: "22%" } as React.CSSProperties}>
                  <span className="fish-bob">
                    <TankFish species="guppy" size={0.78} />
                  </span>
                </i>
                <i className="tub-fish tf-1" style={{ "--dur": "12.5s", top: "58%" } as React.CSSProperties}>
                  <span className="fish-bob">
                    <TankFish species="goldfish" size={0.92} />
                  </span>
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

      {/* 鱼儿吐出的知识点泡泡（桌面端房间内；移动端在工具条上方） */}
      {tipLink}

      {/* 墙上挂的礼物挂件（增值包入口）：钉子 + 缎带吊绳 + 礼盒牌 */}
      {giftBox && (
        <Link
          href={giftBox.href}
          className="gift-box"
          aria-label={`打开礼物：${giftBox.label}`}
          onClick={(e) => {
            if (openAuth(`打开${giftBox.label}`)) e.preventDefault();
          }}
        >
          <span className="gift-nail" aria-hidden="true" />
          <span className="gift-cord" aria-hidden="true" />
          <span className="gift-hanger">
            <span className="gift-bow" aria-hidden="true">
              <span className="bow-loop bow-loop-l" />
              <span className="bow-loop bow-loop-r" />
              <span className="bow-knot" />
            </span>
            <span className="gift-body" aria-hidden="true">
              <span className="gift-ribbon-v" />
              <span className="gift-print">{giftBox.label}</span>
            </span>
            <span className="gift-tag">{giftBox.sub}</span>
          </span>
          <span className="gift-sparkle sparkle-a" aria-hidden="true">
            ✦
          </span>
          <span className="gift-sparkle sparkle-b" aria-hidden="true">
            ✦
          </span>
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
          <PlantSvg stage={plantSize} />
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

      {/* 墙上挂牌悬浮面板：点击场景里的牌子弹出 */}
      {panel && TAG_PANELS[panel] && (
        <div
          className="wall-panel-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <div className="wall-panel" role="dialog" aria-label={TAG_PANELS[panel].title}>
            <button
              className="wall-panel-close"
              onClick={() => setPanel(null)}
              aria-label="关闭"
            >
              ✕
            </button>
            <p className="wall-panel-icon" aria-hidden="true">
              {TAG_PANELS[panel].icon}
            </p>
            <h3 className="wall-panel-title">{TAG_PANELS[panel].title}</h3>
            <p className="wall-panel-desc">{TAG_PANELS[panel].desc}</p>
            {panel === "notebook" && (
              <p className="wall-panel-stats">
                ⭐ 收藏 {nbCounts?.fav ?? "…"} · 🧯 错题 {nbCounts?.wrong ?? "…"} · 📝 笔记 {nbCounts?.notes ?? 0}
              </p>
            )}
            {panel === "report" && (
              <p className="wall-panel-stats">
                ⚡ {roomStats.xp} XP · 🔥 连续 {roomStats.streak} 天 · ✅ 完成 {roomStats.done} 课
              </p>
            )}
            <Link
              href={TAG_PANELS[panel].href}
              className="wall-panel-cta"
              onClick={(e) => {
                if (openAuth(`打开「${TAG_PANELS[panel].title}」`)) e.preventDefault();
                else setPanel(null);
              }}
            >
              {TAG_PANELS[panel].cta} →
            </Link>
          </div>
        </div>
      )}

      {/* 访客注册引导：第一次点击 3D 场景里的物件时弹出（key 保证每次打开都是干净表单） */}
      <AuthModal
        key={authOpen ? "open" : "closed"}
        open={authOpen}
        reason={authReason}
        onClose={() => setAuthOpen(false)}
      />

      {/* 镜头拉近提示 */}
      {zoom && (
        <div className="zoom-hint" aria-hidden="true">
          ↩ 点击空白处返回全景
        </div>
      )}

      {/* 轻提示（浇水结果等；不用 alert，不打断场景） */}
      {toast && (
        <div className={`room-toast ${toast.kind === "warn" ? "is-warn" : ""}`} role="status">
          {toast.text}
        </div>
      )}

      {/* 3D 开门进场：首访门关着印字等待推门；老访客自动开门 */}
      <div
        className={`room-door is-${doors}`}
        aria-hidden={doors === "open"}
        onClick={enterRoom}
        role={doors === "closed" ? "button" : undefined}
        aria-label={doors === "closed" ? "推开门，进入 TutorAI" : undefined}
      >
        <div className="door-panel door-l">
          <span className="door-molding" aria-hidden="true" />
          <span className="door-knob" aria-hidden="true" />
          <div className="door-lead" aria-hidden="true">
            <p className="door-lead-line">准备好进入</p>
          </div>
        </div>
        <div className="door-panel door-r">
          <span className="door-molding" aria-hidden="true" />
          <span className="door-knob" aria-hidden="true" />
          <div className="door-lead" aria-hidden="true">
            <p className="door-lead-line">TutorAI 的世界了吗</p>
            <p className="door-lead-hint">👆 点门把手 · 推门而入</p>
          </div>
        </div>
      </div>
    </>
  );
}
