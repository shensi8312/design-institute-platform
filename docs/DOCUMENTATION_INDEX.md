# 设计院平台 - 文档系统分析索引

## 项目概述

本文档集合提供了设计院平台文档处理、向量化和知识图谱系统的完整分析。

**分析日期**: 2025-11-03  
**范围**: apps/api 核心系统  
**分支**: refactor/architecture-overhaul-20250824

---

## 文档清单

### 1. 详细系统分析
**文件**: `DOCUMENT_SYSTEM_ANALYSIS.md` (13,000+ 字)

**内容**:
- 系统架构概述（组件关系图）
- 文档上传与处理流程（时序图）
- 向量化实现详解（Milvus 集成）
- 知识图谱提取（GraphRAGService）
- 文档分类实现（分层、权限）
- 完整的数据库表结构（14个表详细说明）
- 现状总结与改进建议

**适合人群**: 
- 架构师（了解整体设计）
- 后端开发者（理解数据流）
- DevOps（部署和配置）

---

### 2. 快速参考卡
**文件**: `DOCUMENT_FLOW_QUICK_REFERENCE.md` (3,000+ 字)

**内容**:
- 5分钟核心流程图
- 关键类和方法速查
- 重要参数表
- 常见操作代码片段
- 错误排查表
- 数据库查询示例
- 环境变量配置
- 常见问题 FAQ

**适合人群**:
- 新手开发者（快速上手）
- 日常开发维护（查询工具）
- 故障排查（错误诊断）

---

## 核心知识导航

### 如果你想了解...

#### 文档上传流程
1. 阅读: `DOCUMENT_SYSTEM_ANALYSIS.md` → "文档上传与处理流程"
2. 查看: `KnowledgeService.uploadDocument()` (第453行)
3. 参考: `DOCUMENT_FLOW_QUICK_REFERENCE.md` → "核心流程"

#### 向量化和搜索
1. 阅读: `DOCUMENT_SYSTEM_ANALYSIS.md` → "向量化实现详解"
2. 查看: `DocumentProcessorService.processDocument()`
3. 查看: `VectorService.searchSimilarChunks()`
4. 参考: `DOCUMENT_FLOW_QUICK_REFERENCE.md` → "重要参数速查"

#### 知识图谱
1. 阅读: `DOCUMENT_SYSTEM_ANALYSIS.md` → "知识图谱提取"
2. 查看: `GraphRAGService.extractGraph()`
3. 查看: 数据库表 `knowledge_graph_nodes`, `knowledge_graph_relationships`
4. 参考: "图谱配置" 中的实体和关系类型

#### 数据库设计
1. 阅读: `DOCUMENT_SYSTEM_ANALYSIS.md` → "数据库表结构"
2. 查看: `apps/api/src/database/migrations/` 中的迁移文件
3. 重点: 
   - `021_create_knowledge_versions_and_graph_tables.js`
   - `022_create_graph_config_tables.js`

#### 文档分类
1. 阅读: `DOCUMENT_SYSTEM_ANALYSIS.md` → "文档分类实现"
2. 查看: `knowledge_categories` 表定义
3. 查看: `KnowledgeService.getDocumentsByKbId()`

#### 错误处理和重试
1. 查看: `DocumentErrorLogger` 服务
2. 查看: `knowledge.js` 路由中的 `/revectorize`, `/reextract-graph`, `/reprocess`
3. 参考: `DOCUMENT_FLOW_QUICK_REFERENCE.md` → "错误排查速查表"

---

## 关键文件位置速查

### 服务层
| 功能 | 文件 | 主类 |
|------|------|------|
| 知识库管理 | `services/system/KnowledgeService.js` | KnowledgeService |
| 文档处理 | `services/document/DocumentProcessorService.js` | DocumentProcessorService |
| 文档解析 | `services/document/DocumentParserService.js` | DocumentParserService |
| 向量检索 | `services/knowledge/VectorService.js` | VectorService |
| 知识图谱 | `services/rag/GraphRAGService.js` | GraphRAGService |

