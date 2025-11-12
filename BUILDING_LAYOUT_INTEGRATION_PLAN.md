# 建筑强排系统 - 集成方案

## 🎯 集成策略: 扩展现有 design_rules 统一规则系统

### 现状分析

你已经有完善的基础设施:
- ✅ `design_rules` 表 - 统一规则基表 (支持 rule_type: building/assembly/pid/process)
- ✅ `rule_categories` 表 - 规则分类系统
- ✅ `knowledge_documents` 表 - 文档管理
- ✅ `knowledge_graph` 表 - 知识图谱 (Neo4j + Milvus)
- ✅ `assembly_rules` 表 - 装配专用规则

**结论**: 不需要新建表! 扩展现有系统即可。

---

## 📋 实施计划

### Phase 1: 扩展规则类型和分类 (1-2天)

#### 1.1 添加新的 rule_categories

```sql
-- 新增建筑强排规则分类
INSERT INTO rule_categories (id, name, code, level, sort_order, description) VALUES
  ('layout_setback', '红线退距规则', 'SETBACK', 'national', 10, '建筑与用地红线、道路、河流等的退距要求'),
  ('layout_area', '面积推导规则', 'AREA', 'enterprise', 11, '基于工艺参数自动推导各功能区面积'),
  ('layout_um', '能耗公式规则', 'UM', 'enterprise', 12, '冷热电气水等能耗计算公式'),
  ('layout_compliance', '合规检查规则', 'COMPLIANCE', 'national', 13, '建筑规范、消防、结构限制等合规检查');
```

#### 1.2 定义规则结构 JSON Schema

**1. Setback Rule (红线退距规则)**

```javascript
// design_rules.rule_structure 字段内容
{
  "meta": {
    "rule_type": "layout_setback",
    "version": "1.0",
    "author": "system",
    "created_at": "2025-11-11"
  },
  "scope": {
    "boundary_type": "expressway",  // expressway/road/river/property_line
    "building_types": ["fab", "warehouse"],  // 适用建筑类型
    "regions": ["全国"]  // 适用地区
  },
  "rule": {
    "base_distance": 50,  // 基础退距 (米)
    "unit": "meters",
    "conditions": [
      {
        "condition_type": "building_height",
        "operator": ">",
        "threshold": 24,
        "adjustment": 10  // 超过24m加10m
      },
      {
        "condition_type": "boundary_level",
        "mapping": {
          "expressway": 50,
          "main_road": 30,
          "secondary_road": 15
        }
      }
    ]
  },
  "evaluation": {
    "formula": "base_distance + sum(conditions.adjustments)",
    "result_unit": "meters"
  }
}
```

**2. Area Formula Rule (面积推导规则)**

```javascript
{
  "meta": {
    "rule_type": "layout_area",
    "version": "1.0",
    "facility_type": "fab"
  },
  "scope": {
    "process_type": "semiconductor_fab",
    "technology_node": "28nm"
  },
  "rule": {
    "target_area": "cleanroom",
    "dependencies": ["chips_per_month"],  // 依赖的输入参数
    "formula": {
      "expression": "chips_per_month * coefficient + base_area",
      "coefficients": {
        "coefficient": 2.5,  // 每片/月需要2.5平米
        "base_area": 1000    // 基础面积1000平米
      }
    },
    "constraints": {
      "min_area": 500,
      "max_area": 50000,
      "multiple_of": 100  // 面积必须是100的倍数
    }
  },
  "evaluation": {
    "formula": "chips_per_month * 2.5 + 1000",
    "result_unit": "square_meters"
  }
}
```

**3. UM Formula Rule (能耗公式规则)**

```javascript
{
  "meta": {
    "rule_type": "layout_um",
    "version": "1.0",
    "utility_type": "power"  // power/cooling/water/gas
  },
  "scope": {
    "facility_type": "fab",
    "regions": ["全国"]
  },
  "rule": {
    "target_utility": "power_consumption",
    "dependencies": ["cleanroom_area", "office_area", "warehouse_area"],
    "formula": {
      "expression": "cleanroom_area * cleanroom_coef + office_area * office_coef + warehouse_area * warehouse_coef",
      "coefficients": {
        "cleanroom_coef": 800,  // W/m²
        "office_coef": 50,      // W/m²
        "warehouse_coef": 30    // W/m²
      }
    },
    "redundancy_factor": 1.2  // 20% 冗余
  },
  "evaluation": {
    "formula": "(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2",
    "result_unit": "watts"
  }
}
```

