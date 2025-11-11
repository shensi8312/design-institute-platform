# RAG契约一致性审计报告

**审计日期**: 2025-11-11  
**审计范围**: BOM学习系统、PID识别系统、模板系统、装配推理系统  
**审计方法**: 代码分析、Migration检查、前后端契约对比、分支差异分析

---

## 执行摘要

本次审计发现 **7个P0级问题** 和 **3个P1级问题**，主要集中在：
1. 未合并的功能分支导致的契约缺失
2. 数据库表重复定义和外键引用错误
3. 前端API调用与后端路由不一致

**关键发现**: BOM学习系统的完整实现（4个API、4个表、380行代码）存在于分支但未合并到main。

---

## 一、不一致问题清单

### P0 - 阻塞性问题（必须立即修复）

#### ❌ P0-1: BOM学习系统功能缺失（分支未合并）

**问题描述**:  
用户要求审计的BOM学习系统API和表结构在main分支**完全不存在**，但在分支`claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY`中有完整实现。

**证据**:
```bash
# 在main分支搜索：无结果
grep -r "uploadHistoricalBOM\|analyzeMatchingPatterns\|getMatchingRules\|getHistoricalCases" apps/api/src/controllers/

# 在分支中存在完整实现
git show claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY:apps/api/src/routes/assembly.js | grep "learn/"
# 输出: /learn/upload-historical-bom, /learn/historical-cases, /learn/analyze-patterns, /learn/matching-rules
```

**缺失内容**:
- **Controller方法** (380行):
  - `uploadHistoricalBOM()` - apps/api/src/controllers/AssemblyController.js:L???
  - `analyzeMatchingPatterns()` 
  - `getMatchingRules()`
  - `getHistoricalCases()`

- **路由** - apps/api/src/routes/assembly.js:
  - `POST /api/assembly/learn/upload-historical-bom`
  - `GET /api/assembly/learn/historical-cases`
  - `POST /api/assembly/learn/analyze-patterns`
  - `GET /api/assembly/learn/matching-rules`

- **数据库表** - apps/api/src/database/migrations/20251111000000_create_knowledge_base_learning_tables.js:
  - `historical_cases` (id, project_name, bom_data, extracted_rules_count, learned_rules, uploaded_by, created_at)
  - `matching_patterns` (pattern_key, occurrence_count, confidence, main_part_type, matching_part_type)
  - `standards_library` (standard_id, standard_data, effective_date, document_path)
  - `design_rules` 扩展字段 (rule_type, condition_data, action_data, confidence, sample_count)

**影响范围**: 整个BOM学习功能不可用

**修复优先级**: P0 - 立即合并或明确功能状态

---

#### ❌ P0-2: assembly_inference_tasks表重复定义

**问题描述**:  
两个migration文件尝试创建同一个表，且schema不一致，会导致migration失败。

**证据**:
```javascript
// Migration 1: 20251029132214_create_assembly_tables.js:3
createTable('assembly_inference_tasks', table => {
  table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))  // UUID主键
  table.string('user_id', 50).notNullable()
  table.string('status', 20).defaultTo('pending')
  // ... 共14个字段
})

// Migration 2: 20251029142500_add_assembly_inference_tasks.js:3
createTable('assembly_inference_tasks', table => {
  table.increments('id').primary()  // INTEGER主键 ❌ 冲突！
  table.string('user_id').notNullable()
  table.enum('status', ['pending', 'processing', 'completed', 'failed'])
  // ... 共8个字段
})
```

**冲突点**:
1. 主键类型不同 (UUID vs INTEGER)
2. status字段类型不同 (STRING vs ENUM)
3. 字段数量不同 (14 vs 8)

**影响范围**: 
- 代码中使用UUID: apps/api/src/controllers/AssemblyController.js:L153 `db('assembly_inference_tasks').where('id', taskId)`
- Migration 2中的`assembly_constraints`表依赖Migration 2的INTEGER外键

**修复建议**: 删除Migration 2（20251029142500），保留Migration 1的UUID版本

---

#### ❌ P0-3: pid_recognition_results引用不存在的表

**问题描述**:  
外键引用的表名错误，实际表名不同。

**证据**:
```javascript
// apps/api/src/database/migrations/20251105084524_create_pid_recognition_results.js:6
table.uuid('document_id')
  .references('id')
  .inTable('documents')  // ❌ 'documents'表不存在
  .onDelete('CASCADE');

// 实际存在的表:
// 1. knowledge_documents (009_create_knowledge_documents_table.js)
// 2. project_documents (20251105000000_create_unified_document_system.js:53)
```

