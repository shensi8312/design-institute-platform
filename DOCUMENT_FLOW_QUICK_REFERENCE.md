# 文档处理流程 - 快速参考卡

## 核心流程（5分钟理解版）

```
用户上传文档
    ↓ (1秒)
MinIO 存储 + DB 记录
    ↓ (异步)
[并行执行]
├─ 文档解析 → 文本提取
├─ 文本分块 → 向量化 → Milvus 存储
└─ LLM 提取 → 知识图谱存储
    ↓
文档处理完成（通知用户）
```

---

## 关键类和方法速查

### 文档上传入口
**文件**: `apps/api/src/controllers/KnowledgeController.js`
```javascript
uploadDocument(req, res)  // 接收文件上传请求
  → KnowledgeService.uploadDocument()  // 业务处理
    → DocumentParserService.parseDocument()  // 文本解析
    → DocumentProcessorService.processDocument() [异步]  // 向量化和图谱
```

### 向量化主流程
**文件**: `apps/api/src/services/document/DocumentProcessorService.js`
```javascript
processDocument(docId)
  → chunkText(text, 512, 50)        // 分块 (512字符, 50重叠)
  → generateEmbedding(chunk)         // 调用 Ollama 生成向量
  → milvusService.insertVectors()   // 批量插入 Milvus
  → vectorRepository.batchInsert()   // 保存元数据到 PostgreSQL
```

### 图谱提取主流程
**文件**: `apps/api/src/services/rag/GraphRAGService.js`
```javascript
extractGraph(docId, versionId, textContent)
  → extractByLLM(textContent)       // 调用 LLM 提取实体和关系
  → graphRepository.batchInsert()   // 保存到 PostgreSQL
```

### 向量搜索
**文件**: `apps/api/src/services/knowledge/VectorService.js`
```javascript
searchSimilarChunks(query, options)
  → UnifiedLLMService.generateEmbedding()  // 生成查询向量
  → milvusService.search()                 // Milvus 搜索
  → 过滤和排序结果                        // 返回最相似的块
```

---

## 数据表关系快图

```
knowledge_documents (文档表)
    ↓ (has)
    ├─→ knowledge_document_versions (版本表)
    │      ↓ (has)
    │      ├─→ knowledge_vectors (向量记录)
    │      │      ↓ (references)
    │      │      └─→ Milvus (向量库)
    │      │
    │      ├─→ knowledge_graph_nodes (图谱节点)
    │      │
    │      └─→ knowledge_graph_relationships (图谱关系)
    │             ↓ (references)
    │             └─→ knowledge_graph_nodes
    │
    ├─→ knowledge_categories (分类)
    ├─→ knowledge_bases (知识库)
    └─→ users (上传者)
```

---

## 状态流转图

### 文档状态
```
pending → processing → processed (成功)
                    ↓
                   failed (失败)
```

### 向量状态和图谱状态
```
pending → processing → completed (成功)
                   ↓
                   failed (失败)
```

---

## 重要参数速查

| 参数 | 默认值 | 位置 | 说明 |
|------|--------|------|------|
| chunkSize | 512 | DocumentProcessorService.chunkText | 文本分块大小（字符） |
| overlap | 50 | DocumentProcessorService.chunkText | 分块重叠（字符） |
| topK | 5-10 | VectorService.searchSimilarChunks | 返回相似块数量 |
| threshold | 0.7 | VectorService.searchSimilarChunks | 相似度阈值 |
| temperature | 0.3 | GraphRAGService.extractByLLM | LLM 温度（越低越稳定） |
| OLLAMA_EMBED_MODEL | nomic-embed-text | 环境变量 | 向量生成模型 |
| OLLAMA_MODEL | qwen2:1.5b | 环境变量 | LLM 模型 |

---

## 常见操作 - 代码片段

### 获取文档的所有向量
```javascript
const vectors = await vectorRepository.getVectorsByDocId(docId);
// 返回: [{id, chunk_index, chunk_text, milvus_id}, ...]
```