**4. Compliance Rule (合规检查规则)**

```javascript
{
  "meta": {
    "rule_type": "layout_compliance",
    "version": "1.0",
    "standard_code": "GB50016-2014",
    "standard_name": "建筑设计防火规范"
  },
  "scope": {
    "building_types": ["fab", "warehouse"],
    "check_type": "fire_safety"
  },
  "rule": {
    "check_items": [
      {
        "item": "building_spacing",
        "description": "建筑防火间距",
        "conditions": [
          {
            "if": "building_height <= 24 && fire_resistance_rating == 1",
            "then": "spacing >= 10"
          },
          {
            "if": "building_height > 24 || fire_resistance_rating == 2",
            "then": "spacing >= 13"
          }
        ]
      },
      {
        "item": "evacuation_width",
        "description": "疏散门宽度",
        "formula": "occupant_count / 100",
        "min_value": 0.9,
        "unit": "meters"
      }
    ]
  },
  "evaluation": {
    "type": "boolean",
    "all_must_pass": true
  }
}
```

#### 1.3 数据库迁移文件

```javascript
// apps/api/src/database/migrations/20251112000000_add_building_layout_rule_types.js

exports.up = async function(knex) {
  console.log('🏗️  添加建筑强排规则类型...')

  // 1. 添加新的规则分类
  await knex('rule_categories').insert([
    {
      id: 'layout_setback',
      name: '红线退距规则',
      code: 'SETBACK',
      level: 'national',
      sort_order: 10,
      description: '建筑与用地红线、道路、河流等的退距要求'
    },
    {
      id: 'layout_area',
      name: '面积推导规则',
      code: 'AREA',
      level: 'enterprise',
      sort_order: 11,
      description: '基于工艺参数自动推导各功能区面积'
    },
    {
      id: 'layout_um',
      name: '能耗公式规则',
      code: 'UM',
      level: 'enterprise',
      sort_order: 12,
      description: '冷热电气水等能耗计算公式'
    },
    {
      id: 'layout_compliance',
      name: '合规检查规则',
      code: 'COMPLIANCE',
      level: 'national',
      sort_order: 13,
      description: '建筑规范、消防、结构限制等合规检查'
    }
  ])

  // 2. 插入示例规则
  await knex('design_rules').insert([
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_setback',
      rule_code: 'SETBACK-EXPRESSWAY-001',
      rule_name: '高速公路红线退距',
      rule_content: '建筑物与高速公路红线的最小退距为50米，建筑高度超过24米时增加10米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_setback',
          version: '1.0'
        },
        scope: {
          boundary_type: 'expressway',
          building_types: ['fab', 'warehouse', 'office']
        },
        rule: {
          base_distance: 50,
          unit: 'meters',
          conditions: [
            {
              condition_type: 'building_height',
              operator: '>',
              threshold: 24,
              adjustment: 10
            }
          ]
        },
        evaluation: {
          formula: 'base_distance + (building_height > 24 ? 10 : 0)',
          result_unit: 'meters'
        }
      }),
      parameters: JSON.stringify({
        base_distance: 50,
        height_threshold: 24,
        additional_distance: 10
      }),
      extraction_method: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_area',
      rule_code: 'AREA-FAB-CLEANROOM-001',
      rule_name: 'Fab洁净室面积推导',
      rule_content: '洁净室面积 = 月产能(片) × 2.5 + 基础面积1000平米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_area',
          version: '1.0',
          facility_type: 'fab'
        },
        scope: {
          process_type: 'semiconductor_fab',
          technology_node: ['28nm', '14nm', '7nm']
        },
        rule: {
          target_area: 'cleanroom',
          dependencies: ['chips_per_month'],
          formula: {
            expression: 'chips_per_month * 2.5 + 1000',
            coefficients: {
              per_chip_area: 2.5,
              base_area: 1000
            }
          },
          constraints: {
            min_area: 500,
            max_area: 50000
          }
        },
        evaluation: {
          formula: 'chips_per_month * 2.5 + 1000',
          result_unit: 'square_meters'
        }
      }),
      parameters: JSON.stringify({
        coefficient: 2.5,
        base_area: 1000,
        min_area: 500,
        max_area: 50000
      }),
      extraction_method: 'ai_learning',
      learned_from: 'ai_learning',
      review_status: 'approved',
      confidence_score: 0.92,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_um',
      rule_code: 'UM-POWER-FAB-001',
      rule_name: 'Fab电力负荷计算',
      rule_content: '总电力负荷 = 洁净室面积×800W/m² + 办公区×50W/m² + 仓库×30W/m²，冗余系数1.2',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_um',
          version: '1.0',
          utility_type: 'power'
        },
        scope: {
          facility_type: 'fab'
        },
        rule: {
          target_utility: 'power_consumption',
          dependencies: ['cleanroom_area', 'office_area', 'warehouse_area'],
          formula: {
            expression: '(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2',
            coefficients: {
              cleanroom_coef: 800,
              office_coef: 50,
              warehouse_coef: 30,
              redundancy_factor: 1.2
            }
          }
        },
        evaluation: {
          formula: '(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2',
          result_unit: 'watts'
        }
      }),
      parameters: JSON.stringify({
        cleanroom_power_density: 800,
        office_power_density: 50,
        warehouse_power_density: 30,
        redundancy_factor: 1.2
      }),
      extraction_method: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    }
  ])

  console.log('✅ 建筑强排规则类型添加完成')
}

exports.down = async function(knex) {
  await knex('design_rules').whereIn('category_id', [
    'layout_setback',
    'layout_area',
    'layout_um',
    'layout_compliance'
  ]).del()

  await knex('rule_categories').whereIn('id', [
    'layout_setback',
    'layout_area',
    'layout_area',
    'layout_um',
    'layout_compliance'
  ]).del()
}
```

