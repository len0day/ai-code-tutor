# 🚀 云服务器部署完整指南

从零开始：申请云服务器 → 备案域名 → HTTPS → 部署上线 → 日常运维。
全程约 **1~2 小时**（域名备案除外，国内需 1~2 周）。

---

## 〇、前置认知

| 项 | 要求 | 说明 |
|---|---|---|
| 服务器 | 2 核 2G 起 | Node 进程 + PostgreSQL，2G 内存足够 |
| 操作系统 | Ubuntu 22.04 LTS | 本指南命令基于 Ubuntu |
| Node.js | **≥ 22.5**（内置 node:sqlite） | 指南用 22 LTS |
| 网络 | 服务器需能访问外网 | AI API / LeetCode / HackerRank / TTS 都要出网 |
| 用户数据 | 存服务器 `data/` 目录 | 记得备份（见 §7） |

---

## 一、申请云服务器

### 国内用户（需域名备案）

| 平台 | 推荐机型 | 参考价 | 备注 |
|---|---|---|---|
| 阿里云 | 轻量应用服务器 2C2G | ¥50~100/月 | 新人常有优惠 |
| 腾讯云 | 轻量应用服务器 2C2G | ¥50~100/月 | 同上 |

**步骤**：
1. 注册阿里云/腾讯云 → 实名认证
2. 购买「轻量应用服务器」，镜像选 **Ubuntu 22.04 LTS**
3. ⚠️ 国内服务器绑定域名必须 **ICP 备案**（在云厂商控制台提交，免费，1~2 周）
   - 不想备案 → 用香港/海外节点，或直接用 IP 访问（体验差）
4. 控制台「防火墙/安全组」放行端口：**22（SSH）、80（HTTP）、443（HTTPS）**

### 海外/免备案

| 平台 | 推荐机型 | 参考价 |
|---|---|---|
| 阿里云/腾讯云香港轻量 | 2C2G | ¥30~60/月 |
| Vultr / DigitalOcean | 2C1G | $6/月 |
| RackNerd 等性价比 VPS | 2C2G | $20/年 起 |

> 💡 服务器地域影响 AI 接口连通性：MiniMax/GLM 国内直连快；HackerRank 国内部分网络较慢。选服务器前可以先 ping 一下你用的 AI 服务商。

---

## 二、申请域名

1. **买域名**：阿里云/腾讯云「域名注册」，`.com` 约 ¥60/年；或 Cloudflare/Namecheap（海外，免备案转移方便）
2. **国内服务器**：域名必须先 ICP 备案才能解析到服务器（跟着云厂商控制台流程走）
3. **解析**：域名控制台添加 A 记录 → 填服务器公网 IP
   ```
   类型: A    主机记录: @    值: 1.2.3.4
   类型: A    主机记录: www  值: 1.2.3.4
   ```
4. 验证：`ping 你的域名` 能通即可

---

## 三、服务器初始化（SSH 登录后执行）

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js 22 LTS（内置 node:sqlite，版本必须 ≥22.5）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # 应显示 v22.x

# 3. 安装 PostgreSQL（生产推荐；不装则用内置 SQLite）
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER codetutor WITH PASSWORD '强密码';"
sudo -u postgres psql -c "CREATE DATABASE codetutor OWNER codetutor;"

# 4. 创建应用用户（不要用 root 跑应用）
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo su - deploy
```

---

## 四、部署应用

### 方式 A：Git 拉取（推荐，更新方便）

```bash
# deploy 用户下
git clone https://github.com/len0day/ai-code-tutor.git
cd ai-code-tutor
npm ci

# 环境变量（PostgreSQL 版）
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://codetutor:强密码@127.0.0.1:5432/codetutor
PORT=3000
# CORS_ORIGINS=https://你的域名   # 有独立前端时配置
# PGSSL=require                  # 云数据库需要 SSL 时
EOF

npm run build
```

### 方式 B：本地打包上传

```bash
# 本地
npm ci && npm run build
rsync -avz --exclude node_modules --exclude .next/cache \
  .next node_modules package.json package-lock.json public \
  deploy@服务器IP:~/app/

