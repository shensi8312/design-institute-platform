# 向量化服务 (Vector Service)

独立的向量化微服务，支持文档向量化、语义搜索、智能问答。

## 特性

- ✅ **完全独立**: 可单独部署，不依赖其他服务
- ✅ **中文优化**: 使用BGE-zh模型，针对中文优化
- ✅ **多格式支持**: PDF、Word、Excel、PPT解析
- ✅ **智能问答**: 集成VLLM/Ollama，支持RAG问答
- ✅ **RESTful API**: 标准接口，易于集成
- ✅ **Docker支持**: 容器化部署

## 快速开始

### 1. 独立运行（给其他项目用）

```bash
# 克隆服务
git clone <this-service-url> vector-service
cd vector-service

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 Milvus 连接信息

# 启动服务
python app.py
# 服务运行在 http://localhost:8085
```

### 2. Docker运行

```bash
# 构建镜像
docker build -t vector-service:latest .

# 运行容器
docker run -d \
  --name vector-service \
  -p 8085:8085 \
  -e MILVUS_HOST=your-milvus-host \
  -e MILVUS_PORT=19530 \
  vector-service:latest
```

### 3. 在设计院平台中使用

```bash
# 在主项目中
cd design-institute-platform
docker-compose up vector-service
```

## API文档

### 健康检查
```
GET /api/health
```

### 文档向量化
```
POST /api/vectorize
Content-Type: multipart/form-data

file: 文档文件
doc_id: 文档ID（可选）
metadata: JSON元数据（可选）
```

### 语义搜索
```
POST /api/search
Content-Type: application/json

{
  "query": "搜索内容",
  "limit": 10,
  "filters": {}
}
```

### 智能问答
```
POST /api/chat
Content-Type: application/json

{
  "question": "问题",
  "context_limit": 5,
  "use_vllm": true
}
```

### 批量处理
```
POST /api/batch_vectorize
Content-Type: multipart/form-data

files[]: 多个文件
```

## 配置说明

### 环境变量 (.env)

```env
# 服务配置
SERVICE_PORT=8085
SERVICE_HOST=0.0.0.0

# Milvus向量数据库
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_COLLECTION=documents

# Embedding模型
EMBEDDING_MODEL=BAAI/bge-base-zh-v1.5
EMBEDDING_DIM=768

# LLM配置（可选）
VLLM_URL=http://10.10.18.2:8000/v1/chat/completions
OLLAMA_URL=http://localhost:11434/api/generate

# Redis队列（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 依赖的外部服务

### 必需
- **Milvus**: 向量数据库（19530端口）

### 可选
- **Redis**: 任务队列（6379端口）
- **VLLM/Ollama**: 大语言模型

## 性能指标

- 向量化速度: ~100文档/分钟
- 搜索延迟: <100ms
- 并发支持: 100+ QPS
- 内存占用: ~2GB

## 集成示例

### Python集成
```python
import requests

# 向量化文档
with open('document.pdf', 'rb') as f:
    response = requests.post(
        'http://localhost:8085/api/vectorize',
        files={'file': f},
        data={'doc_id': 'doc123'}
    )

# 搜索
response = requests.post(
    'http://localhost:8085/api/search',
    json={'query': '建筑规范'}
)
```

### Node.js集成
```javascript
const FormData = require('form-data');
const axios = require('axios');

// 向量化
const form = new FormData();
form.append('file', fs.createReadStream('document.pdf'));
form.append('doc_id', 'doc123');

await axios.post('http://localhost:8085/api/vectorize', form);

// 搜索
const result = await axios.post('http://localhost:8085/api/search', {
  query: '建筑规范'
});
```

## 授权

MIT License - 可自由用于商业项目

## 支持

- Issues: 提交问题
- Email: support@example.com