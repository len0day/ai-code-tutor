import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runCode } from "@/lib/runner";

/**
 * 运行用户提交的代码（本地沙箱）。
 * 返回 stdout / stderr 原文、退出码与耗时；出错时直接返回原始错误信息。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = (await req.json()) as { code?: string; lang?: string };
    const code = typeof body.code === "string" ? body.code : "";
    const lang = typeof body.lang === "string" ? body.lang : "";

    if (!code.trim()) {
      return NextResponse.json({ error: "请先输入要运行的代码" }, { status: 400 });
    }
    if (code.length > 100_000) {
      return NextResponse.json({ error: "代码过长（上限 100KB）" }, { status: 400 });
    }

    const result = await runCode(code, lang);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "执行失败" },
      { status: 500 }
    );
  }
}
