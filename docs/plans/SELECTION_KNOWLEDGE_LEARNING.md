# 零件选型知识学习 - 完整方案

## 🎯 您的核心问题

**您想要系统学会：**
1. ❓ **为什么选这个型号** - 为什么选DN50而不是DN80？
2. ❓ **为什么这样组装** - 为什么阀门+法兰用4个M8螺栓？
3. ❓ **为什么这样匹配** - 为什么DN50阀门配DN50法兰？
4. ❓ **下次能自动选型吗** - 给新的PID图，能否自动选择合适的零件？

**简单说：从PID功能需求 → 自动选型 → 自动装配**

---

## 📊 现有系统能力分析

### ✅ 现有系统**能学到**的

| 知识类型 | 示例 | 现状 |
|---------|------|-----|
| 装配规则 | "阀门+法兰 → 螺栓连接" | ✅ 可以学 |
| 几何约束 | "距离5mm, 4个螺栓" | ✅ 可以学 |
| 零件类型组合 | "阀门必须配法兰" | ✅ 可以学 |
| 材质匹配 | "不锈钢阀门配不锈钢法兰" | ✅ 可以学（如果BOM有材质信息） |

**当前学习输入：**
```
BOM(零件清单) + 装配图STEP
    ↓
学到：零件A + 零件B → 如何装配
```

**能回答的问题：**
- ✅ "已知有球阀DN50和法兰DN50，如何装配？"
- ✅ "球阀和法兰用什么约束？"
- ✅ "螺栓应该是什么规格？"

### ❌ 现有系统**学不到**的

| 知识类型 | 示例 | 现状 |
|---------|------|-----|
| **选型规则** | "管道DN50 → 选DN50阀门" | ❌ 学不到 |
| **规格推导** | "压力16bar → 选PN16零件" | ❌ 学不到 |
| **功能匹配** | "流量100m³/h → 选50-200/15泵" | ❌ 学不到 |
| **配套选型** | "选DN50阀门 → 必选DN50法兰" | ❌ 学不到 |
| **材质选择** | "腐蚀性流体 → 选不锈钢" | ❌ 学不到 |

**缺失的学习输入：**
```
❌ 没有：PID图（功能需求）
❌ 没有：工况参数（压力、温度、流量）
❌ 没有：流体特性（腐蚀性、粘度）
```

**无法回答的问题：**
- ❌ "管道是DN50，应该选什么阀门？"
- ❌ "压力是16bar，应该选什么压力等级？"
- ❌ "流量是100m³/h，应该选什么泵？"

---

## 🔍 为什么学不到选型知识？

### 根本原因：缺少**功能需求与零件规格的关联**

**完整的学习样本应该包含：**

```
学习案例 = PID图 + BOM + 装配图STEP + (可选)零件图

PID图告诉我们：
├─ 管道口径：DN50
├─ 工作压力：16 bar
├─ 流体类型：水/腐蚀性液体
├─ 流量：100 m³/h
└─ 设备连接关系

BOM告诉我们：
├─ 选择了：DN50 PN16球阀
├─ 选择了：50-200/15离心泵
└─ 选择了：DN50 PN16法兰

装配图STEP告诉我们：
└─ 如何装配这些零件

完整学习 = PID功能需求 → 零件选型决策 → 装配关系
```

**现在只有：**
```
❌ BOM + STEP
只能学到：已知零件如何装配
不能学到：如何选择零件
```

---

## 🛠️ 完整解决方案

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│  学习阶段：建立知识库                                          │
└─────────────────────────────────────────────────────────────┘

输入：完整工程案例
├─ PID图（功能需求）
├─ BOM清单（选型结果）
├─ 装配图STEP（装配方案）
└─ 设计说明（可选）

         ↓

┌──────────────────────────────────────────────────────────────┐
│  提取三类知识                                                  │
├──────────────────────────────────────────────────────────────┤
│  1️⃣ 选型知识（PID → BOM）                                     │
│     - PID管道DN50 → 选DN50阀门、DN50法兰                       │
│     - PID压力16bar → 选PN16零件                               │
│     - PID流量100m³/h → 选50-200/15泵                          │
│                                                               │
│  2️⃣ 配套知识（BOM → BOM）                                     │
│     - 选DN50阀门 → 必须选DN50法兰                              │
│     - 选PN16阀门 → 必须选PN16法兰                              │
│     - 选DN50法兰 → 需要M8螺栓(4-8个)                           │
│                                                               │
│  3️⃣ 装配知识（BOM → STEP）                                    │
│     - 阀门+法兰 → SCREW连接，4螺栓，间距5mm                     │
│     - 泵+底座 → 固定，4个地脚螺栓                              │
└──────────────────────────────────────────────────────────────┘

         ↓

