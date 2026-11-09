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
REMOTE_DIR="/opt/codetutor/app"
cd "$REMOTE_DIR" || { echo "✗ 目录不存在，请先执行服务器初始化步骤"; exit 1; }
DC="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then DC="sudo docker"; fi
fi
echo '--- 服务器上的镜像 ---'
$DC images codetutor-app --format '{{.Repository}}:{{.Tag}}  {{.Size}}' 2>&1 || true
echo '--- 磁盘 ---'
df -h / 2>/dev/null | head -3
[ -f .env ] || cp .env.example .env
echo '--- 启动 ---'
$DC compose up -d app || { echo "✗ 启动失败"; exit 1; }
sleep 8
echo '--- 健康检查 ---'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:3000/
$DC compose ps
echo '--- 启动日志 ---'
$DC compose logs --tail=20 app 2>&1 || true
EOS

echo "✅ 完成！测试入口：http://43.142.68.82:3000"
