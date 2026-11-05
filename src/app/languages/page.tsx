"use client";

import { useEffect, useMemo, useState } from "react";
import { COURSES, LANGUAGE_COURSES } from "@/data/courses";
import { fetchProgress } from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import Bookshelf from "@/components/Bookshelf";
import type { Progress } from "@/lib/types";
import "./book.css";

/** 语言学习增值包：书架 + 抽出的书 */
export default function LanguagesPage() {
  const me = useRequireUser();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [usage, setUsage] = useState<{
    unlocked: string[];
    courseLimit: number;
  } | null>(null);

  useEffect(() => {
    if (!me) return;
    fetchProgress().then(setProgress).catch(() => {});
    fetch("/api/me/usage")
      .then((r) => r.json())
      .then((d) => setUsage({ unlocked: d.unlocked ?? [], courseLimit: d.courseLimit ?? -1 }))
      .catch(() => {});
  }, [me]);

  const lockedLangs = useMemo(() => {
    if (!usage || usage.courseLimit === -1) return [];
    if (usage.unlocked.length < usage.courseLimit) return [];
    return COURSES.filter((c) => !usage.unlocked.includes(c.lang)).map((c) => c.lang);
  }, [usage]);

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-24">加载中…</p>;
  }
  if (me === null) return null;

  return (
    <div className="space-y-10">
      {/* Hero：书架氛围 */}
      <section className="text-center py-10 book-stage">
        <p className="hand-note text-lg mb-1">—— 学语言，像读一本书 ——</p>
        <h1 className="text-4xl font-extrabold serif-title">
          语言学习<span className="grad-text">增值包</span>
        </h1>
        <p className="mt-4 text-slate-500 max-w-xl mx-auto leading-relaxed">
          每一门语言都是一本书：翻开封面，从第一页读到最后一页。
          场景对话是「对话练习」，老师批注是「页边笔记」，读完一章，翻向下一章。
        </p>
      </section>

      {/* 书架：抽出语言书 */}
      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              🌸 语言书架
              <span className="text-xs font-normal bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                {LANGUAGE_COURSES.length} 本
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              点一本书把它抽出来，翻开目录；也可进入编程课程书架。
            </p>
          </div>
        </div>

        <Bookshelf
          courses={LANGUAGE_COURSES}
          progress={progress}
          lockedLangs={lockedLangs}
        />
      </section>

      {/* 与编程课的区别说明 */}
      <section className="paper book-page rounded-r-xl rounded-l-sm p-5 sm:p-6">
        <h2 className="serif-title font-bold mb-2">📖 与编程课程有什么不同？</h2>
        <ul className="text-sm space-y-1.5 text-slate-600 dark:text-slate-300">
          <li>
            <b>编程课程</b>：AI 导师问答 → 练习测验 → 代码实操（写+运行+AI 挑毛病）→ 模拟面试（技术面）
          </li>
          <li>
            <b>语言课程</b>：AI 导师问答 → 练习测验 → 场景模拟（对话实战 + 语言老师点评），无代码实操
          </li>
          <li>
            两者共用闯关制：测验与场景对话双达标才能翻向下一页；进度、错题本、收藏、笔记完全互通
          </li>
        </ul>
      </section>
    </div>
  );
}
