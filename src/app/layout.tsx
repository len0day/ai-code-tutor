import type { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import Nav from "@/components/Nav";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

export const metadata: Metadata = {
  title: "CodeTutor AI · 编程·运维·外语学习",
  description:
    "用 AI 导师快速学习 Python / Java / JavaScript / TypeScript / HTML / Docker / Linux / 日语：内置从入门到进阶课程，AI 对话辅导、练习测验、代码实操、模拟面试与个性化学习路径。",
};

// 首屏渲染前应用主题，避免深色模式下白屏闪烁
const themeInitScript = `(function(){try{var t=localStorage.getItem('ct-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          跳到主内容
        </a>
        <Suspense fallback={<header className="h-14 border-b border-border" />}>
          <Nav />
        </Suspense>
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className="flex-1 w-full max-w-6xl mx-auto px-3.5 py-5 sm:px-4 sm:py-8 focus:outline-none"
        >
          {children}
        </main>
        <footer className="border-t border-border py-6 text-center text-sm text-slate-400">
          CodeTutor AI · 本地运行 · 数据保存在本机 data/ 目录
        </footer>
      </body>
    </html>
  );
}
