#!/usr/bin/env python3
"""
装配规则学习系统
从PID图纸 + STEP装配体中学习装配规则
"""
import sys
import json
from collections import defaultdict
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_SOLID
from OCC.Core.TopoDS import topods
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties
from OCC.Core.BRepBndLib import brepbndlib
from OCC.Core.Bnd import Bnd_Box

def extract_assembly_structure(step_file):
    """
    从STEP装配体中提取结构信息
    返回: {
        'parts': [{'id', 'position', 'rotation', 'bbox', 'volume'}],
        'connections': [{'part1', 'part2', 'distance', 'type'}]
    }
    """
    print(f"\n🔍 分析装配体: {step_file}", file=sys.stderr)

    reader = STEPControl_Reader()
    status = reader.ReadFile(step_file)
    if status != IFSelect_RetDone:
        return None

    reader.TransferRoots()
    shape = reader.OneShape()

    parts = []
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    part_idx = 0

    while explorer.More():
        solid = topods.Solid(explorer.Current())

        # 提取位置变换
        location = solid.Location()
        trsf = location.Transformation()
        trans = trsf.TranslationPart()
        position = [trans.X(), trans.Y(), trans.Z()]

        # 提取旋转矩阵
        rot = trsf.VectorialPart()
        rotation = [
            [rot.Value(1,1), rot.Value(1,2), rot.Value(1,3)],
            [rot.Value(2,1), rot.Value(2,2), rot.Value(2,3)],
            [rot.Value(3,1), rot.Value(3,2), rot.Value(3,3)]
        ]

        # 计算体积
        props = GProp_GProps()
        try:
            brepgprop_VolumeProperties(solid, props)
            volume = props.Mass()
        except:
            volume = 0.0

        # 简化包围盒（使用质心估算）
        bbox_data = {
            'min': [position[0]-10, position[1]-10, position[2]-10],
            'max': [position[0]+10, position[1]+10, position[2]+10],
            'size': [20, 20, 20]
        }

        parts.append({
            'id': f'Part_{part_idx}',
            'index': part_idx,
            'position': position,
            'rotation': rotation,
            'bbox': bbox_data,
            'volume': volume
        })

        part_idx += 1
        explorer.Next()

    print(f"✓ 提取 {len(parts)} 个零件", file=sys.stderr)

    # 分析零件间连接关系
    connections = analyze_connections(parts)
    print(f"✓ 识别 {len(connections)} 个连接", file=sys.stderr)

    return {
        'parts': parts,
        'connections': connections,
        'total_parts': len(parts)
    }

def analyze_connections(parts):
    """分析零件间的连接关系"""
    connections = []

    for i, part1 in enumerate(parts):
        for j, part2 in enumerate(parts):
            if i >= j:
                continue

            # 计算质心距离
            pos1 = part1['position']
            pos2 = part2['position']
            distance = ((pos1[0]-pos2[0])**2 +
                       (pos1[1]-pos2[1])**2 +
                       (pos1[2]-pos2[2])**2) ** 0.5

            # 判断是否接触或接近
            bbox1 = part1['bbox']
            bbox2 = part2['bbox']

            # 检查包围盒是否相交或接近
            threshold = 10.0  # 10mm阈值
            if check_proximity(bbox1, bbox2, threshold):
                conn_type = classify_connection(part1, part2, distance)
                connections.append({
                    'part1': part1['id'],
                    'part2': part2['id'],
                    'distance': round(distance, 2),
                    'type': conn_type,
                    'relative_position': [
                        pos2[0] - pos1[0],
                        pos2[1] - pos1[1],
                        pos2[2] - pos1[2]
                    ]
                })

    return connections

def check_proximity(bbox1, bbox2, threshold):
    """检查两个包围盒是否接近"""
    min1, max1 = bbox1['min'], bbox1['max']
    min2, max2 = bbox2['min'], bbox2['max']

    # 检查各轴是否有间隙
    for i in range(3):
        gap = max(min1[i] - max2[i], min2[i] - max1[i])
        if gap > threshold:
            return False
    return True

def classify_connection(part1, part2, distance):
    """分类连接类型"""
    vol1, vol2 = part1['volume'], part2['volume']
    vol_ratio = max(vol1, vol2) / (min(vol1, vol2) + 1e-6)

    if distance < 5:
        return 'tight_fit'
    elif distance < 20:
        return 'close_fit'
    elif vol_ratio > 100:
        return 'mounting'  # 大件安装小件
    else:
        return 'adjacent'

def learn_assembly_rules(assembly_data):
    """
    从装配数据中学习规则
    """
    rules = {
        'connection_patterns': defaultdict(list),
        'position_constraints': [],
        'assembly_sequence': []
    }

    # 1. 学习连接模式
    for conn in assembly_data['connections']:
        pattern = {
            'type': conn['type'],
            'distance': conn['distance'],
            'relative_pos': conn['relative_position']
        }
        rules['connection_patterns'][conn['type']].append(pattern)

    # 2. 学习位置约束
    parts = assembly_data['parts']
    for part in parts:
        rules['position_constraints'].append({
            'part_id': part['id'],
            'position_range': part['bbox'],
            'typical_position': part['position']
        })

    # 3. 推断装配顺序（基于连接关系）
    # 简化版：按Z坐标排序
    sorted_parts = sorted(parts, key=lambda p: p['position'][2])
    rules['assembly_sequence'] = [p['id'] for p in sorted_parts]

    # 4. 统计连接类型分布
    type_stats = defaultdict(int)
    for conn in assembly_data['connections']:
        type_stats[conn['type']] += 1
    rules['connection_statistics'] = dict(type_stats)

    return rules

def main(step_file, output_file=None):
    """主函数"""
    # 提取装配结构
    assembly_data = extract_assembly_structure(step_file)
    if not assembly_data:
        print(json.dumps({'success': False, 'error': '无法解析STEP文件'}))
        return 1

    # 学习规则
    print("\n🧠 学习装配规则...", file=sys.stderr)
    rules = learn_assembly_rules(assembly_data)

    result = {
        'success': True,
        'assembly_data': assembly_data,
        'learned_rules': rules,
        'source_file': step_file.split('/')[-1]
    }

    # 保存结果
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n✓ 规则已保存: {output_file}", file=sys.stderr)

    # 输出摘要
    print(f"\n📊 学习结果:", file=sys.stderr)
    print(f"  - 零件数: {assembly_data['total_parts']}", file=sys.stderr)
    print(f"  - 连接数: {len(assembly_data['connections'])}", file=sys.stderr)
    print(f"  - 连接类型: {list(rules['connection_statistics'].keys())}", file=sys.stderr)

    print(json.dumps(result))
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': '缺少STEP文件路径'}))
        sys.exit(1)

    step_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    sys.exit(main(step_file, output_file))
