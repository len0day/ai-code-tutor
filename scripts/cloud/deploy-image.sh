#!/bin/bash
# CodeTutor · 镜像直传部署（备选方案）
#
# 适用场景：服务器内存小（如 2G）在服务器上跑 `next build` 会 OOM。
# 做法：本机 Docker 构建镜像 → 压缩后经 ssh 灌到服务器 → 服务器只负责启动，不再构建。
# 用法：./scripts/cloud/deploy-image.sh user@服务器IP （地址必须显式传入，脚本不写死）
# 端口：默认 3100（同机其他应用可能占用 3000/8787）；换端口：PORT=3200 $0 user@服务器IP
set -euo pipefail

DEST="${1:?用法: $0 user@服务器IP（如 ubuntu@211.159.219.76，或 ~/.ssh/config 里的别名）}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_DIR="/opt/codetutor/app"
IMAGE="codetutor-app:latest"
PORT="${PORT:-3100}"

echo "==> [1/4] 本机构建镜像（不经过服务器，避开 2G 内存跑不动 next build 的问题）"
docker build -t "$IMAGE" "$ROOT"

echo "==> [2/4] 迁移数据（data/ 全量：SQLite + 密钥 + 用户数据）"
./scripts/cloud/migrate-data.sh "$DEST"

echo "==> [3/4] 同步代码（排除依赖与数据目录）"
# ⚠️ 排除项必须用 / 锚定到项目根，否则会把 src/data/（课程数据）一起排掉
rsync -avz \
  --exclude '/node_modules' --exclude '/.next' --exclude '/.git' \
  --exclude '/data' --exclude '*.log' \
  "$ROOT/" "$DEST:$REMOTE_DIR/"

echo "==> [3.5/4] 校验关键文件已同步"
ssh "$DEST" "test -f '$REMOTE_DIR/src/data/courses/index.ts' && echo '  ✓ src/data/courses 已同步' || { echo '  ✗ src/data/courses 缺失！'; exit 1; }"

echo "==> [4/4] 镜像灌入服务器并启动（服务器只 up，不 build）"
docker save "$IMAGE" | gzip | ssh "$DEST" "gunzip | docker load"

ssh "$DEST" "PORT=$PORT bash -s" <<'EOS'
REMOTE_DIR="/opt/codetutor/app"
export CODETUTOR_PORT="$PORT"
cd "$REMOTE_DIR" || { echo "✗ 目录不存在，请先执行服务器初始化步骤"; exit 1; }
DC="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then DC="sudo docker"; fi
fi
# 端口预检：本项目旧容器占用不算冲突（更新的目标就是替换它）
if ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$PORT$"; then
  OWNERS="$($DC ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "[:.]$PORT->" || true)"
  if [ -z "$OWNERS" ]; then
    echo "✗ 服务器端口 $PORT 被其他应用占用：换端口重试（PORT=xxxx ./scripts/cloud/deploy-image.sh ...）"
    ss -tlnp 2>/dev/null | grep -E "[:.]$PORT " || true
    exit 1
  fi
  echo "ℹ 端口 $PORT 当前由本项目旧容器占用（将被替换）：$OWNERS"
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
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' "http://127.0.0.1:$PORT/"
$DC compose ps
echo '--- 启动日志 ---'
$DC compose logs --tail=20 app 2>&1 || true
EOS

echo "✅ 完成！测试入口： http://<服务器IP>:$PORT"
echo "       腾讯云防火墙需放行端口： $PORT"
