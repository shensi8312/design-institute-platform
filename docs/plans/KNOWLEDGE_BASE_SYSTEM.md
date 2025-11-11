# 装配设计知识库体系

## 🎯 核心问题

**您的需求：**
> PID上没有的件（螺栓、法兰、垫片、支架），怎么推导出需要加哪些？为什么加这些？

**解决方案：建立完整的知识库体系**

---

## 📚 知识库分类

### 1. 选型知识（PID参数 → 零件规格）

**作用：** 从PID的工况参数推导零件规格

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **口径匹配** | 管道口径决定设备口径 | 管道DN50 → 选DN50阀门 |
| **压力等级** | 工作压力决定零件压力等级 | 压力16bar → 选PN16零件 |
| **流量匹配** | 流量决定泵/管道规格 | 流量100m³/h → 选DN50管道 |
| **温度等级** | 温度决定材质 | 200℃ → 选耐高温材料 |
| **介质匹配** | 流体特性决定材质 | 腐蚀性 → 选不锈钢 |
| **设备选型** | 功能需求决定设备型号 | 流量100m³/h, 扬程50m → 选50-200/15泵 |

### 2. 配套知识（主件 → 辅助件）

**作用：** 从已选主件推导必需的辅助件

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **连接配套** | 主设备需要的连接件 | 球阀 → 需要法兰×2 |
| **紧固配套** | 连接需要的紧固件 | 法兰DN50 → 需要M8螺栓×4 |
| **密封配套** | 连接需要的密封件 | 法兰连接 → 需要垫片 |
| **支撑配套** | 管道需要的支撑件 | 管道8m → 需要支架×3 |
| **安装配套** | 设备安装需要的辅助件 | 泵 → 需要底座+地脚螺栓 |
| **传动配套** | 动力传动需要的部件 | 泵+电机 → 需要联轴器 |

### 3. 装配知识（零件组合 → 装配约束）

**作用：** 从零件类型推导装配方式

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **连接方式** | 零件间连接类型 | 阀门+法兰 → SCREW连接 |
| **几何约束** | 装配的几何关系 | 法兰连接 → 同轴+间距5mm |
| **装配顺序** | 先装什么后装什么 | 先装底座，再装泵，最后接管道 |
| **紧固力矩** | 螺栓的拧紧力矩 | M8螺栓 → 25N·m |
| **配合公差** | 配合面的公差要求 | 轴孔配合 → H7/g6 |

### 4. 安装空间知识（实际可操作性）⭐ 新增

**作用：** 确保工人能够实际安装，避免设计不可施工

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **操作空间** | 工具和手的最小工作空间 | 扳手操作需要≥150mm径向空间 |
| **可达性** | 螺栓位置是否可触及 | 法兰螺栓不能被管道遮挡 |
| **工具需求** | 所需工具类型和尺寸 | M16螺栓需要24mm扳手 |
| **人体工程** | 工人姿势和力量限制 | 高于2m需要脚手架，单人最大拧紧力矩80N·m |
| **拆卸维护** | 后续维护的空间预留 | 泵体周围预留≥800mm维护空间 |
| **安装顺序约束** | 因空间限制的安装次序 | 必须先装内部件再装外壳 |

**典型规则示例：**
```javascript
{
    rule_id: 'CLEARANCE_CHECK_FLANGE_BOLTS',
    rule_name: '法兰螺栓操作空间检查',
    rule_type: 'installation_feasibility',

    condition: {
        connection_type: '法兰螺栓连接',
        bolt_spec: 'M16',
        clearance_to_wall: '<200mm'  // 距墙小于200mm
    },

    action: {
        warning_level: 'high',
        message: '操作空间不足！M16螺栓需要24mm扳手，最小径向空间150mm',
        suggestions: [
            '方案1：法兰旋转90°改变螺栓方向',
            '方案2：使用细长型扳手或套筒扳手',
            '方案3：改用快装卡箍（无螺栓）'
        ]
    },

    source: 'GB/T 5270-2005 紧固件操作空间',
    confidence: 1.0
}
```

