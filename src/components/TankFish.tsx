"use client";

import { useId } from "react";

/**
 * 缸里的小鱼：每个品种一个专属轮廓（不再是换色同款）：
 *  - guppy    孔雀鱼：细小身体 + 超大扇形尾
 *  - goldfish 金鱼：圆胖身体 + 双层飘逸长尾
 *  - puffer   河豚：圆球 + 一圈尖刺 + 小短尾
 *  - shark    鲨鱼：修长流线 + 高背鳍 + 月牙尾 + 鳃裂
 *  - whale    鲸鱼：巨大钝头 + 横向尾鳍 + 腹褶
 * 左右游动与转向由外层容器的 CSS 动画负责；摆尾/划水由组件内 CSS 动画负责。
 */

interface Look {
  fin: string;
  belly: string;
  accent: string;
}

const LOOKS: Record<string, Look> = {
  guppy: { fin: "#ff9d5c", belly: "#cfeaff", accent: "#3fc1c9" },
  goldfish: { fin: "#ffb066", belly: "#ffe2b8", accent: "#ffd166" },
  puffer: { fin: "#ffe9a8", belly: "#fff6d8", accent: "#e0a63f" },
  shark: { fin: "#dbe7f0", belly: "#eef4f8", accent: "#8fa6ba" },
  whale: { fin: "#c6ddfa", belly: "#dbeafc", accent: "#7aa8e0" },
};

