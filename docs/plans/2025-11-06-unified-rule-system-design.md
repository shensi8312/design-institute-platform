# 统一规则系统设计方案

**设计日期**: 2025-11-06
**设计目标**: 构建可扩展的统一规则学习、管理和应用系统

---

## 1. 设计目标

### 1.1 业务目标
- **装配规则**: 从STEP文件学习零件装配约束，用于3D自动装配
- **PID规则**: 从P&ID图纸学习管道仪表连接规则，用于工艺设计
- **建筑规范**: 从GB/JGJ等文档提取设计规范，用于合规检查
- **工艺规则**: 制造、材料、成本等业务规则（二期）

### 1.2 技术目标
- 统一的规则学习流程（可插拔业务逻辑）
- 统一的审核管理界面
- 统一的应用反馈机制
- Human-in-the-Loop学习闭环

---

## 2. 核心架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端统一界面                           │
│  [规则学习配置] [规则审核中心] [规则库管理] [应用监控]     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   统一规则引擎层                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 学习调度器    │  │  审核工作流   │  │  应用引擎    │  │
│  │ (可配置触发)  │  │ (一期:简单)  │  │ (置信度+人工)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 业务规则处理器（可插拔）                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │装配规则处理器│ │PID规则处理器│ │建筑规则处理器│         │
│  │- STEP分析  │ │- OCR提取   │ │- LLM提取   │          │
│  │- 约束推理  │ │- 符号识别  │ │- 条文解析  │          │
│  └────────────┘ └────────────┘ └────────────┘          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    数据持久层                            │
│  rule_base (通用字段)                                    │
│  ├─ assembly_rules (装配约束)                            │
│  ├─ pid_rules (管道仪表)                                 │
│  └─ building_rules (建筑规范)                            │
│  rule_applications (应用记录 - 反馈学习)                 │
│  rule_learning_config (学习配置)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 基表：rule_base

```sql
CREATE TABLE rule_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type VARCHAR(50) NOT NULL,  -- 'assembly' | 'pid' | 'building' | 'process'
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- 来源追溯
  source_type VARCHAR(50),  -- 'step_file' | 'drawing' | 'document' | 'manual'
  source_file_id UUID REFERENCES knowledge_documents(id),
  source_metadata JSONB,  -- 原始文件信息

  -- 学习与审核
  extraction_method VARCHAR(50),  -- 'ai_learning' | 'llm_extraction' | 'manual'
  confidence_score DECIMAL(3,2),  -- 0.00-1.00
  review_status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_comment TEXT,

  -- 应用统计（用于反馈学习）
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_applied_at TIMESTAMP,

  -- 通用字段
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_rule_type (rule_type),
  INDEX idx_review_status (review_status),
  INDEX idx_confidence (confidence_score DESC)
);
```

### 3.2 业务表：assembly_rules

