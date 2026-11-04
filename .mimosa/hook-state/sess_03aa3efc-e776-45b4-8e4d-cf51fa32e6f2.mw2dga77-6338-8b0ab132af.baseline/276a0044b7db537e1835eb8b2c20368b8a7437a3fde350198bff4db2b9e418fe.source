import "server-only";
import crypto from "node:crypto";
import type { Notebook, Progress, Settings } from "./types";
import { getDb } from "./db";

/**
 * 数据访问层（SQLite / PostgreSQL 通用）。
 * 所有查询使用 `$name` 具名参数绑定，两端原生支持。
 */

// ---- 用户 ----
export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: "admin" | "user";
  disabled: boolean;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  role: string;
  disabled: number;
  created_at: string;
}

function toUser(r: UserRow): AppUser {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    salt: r.salt,
    role: r.role as AppUser["role"],
    disabled: Boolean(r.disabled),
    createdAt: r.created_at,
  };
}

export async function getUsers(): Promise<AppUser[]> {
  const rows = await (await getDb()).all<UserRow>(
    "SELECT id, username, password_hash, salt, role, disabled, created_at FROM users ORDER BY created_at"
  );
  return rows.map(toUser);
}

export async function saveUsers(users: AppUser[]): Promise<void> {
  const db = await getDb();
  await db.tx(async () => {
    await db.run("DELETE FROM users");
    for (const u of users) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, salt, role, disabled, created_at)
         VALUES ($id, $username, $passwordHash, $salt, $role, $disabled, $createdAt)
         ON CONFLICT (id) DO UPDATE SET
           username = excluded.username,
           password_hash = excluded.password_hash,
           salt = excluded.salt,
           role = excluded.role,
           disabled = excluded.disabled,
           created_at = excluded.created_at`,
        {
          id: u.id,
          username: u.username,
          passwordHash: u.passwordHash,
          salt: u.salt,
          role: u.role,
          disabled: u.disabled ? 1 : 0,
          createdAt: u.createdAt,
        }
      );
    }
  });
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const row = await (await getDb()).get<UserRow>(
    "SELECT id, username, password_hash, salt, role, disabled, created_at FROM users WHERE id = $id",
    { id }
  );
  return row ? toUser(row) : null;
}

export async function findUserByName(username: string): Promise<AppUser | null> {
  const row = await (await getDb()).get<UserRow>(
    "SELECT id, username, password_hash, salt, role, disabled, created_at FROM users WHERE lower(username) = lower($username)",
    { username: username.trim() }
  );
  return row ? toUser(row) : null;
}

export async function createUser(
  username: string,
  passwordHash: string,
  salt: string,
  role: "admin" | "user"
): Promise<AppUser> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await (await getDb()).run(
    `INSERT INTO users (id, username, password_hash, salt, role, disabled, created_at)
     VALUES ($id, $username, $passwordHash, $salt, $role, 0, $createdAt)`,
    { id, username: username.trim(), passwordHash, salt, role, createdAt: now }
  );
  return { id, username: username.trim(), passwordHash, salt, role, disabled: false, createdAt: now };
}

export async function deleteUserById(id: string): Promise<void> {
  const db = await getDb();
  await db.tx(async () => {
    await db.run("DELETE FROM users WHERE id = $id", { id });
    await db.run("DELETE FROM user_progress WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM user_stats WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM wrong_questions WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM favorites WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM notes WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM memory_chats WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM ai_usage WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM course_unlocks WHERE user_id = $userId", { userId: id });
    await db.run("DELETE FROM lesson_gates WHERE user_id = $userId", { userId: id });
  });
}

// ---- 学习进度 ----
export const DEFAULT_PROGRESS: Progress = { lessons: {}, xp: 0, streak: 0 };

interface ProgressRow {
  lesson_id: string;
  completed: number;
  quiz_scores: string;
  interview_scores: string;
  wrong_question_ids: string;
  visited_at: string | null;
  completed_at: string | null;
}

export async function getProgress(userId: string): Promise<Progress> {
  const db = await getDb();
  const rows = await db.all<ProgressRow>(
    `SELECT lesson_id, completed, quiz_scores, interview_scores, wrong_question_ids, visited_at, completed_at
     FROM user_progress WHERE user_id = $userId`,
    { userId }
  );
  const stat = await db.get<{ xp: number; streak: number; last_study_date: string | null }>(
    "SELECT xp, streak, last_study_date FROM user_stats WHERE user_id = $userId",
    { userId }
  );

  const lessons: Progress["lessons"] = {};
  for (const r of rows) {
    lessons[r.lesson_id] = {
      completed: Boolean(r.completed),
      quizScores: JSON.parse(r.quiz_scores || "[]") as number[],
      interviewScores: JSON.parse(r.interview_scores || "[]") as number[],
      wrongQuestionIds: JSON.parse(r.wrong_question_ids || "[]") as string[],
      visitedAt: r.visited_at ?? undefined,
      completedAt: r.completed_at ?? undefined,
    };
  }
  return {
    lessons,
    xp: stat?.xp ?? 0,
    streak: stat?.streak ?? 0,
    lastStudyDate: stat?.last_study_date ?? undefined,
  };
}

export async function saveProgress(userId: string, p: Progress): Promise<void> {
  const db = await getDb();
  await db.tx(async () => {
    await db.run("DELETE FROM user_progress WHERE user_id = $userId", { userId });
    for (const [lid, lp] of Object.entries(p.lessons)) {
      await db.run(
        `INSERT INTO user_progress
           (user_id, lesson_id, completed, quiz_scores, interview_scores, wrong_question_ids, visited_at, completed_at)
         VALUES ($userId, $lessonId, $completed, $quizScores, $interviewScores, $wrongIds, $visitedAt, $completedAt)`,
        {
          userId,
          lessonId: lid,
          completed: lp.completed ? 1 : 0,
          quizScores: JSON.stringify(lp.quizScores ?? []),
          interviewScores: JSON.stringify(lp.interviewScores ?? []),
          wrongIds: JSON.stringify(lp.wrongQuestionIds ?? []),
          visitedAt: lp.visitedAt ?? null,
          completedAt: lp.completedAt ?? null,
        }
      );
    }
    await db.run(
      `INSERT INTO user_stats (user_id, xp, streak, last_study_date)
       VALUES ($userId, $xp, $streak, $lastStudyDate)
       ON CONFLICT (user_id) DO UPDATE SET
         xp = excluded.xp,
         streak = excluded.streak,
         last_study_date = excluded.last_study_date`,
      {
        userId,
        xp: p.xp ?? 0,
        streak: p.streak ?? 0,
        lastStudyDate: p.lastStudyDate ?? null,
      }
    );
  });
}

// ---- 知识库 ----
export async function getNotebook(userId: string): Promise<Notebook> {
  const db = await getDb();
  const wrongRows = await db.all<{ payload: string }>(
    "SELECT payload FROM wrong_questions WHERE user_id = $userId ORDER BY added_at DESC",
    { userId }
  );
  const favRows = await db.all<{ payload: string }>(
    "SELECT payload FROM favorites WHERE user_id = $userId ORDER BY added_at DESC",
    { userId }
  );
  const noteRows = await db.all<{
    lesson_id: string;
    lang: string;
    content: string;
    updated_at: string;
  }>("SELECT lesson_id, lang, content, updated_at FROM notes WHERE user_id = $userId", {
    userId,
  });

  return {
    wrongQuestions: wrongRows.map((r) => JSON.parse(r.payload) as Notebook["wrongQuestions"][number]),
    favorites: favRows.map((r) => JSON.parse(r.payload) as Notebook["favorites"][number]),
    notes: Object.fromEntries(
      noteRows.map((r) => [
        r.lesson_id,
        { lessonId: r.lesson_id, lang: r.lang, content: r.content, updatedAt: r.updated_at },
      ])
    ),
  };
}

export async function saveNotebook(userId: string, n: Notebook): Promise<void> {
  const db = await getDb();
  await db.tx(async () => {
    await db.run("DELETE FROM wrong_questions WHERE user_id = $userId", { userId });
    await db.run("DELETE FROM favorites WHERE user_id = $userId", { userId });
    await db.run("DELETE FROM notes WHERE user_id = $userId", { userId });

    for (const w of n.wrongQuestions) {
      const { resolved, ...rest } = w;
      await db.run(
        `INSERT INTO wrong_questions (id, user_id, payload, resolved, added_at)
         VALUES ($id, $userId, $payload, $resolved, $addedAt)`,
        {
          id: w.id,
          userId,
          payload: JSON.stringify(rest),
          resolved: resolved ? 1 : 0,
          addedAt: w.addedAt,
        }
      );
    }
    for (const f of n.favorites) {
      await db.run(
        `INSERT INTO favorites (id, user_id, payload, added_at)
         VALUES ($id, $userId, $payload, $addedAt)`,
        { id: f.id, userId, payload: JSON.stringify(f), addedAt: f.addedAt }
      );
    }
    for (const [lid, note] of Object.entries(n.notes)) {
      await db.run(
        `INSERT INTO notes (user_id, lesson_id, lang, content, updated_at)
         VALUES ($userId, $lessonId, $lang, $content, $updatedAt)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET
           lang = excluded.lang,
           content = excluded.content,
           updated_at = excluded.updated_at`,
        {
          userId,
          lessonId: lid,
          lang: note.lang,
          content: note.content,
          updatedAt: note.updatedAt,
        }
      );
    }
  });
}

// ---- AI 全局设置 ----
export const DEFAULT_SETTINGS: Settings = {
  provider: "glm",
  apiKey: "",
  baseUrl: "",
  model: "",
  temperature: 0.7,
};

const SETTING_KEYS = ["provider", "apiKey", "baseUrl", "model", "temperature"] as const;

export async function getSettings(): Promise<Settings> {
  const rows = await (await getDb()).all<{ key: string; value: string }>(
    "SELECT key, value FROM settings"
  );
  const kv = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    provider: (kv.provider as Settings["provider"]) ?? DEFAULT_SETTINGS.provider,
    apiKey: kv.apiKey ?? "",
    baseUrl: kv.baseUrl ?? "",
    model: kv.model ?? "",
    temperature: Number(kv.temperature ?? DEFAULT_SETTINGS.temperature),
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  const db = await getDb();
  for (const k of SETTING_KEYS) {
    await db.run(
      `INSERT INTO settings (key, value) VALUES ($key, $value)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      { key: k, value: String(next[k]) }
    );
  }
  return next;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}