---

### Phase 2: 创建规则评估引擎 (2-3天)

#### 2.1 通用规则评估器

```javascript
// apps/api/src/services/rules/RuleEvaluationEngine.js

class RuleEvaluationEngine {
  constructor() {
    this.evaluators = {
      'layout_setback': this.evaluateSetbackRule.bind(this),
      'layout_area': this.evaluateAreaRule.bind(this),
      'layout_um': this.evaluateUMRule.bind(this),
      'layout_compliance': this.evaluateComplianceRule.bind(this)
    }
  }

  /**
   * 评估规则
   * @param {Object} rule - design_rules 表中的一条记录
   * @param {Object} context - 评估上下文 (如: {building_height: 30, boundary_type: 'expressway'})
   * @returns {Object} 评估结果
   */
  async evaluate(rule, context) {
    const ruleStructure = typeof rule.rule_structure === 'string'
      ? JSON.parse(rule.rule_structure)
      : rule.rule_structure

    const ruleType = ruleStructure.meta.rule_type
    const evaluator = this.evaluators[ruleType]

    if (!evaluator) {
      throw new Error(`未知规则类型: ${ruleType}`)
    }

    return await evaluator(ruleStructure, context)
  }

  evaluateSetbackRule(ruleStructure, context) {
    const { base_distance, conditions } = ruleStructure.rule
    let totalDistance = base_distance

    // 评估条件
    for (const condition of conditions || []) {
      if (condition.condition_type === 'building_height') {
        const height = context.building_height || 0
        if (this.compareValues(height, condition.operator, condition.threshold)) {
          totalDistance += condition.adjustment
        }
      }
      // ... 其他条件类型
    }

    return {
      success: true,
      result: totalDistance,
      unit: ruleStructure.rule.unit,
      details: {
        base: base_distance,
        adjustments: totalDistance - base_distance
      }
    }
  }

  evaluateAreaRule(ruleStructure, context) {
    const { formula } = ruleStructure.rule
    const expression = formula.expression

    // 简单表达式解析 (生产环境建议用 mathjs 库)
    let result = 0
    try {
      // 替换变量
      let evalExpression = expression
      for (const [key, value] of Object.entries(context)) {
        evalExpression = evalExpression.replace(new RegExp(key, 'g'), value)
      }
      result = eval(evalExpression)  // 注意: 生产环境需要安全的表达式求值器

      // 应用约束
      const constraints = ruleStructure.rule.constraints || {}
      if (constraints.min_area && result < constraints.min_area) {
        result = constraints.min_area
      }
      if (constraints.max_area && result > constraints.max_area) {
        result = constraints.max_area
      }
      if (constraints.multiple_of) {
        result = Math.ceil(result / constraints.multiple_of) * constraints.multiple_of
      }

      return {
        success: true,
        result: result,
        unit: ruleStructure.evaluation.result_unit,
        formula: expression,
        context
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  evaluateUMRule(ruleStructure, context) {
    // 类似 evaluateAreaRule
    return this.evaluateAreaRule(ruleStructure, context)
  }

  evaluateComplianceRule(ruleStructure, context) {
    const { check_items } = ruleStructure.rule
    const results = []

    for (const item of check_items) {
      const itemResult = {
        item: item.item,
        description: item.description,
        passed: true,
        violations: []
      }

      // 评估条件
      for (const condition of item.conditions || []) {
        const conditionMet = this.evaluateCondition(condition, context)
        if (!conditionMet) {
          itemResult.passed = false
          itemResult.violations.push({
            condition: condition.if,
            requirement: condition.then,
            actual: context
          })
        }
      }

      results.push(itemResult)
    }

    return {
      success: results.every(r => r.passed),
      results,
      compliant: results.every(r => r.passed)
    }
  }

  compareValues(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold
      case '>=': return value >= threshold
      case '<': return value < threshold
      case '<=': return value <= threshold
      case '==': return value == threshold
      default: return false
    }
  }

  evaluateCondition(condition, context) {
    // 简化版条件评估 (生产环境需要完整的逻辑表达式解析器)
    try {
      const ifClause = condition.if
      let evalExpression = ifClause
      for (const [key, value] of Object.entries(context)) {
        evalExpression = evalExpression.replace(new RegExp(key, 'g'), JSON.stringify(value))
      }
      return eval(evalExpression)
    } catch (error) {
      console.error('条件评估失败:', error)
      return false
    }
  }
}

module.exports = RuleEvaluationEngine
```