```sql
CREATE TABLE assembly_rules (
  rule_id UUID PRIMARY KEY REFERENCES rule_base(id) ON DELETE CASCADE,

  -- 装配约束类型
  constraint_type VARCHAR(50) NOT NULL,  -- 'mate' | 'align' | 'offset' | 'angle' | 'pattern'

  -- 约束实体
  entities JSONB NOT NULL,  -- [{"part": "A", "face": "top"}, {"part": "B", "face": "bottom"}]

  -- 约束参数
  parameters JSONB,  -- {"offset": 10, "angle": 90, "unit": "mm"}

  -- 推理路径
  reasoning_path TEXT,  -- AI推理过程说明

  -- 几何特征
  geometric_features JSONB,  -- 从STEP提取的几何特征

  -- 优先级
  priority INTEGER DEFAULT 5,  -- 1-10, 数字越大优先级越高

  -- 冲突检测
  conflicts_with UUID[],  -- 与哪些规则冲突

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 业务表：pid_rules

```sql
CREATE TABLE pid_rules (
  rule_id UUID PRIMARY KEY REFERENCES rule_base(id) ON DELETE CASCADE,

  -- PID规则类型
  rule_category VARCHAR(50),  -- 'symbol' | 'connection' | 'specification' | 'layout'

  -- 符号识别
  symbol_type VARCHAR(100),  -- 'valve' | 'pump' | 'instrument' | ...
  symbol_variants JSONB,  -- 不同表示方式

  -- 连接规则
  connection_rules JSONB,  -- {"inlet": "pipe", "outlet": "pipe", "control": "signal"}

  -- 规格参数
  specifications JSONB,  -- {"pressure": "PN16", "material": "SS304", ...}

  -- 布局约束
  layout_constraints JSONB,  -- 间距、方向等

  -- 标准引用
  standard_reference VARCHAR(200),  -- 如 "GB/T 12459-2017"

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.4 业务表：building_rules

```sql
CREATE TABLE building_rules (
  rule_id UUID PRIMARY KEY REFERENCES rule_base(id) ON DELETE CASCADE,

  -- 规范编码
  standard_code VARCHAR(100) NOT NULL,  -- "GB50809-2023-4.2.1"
  standard_name VARCHAR(200),  -- "数据中心设计规范"

  -- 规则内容
  article_number VARCHAR(50),  -- "4.2.1"
  article_title VARCHAR(200),
  rule_text TEXT NOT NULL,  -- 规范原文

  -- 结构化参数
  rule_parameters JSONB,  -- {"minHeight": 2.8, "unit": "m", "condition": "主机房"}

  -- 适用范围
  applicable_scope VARCHAR(200),
  building_type VARCHAR(100),  -- "data_center" | "residential" | ...

  -- 强制等级
  compliance_level VARCHAR(20),  -- 'mandatory' | 'recommended' | 'optional'

  -- 检查方法
  check_method VARCHAR(50),  -- 'dimension' | 'material' | 'calculation' | ...
  check_logic JSONB,  -- 检查逻辑的机器可读格式

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.5 应用记录表（反馈学习核心）

```sql
CREATE TABLE rule_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES rule_base(id) ON DELETE CASCADE,

  -- 应用场景
  application_type VARCHAR(50),  -- 'assembly_generation' | 'pid_design' | 'compliance_check'
  project_id UUID,
  design_id UUID,

  -- 应用上下文
  context JSONB,  -- 当时的输入数据（如零件信息、图纸特征等）

  -- 应用方式
  applied_method VARCHAR(50),  -- 'auto' | 'suggested' | 'manual_selected'

  -- 结果评估
  result_status VARCHAR(20),  -- 'success' | 'failed' | 'corrected' | 'rejected'

  -- 人工反馈
  user_feedback VARCHAR(20),  -- 'correct' | 'incorrect' | 'partially_correct'
  user_correction JSONB,  -- 用户修正后的正确答案
  feedback_comment TEXT,

  -- 置信度调整
  original_confidence DECIMAL(3,2),
  adjusted_confidence DECIMAL(3,2),  -- 根据反馈调整后的置信度

  applied_by UUID REFERENCES users(id),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_rule_id (rule_id),
  INDEX idx_result_status (result_status),
  INDEX idx_applied_at (applied_at DESC)
);
```

### 3.6 学习配置表

```sql
CREATE TABLE rule_learning_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type VARCHAR(50) NOT NULL,  -- 'assembly' | 'pid' | 'building'

  -- 学习触发方式
  trigger_mode VARCHAR(50),  -- 'auto' | 'manual' | 'batch' | 'scheduled'

  -- 自动学习配置
  auto_learn_enabled BOOLEAN DEFAULT FALSE,
  auto_approve_threshold DECIMAL(3,2),  -- 自动批准的置信度阈值

  -- 批量处理配置
  batch_size INTEGER,
  batch_interval_hours INTEGER,

  -- 质量控制
  min_confidence_threshold DECIMAL(3,2) DEFAULT 0.5,  -- 最低置信度要求
  require_human_review BOOLEAN DEFAULT TRUE,

  -- 反馈学习配置
  enable_feedback_learning BOOLEAN DEFAULT TRUE,
  feedback_weight DECIMAL(3,2) DEFAULT 0.3,  -- 反馈对置信度的影响权重

  -- 冲突处理
  conflict_resolution_strategy VARCHAR(50),  -- 'highest_confidence' | 'manual_select' | 'weighted'

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(rule_type)
);
```

---

## 4. 业务流程设计

### 4.1 装配规则学习流程

```
┌──────────────────────────────────────────────────────────────┐
│ 阶段1: 样本上传与预处理                                        │
└──────────────────────────────────────────────────────────────┘
用户上传STEP文件
    ↓
