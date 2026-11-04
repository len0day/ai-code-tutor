import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChat, saveChat, clearChat } from "@/lib/memory";
import type { ChatMessage } from "@/lib/types";

/** 导师对话记忆（当前登录用户）：GET ?lessonId= 读取历史；POST 保存/清空 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const lessonId = new URL(req.url).searchParams.get("lessonId") ?? "";
  if (!lessonId) return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });
  return NextResponse.json({ messages: await getChat(user.id, lessonId) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      type?: "save" | "clear";
      lessonId?: string;
      messages?: ChatMessage[];
    };
    if (!body.lessonId) {
      return NextResponse.json({ error: "缺少 lessonId" }, { status: 400 });
    }
    if (body.type === "clear") {
      await clearChat(user.id, body.lessonId);
      return NextResponse.json({ ok: true });
    }
    if (!Array.isArray(body.messages)) {
      return NextResponse.json({ error: "缺少 messages" }, { status: 400 });
    }
    await saveChat(user.id, body.lessonId, body.messages);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
