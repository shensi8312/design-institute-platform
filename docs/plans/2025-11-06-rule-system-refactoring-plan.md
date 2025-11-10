# 统一规则系统重构方案（复用现有代码优先）

**日期**: 2025-11-06
**原则**: 最大化复用现有代码，避免重复造轮子

---

## 一、现状盘点

### ✅ 已有前端页面（可复用）

| 页面文件 | 功能 | 状态 | 复用度 |
|---------|------|------|--------|
| **AssemblyRuleManagement.tsx** | 装配规则管理 | ✅ 完整 | 90% |
| - 规则列表 | 显示所有规则 | ✅ | 复用 |
| - 学习功能 | `/api/assembly/learn-rules` | ✅ | 复用 |
| - 导入规则 | 从学习结果导入 | ✅ | 复用 |
| **RuleManagement.tsx** | 通用规则管理（建筑规范） | ✅ 完整 | 80% |
| - 分类筛选 | rule_categories | ✅ | 复用 |
| - 搜索过滤 | 按状态/优先级 | ✅ | 复用 |
| **RuleReview.tsx** | 规则审核 | ✅ 完整 | 95% |
| - 待审核列表 | review_status='pending' | ✅ | 直接复用 |
| - 批准/拒绝 | PUT /api/rules/:id/review | ✅ | 直接复用 |
| **AssemblyConstraintEngine.tsx** | 装配约束引擎 | ✅ 完整 | 保留 |
| - BOM上传 | ✅ | 保留 |
| - 约束推理 | ✅ | 保留 |

### ✅ 已有后端API（可复用）

| API端点 | 功能 | 控制器 | 复用度 |
|---------|------|--------|--------|
| `GET /api/assembly/rules` | 获取装配规则 | AssemblyController | 扩展 |
| `POST /api/assembly/learn-rules` | 学习规则 | AssemblyController | ✅ 复用 |
| `GET /api/assembly/learned-rules` | 获取学习的规则 | AssemblyController | ✅ 复用 |
| `POST /api/assembly/feedback` | 反馈学习 | AssemblyController | ✅ 复用 |
| `GET /api/rules/pending` | 获取待审核规则 | RulesController | ✅ 复用 |
| `PUT /api/rules/:id/review` | 审核规则 | RulesController | ✅ 复用 |

### ✅ 已有数据库表（扩展使用）

| 表名 | 用途 | 状态 | 改造方案 |
|------|------|------|---------|
| **design_rules** | 设计规范（建筑） | ✅ 结构完整 | **扩展为通用rule_base** |
| **assembly_rules** | 装配规则 | ✅ 独立表 | 保留，JOIN使用 |
| **ai_rules** | AI规则 | ✅ | 保留，JOIN使用 |
| **rule_applications** | 规则应用记录 | ✅ 基础字段 | **扩展反馈学习字段** |
| **rule_categories** | 规则分类 | ✅ | **扩展业务类型** |

---

## 二、重构策略

### 策略1: 扩展现有表，避免新建

#### 2.1 扩展 `design_rules` 为通用 `rule_base`

**方案**: 添加 `rule_type` 字段，兼容多种规则类型

```sql
-- 迁移脚本
ALTER TABLE design_rules ADD COLUMN rule_type VARCHAR(50) DEFAULT 'building';
ALTER TABLE design_rules ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE design_rules ADD COLUMN success_count INTEGER DEFAULT 0;
ALTER TABLE design_rules ADD COLUMN last_applied_at TIMESTAMP;

-- 创建索引
CREATE INDEX idx_design_rules_rule_type ON design_rules(rule_type);
CREATE INDEX idx_design_rules_confidence ON design_rules(confidence_score DESC);

-- 添加评论
COMMENT ON TABLE design_rules IS '统一规则基表（支持装配/PID/建筑/工艺）';
COMMENT ON COLUMN design_rules.rule_type IS '规则类型: building/assembly/pid/process';
```

**字段映射**:
```
设计文档中的 rule_base → 现有的 design_rules
├─ 保留字段: category_id, rule_code, rule_name, rule_content, confidence_score
├─ 保留字段: review_status, reviewed_by, reviewed_at, parameters
├─ 新增字段: rule_type, usage_count, success_count, last_applied_at
└─ 业务表: assembly_rules, ai_rules (保留，通过rule_code关联)
```

#### 2.2 扩展 `rule_applications` 添加反馈学习

