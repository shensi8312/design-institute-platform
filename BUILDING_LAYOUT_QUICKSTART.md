# 建筑强排系统 - 快速开始

## ✅ 已完成

建筑强排系统已成功实现并集成到现有的 `design_rules` 统一规则框架！

## 📋 系统组件

### 1. 数据库层
- ✅ 4个新规则分类（退距/面积/能耗/合规）
- ✅ 8条示例规则已创建
- ✅ 迁移文件：`20251112000000_add_building_layout_rule_types.js`

### 2. 后端服务
- ✅ **DesignRulesRepository** - 规则数据访问层
- ✅ **RuleEvaluationEngine** - 通用规则评估引擎
- ✅ **BuildingLayoutService** - 建筑强排核心服务
- ✅ **BuildingLayoutController** - HTTP 控制器
- ✅ **Routes** - RESTful API 端点

## 🚀 启动步骤

### 1. 运行数据库迁移

```bash
cd apps/api
npm run migrate
```

这将创建规则分类和示例规则。

### 2. 启动后端服务

```bash
cd apps/api
npm run dev
```

### 3. 测试 API

获取使用示例：
```bash
curl http://localhost:3000/api/building-layout/example
```

## 📡 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/building-layout/setbacks` | POST | 计算红线退距 |
| `/api/building-layout/areas` | POST | 推导建筑面积 |
| `/api/building-layout/um-table` | POST | 生成UM表（能耗） |
| `/api/building-layout/compliance` | POST | 合规检查 |
| `/api/building-layout/workflow` | POST | 完整工作流 |
| `/api/building-layout/rules-summary` | GET | 获取可用规则 |
| `/api/building-layout/example` | GET | 获取API示例 |

## 🎯 使用示例

### 完整工作流调用

```bash
curl -X POST http://localhost:3000/api/building-layout/workflow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "siteInfo": {
      "building_height": 30,
      "building_type": "fab",
      "boundaries": [
        {
          "id": "b1",
          "name": "东侧-高速公路",
          "type": "expressway"
        },
        {
          "id": "b2",
          "name": "南侧-主干道",
          "type": "main_road"
        }
      ],
      "spacing": 15,
      "fire_resistance_rating": 2
    },
    "projectParams": {
      "chips_per_month": 10000,
      "process_type": "semiconductor_fab",
      "technology_node": "28nm"
    }
  }'
```

### 预期响应

```json
{
  "success": true,
  "workflow": {
    "setbacks": [
      {
        "boundary_id": "b1",
        "boundary_type": "expressway",
        "required_distance": 60,
        "unit": "meters",
        "applied_rule": {
          "rule_code": "SETBACK-EXPRESSWAY-001",
          "rule_name": "高速公路红线退距"
        }
      },
      {
        "boundary_id": "b2",
        "boundary_type": "main_road",
        "required_distance": 30,
        "unit": "meters"
      }
    ],
    "areas": {
      "cleanroom": {
        "value": 26000,
        "unit": "square_meters",
        "formula": "chips_per_month * 2.5 + 1000"
      },
      "office": {
        "value": 7800,
        "unit": "square_meters",
        "formula": "cleanroom_area * 0.3"
      },
      "warehouse": {
        "value": 3900,
        "unit": "square_meters",
        "formula": "cleanroom_area * 0.15"
      }
    },
    "total_building_area": 37700,
    "um_table": {
      "power": {
        "value": 21434400,
        "unit": "watts"
      },
      "cooling": {
        "value": 15916500,
        "unit": "watts"
      }
    },
    "compliance": {
      "compliant": true,
      "checks": [],
      "violations": []
    }
  }
}
```

## 📊 示例规则

系统已预装8条示例规则：

### 退距规则
1. **SETBACK-EXPRESSWAY-001** - 高速公路退距50m，超24m高增加10m
2. **SETBACK-MAINROAD-001** - 主干道退距30m

### 面积推导规则
3. **AREA-FAB-CLEANROOM-001** - 洁净室面积 = 月产能×2.5 + 1000
4. **AREA-FAB-OFFICE-001** - 办公区面积 = 洁净室×0.3
5. **AREA-FAB-WAREHOUSE-001** - 仓库面积 = 洁净室×0.15

