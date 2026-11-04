import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  createSessionToken,
  hashPassword,
  makeSalt,
} from "@/lib/auth";
import {
  createUser,
  findUserByName,
  getUsers,
} from "@/lib/store";

/** 注册：首个注册用户自动成为管理员，并继承升级前的全局学习数据 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!/^[A-Za-z0-9_\u4e00-\u9fa5-]{2,20}$/.test(username)) {
      return NextResponse.json(
        { error: "用户名 2~20 位，可含中文、字母、数字、下划线和短横线" },
        { status: 400 }
      );
    }
    if (password.length < 6 || password.length > 72) {
      return NextResponse.json({ error: "密码需 6~72 位" }, { status: 400 });
    }
    const exists = await findUserByName(username);
    if (exists) {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
    }

    const users = await getUsers();
    const role = users.length === 0 ? "admin" : "user";
    const salt = makeSalt();
    const user = await createUser(username, hashPassword(password, salt), salt, role);
    // 旧 JSON 数据由 db.ts 首次初始化时统一迁移，无需在此处理

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
