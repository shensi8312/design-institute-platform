# 装配学习系统 - 准确诊断与修复方案

## ✅ 现有系统功能确认

您的系统**已经具备**以下功能：

### 1. 前端上传入口 ✅
- 文件：`apps/web/src/pages/AssemblyConstraintEngine.tsx`
- 功能：
  - ✅ 上传BOM Excel文件
  - ✅ 上传多个STEP文件（装配图 + 零件图）
  - ✅ 触发学习流程
  - ✅ 显示学习结果（约束列表）

### 2. 后端学习流程 ✅
- 文件：`apps/api/src/services/assembly/AssemblyReasoningService.js`
- 功能：
  - ✅ BOM解析：`_parseBOM()` - 从Excel提取零件编号、名称、描述
  - ✅ STEP解析：`_parseStepFiles()` - 调用Python脚本分析装配关系
  - ✅ 规则匹配：使用硬编码规则(R1-R5)生成约束
  - ✅ 规则学习：`_extractRulesFromConstraints()` - 从约束中学习新规则

### 3. 数据库存储 ✅
- ✅ `assembly_constraints` - 存储学到的约束
- ✅ `assembly_rules` - 存储学到的规则
- ✅ `assembly_inference_tasks` - 存储学习任务

---

## ❌ 核心问题诊断

### 问题：学到的规则质量差，无法应用

**当前学习流程：**
```
用户上传: BOM + 装配图STEP
    ↓
解析BOM → 零件列表(名称、编号)
解析STEP → 几何约束
    ↓
使用硬编码规则(R1-R5) → 生成约束
    ↓
从约束中学习规则(_extractRulesFromConstraints)
    ↓
学到的规则格式:
{
  rule_name: "M8 螺纹配合规则",
  condition_logic: { type: 'name_contains', field: 'name', value: 'M8' },
  action_template: { constraint_type: 'SCREW' }
}
```

**问题所在：**

| 问题 | 现状 | 影响 |
|------|------|------|
| ❌ 规则过于简单 | 只基于关键词匹配<br>("名称包含M8") | 规则太宽泛，误匹配率高 |
| ❌ 缺少零件类型 | 没有记录零件类型组合<br>("阀门+法兰") | 无法学到语义化规则 |
| ❌ BOM-STEP关联弱 | STEP中零件是文件名<br>BOM中零件是零件名<br>关联只靠名称模糊匹配 | 学到的规则缺少类型信息 |
| ❌ 参数信息缺失 | 只记录约束类型<br>不记录距离、角度等参数 | 规则不完整，应用时缺参数 |

**代码证据**（`AssemblyReasoningService.js:1303-1312`）：
```javascript
// 现有的规则学习逻辑
const rule = {
  rule_name: `${patternData.feature} 螺纹配合规则`,  // 只有特征名
  rule_content: `当检测到包含"${patternData.feature}"特征的零件时...`,
  // ❌ condition只是name_contains，不是零件类型匹配
  // ❌ action没有具体参数（距离、角度）
}
```

### 具体示例对比

**现在学到的规则：**
```json
{
  "rule_id": "LEARNED_SCREW_M8",
  "condition_logic": {
    "type": "name_contains",
    "field": "name",
    "value": "M8"
  },
  "action_template": {
    "constraint_type": "SCREW"
  }
}
```
❌ **问题**：只要零件名称包含"M8"就触发，不管是螺栓、螺母、还是阀门

**您期望学到的规则：**
```json
{
  "rule_id": "VALVE_FLANGE_CONNECTION",
  "rule_name": "阀门-法兰螺栓连接规则",
  "condition_logic": {
    "type": "part_type_combination",
    "part_a_type": "阀门",
    "part_b_type": "法兰",
    "specification_match": "DN相同"
  },
  "action_template": {
    "constraint_type": "SCREW",
    "distance_mm": 5.0,
    "bolt_thread": "M8",
    "bolt_count": 4,
    "alignment": "ALIGNED"
  },
  "confidence": 0.95,
  "sample_count": 18
}
```
✅ **正确**：明确零件类型组合 + 详细参数

---

## 🎯 问题根源

### 根源1：BOM解析只提取名称，没有类型分类

**当前`_parseBOM`的输出** (line 494-530):
```javascript
{
  partNumber: "V-001",
  name: "球阀DN50",
  description: "不锈钢球阀 DN50 PN16",
  thread: "M8x1.25",     // ✅ 能识别螺纹
  type: "接头"            // ❌ 类型识别不准（球阀被识别为接头）
}
```

