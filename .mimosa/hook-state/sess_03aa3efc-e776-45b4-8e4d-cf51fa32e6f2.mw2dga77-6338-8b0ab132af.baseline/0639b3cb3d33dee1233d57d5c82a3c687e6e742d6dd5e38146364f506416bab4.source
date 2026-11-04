import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cacheGet, cacheKey } from "@/lib/cache";

/**
 * 读取已缓存的 AI 内容（讲解 / 试题）。
 * 已完成课程的讲解会长期保留在此，用户随时打开即可查看与朗读，无需再次调用 AI。
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const task = params.get("task") ?? "";
  const lang = params.get("lang") ?? undefined;
  const lessonId = params.get("lessonId") ?? undefined;
  if (!task) {
    return NextResponse.json({ error: "缺少 task 参数" }, { status: 400 });
  }

  const content = await cacheGet<unknown>(cacheKey(task, lang, lessonId));
  if (content === null) {
    return NextResponse.json({ cached: false, content: null });
  }
  return NextResponse.json({
    cached: true,
    content: typeof content === "string" ? content : content,
  });
}
