"use client";

/**
 * 房间里的树苗：分层 SVG（陶盆 / 树干 / 叶冠 / 高光），随 stage 1~5 生长：
 * 1 嫩芽 → 2 幼苗 → 3 灌木苗 → 4 小树 → 5 大树。替代 emoji 盆栽。
 */

const STAGE = {
  1: { h: 20, w: 3, r: 0, leaves: 2 },
  2: { h: 32, w: 4, r: 0, leaves: 4 },
  3: { h: 46, w: 6, r: 15, leaves: 3 },
  4: { h: 60, w: 9, r: 21, leaves: 0 },
  5: { h: 74, w: 12, r: 29, leaves: 0 },
} as const;

/** 叶子：椭圆 + 叶柄方向（绕茎旋转） */
function Leaf({ x, y, rot, s = 1 }: { x: number; y: number; rot: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx={9 * s} ry={3.6 * s} className="plant-leaf" />
      <ellipse rx={9 * s} ry={3.6 * s} className="plant-leaf-vein" />
    </g>
  );
}

export default function PlantSvg({ stage }: { stage: number }) {
  const s = Math.min(5, Math.max(1, Math.round(stage))) as 1 | 2 | 3 | 4 | 5;
  const cfg = STAGE[s];
  const baseY = 106; // 盆口高度
  const topY = baseY - cfg.h;

  return (
    <svg viewBox="0 0 100 132" className="plant-svg" aria-hidden="true">
      <defs>
        <linearGradient id="plant-trunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a663c" />
          <stop offset="0.5" stopColor="#7a4d28" />
          <stop offset="1" stopColor="#5c3a20" />
        </linearGradient>
        <radialGradient id="plant-leaf-g" cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#8fe69b" />
          <stop offset="0.6" stopColor="#3fae63" />
          <stop offset="1" stopColor="#1d7a44" />
        </radialGradient>
        <linearGradient id="plant-pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c97a4a" />
          <stop offset="0.55" stopColor="#a05a32" />
          <stop offset="1" stopColor="#7c4222" />
        </linearGradient>
      </defs>

      {/* 陶盆（梯形 + 盆沿） */}
      <path d="M27 110 L73 110 L66 130 L34 130 Z" fill="url(#plant-pot)" />
      <rect x="24.5" y="105" width="51" height="8" rx="3.5" fill="#b96a3e" />
      <rect x="24.5" y="105" width="51" height="3" rx="1.5" fill="#d98d58" />
      {/* 盆口土面 */}
      <ellipse cx="50" cy="108.5" rx="21" ry="4" fill="#4a2f18" />

      {s <= 2 ? (
        <>
          {/* 嫩茎（微弯） */}
          <path
            d={`M50 ${baseY} C ${48 - s} ${baseY - cfg.h * 0.45} ${49 - s} ${baseY - cfg.h * 0.75} ${50 - s * 1.5} ${topY}`}
            fill="none"
            stroke="url(#plant-trunk)"
            strokeWidth={cfg.w}
            strokeLinecap="round"
          />
          <Leaf x={50 - s * 1.5} y={topY + 2} rot={-155} s={0.9 + s * 0.12} />
          <Leaf x={50 - s * 1.5} y={topY + 6} rot={-25} s={0.85 + s * 0.12} />
          {s === 2 && <Leaf x={49} y={topY + 16} rot={-150} s={0.8} />}
          {s === 2 && <Leaf x={49} y={topY + 20} rot={-30} s={0.75} />}
          {/* 顶端嫩芽 */}
          <circle cx={50 - s * 1.8} cy={topY - 2} r={3.4} className="plant-leaf" />
        </>
      ) : (
        <>
          {/* 树干：底部粗、顶部细 */}
          <path
            d={`M${50 - cfg.w * 0.8} ${baseY} C ${50 - cfg.w * 0.4} ${baseY - cfg.h * 0.4} ${50 - cfg.w * 0.2} ${baseY - cfg.h * 0.7} ${50 - cfg.w * 0.15} ${topY + cfg.r * 0.5}
                L ${50 + cfg.w * 0.15} ${topY + cfg.r * 0.5}
                C ${50 + cfg.w * 0.2} ${baseY - cfg.h * 0.7} ${50 + cfg.w * 0.4} ${baseY - cfg.h * 0.4} ${50 + cfg.w * 0.8} ${baseY} Z`}
            fill="url(#plant-trunk)"
          />
          {/* 分枝 */}
          <path
            d={`M50 ${topY + cfg.r + 6} L ${50 - cfg.r * 0.8} ${topY + cfg.r * 0.35}`}
            stroke="url(#plant-trunk)"
            strokeWidth={cfg.w * 0.45}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M50 ${topY + cfg.r + 9} L ${50 + cfg.r * 0.85} ${topY + cfg.r * 0.5}`}
            stroke="url(#plant-trunk)"
            strokeWidth={cfg.w * 0.45}
            strokeLinecap="round"
            fill="none"
          />
          {/* 叶冠：三层错位椭圆，深浅叠出体积 */}
          <ellipse cx={50 - cfg.r * 0.45} cy={topY + cfg.r * 0.55} rx={cfg.r * 0.72} ry={cfg.r * 0.5} className="plant-canopy-dark" />
          <ellipse cx={50 + cfg.r * 0.5} cy={topY + cfg.r * 0.62} rx={cfg.r * 0.68} ry={cfg.r * 0.48} className="plant-canopy-dark" />
          <ellipse cx={50} cy={topY} rx={cfg.r} ry={cfg.r * 0.78} className="plant-canopy" />
          <ellipse cx={50 - cfg.r * 0.3} cy={topY - cfg.r * 0.22} rx={cfg.r * 0.5} ry={cfg.r * 0.34} className="plant-canopy-light" />
          {s <= 3 && <Leaf x={50 - cfg.r * 0.9} y={topY + cfg.r * 1.15} rot={-160} s={0.8} />}
          {s <= 3 && <Leaf x={50 + cfg.r * 0.9} y={topY + cfg.r * 1.2} rot={-20} s={0.8} />}
        </>
      )}
    </svg>
  );
}