### 获取文档的知识图谱
```javascript
const graph = await graphRepository.getGraphByDocId(docId);
// 返回: {nodes: [...], relationships: [...]}
```

### 搜索相似文档块
```javascript
const results = await VectorService.searchSimilarChunks('搜索词', {
  topK: 5,
  threshold: 0.7
});
// 返回: [{content, documentId, score, ...}, ...]
```

### 手动重新处理文档
```javascript
// POST /knowledge/documents/:id/revectorize
// POST /knowledge/documents/:id/reextract-graph
// POST /knowledge/documents/:id/reprocess
```

---

## 错误排查速查表

| 现象 | 可能原因 | 解决方案 |
|------|--------|--------|
| 向量化失败 | Ollama 未运行 | 检查 OLLAMA_HOST 和端口 11434 |
| 图谱提取失败 | LLM 返回格式错误 | 降低温度, 检查 LLM 模型输出 |
| 文档内容为空 | 解析器不支持格式 | 检查 DocumentParserService 支持的格式 |
| 搜索无结果 | 相似度阈值过高 | 降低 threshold 参数 |
| Milvus 连接失败 | Milvus 服务未启动 | 检查 MILVUS_HOST:MILVUS_PORT |
| MinIO 上传失败 | 权限或网络问题 | 检查 MinIO 连接信息和桶权限 |

---

## 数据库查询示例

### 查找处理失败的文档
```sql
SELECT id, name, vector_status, graph_status, vectorization_error 
FROM knowledge_documents 
WHERE vector_status = 'failed' OR graph_status = 'failed'
LIMIT 10;
```

### 查看某知识库的文档统计
```sql
SELECT 
  status, vector_status, graph_status,
  COUNT(*) as count
FROM knowledge_documents
WHERE kb_id = 'kb-id'
GROUP BY status, vector_status, graph_status;
```

### 查找某文档的所有向量块
```sql
SELECT chunk_index, chunk_text, milvus_id
FROM knowledge_vectors
WHERE document_id = 'doc-id'
ORDER BY chunk_index;
```

### 查看知识图谱统计
```sql
SELECT 
  kgn.entity_type,
  COUNT(DISTINCT kgn.id) as node_count,
  COUNT(DISTINCT kgr.id) as relationship_count
FROM knowledge_graph_nodes kgn
LEFT JOIN knowledge_graph_relationships kgr 
  ON kgn.document_id = kgr.document_id
WHERE kgn.document_id = 'doc-id'
GROUP BY kgn.entity_type;
```

---

## 环境变量配置示例

```bash
# Ollama (向量和 LLM)
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_EMBED_MODEL=nomic-embed-text
export OLLAMA_MODEL=qwen2:1.5b

# Milvus (向量库)
export MILVUS_HOST=localhost
export MILVUS_PORT=19530

# MinIO (文件存储)
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export MINIO_BUCKET=knowledge-documents

# OCR 服务
export DOCUMENT_RECOGNITION_SERVICE=http://localhost:8086/api/recognize
export USE_OCR_FOR_PDF=true

# 数据库
export DATABASE_URL=postgresql://user:pass@localhost:5432/design_platform
```

---

## 异步处理的实现

文档上传后，处理是异步执行的：

```javascript
// 在 KnowledgeService.uploadDocument() 中
setImmediate(async () => {
  try {
    // 1. 向量化
    await this.vectorizeDocument(document.id);
    
    // 2. 图谱提取
    await this.extractGraph(document.id);
    
  } catch (error) {
    console.error('文档处理失败:', error);
    // 更新为失败状态
  }
});

// 立即返回响应给用户，无需等待处理完成
return {
  success: true,
  message: '文档上传成功',
  data: document
};
```

**关键特点**:
- 不阻塞上传响应
- 失败时会更新文档状态
- 用户可以通过轮询文档状态来检查处理进度
- 支持手动重新处理

---

## 文件格式支持矩阵

