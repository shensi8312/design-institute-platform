#!/usr/bin/env python3
"""
STEP装配文件智能分析器 - 提取装配约束、孔特征、空间关系
"""
import re
import json
import math
import sys
from pathlib import Path
from collections import defaultdict

class StepAssemblyAnalyzer:
    def __init__(self):
        self.entities = {}
        self.products = {}
        self.assemblies = []
        self.placements = {}
        self.positions = {}
        self.directions = {}
        self.cylinders = []
        self.constraints = []

    def parse_step_file(self, filepath):
        """解析STEP文件"""
        filename = Path(filepath).name
        print(f"📂 解析STEP文件: {filename}")

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 提取所有实体
        entity_pattern = r'#(\d+)\s*=\s*([A-Z_0-9]+)\s*\((.*?)\);'
        for match in re.finditer(entity_pattern, content, re.DOTALL):
            entity_id = match.group(1)
            entity_type = match.group(2)
            entity_data = match.group(3)
            self.entities[entity_id] = {
                'type': entity_type,
                'data': entity_data
            }

        print(f"  ✅ 提取 {len(self.entities)} 个实体")

        # 解析产品
        self._parse_products()

        # 解析装配关系
        self._parse_assemblies()

        # 判断文件类型
        file_type = self._identify_file_type(filename)
        print(f"  🔍 文件类型: {file_type}")

        # 解析几何位置
        self._parse_geometry()

        # 解析圆柱面（孔特征）
        self._parse_cylinders()

        self.file_type = file_type
        return self

    def _identify_file_type(self, filename):
        """识别STEP文件类型：装配图(Assembly) 或 零件图(Part)"""

        # 方法1: 根据文件名前缀判断
        if filename.startswith('A') and filename[1:].split('.')[0].isdigit():
            return 'assembly'  # A0000002659.STEP
        elif filename.startswith('P') and filename[1:].split('.')[0].isdigit():
            return 'part'  # P0000009449.STEP
        elif filename.startswith('1000') or filename.startswith('1010'):
            return 'part'  # 100001060023.STEP

        # 方法2: 根据装配关系数量判断
        if len(self.assemblies) > 0:
            return 'assembly'  # 有装配关系 = 装配图

        # 方法3: 根据产品数量判断
        if len(self.products) > 1:
            return 'assembly'  # 多个产品 = 装配图

        # 方法4: 检查是否有NEXT_ASSEMBLY_USAGE_OCCURRENCE
        for entity in self.entities.values():
            if entity['type'] == 'NEXT_ASSEMBLY_USAGE_OCCURRENCE':
                return 'assembly'

        # 默认认为是零件图
        return 'part'

    def _parse_products(self):
        """提取产品信息"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'PRODUCT':
                # PRODUCT('零件名', ...)
                name_match = re.search(r"'([^']*)'", entity['data'])
                if name_match:
                    self.products[entity_id] = {
                        'id': entity_id,
                        'name': name_match.group(1)
                    }
        print(f"  🔹 产品数量: {len(self.products)}")

    def _parse_assemblies(self):
        """提取装配关系"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'NEXT_ASSEMBLY_USAGE_OCCURRENCE':
                # #123 = NEXT_ASSEMBLY_USAGE_OCCURRENCE('name', #parent, #child, ...)
                refs = re.findall(r'#(\d+)', entity['data'])
                if len(refs) >= 2:
                    self.assemblies.append({
                        'id': entity_id,
                        'parent': refs[0],
                        'child': refs[1]
                    })
        print(f"  🔗 装配关系: {len(self.assemblies)}")

    def _parse_geometry(self):
        """解析几何信息"""
        # 解析坐标点
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'CARTESIAN_POINT':
                # 匹配科学计数法和普通小数： -1.234E-5 或 1.234
                coords = re.findall(r'([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)', entity['data'])
                coords = [c for c in coords if c]  # 过滤空字符串
                if len(coords) >= 3:
                    try:
                        self.positions[entity_id] = [
                            float(coords[0]),
                            float(coords[1]),
                            float(coords[2])
                        ]
                    except ValueError:
                        pass  # 跳过无效坐标

        # 解析方向向量
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'DIRECTION':
                coords = re.findall(r'([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)', entity['data'])
                coords = [c for c in coords if c]
                if len(coords) >= 3:
                    try:
                        self.directions[entity_id] = [
                            float(coords[0]),
                            float(coords[1]),
                            float(coords[2])
                        ]
                    except ValueError:
                        pass

        # 统计AXIS2_PLACEMENT_3D数量
        axis2_count = sum(1 for e in self.entities.values() if e['type'] == 'AXIS2_PLACEMENT_3D')
        print(f"  🔍 AXIS2_PLACEMENT_3D实体数: {axis2_count}")

        # 显示前5个position键（用于调试）
        pos_keys_sample = list(self.positions.keys())[:5]
        if pos_keys_sample:
            print(f"  🔑 前5个position键示例: {pos_keys_sample}")
            print(f"  🔑 键类型: {type(pos_keys_sample[0])}")

        # 解析位置变换
        placement_count = 0
        missing_pos = 0
        missing_dir = 0
        debug_count = 0
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'AXIS2_PLACEMENT_3D':
                refs = re.findall(r'#(\d+)', entity['data'])

                # 调试前3个AXIS2_PLACEMENT_3D
                if debug_count < 3:
                    print(f"  🔍 DEBUG AXIS2_PLACEMENT_3D #{entity_id}: {entity['data'][:100]}")
                    print(f"     引用refs: {refs[:5]}")
                    if len(refs) > 0:
                        print(f"     refs[0]={refs[0]} (类型:{type(refs[0])})")
                        print(f"     refs[0] in positions? {refs[0] in self.positions}")
                        # 尝试查找相似的键
                        similar_keys = [k for k in list(self.positions.keys())[:50] if str(k).startswith(str(refs[0])[:min(3, len(refs[0]))])]
                        if similar_keys:
                            print(f"     找到相似键: {similar_keys[:3]}")
                    debug_count += 1

                if len(refs) >= 1:
                    placement = {'id': entity_id}
                    has_data = False

                    # 位置（第一个引用）
                    if refs[0] in self.positions:
                        placement['position'] = self.positions[refs[0]]
                        has_data = True
                    else:
                        missing_pos += 1

                    # Z轴方向（第二个引用，如果有）
                    if len(refs) >= 2 and refs[1] in self.directions:
                        placement['z_axis'] = self.directions[refs[1]]

                    # X轴方向（第三个引用，如果有）
                    if len(refs) >= 3 and refs[2] in self.directions:
                        placement['x_axis'] = self.directions[refs[2]]

                    # 只要有position就保存
                    if has_data:
                        self.placements[entity_id] = placement
                        placement_count += 1

        print(f"  📍 位置数据: {len(self.positions)}")
        print(f"  📐 方向数据: {len(self.directions)}")
        print(f"  🎯 空间变换: {len(self.placements)}")
        if missing_pos > 0:
            print(f"  ⚠️  缺失位置引用: {missing_pos}")

    def _parse_cylinders(self):
        """提取圆柱面特征（孔/轴）"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'CYLINDRICAL_SURFACE':
                refs = re.findall(r'#(\d+)', entity['data'])
                # CYLINDRICAL_SURFACE('name', #placement, radius)
                if refs:
                    placement_id = refs[0]
                    # 提取半径
                    radius_match = re.search(r',\s*([\d.E+-]+)\s*\)', entity['data'])
                    radius = float(radius_match.group(1)) if radius_match else None

                    if placement_id in self.placements and radius:
                        cylinder = {
                            'id': entity_id,
                            'placement': self.placements[placement_id],
                            'radius': radius,
                            'type': 'hole' if radius < 50 else 'shaft'  # 简单启发式
                        }
                        self.cylinders.append(cylinder)

        print(f"  🕳️  圆柱特征（孔/轴）: {len(self.cylinders)}")

    def analyze_constraints(self):
        """分析装配约束"""
        print("\n🔍 分析装配约束...")

        placements_list = list(self.placements.values())

        # 1. 分析配合类型（基于轴向关系）
        for i, p1 in enumerate(placements_list):
            for p2 in placements_list[i+1:]:
                constraint = self._analyze_mate_type(p1, p2)
                if constraint:
                    self.constraints.append(constraint)

        # 2. 分析孔对孔约束
        for i, c1 in enumerate(self.cylinders):
            for c2 in self.cylinders[i+1:]:
                constraint = self._analyze_hole_constraint(c1, c2)
                if constraint:
                    self.constraints.append(constraint)

        print(f"  ✅ 识别约束: {len(self.constraints)}")
        return self.constraints

    def _analyze_mate_type(self, p1, p2):
        """分析两个零件的配合类型"""
        if 'z_axis' not in p1 or 'z_axis' not in p2:
            return None

        if 'position' not in p1 or 'position' not in p2:
            return None

        z1 = p1['z_axis']
        z2 = p2['z_axis']

        # 计算夹角
        dot = sum(a*b for a, b in zip(z1, z2))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, dot))))

        # 计算距离
        pos1 = p1['position']
        pos2 = p2['position']
        distance = math.sqrt(sum((a-b)**2 for a, b in zip(pos1, pos2)))

        # 判断配合类型
        mate_type = None
        if angle < 5 or angle > 175:
            mate_type = 'concentric'  # 同轴
        elif 85 < angle < 95:
            mate_type = 'perpendicular'  # 垂直
        else:
            mate_type = f'angle_{int(angle)}'

        # 只保留重要约束（距离<300mm）
        if distance > 300:
            return None

        return {
            'type': mate_type,
            'part1': p1['id'],
            'part2': p2['id'],
            'distance': round(distance, 2),
            'angle': round(angle, 2),
            'confidence': 0.8 if mate_type in ['concentric', 'perpendicular'] else 0.5
        }

    def _analyze_hole_constraint(self, c1, c2):
        """分析孔-孔约束"""
        p1 = c1['placement']
        p2 = c2['placement']

        if 'position' not in p1 or 'position' not in p2:
            return None

        pos1 = p1['position']
        pos2 = p2['position']
        distance = math.sqrt(sum((a-b)**2 for a, b in zip(pos1, pos2)))

        # 孔间距约束
        if distance < 200:
            return {
                'type': 'hole_spacing',
                'hole1': c1['id'],
                'hole2': c2['id'],
                'distance': round(distance, 2),
                'radius1': c1['radius'],
                'radius2': c2['radius'],
                'confidence': 0.9
            }

        return None

    def export_results(self):
        """导出分析结果"""
        return {
            'file_type': getattr(self, 'file_type', 'unknown'),  # 新增：文件类型
            'metadata': {
                'products_count': len(self.products),
                'assemblies_count': len(self.assemblies),
                'placements_count': len(self.placements),
                'cylinders_count': len(self.cylinders),
                'constraints_count': len(self.constraints)
            },
            'products': list(self.products.values()),
            'assemblies': self.assemblies,
            'cylinders': [{
                'id': c['id'],
                'type': c['type'],
                'radius': c['radius'],
                'position': c['placement'].get('position'),
                'axis': c['placement'].get('z_axis')
            } for c in self.cylinders],
            'constraints': self.constraints
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python step_assembly_analyzer.py <step_file> [output_json]")
        sys.exit(1)

    step_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          STEP装配智能分析器 v2.0                                ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    analyzer = StepAssemblyAnalyzer()
    analyzer.parse_step_file(step_file)
    analyzer.analyze_constraints()

    results = analyzer.export_results()

    # 输出结果
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n💾 结果已导出: {output_file}")
    else:
        print("\n" + "="*70)
        print(json.dumps(results, indent=2, ensure_ascii=False))

    print("\n📊 分析摘要:")
    print(f"  产品数: {results['metadata']['products_count']}")
    print(f"  装配关系: {results['metadata']['assemblies_count']}")
    print(f"  孔/轴特征: {results['metadata']['cylinders_count']}")
    print(f"  约束数: {results['metadata']['constraints_count']}")

if __name__ == '__main__':
    main()
