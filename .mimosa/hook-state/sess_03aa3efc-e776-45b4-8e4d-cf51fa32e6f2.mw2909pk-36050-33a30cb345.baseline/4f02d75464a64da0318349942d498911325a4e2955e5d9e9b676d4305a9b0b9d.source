"use client";

import { useEffect, useState } from "react";
import { PROVIDER_PRESETS } from "@/lib/ai/presets";
import { fetchSettings, saveSettings, testSettings } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { ProviderId } from "@/lib/types";

interface Usage {
  username: string;
  role: "admin" | "user";
  createdAt: string;
  aiUsed: number;
  aiLimit: number;
  unlocked: string[];
  courseLimit: number;
  totalCourses: number;
  xp: number;
  completedLessons: number;
  streak: number;
  tokens?: {
    total: number;
    prompt: number;
    completion: number;
    calls: number;
    today: number;
    estimated: boolean;
  };
}

export default function SettingsPage() {
  const me = useRequireUser();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [provider, setProvider] = useState<ProviderId>("glm");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maskedKey, setMaskedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ count: number; byTask: Record<string, number> } | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const [tokens, setTokens] = useState<
    Array<{ id: string; label: string; createdAt: string; lastUsedAt: string | null; revoked: boolean }>
  >([]);
  const [tokenLabel, setTokenLabel] = useState("");
  const [newToken, setNewToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [tokenCopied, setTokenCopied] = useState(false);

  /** 拉取已签发的 API Token 列表 */
  const loadTokens = () => {
    fetch("/api/auth/tokens")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => {});
  };

  const createToken = async () => {
    setTokenBusy(true);
    setTokenError("");
    try {
      const res = await fetch("/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", label: tokenLabel }),
      });
      const d = await res.json();
      if (!res.ok) {
        setTokenError(d.error ?? "生成失败");
        return;
      }
      setNewToken(d.token ?? "");
      setTokens(d.tokens ?? []);
      setTokenLabel("");
    } catch {
      setTokenError("生成失败");
    } finally {
      setTokenBusy(false);
    }
  };

  const revokeToken = async (id: string) => {
    const res = await fetch("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", tokenId: id }),
    });
    const d = await res.json();
    setTokens(d.tokens ?? []);
  };

  /** 从服务端实时拉取可用模型列表 */
  const fetchModels = async () => {
    setModelLoading(true);
    setModelError("");
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (!res.ok) {
        setModelError(data.error ?? "获取失败");
        return;
      }
      if (Array.isArray(data.models) && data.models.length > 0) {
        setFetchedModels(data.models);
        // 当前模型不在列表里时，自动选第一个
        setModel((cur) =>
          cur && data.models.includes(cur) ? cur : data.models[0]
        );
      } else {
        setModelError(data.message ?? "未获取到模型");
      }
    } catch {
      setModelError("获取失败");
    } finally {
      setModelLoading(false);
    }
  };

  const refreshCacheInfo = () => {
    fetch("/api/cache")
      .then((r) => r.json())
      .then(setCacheInfo)
      .catch(() => {});
  };

  useEffect(() => {
    if (!me) {
      return;
    }
    let alive = true;
    (async () => {
      try {
        const u = await fetch("/api/me/usage").then((r) => r.json());
        if (!alive) return;
        setUsage(u);
        if (me.role === "admin") {
          const s = await fetchSettings();
          if (!alive) return;
          setProvider(s.provider);
          setBaseUrl(s.baseUrl);
          setModel(s.model);
          setTemperature(s.temperature);
          setMaskedKey(s.apiKeyMasked);
          const c = await fetch("/api/cache").then((r) => r.json());
          if (alive) setCacheInfo(c);
          loadTokens();
        }
      } catch {
        /* 加载失败保持默认 */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [me]);

  const clearCache = async () => {
    await fetch("/api/cache", { method: "DELETE" });
    refreshCacheInfo();
  };

  const preset = PROVIDER_PRESETS[provider];

  const switchProvider = (p: ProviderId) => {
    setProvider(p);
    setModel(PROVIDER_PRESETS[p].defaultModel);
    setMessage(null);
  };

  const buildPayload = (persist = false) => ({
    provider,
    apiKey: apiKey.trim() || undefined, // 留空 = 保留旧 Key
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    temperature,
    persist,
  });

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(buildPayload());
      const s = await fetchSettings();
      setMaskedKey(s.apiKeyMasked);
      setApiKey("");
      setMessage({ ok: true, text: "✅ 配置已保存" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const r = await testSettings(buildPayload(false));
      if (r.ok) {
        setMessage({
          ok: true,
          text: `✅ 连接成功！模型 ${r.model} 回复：${r.reply ?? ""}`,
        });
      } else {
        setMessage({ ok: false, text: `❌ ${r.error ?? "连接失败"}` });
      }
    } catch (e) {
      setMessage({ ok: false, text: `❌ ${e instanceof Error ? e.message : "连接失败"}` });
    } finally {
      setTesting(false);
    }
  };

  if (loading || me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) {
    return null; // 未登录，已跳转 /login
  }

  // ---------- 普通用户视图：账号与配额用量（不含 AI 配置） ----------
  if (me.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold">⚙️ 设置</h1>
          <p className="text-slate-500 mt-1 text-sm">账号信息与个人用量</p>
        </header>

        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold mb-4">👤 账号</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400 text-xs">用户名</div>
              <div className="font-medium mt-0.5">{usage?.username ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">角色</div>
              <div className="font-medium mt-0.5">普通用户</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">累计 XP</div>
              <div className="font-medium mt-0.5">{usage?.xp ?? 0}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">连续学习</div>
              <div className="font-medium mt-0.5">🔥 {usage?.streak ?? 0} 天</div>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-bold">📊 我的用量</h2>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>今日 AI 交互</span>
              <span className="text-slate-400">
                {usage ? `${usage.aiUsed} / ${usage.aiLimit} 次` : "…"}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                style={{
                  width: usage && usage.aiLimit > 0 ? `${Math.min(100, (usage.aiUsed / usage.aiLimit) * 100)}%` : "0%",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>已解锁课程</span>
              <span className="text-slate-400">
                {usage ? `${usage.unlocked.length} / ${usage.courseLimit} 门（共 ${usage.totalCourses} 门）` : "…"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {usage?.unlocked.length ? (
                usage.unlocked.map((l) => (
                  <span key={l} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                    {l}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">进入任意课程即自动解锁</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              提示：进入新课程会占用一个解锁名额；需要更多课程请联系管理员调整配额。
            </p>
          </div>

          {/* Token 用量 */}
          {usage?.tokens && (
            <div className="border-t border-border pt-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span>累计 Token 用量</span>
                <span className="text-slate-400 tabular-nums">
                  {usage.tokens.total.toLocaleString()} tokens
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 dark:bg-card-2 rounded-lg py-2">
                  <div className="text-sm font-semibold text-indigo-600 tabular-nums">
                    {usage.tokens.prompt.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">输入</div>
                </div>
                <div className="bg-slate-50 dark:bg-card-2 rounded-lg py-2">
                  <div className="text-sm font-semibold text-cyan-600 tabular-nums">
                    {usage.tokens.completion.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">输出</div>
                </div>
                <div className="bg-slate-50 dark:bg-card-2 rounded-lg py-2">
                  <div className="text-sm font-semibold text-slate-600 tabular-nums">
                    {usage.tokens.calls}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">调用次数</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                今日消耗 {usage.tokens.today.toLocaleString()} tokens
                {usage.tokens.estimated && "（部分为估算值：服务商未返回 usage）"}
              </p>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl p-4">
          <p className="font-medium text-slate-500 mb-1">💡 说明</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>AI 服务（模型/Key/配额）由管理员统一配置，普通用户无需也无需权限修改。</li>
            <li>外观主题在右上角 ☀️/🌙 切换，偏好保存在浏览器本地。</li>
            <li>学习数据保存在服务器数据库中，仅你本人与管理员可见。</li>
          </ul>
        </section>
      </div>
    );
  }

  // ---------- 管理员视图：AI 服务配置 ----------
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">⚙️ 设置</h1>
        <p className="text-slate-500 mt-1 text-sm">
          AI 服务商与 API Key 配置（管理员专属）。配置保存在服务器数据库中，不会出现在前端。
        </p>
      </header>

      {/* 服务商选择 */}
      <section>
        <h2 className="font-bold mb-3">AI 服务商</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.values(PROVIDER_PRESETS).map((p) => (
            <button
              key={p.id}
              onClick={() => switchProvider(p.id)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                provider === p.id
                  ? "border-indigo-500 bg-indigo-50/60 shadow-sm"
                  : "border-border bg-card hover:border-indigo-200"
              }`}
            >
              <div className="font-bold text-sm">
                {p.id === "glm" && "🧊 "}
                {p.id === "minimax" && "🐚 "}
                {p.id === "custom" && "🔧 "}
                {p.name}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{p.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 配置表单 */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            API Key <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={maskedKey ? `已保存：${maskedKey}（留空则不修改）` : "粘贴你的 API Key"}
              className="flex-1 font-mono text-sm border border-border rounded-xl px-3.5 py-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="px-3 text-sm text-slate-500 hover:text-slate-800 border border-border rounded-xl"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {preset.keyHint}
            {preset.docsUrl && (
              <>
                {" · "}
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-500 hover:underline"
                >
                  获取 Key ↗
                </a>
              </>
            )}
          </p>
        </div>

        {/* 自定义 Base URL */}
        {preset.allowCustomBaseUrl && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Base URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="如 https://api.deepseek.com 或 http://localhost:11434/v1"
              className="w-full font-mono text-sm border border-border rounded-xl px-3.5 py-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              填到版本号即可（/v1、/v4），应用会自动拼接 /chat/completions
            </p>
          </div>
        )}

        {/* 模型 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium">模型</label>
            <button
              onClick={fetchModels}
              disabled={modelLoading}
              className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              {modelLoading ? "获取中…" : "⟳ 自动获取模型列表"}
            </button>
          </div>
          {modelError && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mb-2">
              {modelError}
            </p>
          )}
          {fetchedModels.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2 mb-1">
                {fetchedModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                      model === m
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-border text-slate-500 hover:border-indigo-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                共 {fetchedModels.length} 个可用模型（实时读取自服务商）
              </p>
            </>
          ) : preset.models.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {preset.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                    model === m
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-border text-slate-500 hover:border-indigo-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={preset.defaultModel || "输入模型名，如 deepseek-chat"}
            className="mt-2 w-full font-mono text-sm border border-border rounded-xl px-3.5 py-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>

        {/* 温度 */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            回复风格（temperature：{temperature.toFixed(1)}）
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>0.0 严谨稳定</span>
            <span>0.7 平衡（推荐）</span>
            <span>1.0 活泼发散</span>
          </div>
        </div>

        {/* 消息 */}
        {message && (
          <p
            className={`text-sm rounded-xl px-4 py-3 break-all ${
              message.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {testing ? "测试中…" : "① 测试连接"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 btn-primary disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {saving ? "保存中…" : "② 保存配置"}
          </button>
        </div>
      </section>

      {/* 移动端接入 */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-sm mb-1">📱 移动端 / 小程序接入</h2>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          生成 API Token 后，即可在微信小程序、React Native (iOS/Android) 或任意
          独立前端中调用本应用的全部接口。Token 明文只显示一次，服务端仅存摘要。
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={tokenLabel}
            onChange={(e) => setTokenLabel(e.target.value)}
            placeholder="备注名称，如「我的 iPhone」"
            className="text-sm border border-border rounded-lg px-3 py-2 flex-1 min-w-[160px] bg-card"
          />
          <button
            onClick={createToken}
            disabled={tokenBusy}
            className="btn-primary text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {tokenBusy ? "生成中…" : "生成 Token"}
          </button>
        </div>

        {newToken && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
            <div className="text-xs font-medium text-emerald-700 mb-1">
              ✓ 新 Token（仅显示这一次，请立即保存）
            </div>
            <code className="block font-mono text-xs bg-card border border-border rounded-lg p-2 break-all">
              {newToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(newToken);
                setTokenCopied(true);
                setTimeout(() => setTokenCopied(false), 2000);
              }}
              className="mt-2 text-xs text-emerald-700 hover:underline"
            >
              {tokenCopied ? "✓ 已复制" : "复制"}
            </button>
          </div>
        )}

        {tokenError && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-2">
            {tokenError}
          </p>
        )}

        {tokens.length > 0 && (
          <div className="space-y-1.5">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 text-xs border border-border rounded-lg px-3 py-2"
              >
                <span className="font-medium">{t.label || "未命名"}</span>
                <span className="text-slate-400 font-mono">#{t.id}</span>
                <span className="text-slate-400 ml-auto">
                  {t.revoked ? "已撤销" : `最近使用 ${t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString("zh-CN") : "—"}`}
                </span>
                {!t.revoked && (
                  <button
                    onClick={() => revokeToken(t.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    撤销
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <details className="mt-4">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-indigo-500">
            接入代码示例（小程序 / React Native）
          </summary>
          <pre className="mt-2 text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed">{`// React Native / 小程序通用
const api = createApiClient({
  baseUrl: "https://your-api.example.com",
  token: "ct_xxxxxxxx",
});

const me = await api.fetchUsage();
const progress = await api.fetchProgress();
await api.streamAi(
  { task: "tutor", lang: "python", lessonId: "python-1-1",
    messages: [{ role: "user", content: "什么是变量？" }] },
  { onContent: (t) => setReply((p) => p + t) }
);`}</pre>
          <p className="text-[11px] text-slate-400 mt-2">
            跨域前端请在后端设置环境变量 <code className="bg-slate-100 px-1 rounded">CORS_ORIGINS</code>{" "}
            指定允许的来源（逗号分隔），留空表示放行全部。
          </p>
        </details>
      </section>

      {/* 内容缓存管理 */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-sm">♻️ AI 内容缓存</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              已生成的深入讲解、测验题、面试题会落盘复用，命中缓存不再调用大模型（省费用）。
              目前缓存 <b className="text-slate-600">{cacheInfo?.count ?? 0}</b> 条
              {cacheInfo && cacheInfo.count > 0 && (
                <span>
                  {" "}（{Object.entries(cacheInfo.byTask)
                    .map(([t, n]) => `${t === "explain" ? "讲解" : t === "quiz" ? "测验" : t === "interview-questions" ? "面试题" : t === "interview-guide" ? "面试讲解" : t}×${n}`)
                    .join("、")}）
                </span>
              )}
              。重新生成会自动覆盖对应缓存。
            </p>
          </div>
          <button
            onClick={clearCache}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
          >
            清空缓存
          </button>
        </div>
      </section>

      <section className="text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl p-4">
        <p className="font-medium text-slate-500 mb-1">💡 说明</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>「测试连接」会真实调用一次 AI（成功后自动保存），用于验证 Key 与模型名是否正确。</li>
          <li>GLM 的 glm-4-flash 有免费额度，适合先体验；MiniMax 与自定义服务按各平台计费。</li>
          <li>所有 AI 请求由本地 Next.js 服务端转发，浏览器不直接接触 Key。</li>
        </ul>
      </section>
    </div>
  );
}
