import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, makeSalt } from "@/lib/auth";
import {
  deleteUserById,
  findUserById,
  getNotebook,
  getProgress,
  getUsers,
  resetCourseUnlocks,
  saveUsers,
} from "@/lib/store";
import { cacheStats } from "@/lib/cache";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }) };
  }
  return { user };
}

/** 用户列表 + 每人学习数据摘要 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const allUsers = await getUsers();
  const users = [];
  for (const u of allUsers) {
    let xp = 0;
    let completed = 0;
    let wrongCount = 0;
    try {
      const p = await getProgress(u.id);
      xp = p.xp;
      completed = Object.values(p.lessons).filter((l) => l.completed).length;
      const nb = await getNotebook(u.id);
      wrongCount = nb.wrongQuestions.filter((w) => !w.resolved).length;
    } catch {
      /* 无数据视为 0 */
    }
    users.push({
      id: u.id,
      username: u.username,
      role: u.role,
      disabled: u.disabled,
      createdAt: u.createdAt,
      xp,
      completed,
      wrongCount,
    });
  }

  const doneLessons = users.reduce((sum, u) => sum + u.completed, 0);
  const totalXp = users.reduce((s, u) => s + u.xp, 0);
  const totalWrong = users.reduce((s, u) => s + u.wrongCount, 0);
  const cache = await cacheStats();

  return NextResponse.json({
    users,
    stats: {
      userCount: users.length,
      adminCount: users.filter((u) => u.role === "admin").length,
      disabledCount: users.filter((u) => u.disabled).length,
      doneLessons,
      totalXp,
      totalWrong,
      cacheCount: cache.count,
    },
  });
}

type Ops =
  | { type: "setRole"; userId: string; role: "admin" | "user" }
  | { type: "setDisabled"; userId: string; disabled: boolean }
  | { type: "resetPassword"; userId: string; password: string }
  | { type: "resetCourses"; userId: string }
  | { type: "delete"; userId: string };

/** 用户管理操作（管理员）：改角色 / 禁用启用 / 重置密码 / 删除 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const admin = guard.user!;

  let op: Ops;
  try {
    op = (await req.json()) as Ops;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  if (!op.userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  const target = await findUserById(op.userId);
  if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  // 防误操作：管理员不能对自己降级/禁用/删除
  if (target.id === admin.id && (op.type === "setRole" || op.type === "setDisabled" || op.type === "delete")) {
    return NextResponse.json({ error: "不能对自己执行该操作" }, { status: 400 });
  }

  switch (op.type) {
    case "setRole": {
      if (op.role !== "admin" && op.role !== "user") {
        return NextResponse.json({ error: "非法角色" }, { status: 400 });
      }
      const users = await getUsers();
      const u = users.find((x) => x.id === target.id)!;
      u.role = op.role;
      await saveUsers(users);
      return NextResponse.json({ ok: true });
    }
    case "setDisabled": {
      const users = await getUsers();
      const u = users.find((x) => x.id === target.id)!;
      u.disabled = Boolean(op.disabled);
      await saveUsers(users);
      return NextResponse.json({ ok: true });
    }
    case "resetPassword": {
      if (typeof op.password !== "string" || op.password.length < 6 || op.password.length > 72) {
        return NextResponse.json({ error: "新密码需 6~72 位" }, { status: 400 });
      }
      const users = await getUsers();
      const u = users.find((x) => x.id === target.id)!;
      u.salt = makeSalt();
      u.passwordHash = hashPassword(op.password, u.salt);
      await saveUsers(users);
      return NextResponse.json({ ok: true });
    }
    case "resetCourses": {
      await resetCourseUnlocks(target.id);
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      await deleteUserById(target.id);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }
}
