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
        <div className="shelf-heading">
          <div className="shelf-heading-main">
            <span className="shelf-heading-icon" aria-hidden="true">
              📚
            </span>
            <h2 className="shelf-heading-title">我的书架</h2>
            <span className="shelf-heading-count">{CODE_COURSES.length} 本</span>
          </div>
          <p className="shelf-heading-sub">
            点一本书把它从书架上抽出来，再点一下翻开封面，从目录进入全屏阅读。
          </p>
        </div>

        <Bookshelf
          courses={CODE_COURSES}
          progress={progress}
          lockedLangs={lockedLangs}
          giftBox={
            LANGUAGE_COURSES.length > 0
              ? { href: "/languages", label: "日语", sub: "语言增值包" }
              : undefined
          }
        />
      </section>
    </div>
  );
}
