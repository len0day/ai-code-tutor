import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cacheList, cacheContent } from "@/lib/cache";

/**
 * 内容缓存查看（管理员）：
 *  GET            → 缓存条目列表（讲解/试题等）
 *  GET ?key=xxx   → 单条缓存全文
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const key = new URL(req.url).searchParams.get("key");
  if (key) {
    const entry = await cacheContent(key);
    if (!entry) return NextResponse.json({ error: "缓存不存在" }, { status: 404 });
    return NextResponse.json(entry);
  }

  return NextResponse.json({ entries: await cacheList(300) });
}
