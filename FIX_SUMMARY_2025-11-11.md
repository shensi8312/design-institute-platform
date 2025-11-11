# 契约一致性审计修复总结

## 已修复问题

### ✅ P0-3: pid_recognition_results外键引用错误

**文件**: `apps/api/src/database/migrations/20251105084524_create_pid_recognition_results.js:6`

**变更**:
```diff
- table.uuid('document_id').references('id').inTable('documents').onDelete('CASCADE');
+ table.uuid('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE'); // [PE-fix-table-name]
```

**验证**: Migration现在可以正确执行，外键引用knowledge_documents表

---

### ✅ P0-2: assembly_inference_tasks重复定义

**文件**: `apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js`

**操作**: 重命名为 `.js.backup`，创建 `.REMOVED.md` 说明文档

**原因**: 该表已由 `20251029132214_create_assembly_tables.js` 创建（UUID主键版本）

**影响**: 消除migration执行冲突，使用统一的UUID主键

---

## 待修复问题（需进一步决策）

### ⚠️ P0-4: 前端调用的3D路由不一致

**问题分析**:

**前端调用**:
```typescript
// apps/web/src/pages/AssemblyDesignManagement.tsx:283
axios.post(`/api/assembly/designs/${designId}/generate-3d`)

// apps/web/src/pages/AssemblyDesignManagement.tsx:491
action={`${axios.defaults.baseURL}/api/assembly/designs/${record.id}/upload-3d`}
```

**后端实际路由**:
```javascript
// apps/api/src/routes/assembly.js:118
POST /api/assembly/designs/:designId/3d-model  // 上传（已存在）
GET  /api/assembly/designs/:id/3d-model        // 获取（已存在）
```

**推荐方案（最小修改）**: 修改前端调用路径

**文件**: `apps/web/src/pages/AssemblyDesignManagement.tsx`

**变更1** (Line 283):
```diff
- const response = await axios.post(`/api/assembly/designs/${designId}/generate-3d`)
+ const response = await axios.post(`/api/assembly/designs/${designId}/3d-model`)
```

**变更2** (Line 491):
```diff
- action={`${axios.defaults.baseURL}/api/assembly/designs/${record.id}/upload-3d`}
+ action={`${axios.defaults.baseURL}/api/assembly/designs/${record.id}/3d-model`}
```

**验证**: 前端上传功能将调用正确的后端路由

---

### ⚠️ P0-1: BOM学习系统未合并（需决策）

**状态**: 功能完整实现在分支 `claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY`

**选项**:

#### 选项A: 立即合并分支（推荐）

```bash
git checkout main
git merge claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY
# 解决冲突（主要是design_rules字段重复）
npm run migrate
```

**优点**: 功能完整可用  
**缺点**: 需解决design_rules扩展字段冲突（P1-1）

#### 选项B: 标记为Roadmap

在项目文档中明确说明BOM学习功能为未来版本规划。

**文档位置**: 
- README.md - 功能清单标记为"计划中"
- docs/ROADMAP.md - 添加"BOM历史案例学习系统"

---

## 待处理的P1问题

### P1-1: design_rules扩展字段冲突

**问题**: 两个migration对同一表添加相同字段（rule_type）

**文件**:
- `20251106120000_extend_design_rules_for_unified_system.js` (已合并)
- `20251111000000_create_knowledge_base_learning_tables.js` (分支)

**解决方案**: 如果合并分支，需修改分支migration移除重复字段检查

**变更文件**: `20251111000000_create_knowledge_base_learning_tables.js`

```diff
- const hasRuleType = await knex.schema.hasColumn('design_rules', 'rule_type')
  const hasConditionData = await knex.schema.hasColumn('design_rules', 'condition_data')
  
  if (!hasConditionData) {
    await knex.schema.alterTable('design_rules', (table) => {
-     if (!hasRuleType) {
-       table.string('rule_type', 50)  // 删除，已存在
-       table.index('rule_type')
-     }
      // 只添加新字段
      table.jsonb('condition_data')
      table.jsonb('action_data')
```

---

## 验证清单

- [x] pid_recognition_results migration语法正确
- [x] assembly_inference_tasks重复定义已消除
- [ ] 前端3D路由调用修改（等待确认）
- [ ] BOM学习分支合并决策（等待确认）
- [ ] design_rules字段冲突解决（如果合并分支）

---

## 下一步行动

1. **立即**: 提交P0-2和P0-3修复
2. **短期**: 修改前端3D路由调用（P0-4）
3. **中期**: 决策是否合并BOM学习分支（P0-1）
4. **中期**: 如合并，解决design_rules冲突（P1-1）

---

**修复日期**: 2025-11-11  
**修复人**: Claude Code Audit  
**参考**: CONTRACT_AUDIT_REPORT_2025-11-11.md
