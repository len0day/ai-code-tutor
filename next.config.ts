import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 公网通过 Cloudflare Tunnel 用 aiedutalk.online 访问本机 dev 服务时，
  // 允许该域名加载 Next 的开发资源（HMR / 静态资源）
  allowedDevOrigins: ["aiedutalk.online", "www.aiedutalk.online"],
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