**知识来源：**
- GB/T 5270-2005：紧固件操作空间标准
- GB/T 13861-2009：生产设备安全卫生设计总则（人机工程）
- 《化工装置设备布置设计规范》HG/T 20546
- 历史案例：现场返工记录（因空间不足需要重新设计）

### 5. 成本优化知识（经济性）⭐ 新增

**作用：** 在满足功能的前提下降低成本

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **材料成本** | 零件单价和用量 | 不锈钢法兰比碳钢贵3倍 |
| **加工成本** | 特殊工艺的成本 | 焊接比法兰连接省50%成本但不可拆 |
| **安装工时** | 不同方案的人工成本 | 螺纹连接比焊接省2小时工时 |
| **标准化优势** | 使用标准件降低成本 | 标准法兰比非标便宜60% |
| **批量采购** | 同规格集中采购折扣 | 统一使用M16螺栓可获批量折扣 |
| **维护成本** | 全生命周期成本 | 快装卡箍初次贵20%但维护省50%工时 |

**典型规则示例：**
```javascript
{
    rule_id: 'COST_OPT_BOLT_STANDARDIZATION',
    rule_name: '螺栓规格标准化优化',
    rule_type: 'cost_optimization',

    condition: {
        bolt_specs_used: ['M12', 'M14', 'M16', 'M18'],  // 使用了4种接近规格
        total_bolt_count: '>100'
    },

    action: {
        optimization_type: 'standardization',
        recommendation: '统一使用M16螺栓',
        reasoning: [
            '强度：M16满足所有连接的强度要求（安全系数>1.5）',
            '成本：统一规格可获批量折扣，预计节省15%采购成本',
            '库存：减少备件种类，降低库存成本',
            '维护：工人只需携带1种扳手，提高效率'
        ],
        estimated_savings: {
            material_cost: -15,  // 节省15%材料费
            inventory_cost: -20,  // 节省20%库存费
            maintenance_time: -10  // 节省10%维护时间
        }
    },

    source: 'learned_from_optimization_cases',
    confidence: 0.9
}
```

**知识来源：**
- 企业采购数据库（零件单价、批量折扣）
- 企业定额标准（安装工时定额）
- 历史项目成本分析（成本对比数据）
- 供应商报价系统

### 6. 装配工艺知识（可制造性）⭐ 新增

**作用：** 确保装配方案在现场可实施

| 知识类型 | 说明 | 示例 |
|---------|------|------|
| **工具可用性** | 现场工具限制 | 工地只有手动扳手，不能依赖液压工具 |
| **工人技能** | 技工等级要求 | 焊接需要持证焊工，法兰连接普通工人可操作 |
| **环境限制** | 现场施工条件 | 高空作业需要吊装设备 |
| **质量检验** | 可检验性 | 盲孔螺栓连接难以检查 |
| **安全要求** | 施工安全规范 | 高压管道需要打压测试 |
| **工序依赖** | 工序间的先后关系 | 焊接后需要退火处理 |

**典型规则示例：**
```javascript
{
    rule_id: 'SKILL_REQUIREMENT_WELDING',
    rule_name: '焊接工艺技能要求',
    rule_type: 'manufacturability',

    condition: {
        connection_type: '焊接',
        material: '不锈钢',
        pressure_rating: '>10bar'
    },

    action: {
        skill_level: '高级焊工（持证）',
        required_equipment: [
            '氩弧焊机',
            '焊接工装夹具',
            '无损检测设备（X光或超声波）'
        ],
        process_requirements: [
            '焊前预热150°C',
            '焊后退火处理',
            '100%无损检测',
            '打压试验1.5倍工作压力'
        ],
        estimated_time: '4小时/接头',
        cost_factor: 'high',
        alternative: '如果现场条件不足，建议改用法兰连接'
    },

    source: 'GB 50236-2011 现场设备、工业管道焊接工程施工规范',
    confidence: 1.0
}
```

**知识来源：**
- GB 50236-2011：现场设备、工业管道焊接工程施工规范
- 企业施工规范（现场工具清单、工人技能等级）
- 历史项目施工记录（实际工时、问题记录）

