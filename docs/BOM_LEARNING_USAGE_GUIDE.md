# BOM历史案例学习系统使用指南

## 📋 概述

本系统实现了从历史BOM样本中自动学习配套规则的功能,支持:
1. **上传历史BOM** - 批量上传Excel格式的BOM清单
2. **统计分析** - 自动分析零件配套模式
3. **生成规则** - 生成置信度评分的配套规则
4. **规则应用** - 在新的设计中自动应用学习到的规则

---

## 🎯 核心功能

### 1. 历史案例上传

**API接口:**
```
POST /api/assembly/learn/upload-historical-bom
```

**请求参数:**
- `bom_files`: 文件数组 (最多20个Excel文件)
- `project_name`: 项目名称 (可选)
- `description`: 描述信息 (可选)

**BOM Excel格式要求:**

| 列名(中文) | 列名(英文) | 说明 | 是否必填 |
|-----------|-----------|------|---------|
| 图号/零件编号 | part_number | 零件图号 | 建议填写 |
| 名称/零件名称 | name | 零件名称 | **必填** |
| 规格 | spec | 规格型号 (如DN50) | **必填** |
| 材质 | material | 材料 | 可选 |
| 数量 | quantity | 数量 | **必填** |
| 单位 | unit | 单位 (个/件/套) | 可选 |
| 备注 | remark | 备注信息 | 可选 |

**示例BOM:**
```
图号          名称          规格         数量    单位
V-001        球阀          DN50 PN16     1      个
FL-001       法兰          DN50 PN16     2      个
BLT-001      六角螺栓      M16×60        8      个
NUT-001      六角螺母      M16           8      个
GSK-001      垫片          DN50          2      个
```

**cURL示例:**
```bash
curl -X POST http://localhost:5000/api/assembly/learn/upload-historical-bom \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bom_files=@project1_bom.xlsx" \
  -F "bom_files=@project2_bom.xlsx" \
  -F "bom_files=@project3_bom.xlsx" \
  -F "project_name=历史项目案例集" \
  -F "description=2020-2023年的管道系统项目BOM"
```

**响应示例:**
```json
{
  "success": true,
  "message": "成功上传3个历史案例",
  "data": {
    "uploaded_count": 3,
    "cases": [
      {
        "id": 1,
        "project_name": "project1_bom.xlsx",
        "created_at": "2025-11-11T10:00:00Z"
      }
    ]
  }
}
```

---

### 2. 查看历史案例列表

**API接口:**
```
GET /api/assembly/learn/historical-cases
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "project_name": "project1_bom.xlsx",
      "description": "2020年管道项目",
      "item_count": 45,
      "uploaded_by": "user123",
      "created_at": "2025-11-11T10:00:00Z"
    }
  ]
}
```

---

### 3. 分析配套模式

**API接口:**
```
POST /api/assembly/learn/analyze-patterns
```

**功能说明:**
- 从所有历史BOM中统计零件共现模式
- 识别主件(阀门、泵等)与辅助件(法兰、螺栓等)的配套关系
- 计算配套数量的平均值和置信度
- 生成可复用的配套规则

**分析逻辑:**

1. **识别主件** - 通过关键词识别主要设备
   - 阀门类: 球阀、闸阀、截止阀
   - 泵类: 离心泵、齿轮泵
   - 提取DN口径: DN50, DN80等

2. **查找配套件** - 在同一BOM中查找相关零件
   - 法兰: 同DN口径的法兰
   - 螺栓: 配套的螺栓螺母
   - 垫片: 同DN口径的垫片

3. **统计共现** - 计算出现频率
   - 如果"球阀DN50"在10个案例中都配"法兰DN50×2"
   - 则生成规则: 置信度 = 10/10 = 100%

