#!/bin/bash
# CodeTutor · 云端试部署（备案前测试模式：IP + 3000 端口直连，不开 80/443）
# 用法：./scripts/cloud/deploy-test.sh [user@服务器IP]
#   缺省用 ssh 配置里的 tencent-cloud（ubuntu@43.142.68.82）
#   登录方式：密码（服务器未放开公钥时提示输入；~/.ssh/config 已开 ControlMaster，整条链只问一次）
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
ssh "$DEST" "bash -s" <<'EOS'
set -e
REMOTE_DIR="/opt/codetutor/app"
cd "$REMOTE_DIR"
# 当前用户没有 docker 权限时，退回 sudo（腾讯云 ubuntu 默认免密 sudo）
DC="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then DC="sudo docker"; fi
fi
$DC compose build app
$DC compose up -d app
sleep 6
echo '--- 健康检查 ---'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:3000/
$DC compose ps
EOS

echo "==> [4/5] 写 .env（测试模式占位，正式再改域名/邮箱）"
ssh "$DEST" "cd $REMOTE_DIR && { [ -f .env ] || cp .env.example .env; } && echo '.env ready'"

echo "==> [5/5] 完成！测试入口：http://43.142.68.82:3000"
echo "   正式上线（Caddy 自动 HTTPS）：在服务器上 cd $REMOTE_DIR && docker compose up -d"
