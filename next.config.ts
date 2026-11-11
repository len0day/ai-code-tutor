import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 公网通过 Cloudflare Tunnel 用 aiedutalk.online 访问本机 dev 服务时，
  // 允许该域名加载 Next 的开发资源（HMR / 静态资源）
  // localhost / 127.0.0.1 也要放行：否则 HMR WebSocket 被拦截，客户端会退化成
  // 定时整页重载，页面永远停在「加载中…」
  allowedDevOrigins: [
    "aiedutalk.online",
    "www.aiedutalk.online",
    "study.aiedutalk.online",
    "localhost",
    "127.0.0.1",
  ],
  // msedge-tts 依赖 ws/isomorphic-ws，避免打包器处理其 Node 专用路径
  serverExternalPackages: ["msedge-tts"],
  turbopack: {
    // 上级目录存在 package-lock.json，显式指定项目根，避免 Turbopack 误判
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
