# 装配规则学习系统 - 问题诊断与修复方案

## 📌 问题诊断

### 现有学习流程的致命缺陷

**当前流程：**
```
用户点击"重新学习规则"
→ 调用 /api/assembly/learn-rules
→ 执行 Python脚本 extract_assembly_rules.py
→ 扫描 docs/solidworks/ 目录
→ 只解析STEP文件
→ 输出 assembly_rules.json
```

**致命问题分析：**

| 问题 | 现状 | 影响 | 严重程度 |
|------|------|------|----------|
| **❌ 无BOM数据** | 只有STEP几何数据 | 零件没有名称、规格、型号，无法识别零件类型 | 🔴 致命 |
| **❌ 无零件特征** | 没有PDF解析 | 不知道零件接口类型、尺寸、功能属性 | 🔴 致命 |
| **❌ 无数据关联** | BOM、STEP、PDF各自独立 | 无法建立完整的零件知识 | 🔴 致命 |
| **❌ 规则太简单** | 只是统计频率 | 学到的是"60%是同轴配合"，而不是"VCR接头用同轴配合" | 🔴 致命 |
| **❌ 无条件逻辑** | 规则没有if-then结构 | 无法根据零件类型匹配规则 | 🔴 致命 |
| **❌ 无法应用** | 规则不可查询、不可匹配 | 生成装配时无法使用学到的规则 | 🔴 致命 |

### 现有代码问题详解

#### 1. extract_assembly_rules.py 的局限性

**当前提取的信息：**
```python
# 只有几何数据
{
  'mate_types': {
    'concentric': 120,      # 同轴配合120次
    'perpendicular': 45,    # 垂直配合45次
    'unknown': 30           # 未知30次
  },
  'typical_distances': [
    {'distance_mm': 50, 'occurrences': 15},  # 50mm出现15次
    {'distance_mm': 100, 'occurrences': 10}  # 100mm出现10次
  ]
}
```

**缺少的语义信息：**
```
❌ 没有：零件名称（法兰、阀门、泵）
❌ 没有：零件规格（DN50、PN16）
❌ 没有：接口类型（VCR接头、卡套接头、法兰接口）
❌ 没有：功能属性（流体类型、压力等级）
❌ 没有：条件规则（IF零件A是法兰 AND 零件B是阀门 THEN 使用螺栓连接）
```

**导致的问题：**
- ✅ 能学到："大多数零件用同轴配合"
- ❌ 无法学到："VCR接头与管道连接时用同轴配合，距离50mm，对齐方式ALIGNED"

#### 2. 前端调用流程的问题

**用户操作流程：**
```
1. 用户上传STEP文件到 docs/solidworks/
2. 点击"重新学习规则"按钮
3. 后端调用 extract_assembly_rules.py
4. 生成 assembly_rules.json
5. 前端读取规则显示
```

**问题：**
- ❌ 用户没有上传BOM文件的入口
- ❌ 用户没有上传零件图PDF的入口
- ❌ 系统没有要求用户提供零件编号映射

#### 3. 学到的规则无法应用

**现有规则格式：**
```json
{
  "rule_id": "MATE_CONCENTRIC",
  "type": "mate_type_frequency",
  "mate_type": "concentric",
  "probability": 0.615,
  "sample_count": 120,
  "description": "concentric配合占61.5%"
}
```

**问题：**
- ❌ 没有条件（condition）：什么情况下应用这个规则？
- ❌ 没有参数（parameters）：具体怎么装配？
- ❌ 没有零件类型（part_types）：适用于哪些零件？

**期望的规则格式：**
```json
{
  "rule_id": "VCR_PIPE_CONNECTION",
  "rule_name": "VCR接头与管道连接规则",
  "condition": {
    "part_a_type": "VCR接头",
    "part_b_type": "管道",
    "connection_type": "流体连接"
  },
  "action": {
    "constraint_type": "CONCENTRIC",
    "alignment": "ALIGNED",
    "typical_distance_mm": 50,
    "tolerance_mm": 5
  },
  "confidence": 0.95,
  "sample_count": 25,
  "source_assemblies": ["Assembly_001.step", "Assembly_005.step"]
}
```

