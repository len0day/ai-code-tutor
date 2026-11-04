import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** 当前登录用户（未登录返回 user: null，HTTP 200 便于客户端判断） */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user ? { id: user.id, username: user.username, role: user.role } : null,
  });
}
