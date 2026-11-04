import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Db, DbParams } from "./index";
import { SCHEMA_STATEMENTS } from "./index";
import type { SQLInputValue } from "node:sqlite";

/** node:sqlite 具名参数只接受 string/number/bigint/Uint8Array/null */
function toSqliteParams(params: DbParams): Record<string, SQLInputValue> {
  const out: Record<string, SQLInputValue> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === "boolean") out[k] = v ? 1 : 0;
    else out[k] = v as SQLInputValue;
  }
  return out;
}

/**
 * SQLite 实现（默认，零配置）：Node 22 内置 node:sqlite。
 * SQL 使用 `$name` 具名占位符 —— SQLite 原生支持，对象绑定，无需任何改写。
 */
export async function createSqliteDb(): Promise<Db> {
  const dataDir = path.join(process.cwd(), "data");
  const file = path.join(dataDir, "app.db");
  fs.mkdirSync(dataDir, { recursive: true });

  const raw = new DatabaseSync(file);
  raw.prepare("PRAGMA journal_mode = WAL").run();
  for (const sql of SCHEMA_STATEMENTS) raw.prepare(sql).run();

  return {
    kind: "sqlite",
    async runRaw(sql: string): Promise<void> {
      raw.prepare(sql).run();
    },
    async all<T>(sql: string, params: DbParams = {}): Promise<T[]> {
      const stmt = raw.prepare(sql);
      return (
        Object.keys(params).length ? stmt.all(toSqliteParams(params)) : stmt.all()
      ) as T[];
    },
    async get<T>(sql: string, params: DbParams = {}): Promise<T | null> {
      const stmt = raw.prepare(sql);
      const row = Object.keys(params).length
        ? stmt.get(toSqliteParams(params))
        : stmt.get();
      return (row as T) ?? null;
    },
    async run(sql: string, params: DbParams = {}): Promise<void> {
      const stmt = raw.prepare(sql);
      if (Object.keys(params).length) stmt.run(toSqliteParams(params));
      else stmt.run();
    },
    async tx<T>(fn: () => Promise<T>): Promise<T> {
      raw.prepare("BEGIN").run();
      try {
        const result = await fn();
        raw.prepare("COMMIT").run();
        return result;
      } catch (e) {
        raw.prepare("ROLLBACK").run();
        throw e;
      }
    },
  };
}
