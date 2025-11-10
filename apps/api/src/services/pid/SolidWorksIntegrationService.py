#!/usr/bin/env python3
"""
SolidWorks自动装配集成服务
- STEP装配文件生成
- 约束自动添加
- BOM自动生成
- 与PID识别和零件库集成
"""
import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
import math

sys.path.append(str(Path(__file__).parent.parent))
from step_assembly_analyzer import StepAssemblyAnalyzer

class SolidWorksIntegrationService:
    def __init__(self):
        self.part_library = self._load_part_library()
        self.assembly_rules = self._load_assembly_rules()
        self.constraint_priority = {
            'CONCENTRIC': 1,
            'PERPENDICULAR': 2,
            'COINCIDENT': 3,
            'PARALLEL': 4,
            'SCREW': 5
        }

    def _load_part_library(self) -> Dict:
        """加载零件库"""
        library_path = Path(__file__).parent.parent.parent.parent.parent / 'docs' / 'part_library.json'
        if library_path.exists():
            with open(library_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'part_library': {}, 'part_specs': {}}

    def _load_assembly_rules(self) -> Dict:
        """加载装配规则"""
        rules_path = Path(__file__).parent.parent.parent.parent.parent / 'docs' / 'assembly_rules.json'
        if rules_path.exists():
            with open(rules_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'rules': []}

    def auto_assemble(self, pid_components: List[Dict], physical_constraints: Dict) -> Dict:
        """自动装配主流程"""
        print("🔧 开始自动装配...")

        # 步骤1: 零件选型
        selected_parts = self._select_parts(pid_components, physical_constraints)
        print(f"  ✅ 选型完成: {len(selected_parts)} 个零件")

        # 步骤2: 生成装配约束
        constraints = self._generate_constraints(selected_parts, physical_constraints)
        print(f"  ✅ 生成约束: {len(constraints)} 条")

        # 步骤3: 空间布局优化
        layout = self._optimize_layout(selected_parts, constraints)
        print(f"  ✅ 布局优化完成")

        # 步骤4: 生成装配文件
        assembly_file = self._generate_assembly_step(selected_parts, constraints, layout)
        print(f"  ✅ 生成装配文件: {assembly_file}")

        # 步骤5: 生成BOM
        bom = self._generate_bom(selected_parts)
        print(f"  ✅ 生成BOM: {len(bom)} 行")

        return {
            'selected_parts': selected_parts,
            'constraints': constraints,
            'layout': layout,
            'assembly_file': assembly_file,
            'bom': bom
        }

    def _select_parts(self, pid_components: List[Dict], physical_constraints: Dict) -> List[Dict]:
        """零件选型"""
        selected = []

        for comp in pid_components:
            symbol_type = comp.get('symbol_type')
            tag_number = comp.get('tag_number')
            parameters = comp.get('parameters', {})

            # 根据符号类型和参数选择零件
            if symbol_type == 'pump':
                part = self._select_pump(parameters, physical_constraints)
            elif symbol_type == 'valve':
                part = self._select_valve(parameters, physical_constraints)
            elif symbol_type == 'instrument':
                part = self._select_instrument(parameters, physical_constraints)
            else:
                part = self._select_generic_part(symbol_type, parameters)

            if part:
                selected.append({
                    'tag': tag_number,
                    'part_number': part['part_number'],
                    'type': symbol_type,
                    'spec': part.get('spec', {}),
                    'parameters': parameters
                })

        return selected

    def _select_pump(self, parameters: Dict, constraints: Dict) -> Dict:
        """选择泵"""
        # 从零件库查找泵
        pumps = self.part_library.get('part_library', {}).get('pump', [])

        if not pumps and 'custom_part' in self.part_library.get('part_library', {}):
            # 回退到自定义零件
            pumps = [p for p in self.part_library['part_library']['custom_part']
                    if 'pump' in p.get('filename', '').lower()]

        if pumps:
            # 简单选择第一个
            return pumps[0]

        return {
            'part_number': 'PUMP-GENERIC-001',
            'spec': {
                'type': 'centrifugal',
                'flow': parameters.get('flow', {}).get('value', 50),
                'head': 30
            }
        }

    def _select_valve(self, parameters: Dict, constraints: Dict) -> Dict:
        """选择阀门"""
        # 从零件库查找阀门
        valves = self.part_library.get('part_library', {}).get('valve', [])

        if valves:
            return valves[0]

        return {
            'part_number': 'VALVE-GENERIC-001',
            'spec': {
                'type': 'gate',
                'diameter': parameters.get('diameter', {}).get('value', 50),
                'pressure_class': parameters.get('pressure_class', 'PN16')
            }
        }

    def _select_instrument(self, parameters: Dict, constraints: Dict) -> Dict:
        """选择仪表"""
        return {
            'part_number': 'INSTRUMENT-GENERIC-001',
            'spec': {
                'type': 'pressure_gauge',
                'range': '0-2.5 MPa'
            }
        }

    def _select_generic_part(self, part_type: str, parameters: Dict) -> Dict:
        """选择通用零件"""
        return {
            'part_number': f'{part_type.upper()}-GENERIC-001',
            'spec': parameters
        }

    def _generate_constraints(self, parts: List[Dict], physical_constraints: Dict) -> List[Dict]:
        """生成装配约束"""
        constraints = []

        # 从装配规则学习的约束类型分布
        rules = self.assembly_rules.get('rules', [])
        constraint_dist = {}

        for rule in rules:
            if rule.get('type') == 'mate_type_frequency':
                mate_type = rule.get('mate_type', '').upper()
                probability = rule.get('probability', 0)
                constraint_dist[mate_type] = probability

        # 为相邻零件生成约束
        for i in range(len(parts) - 1):
            part1 = parts[i]
            part2 = parts[i + 1]

            # 根据概率分布选择约束类型
            constraint_type = self._select_constraint_type(constraint_dist, part1, part2)

            constraints.append({
                'type': constraint_type,
                'part1': part1['tag'],
                'part2': part2['tag'],
                'confidence': constraint_dist.get(constraint_type, 0.5)
            })

            # 法兰连接需要额外的同心约束
            if 'flange' in part1.get('type', '').lower() or 'flange' in part2.get('type', '').lower():
                constraints.append({
                    'type': 'CONCENTRIC',
                    'part1': part1['tag'],
                    'part2': part2['tag'],
                    'confidence': 0.9
                })

        return constraints

    def _select_constraint_type(self, dist: Dict, part1: Dict, part2: Dict) -> str:
        """根据概率分布选择约束类型"""
        # 优先使用高概率约束
        if dist:
            sorted_types = sorted(dist.items(), key=lambda x: x[1], reverse=True)
            return sorted_types[0][0]

        # 默认约束
        return 'COINCIDENT'

    def _optimize_layout(self, parts: List[Dict], constraints: List[Dict]) -> Dict:
        """优化空间布局"""
        layout = {
            'parts_positions': [],
            'spacing': 100.0,  # mm
            'orientation': 'horizontal'
        }

        # 简单线性布局
        x_offset = 0
        for i, part in enumerate(parts):
            layout['parts_positions'].append({
                'tag': part['tag'],
                'position': (x_offset, 0, 0),
                'rotation': (0, 0, 0)
            })

            # 估算零件尺寸
            part_length = self._estimate_part_length(part)
            x_offset += part_length + layout['spacing']

        return layout

    def _estimate_part_length(self, part: Dict) -> float:
        """估算零件长度"""
        part_type = part.get('type', '')

        size_map = {
            'pump': 500,
            'valve': 200,
            'instrument': 100,
            'flange': 50,
            'pipe': 1000
        }

        return size_map.get(part_type, 300)

    def _generate_assembly_step(self, parts: List[Dict], constraints: List[Dict], layout: Dict) -> str:
        """生成STEP装配文件"""
        output_dir = Path(__file__).parent.parent.parent.parent.parent / 'docs'
        output_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = output_dir / f'auto_assembly_{timestamp}.STEP'

        # 生成STEP文件内容
        step_content = self._build_step_content(parts, constraints, layout)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(step_content)

        return str(output_file)

    def _build_step_content(self, parts: List[Dict], constraints: List[Dict], layout: Dict) -> str:
        """构建STEP文件内容"""
        # STEP AP214 格式头
        header = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Auto-generated assembly from PID'), '2;1');
