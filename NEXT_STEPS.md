# 下一步操作指南

## 立即操作（必须）

### 1. 提交已修复的代码

```bash
# 查看变更
git status
git diff

# 添加修复文件
git add apps/api/src/database/migrations/20251105084524_create_pid_recognition_results.js
git add apps/web/src/pages/AssemblyDesignManagement.tsx

# 删除重复的migration（Git会自动记录）
git add apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js

# 添加文档
git add CONTRACT_AUDIT_REPORT_2025-11-11.md
git add FIX_SUMMARY_2025-11-11.md
git add apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.REMOVED.md
git add apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js.backup
git add scripts/verify_contract_fixes.sh
git add NEXT_STEPS.md

# 提交
git commit -m "$(cat <<'COMMIT_MSG'
fix(db): 修复契约一致性问题 - P0级修复

## 修复内容

### P0-2: 删除重复的assembly_inference_tasks migration
- 移除: 20251029142500_add_assembly_inference_tasks.js
- 保留: 20251029132214_create_assembly_tables.js (UUID版本)
- 原因: 两个migration创建同一表，主键类型冲突

### P0-3: 修正pid_recognition_results外键引用
- 文件: 20251105084524_create_pid_recognition_results.js
- 修改: documents → knowledge_documents
- 原因: documents表不存在

### P0-4: 统一前端3D模型API路由
- 文件: apps/web/src/pages/AssemblyDesignManagement.tsx
- 修改: /generate-3d, /upload-3d → /3d-model
- 原因: 后端实际路由为/3d-model

## 文档
- 添加完整审计报告: CONTRACT_AUDIT_REPORT_2025-11-11.md
- 添加修复总结: FIX_SUMMARY_2025-11-11.md
- 添加验证脚本: scripts/verify_contract_fixes.sh

## 待处理
- P0-1: BOM学习系统未合并（需决策）
- P1-1: design_rules字段冲突（如合并分支）

参考: CONTRACT_AUDIT_REPORT_2025-11-11.md
COMMIT_MSG
)"
```

---

## 短期操作（本周内）

### 2. 决策BOM学习系统分支

#### 选项A: 合并分支（推荐）

**优点**: 功能完整，380行代码，4个API，4个表  
**缺点**: 需解决design_rules字段冲突

```bash
# 1. 备份当前main分支
git checkout main
git checkout -b backup-before-learning-merge

# 2. 合并分支
git checkout main
git merge claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY

# 3. 解决冲突（预计在design_rules字段）
# 编辑: apps/api/src/database/migrations/20251111000000_create_knowledge_base_learning_tables.js
# 移除rule_type字段的重复检查（已由20251106120000添加）

# 4. 运行migration
npm run migrate

# 5. 测试API
curl -X GET http://localhost:3000/api/assembly/learn/historical-cases \
  -H "Authorization: Bearer $TOKEN"

# 6. 提交合并
git add .
git commit -m "feat(assembly): 合并BOM学习系统 - 历史案例学习功能"
```

#### 选项B: 标记为未实现

```bash
# 1. 更新项目文档
echo "## 功能路线图

### 计划中功能
- [ ] BOM历史案例学习系统
  - 历史BOM上传和解析
  - 配套模式统计分析
  - 学习规则自动生成
  - 实现分支: claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY
  - 预计版本: v2.1.0
" >> README.md

git add README.md
git commit -m "docs: 标记BOM学习系统为计划中功能"
```

---

## 中期操作（本月内）

### 3. 运行完整验证

```bash
# 1. 检查数据库迁移状态
npm run migrate:status

# 2. 运行migration（如果需要）
npm run migrate

# 3. 验证表结构
psql $DATABASE_URL -c "\d+ assembly_inference_tasks"
psql $DATABASE_URL -c "\d+ pid_recognition_results"

# 4. 检查外键完整性
psql $DATABASE_URL << 'SQL'
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('pid_recognition_results', 'assembly_constraints');
SQL

# 5. 测试前端构建
cd apps/web
npm run build

# 6. 启动服务测试
npm run dev
```

### 4. 性能与安全审计

```bash
# 1. 检查缺失的索引
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN ('assembly_inference_tasks', 'pid_recognition_results')
ORDER BY tablename, attname;
"

# 2. 检查表大小
psql $DATABASE_URL -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%assembly%' OR tablename LIKE '%pid%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 3. 运行API安全扫描（如果有）
npm run security:audit
```

---

## 长期操作（季度）

### 5. 建立契约测试自动化

```bash
# 创建契约测试脚本
mkdir -p tests/contract
cat > tests/contract/api-contract.test.js << 'TEST'
const axios = require('axios')
const { expect } = require('chai')

describe('API Contract Tests', () => {
  it('POST /api/assembly/infer should match schema', async () => {
    const response = await axios.post('/api/assembly/infer', {
      // test data
    })
    expect(response.data).to.have.property('success')
    expect(response.data).to.have.property('task_id')
  })
  
  // 更多测试...
})
TEST

# 添加到CI/CD
echo "
test:contract:
  script:
    - npm run test:contract
" >> .gitlab-ci.yml
```

### 6. 文档维护

- [ ] 更新API文档（OpenAPI/Swagger）
- [ ] 更新数据库ER图
- [ ] 更新前后端契约文档
- [ ] 建立季度审计机制

---

## 检查清单

### 立即（今天）
- [ ] 提交P0修复代码
- [ ] 推送到远程仓库
- [ ] 通知团队成员

### 短期（本周）
- [ ] 决策BOM学习分支合并
- [ ] 运行验证测试
- [ ] 更新项目看板

### 中期（本月）
- [ ] 完整数据库验证
- [ ] 前端集成测试
- [ ] 性能基准测试

### 长期（季度）
- [ ] 建立契约测试自动化
- [ ] 完善文档体系
- [ ] 建立定期审计机制

---

## 联系与支持

如遇到问题，请参考：
- **详细审计报告**: CONTRACT_AUDIT_REPORT_2025-11-11.md
- **修复总结**: FIX_SUMMARY_2025-11-11.md
- **验证脚本**: scripts/verify_contract_fixes.sh

**创建日期**: 2025-11-11  
**下次审计**: BOM分支合并后1周内