#### 2.2 建筑强排服务

```javascript
// apps/api/src/services/building/BuildingLayoutService.js

const RuleEvaluationEngine = require('../rules/RuleEvaluationEngine')
const DesignRulesRepository = require('../../repositories/DesignRulesRepository')

class BuildingLayoutService {
  constructor() {
    this.ruleEngine = new RuleEvaluationEngine()
    this.rulesRepo = new DesignRulesRepository()
  }

  /**
   * 计算红线退距
   * @param {Object} siteInfo - 场地信息
   * @returns {Object} 退距计算结果
   */
  async calculateSetbacks(siteInfo) {
    // 1. 获取适用的退距规则
    const setbackRules = await this.rulesRepo.findByCategory('layout_setback', {
      is_active: true,
      review_status: 'approved'
    })

    const results = []

    // 2. 对每条边界评估退距
    for (const boundary of siteInfo.boundaries) {
      const context = {
        boundary_type: boundary.type,
        building_height: siteInfo.building_height || 15,
        ...boundary.properties
      }

      // 找到匹配的规则
      for (const rule of setbackRules) {
        const ruleStructure = JSON.parse(rule.rule_structure)
        if (this.ruleMatches(ruleStructure.scope, context)) {
          const result = await this.ruleEngine.evaluate(rule, context)
          results.push({
            boundary_id: boundary.id,
            boundary_type: boundary.type,
            rule_code: rule.rule_code,
            required_distance: result.result,
            unit: result.unit,
            details: result.details
          })

          // 更新规则使用统计
          await this.rulesRepo.incrementUsageCount(rule.id)
        }
      }
    }

    return {
      success: true,
      setbacks: results
    }
  }

  /**
   * 推导建筑面积
   * @param {Object} projectParams - 项目参数 (如: chips_per_month)
   * @returns {Object} 面积分配结果
   */
  async deriveAreas(projectParams) {
    // 1. 获取面积推导规则
    const areaRules = await this.rulesRepo.findByCategory('layout_area', {
      is_active: true,
      review_status: 'approved'
    })

    const areas = {}

    // 2. 对每个功能区评估面积
    for (const rule of areaRules) {
      const ruleStructure = JSON.parse(rule.rule_structure)
      const targetArea = ruleStructure.rule.target_area

      const result = await this.ruleEngine.evaluate(rule, projectParams)
      if (result.success) {
        areas[targetArea] = {
          value: result.result,
          unit: result.unit,
          formula: result.formula,
          rule_code: rule.rule_code
        }

        await this.rulesRepo.incrementUsageCount(rule.id)
      }
    }

    return {
      success: true,
      areas,
      total_building_area: Object.values(areas).reduce((sum, a) => sum + a.value, 0)
    }
  }

  /**
   * 生成UM表
   * @param {Object} areas - 面积分配结果
   * @returns {Object} UM表
   */
  async generateUMTable(areas) {
    // 1. 获取能耗公式规则
    const umRules = await this.rulesRepo.findByCategory('layout_um', {
      is_active: true,
      review_status: 'approved'
    })

    const umTable = {}

    // 2. 对每种能耗类型计算
    for (const rule of umRules) {
      const ruleStructure = JSON.parse(rule.rule_structure)
      const utilityType = ruleStructure.meta.utility_type

      // 准备上下文
      const context = {}
      for (const [areaType, areaData] of Object.entries(areas)) {
        context[`${areaType}_area`] = areaData.value
      }

      const result = await this.ruleEngine.evaluate(rule, context)
      if (result.success) {
        umTable[utilityType] = {
          value: result.result,
          unit: result.unit,
          formula: result.formula,
          rule_code: rule.rule_code
        }

        await this.rulesRepo.incrementUsageCount(rule.id)
      }
    }

    return {
      success: true,
      um_table: umTable
    }
  }

  /**
   * 合规检查
   * @param {Object} layoutDesign - 布局设计方案
   * @returns {Object} 合规检查结果
   */
  async checkCompliance(layoutDesign) {
    // 1. 获取合规检查规则
    const complianceRules = await this.rulesRepo.findByCategory('layout_compliance', {
      is_active: true,
      review_status: 'approved'
    })

    const checkResults = []

    // 2. 逐条检查
    for (const rule of complianceRules) {
      const result = await this.ruleEngine.evaluate(rule, layoutDesign)
      checkResults.push({
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        standard: rule.rule_structure.meta.standard_code,
        passed: result.compliant,
        details: result.results
      })

      await this.rulesRepo.incrementUsageCount(rule.id)
    }

    return {
      success: true,
      compliant: checkResults.every(r => r.passed),
      checks: checkResults,
      violations: checkResults.filter(r => !r.passed)
    }
  }

  ruleMatches(scope, context) {
    // 简化版规则匹配逻辑
    if (scope.boundary_type && scope.boundary_type !== context.boundary_type) {
      return false
    }
    return true
  }
}

module.exports = BuildingLayoutService
```

