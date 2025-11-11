# AI装配系统 - 双流程架构方案

## 📋 现状诊断

### ✅ 已有能力

1. **STEP装配文件解析**（`learn_assembly_rules.py`）
   - ✅ 提取零件几何信息（位置、旋转、体积、包围盒）
   - ✅ 分析零件间连接关系（距离、接触类型）
   - ✅ 学习装配模式和约束规则
   - ✅ 推断装配顺序

2. **PID识别与装配生成**（`PIDtoAssemblyPipeline.py`）
   - ✅ PID图纸识别
   - ✅ 零件库匹配
   - ✅ 物理约束验证
   - ✅ SolidWorks集成

### ❌ 缺失功能

**您拥有的学习材料无法完全利用：**

1. ❌ **BOM文件解析**
   - 您有：BOM Excel/CSV文件（零件编号、名称、规格、数量）
   - 现状：没有BOM解析模块
   - 影响：无法建立零件编号与实际零件的关联

2. ❌ **零件图PDF解析**
   - 您有：零件图PDF文件（详细尺寸、几何特征、接口信息）
   - 现状：没有PDF图纸解析模块
   - 影响：无法提取零件的详细特征

3. ❌ **多源数据关联**
   - 需要：BOM编号 ↔ STEP零件 ↔ PDF零件图 的三向关联
   - 现状：各模块独立工作，无关联机制
   - 影响：无法形成完整的知识图谱

---

## 🏗️ 双流程架构设计

### 流程A：学习流程（训练规则库）

```
用户输入：
├─ BOM文件（Excel/CSV）    → 零件清单、编号、规格
├─ 组装图STEP文件          → 装配关系、位置约束
└─ 零件图PDF文件夹         → 零件特征、尺寸、接口

         ↓

┌──────────────────────────────────────────────────┐
│  1. 多源解析层                                    │
│  ├─ BOM Parser      → 零件清单数据               │
│  ├─ STEP Parser     → 装配结构数据 (已有)        │
│  └─ PDF Parser      → 零件特征数据 (需开发)      │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  2. 数据关联层                                    │
│  - 基于零件编号关联BOM、STEP、PDF               │
│  - 建立零件主档（Master Part Record）            │
│  - 提取装配上下文（哪些零件组合出现）             │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  3. 规则学习层                                    │
│  - 装配模式学习（连接类型、位置关系）             │
│  - 约束规则提取（物理约束、工艺约束）             │
│  - 参数范围统计（距离、角度、配合公差）           │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  4. 规则库存储                                    │
│  - 零件特征库（Postgres + 向量检索）             │
│  - 装配规则库（规则引擎）                         │
│  - 案例库（成功装配案例）                         │
└──────────────────────────────────────────────────┘
```

**输出：训练好的规则库**

---

### 流程B：应用流程（自动装配生成）

```
用户输入：PID图纸

         ↓

┌──────────────────────────────────────────────────┐
│  1. PID识别（已有）                               │
│  - 识别设备类型                                   │
│  - 提取管线连接                                   │
│  - 解析参数（压力、温度、流量）                   │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  2. 规则库查询                                    │
│  - 匹配类似场景（向量相似度）                     │
│  - 查询适用规则                                   │
│  - 检索历史案例                                   │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  3. 智能装配生成                                  │
│  - 应用学习到的规则                               │
│  - 应用物理约束（已有PhysicalConstraintEngine）  │
│  - 应用机械知识（标准库、国标）                   │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  4. 人工审核与调整                                │
│  - 3D预览                                        │
│  - 参数微调                                      │
│  - 规则确认/修正                                  │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  5. 输出生成                                      │
│  - STEP装配文件                                   │
│  - BOM清单                                       │
│  - 装配工艺卡                                     │
└──────────────────────────────────────────────────┘
```

**输出：自动生成的装配图 + BOM**

---

## 🛠️ 实施方案

### Phase 1: 学习流程基础模块（优先级最高）

#### 1.1 BOM解析器
```python
# apps/api/src/services/learning/BOMParser.py
class BOMParser:
    def parse_excel(self, file_path: str) -> List[BOMItem]:
        """
        解析BOM Excel文件
        支持格式：
        - 零件编号 | 零件名称 | 规格型号 | 数量 | 备注
        """
        pass

    def extract_part_info(self, bom_items: List) -> Dict:
        """提取零件信息字典"""
        pass
```

**输入示例：**
```excel
零件编号    | 零件名称      | 规格型号        | 数量 | 备注
---------------------------------------------------------
V-001      | 球阀          | DN50 PN16      | 2    | 不锈钢
P-001      | 离心泵        | 50-200/15      | 1    |
F-001      | 法兰          | DN50 PN16      | 4    |
```

#### 1.2 零件图PDF解析器（可选 - 初期可简化）
```python
# apps/api/src/services/learning/PartDrawingParser.py
class PartDrawingParser:
    def parse_pdf_drawing(self, pdf_path: str, part_number: str):
        """
        解析零件图PDF
        提取：标题栏（零件编号）、尺寸标注、几何特征

        技术方案：
        - OCR识别文字（零件编号、尺寸数值）
        - 图像处理提取几何轮廓
        - 模式匹配识别标准特征（螺纹孔、法兰面等）
        """
        pass
```

**初期简化方案：**
- 用户手工创建零件特征JSON（临时方案）
- 后期再开发自动PDF解析