检查学习配置(rule_learning_config)
    ↓
触发方式判断:
├─ auto: 立即学习
├─ manual: 显示"开始学习"按钮
└─ batch: 加入批处理队列

┌──────────────────────────────────────────────────────────────┐
│ 阶段2: AI学习与规则提取                                        │
└──────────────────────────────────────────────────────────────┘
调用装配规则处理器
    ↓
STEP文件解析 (几何特征提取)
    ↓
约束推理 (基于几何关系)
    ↓
生成候选规则 (带置信度)
    ↓
插入 rule_base + assembly_rules
status = 'pending'

┌──────────────────────────────────────────────────────────────┐
│ 阶段3: 人工审核（一期：简单审核）                               │
└──────────────────────────────────────────────────────────────┘
通知管理员: "有N条待审核规则"
    ↓
审核界面显示:
├─ 规则详情 (constraint_type, entities, parameters)
├─ 置信度得分
├─ 推理路径说明
└─ 原始STEP文件预览
    ↓
管理员操作:
├─ [批准] → review_status = 'approved', is_active = true
├─ [拒绝] → review_status = 'rejected', is_active = false
└─ [修改后批准] → 更新参数 → approved

┌──────────────────────────────────────────────────────────────┐
│ 阶段4: 规则应用与反馈                                          │
└──────────────────────────────────────────────────────────────┘
3D装配生成时
    ↓
查询匹配规则:
SELECT * FROM rule_base rb
JOIN assembly_rules ar ON rb.id = ar.rule_id
WHERE rb.is_active = true
  AND rb.review_status = 'approved'
  AND ar.entities 匹配当前零件
ORDER BY rb.confidence_score DESC, ar.priority DESC
    ↓
置信度判断:
├─ confidence >= 0.8 → 自动应用
└─ confidence < 0.8 → 弹出选项让用户选择
    ↓
应用后记录:
INSERT INTO rule_applications (
  rule_id, context, applied_method, result_status
)
    ↓
用户反馈:
├─ [正确] → success_count++, confidence微调+
├─ [错误] → 让用户选正确答案 → 记录user_correction
└─ [修正] → 更新规则参数, 重新训练

┌──────────────────────────────────────────────────────────────┐
│ 阶段5: 反馈学习闭环                                            │
└──────────────────────────────────────────────────────────────┘
定时任务 (每日/每周):
    ↓
分析 rule_applications 数据
    ↓
计算成功率: success_count / usage_count
    ↓
调整置信度:
new_confidence = original_confidence * 0.7 + success_rate * 0.3
    ↓
更新 rule_base.confidence_score
    ↓
低成功率规则 → 标记复审 / 自动禁用
```

### 4.2 PID规则学习流程

```
┌──────────────────────────────────────────────────────────────┐
│ 阶段1: 图纸识别                                               │
└──────────────────────────────────────────────────────────────┘
用户上传P&ID图纸
    ↓
OCR识别 + 符号检测 (已有服务)
    ↓
生成识别结果 (pid_recognition_results表)

┌──────────────────────────────────────────────────────────────┐
│ 阶段2: 规则提取（可配置触发）                                   │
└──────────────────────────────────────────────────────────────┘
检查 rule_learning_config.trigger_mode:
├─ auto: OCR完成后自动触发
└─ manual: 显示"提取规则"按钮
    ↓
调用PID规则处理器
    ↓
分析识别结果:
├─ 符号类型统计
├─ 连接关系分析
├─ 规格参数提取
└─ 布局模式学习
    ↓
生成候选规则 → rule_base + pid_rules

┌──────────────────────────────────────────────────────────────┐
│ 阶段3-5: 同装配规则流程                                        │
└──────────────────────────────────────────────────────────────┘
审核 → 应用 → 反馈 → 学习
```

### 4.3 建筑规范学习流程

```
┌──────────────────────────────────────────────────────────────┐
│ 方案A: 实时提取                                               │
└──────────────────────────────────────────────────────────────┘
上传PDF/Word → LLM提取 → 生成候选规则 → 审核

