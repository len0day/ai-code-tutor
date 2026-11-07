"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 鱼缸放大查看：大水箱里养鱼游动 + 用 XP 购买新鱼 / 鱼食 + 喂食。
 * 数据全部走 /api/aquarium（XP 扣减在服务端校验）。
 */

interface Fish {
  id: string;
  species: string;
  size: number;
  fedCount: number;
}

interface Species {
  species: string;
  name: string;
  emoji: string;
  price: number;
}

interface AquariumData {
  fish: Fish[];
  food: number;
  xp: number;
  species: Species[];
  foodPrice: number;
  maxFish: number;
  fedsToGrow: number;
}

/** 鱼的游动参数由 id 稳定生成（不同鱼速度/高度/朝向都不同） */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export default function AquariumModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<AquariumData | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [feeding, setFeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/aquarium");
      if (!r.ok) throw new Error("加载失败");
      setData((await r.json()) as AquariumData);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const act = useCallback(
    async (body: Record<string, unknown>, okMsg?: string) => {
      setBusy(true);
      try {
        const r = await fetch("/api/aquarium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (!r.ok) {
          setError(d.error ?? "操作失败");
        } else {
          // 合并保留 species 等元数据（POST 响应只含状态）
          setData((prev) => ({ ...prev, ...d }));
          setError("");
          if (okMsg) {
            setToast(okMsg);
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setToast(""), 2200);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const feed = useCallback(async () => {
    setFeeding(true);
    await act({ action: "feed" }, "🐠 鱼儿们吃饱啦");
    window.setTimeout(() => setFeeding(false), 1400);
  }, [act]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fish = data?.fish ?? [];
  const xp = data?.xp ?? 0;
  const food = data?.food ?? 0;

  return (
    <div
      className="aquarium-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="我的鱼缸"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="aquarium-panel" onClick={(e) => e.stopPropagation()}>
        <header className="aq-head">
          <h2>🐠 我的鱼缸</h2>
          <div className="aq-wallet">
            <span className="aq-chip xp">⚡ {xp} XP</span>
            <span className="aq-chip food">🍚 鱼食 × {food}</span>
            <button onClick={feed} disabled={busy || food <= 0} className="aq-feed">
              喂食
            </button>
            <button
              onClick={onClose}
              className="aq-close"
              aria-label="关闭鱼缸"
            >
              ✕
            </button>
          </div>
        </header>

        {/* 大鱼缸 */}
        <div className={`aq-tank ${feeding ? "is-feeding" : ""}`}>
          <span className="aq-water-line" aria-hidden="true" />
          {feeding && (
            <>
              <i className="aq-flake fl-a" aria-hidden="true">🍚</i>
              <i className="aq-flake fl-b" aria-hidden="true">🍚</i>
              <i className="aq-flake fl-c" aria-hidden="true">🍚</i>
            </>
          )}
          {fish.length === 0 && (
            <p className="aq-empty">
              鱼缸空空的 —— 用下面的 XP 买一条鱼吧
            </p>
          )}
          {fish.map((f) => {
            const h = hash(f.id);
            const dur = 9 + (h % 8);
            const top = 12 + (h % 55);
            const dist = 520 + (h % 130);
            const sp = data?.species?.find((s) => s.species === f.species);
            return (
              <span
                key={f.id}
                className="aq-fish"
                title={`${sp?.name ?? f.species} · ${f.size} 号 · 已喂 ${f.fedCount} 次`}
                style={
                  {
                    "--dur": `${dur}s`,
                    "--dist": `${dist}px`,
                    top: `${top}%`,
                    fontSize: `${20 + f.size * 6}px`,
                    animationDelay: `${-(h % 9)}s`,
                  } as React.CSSProperties
                }
              >
                <span className="aq-fish-body">{sp?.emoji ?? "🐟"}</span>
              </span>
            );
          })}
          {Array.from({ length: 6 }, (_, i) => (
            <i
              key={i}
              className="aq-bubble"
              style={
                {
                  left: `${8 + i * 15}%`,
                  animationDelay: `${i * 0.9}s`,
                } as React.CSSProperties
              }
              aria-hidden="true"
            />
          ))}
        </div>

        {error && <p className="aq-error">{error}</p>}
        {toast && <p className="aq-toast">{toast}</p>}

        {/* 商店 */}
        <section className="aq-shop" aria-label="鱼商店">
          <h3>🛒 鱼商店（用 XP 购买）</h3>
          <div className="aq-shop-row">
            {(data?.species ?? []).map((s) => (
              <button
                key={s.species}
                onClick={() => act({ action: "buy-fish", species: s.species }, `${s.name} 入缸啦！`)}
                disabled={busy || xp < s.price || fish.length >= (data?.maxFish ?? 12)}
                className="aq-card"
                title={xp < s.price ? "XP 不够" : ""}
              >
                <span className="aq-card-emoji">{s.emoji}</span>
                <span className="aq-card-name">{s.name}</span>
                <span className="aq-card-price">⚡ {s.price}</span>
              </button>
            ))}
            <button
              onClick={() => act({ action: "buy-food", qty: 1 }, "买到一份鱼食")}
              disabled={busy || xp < (data?.foodPrice ?? 10)}
              className="aq-card"
              title="喂食消耗鱼食，每喂 3 次鱼长大一号"
            >
              <span className="aq-card-emoji">🍚</span>
              <span className="aq-card-name">鱼食</span>
              <span className="aq-card-price">⚡ {data?.foodPrice ?? 10}</span>
            </button>
          </div>
          <p className="aq-hint">
            🐟 最多养 {data?.maxFish ?? 12} 条 · 每喂 {data?.fedsToGrow ?? 3} 次
            长大一号 · XP 通过学习和通关获得
          </p>
        </section>
      </div>
    </div>
  );
}
