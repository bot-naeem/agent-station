#!/bin/bash
# 部署脚本

set -e

PLATFORM_DIR="/home/ubuntu/agent-log-platform"
cd "$PLATFORM_DIR"

echo "=== Agent Log Platform 部署脚本 ==="
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "错误: .env 文件不存在，请从 .env.example 复制并填入密钥"
    exit 1
fi

# 加载环境变量
source .env

echo "1. 验证 Docker 配置..."
docker compose config > /dev/null
echo "   ✓ 配置有效"

echo "2. 构建并启动服务..."
docker compose up -d --build

echo "3. 等待服务就绪..."
sleep 15

echo "4. 运行数据库迁移..."
docker compose exec -T api alembic upgrade head
echo "   ✓ 迁移完成"

echo "5. 创建 Qdrant 集合..."
docker compose exec -T api python -c "
from app.services.vector_service import VectorService
from app.core.database import async_session_maker
import asyncio

async def main():
    async with async_session_maker() as db:
        vs = VectorService(db)
        await vs.ensure_collection()
        print('   ✓ Qdrant 集合就绪')

asyncio.run(main())
"

echo "6. 健康检查..."
for i in {1..10}; do
    if curl -sf -H "X-API-Key: $API_KEY" https://codingfamily.online/api/v1/health/public > /dev/null; then
        echo "   ✓ API 健康检查通过"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "   ✗ 健康检查失败"
        exit 1
    fi
    sleep 3
done

echo ""
echo "=== 部署完成 ==="
echo "前端访问: https://codingfamily.online/app"
echo "API 文档: https://codingfamily.online/api/v1/docs"
echo "Qdrant UI: http://localhost:6333/dashboard (仅本地访问)"
echo ""
echo "查看日志: docker compose logs -f"
echo "停止服务: docker compose down"