---

## 🔧 完整修复方案

### 修复目标

**让学习流程真正有用：**
1. ✅ 能够从BOM + STEP + PDF学习
2. ✅ 学到的规则包含语义信息（零件类型、功能）
3. ✅ 学到的规则是条件规则（if-then结构）
4. ✅ 学到的规则可以应用到新的装配场景

### 实施方案

#### 阶段1：BOM解析与关联（最关键）

**1.1 创建BOM解析器**

```python
# apps/api/src/services/learning/BOMParser.py

import pandas as pd
from typing import List, Dict

class BOMParser:
    """
    BOM文件解析器
    支持Excel格式，提取零件清单
    """

    def parse_excel(self, file_path: str) -> List[Dict]:
        """
        解析BOM Excel文件

        预期格式：
        | 零件编号 | 零件名称 | 规格型号 | 数量 | 备注 |
        |---------|---------|---------|------|------|
        | V-001   | 球阀     | DN50 PN16 | 2  | 不锈钢 |
        | P-001   | 离心泵   | 50-200/15 | 1  |        |
        """
        df = pd.read_excel(file_path)

        # 标准化列名
        column_mapping = {
            '零件编号': 'part_number',
            '零件名称': 'part_name',
            '规格型号': 'specification',
            '数量': 'quantity',
            '备注': 'notes'
        }

        df.rename(columns=column_mapping, inplace=True)

        # 提取零件信息
        parts = []
        for _, row in df.iterrows():
            part = {
                'part_number': str(row.get('part_number', '')).strip(),
                'part_name': str(row.get('part_name', '')).strip(),
                'specification': str(row.get('specification', '')).strip(),
                'quantity': int(row.get('quantity', 1)),
                'notes': str(row.get('notes', '')).strip(),

                # 智能提取规格参数
                'extracted_params': self._extract_specs(
                    row.get('part_name', ''),
                    row.get('specification', '')
                )
            }
            parts.append(part)

        return parts

    def _extract_specs(self, part_name: str, specification: str) -> Dict:
        """
        从规格型号中提取参数
        例如: "DN50 PN16" → {'DN': 50, 'PN': 16}
        """
        import re
        params = {}

        combined = f"{part_name} {specification}"

        # 提取DN参数
        dn_match = re.search(r'DN\s*(\d+)', combined, re.IGNORECASE)
        if dn_match:
            params['DN'] = int(dn_match.group(1))

        # 提取PN参数
        pn_match = re.search(r'PN\s*(\d+)', combined, re.IGNORECASE)
        if pn_match:
            params['PN'] = int(pn_match.group(1))

        # 提取材质
        materials = ['不锈钢', '碳钢', '铸铁', '铝合金', 'stainless', 'steel']
        for material in materials:
            if material.lower() in combined.lower():
                params['material'] = material
                break

        # 提取零件大类
        part_types = {
            '阀': 'valve',
            'valve': 'valve',
            '泵': 'pump',
            'pump': 'pump',
            '法兰': 'flange',
            'flange': 'flange',
            '接头': 'connector',
            'connector': 'connector'
        }
        for keyword, part_type in part_types.items():
            if keyword in combined.lower():
                params['part_type'] = part_type
                break

        return params
```

**1.2 创建STEP与BOM关联逻辑**

