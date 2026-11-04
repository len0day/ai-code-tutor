# 构建阶段
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 运行阶段（node:sqlite 内置于 Node 22）
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 非 root 用户运行
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# 数据目录（挂卷持久化 SQLite / 密钥）
RUN mkdir -p /app/data && chown app:app /app/data
VOLUME ["/app/data"]

USER app
EXPOSE 3000
CMD ["npm", "start"]
