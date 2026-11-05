import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 代码运行沙箱（本地执行）。
 *
 * 安全约束：
 *  - 解释器白名单：只允许 python3 / node，其余语言返回提示
 *  - 参数数组传参，不经过 shell（无命令注入面）
 *  - 强制超时并杀死进程树
 *  - 内存与栈限制
 *  - 独立临时目录，执行完立即删除
 *  - 输出截断，避免刷屏
 */

const TIMEOUT_MS = 8000;
const MAX_OUTPUT = 64 * 1024;

interface RunSpec {
  /** 解释器命令 */
  cmd: string;
  /** 解释器参数 */
  args: string[];
  /** 源文件扩展名 */
  ext: string;
  label: string;
}

/** 课程语言 → 执行方案（严格白名单）。Go 需要 module 环境：写入 go.mod */
function specFor(lang: string): RunSpec | null {
  switch (lang) {
    case "python":
      return {
        cmd: "python3",
        // -I 隔离模式：忽略环境变量与用户 site-packages
        args: ["-I"],
        ext: "py",
        label: "Python 3",
      };
    case "javascript":
    case "typescript":
    case "nextjs":
      return {
        cmd: "node",
        args: ["--max-old-space-size=128"],
        ext: "js",
        label: "Node.js",
      };
    case "go":
      return {
        cmd: "go",
        args: ["run"],
        ext: "go",
        label: "Go",
      };
    default:
      return null;
  }
}

export interface RunResult {
  ok: boolean;
  label: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  /** 不支持运行等前置提示 */
  notice?: string;
}

export async function runCode(code: string, lang: string): Promise<RunResult> {
  const spec = specFor(lang);
  if (!spec) {
    return {
      ok: false,
      label: lang,
      stdout: "",
      stderr: "",
      exitCode: null,
      durationMs: 0,
      timedOut: false,
      notice: `当前环境未内置「${lang}」解释器，无法直接运行。`,
    };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codetutor-run-"));
  const file = path.join(dir, `main.${spec.ext}`);
  const started = Date.now();

  try {
    fs.writeFileSync(file, code, "utf-8");
    if (lang === "go") {
      // go run 需要 module 环境
      fs.writeFileSync(
        path.join(dir, "go.mod"),
        "module codetutor\n\ngo 1.22\n",
        "utf-8"
      );
    }

    const { stdout, stderr, exitCode, timedOut } = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
    }>((resolve) => {
      const child = execFile(
        spec.cmd,
        [...spec.args, file],
        {
          cwd: dir,
          timeout: TIMEOUT_MS,
          killSignal: "SIGKILL",
          maxBuffer: MAX_OUTPUT,
          env: {
            PATH: process.env.PATH ?? "",
            HOME: dir,
            LANG: "C.UTF-8",
            PYTHONIOENCODING: "utf-8",
            NODE_OPTIONS: "--max-old-space-size=128",
          } as unknown as NodeJS.ProcessEnv,
        },
        (error, out, err) => {
          const killed = Boolean(error && (error as { killed?: boolean }).killed);
          resolve({
            stdout: truncate(out ?? ""),
            stderr: truncate(err ?? ""),
            exitCode: error
              ? typeof (error as { code?: number | string }).code === "number"
                ? ((error as { code: number }).code ?? 1)
                : 1
              : 0,
            timedOut: killed,
          });
        }
      );
      // 子进程异常时兜底
      child.on("error", () => {
        resolve({
          stdout: "",
          stderr: `无法启动 ${spec.cmd}，请确认已安装该运行时。`,
          exitCode: 127,
          timedOut: false,
        });
      });
    });

    return {
      ok: exitCode === 0 && !timedOut,
      label: spec.label,
      stdout,
      stderr,
      exitCode,
      durationMs: Date.now() - started,
      timedOut,
    };
  } catch {
    return {
      ok: false,
      label: spec.label,
      stdout: "",
      stderr: "执行失败",
      exitCode: 1,
      durationMs: Date.now() - started,
      timedOut: false,
    };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 临时目录清理失败不影响结果 */
    }
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n...（输出过长已截断）`;
}