/** 朝左游的鱼（头在左，尾在右）；整体翻转由外层 scaleX 负责 */
function SpeciesBody({ species, look }: { species: string; look: Look }) {
  switch (species) {
    case "shark":
      return (
        <>
          {/* 月牙尾 */}
          <g className="fish-tail">
            <path d="M46 18 L61 5 C57.5 11 56.6 14.5 56.6 18 C56.6 21.5 57.5 25 61 31 Z" />
            <path d="M46 18 L58 24 C56.4 22 55.8 20 55.8 18 C55.8 16 56.4 14 58 12 Z" opacity="0.75" />
          </g>
          {/* 高背鳍 */}
          <path d="M26 8 C28 1 34 -1 39 3 L34 10 Z" />
          {/* 修长流线身体 + 尖吻 */}
          <path d="M2 18 C6 14 12 11.5 20 10.8 C32 10 42 13 46.5 18 C42 23 32 26 20 25.2 C12 24.5 6 22 2 18 Z" />
          {/* 腹部浅色 */}
          <path d="M6 20 C14 24.6 34 25.4 44 19.5 C40 23.4 28 26 18 25 C12 24.4 8 22.4 6 20 Z" fill={look.belly} opacity="0.85" />
          {/* 胸鳍 */}
          <g className="fish-pect">
            <path d="M25 20 C30 21.5 32 25 30.5 28.5 C26 26 24 22.5 25 20 Z" />
          </g>
          {/* 鳃裂 ×3 */}
          <g stroke="rgba(20,40,60,0.3)" strokeWidth="1.1" fill="none">
            <path d="M19 12.6 C20.6 16 20.6 20 19 23.4" />
            <path d="M22.5 12.2 C24.1 15.8 24.1 20.2 22.5 23.8" />
            <path d="M26 12 C27.6 15.6 27.6 20.4 26 24" />
          </g>
          {/* 眼睛 */}
          <circle cx="9.6" cy="15.4" r="2.1" className="fish-eye" />
          <circle cx="8.9" cy="14.7" r="0.75" className="fish-glint" />
        </>
      );
    case "puffer":
      return (
        <>
          {/* 小短尾 */}
          <g className="fish-tail">
            <path d="M38 18 L48 12 C46 14.8 45.4 16.4 45.4 18 C45.4 19.6 46 21.2 48 24 Z" />
          </g>
          {/* 圆球身体 */}
          <circle cx="24" cy="18" r="14" />
          {/* 一圈尖刺 */}
          <g fill={look.accent}>
            <path d="M24 4 L26 1.5 L28 4.6 Z" />
            <path d="M35 8 L38.5 6.5 L37 10.5 Z" />
            <path d="M13 8 L11 6.5 L12.5 10.5 Z" />
            <path d="M37.5 18 L41.5 18 L37.8 20.4 Z" />
            <path d="M10.5 18 L6.5 18 L10.2 20.4 Z" />
            <path d="M34 28 L37 30.5 L33 31 Z" />
            <path d="M14 28 L11 30.5 L15 31 Z" />
          </g>
          {/* 腹部 */}
          <path d="M12 21 C16 28.5 32 28.5 36 21 C33 27 15 27 12 21 Z" fill={look.belly} opacity="0.9" />
          {/* 小胸鳍 */}
          <g className="fish-pect">
            <path d="M26 20 C29.5 21 31 23.5 30 26 C27 24.5 25.5 22 26 20 Z" />
          </g>
          {/* 大嘴 + 眼睛 */}
          <path d="M10.5 19.5 C12 20.6 13.6 20.6 15 19.5" stroke="rgba(80,50,10,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="16.5" cy="13.5" r="3.1" className="fish-eye" />
          <circle cx="15.5" cy="12.5" r="1.05" className="fish-glint" />
        </>
      );
    case "whale":
      return (
        <>
          {/* 横向大尾鳍（鲸的尾叶是水平的，这里以宽扁形表达） */}
          <g className="fish-tail">
            <path d="M44 18 C50 13 57 10.5 62 11 C59 14 58 16.5 58.5 18.6 C59 20.8 60.4 23 62.6 25.6 C56.6 25.4 50 22 44 18 Z" />
          </g>
          {/* 巨大钝头身体 */}
          <path d="M1 18 C4 10 12 6.2 23 6.2 C34 6.2 42 10.5 45 18 C42 25.5 34 29.8 23 29.8 C12 29.8 4 26 1 18 Z" />
          {/* 腹褶（鲸须沟） */}
          <g stroke={look.accent} strokeWidth="1" opacity="0.5" fill="none">
            <path d="M8 21.5 C18 26 30 26 40 20.5" />
            <path d="M8 23.5 C18 28 30 28 40 22.5" />
            <path d="M8 25.5 C18 30 30 30 40 24.5" />
          </g>
          {/* 小背鳍 */}
          <path d="M28 6.6 C30 3.6 34 3.2 36.5 5.4 L33 8.6 Z" opacity="0.9" />
          {/* 鳍肢 */}
          <g className="fish-pect">
            <path d="M22 21 C27 22.5 29 26 27.5 29.5 C23 27 21 24 22 21 Z" />
          </g>
          {/* 眼睛（小，靠近嘴角） */}
          <circle cx="10.5" cy="16.5" r="1.9" className="fish-eye" />
          <circle cx="9.9" cy="15.9" r="0.7" className="fish-glint" />
          {/* 喷气孔 */}
          <ellipse cx="7.5" cy="10.5" rx="1.6" ry="0.7" fill="rgba(10,30,60,0.35)" />
        </>
      );
    case "goldfish":
      return (
        <>
          {/* 双层飘逸长尾（金鱼招牌） */}
          <g className="fish-tail">
            <path d="M42 18 C52 8 60 6 64 9 C59 12 57 15 57.4 18 C57.8 21 60 24.5 64 27.5 C60 30.5 52 28.5 42 18 Z" />
            <path d="M42 18 C50 13 57 12.5 60 14.5 C56.5 16 55.4 17 55.6 18.2 C55.8 19.5 57.4 21 60.4 22.4 C56.8 23.4 49.5 22.4 42 18 Z" opacity="0.7" />
          </g>
          {/* 圆胖身体 */}
          <path d="M6 18 C8 10.5 16 6.5 25 7.5 C34 8.5 41 13 41.5 18 C41 23 34 27.5 25 28.5 C16 29.5 8 25.5 6 18 Z" />
          {/* 大背鳍（飘） */}
          <path d="M17 8.6 C20 2 30 1 36 6.4 L33 10.4 C29 6.8 22.5 6.6 20 11 Z" />
          {/* 腹鳍长飘 */}
          <g className="fish-pect">
            <path d="M24 19.5 C29 22 31 27 28.5 31.5 C24 28.5 22.5 23.5 24 19.5 Z" />
            <path d="M28 18.5 C33 20 35.5 24 34.5 27.8 C30.5 25.5 28.5 21.5 28 18.5 Z" opacity="0.75" />
          </g>
          {/* 鳞片弧线 */}
          <g stroke="rgba(160,60,10,0.18)" strokeWidth="1" fill="none">
            <path d="M18 12.5 C22 14.5 26 14.5 30 12.5" />
            <path d="M16 17 C21 19.3 27 19.3 32 17" />
            <path d="M17 21.5 C22 23.8 27 23.8 32 21.5" />
          </g>
          <circle cx="12.6" cy="14.6" r="2.5" className="fish-eye" />
          <circle cx="11.8" cy="13.8" r="0.9" className="fish-glint" />
        </>
      );
    // guppy（默认）：细小身体 + 超大扇尾
    default:
      return (
        <>
          {/* 超大扇形尾（孔雀鱼招牌） */}
          <g className="fish-tail">
            <path d="M38 18 C46 6 56 3 61 6 C57.5 10 56 13.6 56.4 18 C56.8 22.4 58.6 26 62 30 C56 33 46 30 38 18 Z" />
            <path d="M38 18 C45 12 52 10.5 56 12 C53 14 52 15.6 52.2 18 C52.4 20.4 54 23 57 25 C52.6 25.6 45 24 38 18 Z" opacity="0.55" fill={look.accent} />
          </g>
          {/* 细长小身体 */}
          <path d="M5 18 C8 12.5 14 10.5 21 11 C29 11.7 35.5 14.5 38.5 18 C35.5 21.5 29 24.3 21 25 C14 25.5 8 23.5 5 18 Z" />
          {/* 小背鳍 */}
          <path d="M18 11.2 C20 7.6 25 6.8 28.5 8.8 L26 12 Z" />
          {/* 彩色侧线（孔雀鱼体色） */}
          <path d="M10 16.5 C16 14.8 26 14.8 34 17" stroke={look.accent} strokeWidth="1.6" fill="none" opacity="0.75" strokeLinecap="round" />
          <g className="fish-pect">
            <path d="M22 19 C26 20.5 27.5 23.5 26 26.5 C22.5 24.5 21 21.5 22 19 Z" />
          </g>
          <circle cx="10.8" cy="15.8" r="2" className="fish-eye" />
          <circle cx="10.1" cy="15.1" r="0.72" className="fish-glint" />
        </>
      );
  }
}