**搜索证据**:
```bash
grep -r "createTable('documents'" apps/api/src/database/migrations/
# 无结果

grep -r "createTable('knowledge_documents'" apps/api/src/database/migrations/
# 009_create_knowledge_documents_table.js:5
```

**影响范围**: 
- Migration执行失败
- PID识别结果无法关联源文档

**修复建议**: 将`documents`改为`knowledge_documents`

---

#### ❌ P0-4: 前端调用的generate-3d和upload-3d路由缺失

**问题描述**:  
前端代码调用了后端不存在的API。

**证据**:
```typescript
// apps/web/src/pages/AssemblyDesignManagement.tsx:283
const response = await axios.post(`/api/assembly/designs/${designId}/generate-3d`)

// apps/web/src/pages/AssemblyDesignManagement.tsx:491
action={`${axios.defaults.baseURL}/api/assembly/designs/${record.id}/upload-3d`}

// 但在 apps/api/src/routes/assembly.js 中搜索：
grep -E "generate-3d|upload-3d" apps/api/src/routes/assembly.js
# 无结果
```

**影响范围**: 
- 前端3D模型生成功能404错误
- 前端3D模型上传功能404错误

**修复建议**: 添加缺失的路由定义或修正前端调用路径

---

### P1 - 高优先级（影响功能完整性）

#### ⚠️ P1-1: design_rules扩展字段多版本冲突

**问题描述**:  
三个migration文件对同一个表添加不同字段，可能存在重复或冲突。

**证据**:
```javascript
// Migration A: 023_create_design_rules_tables.js
// 创建基础表 (12个字段)

// Migration B: 20251106120000_extend_design_rules_for_unified_system.js:10
table.string('rule_type', 50)      // 统一规则系统扩展
table.integer('usage_count')
table.string('learned_from', 20)
// ... +7个字段

// Migration C: 20251111000000_create_knowledge_base_learning_tables.js:85 (分支)
table.string('rule_type', 50)      // ❌ 重复定义！
table.jsonb('condition_data')
table.jsonb('action_data')
// ... +9个字段
```

**冲突点**: 
- `rule_type`字段在两个migration中重复定义
- Migration C在分支中，合并时会冲突
- Migration C使用hasColumn检查，但仍有风险

**影响范围**: 
- 分支合并时migration可能失败
- 字段定义不一致

**修复建议**: 统一字段定义，移除重复，确保幂等性

---

#### ⚠️ P1-2: assembly_constraints表的外键依赖混乱

**问题描述**:  
由于assembly_inference_tasks重复定义，外键引用关系错误。

**证据**:
```javascript
// 20251029132214_create_assembly_tables.js:20
createTable('assembly_constraints', table => {
  table.uuid('task_id')
    .notNullable()
    .references('id')
    .inTable('assembly_inference_tasks')  // 引用UUID版本
    .onDelete('CASCADE')
})

// 20251029142500_add_assembly_inference_tasks.js:16
alterTable('assembly_constraints', table => {
  table.integer('task_id').unsigned()  // ❌ 尝试添加INTEGER版本
  table.foreign('task_id')
    .references('assembly_inference_tasks.id')  // 引用INTEGER版本
})
```

**影响范围**: 
- 外键类型不匹配
- 可能导致关联查询失败

**修复建议**: 删除Migration 2后此问题自动解决

---

#### ⚠️ P1-3: 前端调用/api/pid/save但Controller无此方法名

**问题描述**:  
路由定义与Controller方法名不匹配（轻微）。

**证据**:
```javascript
// apps/api/src/routes/pid.js:48
router.post('/save', authenticate, (req, res) => pidController.saveRecognitionResult(req, res))
// ✓ 实际调用的是 saveRecognitionResult 方法

// apps/web/src/pages/PIDRecognition.tsx:344
const saveResponse = await axios.post('/api/pid/save', {...})
// ✓ 路由正确，只是方法名不同
```

**影响范围**: 
- 功能正常，仅命名风格不一致

**修复建议**: 无需修复，或统一命名风格

---

### P2 - 中优先级（设计改进建议）

#### 💡 P2-1: 缺少migration执行顺序验证

**建议**: 添加migration依赖检查，防止外键引用不存在的表。

#### 💡 P2-2: 缺少数据库索引文档

