# 装配约束推理引擎 (Assembly Constraint Reasoning Engine)

## 🎯 功能概述

装配约束推理引擎是一个基于规则的智能推理系统，能够从BOM表和工程图纸中自动推理出机械装配约束关系，并生成可供SolidWorks执行的装配指令。

### 核心功能
- ✅ **BOM解析**: 支持Excel/CSV格式，自动识别零件名称、编号、规格
- ✅ **标准件识别**: 内置Swagelok、GB/T标准件库，自动匹配螺纹规格
- ✅ **规则推理**: 5大核心规则(VCR同轴、螺纹连接、法兰接触、螺栓-螺母、卡套)
- ✅ **LLM增强**: 可选LLM理解零件描述，提高识别准确率
- ✅ **置信度评分**: 每个约束带置信度分数，便于人工审核
- ✅ **可解释性**: 完整推理路径和触发规则记录
- ✅ **SolidWorks集成**: 导出JSON格式，供SolidWorks插件执行

## 🏗️ 架构设计

### MVP (P0阶段) - 当前版本
- **推理方式**: 基于规则的模式匹配
- **求解器**: 纯代数规则，无需额外依赖
- **性能**: 毫秒级响应
- **适用场景**: 标准件装配、简单机械连接

### P1阶段 (计划中)
- **求解器**: scipy.optimize
- **功能**: 2-3个变量的优化问题求解
- **安装**: `pip install scipy numpy`

### P2阶段 (未来)
- **求解器**: CVXPY / OR-Tools
- **功能**: 复杂多变量全局优化
- **安装**: `pip install cvxpy ortools`

## 📝 使用指南

### 1. 准备BOM文件

**Excel格式示例**:
| 零件名称 | 零件号 | 数量 | 规格 | 描述 |
|---------|--------|------|------|------|
| VCR接头A | VCR-4-VS-2 | 2 | 1/4" | Swagelok VCR接头 |
| 螺栓 | GB/T 70.1-M8 | 4 | M8x1.25 | 六角头螺栓 |
| 螺母 | GB/T 6170-M8 | 4 | M8x1.25 | 六角螺母 |
| 法兰A | - | 1 | DN50 | 不锈钢法兰 |

**支持的列名**:
- 中文: 零件名称, 零件号, 数量, 规格, 描述
- 英文: Part Name, Part Number, Quantity, Spec, Description

### 2. 前端操作

1. 登录系统 → AI工具 → 装配约束推理引擎
2. 上传BOM文件 (必选)
3. 上传工程图纸 (可选, PDF/DWG格式)
4. 点击"开始推理"
5. 查看推理结果和置信度
6. 导出JSON文件供SolidWorks使用

### 3. API调用

```bash
# 获取token
TOKEN="your-jwt-token"

# 调用推理接口
curl -X POST http://localhost:3000/api/assembly/infer \
  -H "Authorization: Bearer $TOKEN" \
  -F "bom=@path/to/bom.xlsx" \
  -F "drawings=@path/to/drawing1.pdf" \
  -F "drawings=@path/to/drawing2.pdf"
```

**响应格式**:
```json
{
  "success": true,
  "constraints": [
    {
      "id": "uuid",
      "type": "CONCENTRIC",
      "entities": ["零件A", "零件B"],
      "parameters": { "alignment": "ALIGNED" },
      "confidence": 1.0,
      "reasoning": "推理依据说明",
      "ruleId": "R1"
    }
  ],
  "explainability": {
    "reasoning_path": ["步骤1: ...", "步骤2: ..."],
    "rules_fired": ["规则1", "规则2"]
  },
  "metadata": {
    "partsCount": 6,
    "constraintsCount": 3,
    "rulesApplied": 3,
    "llmEnhanced": true
  }
}
```

### 4. SolidWorks集成

1. 导出JSON文件 (点击"导出到SolidWorks"按钮)
2. 打开SolidWorks装配体
3. 运行MST AI Architect插件
4. 选择"装配约束推理" → "加载约束文件"
5. 选择导出的JSON文件
6. 插件自动执行装配

**SolidWorks API映射**:
- `CONCENTRIC` → `swMateCONCENTRIC`
- `SCREW` → `swMateSCREW`
- `DISTANCE` → `swMateDISTANCE`
- `COINCIDENT` → `swMateCOINCIDENT`
- `PARALLEL` → `swMatePARALLEL`
- `PERPENDICULAR` → `swMatePERPENDICULAR`

## 🔧 配置说明