┌──────────────────────────────────────────────────────────────┐
│ 方案B: 定时批处理（推荐）                                      │
└──────────────────────────────────────────────────────────────┘
上传PDF/Word
    ↓
先入知识库 (knowledge_documents表)
    ↓
定时任务扫描:
SELECT * FROM knowledge_documents
WHERE category = 'standard'
  AND processed_for_rules = false
    ↓
批量调用LLM提取规则
    ↓
解析GB编号、条文、参数
    ↓
生成 rule_base + building_rules
    ↓
标记 processed_for_rules = true
```

---

## 5. 关键技术实现

### 5.1 规则匹配引擎

```javascript
// apps/api/src/services/rules/RuleMatchingEngine.js

class RuleMatchingEngine {
  /**
   * 匹配适用规则（通用接口）
   */
  async matchRules({ ruleType, context, options = {} }) {
    const {
      minConfidence = 0.5,
      maxResults = 10,
      includeInactive = false
    } = options;

    // 查询基础规则
    const query = knex('rule_base')
      .where('rule_type', ruleType)
      .where('review_status', 'approved');

    if (!includeInactive) {
      query.where('is_active', true);
    }

    if (minConfidence) {
      query.where('confidence_score', '>=', minConfidence);
    }

    // JOIN业务表
    const businessTable = this.getBusinessTable(ruleType);
    query.join(businessTable, 'rule_base.id', `${businessTable}.rule_id`);

    // 业务逻辑过滤（可插拔）
    const processor = this.getProcessor(ruleType);
    const filtered = await processor.filterByContext(query, context);

    // 排序: 置信度 × 成功率 × 优先级
    const scored = filtered.map(rule => ({
      ...rule,
      matchScore: this.calculateMatchScore(rule, context)
    }));

    scored.sort((a, b) => b.matchScore - a.matchScore);

    return scored.slice(0, maxResults);
  }

  /**
   * 计算匹配分数
   */
  calculateMatchScore(rule, context) {
    const successRate = rule.usage_count > 0
      ? rule.success_count / rule.usage_count
      : 0.5; // 新规则默认0.5

    // 加权计算
    return (
      rule.confidence_score * 0.4 +  // 初始置信度
      successRate * 0.4 +             // 历史成功率
      (rule.priority || 5) / 10 * 0.2 // 优先级
    );
  }

  /**
   * 获取业务处理器（可插拔）
   */
  getProcessor(ruleType) {
    const processors = {
      'assembly': new AssemblyRuleProcessor(),
      'pid': new PIDRuleProcessor(),
      'building': new BuildingRuleProcessor()
    };
    return processors[ruleType];
  }
}
```

### 5.2 反馈学习服务

```javascript
// apps/api/src/services/rules/FeedbackLearningService.js

class FeedbackLearningService {
  /**
   * 记录规则应用
   */
  async recordApplication({
    ruleId,
    applicationType,
    context,
    appliedMethod,
    resultStatus,
    userFeedback,
    userCorrection
  }) {
    // 插入应用记录
    const [application] = await knex('rule_applications')
      .insert({
        rule_id: ruleId,
        application_type: applicationType,
        context: JSON.stringify(context),
        applied_method: appliedMethod,
        result_status: resultStatus,
        user_feedback: userFeedback,
        user_correction: userCorrection ? JSON.stringify(userCorrection) : null,
        applied_by: req.user.userId,
        applied_at: knex.fn.now()
      })
      .returning('*');

    // 更新规则统计
    await knex('rule_base')
      .where('id', ruleId)
      .increment('usage_count', 1)
      .update({
        last_applied_at: knex.fn.now()
      });

    if (resultStatus === 'success' || userFeedback === 'correct') {
      await knex('rule_base')
        .where('id', ruleId)
        .increment('success_count', 1);
    }

    // 即时调整置信度（如果配置启用）
    const config = await this.getLearningConfig(ruleType);
    if (config.enable_feedback_learning) {
      await this.adjustConfidence(ruleId, userFeedback, config.feedback_weight);
    }

    return application;
  }