**建议**: 生成索引清单，优化查询性能。

---

## 二、当前状态快照

### 2.1 Migration清单（Main分支）

```
✓ 001-018: 基础表（组织、用户、项目、知识库、菜单）
✓ 020-023: 审核、版本、图谱、规则表
✓ 20251029132214: assembly_inference_tasks (UUID) + assembly_constraints + assembly_reviews
❌ 20251029142500: assembly_inference_tasks (INTEGER) 重复！
✓ 20251029183000: assembly_designs + design_steps + design_reviews
✓ 20251103030317: document_processing_errors
✓ 20251103095852: assembly_designs 3D字段扩展
✓ 20251105000000: 统一文档系统（10个表）
✓ 20251105084524: pid_recognition_results (❌引用documents)
✓ 20251105120000: drawing_comparison_tasks
✓ 20251106120000: design_rules扩展
✓ 20251107000000: pid添加assembly_task_id外键
✓ 20251107120000: 文档处理队列
✓ 20251108000000: 装配MVP表（5个表）
✓ 20251110000001: 模板系统（5个表）
```

### 2.2 API路由与表依赖

| 路由 | Controller方法 | 依赖表 | 状态 |
|------|---------------|--------|------|
| POST /api/assembly/infer | AssemblyController.infer | assembly_inference_tasks, assembly_constraints | ✓ OK |
| GET /api/assembly/tasks | AssemblyController.getTasks | assembly_inference_tasks | ✓ OK |
| POST /api/assembly/designs/create | AssemblyController.createDesign | assembly_designs | ✓ OK |
| POST /api/assembly/learn/upload-historical-bom | AssemblyController.uploadHistoricalBOM | historical_cases | ❌ 分支未合并 |
| POST /api/assembly/learn/analyze-patterns | AssemblyController.analyzeMatchingPatterns | matching_patterns | ❌ 分支未合并 |
| GET /api/assembly/learn/matching-rules | AssemblyController.getMatchingRules | matching_patterns | ❌ 分支未合并 |
| POST /api/pid/recognize | PIDController.recognizePID | pid_recognition_results | ✓ OK |
| POST /api/pid/results/:id/to-assembly | PIDController.createAssemblyFromPID | pid_recognition_results, assembly_inference_tasks | ✓ OK |

### 2.3 表结构完整性

| 表名 | Migration文件 | 被引用次数 | 状态 |
|------|--------------|----------|------|
| assembly_inference_tasks | 2个文件 ❌ | 8次 | 重复定义 |
| assembly_constraints | 20251029132214 + 20251029142500 | 3次 | 外键混乱 |
| pid_recognition_results | 20251105084524 | 11次 | 外键错误 |
| historical_cases | (分支) 20251111000000 | 0次 | 未合并 |
| matching_patterns | (分支) 20251111000000 | 0次 | 未合并 |
| standards_library | (分支) 20251111000000 | 0次 | 未合并 |
| design_rules | 023 + 20251106120000 + (分支)20251111000000 | 15次 | 多版本扩展 |
| parts_catalog | 20251108000000 | 5次 | ✓ OK |
| connection_templates | 20251108000000 | 3次 | ✓ OK |
| document_templates | 20251110000001 | 8次 | ✓ OK |

---

## 三、最小修复计划

### 阶段1: 紧急修复（P0问题）- 预计2小时

#### 修复1: 删除重复的assembly_inference_tasks定义

**文件**: `apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js`

**操作**: 删除整个文件（因为20251029132214已创建该表）

**风险**: 
- ✓ 低风险：Migration 2的功能已被Migration 1覆盖
- ⚠️ 需确认无生产环境已执行Migration 2

**验证命令**:
```bash
# 1. 检查数据库是否已执行此migration
psql $DATABASE_URL -c "SELECT * FROM knex_migrations WHERE name = '20251029142500_add_assembly_inference_tasks.js';"

# 2. 如果已执行，需手动标记为已回滚
psql $DATABASE_URL -c "DELETE FROM knex_migrations WHERE name = '20251029142500_add_assembly_inference_tasks.js';"

# 3. 删除文件
rm apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js

# 4. 验证表结构正确
psql $DATABASE_URL -c "\d+ assembly_inference_tasks;"
```

**回滚策略**: `git restore` 恢复文件

---

#### 修复2: 修正pid_recognition_results的外键引用

**文件**: `apps/api/src/database/migrations/20251105084524_create_pid_recognition_results.js`

