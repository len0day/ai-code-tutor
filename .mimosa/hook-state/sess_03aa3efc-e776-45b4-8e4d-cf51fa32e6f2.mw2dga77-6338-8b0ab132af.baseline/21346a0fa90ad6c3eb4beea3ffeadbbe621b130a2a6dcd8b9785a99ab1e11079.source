import { NextResponse } from "next/server";
import { getUsers } from "@/lib/store";

/** 是否已有账号（公开）：用于注册页提示"首个注册者为管理员" */
export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ hasUsers: users.length > 0 });
}
