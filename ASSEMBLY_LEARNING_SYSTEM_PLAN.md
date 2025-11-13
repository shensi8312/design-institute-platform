# 装配学习系统完整实施计划

## 🎯 目标
从PID图纸 + BOM + 历史装配数据自动学习，生成新PID的装配约束和布局方案

## 📊 系统架构评估

### ✅ 已实现 (2025-01-13)
1. **化学材料知识库** (`ChemicalKnowledgeBase.js`)
   - H2/O2/Cl2/HCl/NH3流体-材料兼容性
   - 密封类型推荐 (VCR/PTFE/橡胶)
   - 基础人体工程学 (阀门高度、维修空间)

2. **碰撞检测系统** (`CollisionDetector.js`)
   - AABB/OBB快速碰撞检测
   - 维修空间验证
   - 管路干涉检测
   - 自动避障策略

3. **布局优化引擎** (`LayoutOptimizationEngine.js`)
   - 7维度质量评估 (AQI)
   - 多目标优化 (Pareto排序)
   - 5种基础策略 + GA搜索

### ❌ 缺失关键组件
1. **机械工程知识库** - 螺纹标准、法兰规范、扭矩要求
2. **安全规范知识库** - 危险品隔离、应急通道、防爆区域
3. **成本数据库** - 实时单价、交期、库存、供应商
4. **标准件库** - Swagelok/Parker/Festo产品目录、3D模型
5. **物理属性库** - 密度、热膨胀、振动容限
6. **装配序列知识** - 先装后装顺序、工具需求
7. **242装配数据集成** - 10480个连接的学习数据
8. **嵌入式语义匹配** - 替代硬编码关键词，实现泛化

---

## 🗓️ 6周开发计划

### 第1周: 机械工程知识库 + 安全规范知识库
**分支**: `feat/mechanical-safety-kb`

#### 目标
- 机械工程知识 (螺纹、法兰、扭矩)
- 安全规范知识 (隔离距离、应急通道)

#### 交付物
```
apps/api/src/services/knowledge/
├── MechanicalEngineeringKB.js      # 机械工程知识库
│   ├── threadStandards              # GB/ANSI/ISO螺纹标准
│   ├── flangeStandards              # ASME/DIN法兰标准
│   ├── torqueSpecifications         # 扭矩-预紧力计算
│   ├── materialProperties           # 材料力学性能
│   └── validateMechanicalDesign()   # 机械设计验证
│
└── SafetyStandardsKB.js             # 安全规范知识库
    ├── hazardIsolationDistances     # 危险品隔离距离矩阵
    ├── emergencyCorridorRequirements # 应急通道宽度≥800mm
    ├── explosionProofZones          # 防爆区域划分
    ├── leakageAnalysis              # 泄漏扩散模型
    └── validateSafetyCompliance()   # 安全合规性检查
```

#### 技术要点
- GB/T 5796螺纹标准数据表
- ASME B16.5法兰压力等级-尺寸对照
- GB 6067爆炸危险环境电力装置设计规范
- 气体扩散计算模型 (Gaussian plume)

