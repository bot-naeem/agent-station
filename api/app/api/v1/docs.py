"""Public documentation endpoints (plain text/markdown, no auth)"""
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

MCP_GUIDE = """# Agent Station - MCP 接入指南（一键配置版）

本平台为 AI 智能体提供日志写入与检索能力。
通过标准 MCP 协议（**双协议支持：SSE + Streamable HTTP**）一次性配置，**完全复制下方命令到 Claude Code/OpenCode/Antigravity**，无需手动 fetch 任何文档，永久生效。

## 一、获取凭证
1. 管理员在平台 Web 端「Agent 管理」创建 Agent 账号
2. 创建时生成一次性 API Key（格式：`sk-as-xxxx`），仅显示一次，请妥善保存
3. 如 Key 丢失，由管理员在后台执行「轮换 Key」

## 二、一键配置命令（复制粘贴即可，无需修改）

### Claude Code / OpenCode（SSE 传输）
```bash
claude mcp add agent-station --transport sse \\
  "https://你的域名/mcp/sse?api_key=你的API_KEY"
```

验证：`claude mcp list` 应显示 `agent-station ... ✓ Connected`

### OpenCode（编辑 ~/.config/opencode/opencode.json）
```json
{
  "mcp": {
    "agent-station": {
      "type": "remote",
      "url": "https://你的域名/mcp/sse?api_key=你的API_KEY"
    }
  }
}
```
> 保存后重启 OpenCode 生效。

### Antigravity CLI (agy)（Streamable HTTP）
编辑 `~/.gemini/config/mcp_config.json`（全局）或 `./.agents/mcp_config.json`（项目级）：
```json
{
  "mcpServers": {
    "agent-station": {
      "serverUrl": "https://你的域名/mcp/sse?api_key=你的API_KEY"
    }
  }
}
```
> 配置变更需**新起 agy 会话**（退出当前 Ctrl+D 或 /exit，重新启动）才加载。

### 其他 MCP 客户端（Codex / Cline 等）
- 传输方式: SSE
- URL: `https://你的域名/mcp/sse?api_key=你的API_KEY`
> api_key 必须放在 URL 查询参数中，参数名为 `api_key`。

## 三、所有可用工具（6 个，直接可用，无需 fetch）

### 1. 日志类（5 个）

| 工具 | 用途 | 关键参数 | 返回示例 |
|------|------|----------|----------|
| `write_log` | 写入一条 Markdown 工作日志 | title(必填), content(必填), log_date(可选默认今天), tags[], project(可选), task_type(可选) | `{id, title, created_at}` |
| `read_logs` | 读取最近日志列表（带 agent_name） | limit(默认10,max100), agent_name(可选), start_date, end_date | `{total, count, items[{id, title, log_date, tags}]}` |
| `search_logs` | 全文搜索历史日志（标题+摘要） | query(必填), agent_name, start_date, end_date, limit | `{total, count, items[]}` |
| `read_log_detail` | 读取单篇日志完整正文（先用 read_logs/search_logs 拿 id） | id(必填) | 完整 log 对象（含 content 全文） |
| `get_stats` | 聚合日志统计 | start_date, end_date, agent_name(可选) | `{total_logs, by_agent{}, by_date{}, top_tags[]}` |

### 2. 通用类（1 个）
| 工具 | 用途 | 关键参数 | 返回示例 |
|------|------|----------|----------|
| `list_agents` | 列出有权限读取的 Agent | 无 | `{agents: [{name, display_name, agent_type, last_used_at}]}` |

## 四、使用建议（直接调用，无需思考）

1. **每完成一项重要工作/会话结束前**，调用 `write_log` 记录：
   - 标题：一句概括做了什么
   - 内容：Markdown 格式，包含 背景/关键步骤/结果/踩坑
   - 标签：便于后续检索的关键词（含日期 YYYY-MM-DD）
   - task_type：开发/调试/部署/调研/运维/文档 选一

2. **需要回顾历史时**：
   - 按日期/Agent：`read_logs(start_date="2026-08-01", end_date="2026-08-31")`
   - 关键词搜索：`search_logs(query="docker", limit=20)`



## 五、故障排查

| 现象 | 处理 |
|------|------|
| 401 Unauthorized | 检查 URL 中 `api_key` 参数是否完整（含 `sk-as-` 前缀） |
| 连接超时 | 确认能访问 https://你的域名:443 |
| 工具报错 initialization | 客户端需先发 `initialize` 并等待响应，再发 `notifications/initialized` |
| Key 泄露 | 立即通知管理员轮换 Key |
| Antigravity 改了 mcp_config.json 没生效 | 配置变更需新起会话：退出当前 Ctrl+D 或 /exit 重新启动 |
| Antigravity 连接/加载异常 | 查看运行日志 ~/.gemini/antigravity-cli/cli.log |

## 七、一键复制给大模型的完整指南

> **把下面这段完整文本直接复制给 Claude Code / OpenCode / Antigravity，让它自行完成 MCP 接入和工具使用，无需任何额外操作：**

```
# Agent Station MCP 一键接入指南

## 平台信息
- 平台: Agent Station
- URL: https://你的域名/mcp/sse?api_key=你的API_KEY
- 传输: SSE (Claude Code/OpenCode) / Streamable HTTP (Antigravity)
- API Key 格式: sk-as-xxxx (必放在 URL api_key 参数中)

## 连接命令 (直接复制执行)

### Claude Code
claude mcp add agent-station --transport sse \\
  "https://你的域名/mcp/sse?api_key=你的API_KEY"

### OpenCode
编辑 ~/.config/opencode/opencode.json，添加：
{
  "mcp": {
    "agent-station": {
      "type": "remote",
      "url": "https://你的域名/mcp/sse?api_key=你的API_KEY"
    }
  }
}
保存后重启 OpenCode

### Antigravity CLI (agy)
编辑 ~/.gemini/config/mcp_config.json，添加：
{
  "mcpServers": {
    "agent-station": {
      "serverUrl": "https://你的域名/mcp/sse?api_key=你的API_KEY"
    }
  }
}
新起 agy 会话生效

## 可用工具一览 (6 个，直接用，无需 fetch)

### 日志工具 (5 个)
- write_log(title="xxx", content="xxx", tags=["2026-08-27", "关键词"])
- read_logs(limit=20, agent_name="我的名字")
- search_logs(query="docker", limit=30)
- read_log_detail(id="日志UUID")
- get_stats(start_date="2026-08-01", end_date="2026-08-31")

### 通用工具 (1 个)
- list_agents()  列出可读 Agent 列表


## 标准操作流程

### 写日志（每项工作/阶段一条）
1. write_log(title="工作名：一句话结果", content="背景+关键步骤+结果+踩坑", tags=["2026-08-27", "关键词1", "关键词2"], task_type="开发")

### 查历史/检索
- read_logs(agent_name="我的名字", start_date="2026-08-01")
- search_logs(query="关键词")

## 故障处理
- 401 → 检查 api_key 是否完整且含 sk-as- 前缀
- 工具报错 → 确保先发 initialize，再发对应工具调用
- 连接中断 → /mcp 重连 或 重启 claude/agy 会话
- 内容截断(30KB+) → 重试一次 通常即可

## 报到上下文恢复（召唤 Agent 后立即执行）
1. read_logs(limit=5)  — 看最近 5 条日志
拼出"我在哪、正在干什么"即可。
```

---

Skill 模板（人设+平台规范+自定义三区）: https://你的域名/api/v1/docs/skill-template

平台地址: https://你的域名/app
API 文档: https://你的域名/api/v1/docs
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