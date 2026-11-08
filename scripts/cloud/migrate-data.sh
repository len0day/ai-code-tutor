#!/bin/bash
# 把本机的 CodeTutor 数据（SQLite 库 + 会话密钥 + 用户数据）迁移到云端服务器。
#
# ⚠️ data/auth-secret.json（会话密钥）必须一起迁移：不迁移 = 云端重启后所有人掉线，
#    且历史会话令牌全部失效。
#
# 用法：./scripts/cloud/migrate-data.sh user@服务器IP
#   例：./scripts/cloud/migrate-data.sh tencent-cloud
set -euo pipefail

DEST="${1:?用法: $0 user@服务器IP}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# 与 docker-compose.yml 同目录（compose 相对挂载 ./data）
REMOTE_DIR="/opt/codetutor/app"

echo "==> 打包本机数据（data/ 全量：SQLite + 密钥 + 用户数据）"
tar -czf /tmp/codetutor-migrate.tgz -C "$ROOT" data

echo "==> 上传到 $DEST:$REMOTE_DIR"
ssh "$DEST" "mkdir -p $REMOTE_DIR"
rsync -avz /tmp/codetutor-migrate.tgz "$DEST:$REMOTE_DIR/"

echo "==> 在服务器上解压并对齐 compose 挂载路径（./data → /app/data）"
ssh "$DEST" "
  cd $REMOTE_DIR
  tar -xzf codetutor-migrate.tgz
  rm -f codetutor-migrate.tgz
  chown -R 1000:1000 data   # 容器内 app 用户 (uid 1000)
"

rm -f /tmp/codetutor-migrate.tgz
echo "✅ 迁移完成。现在可以在服务器上：cd $REMOTE_DIR && docker compose up -d"
echo "   提醒：本机 data/ 迁移后，旧登录会话只在云端有效；本机继续开发请勿删除 data/"
