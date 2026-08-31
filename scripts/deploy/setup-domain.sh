#!/bin/bash
# Agent Station 域名/IP 配置向导
# 交互式：询问域名/IP，生成模板，提醒用户手动完成后续步骤
# 使用方法: ./scripts/deploy/setup-domain.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "========================================="
echo " Agent Station 域名/IP 配置向导"
echo "========================================="
echo ""

# Q1: 域名还是 IP？
echo "你是有域名还是只有公网 IP？"
echo "1) 域名（推荐，可自动申请 HTTPS 证书）"
echo "2) 公网 IP（直接访问，无 HTTPS，明文传输）"
echo "3) 本机开发（localhost，跳过反向代理和域名配置）"
read -p "请输入选项 [1/2/3]：" MODE

case "$MODE" in
  1)
    # --- 域名模式 ---
    read -p "请输入你的域名（如 agent.station.com）: " DOMAIN
    # 域名基本格式校验
    if ! echo "$DOMAIN" | grep -qE '^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
        echo "❌ 域名格式不似，已退出"
        exit 1
    fi
    echo "你选择了域名: $DOMAIN"

    # Q2: 是否要 HTTPS？
    read -p "是否自动申请 Let's Encrypt HTTPS 证书？(y/n，默认 y): " USE_HTTPS
    USE_HTTPS=${USE_HTTPS:-y}

    # 检测 80/443 端口对外是否可达（简单探测）
    if [ "$USE_HTTPS" = "y" ]; then
        echo "正在探测 80 端口对外可达性..."
        if curl -sf -m 3 "http://$DOMAIN" > /dev/null 2>&1; then
            echo "✅ 80 端口可达，将自动配置 HTTPS"
            HTS="true"
        else
            echo "⚠️ 80 端口不可达（可能被防火墙阻止）"
            echo "     如果确定端口已开放，可手动添加防火墙规则后重试。"
            read -p "是否仍要强行继续并写入 Caddyfile？（y/n）: " FORCE
            FORCE=${FORCE:-n}
            if [ "$FORCE" = "n" ]; then
                echo "已取消。请先开放 80/443 端口或选择 IP 模式。"
                exit 1
            fi
            HTS="true"
        fi
    else
        HTS="false"
        echo "⚠️ 你将不使用 HTTPS，配置完成后记得手动配置域名的 DNS 解析和反向代理。"
    fi

    # 生成 Caddyfile（包含两个注释块，用户删掉冗余的即可）
    cat > /etc/caddy/Caddyfile <<EOF
# --- 此处由脚本自动生成，请用编辑器打开并根据需要保留/删除 ---
# 选项 A：自动 HTTPS（推荐，保留下面这段）
# $DOMAIN {
#   reverse_proxy localhost:3001
#   reverse_proxy localhost:8000
#   reverse_proxy localhost:8080
#   automatic_https rfc2965
# }

# 选项 B：仅 HTTP（无证书，保留下面这段）
# $DOMAIN {
#   reverse_proxy localhost:3001
#   reverse_proxy localhost:8000
#   reverse_proxy localhost:8080
# }
EOF
    echo ""
    echo "📝 Caddyfile 已生成在 /etc/caddy/Caddyfile"
    echo "   打开文件，保留「选项 A」或「选项 B」其中之一，删除另一块。"
    echo "   如需改行首部的 # 号，记得把反向代理行前的 # 也删掉。"
    echo ""

    # 写入 .env（用域名替换 VITE 前端变量）
    sed -i "s|^VITE_API_BASE=.*|VITE_API_BASE=https://$DOMAIN/api/v1|" "$PROJECT_DIR/.env"
    sed -i "s|^VITE_WS_BASE=.*|VITE_WS_BASE=wss://$DOMAIN/ws|" "$PROJECT_DIR/.env"
    echo "🔧 .env 前端变量已更新为: https://$DOMAIN/api/v1"
    ;;

  2)
    # --- IP 模式 ---
    read -p "请输入你的公网 IP（如 202.108.20.50）: " EXTERNAL_IP
    if ! echo "$EXTERNAL_IP" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        echo "❌ IP 格式不似，已退出"
        exit 1
    fi
    echo "你选择了 IP: $EXTERNAL_IP"

    # 安全警告
    echo ""
    echo "⚠️ 重要安全提示："
    echo "   使用 IP 将不自动申请 HTTPS 证书，"
    echo "   所有通信将通过明文 HTTP 进行。"
    echo "   如果在公网环境，强烈建议使用域名 + HTTPS 模式。"
    read -p "确认继续使用 IP 模式？(输入 yes 确认): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "已取消。"
        exit 1
    fi

    # 写入 .env（用 IP 替换）
    sed -i "s|^VITE_API_BASE=.*|VITE_API_BASE=http://$EXTERNAL_IP:8000|" "$PROJECT_DIR/.env"
    sed -i "s|^VITE_WS_BASE=.*|VITE_WS_BASE=ws://$EXTERNAL_IP:8080/ws|" "$PROJECT_DIR/.env"
    echo "🔧 .env 前端变量已更新为: http://$EXTERNAL_IP:8000"
    echo "   (如需 HTTPS，请后续换域名重新运行本脚本)"
    ;;

  3)
    # --- 本机开发模式 ---
    echo "本机开发模式：跳过反向代理和域名/IP 配置"
    echo "📍 前端将使用相对路径，直接向 localhost:8000 发起请求"
    # 这里不改 .env，保持原样（deploy.sh 里已写死或由用户自行改）
    ;;

  *)
    echo "❌ 无效选项，已退出"
    exit 1
    ;;
esac

# --- 共享后置步骤 ---
echo ""
echo "========================================="
echo " 后置步骤——请你在自己的环境里完成"
echo "========================================="
echo ""
echo "1. 端口开放:"
echo "   - 如果使用 域名 + HTTPS 模式："
echo "     * 开放服务器 80 端口 (HTTP) 和 443 端口 (HTTPS) 到公网"
echo "     * 确保域名 DNS 已解析到服务器 IP"
echo "   - 如果使用 IP 模式："
echo "     * 开放任意端口（无 HTTPS 需求较低）"
echo "   - 如果是本机开发：无需额外操作"
echo ""
echo "2. 反向代理 (Caddy/Nginx/Traefik):"
echo "   - 确保 Caddy (或你喜欢的反向代理) 已启动"
echo "   - Caddyfile 已由脚本生成在 /etc/caddy/Caddyfile"
echo "   - 按照 Caddyfile 内的注释，删除冗余的配置块，保留一段"
echo ""
echo "3. 证书 (HTTPS 模式仅):"
echo "   - 若自动申请失败，可手动运行: sudo caddy reload"
echo "   - 证书存储在 /etc/letsencrypt/live/ (域名模式)"
echo ""
echo "3. 重启前端使 .env 生效:"
echo "   cd $PROJECT_DIR && docker compose restart frontend"
echo ""
echo "4. 验证访问:"
echo "   打开浏览器访问: http://$(grep '^VITE_API_BASE=' $PROJECT_DIR/.env | cut -d= -f2-)/app"
echo "   或: http://$(grep '^VITE_API_BASE=' $PROJECT_DIR/.env | cut -d= -f2-)/api/v1/health/public"
echo ""
echo "🎉 配置向导结束。详见上文自述的手动步骤。"