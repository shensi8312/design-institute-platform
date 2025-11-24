#!/bin/bash

echo "🚀 启动开发环境服务..."
echo ""

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker 未运行，请先启动 Docker Desktop"
  exit 1
fi

# 检查 Redis
echo "1️⃣ 检查 Redis..."
if redis-cli ping > /dev/null 2>&1; then
  echo "   ✅ Redis 已运行"
else
  echo "   ⚠️  Redis 未运行，尝试启动..."
  redis-server --daemonize yes > /dev/null 2>&1
  sleep 2
  if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis 启动成功"
  else
    echo "   ❌ Redis 启动失败"
    exit 1
  fi
fi

# 检查 PostgreSQL
echo ""
echo "2️⃣ 检查 PostgreSQL (端口 5433)..."
if psql "postgresql://postgres:postgres@localhost:5433/design_platform" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "   ✅ PostgreSQL 已运行"
else
  echo "   ❌ PostgreSQL 未运行 (端口 5433)"
  echo "   请手动启动 PostgreSQL"
  exit 1
fi

# 启动 Milvus
echo ""
echo "3️⃣ 启动 Milvus..."
if nc -zv localhost 19530 > /dev/null 2>&1; then
  echo "   ✅ Milvus 已运行"
else
  echo "   🐳 启动 Milvus Docker 容器..."
  cd /Users/shenguoli/Documents/projects/design-institute-platform/apps/api
  docker-compose -f docker-compose.milvus.yml up -d

  echo "   ⏳ 等待 Milvus 启动 (约30秒)..."
  for i in {1..30}; do
    if nc -zv localhost 19530 > /dev/null 2>&1; then
      echo "   ✅ Milvus 启动成功"
      break
    fi
    sleep 1
    echo -n "."
  done

  if ! nc -zv localhost 19530 > /dev/null 2>&1; then
    echo ""
    echo "   ⚠️  Milvus 启动超时，请检查 Docker 日志:"
    echo "   docker-compose -f docker-compose.milvus.yml logs"
  fi
fi

echo ""
echo "==================================="
echo "✅ 开发环境服务检查完成"
echo "==================================="
echo ""
echo "服务状态:"
echo "  - Redis:      localhost:6379"
echo "  - PostgreSQL: localhost:5433"
echo "  - Milvus:     localhost:19530"
echo ""
echo "现在可以运行测试:"
echo "  node scripts/test-cache-service.js"
echo "  node scripts/test-milvus-integration.js"
echo "  node scripts/test-incremental-indexing.js"
echo ""
