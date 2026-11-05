/**
 * Markdown 目录解析
 *
 * AI 生成的「深入讲解 / 语言精讲 / 面试讲解」都是长文，渲染时需要：
 *  1. 把 `## / ### / ####` 标题抽成一棵目录树（左侧可折叠目录）
 *  2. 给标题生成稳定的锚点 id，点击目录即可跳转
 *
 * 目录解析与 Markdown 渲染共用同一套 slug 规则（见 `remarkHeadingIds`），
 * 因此「目录项 → 页面标题」始终一一对应。
 */

export interface OutlineNode {
  /** 锚点 id（与 Markdown 渲染出的 heading id 一致） */
  id: string;
  /** 纯文本标题 */
  title: string;
  /** 标题层级：2 / 3 / 4 */
  level: number;
  children: OutlineNode[];
}

/** 需要生成锚点的标题层级（与 Markdown 渲染保持一致） */
const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

/** 去掉行内 markdown 标记，得到纯文本标题（与 mdast 取文本的方式一致） */
export function plainTitle(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1")
    .trim();
}

/** 标题 → 锚点基础名 */
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .trim()
    .replace(/[\s　]+/g, "-")
    .replace(/[^\p{L}\p{N}\-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "sec";
}

/** 同一文档内标题去重（重复标题追加序号） */
export function uniqueSlug(title: string, used: Map<string, number>): string {
  const base = slugify(title);
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/** 作用域前缀：同一页面多个 Markdown 区块时避免 id 冲突 */
export function scopeId(scope: string, id: string): string {
  return scope ? `${scope}-${id}` : id;
}

/**
 * 解析 markdown 中的标题，返回目录树。
 * 代码块（``` / ~~~）内的 `#` 不会被当作标题。
 */
export function parseOutline(markdown: string, scope = ""): OutlineNode[] {
  const used = new Map<string, number>();
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  let inFence = false;

  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;

    const level = m[1].length;
    const title = plainTitle(m[2]);
    if (!title) continue;

    const node: OutlineNode = {
      id: scopeId(scope, uniqueSlug(title, used)),
      title,
      level,
      children: [],
    };

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  return roots;
}

/** 目录树扁平化（用于高亮定位） */
export function flattenOutline(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