FILE_NAME('auto_assembly.STEP', '{}', ('Claude AI'), ('MST Platform'), 'STEP Processor', '', '');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
""".format(datetime.now().isoformat())

        # 实体定义
        entity_id = 1
        entities = []

        # 为每个零件创建实体
        for i, part in enumerate(parts):
            pos = layout['parts_positions'][i]['position']
            rot = layout['parts_positions'][i]['rotation']

            # 产品定义
            entities.append(f"#{entity_id}=PRODUCT('{part['tag']}','{part['part_number']}','',());\n")
            entity_id += 1

            # 产品定义形状
            entities.append(f"#{entity_id}=PRODUCT_DEFINITION_SHAPE('','',#{entity_id-1});\n")
            entity_id += 1

            # 位置
            entities.append(f"#{entity_id}=CARTESIAN_POINT('',({pos[0]},{pos[1]},{pos[2]}));\n")
            entity_id += 1

            # 方向
            entities.append(f"#{entity_id}=DIRECTION('',(0.,0.,1.));\n")
            entity_id += 1

        # 装配关系
        for constraint in constraints:
            entities.append(f"#{entity_id}=NEXT_ASSEMBLY_USAGE_OCCURRENCE('{constraint['type']}','','',#{entity_id-10},#{entity_id-5},$);\n")
            entity_id += 1

        footer = "ENDSEC;\nEND-ISO-10303-21;"

        return header + ''.join(entities) + footer

    def _generate_bom(self, parts: List[Dict]) -> List[Dict]:
        """生成物料清单"""
        bom = []

        # 按零件号分组统计
        part_counts = {}
        for part in parts:
            pn = part['part_number']
            if pn not in part_counts:
                part_counts[pn] = {
                    'part_number': pn,
                    'description': part.get('type', ''),
                    'spec': part.get('spec', {}),
                    'quantity': 0
                }
            part_counts[pn]['quantity'] += 1

        # 生成BOM行
        for i, (pn, info) in enumerate(part_counts.items(), 1):
            bom.append({
                'item': i,
                'part_number': pn,
                'description': info['description'],
                'specification': self._format_spec(info['spec']),
                'quantity': info['quantity'],
                'unit': 'EA'
            })

        return bom

    def _format_spec(self, spec: Dict) -> str:
        """格式化规格说明"""
        parts = []
        for key, value in spec.items():
            if isinstance(value, dict):
                value = ', '.join(f"{k}:{v}" for k, v in value.items())
            parts.append(f"{key}={value}")
        return '; '.join(parts)

    def export_bom_excel(self, bom: List[Dict], output_path: str):
        """导出BOM到Excel"""
        try:
            import pandas as pd
            df = pd.DataFrame(bom)
            df.to_excel(output_path, index=False, sheet_name='BOM')
            print(f"📊 BOM已导出到Excel: {output_path}")
        except ImportError:
            # 回退到CSV
            import csv
            csv_path = output_path.replace('.xlsx', '.csv')
            with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
                if bom:
                    writer = csv.DictWriter(f, fieldnames=bom[0].keys())
                    writer.writeheader()
                    writer.writerows(bom)
            print(f"📊 BOM已导出到CSV: {csv_path}")


def main():
    """测试完整流程"""
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          SolidWorks自动装配集成 v1.0                            ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    service = SolidWorksIntegrationService()

    # 模拟PID识别结果
    test_pid_components = [
        {
            'symbol_type': 'pump',
            'tag_number': 'P-101',
            'parameters': {
                'flow': {'value': 50, 'unit': 'm³/h'},
                'pressure': {'value': 1.6, 'unit': 'MPa'}
            }
        },
        {
            'symbol_type': 'valve',
            'tag_number': 'V-101',
            'parameters': {
                'diameter': {'value': 50},
                'pressure_class': 'PN16'
            }
        },
        {
            'symbol_type': 'instrument',
            'tag_number': 'PI-101',
            'parameters': {
                'pressure': {'value': 1.6, 'unit': 'MPa'}
            }
        }
    ]

    # 模拟物理约束
    test_physical_constraints = {
        'max_pressure': 2.5,
        'max_temperature': 200,
        'medium': 'water'
    }

    # 执行自动装配
    result = service.auto_assemble(test_pid_components, test_physical_constraints)

    print("\n📋 装配结果:")
    print(f"  零件数: {len(result['selected_parts'])}")
    print(f"  约束数: {len(result['constraints'])}")
    print(f"  装配文件: {result['assembly_file']}")
    print(f"  BOM行数: {len(result['bom'])}")

    print("\n📦 BOM清单:")
    for item in result['bom']:
        print(f"  {item['item']}. {item['part_number']} - {item['description']} x{item['quantity']}")

    # 导出BOM
    bom_file = result['assembly_file'].replace('.STEP', '_BOM.xlsx')
    service.export_bom_excel(result['bom'], bom_file)

if __name__ == '__main__':
    main()