```sql
ALTER TABLE rule_applications ADD COLUMN applied_method VARCHAR(50);
ALTER TABLE rule_applications ADD COLUMN result_status VARCHAR(20);
ALTER TABLE rule_applications ADD COLUMN user_feedback VARCHAR(20);
ALTER TABLE rule_applications ADD COLUMN user_correction JSONB;
ALTER TABLE rule_applications ADD COLUMN feedback_comment TEXT;
ALTER TABLE rule_applications ADD COLUMN original_confidence DECIMAL(3,2);
ALTER TABLE rule_applications ADD COLUMN adjusted_confidence DECIMAL(3,2);
ALTER TABLE rule_applications ADD COLUMN context JSONB;
ALTER TABLE rule_applications ADD COLUMN applied_by VARCHAR(50);
ALTER TABLE rule_applications ADD COLUMN applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 创建索引
CREATE INDEX idx_rule_applications_result_status ON rule_applications(result_status);
CREATE INDEX idx_rule_applications_applied_at ON rule_applications(applied_at DESC);
```

#### 2.3 扩展 `rule_categories` 添加业务类型

```sql
-- 添加新的规则分类
INSERT INTO rule_categories (id, name, code, level, sort_order, description) VALUES
('assembly_rules', '装配规则', 'ASM', 'business', 10, '从STEP学习的装配约束规则'),
('pid_rules', 'PID规则', 'PID', 'business', 11, '从P&ID图纸学习的工艺规则'),
('process_rules', '工艺规则', 'PROC', 'business', 12, '制造工艺相关规则');
```

### 策略2: 复用现有前端组件

#### 2.1 重构 AssemblyRuleManagement.tsx → UnifiedRuleManagement.tsx

**改造方案**: 参数化规则类型

```typescript
// apps/web/src/pages/UnifiedRuleManagement.tsx
interface Props {
  ruleType: 'assembly' | 'pid' | 'building' | 'process'
  apiPrefix: string  // '/api/assembly' or '/api/rules'
}

const UnifiedRuleManagement: React.FC<Props> = ({ ruleType, apiPrefix }) => {
  // 复用现有的 AssemblyRuleManagement 代码
  // 只需要替换 API 端点和显示字段
}

// 使用示例
<UnifiedRuleManagement ruleType="assembly" apiPrefix="/api/assembly" />
<UnifiedRuleManagement ruleType="building" apiPrefix="/api/rules" />
```

#### 2.2 复用 RuleReview.tsx（无需改动）

RuleReview.tsx 已经是通用的，直接复用：
- ✅ 使用 `/api/rules/pending` - 统一获取待审核规则
- ✅ 使用 `/api/rules/:id/review` - 统一审核接口

### 策略3: 后端API适配器模式

#### 3.1 创建统一规则服务（适配器）

```javascript
// apps/api/src/services/rules/UnifiedRuleService.js
class UnifiedRuleService {
  constructor() {
    this.processors = {
      'assembly': new AssemblyRuleProcessor(),
      'pid': new PIDRuleProcessor(),
      'building': new BuildingRuleProcessor()
    }
  }

  async getRules(ruleType, filters) {
    // 统一查询 design_rules 表
    let query = knex('design_rules')
      .where('rule_type', ruleType)
      .where('is_active', true)

    // 根据类型JOIN业务表
    if (ruleType === 'assembly') {
      query = query.leftJoin('assembly_rules', 'design_rules.rule_code', 'assembly_rules.rule_id')
    }

    return query
  }

  async learnRules(ruleType, sourceData) {
    const processor = this.processors[ruleType]
    const learnedRules = await processor.learnFromSource(sourceData)

    // 保存到 design_rules 表
    for (const rule of learnedRules) {
      await knex('design_rules').insert({
        rule_type: ruleType,
        rule_code: rule.code,
        rule_name: rule.name,
        confidence_score: rule.confidence,
        review_status: 'pending',
        ...rule
      })
    }

    return learnedRules
  }
}
```

#### 3.2 复用现有Controller，添加通用方法

```javascript
// apps/api/src/controllers/AssemblyController.js（扩展）

// 保留现有方法
exports.getRules = async (req, res) => { /* 现有代码 */ }
exports.learnRules = async (req, res) => { /* 现有代码 */ }

// 添加通用方法
exports.getAllRulesByType = async (req, res) => {
  const { ruleType } = req.params
  const unifiedService = new UnifiedRuleService()
  const rules = await unifiedService.getRules(ruleType, req.query)
  res.json({ success: true, data: rules })
}
```

---

## 三、渐进式实施计划

### Phase 1: 数据库扩展（不破坏现有功能）

**目标**: 扩展现有表，兼容旧数据

