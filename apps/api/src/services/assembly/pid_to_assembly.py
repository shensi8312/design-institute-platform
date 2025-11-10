#!/usr/bin/env python3
"""
PID图纸自动装配系统
从PID图纸识别零件 → 匹配3D模型 → 应用规则 → 生成装配体
"""
import sys
import json
import re
from pathlib import Path

class PIDAssemblyEngine:
    """PID自动装配引擎"""

    def __init__(self, learned_rules_file, parts_catalog_file=None):
        """初始化"""
        # 加载学习到的装配规则
        with open(learned_rules_file, 'r', encoding='utf-8') as f:
            rules_data = json.load(f)
            self.rules = rules_data['learned_rules']
            self.reference_assembly = rules_data['assembly_data']

        # 零件目录（从数据库或文件加载）
        self.parts_catalog = self._load_parts_catalog(parts_catalog_file)

        print(f"✓ 已加载规则: {len(self.reference_assembly['parts'])}个零件", file=sys.stderr)
        print(f"✓ 零件库: {len(self.parts_catalog)}个零件", file=sys.stderr)

    def _load_parts_catalog(self, catalog_file):
        """加载零件库"""
        if catalog_file and Path(catalog_file).exists():
            with open(catalog_file, 'r', encoding='utf-8') as f:
                return json.load(f)

        # 简化版：从STEP文件目录扫描
        parts_dir = Path('/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks')
        catalog = {}

        if parts_dir.exists():
            for step_file in parts_dir.glob('*.STEP'):
                part_number = self._extract_part_number(step_file.name)
                if part_number:
                    catalog[part_number] = {
                        'number': part_number,
                        'file': str(step_file),
                        'name': step_file.stem
                    }

        return catalog

    def _extract_part_number(self, filename):
        """从文件名提取零件编号"""
        # 匹配常见模式: A0000002632, 100001060023, P0000053650等
        patterns = [
            r'([AP]\d{10,})',  # A或P开头+数字
            r'(\d{12,})',      # 纯数字
        ]

        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                return match.group(1)
        return None

    def parse_pid_image(self, pid_image_path):
        """
        解析PID图纸（简化版）
        实际应该用OCR+符号识别
        """
        print(f"\n🔍 解析PID图纸: {pid_image_path}", file=sys.stderr)

        # TODO: 实际实现应该调用：
        # 1. QwenVL识别图纸中的设备符号
        # 2. OCR提取零件编号
        # 3. 识别连接线和管道

        # 模拟返回数据
        detected_parts = [
            {'id': 'dev_1', 'type': 'valve', 'number': '100001060023', 'position': [0, 0]},
            {'id': 'dev_2', 'type': 'pump', 'number': 'P0000053650', 'position': [100, 0]},
            {'id': 'dev_3', 'type': 'tank', 'number': 'A0000002655', 'position': [200, 0]},
        ]

        connections = [
            {'from': 'dev_1', 'to': 'dev_2', 'type': 'pipe'},
            {'from': 'dev_2', 'to': 'dev_3', 'type': 'pipe'},
        ]

        print(f"✓ 检测到 {len(detected_parts)} 个设备", file=sys.stderr)
        print(f"✓ 检测到 {len(connections)} 个连接", file=sys.stderr)

        return {
            'parts': detected_parts,
            'connections': connections
        }

    def match_3d_models(self, pid_parts):
        """匹配零件库中的3D模型"""
        print(f"\n🔗 匹配3D模型...", file=sys.stderr)

        matched = []
        for part in pid_parts:
            part_number = part['number']

            if part_number in self.parts_catalog:
                model_info = self.parts_catalog[part_number]
                matched.append({
                    'pid_id': part['id'],
                    'part_number': part_number,
                    'model_file': model_info['file'],
                    'type': part['type'],
                    'pid_position': part['position']
                })
                print(f"  ✓ {part_number} → {model_info['name']}", file=sys.stderr)
            else:
                print(f"  ✗ {part_number} 未找到3D模型", file=sys.stderr)

        print(f"\n✓ 匹配成功: {len(matched)}/{len(pid_parts)}", file=sys.stderr)
        return matched

    def apply_assembly_rules(self, matched_parts, pid_connections):
        """应用学习到的装配规则生成装配体"""
        print(f"\n🧠 应用装配规则...", file=sys.stderr)

        # 1. 根据PID位置计算初始3D位置
        assembly_parts = []
        for i, part in enumerate(matched_parts):
            # PID是2D，需要推断3D位置
            # 简化算法：按PID的x坐标排列，y固定，z=0
            pid_x, pid_y = part['pid_position']

            position = [
                pid_x * 0.1,  # 缩放因子
                0.0,
                pid_y * 0.1
            ]

            # 查找参考装配体中类似零件的典型旋转
            typical_rotation = self._find_typical_rotation(part['type'])

            assembly_parts.append({
                'id': f"Part_{i}",
                'pid_id': part['pid_id'],
                'part_number': part['part_number'],
                'model_file': part['model_file'],
                'position': position,
                'rotation': typical_rotation,
                'type': part['type']
            })

        # 2. 根据连接关系调整位置
        for conn in pid_connections:
            # 查找连接的两个零件
            part1 = next((p for p in assembly_parts if p['pid_id'] == conn['from']), None)
            part2 = next((p for p in assembly_parts if p['pid_id'] == conn['to']), None)

            if part1 and part2:
                # 应用连接规则（从学习到的规则中选择合适的）
                conn_rule = self._select_connection_rule(
                    part1['type'],
                    part2['type'],
                    conn['type']
                )

                if conn_rule:
                    # 调整part2的位置使其与part1正确连接
                    part2['position'] = [
                        part1['position'][0] + conn_rule['relative_pos'][0],
                        part1['position'][1] + conn_rule['relative_pos'][1],
                        part1['position'][2] + conn_rule['relative_pos'][2]
                    ]

        print(f"✓ 生成装配体: {len(assembly_parts)}个零件", file=sys.stderr)

        return {
            'parts': assembly_parts,
            'source': 'pid_auto_assembly',
            'algorithm': 'rule_based',
            'confidence': 0.75
        }

    def _find_typical_rotation(self, part_type):
        """查找典型旋转矩阵"""
        # 简化：返回单位矩阵（无旋转）
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

    def _select_connection_rule(self, type1, type2, conn_type):
        """选择合适的连接规则"""
        # 从学习到的规则中选择
        conn_patterns = self.rules['connection_patterns']

        # 简化：选择close_fit类型的平均值
        if 'close_fit' in conn_patterns and len(conn_patterns['close_fit']) > 0:
            patterns = conn_patterns['close_fit']
            # 计算平均相对位置
            avg_pos = [0, 0, 0]
            for p in patterns[:10]:  # 取前10个样本
                for i in range(3):
                    avg_pos[i] += p['relative_pos'][i]

            for i in range(3):
                avg_pos[i] /= min(len(patterns), 10)

            return {
                'type': 'close_fit',
                'relative_pos': avg_pos
            }

        return None

    def generate_assembly(self, pid_image_path, output_file):
        """完整流程：PID → 装配体"""
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"PID自动装配引擎", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)

        # 1. 解析PID图纸
        pid_data = self.parse_pid_image(pid_image_path)

        # 2. 匹配3D模型
        matched_parts = self.match_3d_models(pid_data['parts'])

        if len(matched_parts) == 0:
            return {
                'success': False,
                'error': '没有找到匹配的3D模型'
            }

        # 3. 应用装配规则
        assembly = self.apply_assembly_rules(matched_parts, pid_data['connections'])

        # 4. 保存结果
        result = {
            'success': True,
            'pid_file': pid_image_path,
            'assembly': assembly,
            'statistics': {
                'detected_parts': len(pid_data['parts']),
                'matched_parts': len(matched_parts),
                'final_assembly_parts': len(assembly['parts'])
            }
        }

        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n✓ 装配体已保存: {output_file}", file=sys.stderr)

        return result

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': '用法: python pid_to_assembly.py <learned_rules.json> <pid_image> [output.json]'
        }))
        return 1

    rules_file = sys.argv[1]
    pid_image = sys.argv[2]
    output_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        engine = PIDAssemblyEngine(rules_file)
        result = engine.generate_assembly(pid_image, output_file)

        print(json.dumps(result))
        return 0 if result['success'] else 1

    except Exception as e:
        import traceback
        print(json.dumps({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }))
        return 1

if __name__ == '__main__':
    sys.exit(main())
