"""MCP Server for Agent Log Platform - Dual Protocol (SSE + Streamable HTTP)"""
import os
import contextvars
import contextlib
import httpx
import anyio
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
import uvicorn

# Config from env
API_BASE = os.getenv("AS_API_BASE", "http://localhost:8000/api/v1")
API_KEY = os.getenv("AS_API_KEY")
if not API_KEY:
    raise RuntimeError("AS_API_KEY environment variable is required")

# Context variable for per-connection API key (fallback to env API_KEY)
_current_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar("_current_api_key", default=None)


def _get_headers() -> dict[str, str]:
    """Get headers with current connection's API key (fallback to env key)."""
    api_key = _current_api_key.get() or API_KEY
    return {"X-API-Key": api_key, "Content-Type": "application/json"}


async def _validate_api_key(request: Request) -> str | JSONResponse:
    """Extract and validate API key from query params or header. Returns API key string on success, JSONResponse on failure."""
    api_key = request.query_params.get("api_key") or request.headers.get("X-API-Key")
    if not api_key:
        return JSONResponse({"error": "Missing api_key parameter"}, status_code=401)

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/agents/me", headers={"X-API-Key": api_key})
        if resp.status_code != 200:
            return JSONResponse({"error": "Invalid API key"}, status_code=401)

    return api_key


mcp = FastMCP("agent-station")


@mcp.tool()
async def write_log(
    title: str,
    content: str,
    log_date: str = "",
    tags: list[str] = [],
    project: str = "",
    task_type: str = "",
) -> str:
    """Record a work log entry to the platform. Call this at the end of every significant task or session. Your identity (agent name) is automatically bound to your API key - do NOT try to specify it.

    Args:
        title: One-line summary of what was done, in Chinese, e.g. "修复登录页白屏问题"
        content: Full log body in Markdown (Chinese). Use this structure: \
## 背景\n为什么做这件事 \n## 操作步骤\n关键步骤和命令 \n## 结果\n最终效果/验证方式 \n## 踩坑与经验\n遇到的问题及解法
        log_date: The date this work happened, format "YYYY-MM-DD". \
Omit or leave empty for today. MUST set this when recording work completed on an earlier day, otherwise it will be filed under today.
        tags: 2-5 short keywords for later retrieval, e.g. ["部署", "docker", "网关"]
        project: Optional project/module name this work belongs to, e.g. "agent-station"
        task_type: Optional category: one of 开发/调试/部署/调研/运维/文档
    Returns:
        The created log ID (UUID string)
    """
    from datetime import date as _date

    parsed_date = None
    if log_date.strip():
        try:
            parsed_date = _date.fromisoformat(log_date.strip())
        except ValueError:
            raise ValueError(f"log_date 格式错误: '{log_date}'，需要 YYYY-MM-DD，例如 2026-08-22")

    front_matter: dict = {"tags": tags}
    if project.strip():
        front_matter["project"] = project.strip()
    if task_type.strip():
        front_matter["task_type"] = task_type.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{API_BASE}/markdown",
            headers=_get_headers(),
            json={
                "title": title,
                "content": content,
                "log_date": parsed_date.isoformat() if parsed_date else None,
                "front_matter": front_matter,
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]


@mcp.tool()
async def read_logs(
    limit: int = 10,
    agent_name: str = "",
    start_date: str = "",
    end_date: str = "",
) -> dict:
    """Read work logs, newest first. Each entry includes agent_name telling you WHO wrote it.

    Args:
        limit: Max number of logs to return (default 10, max 100)
        agent_name: Exact agent display_name to filter by, e.g. "Umayar". Leave empty to see all logs within your permission scope.
        start_date: Only logs on/after this date, "YYYY-MM-DD" (inclusive, UTC)
        end_date: Only logs on/before this date, "YYYY-MM-DD" (inclusive, UTC). Tip: to read ALL logs of ONE specific day, pass the SAME date as both start_date and end_date.
    Returns:
        {"total": N, "count": M, "items": [log objects]} - items is ALWAYS a complete JSON array (one entry per log: id, title, summary, agent_name, agent_type, log_date, file_path). Never truncated.
        NOTE: items contain title + summary ONLY (no full body). Call read_log_detail(id) for the full Markdown content.
    """
    params: dict = {"page_size": max(1, min(limit, 100))}
    if agent_name.strip():
        params["agent_name"] = agent_name.strip()
    if start_date.strip():
        params["start_date"] = start_date.strip()
    if end_date.strip():
        params["end_date"] = end_date.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/markdown", headers=_get_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()
        return {"total": data["total"], "count": len(data["items"]), "items": data["items"]}


