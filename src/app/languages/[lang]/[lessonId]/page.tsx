"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import BookStage, { type BookPageDef } from "@/components/BookStage";
import ToolDrawer from "@/components/ToolDrawer";
import { splitMarkdownSections } from "@/lib/outline";
import { PASS_SCORE } from "@/lib/gateConstants";
import "../../book.css";

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

  // ---- 右侧工具抽屉（桌面端默认展开） ----
  const [drawerOpen, setDrawerOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
  );
  const [drawerTab, setDrawerTab] = useState("tutor");
  const openDrawer = (tab: string) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

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

  // ---- 精讲分节：按标题拆成书的多页（Hooks 必须在早退 return 之前） ----
  const teachSections = useMemo(
    () => (teach && !teaching ? splitMarkdownSections(teach, "teach") : []),
    [teach, teaching]
  );

  // 生成完成 → 自动跳到精讲第一节
  const wasTeaching = useRef(false);
  const [focusPageId, setFocusPageId] = useState<string | null>(null);
  useEffect(() => {
    if (wasTeaching.current && !teaching && teachSections.length > 1) {
      setFocusPageId(teachSections[0].id);
    }
    wasTeaching.current = teaching;
  }, [teaching, teachSections.length]);

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

  /** 锁定页占位 */
  const lockedPage = (
    <div className="p-6 text-center">
      <div className="text-4xl mb-3" aria-hidden="true">
        🔒
      </div>
      <p className="text-sm font-medium text-slate-700">此页未解锁</p>
      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
        需先通过上一节的「练习测验」与「场景对话」
        <br />（各 {PASS_SCORE} 分以上）。
      </p>
      <Link
        href={`/languages/${lang}`}
        className="inline-block mt-4 text-sm font-medium text-rose-600 hover:underline"
      >
        ← 返回课程目录
      </Link>
    </div>
  );

  /** 精讲主页（控制台：生成 / 朗读 / 重新生成 + 分节总览） */
  const teachHub = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="hand-note text-sm">
          语言老师讲 语法要点 + 单词表 + 句子拆解 + 常见错误 + 随堂练习
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {teach && !teaching && (
            <>
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
            </>
          )}
          <button
            onClick={() => runTeach(teach ? true : false)}
            disabled={teaching || !unlocked}
            title={
              unlocked
                ? teach
                  ? "已有精讲：点击可忽略缓存重新生成"
                  : "优先复用已有精讲，没有才调用 AI"
                : "本课尚未解锁，通过上一课后可用"
            }
            className="text-xs btn-primary disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {teaching ? "生成中…" : teach ? "重新生成" : "👩‍🏫 生成语言精讲"}
          </button>
        </div>
      </div>
      {!unlocked && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          🔒 本课未解锁，AI 精讲暂不可用（通过上一课后开放）
        </p>
      )}
      {(teachReasoning || teaching) && (
        <ReasoningBlock reasoning={teachReasoning} thinking={teaching && !teach} />
      )}
      {teachError && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
          {teachError}
        </p>
      )}
      {teaching && (
        <div>
          <Markdown content={teach} scope="teach" />
          <span className="streaming-cursor" />
        </div>
      )}
      {!teach && !teaching && !teachError && !teachReasoning && unlocked && (
        <p className="text-sm text-slate-400">
          点击「生成语言精讲」，老师按本课水平生成语法 + 单词 + 拆解 + 练习。
        </p>
      )}
      {teachSections.length > 0 && (
        <div className="mt-2 text-xs text-slate-500 bg-amber-900/5 dark:bg-amber-100/5 rounded-lg px-3 py-2.5">
          📑 本次精讲已按段落拆成 {teachSections.length} 页 ——
          在左侧目录「精讲」下方逐节阅读。
        </div>
      )}
    </div>
  );

  /** 书的正文页：要点 / 例句 / 精讲（+分节）/ 练习测验 / 场景对话 */
  const pages: BookPageDef[] = [
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
      content: teachHub,
      children:
        teachSections.length > 1
          ? teachSections.map((s) => ({
              id: s.id,
              label: s.title,
              content: (
                <div className="pr-1">
                  <Markdown content={s.md} scope="teach" />
                </div>
              ),
            }))
          : undefined,
    },
    {
      id: "quiz",
      label: "练习测验",
      icon: "📝",
      content: unlocked ? (
        <QuizTab lang={lang} lesson={lesson} onGateChange={refreshGate} />
      ) : (
        lockedPage
      ),
    },
    {
      id: "roleplay",
      label: "场景对话",
      icon: "🎭",
      content: unlocked ? (
        <LanguageRoleplay lang={lang} lesson={lesson} onGateChange={refreshGate} />
      ) : (
        lockedPage
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
            onClick={() => openDrawer("notes")}
            title="打开笔记（随时记录）"
            className={`text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
              noteDraft.trim()
                ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                : "border-border text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
            }`}
          >
            📝 笔记
          </button>
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

      {/* 全屏书本 */}
      <div className="book-stage space-y-6">
        <BookStage
          courseName={course.name}
          courseEmoji={course.emoji}
          lessonTitle={lesson.title}
          levelName={`${level.name}（N${Number(level.id) * 2 - 2} 级参考）`}
          index={index}
          total={total}
          pages={pages}
          focusPageId={focusPageId}
          headerRight={
            <button
              onClick={() => openDrawer("tutor")}
              title="打开 AI 导师"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-slate-500 hover:border-rose-300 hover:text-rose-600 transition-colors"
            >
              💬 导师
            </button>
          }
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
      </div>

      {/* 右侧工具抽屉：AI 导师 / 笔记 */}
      <ToolDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        tabs={[
          {
            id: "tutor",
            label: "AI 导师",
            icon: "💬",
            content: <ChatPanel lang={lang} langName={course.name} lesson={lesson} />,
          },
          {
            id: "notes",
            label: "笔记",
            icon: "📝",
            content: (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="hand-note text-sm">书页边的批注…</span>
                  <div className="flex items-center gap-2">
                    {noteSavedAt && (
                      <span className="text-xs text-emerald-600">✓ {noteSavedAt}</span>
                    )}
                    <button
                      onClick={handleSaveNote}
                      className="text-xs btn-primary text-white px-3 py-1.5 rounded-lg"
                    >
                      保存
                    </button>
                  </div>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={14}
                  placeholder="记录你的理解、易错点、心得…（可在「知识库 → 笔记」查看全部）"
                  className="w-full text-sm bg-transparent border-0 border-b-2 border-dashed border-amber-900/25 dark:border-amber-100/20 focus:outline-none focus:border-rose-400 leading-loose resize-none px-1"
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
