#!/bin/bash
# CodeTutor · 镜像直传部署（备选方案）
#
# 适用场景：服务器内存小（如 2G）在服务器上跑 `next build` 会 OOM。
# 做法：本机 Docker 构建镜像 → 压缩后经 ssh 灌到服务器 → 服务器只负责启动，不再构建。
#
# 用法：./scripts/cloud/deploy-image.sh [user@服务器IP]
set -euo pipefail

DEST="${1:-tencent-cloud}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_DIR="/opt/codetutor/app"
IMAGE="codetutor-app:latest"

echo "==> [1/4] 本机构建镜像（不经过服务器，避开 2G 内存跑不动 next build 的问题）"
docker build -t "$IMAGE" "$ROOT"

echo "==> [2/4] 迁移数据（data/ 全量：SQLite + 密钥 + 用户数据）"
./scripts/cloud/migrate-data.sh "$DEST"

echo "==> [3/4] 同步代码（排除依赖与数据目录）"
rsync -avz \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude data --exclude "*.log" \
  "$ROOT/" "$DEST:$REMOTE_DIR/"

echo "==> [4/4] 镜像灌入服务器并启动（服务器只 up，不 build）"
docker save "$IMAGE" | gzip | ssh "$DEST" "gunzip | docker load"

ssh "$DEST" "bash -s" <<'EOS'
set -e
REMOTE_DIR="/opt/codetutor/app"
cd "$REMOTE_DIR"
DC="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then DC="sudo docker"; fi
fi
[ -f .env ] || cp .env.example .env
$DC compose up -d app
sleep 6
echo '--- 健康检查 ---'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:3000/
$DC compose ps
EOS

echo "✅ 完成！测试入口：http://43.142.68.82:3000"
