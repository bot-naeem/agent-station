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

> **MCP alone = tools available. Skill = agent knows when/how to use them.** Both configured once, permanent.

---

## Agent Skill — Enable This to Make MCP Actually Useful (Strongly Recommended)

If you only configure MCP above, your agent **can** see the 13 tools (`write_log`, `list_tasks`, etc.) but **doesn't know** when to call them, what log format to use, or how the 6-state task lifecycle works — you'll have to instruct it every session. **The Skill fixes this.** One file teaches the agent the full platform protocol, so it logs, manages tasks, and recovers context autonomously.

### What the Skill Does
- **Auto context recovery on invocation** (`/<your-skill>`): calls `list_tasks` (active tasks) + `read_logs` (last 5) and reports status — so you never start from zero.
- **Built-in 13-tool manual** (no fetch needed): exact params/rules for `write_log` / `read_logs` / `search_logs` / `get_stats` + 6 task tools + 3 blog tools.
- **Log discipline**: one log per task/phase, `title` / `tags` / `content` structure (`Background / Steps / Result / Pitfalls`), required `task_type` (`dev/debug/deploy/research/ops/docs`).
- **Task workflow**: `待办 → 进行中 → 阻塞/挂起 → 完成/废弃` — `create_task` → `update_task` → `close_task` (requires `result`), `status_history` auto-tracked.
- **Pitfall handling**: `404 session` reconnect, 30KB+ truncation retry, upgrade window retries.

### MCP vs Skill

| Layer | What it is | Required | Analogy |
|-------|------------|----------|---------|
| **MCP** (`/mcp/sse?api_key=sk-as-...`) | Wires the 13 tools into Claude Code / OpenCode / Antigravity | Yes | Giving a worker the toolbox |
| **Skill** (`~/.claude/skills/<name>/SKILL.md`) | Tells the worker *when/how* to use each tool | **Strongly recommended** | Giving the worker the **operations manual** |

> **Recommendation:** Always enable **both**. With Skill enabled, after any important task the agent will *proactively* call `write_log` without you prompting; without it, you must remind it each time.

### Enable in 2 Minutes

**1. Get the template** (any of these):
- Web UI: `Agent Management` page → **Skill Template** button (copy full text, includes live MCP URL)
- API (for your agent to self-fetch): `curl https://your-host/api/v1/docs/skill-template`
- Repo: [`docs/skill-template.md`](docs/skill-template.md)

**2. Fill and save** (template has 3 sections):
- **① Identity** (`Name`, `Vibe`, `Creature`, etc.) — fill your persona, keep tone requirements.
- **② Platform Protocol** — **do not edit** (already contains the 13-tool table and specs).
- **③ Custom** — delete/playbook examples you don't need, add your own playbooks / ops rules.

Save as:
```bash
# Choose a short name, e.g. "station" or your agent's name
mkdir -p ~/.claude/skills/station
# paste the filled template
$EDITOR ~/.claude/skills/station/SKILL.md
```

For **OpenCode** the same file also works if you keep Claude-compatible skills path; otherwise keep the MCP config at `~/.config/opencode/opencode.json` and still use the Skill file for behavioral rules via system prompt injection.

**3. Verify**:
```bash
claude mcp list   # must show: agent-station ✓ Connected  (MCP OK)
```
Then in a new Claude session type `/station` (or `/<your-name>`) — the agent should report persona, call `list_tasks` + `read_logs`, and enter standby. If not, check the file path and that frontmatter `name` matches the slash command.

### Without vs With Skill

| Without Skill (MCP only) | With Skill (MCP + SKILL.md) |
|--------------------------|------------------------------|
| You: "please write_log for what you just did..." every time | Agent: finishes task → *automatically* `write_log` with correct format |
| Agent forgets history after session restart | `/station` → agent restores `list_tasks` + recent logs and continues |
| Task `close_task` often missing `result` → archived view broken | `result` always provided, `status_history` complete |

> The Skill Template already embeds the correct MCP URLs and 13-tool specs — you never need to `web-fetch` anything after the initial save.

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
### 🌐 配置公网访问

首次在本机局域网成功运行后，想在其他机器或互联网访问，请运行：

```bash
./scripts/deploy/setup-domain.sh
```

按照交互提示输入域名或 IP。脚本只做前置检查和模板生成，**真正的配置（开放防火墙端口、确保域名解析、申请 HTTPS 证书）请在脚本输出的「后置步骤」里自行完成**。

使用 MCP 接入时，请使用脚本最后打印的 API_BASE URL，如：

```bash
claude mcp add agent-station --transport sse \
  "$(grep '^VITE_API_BASE=' .env)/mcp/sse?api_key=sk-as-xxxxxx"
```