存储到知识库
├─ 选型规则库（Selection Rules）
├─ 配套规则库（Matching Rules）
└─ 装配规则库（Assembly Rules）


┌─────────────────────────────────────────────────────────────┐
│  应用阶段：自动设计                                            │
└─────────────────────────────────────────────────────────────┘

输入：新的PID图

         ↓

1️⃣ PID识别
   - 识别设备类型（泵、阀门、仪表）
   - 提取工况参数（DN、压力、流量）
   - 提取流体特性

         ↓

2️⃣ 自动选型（使用选型规则库）
   查询规则：
   - "PID管道DN50" → 匹配规则 → 选"DN50球阀"
   - "PID压力16bar" → 匹配规则 → 选"PN16"等级
   - "PID流量100m³/h" → 匹配规则 → 选"50-200/15泵"

   输出：初步BOM清单

         ↓

3️⃣ 配套补充（使用配套规则库）
   查询规则：
   - "已选DN50阀门" → 匹配规则 → 补充"DN50法兰"
   - "已选DN50法兰" → 匹配规则 → 补充"M8螺栓×4"
   - "已选PN16阀门" → 匹配规则 → 补充"PN16垫片"

   输出：完整BOM清单

         ↓

4️⃣ 自动装配（使用装配规则库）
   查询规则：
   - "阀门+法兰" → 匹配规则 → 生成SCREW约束(5mm, 4螺栓)
   - "泵+底座" → 匹配规则 → 生成固定约束

   输出：装配图STEP

         ↓

人工审核 → 导出交付物
```

---

## 💡 关键技术：如何提取选型知识

### 技术1：PID参数与BOM规格关联

**学习输入：**
```
PID图：
  - 管道标注：DN50, 16bar
  - 流体：水
  - 流量：100 m³/h

BOM清单：
  - V-001: 球阀, DN50, PN16, 不锈钢
  - F-001: 法兰, DN50, PN16, 碳钢
  - P-001: 离心泵, 50-200/15, 11kW
```

**关联分析：**
```python
# 提取关联规则
def extract_selection_rules(pid_data, bom_data):
    rules = []

    # 规则1: 管道口径 → 阀门口径
    pid_dn = extract_dn_from_pid(pid_data)  # DN50
    valve = find_valve_in_bom(bom_data)
    valve_dn = extract_dn_from_spec(valve.specification)  # DN50

    if pid_dn == valve_dn:
        rules.append({
            'rule_type': 'selection',
            'condition': {
                'pid_pipe_dn': pid_dn
            },
            'action': {
                'select_part_type': '球阀',
                'specification': f'DN{pid_dn}'
            },
            'confidence': 0.9,
            'reasoning': '管道口径与阀门口径匹配'
        })

    # 规则2: 压力等级 → 零件压力等级
    pid_pressure = extract_pressure_from_pid(pid_data)  # 16 bar
    pn_level = pressure_to_pn(pid_pressure)  # PN16

    for part in bom_data:
        if f'PN{pn_level}' in part.specification:
            rules.append({
                'rule_type': 'selection',
                'condition': {
                    'pid_pressure_bar': pid_pressure
                },
                'action': {
                    'select_pn_level': f'PN{pn_level}'
                },
                'confidence': 0.95,
                'reasoning': '压力16bar对应PN16等级'
            })

    # 规则3: 流量 → 泵型号
    pid_flow = extract_flow_from_pid(pid_data)  # 100 m³/h
    pump = find_pump_in_bom(bom_data)
    pump_model = pump.specification  # 50-200/15

    rules.append({
        'rule_type': 'selection',
        'condition': {
            'pid_flow_m3_h': pid_flow,
            'fluid_type': '水'
        },
        'action': {
            'select_part': '离心泵',
            'model': pump_model
        },
        'confidence': 0.85,
        'reasoning': f'流量{pid_flow}m³/h适用泵型号{pump_model}'
    })

    return rules
```

**学习结果示例：**
```json
{
  "rule_id": "SELECT_VALVE_BY_DN",
  "rule_name": "根据管道口径选择阀门",
  "condition": {
    "pid_pipe_dn": 50
  },
  "action": {
    "part_type": "球阀",
    "specification": "DN50"
  },
  "confidence": 0.95,
  "sample_count": 15
}
```

### 技术2：配套规则学习

**学习输入：**
```
BOM清单中的共现模式：
  - 球阀DN50 PN16  ←→  法兰DN50 PN16 (出现15次)
  - 法兰DN50      ←→  M8螺栓×4      (出现15次)
  - 不锈钢阀门     ←→  不锈钢法兰     (出现12次)