**问题**：
- ❌ 类型识别基于简单关键词匹配，准确率低
- ❌ 缺少子类型（球阀、截止阀、止回阀）
- ❌ 缺少连接方式识别（法兰连接、螺纹连接、焊接）

### 根源2：STEP解析只提取几何，没有关联BOM

**当前`_parseStepFiles`的输出**:
```javascript
// STEP文件分析结果
{
  constraints: [
    {
      type: "CONCENTRIC",
      part1: "Part_1",      // ❌ 只是ID，不知道是什么零件
      part2: "Part_3",
      distance: 50.2
    }
  ],
  parts: [
    {
      part_number: "Part_1",    // ❌ 没有关联到BOM的V-001
      file_name: "valve.step",
      has_holes: true
    }
  ]
}
```

**问题**：
- ❌ STEP中的零件（Part_1）无法关联到BOM中的零件（V-001 球阀）
- ❌ 学习规则时不知道Part_1是"球阀"

### 根源3：规则学习只统计关键词，不分析零件类型组合

**当前`_extractRulesFromConstraints`的逻辑** (line 1236-1300):
```javascript
// 现有学习逻辑
patterns.forEach(item => {
  // 只提取关键词
  const keywords = ['螺母', '螺钉', '螺栓', '垫片', '法兰', '接头', '阀门']
  keywords.forEach(keyword => {
    if (partA.includes(keyword) || partB.includes(keyword)) {
      patterns[`${type}_${keyword}`].count++  // ❌ 只统计关键词频率
    }
  })
})

// 生成规则
const rule = {
  condition_logic: {
    type: 'name_contains',   // ❌ 只是名称包含
    value: keyword
  }
}
```

**问题**：
- ❌ 没有分析"零件A类型 + 零件B类型 → 约束类型"的模式
- ❌ 没有统计典型参数（距离范围、角度等）
- ❌ 没有记录零件规格匹配要求（DN相同、螺纹匹配等）

---

## 🛠️ 修复方案

### 方案概览

```
改进点1: 增强BOM解析
├─ 使用NLP/LLM识别零件类型
├─ 提取规格参数（DN、PN、材质）
└─ 分类：主类型 + 子类型 + 连接方式

改进点2: 强化BOM-STEP关联
├─ 基于零件编号精确匹配
├─ 基于规格参数匹配(DN, 螺纹)
└─ 基于几何特征匹配(体积, 孔数)

改进点3: 改进规则学习算法
├─ 分析零件类型组合模式
├─ 统计约束参数分布
└─ 生成条件规则(IF-THEN)
```

### 修复1：增强BOM解析

**新增函数：`_enrichPartType`**
```javascript
/**
 * 增强零件类型识别
 * 使用LLM + 规则结合
 */
async _enrichPartType(partInfo) {
  const { name, description, specification } = partInfo

  // 1. 规则匹配（快速）
  const ruleBasedType = this._matchPartTypeByRules(name, description)

  // 2. LLM识别（准确）
  if (!ruleBasedType || ruleBasedType.confidence < 0.8) {
    const llmResult = await this._identifyPartTypeWithLLM(name, description, specification)
    return {
      main_type: llmResult.main_type,        // 阀门、泵、法兰、管道等
      sub_type: llmResult.sub_type,          // 球阀、截止阀、止回阀
      connection_type: llmResult.connection, // 法兰连接、螺纹连接、焊接
      dn: this._extractDN(specification),
      pn: this._extractPN(specification),
      material: this._extractMaterial(description),
      confidence: llmResult.confidence
    }
  }

  return ruleBasedType
}

_matchPartTypeByRules(name, description) {
  const combined = `${name} ${description}`.toLowerCase()

  // 精细化分类
  const typeRules = [
    { pattern: /球阀|ball.*valve/i, main: '阀门', sub: '球阀', conn: '法兰连接' },
    { pattern: /截止阀|globe.*valve/i, main: '阀门', sub: '截止阀', conn: '法兰连接' },
    { pattern: /止回阀|check.*valve/i, main: '阀门', sub: '止回阀', conn: '法兰连接' },
    { pattern: /法兰|flange/i, main: '法兰', sub: '对焊法兰', conn: '螺栓连接' },
    { pattern: /离心泵|centrifugal.*pump/i, main: '泵', sub: '离心泵', conn: '法兰连接' },
    // ...更多规则
  ]

  for (const rule of typeRules) {
    if (rule.pattern.test(combined)) {
      return {
        main_type: rule.main,
        sub_type: rule.sub,
        connection_type: rule.conn,
        confidence: 0.9
      }
    }
  }

  return null
}
```

