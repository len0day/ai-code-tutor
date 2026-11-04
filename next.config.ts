import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