```python
# apps/api/src/services/learning/AssemblyDataCorrelator.py

from typing import List, Dict
from difflib import SequenceMatcher

class AssemblyDataCorrelator:
    """
    关联BOM数据与STEP装配数据
    """

    def correlate(
        self,
        bom_parts: List[Dict],
        step_assembly_data: Dict
    ) -> Dict:
        """
        关联BOM零件与STEP零件

        策略：
        1. 基于零件编号精确匹配（如果STEP中有零件名）
        2. 基于数量匹配（BOM中数量=2，STEP中某类型零件也是2个）
        3. 基于位置和几何特征推理
        """

        correlations = []

        # 提取STEP中的零件
        step_parts = step_assembly_data.get('parts', [])
        step_placements = step_assembly_data.get('placements', {})

        # 方法1：尝试从STEP文件名或注释中提取编号
        for step_part in step_parts:
            part_id = step_part.get('id', '')

            # 尝试从ID中提取信息（有些STEP文件会包含零件名）
            for bom_part in bom_parts:
                bom_number = bom_part['part_number']

                # 模糊匹配
                if self._fuzzy_match(bom_number, part_id):
                    correlations.append({
                        'bom_part': bom_part,
                        'step_part': step_part,
                        'confidence': 0.9,
                        'match_method': 'name_match'
                    })
                    break

        # 方法2：基于数量推理
        if not correlations:
            # 统计STEP中每种几何特征的数量
            step_types = {}
            for part in step_parts:
                volume = part.get('volume', 0)
                vol_key = round(volume / 1000) * 1000  # 按体积分组
                step_types[vol_key] = step_types.get(vol_key, 0) + 1

            # 匹配BOM中的数量
            for bom_part in bom_parts:
                qty = bom_part['quantity']

                # 找到数量匹配的STEP零件组
                for vol_key, count in step_types.items():
                    if count == qty:
                        # 找到该体积的所有零件
                        matched_parts = [
                            p for p in step_parts
                            if round(p.get('volume', 0) / 1000) * 1000 == vol_key
                        ]

                        for matched_part in matched_parts:
                            correlations.append({
                                'bom_part': bom_part,
                                'step_part': matched_part,
                                'confidence': 0.6,
                                'match_method': 'quantity_match'
                            })

        return {
            'correlations': correlations,
            'matched_count': len(correlations),
            'unmatched_bom': self._find_unmatched_bom(bom_parts, correlations),
            'unmatched_step': self._find_unmatched_step(step_parts, correlations)
        }

    def _fuzzy_match(self, text1: str, text2: str, threshold: float = 0.6) -> bool:
        """模糊匹配两个字符串"""
        ratio = SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
        return ratio >= threshold

    def _find_unmatched_bom(self, bom_parts, correlations):
        """找出未匹配的BOM零件"""
        matched_numbers = {c['bom_part']['part_number'] for c in correlations}
        return [p for p in bom_parts if p['part_number'] not in matched_numbers]

    def _find_unmatched_step(self, step_parts, correlations):
        """找出未匹配的STEP零件"""
        matched_ids = {c['step_part']['id'] for c in correlations}
        return [p for p in step_parts if p['id'] not in matched_ids]
```

**1.3 创建智能规则提取器**