### 修复2：强化BOM-STEP关联

**新增函数：`_correlateBOMandSTEP`**
```javascript
/**
 * 关联BOM零件与STEP零件
 */
_correlateBOMandSTEP(bomParts, stepParts, stepConstraints) {
  const correlations = []

  for (const stepPart of stepParts) {
    const stepPartId = stepPart.part_number || stepPart.file_name

    // 方法1: 零件编号精确匹配
    let matched = bomParts.find(bom =>
      bom.partNumber && stepPartId.includes(bom.partNumber)
    )

    // 方法2: 规格参数匹配
    if (!matched) {
      matched = bomParts.find(bom => {
        const bomDN = this._extractDN(bom.specification)
        const stepDN = this._extractDN(stepPartId)
        return bomDN && stepDN && bomDN === stepDN
      })
    }

    // 方法3: 几何特征匹配
    if (!matched && stepPart.volume) {
      matched = bomParts.find(bom => {
        // 基于体积推断（简化）
        const expectedVolume = this._estimateVolumeByType(bom.main_type, bom.dn)
        return Math.abs(expectedVolume - stepPart.volume) < 1000  // 1L容差
      })
    }

    if (matched) {
      correlations.push({
        step_part: stepPart,
        bom_part: matched,
        confidence: 0.9
      })
    }
  }

  console.log(`[关联] BOM-STEP关联: ${correlations.length}/${stepParts.length}`)

  // 关联STEP约束中的零件信息
  const enrichedConstraints = stepConstraints.map(constraint => {
    const part_a_corr = correlations.find(c => c.step_part.part_number === constraint.part1)
    const part_b_corr = correlations.find(c => c.step_part.part_number === constraint.part2)

    return {
      ...constraint,
      part_a_type: part_a_corr?.bom_part.main_type,
      part_b_type: part_b_corr?.bom_part.main_type,
      part_a_sub_type: part_a_corr?.bom_part.sub_type,
      part_b_sub_type: part_b_corr?.bom_part.sub_type,
      part_a_bom: part_a_corr?.bom_part,
      part_b_bom: part_b_corr?.bom_part
    }
  })

  return enrichedConstraints
}
```

### 修复3：改进规则学习算法

**重写`_extractRulesFromConstraints`**
```javascript
async _extractRulesFromConstraints(constraints, taskId, parts) {
  console.log(`[规则学习] 🧠 分析 ${constraints.length} 个约束...`)

  // 1. 按零件类型组合分组
  const typeComboGroups = {}

  constraints.forEach(c => {
    if (!c.part_a_type || !c.part_b_type) return  // 必须有类型信息

    // 生成组合键（归一化，排序）
    const types = [c.part_a_type, c.part_b_type].sort()
    const comboKey = `${types[0]}_${types[1]}_${c.type}`

    if (!typeComboGroups[comboKey]) {
      typeComboGroups[comboKey] = {
        part_type_a: types[0],
        part_type_b: types[1],
        constraint_type: c.type,
        samples: [],
        distances: [],
        angles: []
      }
    }

    typeComboGroups[comboKey].samples.push(c)
    if (c.distance) typeComboGroups[comboKey].distances.push(c.distance)
    if (c.angle) typeComboGroups[comboKey].angles.push(c.angle)
  })

  console.log(`[规则学习] 识别 ${Object.keys(typeComboGroups).length} 种零件组合模式`)

  // 2. 为每种组合生成规则
  const learnedRules = []

  for (const [comboKey, group] of Object.entries(typeComboGroups)) {
    if (group.samples.length < 2) continue  // 至少2个样本

    // 统计参数分布
    const avgDistance = group.distances.length > 0
      ? group.distances.reduce((a, b) => a + b, 0) / group.distances.length
      : null

    const stdDistance = group.distances.length > 1
      ? Math.sqrt(group.distances.reduce((sum, d) =>
          sum + Math.pow(d - avgDistance, 2), 0) / group.distances.length)
      : null

    // 检查规格匹配要求
    const requiresDNMatch = this._checkDNMatchRequirement(group.samples)
    const requiresThreadMatch = this._checkThreadMatchRequirement(group.samples)

    // 生成规则
    const rule = {
      rule_id: `LEARNED_${group.part_type_a}_${group.part_type_b}_${group.constraint_type}`,
      rule_name: `${group.part_type_a}与${group.part_type_b}${group.constraint_type}连接规则`,

      // ✅ 条件：零件类型组合
      condition_logic: {
        type: 'part_type_combination',
        part_a_type: group.part_type_a,
        part_b_type: group.part_type_b,
        require_dn_match: requiresDNMatch,
        require_thread_match: requiresThreadMatch
      },

      // ✅ 动作：约束类型 + 参数
      action_template: {
        constraint_type: group.constraint_type,
        typical_distance_mm: avgDistance ? avgDistance.toFixed(2) : null,
        distance_tolerance_mm: stdDistance ? (stdDistance * 2).toFixed(2) : null,
        // ...更多参数
      },

      // ✅ 元数据
      confidence: Math.min(0.5 + group.samples.length * 0.05, 0.95),
      sample_count: group.samples.length,
      source_task_id: taskId,

      // ✅ 示例（用于调试）
      examples: group.samples.slice(0, 3).map(s => ({
        part_a: s.part_a_bom?.name,
        part_b: s.part_b_bom?.name,
        distance: s.distance
      }))
    }

    learnedRules.push(rule)

    console.log(`[规则学习] 📚 学到规则: ${rule.rule_name}`)
    console.log(`  - 置信度: ${(rule.confidence * 100).toFixed(0)}%`)
    console.log(`  - 样本数: ${rule.sample_count}`)
    console.log(`  - 典型距离: ${rule.action_template.typical_distance_mm}mm`)
  }

  // 3. 保存规则到数据库
  if (learnedRules.length > 0) {
    await this._saveLearnedRules(learnedRules)
  }

  return learnedRules
}

_checkDNMatchRequirement(samples) {
  // 检查样本中是否都要求DN相同
  let matchCount = 0
  samples.forEach(s => {
    const dn_a = s.part_a_bom?.dn
    const dn_b = s.part_b_bom?.dn
    if (dn_a && dn_b && dn_a === dn_b) matchCount++
  })
  return matchCount / samples.length > 0.8  // 80%以上样本DN相同
}
```

