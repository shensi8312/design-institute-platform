# 🤖 AI自动装配系统 - 流程诊断和改进方案

**创建时间**: 2025-11-11
**系统版本**: v1.0

---

## 📊 当前系统架构

### 完整流程（5个阶段）

```
用户上传          AI处理                人工审核              AI装配              导出结果
   ↓               ↓                      ↓                    ↓                   ↓
┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌────────┐
│ PID图纸  │ → │ PID识别   │ → │ 约束推理 │ → │ 人工审核 │ → │ 自动装配  │ → │ 3D模型  │
│  (PDF)  │   │  (OCR)   │   │ (AI推理) │   │ (确认)  │   │(规则匹配)│   │  (STEP) │
└─────────┘   └──────────┘   └─────────┘   └─────────┘   └──────────┘   └────────┘
                    ↓
               ┌──────────────┐
               │  规则管理库   │  ← 样本学习（BOM + 图纸）
               │ (学习到的规则) │
               └──────────────┘
```

---

## ✅ 已实现的核心模块

### 1. 后端服务（Python + Node.js）

#### PID识别模块
- `PIDRecognitionService.py` - PID图纸识别（OpenCV + OCR）
- `PIDRecognitionVLService.js` - 视觉语言模型识别
- `VisionLLMService.js` - LLM视觉服务
- `PIDGraphAnalyzer.py` - PID图结构分析

#### 装配推理模块
- `AssemblyReasoningService.js` - 装配推理引擎
- `RuleBasedAssemblyGenerator.js` - 基于规则的装配生成
- `PhysicalConstraintEngine.py` - 物理约束引擎
- `ConstraintRuleLearner.py` - 约束规则学习器

#### 规则学习模块
- `learn_assembly_rules.py` - 从STEP装配体学习规则
- `PartLibraryBuilder.py` - 零件库构建
- `FeedbackLearningService.js` - 反馈学习服务

#### 装配生成模块
- `PIDtoAssemblyPipeline.py` - 完整流程管道
- `freecad_assembly_generator.py` - FreeCAD装配生成
- `SolidWorksIntegrationService.py` - SolidWorks集成
- `Assembly3DService.js` - 3D装配服务

### 2. 前端页面（React + TypeScript）

```
/mechanical-design/
├── pid-recognition           # PID识别页面
├── assembly-constraint       # 约束推理页面
├── assembly-tasks            # 人工审核页面
├── assembly-rules            # 规则管理页面
└── assembly-designs          # 自动装配页面
```

### 3. 测试脚本

```bash
scripts/test/
├── test_pid_recognize_with_connections.sh    # PID识别测试
├── test_pid_to_assembly_complete.sh         # 完整流程测试
└── test_full_flow.sh                        # 端到端测试
```

---

## 🔍 流程诊断

### 测试1：PID识别是否工作？

```bash
# 测试PID识别API
curl -X POST "http://localhost:3000/api/pid/recognize?method=qwenvl" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@your-pid-file.pdf"

# 预期结果
{
  "success": true,
  "data": {
    "components": [...],  // 识别到的组件
    "connections": [...]  // 连接关系
  }
}
```

**可能的问题**：
- ❌ OCR服务未启动
- ❌ QwenVL模型未配置
- ❌ PDF解析失败

---

### 测试2：约束推理是否工作？

```bash
# 测试约束推理API
curl -X POST http://localhost:3000/api/assembly/infer-constraints \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pid_data": {...},
    "bom_data": {...}
  }'

# 预期结果
{
  "success": true,
  "data": {
    "constraints": [...],  // 推理出的约束
    "confidence": 0.85
  }
}
```

**可能的问题**：
- ❌ 规则库为空
- ❌ AI推理服务未启动
- ❌ BOM格式不正确

---

### 测试3：规则学习是否工作？

```bash
# 测试样本学习
python apps/api/src/services/assembly/learn_assembly_rules.py \
  --step-file assembly.step \
  --output rules_learned.json

# 预期结果
{
  "parts": 25,
  "connections": 48,
  "rules": [
    {
      "type": "mate",
      "confidence": 0.92,
      "pattern": "flange_to_flange"
    }
  ]
}
```

**可能的问题**：
- ❌ PythonOCC未安装
- ❌ STEP文件格式不支持
- ❌ 规则库数据库未连接

---

### 测试4：自动装配是否工作？

```bash
# 测试自动装配生成
curl -X POST http://localhost:3000/api/assembly/generate-from-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pid_data": {...},
    "catalog_version": "v1.0"
  }'

# 预期结果
{
  "success": true,
  "assembly": {
    "parts": [...],
    "constraints": [...],
    "step_file_url": "..."
  }
}
```

**可能的问题**：
- ❌ 零件库为空
- ❌ 物理约束验证失败
- ❌ 3D生成服务未启动

---

## 🔧 可能的问题和解决方案

### 问题1：规则库为空

