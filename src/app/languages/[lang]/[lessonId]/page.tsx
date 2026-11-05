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
import ContentOutline from "@/components/ContentOutline";
import ChatPanel from "@/components/ChatPanel";
import QuizTab from "@/components/QuizTab";
import LanguageRoleplay from "@/components/LanguageRoleplay";
import ReasoningBlock from "@/components/ReasoningBlock";
import SpeakButton from "@/components/SpeakButton";
import LessonGateGuard, { GateBadge } from "@/components/LessonGateGuard";
import BookReader, { type BookSection } from "@/components/BookReader";
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

  const handleSaveNote = async () => {
    await saveNote(lessonId, lang, noteDraft);
    setNotebook(await fetchNotebook());
    setNoteSavedAt(
      new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    );
  };

  if (me === undefined) {
    return <p className="text-center text-slate-400 py-20">鉴权检查中…</p>;
  }
  if (me === null) return null;
  if (!course || !found) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到课程内容</p>
        <Link href="/languages" className="text-rose-600 mt-4 inline-block">
          返回增值包
        </Link>
      </div>
    );
  }

  const { lesson, level, index, total } = found;
  const flat = flatLessons(lang);
  const prev = index > 0 ? flat[index - 1].lesson : null;
  const next = index < total - 1 ? flat[index + 1].lesson : null;
  const gate = progress?.gates?.[lang]?.[lessonId];
  const passed = gate?.passed ?? false;
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

  /** 书的正文页 */
  const sections: BookSection[] = [
    {
      id: "points",
      label: "要点",
      icon: "✦",
      content: (
        <div className="space-y-2.5">
          {lesson.keyPoints.map((kp, i) => (
            <div key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs grid place-items-center font-bold mt-0.5">
                {i + 1}
              </span>
              <span>{kp}</span>
            </div>
          ))}
        </div>
      ),
    },
    ...(lesson.example
      ? [
          {
            id: "example",
            label: "例句",
            icon: "🗣",
            content: (
              <div>
                {lesson.example.note && (
                  <p className="hand-note text-sm mb-2">{lesson.example.note}</p>
                )}
                <div className="whitespace-pre-wrap text-sm leading-loose">
                  {lesson.example.code}
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <SpeakButton
                    id={`example-ja-${lesson.id}`}
                    text={lesson.example.code}
                    lang={lang}
                    part="foreign"
                    label="读日语"
                  />
                  <SpeakButton
                    id={`example-zh-${lesson.id}`}
                    text={lesson.example.code}
                    lang="zh"
                    part="translation"
                    label="读中文"
                  />
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      id: "teach",
      label: "精讲",
      icon: "👩‍🏫",
      content: (
        <div className="space-y-3">
          <p className="hand-note text-sm">
            由语言老师讲 语法要点 + 单词表 + 句子拆解 + 常见错误 + 随堂练习
          </p>
          {teachReasoning && (
            <ReasoningBlock reasoning={teachReasoning} thinking={teaching && !teach} />
          )}
          {teachError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
              {teachError}
            </p>
          )}
          {teach && (
            <>
              <div className="flex items-center gap-1.5">
                <SpeakButton
                  id={`teach-ja-${lesson.id}`}
                  text={teach}
                  lang={lang}
                  part="foreign"
                  label="读日语"
                />
                <SpeakButton
                  id={`teach-zh-${lesson.id}`}
                  text={teach}
                  lang="zh"
                  part="translation"
                  label="读中文"
                />
              </div>
              <ContentOutline markdown={teach} scope="teach">
                <Markdown content={teach} scope="teach" />
              </ContentOutline>
              {teaching && <span className="streaming-cursor" />}
            </>
          )}
          {!teach && !teaching && (
            <button
              onClick={() => runTeach(false)}
              disabled={teaching || !unlocked}
              title={
                unlocked
                  ? "语法点 + 单词表 + 例句拆解 + 随堂练习"
                  : "本课尚未解锁，通过上一课后可用"
              }
              className="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {teaching ? "生成中…" : "👩‍🏫 生成语言精讲"}
            </button>
          )}
          {!unlocked && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              🔒 本课未解锁，AI 精讲暂不可用（通过上一课后开放）
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 闯关守卫：未解锁 → 预览模式 */}
      <LessonGateGuard lang={lang} lessonId={lessonId} progress={progress} />

      {/* 页眉 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          <Link href="/languages" className="hover:text-rose-500 hand-note">
            🌸 语言学习增值包
          </Link>
          <span className="mx-2">/</span>
          <span className="serif-title">
            {course.name} · 第
            {["一", "二", "三", "四"][Number(level.id) - 1] ?? level.id}章
          </span>
          <span className="mx-2">/</span>
          <span className="text-slate-600">
            第 {index + 1} 页 / 共 {total} 页
          </span>
          <span className="ml-2">
            <GateBadge gate={gate} />
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

      {/* 书本阅读器 */}
      <BookReader
        lang={lang}
        courseName={course.name}
        courseEmoji={course.emoji}
        lessonId={lessonId}
        lessonTitle={lesson.title}
        levelName={`${level.name}（N${Number(level.id) * 2 - 2} 级参考）`}
        index={index}
        total={total}
        progress={progress}
        sections={sections}
      />

      {/* 翻页导航（上一页/下一页课程） */}
      <div className="flex justify-between gap-3 pb-4">
        {prev ? (
          <Link
            href={`/languages/${lang}/${prev.id}`}
            className="hand-note text-sm text-slate-500 hover:text-rose-600 paper book-page rounded-lg px-4 py-2.5"
          >
            ← 上一页：{prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/languages/${lang}/${next.id}`}
            className={`hand-note text-sm paper book-page rounded-lg px-4 py-2.5 ${
              passed
                ? "text-emerald-700 hover:text-emerald-800"
                : "text-slate-400 hover:text-rose-600"
            }`}
            title={passed ? "上一课已通关，可进入" : "需先通关本课"}
          >
            下一页：{next.title} {passed ? "→" : "🔒"}
          </Link>
        ) : (
          <span className="hand-note text-sm text-emerald-600 self-center">
            🎉 全书完 —— 恭喜读完《{course.name}》！
          </span>
        )}
      </div>

      {/* AI 工具区（书外）：导师 / 测验 / 场景模拟 */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabBtn("tutor", "💬 AI 导师")}
          {tabBtn("quiz", "📝 练习测验")}
          {tabBtn("roleplay", "🎭 场景模拟")}
        </div>
        <div className="min-h-[560px]">
          {tab === "tutor" && (
            <ChatPanel lang={lang} langName={course.name} lesson={lesson} />
          )}
          {tab === "quiz" && (
            <QuizTab lang={lang} lesson={lesson} onGateChange={refreshGate} />
          )}
          {tab === "roleplay" && (
            <LanguageRoleplay lang={lang} lesson={lesson} onGateChange={refreshGate} />
          )}
        </div>
      </section>
    </div>
  );
}