---

## 📖 知识来源清单

### 类型1：国家标准（最可靠，100%可信）

#### 1.1 法兰标准

| 标准号 | 名称 | 内容 | 用途 |
|-------|------|------|------|
| **GB/T 9119-2010** | 板式平焊钢制管法兰 | 法兰尺寸、螺栓孔数量、螺栓规格 | 法兰配套螺栓规则 |
| **GB/T 9124-2010** | 钢制管法兰 技术条件 | 法兰材质、压力等级、温度范围 | 法兰选型规则 |
| **HG/T 20592-2009** | 钢制管法兰、垫片、紧固件选用规定 | 法兰-垫片-螺栓配套表 | 完整配套方案 |

**示例数据：**
```
DN50 PN16法兰（GB/T 9119）：
  - 螺栓孔数：4个
  - 螺栓规格：M16
  - 螺栓孔中心圆直径：110mm
  - 法兰外径：165mm
  - 推荐垫片：DN50石棉橡胶垫片
```

#### 1.2 管道标准

| 标准号 | 名称 | 内容 | 用途 |
|-------|------|------|------|
| **HG/T 20593-2011** | 钢制管道支吊架 | 支架间距、支架型式、载荷计算 | 管道支架配套 |
| **GB/T 50316-2000** | 工业金属管道设计规范 | 管道壁厚、材质、布置要求 | 管道选型 |
| **SH/T 3041-2019** | 石油化工管道柔性设计规范 | 管道应力、补偿、支架布置 | 管道系统设计 |

**示例数据：**
```
DN50管道支架间距（HG/T 20593）：
  - 水平管：3.0m
  - 垂直管：4.0m
  - 支架型式：U型管卡 + 支架
  - 紧固件：膨胀螺栓M10×4
```

#### 1.3 螺栓螺母标准

| 标准号 | 名称 | 内容 | 用途 |
|-------|------|------|------|
| **GB/T 5782-2016** | 六角头螺栓 | 螺栓尺寸、长度、性能等级 | 螺栓选型 |
| **GB/T 6170-2015** | 六角螺母 | 螺母尺寸、性能等级 | 螺母配套 |
| **GB/T 230.1-2018** | 金属材料洛氏硬度试验 | 紧固件力学性能 | 螺栓强度选择 |

**示例数据：**
```
M8螺栓（GB/T 5782）：
  - 推荐长度：60mm（法兰厚度20mm + 垫片2mm + 螺母高度7mm + 预留10mm）
  - 性能等级：8.8级（一般工况）
  - 拧紧力矩：25N·m
```

#### 1.4 泵阀标准

| 标准号 | 名称 | 内容 | 用途 |
|-------|------|------|------|
| **GB/T 12241-2005** | 安全阀 | 阀门型号、压力等级、连接形式 | 阀门选型 |
| **GB/T 3216-2016** | 回转动力泵 水力性能试验 | 泵性能参数、选型曲线 | 泵选型 |
| **JB/T 8937-2014** | 离心泵技术条件 | 泵安装、维护、配套要求 | 泵安装配套 |

**示例数据：**
```
离心泵安装配套（JB/T 8937）：
  - 需要：混凝土底座
  - 需要：地脚螺栓（泵座螺栓孔确定规格）
  - 需要：联轴器（泵轴与电机轴连接）
  - 需要：进出口法兰（与管道连接）
  - 需要：减震垫（减少振动）
```

---

### 类型2：行业设计手册（可靠，作为参考）

| 手册名称 | 出版社 | 内容 | 用途 |
|---------|-------|------|------|
| **化工设备设计手册** | 化工出版社 | 设备选型、结构设计、材料选择 | 设备配套 |
| **管道工程设计手册** | 石油工业出版社 | 管道布置、支架设计、阀门选型 | 管道系统 |
| **泵与泵站设计手册** | 中国建筑工业出版社 | 泵选型、管路计算、安装要求 | 泵系统 |
| **机械设计手册** | 机械工业出版社 | 紧固件、传动件、标准件选用 | 通用零件 |

