#!/bin/bash
# 构建单文件可执行程序

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "安装依赖..."
pip install -r requirements.txt -q
pip install pyinstaller -q

echo "构建单文件可执行程序..."
pyinstaller --onefile \
    --name agent-station-sync \
    --add-data "config.yaml.example:." \
    --hidden-import=aiohttp \
    --hidden-import=aiofiles \
    --hidden-import=yaml \
    --hidden-import=frontmatter \
    --hidden-import=watchdog.observers \
    --hidden-import=watchdog.events \
    agent_log_sync.py

echo "构建完成: dist/agent-station-sync"
echo ""
echo "使用方法:"
echo "  1. 复制 dist/agent-station-sync 到目标机器"
echo "  2. 创建配置文件 ~/.config/agent-station/config.yaml"
echo "  3. 运行 ./agent-station-sync"
echo ""
echo "配置文件示例:"
cat config.yaml.example