  /**
   * 调整规则置信度
   */
  async adjustConfidence(ruleId, feedback, weight = 0.3) {
    const rule = await knex('rule_base').where('id', ruleId).first();

    const feedbackScore = {
      'correct': 1.0,
      'partially_correct': 0.7,
      'incorrect': 0.3
    }[feedback] || 0.5;

    const newConfidence =
      rule.confidence_score * (1 - weight) +
      feedbackScore * weight;

    await knex('rule_base')
      .where('id', ruleId)
      .update({
        confidence_score: Math.max(0, Math.min(1, newConfidence)),
        updated_at: knex.fn.now()
      });
  }

  /**
   * 定期批量学习（定时任务）
   */
  async batchLearning(ruleType) {
    // 获取最近30天的应用记录
    const recentApplications = await knex('rule_applications')
      .join('rule_base', 'rule_applications.rule_id', 'rule_base.id')
      .where('rule_base.rule_type', ruleType)
      .where('rule_applications.applied_at', '>', knex.raw("NOW() - INTERVAL '30 days'"))
      .select('rule_id', 'result_status', 'user_feedback');

    // 按规则分组统计
    const stats = {};
    recentApplications.forEach(app => {
      if (!stats[app.rule_id]) {
        stats[app.rule_id] = { total: 0, success: 0 };
      }
      stats[app.rule_id].total++;
      if (app.result_status === 'success' || app.user_feedback === 'correct') {
        stats[app.rule_id].success++;
      }
    });

    // 更新置信度
    for (const [ruleId, stat] of Object.entries(stats)) {
      if (stat.total >= 5) {  // 至少5次应用才调整
        const successRate = stat.success / stat.total;
        const rule = await knex('rule_base').where('id', ruleId).first();

        const newConfidence = rule.confidence_score * 0.6 + successRate * 0.4;

        await knex('rule_base')
          .where('id', ruleId)
          .update({ confidence_score: newConfidence });

        // 低成功率预警
        if (successRate < 0.3 && stat.total >= 10) {
          await this.flagForReview(ruleId, '成功率过低，建议复审');
        }
      }
    }
  }
}
```

### 5.3 业务处理器接口（可插拔）

```javascript
// apps/api/src/services/rules/processors/BaseRuleProcessor.js

class BaseRuleProcessor {
  /**
   * 从源文件学习规则（子类实现）
   */
  async learnFromSource(sourceFile, config) {
    throw new Error('Must implement learnFromSource');
  }

  /**
   * 根据上下文过滤规则（子类实现）
   */
  async filterByContext(query, context) {
    throw new Error('Must implement filterByContext');
  }

  /**
   * 应用规则到设计（子类实现）
   */
  async applyRule(rule, design) {
    throw new Error('Must implement applyRule');
  }
}

// apps/api/src/services/rules/processors/AssemblyRuleProcessor.js
class AssemblyRuleProcessor extends BaseRuleProcessor {
  async learnFromSource(stepFile, config) {
    // 1. 解析STEP文件
    const parts = await this.parseSTEP(stepFile);

    // 2. 提取几何特征
    const features = await this.extractGeometricFeatures(parts);

    // 3. 推理约束关系
    const constraints = await this.inferConstraints(features);

    // 4. 生成规则
    const rules = constraints.map(c => ({
      constraint_type: c.type,
      entities: c.entities,
      parameters: c.parameters,
      confidence: c.confidence,
      reasoning_path: c.reasoning
    }));

    return rules;
  }

