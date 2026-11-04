import "server-only";
import { getDb } from "./db";

/**
 * AI 内容缓存：讲解、测验题、面试题等生成结果入库复用。
 * 同一课程 + 同一任务命中缓存则不再调用大模型（force 时跳过读取并覆盖）。
 */

const MAX_ENTRIES = 300;

export function cacheKey(task: string, lang?: string, lessonId?: string): string {
  return `${task}:${lang ?? ""}:${lessonId ?? ""}`.slice(0, 120);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const row = await (await getDb()).get<{ content: string }>(
    "SELECT content FROM content_cache WHERE cache_key = $cacheKey",
    { cacheKey: key }
  );
  if (!row) return null;
  try {
    return JSON.parse(row.content) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  task: string,
  content: unknown,
  lang?: string,
  lessonId?: string
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO content_cache (cache_key, task, lang, lesson_id, content, created_at)
     VALUES ($cacheKey, $task, $lang, $lessonId, $content, $createdAt)
     ON CONFLICT (cache_key) DO UPDATE SET
       task = excluded.task,
       lang = excluded.lang,
       lesson_id = excluded.lesson_id,
       content = excluded.content,
       created_at = excluded.created_at`,
    {
      cacheKey: key,
      task,
      lang: lang ?? null,
      lessonId: lessonId ?? null,
      content: JSON.stringify(content),
      createdAt: new Date().toISOString(),
    }
  );

  // 超限则按时间淘汰最旧的
  const cnt = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM content_cache");
  if ((cnt?.c ?? 0) > MAX_ENTRIES) {
    const stale = await db.all<{ cache_key: string }>(
      "SELECT cache_key FROM content_cache ORDER BY created_at ASC LIMIT $limit",
      { limit: (cnt?.c ?? 0) - MAX_ENTRIES }
    );
    for (const s of stale) {
      await db.run("DELETE FROM content_cache WHERE cache_key = $cacheKey", {
        cacheKey: s.cache_key,
      });
    }
  }
}

export async function cacheStats(): Promise<{
  count: number;
  byTask: Record<string, number>;
}> {
  const rows = await (await getDb()).all<{ task: string; c: number }>(
    "SELECT task, COUNT(*) AS c FROM content_cache GROUP BY task"
  );
  const byTask: Record<string, number> = {};
  let count = 0;
  for (const r of rows) {
    byTask[r.task] = r.c;
    count += r.c;
  }
  return { count, byTask };
}

export async function cacheClear(): Promise<void> {
  await (await getDb()).run("DELETE FROM content_cache");
}

/** 缓存条目明细（管理员查看用） */
export interface CacheEntry {
  cacheKey: string;
  task: string;
  lang: string | null;
  lessonId: string | null;
  content: string;
  createdAt: string;
  size: number;
}

export async function cacheList(limit = 200): Promise<CacheEntry[]> {
  const rows = await (await getDb()).all<{
    cache_key: string;
    task: string;
    lang: string | null;
    lesson_id: string | null;
    content: string;
    created_at: string;
  }>(
    "SELECT cache_key, task, lang, lesson_id, content, created_at FROM content_cache ORDER BY created_at DESC LIMIT $limit",
    { limit }
  );
  return rows.map((r) => {
    let size = r.content.length;
    try {
      const parsed = JSON.parse(r.content);
      size = typeof parsed === "string" ? parsed.length : r.content.length;
    } catch {
      /* 保持原长度 */
    }
    return {
      cacheKey: r.cache_key,
      task: r.task,
      lang: r.lang,
      lessonId: r.lesson_id,
      content: r.content,
      createdAt: r.created_at,
      size,
    };
  });
}

/** 取单条缓存内容（管理员预览） */
export async function cacheContent(cacheKey: string): Promise<CacheEntry | null> {
  const row = await (await getDb()).get<{
    cache_key: string;
    task: string;
    lang: string | null;
    lesson_id: string | null;
    content: string;
    created_at: string;
  }>(
    "SELECT cache_key, task, lang, lesson_id, content, created_at FROM content_cache WHERE cache_key = $cacheKey",
    { cacheKey }
  );
  if (!row) return null;

  // content 以 JSON 存储：字符串内容解出来是纯文本，对象内容保留 JSON 字符串
  let text = row.content;
  try {
    const parsed = JSON.parse(row.content);
    text = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    /* 本身就是纯文本 */
  }

  return {
    cacheKey: row.cache_key,
    task: row.task,
    lang: row.lang,
    lessonId: row.lesson_id,
    content: text,
    createdAt: row.created_at,
    size: text.length,
  };
}