```

**配套规则提取：**
```python
def extract_matching_rules(bom_samples):
    # 统计零件共现频率
    co_occurrence = {}

    for bom in bom_samples:
        for i, part_a in enumerate(bom):
            for part_b in bom[i+1:]:
                # 检查规格匹配
                if has_common_spec(part_a, part_b):
                    key = (part_a.type, part_b.type, get_common_spec(part_a, part_b))
                    co_occurrence[key] = co_occurrence.get(key, 0) + 1

    # 生成配套规则
    rules = []
    for (type_a, type_b, spec), count in co_occurrence.items():
        if count >= 3:  # 至少出现3次
            rules.append({
                'rule_type': 'matching',
                'condition': {
                    'selected_part_type': type_a,
                    'selected_spec': spec
                },
                'action': {
                    'must_select_part_type': type_b,
                    'matching_spec': spec
                },
                'confidence': count / len(bom_samples),
                'sample_count': count
            })

    return rules
```

**学习结果示例：**
```json
{
  "rule_id": "MATCH_VALVE_FLANGE_DN",
  "rule_name": "阀门法兰口径配套规则",
  "condition": {
    "selected_part_type": "球阀",
    "selected_dn": 50
  },
  "action": {
    "must_select_part": "法兰",
    "matching_dn": 50
  },
  "confidence": 0.95,
  "reasoning": "阀门DN50必须配DN50法兰"
}
```

---

## 🚀 实施方案

### Phase 1: 增强学习能力（2周）

**目标：让系统能够学习选型和配套知识**

#### 1.1 扩展学习输入
```python
# 新增：完整案例学习API
POST /api/assembly/learn-complete-case

Request:
{
  "case_name": "化工管道系统_001",
  "pid_file": <PID图PDF>,
  "bom_file": <BOM Excel>,
  "assembly_file": <装配图STEP>
}

功能：
1. 解析PID提取工况参数（DN, 压力, 流量）
2. 解析BOM提取零件规格
3. 解析STEP提取装配关系
4. 关联三者数据
5. 提取三类知识（选型、配套、装配）
```

#### 1.2 创建选型知识提取器
```python
# apps/api/src/services/learning/SelectionRuleExtractor.py

class SelectionRuleExtractor:
    """
    从PID+BOM中提取选型规则
    """

    def extract_selection_rules(self, pid_data, bom_data):
        """
        提取选型规则

        输入：
        - pid_data: PID解析结果（管道、设备、参数）
        - bom_data: BOM零件清单

        输出：
        - 选型规则列表
        """
        rules = []

        # 1. 口径匹配规则
        rules.extend(self._extract_dn_rules(pid_data, bom_data))

        # 2. 压力等级规则
        rules.extend(self._extract_pressure_rules(pid_data, bom_data))

        # 3. 流量匹配规则
        rules.extend(self._extract_flow_rules(pid_data, bom_data))

        # 4. 材质选择规则
        rules.extend(self._extract_material_rules(pid_data, bom_data))

        return rules

    def _extract_dn_rules(self, pid_data, bom_data):
        """提取口径匹配规则"""
        rules = []

        # 找到PID中的管道
        for pipe in pid_data.get('pipes', []):
            pipe_dn = pipe.get('dn')
            if not pipe_dn:
                continue

            # 找到连接到这个管道的阀门
            connected_valves = self._find_connected_valves(pipe, pid_data, bom_data)

            for valve in connected_valves:
                valve_dn = self._extract_dn(valve.specification)

                if pipe_dn == valve_dn:
                    rules.append({
                        'rule_type': 'selection',
                        'condition': {
                            'type': 'pipe_dn_match',
                            'pid_element': 'pipe',
                            'pid_dn': pipe_dn
                        },
                        'action': {
                            'select_part_type': valve.type,
                            'select_dn': valve_dn
                        },
                        'confidence': 0.9,
                        'reasoning': f'管道DN{pipe_dn}选择DN{valve_dn}阀门'
                    })

        return rules
```

#### 1.3 创建配套规则提取器
```python
# apps/api/src/services/learning/MatchingRuleExtractor.py

class MatchingRuleExtractor:
    """
    从BOM中提取配套规则
    """

    def extract_matching_rules(self, bom_samples):
        """
        从多个BOM样本中提取配套规则

        输入：
        - bom_samples: 多个BOM清单的列表

        输出：
        - 配套规则列表
        """
        # 统计零件共现模式
        co_occurrence = defaultdict(lambda: {'count': 0, 'examples': []})

        for bom in bom_samples:
            # 找出规格相同的零件对
            for i, part_a in enumerate(bom):
                for part_b in bom[i+1:]:
                    # 检查DN匹配
                    dn_a = self._extract_dn(part_a.specification)
                    dn_b = self._extract_dn(part_b.specification)

                    if dn_a and dn_b and dn_a == dn_b:
                        key = (part_a.main_type, part_b.main_type, f'DN{dn_a}')
                        co_occurrence[key]['count'] += 1
                        co_occurrence[key]['examples'].append({
                            'part_a': part_a.name,
                            'part_b': part_b.name
                        })

        # 生成规则
        rules = []
        for (type_a, type_b, spec), data in co_occurrence.items():
            if data['count'] >= 3:  # 至少3个样本
                rules.append({
                    'rule_type': 'matching',
                    'rule_name': f'{type_a}与{type_b}{spec}配套规则',
                    'condition': {
                        'selected_part_type': type_a,
                        'selected_spec': spec
                    },
                    'action': {
                        'must_select_part_type': type_b,
                        'matching_spec': spec
                    },
                    'confidence': min(0.9, 0.5 + data['count'] * 0.1),
                    'sample_count': data['count'],
                    'examples': data['examples'][:3]
                })

        return rules
