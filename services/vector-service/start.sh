#!/bin/bash

# 向量服务独立启动脚本
# 可以单独运行，不依赖主项目

echo "🚀 启动向量服务..."

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3未安装"
    exit 1
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "📦 安装依赖..."
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制环境配置
if [ ! -f ".env" ]; then
    echo "⚙️ 创建环境配置..."
    cp .env.example .env
    echo "请编辑 .env 文件配置Milvus连接信息"
fi

# 检查Milvus连接
echo "🔍 检查Milvus连接..."
python3 -c "
from pymilvus import connections
try:
    connections.connect(host='localhost', port='19530')
    print('✅ Milvus连接成功')
except:
    print('⚠️ Milvus未运行，请先启动Milvus')
    print('  docker run -d --name milvus-standalone \\\\')
    print('    -p 19530:19530 \\\\')
    print('    -p 9091:9091 \\\\')
    print('    -v ./volumes/milvus:/var/lib/milvus \\\\')
    print('    milvusdb/milvus:latest')
"

# 启动服务
echo "✨ 启动向量服务..."
echo "📍 服务地址: http://localhost:8085"
echo "📚 API文档: http://localhost:8085/api/health"
echo ""

python3 app.py