export default function TankFish({
  species,
  size = 1,
}: {
  species: string;
  /** 相对大小（1 ≈ 64px 长） */
  size?: number;
}) {
  const look = LOOKS[species] ?? LOOKS.guppy;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const SCALE: Record<string, number> = { shark: 1.12, whale: 1.3, guppy: 0.9, puffer: 0.95, goldfish: 1 };
  const k = SCALE[species] ?? 1;
  const w = Math.round(66 * size * k);
  const h = Math.round(38 * size * k);
  return (
    <svg
      viewBox="-2 -4 70 42"
      width={w}
      height={h}
      className="fish-svg"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`fish-g-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BODY_TOP[species] ?? "#ffb36b"} />
          <stop offset="1" stopColor={BODY_BOTTOM[species] ?? "#e25822"} />
        </linearGradient>
      </defs>
      <g fill={`url(#fish-g-${uid})`}>
        <SpeciesBody species={species} look={look} />
      </g>
      <style>{`
        .fish-svg .fish-fin, .fish-svg .fish-tail path:first-child { fill: url(#fish-g-${uid}); }
        .fish-svg .fish-tail path { opacity: 0.94; }
        .fish-svg .fish-eye { fill: #1d2733; }
        .fish-svg .fish-glint { fill: #ffffff; }
      `}</style>
    </svg>
  );
}

/** 每个品种的体色（上/下），轮廓由 SpeciesBody 区分 */
const BODY_TOP: Record<string, string> = {
  guppy: "#c8dbe8",
  goldfish: "#ff9a45",
  puffer: "#ffd35e",
  shark: "#9db2c5",
  whale: "#7fb0ee",
};
const BODY_BOTTOM: Record<string, string> = {
  guppy: "#7f9fb5",
  goldfish: "#e2451d",
  puffer: "#e8a52c",
  shark: "#54708c",
  whale: "#3a6fb8",
};
