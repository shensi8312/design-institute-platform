# Python 算法服务规划

## 🎯 推荐架构：独立 Python 微服务

```
design-institute-platform/
├── apps/
│   ├── api/          # Node.js 后端（主服务）
│   └── web/          # React 前端
│
└── services/
    ├── vector-service/   # 向量搜索服务
    └── ml-service/       # Python 算法服务 ✨ NEW
        ├── requirements.txt
        ├── Dockerfile
        ├── docker-compose.yml
        ├── main.py           # FastAPI 入口
        ├── config/
        │   └── settings.py
        ├── algorithms/       # 算法模块
        │   ├── __init__.py
        │   ├── ocr/          # OCR 识别
        │   │   ├── __init__.py
        │   │   └── tesseract.py
        │   ├── cv/           # 计算机视觉
        │   │   ├── __init__.py
        │   │   ├── image_processor.py
        │   │   └── feature_extractor.py
        │   ├── cad/          # CAD 处理
        │   │   ├── __init__.py
        │   │   ├── step_parser.py
        │   │   └── geometry.py
        │   └── ml/           # 机器学习
        │       ├── __init__.py
        │       ├── classifier.py
        │       └── embeddings.py
        ├── models/           # 预训练模型
        ├── tests/
        └── utils/
```

---

## 🔧 技术栈建议

### Python 服务框架
```python
# FastAPI (推荐) - 高性能、自动文档
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/ocr")
async def ocr_image(file: UploadFile):
    # OCR 处理
    return {"text": "识别结果"}

@app.post("/api/classify")
async def classify_document(data: dict):
    # 文档分类
    return {"category": "技术图纸"}
```

### 核心依赖
```txt
# requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
numpy==1.24.3
opencv-python==4.8.1
pillow==10.1.0
pytesseract==0.3.10
torch==2.1.0           # 如需深度学习
transformers==4.35.2   # 如需 NLP
pythonOCC-core==7.7.0  # CAD 处理（你已有）
pydantic==2.5.0
python-multipart==0.0.6
```

---

## 🔗 与 Node.js 后端通信

### Node.js 调用 Python 服务

```javascript
// apps/api/src/services/ml/client.js
const axios = require('axios');

class MLServiceClient {
  constructor() {
    this.baseURL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  }

  async classifyDocument(fileBuffer) {
    const formData = new FormData();
    formData.append('file', fileBuffer);

    const response = await axios.post(
      `${this.baseURL}/api/classify`,
      formData
    );
    return response.data;
  }

  async extractCADFeatures(stepFile) {
    const response = await axios.post(
      `${this.baseURL}/api/cad/extract`,
      { file_path: stepFile }
    );
    return response.data;
  }
}

module.exports = new MLServiceClient();
```

### 在控制器中使用

```javascript
// apps/api/src/controllers/documentController.js
const mlService = require('../services/ml/client');

async function uploadDocument(req, res) {
  const file = req.file;

  // 调用 Python 服务进行分类
  const classification = await mlService.classifyDocument(file.buffer);

  // 保存到数据库
  await Document.create({
    filename: file.originalname,
    category: classification.category,
    confidence: classification.confidence
  });

  res.json({ success: true, classification });
}
```

---

## 🐳 Docker 配置

### Python 服务 Dockerfile
```dockerfile
# services/ml-service/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 启动服务
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 添加到 docker-compose.yml
```yaml
# infrastructure/docker/docker-compose.yml
services:
  # ... 现有服务 ...

  ml-service:
    build: ../../services/ml-service
    ports:
      - "8001:8001"
    volumes:
      - ../../services/ml-service:/app
      - ml-models:/app/models
    environment:
      - MODEL_PATH=/app/models
      - LOG_LEVEL=info
    depends_on:
      - redis
      - minio

volumes:
  ml-models:
```

---

## 📝 示例：完整的 Python 服务

### main.py
```python
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from algorithms.ocr.tesseract import TesseractOCR
from algorithms.cad.step_parser import StepParser
from algorithms.ml.classifier import DocumentClassifier

