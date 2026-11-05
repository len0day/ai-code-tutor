"use client";

import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/common";
import { plainTitle, scopeId, uniqueSlug } from "@/lib/outline";

function highlightCode(code: string, lang?: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightCode(code, lang), [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用则忽略 */
    }
  };

  return (
      <div className="my-3 rounded-xl overflow-hidden border border-[#1d2a45]">
      <div className="flex items-center justify-between bg-[#0b1224] px-4 py-1.5">
        <span className="text-xs text-slate-400 font-mono">{lang || "code"}</span>
        <button
          onClick={copy}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
      <pre className="!my-0 !rounded-none">
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}

/* ---------- 标题锚点：让「目录」可以跳转到正文 ---------- */

/** 取 mdast 节点的纯文本（与 outline.parseOutline 的标题规范化保持一致） */
function mdastText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as {
    type?: string;
    value?: string;
    children?: unknown[];
  };
  if (n.type === "text" || n.type === "inlineCode") return n.value ?? "";
  if (Array.isArray(n.children)) return n.children.map(mdastText).join("");
  return "";
}

/**
 * remark 插件：为 `#`~`####` 标题生成锚点 id。
 * id 规则与 `parseOutline` 完全一致 → 目录点击可精准定位。
 *
 * 用法：`[remarkHeadingIds, { scope }]`（unified 的插件 + 选项元组写法）
 */
export function remarkHeadingIds(options?: { scope?: string }) {
  const scope = options?.scope ?? "";
  return (tree: unknown) => {
    const used = new Map<string, number>();
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as {
        type?: string;
        depth?: number;
        children?: unknown[];
        data?: { hProperties?: Record<string, unknown> };
      };
      if (n.type === "heading" && typeof n.depth === "number") {
        const depth = n.depth;
        if (depth >= 1 && depth <= 4) {
          const title = plainTitle(mdastText(n));
          if (title) {
            n.data = n.data ?? {};
            n.data.hProperties = {
              ...(n.data.hProperties ?? {}),
              id: scopeId(scope, uniqueSlug(title, used)),
            };
          }
        }
      }
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * AI 输出 / 课程内容的 Markdown 渲染（代码块高亮 + 复制按钮 + 标题锚点）。
 * 代码块内容经 highlight.js 手动高亮，避免 rehype 与自定义组件的结构冲突。
 */
const Markdown = memo(function Markdown({
  content,
  scope = "",
}: {
  content: string;
  /** 作用域前缀：同页面多个 Markdown 区块时避免锚点冲突 */
  scope?: string;
}) {
  const remarkPlugins = useMemo(
    () =>
      [
        remarkGfm,
        [remarkHeadingIds, { scope }],
      ] as unknown as never[],
    [scope]
  );

  const heading = (Tag: "h1" | "h2" | "h3" | "h4") =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function Heading({ node, children, id: idProp }: any) {
      const id = (idProp ?? node?.properties?.id) as string | undefined;
      return (
        <Tag
          id={id}
          className="scroll-mt-24 group/head"
        >
          {children}
          {id && (
            <a
              href={`#${id}`}
              aria-label="复制本节链接"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard?.writeText(
                  `${window.location.origin}${window.location.pathname}#${id}`
                );
              }}
              className="ml-2 opacity-0 group-hover/head:opacity-40 hover:!opacity-90 text-slate-400 align-middle text-xs"
            >
              #
            </a>
          )}
        </Tag>
      );
    };

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          code({ className, children }) {
            const text = String(children).replace(/\n$/, "");
            const isBlock = text.includes("\n") || /language-|hljs/.test(className ?? "");
            if (isBlock) {
              const matched = className?.match(/language-(\w+)/);
              const lang = matched ? matched[1] : undefined;
              return <CodeBlock code={text} lang={lang} />;
            }
            return <code className={className}>{children}</code>;
          },
          pre({ children }) {
            // CodeBlock 已自带 <pre>，跳过默认包裹
            return <>{children}</>;
          },
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
          h4: heading("h4"),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
