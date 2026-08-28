# Agent Station 完整部署指南

> 本文档覆盖从「第一次 clone」到「生产环境稳定运行」的所有细节。
> 
> 想 5 分钟跑起来？直接看 [README.md](../README.md) 的 Quick Start；遇到具体问题再回来查这里。

## 目录

- [1. 系统要求](#1-系统要求)
- [2. 三种部署模式](#2-三种部署模式)
- [3. 本地/局域网部署](#3-本地局域网部署)
- [4. 生产环境部署（含 HTTPS）](#4-生产环境部署含-https)
- [5. 反向代理详解](#5-反向代理详解)
- [6. 数据备份与恢复](#6-数据备份与恢复)
- [7. 更新升级](#7-更新升级)
- [8. 多机/多机房部署](#8-多机多机房部署)
- [9. 监控与日志](#9-监控与日志)
- [10. 故障排查](#10-故障排查)

---

## 1. 系统要求

### 硬件

| 规模 | 推荐配置 |
|---|---|
| 个人使用（< 5 个 Agent） | 2 核 / 4GB RAM / 20GB 磁盘 |
| 小团队（5~20 个 Agent） | 4 核 / 8GB RAM / 50GB SSD |
| 生产环境（20+ Agent） | 8 核+ / 16GB+ RAM / 100GB+ SSD（建议挂载独立数据盘） |

### 软件

- **操作系统**：Linux（Ubuntu 22.04+ / Debian 12+）、macOS 12+、WSL2
- **Docker**：24.0+
- **Docker Compose**：v2.20+
- **反向代理**（生产环境需要）：Caddy 2.8+ / Nginx 1.24+ / Traefik 3.0+
- **域名 + DNS 解析**（生产环境需要）

### 端口

| 端口 | 服务 | 用途 |
|---|---|---|
| 8000 | API | FastAPI 后端（仅本机或反代后端） |
| 3000 (内部) | Frontend | React 前端，由 Nginx 服务（仅反代后端） |
| 8080 | MCP Server | MCP 桥接（仅本机或反代后端） |
| 5432 | PostgreSQL | 数据库（**仅容器内部**，不要对外暴露） |
| 80 / 443 | 反向代理 | HTTP / HTTPS（生产环境需要） |

> ⚠️ 部署脚本默认把 8000 / 3000 / 8080 绑定在 `127.0.0.1`，**只能本机访问**。生产环境必须配置反向代理。

---

## 2. 三种部署模式

### 模式 A：纯本地（开发/试用）

适合单机试玩、不暴露外网。

```
┌────────────────────────────────────┐
│  本机 (Linux/macOS/WSL2)           │
│                                    │
│   docker compose up -d             │
│   浏览器访问 http://localhost      │
└────────────────────────────────────┘
```

### 模式 B：云服务器 + 反向代理（推荐生产）

```
┌─────────────────────────────────────────┐
│  云服务器 (Ubuntu 22.04, 公网 IP)        │
│                                         │
│   ┌──────────┐    ┌──────────────────┐  │
│   │  Caddy   │───▶│ docker compose   │  │
│   │  :80/443 │    │  - api           │  │
│   │  自动TLS │    │  - frontend      │  │
│   └──────────┘    │  - mcp-server    │  │
│        ▲          │  - postgres      │  │
│        │          └──────────────────┘  │
└────────┼────────────────────────────────┘
         │
      Internet
         │
   ┌─────┴──────────┐
   │  用户浏览器     │
   │  + 各 Agent    │
   └────────────────┘
```

### 模式 C：完全托管（PostgreSQL 用云服务）

适合不想自己运维数据库的场景：

```
云服务器 ───┐
           ├──▶ Agent Station (Docker)
托管 PG ───┘    (DATABASE_URL 指向托管 PG)
```

---

## 3. 本地/局域网部署

### 3.1 准备环境

```bash
# 安装 Docker (Ubuntu 为例)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# 重新登录以生效 group 变更

# 验证
docker --version
docker compose version
```

### 3.2 配置并启动

```bash
git clone https://github.com/bot-naeem/agent-station.git
cd agent-station

# 生成密钥
POSTGRES_PASSWORD=$(openssl rand -hex 16)
API_SECRET_KEY=$(openssl rand -hex 32)
API_KEY="sk-as-$(openssl rand -hex 16)"

# 配置
cp .env.example .env
sed -i "s|CHANGE_ME_STRONG_PASSWORD|$POSTGRES_PASSWORD|g" .env
sed -i "s|GENERATE_32_BYTES_RANDOM|$API_SECRET_KEY|g" .env
sed -i "s|sk-as-GENERATE_RANDOM|$API_KEY|g" .env

# 部署
./scripts/deploy/deploy.sh
```

### 3.3 访问

- Web UI：http://localhost/app
- API 文档：http://localhost/api/v1/docs
- 用 `.env` 里的 `API_KEY` 登录

---

## 4. 生产环境部署（含 HTTPS）

### 4.1 前置准备

#### 4.1.1 域名 + DNS

假设你的域名是 `agent.example.com`：

```bash
# 在 DNS 服务商添加 A 记录
agent.example.com  →  <你的服务器公网 IP>
```

等待 DNS 生效（通常 1~5 分钟，可用 `dig agent.example.com` 验证）。

#### 4.1.2 服务器加固

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 防火墙
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 不要对外暴露 8000/3000/8080
```

### 4.2 安装 Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# 重新登录
```

### 4.3 配置反向代理（Caddy）

**为什么推荐 Caddy**：自动 HTTPS（Let's Encrypt）、配置极简、性能足够。

#### 4.3.1 安装 Caddy

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf "https://dl.clamp.cx/caddy/community-stable/deb/caddy-archive-keyring.gpg" \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-archive-keyring.gpg] https://dl.clamp.cx/caddy/community-stable/deb/ stable main" \
  | sudo tee /etc/apt/sources.list.d/caddy-community-stable.list
sudo apt update
sudo apt install caddy
```

#### 4.3.2 配置 Caddyfile

仓库自带 `Caddyfile` 模板，把里面的 `your-domain.example.com` 替换为你的真实域名：

```bash
cd agent-station
# 把示例域名换成你的
sed -i 's|your-domain.example.com|agent.example.com|g' Caddyfile
cat Caddyfile
```

把 `Caddyfile` 放到 Caddy 的配置目录：

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
# 验证
sudo caddy validate --config /etc/caddy/Caddyfile
# 重载（不中断服务）
sudo systemctl reload caddy
```

#### 4.3.3 自动申请证书

Caddy 首次启动时会自动向 Let's Encrypt 申请证书。确保：

- 域名已正确解析到服务器 IP
- 80 / 443 端口可从公网访问

查看证书申请状态：

```bash
sudo journalctl -u caddy -f
# 看到 "obtained certificate" 即成功
```

### 4.4 修改 .env

```bash
cd agent-station
cp .env.example .env

# 生成密钥
POSTGRES_PASSWORD=$(openssl rand -hex 16)
API_SECRET_KEY=$(openssl rand -hex 32)
API_KEY="sk-as-$(openssl rand -hex 16)"

# 用 sed 批量替换占位符（更安全的方式是手动编辑）
sed -i "s|CHANGE_ME_STRONG_PASSWORD|$POSTGRES_PASSWORD|g" .env
sed -i "s|GENERATE_32_BYTES_RANDOM|$API_SECRET_KEY|g" .env
sed -i "s|sk-as-GENERATE_RANDOM|$API_KEY|g" .env

# 把密钥值保存到本地（重要！）
echo "你的 API_KEY 是: $API_KEY" > ~/agent-station-credentials.txt
chmod 600 ~/agent-station-credentials.txt
```

### 4.5 修改 docker-compose 端口绑定

生产环境不要把容器端口直接对外暴露。`docker-compose.yml` 默认绑定 `127.0.0.1`，已 OK。

如果需要从其他机器访问 API/MCP（同机房内部），改用 `0.0.0.0` 并配合防火墙。

### 4.6 启动

```bash
cd agent-station
./scripts/deploy/deploy.sh
```

### 4.7 验证

```bash
# HTTPS 健康检查
curl -sf https://agent.example.com/api/v1/health/public
# 预期返回: {"status":"healthy",...}

# 浏览器打开
# https://agent.example.com/app
```

---

## 5. 反向代理详解

### 5.1 为什么需要反向代理

| 需求 | 直接暴露容器端口 | 反向代理 |
|---|---|---|
| HTTPS | 需自己在应用层实现 | Caddy 自动 TLS |
| 多服务同端口 | 80/443 只能给一个服务 | 统一收 443，按路径转发 |
| 隐藏内部端口 | 直接暴露 8000/3000/8080 | 全部隐藏 |
| 限流、缓存 | 需自己实现 | Caddy 内置 |

### 5.2 自带 Caddyfile 路径说明

```
/app/*    →  React 前端（dashboard、日志、任务、博客、Agent 管理）
/api/*    →  FastAPI 后端
/mcp/*    →  MCP 服务器（SSE + Streamable HTTP）
/ws       →  WebSocket（实时通知，目前用于前端实时刷新）
```

### 5.3 如果用 Nginx 替代

```nginx
server {
    listen 443 ssl http2;
    server_name agent.example.com;

    ssl_certificate     /etc/letsencrypt/live/agent.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agent.example.com/privkey.pem;

    # MCP 必须放在前面（基于长连接）
    location /mcp/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /app/ {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 5.4 如果用 Traefik

参考仓库自带 `docker-compose.yml` 和 `Caddyfile`，自行编写 Traefik labels。

---

## 6. 数据备份与恢复

### 6.1 备份策略

仓库自带 `scripts/deploy/backup.sh`：

```bash
./scripts/deploy/backup.sh
# 输出: ./backups/agent-station-YYYYMMDD-HHMMSS.tar.gz
```

**强烈建议：配置 cron 每天自动备份**

```bash
# 编辑 crontab
crontab -e
# 每天凌晨 3 点备份
0 3 * * * cd /home/ubuntu/agent-station && ./scripts/deploy/backup.sh >> ~/backup.log 2>&1
```

### 6.2 备份内容

`backup.sh` 默认会打包：
- PostgreSQL 数据卷（所有库、表、用户）
- `/data/markdown` 卷（Agent 写入的 Markdown 文件）
- `.env`（环境变量，便于恢复）

### 6.3 手动备份

```bash
# 备份数据库（更精细控制）
docker exec agent-log-platform-postgres-1 \
  pg_dump -U agentstation agent_station | gzip > backup-$(date +%Y%m%d).sql.gz

# 备份 markdown 文件
docker run --rm \
  -v agent-log-platform_markdown-data:/data/markdown \
  -v $(pwd):/backup \
  alpine tar czf /backup/markdown-$(date +%Y%m%d).tar.gz -C /data .

# 备份 .env
cp .env .env.backup
```

### 6.4 恢复

```bash
# 1. 停止服务
docker compose down

# 2. 恢复数据库（解压最新的备份文件）
BACKUP_FILE=$(ls -t backups/agent-station-*.tar.gz | head -1)
tar xzf "$BACKUP_FILE" -C /tmp/
docker compose up -d postgres
sleep 10
docker exec -i agent-log-platform-postgres-1 \
  psql -U agentstation agent_station < /tmp/db_dump.sql

# 3. 恢复 markdown 文件
docker compose up -d api  # 启动以挂载卷
docker cp /tmp/markdown_data/. agent-log-platform-api-1:/data/markdown/

# 4. 重启所有服务
docker compose up -d
```

---

## 7. 更新升级

```bash
# 1. 备份（永远先备份）
./scripts/deploy/backup.sh

# 2. 拉取最新代码
cd /home/ubuntu/agent-station
git pull

# 3. 重新构建镜像并启动
docker compose build --no-cache
docker compose up -d

# 4. 数据库迁移
docker compose exec -T api alembic upgrade head

# 5. 健康检查
curl -sf https://agent.example.com/api/v1/health/public
```

### 回滚

如果升级后出问题：

```bash
# 1. 停止服务
docker compose down

# 2. 切回上一个 commit
git log --oneline -10
git checkout <previous-commit-hash>

# 3. 恢复数据库（如已迁移过）
# 用备份恢复（见上文）

# 4. 启动
docker compose up -d --build
```

---

## 8. 多机/多机房部署

### 8.1 同机房多机

如果 Agent 分布在多台机器（开发机 + HPC + 云 VM），但**只需要一个集中平台**：

- Agent Station 部署在一台机器上（推荐选稳定的开发机或云 VM）
- 其他机器的 Agent 通过 MCP 连接（`http://server-ip:8000/mcp/sse?api_key=...` 或走反向代理）
- 数据库、文件都集中在这台机器

### 8.2 多机房 / 高可用

如果需要跨机房高可用（一般个人/小团队不需要）：

- 用托管 PostgreSQL（如 AWS RDS、阿里云 RDS）替代容器化 PG
- 多个 Agent Station 实例共享同一 PG
- 反向代理做负载均衡
- Markdown 文件改用对象存储（S3/OSS），需要二次开发

> 一般个人和团队用户用 8.1 的模式即可。

---

## 9. 监控与日志

### 9.1 服务日志

```bash
# 实时查看所有服务
docker compose logs -f

# 单个服务
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f mcp-server
docker compose logs -f postgres
```

### 9.2 反向代理日志（Caddy）

```bash
sudo journalctl -u caddy -f
# 或
sudo tail -f /var/log/caddy/access.log
```

### 9.3 资源监控

```bash
# 容器资源占用
docker stats

# 磁盘占用
docker system df

# 数据卷大小
docker volume ls
du -sh /var/lib/docker/volumes/agent-log-platform_*
```

### 9.4 关键指标

| 指标 | 查看方式 |
|---|---|
| 数据库大小 | `docker exec postgres psql -c "SELECT pg_size_pretty(pg_database_size('agent_station'));"` |
| 日志条目数 | `curl -H "X-API-Key: $API_KEY" https://agent.example.com/api/v1/markdown/stats` |
| 磁盘剩余 | `df -h` |
| API 响应时间 | 看 Caddy/Nginx access log |

---

## 10. 故障排查

### 10.1 启动失败

```bash
# 查看具体报错
docker compose up  # 不要 -d，直接前台跑看输出

# 看某个服务状态
docker compose ps
docker compose logs api --tail 50
```

常见原因：
- `.env` 中占位符未替换 → 用本文 4.4 节的方法重新生成
- 端口被占用 → `sudo lsof -i :8000` 查谁在用
- Docker 资源不足 → `docker system prune` 清理

### 10.2 数据库迁移失败

```bash
# 看 alembic 报错
docker compose exec api alembic upgrade head

# 如果卡在某个 revision 上面，可以手动查看
docker compose exec postgres psql -U agentstation -d agent_station -c "SELECT * FROM alembic_version;"
```

### 10.3 MCP 连接不上

按顺序排查：

1. **API 健康**：浏览器能打开 `/app` 吗？
2. **MCP 端点**：`curl https://your-domain/mcp/sse?api_key=xxx` 有响应吗？
3. **API Key 正确吗**：去 Agent 管理页面检查该 Agent 的 Key（用 `API_KEY` 作为 admin 可以查看所有 Agent）
4. **反向代理**：MCP 是长连接，Caddy/Nginx 需要禁用 buffering（仓库自带 Caddyfile 已正确配置）

### 10.4 证书申请失败

```bash
sudo journalctl -u caddy -n 100 | grep -i cert
```

常见原因：
- DNS 没解析到服务器（用 `dig agent.example.com` 验证）
- 80 端口被占用或防火墙挡住
- 域名刚注册 / 刚改 DNS，等几分钟再试

### 10.5 数据丢失

```bash
# 1. 立即停止写入操作
docker compose stop api frontend mcp-server

# 2. 检查最近的备份
ls -lt backups/

# 3. 用最近一次备份恢复（见 6.4）
```

### 10.6 性能慢

| 现象 | 排查方向 |
|---|---|
| 页面加载慢 | Caddy 是否配置了 gzip（仓库自带已配）；前端是否有大量日志 |
| API 慢 | `docker stats` 看 API 内存/CPU；`docker compose logs api` 看慢查询 |
| 数据库慢 | `docker exec postgres psql -c "SELECT * FROM pg_stat_activity;"` 看活跃查询 |
| 磁盘满 | `df -h`；清理 Docker `docker system prune -a` |

---

## 附录 A：.env 字段全解

```bash
# === 数据库 ===
POSTGRES_USER=agentstation                 # PG 用户名（容器内部使用）
POSTGRES_PASSWORD=<32 字节随机>            # PG 密码
POSTGRES_DB=agent_station                  # 库名
DATABASE_URL=postgresql://agentstation:<密码>@postgres:5432/agent_station

# === API ===
API_SECRET_KEY=<32 字节随机>               # JWT 签名密钥，丢失 = 所有 Web 会话失效
API_HOST=0.0.0.0                            # 监听地址（一般不用改）
API_PORT=8000                                # 监听端口（一般不用改）
API_KEY=sk-as-<32 字节随机>                  # 管理员 / bootstrap API Key

# === Markdown ===
MARKDOWN_ROOT=/data/markdown                # Agent 写入日志的根目录（容器内路径）

# === 前端 ===
VITE_API_BASE=                              # 留空 = 使用相对路径（自动跟随域名）
VITE_WS_BASE=                               # 留空 = 使用 wss://<当前域名>/ws
```

## 附录 B：常用命令速查

```bash
# 查看服务状态
docker compose ps

# 重启单个服务
docker compose restart api

# 查看日志
docker compose logs -f --tail 100 api

# 进入 API 容器调试
docker compose exec api bash

# 进入数据库
docker compose exec postgres psql -U agentstation -d agent_station

# 备份
./scripts/deploy/backup.sh

# 更新
git pull && docker compose up -d --build && docker compose exec -T api alembic upgrade head

# 完全重置（危险！会丢数据）
docker compose down -v
```

---

**部署遇到问题？** 先看第 10 节故障排查；找不到答案去 [GitHub Issues](https://github.com/bot-naeem/agent-station/issues) 搜/提问。