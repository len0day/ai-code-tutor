import "server-only";
import { Pool, type PoolClient, type QueryConfigValues } from "pg";
import type { Db, DbParams } from "./index";

/** pg 具名参数对象类型（pg 自身定义，值可混合类型） */
function toPgParams(params: DbParams): QueryConfigValues<Record<string, never>> {
  return params as unknown as QueryConfigValues<Record<string, never>>;
}

/**
 * PostgreSQL 实现（生产推荐，DATABASE_URL 存在即启用）。
 * SQL 使用 `$name` 具名占位符 —— pg 原生支持，对象绑定，零字符串改写。
 */
export async function createPostgresDb(url: string): Promise<Db> {
  const pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // 云数据库需 SSL 时设 PGSSL=require；证书校验保持开启（自签证书请用 PGSSLROOTCERT 指定 CA）
    ...(process.env.PGSSL === "require" ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      return await fn(c);
    } finally {
      c.release();
    }
  }

  return {
    kind: "postgres",
    async runRaw(sql: string): Promise<void> {
      await withClient((c) => c.query(sql));
    },
    async all<T>(sql: string, params: DbParams = {}): Promise<T[]> {
      const res = await withClient((c) => c.query(sql, toPgParams(params)));
      return res.rows as T[];
    },
    async get<T>(sql: string, params: DbParams = {}): Promise<T | null> {
      const res = await withClient((c) => c.query(sql, toPgParams(params)));
      return (res.rows[0] as T) ?? null;
    },
    async run(sql: string, params: DbParams = {}): Promise<void> {
      await withClient((c) => c.query(sql, toPgParams(params)));
    },
    async tx<T>(fn: () => Promise<T>): Promise<T> {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await fn();
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
