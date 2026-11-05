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

// ---- 按标题分节（讲解拆页） ----

export interface MdSection {
  /** 小节锚点 id（与 Markdown 渲染一致） */
  id: string;
  title: string;
  /** 起始标题层级 */
  level: number;
  /** 本节 markdown（从标题行到下一同级标题之前） */
  md: string;
}

/**
 * 把长文按一/二级标题切成多节（用于把 AI 讲解拆成书的多页）。
 * 代码块内的 `#` 不会被误判；首标题前的引言并入第一节。
 * 标题 id 规则与 parseOutline / Markdown 渲染一致。
 */
export function splitMarkdownSections(markdown: string, scope = ""): MdSection[] {
  if (!markdown.trim()) return [];
  const lines = markdown.split("\n");
  const used = new Map<string, number>();

  interface Stop {
    level: number;
    title: string;
    id: string;
    line: number;
  }
  const stops: Stop[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,2})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const title = plainTitle(m[2]);
    if (!title) continue;
    stops.push({
      level: m[1].length,
      title,
      id: scopeId(scope, uniqueSlug(title, used)),
      line: i,
    });
  }

  if (stops.length === 0) return [];

  // 只按最顶层的标题分节：旧内容用 `# 一、`，新提示词用 `## 一、`
  // 取实际出现的最小层级，避免把小节也拆成页
  const minLevel = Math.min(...stops.map((s) => s.level));
  const topStops = stops.filter((s) => s.level === minLevel);

  const sections: MdSection[] = topStops.map((h, idx) => {
    const end = idx + 1 < topStops.length ? topStops[idx + 1].line : lines.length;
    return {
      id: h.id,
      title: h.title,
      level: h.level,
      md: lines.slice(h.line, end).join("\n").trim(),
    };
  });

  // 首个标题前的引言并入第一节
  const intro = lines.slice(0, topStops[0].line).join("\n").trim();
  if (intro) sections[0].md = `${intro}\n\n${sections[0].md}`;

  return sections;
}
