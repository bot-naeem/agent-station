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
API_BASE = os.getenv("ALP_API_BASE", "https://codingfamily.online/api/v1")
API_KEY = os.getenv("ALP_API_KEY")
if not API_KEY:
    raise RuntimeError("ALP_API_KEY environment variable is required")

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


mcp = FastMCP("agent-log-platform")


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
        project: Optional project/module name this work belongs to, e.g. "agent-log-platform"
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
) -> list[dict]:
    """Read work logs, newest first. Each entry includes agent_name telling you WHO wrote it.

    Args:
        limit: Max number of logs to return (default 10, max 100)
        agent_name: Exact agent display name to filter by, e.g. "Umayar". \
Leave empty to see all logs within your permission scope.
        start_date: Only logs on/after this date, "YYYY-MM-DD"
        end_date: Only logs on/before this date, "YYYY-MM-DD". \
TIP: to read ALL logs of ONE specific day, pass the SAME date as both start_date and end_date.
    Returns:
        {"total": N, "count": M, "items": [log objects]} - items is ALWAYS a complete JSON array \
(one entry per log: id, title, summary, agent_name, agent_type, log_date, file_path). Never truncated to one item.
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
) -> list[dict]:
    """Full-text keyword search across log titles and summaries. Combine with read_logs to answer open questions about history.

    Args:
        query: Keyword(s) to search, e.g. "nginx" or "登录 白屏"
        limit: Max results (default 10)
        agent_name: Exact agent name to filter by, e.g. "Umayar"
        start_date: Only logs on/after this date, "YYYY-MM-DD"
        end_date: Only logs on/before this date, "YYYY-MM-DD"
    Returns:
        {"total": N, "count": M, "items": [matching log objects]} - items is ALWAYS a complete JSON array, never truncated.
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
async def get_stats(start_date: str = "", end_date: str = "", agent_name: str = "") -> dict:
    """Get aggregated statistics of stored logs: totals, per-agent counts, per-date counts, top tags.

    Args:
        start_date: Range start "YYYY-MM-DD" (optional)
        end_date: Range end "YYYY-MM-DD" (optional)
        agent_name: Optional exact agent name to count only that agent's output, e.g. "Umayar"
    Returns:
        Stats object: total_logs, total_tokens, by_agent, by_date, top_tags
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


# ────────────────────────── 任务管理（六态工作流）──────────────────────────


@mcp.tool()
async def create_task(
    title: str,
    detail: str = "",
    tags: list[str] = [],
    project: str = "",
    status: str = "待办",
) -> dict:
    """Create a task. Your identity is auto-bound to your API key.

    Status is one of six states: 待办 / 进行中 / 阻塞 / 挂起 / 完成 / 废弃 (default 待办).
    Duplicate title within your account will be REJECTED (409) - never overwrites existing tasks.
    Tasks default to active view; use close_task when finished (with a result summary).

    Args:
        title: Unique human-readable task name (required), e.g. "修复网关超时"
        detail: Optional multi-line Markdown details: sub-bullets, code blocks, paths, session names
        tags: Optional keywords for retrieval
        project: Optional project name
        status: Initial status, default "待办"
    Returns:
        Full task object including id and status_history
    """
    body: dict = {"title": title, "status": status}
    if detail.strip():
        body["detail"] = detail
    if tags:
        body["tags"] = tags
    if project.strip():
        body["project"] = project.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{API_BASE}/tasks", headers=_get_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def update_task(
    id: str = "",
    title: str = "",
    new_title: str = "",
    status: str = "",
    detail: str = "",
    tags: list[str] = [],
    project: str = "",
) -> dict:
    """Partially update a task - fields you omit stay unchanged. Locate by id OR title (either one).

    When status changes, the change is appended to status_history automatically.
    Renaming to an existing title returns 409 conflict.
    Valid statuses: 待办 / 进行中 / 阻塞 / 挂起 / 完成 / 废弃. Terminal states (完成/废弃) cannot transition again.

    Args:
        id: Task UUID (preferred locator). Leave empty if using title.
        title: Locator alternative to id - the CURRENT title of the task.
        new_title: New title if renaming (omit to keep current)
        status: New status (omit to keep current)
        detail: New Markdown detail (omit to keep current). Pass full replacement text - omitted means unchanged.
        tags: New tags array (replaces all; omit to keep current)
        project: New project name (omit to keep current)
    Returns:
        Updated full task object with status_history
    """
    if not id.strip() and not title.strip():
        raise ValueError("定位任务需要提供 id 或 title 之一")

    target_id = id.strip()
    if not target_id:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{API_BASE}/tasks",
                headers=_get_headers(),
                params={"limit": 200},
            )
            resp.raise_for_status()
            items = resp.json()["items"]
            matches = [t for t in items if t["title"].lower() == title.strip().lower()]
            if not matches:
                raise ValueError(f"找不到任务: title={title}")
            target_id = matches[0]["id"]

    body: dict = {}
    if new_title.strip():
        body["title"] = new_title.strip()
    if status.strip():
        body["status"] = status.strip()
    if detail:
        body["detail"] = detail
    if tags:
        body["tags"] = tags
    if project.strip():
        body["project"] = project.strip()
    if not body:
        raise ValueError("没有提供任何要更新的字段（new_title/status/detail/tags/project 至少传一个）")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.patch(f"{API_BASE}/tasks/{target_id}", headers=_get_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def list_tasks(
    status: str = "",
    agent_name: str = "",
    project: str = "",
    tag: str = "",
    updated_since: str = "",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List tasks. THE core tool for restoring work context.

    Default returns only ACTIVE states (进行中/阻塞/待办/挂起), sorted 进行中→阻塞→待办→挂起, newest-updated first within group.
    Pass status="all" to include terminal states (完成/废弃). Pass comma-separated multi values e.g. "阻塞,挂起".

    Args:
        status: "" (default, active only) | "all" | single state | comma-separated states
        agent_name: Exact agent name to query another agent's tasks (requires permission); empty = your own
        project: Filter by project
        tag: Filter by tag
        updated_since: Only tasks touched after this ISO datetime, e.g. "2026-08-20T00:00:00+00:00" ("最近在干啥")
        limit: Page size (default 50, max 200) - always honored
        offset: Pagination offset
    Returns:
        {"total": N, "items": [task objects]} - ALWAYS an array under items, never a single object
    """
    params: dict = {"limit": max(1, min(limit, 200)), "offset": max(0, offset)}
    if status.strip():
        params["status"] = status.strip()
    if agent_name.strip():
        params["agent_name"] = agent_name.strip()
    if project.strip():
        params["project"] = project.strip()
    if tag.strip():
        params["tag"] = tag.strip()
    if updated_since.strip():
        params["updated_since"] = updated_since.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/tasks", headers=_get_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()
        return {"total": data["total"], "items": data["items"]}


