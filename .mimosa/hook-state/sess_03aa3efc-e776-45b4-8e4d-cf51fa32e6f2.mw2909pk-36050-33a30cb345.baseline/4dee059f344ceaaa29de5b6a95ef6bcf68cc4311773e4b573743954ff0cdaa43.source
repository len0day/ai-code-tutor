import "server-only";
import type { ChatMessage } from "./types";
import { getDb } from "./db";

/**
 * 导师对话记忆：每节课的对话历史入库持久化，
 * 重启应用后 AI 导师依然记得之前聊过的内容。
 */

const MAX_MESSAGES_PER_CHAT = 60;
const MAX_CHATS = 200;

export async function getChat(userId: string, lessonId: string): Promise<ChatMessage[]> {
  const row = await (await getDb()).get<{ messages: string }>(
    "SELECT messages FROM memory_chats WHERE user_id = $userId AND lesson_id = $lessonId",
    { userId, lessonId }
  );
  if (!row?.messages) return [];
  try {
    const msgs = JSON.parse(row.messages) as ChatMessage[];
    return msgs.filter((m) => m.role === "user" || m.role === "assistant");
  } catch {
    return [];
  }
}

export async function saveChat(
  userId: string,
  lessonId: string,
  messages: ChatMessage[]
): Promise<void> {
  const db = await getDb();
  const trimmed = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_MESSAGES_PER_CHAT)
    .map((m) => ({ role: m.role, content: m.content }));

  const existing = await db.get(
    "SELECT 1 AS x FROM memory_chats WHERE user_id = $userId AND lesson_id = $lessonId",
    { userId, lessonId }
  );
  if (!existing) {
    // 聊天记录总课数上限，淘汰最旧的
    const cnt = await db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM memory_chats WHERE user_id = $userId",
      { userId }
    );
    if ((cnt?.c ?? 0) >= MAX_CHATS) {
      const oldest = await db.all<{ lesson_id: string }>(
        "SELECT lesson_id FROM memory_chats WHERE user_id = $userId ORDER BY updated_at ASC LIMIT $limit",
        { userId, limit: (cnt?.c ?? 0) - MAX_CHATS + 1 }
      );
      for (const o of oldest) {
        await db.run(
          "DELETE FROM memory_chats WHERE user_id = $userId AND lesson_id = $lessonId",
          { userId, lessonId: o.lesson_id }
        );
      }
    }
  }

  await db.run(
    `INSERT INTO memory_chats (user_id, lesson_id, messages, updated_at)
     VALUES ($userId, $lessonId, $messages, $updatedAt)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       messages = excluded.messages,
       updated_at = excluded.updated_at`,
    {
      userId,
      lessonId,
      messages: JSON.stringify(trimmed),
      updatedAt: new Date().toISOString(),
    }
  );
}

export async function clearChat(userId: string, lessonId: string): Promise<void> {
  await (await getDb()).run(
    "DELETE FROM memory_chats WHERE user_id = $userId AND lesson_id = $lessonId",
    { userId, lessonId }
  );
}
