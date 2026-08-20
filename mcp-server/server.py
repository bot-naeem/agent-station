"""MCP Server for Agent Log Platform - SSE Transport"""
import os
import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Mount, Route
import uvicorn

# Config from env
API_BASE = os.getenv("ALP_API_BASE", "https://codingfamily.online/api/v1")
API_KEY = os.getenv("ALP_API_KEY")
if not API_KEY:
    raise RuntimeError("ALP_API_KEY environment variable is required")

HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
DEFAULT_AGENT = os.getenv("HOSTNAME", "mcp-server")

mcp = FastMCP("agent-log-platform")


@mcp.tool()
async def write_log(title: str, content: str, tags: list[str] = [], agent_type: str = "") -> str:
    """Write a markdown log entry to the platform.

    Args:
        title: Log title
        content: Markdown content
        tags: Optional tags for categorization
        agent_type: Override default agent type (defaults to hostname)
    Returns:
        The created log ID
    """
    agent = agent_type or DEFAULT_AGENT
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{API_BASE}/markdown",
            headers=HEADERS,
            json={
                "agent_type": agent,
                "title": title,
                "content": content,
                "front_matter": {"tags": tags},
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]


@mcp.tool()
async def read_logs(limit: int = 10, agent_type: str = "", start_date: str = "", end_date: str = "") -> list[dict]:
    """Read recent markdown logs.

    Args:
        limit: Maximum number of logs to return
        agent_type: Filter by agent type (defaults to hostname)
        start_date: Filter logs after this date (YYYY-MM-DD)
        end_date: Filter logs before this date (YYYY-MM-DD)
    Returns:
        List of log entries
    """
    agent = agent_type or DEFAULT_AGENT
    params = {"agent_type": agent, "page_size": limit}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/markdown", headers=HEADERS, params=params)
        resp.raise_for_status()
        return resp.json()["items"]


@mcp.tool()
async def rag_query(question: str, agent_type: str = "", top_k: int = 5) -> str:
    """Query the RAG system for intelligent answers based on stored logs.

    Args:
        question: The question to ask
        agent_type: Filter by agent type (defaults to hostname)
        top_k: Number of top chunks to retrieve
    Returns:
        AI-generated answer with sources
    """
    agent = agent_type or DEFAULT_AGENT
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{API_BASE}/rag/chat",
            headers=HEADERS,
            json={
                "messages": [{"role": "user", "content": question}],
                "agent_type": agent,
                "top_k": top_k,
            },
        )
        resp.raise_for_status()
        return resp.json()["answer"]


@mcp.tool()
async def search_logs(query: str, limit: int = 10, agent_type: str = "") -> list[dict]:
    """Full-text search across markdown logs.

    Args:
        query: Search query string
        limit: Maximum results
        agent_type: Filter by agent type (defaults to hostname)
    Returns:
        Matching log entries
    """
    agent = agent_type or DEFAULT_AGENT
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{API_BASE}/markdown",
            headers=HEADERS,
            params={"agent_type": agent, "query": query, "page_size": limit},
        )
        resp.raise_for_status()
        return resp.json()["items"]


@mcp.tool()
async def get_stats(start_date: str = "", end_date: str = "") -> dict:
    """Get markdown statistics for the agent.

    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    Returns:
        Stats object with totals, by_agent, by_date, top_tags
    """
    agent = DEFAULT_AGENT
    params = {"agent_type": agent}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{API_BASE}/markdown/stats", headers=HEADERS, params=params)
        resp.raise_for_status()
        return resp.json()


# SSE Transport for MCP clients
sse = SseServerTransport("/messages/")

async def handle_sse(request):
    async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
        await mcp._mcp_server.run(streams[0], streams[1], mcp._mcp_server.create_initialization_options())

app = Starlette(
    routes=[
        Route("/sse", endpoint=handle_sse),
        Mount("/messages/", app=sse.handle_post_message),
    ]
)

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)