@mcp.tool()
async def get_task(id: str = "", title: str = "") -> dict:
    """Get ONE task's full detail by id OR exact title, including complete status_history (when did it get stuck?).

    Args:
        id: Task UUID (preferred). Leave empty if using title.
        title: Exact current title of the task.
    Returns:
        Full task object: id, title, status, detail(Markdown), tags, project, result, status_history, created_at, updated_at
    """
    if not id.strip() and not title.strip():
        raise ValueError("需要提供 id 或 title 之一")

    if id.strip():
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{API_BASE}/tasks/{id.strip()}", headers=_get_headers())
            resp.raise_for_status()
            return resp.json()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/tasks", headers=_get_headers(), params={"limit": 200})
        resp.raise_for_status()
        matches = [t for t in resp.json()["items"] if t["title"].lower() == title.strip().lower()]
        if not matches:
            raise ValueError(f"找不到任务: title={title}")
        return matches[0]


@mcp.tool()
async def close_task(
    id: str = "",
    title: str = "",
    status: str = "完成",
    result: str = "",
) -> dict:
    """Archive-finish a task: set terminal state (完成 or 废弃) + store a result conclusion.

    The task disappears from default list_tasks view but remains queryable with status="all".
    This replaces bare deletion - history is preserved. Errors if task already terminal.

    Args:
        id: Task UUID (preferred). Leave empty if using title.
        title: Exact current title of the task.
        status: Terminal state: "完成" (done, default) or "废弃" (abandoned)
        result: Conclusion text to archive, e.g. "根因是DNS污染，改用hosts解决"
    Returns:
        Final archived task object
    """
    if not id.strip() and not title.strip():
        raise ValueError("需要提供 id 或 title 之一")

    target_id = id.strip()
    if not target_id:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{API_BASE}/tasks", headers=_get_headers(), params={"limit": 200})
            resp.raise_for_status()
            matches = [t for t in resp.json()["items"] if t["title"].lower() == title.strip().lower()]
            if not matches:
                raise ValueError(f"找不到任务: title={title}")
            target_id = matches[0]["id"]

    body: dict = {"id": target_id, "status": status}
    if result.strip():
        body["result"] = result

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{API_BASE}/tasks/close", headers=_get_headers(), json=body)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def delete_task(id: str = "", confirm: bool = False) -> dict:
    """HARD-DELETE a task permanently. Use close_task instead for normal completion!

    Only for cleaning up mistakenly-created tasks. Requires explicit confirm=true.

    Args:
        id: Task UUID (required)
        confirm: Must be explicitly true to proceed
    Returns:
        {"deleted": true, "id": ..., "title": ...}
    """
    if not confirm:
        raise ValueError("删除任务必须显式传 confirm=true。日常收尾请改用 close_task（可归档结论）")
    if not id.strip():
        raise ValueError("需要提供任务 id")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{API_BASE}/tasks/{id.strip()}",
            headers=_get_headers(),
            params={"confirm": "true"},
        )
        resp.raise_for_status()
        return resp.json()


# SSE Transport for MCP clients (Claude Code)
sse = SseServerTransport("messages/")


async def handle_sse(request):
    # Extract api_key from query params
    api_key = request.query_params.get("api_key")
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
            await mcp._mcp_server.run(streams[0], streams[1], mcp._mcp_server.create_initialization_options())
    finally:
        _current_api_key.reset(token)


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
        Mount("/messages/", app=sse.handle_post_message),
        # Streamable HTTP endpoint at root (for /mcp after Caddy strips prefix)
        Mount("/", app=streamable_http_app),  # POST only
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)