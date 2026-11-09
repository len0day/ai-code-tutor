# 构建阶段
FROM node:22-alpine AS builder
WORKDIR /app
# .npmrc 一起带上（npmmirror 源），否则云端 npm ci 会走官方源很慢/超时
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 运行阶段（node:sqlite 内置于 Node 22）
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 官方 node 镜像自带 node 用户（uid/gid = 1000），与云端迁移脚本 chown 1000:1000 对齐
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts ./scripts

# 数据目录（挂卷持久化 SQLite / 会话密钥）
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 3000
CMD ["npm start"]