**cURL示例:**
```bash
curl -X POST http://localhost:5000/api/assembly/learn/analyze-patterns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**响应示例:**
```json
{
  "success": true,
  "message": "分析完成,生成5条配套规则",
  "data": {
    "analyzed_cases": 10,
    "rules_generated": 5,
    "rules": [
      {
        "rule_id": "LEARNED_球阀_DN50_NEEDS_FLANGES",
        "rule_name": "球阀DN50配套规则",
        "confidence": 0.95
      }
    ]
  }
}
```

---

### 4. 查看学习到的规则

**API接口:**
```
GET /api/assembly/learn/matching-rules
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "rule_id": "LEARNED_球阀_DN50_NEEDS_FLANGES",
      "rule_name": "球阀DN50配套规则",
      "rule_type": "matching",
      "condition_data": {
        "part_type": "球阀",
        "dn": 50
      },
      "action_data": {
        "add_parts": [
          {
            "type": "法兰",
            "spec": "DN50",
            "quantity": 2,
            "reasoning": "统计10个案例,平均配套数量"
          },
          {
            "type": "螺栓",
            "spec": "M16",
            "quantity": 8,
            "reasoning": "统计10个案例,平均配套数量"
          }
        ]
      },
      "source": "learned_from_history",
      "confidence": 0.95,
      "sample_count": 10,
      "created_at": "2025-11-11T11:00:00Z"
    }
  ]
}
```

---

## 🔧 技术实现

### 数据库表结构

#### 1. historical_cases (历史案例表)
```sql
CREATE TABLE historical_cases (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255),
    description TEXT,
    bom_data JSONB,  -- BOM清单数据
    uploaded_by VARCHAR(50),
    created_at TIMESTAMP
);
```

#### 2. design_rules (设计规则表 - 扩展)
```sql
ALTER TABLE design_rules ADD COLUMN rule_type VARCHAR(50);  -- 'matching'
ALTER TABLE design_rules ADD COLUMN condition_data JSONB;   -- 条件
ALTER TABLE design_rules ADD COLUMN action_data JSONB;      -- 动作
ALTER TABLE design_rules ADD COLUMN confidence FLOAT;       -- 置信度
ALTER TABLE design_rules ADD COLUMN sample_count INTEGER;   -- 样本数
```

#### 3. matching_patterns (配套模式缓存表)
```sql
CREATE TABLE matching_patterns (
    id SERIAL PRIMARY KEY,
    pattern_key VARCHAR(200) UNIQUE,  -- valve_DN50_needs_flanges
    main_part_type VARCHAR(100),
    main_part_dn INTEGER,
    matching_part_type VARCHAR(100),
    occurrence_count INTEGER,
    confidence FLOAT
);
```

### 关键算法

#### 共现模式分析算法
```javascript
function analyzeCoOccurrencePatterns(cases) {
  const patterns = {}

  for (const caseData of cases) {
    const bom = caseData.bom_data

    // 1. 识别主件
    for (const item of bom) {
      if (isMainPart(item)) {
        const mainPartType = extractType(item)
        const dn = extractDN(item.specification)

        // 2. 查找配套件
        const flanges = bom.filter(part =>
          isFlangeAndMatchDN(part, dn)
        )

        // 3. 记录配套关系
        const key = `${mainPartType}_DN${dn}_needs_flanges`
        if (!patterns[key]) {
          patterns[key] = { count: 0, parts: [] }
        }
        patterns[key].count++
        patterns[key].parts.push({ quantity: flanges.length })
      }
    }
  }

  return patterns
}
```

#### 规则生成算法
```javascript
function generateMatchingRules(patterns) {
  const rules = []

  for (const [key, pattern] of Object.entries(patterns)) {
    // 计算置信度
    const confidence = pattern.count / totalCases

    // 只保留置信度 >= 50% 的规则
    if (confidence < 0.5) continue

    // 计算平均配套数量
    const avgQuantity = Math.round(
      pattern.parts.reduce((sum, p) => sum + p.quantity, 0) / pattern.parts.length
    )

    rules.push({
      rule_id: `LEARNED_${key.toUpperCase()}`,
      condition: { part_type: pattern.main_part_type, dn: pattern.dn },
      action: { add_parts: [{ type: '法兰', quantity: avgQuantity }] },
      confidence: Math.min(0.95, confidence),  // 最高95%
      sample_count: pattern.count
    })
  }

  return rules
}
```

---

## 📊 使用场景示例

### 场景1: 从10个历史项目学习阀门配套规则

**步骤:**

1. **准备BOM文件** (10个Excel文件)
   - project1_bom.xlsx: 包含球阀DN50 + 法兰DN50×2 + M16螺栓×8
   - project2_bom.xlsx: 包含球阀DN50 + 法兰DN50×2 + M16螺栓×8
   - ...
   - project10_bom.xlsx

2. **上传BOM**
```bash
curl -X POST http://localhost:5000/api/assembly/learn/upload-historical-bom \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bom_files=@project1_bom.xlsx" \
  ... \
  -F "bom_files=@project10_bom.xlsx"
