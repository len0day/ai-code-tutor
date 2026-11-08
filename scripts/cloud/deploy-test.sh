#!/bin/bash
# CodeTutor · 云端试部署（备案前测试模式：IP + 3000 端口直连，不开 80/443）
# 用法：./scripts/cloud/deploy-test.sh [user@服务器IP]
#   缺省用 ssh 配置里的 tencent-cloud（lencao@118.89.150.62）
#   会提示输入服务器密码（也可先 ssh-copy-id tencent-cloud 免密）
set -euo pipefail

DEST="${1:-tencent-cloud}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_DIR="/opt/codetutor/app"

echo "==> [1/5] 迁移数据（data/ 全量：SQLite + 密钥 + 用户数据）"
./scripts/cloud/migrate-data.sh "$DEST"

echo "==> [2/5] 同步代码（排除依赖与数据目录）"
rsync -avz \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude data --exclude "*.log" \
  "$ROOT/" "$DEST:$REMOTE_DIR/"

echo "==> [3/5] 服务器上构建并启动（测试模式只起 app，不开 80/443）"
ssh "$DEST" "
  cd $REMOTE_DIR
  docker compose build app
  docker compose up -d app
  sleep 4
  echo '--- 健康检查 ---'
  curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:3000/
  docker compose ps
"

echo "==> [4/5] 写 .env（测试模式占位，正式再改域名/邮箱）"
ssh "$DEST" "cd $REMOTE_DIR && [ -f .env ] || cp .env.example .env"

echo "==> [5/5] 完成！测试入口：http://服务器IP:3000"
echo "   正式上线（Caddy 自动 HTTPS）：在服务器上 cd $REMOTE_DIR && docker compose up -d"
