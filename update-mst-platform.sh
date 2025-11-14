#!/bin/bash

set -e

echo "🔄 开始更新 MST Platform..."

# 定义变量
PACKAGE_FILE="$HOME/design-institute-platform_20251112_101700.tar.gz"
DEPLOY_DIR="/mnt/data/mst-platform"
BACKUP_DIR="/mnt/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 检查包文件
if [ ! -f "$PACKAGE_FILE" ]; then
  echo "❌ 包文件不存在: $PACKAGE_FILE"
  exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "📦 解压新版本..."
TMP_DIR="/tmp/deploy_update_${TIMESTAMP}"
mkdir -p "$TMP_DIR"
tar -xzf "$PACKAGE_FILE" -C "$TMP_DIR"
NEW_VERSION_DIR=$(ls -d ${TMP_DIR}/*/ | head -n 1)

# 备份当前版本的关键文件
echo "💾 备份环境变量和配置..."
mkdir -p "$BACKUP_DIR/preserve_${TIMESTAMP}"

# 保留环境变量
[ -f "$DEPLOY_DIR/apps/api/.env" ] && cp "$DEPLOY_DIR/apps/api/.env" "$BACKUP_DIR/preserve_${TIMESTAMP}/"
[ -f "$DEPLOY_DIR/.env.server" ] && cp "$DEPLOY_DIR/.env.server" "$BACKUP_DIR/preserve_${TIMESTAMP}/"

# 保留上传文件和日志
[ -d "$DEPLOY_DIR/apps/api/uploads" ] && tar -czf "$BACKUP_DIR/preserve_${TIMESTAMP}/uploads.tar.gz" -C "$DEPLOY_DIR/apps/api" uploads
[ -d "$DEPLOY_DIR/apps/api/logs" ] && tar -czf "$BACKUP_DIR/preserve_${TIMESTAMP}/logs.tar.gz" -C "$DEPLOY_DIR/apps/api" logs

echo "⏸️  停止服务..."
cd "$DEPLOY_DIR/apps/api"
$HOME/.nvm/versions/node/v20.19.5/bin/npm run stop 2>/dev/null || \
  $HOME/.pm2/node_modules/.bin/pm2 stop all || \
  echo "⚠️  服务停止失败，继续..."

sleep 3

# 更新前端
echo "🎨 更新前端..."
if [ -d "${NEW_VERSION_DIR}/apps/web/dist" ]; then
  rm -rf "$DEPLOY_DIR/apps/web/dist"
  mkdir -p "$DEPLOY_DIR/apps/web"
  cp -r "${NEW_VERSION_DIR}/apps/web/dist" "$DEPLOY_DIR/apps/web/"
  echo "  ✓ 前端更新完成"
fi

# 更新后端代码（保留node_modules和上传文件）
echo "⚙️  更新后端代码..."
rsync -av \
  --exclude='node_modules' \
  --exclude='uploads' \
  --exclude='logs' \
  --exclude='.env' \
  --exclude='*.log' \
  ${NEW_VERSION_DIR}/apps/api/ "$DEPLOY_DIR/apps/api/"
echo "  ✓ 后端代码更新完成"

# 更新Python服务
echo "🐍 更新Python服务..."
if [ -d "${NEW_VERSION_DIR}/services" ]; then
  rsync -av \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.env' \
    --exclude='venv' \
    ${NEW_VERSION_DIR}/services/ "$DEPLOY_DIR/services/"
  echo "  ✓ Python服务更新完成"
fi

# 安装新依赖（如果有）
echo "📚 检查并安装新依赖..."
cd "$DEPLOY_DIR/apps/api"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install --production 2>&1 | grep -E "(added|updated|removed)" || echo "  ✓ 依赖无变化"

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
npx knex migrate:latest 2>&1 || echo "  ⚠️  迁移失败或无新迁移"

# 重启服务
echo "▶️  重启服务..."
cd "$DEPLOY_DIR/apps/api"
$HOME/.pm2/node_modules/.bin/pm2 restart all || \
  $HOME/.nvm/versions/node/v20.19.5/bin/npm start &

sleep 5

# 清理临时文件
echo "🧹 清理临时文件..."
rm -rf "$TMP_DIR"

# 验证服务状态
echo ""
echo "✅ 更新完成！"
echo ""
echo "📊 服务状态："
$HOME/.pm2/node_modules/.bin/pm2 list 2>/dev/null || ps aux | grep "node src" | grep -v grep

echo ""
echo "🔍 验证服务："
echo "  API服务: curl http://localhost:3000/health"
echo "  查看日志: tail -f $DEPLOY_DIR/apps/api/logs/*.log"
echo ""
echo "💡 备份位置: $BACKUP_DIR/preserve_${TIMESTAMP}/"
