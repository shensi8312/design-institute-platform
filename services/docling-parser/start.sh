#!/bin/bash
# Docling 服务启动脚本

cd "$(dirname "$0")"

# 激活虚拟环境
source venv/bin/activate

# 启动服务
echo "🚀 启动 Docling 文档解析服务..."
echo "📍 监听端口: 7001"
python app.py
