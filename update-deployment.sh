#!/bin/bash

set -e

echo "🔄 开始更新部署..."

# 定义变量
PACKAGE_FILE="$1"
DEPLOY_DIR="/opt/design-institute-platform"
BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 检查包文件
if [ -z "$PACKAGE_FILE" ]; then
  echo "❌ 请提供包文件路径"
  echo "用法: $0 <package_file.tar.gz>"
  exit 1
fi

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

# 备份当前版本（不包括node_modules, uploads, logs）
if [ -d "$DEPLOY_DIR" ]; then
  echo "💾 备份当前版本..."
  BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"

  tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='uploads' \
    --exclude='logs' \
    --exclude='*.log' \
    -C "$DEPLOY_DIR" . || echo "⚠️  备份失败，继续..."

  echo "✅ 备份完成: $BACKUP_FILE"
fi

# 停止服务
echo "⏸️  停止服务..."
cd "$DEPLOY_DIR/apps/api" || true
pm2 stop api || echo "⚠️  API服务未运行"

# 停止Python服务
pm2 stop doc-recognition || echo "⚠️  文档识别服务未运行"
pm2 stop vector-service || echo "⚠️  向量服务未运行"

# 保留需要保留的文件和目录
echo "💾 保留环境变量和数据..."
mkdir -p /tmp/preserve_${TIMESTAMP}

# 保留环境变量
[ -f "$DEPLOY_DIR/apps/api/.env" ] && cp "$DEPLOY_DIR/apps/api/.env" /tmp/preserve_${TIMESTAMP}/api.env
[ -f "$DEPLOY_DIR/services/document-recognition/.env" ] && cp "$DEPLOY_DIR/services/document-recognition/.env" /tmp/preserve_${TIMESTAMP}/doc.env
[ -f "$DEPLOY_DIR/services/vector-service/.env" ] && cp "$DEPLOY_DIR/services/vector-service/.env" /tmp/preserve_${TIMESTAMP}/vector.env

# 保留上传文件目录
[ -d "$DEPLOY_DIR/apps/api/uploads" ] && cp -r "$DEPLOY_DIR/apps/api/uploads" /tmp/preserve_${TIMESTAMP}/
[ -d "$DEPLOY_DIR/apps/api/logs" ] && cp -r "$DEPLOY_DIR/apps/api/logs" /tmp/preserve_${TIMESTAMP}/

# 更新前端
echo "🎨 更新前端..."
rm -rf "$DEPLOY_DIR/apps/web/dist"
mkdir -p "$DEPLOY_DIR/apps/web"
cp -r ${NEW_VERSION_DIR}/apps/web/dist "$DEPLOY_DIR/apps/web/"

# 更新后端代码（保留node_modules）
echo "⚙️  更新后端代码..."
rsync -av \
  --exclude='node_modules' \
  --exclude='uploads' \
  --exclude='logs' \
  --exclude='.env' \
  ${NEW_VERSION_DIR}/apps/api/ "$DEPLOY_DIR/apps/api/"

# 更新Python服务
echo "🐍 更新Python服务..."
if [ -d "${NEW_VERSION_DIR}/services/document-recognition" ]; then
  rsync -av \
    --exclude='__pycache__' \
    --exclude='.env' \
    ${NEW_VERSION_DIR}/services/document-recognition/ "$DEPLOY_DIR/services/document-recognition/"
fi

if [ -d "${NEW_VERSION_DIR}/services/vector-service" ]; then
  rsync -av \
    --exclude='__pycache__' \
    --exclude='.env' \
    ${NEW_VERSION_DIR}/services/vector-service/ "$DEPLOY_DIR/services/vector-service/"
fi

# 恢复环境变量和数据
echo "🔙 恢复环境变量和数据..."
[ -f /tmp/preserve_${TIMESTAMP}/api.env ] && cp /tmp/preserve_${TIMESTAMP}/api.env "$DEPLOY_DIR/apps/api/.env"
[ -f /tmp/preserve_${TIMESTAMP}/doc.env ] && cp /tmp/preserve_${TIMESTAMP}/doc.env "$DEPLOY_DIR/services/document-recognition/.env"
[ -f /tmp/preserve_${TIMESTAMP}/vector.env ] && cp /tmp/preserve_${TIMESTAMP}/vector.env "$DEPLOY_DIR/services/vector-service/.env"

# 恢复上传文件和日志
[ -d /tmp/preserve_${TIMESTAMP}/uploads ] && cp -r /tmp/preserve_${TIMESTAMP}/uploads "$DEPLOY_DIR/apps/api/"
[ -d /tmp/preserve_${TIMESTAMP}/logs ] && cp -r /tmp/preserve_${TIMESTAMP}/logs "$DEPLOY_DIR/apps/api/"

# 安装新依赖（如果有）
echo "📚 检查并安装新依赖..."
cd "$DEPLOY_DIR/apps/api"
npm install --production 2>&1 | grep -E "(added|updated|removed)" || echo "依赖无变化"

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
npx knex migrate:latest || echo "⚠️  迁移失败或无新迁移"

# 启动服务
echo "▶️  启动服务..."
cd "$DEPLOY_DIR/apps/api"
pm2 start src/server.js --name api || pm2 restart api

# 启动Python服务
cd "$DEPLOY_DIR/services/document-recognition"
pm2 start src/app.py --name doc-recognition --interpreter python3 || pm2 restart doc-recognition

cd "$DEPLOY_DIR/services/vector-service"
pm2 start src/app.py --name vector-service --interpreter python3 || pm2 restart vector-service

# 清理临时文件
echo "🧹 清理临时文件..."
rm -rf "$TMP_DIR"
rm -rf /tmp/preserve_${TIMESTAMP}

# 验证服务状态
echo ""
echo "✅ 更新完成！"
echo ""
echo "📊 服务状态："
pm2 list

echo ""
echo "🔍 验证服务："
echo "  API服务: curl http://localhost:3000/health"
echo "  查看日志: pm2 logs"
echo ""
echo "💡 如需回滚，使用备份: $BACKUP_FILE"