| 格式 | 解析方式 | 支持 OCR | 存储位置 |
|------|--------|--------|--------|
| PDF | pdf-parse 或 OCR | 是 | Minio + DB |
| Word (.docx) | mammoth | 否 | Minio + DB |
| PPT (.pptx) | jszip | 否 | Minio + DB |
| Text (.txt) | 直接读取 | 否 | Minio + DB |
| 图片 (.jpg/.png) | OCR | 是 | Minio + DB |

---

## 性能参考（估算）

| 操作 | 时间 | 影响因素 |
|------|------|--------|
| 文档解析 | 1-10s | 文件大小、格式 |
| 向量化 | 10-100s | 文本长度、Ollama 速度 |
| 图谱提取 | 5-30s | 文本复杂度、LLM 速度 |
| 向量搜索 | <1s | Milvus 性能、向量库大小 |
| 全流程 | 20-150s | 所有因素 |

**优化建议**:
- 使用更快的硬件 GPU
- 增加 Ollama 并行处理数
- 对大文件使用分页处理
- 添加搜索缓存层

---

## 版本管理工作流

```
上传初始版本
    ↓
version_number=1, is_current=true
    ↓
用户上传新版本
    ↓
创建 version_number=2
旧版本: is_current=false
新版本: is_current=true
    ↓
删除旧向量和图谱数据
重新向量化和提取图谱
    ↓
版本 2 变为当前版本
```

---

## 权限模型

文档的权限级别：
- **personal** (个人): 仅所有者可见
- **project** (项目): 项目成员可见
- **department** (部门): 部门成员可见  
- **organization** (企业): 全企业可见

查询时的过滤逻辑：
```javascript
// 获取用户能访问的文档
where(function() {
  // 个人文档：自己创建的
  this.where('permission_level', 'personal')
    .where('owner_id', userId)
  // 企业文档：同组织的
  .orWhere('permission_level', 'organization')
    .where('organization_id', userOrgId)
})
```

---

## 调试技巧

### 查看文档处理日志
```bash
# 检查文档状态
curl http://localhost:3000/knowledge/documents/{id}

# 查看 vector_status 和 graph_status 字段
# pending → processing → completed/failed
```

### 手动重新处理
```bash
# 重新向量化
curl -X POST http://localhost:3000/knowledge/documents/{id}/revectorize

# 重新提取图谱
curl -X POST http://localhost:3000/knowledge/documents/{id}/reextract-graph

# 完整重新处理
curl -X POST http://localhost:3000/knowledge/documents/{id}/reprocess
```

### 检查 Milvus 连接
```javascript
// 在服务中执行
const status = await milvusService.checkHealth();
console.log('Milvus 状态:', status);
```

### 查询 PostgreSQL 向量数量
```bash
psql $DATABASE_URL -c \
  "SELECT COUNT(*) FROM knowledge_vectors WHERE document_id='doc-id';"
```

---

## 常见问题 FAQ

### Q: 为什么文档上传后没有立即出现向量和图谱？
A: 处理是异步的，使用 `setImmediate` 执行。检查 `vector_status` 和 `graph_status` 字段查看进度。

### Q: 如何修改分块大小？
A: 在 `DocumentProcessorService.chunkText()` 中修改 `chunkSize` 和 `overlap` 参数。

### Q: 向量搜索为什么找不到相关文档？
A: 检查阈值是否过高，或向量库中文档数量不足。尝试降低 `threshold` 参数。

### Q: 如何支持新的文件格式？
A: 在 `DocumentParserService.parseDocument()` 中添加新的格式判断和解析逻辑。

### Q: 知识图谱如何与领域相关联？
A: 通过 `DomainConfig` 为不同领域定义不同的实体类型和关系类型。

---

## 下一步阅读

- 详细分析: `DOCUMENT_SYSTEM_ANALYSIS.md`
- 代码入门: 从 `KnowledgeController.uploadDocument()` 开始跟踪
- 数据库: 检查 `apps/api/src/database/migrations/` 中的迁移文件
- 配置: 查看 `apps/api/src/config/DomainConfig.js` 和环境变量设置