// ---- 应用配额配置 ----
export interface QuotaConfig {
  aiDailyLimit: number;
  courseLimit: number;
}

export const DEFAULT_QUOTA: QuotaConfig = { aiDailyLimit: 30, courseLimit: 2 };

export async function getQuotaConfig(): Promise<QuotaConfig> {
  const rows = await (await getDb()).all<{ key: string; value: string }>(
    "SELECT key, value FROM app_config WHERE key IN ('aiDailyLimit','courseLimit')"
  );
  const kv = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    aiDailyLimit: Math.max(0, Number(kv.aiDailyLimit ?? DEFAULT_QUOTA.aiDailyLimit)),
    courseLimit: Math.max(0, Number(kv.courseLimit ?? DEFAULT_QUOTA.courseLimit)),
  };
}

export async function setQuotaConfig(patch: Partial<QuotaConfig>): Promise<QuotaConfig> {
  const next = { ...(await getQuotaConfig()), ...patch };
  const db = await getDb();
  for (const [key, value] of Object.entries(next)) {
    await db.run(
      `INSERT INTO app_config (key, value) VALUES ($key, $value)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      { key, value: String(value) }
    );
  }
  return next;
}

// ---- AI 用量 ----
export async function getAiUsageToday(userId: string): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const row = await (await getDb()).get<{ count: number }>(
    "SELECT count FROM ai_usage WHERE user_id = $userId AND date = $date",
    { userId, date }
  );
  return row?.count ?? 0;
}

export async function incrAiUsage(userId: string): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const db = await getDb();
  await db.run(
    `INSERT INTO ai_usage (user_id, date, count) VALUES ($userId, $date, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET count = ai_usage.count + 1`,
    { userId, date }
  );
  return getAiUsageToday(userId);
}

// ---- 课程解锁 ----
export async function getUnlockedCourses(userId: string): Promise<string[]> {
  const rows = await (await getDb()).all<{ lang: string }>(
    "SELECT lang FROM course_unlocks WHERE user_id = $userId",
    { userId }
  );
  return rows.map((r) => r.lang);
}

export async function unlockCourse(userId: string, lang: string): Promise<boolean> {
  const exists = await (await getDb()).get(
    "SELECT 1 AS x FROM course_unlocks WHERE user_id = $userId AND lang = $lang",
    { userId, lang }
  );
  if (exists) return true;
  await (await getDb()).run(
    `INSERT INTO course_unlocks (user_id, lang, unlocked_at) VALUES ($userId, $lang, $now)`,
    { userId, lang, now: new Date().toISOString() }
  );
  return false;
}

export async function resetCourseUnlocks(userId: string): Promise<void> {
  await (await getDb()).run("DELETE FROM course_unlocks WHERE user_id = $userId", { userId });
}

/**
 * 进入课程前确保已解锁：未解锁且配额未满时自动解锁（占用名额）。
 * admin 传 Infinity 表示不受限。
 */
export async function ensureCourseUnlock(
  userId: string,
  lang: string,
  limit: number
): Promise<{ ok: boolean; limit: number }> {
  const exists = await (await getDb()).get(
    "SELECT 1 AS x FROM course_unlocks WHERE user_id = $userId AND lang = $lang",
    { userId, lang }
  );
  if (exists) return { ok: true, limit };
  const cnt = await (await getDb()).get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM course_unlocks WHERE user_id = $userId",
    { userId }
  );
  if ((cnt?.c ?? 0) >= limit) return { ok: false, limit };
  await unlockCourse(userId, lang);
  return { ok: true, limit };
}

// ---- Token 用量统计 ----
export interface TokenUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
}

export interface TokenTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  estimatedCalls: number;
}

/** 记录一次 AI 调用的 token 用量 */
export async function recordTokenUsage(
  userId: string,
  task: string,
  model: string,
  usage: TokenUsageRecord,
  lang?: string
): Promise<void> {
  await (await getDb()).run(
    `INSERT INTO token_usage
       (id, user_id, task, model, lang, prompt_tokens, completion_tokens, total_tokens, estimated, created_at)
     VALUES ($id, $userId, $task, $model, $lang, $promptTokens, $completionTokens, $totalTokens, $estimated, $createdAt)`,
    {
      id: crypto.randomUUID(),
      userId,
      task,
      model,
      lang: lang ?? null,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimated: usage.estimated ? 1 : 0,
      createdAt: new Date().toISOString(),
    }
  );
}

/** 汇总 token 用量（不传 userId 则统计全体） */
export async function getTokenTotals(
  userId?: string,
  since?: string
): Promise<TokenTotals> {
  const from = since ?? "1970-01-01";
  const row = userId
    ? await (await getDb()).get<{
        p: number;
        c: number;
        t: number;
        calls: number;
        est: number;
      }>(
        `SELECT COALESCE(SUM(prompt_tokens),0) AS p, COALESCE(SUM(completion_tokens),0) AS c,
                COALESCE(SUM(total_tokens),0) AS t, COUNT(*) AS calls,
                COALESCE(SUM(estimated),0) AS est
         FROM token_usage WHERE user_id = $userId AND created_at >= $from`,
        { userId, from }
      )
    : await (await getDb()).get<{
        p: number;
        c: number;
        t: number;
        calls: number;
        est: number;
      }>(
        `SELECT COALESCE(SUM(prompt_tokens),0) AS p, COALESCE(SUM(completion_tokens),0) AS c,
                COALESCE(SUM(total_tokens),0) AS t, COUNT(*) AS calls,
                COALESCE(SUM(estimated),0) AS est
         FROM token_usage WHERE created_at >= $from`,
        { from }
      );
  return {
    promptTokens: row?.p ?? 0,
    completionTokens: row?.c ?? 0,
    totalTokens: row?.t ?? 0,
    calls: row?.calls ?? 0,
    estimatedCalls: row?.est ?? 0,
  };
}

/** 按任务维度聚合 token 用量 */
export async function getTokenByTask(
  userId?: string,
  since?: string
): Promise<Array<{ task: string; totalTokens: number; calls: number }>> {
  const from = since ?? "1970-01-01";
  const sql = userId
    ? `SELECT task, COALESCE(SUM(total_tokens),0) AS totalTokens, COUNT(*) AS calls
       FROM token_usage WHERE created_at >= $from AND user_id = $userId
       GROUP BY task ORDER BY totalTokens DESC`
    : `SELECT task, COALESCE(SUM(total_tokens),0) AS totalTokens, COUNT(*) AS calls
       FROM token_usage WHERE created_at >= $from
       GROUP BY task ORDER BY totalTokens DESC`;
  return (await getDb()).all(sql, userId ? { from, userId } : { from });
}

/** 按用户聚合 token 用量（管理员视图） */
export async function getTokenByUser(): Promise<
  Array<{ userId: string; username: string; totalTokens: number; calls: number }>
> {
  return (await getDb()).all(
    `SELECT t.user_id AS userId, COALESCE(u.username, '(已删除)') AS username,
            COALESCE(SUM(t.total_tokens),0) AS totalTokens, COUNT(t.id) AS calls
     FROM token_usage t
     LEFT JOIN users u ON u.id = t.user_id
     GROUP BY t.user_id, u.username
     ORDER BY totalTokens DESC`
  );
}

/** 最近若干条明细（管理员视图） */
export async function getRecentTokenUsage(limit = 20): Promise<
  Array<{
    username: string;
    task: string;
    model: string;
    totalTokens: number;
    estimated: number;
    createdAt: string;
  }>
> {
  return (await getDb()).all(
    `SELECT COALESCE(u.username, '(已删除)') AS username, t.task, t.model,
            t.total_tokens AS totalTokens, t.estimated, t.created_at AS createdAt
     FROM token_usage t
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT $limit`,
    { limit: Math.min(100, Math.max(1, limit)) }
  );
}

// ---- 工具 ----
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 连续学习天数：与上次学习日期比较，断签则重置 */
export function touchStreak(p: Progress): Progress {
  const t = today();
  if (p.lastStudyDate === t) return p;
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  p.streak = p.lastStudyDate === yesterday ? p.streak + 1 : 1;
  p.lastStudyDate = t;
  return p;
}
