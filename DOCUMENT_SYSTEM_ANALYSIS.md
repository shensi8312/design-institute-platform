# 设计院平台 - 文档处理流程与向量化知识图谱系统分析

**作者**: Claude Code  
**日期**: 2025-11-03  
**范围**: apps/api 核心系统分析

---

## 目录

1. [系统架构概述](#系统架构概述)
2. [文档上传与处理流程](#文档上传与处理流程)
3. [向量化实现详解](#向量化实现详解)
4. [知识图谱提取](#知识图谱提取)
5. [文档分类实现](#文档分类实现)
6. [数据库表结构](#数据库表结构)
7. [现状总结与建议](#现状总结与建议)

---

## 系统架构概述

### 核心组件关系图

```
用户请求 (前端)
    ↓
KnowledgeController (控制层)
    ├→ getKnowledgeBases()
    ├→ uploadDocument()
    ├→ semanticSearch()
    └→ ...
    ↓
KnowledgeService (业务服务层)
    ├→ uploadDocument()
    ├→ vectorizeDocument()
    ├→ extractGraph()
    └→ semanticSearch()
    ↓
    ├─→ DocumentProcessorService (文档处理)
    │   ├→ processDocument()
    │   ├→ chunkText() [分块]
    │   ├→ generateEmbedding() [生成向量]
    │   └→ semanticSearch() [向量搜索]
    │
    ├─→ VectorService (向量检索)
    │   ├→ searchSimilarChunks()
    │   └→ search()
    │
    ├─→ GraphRAGService (知识图谱)
    │   ├→ extractGraph()
    │   ├→ extractByLLM()
    │   └→ getDocumentGraph()
    │
    └─→ DocumentParserService (文档解析)
        ├→ parsePDF()
        ├→ parseWord()
        ├→ parsePowerPoint()
        └→ parseImage() [OCR]
    ↓
数据存储
    ├→ PostgreSQL (业务数据)
    │   ├─ knowledge_documents
    │   ├─ knowledge_bases
    │   ├─ knowledge_document_versions
    │   ├─ knowledge_vectors
    │   ├─ knowledge_graph_nodes
    │   ├─ knowledge_graph_relationships
    │   ├─ knowledge_categories [分类]
    │   └─ graph_entity_types, graph_relationship_types [图谱配置]
    │
    ├→ Milvus (向量数据库)
    │   └─ 存储文档块的向量 (embeddings)
    │
    └→ MinIO (文件存储)
        └─ 存储原始文件、生成的文档等
```

---

## 文档上传与处理流程

### 流程时序图

```
1. 用户上传文件
   ↓
2. KnowledgeController.uploadDocument()
   ├→ 参数验证 (kb_id 检查)
   ├→ 文件上传到 MinIO
   └→ 创建文档记录到 PostgreSQL
   ↓
3. DocumentParserService.parseDocument()
   ├→ 根据文件类型选择解析器
   │  ├─ PDF → parsePDF()
   │  ├─ Word → parseWord()
   │  ├─ PPT → parsePowerPoint()
   │  └─ 图片 → parseImage() [OCR识别]
   ├→ 提取文本内容
   └→ 存储到 knowledge_documents.content
   ↓
4. 创建文档版本记录
   ├→ knowledge_document_versions 表
   ├→ 记录 MD5 哈希、文件路径等
   └→ 设置 is_current = true
   ↓
5. 异步触发文档处理 (setImmediate)
   ├→ 向量化处理 (vectorizeDocument)
   ├→ 知识图谱提取 (extractGraph)
   └→ 自动规则提取
   ↓
6. 更新文档状态
   └─ status: 'processed'
     vector_status: 'completed'
     graph_status: 'completed'
```

### 关键代码片段

**上传入口** (`KnowledgeService.uploadDocument`, 第453行):
```javascript
async uploadDocument(kbId, file, metadata = {}, userId) {
  // 1. 参数验证
  // 2. 上传到 MinIO
  // 3. 文档解析 (DocumentParserService.parseDocument)
  // 4. 创建文档记录
  // 5. 创建初始版本
  // 6. 异步触发处理 (setImmediate)
  //    - vectorizeDocument()
  //    - extractGraph()
}
```

**处理状态字段**:
- `status`: 'pending' → 'processing' → 'processed'/'failed'
- `vector_status`: 'pending' → 'processing' → 'completed'/'failed'
- `graph_status`: 'pending' → 'processing' → 'completed'/'failed'

---

## 向量化实现详解

### 向量化流程

```
DocumentProcessorService.processDocument(docId)
  ↓
1. 获取文档内容
   ↓
2. chunkText(text, chunkSize=512, overlap=50) [文本分块]
   ├─ 以512字符为单位分块
   ├─ 块之间重叠50字符
   └─ 返回数组: [{text, start_pos, end_pos}, ...]
   ↓
3. 对每个分块生成向量
   ├─ generateEmbedding(chunkText)
   │  ├→ 调用 Ollama API
   │  ├→ 模型: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
   │  ├→ 端口: process.env.OLLAMA_HOST || 'http://localhost:11434'
   │  └→ 返回: embedding 向量数组
   │
   ├─ 准备 Milvus 数据
   │  └─ {document_id, chunk_index, chunk_text, embedding}
   │
   └─ 准备 PostgreSQL 向量记录
      └─ {document_id, version_id, chunk_index, chunk_text, milvus_id}
   ↓
4. 批量插入 Milvus
   └─ milvusService.insertVectors(vectorRecords)
   ↓
5. 保存向量记录到 PostgreSQL
   └─ vectorRepository.batchInsertVectors(vectorRecords)
   ↓
6. 更新文档状态
   └─ vector_status: 'completed'
```

### 向量存储架构

**Milvus 中的数据结构**:
```json
{
  "id": <自增或生成的ID>,
  "document_id": "doc-uuid",
  "chunk_index": 0,
  "chunk_text": "文本内容",
  "embedding": [0.123, 0.456, ...] // 1536维或1024维
}
```

**PostgreSQL knowledge_vectors 表**:
- `id` (UUID): 向量记录ID
- `document_id` (UUID): 外键
- `version_id` (UUID): 文档版本外键
- `chunk_index` (INT): 分块索引
- `chunk_text` (TEXT): 原始文本
- `milvus_id` (BIGINT): Milvus中的向量ID
- `created_at` (TIMESTAMP): 创建时间

### 向量检索方式

#### 方式1: 直接向量搜索 (VectorService.searchSimilarChunks)
```javascript
// 生成查询向量
const queryEmbedding = await UnifiedLLMService.generateEmbedding(query);

// 在 Milvus 中搜索相似向量
const milvusResults = await this.milvusService.search(queryEmbedding, topK);

// 过滤和排序
const results = milvusResults
  .filter(r => r.score >= threshold)
  .slice(0, topK)
  .map(r => ({
    content: r.chunk_text,
    documentId: r.document_id,
    score: r.score,
    ...
  }))
```

#### 方式2: 深度搜索 (DeepSearchService)
- 结合向量搜索和知识图谱
- 支持图谱增强（graphEnhanced）
- 返回多个来源 (sources)

#### 方式3: 语义搜索接口 (POST /search/semantic)
```bash
POST /knowledge/search/semantic
Content-Type: application/json

{
  "query": "搜索内容",
  "kb_id": "知识库ID",
  "doc_ids": ["doc-id-1", "doc-id-2"],
  "top_k": 5,
  "threshold": 0.7
}
```

### 向量相关配置

**环境变量**:
```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text  # 或其他向量模型
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

**文本分块参数** (DocumentProcessorService.chunkText):
- `chunkSize`: 512 (字符数)
- `overlap`: 50 (字符)

**向量搜索参数** (VectorService.searchSimilarChunks):
- `topK`: 5-10
- `threshold`: 0.7 (相似度阈值)

---

## 知识图谱提取

### 图谱提取流程

```
GraphRAGService.extractGraph(docId, versionId, textContent)
  ↓
1. 调用 LLM 提取实体和关系
   ├─ extractByLLM(textContent)
   │
   ├→ 从数据库读取实体和关系类型配置
   │  ├─ graph_entity_types (活跃的实体类型)
   │  └─ graph_relationship_types (活跃的关系类型)
   │
   ├→ 构建 LLM 提示词
   │  ├─ 使用 getDomainConfig() 获取领域特定提示
   │  ├─ 包含实体类型列表和关系类型列表
   │  └─ 返回格式: JSON
   │
   ├→ 调用 Ollama LLM
   │  ├─ POST /api/generate
   │  ├─ format: 'json'
   │  └─ temperature: 0.3 (低温，增加稳定性)
   │
   └→ 解析 LLM 返回的 JSON
      └─ {entities: [...], relationships: [...]}
   ↓
2. 处理实体（节点）
   ├─ 为每个实体创建节点
   │  ├─ id: UUID
   │  ├─ document_id: 文档ID
   │  ├─ version_id: 版本ID
   │  ├─ entity_name: 实体名称
   │  ├─ entity_type: 实体类型
   │  └─ properties: {description: ...}
   │
   └─ 批量插入 knowledge_graph_nodes
   ↓
3. 处理关系
   ├─ 为每个关系创建关系记录
   │  ├─ id: UUID
   │  ├─ document_id: 文档ID
   │  ├─ version_id: 版本ID
   │  ├─ source_node_id: 源节点ID
   │  ├─ target_node_id: 目标节点ID
   │  ├─ relationship_type: 关系类型
   │  └─ properties: {description: ...}
   │
   └─ 批量插入 knowledge_graph_relationships
   ↓
4. 更新文档状态
   └─ graph_status: 'completed'
   ↓
5. 自动提取设计规则 (可选)
   └─ RuleExtractionService.extractRulesFromGraph()
```

### 图谱配置

**实体类型** (graph_entity_types 表):
```
- person (人物)
- org (组织)
- location (地点)
- concept (概念)
- tech (技术)
- product (产品)
- other (其他)
```

**关系类型** (graph_relationship_types 表):
```
- is (是)
- has (包含)
- uses (使用)
- belongs_to (属于)
- located_in (位于)
- develops (开发)
- related (相关)
```

### 领域配置支持

**DomainConfig** (apps/api/src/config/DomainConfig.js):
- 支持多领域配置 (architecture, mechanical 等)
- YAML 格式配置文件在 `config/domains/` 目录
- 包含领域特定的实体类型和关系类型
- 提供 LLM 提示词模板

**图谱数据库设计**:
```
knowledge_graph_nodes (节点表)
├─ id (UUID primary)
├─ document_id (UUID FK)
├─ version_id (UUID FK)
├─ entity_name (VARCHAR 255)
├─ entity_type (VARCHAR 100)
├─ properties (JSONB) - 灵活存储属性
└─ created_at (TIMESTAMP)

knowledge_graph_relationships (关系表)
├─ id (UUID primary)
├─ document_id (UUID FK)
├─ version_id (UUID FK)
├─ source_node_id (UUID FK → knowledge_graph_nodes)
├─ target_node_id (UUID FK → knowledge_graph_nodes)
├─ relationship_type (VARCHAR 100)
├─ properties (JSONB)
└─ created_at (TIMESTAMP)
```

### 图谱查询接口

**获取文档图谱**:
```javascript
// 通过 GraphRAGService
const graph = await graphService.getDocumentGraph(docId);
// 返回: { nodes: [...], relationships: [...] }
```

**删除图谱**:
```javascript
// 删除所有关系，再删除节点
await graphRepository.deleteNodesByDocId(docId);
```

---

## 文档分类实现

### 当前状态：已基本实现

**分类相关表**:
1. `knowledge_categories` (分类表)
   - id, name, code, parent_id, organization_id
   - description, icon, color, sort, status
   - 支持层级分类 (parent_id 自引用)

2. `knowledge_documents` (文档表中的分类字段)
   - category_id → 外键指向 knowledge_categories

### 分类字段在文档中

**knowledge_documents 表中的分类相关字段**:
```
- category_id (UUID FK) → knowledge_categories.id
- permission_level (enum) [personal, project, department, organization]
- tags (JSONB) → 用于标签化分类
- metadata (JSONB) → 可存储自定义分类属性
- domain (VARCHAR) → 存储领域信息（建筑、机械等）
```

### 分类查询方式

通过 `KnowledgeService.getDocumentsByKbId()`:
```javascript
// 已支持搜索过滤
async getDocumentsByKbId(kbId, options = {}) {
  const { search = '', page = 1, pageSize = 10 } = options;
  
  // 支持按 title 或 file_name 搜索
  // 可扩展支持 category_id 过滤
}
```

### 文档分类工作流

```
1. 创建分类
   POST /knowledge/categories
   {
     "name": "建筑设计",
     "code": "arch_design",
     "parent_id": null,
     "organization_id": "org-id"
   }
   ↓
2. 上传文档时关联分类
   POST /knowledge/documents/upload
   {
     "kb_id": "kb-id",
     "file": <binary>,
     "category_id": "category-id"
   }
   ↓
3. 查询分类下的文档
   GET /knowledge/documents?category_id=xxx
   ↓
4. 更新文档分类
   PUT /knowledge/documents/{id}
   {
     "category_id": "new-category-id"
   }
```

### 建议的增强

**待实现的分类功能**:
1. 自动分类 (使用 LLM 基于文档内容)
2. 分类权限管理 (哪些用户可以访问哪些分类)
3. 分类统计信息
4. 分类与知识图谱的关联

---

## 数据库表结构

### 核心表概览

```
┌─────────────────────────────────────────────────────────────┐
│                    知识库管理相关表                           │
├─────────────────────────────────────────────────────────────┤

knowledge_bases
├─ id (UUID PK)
├─ name (VARCHAR 200)
├─ description (TEXT)
├─ owner_id (UUID FK → users)
├─ organization_id (UUID FK → organizations)
├─ permission_level (enum: personal, project, department, organization)
├─ category_id (UUID FK → knowledge_categories)
├─ ragflow_kb_id (VARCHAR 100) [RAGFlow 知识库ID]
├─ settings (JSONB)
├─ statistics (JSONB)
└─ status (enum: active, inactive, processing)

knowledge_categories (分类表)
├─ id (UUID PK)
├─ name (VARCHAR 100)
├─ code (VARCHAR 50)
├─ parent_id (UUID FK → self) [层级分类]
├─ organization_id (UUID FK)
├─ description, icon, color
├─ sort, status
└─ unique: (organization_id, code)

knowledge_documents
├─ id (UUID PK)
├─ kb_id (UUID FK → knowledge_bases)
├─ name (VARCHAR 255)
├─ title (VARCHAR 200)
├─ content (TEXT) [文档解析后的内容]
├─ category_id (UUID FK → knowledge_categories)
├─ file_path (VARCHAR)
├─ minio_path (VARCHAR) [MinIO 存储路径]
├─ file_type (VARCHAR 20)
├─ file_size (BIGINT)
├─ upload_by (UUID FK → users)
├─ domain (VARCHAR) [领域: architecture, mechanical 等]
├─ current_version (INT)
├─ status (enum: pending, processing, processed, failed, deleted)
├─ vector_status (enum: pending, processing, completed, failed)
├─ graph_status (enum: pending, processing, completed, failed)
├─ vector_indexed_at (TIMESTAMP)
├─ graph_indexed_at (TIMESTAMP)
├─ vectorization_error, graph_extraction_error (TEXT)
├─ metadata (JSONB) [灵活存储扩展数据]
├─ tags (JSONB) [标签数组]
├─ permission_level (enum)
└─ created_at, updated_at, deleted_at (TIMESTAMP)

┌─────────────────────────────────────────────────────────────┐
│                    版本管理相关表                             │
├─────────────────────────────────────────────────────────────┤

knowledge_document_versions
├─ id (VARCHAR 50 PK)
├─ document_id (VARCHAR FK → knowledge_documents)
├─ version_number (INT)
├─ file_path (TEXT)
├─ minio_path (TEXT)
├─ file_size (BIGINT)
├─ file_hash (VARCHAR 64) [MD5 哈希]
├─ change_description (TEXT)
├─ upload_by (VARCHAR)
├─ is_current (BOOLEAN) [当前版本标记]
├─ created_at (TIMESTAMP)
└─ unique: (document_id, version_number)

┌─────────────────────────────────────────────────────────────┐
│                    向量化相关表                              │
├─────────────────────────────────────────────────────────────┤

knowledge_vectors
├─ id (VARCHAR 50 PK)
├─ document_id (VARCHAR FK)
├─ version_id (VARCHAR FK → knowledge_document_versions)
├─ chunk_index (INT) [分块索引]
├─ chunk_text (TEXT) [原始文本块]
├─ milvus_id (BIGINT) [Milvus 中的向量ID]
└─ created_at (TIMESTAMP)

[Milvus 向量库 - 不是 PostgreSQL]
├─ id (BIGINT)
├─ document_id (UUID)
├─ chunk_index (INT)
├─ chunk_text (VARCHAR/TEXT)
└─ embedding (Float32 1024/1536维)

┌─────────────────────────────────────────────────────────────┐
│                    知识图谱相关表                            │
├─────────────────────────────────────────────────────────────┤

graph_entity_types (实体类型配置)
├─ id (VARCHAR 50 PK)
├─ name (VARCHAR 100) [类型名称]
├─ color (VARCHAR 20)
├─ icon (VARCHAR 50)
├─ description (TEXT)
├─ is_active (BOOLEAN)
└─ sort_order (INT)

graph_relationship_types (关系类型配置)
├─ id (VARCHAR 50 PK)
├─ name (VARCHAR 100)
├─ color (VARCHAR 20)
├─ description (TEXT)
├─ is_active (BOOLEAN)
├─ is_directed (BOOLEAN) [是否有方向]
└─ sort_order (INT)

knowledge_graph_nodes (图谱节点)
├─ id (VARCHAR 50 PK)
├─ document_id (VARCHAR FK)
├─ version_id (VARCHAR FK)
├─ entity_name (VARCHAR 255)
├─ entity_type (VARCHAR 100)
├─ properties (JSONB) [灵活存储实体属性]
└─ created_at (TIMESTAMP)

knowledge_graph_relationships (图谱关系)
├─ id (VARCHAR 50 PK)
├─ document_id (VARCHAR FK)
├─ version_id (VARCHAR FK)
├─ source_node_id (VARCHAR FK → knowledge_graph_nodes)
├─ target_node_id (VARCHAR FK → knowledge_graph_nodes)
├─ relationship_type (VARCHAR 100)
├─ properties (JSONB)
└─ created_at (TIMESTAMP)

┌─────────────────────────────────────────────────────────────┐
│                    图谱查询和优化记录                        │
├─────────────────────────────────────────────────────────────┤

graph_build_tasks
├─ id (UUID PK)
├─ kb_id (UUID FK)
├─ document_count (INT)
├─ status (enum: pending, processing, completed, failed)
├─ result (JSONB) [构建结果统计]
├─ error_message (TEXT)
└─ timestamps

graph_query_history
├─ id (UUID PK)
├─ kb_id (UUID FK)
├─ user_id (UUID FK)
├─ question (TEXT)
├─ answer (TEXT)
├─ sources (JSONB)
├─ confidence (DECIMAL)
└─ response_time (INT) [毫秒]

graph_optimization_history
├─ id (UUID PK)
├─ kb_id (UUID FK)
├─ metrics_before (JSONB)
├─ metrics_after (JSONB)
└─ optimized_at (TIMESTAMP)
```

### 字段索引

**knowledge_documents 的关键索引**:
- (kb_id, status)
- (upload_by)
- (category_id)
- (permission_level)
- (domain)
- (vector_status, graph_status) [可考虑添加]

**knowledge_vectors 的关键索引**:
- (document_id) - 用于按文档查询
- (milvus_id) - 用于向量查询关联
- (version_id) - 用于版本查询

**knowledge_graph_nodes 的关键索引**:
- (document_id)
- (entity_type)
- (version_id)

---

## 现状总结与建议

### 已完成的功能

1. **文档上传与管理** ✓
   - 支持多种文件格式 (PDF, Word, PPT, TXT, 图片)
   - 文件上传到 MinIO
   - 文档版本管理
   - 软删除机制

2. **文档解析** ✓
   - PDF 解析 (pdf-parse)
   - Word 解析 (mammoth)
   - PPT 解析 (jszip)
   - OCR 识别 (集成 DeepSeek-OCR)
   - 智能判断是否需要 OCR (检查文字密度)

3. **向量化和相似度搜索** ✓
   - 文本分块 (512 字符, 50字符重叠)
   - Ollama 向量生成
   - Milvus 向量存储和搜索
   - 多种搜索接口 (DirectSearch, DeepSearch, SemanticSearch)

4. **知识图谱提取** ✓
   - LLM 自动提取实体和关系
   - 支持多领域配置 (DomainConfig)
   - 图谱节点和关系存储
   - 可视化查询接口

5. **分类管理** ✓
   - 多级分类支持 (parent_id)
   - 文档与分类关联
   - 权限级别管理 (personal, project, department, organization)

6. **异步处理** ✓
   - 文档上传后异步向量化和图谱提取
   - 错误日志记录
   - 重试机制 (DocumentErrorLogger)

### 待完善的地方

1. **自动分类** ⚠️
   - 目前分类需要手动指定
   - 可以使用 LLM 基于文档内容自动分类

2. **错误恢复** ⚠️
   - 虽然有错误记录，但缺乏自动重试机制
   - 支持手动重新处理 (`POST /documents/:id/revectorize`)
   - 建议添加定时任务定期重试失败的任务

3. **性能优化** ⚠️
   - 大文件处理可能较慢
   - 向量搜索缓存不足
   - 建议添加分页处理和批量处理

4. **监控和统计** ⚠️
   - 缺乏完整的处理统计
   - 建议添加处理耗时、成功率等指标
   - 可以利用已有的 graph_query_history 表

5. **并发控制** ⚠️
   - 多个文档同时处理可能导致资源竞争
   - 建议添加队列机制 (如 Bull, RabbitMQ)

### 建议的改进方向

#### 短期 (1-2周)

1. **自动分类功能**
   ```javascript
   // 在 DocumentProcessorService 中添加自动分类
   async classifyDocument(docId, content) {
     const category = await LLM.classifyContent(content);
     // 基于 LLM 推荐更新 category_id
   }
   ```

2. **处理队列化**
   ```javascript
   // 使用 Bull 替代 setImmediate
   const queue = new Queue('document-processing');
   queue.add({docId}, {delay: 1000});
   ```

3. **增强错误恢复**
   ```javascript
   // 添加定时任务重试失败的任务
   if (error && error.retryCount < 3) {
     await scheduleRetry(docId, error, retryCount + 1);
   }
   ```

#### 中期 (1个月)

1. **向量搜索优化**
   - 添加缓存层 (Redis)
   - 搜索结果排序优化
   - 添加搜索统计

2. **图谱可视化**
   - 前端图谱展示组件
   - 交互式节点编辑
   - 图谱统计分析

3. **权限管理完善**
   - 基于角色的分类访问控制
   - 分享和协作功能

#### 长期 (3个月+)

1. **多模态支持**
   - 图片内容理解
   - 视频帧提取和分析
   - 音频转录

2. **智能推荐**
   - 基于用户行为的文档推荐
   - 基于图谱的相关文档推荐

3. **知识发现**
   - 图谱聚类和社区检测
   - 知识主题的自动提取
   - 知识演化追踪

---

## 工作流程总结表

| 阶段 | 服务/模块 | 主要操作 | 数据流向 | 状态标记 |
|------|---------|--------|--------|---------|
| 上传 | Controller | 文件验证、参数解析 | 内存 | - |
| 存储 | MinIO Service | 文件持久化 | MinIO | - |
| 解析 | DocumentParser | 格式识别、内容提取 | 内存→DB | - |
| 记录 | KnowledgeService | 创建文档&版本记录 | PostgreSQL | pending |
| 分块 | DocumentProcessor | 文本分割、重叠处理 | 内存 | processing |
| 向量化 | DocumentProcessor | 调用Ollama、生成向量 | 内存→Milvus | processing |
| 存储向量 | VectorRepository | 向量和关联信息持久化 | PostgreSQL | - |
| 图谱提取 | GraphRAGService | LLM实体关系提取 | 内存 | processing |
| 存储图谱 | GraphRepository | 节点和关系持久化 | PostgreSQL | - |
| 规则提取 | RuleExtraction | 自动规则挖掘 | 内存 | - |
| 完成 | KnowledgeService | 状态更新 | PostgreSQL | completed |

---

## API 端点快速参考

### 知识库管理
- `GET /knowledge/bases` - 获取知识库列表
- `POST /knowledge/bases` - 创建知识库
- `PUT /knowledge/bases/:id` - 更新知识库
- `DELETE /knowledge/bases/:id` - 删除知识库

### 文档管理
- `POST /knowledge/documents/upload` - 上传文档
- `GET /knowledge/documents` - 获取文档列表
- `DELETE /knowledge/documents/:id` - 删除文档
- `GET /knowledge/documents/:id/download` - 下载文档
- `GET /knowledge/documents/:id/preview` - 预览文档
- `GET /knowledge/documents/:id/office-preview` - Office文档预览

### 版本管理
- `GET /knowledge/documents/:id/versions` - 获取版本列表
- `POST /knowledge/documents/:id/versions` - 上传新版本
- `PUT /knowledge/documents/:id/versions/:versionId/activate` - 切换版本

### 搜索和问答
- `POST /knowledge/search/semantic` - 语义搜索
- `POST /knowledge/chat` - 智能问答 (SSE流式)

### 处理和维护
- `POST /knowledge/documents/:id/revectorize` - 重新向量化
- `POST /knowledge/documents/:id/reextract-graph` - 重新提取图谱
- `POST /knowledge/documents/:id/reprocess` - 重新处理文档

---

## 关键配置和环境变量

```bash
# 文件存储
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=knowledge-documents

# 向量化
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_MODEL=qwen2:1.5b (用于 LLM)

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530

# OCR 服务
DOCUMENT_RECOGNITION_SERVICE=http://localhost:8086/api/recognize
USE_OCR_FOR_PDF=true

# 数据库
DATABASE_URL=postgresql://...
```

---

## 文件位置速查

| 功能 | 文件路径 |
|------|--------|
| 文档处理入口 | `apps/api/src/services/document/DocumentProcessorService.js` |
| 向量检索 | `apps/api/src/services/knowledge/VectorService.js` |
| 知识图谱 | `apps/api/src/services/rag/GraphRAGService.js` |
| 知识库服务 | `apps/api/src/services/system/KnowledgeService.js` |
| 控制器 | `apps/api/src/controllers/KnowledgeController.js` |
| 路由定义 | `apps/api/src/routes/knowledge.js` |
| 数据库迁移 | `apps/api/src/database/migrations/` |
| 向量Repository | `apps/api/src/repositories/VectorRepository.js` |
| 图谱Repository | `apps/api/src/repositories/KnowledgeGraphNodesRepository.js` |
| 领域配置 | `apps/api/src/config/DomainConfig.js` |
| 文档解析 | `apps/api/src/services/document/DocumentParserService.js` |

---

## 总结

**设计院平台的文档知识库系统**已经形成了一个相对完整的架构：

1. **完整的文档生命周期管理** - 从上传到版本管理
2. **多层次的内容处理** - 解析、向量化、图谱提取
3. **灵活的存储方案** - PostgreSQL + Milvus + MinIO
4. **丰富的搜索能力** - 向量搜索、图谱增强搜索、多条件过滤
5. **可扩展的架构** - 支持多领域、多格式、异步处理

主要改进方向应该集中在：
- 自动化程度提升 (自动分类、自动重试)
- 性能优化 (队列化、缓存、索引)
- 错误恢复完善
- 监控和可观测性