  async filterByContext(query, context) {
    // context = { partA: {}, partB: {} }
    // 根据零件特征过滤适用规则
    return query.where(knex.raw(
      "entities @> ?",
      [JSON.stringify([{ part: context.partA.name }])]
    ));
  }
}
```

---

## 6. 前端界面设计

### 6.1 统一规则管理页面

```
┌─────────────────────────────────────────────────────────────┐
│  规则管理中心                                    [配置] [帮助] │
├─────────────────────────────────────────────────────────────┤
│  [装配规则] [PID规则] [建筑规范] [工艺规则]                  │
├─────────────────────────────────────────────────────────────┤
│  状态筛选: [○全部] [○待审核] [○已批准] [○已拒绝]             │
│  置信度: [━━●━━━━] 0.5-1.0                                   │
│  来源: [全部 ▼]  搜索: [___________________] [🔍]           │
├─────────────────────────────────────────────────────────────┤
│  规则ID  │ 名称        │ 类型    │ 置信度 │ 状态   │ 操作    │
│  ────────┼────────────┼────────┼───────┼───────┼────────│
│  ASM001  │ 法兰同轴约束 │ 装配    │ 0.92   │ 待审核 │ [审核]  │
│  PID023  │ 阀门连接规则 │ PID     │ 0.87   │ 已批准 │ [详情]  │
│  GB5080  │ 机房高度要求 │ 建筑    │ 0.95   │ 已批准 │ [详情]  │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 规则审核界面

```
┌─────────────────────────────────────────────────────────────┐
│  规则审核 - ASM001                               [关闭] [批准]│
├─────────────────────────────────────────────────────────────┤
│  基本信息                                                     │
│  ├─ 规则类型: 装配规则 - 同轴约束                             │
│  ├─ 来源文件: part_assembly_001.STEP                         │
│  ├─ 提取方式: AI学习                                         │
│  └─ 置信度: 0.92                                             │
├─────────────────────────────────────────────────────────────┤
│  规则详情                                                     │
│  ├─ 约束类型: mate (配合)                                     │
│  ├─ 实体1: 零件A - 圆柱面                                     │
│  ├─ 实体2: 零件B - 圆柱孔                                     │
│  └─ 参数: { tolerance: 0.05mm }                              │
├─────────────────────────────────────────────────────────────┤
│  推理路径                                                     │
│  1. 检测到零件A有外圆柱特征 (直径50mm)                         │
│  2. 检测到零件B有内圆柱特征 (直径50.05mm)                      │
│  3. 直径匹配 + 公差合理 → 推断为配合约束                       │
│  4. 参考样本: 10个类似案例，置信度0.92                        │
├─────────────────────────────────────────────────────────────┤
│  3D预览                                                       │
│  [            零件A与零件B的装配示意图            ]            │
├─────────────────────────────────────────────────────────────┤
│  审核意见                                                     │
│  [________________________________________]                   │
│                                                               │
│  [拒绝]  [修改参数]  [批准并激活]                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 规则学习配置页面

```
┌─────────────────────────────────────────────────────────────┐
│  规则学习配置                                                 │
├─────────────────────────────────────────────────────────────┤
│  装配规则学习                                                 │
│  ├─ 触发方式: [○立即自动 ●手动触发 ○批量处理]                 │
│  ├─ 自动批准阈值: [━━━━●━━] 0.9 (置信度≥0.9自动批准)         │
│  ├─ 批量大小: [10] 个文件                                     │
│  └─ 反馈学习: [✓] 启用  权重: [━●━━━━] 0.3                  │
├─────────────────────────────────────────────────────────────┤
│  PID规则学习                                                  │
│  ├─ 触发方式: [●OCR后自动 ○手动触发]                         │
│  ├─ 最低置信度: [━━●━━━━] 0.5                                │
│  └─ 需要人工审核: [✓]                                        │
├─────────────────────────────────────────────────────────────┤
│  建筑规范学习                                                 │
│  ├─ 提取方式: [○实时提取 ●定时任务]                          │
│  ├─ 定时间隔: [24] 小时                                       │
│  └─ LLM模型: [GPT-4 ▼]                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. API接口设计

### 7.1 规则学习接口

```javascript
// POST /api/rules/learn
{
  "ruleType": "assembly",
  "sourceType": "step_file",
  "sourceFileId": "uuid",
  "config": {
    "triggerMode": "manual",
    "autoApprove": false
  }
}

// Response
{
  "success": true,
  "data": {
    "taskId": "learn_task_123",
    "extractedRules": [
      {
        "id": "rule_uuid",
        "name": "法兰同轴约束",
        "confidence": 0.92,
        "status": "pending_review"
      }
    ]
  }
}
```

### 7.2 规则审核接口