```python
# apps/api/src/services/learning/SmartRuleExtractor.py

from collections import defaultdict
from typing import List, Dict

class SmartRuleExtractor:
    """
    智能规则提取器 - 提取语义化的装配规则
    """

    def extract_rules(
        self,
        correlated_data: Dict,
        step_connections: List[Dict]
    ) -> List[Dict]:
        """
        从关联数据中提取智能规则

        输入：
        - correlated_data: BOM与STEP的关联数据
        - step_connections: STEP中的连接关系

        输出：
        - 语义化规则列表
        """

        rules = []
        correlations = correlated_data.get('correlations', [])

        # 按零件类型分组连接
        type_connections = defaultdict(list)

        for conn in step_connections:
            part_a_id = conn['part1']
            part_b_id = conn['part2']

            # 找到对应的BOM零件
            part_a_bom = self._find_bom_by_step_id(part_a_id, correlations)
            part_b_bom = self._find_bom_by_step_id(part_b_id, correlations)

            if part_a_bom and part_b_bom:
                # 提取零件类型
                type_a = part_a_bom.get('extracted_params', {}).get('part_type', 'unknown')
                type_b = part_b_bom.get('extracted_params', {}).get('part_type', 'unknown')

                connection_key = tuple(sorted([type_a, type_b]))
                type_connections[connection_key].append({
                    'part_a': part_a_bom,
                    'part_b': part_b_bom,
                    'connection': conn,
                    'mate_type': conn.get('type', 'unknown'),
                    'distance': conn.get('distance', 0),
                    'relative_position': conn.get('relative_position', [0, 0, 0])
                })

        # 为每种零件组合生成规则
        for connection_types, connections in type_connections.items():
            if len(connections) < 2:  # 至少出现2次才生成规则
                continue

            type_a, type_b = connection_types

            # 统计该组合的配合类型
            mate_types = [c['mate_type'] for c in connections]
            most_common_mate = max(set(mate_types), key=mate_types.count)
            mate_confidence = mate_types.count(most_common_mate) / len(mate_types)

            # 统计典型距离
            distances = [c['distance'] for c in connections]
            avg_distance = sum(distances) / len(distances)
            std_distance = (sum((d - avg_distance) ** 2 for d in distances) / len(distances)) ** 0.5

            # 生成规则
            rule = {
                'rule_id': f'{type_a.upper()}_{type_b.upper()}_CONNECTION',
                'rule_name': f'{type_a}与{type_b}连接规则',

                # ✅ 条件（Condition）
                'condition': {
                    'part_a_type': type_a,
                    'part_b_type': type_b,
                    'connection_pattern': 'direct_connection'
                },

                # ✅ 动作（Action）
                'action': {
                    'constraint_type': most_common_mate.upper(),
                    'typical_distance_mm': round(avg_distance, 2),
                    'distance_tolerance_mm': round(std_distance * 2, 2),
                    'alignment': 'ALIGNED' if most_common_mate == 'concentric' else 'ANY'
                },

                # ✅ 元数据
                'confidence': round(mate_confidence, 3),
                'sample_count': len(connections),
                'source_assemblies': list(set(c['connection'].get('source_file', 'unknown') for c in connections)),

                # ✅ 示例数据（用于调试）
                'examples': [
                    {
                        'part_a_name': c['part_a']['part_name'],
                        'part_b_name': c['part_b']['part_name'],
                        'distance': c['distance']
                    }
                    for c in connections[:3]  # 保留前3个示例
                ],

                'created_at': self._get_timestamp()
            }

            rules.append(rule)

        return rules

    def _find_bom_by_step_id(self, step_id: str, correlations: List[Dict]):
        """根据STEP零件ID查找对应的BOM零件"""
        for corr in correlations:
            if corr['step_part']['id'] == step_id:
                return corr['bom_part']
        return None

    def _get_timestamp(self):
        from datetime import datetime
        return datetime.now().isoformat()
```

#### 阶段2：完整学习流程实现

**2.1 创建学习流程编排器**