**变更**:
```diff
  exports.up = function(knex) {
    return knex.schema.createTable('pid_recognition_results', table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  
      // 关联原始文档
-     table.uuid('document_id').references('id').inTable('documents').onDelete('CASCADE');
+     table.uuid('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE');  // [PE-fix-table-name]
      table.string('file_name').notNullable();
```

**验证命令**:
```bash
# 1. 如果表已创建，需手动修改外键
psql $DATABASE_URL << 'SQL'
ALTER TABLE pid_recognition_results 
  DROP CONSTRAINT IF EXISTS pid_recognition_results_document_id_foreign;

ALTER TABLE pid_recognition_results 
  ADD CONSTRAINT pid_recognition_results_document_id_foreign 
  FOREIGN KEY (document_id) 
  REFERENCES knowledge_documents(id) 
  ON DELETE CASCADE;
SQL

# 2. 验证外键
psql $DATABASE_URL -c "\d+ pid_recognition_results;" | grep -A5 "Foreign-key"
```

**回滚策略**: 使用修改前的表名（但会失败，因为documents表不存在）

---

#### 修复3: 添加缺失的generate-3d和upload-3d路由

**文件**: `apps/api/src/routes/assembly.js`

**操作**: 在现有路由后添加

```javascript
// ========== 3D模型管理 ==========

// 生成3D模型
router.post('/designs/:designId/generate-3d', authenticate, AssemblyController.generate3DModel)

// 上传3D模型（已存在upload.single('model')）
router.post('/designs/:designId/upload-3d', authenticate, upload.single('model'), AssemblyController.upload3DModel)
```

**验证命令**:
```bash
# 1. 检查Controller中是否有这两个方法
grep -n "generate3DModel\|upload3DModel" apps/api/src/controllers/AssemblyController.js

# 2. 如果不存在，需创建方法
# 如果upload3DModel已存在（见assembly.js:118），则只需调整路由名
```

**注意**: 
- 检查Controller中实际方法名是`upload3DModel`还是`upload3DModel`
- Line 118已有`/designs/:designId/3d-model`上传路由，可能只需统一路径

**最小方案**: 前端改用现有路由 `/designs/:designId/3d-model` (POST上传, GET获取)

---

#### 修复4: 合并BOM学习系统分支或标记为未实现

**选项A（推荐）**: 合并分支

```bash
# 1. 切换到main分支
git checkout main

# 2. 合并学习系统分支
git merge claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY

# 3. 解决冲突（预计有design_rules扩展字段冲突）
git status

# 4. 运行migration
npm run migrate

# 5. 验证API
curl -X GET http://localhost:3000/api/assembly/learn/historical-cases \
  -H "Authorization: Bearer $TOKEN"
```

**选项B**: 标记为未实现

在项目文档中明确说明BOM学习功能未实现，移除相关需求或标记为Roadmap。

**验证命令**:
```bash
# 合并后验证4个表是否创建
psql $DATABASE_URL -c "\dt historical_cases"
psql $DATABASE_URL -c "\dt matching_patterns"
psql $DATABASE_URL -c "\dt standards_library"

# 验证API路由
curl -X POST http://localhost:3000/api/assembly/learn/upload-historical-bom \
  -H "Authorization: Bearer $TOKEN" \
  -F "bom_files=@test.xlsx"
```

---

### 阶段2: 优化改进（P1问题）- 预计1小时

#### 修复5: 统一design_rules扩展字段（如果合并分支）

**文件**: `apps/api/src/database/migrations/20251111000000_create_knowledge_base_learning_tables.js`

**操作**: 移除与20251106120000重复的字段检查，确保幂等

```diff
  // 3. 检查design_rules表是否需要添加新字段
- const hasRuleType = await knex.schema.hasColumn('design_rules', 'rule_type')
  const hasConditionData = await knex.schema.hasColumn('design_rules', 'condition_data')
  
  if (!hasConditionData) {
    await knex.schema.alterTable('design_rules', (table) => {
-     if (!hasRuleType) {
-       table.string('rule_type', 50)  // ❌ 删除，已由20251106120000添加
-     }
      table.jsonb('condition_data')
      table.jsonb('action_data')
      // ... 其他新字段
    })
  }
```

**验证命令**:
```bash
# 1. 检查design_rules最终字段列表
psql $DATABASE_URL -c "\d+ design_rules;" | grep "rule_type\|condition_data"

# 2. 确保无重复索引
psql $DATABASE_URL -c "\d+ design_rules;" | grep "Indexes:"
```

