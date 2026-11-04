import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createApiToken,
  listApiTokens,
  revokeAllApiTokens,
  revokeApiToken,
} from "@/lib/apiToken";

/**
 * API Token 管理（移动端 / 小程序接入用）。
 * Token 明文仅在创建时返回一次，服务端只保存摘要。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ tokens: await listApiTokens(user.id) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      action?: "create" | "revoke" | "revokeAll";
      label?: string;
      tokenId?: string;
    };
    if (body.action === "revokeAll") {
      await revokeAllApiTokens(user.id);
      return NextResponse.json({ ok: true, tokens: await listApiTokens(user.id) });
    }
    if (body.action === "revoke") {
      if (!body.tokenId) {
        return NextResponse.json({ error: "缺少 tokenId" }, { status: 400 });
      }
      await revokeApiToken(user.id, body.tokenId);
      return NextResponse.json({ ok: true, tokens: await listApiTokens(user.id) });
    }
    // 默认创建
    const label = body.label?.trim() || "移动端客户端";
    const { token, info } = await createApiToken(user.id, label);
    return NextResponse.json({
      ok: true,
      token, // ⚠️ 明文仅此一次返回
      info,
      tokens: await listApiTokens(user.id),
    });
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
