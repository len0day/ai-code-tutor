import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * HackerRank 题库代理：读取官方练习区的挑战列表（非官方接口）。
 * 安全约束与 LeetCode 代理一致：目标 URL 硬编码白名单，
 * 入参仅 track（白名单枚举）/ search（清洗）/ limit（数值），杜绝 SSRF。
 */
const ENDPOINT = "https://www.hackerrank.com/rest/contests/master/tracks";

/** 可用的 track 白名单（来自官网 tracks 元数据） */
const TRACKS = new Set([
  "python",
  "java",
  "algorithms",
  "data-structures",
  "shell",
  "general-programming",
  "sql",
  "databases",
  "mathematics",
]);

interface HRModel {
  name: string;
  slug: string;
  difficulty_name?: string;
  success_ratio?: number;
  track?: { slug?: string };
}

function normalize(models: HRModel[]): Array<{
  id: string;
  title: string;
  url: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acRate: number | null;
  source: "hackerrank";
}> {
  return models
    .filter((m) => m.name && m.slug)
    .map((m) => {
      const d = (m.difficulty_name ?? "Easy").toLowerCase();
      const difficulty = (["easy", "medium", "hard"] as const).find((x) => x === d) ?? "Easy";
      const ratio = typeof m.success_ratio === "number" ? m.success_ratio : null;
      return {
        id: m.slug,
        title: m.name,
        url: `https://www.hackerrank.com/challenges/${m.slug}/problem`,
        difficulty: (difficulty.charAt(0).toUpperCase() + difficulty.slice(1)) as
          | "Easy"
          | "Medium"
          | "Hard",
        acRate: ratio === null ? null : Math.round(ratio * 1000) / 10,
        source: "hackerrank" as const,
      };
    });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { track?: string; search?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const track = (body.track ?? "").trim().toLowerCase();
  if (!TRACKS.has(track)) {
    return NextResponse.json({ error: "不支持的题库分类" }, { status: 400 });
  }
  const limit = Math.min(30, Math.max(1, Number(body.limit) || 12));
  const search =
    typeof body.search === "string"
      ? body.search.replace(/[^\p{L}\p{N}\s'-]/gu, "").trim().slice(0, 60)
      : "";

  try {
    const res = await fetch(`${ENDPOINT}/${track}/challenges?offset=0&limit=${limit * 3}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `HackerRank 返回 ${res.status}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { models?: HRModel[] };
    let problems = normalize(data.models ?? []);

    // 本地关键词过滤（接口不支持搜索参数）
    if (search) {
      const kw = search.toLowerCase();
      problems = problems.filter((p) => p.title.toLowerCase().includes(kw));
    }
    problems = problems.slice(0, limit);

    return NextResponse.json({ problems, source: "hackerrank.com", track });
  } catch (err) {
    return NextResponse.json(
      {
        error: `HackerRank 题库暂不可达（${err instanceof Error ? err.message : "未知错误"}）`,
      },
      { status: 502 }
    );
  }
}
