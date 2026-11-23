"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Course } from "@/lib/types";

/**
 * Three.js 真实 3D 房间（仅桌面 3D 视角模式挂载）：
 *  - 房间壳：木地板 / 三面墙 / 踢脚线 / 吊灯（真实点光源 + 阴影）
 *  - 书柜：退到房间深处，每门课程一本可点击的 3D 书（书脊 canvas 纹理）
 *  - 墙面挂件：挂钟（真实走时）/ 三轴卷轴 / 挂历 / 木牌入口（可点）/ 礼包（可点，挂在墙上）
 *  - 鱼缸：玻璃缸 + 水体 + 五种形态各异的 3D 鱼（游动/摆尾/浮沉）+ 水草 + 气泡
 *  - 树苗：随 stage 生长，可点击浇水（浇水时落水滴）
 *  - 交互：射线拾取点击 / 悬停放大 + 手型光标 / 鼠标视差 / 点击物件镜头推近
 *  - 知识点气泡：锚定到「说话的鱼」头部，随鱼投影位置实时跟随
 */

export interface RoomTip {
  lang: string;
  lessonId: string;
  courseName: string;
  lessonTitle: string;
  text: string;
}

interface Props {
  courses: Course[];
  stats: Record<string, { done: number; total: number; pct: number }>;
  lockedLangs: string[];
  plantSize: number;
  watering: boolean;
  tankFish: { id: string; species: string }[];
  tip: RoomTip | null;
  tipShown: boolean;
  /** 抽出书阅读时压暗房间 */
  dimmed: boolean;
  /** 镜头推近目标 */
  focus: "" | "tub" | "plant" | "shelf" | "window";
  /** 房间挂牌实时数据（卷轴） */
  roomStats: { xp: number; streak: number; done: number };
  /** 当前用户是否管理员（决定后台入口是否出现） */
  isAdmin?: boolean;
  /** 点击墙上挂牌 → 弹出悬浮面板 */
  onTagPanel: (id: string) => void;
  /** 场景日夜切换 → 同步站点主题 */
  onSceneTheme: (night: boolean) => void;
  /** 首访开门时间戳（>0 触发魔法入场序列） */
  revealAt: number;
  onPickBook: (lang: string) => void;
  onOpenTub: () => void;
  onWaterPlant: () => void;
  /** 点击书柜空白 → 拉近书架 */
  onFocusShelf: () => void;
  /** 点击窗户（窗帘已开）→ 拉近观景 */
  onFocusWindow: () => void;
  onNavigate: (href: string) => void;
  onEmptyClick: () => void;
}

/** 与 Bookshelf 的书脊配色一致 */
const SPINE: Record<string, [string, string]> = {
  python: ["#2e6e9e", "#173c5c"],
  java: ["#a05a2c", "#5c2f18"],
  javascript: ["#b08d3e", "#6b5122"],
  typescript: ["#3d5a8f", "#22335e"],
  html: ["#a34a3c", "#5e241c"],
  docker: ["#2b7a8c", "#16424f"],
  linux: ["#6e7683", "#3c424c"],
  japanese: ["#a44a68", "#5e2438"],
  go: ["#2d7f6f", "#174a3f"],
  swift: ["#b06a3c", "#6b3a1c"],
  nextjs: ["#565b64", "#26282e"],
};