**现象**：上传PID后无法生成装配

**原因**：没有样本数据供系统学习

**解决方案**：

#### 方案A：手动导入样本规则
```sql
-- 插入基础装配规则
INSERT INTO design_rules (type, name, pattern, confidence) VALUES
  ('assembly', 'flange_connection', {...}, 0.9),
  ('assembly', 'bolt_fastening', {...}, 0.85);
```

#### 方案B：从STEP文件学习
```bash
# 批量学习STEP装配文件
python scripts/batch_learn_assembly_rules.py \
  --input-dir docs/solidworks/assemblies/ \
  --output rules_database.json
```

#### 方案C：创建前端样本学习页面 ⭐ **推荐**
```
新建页面：/mechanical-design/sample-learning
功能：
1. 上传BOM Excel
2. 上传零件图（多个PDF）
3. 上传组装图（STEP文件）
4. AI自动学习装配规则
5. 显示学习结果和置信度
```

---

### 问题2：PID识别准确率低

**现象**：识别到的组件不完整或错误

**原因**：
- 图纸质量差（扫描件、模糊）
- 符号库不完整
- OCR错误率高

**解决方案**：

#### 图像预处理
```python
# 增强图像质量
from PIL import Image, ImageEnhance

def preprocess_pid_image(image_path):
    img = Image.open(image_path)

    # 提高对比度
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    # 去噪
    img = img.filter(ImageFilter.MedianFilter(size=3))

    # 二值化
    img = img.convert('L')
    threshold = 180
    img = img.point(lambda x: 255 if x > threshold else 0)

    return img
```

#### 符号库扩充
```javascript
// 添加更多PID符号模板
const pidSymbols = {
  'valve': [...],
  'pump': [...],
  'tank': [...],
  'heat_exchanger': [...],
  // 添加更多...
};
```

---

### 问题3：物理约束冲突

**现象**：生成的装配不符合物理规律

**原因**：
- 约束冲突（过约束/欠约束）
- 零件尺寸不匹配
- 管道长度/角度不合理

**解决方案**：

#### 约束验证
```python
# PhysicalConstraintEngine.py
def validate_constraints(assembly):
    errors = []

    # 检查管道长度
    for conn in assembly['connections']:
        distance = calc_distance(conn['part1'], conn['part2'])
        if distance > MAX_PIPE_LENGTH:
            errors.append(f"管道过长: {distance}m")

    # 检查角度约束
    for angle in assembly['angles']:
        if not (0 <= angle <= 180):
            errors.append(f"无效角度: {angle}°")

    return errors
```

---

### 问题4：前端流程不连贯

**现象**：各个页面独立，用户不知道下一步做什么

**解决方案**：创建统一的工作流引导页面

#### 新建组件：`WorkflowGuide.tsx`
```typescript
const steps = [
  {
    title: "样本学习（首次使用）",
    status: "optional",
    action: "前往样本学习",
    path: "/sample-learning"
  },
  {
    title: "1. 上传PID图纸",
    status: "required",
    action: "开始识别",
    path: "/pid-recognition"
  },
  {
    title: "2. 查看约束推理",
    status: "auto",
    info: "系统自动推理，无需操作"
  },
  {
    title: "3. 人工审核",
    status: "required",
    action: "审核任务",
    path: "/assembly-tasks"
  },
  {
    title: "4. 自动装配",
    status: "auto",
    action: "生成装配",
    path: "/assembly-designs"
  },
  {
    title: "5. 导出结果",
    status: "required",
    action: "下载STEP文件",
    path: "/assembly-designs/:id/export"
  }
];
```

---

## 🚀 改进计划

### 优先级1：创建样本学习页面 ⭐⭐⭐

**目标**：让用户能方便地上传样本数据供系统学习

**功能**：
```
┌────────────────────────────────────────┐
│         样本学习 - 装配规则学习         │
├────────────────────────────────────────┤
│                                        │
│  步骤1: 上传BOM表                       │
│  [选择Excel文件]  ✅ BOM_项目A.xlsx     │
│                                        │
│  步骤2: 上传零件图（可选）               │
│  [选择PDF文件]  ✅ 零件图1.pdf          │
│                 ✅ 零件图2.pdf          │
│                 + 继续添加              │
│                                        │
│  步骤3: 上传组装图（STEP文件）           │
│  [选择STEP文件] ✅ 总装配.step          │
│                                        │
│  [开始学习]                             │
│                                        │
│  学习结果：                             │
│  ✅ 识别到 25 个零件                    │
│  ✅ 提取 48 个连接关系                  │
│  ✅ 学习到 15 条装配规则                │
│  ✅ 平均置信度: 87%                     │
│                                        │
│  [保存到规则库]  [查看详情]             │
└────────────────────────────────────────┘
```

