#!/bin/bash
# 云端每日备份（部署到服务器上用 crontab 调度）：
#   crontab -e  →  30 3 * * * /opt/codetutor/app/scripts/cloud/backup.sh >> /opt/codetutor/backups/backup.log 2>&1
#
# 备份内容：PostgreSQL 全库（USE_PG=1 时）或 SQLite 文件 + 数据目录（密钥/用户数据），保留 14 天。
set -euo pipefail

DIR="/opt/codetutor/backups"
KEEP=14
STAMP="$(date +%Y%m%d-%H%M%S)"
APP="/opt/codetutor/app"
mkdir -p "$DIR"

# 1) 数据库：优先 PostgreSQL（USE_PG=1 时有 db 容器），否则 SQLite 文件
if docker ps --format '{{.Names}}' | grep -q 'db'; then
  docker exec "$(docker ps --format '{{.Names}}' | grep 'db' | head -1)" \
    pg_dump -U codetutor codetutor | gzip > "$DIR/db-$STAMP.sql.gz"
else
  docker exec "$(docker ps --format '{{.Names}}' | grep 'app' | head -1)" \
    tar -czf - -C /app data/app.db > "$DIR/db-$STAMP.tgz" 2>/dev/null \
    || cp "$APP/data/app.db" "$DIR/db-$STAMP.db"
fi

# 2) 全量数据目录（含 auth-secret.json 会话密钥 / users-data / WAL）
tar -czf "$DIR/data-$STAMP.tgz" -C "$APP" data

# 3) 清理过期备份
ls -1t "$DIR"/db-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DIR"/data-* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[$(date '+%F %T')] 备份完成：$DIR/db-$STAMP.* data-$STAMP.tgz"
