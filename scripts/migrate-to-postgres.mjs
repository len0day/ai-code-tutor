#!/usr/bin/env node
/**
 * 数据迁移：SQLite → PostgreSQL
 *
 * 用法：
 *   DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/migrate-to-postgres.mjs
 *
 * 行为：读取本地 data/app.db 的全部表，逐表写入 PostgreSQL（幂等：已存在的行按主键跳过）。
 */

import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_FILE = path.join(__dirname, "..", "data", "app.db");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("请设置 DATABASE_URL，例如：");
  console.error("  DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/codetutor node scripts/migrate-to-postgres.mjs");
  process.exit(1);
}

/** 表 → 目标列（与 src/lib/db/index.ts 的 SCHEMA_STATEMENTS 保持一致） */
const TABLES = [
  ["users", ["id", "username", "password_hash", "salt", "role", "disabled", "created_at"]],
  ["user_progress", ["user_id", "lesson_id", "completed", "quiz_scores", "interview_scores", "wrong_question_ids", "visited_at", "completed_at"]],
  ["user_stats", ["user_id", "xp", "streak", "last_study_date"]],
  ["wrong_questions", ["id", "user_id", "payload", "resolved", "added_at"]],
  ["favorites", ["id", "user_id", "payload", "added_at"]],
  ["notes", ["user_id", "lesson_id", "lang", "content", "updated_at"]],
  ["memory_chats", ["user_id", "lesson_id", "messages", "updated_at"]],
  ["settings", ["key", "value"]],
  ["content_cache", ["cache_key", "task", "lang", "lesson_id", "content", "created_at"]],
  ["ai_usage", ["user_id", "date", "count"]],
  ["course_unlocks", ["user_id", "lang", "unlocked_at"]],
  ["app_config", ["key", "value"]],
  ["api_tokens", ["token_hash", "user_id", "label", "created_at", "last_used_at", "revoked"]],
  ["lesson_gates", ["user_id", "lesson_id", "quiz_passed", "interview_passed", "quiz_score", "interview_score", "attempts", "updated_at"]],
  ["token_usage", ["id", "user_id", "task", "model", "lang", "prompt_tokens", "completion_tokens", "total_tokens", "estimated", "created_at"]],
];

async function main() {
  const sqlite = new DatabaseSync(SQLITE_FILE, { readOnly: true });
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

  let total = 0;
  for (const [table, columns] of TABLES) {
    const exists = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    if (!exists) {
      console.log(`- ${table}: 源库不存在，跳过`);
      continue;
    }

    const rows = sqlite
      .prepare(`SELECT ${columns.join(", ")} FROM ${table}`)
      .all();

    if (rows.length === 0) {
      console.log(`- ${table}: 0 行`);
      continue;
    }

    // 按主键去重：已存在则跳过
    const pk =
      table === "users" || table === "user_stats" || table === "settings" || table === "app_config" || table === "content_cache"
        ? [columns[0]]
        : table === "user_progress"
          ? ["user_id", "lesson_id"]
          : table === "wrong_questions" || table === "favorites"
            ? ["user_id", columns[0]]
            : table === "notes" || table === "memory_chats"
              ? ["user_id", "lesson_id"]
              : table === "ai_usage"
                ? ["user_id", "date"]
                : table === "course_unlocks"
                  ? ["user_id", "lang"]
                  : table === "api_tokens"
                    ? ["token_hash"]
                    : table === "lesson_gates"
                      ? ["user_id", "lesson_id"]
                      : ["id"];

    const conflictCols = pk.join(", ");
    const placeholders = columns.map((c) => `$${c}`).join(", ");
    const conflictSet = columns
      .filter((c) => !pk.includes(c))
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");
    const sql = conflictSet
      ? `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
         ON CONFLICT (${conflictCols}) DO UPDATE SET ${conflictSet}`
      : `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
         ON CONFLICT (${conflictCols}) DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      const params = {};
      for (const c of columns) params[c] = row[c] ?? null;
      const res = await pool.query(sql, params);
      inserted += res.rowCount ?? 0;
    }
    total += inserted;
    console.log(`✓ ${table}: 迁移 ${inserted} 行`);
  }

  sqlite.close();
  await pool.end();
  console.log(`\n完成，共迁移 ${total} 行到 PostgreSQL。`);
  console.log("请在 .env.local 中设置 DATABASE_URL 后重启应用。");
}

main().catch((err) => {
  console.error("迁移失败：", err.message);
  process.exit(1);
});
