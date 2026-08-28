#!/bin/bash
# 备份脚本

set -e

PLATFORM_DIR="/home/ubuntu/agent-station"
BACKUP_DIR="/home/ubuntu/backups/agent-station"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

cd "$PLATFORM_DIR"

echo "=== 备份 Agent Station ==="

# 备份 PostgreSQL
echo "备份 PostgreSQL..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"
echo "  ✓ 完成: $BACKUP_DIR/postgres_$DATE.sql.gz"

# 备份 Markdown 文件
echo "备份 Markdown 文件..."
tar -czf "$BACKUP_DIR/markdown_$DATE.tar.gz" -C /home/ubuntu/agent-station ./data/markdown 2>/dev/null || \
docker run --rm -v agent-station_markdown-data:/data -v "$BACKUP_DIR":/backup alpine tar -czf "/backup/markdown_$DATE.tar.gz" -C /data .
echo "  ✓ 完成: $BACKUP_DIR/markdown_$DATE.tar.gz"

# 清理 30 天前的备份
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo ""
echo "=== 备份完成 ==="
echo "备份目录: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"/*_$DATE.*