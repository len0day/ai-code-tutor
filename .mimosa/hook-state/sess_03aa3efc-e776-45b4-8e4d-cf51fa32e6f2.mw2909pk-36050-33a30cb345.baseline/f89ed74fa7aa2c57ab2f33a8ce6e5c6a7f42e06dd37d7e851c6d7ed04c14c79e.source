import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { LeetCodeProblem } from "@/lib/types";

/**
 * LeetCode 题库代理：从 leetcode.cn（备用 leetcode.com）拉取题目列表。
 *
 * 安全约束（SSRF 防护）：目标 URL 为硬编码白名单域名，绝不接受用户传入的 URL；
 * 其余入参（tags/search/difficulty/limit）仅作为查询变量传递并做字符白名单校验。
 */
const ALLOWED_ENDPOINTS = [
  "https://leetcode.cn/graphql",
  "https://leetcode.com/graphql",
] as const;

const QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total
    questions {
      acRate
      difficulty
      frontendQuestionId
      title
      titleCn
      titleSlug
      topicTags { slug nameTranslated }
    }
  }
}`;

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[a-z0-9-]{1,40}$/.test(t))
    .slice(0, 5);
}

function sanitizeSearch(search: unknown): string {
  if (typeof search !== "string") return "";
  // 仅保留常见安全字符，防止注入与控制字符
  return search.replace(/[^\p{L}\p{N}\s'-]/gu, "").trim().slice(0, 60);
}

function sanitizeDifficulty(d: unknown): string | undefined {
  if (typeof d !== "string") return undefined;
  const up = d.trim().toUpperCase();
  return ["EASY", "MEDIUM", "HARD"].includes(up) ? up : undefined;
}

interface RawQuestion {
  acRate: number;
  difficulty: string;
  frontendQuestionId: string;
  title: string;
  titleCn: string | null;
  titleSlug: string;
  topicTags: Array<{ slug: string; nameTranslated: string | null }>;
}

function normalize(raw: RawQuestion[]): LeetCodeProblem[] {
  return raw.map((q) => {
    const diff = (q.difficulty || "").toUpperCase();
    return {
      frontendQuestionId: q.frontendQuestionId,
      title: q.title,
      titleCn: q.titleCn || q.title,
      titleSlug: q.titleSlug,
      difficulty: (diff.charAt(0) + diff.slice(1).toLowerCase()) as LeetCodeProblem["difficulty"],
      acRate: Math.round((q.acRate > 1 ? q.acRate : q.acRate * 100) * 10) / 10,
      tags: q.topicTags?.map((t) => t.slug) ?? [],
    };
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: {
    tags?: string[];
    search?: string;
    difficulty?: string;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const variables = {
    categorySlug: "all-code-essentials",
    limit: Math.min(50, Math.max(1, Number(body.limit) || 12)),
    skip: 0,
    filters: {
      ...(sanitizeTags(body.tags).length ? { tags: sanitizeTags(body.tags) } : {}),
      ...(sanitizeDifficulty(body.difficulty) ? { difficulty: sanitizeDifficulty(body.difficulty) } : {}),
      ...(sanitizeSearch(body.search) ? { searchKeywords: sanitizeSearch(body.search) } : {}),
    },
  };

  let lastError = "未知错误";
  for (const endpoint of ALLOWED_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: `${endpoint.replace("/graphql", "")}/problemset/`,
        },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        lastError = `${new URL(endpoint).host} 返回 ${res.status}`;
        continue;
      }
      const data = (await res.json()) as {
        data?: { problemsetQuestionList?: { total?: number; questions?: RawQuestion[] } };
        errors?: Array<{ message: string }>;
      };
      if (data.errors?.length) {
        lastError = `${new URL(endpoint).host}: ${data.errors[0].message}`;
        continue;
      }
      const list = data.data?.problemsetQuestionList;
      if (!list?.questions) {
        lastError = `${new URL(endpoint).host} 返回为空`;
        continue;
      }
      const problems = normalize(list.questions);
      return NextResponse.json({
        total: list.total ?? problems.length,
        problems,
        source: new URL(endpoint).host,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(
    { error: `LeetCode 题库暂不可达（${lastError}）` },
    { status: 502 }
  );
}