**API接口**：
```javascript
POST /api/assembly/learn-from-sample
Request:
{
  bom_file: File,        // Excel
  part_drawings: File[], // PDFs (可选)
  assembly_step: File    // STEP
}

Response:
{
  success: true,
  learned_rules: [...],
  statistics: {
    parts_count: 25,
    connections: 48,
    rules_learned: 15,
    avg_confidence: 0.87
  }
}
```

---

### 优先级2：端到端测试和文档 ⭐⭐

**目标**：验证完整流程，编写用户手册

**测试清单**：
```bash
# 1. 样本学习测试
✅ 上传BOM + STEP → 学习规则 → 保存到数据库

# 2. PID识别测试
✅ 上传PID → 识别组件 → 返回结果

# 3. 约束推理测试
✅ PID数据 → AI推理 → 生成约束

# 4. 人工审核测试
✅ 查看任务 → 审核/修改 → 通过

# 5. 自动装配测试
✅ 审核通过 → 生成装配 → 导出STEP

# 6. 完整流程测试
✅ 端到端走一遍（20分钟内完成）
```

**用户手册大纲**：
```markdown
# AI自动装配系统用户手册

## 1. 系统介绍
## 2. 首次使用 - 样本学习
## 3. 日常使用 - PID到装配
## 4. 故障排查
## 5. API文档
## 6. 最佳实践
```

---

### 优先级3：Python服务独立部署 ⭐

**目标**：将Python算法服务独立为微服务

**架构**：
```
services/ml-service/
├── Dockerfile
├── requirements.txt
├── main.py                    # FastAPI入口
├── algorithms/
│   ├── ocr/                   # OCR识别
│   ├── pid/                   # PID分析
│   │   ├── recognition.py
│   │   └── graph_analyzer.py
│   ├── assembly/              # 装配算法
│   │   ├── rule_learner.py
│   │   ├── constraint_solver.py
│   │   └── generator.py
│   └── cad/                   # CAD处理
│       ├── step_parser.py
│       └── freecad_wrapper.py
└── models/                    # 预训练模型
```

**API设计**：
```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/api/ml/learn-assembly-rules")
async def learn_assembly(step_file: UploadFile):
    """从STEP文件学习装配规则"""
    ...

@app.post("/api/ml/recognize-pid")
async def recognize_pid(image: UploadFile):
    """PID图纸识别"""
    ...

@app.post("/api/ml/generate-assembly")
async def generate_assembly(pid_data: dict, rules: dict):
    """生成装配"""
    ...
```

---

## 📝 快速验证流程

### 1分钟诊断脚本

```bash
#!/bin/bash
# 快速诊断AI装配系统

echo "🔍 诊断AI装配系统..."

# 检查服务状态
echo -n "Node.js API: "
curl -s http://localhost:3000/health > /dev/null && echo "✅" || echo "❌"

# 检查Python依赖
echo -n "PythonOCC: "
python -c "from OCC.Core.STEPControl import STEPControl_Reader" 2>/dev/null && echo "✅" || echo "❌"

echo -n "FreeCAD: "
python -c "import FreeCAD" 2>/dev/null && echo "✅" || echo "❌"

# 检查数据库
echo -n "PostgreSQL: "
psql -h localhost -U postgres -d design_platform -c "SELECT 1" > /dev/null 2>&1 && echo "✅" || echo "❌"

# 检查规则库
echo -n "规则库: "
RULES_COUNT=$(psql -h localhost -U postgres -d design_platform -t -c "SELECT COUNT(*) FROM design_rules WHERE type='assembly'" 2>/dev/null)
if [ "$RULES_COUNT" -gt "0" ]; then
  echo "✅ ($RULES_COUNT 条规则)"
else
  echo "⚠️  (规则库为空)"
fi

# 检查零件库
echo -n "零件库: "
PARTS_COUNT=$(psql -h localhost -U postgres -d design_platform -t -c "SELECT COUNT(*) FROM parts_catalog" 2>/dev/null)
if [ "$PARTS_COUNT" -gt "0" ]; then
  echo "✅ ($PARTS_COUNT 个零件)"
else
  echo "⚠️  (零件库为空)"
fi
```

---

## 💡 下一步建议

### 立即执行（今天）
1. ✅ 运行诊断脚本，确认哪些模块有问题
2. ✅ 运行端到端测试脚本：`scripts/test/test_pid_to_assembly_complete.sh`
3. ✅ 检查规则库和零件库是否有数据

### 短期计划（1-2天）
1. 🔨 创建样本学习前端页面
2. 🔨 完善工作流引导页面
3. 🔨 编写用户操作手册

### 中期计划（1周）
1. 🚀 独立部署Python ML服务
2. 🚀 优化PID识别准确率
3. 🚀 增强物理约束验证

---

## 📞 支持

需要帮助？
1. 运行诊断脚本查看问题
2. 查看日志：`pm2 logs mst-api`
3. 查看测试结果：`cat /tmp/pid_full_result.json`

---

**文档版本**: v1.0
**最后更新**: 2025-11-11
