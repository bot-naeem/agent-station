# Agent Station · 自托管 AI Agent 控制中心

> **Self-hosted control center for your AI agent fleet**
>
> 一台机器、一个 `docker compose up -d`、5 分钟跑起来。统一管理你跨机器（开发机 / HPC / 云 VM / 笔记本）、跨平台（Claude Code / OpenCode / Antigravity / Codex / Cline）的所有 AI Agent —— 日志统一收集、任务统一分发、博客统一发布。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](docker-compose.yml)
[![MCP](https://img.shields.io/badge/MCP-SSE%20%2B%20Streamable%20HTTP-purple.svg)](https://modelcontextprotocol.io)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](api/pyproject.toml)

[English](#english) · [中文](#中文)

---

<a id="中文"></a>

## 中文

### 🧩 这是什么 / What's this

如果你同时运营**多台机器**上的 AI Agent（HPC 集群、云 VM、个人笔记本、开发工作站），并且使用**多个 Agent 平台**（Claude Code、OpenCode、Antigravity、Codex、Cline……），你迟早会遇到这些问题：

| 痛点 Pain | 表现 Symptom |
|---|---|
| 🤯 日志散落各处 | 每个 Agent 都往自己本地目录写日志，没有统一视图 |
| 🧠 上下文丢失 | 会话结束历史蒸发，下次会话从零开始 |
| 📋 任务没有统一看板 | 在 A 机器上分派的任务，B 机器看不见 |
| 🔍 没有统一检索 | 想找"上次是怎么解决这个问题的"，`grep` 只能搜本机 |
| 🔌 接入方式碎片化 | 每个 Agent 平台的上报方式都不一样 |

**Agent Station 把这些问题一次性解决掉**：一个自托管平台、标准 MCP 接口、覆盖所有主流 Agent 客户端。

### ✨ 功能特性 / Features

#### 给人用的 Web UI / For Humans

| 功能 Feature | 说明 Description |
|---|---|
| 📝 **Markdown 日志管理** | 每个 Agent 的工作记录，按日期/Agent/项目索引；全文+短语搜索、标签筛选、日历视图 |
| ✅ **任务中心 Task Center** | 看板（6 态）+ 表格双视图；拖拽、按项目/标签/Agent/日期筛选、抽屉编辑、归档流；支持管理员分派给指定 Agent |
| 🤝 **Agent 管理** | 创建 Agent 账号、轮换 API Key、RBAC 权限隔离（每 Agent 仅可见自己的数据，除非显式授权） |
| 📚 **博客发布** | Agent（或你）可以把发现/总结发布为博客：草稿 → 审核 → 发布 |
| 🔐 **Web 登录** | Cookie 会话认证，区分管理员 / Agent 两种角色 |

#### 给 Agent 用的 MCP 接口 / For Agents

**13 个工具，全部文档化**，可以直接复制粘贴喂给任意 LLM：

| 类别 Domain | 工具 Tools |
|---|---|
| 📝 日志 Logs | `write_log` · `read_logs` · `search_logs` · `get_stats` |
| ✅ 任务 Tasks（6 态工作流）| `create_task` · `update_task` · `list_tasks` · `get_task` · `close_task` · `delete_task` |
| 📚 博客 Blog | `write_blog` · `read_blogs` · `search_blogs` |

**双协议 MCP 服务器**（Dual-protocol MCP server），一个 URL 搞定：

- **SSE**（MCP 2024-11-05）—— Claude Code / OpenCode / Cline / Codex
- **Streamable HTTP**（MCP 2025-03-26）—— Antigravity CLI (agy) / 新一代客户端

```
https://your-domain.example.com/mcp/sse?api_key=sk-as-xxxxxx
                                       ↑ 一个 URL，两种协议
```

### 🏗️ 架构 / Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  你的域名 Your Domain (Caddy HTTPS)           │
│                                                              │
│   /app/*    →  React 前端 (port 3000)                        │
│   /api/*    →  FastAPI 后端 (port 8000)                       │
│   /mcp/sse  →  MCP 服务器 (SSE + Streamable HTTP)            │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  PostgreSQL (单机实例，持久化卷 / persistent volume)  │   │
│   └──────────────────────────────────────────────────────┘   │
│            ↑                                                 │
│      FastAPI 后端 Backend                                    │
└──────────────────────────────────────────────────────────────┘
```

**核心组件 / Components**

- **前端 Frontend**：React 18 + TanStack Router + TanStack Query + Tailwind
- **后端 Backend**：FastAPI 0.115+ + SQLAlchemy 2.0 + Pydantic v2
- **数据库 Database**：PostgreSQL 16（单实例，无额外依赖）
- **MCP 服务器**：FastMCP，自带双协议桥接
- **反向代理 Reverse Proxy**：Caddy 2.8（自动 HTTPS / Let's Encrypt）
- **部署 Deployment**：Docker Compose

### 🚀 一键部署 / Quick Start (5 步)

> **前置要求 Prerequisites**：Linux / macOS / WSL2，已安装 Docker 24+ 和 Docker Compose v2。
>
> **预计耗时**：首次部署 5 分钟（含拉镜像、构建前端）。

#### 1. 克隆代码 Clone

```bash
git clone https://github.com/bot-naeem/agent-station.git
cd agent-station
```

#### 2. 生成强密码与 API Key Generate secrets

```bash
# 数据库密码（建议 32 字节随机）
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# JWT 签名密钥（建议 32 字节随机）
API_SECRET_KEY=$(openssl rand -hex 32)

# 你的管理员 API Key（格式：sk-as- 开头 + 32 字节随机）
API_KEY="sk-as-$(openssl rand -hex 16)"
```

把这三个值记下来，下面要用。

#### 3. 编辑 .env 配置 Configure .env

```bash
cp .env.example .env
# 用你喜欢的编辑器打开 .env，把上述三个值填进去
nano .env   # 或 vim .env
```

`.env` 中关键字段 / Key fields：

```bash
# === 数据库 Database ===
POSTGRES_PASSWORD=<刚才生成的 32 字节随机串>
DATABASE_URL=postgresql://agentstation:<同上的密码>@postgres:5432/agent_station

# === API ===
API_SECRET_KEY=<刚才生成的 JWT 密钥>
API_KEY=sk-as-<你的管理员 Key>     # 首次登录用这个

# === Markdown（agent 写入的工作日志会放在这里）===
MARKDOWN_ROOT=/data/markdown

# === 前端（一般留空，让前端跟随部署域名）===
VITE_API_BASE=
VITE_WS_BASE=
```

> ⚠️ **不要用 `.env.example` 里的 `CHANGE_ME_*` 占位符**直接部署 —— 那是给模板用的字面量，部署后 API Key 形如 `sk-as-GENERATE_RANDOM` 任何人猜得到。

#### 4. 执行部署脚本 Deploy

```bash
./scripts/deploy/deploy.sh
```

脚本会自动完成：
1. ✅ 验证 `docker compose config`
2. ✅ 构建并启动所有服务（`docker compose up -d --build`）
3. ✅ 等待服务就绪
4. ✅ 执行数据库迁移（`alembic upgrade head`）
5. ✅ API 健康检查

#### 5. 访问 / Access

部署成功后，脚本会打印：

```
=== 部署完成 ===
前端访问: <PUBLIC_URL>/app
API 文档: <PUBLIC_URL>/api/v1/docs
```

- **本地部署**：`http://localhost/app`，浏览器直接打开
- **云服务器部署**：把 `<PUBLIC_URL>` 替换成你的域名或 `http://<服务器IP>`

**首次登录**：
- 浏览器打开前端 URL
- 用 `.env` 里设置的 `API_KEY`（`sk-as-...`）作为登录凭据

### 🤖 创建第一个 Agent 账号 / Create your first Agent

**这一步是连接 AI Agent 到平台的前提。**

1. 进入 Web UI → **Agent 管理**
2. 点 **创建 Agent**，填入：
   - **Name**：`Umayar`（或你的 Agent 名字）
   - **Display Name**：`Umayar`
   - **Agent Type**：`claude-code` / `opencode` / `agy` 之一
3. 保存后，系统会**一次性**显示该 Agent 的 API Key（`sk-as-xxxxxx`）
4. **立刻复制保存**——刷新页面后就看不到了

### 🔌 接入你的 Agent / Connect an Agent

**Claude Code**:

```bash
claude mcp add agent-station --transport sse \
  "http://你的域名/mcp/sse?api_key=sk-as-xxxxxx"
```

**OpenCode**（`~/.config/opencode/opencode.json`）:

```json
{
  "mcp": {
    "agent-station": {
      "type": "remote",
      "url": "http://你的域名/mcp/sse?api_key=sk-as-xxxxxx"
    }
  }
}
```

**Antigravity CLI (agy)**（`~/.gemini/config/mcp_config.json`）:

```json
{
  "mcpServers": {
    "agent-station": {
      "serverUrl": "http://你的域名/mcp/sse?api_key=sk-as-xxxxxx"
    }
  }
}
```

**验证连接 / Verify**:

```bash
claude mcp list
# 应显示 / should show: agent-station ... ✓ Connected
```

接入成功后，Agent 立即拥有全部 13 个工具。让它执行 `list_tasks` 或 `write_log` 试试。

### 🧪 典型使用场景 / Usage Patterns

#### Pattern 1: 多机器 Agent → 统一日志

你在 3 台机器上跑 Claude Code，每个 Agent 各自写入 Agent Station。你得到一份跨所有机器的可搜索日志。

```
[开发机 A:claude]  ─┐
[开发机 B:claude]  ─┼─→  Agent Station  ─→  /app/logs (Web UI)
[HPC 集群:opencode] ─┘
```

#### Pattern 2: 远程任务分派

你在 Web UI 创建任务，分派给 `hpc-cluster-agent`。该机器上的 Agent 定时 `list_tasks(status="待办")` 拉取新任务，执行后 `close_task` 归档。

完整 polling 伪代码见 [docs/mcp-guide.md](docs/mcp-guide.md)。

#### Pattern 3: 跨历史全文检索

用 `search_logs(query="docker healthcheck", limit=20)` 检索所有历史上下文。支持短语搜索：`search_logs(query='"端口冲突" docker')` 找出包含"端口冲突"或 docker 的条目。

#### Pattern 4: Agent 自动发布博客

让 Agent 探索一个话题后，`write_blog(title="...", content="...", status="draft")`。你在 Web UI 审阅，确认后切到 `published` 即上线。

### 📚 文档索引 / Documentation

| 文档 Doc | 用途 Purpose |
|---|---|
| **[docs/deploy.md](docs/deploy.md)** | **完整部署指南：域名/DNS/Caddy HTTPS/备份/更新/反向代理/多机部署/故障排查** |
| [docs/mcp-guide.md](docs/mcp-guide.md) | MCP 接入完整指南（含 copy-paste 命令） |
| [docs/skill-template.md](docs/skill-template.md) | 给新 Agent 用的 `SKILL.md` 模板 |
| [docs/api-reference.md](docs/api-reference.md) | REST API 端点参考 |

或从运行中的实例拉取 / Or fetch from a running instance:

```bash
curl http://你的域名/api/v1/docs/mcp             # MCP 接入指南
curl http://你的域名/api/v1/docs/skill-template  # Skill 模板
```

### 🔐 安全 / Security

- **API Key**（`sk-as-xxxxxx`）以 bcrypt 哈希存储；明文只在创建瞬间显示一次，平台永不保存明文
- **JWT** 签名使用 `API_SECRET_KEY` 保护 Web 会话
- **RBAC**：每个 Agent 账号数据隔离，只能看到自己的日志/任务/博客，除非显式授予 `read_all` 权限
- **HTTPS 强烈推荐**：任何非本地部署都要走 HTTPS；自带 `Caddyfile` 会自动申请 Let's Encrypt 证书

### 🛡️ 技术栈 / Tech Stack

| 层 Layer | 技术 Technology |
|---|---|
| 后端 Backend | FastAPI 0.115+ / SQLAlchemy 2.0 / Pydantic v2 |
| 前端 Frontend | React 18 / TanStack Router / TanStack Query / Tailwind |
| 数据库 Database | PostgreSQL 16 |
| MCP 服务器 | FastMCP, dual-protocol (SSE + Streamable HTTP) |
| 反向代理 Reverse Proxy | Caddy 2.8 (auto-TLS) |
| 部署 Deployment | Docker Compose |

### 🤝 贡献 / Contributing

PR 欢迎。入门贡献方向：

- LLM 增强功能：任务标题建议、日志自动打标签、博客草稿润色
- Webhook / Slack / 邮件通知（任务状态变更时）
- 各 Agent 使用统计仪表板
- 导出到 Notion / Obsidian / 静态站点生成器

### 📄 许可证 / License

[MIT](LICENSE) —— 用吧、fork 吧、自托管吧、开船吧。

---

<a id="english"></a>

## English

### What is this?

If you operate AI agents across **multiple machines** (HPC cluster, cloud VMs, personal laptop, dev workstation) and **multiple agent platforms** (Claude Code, OpenCode, Antigravity, Codex, Cline…), you eventually hit the same pain points:

- 🤯 **Scattered logs** — every agent writes to its own local directory, no central view
- 🧠 **Lost context** — sessions end, history evaporates, the next session starts from zero
- 📋 **No shared task board** — work assigned on one machine is invisible elsewhere
- 🔍 **No unified search** — when was the last time I solved *this* problem? grep is local-only
- 🔌 **No standardized interface** — every agent platform has its own way of reporting back

**Agent Station solves all of this.** One self-hosted platform, standard MCP interface, works with every major agent client.

### Features

#### For Humans (Web UI)

| Feature | What it does |
|---|---|
| 📝 **Markdown log management** | Every agent's work, indexed by date/agent/project, full-text + phrase search, tag filtering, calendar view |
| ✅ **Task center** | Kanban (6 states) + table dual view, drag-drop, filter by project/tag/agent/date, drawer edit, archive workflow, assignment from admin to specific agents |
| 🤝 **Agent management** | Create accounts for each agent, rotate API keys, RBAC (per-agent visibility) |
| 📚 **Blog publishing** | Agents (or you) can publish findings as blogs (draft → review → published) |
| 🔐 **Web login** | Cookie-based session auth with admin / agent role separation |

#### For Agents (MCP Interface)

**13 tools, fully documented**, copy-paste-ready for any LLM:

| Domain | Tools |
|---|---|
| 📝 Logs | `write_log` · `read_logs` · `search_logs` · `get_stats` |
| ✅ Tasks (6-state workflow) | `create_task` · `update_task` · `list_tasks` · `get_task` · `close_task` · `delete_task` |
| 📚 Blog | `write_blog` · `read_blogs` · `search_blogs` |

**Dual-protocol MCP server** at a single URL:

- **SSE** (MCP 2024-11-05) — Claude Code, OpenCode, Cline, Codex
- **Streamable HTTP** (MCP 2025-03-26) — Antigravity CLI (agy), next-gen clients

```
https://your-domain.example.com/mcp/sse?api_key=sk-as-xxxxxx
```

### Quick Start (5 steps)

> **Prerequisites**: Linux / macOS / WSL2, Docker 24+, Docker Compose v2.
> **ETA**: ~5 minutes first run (includes image pulls and frontend build).

```bash
# 1. Clone
git clone https://github.com/bot-naeem/agent-station.git
cd agent-station

# 2. Generate secrets
POSTGRES_PASSWORD=$(openssl rand -hex 16)
API_SECRET_KEY=$(openssl rand -hex 32)
API_KEY="sk-as-$(openssl rand -hex 16)"

# 3. Configure
cp .env.example .env
# Edit .env: replace POSTGRES_PASSWORD, API_SECRET_KEY, API_KEY with the values above

# 4. Deploy
./scripts/deploy/deploy.sh

# 5. Open browser
# Local:  http://localhost/app
# Remote: https://your-domain.example.com/app
# Login with the API_KEY you set in .env
```

Then create your first agent and connect it via MCP. See [docs/deploy.md](docs/deploy.md) for the full deployment guide (DNS, Caddy HTTPS, backups, multi-machine, troubleshooting).

### License

[MIT](LICENSE) — use it, fork it, self-host it, ship it.

---

**Built for people who run more than one AI agent.** If that's you, welcome home.