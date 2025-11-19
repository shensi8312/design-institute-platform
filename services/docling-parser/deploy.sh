#!/bin/bash
set -e

# 配置
IMAGE_NAME="docling-parser"
IMAGE_TAG="latest"
SERVER_USER="aiuser"
SERVER_HOST="10.10.19.3"
SERVER_PASS="asd123465QWE"
REMOTE_PORT=7001

echo "🔨 1. 构建 Docker 镜像..."
cd "$(dirname "$0")"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "📦 2. 导出镜像..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > /tmp/${IMAGE_NAME}.tar.gz
ls -lh /tmp/${IMAGE_NAME}.tar.gz

echo "🚀 3. 上传到服务器..."
sshpass -p "${SERVER_PASS}" scp -o StrictHostKeyChecking=no \
    /tmp/${IMAGE_NAME}.tar.gz \
    ${SERVER_USER}@${SERVER_HOST}:~/

echo "📥 4. 在服务器上加载并运行..."
sshpass -p "${SERVER_PASS}" ssh -o StrictHostKeyChecking=no \
    ${SERVER_USER}@${SERVER_HOST} << 'EOF'

    echo "加载镜像..."
    gunzip -c ~/docling-parser.tar.gz | docker load

    echo "停止旧容器..."
    docker stop docling-parser 2>/dev/null || true
    docker rm docling-parser 2>/dev/null || true

    echo "启动新容器..."
    docker run -d \
        --name docling-parser \
        --restart unless-stopped \
        -p 7001:7001 \
        docling-parser:latest

    echo "检查状态..."
    sleep 3
    docker ps | grep docling-parser
    curl -s http://localhost:7001/health | head -100

    echo "✅ 部署完成!"
EOF

echo "🧹 清理本地临时文件..."
rm -f /tmp/${IMAGE_NAME}.tar.gz

echo "✅ 全部完成! 服务地址: http://${SERVER_HOST}:${REMOTE_PORT}"
