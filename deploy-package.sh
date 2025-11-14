#!/bin/bash

set -e

echo "🚀 开始打包项目..."

# 定义变量
PROJECT_NAME="design-institute-platform"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="${PROJECT_NAME}_${TIMESTAMP}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/deploy-packages"

# 创建临时目录
mkdir -p "${TEMP_DIR}"
mkdir -p "${OUTPUT_DIR}"

echo "📦 复制项目文件..."

# 复制前端构建文件
echo "  - 复制前端构建文件..."
mkdir -p "${TEMP_DIR}/apps/web"
cp -r apps/web/dist "${TEMP_DIR}/apps/web/"
cp apps/web/package.json "${TEMP_DIR}/apps/web/"

# 复制后端API代码（不包含node_modules）
echo "  - 复制后端API代码..."
mkdir -p "${TEMP_DIR}/apps/api"
rsync -av --exclude='node_modules' \
         --exclude='uploads' \
         --exclude='logs' \
         --exclude='*.log' \
         --exclude='.env' \
         --exclude='test_*.js' \
         apps/api/ "${TEMP_DIR}/apps/api/"

# 复制服务代码
echo "  - 复制Python服务..."
mkdir -p "${TEMP_DIR}/services"

# document-recognition 服务
if [ -d "services/document-recognition" ]; then
  mkdir -p "${TEMP_DIR}/services/document-recognition"
  rsync -av --exclude='__pycache__' \
           --exclude='*.pyc' \
           --exclude='.pytest_cache' \
           --exclude='venv' \
           --exclude='.env' \
           services/document-recognition/ "${TEMP_DIR}/services/document-recognition/"
fi

# vector-service 服务
if [ -d "services/vector-service" ]; then
  mkdir -p "${TEMP_DIR}/services/vector-service"
  rsync -av --exclude='__pycache__' \
           --exclude='*.pyc' \
           --exclude='.pytest_cache' \
           --exclude='venv' \
           --exclude='.env' \
           services/vector-service/ "${TEMP_DIR}/services/vector-service/"
fi

# assembly-solver 服务
if [ -d "services/assembly-solver" ]; then
  mkdir -p "${TEMP_DIR}/services/assembly-solver"
  rsync -av --exclude='__pycache__' \
           --exclude='*.pyc' \
           --exclude='.pytest_cache' \
           --exclude='venv' \
           --exclude='.env' \
           services/assembly-solver/ "${TEMP_DIR}/services/assembly-solver/"
fi

# 复制配置文件
echo "  - 复制配置文件..."
[ -f "package.json" ] && cp package.json "${TEMP_DIR}/"
[ -f "Makefile" ] && cp Makefile "${TEMP_DIR}/"
[ -f "README.md" ] && cp README.md "${TEMP_DIR}/"

# 复制数据库迁移文件
if [ -d "apps/api/migrations" ]; then
  echo "  - 复制数据库迁移文件..."
  mkdir -p "${TEMP_DIR}/apps/api/migrations"
  cp -r apps/api/migrations/* "${TEMP_DIR}/apps/api/migrations/"
fi

# 复制部署脚本（如果存在）
echo "  - 复制部署脚本..."
[ -f "deploy-to-server.sh" ] && cp deploy-to-server.sh "${TEMP_DIR}/"
[ -f "start.sh" ] && cp start.sh "${TEMP_DIR}/"

# 创建环境变量模板
echo "  - 创建环境变量模板..."
cat > "${TEMP_DIR}/.env.example" << 'EOF'
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=design_institute_platform
DB_USER=postgres
DB_PASSWORD=your_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your_jwt_secret_here

# API配置
API_PORT=3000
WEB_PORT=8000

# 服务配置
DOCUMENT_RECOGNITION_SERVICE=http://localhost:7000
VECTOR_SERVICE_URL=http://localhost:8001
KNOWLEDGE_GRAPH_SERVICE=http://localhost:8002

# AI服务配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=http://localhost:8080/v1/chat/completions

# OnlyOffice配置
ONLYOFFICE_URL=http://10.10.6.95
EOF

# 创建部署说明文档
cat > "${TEMP_DIR}/DEPLOY.md" << 'EOF'
# 部署说明

## 服务器要求
- Node.js 18+
- Python 3.9+
- PostgreSQL 13+
- Redis 6+
- Nginx (可选)

## 部署步骤

### 1. 解压文件
```bash
tar -xzf design-institute-platform_*.tar.gz
cd design-institute-platform_*
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
vi .env
```

### 3. 安装依赖

#### 安装后端依赖
```bash
cd apps/api
npm install --production
cd ../..
```

#### 安装Python服务依赖
```bash
# document-recognition
cd services/document-recognition
pip3 install -r requirements.txt
cd ../..

# vector-service
cd services/vector-service
pip3 install -r requirements.txt
cd ../..
```

### 4. 数据库迁移
```bash
cd apps/api
npx knex migrate:latest
cd ../..
```

### 5. 启动服务

#### 使用PM2启动（推荐）
```bash
# 安装PM2
npm install -g pm2

# 启动API服务
cd apps/api
pm2 start src/server.js --name api

# 启动Python服务
cd ../../services/document-recognition
pm2 start src/app.py --name doc-recognition --interpreter python3

cd ../vector-service
pm2 start src/app.py --name vector-service --interpreter python3
```

#### 或手动启动
```bash
# 后端API
cd apps/api
NODE_ENV=production npm start &

# Python服务
cd services/document-recognition
python3 src/app.py &

cd ../vector-service
python3 src/app.py &
```

### 6. 配置Nginx（可选）
参考 nginx.conf.example 配置反向代理

### 7. 验证部署
```bash
# 检查API服务
curl http://localhost:3000/health

# 检查文档识别服务
curl http://localhost:7000/health

# 检查向量服务
curl http://localhost:8001/health
```

## 目录结构
```
├── apps/
│   ├── api/          # 后端API服务
│   └── web/          # 前端构建文件
├── services/
│   ├── document-recognition/  # 文档识别服务
│   ├── vector-service/        # 向量服务
│   └── assembly-solver/       # 装配求解服务
├── .env.example      # 环境变量模板
└── DEPLOY.md        # 本文档
```

## 故障排除

### 服务无法启动
1. 检查端口是否被占用：`lsof -i :3000`
2. 查看日志：`pm2 logs`
3. 检查环境变量配置

### 数据库连接失败
1. 验证PostgreSQL是否运行：`systemctl status postgresql`
2. 检查数据库配置：`.env`文件中的DB_*变量
3. 测试连接：`psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

### Python服务错误
1. 确认Python版本：`python3 --version`
2. 检查依赖安装：`pip3 list`
3. 查看服务日志
EOF

# 打包
echo "📦 创建压缩包..."
cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# 移动到输出目录
mv "${PACKAGE_NAME}.tar.gz" "${OUTPUT_DIR}/"
cd "${SCRIPT_DIR}"

# 清理临时文件
echo "🧹 清理临时文件..."
rm -rf "${TEMP_DIR}"

# 完成
echo "✅ 打包完成！"
echo "📦 包文件: ${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz"
echo "📊 包大小: $(du -h "${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz" | cut -f1)"
echo ""
echo "📤 上传到服务器命令:"
echo "scp ${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz root@58.209.247.194:~/"
