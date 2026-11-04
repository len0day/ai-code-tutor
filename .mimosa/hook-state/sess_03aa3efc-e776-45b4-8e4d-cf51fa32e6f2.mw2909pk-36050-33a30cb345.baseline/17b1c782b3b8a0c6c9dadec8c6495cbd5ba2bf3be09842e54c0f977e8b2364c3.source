import { NextResponse } from "next/server";
import { getSettings, getProgress, getNotebook, getQuotaConfig, getAiUsageToday, incrAiUsage, ensureCourseUnlock, recordTokenUsage } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { chatComplete, aiError, type TokenUsage } from "@/lib/ai/provider";
import { buildSystemPrompt, TASK_TEMPERATURE, type TaskContext } from "@/lib/prompts";
import { findLesson, flatLessons, getCourse } from "@/data/courses";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";
import type { AiTask, ChatMessage, LangId } from "@/lib/types";

const STREAMING_TASKS: AiTask[] = [
  "tutor",
  "explain",
  "code-review",
  "interview-guide",
  "language-review",
  "language-teach",
];
/** 允许缓存复用的任务（key = task + lang + lessonId） */
const CACHEABLE_TASKS: AiTask[] = [
  "explain",
  "interview-guide",
  "quiz",
  "interview-questions",
  "language-teach",
];
const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

interface Body {
  task: AiTask;
  lang?: LangId;
  lessonId?: string;
  messages?: ChatMessage[];
  code?: string;
  questions?: unknown;
  answers?: unknown;
  /** 模拟面试：题目 / 作答 / 已答题列表 */
  question?: unknown;
  answer?: string;
  items?: unknown;
  /** true = 跳过缓存强制重新生成（结果仍会覆盖缓存） */
  force?: boolean;
}

/** 剥掉可能的 markdown 围栏，截取 JSON 主体 */
function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw aiError("AI 返回的不是有效 JSON");
  return JSON.parse(t.slice(start, end + 1));
}

function lessonContext(lang?: string, lessonId?: string): TaskContext {
  if (!lang || !lessonId) return {};
  const found = findLesson(lang, lessonId);
  if (!found) return {};
  return {
    lang,
    langName: getCourse(lang)?.name ?? lang,
    lesson: found.lesson,
  };
}

