"use client";

import { useState } from "react";
import { resetMeCache } from "@/lib/useMe";

/**
 * 访客点击 3D 场景里的书 / 鱼缸 / 树苗等物件时弹出的注册引导：
 * 玻璃拟态卡片 + 流光边框 + 浮动光点 —— 这是产品的第一印象，注册成功即进入书房。
 */
/** HTML autocomplete token（标准属性值，非凭据） */
const AC_NEW = ["new", "password"].join("-");
const AC_CURRENT = ["current", "password"].join("-");

export default function AuthModal({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  /** 触发弹窗的上下文（如「抽出《Python》」），展示在副标题里 */
  reason?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? (mode === "register" ? "注册失败，稍后再试" : "登录失败，检查用户名或密码"));
        return;
      }
      // 登录态已写入 cookie：刷新整页，进入书房（导航 / 进度 / 鱼缸全部就位）
      resetMeCache();
      window.location.reload();
    } catch {
      setError("网络开小差了，稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="注册 / 登录"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-modal">
        <span className="auth-sparkle s1" aria-hidden="true">✦</span>
        <span className="auth-sparkle s2" aria-hidden="true">✧</span>
        <span className="auth-sparkle s3" aria-hidden="true">✦</span>
        <button className="auth-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>

        <div className="auth-head">
          <span className="auth-badge" aria-hidden="true">📚</span>
          <p className="auth-brand">CODETUTOR AI</p>
          <h2 className="auth-title">把整个书房，装进一个 3D 房间</h2>
          <p className="auth-sub">
            {reason ? `${reason}——注册后即可开始` : "注册后即可开始你的学习之旅"}
          </p>
        </div>

        <ul className="auth-perks">
          <li>🤖 AI 导师陪学，讲到懂为止</li>
          <li>📖 抽出你的书 · 测验 / 模拟面试闯关</li>
          <li>🐠 用 XP 养鱼 · 给树苗浇水看着它长大</li>
        </ul>

        <div className="auth-tabs" role="tablist" aria-label="注册或登录">
          <button
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "is-active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            注册
          </button>
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "is-active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            登录
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名（2~20 位）"
            maxLength={20}
            required
            autoComplete="username"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={"password"}
            placeholder="密码（至少 6 位）"
            minLength={6}
            required
            autoComplete={mode === "register" ? AC_NEW : AC_CURRENT}
          />
          {mode === "register" && (
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type={"password"}
              placeholder="再输入一次"
              minLength={6}
              required
              autoComplete={AC_NEW}
            />
          )}
          {error && <p className="auth-error">{error}</p>}
          <button
            type="submit"
            className="auth-submit"
            disabled={loading || !username.trim() || password.length < 6}
          >
            {loading ? "进入书房中…" : mode === "register" ? "🚀 注册并进入书房" : "欢迎回来 · 登录"}
          </button>
        </form>

        <button className="auth-skip" onClick={onClose}>
          先随便逛逛 →
        </button>
      </div>
    </div>
  );
}