```

### Phase 2: 应用阶段（2周）

**目标：从新PID自动选型和装配**

#### 2.1 PID解析服务（已有，需增强）
```javascript
// 增强现有 PIDRecognitionService
// 不仅识别设备，还要提取参数

class PIDRecognitionService {
    recognizePID(pidFile) {
        return {
            devices: [
                {
                    type: '泵',
                    tag: 'P-101',
                    parameters: {
                        flow: 100,  // m³/h
                        head: 50    // m
                    }
                },
                {
                    type: '阀门',
                    tag: 'V-101',
                    connected_pipe: 'L-001'
                }
            ],
            pipes: [
                {
                    tag: 'L-001',
                    dn: 50,
                    pressure: 16,  // bar
                    fluid: '水'
                }
            ]
        }
    }
}
```

#### 2.2 自动选型服务
```javascript
// apps/api/src/services/selection/AutoSelectionService.js

class AutoSelectionService {
    /**
     * 根据PID自动选型
     */
    async selectParts(pidData) {
        const selectedParts = []
        const selectionRules = await this.loadSelectionRules()

        // 1. 为每个PID设备选择零件
        for (const device of pidData.devices) {
            // 查询选型规则
            const applicableRules = selectionRules.filter(rule =>
                this.matchCondition(rule.condition, device, pidData)
            )

            // 应用规则选择零件
            for (const rule of applicableRules) {
                const part = {
                    type: rule.action.select_part_type,
                    specification: this.buildSpecification(rule.action, device),
                    source_rule: rule.rule_id,
                    confidence: rule.confidence
                }
                selectedParts.push(part)
            }
        }

        // 2. 根据配套规则补充零件
        const matchingRules = await this.loadMatchingRules()
        const additionalParts = this.applyMatchingRules(selectedParts, matchingRules)

        return {
            primary_parts: selectedParts,
            additional_parts: additionalParts,
            total_parts: selectedParts.length + additionalParts.length
        }
    }

    matchCondition(condition, device, pidData) {
        if (condition.type === 'pipe_dn_match') {
            // 找到设备连接的管道
            const pipe = pidData.pipes.find(p =>
                p.tag === device.connected_pipe
            )
            return pipe && pipe.dn === condition.pid_dn
        }

        // ...更多条件匹配逻辑
    }
}
```

#### 2.3 完整流程API
```javascript
// apps/api/src/routes/assembly.js

/**
 * PID → 自动选型 → 自动装配 完整流程
 */
