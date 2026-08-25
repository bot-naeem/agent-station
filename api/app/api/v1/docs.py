"""Public documentation endpoints (plain text/markdown, no auth)"""
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

MCP_GUIDE = """# Agent Log Platform - MCP 接入指南

本平台为 AI 智能体提供日志写入、检索与 RAG 问答能力。
通过标准 MCP 协议（**双协议支持：SSE + Streamable HTTP**）接入，一次配置，永久生效。

- **SSE 传输** (MCP 2024-11-05): 兼容 Claude Code、OpenCode 等传统客户端
- **Streamable HTTP** (MCP 2025-03-26): 兼容 Antigravity CLI (agy)、最新 MCP 客户端

两端点均可用同一 URL: `https://codingfamily.online/mcp/sse?api_key=...`

## 一、获取凭证

1. 管理员在平台 Web 端「Agent 管理」创建 Agent 账号
2. 创建时生成一次性 API Key（格式: sk-alp-xxxx），仅显示一次，请妥善保存
3. 如 Key 丢失，由管理员在后台执行「轮换 Key」

## 二、连接命令

### Claude Code
```bash
claude mcp add agent-log --transport sse \
  "https://codingfamily.online/mcp/sse?api_key=你的API_KEY"
```

### OpenCode（编辑 ~/.config/opencode/opencode.json）
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-log": {
      "type": "remote",
      "url": "https://codingfamily.online/mcp/sse?api_key=你的API_KEY"
    }
  }
  // ...其他配置保持不变
}
```
> OpenCode v2 用扁平结构 `mcp.{server-name}`，无需 servers 嵌套层，也无需 enabled 字段（默认启用）。保存后重启 OpenCode 生效。

### Antigravity CLI (agy)
服务端已支持 **Streamable HTTP 协议**，与 Antigravity 原生兼容。

支持全局配置（推荐）与项目级配置：
- 全局: ~/.gemini/config/mcp_config.json
- 项目级: ./.agents/mcp_config.json

编辑配置文件添加：
```json
{
  "mcpServers": {
    "agent-log": {
      "serverUrl": "https://codingfamily.online/mcp/sse?api_key=你的API_KEY"
    }
  }
}
```
> 注意：Antigravity 远程 SSE 使用 `serverUrl` 字段（不同于 Claude Code 的 "type": "sse" + "url" 结构）。文件不存在可手动创建；修改后需新起 agy 会话才加载。
>
> **服务端双协议**: 同一 URL 同时支持 SSE (GET) 与 Streamable HTTP (POST)。Antigravity 会自动使用 Streamable HTTP 模式直连。

### 其他 MCP 客户端（Codex / Cline 等）
- 传输方式: SSE
- URL: https://codingfamily.online/mcp/sse?api_key=你的API_KEY

> 注意: api_key 必须放在 URL 查询参数中，参数名为下划线 api_key。

### 验证连接
```bash
# SSE 传输 (Claude Code / OpenCode)
claude mcp list
# 应显示: agent-log ... ✓ Connected

opencode
# 会话内调用工具或查看 MCP 状态，应显示: ● ✓ agent-log connected

# Streamable HTTP 传输
curl -X POST "https://codingfamily.online/mcp/sse?api_key=你的API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# 应返回 HTTP 200，包含 serverInfo 与 capabilities 的 JSON-RPC 响应

agy
# 启动即自动连接并拉取工具列表；排查看 ~/.gemini/antigravity-cli/cli.log
```

## 三、可用工具（4 个）

## 三、可用工具（10 个）

### 日志类
| 工具 | 说明 | 关键参数 |
|------|------|----------|
| write_log | 写入一条 Markdown 工作日志 | title(必填), content(必填), log_date, tags[] |
| read_logs | 读取最近日志列表（带 agent_name） | limit, agent_name, start_date, end_date |
| search_logs | 全文搜索历史日志 | query(必填), agent_name, start_date, end_date |
| get_stats | 获取日志统计 | start_date, end_date, agent_name |

### 任务类（六态工作流）
| 工具 | 说明 | 关键参数 |
|------|------|----------|
| create_task | 创建任务（重名报错） | title(必填), detail, tags[], status |
| update_task | 部分更新（status 变更自动记 history） | id 或 title 定位 + 要改的字段 |
| list_tasks | 列任务（缺省只回活跃态；数组+total） | status(all/多值), agent_name, updated_since, limit |
| get_task | 单条完整详情（含 status_history） | id 或 title |
| close_task | 归档收尾：置终态+存结论 | id/title, status(完成/废弃), result |
| delete_task | 硬删除（需 confirm=true） | id, confirm |

任务状态机：待办 / 进行中 / 阻塞 / 挂起 为活跃态；完成 / 废弃 为终态。

## 四、使用建议

1. 每完成一个重要任务/会话结束前，调用 write_log 记录:
   - 标题: 一句话概括做了什么
   - 内容: Markdown 格式，包含 背景/操作/结果/踩坑
   - 标签: 便于后续检索的关键词
2. 需要回顾历史时，用 read_logs（按日期/Agent 过滤）或 search_logs（关键词）
3. 权限说明: 普通 Agent 只能读写自己的日志（RBAC 隔离）

## 五、故障排查

| 现象 | 处理 |
|------|------|
| 401 Unauthorized | 检查 URL 中 api_key 参数是否完整（含 sk-alp- 前缀） |
| 连接超时 | 确认能访问 https://codingfamily.online:443 |
| 工具报错 initialization | 客户端需先发 initialize 并等待响应，再发 notifications/initialized |
| Key 泄露 | 立即通知管理员轮换 Key |
| Antigravity 改了 mcp_config.json 没生效 | 配置变更需新起会话：退出当前 agy（Ctrl+D 或 /exit）重新启动 |
| Antigravity 连接/加载异常 | 查看运行日志 ~/.gemini/antigravity-cli/cli.log |

---
Skill 模板（人设+平台规范+自定义三区）: https://codingfamily.online/api/v1/docs/skill-template

平台地址: https://codingfamily.online/app
API 文档: https://codingfamily.online/api/v1/docs
"""


@router.get("/docs/mcp", response_class=PlainTextResponse, include_in_schema=False)
async def mcp_guide_doc():
    """MCP 接入指南（纯文本 Markdown，供智能体 web-fetch）"""
    return PlainTextResponse(MCP_GUIDE, media_type="text/markdown; charset=utf-8")


SKILL_TEMPLATE_PATH = "/app/app/templates/skill_template.md"


@router.get("/docs/skill-template", response_class=PlainTextResponse, include_in_schema=False)
async def skill_template_doc():
    """Agent Skill 模板（纯文本 Markdown）：人设区 + 平台规范区 + 自定义区。下载后填 ①③ 区存为 SKILL.md"""
    from pathlib import Path
    try:
        content = Path(SKILL_TEMPLATE_PATH).read_text(encoding="utf-8")
    except FileNotFoundError:
        content = "# 模板文件缺失，请联系管理员"
    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")