/** 学生画像（长期记忆）：进度 / 错题 / 笔记汇总，注入导师系统提示词 */
async function buildProfileSummary(userId: string): Promise<string> {
  const progress = await getProgress(userId);
  const notebook = await getNotebook(userId);
  const done = Object.entries(progress.lessons).filter(([, l]) => l.completed);
  const openWrong = notebook.wrongQuestions.filter((w) => !w.resolved);
  const noteCount = Object.keys(notebook.notes).length;

  const lines = [
    `- 累计 XP ${progress.xp}，连续学习 ${progress.streak} 天，已完成 ${done.length} 节课`,
    done.length
      ? `- 最近完成的课：${done.slice(-5).map(([id]) => id).join("、")}`
      : "- 尚未完成过任何课程（刚起步）",
    openWrong.length
      ? `- 有 ${openWrong.length} 道未掌握的错题，最近的如：${openWrong
          .slice(0, 3)
          .map((w) => `「${w.question.slice(0, 30)}」`)
          .join("、")}`
      : "- 暂无未掌握的错题",
    noteCount > 0 ? `- 在 ${noteCount} 节课写过学习笔记` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** 把文本切成小块按 SSE 回放（缓存命中时模拟流式体验） */
function replayAsStream(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: Record<string, string>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const CHUNK = 120;
      for (let i = 0; i < text.length; i += CHUNK) {
        send({ type: "content", text: text.slice(i, i + CHUNK) });
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const { task } = body;
  if (!task) return NextResponse.json({ error: "缺少 task 参数" }, { status: 400 });

  // AI 调用消耗配额，需要登录（内容缓存全体共享）
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const force = body.force === true;

  // 课程解锁校验：普通用户受课程数配额限制（首次调用自动占用名额）
  if (body.lang) {
    const limit =
      authUser.role === "admin"
        ? Number.MAX_SAFE_INTEGER
        : (await getQuotaConfig()).courseLimit;
    const unlock = await ensureCourseUnlock(authUser.id, body.lang, limit);
    if (!unlock.ok) {
      return NextResponse.json(
        {
          error: `学习课程数已达上限（${unlock.limit} 门）。可在「设置」查看已解锁课程，联系管理员扩容。`,
          courseLimitReached: true,
        },
        { status: 403 }
      );
    }
  }

  // 普通用户每日 AI 交互次数限制（缓存命中不占用配额）
  let quotaReached = false;
  let quotaLimit = 0;
  if (authUser.role !== "admin") {
    quotaLimit = (await getQuotaConfig()).aiDailyLimit;
    quotaReached = (await getAiUsageToday(authUser.id)) >= quotaLimit;
  }
  /** 成功调用后计入用量（缓存命中不计） */
  const countAi = () => {
    if (authUser.role !== "admin") {
      void incrAiUsage(authUser.id);
    }
  };
  const quotaGuard = () => {
    if (quotaReached) {
      return NextResponse.json(
        {
          error: `今日 AI 交互次数已达上限（${quotaLimit} 次），明天再来，或联系管理员调整配额`,
        },
        { status: 429 }
      );
    }
    return null;
  };
  /** 记录 token 用量（失败不入库） */
  const recordTokens = (
    userId: string,
    task: string,
    model: string,
    usage: TokenUsage,
    lang?: string
  ) => {
    try {
      void recordTokenUsage(userId, task, model, usage, lang);
    } catch {
      /* 统计失败不影响主流程 */
    }
  };

  const settings = await getSettings();
  const ctx = lessonContext(body.lang, body.lessonId);
  const temperature = TASK_TEMPERATURE[task] ?? settings.temperature ?? 0.7;

  try {
    // ---------- 缓存命中检查（内容类任务优先复用，不再调用大模型） ----------
    if (CACHEABLE_TASKS.includes(task) && !force && body.lang && body.lessonId) {
      const key = cacheKey(task, body.lang, body.lessonId);
      const cached = await cacheGet<unknown>(key);
      if (cached !== null) {
        if (STREAMING_TASKS.includes(task)) {
          // explain / interview-guide：把缓存的 markdown 分块回放
          return replayAsStream(typeof cached === "string" ? cached : String(cached));
        }
        return NextResponse.json({ ...(cached as object), cached: true });
      }
    }

    const system = buildSystemPrompt(task, ctx);

    // ---------- 流式任务：标准 SSE（data: {...} 事件帧） ----------
    if (STREAMING_TASKS.includes(task)) {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      let messages: ChatMessage[];
      if (task === "tutor") {
        const history = (body.messages ?? []).filter(
          (m) => m.role === "user" || m.role === "assistant"
        );
        if (history.length === 0) {
          return NextResponse.json({ error: "缺少对话内容" }, { status: 400 });
        }
        // 注入学生画像（长期记忆）
        const tutorSystem = buildSystemPrompt("tutor", {
          ...ctx,
          profile: await buildProfileSummary(authUser.id),
        });
        messages = [{ role: "system", content: tutorSystem }, ...history.slice(-20)];
      } else if (task === "code-review") {
        const code = body.code?.trim();
        if (!code) return NextResponse.json({ error: "请粘贴要审查的代码" }, { status: 400 });
        messages = [
          { role: "system", content: system },
          { role: "user", content: `请审查这段代码：\n\n\`\`\`\n${code}\n\`\`\`` },
        ];
      } else if (task === "language-teach") {
        // 语言精讲：语法 + 单词表 + 例句 + 随堂练习（带上本课要点，避免模型反问）
        const l = ctx.lesson;
        const brief = [
          `【本课课程信息】`,
          `课程名称：${l?.title ?? ""}`,
          `课程简介：${l?.summary ?? ""}`,
          `本课语法/知识点：${l?.keyPoints?.join("；") ?? ""}`,
          l?.example?.code ? `本课例句：\n${l.example.code}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        messages = [
          { role: "system", content: system },
          {
            role: "user",
            content: `${brief}\n\n请直接基于以上课程信息输出精讲正文，\n不要提问、不要确认、不要索要补充信息，\n直接从「## 一、核心语法点」开始写。`,
          },
        ];
      } else if (task === "language-review") {
        // 语言老师点评整段对话
        const dialog = typeof body.code === "string" ? body.code : "";
        if (!dialog.trim()) {
          return NextResponse.json({ error: "缺少对话内容" }, { status: 400 });
        }
        messages = [
          { role: "system", content: system },
          {
            role: "user",
            content: `【学生的场景对话记录】\n${dialog}\n\n请按要求点评。`,
          },
        ];
      } else {
        // explain / interview-guide：一次性生成
        messages = [
          { role: "system", content: system },
          { role: "user", content: task === "explain" ? "请开始深入讲解本课内容。" : "请开始整理本课的面试高频题。" },
        ];
      }

      const cacheK =
        body.lang && body.lessonId ? cacheKey(task, body.lang, body.lessonId) : null;
      let fullText = "";

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (obj: Record<string, string>) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          try {
            const result = await chatComplete(
              settings,
              messages,
              (content, reasoning) => {
                if (reasoning) send({ type: "reasoning", text: reasoning });
                if (content) {
                  fullText += content;
                  send({ type: "content", text: content });
                }
              },
              temperature
            );
            // 内容类任务生成成功 → 落盘缓存供以后复用（tutor/code-review 不缓存）
            if (cacheK && fullText && CACHEABLE_TASKS.includes(task)) {
              await cacheSet(cacheK, task, fullText, body.lang, body.lessonId);
            }
            countAi(); // 成功调用计入配额
            recordTokens(authUser.id, task, result.model, result.usage, body.lang);
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "AI 调用失败";
            // 流中途出错：把错误文本发给前端展示
            send({ type: "content", text: `\n\n⚠️ ${msg}` });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    // ---------- JSON 任务 ----------
    if (task === "quiz") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: "请按格式出题。" },
      ];
      const { text, model, usage } = await chatComplete(settings, messages, undefined, temperature);
      const data = extractJson(text) as { questions?: unknown };
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw aiError("AI 未生成有效题目，请重试");
      }
      if (body.lang && body.lessonId) {
        await cacheSet(cacheKey(task, body.lang, body.lessonId), task, data, body.lang, body.lessonId);
      }
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json(data);
    }

    if (task === "grade") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const user = `【题目与参考答案】\n${JSON.stringify(body.questions)}\n\n【学生作答】\n${JSON.stringify(body.answers)}`;
      const { text, model, usage } = await chatComplete(
        settings,
        [
          { role: "system", content: buildSystemPrompt("grade", ctx) },
          { role: "user", content: user },
        ],
        undefined,
        temperature
      );
      const data = extractJson(text) as { results?: unknown };
      if (!Array.isArray(data.results)) throw aiError("AI 批改结果格式异常，请重试");
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json(data);
    }

    if (task === "path") {
      const progress = await getProgress(authUser.id);
      const lang = body.lang;
      // 组装学习数据摘要
      const stats: Record<string, unknown> = {};
      for (const [lid, lp] of Object.entries(progress.lessons)) {
        const [l] = lid.split("-");
        stats[l] ??= { completed: 0, quizTaken: 0, avgScore: 0, wrong: 0 };
        const s = stats[l] as { completed: number; quizTaken: number; avgScore: number; wrong: number };
        if (lp.completed) s.completed++;
        if (lp.quizScores.length) {
          s.quizTaken++;
          s.avgScore = Math.round(lp.quizScores.reduce((a, b) => a + b, 0) / lp.quizScores.length);
        }
        s.wrong += lp.wrongQuestionIds.length;
      }

      // 候选课程：默认该语言未完成的课
      const candidates = lang
        ? flatLessons(lang)
            .filter((x) => !progress.lessons[x.lesson.id]?.completed)
            .slice(0, 30)
            .map((x) => `${x.lesson.id}: ${x.lesson.title}（${x.level.name}）`)
        : [];

      const user = [
        `【学习统计（按语言）】${JSON.stringify(stats)}`,
        `【累计 XP】${progress.xp}，连续学习 ${progress.streak} 天`,
        lang ? `【当前语言】${getCourse(lang)?.name}` : "",
        candidates.length ? `【候选课程】\n${candidates.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { text, model, usage } = await chatComplete(
        settings,
        [
          { role: "system", content: buildSystemPrompt("path", { lang, langName: lang ? getCourse(lang)?.name : undefined }) },
          { role: "user", content: user },
        ],
        undefined,
        temperature
      );
      const data = extractJson(text);
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json(data);
    }

    if (task === "interview-questions") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: "请按格式出 5 道面试题。" },
      ];
      const { text, model, usage } = await chatComplete(settings, messages, undefined, temperature);
      const data = extractJson(text) as { questions?: unknown };
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw aiError("AI 未生成有效面试题，请重试");
      }
      if (body.lang && body.lessonId) {
        await cacheSet(cacheKey(task, body.lang, body.lessonId), task, data, body.lang, body.lessonId);
      }
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json(data);
    }

    if (task === "interview-grade") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const q = body.question as { question?: string; referencePoints?: string[]; type?: string } | undefined;
      const answer = body.answer?.trim();
      if (!q?.question || !answer) {
        return NextResponse.json({ error: "缺少题目或作答内容" }, { status: 400 });
      }
      const user = `【面试题（${q.type ?? "concept"}）】${q.question}\n【参考要点】${JSON.stringify(q.referencePoints ?? [])}\n【候选人回答】\n${answer}`;
      const { text, model, usage } = await chatComplete(
        settings,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        undefined,
        temperature
      );
      const data = extractJson(text) as {
        score?: number;
        feedback?: string;
        idealAnswer?: string;
      };
      if (typeof data.score !== "number") throw aiError("AI 评分结果格式异常，请重试");
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json({
        score: Math.max(0, Math.min(100, Math.round(data.score))),
        pass: data.score >= 60,
        feedback: data.feedback ?? "",
        idealAnswer: data.idealAnswer ?? "",
      });
    }

    if (task === "interview-report") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "缺少答题记录" }, { status: 400 });
      }
      const avg = Math.round(
        (body.items as Array<{ score?: number }>).reduce((a, b) => a + (b.score ?? 0), 0) /
          (body.items as unknown[]).length
      );
      const user = `【整轮面试记录（题目/回答/你的评分）】\n${JSON.stringify(body.items)}\n\n【各题平均分】${avg}`;
      const { text, model, usage } = await chatComplete(
        settings,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        undefined,
        temperature
      );
      const data = extractJson(text) as {
        total?: number;
        level?: string;
        summary?: string;
        strengths?: string[];
        improvements?: string[];
        recommendation?: string;
      };
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json({
        total: typeof data.total === "number" ? data.total : avg,
        level: data.level ?? (avg >= 85 ? "优秀" : avg >= 70 ? "良好" : avg >= 60 ? "合格" : "需提升"),
        summary: data.summary ?? "",
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        recommendation: data.recommendation ?? "",
      });
    }

    if (task === "language-score") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const dialog = typeof body.code === "string" ? body.code : "";
      if (!dialog.trim()) {
        return NextResponse.json({ error: "缺少对话内容" }, { status: 400 });
      }
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        {
          role: "user",
          content: `【学生的场景对话记录】\n${dialog}\n\n请评分。`,
        },
      ];
      const { text, model, usage } = await chatComplete(settings, messages, undefined, temperature);
      const data = extractJson(text) as {
        score?: number;
        detail?: string;
        dimensions?: Record<string, number>;
      };
      if (typeof data.score !== "number") {
        throw aiError("AI 评分结果格式异常，请重试");
      }
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json({
        score: Math.max(0, Math.min(100, Math.round(data.score))),
        detail: data.detail ?? "",
        dimensions: data.dimensions ?? {},
      });
    }

    if (task === "language-scenario") {
      const blocked = quotaGuard();
      if (blocked) return blocked;
      const l = ctx.lesson;
      const brief = [
        `【本课课程信息】`,
        `课程名称：${l?.title ?? ""}`,
        `课程简介：${l?.summary ?? ""}`,
        `本课语法/知识点：${l?.keyPoints?.join("；") ?? ""}`,
      ]
        .filter(Boolean)
        .join("\n");
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        {
          role: "user",
          content: `${brief}\n\n请基于以上课程信息直接输出场景 JSON（至少 3 轮连续对话），\n不要提问、不要索要补充信息。`,
        },
      ];
      const { text, model, usage } = await chatComplete(settings, messages, undefined, temperature);
      const data = extractJson(text) as Record<string, unknown>;
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      if (!data.title || rounds.length === 0) {
        throw aiError("AI 未能生成有效场景，请重试");
      }
      // 归一化：确保每轮都有选项数组与 answerIndex
      const normalizedRounds = rounds.map((r) => {
        const round = r as {
          text?: string;
          translation?: string;
          options?: string[];
          answerIndex?: number;
          hint?: string;
          followUp?: string;
          followUpTranslation?: string;
          followUpOptions?: string[];
        };
        const options = Array.isArray(round.options) ? round.options : [];
        const answerIndex =
          typeof round.answerIndex === "number" &&
          round.answerIndex >= 0 &&
          round.answerIndex < options.length
            ? round.answerIndex
            : 0;
        return {
          ...round,
          text: round.text ?? "",
          translation: round.translation ?? "",
          options,
          answerIndex,
        };
      });
      countAi();
      recordTokens(authUser.id, task, model, usage, body.lang);
      return NextResponse.json({ ...data, rounds: normalizedRounds });
    }

    return NextResponse.json({ error: `未知任务: ${task}` }, { status: 400 });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: e.message ?? "AI 调用失败" },
      { status: e.status && e.status >= 400 && e.status < 600 ? e.status : 500 }
    );
  }
}