@mcp.tool()
async def search_logs(
    query: str,
    limit: int = 10,
    agent_name: str = "",
    start_date: str = "",
    end_date: str = "",
) -> dict:
    """Full-text keyword search across log titles and summaries. Combine with read_logs to answer open questions about history.

    Search syntax:
      - Multiple words are AND-ed by default: "nginx 部署" = nginx AND 部署
      - Use double quotes for exact phrase: "\"youtube transcript\"" matches the exact phrase
      - Chinese/English mixed supported

    Args:
        query: Keyword(s) to search, e.g. "nginx" or "登录 白屏" or "\"youtube transcript\""
        limit: Max results (default 10)
        agent_name: Exact agent display_name to filter by, e.g. "Umayar"
        start_date: Only logs on/after this date, "YYYY-MM-DD" (inclusive, UTC)
        end_date: Only logs on/before this date, "YYYY-MM-DD" (inclusive, UTC)
    Returns:
        {"total": N, "count": M, "items": [matching log objects]} - items is ALWAYS a complete JSON array, never truncated.
        NOTE: items contain title + summary ONLY (no full body). Call read_log_detail(id) for the full Markdown content.
    """
    params: dict = {"query": query, "page_size": max(1, min(limit, 100))}
    if agent_name.strip():
        params["agent_name"] = agent_name.strip()
    if start_date.strip():
        params["start_date"] = start_date.strip()
    if end_date.strip():
        params["end_date"] = end_date.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/markdown", headers=_get_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()
        return {"total": data["total"], "count": len(data["items"]), "items": data["items"]}


