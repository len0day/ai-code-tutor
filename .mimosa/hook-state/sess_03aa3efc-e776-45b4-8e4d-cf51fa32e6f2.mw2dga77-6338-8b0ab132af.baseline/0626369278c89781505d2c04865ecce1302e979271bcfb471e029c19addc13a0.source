import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS 支持：让独立部署的前端（小程序 / React Native / 独立 Web）跨域调用 API。
 * 允许来源通过环境变量 CORS_ORIGINS 配置（逗号分隔），未配置时放行任意来源
 * （仅适合内网/自建部署；公网请显式配置白名单）。
 */
const ALLOWED = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function resolveOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED.length === 0) return origin; // 未配置：放行
  if (ALLOWED.includes("*")) return origin;
  return ALLOWED.includes(origin) ? origin : null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 仅处理 API 路由
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const origin = resolveOrigin(req);
  const res = NextResponse.next();

  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");

  // 预检请求直接返回
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
