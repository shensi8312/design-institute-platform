#!/usr/bin/env python3
"""
装配规则提取引擎 - 从STEP文件中学习装配规则
"""
import re
import json
import math
import sys
from collections import defaultdict, Counter
from pathlib import Path
from datetime import datetime

class AssemblyRuleExtractor:
    def __init__(self):
        self.all_assemblies = []
        self.statistics = {
            'total_assemblies': 0,
            'total_parts': 0,
            'total_relations': 0,
            'mate_types': Counter(),
            'distance_patterns': [],
            'angle_patterns': [],
            'axis_alignments': Counter()
        }
        self.rules = []

    def parse_assembly_step(self, filepath):
        """解析单个装配STEP文件"""
        data = {
            'filepath': str(filepath),
            'filename': filepath.name,
            'products': [],
            'assemblies': [],
            'placements': {},
            'positions': {},
            'directions': {}
        }

        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # 提取产品数量
            products = re.findall(r'#\d+ = PRODUCT\s*\(', content)
            data['product_count'] = len(products)

            # 提取装配关系
            assembly_pattern = r"#(\d+) = NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\([^)]*#(\d+)\s*,\s*#(\d+)"
            for match in re.finditer(assembly_pattern, content):
                data['assemblies'].append({
                    'id': match.group(1),
                    'parent': match.group(2),
                    'child': match.group(3)
                })

            # 提取坐标点
            point_pattern = r"#(\d+) = CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.E]+)\s*,\s*([-\d.E]+)\s*,\s*([-\d.E]+)\s*\)\s*\)"
            for match in re.finditer(point_pattern, content):
                entity_id = match.group(1)
                x, y, z = float(match.group(2)), float(match.group(3)), float(match.group(4))
                data['positions'][entity_id] = [x, y, z]

            # 提取方向向量
            direction_pattern = r"#(\d+) = DIRECTION\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.E]+)\s*,\s*([-\d.E]+)\s*,\s*([-\d.E]+)\s*\)\s*\)"
            for match in re.finditer(direction_pattern, content):
                entity_id = match.group(1)
                dx, dy, dz = float(match.group(2)), float(match.group(3)), float(match.group(4))
                data['directions'][entity_id] = [dx, dy, dz]

            # 提取位置变换
            placement_pattern = r"#(\d+) = AXIS2_PLACEMENT_3D\s*\(\s*'([^']*)'\s*,\s*#(\d+)\s*,\s*#(\d+)\s*,\s*#(\d+)\s*\)"
            for match in re.finditer(placement_pattern, content):
                entity_id = match.group(1)
                point_ref = match.group(3)
                z_dir_ref = match.group(4)
                x_dir_ref = match.group(5)

                placement = {'id': entity_id}
                if point_ref in data['positions']:
                    placement['position'] = data['positions'][point_ref]
                if z_dir_ref in data['directions']:
                    placement['z_axis'] = data['directions'][z_dir_ref]
                if x_dir_ref in data['directions']:
                    placement['x_axis'] = data['directions'][x_dir_ref]

                if 'position' in placement:
                    data['placements'][entity_id] = placement

        except Exception as e:
            print(f"  ⚠️  解析失败: {e}")
            return None

        return data

    def analyze_mate_type(self, placement1, placement2):
        """分析两个零件之间的配合类型"""
        if 'z_axis' not in placement1 or 'z_axis' not in placement2:
            return 'unknown'

        z1 = placement1['z_axis']
        z2 = placement2['z_axis']

        # 计算向量夹角
        dot = sum(a*b for a, b in zip(z1, z2))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, dot))))

        # 同轴配合: 轴向平行或反平行 (0° or 180°)
        if angle < 5 or angle > 175:
            return 'concentric'  # 同轴

        # 垂直配合: 90°
        if 85 < angle < 95:
            return 'perpendicular'  # 垂直

        # 角度配合
        return f'angle_{int(angle)}deg'

    def calculate_distance(self, pos1, pos2):
        """计算两个位置之间的距离"""
        return math.sqrt(sum((a-b)**2 for a, b in zip(pos1, pos2)))

    def extract_patterns(self, assembly_data):
        """从单个装配中提取模式"""
        placements = list(assembly_data['placements'].values())

        # 分析配合类型
        for i, p1 in enumerate(placements):
            for p2 in placements[i+1:]:
                mate_type = self.analyze_mate_type(p1, p2)
                self.statistics['mate_types'][mate_type] += 1

                # 分析距离
                if 'position' in p1 and 'position' in p2:
                    dist = self.calculate_distance(p1['position'], p2['position'])
                    if dist < 500:  # 只统计500mm内的
                        self.statistics['distance_patterns'].append({
                            'distance': dist,
                            'mate_type': mate_type
                        })

        # 分析轴向对齐
        for p in placements:
            if 'z_axis' in p:
                z = p['z_axis']
                # 判断主轴方向
                if abs(z[2]) > 0.9:  # Z轴
                    self.statistics['axis_alignments']['Z_axis'] += 1
                elif abs(z[1]) > 0.9:  # Y轴
                    self.statistics['axis_alignments']['Y_axis'] += 1
                elif abs(z[0]) > 0.9:  # X轴
                    self.statistics['axis_alignments']['X_axis'] += 1
                else:
                    self.statistics['axis_alignments']['angled'] += 1

    def generate_rules(self):
        """根据统计数据生成规则"""
        rules = []

        # 规则1: 配合类型分布
        total_mates = sum(self.statistics['mate_types'].values())
        if total_mates > 0:
            for mate_type, count in self.statistics['mate_types'].most_common(5):
                probability = count / total_mates
                if probability > 0.05:  # 只保留出现频率>5%的
                    rules.append({
                        'rule_id': f'MATE_{mate_type.upper()}',
                        'type': 'mate_type_frequency',
                        'mate_type': mate_type,
                        'probability': round(probability, 3),
                        'sample_count': count,
                        'description': f'{mate_type}配合占{probability*100:.1f}%',
                        'confidence': 'high' if probability > 0.3 else 'medium'
                    })

        # 规则2: 典型距离
        distances = [d['distance'] for d in self.statistics['distance_patterns']]
        if distances:
            # 聚类分析常见距离
            distance_bins = defaultdict(list)
            for d in distances:
                bin_key = round(d / 10) * 10  # 10mm精度
                distance_bins[bin_key].append(d)

            # 找出频繁出现的距离
            for dist_bin, values in sorted(distance_bins.items(), key=lambda x: len(x[1]), reverse=True)[:5]:
                if len(values) > 10:  # 至少出现10次
                    avg_dist = sum(values) / len(values)
                    rules.append({
                        'rule_id': f'DIST_{int(avg_dist)}MM',
                        'type': 'typical_distance',
                        'distance_mm': round(avg_dist, 2),
                        'occurrences': len(values),
                        'std_dev': round(math.sqrt(sum((v-avg_dist)**2 for v in values) / len(values)), 2),
                        'description': f'典型间距: {avg_dist:.1f}mm (出现{len(values)}次)',
                        'confidence': 'high' if len(values) > 50 else 'medium'
                    })

        # 规则3: 轴向对齐偏好
        total_alignments = sum(self.statistics['axis_alignments'].values())
        if total_alignments > 0:
            for axis, count in self.statistics['axis_alignments'].most_common():
                probability = count / total_alignments
                if probability > 0.1:
                    rules.append({
                        'rule_id': f'ALIGN_{axis.upper()}',
                        'type': 'axis_alignment',
                        'axis': axis,
                        'probability': round(probability, 3),
                        'sample_count': count,
                        'description': f'{axis}对齐占{probability*100:.1f}%',
                        'confidence': 'high'
                    })

        self.rules = rules
        return rules

    def process_directory(self, directory_path):
        """批量处理目录中的所有装配STEP文件"""
        directory = Path(directory_path)
        if not directory.exists():
            print(f"\n❌ 输入目录不存在: {directory}")
            return

        step_extensions = {'.step', '.stp'}

        def collect(filter_func):
            return sorted([
                path for path in directory.iterdir()
                if path.is_file()
                and path.suffix.lower() in step_extensions
                and filter_func(path)
            ])

        assembly_files = collect(lambda p: p.name.upper().startswith('A'))

        if not assembly_files:
            print("⚠️  未找到以 'A' 开头的装配文件，回退到扫描全部 STEP/STP。")
            assembly_files = collect(lambda _: True)

        print(f"\n🔍 扫描目录: {directory}")
        print(f"📦 找到 {len(assembly_files)} 个装配STEP文件（支持 .step/.stp）\n")

        if not assembly_files:
            print("⚠️  没有匹配到任何 STEP 装配文件，请确认文件命名或扩展名。")
            return

        for i, filepath in enumerate(assembly_files, 1):
            print(f"[{i}/{len(assembly_files)}] 分析: {filepath.name} ({filepath.stat().st_size / 1024 / 1024:.1f} MB)")

            assembly_data = self.parse_assembly_step(filepath)
            if assembly_data:
                self.all_assemblies.append(assembly_data)
                self.statistics['total_assemblies'] += 1
                self.statistics['total_parts'] += assembly_data['product_count']
                self.statistics['total_relations'] += len(assembly_data['assemblies'])

                # 提取模式
                self.extract_patterns(assembly_data)

                print(f"  ✅ 零件: {assembly_data['product_count']}, 装配关系: {len(assembly_data['assemblies'])}, 位置: {len(assembly_data['placements'])}")

        print(f"\n{'='*70}")
        print(f"✅ 批量分析完成!")
        print(f"{'='*70}\n")

    def print_summary(self):
        """打印统计摘要"""
        stats = self.statistics

        print("📊 装配数据统计:")
        print(f"  装配体总数: {stats['total_assemblies']}")
        print(f"  零件总数: {stats['total_parts']}")
        print(f"  装配关系总数: {stats['total_relations']}")

        print(f"\n🔧 配合类型分布 (Top 10):")
        total_mates = sum(stats['mate_types'].values())
        for mate_type, count in stats['mate_types'].most_common(10):
            percentage = (count / total_mates * 100) if total_mates > 0 else 0
            print(f"  {mate_type:20s}: {count:8d} ({percentage:5.1f}%)")

        print(f"\n📏 典型距离模式:")
        distances = [d['distance'] for d in stats['distance_patterns']]
        if distances:
            print(f"  平均距离: {sum(distances)/len(distances):.2f} mm")
            print(f"  最小距离: {min(distances):.2f} mm")
            print(f"  最大距离: {max(distances):.2f} mm")
            print(f"  中位数: {sorted(distances)[len(distances)//2]:.2f} mm")

        print(f"\n🧭 轴向对齐分布:")
        total_align = sum(stats['axis_alignments'].values())
        for axis, count in stats['axis_alignments'].most_common():
            percentage = (count / total_align * 100) if total_align > 0 else 0
            print(f"  {axis:15s}: {count:6d} ({percentage:5.1f}%)")

        print(f"\n📐 生成规则数量: {len(self.rules)}")

    def export_rules(self, output_path):
        """导出规则到JSON文件"""
        output = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'source_directory': str(self.all_assemblies[0]['filepath']) if self.all_assemblies else 'unknown',
                'total_assemblies_analyzed': self.statistics['total_assemblies'],
                'total_parts': self.statistics['total_parts'],
                'total_relations': self.statistics['total_relations']
            },
            'statistics': {
                'mate_types': dict(self.statistics['mate_types']),
                'axis_alignments': dict(self.statistics['axis_alignments']),
                'distance_stats': {
                    'count': len(self.statistics['distance_patterns']),
                    'average': sum(d['distance'] for d in self.statistics['distance_patterns']) / len(self.statistics['distance_patterns']) if self.statistics['distance_patterns'] else 0
                }
            },
            'rules': self.rules
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\n💾 规则库已导出: {output_path}")
        print(f"   文件大小: {Path(output_path).stat().st_size / 1024:.1f} KB")

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_assembly_rules.py <directory_with_step_files> [output_json]")
        print("Example: python extract_assembly_rules.py docs/solidworks/ assembly_rules.json")
        sys.exit(1)

    directory = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'assembly_rules.json'

    print("╔" + "="*68 + "╗")
    print("║" + " "*10 + "装配规则提取引擎 v1.0" + " "*36 + "║")
    print("╚" + "="*68 + "╝")

    extractor = AssemblyRuleExtractor()

    # 批量处理
    extractor.process_directory(directory)

    # 生成规则
    print("📊 统计分析中...")
    extractor.generate_rules()

    # 打印摘要
    extractor.print_summary()

    # 导出规则
    extractor.export_rules(output_file)

    print(f"\n🎉 完成! 共提取 {len(extractor.rules)} 条装配规则")
    print(f"💡 规则可用于自动装配算法")

if __name__ == '__main__':
    main()