```python
# apps/api/src/services/learning/CompleteLearningPipeline.py

import os
import json
from pathlib import Path
from typing import Dict, List

from .BOMParser import BOMParser
from .AssemblyDataCorrelator import AssemblyDataCorrelator
from .SmartRuleExtractor import SmartRuleExtractor

# 复用现有的STEP解析
import sys
sys.path.append(os.path.dirname(__file__) + '/../assembly')
from learn_assembly_rules import extract_assembly_structure, learn_assembly_rules

class CompleteLearningPipeline:
    """
    完整的装配规则学习流程

    流程：
    1. 解析BOM Excel文件
    2. 解析STEP装配文件
    3. 关联BOM与STEP数据
    4. 提取智能规则
    5. 存储到数据库
    """

    def __init__(self):
        self.bom_parser = BOMParser()
        self.correlator = AssemblyDataCorrelator()
        self.rule_extractor = SmartRuleExtractor()

    def learn_from_complete_assembly(
        self,
        bom_file_path: str,
        step_file_path: str,
        part_drawings_dir: str = None,  # 可选：零件图PDF目录
        output_dir: str = None
    ) -> Dict:
        """
        从完整装配案例中学习规则

        参数：
        - bom_file_path: BOM Excel文件路径
        - step_file_path: 装配体STEP文件路径
        - part_drawings_dir: 零件图PDF目录（可选，暂不实现）
        - output_dir: 输出目录

        返回：
        - 学习结果报告
        """

        print("🚀 开始完整学习流程")
        print("=" * 70)

        result = {
            'success': True,
            'stages': {}
        }

        # ========== 阶段1: 解析BOM ==========
        print("\n【阶段1/4】解析BOM文件")
        print(f"文件: {bom_file_path}")

        try:
            bom_parts = self.bom_parser.parse_excel(bom_file_path)
            result['stages']['bom_parsing'] = {
                'status': 'success',
                'parts_count': len(bom_parts),
                'parts': bom_parts
            }
            print(f"✅ 成功解析 {len(bom_parts)} 个零件")

            for part in bom_parts[:5]:  # 显示前5个
                print(f"  - {part['part_number']}: {part['part_name']} ({part['specification']})")

        except Exception as e:
            print(f"❌ BOM解析失败: {e}")
            result['stages']['bom_parsing'] = {
                'status': 'failed',
                'error': str(e)
            }
            result['success'] = False
            return result

        # ========== 阶段2: 解析STEP装配体 ==========
        print("\n【阶段2/4】解析STEP装配文件")
        print(f"文件: {step_file_path}")

        try:
            # 复用现有的STEP解析逻辑
            assembly_data = extract_assembly_structure(step_file_path)

            if not assembly_data:
                raise Exception("STEP文件解析失败")

            result['stages']['step_parsing'] = {
                'status': 'success',
                'parts_count': assembly_data['total_parts'],
                'connections_count': len(assembly_data['connections']),
                'data': assembly_data
            }
            print(f"✅ 成功解析 {assembly_data['total_parts']} 个零件")
            print(f"✅ 识别 {len(assembly_data['connections'])} 个连接关系")

        except Exception as e:
            print(f"❌ STEP解析失败: {e}")
            result['stages']['step_parsing'] = {
                'status': 'failed',
                'error': str(e)
            }
            result['success'] = False
            return result

        # ========== 阶段3: 关联BOM与STEP ==========
        print("\n【阶段3/4】关联BOM数据与STEP数据")

        try:
            correlation_result = self.correlator.correlate(
                bom_parts,
                assembly_data
            )

            result['stages']['correlation'] = {
                'status': 'success',
                'matched_count': correlation_result['matched_count'],
                'unmatched_bom_count': len(correlation_result['unmatched_bom']),
                'unmatched_step_count': len(correlation_result['unmatched_step']),
                'correlations': correlation_result['correlations']
            }

            print(f"✅ 成功关联 {correlation_result['matched_count']} 对零件")

            if correlation_result['unmatched_bom']:
                print(f"⚠️  {len(correlation_result['unmatched_bom'])} 个BOM零件未匹配:")
                for part in correlation_result['unmatched_bom'][:3]:
                    print(f"  - {part['part_number']}: {part['part_name']}")

        except Exception as e:
            print(f"❌ 数据关联失败: {e}")
            result['stages']['correlation'] = {
                'status': 'failed',
                'error': str(e)
            }
            result['success'] = False
            return result

        # ========== 阶段4: 提取智能规则 ==========
        print("\n【阶段4/4】提取装配规则")

        try:
            rules = self.rule_extractor.extract_rules(
                correlation_result,
                assembly_data['connections']
            )

            result['stages']['rule_extraction'] = {
                'status': 'success',
                'rules_count': len(rules),
                'rules': rules
            }

            print(f"✅ 提取 {len(rules)} 条智能规则")

            for rule in rules[:5]:  # 显示前5条
                print(f"  - {rule['rule_id']}: {rule['rule_name']} (置信度: {rule['confidence']:.1%})")

        except Exception as e:
            print(f"❌ 规则提取失败: {e}")
            result['stages']['rule_extraction'] = {
                'status': 'failed',
                'error': str(e)
            }
            result['success'] = False
            return result

        # ========== 保存结果 ==========
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            # 保存完整学习报告
            report_file = output_path / 'learning_report.json'
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"\n💾 学习报告已保存: {report_file}")

        print("\n" + "=" * 70)
        print("🎉 学习流程完成！")

        return result
```

