import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";

/**
 * API Token（用于移动端 / 小程序等无法携带 Cookie 的客户端）。
 * 明文仅在生成时返回一次，服务端只保存 sha256 摘要。
 */

export interface ApiTokenInfo {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 生成新 Token：返回明文（仅此一次）与元信息 */
export async function createApiToken(
  userId: string,
  label: string
): Promise<{ token: string; info: ApiTokenInfo }> {
  const token = `ct_${crypto.randomBytes(24).toString("hex")}`;
  const now = new Date().toISOString();
  await (await getDb()).run(
    `INSERT INTO api_tokens (token_hash, user_id, label, created_at, revoked)
     VALUES ($hash, $userId, $label, $createdAt, 0)`,
    { hash: hashToken(token), userId, label: label.slice(0, 40), createdAt: now }
  );
  return {
    token,
    info: {
      id: hashToken(token).slice(0, 12),
      label: label.slice(0, 40),
      createdAt: now,
      lastUsedAt: null,
      revoked: false,
    },
  };
}

/** 校验 Token，返回所属用户 id（无效返回 null） */
export async function verifyApiToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const db = await getDb();
  const row = await db.get<{ user_id: string }>(
    "SELECT user_id FROM api_tokens WHERE token_hash = $hash AND revoked = 0",
    { hash: hashToken(token) }
  );
  if (!row) return null;
  await db.run("UPDATE api_tokens SET last_used_at = $now WHERE token_hash = $hash", {
    now: new Date().toISOString(),
    hash: hashToken(token),
  });
  return row.user_id;
}

export async function listApiTokens(userId: string): Promise<ApiTokenInfo[]> {
  const rows = await (await getDb()).all<{
    token_hash: string;
    label: string;
    created_at: string;
    last_used_at: string | null;
    revoked: number;
  }>(
    `SELECT token_hash, label, created_at, last_used_at, revoked
     FROM api_tokens WHERE user_id = $userId ORDER BY created_at DESC`,
    { userId }
  );
  return rows.map((r) => ({
    id: r.token_hash.slice(0, 12),
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revoked: Boolean(r.revoked),
  }));
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.all<{ token_hash: string }>(
    "SELECT token_hash FROM api_tokens WHERE user_id = $userId AND token_hash LIKE $prefix",
    { userId, prefix: `${tokenId}%` }
  );
  for (const r of rows) {
    await db.run("UPDATE api_tokens SET revoked = 1 WHERE token_hash = $hash", {
      hash: r.token_hash,
    });
  }
  return rows.length > 0;
}

export async function revokeAllApiTokens(userId: string): Promise<void> {
  await (await getDb()).run(
    "UPDATE api_tokens SET revoked = 1 WHERE user_id = $userId",
    { userId }
  );
}