### 能耗规则
6. **UM-POWER-FAB-001** - 电力负荷计算（800W/m² 洁净室）
7. **UM-COOLING-FAB-001** - 冷量需求计算（500W/m² 洁净室）

### 合规规则
8. **COMPLIANCE-FIRE-SPACING-001** - 防火间距检查（GB50016-2014）

## 🔧 规则管理

### 添加新规则

通过统一规则管理接口添加：

```bash
POST /api/rules
{
  "category_id": "layout_setback",
  "rule_code": "SETBACK-RIVER-001",
  "rule_name": "河流红线退距",
  "rule_content": "建筑与河流红线退距不小于20米",
  "rule_type": "building",
  "rule_structure": {
    "meta": {
      "rule_type": "layout_setback",
      "version": "1.0"
    },
    "scope": {
      "boundary_type": "river"
    },
    "rule": {
      "base_distance": 20,
      "unit": "meters",
      "conditions": []
    }
  }
}
```

### 查看规则统计

```bash
GET /api/building-layout/rules-summary
```

## 🎓 规则 JSON Schema

### 退距规则结构

```javascript
{
  "meta": {
    "rule_type": "layout_setback",
    "version": "1.0"
  },
  "scope": {
    "boundary_type": "expressway",  // 边界类型
    "building_types": ["fab"]       // 适用建筑类型
  },
  "rule": {
    "base_distance": 50,            // 基础退距
    "unit": "meters",
    "conditions": [                 // 调整条件
      {
        "condition_type": "building_height",
        "operator": ">",
        "threshold": 24,
        "adjustment": 10            // 超过阈值增加的退距
      }
    ]
  }
}
```

### 面积规则结构

```javascript
{
  "meta": {
    "rule_type": "layout_area",
    "facility_type": "fab"
  },
  "scope": {
    "process_type": "semiconductor_fab",
    "technology_node": ["28nm", "14nm"]
  },
  "rule": {
    "target_area": "cleanroom",     // 目标面积类型
    "dependencies": ["chips_per_month"],  // 依赖参数
    "formula": {
      "expression": "chips_per_month * 2.5 + 1000"
    },
    "constraints": {
      "min_area": 500,
      "max_area": 50000,
      "multiple_of": 100            // 面积必须是100的倍数
    }
  }
}
```

## 📈 下一步开发

### Phase 2: 几何处理（未实现）
- DXF/SHP 场地解析
- 红线偏移算法
- 建筑轮廓生成

### Phase 3: 优化求解（未实现）
- OR-Tools CP-SAT 集成
- 多目标优化
- 布局方案生成

### Phase 4: 前端界面（未实现）
- 规则管理UI
- 强排工作流界面
- 可视化结果展示

## 🔗 相关文档

- [完整集成方案](./BUILDING_LAYOUT_INTEGRATION_PLAN.md)
- [API文档](./apps/api/src/routes/building-layout.js)
- [规则评估引擎](./apps/api/src/services/rules/RuleEvaluationEngine.js)
- [建筑强排服务](./apps/api/src/services/building/BuildingLayoutService.js)

## 💡 技术亮点

1. **统一规则基表** - 复用 design_rules，支持多种规则类型
2. **规则依赖链** - 自动识别依赖关系，多轮评估
3. **安全表达式计算** - 使用 Function 构造器，避免 eval
4. **规则使用统计** - 自动跟踪规则应用次数和成功率
5. **知识图谱集成** - 规则可关联源文档和知识图谱

## ❓ 问题排查

### 迁移失败
```bash
# 检查数据库连接
psql -h localhost -p 5433 -U postgres -d design_platform

# 手动运行迁移
cd apps/api
npm run migrate
```

### API 404错误
- 确认后端服务已启动
- 检查 app.js 中路由已注册
- 验证 JWT token 有效

### 规则评估失败
- 检查规则 JSON 结构是否正确
- 验证输入参数是否包含所有依赖
- 查看后端日志中的错误信息

---

**✅ 系统已就绪！开始使用建筑强排系统吧！**