router.post('/pid-to-assembly-complete', authenticate, async (req, res) => {
    try {
        const { pidFile } = req.files

        // 1. PID识别
        const pidData = await pidRecognitionService.recognize(pidFile)

        // 2. 自动选型
        const selectionResult = await autoSelectionService.selectParts(pidData)

        // 3. 生成BOM
        const bom = selectionResult.primary_parts.concat(selectionResult.additional_parts)

        // 4. 自动装配（使用装配规则）
        const assemblyResult = await assemblyReasoningService.inferConstraints(
            bom,  // 自动生成的BOM
            [],   // 暂无STEP（首次设计）
            req.user.id
        )

        // 5. 生成3D模型
        const modelResult = await assembly3DService.generate(assemblyResult.constraints)

        res.json({
            success: true,
            pid_recognition: pidData,
            auto_selection: selectionResult,
            bom: bom,
            assembly_constraints: assemblyResult.constraints,
            model_preview: modelResult.preview_url
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})
```

---

## 📊 效果演示

### 学习阶段

**输入：15个历史工程案例**
```
案例1: PID(管道DN50,16bar) + BOM(DN50球阀,PN16法兰) + STEP
案例2: PID(管道DN80,25bar) + BOM(DN80球阀,PN25法兰) + STEP
...
案例15: ...
```

**学到的知识：**
```json
{
  "selection_rules": [
    {
      "rule": "管道DN50 → 选DN50阀门",
      "confidence": 0.95,
      "samples": 12
    },
    {
      "rule": "压力16bar → 选PN16零件",
      "confidence": 0.93,
      "samples": 10
    },
    {
      "rule": "流量100m³/h → 选50-200/15泵",
      "confidence": 0.85,
      "samples": 5
    }
  ],
  "matching_rules": [
    {
      "rule": "DN50阀门 → 必配DN50法兰",
      "confidence": 0.98,
      "samples": 15
    },
    {
      "rule": "DN50法兰 → 需M8螺栓×4",
      "confidence": 0.92,
      "samples": 13
    }
  ],
  "assembly_rules": [
    {
      "rule": "阀门+法兰 → SCREW(5mm,4螺栓)",
      "confidence": 0.95,
      "samples": 15
    }
  ]
}
```

### 应用阶段

**输入：新的PID图**
```
PID内容：
  - 管道L-001: DN50, 16bar, 水
  - 阀门V-101: 位于L-001上
  - 泵P-101: 流量100m³/h
```

**自动选型结果：**
```json
{
  "auto_selection": [
    {
      "part": "球阀",
      "specification": "DN50 PN16",
      "reason": "匹配规则：管道DN50→选DN50阀门，压力16bar→选PN16",
      "confidence": 0.95
    },
    {
      "part": "法兰",
      "specification": "DN50 PN16",
      "reason": "配套规则：DN50阀门必配DN50法兰",
      "confidence": 0.98
    },
    {
      "part": "M8螺栓",
      "quantity": 4,
      "reason": "配套规则：DN50法兰需M8螺栓×4",
      "confidence": 0.92
    },
    {
      "part": "离心泵",
      "model": "50-200/15",
      "reason": "流量100m³/h匹配泵型号",
      "confidence": 0.85
    }
  ],
  "generated_bom": [
    "V-101: 球阀 DN50 PN16 ×1",
    "F-101: 法兰 DN50 PN16 ×2",
    "B-101: M8螺栓 ×8",
    "P-101: 离心泵 50-200/15 ×1"
  ]
}
```

**自动装配结果：**
```json
{
  "assembly_constraints": [
    {
      "part_a": "球阀V-101",
      "part_b": "法兰F-101",
      "constraint": "SCREW",
      "distance_mm": 5,
      "bolt_count": 4,
      "reason": "装配规则：阀门+法兰螺栓连接",
      "confidence": 0.95
    }
  ],
  "3d_model": "assembly_001.step"
}
```

---

## ✅ 总结

### 能学到的知识

| 知识类型 | 现状 | 修复后 |
|---------|-----|--------|
| 装配规则 | ✅ 能学 | ✅ 能学（更好） |
| 选型规则 | ❌ 不能学 | ✅ **能学**（新增） |
| 配套规则 | ❌ 不能学 | ✅ **能学**（新增） |

### 能回答的问题

| 问题 | 现状 | 修复后 |
|-----|-----|--------|
| "为什么选DN50？" | ❌ 不知道 | ✅ **"因为管道是DN50"** |
| "为什么选PN16？" | ❌ 不知道 | ✅ **"因为压力是16bar"** |
| "为什么配DN50法兰？" | ❌ 不知道 | ✅ **"因为阀门是DN50"** |
| "为什么4个螺栓？" | ❌ 不知道 | ✅ **"DN50法兰标准配置"** |
| "下次能自动选型吗？" | ❌ 不能 | ✅ **能！** |

### 实施时间

- **Phase 1** (学习能力): 2周
- **Phase 2** (应用能力): 2周
- **总计**: 4周完整实现

---

## 🚀 立即开始？

我建议从**Phase 1开始**，先让系统能够学习选型知识。

需要我立即实施吗？

---

## 🔧 关键问题：连接件和辅助件如何选择？

### 您的追问

> "连接件（螺栓、垫片）和管线，这些PID图上是没有的，我们知道要找什么样的件吗？"

**核心矛盾：**
- PID图只标注**主设备**（泵、阀门、罐体）和**管线参数**（DN、压力）
- 但装配需要大量**连接件**（法兰、螺栓、垫片）和**辅助件**（支架、密封圈）
- 这些在PID图上**没有标注**

---

### 解决方案：配套规则库

**关键思想：从主零件推导辅助零件**

```
PID图告诉我们主设备：
├─ 球阀（但不知道需要法兰）
├─ 管道DN50（但不知道需要法兰、支架）
└─ 泵（但不知道需要底座、联轴器）

通过学习，系统知道：
├─ "选了球阀" → 自动配套"法兰×2"
├─ "选了法兰DN50" → 自动配套"M8螺栓×4 + DN50垫片×1"
├─ "选了管道DN50" → 自动配套"管卡 + 支架（每3米）"
└─ "选了泵" → 自动配套"底座 + 地脚螺栓 + 联轴器"
```

---

### 示例：从PID到完整BOM

#### PID图内容（简化）

```
PID标注：
┌────────────────────────────────────┐
│  L-001: DN50, 16bar, 水            │
│         ↓                          │
│  [V-101]  球阀                     │
│         ↓                          │
│  L-002: DN50, 16bar                │
│         ↓                          │
│  [P-101]  离心泵, 100m³/h          │
└────────────────────────────────────┘

PID上只有：
✅ 管线标识 (L-001, L-002)
✅ 管线参数 (DN50, 16bar)
✅ 主设备 (阀门、泵)
✅ 工况参数 (流量)

PID上没有：
❌ 法兰
❌ 螺栓
❌ 垫片
❌ 支架
❌ 管件（弯头、三通）
```

#### 第1步：PID识别 + 初步选型

```
系统识别：
  - 设备：球阀V-101
  - 设备：离心泵P-101
  - 管道：L-001 (DN50, 16bar)
  - 管道：L-002 (DN50, 16bar)

初步选型（使用选型规则）：
  ✅ V-101: 球阀 DN50 PN16 ×1
  ✅ P-101: 离心泵 50-200/15 ×1
  ✅ L-001管道: 直管DN50 PN16 ×5m（估算）
  ✅ L-002管道: 直管DN50 PN16 ×3m（估算）
```

此时BOM还不完整，缺少连接件！

#### 第2步：配套规则补充

**规则1：阀门需要法兰**
```
IF 选择了"球阀 DN50"
THEN 必须配套：
  - 法兰 DN50 PN16 ×2  (阀门两端)
  - 理由：阀门法兰连接标准配置
  - 置信度：0.98 (从15个案例中学到，100%出现)
```

**规则2：法兰需要螺栓和垫片**
```
IF 选择了"法兰 DN50 PN16"
THEN 必须配套：
  - M8螺栓 ×4  (每个法兰连接)
  - M8螺母 ×4
  - DN50垫片 ×1
  - 理由：DN50法兰标准配置（国标/从历史学习）
  - 置信度：0.95
```

**规则3：泵需要底座和联轴器**
```
IF 选择了"离心泵 50-200/15"
THEN 必须配套：
  - 泵底座 ×1
  - 地脚螺栓M16 ×4
  - 联轴器 ×1
  - 法兰DN50 ×2  (泵进出口)
  - 理由：泵的标准安装配置
  - 置信度：0.92
```

**规则4：管道需要支架**
```
IF 选择了"管道 DN50, 长度8m"
THEN 必须配套：
  - 管卡DN50 ×3  (每3米一个)
  - U型支架 ×3
  - 膨胀螺栓M10 ×12  (每个支架4个)
  - 理由：管道支撑标准要求
  - 置信度：0.90
```

#### 第3步：完整BOM清单

```
应用配套规则后，生成完整BOM：

【主设备】(PID上有的)
  ✅ V-101: 球阀 DN50 PN16                ×1

【管道系统】(PID上有的)
  ✅ L-001: 直管 DN50 PN16, 5m            ×1
  ✅ L-002: 直管 DN50 PN16, 3m            ×1

【泵系统】(PID上有的)
  ✅ P-101: 离心泵 50-200/15             ×1

【法兰】(配套补充)
  🔧 F-001: 法兰 DN50 PN16              ×2  (阀门配套)
  🔧 F-002: 法兰 DN50 PN16              ×2  (泵配套)
  🔧 F-003: 法兰 DN50 PN16              ×2  (管道连接)

【螺栓/螺母】(配套补充)
  🔧 B-001: M8六角螺栓, L=60mm          ×24 (6个法兰×4)
  🔧 N-001: M8六角螺母                  ×24
  🔧 B-002: M16地脚螺栓, L=200mm        ×4  (泵底座)

【垫片】(配套补充)
  🔧 G-001: DN50石棉垫片                ×6  (6个法兰连接)

【支架系统】(配套补充)
  🔧 S-001: 管卡DN50                    ×3  (8m管道)
  🔧 S-002: U型支架                     ×3
  🔧 S-003: 膨胀螺栓M10, L=80mm         ×12 (3支架×4)

【泵安装】(配套补充)
  🔧 BASE-001: 泵底座                   ×1
  🔧 COUP-001: 联轴器                   ×1

总计：12种主件 + 辅助件，共约70个零件
```

---

### 配套规则的两种来源

#### 来源1：标准规范（硬编码）

```javascript
// 标准规范规则（可靠性高）
const STANDARD_RULES = [
    {
        rule_id: 'STD_FLANGE_BOLT_DN50',
        source: '国标GB/T 9119-2010',
        condition: {
            part_type: '法兰',
            dn: 50,
            pn: 16
        },
        action: {
            add_parts: [
                { type: 'M8螺栓', quantity: 4 },
                { type: 'M8螺母', quantity: 4 },
                { type: 'DN50垫片', quantity: 1 }
            ]
        },
        confidence: 1.0  // 标准规范，100%可信
    },

    {
        rule_id: 'STD_PIPE_SUPPORT',
        source: 'HG/T 20593管道支架标准',
        condition: {
            part_type: '管道',
            dn_min: 40,
            dn_max: 80
        },
        action: {
            add_parts_per_meter: {
                support_interval: 3,  // 每3米一个支架
                parts: [
                    { type: '管卡', spec: 'DN{dn}' },
                    { type: 'U型支架' },
                    { type: '膨胀螺栓M10', quantity: 4 }
                ]
            }
        },
        confidence: 1.0
    }
]
```

#### 来源2：历史案例学习（数据驱动）

```python
def learn_matching_rules_from_history(bom_samples):
    """
    从历史BOM中学习配套规则
    
    输入：15个历史工程的BOM清单
    输出：配套规则
    """
    
    # 统计共现模式
    co_occurrence = defaultdict(lambda: {'count': 0, 'specs': []})
    
    for bom in bom_samples:
        # 找出阀门
        valves = [p for p in bom if p.type == '球阀']
        
        for valve in valves:
            valve_dn = extract_dn(valve.specification)
            
            # 统计这个阀门周围配套了什么
            flanges = find_nearby_parts(bom, valve, '法兰')
            bolts = find_nearby_parts(bom, valve, '螺栓')
            
            if flanges:
                flange_dn = extract_dn(flanges[0].specification)
                if flange_dn == valve_dn:
                    key = f'valve_DN{valve_dn}_needs_flange'
                    co_occurrence[key]['count'] += 1
                    co_occurrence[key]['specs'].append({
                        'flange_count': len(flanges),
                        'flange_spec': flanges[0].specification
                    })
            
            if bolts:
                bolt_thread = extract_thread(bolts[0].specification)
                bolt_count = len(bolts)
                key = f'flange_DN{valve_dn}_needs_bolt_{bolt_thread}'
                co_occurrence[key]['count'] += 1
                co_occurrence[key]['specs'].append({
                    'bolt_count': bolt_count
                })
    
    # 生成规则
    rules = []
    for key, data in co_occurrence.items():
        if data['count'] >= 5:  # 至少5个样本
            # 统计最常见的配置
            most_common_config = find_most_common(data['specs'])
            
            rules.append({
                'rule_id': f'LEARNED_{key}',
                'source': 'learned_from_history',
                'confidence': min(0.95, 0.6 + data['count'] * 0.05),
                'sample_count': data['count'],
                'config': most_common_config
            })
    
    return rules

# 学习结果示例：
"""
从15个案例中学到：
- 球阀DN50出现12次，每次都配了2个DN50法兰 → 置信度0.95
- DN50法兰出现25次，其中23次配了4个M8螺栓 → 置信度0.92
- DN50法兰出现25次，其中2次配了8个M8螺栓 → 置信度0.08 (不采纳)
"""
```

---

### 混合策略：标准 + 学习

```javascript
class MatchingRuleEngine {
    /**
     * 应用配套规则
     * 优先使用标准规范，其次使用学习规则
     */
    async applyMatchingRules(selectedParts) {
        const additionalParts = []
        
        // 1. 加载标准规范规则（高优先级）
        const standardRules = await this.loadStandardRules()
        
        // 2. 加载学习规则（低优先级，作为补充）
        const learnedRules = await this.loadLearnedRules()
        
        // 3. 合并规则（标准规则覆盖学习规则）
        const allRules = this.mergeRules(standardRules, learnedRules)
        
        // 4. 为每个已选零件应用配套规则
        for (const part of selectedParts) {
            const applicableRules = allRules.filter(rule =>
                this.matchCondition(rule.condition, part)
            )
            
            // 按置信度排序（标准规则confidence=1.0优先）
            applicableRules.sort((a, b) => b.confidence - a.confidence)
            
            // 应用规则
            for (const rule of applicableRules) {
                const newParts = this.generateParts(rule.action, part)
                additionalParts.push(...newParts)
            }
        }
        
        return additionalParts
    }
    
    mergeRules(standardRules, learnedRules) {
        // 标准规则优先，学习规则作为补充
        const merged = [...standardRules]
        
        for (const learnedRule of learnedRules) {
            // 检查是否与标准规则冲突
            const hasConflict = standardRules.some(std =>
                this.isConflicting(std, learnedRule)
            )
            
            if (!hasConflict) {
                merged.push(learnedRule)
            }
        }
        
        return merged
    }
}
```

---

### 实际应用示例

#### 案例：管道系统自动补全

**输入：PID识别结果**
```json
{
  "devices": [
    {"type": "球阀", "tag": "V-101", "connected_pipe": "L-001"}
  ],
  "pipes": [
    {
      "tag": "L-001",
      "dn": 50,
      "pressure": 16,
      "length": 8.0,
      "material": "碳钢"
    }
  ]
}
```

**步骤1：初步选型（主设备）**
```json
{
  "primary_parts": [
    {
      "part_number": "V-101",
      "type": "球阀",
      "specification": "DN50 PN16",
      "quantity": 1,
      "source": "pid_device"
    },
    {
      "part_number": "PIPE-001",
      "type": "直管",
      "specification": "DN50 PN16, L=8000mm",
      "quantity": 1,
      "source": "pid_pipe"
    }
  ]
}
```

**步骤2：应用配套规则（自动补全）**
```json
{
  "additional_parts": [
    // 规则1：球阀需要法兰
    {
      "part_number": "F-101",
      "type": "法兰",
      "specification": "DN50 PN16 对焊法兰",
      "quantity": 2,
      "source_rule": "STD_VALVE_FLANGES",
      "reasoning": "球阀两端需要法兰连接",
      "confidence": 1.0
    },
    
    // 规则2：法兰需要螺栓
    {
      "part_number": "B-101",
      "type": "六角螺栓",
      "specification": "M8×60",
      "quantity": 8,
      "source_rule": "STD_FLANGE_BOLT_DN50",
      "reasoning": "DN50法兰标准配置4螺栓×2连接",
      "confidence": 1.0
    },
    
    // 规则3：法兰需要螺母
    {
      "part_number": "N-101",
      "type": "六角螺母",
      "specification": "M8",
      "quantity": 8,
      "source_rule": "STD_FLANGE_BOLT_DN50",
      "reasoning": "配套螺栓",
      "confidence": 1.0
    },
    
    // 规则4：法兰需要垫片
    {
      "part_number": "G-101",
      "type": "垫片",
      "specification": "DN50 石棉橡胶垫片",
      "quantity": 2,
      "source_rule": "STD_FLANGE_GASKET",
      "reasoning": "法兰密封",
      "confidence": 1.0
    },
    
    // 规则5：管道需要支架
    {
      "part_number": "S-101",
      "type": "管卡",
      "specification": "DN50 U型管卡",
      "quantity": 3,
      "source_rule": "STD_PIPE_SUPPORT",
      "reasoning": "8米管道需3个支架(每3米)",
      "confidence": 1.0
    },
    
    {
      "part_number": "S-102",
      "type": "支架",
      "specification": "U型支架 DN50",
      "quantity": 3,
      "source_rule": "STD_PIPE_SUPPORT",
      "reasoning": "配套管卡",
      "confidence": 1.0
    },
    
    {
      "part_number": "B-102",
      "type": "膨胀螺栓",
      "specification": "M10×80",
      "quantity": 12,
      "source_rule": "STD_PIPE_SUPPORT",
      "reasoning": "支架固定(每个支架4螺栓×3)",
      "confidence": 1.0
    }
  ]
}
```

**最终完整BOM：**
```
主设备（PID识别）：
  V-101: 球阀 DN50 PN16                    ×1
  PIPE-001: 直管 DN50 PN16, L=8m           ×1

辅助件（配套规则自动补充）：
  F-101: 法兰 DN50 PN16                    ×2
  B-101: M8×60螺栓                        ×8
  N-101: M8螺母                           ×8
  G-101: DN50垫片                         ×2
  S-101: DN50管卡                         ×3
  S-102: U型支架                          ×3
  B-102: M10×80膨胀螺栓                   ×12

总计：8种零件，共39个
```

---

## ✅ 总结回答您的问题

### Q: 连接件和管线在PID上没有，系统知道要找什么件吗？

**A: 知道！通过配套规则**

1. **标准规范规则**（硬编码，100%可信）
   - 国标：DN50法兰配M8螺栓×4
   - 行业标准：管道每3米一个支架
   - 机械设计手册：泵需要底座和联轴器

2. **历史案例学习**（数据驱动，85-95%置信度）
   - 从15个案例学到：DN50阀门总是配2个DN50法兰
   - 从20个案例学到：DN50法兰92%的时候配4个螺栓
   - 从10个案例学到：不锈钢阀门配不锈钢法兰

3. **混合策略**
   - 优先使用标准规范（高可信度）
   - 标准未覆盖时使用学习规则
   - 学习规则可以发现新模式

**流程：**
```
PID图（只有主设备） 
  → 选型规则（选主设备）
  → 配套规则（自动补充连接件、辅助件）
  → 完整BOM清单
```

这样，即使PID图上没有标注螺栓、垫片、支架，系统也能自动推导出来！
