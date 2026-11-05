"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { findLesson, getCourse, flatLessons } from "@/data/courses";
import {
  availableBanks,
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
import CodeLab from "@/components/CodeLab";
import InterviewTab from "@/components/InterviewTab";
import ProblemBank from "@/components/ProblemBank";
import ReasoningBlock from "@/components/ReasoningBlock";
import SpeakButton from "@/components/SpeakButton";
import LessonGateGuard, { GateBadge } from "@/components/LessonGateGuard";
import BookReader, { type BookSection } from "@/components/BookReader";
import "../../../languages/book.css";
import { PASS_SCORE } from "@/lib/gateConstants";

type Tab = "tutor" | "quiz" | "review" | "interview";

/** 课程语言 → highlight.js 语言（示例代码高亮用） */
const HL_LANG: Record<string, string> = {
  docker: "dockerfile",
  linux: "bash",
};

export default function LessonPage() {
  const me = useRequireUser();
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-20">加载课程…</p>}>
      <LessonContent me={me} />
    </Suspense>
  );
}

function LessonContent({ me }: { me: ReturnType<typeof useRequireUser> }) {
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
  const [explain, setExplain] = useState("");
  const [explainReasoning, setExplainReasoning] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState("");
  /** 闯关：未解锁 → 预览模式，AI 功能禁用 */
  const [unlocked, setUnlocked] = useState(true);

  // 记录访问（异步回调中更新状态）
  useEffect(() => {
    if (findLesson(lang, lessonId)) {
      postProgress({ type: "visit", lessonId }).then(setProgress).catch(() => {});
    }
  }, [lang, lessonId]);

  // 检查本课解锁状态
  const refreshGate = () => {
    fetchProgress()
      .then((d) => {
        setProgress(d);
        setUnlocked(isLessonUnlocked(d, lang, lessonId));
      })
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    fetchProgress()
      .then((d) => {
        if (!alive) return;
        setProgress(d);
        setUnlocked(isLessonUnlocked(d, lang, lessonId));
      })
      .catch(() => {});
    // 取回已缓存的讲解（已完成课程的讲解长期保留，直接展示，不消耗 AI 调用）
    fetch(`/api/ai/cached?task=explain&lang=${lang}&lessonId=${lessonId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.cached && typeof d.content === "string") setExplain(d.content);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang, lessonId]);

  // 拉取知识库（收藏/笔记状态）
  useEffect(() => {
    fetchNotebook()
      .then((nb) => {
        setNotebook(nb);
        setNoteDraft(nb.notes[lessonId]?.content ?? "");
      })
      .catch(() => {});
  }, [lessonId]);

  // 切换课时清空讲解与完成提示（渲染期调整状态）
  const [prevKey, setPrevKey] = useState(lessonId);
  if (prevKey !== lessonId) {
    setPrevKey(lessonId);
    setExplain("");
    setExplainReasoning("");
    setExplaining(false);
    setExplainError("");
    setNoteSavedAt(null);
  }

  // 登录门禁：所有 Hooks 之后才能早退
  if (me === undefined) {
    return <p className="text-center text-slate-400 py-20">鉴权检查中…</p>;
  }
  if (me === null) return null;

  if (!course || !found) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到课程内容</p>
        <Link href="/" className="text-indigo-600 mt-4 inline-block">
          返回首页
        </Link>
      </div>
    );
  }

  // 语言类课程走增值包路径，避免两套页面重复
  if (course.kind === "language") {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">
          「{course.name}」属于语言学习增值包，请在对应页面学习。
        </p>
        <Link
          href={`/languages/${course.lang}/${lessonId}`}
          className="text-rose-600 mt-4 inline-block font-medium"
        >
          前往语言学习页 →
        </Link>
      </div>
    );
  }

  const { lesson, level, index, total } = found;
  const flat = flatLessons(lang);
  const prev = index > 0 ? flat[index - 1].lesson : null;
  const next = index < total - 1 ? flat[index + 1].lesson : null;
  // 完成状态由闯关系统判定（测验 + 面试双达标），不可手动标记
  const gate = progress?.gates?.[lang]?.[lessonId];
  const completed = gate?.passed ?? false;

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

  const isKeyPointFav = (kp: string) =>
    notebook?.favorites.some(
      (f) => f.kind === "keypoint" && f.lessonId === lessonId && f.title === kp
    );

  const toggleKeyPointFav = async (kp: string) => {
    await toggleFavorite({
      lessonId,
      lang,
      kind: "keypoint",
      title: kp,
      content: `《${lesson.title}》的知识点`,
    });
    setNotebook(await fetchNotebook());
  };

  const handleSaveNote = async () => {
    await saveNote(lessonId, lang, noteDraft);
    setNotebook(await fetchNotebook());
    setNoteSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  };

  const deepExplain = async (force = false) => {
    if (explaining) return;
    setExplain("");
    setExplainReasoning("");
    setExplainError("");
    setExplaining(true);
    try {
      await streamAi(
        { task: "explain", lang, lessonId, force },
        {
          onContent: (delta) => setExplain((prev) => prev + delta),
          onReasoning: (delta) => setExplainReasoning((prev) => prev + delta),
        }
      );
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : "讲解失败");
    } finally {
      setExplaining(false);
    }
  };

  /** 书的正文页：要点 / 示例代码 / 深入讲解 / 笔记 / 题库 */
  const sections: BookSection[] = [
    {
      id: "points",
      label: "要点",
      icon: "✦",
      content: (
        <div className="space-y-2.5">
          <p className="text-sm text-slate-500 leading-relaxed mb-3">
            {lesson.summary}
          </p>
          {lesson.keyPoints.map((kp, i) => {
            const fav = isKeyPointFav(kp);
            return (
              <div key={i} className="flex gap-2.5 text-sm leading-relaxed items-start">
                <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs grid place-items-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="flex-1">{kp}</span>
                <button
                  onClick={() => toggleKeyPointFav(kp)}
                  title={fav ? "取消收藏该知识点" : "收藏该知识点"}
                  className={`shrink-0 text-xs mt-0.5 transition-colors ${
                    fav ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                  }`}
                >
                  {fav ? "★" : "☆"}
                </button>
              </div>
            );
          })}
        </div>
      ),
    },
    ...(lesson.example
      ? [
          {
            id: "example",
            label: "示例",
            icon: "💻",
            content: (
              <div>
                {lesson.example.note && (
                  <p className="hand-note text-sm mb-2">{lesson.example.note}</p>
                )}
                <Markdown
                  content={`\`\`\`${HL_LANG[lang] ?? lang}\n${lesson.example.code}\n\`\`\``}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      id: "explain",
      label: "讲解",
      icon: "🤖",
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="hand-note text-sm">
              AI 用类比、更多例子和常见坑帮你吃透本课
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {explain && !explaining && (
                <SpeakButton
                  id={`explain-${lesson.id}`}
                  text={explain}
                  lang={lang}
                  compact
                />
              )}
              <button
                onClick={() => deepExplain(explain ? true : false)}
                disabled={explaining || !unlocked}
                title={
                  unlocked
                    ? explain
                      ? "已有讲解：点击可忽略缓存重新生成"
                      : "优先复用已有讲解，没有才调用 AI"
                    : "本课尚未解锁，通过上一课后可用"
                }
                className="text-xs btn-primary disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {explaining ? "讲解中…" : explain ? "重新生成" : "生成讲解"}
              </button>
            </div>
          </div>
          {!unlocked && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              🔒 本课未解锁，AI 深入讲解暂不可用（通过上一课后开放）
            </p>
          )}
          {(explainReasoning || explaining) && (
            <ReasoningBlock
              reasoning={explainReasoning}
              thinking={explaining && !explain}
            />
          )}
          {explainError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {explainError}
            </p>
          )}
          {explain && (
            <ContentOutline markdown={explain} scope="ex">
              <Markdown content={explain} scope="ex" />
            </ContentOutline>
          )}
          {explaining && explain && <span className="streaming-cursor" />}
          {!explain && !explaining && !explainError && !explainReasoning && unlocked && (
            <p className="text-sm text-slate-400">
              点击「生成讲解」，AI 会用类比、更多例子和常见坑帮你吃透本课。
            </p>
          )}
        </div>
      ),
    },
    {
      id: "notes",
      label: "笔记",
      icon: "📝",
      content: (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="hand-note text-sm">记录你的理解、易错点、心得…</span>
            <div className="flex items-center gap-2 shrink-0">
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
            rows={8}
            placeholder="像在书页边上写批注…（可在「知识库 → 笔记」查看全部）"
            className="w-full text-sm bg-transparent border-0 border-b-2 border-dashed border-amber-900/25 dark:border-amber-100/20 focus:outline-none focus:border-rose-400 leading-loose resize-none px-1"
          />
        </div>
      ),
    },
    ...(availableBanks(lang).length > 0
      ? [
          {
            id: "banks",
            label: "题库",
            icon: "🔗",
            content: (
              <ProblemBank
                lang={lang}
                lessonTitle={lesson.title}
                lessonSummary={lesson.summary}
                limit={5}
                title="🔗 在线题库实战"
              />
            ),
          },
        ]
      : []),
  ];

  const tabBtn = (id: Tab, label: string) => (    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        tab === id
          ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
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

      {/* 顶部导航 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          <Link href={`/learn/${lang}`} className="hover:text-slate-600">
            {course.emoji} {course.name}
          </Link>
          <span className="mx-2">/</span>
          <span>
            L{level.id} {level.name}
          </span>
          <span className="mx-2">/</span>
          <span className="text-slate-600">
            {index + 1} / {total}
          </span>
          <span className="ml-2">
            <GateBadge gate={progress?.gates?.[lang]?.[lessonId]} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLessonFav}
            title={lessonFav ? "取消收藏本课" : "收藏本课"}
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

      {completed && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
          <span>
            🎉 本课已通关！测验与面试/场景均已达标（
            {gate?.quizScore ?? 0} / {gate?.interviewScore ?? 0}），下一课已解锁。
          </span>
          {next && (
            <Link
              href={`/learn/${lang}/${next.id}`}
              className="font-medium underline shrink-0 ml-3"
            >
              下一课 →
            </Link>
          )}
        </div>
      )}

      <div className="space-y-6 book-stage">
        {/* 书本阅读器：双页对开（左目录 + 右正文），AI 面板在书下方 */}
        <BookReader
          lang={lang}
          courseName={course.name}
          courseEmoji={course.emoji}
          lessonId={lessonId}
          lessonTitle={lesson.title}
          levelName={`${level.name} · L${level.id}`}
          index={index}
          total={total}
          progress={progress}
          sections={sections}
        />

        {/* AI 工具区（书外）：导师 / 测验 / 代码实操 / 面试 */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {tabBtn("tutor", "💬 AI 导师")}
            {tabBtn("quiz", "📝 练习测验")}
            {tabBtn("review", "💻 代码实操")}
            {tabBtn("interview", "🎤 模拟面试")}
          </div>
          <div className="min-h-[560px]">
            {!unlocked ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3" aria-hidden="true">
                  🔒
                </div>
                <p className="text-sm font-medium text-slate-700">AI 功能未解锁</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  本节需要先通过上一节的「练习测验」与「模拟面试」
                  <br />
                  （各 {PASS_SCORE} 分以上）才能解锁这里的 AI 导师、测验与面试。
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  书中的知识点与例句可自由预习。
                </p>
                <Link
                  href={`/learn/${lang}`}
                  className="inline-block mt-4 text-sm font-medium text-indigo-600 hover:underline"
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
                {tab === "review" && <CodeLab lang={lang} lesson={lesson} />}
                {tab === "interview" && (
                  <InterviewTab lang={lang} lesson={lesson} onGateChange={refreshGate} />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* 上一课 / 下一课（书外翻页） */}
      <div className="flex justify-between gap-3 pb-4">
        {prev ? (
          <Link
            href={`/learn/${lang}/${prev.id}`}
            className="hand-note text-sm text-slate-500 hover:text-rose-600 paper book-page rounded-lg px-4 py-2.5"
          >
            ← 上一页：{prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/learn/${lang}/${next.id}`}
            className={`hand-note text-sm paper book-page rounded-lg px-4 py-2.5 ${
              completed
                ? "text-emerald-700 hover:text-emerald-800"
                : "text-slate-400 hover:text-rose-600"
            }`}
            title={completed ? "上一课已通关，可进入" : "需先通关本课"}
          >
            下一页：{next.title} {completed ? "→" : "🔒"}
          </Link>
        ) : (
          <span className="hand-note text-sm text-emerald-600 self-center">
            🎉 全书完 —— 恭喜读完《{course.name}》！
          </span>
        )}
      </div>
    </div>
  );
}
