import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { findUserByName } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    const user = await findUserByName(username);
    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
    if (user.disabled) {
      return NextResponse.json({ error: "账号已被禁用，请联系管理员" }, { status: 403 });
    }
    if (!verifyPassword(password, user.salt, user.passwordHash)) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