**示例数据：**
```
《管道工程设计手册》中的经验值：
  - DN50管道，压力16bar，碳钢材质
  - 壁厚：SCH40 (3.91mm)
  - 重量：每米4.5kg
  - 支架间距：水平管3m，垂直管4m
  - 法兰选择：对焊法兰优于平焊法兰
```

---

### 类型3：企业内部规范（企业特色）

| 规范类型 | 说明 | 示例 |
|---------|------|------|
| **设计标准** | 公司内部设计规定 | "本公司所有DN≤80的管道优先选用对焊法兰" |
| **选型手册** | 常用零件型号库 | "泵优先选用某品牌型号" |
| **典型设计** | 标准化设计方案 | "DN50管道系统标准配置" |
| **历史案例** | 以往项目经验 | "某项目的BOM清单" |

---

### 类型4：供应商资料（品牌相关）

| 资料类型 | 说明 | 示例 |
|---------|------|------|
| **产品样本** | 设备选型手册 | 某品牌泵选型样本 |
| **安装手册** | 设备安装说明 | 泵的安装配套要求 |
| **配件清单** | 标准配件清单 | 泵的标准配件（底座、联轴器等） |

---

## 🧠 知识学习方法

### 方法1：从标准规范中提取规则（硬编码）

**步骤：**
```
1. 收集标准文档（PDF/Word）
2. 人工/OCR提取关键表格数据
3. 转换为结构化规则
4. 存入规则库
```

**示例：从GB/T 9119提取法兰螺栓配套规则**

**原始标准表格：**
```
┌────────┬──────────┬────────┬──────┬────────┐
│ DN     │ 螺栓孔数  │ 螺栓规格│ 法兰厚│ 垫片规格│
├────────┼──────────┼────────┼──────┼────────┤
│ DN40   │    4     │  M16   │  18  │  DN40  │
│ DN50   │    4     │  M16   │  20  │  DN50  │
│ DN80   │    8     │  M16   │  22  │  DN80  │
│ DN100  │    8     │  M20   │  24  │  DN100 │
└────────┴──────────┴────────┴──────┴────────┘
```

**转换为规则：**
```javascript
const STANDARD_RULES = [
    {
        rule_id: 'GB9119_DN50_PN16',
        source: 'GB/T 9119-2010 表3',
        rule_type: 'matching',
        condition: {
            part_type: '法兰',
            dn: 50,
            pn: 16
        },
        action: {
            add_parts: [
                {
                    type: '六角螺栓',
                    spec: 'M16×60',
                    standard: 'GB/T 5782',
                    quantity: 4
                },
                {
                    type: '六角螺母',
                    spec: 'M16',
                    standard: 'GB/T 6170',
                    quantity: 4
                },
                {
                    type: '垫片',
                    spec: 'DN50 PN16',
                    standard: 'HG/T 20606',
                    material: '石棉橡胶',
                    quantity: 1
                }
            ]
        },
        confidence: 1.0,  // 国标，100%可信
        reference: 'GB/T 9119-2010 第15页 表3'
    }
]
```

**实施方案：**
```javascript
// apps/api/src/services/standards/StandardRulesLibrary.js

class StandardRulesLibrary {
    constructor() {
        // 初始化标准规则库
        this.rules = []
        this.loadStandardRules()
    }

    loadStandardRules() {
        // 法兰标准
        this.rules.push(...this.loadFlangeStandards())

        // 管道支架标准
        this.rules.push(...this.loadPipeSupportStandards())

        // 螺栓标准
        this.rules.push(...this.loadBoltStandards())

        // 泵阀标准
        this.rules.push(...this.loadPumpValveStandards())
    }

    loadFlangeStandards() {
        // 从GB/T 9119-2010提取
        return [
            // DN40-DN200的所有规格
            { rule_id: 'GB9119_DN40_PN16', dn: 40, bolts: 4, bolt_spec: 'M16', ... },
            { rule_id: 'GB9119_DN50_PN16', dn: 50, bolts: 4, bolt_spec: 'M16', ... },
            { rule_id: 'GB9119_DN80_PN16', dn: 80, bolts: 8, bolt_spec: 'M16', ... },
            // ...更多规格
        ]
    }

    loadPipeSupportStandards() {
        // 从HG/T 20593-2011提取
        return [
            {
                rule_id: 'HG20593_SUPPORT_DN40_80',
                dn_min: 40,
                dn_max: 80,
                horizontal_interval: 3.0,  // 米
                vertical_interval: 4.0,
                support_type: 'U型管卡',
                bolt_spec: 'M10',
                bolt_quantity: 4
            },
            // ...更多规格段
        ]
    }
}
```

