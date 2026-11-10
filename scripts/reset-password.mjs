#!/usr/bin/env node
/**
 * CodeTutor · 重置账号密码（忘记密码时在服务器上用）
 *
 * 用法：
 *   CT_NEW_PASSWORD='你的新密码' node scripts/reset-password.mjs admin
 *   node scripts/reset-password.mjs admin          # 交互输入（不回显）
 *
 * ⚠️ 新密码请通过环境变量传入或交互输入，不要写进脚本/仓库。
 * ⚠️ 密码只以 scrypt 哈希存库，忘记后无法找回，只能重置。
 * ⚠️ 重置不会踢掉已登录的会话（会话是无状态 HMAC 令牌），如需强制下线请同时停服务清 Cookie。
 *
 * 数据库：默认 SQLite（data/app.db）；设了 DATABASE_URL=postgres://... 则走 PostgreSQL。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const username = process.argv[2];
if (!username) {
  console.error("用法：node scripts/reset-password.mjs <用户名>");
  process.exit(1);
}

/** 与 src/lib/auth.ts 完全一致的方案：随机 16 字节盐 + scrypt 64 字节 */
function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function askHidden(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (str) => {
    if (str.includes(question)) write(str);
    else rl.output.write("*");
  };
  const answer = await rl.question(question);
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const password = process.env.CT_NEW_PASSWORD || (await askHidden(`为「${username}」设置新密码: `));
  if (!password || password.length < 6 || password.length > 72) {
    console.error("✗ 密码需 6~72 位");
    process.exit(1);
  }

  const salt = makeSalt();
  const hash = hashPassword(password, salt);
  const url = process.env.DATABASE_URL?.trim();

  if (url && /^postgres(ql)?:\/\//.test(url)) {
    // ---- PostgreSQL ----
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const r = await client.query("UPDATE users SET password_hash = $1, salt = $2 WHERE username = $3", [
      hash,
      salt,
      username,
    ]);
    await client.end();
    console.log(
      r.rowCount > 0 ? `✅ PostgreSQL：已重置「${username}」的密码` : `✗ PostgreSQL：没有名为「${username}」的账号`
    );
    process.exit(r.rowCount > 0 ? 0 : 1);
  }

  // ---- SQLite ----
  const { DatabaseSync } = await import("node:sqlite");
  const file = process.env.CT_DB_FILE || path.join(ROOT, "data", "app.db");
  if (!fs.existsSync(file)) {
    console.error(`✗ 找不到数据库：${file}`);
    process.exit(1);
  }
  const db = new DatabaseSync(file);
  const names = db.prepare("SELECT username, role FROM users ORDER BY created_at").all();
  const r = db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = ?").run(hash, salt, username);
  db.close();
  if (r.changes > 0) {
    console.log(`✅ SQLite：已重置「${username}」的密码`);
  } else {
    console.error(`✗ 没有名为「${username}」的账号。现有账号：`);
    for (const n of names) console.error(`    ${n.username}（${n.role}）`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("✗ 执行失败：", e?.message || e);
  process.exit(1);
});