#### 阶段3：后端API集成

**3.1 更新Controller**

```javascript
// apps/api/src/controllers/AssemblyController.js

/**
 * 新版规则学习API - 支持BOM+STEP完整学习
 */
learnRulesV2 = async (req, res) => {
  try {
    const { bomFile, stepFile } = req.files
    const { assemblyName } = req.body

    if (!bomFile || !stepFile) {
      return res.status(400).json({
        success: false,
        message: 'BOM文件和STEP文件都是必需的'
      })
    }

    // 保存上传的文件
    const fs = require('fs')
    const path = require('path')
    const { spawn } = require('child_process')

    const uploadDir = path.join(__dirname, '../../../uploads/learning')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const bomPath = path.join(uploadDir, `bom_${Date.now()}.xlsx`)
    const stepPath = path.join(uploadDir, `assembly_${Date.now()}.step`)

    fs.writeFileSync(bomPath, bomFile.buffer)
    fs.writeFileSync(stepPath, stepFile.buffer)

    console.log('[规则学习V2] 文件已保存')
    console.log(`  BOM: ${bomPath}`)
    console.log(`  STEP: ${stepPath}`)

    // 调用Python学习脚本
    const script = path.join(__dirname, '../services/learning/run_complete_learning.py')
    const outputDir = path.join(__dirname, '../../../../docs/learning_results')

    const python = spawn('python3', [
      script,
      bomPath,
      stepPath,
      outputDir
    ])

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
      console.log(data.toString())
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
      console.error(data.toString())
    })

    python.on('close', async (code) => {
      if (code === 0) {
        // 读取学习结果
        const reportPath = path.join(outputDir, 'learning_report.json')
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))

        // 将规则存入数据库
        const rules = report.stages.rule_extraction.rules
        for (const rule of rules) {
          await this._saveRuleToDatabase(rule, req.user.id)
        }

        res.json({
          success: true,
          message: `学习完成，提取了 ${rules.length} 条规则`,
          rules_count: rules.length,
          report: report
        })
      } else {
        res.status(500).json({
          success: false,
          message: '学习失败',
          error: stderr
        })
      }
    })

  } catch (error) {
    console.error('[规则学习V2失败]:', error)
    res.status(500).json({
      success: false,
      message: '学习失败: ' + error.message
    })
  }
}

async _saveRuleToDatabase(rule, userId) {
  const db = require('../config/database')

  try {
    await db('assembly_rules').insert({
      rule_id: rule.rule_id,
      name: rule.rule_name,
      description: rule.rule_name,
      priority: Math.floor(rule.confidence * 10),  // 置信度转优先级
      constraint_type: rule.action.constraint_type,
      condition_logic: JSON.stringify(rule.condition),
      action_template: JSON.stringify(rule.action),
      is_active: true,
      source: 'learned',
      metadata: JSON.stringify({
        confidence: rule.confidence,
        sample_count: rule.sample_count,
        source_assemblies: rule.source_assemblies,
        created_at: rule.created_at
      }),
      created_by: userId
    })

    console.log(`✅ 规则已保存到数据库: ${rule.rule_id}`)
  } catch (error) {
    if (error.code === '23505') {  // Unique violation
      console.log(`⚠️  规则已存在: ${rule.rule_id}`)
    } else {
      console.error(`❌ 保存规则失败: ${rule.rule_id}`, error)
    }
  }
}
```