---

### 方法2：从历史案例中学习规则（数据驱动）

**步骤：**
```
1. 收集历史工程案例（PID + BOM + STEP）
2. 解析三者数据
3. 统计共现模式
4. 生成规则（IF-THEN）
5. 计算置信度
6. 存入规则库
```

**示例：从15个案例学习阀门配套规则**

**输入数据：**
```
案例1: BOM包含 [球阀DN50, 法兰DN50×2, M16螺栓×8]
案例2: BOM包含 [球阀DN50, 法兰DN50×2, M16螺栓×8]
案例3: BOM包含 [球阀DN80, 法兰DN80×2, M16螺栓×16]
...
案例15: BOM包含 [球阀DN50, 法兰DN50×2, M16螺栓×8]
```

**统计分析：**
```python
def analyze_valve_matching_patterns(bom_samples):
    """
    统计阀门配套模式
    """
    patterns = defaultdict(lambda: {'count': 0, 'configs': []})

    for bom in bom_samples:
        valves = [p for p in bom if '阀' in p.type]

        for valve in valves:
            dn = extract_dn(valve.specification)

            # 查找配套的法兰
            flanges = find_related_parts(bom, valve, '法兰', radius=2)

            if flanges:
                flange_count = len(flanges)
                flange_dn = extract_dn(flanges[0].specification)

                # 查找配套的螺栓
                bolts = find_related_parts(bom, flanges[0], '螺栓', radius=1)

                if bolts:
                    bolt_spec = extract_thread(bolts[0].specification)
                    bolt_count = len(bolts)

                    key = f'valve_DN{dn}_needs_flange_and_bolts'
                    patterns[key]['count'] += 1
                    patterns[key]['configs'].append({
                        'flange_count': flange_count,
                        'flange_dn': flange_dn,
                        'bolt_spec': bolt_spec,
                        'bolt_count': bolt_count
                    })

    return patterns

# 分析结果：
"""
valve_DN50_needs_flange_and_bolts:
  - 出现次数: 12次
  - 配置:
    - 法兰DN50 ×2: 12次 (100%)
    - M16螺栓 ×8: 12次 (100%)
  - 置信度: 0.95 (出现12/15次)
"""
```

**生成规则：**
```javascript
{
    rule_id: 'LEARNED_VALVE_DN50_MATCHING',
    source: 'learned_from_history',
    rule_type: 'matching',

    condition: {
        part_type: '球阀',
        dn: 50
    },

    action: {
        add_parts: [
            {
                type: '法兰',
                spec: 'DN50 PN16',
                quantity: 2,
                reasoning: '阀门两端需要法兰'
            },
            {
                type: '六角螺栓',
                spec: 'M16×60',
                quantity: 8,
                reasoning: '2个法兰连接，每个4颗螺栓'
            },
            {
                type: '六角螺母',
                spec: 'M16',
                quantity: 8
            },
            {
                type: '垫片',
                spec: 'DN50',
                quantity: 2
            }
        ]
    },

    confidence: 0.95,  // 12/15 = 80%, 调整后95%
    sample_count: 12,

    learned_from: {
        total_samples: 15,
        matched_samples: 12,
        source_projects: ['Project_001', 'Project_002', ...]
    }
}
```

---

### 方法3：混合策略（标准 + 学习）

