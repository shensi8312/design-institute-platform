#!/usr/bin/env python3
"""
零件库构建器 - 从STEP文件建立零件库
"""
import sys
import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List
sys.path.append(str(Path(__file__).parent.parent))
from step_assembly_analyzer import StepAssemblyAnalyzer

class PartLibraryBuilder:
    def __init__(self):
        self.part_library = defaultdict(list)
        self.part_specs = {}

    def build_from_step_files(self, step_directory: str):
        """从STEP文件构建零件库"""
        print("📚 构建零件库...")

        step_dir = Path(step_directory)

        # 处理零件文件
        part_files = list(step_dir.glob('P*.STEP')) + list(step_dir.glob('[0-9]*.STEP'))

        print(f"  ✅ 找到 {len(part_files)} 个零件STEP文件")

        for i, part_file in enumerate(part_files, 1):
            if i % 10 == 0:
                print(f"  处理进度: {i}/{len(part_files)}")

            try:
                analyzer = StepAssemblyAnalyzer()
                analyzer.parse_step_file(str(part_file))

                # 提取零件特征
                part_info = self._extract_part_features(analyzer, part_file.name)

                # 分类存储
                part_type = self._classify_part(part_info)
                self.part_library[part_type].append(part_info)

                # 规格化
                part_spec = self._normalize_spec(part_info)
                self.part_specs[part_file.stem] = part_spec

            except Exception as e:
                print(f"  ⚠️  处理失败 {part_file.name}: {e}")

        print(f"\n✅ 零件库构建完成:")
        for part_type, parts in self.part_library.items():
            print(f"  - {part_type}: {len(parts)}个")

        return self.part_library

    def _extract_part_features(self, analyzer: StepAssemblyAnalyzer, filename: str) -> Dict:
        """提取零件特征"""
        result = analyzer.export_results()

        features = {
            'filename': filename,
            'part_number': filename.split('.')[0],
            'cylinders': result['cylinders'],
            'has_holes': any(c['type'] == 'hole' for c in result['cylinders']),
            'has_shafts': any(c['type'] == 'shaft' for c in result['cylinders']),
            'hole_count': sum(1 for c in result['cylinders'] if c['type'] == 'hole'),
            'bounding_box': self._estimate_bounding_box(result),
        }

        return features

    def _estimate_bounding_box(self, result: Dict) -> Dict:
        """估算包围盒"""
        # 简化实现 - 从圆柱位置估算
        positions = [c['position'] for c in result['cylinders'] if c['position']]

        if not positions:
            return {'width': 0, 'height': 0, 'depth': 0}

        xs = [p[0] for p in positions]
        ys = [p[1] for p in positions]
        zs = [p[2] for p in positions]

        return {
            'width': max(xs) - min(xs) if xs else 0,
            'height': max(ys) - min(ys) if ys else 0,
            'depth': max(zs) - min(zs) if zs else 0
        }

    def _classify_part(self, part_info: Dict) -> str:
        """分类零件类型"""
        filename = part_info['filename']
        part_number = part_info['part_number']

        # 基于文件名规则
        if filename.startswith('P'):
            # P开头 - 非标零件
            if part_info['has_holes'] and part_info['has_shafts']:
                return 'flange'  # 有孔有轴 → 法兰
            elif part_info['has_holes']:
                return 'plate'  # 只有孔 → 板类
            elif part_info['has_shafts']:
                return 'shaft'  # 只有轴 → 轴类
            else:
                return 'custom_part'

        elif part_number.startswith('1000'):
            # 标准件
            if 1000 <= int(part_number[:6]) < 100010:
                return 'bolt'
            elif 100010 <= int(part_number[:6]) < 100020:
                return 'nut'
            elif 100020 <= int(part_number[:6]) < 100030:
                return 'washer'
            else:
                return 'standard_part'

        elif part_number.startswith('101'):
            # 管件接头
            return 'fitting'

        return 'unknown'

    def _normalize_spec(self, part_info: Dict) -> Dict:
        """规格化零件参数"""
        part_number = part_info['part_number']

        spec = {
            'part_number': part_number,
            'type': self._classify_part(part_info),
        }

        # 从零件号推断规格
        if part_info['has_holes']:
            # 估算孔径（从圆柱半径）
            hole_diameters = [
                c['radius'] * 2 for c in part_info['cylinders']
                if c.get('type') == 'hole' and c.get('radius')
            ]
            if hole_diameters:
                spec['hole_diameter'] = round(sum(hole_diameters) / len(hole_diameters), 1)

        # 尺寸
        bbox = part_info['bounding_box']
        spec['dimensions'] = {
            'width': round(bbox['width'], 1),
            'height': round(bbox['height'], 1),
            'depth': round(bbox['depth'], 1)
        }

        return spec

    def search_parts(self, query: Dict) -> List[Dict]:
        """搜索零件"""
        results = []

        part_type = query.get('type')
        if part_type and part_type in self.part_library:
            candidates = self.part_library[part_type]

            # 过滤条件
            for part in candidates:
                match = True

                # 孔径匹配
                if 'hole_diameter' in query:
                    spec = self.part_specs.get(part['part_number'], {})
                    if abs(spec.get('hole_diameter', 0) - query['hole_diameter']) > 1:
                        match = False

                if match:
                    results.append({
                        **part,
                        'spec': self.part_specs.get(part['part_number'], {})
                    })

        return results

    def export_library(self, output_path: str):
        """导出零件库"""
        library_data = {
            'part_library': dict(self.part_library),
            'part_specs': self.part_specs,
            'statistics': {
                'total_parts': sum(len(parts) for parts in self.part_library.values()),
                'part_types': list(self.part_library.keys())
            }
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(library_data, f, indent=2, ensure_ascii=False, default=str)

        print(f"💾 零件库已导出: {output_path}")

def main():
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          零件库构建器 v1.0                                      ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    builder = PartLibraryBuilder()

    # 构建零件库
    builder.build_from_step_files("docs/solidworks/")

    # 导出
    builder.export_library("docs/part_library.json")

    # 测试搜索
    print("\n🔍 测试搜索:")
    results = builder.search_parts({'type': 'flange'})
    print(f"  找到 {len(results)} 个法兰零件")

if __name__ == '__main__':
    main()