/** canvas → 纹理（SRGB + 各向异性） */
function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  maxAniso = 4
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** 木地板纹理 */
function woodFloorTexture(maxAniso: number): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, "#6a4a26");
      g.addColorStop(0.55, "#503620");
      g.addColorStop(1, "#33210f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      // 木板条
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + (y % 128 ? 0.05 : 0)})`;
        ctx.fillRect(0, y, 512, 62);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
        // 板缝错位
        const off = (y / 64) % 2 ? 128 : 256;
        ctx.beginPath();
        ctx.moveTo(off, y);
        ctx.lineTo(off, y + 64);
        ctx.stroke();
      }
      // 木纹
      ctx.strokeStyle = "rgba(255,220,170,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const y = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 2);
        ctx.stroke();
      }
    },
    maxAniso
  );
}

/** 墙面纹理（暗木墙板） */
function wallTexture(maxAniso: number): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, "#3d2c18");
      g.addColorStop(1, "#241a10");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 108) {
        ctx.fillStyle = "rgba(255,214,150,0.05)";
        ctx.fillRect(x + 2, 0, 52, 512);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
    },
    maxAniso
  );
}

/** 窗外天空：白天 = 蓝天 + 太阳 + 云；夜晚 = 深蓝 + 星空 + 月亮 */
function skyTexture(day: boolean): THREE.CanvasTexture {
  return canvasTexture(512, 640, (ctx) => {
    // 纯渐变背景：月亮/太阳/星星/云全部由 3D 元素渲染，避免重复
    const g = ctx.createLinearGradient(0, 0, 0, 640);
    if (day) {
      g.addColorStop(0, "#5fb8ee");
      g.addColorStop(1, "#d6ecff");
    } else {
      g.addColorStop(0, "#0b1530");
      g.addColorStop(1, "#233a63");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 640);
  });
}

/** 书柜木纹（纵向纹理） */
function cabinetTexture(maxAniso: number): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#8a5a2f");
    g.addColorStop(1, "#5c3a1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? "255,220,170" : "40,20,5"},${0.04 + Math.random() * 0.06})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 6, 170, x - 6, 340, x + 3, 512);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
  }, maxAniso);
}

/** 书页侧面（米白 + 细横线） */
function pagesTexture(maxAniso: number): THREE.CanvasTexture {
  return canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = "#f3ecd8";
    ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = "rgba(160,130,80,0.35)";
    ctx.lineWidth = 1;
    for (let y = 6; y < 256; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
  }, maxAniso);
}

/** 书脊纹理：布面/皮面质感 + 竖排烫金课名 + 底部进度（书店风格） */
function spineTexture(course: Course, pct: number, locked: boolean): THREE.CanvasTexture {
  const [from, to] = SPINE[course.lang] ?? ["#7c6f58", "#443a2a"];
  return canvasTexture(192, 768, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 192, 768);
    // 布纹经纬
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = "rgba(0,0,0," + (0.02 + Math.random() * 0.035) + ")";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * 768);
      ctx.lineTo(192, Math.random() * 768);
      ctx.stroke();
    }
    // 圆脊光影（左亮右暗）
    const hl = ctx.createLinearGradient(0, 0, 192, 0);
    hl.addColorStop(0, "rgba(255,255,255,0.2)");
    hl.addColorStop(0.28, "rgba(255,255,255,0)");
    hl.addColorStop(0.78, "rgba(0,0,0,0)");
    hl.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, 192, 768);
    // 上下装订压凹槽（暗线 + 亮线）
    [58, 88, 678, 708].forEach((y, k) => {
      ctx.strokeStyle = "rgba(0,0,0,0.42)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(176, y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,205,0.22)";
      ctx.lineWidth = 1.4;
      const yy = k % 2 ? y - 4 : y + 4;
      ctx.beginPath();
      ctx.moveTo(16, yy);
      ctx.lineTo(176, yy);
      ctx.stroke();
    });
    if (locked) {
      ctx.fillStyle = "rgba(18,14,8,0.45)";
      ctx.fillRect(0, 0, 192, 768);
    }
    // 顶部徽记（细金圈 + emoji）
    ctx.beginPath();
    ctx.arc(96, 150, 42, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(214,182,112,0.9)";
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.font = "50px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(locked ? "🔒" : course.emoji, 96, 152);
    // 竖排课名（衬线烫金 + 投影）
    ctx.save();
    ctx.translate(96, 400);
    ctx.rotate(Math.PI / 2);
    ctx.font = "700 58px 'Songti SC','PingFang SC',serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillText(course.name, 3, 3, 520);
    ctx.fillStyle = "#f0e2bd";
    ctx.fillText(course.name, 0, 0, 520);
    ctx.restore();
    // 底部进度（百分比 + 细金条）
    ctx.font = "600 32px 'PingFang SC',sans-serif";
    ctx.fillStyle = "rgba(240,226,189,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(locked ? "未解锁" : pct + "%", 96, 622);
    const barY = 644;
    const barW = 120;
    const barX = 36;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(barX, barY, barW, 9);
    if (!locked) {
      ctx.fillStyle = "#d9b56a";
      ctx.fillRect(barX, barY, Math.round(barW * Math.min(1, pct / 100)), 9);
    }
  });
}
/** 月面纹理：灰白底 + 月海暗斑 + 颗粒 + 环形山（凹坑 + 内影 + 亮缘） */
function moonTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#efe9d8";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(148,145,128,0.5)";
    [[72, 92, 46], [152, 70, 34], [192, 132, 40], [92, 172, 38], [162, 196, 26]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.78, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,252,240,0.06)" : "rgba(110,105,90,0.06)";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    [[60, 60, 13], [122, 42, 8], [200, 62, 11], [42, 130, 9], [96, 106, 6], [170, 100, 7], [222, 162, 9], [130, 150, 12], [70, 202, 8], [182, 222, 6], [32, 42, 6], [210, 112, 5], [106, 222, 7], [150, 176, 5], [236, 40, 4], [16, 170, 5]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(104,100,86,0.5)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.12, y + r * 0.12, r * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(82,79,68,0.5)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.18, y - r * 0.18, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(238,232,214,0.55)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.98, -Math.PI * 0.2, Math.PI * 0.5);
      ctx.strokeStyle = "rgba(250,246,230,0.7)";
      ctx.lineWidth = Math.max(1.4, r * 0.2);
      ctx.stroke();
    });
  });
}
/** 挂历纹理：当月日历，今日标红 */
function calendarTexture(now: Date): THREE.CanvasTexture {
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const firstDow = new Date(y, m, 1).getDay();
  const today = now.getDate();
  return canvasTexture(560, 700, (ctx) => {
    ctx.fillStyle = "#f7f1e0";
    ctx.fillRect(0, 0, 560, 700);
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(0, 0, 560, 160);
    ctx.fillStyle = "#fff5e6";
    ctx.textAlign = "left";
    ctx.font = "800 92px 'PingFang SC',sans-serif";
    ctx.fillText(`${m + 1} 月`, 40, 112);
    ctx.font = "500 58px sans-serif";
    ctx.fillText(String(y), 370, 106);
    ctx.fillStyle = "#4a3b22";
    const cols = 7;
    const cell = 72;
    const ox = 32;
    const oy = 232;
    for (let d = 1; d <= days; d++) {
      const idx = firstDow + d - 1;
      const cx = ox + (idx % cols) * cell;
      const cy = oy + Math.floor(idx / cols) * cell;
      if (d === today) {
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.arc(cx + 16, cy - 12, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
      } else {
        ctx.fillStyle = d % 7 === 0 || d % 7 === 1 ? "#b91c1c" : "#4a3b22";
      }
      ctx.font = "500 38px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(d), cx + 16, cy);
    }
  });
}

/** 挂钟表盘 */
function clockFaceTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const g = ctx.createRadialGradient(200, 170, 40, 256, 256, 260);
    g.addColorStop(0, "#fdf8ea");
    g.addColorStop(1, "#efe6cd");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();
    // 刻度
    ctx.strokeStyle = "#6d4a1f";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 === 0 ? 10 : 4;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200);
      ctx.lineTo(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236);
      ctx.stroke();
    }
    ctx.fillStyle = "#7a5a2e";
    ctx.font = "700 56px Georgia,serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("12", 256, 96);
    ctx.fillText("3", 416, 256);
    ctx.fillText("6", 256, 416);
    ctx.fillText("9", 96, 256);
  });
}

/** 木牌文字 */
function tagTexture(label: string): THREE.CanvasTexture {
  return canvasTexture(320, 110, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 320, 110);
    g.addColorStop(0, "#4a321c");
    g.addColorStop(0.58, "#2b1f14");
    g.addColorStop(1, "#1d150d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 110);
    ctx.strokeStyle = "rgba(201,162,75,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 304, 94);
    ctx.fillStyle = "#ffecbe";
    ctx.font = "700 56px 'Songti SC','STSong',serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 160, 58);
  });
}

/** 墙上浮雕题字：Tutor（金）+ AI（彩色），多层描边营造浮雕立体感 */
function signTexture(): THREE.CanvasTexture {
  return canvasTexture(1400, 400, (ctx) => {
    ctx.clearRect(0, 0, 1400, 400);
    const font = "italic 900 200px 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = font;
    const wTutor = ctx.measureText("Tutor").width;
    const wAI = ctx.measureText("AI").width;
    const total = wTutor + wAI;
    const x0 = (1400 - total) / 2;
    const by = 200;
    const parts: Array<{ text: string; x: number; grad: (a: number, b: number) => CanvasGradient }> = [
      {
        text: "Tutor",
        x: x0,
        grad: () => {
          const g = ctx.createLinearGradient(0, by - 110, 0, by + 60);
          g.addColorStop(0, "#fdf3cf");
          g.addColorStop(0.45, "#eec96a");
          g.addColorStop(0.75, "#c98f2e");
          g.addColorStop(1, "#8a5a1e");
          return g;
        },
      },
      {
        text: "AI",
        x: x0 + wTutor,
        grad: (a: number, b: number) => {
          const g = ctx.createLinearGradient(a, 0, b, 0);
          g.addColorStop(0, "#f87171");
          g.addColorStop(0.3, "#fbbf24");
          g.addColorStop(0.55, "#34d399");
          g.addColorStop(0.8, "#60a5fa");
          g.addColorStop(1, "#c084fc");
          return g;
        },
      },
    ];
    for (const p of parts) {
      const b = p.x + (p.text === "Tutor" ? wTutor : wAI);
      ctx.font = font;
      // ① 深色投影（下右）
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillText(p.text, p.x + 7, by + 9);
      // ② 亮色高光（上左）→ 浮雕凸起感
      ctx.fillStyle = "rgba(255, 244, 214, 0.4)";
      ctx.fillText(p.text, p.x - 3, by - 4);
      // ③ 主渐变
      ctx.fillStyle = p.grad(p.x, b);
      ctx.fillText(p.text, p.x, by);
      // ④ 细描边（倒角棱线）
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.strokeText(p.text, p.x, by);
    }
    // 两端花饰
    ctx.font = "italic 700 60px 'Snell Roundhand', cursive";
    ctx.fillStyle = "rgba(251, 191, 36, 0.55)";
    ctx.fillText("❦", Math.max(20, x0 - 120), by + 10);
    ctx.fillText("❦", Math.min(1340, x0 + total + 70), by + 10);
  });
}

interface FishRig {
  group: THREE.Group;
  tail: THREE.Group;
  pec: THREE.Group | null;
  speed: number;
  phase: number;
  a: number;
  b: number;
  yBase: number;
  tailFreq: number;
  tailAmp: number;
  speaking: boolean;
  /** 刚结束说话：平滑游回巡游路径 */
  resume: boolean;
  yaw: number;
  /** 鱼头在 group 本地坐标里的偏移（知识点气泡锚定用） */
  headOffset: THREE.Vector3;
}

/** 五种鱼：旋转成型（Lathe）身体 + 异形尾鳍/背鳍（Shape 轮廓平面），头朝 +X。
 *  身体经 xShift 平移后鼻尖位于 x=xShift、尾根位于 x=xShift-L；
 *  尾鳍组、眼睛、头锚点全部对齐这条轴线。 */
/** 鱼鳞纹理：底色 + 交叠弧鳞（鳞片下缘亮、上缘暗，环向铺满体表） */
function scaleTexture(base: number): THREE.CanvasTexture {
  const col = new THREE.Color(base);
  const dark = col.clone().multiplyScalar(0.68);
  const light = col.clone().multiplyScalar(1.22);
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#" + col.getHexString();
    ctx.fillRect(0, 0, 256, 256);
    const R2 = 14;
    for (let row = 0; row < 13; row++) {
      const y0 = row * 21;
      const off = row % 2 ? R2 : 0;
      for (let xi = -1; xi < 11; xi++) {
        const cx = xi * R2 * 2 + off;
        ctx.beginPath();
        ctx.arc(cx, y0, R2, 0, Math.PI);
        ctx.strokeStyle = dark.getStyle();
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, y0 + 3, R2, Math.PI * 0.15, Math.PI * 0.85);
        ctx.strokeStyle = light.getStyle();
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }
  });
}
function buildFish(species: string): FishRig {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const tail = new THREE.Group();
  const std = (c: number, rough = 0.55) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: rough,
      metalness: 0.05,
      emissive: c,
      emissiveIntensity: 0.16,
    });
  const flat = (c: number, opacity = 0.95) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity,
      emissive: c,
      emissiveIntensity: 0.12,
    });
  /** 带鳞片纹理的体表材质（微金属光泽，模拟鱼鳞反光） */
  const scaled = (c: number, rough = 0.5) =>
    new THREE.MeshStandardMaterial({
      map: scaleTexture(c),
      roughness: rough,
      metalness: 0.22,
      emissive: c,
      emissiveIntensity: 0.12,
    });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = inner) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };
  /** 2D 轮廓 → 加厚鳍片（ExtrudeGeometry，侧看不消失） */
  const fin = (pts: [number, number][], mat: THREE.Material, parent: THREE.Object3D = inner) => {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    // 样条曲线过点（鳍缘圆滑无折角）
    if (pts.length > 2) shape.splineThru(pts.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
    else for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false, curveSegments: 48 }),
      mat
    );
    m.position.z = -0.0035;
    parent.add(m);
    return m;
  };
  /** 旋转成型身体：profile [半径, 轴向y]，y=0 鼻尖 → y=L 尾根；鼻尖位于 x=xShift
   *  控制点经 Catmull-Rom 细分（每段 6 点）+ 128 环向分段，轮廓平滑无棱角 */
  const body = (profile: [number, number][], mat: THREE.Material, xShift: number) => {
    const curve = new THREE.CatmullRomCurve3(
      profile.map(([r, y]) => new THREE.Vector3(Math.max(r, 0.0006), y, 0)),
      false,
      "centripetal"
    );
    const pts = curve
      .getPoints((profile.length - 1) * 10)
      .map((p) => new THREE.Vector2(Math.max(p.x, 0.0006), p.y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 160), mat);
    m.rotation.z = Math.PI / 2;
    m.position.x = xShift;
    inner.add(m);
    return m;
  };
  const eye = (x: number, y: number, z: number, r = 0.014) => {
    const w = add(new THREE.SphereGeometry(r, 24, 18), std(0xf5f8fa, 0.25));
    w.position.set(x, y, z);
    // 瞳孔贴在眼球外侧（朝鱼头前方），不再藏进球体里
    const side = z >= 0 ? 1 : -1;
    const b = add(new THREE.SphereGeometry(r * 0.5, 16, 12), std(0x101820, 0.2));
    b.position.set(x + r * 0.38, y + r * 0.1, z + side * r * 0.72);
    const hl = add(new THREE.SphereGeometry(r * 0.16, 12, 10), std(0xffffff, 0.1));
    hl.position.set(x + r * 0.42, y + r * 0.34, z + side * r * 0.78);
    return w;
  };
  const base = {
    speed: 0.24,
    phase: Math.random() * Math.PI * 2,
    a: 0.52,
    b: 0.15,
    yBase: 0.4,
    tailFreq: 7,
    tailAmp: 0.55,
    speaking: false,
    resume: false,
    yaw: 0,
    pec: null as THREE.Group | null,
  };
  let overrides: Partial<FishRig> = {};
  let headX = 0.12;

  if (species === "shark") {
    const L = 0.5;
    const nose = 0.21;
    const bodyMat = scaled(0x8fa6ba, 0.5);
    body(
      [
        [0.004, 0],
        [0.018, 0.04],
        [0.032, 0.1],
        [0.043, 0.16],
        [0.049, 0.22],
        [0.05, 0.26],
        [0.047, 0.3],
        [0.041, 0.35],
        [0.033, 0.4],
        [0.024, 0.44],
        [0.015, 0.47],
        [0.008, 0.5],
      ],
      bodyMat,
      nose
    );
    const belly = body(
      [
        [0.002, 0.05],
        [0.016, 0.1],
        [0.028, 0.16],
        [0.034, 0.22],
        [0.036, 0.27],
        [0.032, 0.32],
        [0.024, 0.37],
        [0.012, 0.42],
      ],
      std(0xdde7ee, 0.6),
      nose
    );
    belly.position.y = -0.02;
    // 背鳍（中背）
    const dorsal = fin(
      [
        [0, 0],
        [0.035, 0.065],
        [0.085, 0.055],
        [0.105, 0.005],
      ],
      flat(0x7e94a8)
    );
    dorsal.position.set(-0.02, 0.048, 0);
    // 月牙尾（挂在尾根）
    fin(
      [
        [0, 0.03],
        [-0.04, 0.075],
        [-0.11, 0.1],
        [-0.1, 0.055],
        [-0.085, 0.015],
        [-0.1, -0.03],
        [-0.115, -0.08],
        [-0.06, -0.06],
        [0, -0.025],
      ],
      flat(0x8fa6ba),
      tail
    );
    tail.position.set(nose - L, 0, 0);
    inner.add(tail);
    const pec = new THREE.Group();
    fin(
      [
        [0, 0],
        [-0.05, -0.02],
        [-0.06, -0.05],
        [0.01, -0.04],
      ],
      flat(0xdde7ee),
      pec
    );
    pec.position.set(nose - 0.11, -0.03, 0.035);
    pec.rotation.y = 0.35;
    inner.add(pec);
    // 鳃裂×3（两侧弧形刻痕，真实感细节）
    for (let gi = 0; gi < 3; gi++) {
      const gx = nose - 0.08 - gi * 0.03;
      const gr = 0.026 + gi * 0.007;
      for (const gz of [gr, -gr]) {
        const gill = fin(
          [
            [0, 0.012],
            [-0.02, 0.005],
            [0, -0.012],
          ],
          flat(0x5f7488)
        );
        gill.position.set(gx, 0, gz);
      }
    }
    eye(nose - 0.06, 0.02, 0.03);
    eye(nose - 0.06, 0.02, -0.03);
    headX = nose - 0.02;
    // 游动范围收紧到水体内部，不穿玻璃（留出鱼身长度）
    overrides = { speed: 0.3, a: 0.46, b: 0.12, yBase: 0.36, tailFreq: 5.5, tailAmp: 0.32 };
  } else if (species === "whale") {
    const L = 0.44;
    const nose = 0.185;
    const bodyMat = scaled(0x5b8fd6, 0.5);
    body(
      [
        [0.008, 0],
        [0.032, 0.04],
        [0.058, 0.09],
        [0.076, 0.15],
        [0.085, 0.2],
        [0.088, 0.25],
        [0.084, 0.3],
        [0.072, 0.35],
        [0.055, 0.39],
        [0.038, 0.42],
        [0.026, 0.44],
      ],
      bodyMat,
      nose
    );
    const belly = body(
      [
        [0.003, 0.06],
        [0.022, 0.11],
        [0.036, 0.17],
        [0.043, 0.23],
        [0.045, 0.28],
        [0.039, 0.33],
        [0.026, 0.37],
        [0.01, 0.4],
      ],
      std(0x9cc0ef, 0.6),
      nose
    );
    belly.position.y = -0.025;
    // 横向大尾鳍（水平面，挂尾根）
    const fluke = fin(
      [
        [0, 0],
        [-0.06, 0.07],
        [-0.15, 0.11],
        [-0.135, 0.06],
        [-0.12, 0.015],
        [-0.14, -0.045],
        [-0.16, -0.1],
        [-0.08, -0.07],
        [0, -0.015],
      ],
      flat(0x4a7fbf),
      tail
    );
    fluke.rotation.x = -Math.PI / 2;
    tail.position.set(nose - L, 0, 0);
    inner.add(tail);
    const dorsal = fin(
      [
        [0, 0],
        [0.045, 0.05],
        [0.09, 0.04],
        [0.11, 0.004],
      ],
      flat(0x4a7fbf)
    );
    dorsal.position.set(-0.03, 0.082, 0);
    const pec = new THREE.Group();
    fin(
      [
        [0, 0],
        [-0.055, -0.025],
        [-0.065, -0.055],
        [0.008, -0.045],
      ],
      flat(0x9cc0ef),
      pec
    );
    pec.position.set(nose - 0.09, -0.05, 0.05);
    pec.rotation.y = 0.4;
    inner.add(pec);
    eye(nose - 0.055, 0.005, 0.05, 0.013);
    eye(nose - 0.055, 0.005, -0.05, 0.013);
    headX = nose - 0.018;
    overrides = { speed: 0.16, a: 0.4, b: 0.09, yBase: 0.3, tailFreq: 3.2, tailAmp: 0.28 };
  } else if (species === "puffer") {
    const bodyMat = scaled(0xffd35e, 0.55);
    const body = add(new THREE.SphereGeometry(0.07, 48, 32), bodyMat);
    body.scale.set(1.1, 0.92, 0.92);
    const spikeMat = std(0xe0a63f, 0.6);
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const spike = add(new THREE.ConeGeometry(0.006, 0.024, 12), spikeMat);
      const dir = new THREE.Vector3(0, Math.cos(th) * 0.065, Math.sin(th) * 0.065);
      if (i % 3 === 0) dir.x = 0.03 * (i % 2 ? 1 : -1);
      spike.position.copy(dir);
      spike.lookAt(dir.clone().multiplyScalar(4));
      spike.rotateX(Math.PI / 2);
    }
    fin(
      [
        [0, 0.022],
        [-0.05, 0.03],
        [-0.045, -0.03],
        [0, -0.022],
      ],
      flat(0xffe27a),
      tail
    );
    tail.position.set(-0.065, 0, 0);
    inner.add(tail);
    const pec = new THREE.Group();
    fin(
      [
        [0, 0],
        [-0.03, -0.008],
        [-0.032, -0.024],
        [0.004, -0.02],
      ],
      flat(0xffe9a8),
      pec
    );
    pec.position.set(0.02, -0.02, 0.055);
    inner.add(pec);
    eye(0.048, 0.02, 0.048, 0.017);
    eye(0.048, 0.02, -0.048, 0.017);
    headX = 0.06;
    overrides = { speed: 0.12, a: 0.38, b: 0.1, yBase: 0.32, tailFreq: 9, tailAmp: 0.4 };
  } else if (species === "goldfish") {
    const L = 0.27;
    const nose = 0.108;
    const bodyMat = scaled(0xff6a2c, 0.42);
    const finMat = flat(0xff8a3c);
    body(
      [
        [0.006, 0],
        [0.028, 0.03],
        [0.052, 0.06],
        [0.072, 0.1],
        [0.082, 0.13],
        [0.084, 0.16],
        [0.075, 0.19],
        [0.058, 0.22],
        [0.036, 0.25],
        [0.018, 0.27],
      ],
      bodyMat,
      nose
    );
    // 飘逸大背鳍（背中）
    const dorsal = fin(
      [
        [0, 0],
        [0.04, 0.05],
        [0.085, 0.06],
        [0.125, 0.03],
      ],
      finMat
    );
    dorsal.rotation.z = Math.PI / 2;
    dorsal.position.set(-0.03, 0.062, 0);
    // 双层飘逸长尾（挂尾根）
    fin(
      [
        [0, 0.035],
        [-0.05, 0.058],
        [-0.105, 0.065],
        [-0.125, 0.04],
        [-0.135, 0.012],
        [-0.118, -0.015],
        [-0.105, -0.04],
        [-0.125, -0.065],
        [-0.135, -0.09],
        [-0.09, -0.078],
        [-0.065, -0.06],
        [-0.03, -0.05],
        [0, -0.035],
      ],
      finMat,
      tail
    );
    fin(
      [
        [0, 0.022],
        [-0.07, 0.035],
        [-0.095, 0],
        [-0.065, -0.032],
        [0, -0.022],
      ],
      flat(0xffb27a, 0.8),
      tail
    );
    tail.position.set(nose - L, 0, 0);
    inner.add(tail);
    const pec = new THREE.Group();
    fin(
      [
        [0, 0],
        [-0.05, -0.02],
        [-0.06, -0.055],
        [0.008, -0.045],
      ],
      finMat,
      pec
    );
    pec.position.set(nose - 0.055, -0.035, 0.042);
    pec.rotation.y = 0.4;
    inner.add(pec);
    eye(nose - 0.04, 0.02, 0.042);
    eye(nose - 0.04, 0.02, -0.042);
    headX = nose - 0.012;
    overrides = { speed: 0.2, a: 0.46, b: 0.13, yBase: 0.42, tailFreq: 6, tailAmp: 0.42 };
  } else {
    // guppy：细长身体 + 超大扇尾
    const L = 0.18;
    const nose = 0.076;
    const bodyMat = scaled(0xc9a276, 0.4);
    const tailMat = flat(0xff8a50);
    body(
      [
        [0.005, 0],
        [0.013, 0.02],
        [0.022, 0.05],
        [0.03, 0.08],
        [0.034, 0.11],
        [0.032, 0.13],
        [0.026, 0.15],
        [0.02, 0.16],
        [0.014, 0.18],
      ],
      bodyMat,
      nose
    );
    // 超大扇尾（挂尾根）
    fin(
      [
        [0, 0.014],
        [-0.03, 0.038],
        [-0.056, 0.052],
        [-0.09, 0.06],
        [-0.12, 0.063],
        [-0.13, 0.042],
        [-0.133, 0.02],
        [-0.13, -0.008],
        [-0.12, -0.035],
        [-0.09, -0.05],
        [-0.056, -0.056],
        [-0.028, -0.04],
        [0, -0.014],
      ],
      tailMat,
      tail
    );
    fin(
      [
        [0, 0.012],
        [-0.07, 0.032],
        [-0.115, 0.02],
        [-0.07, -0.032],
        [0, -0.012],
      ],
      flat(0xffc08a, 0.8),
      tail
    );
    tail.position.set(nose - L, 0, 0);
    inner.add(tail);
    const dorsal = fin(
      [
        [0, 0],
        [0.025, 0.03],
        [0.055, 0.032],
        [0.065, 0.004],
      ],
      tailMat
    );
    dorsal.rotation.z = Math.PI / 2;
    dorsal.position.set(-0.015, 0.028, 0);
    const pec = new THREE.Group();
    fin(
      [
        [0, 0],
        [-0.032, -0.012],
        [-0.036, -0.03],
        [0.004, -0.026],
      ],
      tailMat,
      pec
    );
    pec.position.set(nose - 0.04, -0.018, 0.028);
    inner.add(pec);
    eye(nose - 0.028, 0.015, 0.025, 0.012);
    eye(nose - 0.028, 0.015, -0.025, 0.012);
    headX = nose - 0.008;
    overrides = { speed: 0.26, a: 0.5, b: 0.14, yBase: 0.48, tailFreq: 8, tailAmp: 0.5 };
  }
  // 嘴部（鼻尖微张的小口）
  const mouth = add(new THREE.SphereGeometry(0.0075, 12, 10), std(0x241a14, 0.5));
  mouth.position.set(headX + 0.014, -0.01, 0);
  mouth.scale.set(0.75, 0.5, 0.95);
  inner.scale.setScalar(1);
  inner.renderOrder = 1;

  return {
    ...base,
    ...overrides,
    group,
    tail,
    pec: overrides.pec ?? null,
    headOffset: new THREE.Vector3(headX, 0.01, 0),
  };
}

export default function Room3D({
  courses,
  stats,
  lockedLangs,
  plantSize,
  watering,
  tankFish,
  tip,
  tipShown,
  dimmed,
  focus,
  roomStats,
  isAdmin = false,
  onTagPanel,
  onSceneTheme,
  revealAt,
  onPickBook,
  onOpenTub,
  onWaterPlant,
  onFocusShelf,
  onFocusWindow,
  onNavigate,
  onEmptyClick,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLAnchorElement>(null);
  const apiRef = useRef<{
    setPlant: (s: number) => void;
    setWatering: (v: boolean) => void;
    setFish: (list: { id: string; species: string }[]) => void;
    setDimmed: (v: boolean) => void;
    setFocus: (f: "" | "tub" | "plant" | "shelf" | "window") => void;
    setSpeaking: (idx: number | null) => void;
    setScrolls: (xp: number, streak: number, done: number) => void;
    startReveal: () => void;
    fishCount: () => number;
  } | null>(null);

  // 场景初始化（仅一次）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = "room-gl-canvas";
    wrap.appendChild(renderer.domElement);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16100a);
    const portrait = wrap.clientWidth / wrap.clientHeight < 1;
    const camera = new THREE.PerspectiveCamera(
      portrait ? 56 : 44,
      wrap.clientWidth / wrap.clientHeight,
      0.1,
      60
    );
    // 轨道相机：拖拽旋转 / 滚轮·双指缩放（focus 拉近时由推拉镜头接管）
    const ORBIT_LOOK = new THREE.Vector3(0, 1.34, -0.3);
    const orbit = { yaw: 0, pitch: 0.05, r: portrait ? 7.2 : 6.15 };
    let focusCur: "" | "tub" | "plant" | "shelf" | "window" = "";
    let dimmedNow = dimmed; // 抽书阅读中：画布点击一律放回书架
    const FOCI: Record<string, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
      tub: { pos: new THREE.Vector3(2.75, 1.35, 2.4), look: new THREE.Vector3(2.75, 0.95, 0.05) },
      plant: { pos: new THREE.Vector3(-1.7, 0.68, 3.1), look: new THREE.Vector3(-1.7, 0.42, 1.6) },
      shelf: { pos: new THREE.Vector3(0, 1.42, 3.1), look: new THREE.Vector3(0, 1.18, -2.0) },
      window: { pos: new THREE.Vector3(-2.35, 2.0, 1.0), look: new THREE.Vector3(-2.58, 2.3, -2.31) },
    };
    camera.position.set(0, 1.62, 5.6);
    const lookAt = ORBIT_LOOK.clone();

    // ---------- 灯光 ----------
    scene.add(new THREE.AmbientLight(0xffe2b8, 0.55));
    const hemi = new THREE.HemisphereLight(0xffe7c4, 0x2a1c10, 0.7);
    scene.add(hemi);
    const lampLight = new THREE.PointLight(0xffd9a0, 26, 14, 2);
    lampLight.position.set(0.55, 3.05, -0.55);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.0004;
    scene.add(lampLight);
    // 左侧补光（照亮树苗/卷轴区域）+ 缸内补光（让鱼透出水体）
    const fillL = new THREE.PointLight(0xffe6c4, 7, 9, 2);
    fillL.position.set(-2.2, 2.6, 2.2);
    scene.add(fillL);
    const tankLight = new THREE.PointLight(0xdff2ff, 0.9, 2.2, 2);
    tankLight.position.set(2.75, 1.4, 0.05);
    scene.add(tankLight);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    fill.position.set(-3, 4, 3);
    scene.add(fill);

    // ---------- 房间壳 ----------
    const floorTex = woodFloorTexture(maxAniso);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 3);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallTex = wallTexture(maxAniso);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(3, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.8), wallMat);
    back.position.set(0, 2.4, -2.4);
    back.receiveShadow = true;
    scene.add(back);
    const wallL = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.8), wallMat.clone());
    wallL.position.set(-4.3, 2.4, 1.2);
    wallL.rotation.y = Math.PI / 2;
    wallL.receiveShadow = true;
    scene.add(wallL);
    const wallR = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.8), wallMat.clone());
    wallR.position.set(4.3, 2.4, 1.2);
    wallR.rotation.y = -Math.PI / 2;
    wallR.receiveShadow = true;
    scene.add(wallR);
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshStandardMaterial({ color: 0x1b1209, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 4.8;
    scene.add(ceil);
    // 踢脚线
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.8 });
    const skirtB = new THREE.Mesh(new THREE.BoxGeometry(16, 0.18, 0.06), skirtMat);
    skirtB.position.set(0, 0.09, -2.37);
    scene.add(skirtB);

    // ---------- 书柜（重设计：胡桃木 + 阶梯顶檐 + 线脚立柱 + 柜顶摆件） ----------
    const bookcase = new THREE.Group();
    bookcase.position.set(0, 0, -2.02);
    const woodMat = new THREE.MeshStandardMaterial({ map: cabinetTexture(maxAniso), color: 0xcfa878, roughness: 0.48 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2712, roughness: 0.65 });
    const woodTrim = new THREE.MeshStandardMaterial({ color: 0x8a6438, roughness: 0.42 });
    const panel = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true;
      b.receiveShadow = true;
      bookcase.add(b);
      return b;
    };
    // 底座：两级台阶 + 四个脚
    panel(3.74, 0.08, 0.62, 0, 0.04, 0, woodDark);
    panel(3.62, 0.1, 0.58, 0, 0.13, 0, woodMat);
    [[-1.68, 0.24], [1.68, 0.24], [-1.68, -0.24], [1.68, -0.24]].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.1, 10), woodDark);
      foot.position.set(fx, 0.05, fz);
      foot.castShadow = true;
      bookcase.add(foot);
    });
    // 侧立柱 + 正面线脚凹槽
    panel(0.14, 2.12, 0.58, -1.73, 1.24, 0, woodMat);
    panel(0.14, 2.12, 0.58, 1.73, 1.24, 0, woodMat);
    [-1.73, 1.73].forEach((px) => {
      [-0.025, 0.025].forEach((off) => {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.018, 2.0, 0.015), woodTrim);
        groove.position.set(px + off, 1.24, 0.288);
        bookcase.add(groove);
      });
    });
    // 阶梯顶檐（三层外挑）
    panel(3.6, 0.07, 0.56, 0, 2.32, 0, woodMat);
    panel(3.74, 0.05, 0.62, 0, 2.38, 0.01, woodTrim);
    panel(3.86, 0.05, 0.68, 0, 2.43, 0.02, woodMat);
    // 层板
    const shelfY = [0.86, 1.6];
    for (const y of shelfY) panel(3.32, 0.055, 0.5, 0, y, 0, woodDark);
    // 背板 + 竖拼板缝
    const backboard = new THREE.Mesh(
      new THREE.BoxGeometry(3.36, 2.1, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x2e1d0c, roughness: 0.92 })
    );
    backboard.position.set(0, 1.3, -0.26);
    bookcase.add(backboard);
    for (let pi = 0; pi < 7; pi++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.06, 0.006), woodDark);
      seam.position.set(-1.44 + pi * 0.48, 1.3, -0.242);
      bookcase.add(seam);
    }

    // 书：每门课一本（可点击），宽/高/厚度自然变化，行尾横叠书
    const pagesTex = pagesTexture(maxAniso);
    const pageMat = new THREE.MeshStandardMaterial({ map: pagesTex, color: 0xf5edd8, roughness: 0.85 });
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    const books: THREE.Mesh[] = [];
    const rowCourses: Course[][] = [
      courses.slice(0, Math.ceil(courses.length / 2)),
      courses.slice(Math.ceil(courses.length / 2)),
    ];
    rowCourses.forEach((rc, row) => {
      const baseY = row === 0 ? 0.19 : shelfY[0] + 0.035;
      const widths = rc.map((_, k) => 0.14 + ((k * 13 + row * 7) % 5) * 0.016);
      const gap = 0.03;
      const stackW = 0.36;
      const total = widths.reduce((s2, w) => s2 + w, 0) + gap * (rc.length - 1) + gap + stackW;
      let cursor = -total / 2;
      rc.forEach((c) => {
        const gi = courses.indexOf(c);
        const pct = stats[c.lang]?.pct ?? 0;
        const locked = lockedLangs.includes(c.lang);
        const w = widths[rc.indexOf(c)];
        const h = 0.44 + ((gi * 37) % 7) * 0.026;
        const dep = 0.25 + ((gi * 29) % 3) * 0.02;
        const tex = spineTexture(c, pct, locked);
        const spineMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
        const coverMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(SPINE[c.lang]?.[1] ?? "#4b5563").multiplyScalar(0.6),
          roughness: 0.6,
        });
        const book = new THREE.Mesh(bookGeo, [coverMat, coverMat, pageMat, pageMat, spineMat, coverMat]);
        book.scale.set(w, h, dep);
        const lean = gi % 6 === 2 ? -0.045 : gi % 9 === 4 ? 0.035 : 0;
        book.position.set(cursor + w / 2 + lean * 0.35, baseY + h / 2, 0.015 + ((gi * 17) % 3) * 0.008);
        book.rotation.z = lean;
        book.castShadow = true;
        // 书脊装订凸带（上下两道骨线，立体感）
        for (const ry of [-0.34, 0.34]) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 0.1), coverMat);
          rib.position.set(0, ry, 0.46);
          book.add(rib);
        }
        book.userData = { action: { type: "book" as const, lang: c.lang }, baseScale: w, baseDepth: dep };
        book.userData.hoverTitle = '《' + c.name + '》' + (locked ? '（已达课程数上限）' : '');
        bookcase.add(book);
        books.push(book);
        cursor += w + gap;
      });
      // 行尾横叠书（平放两本）
      const stackCols = [0x8c3b30, 0x2f5d46, 0x33415e, 0x8a6b3c, 0x6b4a6e];
      for (let si = 0; si < 2; si++) {
        const sm = new THREE.MeshStandardMaterial({ color: stackCols[(row * 2 + si) % stackCols.length], roughness: 0.62 });
        const sb = new THREE.Mesh(bookGeo, [pageMat, pageMat, sm, sm, sm, pageMat]);
        sb.scale.set(0.34, 0.052, 0.24);
        sb.position.set(cursor + 0.17, baseY + 0.026 + si * 0.054, 0.02);
        sb.rotation.y = (row + si) % 2 ? 0.03 : -0.02;
        sb.castShadow = true;
        bookcase.add(sb);
      }
    });

    // 柜顶摆件：小盆栽 + 黄铜地球仪
    const decoPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.055, 0.1, 14),
      new THREE.MeshStandardMaterial({ color: 0xb56a4a, roughness: 0.7 })
    );
    decoPot.position.set(-1.35, 2.51, 0);
    decoPot.castShadow = true;
    bookcase.add(decoPot);
    for (let li = 0; li < 5; li++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, 0.17, 8),
        new THREE.MeshStandardMaterial({ color: li % 2 ? 0x3f8f5a : 0x4aa566, roughness: 0.6 })
      );
      const la = (li / 5) * Math.PI * 2;
      leaf.position.set(-1.35 + Math.cos(la) * 0.032, 2.65, Math.sin(la) * 0.032);
      leaf.rotation.z = Math.cos(la) * 0.45;
      leaf.rotation.x = -Math.sin(la) * 0.45;
      bookcase.add(leaf);
    }
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.32 });
    const globeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.035, 12), brass);
    globeStand.position.set(1.2, 2.475, 0);
    bookcase.add(globeStand);
    const globeArm = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 8, 20, Math.PI), brass);
    globeArm.position.set(1.2, 2.56, 0);
    globeArm.rotation.y = Math.PI / 2;
    bookcase.add(globeArm);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0x3f6ea5, roughness: 0.55 })
    );
    globe.position.set(1.2, 2.56, 0);
    globe.rotation.z = 0.3;
    bookcase.add(globe);
    for (let ci = 0; ci < 5; ci++) {
      const cont = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 + (ci % 3) * 0.011, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x6a9a5a, roughness: 0.7 })
      );
      const ca = ci * 1.35;
      const cb = (ci % 3 - 1) * 0.55;
      cont.position.set(
        1.2 + Math.cos(ca) * Math.cos(cb) * 0.069,
        2.56 + Math.sin(cb) * 0.069,
        Math.sin(ca) * Math.cos(cb) * 0.069
      );
      cont.scale.set(1, 0.6, 0.45);
      cont.lookAt(1.2, 2.56, 0);
      bookcase.add(cont);
    }
    scene.add(bookcase);

    // ---------- 窗户（后墙左，窗帘 + 日夜天空，可点） ----------
    // 层叠自后向前：天空(-0.02) → 玻璃(+0.02) → 框架/中棂(+0.05) → 窗帘(+0.16)，层间留隙防闪烁
    const winGroup = new THREE.Group();
    winGroup.position.set(-2.62, 2.32, -2.31);
    const skyTexNight = skyTexture(false);
    const skyTexDay = skyTexture(true);
    const skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.8),
      new THREE.MeshBasicMaterial({ map: skyTexNight })
    );
    skyMesh.position.z = -0.02; // 离墙面 0.08，避免与墙面 z-fighting 闪烁
    winGroup.add(skyMesh);
    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x6d4a26, roughness: 0.5 });
    const winFrame = (w: number, h: number, x: number, y: number) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), winFrameMat);
      f.position.set(x, y, 0.05);
      f.castShadow = true;
      winGroup.add(f);
    };
    winFrame(1.6, 0.1, 0, 0.95); // 上沿
    winFrame(1.6, 0.1, 0, -0.95); // 下沿
    winFrame(0.1, 1.9, -0.755, 0); // 左立
    winFrame(0.1, 1.9, 0.755, 0); // 右立
    // 双扇平开窗（左右各一扇，绕窗框立柱铰链开合）
    const paneMat = new THREE.MeshPhysicalMaterial({
      color: 0xcfe8ff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.03,
      side: THREE.DoubleSide,
    });
    const paneLPivot = new THREE.Group();
    paneLPivot.position.set(-0.68, 0, 0.02);
    const paneL = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.78), paneMat);
    paneL.position.x = 0.33;
    paneLPivot.add(paneL);
    winGroup.add(paneLPivot);
    const paneRPivot = new THREE.Group();
    paneRPivot.position.set(0.68, 0, 0.02);
    const paneR = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.78), paneMat);
    paneR.position.x = -0.33;
    paneRPivot.add(paneR);
    winGroup.add(paneRPivot);
    // 窗扇把手（金色立柱式，左右窗扇各一，位于窗扇内边缘）
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd9b06a, metalness: 0.7, roughness: 0.25 });
    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 10), handleMat);
    handleL.position.set(0.6, -0.08, 0.05);
    paneLPivot.add(handleL);
    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 10), handleMat);
    handleR.position.set(-0.6, -0.08, 0.05);
    paneRPivot.add(handleR);
    // 把手点击区（跟随窗扇旋转；点把手 = 开/关窗扇，点窗玻璃 = 只拉窗帘）
    const handleHitGeo = new THREE.BoxGeometry(0.28, 0.55, 0.55);
    const handleHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const handleLHit = new THREE.Mesh(handleHitGeo, handleHitMat);
    handleLHit.position.set(0.6, -0.08, 0.12);
    handleLHit.userData = { action: { type: "handle" as const }, baseScale: 1 };
    paneLPivot.add(handleLHit);
    const handleRHit = new THREE.Mesh(handleHitGeo, handleHitMat);
    handleRHit.position.set(-0.6, -0.08, 0.12);
    handleRHit.userData = { action: { type: "handle" as const }, baseScale: 1 };
    paneRPivot.add(handleRHit);

    // 窗帘杆（金色端头装饰球）+ 立体褶皱窗帘 + 波浪垂幔
    const rod = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.055, 0.075), winFrameMat);
    rod.position.set(0, 1.02, 0.16);
    winGroup.add(rod);
    const finialMat = new THREE.MeshStandardMaterial({ color: 0xd9b06a, metalness: 0.65, roughness: 0.28 });
    for (const ex of [-0.91, 0.91]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), finialMat);
      finial.position.set(ex, 1.02, 0.16);
      winGroup.add(finial);
    }
    const curtainMatA = new THREE.MeshStandardMaterial({ color: 0x8e2f44, roughness: 0.85, side: THREE.DoubleSide });
    const curtainMatB = new THREE.MeshStandardMaterial({ color: 0x6b2135, roughness: 0.85, side: THREE.DoubleSide });
    // 立体褶皱：5 片竖条前后波浪错位 + 底部裙边
    const buildCurtain = (side: 1 | -1) => {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.15;
        const zw = Math.sin(i * 2.2) * 0.038;
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.155, 1.72, 0.05), i % 2 === 0 ? curtainMatA : curtainMatB);
        s.position.set(x, 0, zw);
        s.castShadow = true;
        g.add(s);
        const hem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.06), curtainMatB);
        hem.position.set(x, -0.88, zw - 0.004);
        g.add(hem);
      }
      g.position.set(side * 0.4, -0.04, 0.16);
      winGroup.add(g);
      return g;
    };
    const curtL = buildCurtain(-1);
    const curtR = buildCurtain(1);
    // 波浪垂幔（扇贝形，盖住窗帘顶部与窗帘杆）
    for (let i = 0; i < 9; i++) {
      const v = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.34 - (i % 2) * 0.1, 0.075),
        i % 2 === 0 ? curtainMatA : curtainMatB
      );
      v.position.set(-0.84 + i * 0.21, 0.86, 0.175 + Math.sin(i * 1.7) * 0.02);
      v.castShadow = true;
      winGroup.add(v);
    }
    // 窗帘拉绳（珠串 + 红色坠饰，点击切换窗帘开/合）
    const beadMat = new THREE.MeshStandardMaterial({ color: 0xe8d5a8, roughness: 0.4 });
    const pullCord = new THREE.Group();
    for (let bi = 0; bi < 9; bi++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), beadMat);
      bead.position.set(0, 0.42 - bi * 0.105, 0);
      pullCord.add(bead);
    }
    const tassel = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
    );
    tassel.rotation.z = Math.PI;
    tassel.position.set(0, -0.58, 0);
    pullCord.add(tassel);
    pullCord.position.set(0.88, 0.1, 0.19);
    winGroup.add(pullCord);
    const cordHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.3, 0.18),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    cordHit.position.set(0.88, 0.1, 0.19);
    cordHit.userData = { action: { type: "curtain" as const }, baseScale: 1 };
    winGroup.add(cordHit);

    scene.add(winGroup);
    let curtainT = 1;
    let windowT = 0;
    let windowTarget = 0;
    let curtainTarget = 1;

    // ---------- 窗户命中区（点击：合上→拉开；已开→拉近观看） ----------
    const winHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.0, 0.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    winHit.position.set(-2.62, 2.3, -2.35);
    winHit.userData = { action: { type: "window" as const }, baseScale: 1 };
    scene.add(winHit);

    // ---------- 窗外动态场景（3D 月亮/星星/流星/太阳/云/鸟） ----------
    const sky3D = new THREE.Group();
    sky3D.position.set(-2.62, 2.32, -2.31);
    scene.add(sky3D);
    // 月相盈缺：直接在月面纹理上重绘明暗区（无遮掩球，约 240 秒一轮）
    const moonBaseTex = moonTexture();
    const moonCv = document.createElement("canvas");
    moonCv.width = 256;
    moonCv.height = 256;
    const moonCtx = moonCv.getContext("2d")!;
    const moonTex = new THREE.CanvasTexture(moonCv);
    moonTex.colorSpace = THREE.SRGBColorSpace;
    let moonPhaseDrawn = -1;
    /** 按相位在月面上叠加暗区：盈凸/上弦/蛾眉/新月/残月/亏凸全周期 */
    let moonFigure = 0; // 0 无 / 1 嫦娥 / 2 玉兔（夜间随机出现）
    let moonFigTimer = 8 + Math.random() * 10;
    const drawMoonPhase = (phase: number) => {
      moonCtx.drawImage(moonBaseTex.image as HTMLCanvasElement, 0, 0);
      if (moonFigure > 0) {
        moonCtx.save();
        moonCtx.translate(150, 150);
        moonCtx.fillStyle = "rgba(96,90,74,0.6)";
        moonCtx.strokeStyle = "rgba(96,90,74,0.6)";
        if (moonFigure === 1) {
          // 嫦娥：头 + 长裙 + 双飘带
          moonCtx.beginPath();
          moonCtx.arc(0, -25, 7.5, 0, Math.PI * 2);
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.moveTo(-5, -17);
          moonCtx.bezierCurveTo(-17, 0, -15, 24, -7, 30);
          moonCtx.lineTo(7, 30);
          moonCtx.bezierCurveTo(15, 24, 17, 0, 5, -17);
          moonCtx.closePath();
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.moveTo(6, -12);
          moonCtx.bezierCurveTo(24, -4, 28, 10, 20, 24);
          moonCtx.lineWidth = 4.5;
          moonCtx.stroke();
          moonCtx.beginPath();
          moonCtx.moveTo(-6, -10);
          moonCtx.bezierCurveTo(-20, 0, -22, 12, -16, 22);
          moonCtx.lineWidth = 3.5;
          moonCtx.stroke();
        } else {
          // 玉兔：身体 + 头 + 双耳 + 尾
          moonCtx.beginPath();
          moonCtx.ellipse(0, 10, 15, 9.5, 0, 0, Math.PI * 2);
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.arc(12, -2, 6.5, 0, Math.PI * 2);
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.ellipse(15, -16, 2.6, 8.5, 0.25, 0, Math.PI * 2);
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.ellipse(9.5, -17, 2.4, 8, 0.12, 0, Math.PI * 2);
          moonCtx.fill();
          moonCtx.beginPath();
          moonCtx.arc(-14, 9, 4, 0, Math.PI * 2);
          moonCtx.fill();
        }
        moonCtx.restore();
      }
      // 逐像素月相：明暗界线（terminator）x = ±c·√(R²−y²)，直接判定每个像素亮/暗
      // phase 0=新月 0.25=上弦 0.5=满月 0.75=下弦；盈相亮右暗左，亏相亮左暗右
      const R = 120;
      const c = Math.cos(phase * Math.PI * 2);
      const img = moonCtx.getImageData(0, 0, 256, 256);
      const d = img.data;
      for (let py = 0; py < 256; py++) {
        const y = py - 128;
        for (let px = 0; px < 256; px++) {
          const x = px - 128;
          const r2 = x * x + y * y;
          const ai = (py * 256 + px) * 4 + 3;
          if (r2 > R * R) { d[ai] = 0; continue; } // 圆盘外裁掉，月亮边缘干净
          const xt = c * Math.sqrt(R * R - y * y);
          const dist = phase <= 0.5 ? x - xt : -xt - x;
          let a = 255;
          if (dist < 0) a = 0; // 暗部全透明，透出夜空
          else if (dist < 1.5) a = Math.round(255 * (dist / 1.5)); // 明暗界线羽化
          const edge = R - Math.sqrt(r2);
          if (edge < 1) a = Math.min(a, Math.max(0, Math.round(255 * edge))); // 外缘羽化
          d[ai] = a;
          // 亮部靠近明暗界线处轻微压暗，月面更有球面立体感
          if (a > 0 && dist < 18) {
            const sh = 0.74 + 0.26 * (dist / 18);
            const bi = (py * 256 + px) * 4;
            d[bi] = Math.round(d[bi] * sh);
            d[bi + 1] = Math.round(d[bi + 1] * sh);
            d[bi + 2] = Math.round(d[bi + 2] * sh);
          }
        }
      }
      moonCtx.putImageData(img, 0, 0);
      moonTex.needsUpdate = true;
    };
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.105, 48),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false })
    );
    moon.position.set(0.26, 0.42, 0);
    sky3D.add(moon);
    const stars: THREE.Mesh[] = [];
    for (let i = 0; i < 50; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.004 + Math.random() * 0.008, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
      );
      s.position.set((Math.random() - 0.5) * 1.24, (Math.random() - 0.5) * 1.5 + 0.05, -0.01);
      s.userData.tw = Math.random() * Math.PI * 2;
      s.userData.twS = 0.22 + Math.random() * 0.5;
      sky3D.add(s);
      stars.push(s);
    }
    const meteorPool: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      sky3D.add(m);
      meteorPool.push(m);
    }
    let meteorTimer = 3 + Math.random() * 5;
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe27a })
    );
    sun.position.set(-0.3, 0.42, -0.035);
    sky3D.add(sun);
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.25, depthWrite: false })
    );
    sunGlow.position.copy(sun.position);
    sky3D.add(sunGlow);
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.1, depthWrite: false })
    );
    sunHalo.position.copy(sun.position);
    sky3D.add(sunHalo);    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, roughness: 0.9, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), cloudMat);
      const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), cloudMat);
      s2.position.set(0.055, -0.008, 0);
      const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), cloudMat);
      s3.position.set(-0.05, -0.01, 0);
      c.add(s1, s2, s3);
      c.position.set(-0.62 + i * 0.36 + Math.random() * 0.06, 0.15 + Math.random() * 0.35, 0.008);
      c.userData.drift = 0.0006 + Math.random() * 0.0006;
      c.userData.baseY = c.position.y;
      sky3D.add(c);
      clouds.push(c);
    }
    const birds: {
      group: THREE.Group;
      kind: number;
      state: "out" | "enter" | "in" | "toPerch" | "perch" | "leave";
      t: number;
      speed: number;
      inT: number;
      wingL: THREE.Mesh;
      wingR: THREE.Mesh;
      yaw: number;
      from: THREE.Vector3;
      perch: THREE.Vector3 | null;
      perchT: number;
      inA0: number;
    }[] = [];
    // 4 种鸟：麻雀 / 蓝鹊 / 金丝雀 / 鸽子（不同配色与体型）
    const birdSpecs = [
      { body: 0x8a6f4d, belly: 0xe8dcc0, beak: 0x5a4632, size: 1.0 },
      { body: 0x4a7ab5, belly: 0xd9e8f5, beak: 0x2e3440, size: 1.05 },
      { body: 0xe8c84a, belly: 0xf5ecc8, beak: 0x8a6a2a, size: 0.95 },
      { body: 0x9aa0a8, belly: 0xf0f2f4, beak: 0x6a6f76, size: 1.3 },
    ];
    const buildBird = (kind: number) => {
      const sp = birdSpecs[kind % birdSpecs.length];
      const birdBodyMat = new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.75 });
      const birdBellyMat = new THREE.MeshStandardMaterial({ color: sp.belly, roughness: 0.8 });
      const birdBeakMat = new THREE.MeshStandardMaterial({ color: sp.beak, roughness: 0.5 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 16), birdBodyMat);
      body.scale.set(1.4, 0.8, 0.75);
      g.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 12), birdBellyMat);
      belly.scale.set(1.25, 0.7, 0.7);
      belly.position.set(0.004, -0.005, 0);
      g.add(belly);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 14), birdBodyMat);
      head.position.set(0.019, 0.008, 0);
      g.add(head);
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.012, 8), birdBodyMat);
      crest.position.set(0.016, 0.019, 0);
      crest.rotation.z = -0.5;
      g.add(crest);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.012, 10), birdBeakMat);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.031, 0.0075, 0);
      g.add(beak);
      const beakLow = new THREE.Mesh(new THREE.ConeGeometry(0.0028, 0.007, 8), birdBeakMat);
      beakLow.rotation.z = -Math.PI / 2;
      beakLow.position.set(0.0285, 0.0045, 0);
      g.add(beakLow);
      const eyeRingMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.4 });
      const birdEyeMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.3 });
      [1, -1].forEach((sz) => {
        const ring = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 10, 8), eyeRingMat);
        ring.position.set(0.024, 0.012, sz * 0.0058);
        g.add(ring);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0021, 8, 6), birdEyeMat);
        pupil.position.set(0.0255, 0.0122, sz * 0.0062);
        g.add(pupil);
      });
      for (let ti = -1; ti <= 1; ti++) {
        const tailF = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0028, 0.007), birdBodyMat);
        tailF.position.set(-0.028, 0.004, ti * 0.006);
        tailF.rotation.y = ti * 0.35;
        tailF.rotation.z = 0.18;
        g.add(tailF);
      }
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0.012, 0);
      wingShape.splineThru([
        new THREE.Vector2(0.013, 0.02),
        new THREE.Vector2(0.006, 0.045),
        new THREE.Vector2(-0.004, 0.058),
        new THREE.Vector2(-0.012, 0.05),
        new THREE.Vector2(-0.017, 0.028),
        new THREE.Vector2(-0.014, 0.008),
        new THREE.Vector2(-0.006, 0),
      ]);
      wingShape.closePath();
      const wingMatB = new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.7, side: THREE.DoubleSide });
      const wingGeoL = new THREE.ExtrudeGeometry(wingShape, { depth: 0.003, bevelEnabled: false, curveSegments: 24 });
      wingGeoL.rotateX(Math.PI / 2);
      const wingL = new THREE.Mesh(wingGeoL, wingMatB);
      wingL.position.set(-0.002, 0.006, 0.006);
      g.add(wingL);
      const wingGeoR = new THREE.ExtrudeGeometry(wingShape, { depth: 0.003, bevelEnabled: false, curveSegments: 24 });
      wingGeoR.rotateX(-Math.PI / 2);
      const wingR = new THREE.Mesh(wingGeoR, wingMatB);
      wingR.position.set(-0.002, 0.006, -0.006);
      g.add(wingR);
      g.scale.setScalar(sp.size);
      return { g, wingL, wingR };
    };
    // 屋内停留点：书柜顶 / 鱼缸顶沿 / 吊灯顶 / 窗框顶 / 挂历顶
    const perchSpots = [
      new THREE.Vector3(0.5, 2.42, -1.92),
      new THREE.Vector3(2.9, 1.66, 0.05),
      new THREE.Vector3(0.55, 3.42, -0.55),
      new THREE.Vector3(-2.62, 3.36, -2.22),
      new THREE.Vector3(3.3, 3.18, -2.26),
    ];
    for (let i = 0; i < 5; i++) {
      const { g, wingL, wingR } = buildBird(i);
      g.position.set(-3.2 + i * 0.3, 2.72, -2.297);
      g.visible = false;
      scene.add(g);
      birds.push({ group: g, kind: i, state: "out", t: Math.random() * 10, speed: 0.12 + Math.random() * 0.08, inT: 0, wingL, wingR, yaw: 0, from: new THREE.Vector3(), perch: null, perchT: 0, inA0: 0 });
    }
    // ---------- 夜间飞行者：猫头鹰 + 蝴蝶（夜间替代白天的鸟） ----------
    const buildOwl = () => {
      const g = new THREE.Group();
      const feather = new THREE.MeshStandardMaterial({ color: 0x6e5638, roughness: 0.85 });
      const faceMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a4, roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.02, 18, 14), feather);
      body.scale.set(1.15, 1.05, 0.9);
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 14), feather);
      head.position.set(0.014, 0.024, 0);
      g.add(head);
      [1, -1].forEach((sz) => {
        const disc = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 12, 10), faceMat);
        disc.scale.set(0.5, 1, 0.85);
        disc.position.set(0.026, 0.026, sz * 0.005);
        g.add(disc);
        const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5efdf, roughness: 0.3 }));
        eyeW.position.set(0.0295, 0.027, sz * 0.005);
        g.add(eyeW);
        const eyeB = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.25 }));
        eyeB.position.set(0.031, 0.027, sz * 0.005);
        g.add(eyeB);
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.012, 8), feather);
        ear.position.set(0.01, 0.039, sz * 0.008);
        ear.rotation.z = -0.15;
        g.add(ear);
      });
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.008, 8), new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 0.5 }));
      beak.rotation.z = -Math.PI / 2 - 0.35;
      beak.position.set(0.0305, 0.021, 0);
      g.add(beak);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.016), feather);
      tail.position.set(-0.032, -0.002, 0);
      tail.rotation.z = -0.15;
      g.add(tail);
      const owlWingShape = new THREE.Shape();
      owlWingShape.moveTo(0.02, 0);
      owlWingShape.splineThru([
        new THREE.Vector2(0.022, 0.034),
        new THREE.Vector2(0.01, 0.076),
        new THREE.Vector2(-0.007, 0.098),
        new THREE.Vector2(-0.02, 0.085),
        new THREE.Vector2(-0.029, 0.048),
        new THREE.Vector2(-0.024, 0.014),
        new THREE.Vector2(-0.01, 0),
      ]);
      owlWingShape.closePath();
      const owlWingMat = new THREE.MeshStandardMaterial({ color: 0x6e5638, roughness: 0.85, side: THREE.DoubleSide });
      const owlGeoL = new THREE.ExtrudeGeometry(owlWingShape, { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
      owlGeoL.rotateX(Math.PI / 2);
      const wingL = new THREE.Mesh(owlGeoL, owlWingMat);
      wingL.position.set(-0.005, 0.012, 0.008);
      g.add(wingL);
      const owlGeoR = new THREE.ExtrudeGeometry(owlWingShape, { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
      owlGeoR.rotateX(-Math.PI / 2);
      const wingR = new THREE.Mesh(owlGeoR, owlWingMat);
      wingR.position.set(-0.005, 0.012, -0.008);
      g.add(wingR);
      g.scale.setScalar(1.45);
      return { g, wingL, wingR };
    };
    const buildButterfly = () => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.02, 4, 8), bodyMat);
      body.rotation.z = Math.PI / 2;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), bodyMat);
      head.position.set(0.014, 0.002, 0);
      g.add(head);
      [1, -1].forEach((sz) => {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.014, 4), bodyMat);
        ant.position.set(0.02, 0.008, sz * 0.002);
        ant.rotation.z = -0.6;
        ant.rotation.x = sz * 0.2;
        g.add(ant);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 6, 5), bodyMat);
        tip.position.set(0.024, 0.014, sz * 0.0035);
        g.add(tip);
      });
      const wingTex = canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = "#e8833a";
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = "#2c1e12";
        ctx.fillRect(0, 0, 128, 10);
        ctx.fillRect(0, 118, 128, 10);
        ctx.fillRect(0, 0, 10, 128);
        ctx.fillRect(118, 0, 10, 128);
        ctx.fillStyle = "#f5e6c8";
        [[30, 40], [60, 70], [85, 35], [45, 95]].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, side: THREE.DoubleSide, roughness: 0.6 });
      const mkWing = (side: number) => {
        const geo = new THREE.CircleGeometry(0.024, 18);
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0, side * 0.022);
        const w = new THREE.Mesh(geo, wingMat);
        w.position.set(0, 0.004, 0);
        g.add(w);
        return w;
      };
      const wingL = mkWing(1);
      const wingR = mkWing(-1);
      g.scale.setScalar(0.8);
      return { g, wingL, wingR };
    };
    const nightFlyers: {
      group: THREE.Group;
      kind: number;
      state: "out" | "enter" | "perch" | "leave";
      t: number;
      speed: number;
      inT: number;
      wingL: THREE.Object3D;
      wingR: THREE.Object3D;
      yaw: number;
      from: THREE.Vector3;
      perch: THREE.Vector3 | null;
      perchT: number;
    }[] = [];
    const owlParts = buildOwl();
    owlParts.g.visible = false;
    scene.add(owlParts.g);
    nightFlyers.push({ group: owlParts.g, kind: 0, state: "out", t: Math.random() * 8, speed: 0.1, inT: 0, wingL: owlParts.wingL, wingR: owlParts.wingR, yaw: 0, from: new THREE.Vector3(), perch: null, perchT: 0 });
    const bfParts = buildButterfly();
    bfParts.g.visible = false;
    scene.add(bfParts.g);
    nightFlyers.push({ group: bfParts.g, kind: 1, state: "out", t: Math.random() * 8 + 3, speed: 0.16, inT: 0, wingL: bfParts.wingL, wingR: bfParts.wingR, yaw: 0, from: new THREE.Vector3(), perch: null, perchT: 0 });

    // ---------- 屋外天气（晴 / 雨 / 雪 自动轮换） ----------
    let weather = "clear" as "clear" | "rain" | "snow";
    let lastPrecip: "rain" | "snow" = "rain";
    let weatherTimer = 10 + Math.random() * 8;
    let weatherFade = 0;
    const rainMat = new THREE.MeshBasicMaterial({ color: 0xbfd8ea, transparent: true, opacity: 0, depthWrite: false });
    const rainDrops: THREE.Mesh[] = [];
    for (let i = 0; i < 48; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.11, 0.004), rainMat);
      d.visible = false;
      d.position.set((Math.random() - 0.5) * 1.24, (Math.random() - 0.5) * 1.6 + 0.05, -0.005);
      d.userData.vy = 0.85 + Math.random() * 0.4;
      sky3D.add(d);
      rainDrops.push(d);
    }
    const snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const snowFlakes: THREE.Mesh[] = [];
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.006 + Math.random() * 0.005, 8, 6), snowMat);
      f.visible = false;
      f.position.set((Math.random() - 0.5) * 1.24, (Math.random() - 0.5) * 1.6 + 0.05, -0.005);
      f.userData.vy = 0.055 + Math.random() * 0.045;
      f.userData.sw = Math.random() * Math.PI * 2;
      sky3D.add(f);
      snowFlakes.push(f);
    }
    // ---------- 墙上浮雕题字（最后显现） ----------
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.72),
      new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true })
    );
    sign.position.set(-0.7, 3.85, -2.38);
    scene.add(sign);

    // ---------- 吊灯 ----------
    const lamp = new THREE.Group();
    lamp.position.set(0.55, 0, -0.55);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x241708 })
    );
    cord.position.y = 4.05;
    lamp.add(cord);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.2, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2e5d43, roughness: 0.4, side: THREE.DoubleSide })
    );
    shade.position.y = 3.28;
    lamp.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc266, emissiveIntensity: 2.2 })
    );
    bulb.position.y = 3.18;
    lamp.add(bulb);
    // 吊灯可点：切换白天 / 黑夜（加大号命中区罩住灯罩与灯泡）
    const lampHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.0, 1.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lampHit.position.set(0.55, 3.05, -0.55);
    lampHit.userData = { action: { type: "lamp" as const }, baseScale: 1 };
    scene.add(lampHit);
    shade.userData = { action: { type: "lamp" as const }, baseScale: 1 };
    bulb.userData = { action: { type: "lamp" as const }, baseScale: 1 };
    scene.add(lamp);

    // ---------- 日夜模式（吊灯点击切换；首次跟随系统） ----------
    const amb = scene.children.find(
      (c) => c instanceof THREE.AmbientLight
    ) as THREE.AmbientLight;
    const sunLight = new THREE.DirectionalLight(0xffe3b0, 0);
    sunLight.position.set(-7, 4.2, 2.2);
    sunLight.target.position.set(0, 1, -1);
    scene.add(sunLight);
    scene.add(sunLight.target);
    const applyNight = (night: boolean) => {
      nightNow = night;
      lampLight.intensity = night ? 26 : 0;
      bulb.material.emissiveIntensity = night ? 2.2 : 0.04;
      amb.intensity = night ? 0.55 : 1.15;
      hemi.intensity = night ? 0.7 : 1.5;
      fillL.intensity = night ? 7 : 3;
      sunLight.intensity = night ? 0 : 2.4;
      skyMesh.material.map = night ? skyTexNight : skyTexDay;
      (skyMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
      curtainTarget = night ? 0 : 1;
      windowTarget = 0; // 日夜切换时窗扇复位关闭
      (scene.background as THREE.Color).set(night ? 0x16100a : 0x3a2b1a);
      renderer.toneMappingExposure = night ? 1.12 : 1.32;
      onSceneTheme(night);
    };
    const savedLamp = localStorage.getItem("ct-lamp");
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let nightNow = savedLamp ? savedLamp === "night" : sysDark;
    applyNight(nightNow);

    // ---------- 挂钟（真实走时 + 秒针；加大、上移、左移） ----------
    const clock = new THREE.Group();
    clock.position.set(2.32, 3.28, -2.32);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0x7a4f26, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2;
    clock.add(rim);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 40),
      new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.6 })
    );
    face.position.z = 0.035;
    clock.add(face);
    const handMat = new THREE.MeshStandardMaterial({ color: 0x3d2c14, roughness: 0.5 });
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.22, 0.014), handMat);
    hourHand.geometry.translate(0, 0.11, 0);
    hourHand.position.set(0, 0, 0.05);
    clock.add(hourHand);
    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.32, 0.014), handMat);
    minHand.geometry.translate(0, 0.16, 0);
    minHand.position.set(0, 0, 0.056);
    clock.add(minHand);
    // 秒针（细长红针）
    const secMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35 });
    const secHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.38, 0.008), secMat);
    secHand.geometry.translate(0, 0.16, 0);
    secHand.position.set(0, 0, 0.062);
    clock.add(secHand);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf4d98b, metalness: 0.6, roughness: 0.3 })
    );
    pin.position.z = 0.066;
    clock.add(pin);
    scene.add(clock);

    // ---------- 后墙左：卷轴 ×3（数字接真实进度，可重绘） ----------
    const scrollSkins: Array<{ tex: THREE.CanvasTexture; silk: string }> = [];
    const scrollSilks = ["#1e4e6e", "#5e2a6e", "#1e5e3a"];
    const scrollLabels = ["XP 经验", "连续天数", "完成课程"];
    const drawScroll = (i: number, num: string | number) => {
      const skin = scrollSkins[i];
      const c = skin.tex.image as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = skin.silk;
      ctx.fillRect(0, 0, 300, 340);
      const g = ctx.createRadialGradient(150, 170, 24, 150, 170, 280);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 300, 340);
      ctx.strokeStyle = "rgba(255,235,190,0.25)";
      ctx.lineWidth = 5;
      ctx.strokeRect(12, 12, 276, 316);
      // 数字自适应字号：再大的数值也不会超出绸面
      ctx.fillStyle = "#ffe9c2";
      ctx.textAlign = "center";
      let fs = 118;
      ctx.font = `800 ${fs}px 'PingFang SC',sans-serif`;
      const label = String(num);
      while (ctx.measureText(label).width > 244 && fs > 36) {
        fs -= 10;
        ctx.font = `800 ${fs}px 'PingFang SC',sans-serif`;
      }
      ctx.fillText(label, 150, 176);
      ctx.font = "500 46px 'Songti SC','STSong',serif";
      ctx.fillStyle = "rgba(255,236,190,0.85)";
      ctx.fillText(scrollLabels[i], 150, 268);
      skin.tex.needsUpdate = true;
    };
    const scrolls: THREE.Group[] = [];
    scrollSilks.forEach((silk, i) => {
      const g = new THREE.Group();
      g.position.set(-3.95, 2.6 - i * 0.62, -2.28);
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2f, roughness: 0.45 });
      const rodT = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 12), rodMat);
      rodT.rotation.z = Math.PI / 2;
      rodT.position.y = 0.22;
      g.add(rodT);
      const rodB = rodT.clone();
      rodB.position.y = -0.22;
      g.add(rodB);
      const silkTex = canvasTexture(300, 340, () => {}, maxAniso);
      scrollSkins.push({ tex: silkTex, silk });
      const silkMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.46),
        new THREE.MeshStandardMaterial({ map: silkTex, roughness: 0.8 })
      );
      g.add(silkMesh);
      // 挂绳 + 墙上挂钉
      const nail = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xf4d98b, metalness: 0.5 })
      );
      nail.position.y = 0.34;
      g.add(nail);
      const cordM = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4),
        new THREE.MeshStandardMaterial({ color: 0xe8cd9b })
      );
      cordM.position.y = 0.28;
      g.add(cordM);
      scene.add(g);
      scrolls.push(g);
      drawScroll(i, 0);
    });
    const calendar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.85),
      new THREE.MeshStandardMaterial({ map: calendarTexture(new Date()), roughness: 0.85 })
    );
    calendar.position.set(3.3, 2.72, -2.3);
    scene.add(calendar);

    // ---------- 后墙挂牌：导航功能入场景（点击弹出悬浮面板） ----------
    // 三块功能牌在经验卷轴左上方；课程牌在书柜顶上；设置/后台（管理员）在礼包下方
    const tagHits: THREE.Object3D[] = [];
    const tagGroups: THREE.Group[] = [];
    const tagData: Array<[string, string, number, number]> = [
      ["learn", "课程", 2.72, 0],
      ["notebook", "知识库", 4.3, -3.84],
      ["advice", "学习建议", 3.9, -3.62],
      ["report", "学习报告", 3.5, -3.84],
      ["settings", "设置", 1.5, 2.44],
      ...(isAdmin ? ([[
        "admin",
        "后台",
        1.04,
        2.44,
      ]] as Array<[string, string, number, number]>) : []),
    ];
    tagData.forEach(([id, label, y, x]) => {
      const g = new THREE.Group();
      g.position.set(x, y, -2.3);
      tagGroups.push(g);
      const boardMats: THREE.Material[] = [
        woodDark,
        woodDark,
        woodDark,
        woodDark,
        new THREE.MeshStandardMaterial({ map: tagTexture(label), roughness: 0.6 }),
        woodDark,
      ];
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.035), boardMats);
      board.castShadow = true;
      g.add(board);
      // 加大号隐形命中区：小物件好点中
      const tagHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.44, 0.3),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      tagHit.position.set(x, y, -2.3);
      tagHit.userData = { action: { type: "panel" as const, id }, baseScale: 1 };
      scene.add(tagHit);
      tagHits.push(tagHit);
      const nail = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xf4d98b, metalness: 0.5 })
      );
      nail.position.y = 0.12;
      g.add(nail);
      const cordM = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0025, 0.0025, 0.08, 4),
        new THREE.MeshStandardMaterial({ color: 0xe8cd9b })
      );
      cordM.position.y = 0.09;
      g.add(cordM);
      board.userData = { action: { type: "panel" as const, id }, baseScale: 1 };
      scene.add(g);
    });

    // ---------- 礼包（挂在日历下方，微微摆动；钉子与吊绳固定不动） ----------
    const gift = new THREE.Group();
    gift.position.set(3.3, 1.86, -2.26);
    const giftNail = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf4d98b, metalness: 0.5 })
    );
    giftNail.position.y = 0.42;
    gift.add(giftNail);
    const giftCord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.24, 5),
      new THREE.MeshStandardMaterial({ color: 0xe8cd9b })
    );
    giftCord.position.y = 0.28;
    gift.add(giftCord);
    const giftHanger = new THREE.Group();
    gift.add(giftHanger);
    const giftBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 })
    );
    giftBox.castShadow = true;
    giftBox.userData = { action: { type: "navigate" as const, href: "/languages" }, baseScale: 1 };
    giftHanger.add(giftBox);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.3 });
    const ribH = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.23), ribbonMat);
    giftHanger.add(ribH);
    const ribV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.27, 0.23), ribbonMat);
    giftHanger.add(ribV);
    const bowL = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 14), ribbonMat);
    bowL.position.set(-0.035, 0.16, 0);
    bowL.rotation.x = 0.5;
    giftHanger.add(bowL);
    const bowR = bowL.clone();
    bowR.position.x = 0.035;
    giftHanger.add(bowR);
    scene.add(gift);

    // ---------- 鱼缸（重设计：高脚胡桃木底柜 + 灯罩顶盖 + 沉木/岩洞/水草造景） ----------
    const tub = new THREE.Group();
    tub.position.set(2.75, 0, 0.05);
    tub.scale.set(1.5, 1.22, 1.22);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x54371c, roughness: 0.5 });
    const standDark = new THREE.MeshStandardMaterial({ color: 0x38220f, roughness: 0.6 });
    // 四个高脚（上细下粗车削感）
    [[-0.76, 0.26], [0.76, 0.26], [-0.76, -0.26], [0.76, -0.26]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.17, 10), standDark);
      leg.position.set(lx, 0.085, lz);
      leg.castShadow = true;
      tub.add(leg);
      const footPad = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), standDark);
      footPad.position.set(lx, 0.02, lz);
      footPad.scale.y = 0.45;
      tub.add(footPad);
    });
    // 柜体裙板 + 柜身
    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.68), standDark);
    apron.position.y = 0.2;
    apron.castShadow = true;
    tub.add(apron);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.36, 0.64), standMat);
    cabinet.position.y = 0.41;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    tub.add(cabinet);
    // 双开门：外框线 + 内嵌面板 + 圆钮
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x66452a, roughness: 0.45 });
    [-0.41, 0.41].forEach((x) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.3, 0.015), doorFrameMat);
      frame.position.set(x, 0.41, 0.325);
      tub.add(frame);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.018), standMat);
      inner.position.set(x, 0.41, 0.328);
      tub.add(inner);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9b06a, metalness: 0.65, roughness: 0.3 })
      );
      knob.position.set(x > 0 ? x - 0.27 : x + 0.27, 0.41, 0.345);
      tub.add(knob);
    });
    // 玻璃缸体
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xaadcef,
      transparent: true,
      opacity: 0.09,
      roughness: 0.04,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.7), glassMat);
    glass.position.y = 0.99;
    glass.renderOrder = -2;
    tub.add(glass);
    // 缸体边框（四角立柱 + 上下沿）
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x232a32, roughness: 0.35, metalness: 0.4 });
    [
      [-0.78, 0.34],
      [0.78, 0.34],
      [-0.78, -0.34],
      [0.78, -0.34],
    ].forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.84, 0.045), trimMat);
      post.position.set(x, 0.99, z);
      tub.add(post);
    });
    const rimB = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.045, 0.76), trimMat);
    rimB.position.y = 0.585;
    tub.add(rimB);
    const rimT = rimB.clone();
    rimT.position.y = 1.4;
    tub.add(rimT);
    // 顶盖灯罩（深色罩壳 + 底面发光灯条）
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.075, 0.78), new THREE.MeshStandardMaterial({ color: 0x1c2129, roughness: 0.5 }));
    hood.position.y = 1.46;
    hood.castShadow = true;
    tub.add(hood);
    const lightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.018, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0xbfe4ff, emissiveIntensity: 1.5 })
    );
    lightStrip.position.y = 1.418;
    tub.add(lightStrip);
    // 水体
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.68, 0.62),
      new THREE.MeshStandardMaterial({
        color: 0x4fb3e8,
        transparent: true,
        opacity: 0.2,
        roughness: 0.15,
        depthWrite: false,
      })
    );
    water.position.y = 0.97;
    water.renderOrder = -1;
    tub.add(water);
    const waterTop = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x8fc8ea,
        transparent: true,
        opacity: 0.12,
        roughness: 0.1,
      })
    );
    waterTop.rotation.x = -Math.PI / 2;
    waterTop.position.y = 1.3;
    tub.add(waterTop);
    // 底床：前沙后砾两层
    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.05, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xd9bd8a, roughness: 1 })
    );
    sand.position.set(0, 0.63, 0.13);
    tub.add(sand);
    const gravel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.07, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 })
    );
    gravel.position.set(0, 0.64, -0.17);
    tub.add(gravel);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xa8835a, roughness: 0.9 });
    const pebbleMat2 = new THREE.MeshStandardMaterial({ color: 0x7d7468, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const peb = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.008, 12, 8), i % 2 ? pebbleMat : pebbleMat2);
      peb.position.set((Math.random() - 0.5) * 1.35, 0.67, (Math.random() - 0.5) * 0.45);
      peb.scale.y = 0.55;
      tub.add(peb);
    }
    // 沉木（左景）
    const woodMatD = new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.85 });
    const drift1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.5, 8), woodMatD);
    drift1.position.set(-0.42, 0.78, -0.08);
    drift1.rotation.z = 0.9;
    drift1.rotation.y = 0.35;
    drift1.castShadow = true;
    tub.add(drift1);
    const drift2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.28, 8), woodMatD);
    drift2.position.set(-0.52, 0.84, -0.02);
    drift2.rotation.z = 0.45;
    drift2.rotation.x = 0.4;
    tub.add(drift2);
    const drift3 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.2, 8), woodMatD);
    drift3.position.set(-0.32, 0.72, 0.02);
    drift3.rotation.z = -0.7;
    drift3.rotation.x = -0.3;
    tub.add(drift3);
    // 岩洞（右景，三石叠成）
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95 });
    [[0.5, 0.7, -0.08, 0.1], [0.62, 0.68, 0.06, 0.075], [0.4, 0.675, 0.08, 0.06]].forEach(([rx, ry, rz, rr]) => {
      const rock = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), rockMat);
      rock.position.set(rx, ry, rz);
      rock.scale.y = 0.72;
      rock.castShadow = true;
      tub.add(rock);
    });
    // 水草：后景高草（摇曳）+ 前景阔叶
    const weeds: THREE.Mesh[] = [];
    const weedMat = new THREE.MeshStandardMaterial({ color: 0x2f9e57, roughness: 0.7 });
    const weedMat2 = new THREE.MeshStandardMaterial({ color: 0x3faf68, roughness: 0.65 });
    for (let gi2 = 0; gi2 < 6; gi2++) {
      const h = 0.3 + (gi2 % 3) * 0.09;
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, h, 6), gi2 % 2 ? weedMat : weedMat2);
      blade.position.set(-0.55 + gi2 * 0.2, 0.665 + h / 2, -0.2 - (gi2 % 2) * 0.05);
      tub.add(blade);
      weeds.push(blade);
    }
    // 阔叶水草（茎 + 两片扁叶，茎入摇摆数组）
    [[-0.62, 0.1], [0.28, 0.14]].forEach(([px, pz]) => {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), weedMat);
      stem.position.set(px, 0.77, pz);
      tub.add(stem);
      weeds.push(stem);
      for (let lf = 0; lf < 2; lf++) {
        const leafM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lf ? weedMat : weedMat2);
        leafM.scale.set(1, 1.6, 0.25);
        leafM.position.set(px + (lf ? 0.05 : -0.045), 0.86 + lf * 0.05, pz);
        leafM.rotation.z = lf ? -0.5 : 0.55;
        tub.add(leafM);
      }
    });
    // 气泡
    const bubbles: THREE.Mesh[] = [];
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xdff2ff,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
    });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 + (i % 3) * 0.004, 8, 6), bubbleMat);
      b.position.set((Math.random() - 0.5) * 1.3, 0.7 + Math.random() * 0.45, (Math.random() - 0.5) * 0.35);
      tub.add(b);
      bubbles.push(b);
      b.userData.rise = 0.1 + Math.random() * 0.12;
    }
    scene.add(tub);

    // ---------- 鱼 ----------
    const fishRigs: FishRig[] = [];
    const fishHost = new THREE.Group();
    fishHost.position.set(2.75, 0.52, 0.05);
    fishHost.scale.setScalar(1.22);
    scene.add(fishHost);
    const setFish = (list: { id: string; species: string }[]) => {
      // 清空旧的
      for (const r of fishRigs) fishHost.remove(r.group);
      fishRigs.length = 0;
      const list2 = list.length ? list : [{ id: "d1", species: "guppy" }, { id: "d2", species: "goldfish" }];
      list2.slice(0, 12).forEach((f, i) => {
        const rig = buildFish(f.species);
        rig.phase = (i / Math.max(1, list2.length)) * Math.PI * 2;
        // 体型随机 0.82~1.18 倍；按体型收窄巡游半径，鱼身不穿玻璃
        const sc = 0.82 + ((i * 7) % 5) * 0.09;
        rig.group.scale.setScalar(sc);
        rig.a = Math.min(0.42 + (i % 3) * 0.07, 0.74 - 0.32 * sc);
        rig.yBase = 0.34 + (i % 3) * 0.09;
        rig.group.position.set(Math.cos(rig.phase) * rig.a, rig.yBase, Math.sin(rig.phase) * rig.b);
        fishHost.add(rig.group);
        fishRigs.push(rig);
      });
    };
    setFish(tankFish);

    // ---------- 房门（左墙，动物串门入口） ----------
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-4.12, 0, 0.8);
    const doorFrameMat2 = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.55 });
    const doorPanelMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.6 });
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.02, 0.09), doorFrameMat2);
    jambL.position.set(0, 1.01, -0.48);
    doorGroup.add(jambL);
    const jambR = jambL.clone();
    jambR.position.z = 0.48;
    doorGroup.add(jambR);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.06), doorFrameMat2);
    lintel.position.set(0, 2.06, 0);
    doorGroup.add(lintel);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 1.0), new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.8 }));
    sill.position.set(0.02, 0.022, 0);
    doorGroup.add(sill);
    const doorPivot = new THREE.Group();
    doorPivot.position.set(0, 0.96, -0.43);
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.9, 0.86), doorPanelMat);
    doorPanel.position.set(0, 0.05, 0.43);
    doorPanel.castShadow = true;
    doorPivot.add(doorPanel);
    [0.55, -0.45].forEach((py) => {
      const inset = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.62), doorFrameMat2);
      inset.position.set(0.026, 0.05 + py, 0.43);
      doorPivot.add(inset);
    });
    const doorKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9b06a, metalness: 0.7, roughness: 0.3 })
    );
    doorKnob.position.set(0.05, 0.02, 0.78);
    doorPivot.add(doorKnob);
    doorGroup.add(doorPivot);
    scene.add(doorGroup);
    let doorT = 0;
    let doorTarget = 0;

    // ---------- 串门小动物（猫/兔/狗轮流来，停留时讲课程知识） ----------
    const VISIT_NAMES = ["橘猫", "白兔", "柴犬", "猴子", "羊驼", "鳄鱼", "斑马", "小猪", "老虎", "狮子", "仓鼠"];
    const VISIT_SKILLS = [
      "番茄工作法：专注25分钟，休息5分钟",
      "费曼技巧：把知识讲给别人听，漏洞立现",
      "间隔重复比临时抱佛脚记得牢得多",
      "先画知识地图，再逐个填细节",
      "睡前快速过一遍，记忆更牢固",
      "把大目标拆成今天能做完的小事",
      "错题本是提分最快的捷径",
      "学习时把手机放到另一个房间",
      "教是最好的学，输出倒逼输入",
      "每天进步一点点，复利效应惊人",
    ];
    const VISIT_QUOTES = [
      "学而时习之，不亦说乎 —— 孔子",
      "千里之行，始于足下 —— 老子",
      "知识就是力量 —— 培根",
      "书山有路勤为径，学海无涯苦作舟",
      "温故而知新，可以为师矣 —— 孔子",
      "少壮不努力，老大徒伤悲",
      "天才是1%的灵感加99%的汗水 —— 爱迪生",
      "读万卷书，行万里路",
      "学而不思则罔，思而不学则殆",
      "求知若饥，虚心若愚 —— 乔布斯",
    ];
    const VISIT_JOKES = [
      "程序员最讨厌两件事：写文档，和别人的代码没文档",
      "数学书为什么总是难过？因为它有太多的问题",
      "老师问为什么迟到，我说在梦里复习功课呢",
      "书本失眠的原因：想太多，页页都是心事",
      "我问代码能不能跑，它反问我会不会写",
      "考试时我的大脑和Wi-Fi一样，信号时有时无",
    ];
    const VISIT_TIPS: Record<string, string[]> = {
      python: ["缩进就是代码块，四个空格最规范", "列表推导式一行写出循环", "None 不等于 0 或空字符串"],
      java: ["程序从 main 方法开始执行", "String 不可变，拼接用 StringBuilder", "JVM 让代码一次编写到处运行"],
      javascript: ["=== 严格相等更安全", "const 的引用内容仍可修改", "事件循环让异步不阻塞页面"],
      typescript: ["类型在编译后会被擦除", "interface 描述对象的形状", "泛型让代码复用又安全"],
      html: ["语义化标签利于无障碍", "图片记得写 alt 文本", "输入框要搭配 label"],
      docker: ["镜像是模板，容器是实例", "Dockerfile 每条指令一层缓存", "compose 一键编排多容器"],
      linux: ["Linux 里一切皆文件", "chmod 755 即 rwxr-xr-x", "grep 加管道排查日志"],
      japanese: ["五十音图是日语字母表", "masu 形是礼貌表达", "助词决定词语的角色"],
      go: ["goroutine 是轻量级线程", "defer 在函数返回前执行", "Go 用返回值处理错误"],
      swift: ["Optional 用问号标记", "let 常量，var 变量", "guard 让异常提前退出"],
      nextjs: ["App Router 默认服务端组件", "文件路径就是路由", "SSG 与 SSR 按页选择"],
      default: ["每天坚持练习进步看得见", "读懂报错是 debug 第一步", "先跑通再优化，小步快跑"],
    };
    const buildVisitor = (kind: number) => {
      const g = new THREE.Group();
      const M = (c: number, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
      const S = (r: number, x: number, y: number, z: number, m: THREE.Material, sx = 1, sy = 1, sz = 1) => {
        const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), m);
        o.position.set(x, y, z);
        o.scale.set(sx, sy, sz);
        g.add(o);
        return o;
      };
      const B = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
        const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        o.position.set(x, y, z);
        g.add(o);
        return o;
      };
      const C = (r1: number, r2: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 12) => {
        const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
        o.position.set(x, y, z);
        g.add(o);
        return o;
      };
      const legs4 = (w: number, l: number, h: number, r: number, m: THREE.Material) => {
        [[w, l], [-w, l], [w, -l], [-w, -l]].forEach(([lx, lz]) => C(r, r * 1.1, h, lx, h / 2, lz, m, 10));
      };
      const eyes2 = (x: number, y: number, z: number, r: number, c = 0x241a10) => {
        [1, -1].forEach((s2) => S(r, s2 * x, y, z, M(c, 0.3)));
      };
      if (kind === 0) {
        const fur = M(0xe8975a), furW = M(0xf5e6d0);
        S(0.088, 0, 0.115, 0, fur, 1, 0.85, 1.4);
        S(0.072, 0, 0.2, 0.125, fur);
        S(0.032, 0, 0.175, 0.185, furW, 1.2, 0.75, 0.8);
        eyes2(0.03, 0.215, 0.175, 0.01);
        [1, -1].forEach((s2) => {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.055, 8), fur);
          ear.position.set(s2 * 0.042, 0.265, 0.12);
          ear.rotation.z = s2 * -0.15;
          g.add(ear);
          const inner = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), M(0xe8a8a0));
          inner.position.set(s2 * 0.042, 0.26, 0.132);
          inner.rotation.z = s2 * -0.15;
          g.add(inner);
        });
        S(0.007, 0, 0.182, 0.2, M(0xc46a6a));
        S(0.05, 0, 0.1, 0.135, furW, 0.8, 1, 0.6);
        const tail = C(0.013, 0.017, 0.17, 0, 0.17, -0.135, fur, 10);
        tail.rotation.x = -0.9;
        legs4(0.042, 0.075, 0.095, 0.015, fur);
      } else if (kind === 1) {
        const fur = M(0xf0ebe2, 0.85), pink = M(0xe8a8b0, 0.7);
        S(0.082, 0, 0.105, 0, fur, 1, 0.88, 1.3);
        S(0.062, 0, 0.2, 0.1, fur);
        [1, -1].forEach((s2) => {
          const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.1, 4, 10), fur);
          ear.position.set(s2 * 0.03, 0.315, 0.09);
          ear.rotation.z = s2 * -0.12;
          g.add(ear);
          const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.065, 4, 8), pink);
          inner.position.set(s2 * 0.03, 0.315, 0.102);
          inner.rotation.z = s2 * -0.12;
          g.add(inner);
        });
        eyes2(0.027, 0.21, 0.155, 0.01, 0xc43c50);
        S(0.006, 0, 0.19, 0.165, pink);
        S(0.03, 0, 0.09, -0.1, fur);
        [[0.037, 0.06], [-0.037, 0.06]].forEach(([lx, lz]) => C(0.014, 0.014, 0.075, lx, 0.037, lz, fur, 10));
        S(0.034, 0.045, 0.032, -0.06, fur, 1, 0.7, 1.35);
        S(0.034, -0.045, 0.032, -0.06, fur, 1, 0.7, 1.35);
      } else if (kind === 2) {
        const fur = M(0xd9a05a), furW = M(0xf5ead6);
        S(0.092, 0, 0.135, 0, fur, 1, 0.88, 1.42);
        S(0.075, 0, 0.225, 0.13, fur);
        B(0.058, 0.048, 0.062, 0, 0.205, 0.195, furW);
        S(0.009, 0, 0.218, 0.228, M(0x2c241c, 0.4));
        eyes2(0.032, 0.24, 0.195, 0.01);
        [1, -1].forEach((s2) => {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 6), fur);
          ear.position.set(s2 * 0.048, 0.295, 0.12);
          ear.rotation.z = s2 * -0.12;
          g.add(ear);
        });
        S(0.056, 0, 0.12, 0.145, furW, 0.85, 1, 0.6);
        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.014, 8, 18, Math.PI * 1.5), fur);
        tail.position.set(0, 0.21, -0.14);
        tail.rotation.x = 0.4;
        g.add(tail);
        legs4(0.048, 0.085, 0.115, 0.016, fur);
      } else if (kind === 3) {
        const fur = M(0x8a6242), face = M(0xd9b98f);
        S(0.082, 0, 0.115, 0, fur, 1, 0.9, 1.25);
        S(0.062, 0, 0.2, 0.11, fur);
        S(0.045, 0, 0.19, 0.155, face, 1.1, 0.9, 0.6);
        eyes2(0.024, 0.215, 0.19, 0.009);
        [1, -1].forEach((s2) => S(0.018, s2 * 0.068, 0.2, 0.1, fur, 0.5, 1, 1));
        S(0.007, 0, 0.19, 0.2, M(0x6a4a30));
        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.011, 8, 20, Math.PI * 1.3), fur);
        tail.position.set(0, 0.16, -0.13);
        tail.rotation.x = 0.5;
        tail.rotation.z = 0.3;
        g.add(tail);
        legs4(0.04, 0.07, 0.1, 0.014, fur);
        [1, -1].forEach((s2) => {
          const arm = C(0.012, 0.012, 0.11, s2 * 0.08, 0.14, 0.06, fur, 8);
          arm.rotation.z = s2 * 0.5;
        });
      } else if (kind === 4) {
        const fur = M(0xf2ead8, 0.95), face = M(0xd9c9a8);
        S(0.095, 0, 0.16, 0, fur, 1, 0.95, 1.35);
        S(0.07, 0, 0.24, 0.02, fur, 1, 0.9, 1);
        C(0.038, 0.045, 0.24, 0, 0.32, 0.1, fur, 12);
        S(0.052, 0, 0.46, 0.11, fur);
        S(0.028, 0, 0.44, 0.16, face, 1, 0.85, 0.9);
        eyes2(0.026, 0.475, 0.15, 0.009);
        [1, -1].forEach((s2) => {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 8), fur);
          ear.position.set(s2 * 0.035, 0.52, 0.1);
          ear.rotation.z = s2 * -0.2;
          g.add(ear);
        });
        S(0.03, 0, 0.15, -0.12, fur);
        legs4(0.05, 0.09, 0.16, 0.014, fur);
      } else if (kind === 5) {
        const skin = M(0x5d8a4a, 0.9), belly = M(0xd9cf9a, 0.85);
        S(0.09, 0, 0.1, -0.02, skin, 1, 0.62, 2.0);
        S(0.075, 0, 0.105, 0.16, skin, 1, 0.55, 0.9);
        B(0.09, 0.035, 0.16, 0, 0.085, 0.27, skin);
        B(0.08, 0.02, 0.15, 0, 0.06, 0.27, belly);
        [1, -1].forEach((s2) => {
          S(0.014, s2 * 0.032, 0.145, 0.18, skin);
          S(0.008, s2 * 0.032, 0.155, 0.185, M(0xd8c84a, 0.3));
        });
        for (let bi2 = 0; bi2 < 5; bi2++) {
          const bump = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), M(0x4a6e3a));
          bump.position.set(0, 0.155, 0.05 - bi2 * 0.07);
          g.add(bump);
        }
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 10), skin);
        tail.rotation.x = -Math.PI / 2;
        tail.position.set(0, 0.09, -0.3);
        g.add(tail);
        legs4(0.08, 0.14, 0.06, 0.016, skin);
      } else if (kind === 6) {
        const white = M(0xeeeae2, 0.85), black = M(0x22201e, 0.8);
        S(0.095, 0, 0.16, 0, white, 1, 0.9, 1.5);
        for (let si2 = 0; si2 < 5; si2++) {
          B(0.2, 0.02, 0.03, 0, 0.19, 0.12 - si2 * 0.06, black);
          B(0.19, 0.02, 0.03, 0, 0.12, 0.1 - si2 * 0.06, black);
        }
        const neck = C(0.035, 0.05, 0.2, 0, 0.3, 0.12, white, 12);
        neck.rotation.x = 0.5;
        S(0.048, 0, 0.42, 0.17, white, 0.9, 1, 1.15);
        B(0.05, 0.05, 0.07, 0, 0.4, 0.24, white);
        S(0.008, 0, 0.41, 0.278, black);
        eyes2(0.028, 0.44, 0.2, 0.009);
        [1, -1].forEach((s2) => {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 6), white);
          ear.position.set(s2 * 0.035, 0.48, 0.14);
          g.add(ear);
        });
        B(0.02, 0.16, 0.03, 0, 0.36, 0.06, black);
        const tail = C(0.008, 0.008, 0.14, 0, 0.14, -0.16, black, 8);
        tail.rotation.x = 0.7;
        legs4(0.055, 0.1, 0.17, 0.015, white);
      } else if (kind === 7) {
        const pink = M(0xf0b8b8, 0.8), pinkD = M(0xe09a9a);
        S(0.1, 0, 0.13, 0, pink, 1, 0.9, 1.3);
        S(0.068, 0, 0.21, 0.12, pink);
        const snout = C(0.028, 0.028, 0.03, 0, 0.2, 0.185, pinkD, 14);
        snout.rotation.x = Math.PI / 2;
        [1, -1].forEach((s2) => {
          S(0.004, s2 * 0.01, 0.2, 0.203, M(0x8a5a5a));
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 6), pinkD);
          ear.position.set(s2 * 0.04, 0.27, 0.1);
          ear.rotation.z = s2 * -0.4;
          g.add(ear);
        });
        eyes2(0.028, 0.23, 0.165, 0.009);
        const tail = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.007, 6, 14, Math.PI * 1.6), pinkD);
        tail.position.set(0, 0.15, -0.13);
        tail.rotation.y = Math.PI / 2;
        g.add(tail);
        legs4(0.05, 0.08, 0.09, 0.016, pink);
      } else if (kind === 8) {
        const orange = M(0xe8823c), black = M(0x2a2018), furW = M(0xf5ead6);
        S(0.092, 0, 0.125, 0, orange, 1, 0.88, 1.45);
        for (let si2 = 0; si2 < 4; si2++) B(0.19, 0.018, 0.028, 0, 0.18, 0.1 - si2 * 0.06, black);
        S(0.075, 0, 0.21, 0.13, orange);
        S(0.034, 0, 0.185, 0.19, furW, 1.15, 0.7, 0.75);
        S(0.008, 0, 0.19, 0.208, M(0xc46a6a));
        eyes2(0.032, 0.225, 0.185, 0.01);
        [1, -1].forEach((s2) => {
          S(0.02, s2 * 0.048, 0.265, 0.11, orange, 1, 1, 0.5);
          S(0.01, s2 * 0.048, 0.265, 0.12, furW, 1, 1, 0.3);
        });
        S(0.052, 0, 0.1, 0.14, furW, 0.85, 1, 0.6);
        const tail = C(0.013, 0.016, 0.17, 0, 0.18, -0.14, orange, 10);
        tail.rotation.x = -0.9;
        legs4(0.048, 0.085, 0.11, 0.016, orange);
      } else if (kind === 9) {
        const tawny = M(0xc9985a), maneM = M(0x8a5a2a, 0.9);
        S(0.095, 0, 0.13, 0, tawny, 1, 0.88, 1.45);
        S(0.095, 0, 0.22, 0.12, maneM, 1.15, 1.15, 0.9);
        S(0.062, 0, 0.225, 0.15, tawny);
        S(0.03, 0, 0.2, 0.2, M(0xe8d0a8), 1.1, 0.7, 0.7);
        S(0.008, 0, 0.205, 0.215, M(0x5a3a2a));
        eyes2(0.03, 0.24, 0.2, 0.01);
        [1, -1].forEach((s2) => S(0.018, s2 * 0.05, 0.27, 0.13, tawny, 1, 1, 0.5));
        const tail = C(0.011, 0.011, 0.16, 0, 0.17, -0.14, tawny, 8);
        tail.rotation.x = -0.9;
        S(0.025, 0, 0.26, -0.17, maneM);
        legs4(0.05, 0.09, 0.12, 0.017, tawny);
      } else {
        const fur = M(0xe8c890, 0.9), furW = M(0xf8f0e0);
        S(0.075, 0, 0.09, 0, fur, 1, 0.95, 1.15);
        S(0.05, 0, 0.15, 0.06, fur);
        [1, -1].forEach((s2) => {
          S(0.022, s2 * 0.032, 0.13, 0.1, furW, 1, 0.9, 0.9);
          S(0.013, s2 * 0.032, 0.2, 0.05, fur, 1, 1, 0.4);
        });
        eyes2(0.022, 0.165, 0.1, 0.009);
        S(0.006, 0, 0.145, 0.112, M(0xc47a7a));
        S(0.035, 0, 0.06, 0.09, furW, 0.9, 0.8, 0.8);
        [[0.03, 0.05], [-0.03, 0.05], [0.03, -0.04], [-0.03, -0.04]].forEach(([lx, lz]) => C(0.011, 0.011, 0.05, lx, 0.025, lz, fur, 8));
        g.scale.setScalar(0.62);
      }
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      return g;
    };
    const vbCv = document.createElement("canvas");
    vbCv.width = 640;
    vbCv.height = 320;
    const vbCtx = vbCv.getContext("2d")!;
    const vbTex = new THREE.CanvasTexture(vbCv);
    vbTex.colorSpace = THREE.SRGBColorSpace;
    const visitorBubble = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: vbTex, transparent: true, depthWrite: false })
    );
    visitorBubble.renderOrder = 5;
    visitorBubble.visible = false;
    scene.add(visitorBubble);
    const drawVisitorBubble = (text: string) => {
      vbCtx.clearRect(0, 0, 640, 320);
      const wrapLines = (fs2: number) => {
        vbCtx.font = "600 " + fs2 + "px 'PingFang SC',sans-serif";
        const lines: string[] = [];
        let cur = "";
        for (const ch of text) {
          if (vbCtx.measureText(cur + ch).width > 556 && cur) {
            lines.push(cur);
            cur = ch;
          } else cur += ch;
        }
        if (cur) lines.push(cur);
        return lines;
      };
      let fs2 = 30;
      let lines = wrapLines(fs2);
      if (lines.length > 4) {
        fs2 = 25;
        lines = wrapLines(fs2);
      }
      if (lines.length > 4) {
        lines = lines.slice(0, 4);
        lines[3] = lines[3].slice(0, Math.max(1, lines[3].length - 1)) + "…";
      }
      const lh = fs2 + 12;
      const boxH = 48 + lines.length * lh;
      const boxY = Math.max(10, (255 - boxH) / 2);
      vbCtx.fillStyle = "rgba(255,250,236,0.96)";
      vbCtx.strokeStyle = "rgba(120,90,50,0.55)";
      vbCtx.lineWidth = 5;
      vbCtx.beginPath();
      const rr = (x: number, y: number, w2: number, h2: number, r: number) => {
        vbCtx.moveTo(x + r, y);
        vbCtx.lineTo(x + w2 - r, y);
        vbCtx.arcTo(x + w2, y, x + w2, y + r, r);
        vbCtx.lineTo(x + w2, y + h2 - r);
        vbCtx.arcTo(x + w2, y + h2, x + w2 - r, y + h2, r);
        vbCtx.lineTo(x + r, y + h2);
        vbCtx.arcTo(x, y + h2, x, y + h2 - r, r);
        vbCtx.lineTo(x, y + r);
        vbCtx.arcTo(x, y, x + r, y, r);
        vbCtx.closePath();
      };
      rr(20, boxY, 600, boxH, 26);
      vbCtx.fill();
      vbCtx.stroke();
      vbCtx.beginPath();
      vbCtx.moveTo(280, boxY + boxH - 2);
      vbCtx.lineTo(330, boxY + boxH - 2);
      vbCtx.lineTo(292, boxY + boxH + 46);
      vbCtx.closePath();
      vbCtx.fill();
      vbCtx.fillStyle = "#43341f";
      vbCtx.textAlign = "center";
      vbCtx.textBaseline = "middle";
      const startY = boxY + 24 + lh / 2;
      lines.forEach((ln, li) => vbCtx.fillText(ln, 320, startY + li * lh));
      vbTex.needsUpdate = true;
    };
    const visitorState = {
      g: null as THREE.Group | null,
      kind: 0,
      state: "none" as "none" | "enter" | "stay" | "leave",
      t: 0,
      tip: "",
    };
    let visitorTimer = 14 + Math.random() * 12;

    // ---------- 树苗（可点） ----------
    const collectPlant = () => {
      const out: THREE.Object3D[] = [];
      plant.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData?.action) out.push(o);
      });
      return out;
    };
    let plantParts: THREE.Object3D[] = [];
    // 树苗的拾取用加大号隐形盒（小物件好点中）
    const plantHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.7),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    plantHit.position.set(-1.7, 0.45, 1.6);
    plantHit.userData = { action: { type: "plant" as const }, baseScale: 1 };
    scene.add(plantHit);
    const plant = new THREE.Group();
    plant.position.set(-1.7, 0, 1.6);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.13, 0.24, 18),
      new THREE.MeshStandardMaterial({ color: 0xa05a32, roughness: 0.7 })
    );
    pot.position.y = 0.12;
    pot.castShadow = true;
    pot.userData = { action: { type: "plant" as const }, baseScale: 1 };
    plant.add(pot);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.02, 18),
      new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 1 })
    );
    soil.position.y = 0.24;
    plant.add(soil);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a4d28, roughness: 0.7 });
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x3fae63, roughness: 0.6 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x2f9e57, roughness: 0.65 });
    const foliage = new THREE.Group();
    foliage.position.y = 0.24;
    plant.add(foliage);
    const buildPlant = (stage: number) => {
      for (const c of [...foliage.children]) foliage.remove(c);
      const s = Math.min(5, Math.max(1, stage));
      const h = 0.14 + s * 0.09;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.012 + s * 0.004, 0.02 + s * 0.006, h, 8), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      trunk.userData = { action: { type: "plant" as const }, baseScale: 1 };
      foliage.add(trunk);
      if (s <= 2) {
        for (let i = 0; i < s + 1; i++) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.035 + s * 0.008, 10, 8), leafMatA);
          leaf.scale.set(1.5, 0.5, 0.8);
          leaf.position.set(Math.cos(i * 2.4) * 0.05, h * 0.75 + i * 0.035, Math.sin(i * 2.4) * 0.03);
          leaf.rotation.z = Math.cos(i * 2.4) * 0.7;
          leaf.userData = { action: { type: "plant" as const }, baseScale: 1 };
          foliage.add(leaf);
        }
      } else {
        const r = 0.1 + s * 0.035;
        const c1 = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), leafMatB);
        c1.position.y = h + r * 0.4;
        c1.userData = { action: { type: "plant" as const }, baseScale: 1 };
        foliage.add(c1);
        const c2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 12, 10), leafMatA);
        c2.position.set(r * 0.62, h - r * 0.18, r * 0.2);
        c2.userData = { action: { type: "plant" as const }, baseScale: 1 };
        foliage.add(c2);
        const c3 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 12, 10), leafMatB);
        c3.position.set(-r * 0.58, h - r * 0.05, -r * 0.25);
        c3.userData = { action: { type: "plant" as const }, baseScale: 1 };
        foliage.add(c3);
        if (s >= 5) {
          const c4 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 12, 10), leafMatA);
          c4.position.set(0, h + r * 0.72, 0);
          c4.userData = { action: { type: "plant" as const }, baseScale: 1 };
          foliage.add(c4);
        }
      }
      plantParts = collectPlant();
    };
    buildPlant(plantSize);
    scene.add(plant);

    // 浇水水滴
    const drops: THREE.Mesh[] = [];
    const dropMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), dropMat);
      d.visible = false;
      d.position.set(-1.66 + (Math.random() - 0.5) * 0.2, 1 + Math.random() * 0.3, 1.6 + (Math.random() - 0.5) * 0.2);
      scene.add(d);
      drops.push(d);
      d.userData.v = 0.5 + Math.random() * 0.4;
    }

    // ---------- 浮尘 ----------
    const dustGeo = new THREE.BufferGeometry();
    const dustN = 50;
    const dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 6;
      dustPos[i * 3 + 1] = 0.8 + Math.random() * 2.4;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.4;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xffdf9e, size: 0.012, transparent: true, opacity: 0.32 })
    );
    scene.add(dust);

    // ---------- 首访魔法入场：物件依次弹现（开门后触发） ----------
    let revealStart: number | null = null;
    const revealables: Array<{ obj: THREE.Object3D; delay: number }> = [
      { obj: bookcase, delay: 150 },
      { obj: lamp, delay: 350 },
      { obj: tub, delay: 520 },
      { obj: winGroup, delay: 640 },
      { obj: plant, delay: 780 },
      { obj: clock, delay: 920 },
      ...scrolls.map((g, i) => ({ obj: g, delay: 1040 + i * 100 })),
      { obj: calendar, delay: 1360 },
      ...tagGroups.map((g, i) => ({ obj: g, delay: 1480 + i * 90 })),
      { obj: gift, delay: 1780 },
      { obj: sign, delay: 2150 },
    ];

    // ---------- 交互：射线拾取 + 拖拽旋转 + 滚轮缩放 ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-2, -2);
    const interactives: THREE.Object3D[] = [...books, giftBox, plantHit, shade, bulb, winHit, handleLHit, handleRHit, cordHit, lampHit, ...tagHits];
    // 书柜命中区（放在书本后面：点到书优先抽书，点到书架空隙/框架 → 拉近书架）
    const shelfHit = new THREE.Mesh(
      new THREE.BoxGeometry(3.7, 2.4, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    shelfHit.position.set(0, 1.2, -2.15);
    shelfHit.userData = { action: { type: "shelf" as const }, baseScale: 1 };
    scene.add(shelfHit);
    const tubHit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
    tubHit.position.set(2.75, 1.0, 0.05);
    tubHit.userData = { action: { type: "tub" as const }, baseScale: 1 };
    scene.add(tubHit);
    interactives.push(shelfHit, tubHit);

    let hovered: THREE.Object3D | null = null;
    const setHover = (o: THREE.Object3D | null) => {
      if (hovered === o) return;
      hovered = o;
      renderer.domElement.style.cursor = o ? "pointer" : "grab";
    };
    const pick = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...interactives, ...plantParts], false);
      return hits.length ? hits[0].object : null;
    };
    // 拖拽旋转 / 滚轮·双指缩放；拖拽结束后不触发点击
    const drag = { active: false, moved: false, lastX: 0, lastY: 0 };
    const activePtrs = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let pinchR = 0;
    let multiTouch = false;
    const ptrDist = () => {
      const p = [...activePtrs.values()];
      return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    };
    const onPointerDown = (e: PointerEvent) => {
      activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePtrs.size === 2) {
        // 双指捏合：不做单指旋转
        pinchDist = ptrDist();
        pinchR = orbit.r;
        multiTouch = true;
        drag.active = false;
        return;
      }
      drag.active = true;
      drag.moved = false;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (activePtrs.has(e.pointerId)) {
        activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      // 双指捏合缩放
      if (activePtrs.size === 2 && pinchDist > 0) {
        const d = ptrDist();
        if (d > 0) orbit.r = THREE.MathUtils.clamp(pinchR * (pinchDist / d), 3.4, 8.4);
        return;
      }
      const rect = wrap.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (drag.active) {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (focusCur === "") {
          orbit.yaw = THREE.MathUtils.clamp(orbit.yaw - dx * 0.0042, -0.85, 0.85);
          orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.0028, -0.04, 0.4);
        }
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
      } else {
        setHover(pick(e.clientX, e.clientY));
        // 视差（减弱动效偏好时静止）
        if (!reduced) {
          parallax.x = px * 0.3;
          parallax.y = py * 0.2;
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      activePtrs.delete(e.pointerId);
      if (activePtrs.size === 0) multiTouch = false;
      if (multiTouch) return; // 捏合手势不算点击
      const wasDrag = drag.moved;
      drag.active = false;
      renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
      // 阻止合成 click 冒泡到场景层（否则 handleSceneClick 会立刻清掉刚设置的拉近状态）
      e.preventDefault();
      if (wasDrag) return; // 拖拽不算点击
      e.stopPropagation();
      /** 统一退出拉近（同步内部状态 + 通知父级清 zoom） */
      const exitFocus = () => {
        focusCur = "";
        onEmptyClick();
      };
      // 抽书阅读中：点画布任意处 = 放回书架
      if (dimmedNow) {
        exitFocus();
        return;
      }
      // 鱼缸/树苗/窗户拉近：点任意处都退出拉近
      if (focusCur === "tub" || focusCur === "plant" || focusCur === "window") {
        exitFocus();
        return;
      }
      // 书架拉近：点书仍可抽书；点空白/框架退出拉近
      const hit = pick(e.clientX, e.clientY);
      if (!hit) {
        exitFocus();
        return;
      }
      const a = hit.userData?.action as
        | { type: "book"; lang: string }
        | { type: "tub" }
        | { type: "plant" }
        | { type: "shelf" }
        | { type: "lamp" }
        | { type: "window" }
        | { type: "handle" }
        | { type: "curtain" }
        | { type: "panel"; id: string }
        | { type: "navigate"; href: string }
        | undefined;
      if (!a) {
        exitFocus();
        return;
      }
      if (a.type === "book") onPickBook(a.lang);
      else if (a.type === "shelf" && focusCur === "shelf") {
        // 已在书架拉近态：再点框架/空隙 → 退出拉近
        exitFocus();
      } else if (a.type === "tub") onOpenTub();
      else if (a.type === "plant") onWaterPlant();
      else if (a.type === "shelf") onFocusShelf();
      else if (a.type === "lamp") {
        // 吊灯 = 白天 / 黑夜开关（记住选择）
        applyNight(!nightNow);
        localStorage.setItem("ct-lamp", nightNow ? "night" : "day");
      } else if (a.type === "window") {
        // 点窗玻璃 = 只拉开窗帘（合上时），不开窗扇；开窗扇请点把手
        if (curtainTarget < 0.5) curtainTarget = 1;
        onFocusWindow();
      } else if (a.type === "handle") {
        // 点把手 = 开/关窗扇；窗帘合上时先拉开窗帘
        if (curtainTarget < 0.5) curtainTarget = 1;
        if (windowTarget < 0.5) {
          windowTarget = 1;
          onFocusWindow();
        } else {
          windowTarget = 0;
        }
      } else if (a.type === "curtain") {
        // 点拉绳 = 开/合窗帘；拉上窗帘时同步关窗
        if (curtainTarget < 0.5) {
          curtainTarget = 1;
        } else {
          curtainTarget = 0;
          windowTarget = 0;
        }
      } else if (a.type === "panel") onTagPanel(a.id);
      else if (a.type === "navigate") onNavigate(a.href);
    };
    const onWheel = (e: WheelEvent) => {
      if (focusCur !== "" && focusCur !== "window") return;
      if (focusCur === "window") return;
      e.preventDefault();
      e.stopPropagation();
      orbit.r = THREE.MathUtils.clamp(orbit.r * (1 + e.deltaY * 0.0011), 3.4, 8.4);
    };
    const onLeave = () => {
      setHover(null);
      parallax.x = 0;
      parallax.y = 0;
      drag.active = false;
      activePtrs.clear();
      multiTouch = false;
      pinchDist = 0;
    };
    const onPointerCancel = (e: PointerEvent) => {
      activePtrs.delete(e.pointerId);
      if (activePtrs.size === 0) {
        multiTouch = false;
        pinchDist = 0;
        drag.active = false;
      }
    };
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // ---------- 动画循环 ----------
    const parallax = { x: 0, y: 0 };
    let wateringNow = watering; // 浇水状态经 api.setWatering 写入，避免渲染期写 ref
    let raf = 0;
    const clockStart = performance.now();
    let speakingIdx: number | null = null;
    const camTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const headWorld = new THREE.Vector3();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = (performance.now() - clockStart) / 1000;

      // 相机：全景轨道（拖拽旋转/滚轮缩放/视差）或焦点推拉
      if (focusCur === "") {
        const yaw = orbit.yaw + parallax.x * 0.22;
        const pitch = THREE.MathUtils.clamp(orbit.pitch + parallax.y * 0.1, -0.04, 0.4);
        const dir = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch)
        );
        camTarget.copy(ORBIT_LOOK).addScaledVector(dir, orbit.r);
        lookTarget.copy(ORBIT_LOOK);
      } else {
        const foci = FOCI[focusCur];
        camTarget.copy(foci.pos);
        lookTarget.copy(foci.look);
      }
      camera.position.lerp(camTarget, 0.1);
      lookAt.lerp(lookTarget, 0.1);
      camera.lookAt(lookAt);

      // 鱼：椭圆巡游 + 摆尾 + 浮沉；说话的鱼游到前排定住
      fishRigs.forEach((rig) => {
        if (rig.speaking) {
          // 游到前排面向观众
          const tgt = new THREE.Vector3(0.28, 0.5, 0.16);
          rig.group.position.lerp(tgt, 0.08);
          rig.group.rotation.y += (-Math.PI / 2 - rig.group.rotation.y) * 0.1;
          rig.group.rotation.x *= 0.92;
          rig.group.rotation.z *= 0.92;
        } else {
          const th = t * rig.speed + rig.phase;
          const nx = Math.cos(th) * rig.a;
          const nz = Math.sin(th) * rig.b;
          const ny = rig.yBase + Math.sin(t * 0.9 + rig.phase * 2) * 0.05;
          if (rig.resume) {
            // 刚结束说话：平滑游回路径点，靠近后恢复正常巡游
            const tgt = new THREE.Vector3(nx, ny, nz);
            rig.group.position.lerp(tgt, 0.06);
            if (rig.group.position.distanceTo(tgt) < 0.02) rig.resume = false;
          } else {
            rig.group.position.set(nx, ny, nz);
          }
          // 用路径导数计算运动方向（原写法在 position.set 之后取差值恒为 0，鱼头朝向冻结导致倒游）
          const dx = -Math.sin(th) * rig.a;
          const dz = Math.cos(th) * rig.b;
          const yaw = Math.atan2(-dz, dx);
          let d = yaw - rig.yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          rig.yaw += d * 0.12;
          // 转弯侧倾 + 升降俯仰 + 摆身，游动更自然
          rig.group.rotation.y = rig.yaw + Math.sin(t * rig.tailFreq * 0.5 + rig.phase) * 0.05;
          rig.group.rotation.z = THREE.MathUtils.clamp(Math.cos(t * 0.9 + rig.phase * 2) * 0.12, -0.2, 0.2);
          rig.group.rotation.x = THREE.MathUtils.clamp(d * 1.6, -0.45, 0.45);
        }
        rig.tail.rotation.y = Math.sin(t * rig.tailFreq + rig.phase) * rig.tailAmp;
        if (rig.pec) rig.pec.rotation.x = Math.sin(t * rig.tailFreq * 0.7 + 1) * 0.5;
      });

      // 鱼群避让：成对排斥，防止互相穿模
      for (let fi = 0; fi < fishRigs.length; fi++) {
        for (let fj = fi + 1; fj < fishRigs.length; fj++) {
          const A = fishRigs[fi];
          const B = fishRigs[fj];
          const dx = A.group.position.x - B.group.position.x;
          const dy = A.group.position.y - B.group.position.y;
          const dz = A.group.position.z - B.group.position.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          const minD = 0.05 + 0.09 * (A.group.scale.x + B.group.scale.x);
          if (d2 > 1e-8 && d2 < minD * minD) {
            const dd = Math.sqrt(d2);
            const push = (minD - dd) * 0.5;
            const ux = dx / dd, uy = dy / dd, uz = dz / dd;
            A.group.position.x += ux * push;
            A.group.position.y += uy * push;
            A.group.position.z += uz * push;
            B.group.position.x -= ux * push;
            B.group.position.y -= uy * push;
            B.group.position.z -= uz * push;
          }
        }
      }
      // 气泡上升
      for (const b of bubbles) {
        b.position.y += b.userData.rise * 0.016;
        if (b.position.y > 1.2) {
          b.position.y = 0.62;
          b.position.x = (Math.random() - 0.5) * 1.3;
        }
      }
      // 水草摇摆
      weeds.forEach((w, i) => {
        w.rotation.z = Math.sin(t * 1.6 + i * 1.3) * 0.16;
      });
      // 窗帘滑动（日夜切换 / 手动拉开）
      curtainT += (curtainTarget - curtainT) * 0.055;
      const ct = curtainT;
      curtL.position.x = -0.4 - 0.28 * ct;
      curtL.scale.x = Math.max(0.45, 1 - 0.5 * ct);
      curtR.position.x = 0.4 + 0.28 * ct;
      curtR.scale.x = Math.max(0.45, 1 - 0.5 * ct);
      // 窗扇开合动画
      windowT += (windowTarget - windowT) * 0.06;
      const wa = windowT * 1.35;
      paneLPivot.rotation.y = -wa;
      paneRPivot.rotation.y = wa;
      // 窗外动态场景
      const skyVis = curtainT > 0.15 ? Math.min(1, (curtainT - 0.15) * 3) : 0;
      sky3D.visible = skyVis > 0.01;
      if (sky3D.visible) {
        if (nightNow) {
          moon.visible = true;
          // 月相盈缺：约 240 秒一轮，相位变化超过 0.4% 才重绘纹理
          const mph = (t / 240) % 1;
          // 嫦娥 / 玉兔随机出现与离去
          moonFigTimer -= 0.016;
          if (moonFigTimer <= 0) {
            if (moonFigure > 0) {
              moonFigure = 0;
              moonFigTimer = 18 + Math.random() * 22;
            } else {
              moonFigure = 1 + Math.floor(Math.random() * 2);
              moonFigTimer = 10 + Math.random() * 8;
            }
            drawMoonPhase(mph);
            moonPhaseDrawn = mph;
          }
          if (Math.abs(mph - moonPhaseDrawn) > 0.004) {
            drawMoonPhase(mph);
            moonPhaseDrawn = mph;
          }
          sun.visible = false; sunGlow.visible = false; sunHalo.visible = false;
          stars.forEach(s => s.visible = true);
          clouds.forEach(c => c.visible = false);
          birds.forEach(b => b.group.visible = false);
          nightFlyers.forEach((b, i) => {
            b.group.visible = true;
            const flying = b.state !== "perch";
            const flapSpd = b.kind === 1 ? 24 : 6.5;
            const flapAmp = b.kind === 1 ? (flying ? 0.95 : 0.5) : (flying ? 0.38 : 0);
            const flap = Math.sin(t * flapSpd + i * 2.0) * flapAmp;
            b.wingL.rotation.x = 0.1 + flap;
            b.wingR.rotation.x = -0.1 - flap;
            let yawT = b.yaw;
            if (b.state === "out") {
              b.t += 0.016 * b.speed;
              const cycle = b.t % 11;
              const baseY = b.kind === 1 ? 2.5 : 2.8;
              if (cycle < 9) {
                b.group.position.x = -3.2 + cycle * 0.24;
                b.group.position.y = baseY + Math.sin(cycle * 1.2 + i) * (b.kind === 1 ? 0.14 : 0.07);
                b.group.position.z = -2.297;
              } else {
                b.group.position.set(-3.2, baseY, -2.297);
              }
              yawT = 0;
              if (windowT > 0.85 && b.group.position.x < -2.0 && Math.random() < 0.003) {
                const pi = Math.floor(Math.random() * perchSpots.length);
                b.perch = perchSpots[pi].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, b.kind === 0 ? 0.045 : 0.005, (Math.random() - 0.5) * 0.08));
                b.from.copy(b.group.position);
                b.state = "enter";
                b.inT = 0;
              }
            } else if (b.state === "enter" || b.state === "leave") {
              b.inT += 0.016;
              const dur = b.state === "enter" ? 2.8 : 2.6;
              const p = Math.min(1, b.inT / dur);
              const ease = p * p * (3 - 2 * p);
              const tgt = b.state === "enter" ? b.perch! : new THREE.Vector3(-2.62, 2.72, -2.297);
              const mx = (b.from.x + tgt.x) / 2;
              const mz = (b.from.z + tgt.z) / 2;
              const my = Math.max(b.from.y, tgt.y) + 0.3;
              const ix = (1 - ease) * (1 - ease) * b.from.x + 2 * (1 - ease) * ease * mx + ease * ease * tgt.x;
              const iy = (1 - ease) * (1 - ease) * b.from.y + 2 * (1 - ease) * ease * my + ease * ease * tgt.y;
              const iz = (1 - ease) * (1 - ease) * b.from.z + 2 * (1 - ease) * ease * mz + ease * ease * tgt.z;
              const dx = ix - b.group.position.x;
              const dz = iz - b.group.position.z;
              if (dx * dx + dz * dz > 1e-8) yawT = Math.atan2(-dz, dx);
              b.group.position.set(ix, iy, iz);
              if (p >= 1) {
                if (b.state === "enter") {
                  b.state = "perch";
                  b.perchT = 9 + Math.random() * 8;
                } else {
                  b.state = "out";
                  b.t = 2;
                  b.group.position.set(-3.2, b.kind === 1 ? 2.5 : 2.8, -2.297);
                }
              }
            } else {
              b.perchT -= 0.016;
              b.group.position.y = b.perch!.y + Math.sin(t * 5 + i * 3) * 0.001;
              yawT = b.yaw + Math.sin(t * 0.5 + i * 2.2) * 0.4;
              if (b.perchT <= 0) {
                b.from.copy(b.group.position);
                b.state = "leave";
                b.inT = 0;
              }
            }
            let dyaw = yawT - b.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            b.yaw += dyaw * 0.12;
            b.group.rotation.y = b.yaw;
          });
          stars.forEach(s => {
            s.userData.tw += 0.04 * s.userData.twS;
            (s.material as THREE.MeshBasicMaterial).opacity = (0.35 + Math.sin(s.userData.tw) * 0.45) * skyVis;
          });
          meteorTimer -= 0.016;
          if (meteorTimer <= 0) {
            const m = meteorPool.find(x => !x.visible);
            if (m) {
              m.visible = true;
              m.position.set(-0.6 + Math.random() * 0.25, 0.45 + Math.random() * 0.2, 0.006);
              m.userData.life = 0;
              m.userData.ang = -0.3 + Math.random() * 0.2;
              m.rotation.z = m.userData.ang;
            }
            meteorTimer = 4 + Math.random() * 8;
          }
          meteorPool.forEach(m => {
            if (!m.visible) return;
            m.userData.life += 0.016;
            m.position.x += Math.cos(m.userData.ang) * 0.15 * 0.016;
            m.position.y -= Math.sin(-m.userData.ang) * 0.15 * 0.016;
            const mat = m.material as THREE.MeshBasicMaterial;
            mat.opacity = m.userData.life < 0.3 ? m.userData.life / 0.3 : Math.max(0, 1 - (m.userData.life - 0.3) / 1.1);
            if (m.userData.life > 1.4 || m.position.x > 0.65) m.visible = false;
          });
        } else {
          moon.visible = false;
          sun.visible = true; sunGlow.visible = true; sunHalo.visible = true;
          stars.forEach(s => s.visible = false);
          meteorPool.forEach(m => m.visible = false);
          clouds.forEach(c => c.visible = true);
          sunGlow.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
          nightFlyers.forEach(b => b.group.visible = false);
          clouds.forEach(c => {
            c.position.x += c.userData.drift;
            if (c.position.x > 0.65) c.position.x = -0.65;
            c.position.y = c.userData.baseY + Math.sin(t * 0.5 + c.position.x * 3) * 0.008;
          });
          birds.forEach((b, i) => {
            b.group.visible = true;
            const flying = b.state !== "perch";
            const flapSpd = 11 + Math.sin(t * 0.9 + i * 1.3) * 4;
            const flap = flying ? Math.sin(t * flapSpd + i * 2.2) * 0.55 : 0;
            b.wingL.rotation.x = 0.15 + flap;
            b.wingR.rotation.x = -0.15 - flap;
            let yawT = b.yaw;
            if (b.state === "out") {
              b.t += 0.016 * b.speed;
              const cycle = b.t % 9;
              if (cycle < 7) {
                b.group.position.x = -3.2 + cycle * 0.24;
                b.group.position.y = 2.72 + Math.sin(cycle * 1.4) * 0.09;
                b.group.position.z = -2.297;
              } else {
                b.group.position.set(-3.2, 2.72, -2.297);
              }
              yawT = 0;
              // 开窗后随机触发进屋（从当前位置起飞，衔接不断层）
              if (windowT > 0.85 && b.group.position.x < -2.0 && Math.random() < 0.004) {
                b.state = "enter";
                b.inT = 0;
                b.from.copy(b.group.position);
                b.inA0 = -Math.PI / 2 + i * 2.1;
              }
            } else if (b.state === "enter") {
              b.inT += 0.016;
              const p = Math.min(1, b.inT / 2.2);
              const ease = p * p * (3 - 2 * p);
              // 终点 = 绕飞轨道起始点（进屋 → 绕飞无缝衔接）
              const a0 = b.inA0;
              const ex = -2.6 + Math.cos(a0) * (0.85 + Math.sin(i * 1.7) * 0.3);
              const ey = 2.2 + Math.sin(a0 * 1.7) * 0.18 + Math.sin(i * 2.6) * 0.3;
              const ez = -0.7 + Math.sin(a0) * (0.55 + Math.sin(i * 0.9) * 0.2);
              const mx = (b.from.x + ex) / 2;
              const mz = (b.from.z + ez) / 2;
              const my = Math.max(b.from.y, ey) + 0.25;
              const ix = (1 - ease) * (1 - ease) * b.from.x + 2 * (1 - ease) * ease * mx + ease * ease * ex;
              const iy = (1 - ease) * (1 - ease) * b.from.y + 2 * (1 - ease) * ease * my + ease * ease * ey;
              const iz = (1 - ease) * (1 - ease) * b.from.z + 2 * (1 - ease) * ease * mz + ease * ease * ez;
              const dx = ix - b.group.position.x;
              const dz = iz - b.group.position.z;
              if (dx * dx + dz * dz > 1e-8) yawT = Math.atan2(-dz, dx);
              b.group.position.set(ix, iy, iz);
              if (p >= 1) { b.state = "in"; b.inT = 0; }
            } else if (b.state === "in") {
              b.inT += 0.016;
              const ang = b.inT * 1.1 + b.inA0;
              const rW = 0.85 + Math.sin(b.inT * 0.5 + i * 1.7) * 0.3;
              const zW = 0.55 + Math.sin(b.inT * 0.61 + i * 0.9) * 0.2;
              b.group.position.x = -2.6 + Math.cos(ang) * rW;
              b.group.position.y = 2.2 + Math.sin(ang * 1.7) * 0.18 + Math.sin(b.inT * 0.45 + i * 2.6) * 0.3;
              b.group.position.z = -0.7 + Math.sin(ang) * zW;
              yawT = -ang - Math.PI / 2;
              // 绕飞几圈后挑个停留点落下
              if (b.inT > 4 + (i % 3) * 2) {
                const pi = Math.floor(Math.random() * perchSpots.length);
                b.perch = perchSpots[pi].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.1));
                b.from.copy(b.group.position);
                b.state = "toPerch";
                b.inT = 0;
              }
            } else if (b.state === "toPerch") {
              b.inT += 0.016;
              const p = Math.min(1, b.inT / 2.4);
              const ease = p * p * (3 - 2 * p);
              const tgt = b.perch!;
              // 二段贝塞尔：起点 → 中点抬高 → 停留点
              const mx = (b.from.x + tgt.x) / 2;
              const mz = (b.from.z + tgt.z) / 2;
              const my = Math.max(b.from.y, tgt.y) + 0.35;
              const ix = (1 - ease) * (1 - ease) * b.from.x + 2 * (1 - ease) * ease * mx + ease * ease * tgt.x;
              const iy = (1 - ease) * (1 - ease) * b.from.y + 2 * (1 - ease) * ease * my + ease * ease * tgt.y;
              const iz = (1 - ease) * (1 - ease) * b.from.z + 2 * (1 - ease) * ease * mz + ease * ease * tgt.z;
              const dx = ix - b.group.position.x;
              const dz = iz - b.group.position.z;
              if (dx * dx + dz * dz > 1e-8) yawT = Math.atan2(-dz, dx);
              b.group.position.set(ix, iy, iz);
              if (p >= 1) {
                b.state = "perch";
                b.perchT = 5 + Math.random() * 9;
              }
            } else if (b.state === "perch") {
              // 停留：收翅、轻颤、缓缓张望
              b.perchT -= 0.016;
              b.group.position.y = b.perch!.y + Math.sin(t * 7 + i * 3) * 0.0012;
              yawT = b.yaw + Math.sin(t * 0.6 + i * 2.4) * 0.5;
              if (b.perchT <= 0) {
                if (Math.random() < 0.45) {
                  const pi = Math.floor(Math.random() * perchSpots.length);
                  b.perch = perchSpots[pi].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.1));
                  b.from.copy(b.group.position);
                  b.state = "toPerch";
                } else {
                  b.from.copy(b.group.position);
                  b.state = "leave";
                }
                b.inT = 0;
              }
            } else {
              // 离开：飞向窗口再出去
              b.inT += 0.016;
              const p = Math.min(1, b.inT / 2.4);
              const ease = p * p * (3 - 2 * p);
              // 终点 = 窗外巡游路径上的点（离开 → 巡游无缝衔接）
              const tx = -3.2 + 2.42 * 0.24;
              const ty = 2.72 + Math.sin(2.42 * 1.4) * 0.09;
              const ix = b.from.x + (tx - b.from.x) * ease;
              const iy = b.from.y + (ty - b.from.y) * ease;
              const iz = b.from.z + (-2.297 - b.from.z) * ease;
              const dx = ix - b.group.position.x;
              const dz = iz - b.group.position.z;
              if (dx * dx + dz * dz > 1e-8) yawT = Math.atan2(-dz, dx);
              b.group.position.set(ix, iy, iz);
              if (p >= 1) {
                b.state = "out";
                b.t = 2.42;
              }
            }
            let dyaw = yawT - b.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            b.yaw += dyaw * 0.14;
            b.group.rotation.y = b.yaw;
          });
        }
        // 天气轮换：晴 → 雨/雪 → 晴（昼夜都运行；降水时天色转阴、白天藏太阳、夜里遮星星）
        weatherTimer -= 0.016;
          if (weatherTimer <= 0) {
            if (weather === "clear") {
              weather = Math.random() < 0.5 ? "rain" : "snow";
              weatherTimer = 16 + Math.random() * 12;
            } else {
              weather = "clear";
              weatherTimer = 18 + Math.random() * 14;
            }
          }
          if (weather !== "clear") lastPrecip = weather;
          const precip = weather !== "clear";
          weatherFade += ((precip ? 1 : 0) - weatherFade) * 0.02;
          rainMat.opacity = 0.55 * weatherFade;
          snowMat.opacity = 0.9 * weatherFade;
          rainDrops.forEach((d) => {
            d.visible = weatherFade > 0.02 && lastPrecip === "rain";
            if (!d.visible) return;
            d.position.y -= d.userData.vy * 0.016;
            if (d.position.y < -0.78) {
              d.position.y = 0.82;
              d.position.x = (Math.random() - 0.5) * 1.24;
            }
          });
          snowFlakes.forEach((f) => {
            f.visible = weatherFade > 0.02 && lastPrecip === "snow";
            if (!f.visible) return;
            f.position.y -= f.userData.vy * 0.016;
            f.userData.sw += 0.016;
            f.position.x += Math.sin(f.userData.sw) * 0.0009;
            if (f.position.y < -0.78) {
              f.position.y = 0.82;
              f.position.x = (Math.random() - 0.5) * 1.24;
            }
          });
          if (!nightNow) {
            const gloomy = weatherFade > 0.5;
            sun.visible = !gloomy;
            sunGlow.visible = !gloomy;
            sunHalo.visible = !gloomy;
          }
          cloudMat.color.setRGB(1 - weatherFade * 0.38, 1 - weatherFade * 0.35, 1 - weatherFade * 0.28);
          if (nightNow) {
            stars.forEach((s) => {
              (s.material as THREE.MeshBasicMaterial).opacity *= 1 - weatherFade * 0.8;
            });
          }
      }
      // 水面微光
      water.scale.y = 1 + Math.sin(t * 1.4) * 0.008;
      // 礼包摆动（只摆盒子，钉子与吊绳固定）
      giftHanger.rotation.z = Math.sin(t * 1.1) * 0.06;
      // 房门开合 + 串门小动物状态机
      doorT += (doorTarget - doorT) * 0.07;
      doorPivot.rotation.y = doorT * 1.35;
      if (visitorState.state === "none") {
        visitorTimer -= 0.016;
        if (visitorTimer <= 0) {
          visitorState.kind = Math.floor(Math.random() * VISIT_NAMES.length);
          visitorState.g = buildVisitor(visitorState.kind);
          visitorState.g.position.set(-4.05, 0, 0.8);
          visitorState.g.visible = false;
          scene.add(visitorState.g);
          visitorState.state = "enter";
          visitorState.t = 0;
          doorTarget = 1;
          const who = VISIT_NAMES[visitorState.kind];
          const rr2 = Math.random();
          if (rr2 < 0.45) {
            const vc = courses[Math.floor(Math.random() * courses.length)];
            const tips = VISIT_TIPS[vc.lang] ?? VISIT_TIPS.default;
            visitorState.tip = vc.emoji + " " + who + "讲" + vc.name + "：" + tips[Math.floor(Math.random() * tips.length)];
          } else if (rr2 < 0.65) {
            visitorState.tip = "🐾 " + who + "的学习技巧：" + VISIT_SKILLS[Math.floor(Math.random() * VISIT_SKILLS.length)];
          } else if (rr2 < 0.85) {
            visitorState.tip = "🐾 " + who + "分享名言：" + VISIT_QUOTES[Math.floor(Math.random() * VISIT_QUOTES.length)];
          } else {
            visitorState.tip = "🐾 " + who + "讲个笑话：" + VISIT_JOKES[Math.floor(Math.random() * VISIT_JOKES.length)];
          }
        }
      } else if (visitorState.state === "enter") {
        visitorState.t += 0.016;
        if (visitorState.t > 0.9 && visitorState.g) visitorState.g.visible = true;
        const p = Math.min(1, Math.max(0, (visitorState.t - 0.6) / 2.8));
        const ease = p * p * (3 - 2 * p);
        if (visitorState.g) {
          visitorState.g.position.set(
            -4.05 + 2.7 * ease,
            Math.abs(Math.sin(visitorState.t * 9)) * 0.02,
            0.8 + 0.25 * ease
          );
          visitorState.g.rotation.y = Math.atan2(2.7, 0.25);
        }
        if (p >= 1) {
          visitorState.state = "stay";
          visitorState.t = 0;
          drawVisitorBubble(visitorState.tip);
          visitorBubble.visible = true;
          doorTarget = 0;
        }
      } else if (visitorState.state === "stay") {
        visitorState.t += 0.016;
        if (visitorState.g) {
          visitorState.g.rotation.y += (0 - visitorState.g.rotation.y) * 0.06;
          visitorBubble.position.set(
            visitorState.g.position.x,
            visitorState.g.position.y + 0.55 + Math.sin(t * 2) * 0.01,
            visitorState.g.position.z + 0.06
          );
        }
        if (visitorState.t > 9) {
          visitorState.state = "leave";
          visitorState.t = 0;
          visitorBubble.visible = false;
          doorTarget = 1;
        }
      } else {
        visitorState.t += 0.016;
        const p = Math.min(1, visitorState.t / 2.8);
        const ease = p * p * (3 - 2 * p);
        if (visitorState.g) {
          visitorState.g.position.set(
            -1.35 - 2.7 * ease,
            Math.abs(Math.sin(visitorState.t * 9)) * 0.02,
            1.05 - 0.25 * ease
          );
          visitorState.g.rotation.y = Math.atan2(-2.7, -0.25);
        }
        if (p >= 1) {
          if (visitorState.g) {
            scene.remove(visitorState.g);
            visitorState.g = null;
          }
          doorTarget = 0;
          visitorState.state = "none";
          visitorTimer = 18 + Math.random() * 20;
        }
      }
      // 浮尘漂移
      const pos = dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustN; i++) {
        let y = pos.getY(i) + 0.0009 * ((i % 5) + 1);
        const x = pos.getX(i) + Math.sin(t * 0.4 + i) * 0.0006;
        if (y > 3.4) y = 0.8;
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
      // 挂钟走时（时 / 分 / 秒）
      const nowD = new Date();
      const hh = (nowD.getHours() % 12) + nowD.getMinutes() / 60;
      hourHand.rotation.z = -hh * ((Math.PI * 2) / 12);
      minHand.rotation.z = -nowD.getMinutes() * ((Math.PI * 2) / 60);
      const secVal = nowD.getSeconds() + nowD.getMilliseconds() / 1000;
      secHand.rotation.z = -secVal * ((Math.PI * 2) / 60);
      // 首访魔法入场：物件依次弹现 + 粒子增强
      if (revealStart !== null) {
        const el = t - revealStart; // 秒
        let allDone = true;
        for (const r of revealables) {
          const p = Math.min(1, Math.max(0, (el * 1000 - r.delay) / 620));
          const c1 = 1.70158;
          const e = p === 0 ? 0 : 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
          r.obj.scale.setScalar(Math.max(0.0001, e));
          if (p < 1) allDone = false;
        }
        const boost = Math.min(1, Math.max(0, 1 - el / 3.2));
        const dm = dust.material as THREE.PointsMaterial;
        dm.opacity = 0.32 + boost * 0.5;
        dm.size = 0.012 + boost * 0.016;
        if (allDone && el > 3.2) {
          revealStart = null;
          for (const r of revealables) r.obj.scale.setScalar(1);
          dm.opacity = 0.32;
          dm.size = 0.012;
        }
      }
      // 浇水水滴
      for (const d of drops) {
        if (!wateringNow) {
          d.visible = false;
          continue;
        }
        d.visible = true;
        d.position.y -= d.userData.v * 0.016;
        if (d.position.y < 0.3) d.position.y = 1.05 + Math.random() * 0.2;
      }
      // 悬停放大（书本）
      for (const b of books) {
        const target = hovered === b ? 1.14 : 1;
        const cur = b.scale.x / (b.userData.baseScale as number);
        const ns = cur + (target - cur) * 0.18;
        b.scale.x = (b.userData.baseScale as number) * ns;
        b.scale.z = (b.userData.baseDepth as number) * ns;
      }
      // 说话鱼的头部 → 屏幕坐标，锚定气泡（钳制在视口内）
      if (bubbleRef.current) {
        if (speakingIdx !== null && fishRigs[speakingIdx]) {
          const rig = fishRigs[speakingIdx];
          headWorld.copy(rig.headOffset);
          rig.group.localToWorld(headWorld);
          headWorld.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          const bw = bubbleRef.current.offsetWidth || 300;
          const px = THREE.MathUtils.clamp(
            (headWorld.x * 0.5 + 0.5) * rect.width,
            bw * 0.2 + 8,
            rect.width - bw * 0.82 - 8
          );
          const py = Math.max(
            60,
            (-headWorld.y * 0.5 + 0.5) * rect.height
          );
          bubbleRef.current.style.left = `${px.toFixed(1)}px`;
          bubbleRef.current.style.top = `${py.toFixed(1)}px`;
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    // ---------- 尺寸自适应 ----------
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // 竖屏（手机）用更广的视野，房间不被裁切
      camera.fov = camera.aspect < 1 ? 56 : 44;
      camera.updateProjectionMatrix();
    });
    ro.observe(wrap);

    // ---------- 供 React 侧更新的 API ----------
    apiRef.current = {
      setPlant: buildPlant,
      setWatering: (v: boolean) => {
        wateringNow = v;
      },
      setFish,
      setDimmed: (v: boolean) => {
        dimmedNow = v;
      },
      setFocus: (f) => {
        focusCur = f;
      },
      setSpeaking: (idx) => {
        fishRigs.forEach((r, i) => {
          const next = i === idx;
          if (r.speaking && !next) {
            // 结束说话 → 同步朝向，游回巡游路径时不跳变
            r.yaw = r.group.rotation.y;
            r.resume = true;
          }
          r.speaking = next;
        });
        speakingIdx = idx;
      },
      setScrolls: (a: number, b: number, c: number) => {
        drawScroll(0, a);
        drawScroll(1, b);
        drawScroll(2, c);
      },
      fishCount: () => fishRigs.length,
      /** 首访开门 → 启动魔法入场序列（与 tick 同一时间基准） */
      startReveal: () => {
        revealStart = (performance.now() - clockStart) / 1000;
        for (const r of revealables) r.obj.scale.setScalar(0.0001);
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.domElement.remove();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 浇水状态经 api 传入动画循环
  useEffect(() => {
    apiRef.current?.setWatering(watering);
  }, [watering]);

  // 状态 → 场景 API
  useEffect(() => {
    apiRef.current?.setPlant(plantSize);
  }, [plantSize]);
  useEffect(() => {
    apiRef.current?.setScrolls(roomStats.xp, roomStats.streak, roomStats.done);
  }, [roomStats]);
  useEffect(() => {
    apiRef.current?.setFish(tankFish);
  }, [tankFish]);
  useEffect(() => {
    apiRef.current?.setFocus(focus);
  }, [focus]);
  useEffect(() => {
    // 选一条鱼「说话」：按 lessonId 稳定散列，气泡出现在它头上
    if (!tipShown || !tip) {
      apiRef.current?.setSpeaking(null);
      return;
    }
    let h = 0;
    for (const ch of tip.lessonId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const n = apiRef.current?.fishCount() ?? 0;
    apiRef.current?.setSpeaking(n > 0 ? h % n : null);
  }, [tipShown, tip]);
  useEffect(() => {
    apiRef.current?.setDimmed(dimmed);
  }, [dimmed]);

  /** 首访开门 → 触发魔法入场 */
  useEffect(() => {
    if (revealAt > 0) apiRef.current?.startReveal();
  }, [revealAt]);

  return (
    <div
      ref={wrapRef}
      className={`room-gl-wrap ${dimmed ? "is-dim" : ""}`}
      aria-hidden={dimmed || undefined}
    >
      {tip && !dimmed && (
        <Link
          ref={bubbleRef}
          href={`/learn/${tip.lang}/${tip.lessonId}`}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/learn/${tip.lang}/${tip.lessonId}`);
          }}
          className={`fish-tip3d ${tipShown ? "is-show" : ""}`}
          title="鱼儿想起的知识点 —— 点击去复习"
        >
          <span className="fish-tip3d-bubble">
            <span className="fish-tip-meta">
              🐟 {tip.courseName} · {tip.lessonTitle}
            </span>
            <span className="fish-tip-text">💡 {tip.text}</span>
            <span className="fish-tip-go">去复习 →</span>
          </span>
        </Link>
      )}
    </div>
  );
}
