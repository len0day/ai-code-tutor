"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COURSES, CODE_COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useMe } from "@/lib/useMe";
import Bookshelf from "@/components/Bookshelf";
import type { Progress } from "@/lib/types";
import "./languages/book.css";

export default function Dashboard() {
  const me = useMe();
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
  }, [me]);

  useEffect(() => {
    if (!me) return;
    fetch("/api/me/usage")
      .then((r) => r.json())
      .then((d) => {
        setUsage(d);
        setConfigured(Boolean(d.configured));
      })
      .catch(() => {});
  }, [me]);

  // 全屏沉浸：进入首页时隐藏导航栏（顶部下拉绳呼出），页面被 3D 场景铺满
  useEffect(() => {
    document.body.classList.add("immersive");
    return () => document.body.classList.remove("immersive", "nav-open");
  }, []);
  const lockedLangs = useMemo(() => {
    if (!usage || usage.courseLimit === -1) return [];
    if (usage.unlocked.length < usage.courseLimit) return [];
    return COURSES.filter((c) => !usage.unlocked.includes(c.lang)).map((c) => c.lang);
  }, [usage]);

  // 登录态：未登录 = 访客模式，一样进入 3D 书房（点书 / 鱼缸等弹出注册引导）
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  const guest = me === null;

  const toggleNav = () => document.body.classList.toggle("nav-open");

  return (
    <>
      {/* 下拉绳：点击呼出 / 收起导航栏（置于全屏容器之外，保证层叠在导航之上） */}
      <button
        className="nav-pull-cord"
        onClick={toggleNav}
        aria-label="下拉显示导航栏"
        title="下拉显示导航栏"
      >
        <span className="cord-line" aria-hidden="true" />
        <span className="cord-ring" aria-hidden="true" />
      </button>
      <div className="scene-fullscreen">
      {/* 配置提醒（仅登录用户）：悬浮在场景左上角 */}
      {!guest && configured === false && (
        <div className="scene-chip">
          ⚠️ 还未配置 AI 的 API Key，
          <Link href="/settings" className="font-semibold underline">
            前往设置
          </Link>
        </div>
      )}

      {/* 3D 书房（铺满全屏） */}
      <Bookshelf
        courses={CODE_COURSES}
        progress={guest ? null : progress}
        lockedLangs={guest ? [] : lockedLangs}
        guest={guest}
        isAdmin={!guest && me.role === "admin"}
        giftBox={
          LANGUAGE_COURSES.length > 0
            ? { href: "/languages", label: "增值礼包", sub: "语言学习增值包" }
            : undefined
        }
      />
      </div>
    </>
  );
}
