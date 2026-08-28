#!/bin/bash
# 部署脚本

set -e

PLATFORM_DIR="/home/ubuntu/agent-station"
cd "$PLATFORM_DIR"

echo "=== Agent Station 部署脚本 ==="
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

echo "5. 健康检查..."
# 通过容器内部网络访问 API（不依赖外部域名）
for i in {1..10}; do
    if docker compose exec -T api curl -sf http://localhost:8000/api/v1/health/public > /dev/null 2>&1; then
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
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
echo "前端访问: ${PUBLIC_URL}/app"
echo "API 文档: ${PUBLIC_URL}/api/v1/docs"
echo ""
echo "查看日志: docker compose logs -f"
echo "停止服务: docker compose down""