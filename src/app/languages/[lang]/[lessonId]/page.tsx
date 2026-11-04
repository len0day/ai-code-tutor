"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { findLesson, getCourse, flatLessons } from "@/data/courses";
import {
  fetchNotebook,
  fetchProgress,
  isLessonUnlocked,
  postProgress,
  saveNote,
  streamAi,
  toggleFavorite,
} from "@/lib/client";
import { useRequireUser } from "@/lib/useMe";
import type { Notebook, Progress } from "@/lib/types";
import Markdown from "@/components/Markdown";
import ChatPanel from "@/components/ChatPanel";
import QuizTab from "@/components/QuizTab";
import LanguageRoleplay from "@/components/LanguageRoleplay";
import ReasoningBlock from "@/components/ReasoningBlock";
import SpeakButton from "@/components/SpeakButton";
import LessonGateGuard, { GateBadge } from "@/components/LessonGateGuard";
import { PASS_SCORE } from "@/lib/gateConstants";
import "../../book.css";

type Tab = "tutor" | "quiz" | "roleplay";

export default function LanguageLessonPage() {
  const me = useRequireUser();
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-20">加载中…</p>}>
      <LanguageLesson me={me} />
    </Suspense>
  );
}

function LanguageLesson({ me }: { me: ReturnType<typeof useRequireUser> }) {
  const params = useParams<{ lang: string; lessonId: string }>();
  const lang = params.lang;
  const lessonId = params.lessonId;
  const course = getCourse(lang);
  const found = findLesson(lang, lessonId);

  const [tab, setTab] = useState<Tab>("tutor");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const [teach, setTeach] = useState("");
  const [teachReasoning, setTeachReasoning] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [teachError, setTeachError] = useState("");
  /** 闯关：未解锁 → 预览模式，AI 功能禁用 */
  const [unlocked, setUnlocked] = useState(true);

  /** 刷新闯关解锁状态 */
  const refreshGate = () => {
    fetchProgress()
      .then((d) => {
        setProgress(d);
        setUnlocked(isLessonUnlocked(d, lang, lessonId));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!me) return;
    postProgress({ type: "visit", lessonId }).then(setProgress).catch(() => {});
    fetchNotebook()
      .then((nb) => {
        setNotebook(nb);
        setNoteDraft(nb.notes[lessonId]?.content ?? "");
      })
      .catch(() => {});
    fetchProgress()
      .then((d) => {
        setProgress(d);
        setUnlocked(isLessonUnlocked(d, lang, lessonId));
      })
      .catch(() => {});
    // 取回已缓存的语言精讲（长期保留，直接展示，不消耗 AI 调用）
    fetch(`/api/ai/cached?task=language-teach&lang=${lang}&lessonId=${lessonId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.cached && typeof d.content === "string") setTeach(d.content);
      })
      .catch(() => {});
  }, [lessonId, me, lang]);

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-20">鉴权检查中…</p>;
  }
  if (me === null) return null;
  if (!course || !found) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到课程内容</p>
        <Link href="/languages" className="text-indigo-600 mt-4 inline-block">
          返回增值包
        </Link>
      </div>
    );
  }

  const { lesson, level, index, total } = found;
  const flat = flatLessons(lang);
  const prev = index > 0 ? flat[index - 1].lesson : null;
  const next = index < total - 1 ? flat[index + 1].lesson : null;
  // 完成状态由闯关系统判定（测验 + 场景对话双达标）

  const lessonFav = notebook?.favorites.some(
    (f) => f.kind === "lesson" && f.lessonId === lessonId
  );
  const toggleLessonFav = async () => {
    await toggleFavorite({
      lessonId,
      lang,
      kind: "lesson",
      title: lesson.title,
      content: lesson.summary,
    });
    setNotebook(await fetchNotebook());
  };

  const handleSaveNote = async () => {
    await saveNote(lessonId, lang, noteDraft);
    setNotebook(await fetchNotebook());
    setNoteSavedAt(
      new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    );
  };

  /** 语言精讲：流式生成语法 + 单词表 + 例句 + 练习 */
  const runTeach = async (force: boolean) => {
    if (teaching) return;
    setTeach("");
    setTeachReasoning("");
    setTeachError("");
    setTeaching(true);
    try {
      await streamAi(
        { task: "language-teach", lang, lessonId, force },
        {
          onContent: (d) => setTeach((p) => p + d),
          onReasoning: (d) => setTeachReasoning((p) => p + d),
        }
      );
    } catch (e) {
      setTeachError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setTeaching(false);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        tab === id
          ? "border-rose-500 text-rose-600 bg-rose-50/50 dark:bg-rose-950/20"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* 闯关守卫：未解锁 → 预览模式 */}
      <LessonGateGuard lang={lang} lessonId={lessonId} progress={progress} />

      {/* 顶部：书页页眉 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          <Link href="/languages" className="hover:text-rose-500 hand-note">
            🌸 语言学习增值包
          </Link>
          <span className="mx-2">/</span>
          <span className="serif-title">
            {course.name} · 第{["一", "二", "三", "四"][Number(level.id) - 1] ?? level.id}章
          </span>
          <span className="mx-2">/</span>
          <span className="text-slate-600">
            第 {index + 1} 页 / 共 {total} 页
          </span>
          <span className="ml-2">
            <GateBadge gate={progress?.gates?.[lang]?.[lessonId]} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLessonFav}
            className={`text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
              lessonFav
                ? "border-amber-300 bg-amber-50 text-amber-500"
                : "border-border text-slate-400 hover:border-amber-300 hover:text-amber-500"
            }`}
          >
            {lessonFav ? "★ 已收藏" : "☆ 收藏"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 book-stage">
        {/* 左列：书页内容 */}
        <div className="space-y-5 page-enter" key={lessonId}>
          <header className="text-center pb-2">
            <p className="hand-note text-sm">第 {index + 1} 页</p>
            <h1 className="text-3xl serif-title font-bold mt-1">{lesson.title}</h1>
            <div className="flex items-center justify-center gap-2 mt-3" aria-hidden="true">
              <span className="h-px w-12 bg-amber-900/25 dark:bg-amber-100/20" />
              <span className="text-rose-500 text-xs">❦</span>
              <span className="h-px w-12 bg-amber-900/25 dark:bg-amber-100/20" />
            </div>
            <p className="text-slate-500 mt-3 leading-relaxed max-w-md mx-auto">
              {lesson.summary}
            </p>
          </header>

          <section className="paper book-page rounded-r-xl rounded-l-sm p-6 pl-8">
            <h2 className="serif-title font-bold mb-3 text-amber-900/80 dark:text-amber-200/80">
              ✦ 本课要点
            </h2>
            <ul className="space-y-2.5">
              {lesson.keyPoints.map((kp, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs grid place-items-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </section>

          {lesson.example && (
            <section className="paper book-page rounded-r-xl rounded-l-sm p-6 pl-8">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="serif-title font-bold text-amber-900/80 dark:text-amber-200/80">
                  ✦ 例句与读音
                </h2>
                <div className="flex items-center gap-1.5">
                  <SpeakButton
                    id={`example-ja-${lesson.id}`}
                    text={lesson.example.code}
                    lang={lang}
                    part="foreign"
                    label="日语"
                  />
                  <SpeakButton
                    id={`example-zh-${lesson.id}`}
                    text={lesson.example.code}
                    lang="zh"
                    part="translation"
                    label="中文"
                  />
                </div>
              </div>
              {lesson.example.note && (
                <p className="hand-note text-sm mb-2">{lesson.example.note}</p>
              )}
              <div className="whitespace-pre-wrap text-sm leading-loose">
                {lesson.example.code}
              </div>
            </section>
          )}

          {/* 语言精讲（语言课专属的内容生成方式） */}
          <section className="paper book-page rounded-r-xl rounded-l-sm p-6 pl-8">
            <div className="flex items-center justify-between mb-1 gap-2">
              <h2 className="serif-title font-bold text-amber-900/80 dark:text-amber-200/80">
                ✦ 语言精讲
              </h2>
              <div className="flex items-center gap-1.5">
                {teach && !teaching && (
                  <>
                    <SpeakButton
                      id={`teach-ja-${lesson.id}`}
                      text={teach}
                      lang={lang}
                      part="foreign"
                      label="日语"
                    />
                    <SpeakButton
                      id={`teach-zh-${lesson.id}`}
                      text={teach}
                      lang="zh"
                      part="translation"
                      label="中文"
                    />
                  </>
                )}
                <button
                  onClick={() => runTeach(teach ? true : false)}
                  disabled={teaching || !unlocked}
                  title={
                    unlocked
                      ? teach
                        ? "忽略缓存重新生成"
                        : "语法点 + 单词表 + 例句拆解 + 随堂练习"
                      : "本课尚未解锁，通过上一课后可用"
                  }
                  className="text-sm btn-primary text-white px-4 py-1.5 rounded-lg disabled:opacity-40"
                >
                  {teaching ? "讲解中…" : teach ? "重新讲解" : "开始精讲"}
                </button>
              </div>
            </div>
            {!unlocked && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                🔒 本课未解锁，AI 精讲暂不可用（通过上一课后开放）
              </p>
            )}
            <p className="hand-note text-sm mb-2">
              与编程课的「深入讲解」不同：这里由语言老师讲 语法要点 + 单词表 + 句子拆解 + 常见错误 + 随堂练习
            </p>
            {teachReasoning && (
              <ReasoningBlock reasoning={teachReasoning} thinking={teaching && !teach} />
            )}
            {teachError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{teachError}</p>
            )}
            {teach && (
              <div className="mt-2">
                <Markdown content={teach} />
                {teaching && <span className="streaming-cursor" />}
              </div>
            )}
            {!teach && !teaching && !teachError && (
              <p className="text-sm text-slate-400">
                点击「开始精讲」，生成一节完整语言课：语法 + 单词 + 例句 + 练习。
              </p>
            )}
          </section>

          <section className="paper book-page rounded-r-xl rounded-l-sm p-6 pl-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="serif-title font-bold">✦ 页边笔记</h2>
              <div className="flex items-center gap-2">
                {noteSavedAt && (
                  <span className="text-xs text-emerald-600">✓ 已保存 {noteSavedAt}</span>
                )}
                <button
                  onClick={handleSaveNote}
                  className="hand-note text-sm bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              placeholder="像在书页边上写批注：易混语法、单词记忆法、造句…"
              className="w-full text-sm bg-transparent border-0 border-b-2 border-dashed border-amber-900/25 dark:border-amber-100/20 focus:outline-none focus:border-rose-400 leading-loose resize-none px-1"
            />
          </section>

          <div className="flex justify-between gap-3 pb-4">
            {prev ? (
              <Link
                href={`/languages/${lang}/${prev.id}`}
                className="hand-note text-sm text-slate-500 hover:text-rose-600 paper book-page rounded-lg px-4 py-2.5"
              >
                ← 上一页
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/languages/${lang}/${next.id}`}
                className="text-sm text-slate-500 hover:text-rose-600 bg-card border border-border rounded-xl px-4 py-2.5 text-right"
              >
                {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>

        {/* 右列：AI 面板（语言版：无代码实操，模拟面试→场景模拟） */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-[620px] lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]">
          <div className="flex border-b border-border shrink-0">
            {tabBtn("tutor", "💬 AI 导师")}
            {tabBtn("quiz", "📝 练习测验")}
            {tabBtn("roleplay", "🎭 场景模拟")}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!unlocked ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3" aria-hidden="true">
                  🔒
                </div>
                <p className="text-sm font-medium text-slate-700">AI 功能未解锁</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  本节需要先通过上一节的「练习测验」与「场景对话」
                  <br />
                  （各 {PASS_SCORE} 分以上）才能解锁这里的 AI 导师、测验与场景模拟。
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  左侧的知识点与例句可自由预习。
                </p>
                <Link
                  href={`/languages/${lang}`}
                  className="inline-block mt-4 text-sm font-medium text-rose-600 hover:underline"
                >
                  ← 返回课程大纲
                </Link>
              </div>
            ) : (
              <>
                {tab === "tutor" && (
                  <ChatPanel lang={lang} langName={course.name} lesson={lesson} />
                )}
                {tab === "quiz" && (
                  <QuizTab lang={lang} lesson={lesson} onGateChange={refreshGate} />
                )}
                {tab === "roleplay" && (
                  <LanguageRoleplay lang={lang} lesson={lesson} onGateChange={refreshGate} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