**3.2 添加新路由**

```javascript
// apps/api/src/routes/assembly.js

const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

// 新版学习API - 支持BOM+STEP
router.post(
  '/learn-rules-v2',
  authenticate,
  upload.fields([
    { name: 'bomFile', maxCount: 1 },
    { name: 'stepFile', maxCount: 1 }
  ]),
  AssemblyController.learnRulesV2
)
```

#### 阶段4：前端UI改进

**4.1 创建新的学习页面**

```typescript
// apps/web/src/pages/AssemblyLearningV2.tsx

import React, { useState } from 'react'
import { Card, Upload, Button, Steps, message, Alert, Descriptions } from 'antd'
import { InboxOutlined, RobotOutlined } from '@ant-design/icons'
import axios from '../utils/axios'

const AssemblyLearningV2: React.FC = () => {
  const [bomFile, setBomFile] = useState<File | null>(null)
  const [stepFile, setStepFile] = useState<File | null>(null)
  const [learning, setLearning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleLearn = async () => {
    if (!bomFile || !stepFile) {
      message.error('请上传BOM文件和STEP文件')
      return
    }

    setLearning(true)

    try {
      const formData = new FormData()
      formData.append('bomFile', bomFile)
      formData.append('stepFile', stepFile)

      const response = await axios.post('/api/assembly/learn-rules-v2', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success) {
        message.success(`学习成功！提取了 ${response.data.rules_count} 条规则`)
        setResult(response.data.report)
      }
    } catch (error) {
      message.error('学习失败')
    } finally {
      setLearning(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="🧠 装配规则学习（完整版）">
        <Alert
          message="学习流程说明"
          description={
            <div>
              <p>请上传：</p>
              <ol>
                <li><strong>BOM Excel文件</strong>: 包含零件编号、名称、规格、数量</li>
                <li><strong>装配体STEP文件</strong>: 完整的装配体3D模型</li>
              </ol>
              <p>系统将：</p>
              <ul>
                <li>✅ 解析BOM提取零件信息</li>
                <li>✅ 解析STEP提取装配关系</li>
                <li>✅ 关联BOM与STEP数据</li>
                <li>✅ 提取智能装配规则（包含零件类型、配合类型、距离等）</li>
                <li>✅ 自动存入规则库</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Steps current={bomFile && stepFile ? 1 : 0} style={{ marginBottom: 24 }}>
          <Steps.Step title="上传文件" />
          <Steps.Step title="AI学习" />
          <Steps.Step title="规则生成" />
        </Steps>

        <div style={{ marginBottom: 24 }}>
          <Upload.Dragger
            accept=".xlsx,.xls"
            beforeUpload={(file) => {
              setBomFile(file)
              return false
            }}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传BOM Excel文件</p>
            <p className="ant-upload-hint">支持 .xlsx, .xls 格式</p>
          </Upload.Dragger>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Upload.Dragger
            accept=".step,.stp"
            beforeUpload={(file) => {
              setStepFile(file)
              return false
            }}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传装配体STEP文件</p>
            <p className="ant-upload-hint">支持 .step, .stp 格式</p>
          </Upload.Dragger>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<RobotOutlined />}
          onClick={handleLearn}
          loading={learning}
          disabled={!bomFile || !stepFile}
          block
        >
          {learning ? '正在学习...' : '开始AI学习'}
        </Button>

        {result && (
          <Card style={{ marginTop: 24 }} title="学习结果">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="BOM零件数">
                {result.stages.bom_parsing.parts_count}
              </Descriptions.Item>
              <Descriptions.Item label="STEP零件数">
                {result.stages.step_parsing.parts_count}
              </Descriptions.Item>
              <Descriptions.Item label="连接关系数">
                {result.stages.step_parsing.connections_count}
              </Descriptions.Item>
              <Descriptions.Item label="成功关联">
                {result.stages.correlation.matched_count} 对
              </Descriptions.Item>
              <Descriptions.Item label="提取规则数">
                {result.stages.rule_extraction.rules_count} 条
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Card>
    </div>
  )
}

export default AssemblyLearningV2
```