### 仓储层
| 功能 | 文件 |
|------|------|
| 向量存储 | `repositories/VectorRepository.js` |
| 图谱存储 | `repositories/KnowledgeGraphNodesRepository.js` |

### 路由和控制器
| 功能 | 文件 |
|------|------|
| 知识库 API | `routes/knowledge.js` |
| 控制器 | `controllers/KnowledgeController.js` |

### 配置和工具
| 功能 | 文件 |
|------|------|
| 领域配置 | `config/DomainConfig.js` |
| 数据库配置 | `config/database.js` |

### 数据库迁移
| 功能 | 文件 |
|------|------|
| 分类表 | `migrations/008_create_knowledge_categories_table.js` |
| 文档表 | `migrations/009_create_knowledge_documents_table.js` |
| 知识库表 | `migrations/011_create_knowledge_bases_table.js` |
| 图谱任务 | `migrations/013_create_graph_tables.js` |
| 版本和图谱 | `migrations/021_create_knowledge_versions_and_graph_tables.js` |
| 图谱配置 | `migrations/022_create_graph_config_tables.js` |

---

## 系统架构速览

```
用户请求
    ↓
[Controller] KnowledgeController
    ↓
[Service] KnowledgeService (协调)
    ├─ DocumentParserService (解析)
    ├─ DocumentProcessorService (处理)
    │  ├─ chunkText (分块)
    │  ├─ generateEmbedding (向量化)
    │  └─ semanticSearch (搜索)
    ├─ VectorService (向量检索)
    ├─ GraphRAGService (图谱提取)
    └─ 其他服务
    ↓
[Repository]
    ├─ VectorRepository
    ├─ KnowledgeGraphNodesRepository
    └─ KnowledgeRepository
    ↓
[Storage]
    ├─ PostgreSQL (业务数据)
    ├─ Milvus (向量库)
    └─ MinIO (文件存储)
```

---

## 数据流速览

### 文档上传到搜索的完整流程

```
1. 用户上传文件
   ↓
2. MinIO 存储文件
3. PostgreSQL 记录文档
4. DocumentParser 解析文件提取文本
   ↓ (异步)
5. DocumentProcessor 分块和向量化
   ├─ 文本分块 (512字符, 50重叠)
   ├─ Ollama 生成向量
   └─ Milvus 存储向量
6. GraphRAGService 提取图谱
   ├─ LLM 提取实体和关系
   └─ PostgreSQL 存储图谱
   ↓
7. 更新文档处理状态
   ↓ (用户查询)
8. VectorService 搜索
   ├─ 生成查询向量
   ├─ Milvus 相似搜索
   └─ 返回相似块
```

---

## 重要概念解释

### 向量化 (Vectorization)
将文本分块转换为数值向量（embedding），存储在 Milvus 中用于相似度搜索。

**关键参数**:
- 分块大小: 512 字符
- 重叠: 50 字符
- 向量模型: nomic-embed-text (Ollama)
- 向量库: Milvus

### 知识图谱提取 (Graph RAG)
使用 LLM 自动从文档中提取实体和关系，构建知识图。

**关键组件**:
- LLM 模型: qwen2:1.5b (Ollama)
- 实体类型: 7种 (person, org, location, concept, tech, product, other)
- 关系类型: 7种 (is, has, uses, belongs_to, located_in, develops, related)

### 文档分类
支持多级分类 (parent_id 自引用) 和权限级别 (personal, project, department, organization)。

### 版本管理
每个文档可以有多个版本，每个版本独立维护向量和图谱数据。

---

## 常见工作流

### 工作流 1: 调试向量化失败
1. 检查文档状态: `SELECT vector_status, vectorization_error FROM knowledge_documents WHERE id='...'`
2. 查看错误日志: `knowledge_document_processing_errors` 表
3. 手动重试: `POST /knowledge/documents/{id}/revectorize`
4. 验证结果: 检查 `knowledge_vectors` 表的记录数

