import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getNotebook, saveNotebook } from "@/lib/store";
import type {
  FavoriteItem,
  Notebook,
  WrongQuestionItem,
} from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json(await getNotebook(user.id));
}

function hashId(...parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 12);
}

type Ops =
  | { type: "addWrong"; item: Partial<WrongQuestionItem> & { lessonId: string; lang: string; source: "quiz" | "interview"; kind: string; question: string } }
  | { type: "removeWrong"; id: string }
  | { type: "toggleResolved"; id: string }
  | { type: "addFavorite"; item: { lessonId: string; lang: string; kind: string; title: string; content?: string } }
  | { type: "removeFavorite"; id: string }
  | { type: "saveNote"; lessonId: string; lang: string; content: string }
  | { type: "removeNote"; lessonId: string };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let op: Ops;
  try {
    op = (await req.json()) as Ops;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const nb: Notebook = await getNotebook(user.id);
  const out: Record<string, unknown> = { ok: true };

  switch (op.type) {
    case "addWrong": {
      if (!op.item.question?.trim()) {
        return NextResponse.json({ error: "缺少题目内容" }, { status: 400 });
      }
      const id = hashId(op.item.source, op.item.kind, op.item.question);
      const existing = nb.wrongQuestions.find((w) => w.id === id);
      if (existing) {
        // 重复错题：重置为未掌握并更新最近一次作答
        existing.resolved = false;
        existing.userAnswer = op.item.userAnswer ?? existing.userAnswer;
      } else {
        nb.wrongQuestions.unshift({
          id,
          lessonId: op.item.lessonId,
          lang: op.item.lang,
          source: op.item.source,
          kind: (op.item.kind as WrongQuestionItem["kind"]) ?? "choice",
          question: op.item.question,
          options: op.item.options,
          answerIndex: op.item.answerIndex,
          explanation: op.item.explanation,
          idealAnswer: op.item.idealAnswer,
          userAnswer: op.item.userAnswer,
          addedAt: new Date().toISOString(),
          resolved: false,
        });
        // 上限保护：最多保留 500 条
        if (nb.wrongQuestions.length > 500) nb.wrongQuestions.length = 500;
      }
      break;
    }
    case "removeWrong":
      nb.wrongQuestions = nb.wrongQuestions.filter((w) => w.id !== op.id);
      break;
    case "toggleResolved": {
      const w = nb.wrongQuestions.find((x) => x.id === op.id);
      if (w) w.resolved = !w.resolved;
      break;
    }
    case "addFavorite": {
      if (!op.item.title?.trim()) {
        return NextResponse.json({ error: "缺少收藏内容" }, { status: 400 });
      }
      const id = hashId(op.item.kind, op.item.lessonId, op.item.title);
      const exists = nb.favorites.some((f) => f.id === id);
      if (exists) {
        nb.favorites = nb.favorites.filter((f) => f.id !== id);
        out.added = false; // 已收藏过 → 本次为取消
      } else {
        nb.favorites.unshift({
          id,
          lessonId: op.item.lessonId,
          lang: op.item.lang,
          kind: op.item.kind as FavoriteItem["kind"],
          title: op.item.title,
          content: op.item.content,
          addedAt: new Date().toISOString(),
        });
        out.added = true;
      }
      break;
    }
    case "removeFavorite":
      nb.favorites = nb.favorites.filter((f) => f.id !== op.id);
      break;
    case "saveNote": {
      const content = op.content ?? "";
      if (!content.trim()) {
        delete nb.notes[op.lessonId];
      } else {
        nb.notes[op.lessonId] = {
          lessonId: op.lessonId,
          lang: op.lang,
          content,
          updatedAt: new Date().toISOString(),
        };
      }
      break;
    }
    case "removeNote":
      delete nb.notes[op.lessonId];
      break;
    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  await saveNotebook(user.id, nb);
  return NextResponse.json(out);
}
