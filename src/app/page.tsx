"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES, CODE_COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import Bookshelf from "@/components/Bookshelf";
import type { Progress } from "@/lib/types";
import "./languages/book.css";

export default function Dashboard() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{
    unlocked: string[];
    courseLimit: number;
    aiUsed: number;
    aiLimit: number;
    configured?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
    fetch("/api/me/usage")
      .then((r) => r.json())
      .then((d) => {
        setUsage(d);
        setConfigured(Boolean(d.configured));
      })
      .catch(() => {});
  }, [me]);

  /** 达到课程数上限的课程（书架上显示锁） */
  const lockedLangs = useMemo(() => {
    if (!usage || usage.courseLimit === -1) return [];
    if (usage.unlocked.length < usage.courseLimit) return [];
    return COURSES.filter((c) => !usage.unlocked.includes(c.lang)).map((c) => c.lang);
  }, [usage]);

  // 登录门禁：所有 Hooks 之后才能早退
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) {
    return null; // 未登录，已跳转 /login
  }

  return (
    <div className="library-page space-y-10">
      {/* 配置提醒 */}
      {configured === false && (
        <div className="flex justify-center pt-2">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2 rounded-xl">
            ⚠️ 还未配置 AI 的 API Key，
            <Link href="/settings" className="font-semibold underline">
              前往设置
            </Link>
          </div>
        </div>
      )}

      {/* 书架：图书馆场景，编程与运维课程（语言课在增值包书架） */}
      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              📚 我的书架
              <span className="text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {CODE_COURSES.length} 本
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              点一本书把它从书架上抽出来，再点一下翻开封面，从目录进入全屏阅读。
            </p>
          </div>
        </div>

        <Bookshelf
          courses={CODE_COURSES}
          progress={progress}
          lockedLangs={lockedLangs}
        />
      </section>

      {/* 语言学习增值包入口 */}
      {LANGUAGE_COURSES.length > 0 && (
        <section className="flex items-center gap-5 bg-card border border-border rounded-2xl p-5 card-glow">
          <Link
            href="/languages"
            aria-label="进入语言学习增值包"
            className="shrink-0 book-cover w-20 h-28 flex flex-col items-center justify-center gap-1"
            style={
              {
                "--cover-from": "#fb7185",
                "--cover-mid": "#db2777",
                "--cover-to": "#be185d",
              } as React.CSSProperties
            }
          >
            <span className="text-2xl">🌸</span>
            <span className="serif-title text-xs text-white">日语</span>
          </Link>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold flex items-center gap-2">
              🌸 语言学习增值包
              <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                {LANGUAGE_COURSES.length} 门
              </span>
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              场景对话实战 + 语言老师逐句点评（与编程课程不同的学习路径，有独立的书架）
            </p>
          </div>
          <Link
            href="/languages"
            className="shrink-0 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            进入增值包书架 →
          </Link>
        </section>
      )}
    </div>
  );
}
