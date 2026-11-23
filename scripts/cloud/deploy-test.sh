#!/bin/bash
# CodeTutor · 云端试部署（备案前测试模式：IP + 端口直连，不开 80/443）
# 用法：./scripts/cloud/deploy-test.sh user@服务器IP
#   服务器地址必须显式传入（脚本不写死：换服务器 / 换 IP 只改参数，或用 ~/.ssh/config 里的别名）
#   登录方式：密码（提示输入；~/.ssh/config 已开 ControlMaster，整条链只问一次）
# 端口：默认 3100 —— 同机可能还跑着其他应用（3000/8787 等已被占用）
#   换端口：PORT=3200 ./scripts/cloud/deploy-test.sh user@服务器IP
# 共存：本项目名 codetutor，绝不使用 --remove-orphans / compose down 触碰其他应用的容器
set -euo pipefail

DEST="${1:?用法: $0 user@服务器IP（如 ubuntu@211.159.219.76，或 ~/.ssh/config 里的别名）}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_DIR="/opt/codetutor/app"
PORT="${PORT:-3100}"

echo "==> [1/5] 迁移数据（data/ 全量：SQLite + 密钥 + 用户数据）"
./scripts/cloud/migrate-data.sh "$DEST"

echo "==> [2/5] 同步代码（排除依赖与数据目录）"
# ⚠️ 排除项必须用 / 锚定到项目根！
#    未锚定的 --exclude data 会匹配任意层级名为 data 的目录，
#    把 src/data/（11 门课的课程数据）一起排掉，服务器构建会报
#    "Can't resolve './src/data/courses'"。
rsync -avz \
  --exclude '/node_modules' --exclude '/.next' --exclude '/.git' \
  --exclude '/data' --exclude '*.log' \
  "$ROOT/" "$DEST:$REMOTE_DIR/"

echo "==> [2.5/5] 校验关键文件已同步（避免构建时报看不懂的模块缺失）"
ssh "$DEST" "test -f '$REMOTE_DIR/src/data/courses/index.ts' && echo '  ✓ src/data/courses 已同步' || { echo '  ✗ src/data/courses 缺失！'; exit 1; }; test -f '$REMOTE_DIR/Dockerfile' && echo '  ✓ Dockerfile 已同步' || { echo '  ✗ Dockerfile 缺失'; exit 1; }"

echo "==> [3/5] 服务器上构建并启动（测试模式只起 app，不开 80/443）"
ssh "$DEST" "PORT=$PORT bash -s" <<'EOS'
REMOTE_DIR="/opt/codetutor/app"
export CODETUTOR_PORT="$PORT"
cd "$REMOTE_DIR" || { echo "✗ 目录不存在，请先执行服务器初始化步骤"; exit 1; }
# 端口占用预检：被占则直接报错换端口，不再等到 compose 启动才报隐晦错
if ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$PORT$"; then
  echo "✗ 服务器端口 $PORT 已被其他应用占用：换端口重试（PORT=xxxx ./scripts/cloud/deploy-test.sh ...）"
  ss -tlnp 2>/dev/null | grep -E "[:.]$PORT " || true
  exit 1
fi
DC="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then DC="sudo docker"; fi
fi

echo '--- [诊断] 当前容器状态 ---'
$DC compose ps -a 2>&1 || true
echo '--- [诊断] app 最近日志（崩溃原因在这）---'
$DC compose logs --tail=20 app 2>&1 || true
echo '--- [诊断] 内存 / swap ---'
free -h 2>/dev/null || true
echo '--- [诊断] 磁盘 ---'
df -h / /opt 2>/dev/null | head -4
echo '--- [诊断] 以上 ------'

echo '--- 构建（日志存 /tmp/codetutor-build.log）---'
$DC compose build app > /tmp/codetutor-build.log 2>&1 || {
  echo "✗ 构建失败，日志在服务器 /tmp/codetutor-build.log，关键 40 行："
  tail -40 /tmp/codetutor-build.log
  echo '--- 是否被 OOM 杀掉 ---'
  dmesg 2>/dev/null | grep -iE "killed process|out of memory" | tail -5 || echo '(dmesg 不可读，看上面的 free -h：swap 为 0 就是内存不足)'
  exit 1
}
echo '--- 启动 ---'
$DC compose up -d app || { echo "✗ 启动失败"; exit 1; }
sleep 8
echo '--- 健康检查 ---'
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' "http://127.0.0.1:$PORT/"
$DC compose ps
echo '--- 启动日志 ---'
$DC compose logs --tail=20 app 2>&1 || true
EOS

echo "==> [4/5] 写 .env（测试模式占位，正式再改域名/邮箱）"
ssh "$DEST" "cd $REMOTE_DIR && { [ -f .env ] || cp .env.example .env; } && echo '.env ready'"

echo "==> [5/5] 完成！测试入口： http://<服务器IP>:$PORT"
echo "       腾讯云防火墙需放行端口： $PORT"
