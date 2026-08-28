#!/bin/bash
# Agent Station 一键部署脚本
# 自动生成密钥 → 构建 → 迁移 → 健康检查

set -e

# 切换到脚本所在目录的上级（即项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Agent Station 部署脚本 ==="
echo "项目目录: $PROJECT_DIR"
echo ""

# ========== Step 0: 检查 .env ==========
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在，正在从 .env.example 复制..."
    cp .env.example .env
    echo "   ✓ 已创建 .env"
fi

# ========== Step 0.5: 自动生成缺失的密钥 ==========
echo "0. 检查并自动生成密钥..."

generate_if_placeholder() {
    local key="$1"
    local current_value=$(grep "^${key}=" .env | head -1 | cut -d= -f2-)
    # 检测占位符/默认值（CHANGE_ME / GENERATE / 空值）
    if [ -z "$current_value" ] || \
       [[ "$current_value" == CHANGE_ME* ]] || \
       [[ "$current_value" == GENERATE* ]] || \
       [[ "$current_value" == "sk-as-changeme" ]]; then
        return 0  # 需要生成
    fi
    return 1  # 已有有效值
}

need_regen=false
if generate_if_placeholder "POSTGRES_PASSWORD"; then
    new_pg_pwd=$(openssl rand -hex 16)
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$new_pg_pwd|" .env
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://agentstation:$new_pg_pwd@postgres:5432/agent_station|" .env
    echo "   ✓ 已生成 POSTGRES_PASSWORD"
    need_regen=true
fi

if generate_if_placeholder "API_SECRET_KEY"; then
    new_jwt=$(openssl rand -hex 32)
    sed -i "s|^API_SECRET_KEY=.*|API_SECRET_KEY=$new_jwt|" .env
    echo "   ✓ 已生成 API_SECRET_KEY"
    need_regen=true
fi

if generate_if_placeholder "API_KEY"; then
    new_api_key="sk-as-$(openssl rand -hex 16)"
    sed -i "s|^API_KEY=.*|API_KEY=$new_api_key|" .env
    echo "   ✓ 已生成 API_KEY"
    need_regen=true
fi

if [ "$need_regen" = true ]; then
    echo ""
    echo "   ⚠️  新生成的密钥已写入 .env，请妥善保管。"
    echo "   API_KEY: $(grep '^API_KEY=' .env | cut -d= -f2-)"
    echo ""
fi

# 重新加载 .env
source .env

# ========== Step 1: 验证 Docker 配置 ==========
echo "1. 验证 Docker 配置..."
docker compose config > /dev/null
echo "   ✓ 配置有效"

# ========== Step 2: 构建并启动 ==========
echo "2. 构建并启动服务..."
docker compose up -d --build

# ========== Step 3: 等待服务就绪 ==========
echo "3. 等待服务就绪..."
sleep 15

# ========== Step 4: 数据库迁移 ==========
echo "4. 运行数据库迁移..."
docker compose exec -T api alembic upgrade head
echo "   ✓ 迁移完成"

# ========== Step 5: 健康检查 ==========
echo "5. 健康检查..."
# 通过容器内部网络访问 API（不依赖外部域名）
healthy=false
for i in {1..15}; do
    # 直接用 docker exec 检查健康（避免依赖容器内是否有 curl）
    status=$(docker compose exec -T api python -c "
import urllib.request
try:
    r = urllib.request.urlopen('http://localhost:8000/api/v1/health/public', timeout=3)
    print(r.status)
except Exception as e:
    print('error')
" 2>/dev/null || echo "error")
    if [ "$status" = "200" ]; then
        echo "   ✓ API 健康检查通过"
        healthy=true
        break
    fi
    if [ $i -eq 15 ]; then
        echo "   ✗ 健康检查失败（已重试 15 次）"
        echo "   查看日志: docker compose logs api"
        exit 1
    fi
    sleep 3
done

# ========== Step 6: 输出访问信息 ==========
echo ""
echo "=== 部署完成 ==="
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
echo ""
echo "🌐 前端访问: ${PUBLIC_URL}/app"
echo "📚 API 文档: ${PUBLIC_URL}/api/v1/docs"
echo "🔑 管理员 API_KEY: $API_KEY"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f"
echo "  停止服务: docker compose down"
echo "  重启服务: docker compose restart"
echo "  完全重置: docker compose down -v  ⚠️ 会删除数据"