#### 1.3 学习流程控制器
```python
# apps/api/src/services/learning/AssemblyLearningPipeline.py
class AssemblyLearningPipeline:
    def learn_from_complete_assembly(
        self,
        bom_file: str,
        step_file: str,
        part_drawings_dir: str = None
    ) -> Dict:
        """
        完整学习流程

        步骤：
        1. 解析BOM → 零件清单
        2. 解析STEP → 装配结构（调用现有learn_assembly_rules.py）
        3. 解析零件图 → 零件特征（可选）
        4. 关联：BOM零件编号 ↔ STEP零件ID
        5. 生成规则并存储到数据库
        """
        # 1. 解析BOM
        bom_data = self.bom_parser.parse_excel(bom_file)

        # 2. 解析STEP（复用现有代码）
        from assembly.learn_assembly_rules import extract_assembly_structure
        assembly_data = extract_assembly_structure(step_file)

        # 3. 关联
        correlated_data = self._correlate_bom_and_step(bom_data, assembly_data)

        # 4. 学习规则
        rules = self._learn_assembly_rules(correlated_data)

        # 5. 存储规则
        self._save_to_rule_database(rules)

        return rules
```

#### 1.4 数据库Schema（规则存储）
```sql
-- 规则库表设计
CREATE TABLE assembly_learning_cases (
    id SERIAL PRIMARY KEY,
    case_name VARCHAR(255),
    bom_file_path TEXT,
    step_file_path TEXT,
    learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB  -- 存储完整学习结果
);

CREATE TABLE assembly_rules (
    id SERIAL PRIMARY KEY,
    case_id INT REFERENCES assembly_learning_cases(id),
    rule_type VARCHAR(50),  -- 'connection', 'constraint', 'sequence'
    rule_data JSONB,
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE part_features (
    id SERIAL PRIMARY KEY,
    part_number VARCHAR(100) UNIQUE,
    part_name VARCHAR(255),
    category VARCHAR(100),
    specifications JSONB,
    geometric_features JSONB,
    embedding VECTOR(768)  -- 用于相似度检索
);
```

### Phase 2: 学习流程前端UI

```typescript
// apps/web/src/pages/AssemblyLearning.tsx
/**
 * 装配规则学习页面
 *
 * 功能：
 * 1. 上传BOM Excel文件
 * 2. 上传组装图STEP文件
 * 3. 上传零件图PDF文件夹（可选）
 * 4. 触发学习流程
 * 5. 显示学习结果（提取的规则、零件特征）
 * 6. 规则审核与修正
 */
```

### Phase 3: 应用流程增强

- 在现有`PIDtoAssemblyPipeline.py`中集成规则库查询
- 添加规则匹配和推荐逻辑
- 优化物理约束引擎

---

## 📝 关键问题解答

### Q1: 能否通过您现有的材料学习？

**✅ 可以！但需要开发以下模块：**

1. **BOM解析器**（必需）- 从Excel提取零件清单
2. **STEP与BOM关联**（必需）- 建立零件编号映射
3. **PDF解析器**（可选，初期可手工补充）

**优先级方案：**
- **Phase 1.0**: BOM + STEP学习（无PDF解析）
  - 用户手工创建零件特征JSON作为补充
  - 先让流程跑通

- **Phase 2.0**: 增加PDF自动解析
  - OCR + 图像处理
  - 自动提取零件特征

### Q2: 需要上传什么材料？

**学习流程上传清单：**

```
一个完整学习案例包含：
├─ BOM.xlsx              (必需) - 零件清单
├─ assembly.step         (必需) - 组装图
└─ part_drawings/        (可选) - 零件图文件夹
   ├─ V-001.pdf
   ├─ P-001.pdf
   └─ F-001.pdf
```

**关键要求：**
- BOM中的零件编号必须能关联到STEP中的零件
- STEP文件应包含完整的装配体结构（非单个零件）
- 零件图PDF的文件名应包含零件编号（如：V-001.pdf）

### Q3: 现有代码的`learn_assembly_rules.py`能用吗？

**✅ 可以复用！它是核心基础模块**

现有代码已经能：
- 解析STEP装配结构 ✅
- 提取零件位置和连接 ✅
- 学习装配模式 ✅

**需要增强的部分：**
- 加入BOM数据关联
- 加入零件特征（从PDF或手工）
- 将学习结果存入数据库（现在只输出JSON）

---

## 🚀 推荐实施路径

### 最小可行方案（MVP）

**目标：用最小开发量验证流程可行性**

1. **开发BOM解析器**（2-3天）
   - 解析Excel格式BOM
   - 输出结构化零件清单

2. **开发关联逻辑**（1-2天）
   - 基于零件编号/名称模糊匹配
   - 关联BOM与STEP中的零件

3. **扩展现有`learn_assembly_rules.py`**（2-3天）
   - 输入增加BOM数据
   - 输出增加零件-规则关联
   - 存储到数据库（新增）

4. **创建学习流程API**（1天）
   - POST `/api/assembly/learn` - 上传BOM+STEP
   - GET `/api/assembly/rules` - 查询学习到的规则

5. **简单前端页面**（2天）
   - 上传BOM和STEP文件
   - 显示学习结果
   - 规则列表展示

**总计：8-11天可完成MVP**

### 完整方案（包含PDF解析）

在MVP基础上增加：
- PDF零件图解析（OCR + 图像处理）：5-7天
- 向量检索优化：3-4天
- 规则推理引擎增强：5-7天

**总计：21-29天**

---

## 💡 下一步建议

1. **确认MVP方案**
   - 先用手工零件特征（JSON格式）补充
   - 专注于BOM+STEP学习流程
   - PDF解析后续迭代

2. **准备测试数据**
   - 提供1-2套完整的BOM+STEP+PDF案例
   - 用于验证学习效果

3. **开始开发**
   - 从BOM解析器开始
   - 逐步集成到现有代码

**您希望我先实现哪个部分？**
- A. BOM解析器（核心基础）
- B. 学习流程控制器（流程编排）
- C. 前端学习页面（用户交互）
- D. 完整MVP（一次性开发）
