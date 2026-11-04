#!/usr/bin/env node
/**
 * 构建前检查：确保数据层 async 函数不会被「忘记 await」地使用。
 *
 * 背景：数据层函数从同步改为 async 后，若调用处漏写 await，
 * 拿到的是 Promise 对象 —— 表现为 `[object Promise]`、空对象或静默失效，
 * 且 TypeScript 无法拦截（Promise 与普通值比较/拼接都不报错）。
 *
 * 本脚本扫描 src/app 与 src/lib，列出所有「调用了已知 async 数据函数
 * 但结果未直接 await / void 消费」的写法，作为构建闸门。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = [path.join(ROOT, "src", "app"), path.join(ROOT, "src", "lib")];
const IGNORE_DIRS = new Set(["node_modules", ".next", "db"]);

/** 数据层中所有 async 函数（漏 await 会出问题的那些） */
const ASYNC_FNS = [
  "cacheGet", "cacheSet", "cacheStats", "cacheClear", "cacheList", "cacheContent",
  "getChat", "saveChat", "clearChat",
  "getProgress", "saveProgress", "getNotebook", "saveNotebook",
  "getSettings", "saveSettings", "getQuotaConfig", "setQuotaConfig",
  "getAiUsageToday", "incrAiUsage", "getUnlockedCourses", "unlockCourse",
  "ensureCourseUnlock", "resetCourseUnlocks",
  "getUsers", "saveUsers", "findUserById", "findUserByName", "createUser", "deleteUserById",
  "computeGates", "recordGateResult", "resetGate",
  "createApiToken", "listApiTokens", "verifyApiToken", "revokeApiToken", "revokeAllApiTokens",
  "recordTokenUsage", "getTokenTotals", "getTokenByTask", "getTokenByUser", "getRecentTokenUsage",
  "getDb",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const problems = [];
const files = SCAN_DIRS.flatMap((d) => walk(d));

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf-8").split("\n");

  lines.forEach((line, i) => {
    const code = line.trim();
    if (!code || code.startsWith("//") || code.startsWith("*")) return;
    // import 语句与类型声明不算调用
    if (/^import\s/.test(code) || /^export\s+(async\s+)?function/.test(code)) return;
    if (/^export\s+(const|type|interface)\s/.test(code)) return;

    for (const fn of ASYNC_FNS) {
      // 匹配 fn(...) 或 fn<...>(...)
      const re = new RegExp(`(?<![\\w.])${fn}\\s*(<[^>()]*>)?\\s*\\(`);
      const m = re.exec(code);
      if (!m) continue;

      // 已在 await / void / return 之后直接消费 → 合规
      if (/\bawait\s/.test(code)) continue;
      if (/\bvoid\s/.test(code)) continue;
      if (/^return\s/.test(code)) continue;
      // 被赋值给变量：变量名需以 $ 结尾或紧跟 await 才安全（本项目约定：直接 await）
      if (/^(const|let|var)\s+\w+\s*=/.test(code)) {
        problems.push({ rel, line: i + 1, fn, code });
      }
    }
  });
}

if (problems.length > 0) {
  console.error("\n❌ 检测到可能漏写 await 的数据层调用：\n");
  for (const p of problems) {
    console.error(`  ${p.rel}:${p.line}  ${p.fn}()`);
    console.error(`      ${p.code}`);
  }
  console.error(
    "\n提示：数据层函数为 async，调用结果必须 await 后使用，否则会得到 Promise 对象。\n"
  );
  process.exit(1);
}

console.log(`✅ await 检查通过（扫描 ${files.length} 个文件）`);