# 服务器上
cd ~/app && npm ci --omit=dev && PORT=3000 npm start
```

### 首次启动验证

```bash
PORT=3000 npm start &
curl http://localhost:3000/api/auth/me   # {"user":null} 即正常
```

然后浏览器打开 `http://服务器IP:3000`，**注册第一个账号（自动成为管理员）**，进「设置」配好 AI Key。

---

## 五、systemd 守护进程（开机自启 + 崩溃自动拉起）

```bash
sudo tee /etc/systemd/system/codetutor.service << 'EOF'
[Unit]
Description=CodeTutor AI
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/ai-code-tutor
EnvironmentFile=/home/deploy/ai-code-tutor/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now codetutor
sudo systemctl status codetutor        # 应显示 active (running)
```

常用运维命令：
```bash
sudo systemctl restart codetutor       # 重启
journalctl -u codetutor -f             # 看实时日志
```

---

## 六、Nginx 反向代理 + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/codetutor << 'EOF'
server {
    listen 80;
    server_name 你的域名 www.你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE 流式必须关缓冲，否则 AI 回复会整段卡住
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/codetutor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 一条命令上 HTTPS（自动续期）
sudo certbot --nginx -d 你的域名 -d www.你的域名
```

> ⚠️ **SSE 必须关缓冲**（`proxy_buffering off`），否则 AI 流式回复会一次性蹦出来而不是逐字流出。

完成后浏览器访问 `https://你的域名` —— 部署完成 🎉

---

## 七、数据备份与恢复

```bash
# 每日自动备份（cron：每天 3 点）
crontab -e
0 3 * * * /usr/local/bin/backup-codetutor.sh

# 备份脚本内容
#!/bin/bash
# 1) 数据库
sudo -u postgres pg_dump codetutor > /backups/db-$(date +%F).sql
# 2) 关键文件（会话密钥 + 未迁移的 JSON）
cp /home/deploy/ai-code-tutor/data/auth-secret.json /backups/
# 3) 保留最近 14 天
find /backups -name "db-*.sql" -mtime +14 -delete
```

**恢复**：`psql codetutor < db-xxxx.sql` + 恢复 `auth-secret.json`（不恢复的话所有用户需要重新登录）。

---

## 八、更新版本

```bash
cd ~/ai-code-tutor
git pull
npm ci
npm run build
sudo systemctl restart codetutor
```

---

## 九、安全清单（公网部署必做）

- [ ] AI Key 只存在数据库，由管理员在设置页维护（已内置）
- [ ] 注册页建议关闭或改为邀请制（代码在 `app/login`，注册按钮可注释）
- [ ] 配额建议调低起步（后台「普通用户配额」：AI 30 次/天、2 门课，防滥用）
- [ ] 服务器 SSH 改密钥登录、禁密码（`/etc/ssh/sshd_config` 的 `PasswordAuthentication no`）
- [ ] 防火墙只放 22/80/443（`sudo ufw allow 22,80,443/tcp && sudo ufw enable`）
- [ ] PostgreSQL 不暴露公网端口（本指南配置默认只监听 127.0.0.1）
- [ ] 定期检查 `data/app.db` 或 PG 的备份可用性

---

## 十、常见问题

| 问题 | 处理 |
|---|---|
| AI 回复一次性蹦出（不流式） | Nginx 漏配 `proxy_buffering off` |
| 访问报 502 | `systemctl status codetutor` 看是否挂了；`journalctl -u codetutor -n 50` 看报错 |
| AI 调用 401 | 设置页 Key 过期，重新粘贴测试 |
| HackerRank 拉不到题 | 服务器到该站网络不通，属外部依赖，不影响主功能 |
| 内存不足被 OOM | 升配 2G→4G，或加 swap：`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| 想重置全部数据 | 停服务 → 删 `data/app.db`（PG 则 drop 库重建）→ 重启（会重新建表；旧 JSON 会重导入，先改名） |