**优先级：**
```
1. 标准规范规则（置信度1.0，最高优先级）
2. 企业内部规范（置信度0.95）
3. 历史案例学习（置信度0.8-0.9）
4. 供应商推荐（置信度0.7）
```

**冲突解决：**
```javascript
function resolveConflictingRules(standardRule, learnedRule) {
    // 如果标准规则存在，优先使用标准
    if (standardRule && standardRule.confidence === 1.0) {
        return standardRule
    }

    // 如果学习规则的样本量很大且置信度高，也可以采纳
    if (learnedRule.sample_count >= 20 && learnedRule.confidence >= 0.95) {
        // 但仍然标注为"建议规则"，需要人工审核
        learnedRule.requires_review = true
        return learnedRule
    }

    // 默认使用标准
    return standardRule
}
```

---

## 🗂️ 知识库数据结构

### 数据库Schema

```sql
-- 规则表
CREATE TABLE design_rules (
    rule_id VARCHAR(100) PRIMARY KEY,
    rule_name VARCHAR(255),
    rule_type VARCHAR(50),  -- 'selection', 'matching', 'assembly'

    -- 条件
    condition_type VARCHAR(50),  -- 'part_type', 'dn_match', 'pn_match', etc.
    condition_data JSONB,

    -- 动作
    action_type VARCHAR(50),  -- 'add_parts', 'set_constraint', etc.
    action_data JSONB,

    -- 元数据
    source VARCHAR(100),  -- 'GB/T 9119-2010', 'learned_from_history', etc.
    confidence FLOAT,
    sample_count INTEGER,

    -- 可追溯性
    reference TEXT,  -- 标准文档引用
    learned_from_projects TEXT[],  -- 学习来源项目

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    is_active BOOLEAN DEFAULT true
);

-- 标准规范表
CREATE TABLE standards_library (
    standard_id VARCHAR(50) PRIMARY KEY,
    standard_name VARCHAR(255),
    standard_category VARCHAR(50),  -- 'flange', 'pipe', 'bolt', etc.

    -- 标准内容（结构化数据）
    standard_data JSONB,

    -- 原始文档
    document_path TEXT,
    document_pages TEXT[],  -- 相关页码

    version VARCHAR(50),
    issued_date DATE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- 历史案例表
CREATE TABLE historical_cases (
    case_id SERIAL PRIMARY KEY,
    project_name VARCHAR(255),

    -- 输入数据
    pid_file_path TEXT,
    bom_file_path TEXT,
    step_file_path TEXT,

    -- 解析后的数据
    pid_data JSONB,
    bom_data JSONB,
    assembly_data JSONB,

    -- 学习结果
    extracted_rules_count INTEGER,
    learned_rules JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 知识获取检查清单

### 必需资料（优先级P0）

**法兰系统：**
- [ ] GB/T 9119-2010 板式平焊钢制管法兰
- [ ] HG/T 20592-2009 钢制管法兰、垫片、紧固件选用规定
- [ ] HG/T 20615-2009 钢制管法兰、垫片、紧固件选用规定

**管道系统：**
- [ ] HG/T 20593-2011 钢制管道支吊架
- [ ] GB/T 50316-2000 工业金属管道设计规范

**螺栓螺母：**
- [ ] GB/T 5782-2016 六角头螺栓
- [ ] GB/T 6170-2015 六角螺母

### 推荐资料（优先级P1）

**设计手册：**
- [ ] 《化工设备设计手册》（第三版）
- [ ] 《管道工程设计手册》
- [ ] 《机械设计手册》（第六版）

**企业资料：**
- [ ] 公司内部设计标准（如果有）
- [ ] 历史项目BOM清单（至少10个）
- [ ] 常用供应商产品样本

### 可选资料（优先级P2）

**行业规范：**
- [ ] SH/T 3041-2019 石油化工管道柔性设计规范
- [ ] GB/T 3216-2016 回转动力泵 水力性能试验

---

## 🚀 实施路线图

### Phase 1: 建立基础规则库（1周）

**目标：** 硬编码核心标准规则

**任务：**
1. 收集核心标准文档（法兰、管道支架、螺栓）
2. 人工提取关键表格数据
3. 转换为JavaScript规则对象
4. 创建`StandardRulesLibrary`类
5. 单元测试验证

**交付物：**
```javascript
// apps/api/src/services/standards/StandardRulesLibrary.js
- 法兰配套规则（DN40-DN200）
- 管道支架规则（DN25-DN300）
- 螺栓规格规则（M6-M24）
```

**效果：**
- 输入："法兰DN50 PN16"
- 输出："需要M16螺栓×4 + M16螺母×4 + DN50垫片×1"

---

### Phase 2: 从历史案例学习（2周）

**目标：** 从真实项目学习配套规则

**任务：**
1. 收集10-15个历史项目（PID + BOM）
2. 实现统计分析算法
3. 生成学习规则
4. 与标准规则合并
5. 前端展示学习结果

**交付物：**
```javascript
// apps/api/src/services/learning/HistoricalCaseLearner.js
- BOM共现模式分析
- 规则置信度计算
- 冲突检测与解决
```

**效果：**
- 输入：15个历史BOM
- 输出：30-50条学习规则（置信度0.8-0.95）

---

### Phase 3: 应用到自动选型（1周）

**目标：** 从PID自动推导完整BOM

**任务：**
1. PID参数提取增强
2. 选型规则应用
3. 配套规则应用
4. 完整BOM生成

**交付物：**
```javascript
// apps/api/src/services/selection/AutoSelectionService.js
- PID → 主设备选型
- 主设备 → 辅助件配套
- 完整BOM清单
```

**效果：**
- 输入：PID图（管道DN50, 阀门V-101）
- 输出：完整BOM（主设备4个 + 辅助件30个）

---

## 📊 知识库预期效果

### 学到的知识示例

**选型知识：**
```
- 管道DN50, 16bar → 选DN50 PN16零件 (100%置信度，标准)
- 流量100m³/h, 扬程50m → 选50-200/15泵 (85%置信度，学习)
```

**配套知识：**
```
- 球阀DN50 → 需要法兰DN50×2 (100%置信度，标准)
- 法兰DN50 → 需要M16螺栓×4 (100%置信度，标准GB9119)
- 管道8m → 需要支架×3 (100%置信度，标准HG20593)
- 泵 → 需要底座+地脚螺栓+联轴器 (90%置信度，学习)
```

**装配知识：**
```
- 阀门+法兰 → SCREW连接, 距离5mm (95%置信度，学习)
- 法兰连接 → 对角线拧紧顺序 (100%置信度，标准)
```

---

## ✅ 检查清单总结

### 您需要准备的资料

**必须有的：**
1. ✅ GB/T 9119-2010（法兰标准）- PDF或表格数据
2. ✅ HG/T 20593-2011（管道支架标准）- PDF或表格数据
3. ✅ 3-5个历史项目的BOM清单（Excel格式）

**最好有的：**
4. ⭐ 公司内部设计标准（如果有）
5. ⭐ 10-15个历史项目（更多更好）
6. ⭐ 化工/管道设计手册（电子版）

**可以后续补充：**
7. 🔸 供应商产品样本
8. 🔸 更多行业标准

---

## 💡 下一步行动

**我建议：**

1. **您先准备资料**
   - 找到法兰标准GB/T 9119（至少DN40-DN200的表格）
   - 找到管道支架标准HG/T 20593（支架间距表）
   - 提供3-5个历史项目BOM（我们可以用来测试学习效果）

2. **我立即开始实施Phase 1**
   - 创建标准规则库框架
   - 实现规则匹配引擎
   - 等您提供标准数据后填充规则

3. **并行进行Phase 2准备**
   - 设计历史案例学习算法
   - 准备BOM解析和统计模块

**时间规划：**
- Week 1: 标准规则库（等您提供标准文档）
- Week 2-3: 历史案例学习（需要您的历史BOM）
- Week 4: 集成应用

**您同意这个计划吗？需要我先实施哪部分？** 🚀