---

### Phase 3: API端点 (1天)

```javascript
// apps/api/src/controllers/BuildingLayoutController.js

const BuildingLayoutService = require('../services/building/BuildingLayoutService')

class BuildingLayoutController {
  constructor() {
    this.service = new BuildingLayoutService()
  }

  async calculateSetbacks(req, res) {
    try {
      const { siteInfo } = req.body
      const result = await this.service.calculateSetbacks(siteInfo)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async deriveAreas(req, res) {
    try {
      const { projectParams } = req.body
      const result = await this.service.deriveAreas(projectParams)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async generateUMTable(req, res) {
    try {
      const { areas } = req.body
      const result = await this.service.generateUMTable(areas)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async checkCompliance(req, res) {
    try {
      const { layoutDesign } = req.body
      const result = await this.service.checkCompliance(layoutDesign)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async runFullWorkflow(req, res) {
    try {
      const { siteInfo, projectParams } = req.body

      // 1. 计算退距
      const setbacks = await this.service.calculateSetbacks(siteInfo)

      // 2. 推导面积
      const areas = await this.service.deriveAreas(projectParams)

      // 3. 生成UM表
      const umTable = await this.service.generateUMTable(areas.areas)

      // 4. 合规检查
      const compliance = await this.service.checkCompliance({
        ...siteInfo,
        ...areas,
        ...umTable
      })

      res.json({
        success: true,
        workflow: {
          setbacks: setbacks.setbacks,
          areas: areas.areas,
          um_table: umTable.um_table,
          compliance: compliance
        }
      })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

const controller = new BuildingLayoutController()

module.exports = {
  calculateSetbacks: (req, res) => controller.calculateSetbacks(req, res),
  deriveAreas: (req, res) => controller.deriveAreas(req, res),
  generateUMTable: (req, res) => controller.generateUMTable(req, res),
  checkCompliance: (req, res) => controller.checkCompliance(req, res),
  runFullWorkflow: (req, res) => controller.runFullWorkflow(req, res)
}
```

