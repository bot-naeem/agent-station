# Agent Station Platform

基于 Docker 容器化部署的 Agent 日志管理平台，支持：
- 📝 **Markdown 日志管理** - 按日期/Agent 分类、全文搜索、标签筛选、日历视图
- 🤖 **RAG 智能问答** - 基于历史日志向量检索 + LLM 回答，引用来源可追溯
- ✅ **待办事项看板** - 跨机器同步、拖拽排序、优先级、会话关联
- 📊 **会话时间轴** - 可视化执行历史、Token 消耗、工具调用链

## 架构

```
codingfamily.online (Caddy HTTPS)
├── /app/*          → React 前端 (端口 3000)
├── /api/*          → FastAPI 后端 (端口 8000)
└── /ws             → WebSocket 实时同步

后端服务:
├── PostgreSQL + pgvector  - 关系型存储 + 向量扩展
├── Qdrant                 - 专用向量数据库 (RAG 核心)
├── Redis                  - 缓存、任务队列、Celery Broker
├── API (FastAPI)          - RESTful API + WebSocket
├── Worker (Celery)        - 异步向量化任务
└── Frontend (Nginx)       - 静态资源服务
```

## 快速开始

### 1. 准备密钥

编辑 `.env` 文件，填入以下密钥：

```bash
# 必填：SiliconFlow API Key (用于 Embedding)
EMBEDDING_API_KEY=sk-xxxxxxxxxxxxx
```

其他密钥已自动生成：
- `POSTGRES_PASSWORD` - 数据库密码
- `API_SECRET_KEY` - JWT 签名密钥
- `API_KEY` - 客户端统一认证 Key: `sk-agent-station-xxxxxxxxxxxxx`

### 2. 部署

```bash
cd /home/ubuntu/agent-station-platform
./scripts/deploy/deploy.sh
```

### 3. 访问

- **前端界面**: https://codingfamily.online/app
- **API 文档**: https://codingfamily.online/api/v1/docs
- **Qdrant 管理界面**: http://localhost:6333/dashboard (仅本地)

## 客户端接入

### 配置同步工具

在工作服务器和个人电脑上：

```bash
# 1. 下载构建好的二进制文件 (或直接运行 Python 脚本)
# 2. 创建配置文件
mkdir -p ~/.config/agent-station
cat > ~/.config/agent-station/config.yaml <<EOF
api_url: "https://codingfamily.online/api/v1"
api_key: "sk-as-xxxxxxxxxxxxx"  # 从 .env 中获取
local_dir: "~/.agent-station/logs"
sync_interval: 60
watch: true
EOF
```

### 各 Agent 接入方式

#### opencode (技能系统)
```python
# 在技能中添加 hook
def on_task_complete(context):
    log_path = f"~/.agent-station/logs/{date}/{agent}/session-{session_id}.md"
    write_markdown(log_path, generate_markdown(context))
```

#### Claude Code (settings.json hooks)
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "python -c \"import sys; from agent_station_sync import sync; sync(sys.argv[1])\""
      }]
    }]
  }
}
```

#### Codex / Gemini CLI
使用 wrapper 脚本在任务结束时写入 `~/.agent-station/logs/{date}/{agent}/session-xxx.md`

### Markdown 格式规范

```markdown
---
session_id: "uuid"
agent_type: "opencode"
task_type: "coding"
project: "my-project"
tags: ["docker", "rag"]
status: "completed"
tokens_used: 45230
duration_seconds: 127
tools_used: ["bash", "read", "edit"]
related_files: ["docker-compose.yml", "api/main.py"]
started_at: "2025-01-15T10:30:00+08:00"
ended_at: "2025-01-15T10:32:07+08:00"
---

# 任务标题

## 执行摘要
...

## 详细步骤
...

## 遇到的问题
...

## 解决方案
...
```

## 运维

### 查看日志
```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f frontend
```

### 备份
```bash
./scripts/deploy/backup.sh
```

### 更新部署
```bash
docker compose pull
docker compose up -d --build
docker compose exec -T api alembic upgrade head
```

### 停止服务
```bash
docker compose down
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/markdown | 创建 markdown 日志 |
| GET | /api/v1/markdown | 列表/搜索/筛选 |
| GET | /api/v1/markdown/calendar | 日历聚合 |
| GET | /api/v1/markdown/stats | 统计信息 |
| GET | /api/v1/markdown/{id} | 获取单个日志详情 |
| POST | /api/v1/rag/query | RAG 单轮问答 |
| POST | /api/v1/rag/chat | RAG 多轮对话 |
| POST | /api/v1/todos | 创建待办 |
| GET | /api/v1/todos | 待办列表/看板 |
| GET | /api/v1/health | 健康检查 |

## 目录结构

```
 /home/ubuntu/agent-station/
├── docker-compose.yml          # 服务编排
├── Caddyfile                   # 反向代理配置
├── .env                        # 环境变量 (需填入密钥)
├── .env.example                # 环境变量模板
├── api/                        # FastAPI 后端
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/                # 数据库迁移
│   └── app/
│       ├── main.py
│       ├── core/               # 配置、数据库、安全、Celery
│       ├── models/             # SQLAlchemy 模型
│       ├── schemas/            # Pydantic Schema
│       ├── api/v1/             # API 路由
│       ├── services/           # 业务逻辑
│       ├── tasks/              # Celery 任务
│       └── utils/              # 工具函数
├── web/                        # React 前端
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── router.tsx
│       ├── components/         # 通用组件
│       ├── pages/              # 页面组件
│       ├── hooks/              # React Query hooks
│       ├── services/           # API 客户端
│       └── styles/
├── scripts/
│   ├── deploy/
│   │   ├── deploy.sh           # 部署脚本
│   │   └── backup.sh           # 备份脚本
│   └── client-sync/
│       ├── agent_log_sync.py   # 同步工具
│       ├── config.yaml.example
│       ├── requirements.txt
│       └── build.sh            # 打包脚本
└── README.md
```

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 容器化 | Docker + Compose | 29.7+ |
| 反向代理 | Caddy | 2.8+ |
| 数据库 | PostgreSQL + pgvector | 16 |
| 向量库 | Qdrant | 1.13+ |
| 缓存/队列 | Redis | 7+ |
| 后端框架 | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0+ |
| 任务队列 | Celery | 5.4+ |
| 前端框架 | React | 18.3+ |
| 路由 | TanStack Router | 1.81+ |
| 状态管理 | TanStack Query | 5.59+ |
| 样式 | Tailwind CSS | 3.4+ |
| 图标 | Lucide React | 0.453+ |
| Markdown 渲染 | react-markdown | 9.0+ |

## 许可证

MIT License