---

## 📊 效果对比

### 修复前 vs 修复后

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **输入** | 只有STEP文件 | BOM + STEP + (可选PDF) |
| **零件信息** | 只有几何ID（#123） | 零件编号、名称、规格、型号 |
| **规则类型** | 统计规则："60%是同轴配合" | 条件规则："VCR接头+管道 → 同轴配合，距离50mm" |
| **规则可用性** | 无法应用到新场景 | 可以根据零件类型匹配规则 |
| **置信度** | 无 | 基于样本数量计算（0.95 = 95%） |
| **可解释性** | 差（不知道为什么） | 好（有示例、有条件、有参数） |

### 预期学习结果示例

**修复前：**
```json
{
  "rule_id": "MATE_CONCENTRIC",
  "type": "mate_type_frequency",
  "mate_type": "concentric",
  "probability": 0.615,
  "description": "concentric配合占61.5%"
}
```

**修复后：**
```json
{
  "rule_id": "VALVE_FLANGE_CONNECTION",
  "rule_name": "阀门与法兰连接规则",
  "condition": {
    "part_a_type": "valve",
    "part_b_type": "flange",
    "connection_pattern": "direct_connection"
  },
  "action": {
    "constraint_type": "SCREW",
    "typical_distance_mm": 5.2,
    "distance_tolerance_mm": 1.5,
    "bolt_count": 4,
    "alignment": "ALIGNED"
  },
  "confidence": 0.95,
  "sample_count": 18,
  "examples": [
    {
      "part_a_name": "球阀DN50",
      "part_b_name": "法兰DN50 PN16",
      "distance": 5.1
    },
    {
      "part_a_name": "截止阀DN80",
      "part_b_name": "法兰DN80 PN16",
      "distance": 5.3
    }
  ]
}
```

---

## 🚀 实施优先级

### MVP阶段（2周）

**必须实现：**
1. ✅ BOM Excel解析器
2. ✅ BOM与STEP关联逻辑（基于名称/数量匹配）
3. ✅ 智能规则提取器（条件+动作结构）
4. ✅ 新版学习API（`/api/assembly/learn-rules-v2`）
5. ✅ 前端上传页面（BOM + STEP）
6. ✅ 规则存入数据库

**可以延后：**
- ⏳ PDF零件图解析（手工补充特征JSON）
- ⏳ 向量检索优化
- ⏳ 规则冲突检测

### 完整版（4周）

在MVP基础上增加：
- PDF零件图OCR识别
- 零件特征自动提取
- 规则推理引擎增强
- 规则评分与排序

---

## ✅ 验收标准

**学习流程修复成功的标准：**

1. ✅ **能够处理BOM数据**：上传BOM Excel → 正确解析零件编号、名称、规格
2. ✅ **能够关联数据**：BOM零件与STEP零件成功关联 ≥ 70%
3. ✅ **提取智能规则**：规则包含条件（零件类型）+ 动作（配合参数）
4. ✅ **规则可应用**：新的装配场景能够查询到适用的规则
5. ✅ **置信度合理**：规则的置信度基于样本数量计算
6. ✅ **用户体验**：前端清晰展示学习结果、关联情况、提取的规则

---

## 📝 下一步行动

请告诉我您希望我：

**A. 立即实现MVP**
我将创建：
- `BOMParser.py`
- `AssemblyDataCorrelator.py`
- `SmartRuleExtractor.py`
- `CompleteLearningPipeline.py`
- 更新Controller和路由
- 创建前端上传页面

**B. 先运行现有脚本测试**
看看现在的学习结果是什么样的，再决定如何改进

**C. 先提供测试数据示例**
您提供一个BOM+STEP案例，我分析能学到什么

请选择！