```

3. **分析模式**
```bash
curl -X POST http://localhost:5000/api/assembly/learn/analyze-patterns \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **查看学习结果**
```bash
curl -X GET http://localhost:5000/api/assembly/learn/matching-rules \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**学习结果:**
```json
{
  "rule_id": "LEARNED_球阀_DN50_NEEDS_FLANGES",
  "rule_name": "球阀DN50配套规则",
  "condition": { "part_type": "球阀", "dn": 50 },
  "action": {
    "add_parts": [
      { "type": "法兰", "spec": "DN50", "quantity": 2 },
      { "type": "螺栓", "spec": "M16", "quantity": 8 },
      { "type": "螺母", "spec": "M16", "quantity": 8 },
      { "type": "垫片", "spec": "DN50", "quantity": 2 }
    ]
  },
  "confidence": 0.95,
  "sample_count": 10
}
```

### 场景2: 新项目自动应用规则

当用户在新项目中选择"球阀DN50"时:

1. 系统查询匹配规则: `WHERE part_type='球阀' AND dn=50`
2. 找到学习规则: `LEARNED_球阀_DN50_NEEDS_FLANGES`
3. 自动添加配套件:
   - 法兰DN50 ×2
   - M16螺栓 ×8
   - M16螺母 ×8
   - DN50垫片 ×2
4. 显示置信度: "该配套方案基于10个历史案例,置信度95%"

---

## 🔍 关键特性

### 1. 智能识别

**零件类型识别:**
- 关键词匹配: "球阀"、"闸阀"、"泵"
- 规格提取: DN50, PN16, M16
- 容错处理: "DN 50" = "DN50"

### 2. 置信度评分

**评分逻辑:**
```
置信度 = 出现次数 / 总案例数

示例:
- 10个案例中,9个都是"球阀DN50配法兰DN50×2"
- 置信度 = 9/10 = 0.9 (90%)
```

**阈值设置:**
- < 50%: 不生成规则 (样本不足)
- 50%-80%: 中等置信度,显示警告
- > 80%: 高置信度,可直接应用

### 3. 数量平均化

**处理数量差异:**
```
案例1: 球阀DN50 + 法兰×2
案例2: 球阀DN50 + 法兰×2
案例3: 球阀DN50 + 法兰×3 (异常)

平均值: (2+2+3)/3 = 2.33 → 四舍五入 = 2
```

---

## ⚠️ 注意事项

### 1. BOM质量要求

**必须包含的信息:**
- ✅ 零件名称 (用于类型识别)
- ✅ 规格型号 (用于DN/PN提取)
- ✅ 数量

**可选但建议的信息:**
- 零件编号 (用于精确匹配)
- 材质 (用于材料选型规则)

### 2. 样本数量要求

**最小样本:**
- 至少3个案例才能进行统计分析
- 建议10个以上案例以提高准确性

**规则置信度:**
- 出现频率 < 50%: 不生成规则
- 出现频率 ≥ 50%: 生成规则但标记为"需审核"
- 出现频率 ≥ 80%: 高置信度,可自动应用

### 3. 数据一致性

**规格命名统一:**
```
✅ 推荐:
  - DN50 (统一大写)
  - M16 (统一格式)

❌ 避免:
  - dn50, Dn50, DN 50 (不一致)
  - M 16, m16 (不一致)
```

---

## 🚀 下一步计划

### Phase 1: 当前完成 ✅
- ✅ BOM上传接口
- ✅ 共现模式分析
- ✅ 规则生成算法
- ✅ 数据库表设计

### Phase 2: 待实现
- [ ] 前端上传页面
- [ ] 规则可视化展示
- [ ] 规则人工审核功能
- [ ] 规则冲突检测

### Phase 3: 高级功能
- [ ] 与国标规则混合应用
- [ ] 规则优先级管理
- [ ] 成本优化建议
- [ ] 安装空间检查

---

## 📚 参考文档

- [知识库系统完整文档](./plans/KNOWLEDGE_BASE_SYSTEM.md)
- [装配系统诊断报告](./plans/LEARNING_SYSTEM_ACCURATE_DIAGNOSIS.md)
- [选型知识学习](./plans/SELECTION_KNOWLEDGE_LEARNING.md)

---

## 🆘 常见问题

### Q1: 为什么我的规则置信度很低?

**A:** 可能原因:
1. 样本数量太少 (< 5个)
2. BOM数据不一致 (规格命名不统一)
3. 配套关系确实不稳定

**解决方案:**
- 增加样本数量
- 统一BOM格式
- 检查是否需要按子类型分组

### Q2: 如何处理特殊案例?

**A:** 对于不符合通用规则的特殊项目:
1. 可以在BOM中添加"备注"字段说明
2. 系统会单独标记这些异常案例
3. 可以创建"特殊规则"类别

### Q3: 学习到的规则会自动应用吗?

**A:** 取决于置信度:
- 置信度 >= 80%: 自动应用,但可撤销
- 置信度 50%-80%: 提示建议,需用户确认
- 置信度 < 50%: 不显示

---

## 📞 技术支持

如有问题,请联系:
- 技术负责人: [您的名字]
- 邮箱: [您的邮箱]
- 文档更新日期: 2025-11-11
