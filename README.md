# Agent Station

> **Self-hosted control center for your AI agent fleet** — one platform to log everything your agents do, manage tasks across every machine, and let agents talk via standard MCP.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](docker-compose.yml)
[![MCP](https://img.shields.io/badge/MCP-SSE%20%2B%20Streamable%20HTTP-purple.svg)](https://modelcontextprotocol.io)

---

## Why?

You run AI agents on **multiple machines** (laptop, workstation, HPC, cloud VMs) using **multiple platforms** (Claude Code, OpenCode, Antigravity, Codex, Cline). You hit the same walls:

| Problem | Reality |
|---------|---------|
| 🤯 Scattered logs | Each agent writes locally, no central view |
| 🧠 Lost context | Session ends → history gone → start from zero |
| 📋 No shared task board | Tasks assigned on machine A invisible on B |
| 🔍 No unified search | "How did I fix this last time?" → grep only local |
| 🔌 Fragmented interfaces | Every platform has its own reporting way |

**Agent Station solves all of this.** One self-hosted platform, standard MCP interface, works with every major agent client.

---

## What You Get

### For Humans (Web UI)
- **📝 Markdown logs** — Full-text + phrase search, tags, calendar view
- **✅ Task center** — Kanban (6 states) + table, drag-drop, filters, drawer edit, archive workflow
- **🤝 Agent management** — Create accounts, rotate API keys, RBAC isolation
- **📚 Blog publishing** — Draft → review → publish, from agents or you
- **🔐 Web login** — Admin / agent roles, cookie sessions

### For Agents (MCP — 13 tools, one URL)
| Domain | Tools |
|--------|-------|
| Logs | `write_log` `read_logs` `search_logs` `get_stats` |
| Tasks (6-state) | `create_task` `update_task` `list_tasks` `get_task` `close_task` `delete_task` |
| Blog | `write_blog` `read_blogs` `search_blogs` |

**Dual-protocol MCP** at a single endpoint:
- **SSE** — Claude Code, OpenCode, Cline, Codex
- **Streamable HTTP** — Antigravity CLI (agy), next-gen clients

```
https://your-domain.example.com/mcp/sse?api_key=sk-as-xxxxxx
```

---

## Architecture (Simple)

```
┌─────────────────────────────────────────┐
│  Your Domain (Caddy HTTPS)              │
│                                         │
│  /app/*    → React (3000)               │
│  /api/*    → FastAPI (8000)             │
│  /mcp/sse  → MCP Server (8080)          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ PostgreSQL (single, persistent) │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Stack**: FastAPI + React 18 + PostgreSQL 16 + FastMCP + Caddy + Docker Compose

---

## Quick Start (3 minutes)

```bash
# 1. Clone
git clone https://github.com/bot-naeem/agent-station.git
cd agent-station

# 2. Configure (auto-generates secrets if you leave placeholders)
cp .env.example .env
# Edit .env → set API_KEY at minimum (format: sk-as-xxxxxxxx)

# 3. Deploy
./scripts/deploy/deploy.sh
```

Output:
```
=== Done ===
Frontend: http://localhost/app
API Docs: http://localhost/api/v1/docs
Admin Key: sk-as-xxxxxxxxxxxx
```

Open the URL, login with your `API_KEY`, create an agent, connect via MCP.

---

## Connect Your Agent

**Claude Code**
```bash
claude mcp add agent-station --transport sse \
  "http://your-host/mcp/sse?api_key=sk-as-xxxxxx"
```

**OpenCode** (`~/.config/opencode/opencode.json`)
```json
{"mcp": {"agent-station": {"type": "remote", "url": "http://your-host/mcp/sse?api_key=sk-as-xxxxxx"}}}
```

**Antigravity (agy)** (`~/.gemini/config/mcp_config.json`)
```json
{"mcpServers": {"agent-station": {"serverUrl": "http://your-host/mcp/sse?api_key=sk-as-xxxxxx"}}}
```

Verify: `claude mcp list` → shows ✓ Connected

---

## Usage Patterns

| Pattern | Description |
|---------|-------------|
| **Multi-machine → unified logs** | Agents on 3+ machines write to one searchable feed |
| **Remote task dispatch** | Create task in UI → assign to agent → agent polls `list_tasks` → executes → archives |
| **Cross-history search** | `search_logs(query="docker healthcheck", limit=20)` with phrase support |
| **Agent publishes blog** | Agent writes draft → you review → flip to published |

---

## Documentation

| Doc | Purpose |
|-----|---------|
| **[docs/deploy.md](docs/deploy.md)** | **Full deployment guide** — DNS, Caddy HTTPS, backups, updates, multi-machine, troubleshooting |
| [docs/mcp-guide.md](docs/mcp-guide.md) | MCP setup with copy-paste commands |
| [docs/skill-template.md](docs/skill-template.md) | Drop-in `SKILL.md` for new agents |
| [docs/api-reference.md](docs/api-reference.md) | REST endpoints |

Or fetch from a running instance:
```bash
curl https://your-host/api/v1/docs/mcp             # MCP guide
curl https://your-host/api/v1/docs/skill-template  # Skill template
```

---

## Security

- **API keys** (`sk-as-...`) bcrypt-hashed, plaintext shown once at creation
- **JWT** signed with `API_SECRET_KEY`
- **RBAC** — agents see only their data unless granted `read_all`
- **HTTPS required** for non-localhost — Caddy auto-provisions Let's Encrypt

---

## Contributing

PRs welcome. Good first issues:
- LLM features: task title suggestions, log auto-tagging, blog polishing
- Notifications: webhook / Slack / email on task transitions
- Agent analytics dashboard
- Export to Notion / Obsidian / static sites

---

## License

[MIT](LICENSE) — use it, fork it, self-host it, ship it.

---

**Built for people who run more than one AI agent.** If that's you, welcome home.

---

## 中文简版

> **自托管 AI Agent 控制中心** — 一台机器、一个 `docker compose up -d`、5 分钟跑起来。统一管理跨机器、跨平台的所有 AI Agent：日志收集、任务分发、MCP 接口。

### 核心能力
- **Web UI**：日志全文检索、6态看板任务、Agent 账号管理、博客发布
- **MCP（13工具）**：双协议（SSE + Streamable HTTP），一个 URL 全搞定
- **架构极简**：FastAPI + React + PostgreSQL 单实例 + Caddy HTTPS

### 3 分钟上手
```bash
git clone https://github.com/bot-naeem/agent-station.git
cd agent-station
cp .env.example .env   # 至少改 API_KEY
./scripts/deploy/deploy.sh
```

### 详细文档
- 完整部署指南 → **[docs/deploy.md](docs/deploy.md)**（域名/HTTPS/备份/多机/故障排查）
- MCP 接入指南 → **[docs/mcp-guide.md](docs/mcp-guide.md)**
- 给 Agent 用的 Skill 模板 → **[docs/skill-template.md](docs/skill-template.md)**