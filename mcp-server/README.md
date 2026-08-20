# Agent Log Platform - MCP Server

MCP (Model Context Protocol) server providing standardized access to the Agent Log Platform for AI agents (Claude Code, Codex, OpenCode, Continue, Cline, etc.).

## Features

| Tool | Description |
|------|-------------|
| `write_log` | Write markdown log entries |
| `read_logs` | Read recent logs with filtering |
| `rag_query` | RAG-powered Q&A over stored logs |
| `search_logs` | Full-text search across logs |
| `get_stats` | Statistics dashboard data |

## Quick Start

### 1. Local Development
```bash
cd mcp-server
pip install -r requirements.txt
export ALP_API_KEY=sk-agent-log-xxxxxxxx
export ALP_API_BASE=https://codingfamily.online/api/v1
python server.py
# Server runs on http://localhost:8080/sse
```

### 2. Docker
```bash
docker build -t alp-mcp .
docker run -d --name alp-mcp \
  -e ALP_API_KEY=sk-agent-log-xxxxxxxx \
  -e ALP_API_BASE=https://codingfamily.online/api/v1 \
  -p 8080:8080 \
  alp-mcp
```

### 3. Docker Compose (with main platform)
```yaml
# In root docker-compose.yml
mcp-server:
  build: ./mcp-server
  env_file: .env
  environment:
    - ALP_API_BASE=http://api:8000
  ports:
    - "127.0.0.1:8080:8080"
  depends_on:
    - api
```

## Agent Integration

### Claude Code
```bash
claude mcp add agent-log --transport sse http://your-server:8080/sse
```

### Codex
```bash
codex mcp add agent-log --url http://your-server:8080/sse
```

### OpenCode
```json
// ~/.config/opencode/mcp.json
{
  "mcpServers": {
    "agent-log": {
      "type": "sse",
      "url": "http://your-server:8080/sse"
    }
  }
}
```

### Continue (VS Code / JetBrains)
```json
// .continue/config.json
{
  "mcpServers": {
    "agent-log": {
      "transport": "sse",
      "url": "http://your-server:8080/sse"
    }
  }
}
```

### Cline / Roo Code (VS Code)
Same as Continue - add SSE URL in extension settings.

### Generic Python Client
```python
from mcp.client.fastmcp import FastMCPClient

client = FastMCPClient("http://your-server:8080/sse")
await client.initialize()

# Call tools
log_id = await client.call_tool("write_log", {
    "title": "Test from Python",
    "content": "Hello MCP!",
    "tags": ["test", "python"]
})
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALP_API_KEY` | Yes | - | Platform API key (sk-agent-log-...) |
| `ALP_API_BASE` | No | `https://codingfamily.online/api/v1` | Platform API base URL |
| `MCP_PORT` | No | `8080` | Server port |

## Security Notes

- **Never expose MCP server directly to public internet** without auth
- Run behind VPN/Tailscale/Cloudflare Tunnel for remote access
- API key only lives in server env, not shared with agents
- Consider adding mTLS or API gateway for production

## Health Check
```bash
curl http://localhost:8080/sse
# Should return SSE stream headers
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ALP_API_KEY not set` | Export in shell or `.env` file |
| Connection refused | Check port 8080, firewall, Docker network |
| Tools not showing in agent | Restart agent after `mcp add` |
| SSE timeout | Increase client timeout, check network latency |