```javascript
// POST /api/rules/:ruleId/review
{
  "action": "approve",  // 'approve' | 'reject' | 'modify'
  "comment": "审核意见",
  "modifications": {
    "parameters": { ... }  // 如果是modify
  }
}
```

### 7.3 规则匹配接口

```javascript
// POST /api/rules/match
{
  "ruleType": "assembly",
  "context": {
    "partA": { "name": "Flange", "features": [...] },
    "partB": { "name": "Pipe", "features": [...] }
  },
  "options": {
    "minConfidence": 0.7,
    "maxResults": 5
  }
}

// Response
{
  "success": true,
  "data": {
    "matches": [
      {
        "rule": { ... },
        "matchScore": 0.89,
        "autoApply": true  // confidence >= 0.8
      }
    ]
  }
}
```

### 7.4 反馈接口

```javascript
// POST /api/rules/feedback
{
  "ruleId": "uuid",
  "applicationType": "assembly_generation",
  "context": { ... },
  "feedback": "correct",  // 'correct' | 'incorrect' | 'partially_correct'
  "correction": { ... }  // 如果是incorrect
}
```

---

## 8. 实施计划

### 8.1 一期（核心功能）

**Week 1-2: 数据层**
- [ ] 创建 rule_base 及三个业务表
- [ ] 创建 rule_applications 表
- [ ] 创建 rule_learning_config 表
- [ ] 数据迁移脚本（整合现有 assembly_rules 等）

**Week 3-4: 后端核心服务**
- [ ] RuleMatchingEngine（规则匹配引擎）
- [ ] FeedbackLearningService（反馈学习服务）
- [ ] BaseRuleProcessor 抽象类
- [ ] AssemblyRuleProcessor（装配规则处理器）

**Week 5-6: API与前端**
- [ ] 规则管理API（CRUD + 审核）
- [ ] 规则学习API
- [ ] 统一规则管理页面
- [ ] 规则审核界面

**Week 7: 集成与测试**
- [ ] 装配生成流程集成规则引擎
- [ ] 端到端测试
- [ ] 性能优化

### 8.2 二期（扩展功能）

**PID规则学习**
- [ ] PIDRuleProcessor 实现
- [ ] OCR结果 → 规则提取流程
- [ ] PID设计工具集成

**建筑规范学习**
- [ ] BuildingRuleProcessor 实现
- [ ] LLM提取流程
- [ ] 合规检查工具

**高级审核**
- [ ] 分级审核工作流
- [ ] 多人协作审核
- [ ] 投票机制

---

## 9. 技术风险与对策

### 9.1 AI学习准确性
**风险**: 规则提取置信度不够高
**对策**:
- 人工审核卡点
- 初期设置高阈值（0.8+）
- 积累反馈数据持续优化

### 9.2 规则冲突
**风险**: 多条规则同时适用且互相冲突
**对策**:
- conflicts_with 字段记录冲突关系
- 匹配时检测冲突，降级为人工选择
- 二期实现规则优先级链

### 9.3 性能问题
**风险**: 规则库增大后查询变慢
**对策**:
- 索引优化（rule_type, confidence, review_status）
- JSONB字段GIN索引
- Redis缓存高频规则
- 定期归档低使用率规则

### 9.4 数据一致性
**风险**: rule_base 与业务表数据不同步
**对策**:
- 外键级联删除
- 事务保证原子性
- 定期一致性检查任务

---

## 10. 成功指标

### 10.1 系统指标
- 规则学习成功率 > 80%
- 规则匹配响应时间 < 500ms
- 审核周期 < 2天

### 10.2 业务指标
- 装配自动化率从30% → 70%
- PID设计效率提升50%
- 合规检查覆盖率100%

### 10.3 质量指标
- 规则应用成功率 > 85%
- 人工干预率 < 30%
- 用户满意度 > 4.0/5.0

---

## 11. 后续演进方向

### 11.1 三期：智能化
- 规则自动发现（无监督学习）
- 规则推荐系统
- 跨领域规则迁移

### 11.2 四期：生态化
- 规则市场（共享/交易）
- 行业规则包
- 插件化规则引擎

---

**文档版本**: v1.0
**最后更新**: 2025-11-06
**审核状态**: 待审核