### 工作流 2: 验证图谱提取结果
1. 获取文档的图谱: `SELECT * FROM knowledge_graph_nodes WHERE document_id='...'`
2. 查看关系: `SELECT * FROM knowledge_graph_relationships WHERE document_id='...'`
3. 可视化: 前端图谱展示组件（如果已实现）

### 工作流 3: 调试搜索结果
1. 执行搜索: `POST /knowledge/search/semantic`
2. 检查 Milvus 连接: `milvusService.checkHealth()`
3. 降低阈值: 尝试 threshold=0.5 或更低
4. 验证向量库有内容: `SELECT COUNT(*) FROM knowledge_vectors`

### 工作流 4: 处理文件格式支持
1. 在 `DocumentParserService` 中添加新格式
2. 实现对应的 `parseXxx()` 方法
3. 更新文件类型检查逻辑
4. 测试并验证

---

## 关键配置项

### 环境变量
```bash
# 必须配置
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_MODEL=qwen2:1.5b
MILVUS_HOST=localhost
MILVUS_PORT=19530
DATABASE_URL=postgresql://...
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### 可调参数
```javascript
// DocumentProcessorService
chunkSize = 512      // 文本分块大小
overlap = 50         // 块重叠大小

// VectorService
topK = 5             // 返回相似块数量
threshold = 0.7      // 相似度阈值

// GraphRAGService
temperature = 0.3    // LLM 温度（越低越稳定）
```

---

## 性能和优化建议

### 性能基准
- 文档解析: 1-10s
- 向量化: 10-100s
- 图谱提取: 5-30s
- 向量搜索: <1s

### 优化建议
1. **短期**: 自动分类、错误重试机制
2. **中期**: 缓存层、图谱可视化、权限管理
3. **长期**: 多模态支持、智能推荐、知识发现

详见 `DOCUMENT_SYSTEM_ANALYSIS.md` → "现状总结与建议"

---

## 故障诊断速查

| 症状 | 原因 | 解决 |
|------|------|------|
| 向量化失败 | Ollama 未运行 | 启动 Ollama, 检查端口 11434 |
| 搜索无结果 | 向量库为空或阈值过高 | 上传文档、降低 threshold |
| 图谱提取失败 | LLM 超时或网络 | 检查 Ollama, 增加超时 |
| 文件上传失败 | MinIO 问题 | 检查连接、权限、存储空间 |

---

## 下一步建议

### 对于新开发者
1. 先读 `DOCUMENT_FLOW_QUICK_REFERENCE.md` 快速上手
2. 跟踪 `KnowledgeController.uploadDocument()` 代码
3. 理解数据流向（文件→PostgreSQL→Milvus→搜索）
4. 参考详细分析文档了解架构

### 对于功能开发
1. 需求分析 → 查看相关代码段
2. 数据库设计 → 参考现有迁移文件
3. 服务实现 → 遵循现有代码结构
4. 测试验证 → 使用数据库查询和 API 端点验证

### 对于性能优化
1. 瓶颈识别 → 查看"性能基准"
2. 缓存策略 → 向量搜索、LLM 响应缓存
3. 队列化 → 使用 Bull/RabbitMQ 替代 setImmediate
4. 监控告警 → 利用现有的 query_history 表

---

## 相关资源

### 外部链接
- Milvus 文档: https://milvus.io/docs
- Ollama: https://github.com/ollama/ollama
- MinIO: https://min.io/docs
- PostgreSQL: https://www.postgresql.org/docs

### 内部资源
- 前端代码: `apps/web/src/pages/`
- 配置文件: `apps/api/src/config/`
- 数据库迁移: `apps/api/src/database/migrations/`

---

## 更新历史

| 版本 | 日期 | 更新内容 |
|------|------|--------|
| 1.0 | 2025-11-03 | 初版发布，包含详细分析和快速参考 |

---

## 联系和反馈

如有问题或建议，请:
1. 查看常见问题 FAQ (快速参考卡)
2. 检查错误排查表
3. 查阅详细系统分析
4. 联系技术团队

---

**Last Updated**: 2025-11-03  
**Maintained By**: Design Platform Development Team  
**Status**: Active