#### 验收标准
- [ ] 螺纹配对验证 (M8螺栓 ↔ M8螺母, 不能配M10)
- [ ] 法兰法兰标准匹配 (ANSI 150# ↔ ANSI 150#)
- [ ] 扭矩计算准确 (M8 @ 40Nm, M10 @ 68Nm)
- [ ] H2/O2危险品隔离≥2m
- [ ] 应急通道宽度≥800mm验证
- [ ] 全部单元测试通过

---

### 第2周: 成本数据库 + 标准件库
**分支**: `feat/cost-standard-parts-db`

#### 目标
- 零件选型7维决策引擎
- 标准件产品目录集成

#### 交付物
```
apps/api/src/services/cost/
├── CostDatabase.js                  # 成本数据库
│   ├── partPricing                  # 零件单价 (实时API)
│   ├── supplierLeadTime             # 供应商交期数据
│   ├── inventoryStatus              # 库存状态查询
│   ├── laborCost                    # 人工成本 (焊接/装配)
│   ├── transportCost                # 运输费用估算
│   └── calculateTotalCost()         # 总成本计算
│
└── PartSelectionEngine.js           # 零件选型引擎
    ├── functionalMatch              # 功能匹配 (必须)
    ├── costOptimization             # 成本优化 (30%)
    ├── leadTimeOptimization         # 交期优化 (25%)
    ├── inventoryPreference          # 库存优先 (20%)
    ├── reliabilityScore             # 可靠性评分 (15%)
    ├── standardizationBonus         # 标准化加分 (5%)
    ├── supplierRating               # 供应商评级 (5%)
    └── selectOptimalPart()          # 最优零件选择

apps/api/src/services/catalog/
└── StandardPartsCatalog.js          # 标准件库
    ├── swagelokCatalog              # Swagelok产品目录
    ├── parkerCatalog                # Parker产品目录
    ├── festoCatalog                 # Festo产品目录
    ├── gbStandards                  # GB国标件
    ├── isoStandards                 # ISO标准件
    ├── ansiStandards                # ANSI标准件
    ├── dinStandards                 # DIN标准件
    ├── part3DModels                 # 3D模型库 (STEP文件路径)
    ├── performanceParams            # 性能参数 (Cv值/耐压/温度)
    └── searchParts()                # 智能零件搜索
```

#### 数据源集成
- Swagelok API / CSV产品目录
- 本地ERP库存系统接口
- 供应商报价系统

#### 验收标准
- [ ] 成本计算准确 (材料+人工+运输)
- [ ] 零件选型7维评分正确
- [ ] 标准件搜索速度<100ms
- [ ] 产品目录覆盖>5000个零件
- [ ] 3D模型路径正确关联
- [ ] 全部单元测试通过

---

### 第3周: 242装配数据集成 + 嵌入式语义匹配
**分支**: `feat/242-data-embedding-integration`

#### 目标
- 集成242装配的10480个连接学习数据
- 替换硬编码关键词为嵌入式语义匹配

#### 交付物
```
apps/api/src/services/learning/
├── PartFeatureExtractor.js          # 零件特征提取器
│   ├── generateEmbedding()          # 生成语义嵌入向量
│   ├── findSimilarParts()           # 查找相似零件 (余弦相似度)
│   ├── inferPartType()              # 推断零件类型 (非关键词)
│   ├── extractPhysicalFeatures()    # 提取物理特征 (尺寸/材质)
│   └── areFunctionallySimilar()     # 判断功能相似性 (>0.8不配对)
│
├── Assembly242Learner.js            # 242装配学习器
│   ├── load242ConnectionData()      # 加载10480个连接
│   ├── extractGeometryPatterns()    # 提取几何约束模式
│   ├── learnDistanceDistributions() # 学习距离分布
│   ├── buildConstraintTemplates()   # 构建约束模板
│   └── inferConstraintForNewParts() # 为新零件推断约束
│
└── SemanticMatcher.js               # 语义匹配器
    ├── embeddingModel               # bge-large-zh-v1.5模型
    ├── partFeatureDB                # 零件特征数据库
    ├── matchBySemantics()           # 语义匹配 (非关键词)
    └── computeMatchScore()          # 计算匹配分数

scripts/
└── import_242_assembly_data.js      # 导入242数据到数据库
```

#### 技术要点
- 嵌入模型: `bge-large-zh-v1.5` (1024维向量)
- 向量数据库: Milvus / pgvector
- 余弦相似度阈值: >0.8 = 同类不配对, 0.3-0.6 = 互补配对
- 几何约束统计分析 (距离均值/方差、角度分布)

#### 数据结构
```javascript
// 242装配连接数据示例
{
  "part1": "VCR Male Connector 1/4\"",
  "part2": "VCR Gland 1/4\"",
  "constraint": {
    "type": "COINCIDENT",
    "entities": ["face_123", "face_456"],
    "distance": 0,
    "alignment": "ALIGNED"
  },
  "geometry": {
    "part1_bbox": { "x": 25, "y": 20, "z": 30 },
    "part2_bbox": { "x": 15, "y": 15, "z": 10 },
    "relative_position": { "dx": 0, "dy": 0, "dz": 30 }
  }
}
```

#### 验收标准
- [ ] 242数据导入成功 (10480条)
- [ ] 嵌入模型部署并可调用
- [ ] 语义匹配替代所有硬编码关键词
- [ ] M8螺栓能泛化推断M10螺栓行为
- [ ] "Screw ↔ Assembled Screw" 错误消除 (同类不配对)
- [ ] 约束推断准确率>85%
- [ ] 全部单元测试通过

---

### 第4周: LLM深度集成 + 推理增强
**分支**: `feat/llm-reasoning-integration`

#### 目标
- LLM 3大核心作用集成
- 约束推理智能化

#### 交付物
```
apps/api/src/services/ai/
├── LLMService.js                    # LLM服务封装
│   ├── qwenVLModel                  # qwen-vl-72b模型
│   ├── deepseekModel                # deepseek-r1模型
│   ├── callLLM()                    # 通用LLM调用
│   └── parseStructuredOutput()      # 解析结构化输出
│
├── PartUnderstandingAgent.js        # 零件理解代理
│   ├── extractPartFeatures()        # 提取零件特征 (LLM理解)
│   ├── inferPartFunction()          # 推断零件功能
│   ├── identifyMatingFeatures()     # 识别配合特征
│   └── explainPartPurpose()         # 解释零件用途
│
├── ConstraintReasoningAgent.js      # 约束推理代理
│   ├── reasonPhysicalConstraints()  # 推理物理约束
│   ├── reasonChemicalConstraints()  # 推理化学约束
│   ├── reasonSafetyConstraints()    # 推理安全约束
│   ├── explainConstraintReason()    # 解释约束原因
│   └── suggestAlternatives()        # 建议替代方案
│
└── SolutionExplainerAgent.js        # 方案解释代理
    ├── generateSolutionReport()     # 生成方案报告
    ├── explainScoreDifferences()    # 解释评分差异
    ├── highlightTradeoffs()         # 突出权衡点
    └── provideRecommendation()      # 提供推荐理由
```

#### LLM Prompt设计
```
角色: 你是资深工艺工程师，精通管路系统装配设计

任务: 分析零件 {partName} 和 {partName2} 的装配约束

已知信息:
- 零件1: {part1_features}
- 零件2: {part2_features}
- 流体类型: {fluidType}
- 压力等级: {pressure}bar
- 历史装配数据: {similar_cases}

请推理:
1. 两者是否应该配对？(考虑功能互补性)
2. 应该使用什么约束类型？(COINCIDENT/CONCENTRIC/DISTANCE等)
3. 约束参数是多少？(距离/角度等)
4. 是否有特殊要求？(材料兼容性/密封类型/扭矩)

输出JSON格式:
{
  "should_mate": true/false,
  "constraint_type": "...",
  "parameters": {...},
  "reasoning": "..."
}
```

#### 验收标准
- [ ] LLM服务稳定调用 (超时<5s)
- [ ] 零件理解准确率>90%
- [ ] 约束推理准确率>85%
- [ ] 方案解释可读性高 (人工评审)
- [ ] Fallback机制 (LLM失败时用规则)
- [ ] 全部单元测试通过

---

### 第5周: 前端API集成 + 3D可视化
**分支**: `feat/frontend-api-visualization`

#### 目标
- 前端调用主流程 `/api/assembly/infer`
- 3D装配可视化

#### 交付物
```
apps/web/src/pages/
└── AssemblyInference.tsx            # 装配推理页面
    ├── PIDUpload                    # PID图纸上传
    ├── BOMUpload                    # BOM上传
    ├── InferenceProgress            # 推理进度条
    ├── SolutionComparison           # 方案对比表格
    ├── 3DVisualization              # 3D装配预览
    └── ExportButtons                # 导出BOM/STEP/约束文件

apps/web/src/components/assembly/
├── Solution3DViewer.tsx             # 3D查看器 (Three.js)
├── ComparisonTable.tsx              # 方案对比表
├── ConstraintList.tsx               # 约束列表
├── WeightAdjuster.tsx               # 优化目标权重调节
└── FeedbackPanel.tsx                # 反馈面板

apps/api/src/routes/
└── assembly.js
    ├── POST /api/assembly/infer     # 主推理接口
    │   ├── 输入: {pid_id, bom_id, preferences}
    │   └── 输出: {solutions[5-15], recommended, comparison}
    ├── GET /api/assembly/solution/:id/3d  # 获取3D数据
    └── POST /api/assembly/feedback  # 反馈接口
```

#### API设计
```javascript
// POST /api/assembly/infer
{
  "pid_id": "uuid",
  "bom_data": [...],
  "preferences": {
    "optimize_for": "cost", // cost|safety|performance|balanced
    "max_solutions": 10,
    "constraints": {
      "max_cost": 50000,
      "space_envelope": {"x": 2000, "y": 1500, "z": 2500},
      "fixed_interfaces": [...]
    }
  }
}

// Response
{
  "solutions": [
    {
      "id": "sol_001",
      "rank": 1,
      "is_recommended": true,
      "overall_score": 0.87,
      "detailed_scores": {
        "cost": 0.85,
        "safety": 0.92,
        "performance": 0.88,
        "maintainability": 0.84,
        ...
      },
      "placements": [...],
      "constraints": [...],
      "bom": [...],
      "warnings": [...],
      "explanation": "该方案采用紧凑单层布局..."
    }
  ],
  "comparison": {
    "best_cost": "sol_003",
    "best_safety": "sol_001",
    "best_performance": "sol_005"
  }
}
```

#### 验收标准
- [ ] 前端成功调用 `/api/assembly/infer`
- [ ] 3D可视化正确显示装配 (零件位置/约束)
- [ ] 方案对比表显示7维度评分
- [ ] 权重调节实时更新推荐
- [ ] 反馈提交成功保存
- [ ] 响应时间<10s (复杂装配)
- [ ] 全部集成测试通过

---

### 第6周: 学习循环 + 生产部署
**分支**: `feat/learning-loop-deployment`

#### 目标
- 3阶段学习循环
- 生产环境部署

#### 交付物
```
apps/api/src/services/learning/
├── OfflineLearner.js                # 离线学习器
│   ├── learn242AssemblyData()       # 从242数据学习
│   ├── learnHistoricalPIDs()        # 从历史10套PID学习
│   ├── buildConstraintLibrary()     # 构建约束库
│   └── exportLearnedRules()         # 导出学习规则
│
├── OnlineLearner.js                 # 在线学习器
│   ├── collectUserFeedback()        # 收集用户反馈
│   ├── recordSelection()            # 记录方案选择
│   ├── recordAdjustment()           # 记录手动调整
│   ├── updateConstraintWeights()    # 更新约束权重
│   └── retrainModels()              # 增量重训练模型
│
└── ActiveLearner.js                 # 主动学习器
    ├── detectLowConfidence()        # 检测低置信度情况
    ├── generateExpertQuery()        # 生成专家咨询
    ├── collectExpertAnnotation()    # 收集专家标注
    └── integrateExpertKnowledge()   # 集成专家知识

scripts/
├── offline_training.js              # 离线训练脚本
└── deploy_production.sh             # 生产部署脚本

deployment/
├── docker-compose.prod.yml          # 生产Docker配置
├── nginx.conf                       # Nginx配置
└── monitoring/
    ├── prometheus.yml               # 监控配置
    └── grafana-dashboards/          # Grafana仪表盘
```

#### 学习循环流程
```
1. 离线学习 (每周执行)
   - 从242装配数据提取10480个约束
   - 从10套历史PID提取零件配对模式
   - 训练嵌入模型和约束预测模型
   - 更新知识库

2. 在线学习 (实时)
   - 用户选择方案 → 记录选择偏好
   - 用户调整布局 → 记录调整量
   - 用户标注错误 → 标记错误样本
   - 每100条反馈 → 增量更新模型

3. 主动学习 (按需)
   - 检测置信度<0.7的情况
   - 生成专家咨询界面
   - 专家标注正确约束
   - 集成到训练集
```

#### 生产部署
- Docker容器化部署
- Nginx反向代理 + SSL
- Redis缓存 (嵌入向量、零件特征)
- PostgreSQL主数据库
- Milvus向量数据库
- Prometheus + Grafana监控
- 日志聚合 (ELK Stack)

#### 验收标准
- [ ] 离线学习成功运行
- [ ] 在线反馈正确保存
- [ ] 主动学习界面可用
- [ ] 模型增量更新成功
- [ ] 生产环境稳定运行 (99.9%可用性)
- [ ] 监控指标正常
- [ ] 负载测试通过 (100并发用户)

---

## 📦 最终交付清单

### 知识库 (6个)
- [x] ChemicalKnowledgeBase.js - 化学材料知识
- [ ] MechanicalEngineeringKB.js - 机械工程知识
- [ ] SafetyStandardsKB.js - 安全规范知识
- [ ] CostDatabase.js - 成本数据
- [ ] StandardPartsCatalog.js - 标准件库
- [ ] PartFeatureExtractor.js - 零件特征提取 (语义嵌入)

### 检测与优化 (3个)
- [x] CollisionDetector.js - 碰撞检测
- [x] LayoutOptimizationEngine.js - 布局优化
- [ ] MultiObjectiveOptimizer.js - 多目标优化 (完善)

### 学习系统 (4个)
- [ ] Assembly242Learner.js - 242装配学习
- [ ] SemanticMatcher.js - 语义匹配器
- [ ] OfflineLearner.js - 离线学习
- [ ] OnlineLearner.js / ActiveLearner.js - 在线/主动学习

### LLM集成 (3个)
- [ ] LLMService.js - LLM服务封装
- [ ] PartUnderstandingAgent.js - 零件理解
- [ ] ConstraintReasoningAgent.js - 约束推理
- [ ] SolutionExplainerAgent.js - 方案解释

### 前端 (1个完整页面)
- [ ] AssemblyInference.tsx - 装配推理主页面
  - PID/BOM上传
  - 方案对比表
  - 3D可视化
  - 反馈收集

### API (3个核心接口)
- [ ] POST /api/assembly/infer - 主推理接口
- [ ] GET /api/assembly/solution/:id/3d - 3D数据
- [ ] POST /api/assembly/feedback - 反馈接口

---

## 🔢 量化指标

### 系统性能
- 推理速度: <10s (中等复杂度装配)
- 方案生成: 5-15个候选方案 (自适应)
- 并发支持: 100用户

### 学习效果
- 约束推断准确率: >85%
- 零件分类准确率: >90%
- 成本预测误差: <15%

### 用户体验
- 系统可用性: 99.9%
- 界面响应: <500ms
- 3D加载: <2s

---

## 🚀 开发流程

每个feature分支:
1. Checkout分支
2. 开发功能
3. 编写单元测试 (覆盖率>80%)
4. 本地测试通过
5. 提交PR
6. Code Review
7. 合并到main

---

## 🛠️ 技术栈

### 后端
- Node.js 18+
- Express.js
- Knex.js (PostgreSQL)
- Jest (测试)

### AI/ML
- bge-large-zh-v1.5 (嵌入模型)
- qwen-vl-72b (多模态LLM)
- deepseek-r1 (推理LLM)
- Milvus (向量数据库)

### 前端
- React 18
- TypeScript
- Three.js (3D可视化)
- Ant Design

### 部署
- Docker + Docker Compose
- Nginx
- Redis
- Prometheus + Grafana

---

## ⚠️ 风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| LLM服务不稳定 | Fallback到基于规则的推理 |
| 242数据质量差 | 人工审核+清洗脚本 |
| 嵌入模型性能差 | 尝试多个模型，选择最优 |
| 3D渲染性能差 | LOD优化+分批加载 |
| 成本API不可用 | 使用缓存数据+定期同步 |

---

**开始日期**: 2025-01-13
**预计完成**: 2025-02-24 (6周)
**负责人**: Claude Code + 用户
