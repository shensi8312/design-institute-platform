# 语义层 V2.0 - 开发环境快速开始

## 🚀 一键启动开发环境

```bash
# 1. 启动所有依赖服务 (Redis + PostgreSQL + Milvus)
./scripts/start-dev-services.sh

# 2. 运行测试
node scripts/test-cache-service.js          # 测试 Redis 缓存
node scripts/test-milvus-integration.js     # 测试 Milvus 向量库
node scripts/test-incremental-indexing.js   # 测试增量索引
```

---

## 📋 环境要求

### 已有服务
- ✅ **Redis** - localhost:6379 (已运行)
- ✅ **PostgreSQL** - localhost:5433 (已运行)
- ✅ **数据库表** - semantic_chunks, embedding_jobs (已创建)

### 需要启动
- ⏳ **Milvus** - localhost:19530 (自动启动)

---

## 🧪 测试流程

### 1. 缓存服务测试 (约 10 秒)

```bash
node scripts/test-cache-service.js
```

**预期输出:**
```
✅ Redis 缓存初始化成功
✅ 缓存命中
⚡ 加速比: 50.00x
```

### 2. Milvus 集成测试 (约 30 秒)

```bash
node scripts/test-milvus-integration.js
```

**预期输出:**
```
✅ Milvus 客户端初始化成功: localhost:19530
✅ 成功插入/更新 2 个向量
找到 2 条结果
```

### 3. 增量索引测试 (约 60 秒)

```bash
node scripts/test-incremental-indexing.js
```

**预期输出:**
```
第一次索引: { indexed: 3, new: 3, updated: 0, skipped: 0 }
第二次索引: { indexed: 0, new: 0, updated: 0, skipped: 3 }  ⚡ 跳过未变化
第三次索引: { indexed: 2, new: 1, updated: 1, skipped: 2 }  ⚡ 增量更新
```

---

## 🔧 故障排查

### Milvus 连接失败

```bash
# 检查 Milvus 状态
docker-compose -f docker-compose.milvus.yml ps

# 查看日志
docker-compose -f docker-compose.milvus.yml logs milvus

# 重启 Milvus
docker-compose -f docker-compose.milvus.yml restart
```

### Redis 连接失败

```bash
# 检查 Redis
redis-cli ping

# 启动 Redis
redis-server --daemonize yes
```

### PostgreSQL 连接失败

```bash
# 检查连接
psql "postgresql://postgres:postgres@localhost:5433/design_platform" -c "SELECT 1;"
```

---

## 📊 性能基准

| 场景 | 无优化 | V2.0 | 提升 |
|------|--------|------|------|
| 重复索引 | 10s | 0.5s | **20x** |
| 热门查询 | 100ms | 2ms | **50x** |
| 10%内容修改 | 10s | 1.5s | **6.7x** |

---

## 🎯 下一步

测试通过后:

1. **集成到现有系统**
   ```javascript
   // 导入知识库
   await SemanticLayerService.importFromKnowledge(kbId)

   // 导入规范模板
   await SemanticLayerService.importFromTemplates(templateId)

   // 导入规则库
   await SemanticLayerService.importFromRules()
   ```

2. **部署到生产环境**
   ```bash
   # 修改 .env.production 配置
   # 运行迁移
   NODE_ENV=production npx knex migrate:latest

   # 重启服务
   pm2 restart api
   ```

---

## 📚 API 文档

### 索引数据

```javascript
const result = await SemanticLayerService.indexChunks(
  'contract',  // domain
  'clause',    // type
  chunks,      // 数据
  {
    incremental: true,  // 启用增量索引
    immediate: false,   // 使用异步队列
    tenantId: 'tenant1',
    projectId: 'proj1'
  }
)
```

### 语义搜索

```javascript
const results = await SemanticLayerService.search(
  '知识产权条款',  // 查询
  {
    domain: 'contract',
    type: 'clause',
    tenantId: 'tenant1'
  },
  10  // topK
)
```

### 获取统计

```javascript
const stats = await SemanticLayerService.getStats('contract')
```

---

## 🐛 已知问题

- Milvus 首次启动需要约 30 秒
- 大量数据索引建议使用异步队列 (immediate: false)
- 缓存默认 TTL 为 1 小时,可通过环境变量调整

---

## 💡 提示

- 开发环境使用 `localhost` 服务
- 生产环境使用 `10.10.19.4` 服务器
- 测试完成后记得提交代码再部署