- [ ] 迁移脚本1: 扩展 `design_rules` 表
- [ ] 迁移脚本2: 扩展 `rule_applications` 表
- [ ] 迁移脚本3: 扩展 `rule_categories` 表
- [ ] 数据迁移: 将现有 `assembly_rules` 数据同步到 `design_rules`

**验证**: 现有规则审核页面正常工作

### Phase 2: 后端服务适配（保留旧API）

**目标**: 创建统一服务，旧API调用新服务

- [ ] 创建 `UnifiedRuleService.js`
- [ ] 创建 `RuleMatchingEngine.js`
- [ ] 创建 `FeedbackLearningService.js`
- [ ] 重构 `AssemblyController` 使用新服务
- [ ] 添加新的统一API `/api/rules/unified/:ruleType`

**验证**: 旧API和新API都能正常工作

### Phase 3: 前端组件统一（保留旧页面）

**目标**: 创建通用组件，逐步替换旧页面

- [ ] 创建 `UnifiedRuleManagement.tsx`（基于 AssemblyRuleManagement）
- [ ] 创建 `RuleLearningConfig.tsx`（新增配置页）
- [ ] 路由配置：旧路由指向旧页面，新路由指向新组件

**验证**: 两套页面共存，逐步迁移

### Phase 4: 功能增强（基于统一架构）

**目标**: 添加设计文档中的新功能

- [ ] 规则学习配置（触发方式、阈值）
- [ ] 反馈学习闭环
- [ ] 规则匹配引擎
- [ ] 置信度调整

### Phase 5: 清理旧代码（最后）

**目标**: 确认新系统稳定后，清理旧代码

- [ ] 删除旧的独立页面
- [ ] 统一API端点
- [ ] 清理冗余数据库表

---

## 四、复用 vs 新建对比

### 📊 复用率统计

| 模块 | 复用代码 | 新建代码 | 复用率 |
|------|---------|---------|--------|
| 前端页面 | 3个页面 | 1个配置页 | 75% |
| 后端API | 8个端点 | 2个统一端点 | 80% |
| 数据库表 | 5个表扩展 | 1个配置表 | 83% |
| 服务层 | 2个Service | 3个新Service | 40% |
| **总体** | - | - | **70%** |

### ✅ 复用带来的好处

1. **减少开发时间**: 70%代码复用 → 节省2-3周开发
2. **保持稳定性**: 现有规则审核功能不受影响
3. **降低风险**: 渐进式迁移，出问题可回滚
4. **减少测试**: 旧功能无需重测
5. **用户无感知**: 界面保持一致

---

## 五、关键决策对比

| 决策点 | 原设计方案 | 重构方案 | 理由 |
|--------|-----------|---------|------|
| 基表设计 | 新建 rule_base | 扩展 design_rules | 避免数据迁移 |
| 业务表 | assembly_rules 新建 | 保留现有 assembly_rules | 装配规则已完整 |
| 前端页面 | 全新开发 | 复用 AssemblyRuleManagement | 70%逻辑相同 |
| API端点 | 全新 /api/rules/* | 扩展现有 /api/assembly/* | 兼容旧客户端 |
| 审核流程 | 新建审核页 | 复用 RuleReview.tsx | 已满足需求 |

---

## 六、风险控制

### 风险1: 数据库扩展失败
**对策**:
- 使用事务执行迁移
- 先在测试库验证
- 保留回滚脚本

### 风险2: API不兼容
**对策**:
- 保留旧API端点
- 新旧API并存
- 逐步迁移客户端

### 风险3: 前端组件冲突
**对策**:
- 旧页面保留在独立路由
- 新组件使用新路由
- 用户可选择使用

---

## 七、实施时间线

| 阶段 | 任务 | 工作量 | 时间 |
|------|------|--------|------|
| Phase 1 | 数据库扩展 | 1天 | Week 1 |
| Phase 2 | 后端服务适配 | 3天 | Week 1-2 |
| Phase 3 | 前端组件统一 | 4天 | Week 2-3 |
| Phase 4 | 功能增强 | 5天 | Week 3-4 |
| Phase 5 | 测试与清理 | 2天 | Week 4 |
| **总计** | - | **15天** | **4周** |

对比原设计的 **7周**，节省 **3周**（43%）

---

## 八、下一步行动

### 立即执行（今天）
1. ✅ 创建数据库迁移脚本
2. ✅ 验证迁移脚本（测试环境）
3. 创建 UnifiedRuleService.js

### 明天执行
4. 重构 AssemblyController
5. 创建 UnifiedRuleManagement.tsx
6. 端到端测试

---

**结论**: 通过最大化复用现有代码，我们可以用 **4周** 完成原本需要 **7周** 的工作，同时保持系统稳定性。