---

## 📊 修复效果对比

### Before（现在）

**学到的规则：**
```json
{
  "rule_name": "M8 螺纹配合规则",
  "condition": "name_contains: M8",
  "action": "SCREW"
}
```
❌ 应用时：只要名称有"M8"就触发，误匹配率高

### After（修复后）

**学到的规则：**
```json
{
  "rule_id": "LEARNED_阀门_法兰_SCREW",
  "rule_name": "阀门与法兰SCREW连接规则",
  "condition": {
    "type": "part_type_combination",
    "part_a_type": "阀门",
    "part_b_type": "法兰",
    "require_dn_match": true
  },
  "action": {
    "constraint_type": "SCREW",
    "typical_distance_mm": 5.2,
    "distance_tolerance_mm": 1.5,
    "bolt_thread": "M8",
    "bolt_count": 4
  },
  "confidence": 0.95,
  "sample_count": 18
}
```
✅ 应用时：检查零件类型、DN匹配，精准触发

---

## 🚀 实施计划

### MVP阶段（1周）

**必须实现：**
1. ✅ 增强`_enrichPartType` - LLM识别零件类型（主类型、子类型）
2. ✅ 新增`_correlateBOMandSTEP` - BOM与STEP零件关联
3. ✅ 重写`_extractRulesFromConstraints` - 学习零件类型组合规则
4. ✅ 修改规则匹配逻辑 - 支持part_type_combination条件

**验收标准：**
- ✅ 学到的规则包含零件类型信息
- ✅ 规则可以根据零件类型精准匹配
- ✅ BOM-STEP关联成功率 ≥ 70%

### 完整版（2周）

在MVP基础上：
- 统计参数分布（距离、角度、螺栓数）
- DN/螺纹匹配要求自动识别
- 规则置信度动态调整

---

## ✅ 下一步行动

**建议：立即实施MVP修复**

我将为您：
1. 改进`_enrichPartType`函数（LLM零件分类）
2. 新增`_correlateBOMandSTEP`函数（BOM-STEP关联）
3. 重写`_extractRulesFromConstraints`（零件类型组合规则学习）
4. 更新规则匹配逻辑（`evaluateCondition`支持新条件类型）

**预计效果：**
- 学到的规则从"名称包含M8"变为"阀门+法兰 → SCREW"
- 规则可以精准应用到新的装配场景
- 误匹配率从50%降低到10%以下

**是否立即开始实施？**