```javascript
// apps/api/src/routes/building-layout.js

const express = require('express')
const router = express.Router()
const BuildingLayoutController = require('../controllers/BuildingLayoutController')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

// 计算退距
router.post('/setbacks', BuildingLayoutController.calculateSetbacks)

// 推导面积
router.post('/areas', BuildingLayoutController.deriveAreas)

// 生成UM表
router.post('/um-table', BuildingLayoutController.generateUMTable)

// 合规检查
router.post('/compliance', BuildingLayoutController.checkCompliance)

// 完整工作流
router.post('/workflow', BuildingLayoutController.runFullWorkflow)

module.exports = router
```

---

### Phase 4: 知识图谱集成 (可选, 1-2天)

利用你现有的 knowledge_graph 系统建立规则之间的关系:

```sql
-- 在 knowledge_graph_nodes 中为规则创建节点
INSERT INTO knowledge_graph_nodes (id, document_id, entity_type, entity_name, properties)
SELECT
  gen_random_uuid()::text,
  source_document_id,
  'DesignRule',
  rule_name,
  jsonb_build_object(
    'rule_code', rule_code,
    'category', category_id,
    'confidence', confidence_score
  )
FROM design_rules
WHERE category_id IN ('layout_setback', 'layout_area', 'layout_um', 'layout_compliance');

-- 创建规则依赖关系
INSERT INTO knowledge_graph_relationships (id, source_node_id, target_node_id, relationship_type)
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM knowledge_graph_nodes WHERE properties->>'rule_code' = 'AREA-FAB-CLEANROOM-001'),
  (SELECT id FROM knowledge_graph_nodes WHERE properties->>'rule_code' = 'UM-POWER-FAB-001'),
  'PROVIDES_INPUT_TO';
```

---

## 🎯 对比: 新建表 vs 扩展现有表

### ❌ 方案A: 新建 building_layout_rules 表

**缺点:**
- ❌ 重复的审核流程
- ❌ 重复的版本管理
- ❌ 重复的使用统计
- ❌ 无法复用知识图谱
- ❌ 前端需要两套UI

### ✅ 方案B: 扩展 design_rules 表 (推荐)

**优点:**
- ✅ 复用现有审核流程 (review_status, confidence_score)
- ✅ 复用现有反馈学习 (usage_count, success_count)
- ✅ 复用知识图谱 (source_document_id, knowledge_graph)
- ✅ 统一规则管理UI
- ✅ 规则间可以建立关系 (rule_relationships表)
- ✅ 支持AI学习 (learned_from, extraction_method)

---

## 📊 实施效果预期

### 数据库层面
- ✅ 4个新的 rule_categories
- ✅ 使用现有的 design_rules 表 (无新表)
- ✅ 利用现有 knowledge_graph 建立规则关系

### 后端层面
- ✅ 1个新的 RuleEvaluationEngine (通用规则引擎)
- ✅ 1个新的 BuildingLayoutService
- ✅ 5个新的API端点

### 前端层面 (Phase 5+)
- ✅ 复用现有规则管理UI
- ✅ 新增强排工作流UI
- ✅ 新增UM表展示UI

---

## 🚀 下一步行动

如果你同意这个方案，我可以立即开始实施:

1. ✅ **立即执行**: 创建迁移文件 `20251112000000_add_building_layout_rule_types.js`
2. ✅ **立即执行**: 运行迁移，插入示例规则
3. ✅ **立即执行**: 创建 RuleEvaluationEngine.js
4. ✅ **立即执行**: 创建 BuildingLayoutService.js
5. ✅ **立即执行**: 创建 API 端点和路由

**预计时间**: 2-3小时完成Phase 1-3的核心代码

---

## 💡 关键优势

这个方案最大的优势是 **不破坏现有系统，完全增量式开发**:

1. ✅ assembly_rules 继续保留 (专用装配约束)
2. ✅ design_rules 成为统一规则基表 (所有类型规则)
3. ✅ knowledge_documents + knowledge_graph 成为规则知识库
4. ✅ 所有系统互相增强，而非互相冲突

---

**你觉得这个方案如何？如果同意，我立即开始编码实施。**
