"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireAdmin } from "@/lib/useMe";
import TokenStatsCard from "@/components/TokenStatsCard";
import CacheViewer from "@/components/CacheViewer";

interface AdminUser {
  id: string;
  username: string;
  role: "admin" | "user";
  disabled: boolean;
  createdAt: string;
  xp: number;
  completed: number;
  wrongCount: number;
}

interface AdminData {
  users: AdminUser[];
  stats: {
    userCount: number;
    adminCount: number;
    disabledCount: number;
    doneLessons: number;
    totalXp: number;
    totalWrong: number;
    cacheCount: number;
  };
}

export default function AdminPage() {
  const me = useRequireAdmin();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("加载失败"));
  };

  useEffect(() => {
    if (me?.role === "admin") load();
  }, [me]);

  const op = async (body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "操作失败");
      else load();
    } catch {
      setError("操作失败");
    } finally {
      setBusy(false);
    }
  };

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">鉴权检查中…</p>;
  }
  if (me === null || me.role !== "admin") {
    return null; // useRequireAdmin 已跳转
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🛡 管理员后台</h1>
          <p className="text-slate-500 mt-1 text-sm">
            当前身份：{me.username}（管理员）
          </p>
        </div>
        <Link
          href="/settings"
          className="text-sm btn-primary text-white px-4 py-2 rounded-xl transition-colors"
        >
          ⚙️ AI 服务配置 →
        </Link>
      </header>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* 系统概览 */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ["用户总数", data?.stats.userCount],
          ["管理员", data?.stats.adminCount],
          ["已禁用", data?.stats.disabledCount],
          ["累计完成课", data?.stats.doneLessons],
          ["总 XP", data?.stats.totalXp],
          ["未掌握错题", data?.stats.totalWrong],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card border border-border rounded-xl p-3.5 text-center">
            <div className="text-xl font-bold text-indigo-600">{value ?? "-"}</div>
            <div className="text-[11px] text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </section>

      {/* 配额设置 */}
      <QuotaCard />

      {/* Token 用量统计 */}
      <TokenStatsCard />

      {/* 缓存内容查看器 */}
      <CacheViewer />

      {/* 用户管理 */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold">👥 用户管理</h2>
          <button
            onClick={load}
            className="text-xs text-slate-400 hover:text-indigo-600"
          >
            ↻ 刷新
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="text-left px-4 py-2.5 font-medium">用户</th>
                <th className="text-left px-3 py-2.5 font-medium">角色</th>
                <th className="text-left px-3 py-2.5 font-medium">状态</th>
                <th className="text-right px-3 py-2.5 font-medium">XP</th>
                <th className="text-right px-3 py-2.5 font-medium">完成课</th>
                <th className="text-right px-3 py-2.5 font-medium">错题</th>
                <th className="text-left px-3 py-2.5 font-medium">注册时间</th>
                <th className="text-right px-4 py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        u.role === "admin"
                          ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                    >
                      {u.role === "admin" ? "管理员" : "用户"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.disabled ? (
                      <span className="text-xs text-red-500">已禁用</span>
                    ) : (
                      <span className="text-xs text-emerald-600">正常</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">{u.xp}</td>
                  <td className="px-3 py-2.5 text-right">{u.completed}</td>
                  <td className="px-3 py-2.5 text-right">{u.wrongCount}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      disabled={busy}
                      onClick={() =>
                        op(
                          { type: "setRole", userId: u.id, role: u.role === "admin" ? "user" : "admin" },
                          `确定将「${u.username}」${u.role === "admin" ? "降级为普通用户" : "提升为管理员"}？`
                        )
                      }
                      className="text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-40"
                    >
                      {u.role === "admin" ? "降级" : "设为管理员"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        op(
                          { type: "setDisabled", userId: u.id, disabled: !u.disabled },
                          `确定${u.disabled ? "启用" : "禁用"}「${u.username}」？`
                        )
                      }
                      className="text-xs text-slate-500 hover:text-amber-600 disabled:opacity-40"
                    >
                      {u.disabled ? "启用" : "禁用"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        op(
                          { type: "resetCourses", userId: u.id },
                          `重置「${u.username}」的课程解锁记录？（其学习进度/数据保留，仅解锁名额清零）`
                        )
                      }
                      className="text-xs text-slate-500 hover:text-cyan-600 disabled:opacity-40"
                    >
                      重置课程
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const pwd = prompt(`为「${u.username}」设置新密码（至少 6 位）：`);
                        if (pwd) op({ type: "resetPassword", userId: u.id, password: pwd });
                      }}
                      className="text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-40"
                    >
                      重置密码
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        op(
                          { type: "delete", userId: u.id },
                          `⚠️ 确定删除「${u.username}」？其全部学习数据（进度/错题/笔记/对话）将被清除，不可恢复！`
                        )
                      }
                      className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-40"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    还没有注册用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 缓存管理 */}
      <section className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-sm">♻️ AI 内容缓存</h2>
          <p className="text-xs text-slate-400 mt-1">
            当前缓存 <b className="text-slate-600">{data?.stats.cacheCount ?? 0}</b> 条，命中后不再调用大模型
          </p>
        </div>
        <button
          onClick={async () => {
            if (!confirm("确定清空全部 AI 内容缓存？之后首次学习会重新调用 AI 生成。")) return;
            await fetch("/api/cache", { method: "DELETE" });
            load();
          }}
          className="text-xs px-3.5 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
        >
          清空缓存
        </button>
      </section>
    </div>
  );
}

/** 配额设置卡：普通用户每日 AI 次数 / 可学课程数 */
function QuotaCard() {
  const [quota, setQuota] = useState<{ aiDailyLimit: number; courseLimit: number } | null>(null);
  const [aiLimit, setAiLimit] = useState("");
  const [courseLimit, setCourseLimit] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d) => {
        setQuota(d);
        setAiLimit(String(d.aiDailyLimit));
        setCourseLimit(String(d.courseLimit));
      })
      .catch(() => setError("加载失败"));
  }, []);

  const save = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDailyLimit: Number(aiLimit), courseLimit: Number(courseLimit) }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "保存失败");
        return;
      }
      setQuota(d);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("保存失败");
    }
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-bold text-sm mb-1">⚖️ 普通用户配额</h2>
      <p className="text-xs text-slate-400 mb-4">
        限制仅对普通用户生效，管理员不受限。AI 交互按成功调用计数，缓存命中不占用次数。
      </p>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate-500">
          每日 AI 交互次数
          <input
            type="number"
            min={0}
            value={aiLimit}
            onChange={(e) => setAiLimit(e.target.value)}
            className="block w-28 mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-card"
          />
        </label>
        <label className="text-xs text-slate-500">
          可学习课程数
          <input
            type="number"
            min={0}
            max={8}
            value={courseLimit}
            onChange={(e) => setCourseLimit(e.target.value)}
            className="block w-28 mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-card"
          />
        </label>
        <button
          onClick={save}
          className="btn-primary text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          保存配额
        </button>
        {saved && <span className="text-xs text-emerald-500">✓ 已保存（当前值：AI {quota?.aiDailyLimit} 次/天，课程 {quota?.courseLimit} 门）</span>}
      </div>
    </section>
  );
}
