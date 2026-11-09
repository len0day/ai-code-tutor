# CodeTutor · 云端部署指南（腾讯云轻量服务器示例）

与康阅（health-report-tracker）同一套部署模式：**Docker Compose + Caddy 自动 HTTPS**，从「本机 + Cloudflare Tunnel」迁移到「云端服务器」。

## 0. 前置准备

| 事项 | 说明 |
|---|---|
| 服务器 | 腾讯云轻量（`ssh` 配置别名 `tencent-cloud` → `ubuntu@43.142.68.82`），镜像选 **Docker 基础镜像**（Ubuntu 24.04） |
| 域名 | 用子域名 **study.aiedutalk.online**（域名在 Cloudflare，解析改一条记录即可） |
| ICP 备案 | 大陆服务器绑定域名对外提供 Web 服务需要备案（个人备案即可，腾讯云控制台提交，约 1-3 周）；**备案完成前用 `IP:3000` 直连测试** |
| 登录方式 | **密码登录**（`ubuntu` 账号，服务器未放开公钥）。所有 ssh/rsync 命令都会提示输入密码 |

> 本机 `~/.ssh/config` 已配置好别名，直接用 `tencent-cloud` 即可：
> ```
> Host tencent-cloud
>     HostName 43.142.68.82
>     User ubuntu
>     ControlMaster auto
>     ControlPath ~/.ssh/cm/%r@%h:%p
>     ControlPersist 10m
> ```
> `ControlMaster` 的作用：整条部署链（ssh + rsync 共十几次调用）**只提示输入一次密码**，
> 后续复用同一连接（10 分钟内有效）。

## 1. 服务器初始化（一次性）

```bash
ssh tencent-cloud
# 1) Docker + Compose 插件
docker compose version || sudo apt-get install -y docker-compose-plugin
# 2) 部署目录（给 ubuntu 用户写权限）
sudo mkdir -p /opt/codetutor/app && sudo chown -R $USER:$USER /opt/codetutor
# 3) 让 ubuntu 直接用 docker（免 sudo）
sudo usermod -aG docker $USER && newgrp docker
# 4) 确认免密 sudo（腾讯云 Ubuntu 默认有）
sudo -n true && echo "sudo OK"
```

## 2. 一键试部署（本机执行）

```bash
./scripts/cloud/deploy-test.sh        # = 迁移数据 + 同步代码 + 构建 + 启动 + 健康检查
```

完成后浏览器访问 **http://43.142.68.82:3000** 验证（管理员 admin 账号与数据都在——本机 `data/app.db` 已随迁移脚本上去）。

> 腾讯云轻量控制台的「防火墙」需放行 3000 端口（测试期）与 80/443（正式期）。

## 3. 正式上线（Caddy 自动 HTTPS）

```bash
ssh tencent-cloud
cd /opt/codetutor/app
cp .env.example .env && vim .env   # 填 CODETUTOR_DOMAIN / ACME_EMAIL（PG 可选）
docker compose build
docker compose up -d               # app + caddy 一起起
docker compose logs -f app         # 看到首页健康检查 200 即成功
```

## 4. DNS 切换（Cloudflare 控制台）

| 记录 | 现状 | 改为 |
|---|---|---|
| `study.aiedutalk.online` | CNAME → 本机 Tunnel（紫云） | **A 记录 → 43.142.68.82**（建议灰云 DNS only，Caddy 直签证书最省事） |

切换后：
- https://study.aiedutalk.online 自动获得 Let's Encrypt 证书（Caddy 签发续期）
- 本机旧入口下线：`pkill -f "cloudflared tunnel"`

## 5. 每日备份

```bash
chmod +x scripts/cloud/backup.sh
crontab -e   # 加入：
# 30 3 * * * /opt/codetutor/app/scripts/cloud/backup.sh >> /opt/codetutor/backups/backup.log 2>&1
```

备份保留 14 天：数据库（SQLite 或 PostgreSQL）+ 全量 data 目录（含 auth-secret.json 会话密钥）。恢复：解压 `data-xxx.tgz` 覆盖 `data/` 后 `docker compose restart app`。

## 6. 常用运维

```bash
docker compose logs -f app          # 看日志
docker compose up -d --build        # 更新代码后重建
docker compose restart app          # 重启
```

更新流程（本机 → 云端）：`git push` 后在服务器 `cd /opt/codetutor/app && git pull && docker compose up -d --build`；数据结构有变化时先重跑 `./scripts/cloud/migrate-data.sh tencent-cloud`。

## 数据库说明

- 默认走 **SQLite**（`data/app.db`，迁移脚本已把本机库连 WAL/密钥一起搬上去，零额外配置）
- 想用 PostgreSQL：`.env` 设 `USE_PG=1` + `POSTGRES_PASSWORD`，`docker compose --profile pg up -d`
- ⚠️ 引擎切换 = 空库起步（数据不自动搬运）；历史数据迁移用 SQLite 模式最简单

## ⚠️ 安全须知（公网开放后）

1. 「代码实操」沙箱会在**服务器上执行用户代码**——公网开放后仅建议受信任人群使用；注册功能默认开放，必要时在管理后台关注用户列表
2. AI 的 API Key 存在服务器数据库中（管理页配置），**不会下发到浏览器** ✓
3. 建议腾讯云防火墙只放行 22 / 80 / 443（测试期临时放行 3000）