@mcp.tool()
async def read_log_detail(id: str) -> dict:
    """Read ONE log's full Markdown body by its id (get the id from read_logs / search_logs first).

    Args:
        id: Log UUID (required), e.g. "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    Returns:
        Full log object including content (complete Markdown body), title, summary,
        agent_name, log_date, file_path, tags/project/task_type (front_matter).
    """
    if not id.strip():
        raise ValueError("需要提供日志 id（从 read_logs / search_logs 的 items[].id 获取）")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{API_BASE}/markdown/{id.strip()}", headers=_get_headers())
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def get_stats(start_date: str = "", end_date: str = "", agent_name: str = "") -> dict:
    """Get aggregated statistics of stored logs: totals, per-agent counts, per-date counts, top tags.

    Args:
        start_date: Range start "YYYY-MM-DD" (optional)
        end_date: Range end "YYYY-MM-DD" (optional)
        agent_name: Optional exact agent name to count only that agent's output, e.g. "Umayar"
    Returns:
        Stats object: total_logs, by_agent, by_date, top_tags
    """
    params: dict = {}
    if start_date.strip():
        params["start_date"] = start_date.strip()
    if end_date.strip():
        params["end_date"] = end_date.strip()
    if agent_name.strip():
        params["agent_name"] = agent_name.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/markdown/stats", headers=_get_headers(), params=params)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def list_agents() -> dict:
    """List all accessible agents for filtering. Use this to get valid agent display_names before filtering logs.

    Returns:
        {"agents": [{"name": "agent-name", "display_name": "显示名", "agent_type": "类型", "last_used_at": "ISO时间"}]} - only agents readable by current API key (based on permissions)
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/agents/readable", headers=_get_headers())
        resp.raise_for_status()
        data = resp.json()
        agents = [
            {
                "name": a.get("name"),
                "display_name": a.get("display_name"),
                "agent_type": a.get("agent_type"),
                "last_used_at": a.get("last_used_at"),
            }
            for a in data.get("items", [])
        ]
        return {"agents": agents}


# SSE Transport for MCP clients (Claude Code)
sse = SseServerTransport("messages/")

# Session API key store: session_id -> api_key
_session_api_keys: dict[str, str] = {}


async def handle_sse(request):
    # Extract api_key from query params or X-API-Key header (parity with Streamable HTTP handler)
    api_key = request.query_params.get("api_key") or request.headers.get("x-api-key")
    if not api_key:
        return JSONResponse({"error": "Missing api_key parameter"}, status_code=401)

    # Validate the API key against backend
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/agents/me", headers={"X-API-Key": api_key})
        if resp.status_code != 200:
            return JSONResponse({"error": "Invalid API key"}, status_code=401)

    token = _current_api_key.set(api_key)
    try:
        async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
            # After connect_sse creates the session, store the API key for this session
            # The session_id is the last key added to sse._sessions
            if hasattr(sse, '_sessions') and sse._sessions:
                # Get the most recently created session (the one we just created)
                session_id = list(sse._sessions.keys())[-1]
                _session_api_keys[session_id] = api_key
            await mcp._mcp_server.run(streams[0], streams[1], mcp._mcp_server.create_initialization_options())
    finally:
        _current_api_key.reset(token)


# Custom handler for /messages/ that restores API key from session
class MessagesAuthApp:
    """ASGI app wrapper for sse.handle_post_message with API key restoration from session."""

    def __init__(self, transport: SseServerTransport):
        self.transport = transport

    async def __call__(self, scope, receive, send):
        # Only handle HTTP POST requests
        if scope["type"] != "http" or scope.get("method") != "POST":
            await send({"type": "http.response.start", "status": 405, "headers": []})
            await send({"type": "http.response.body", "body": b"Method Not Allowed"})
            return

        # Extract session_id from query params
        query_string = scope.get("query_string", b"").decode()
        session_id = None
        for pair in query_string.split("&"):
            if pair.startswith("session_id="):
                session_id = pair.split("=", 1)[1]
                break

        # Restore API key from session store
        api_key = None
        if session_id and session_id in _session_api_keys:
            api_key = _session_api_keys[session_id]

        if api_key:
            token = _current_api_key.set(api_key)
            try:
                await self.transport.handle_post_message(scope, receive, send)
            finally:
                _current_api_key.reset(token)
        else:
            # No API key found, still try to handle (may work for stateless operations)
            await self.transport.handle_post_message(scope, receive, send)


messages_auth_app = MessagesAuthApp(sse)


# Streamable HTTP Transport for MCP clients (Antigravity CLI, newer clients)
# Stateless session manager - each request is independent
session_manager = StreamableHTTPSessionManager(
    app=mcp._mcp_server,
    json_response=True,  # Return JSON directly instead of SSE
    stateless=True,      # Stateless mode - no session persistence
)


class StreamableHTTPAuthApp:
    """ASGI app wrapper for StreamableHTTPSessionManager with API key validation."""

    def __init__(self, manager: StreamableHTTPSessionManager):
        self.manager = manager

    async def __call__(self, scope, receive, send):
        # Only handle HTTP POST requests
        if scope["type"] != "http" or scope.get("method") != "POST":
            await send({"type": "http.response.start", "status": 405, "headers": []})
            await send({"type": "http.response.body", "body": b"Method Not Allowed"})
            return

        # Extract query params from scope
        query_string = scope.get("query_string", b"").decode()
        query_params = {}
        for pair in query_string.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                query_params[k] = v

        # Also check headers for X-API-Key
        headers = dict(scope.get("headers", []))
        api_key = query_params.get("api_key") or headers.get(b"x-api-key", b"").decode()

        if not api_key:
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({"type": "http.response.body", "body": b'{"error": "Missing api_key parameter"}'})
            return

        # Validate API key
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{API_BASE}/agents/me", headers={"X-API-Key": api_key})
            if resp.status_code != 200:
                await send({
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [(b"content-type", b"application/json")],
                })
                await send({"type": "http.response.body", "body": b'{"error": "Invalid API key"}'})
                return

        # Set API key in context for tool execution
        token = _current_api_key.set(api_key)
        try:
            await self.manager.handle_request(scope, receive, send)
        finally:
            _current_api_key.reset(token)


streamable_http_app = StreamableHTTPAuthApp(session_manager)


@contextlib.asynccontextmanager
async def lifespan(app: Starlette):
    """Lifespan handler that runs the streamable HTTP session manager."""
    async with session_manager.run():
        yield


app = Starlette(
    routes=[
        # SSE endpoints (Claude Code compatibility)
        Route("/sse", endpoint=handle_sse, methods=["GET"]),
        Mount("/sse", app=streamable_http_app),  # Streamable HTTP on /sse (Antigravity) - POST only
        Mount("/messages/", app=messages_auth_app),
        # Streamable HTTP endpoint at root (for /mcp after Caddy strips prefix)
        Mount("/", app=streamable_http_app),  # POST only
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)