### 环境变量 (.env)
```bash
# 启用LLM增强 (可选)
ASSEMBLY_USE_LLM=true

# 求解器级别 (P0/P1/P2)
ASSEMBLY_SOLVER_LEVEL=P0

# LLM配置 (如果启用LLM)
LLM_PROVIDER=vllm
VLLM_URL=http://10.10.18.3:8000
VLLM_MODEL=/mnt/data/models/Qwen3-32B
```

### 标准件库扩展

编辑 `apps/api/src/services/assembly/AssemblyReasoningService.js`:

```javascript
this.standardParts = {
  'VCR-4-VS-2': {
    type: 'VCR接头',
    thread: 'M12x1.5',
    sealing: 'VCR金属密封'
  },
  // 添加新标准件...
}
```

### 规则库扩展

```javascript
this.rules.push({
  id: 'R6',
  name: '新规则名称',
  priority: 9,
  condition: (partA, partB) => {
    // 匹配条件
    return partA.type === 'XXX' && partB.type === 'YYY'
  },
  action: (partA, partB) => ({
    type: 'CONSTRAINT_TYPE',
    entities: [partA.name, partB.name],
    parameters: { /* 约束参数 */ },
    reasoning: '推理说明'
  })
})
```

## 📊 测试用例

### 基础测试

```bash
# 创建测试BOM
node -e "
const XLSX = require('xlsx');
const data = [
  ['零件名称', '零件号', '数量', '规格', '描述'],
  ['VCR接头A', 'VCR-4-VS-2', 2, '1/4\"', 'Swagelok VCR接头'],
  ['VCR接头B', 'VCR-4-VS-2', 2, '1/4\"', 'Swagelok VCR接头']
];
const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'BOM');
XLSX.writeFile(wb, '/tmp/test_bom.xlsx');
"

# 测试API
curl -X POST http://localhost:3000/api/assembly/infer \
  -H "Authorization: Bearer $TOKEN" \
  -F "bom=@/tmp/test_bom.xlsx"
```

### 预期结果

✅ **成功案例**:
- VCR接头A + VCR接头B → CONCENTRIC (同轴约束)
- 螺栓 + 螺母 (相同螺纹) → SCREW (螺纹副)
- 法兰A + 法兰B → COINCIDENT (面接触)

❌ **失败案例**:
- 缺少BOM文件 → 400错误
- BOM格式错误 → "BOM文件格式错误"
- 无匹配规则 → 返回空约束列表

## 🚀 部署指南

### 本地开发

```bash
# 安装依赖
cd apps/api
npm install

# 启动服务
npm start

# 访问前端
cd apps/web
npm run dev
# 浏览器打开 http://localhost:8000
```

### 生产环境

```bash
# 构建前端
cd apps/web
npm run build

# 启动API (PM2)
cd apps/api
pm2 start src/app.js --name "api"

# Nginx反向代理
# 配置见 apps/web/nginx.conf
```

## 🐛 常见问题

### Q1: 推理结果为空
**A**: 检查BOM是否包含标准件，或启用LLM增强识别

### Q2: LLM增强失败
**A**: 检查`.env`中`LLM_PROVIDER`配置，确保LLM服务可访问

### Q3: SolidWorks插件无法加载JSON
**A**: 确保JSON格式正确，检查`mates`字段是否存在

### Q4: 置信度偏低
**A**: 补充标准件库，或优化规则匹配条件

## 📈 性能指标

- **BOM解析**: <50ms (6个零件)
- **规则推理**: <100ms (3条规则)
- **总响应时间**: <1s (不含LLM), <5s (含LLM)

## 🔗 相关文档

- [装配约束推理引擎设计文档](./docs/装配约束推理引擎设计.md)
- [求解器选型与实施方案](./docs/装配约束求解器选型.md)
- [SolidWorks集成架构](./docs/轻量级架构-平台推理+SW落图.md)

## 📦 依赖清单

```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "uuid": "^9.0.1",
    "multer": "^1.4.5-lts.1"
  },
  "optionalDependencies": {
    "scipy": "P1阶段需要",
    "cvxpy": "P2阶段需要"
  }
}
```

## 📝 更新日志

### v1.0.0 (2025-10-29)
- ✅ 完成P0 MVP版本
- ✅ 支持5大核心规则
- ✅ 集成LLM增强识别
- ✅ 实现前端UI
- ✅ SolidWorks JSON导出

### 后续计划
- [ ] P1: scipy求解器集成
- [ ] P2: 复杂约束优化
- [ ] 数据库持久化规则
- [ ] 在线学习与反馈机制