app = FastAPI(title="ML Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化算法
ocr_engine = TesseractOCR()
step_parser = StepParser()
classifier = DocumentClassifier()

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/ocr")
async def ocr_document(file: UploadFile = File(...)):
    """OCR 文字识别"""
    content = await file.read()
    text = ocr_engine.extract_text(content)
    return {"text": text, "confidence": 0.95}

@app.post("/api/classify")
async def classify_document(file: UploadFile = File(...)):
    """文档分类"""
    content = await file.read()
    result = classifier.predict(content)
    return {
        "category": result["category"],
        "confidence": result["confidence"],
        "tags": result["tags"]
    }

@app.post("/api/cad/parse")
async def parse_step_file(file: UploadFile = File(...)):
    """解析 STEP CAD 文件"""
    content = await file.read()
    result = step_parser.parse(content)
    return {
        "parts": result["parts"],
        "assemblies": result["assemblies"],
        "metadata": result["metadata"]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

---

## 🚀 快速开始

### 1. 创建服务目录
```bash
mkdir -p services/ml-service/{algorithms/{ocr,cv,cad,ml},models,tests}
cd services/ml-service
```

### 2. 安装依赖
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 启动开发服务器
```bash
uvicorn main:app --reload --port 8001
```

### 4. 测试 API
```bash
# 访问自动文档
open http://localhost:8001/docs

# 测试健康检查
curl http://localhost:8001/health
```

---

## 🔄 开发工作流

### Python 服务开发
```bash
cd services/ml-service
source venv/bin/activate

# 开发新算法
# 1. 在 algorithms/ 下创建新模块
# 2. 在 main.py 中添加新端点
# 3. 测试
pytest tests/

# 启动
uvicorn main:app --reload
```

### Node.js 调用
```bash
cd apps/api

# 使用 ML 服务
node -e "
const client = require('./src/services/ml/client');
client.classifyDocument(buffer).then(console.log);
"
```

---

## 📊 性能优化建议

### 1. 模型缓存
```python
from functools import lru_cache

@lru_cache(maxsize=1)
def load_model():
    # 只加载一次模型
    return torch.load('models/classifier.pt')
```

### 2. 批处理
```python
@app.post("/api/batch/classify")
async def batch_classify(files: List[UploadFile]):
    # 批量处理提高效率
    results = []
    for file in files:
        result = classifier.predict(await file.read())
        results.append(result)
    return {"results": results}
```

### 3. 异步处理
```python
import asyncio

@app.post("/api/async/process")
async def async_process(file: UploadFile):
    # 长时间任务异步处理
    task_id = str(uuid.uuid4())
    asyncio.create_task(process_heavy_task(task_id, file))
    return {"task_id": task_id, "status": "processing"}
```

---

## 🔐 安全建议

1. **API 认证**：与 Node.js 共享 JWT
2. **输入验证**：使用 Pydantic 模型
3. **文件大小限制**：防止大文件攻击
4. **速率限制**：使用 slowapi

---

## 📈 监控和日志

```python
import logging
from prometheus_client import Counter, Histogram

# 日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 指标
request_count = Counter('ml_requests_total', 'Total requests')
request_duration = Histogram('ml_request_duration_seconds', 'Request duration')

@app.middleware("http")
async def monitor(request, call_next):
    request_count.inc()
    with request_duration.time():
        response = await call_next(request)
    return response
```

---

## ✅ 总结

**推荐架构**：
```
Node.js API (主服务，端口 3000)
    ↓ HTTP 调用
Python ML Service (算法服务，端口 8001)
    ↓ 处理
    - OCR 识别
    - 图像处理
    - CAD 解析
    - 机器学习
```

**优点**：
- ✅ 职责分离：Node.js 处理业务逻辑，Python 处理算法
- ✅ 独立部署：可以单独扩展 Python 服务
- ✅ 技术选型自由：Python 用最合适的 ML 库
- ✅ 易于维护：团队可以并行开发

**下一步**：
1. 创建 `services/ml-service/` 目录
2. 实现第一个算法（如 OCR）
3. 在 Node.js 中集成调用
4. 添加到 docker-compose.yml