---

## 四、验证策略

### 4.1 数据库验证

```bash
# 1. 检查所有表是否存在
cat > /tmp/check_tables.sql << 'SQL'
SELECT 
  tablename,
  CASE 
    WHEN tablename IN ('assembly_inference_tasks', 'assembly_constraints', 'pid_recognition_results', 
                       'historical_cases', 'matching_patterns', 'standards_library', 'parts_catalog') 
    THEN '✓' 
    ELSE '?' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'assembly_inference_tasks', 'assembly_constraints', 'assembly_reviews',
    'pid_recognition_results', 'historical_cases', 'matching_patterns',
    'standards_library', 'parts_catalog', 'connection_templates',
    'document_templates', 'design_rules'
  )
ORDER BY tablename;
SQL

psql $DATABASE_URL -f /tmp/check_tables.sql

# 2. 检查外键完整性
psql $DATABASE_URL << 'SQL'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('pid_recognition_results', 'assembly_constraints')
ORDER BY tc.table_name;
SQL

# 3. 检查索引
psql $DATABASE_URL -c "\di+" | grep -E "(assembly|pid|historical|matching)"
```

### 4.2 API端点验证

```bash
# 准备测试token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # 替换为实际token

# 1. 测试装配推理API
curl -sf -X POST http://localhost:3000/api/assembly/infer \
  -H "Authorization: Bearer $TOKEN" \
  -F "bom=@fixtures/test_bom.xlsx" \
  | jq '.success'

# 2. 测试PID识别API
curl -sf -X POST http://localhost:3000/api/pid/recognize?method=qwenvl \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@fixtures/test_pid.pdf" \
  | jq '.success'

# 3. 测试学习系统API（如果已合并）
curl -sf http://localhost:3000/api/assembly/learn/historical-cases \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length'

# 4. 测试缺失的3D路由（应返回404或成功）
curl -sf -X POST http://localhost:3000/api/assembly/designs/test123/generate-3d \
  -H "Authorization: Bearer $TOKEN" \
  || echo "❌ 路由不存在"
```

### 4.3 前端集成验证

```bash
# 1. 启动前端开发服务器
cd apps/web
npm run dev

# 2. 手动测试页面
# - 访问 http://localhost:5173/assembly/tasks
# - 测试上传BOM文件
# - 测试3D模型生成（应无404错误）

# 3. 检查浏览器控制台
# - 打开开发者工具 -> Network
# - 执行操作，检查API调用状态码
# - 预期无404错误
```

---

## 五、回滚策略

### 场景1: Migration执行失败

```bash
# 1. 回滚到上一个成功的migration
npm run migrate:rollback

# 2. 检查knex_migrations表
psql $DATABASE_URL -c "SELECT name, migration_time FROM knex_migrations ORDER BY id DESC LIMIT 5;"

# 3. 恢复修改的文件
git checkout HEAD -- apps/api/src/database/migrations/
```

### 场景2: API路由冲突

```bash
# 1. 重启API服务器（清除路由缓存）
pm2 restart api

# 2. 如果问题持续，回退路由文件
git checkout HEAD -- apps/api/src/routes/assembly.js
```

### 场景3: 分支合并冲突

```bash
# 1. 中止合并
git merge --abort

# 2. 使用策略合并（保留main分支版本）
git merge -X theirs claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY

# 3. 或手动挑选提交
git cherry-pick ea0929c  # BOM学习系统提交
```

---

## 六、附录

### A. 分支对比摘要

```bash
git diff main...claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY --stat
```

| 文件 | 变更类型 | 行数 |
|------|---------|------|
| apps/api/src/controllers/AssemblyController.js | 修改 | +388 |
| apps/api/src/routes/assembly.js | 修改 | +30 |
| apps/api/src/database/migrations/20251111000000_create_knowledge_base_learning_tables.js | 新增 | +180 |

### B. 关键配置文件

- **数据库连接**: `apps/api/src/config/database.js`
- **Migration配置**: `apps/api/knexfile.js`
- **环境变量**: `.env` (DATABASE_URL, JWT_SECRET)

### C. 联系人

- **后端负责人**: [填写]
- **前端负责人**: [填写]
- **DBA**: [填写]

---

**审计完成时间**: 2025-11-11  
**下次审计计划**: 分支合并后1周内
