#!/usr/bin/env python3
"""
装配约束规则学习器
从几何特征JSON中学习装配规则，实现AI辅助装配
"""

import json
import math
from pathlib import Path
from collections import defaultdict, Counter
from typing import List, Dict, Optional, Tuple
from datetime import datetime


class ConstraintRuleLearner:
    """
    装配约束规则学习器

    功能：
    1. 从特征JSON中提取约束模式
    2. 统计装配规则频次
    3. 聚类生成规则库
    4. 支持在线学习和规则优化
    """

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or self._default_config()

        # 规则库（持久化存储）
        self.rules_db = []

        # 统计数据
        self.statistics = {
            'total_constraints': 0,
            'constraint_types': Counter(),
            'parameter_distributions': defaultdict(list),
            'confidence_histogram': Counter(),
            'learning_samples': 0
        }

    def _default_config(self) -> Dict:
        """默认配置"""
        return {
            # 约束判断阈值
            'thresholds': {
                'concentric_axis_dist': 0.5,     # mm - 同轴轴心距
                'concentric_angle': 2.0,          # 度 - 同轴角度
                'parallel_angle': 5.0,            # 度 - 平行角度
                'perpendicular_angle_min': 88.0,  # 度 - 垂直最小角
                'perpendicular_angle_max': 92.0,  # 度 - 垂直最大角
                'coincident_dist': 0.1,           # mm - 面接触距离
                'max_distance': 300.0             # mm - 最大关联距离
            },

            # 规则学习参数
            'learning': {
                'min_samples': 2,                 # 最少样本数
                'confidence_threshold': 0.5,      # 置信度阈值
                'clustering_eps': 10.0,           # 参数聚类半径（mm）
                'max_rules_per_type': 50          # 每种类型最多规则数
            }
        }

    # ==================== 阶段2：规则分析 ====================

    def analyze_features(self, features_json: Dict) -> List[Dict]:
        """
        从特征JSON中提取装配约束

        参数:
            features_json: {
                'parts': [
                    {'part_id': 'xxx', 'features': [...]},
                    ...
                ]
            }

        返回:
            约束列表
        """
        print("\n🔍 开始规则分析...")

        parts = features_json.get('parts', [])
        constraints = []

        # 1. 遍历所有零件对
        for i, part_a in enumerate(parts):
            for part_b in parts[i+1:]:
                # 2. 特征配对分析
                pair_constraints = self._analyze_part_pair(
                    part_a, part_b
                )
                constraints.extend(pair_constraints)

        print(f"  ✅ 识别约束: {len(constraints)} 个")

        # 3. 统计学习
        self._learn_rules_from_constraints(constraints)

        return constraints

    def _analyze_part_pair(self, part_a: Dict, part_b: Dict) -> List[Dict]:
        """分析两个零件之间的所有约束"""
        constraints = []

        features_a = part_a.get('features', [])
        features_b = part_b.get('features', [])

        for feat_a in features_a:
            for feat_b in features_b:
                constraint = self._match_constraint(
                    feat_a, feat_b,
                    part_a['part_id'], part_b['part_id']
                )
                if constraint:
                    constraints.append(constraint)

        return constraints

    def _match_constraint(self, feat_a: Dict, feat_b: Dict,
                         part_a_id: str, part_b_id: str) -> Optional[Dict]:
        """匹配两个特征的约束关系（核心算法）"""

        # Cylinder - Cylinder
        if feat_a['type'] == 'cylinder' and feat_b['type'] == 'cylinder':
            return self._analyze_cylinder_pair(feat_a, feat_b, part_a_id, part_b_id)

        # Plane - Plane
        if feat_a['type'] == 'plane' and feat_b['type'] == 'plane':
            return self._analyze_plane_pair(feat_a, feat_b, part_a_id, part_b_id)

        # Cone - Cylinder（螺纹）
        if (feat_a['type'] == 'cone' and feat_b['type'] == 'cylinder') or \
           (feat_a['type'] == 'cylinder' and feat_b['type'] == 'cone'):
            return self._analyze_thread_pair(feat_a, feat_b, part_a_id, part_b_id)

        # Sphere - Sphere（球面配合，如轴承）
        if feat_a['type'] == 'sphere' and feat_b['type'] == 'sphere':
            return self._analyze_sphere_pair(feat_a, feat_b, part_a_id, part_b_id)

        return None

    # ==================== 几何约束判断 ====================

    def _analyze_cylinder_pair(self, cyl_a: Dict, cyl_b: Dict,
                               part_a: str, part_b: str) -> Optional[Dict]:
        """分析圆柱-圆柱配合"""
        axis_a = cyl_a['axis']
        axis_b = cyl_b['axis']
        center_a = cyl_a['center']
        center_b = cyl_b['center']

        # 1. 计算轴线夹角
        angle = self._calc_axis_angle(axis_a, axis_b)

        # 2. 计算轴心距
        axis_distance = self._calc_axis_distance(center_a, axis_a, center_b, axis_b)

        # 3. 计算中心距
        center_distance = self._calc_distance(center_a, center_b)

        thresholds = self.config['thresholds']

        # 判断约束类型

        # ✅ 同轴配合
        if angle < thresholds['concentric_angle'] and \
           axis_distance < thresholds['concentric_axis_dist']:
            return {
                'type': 'concentric',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'axis_distance': round(axis_distance, 3),
                    'angle': round(angle, 2),
                    'radius_a': cyl_a['radius'],
                    'radius_b': cyl_b['radius'],
                    'center_distance': round(center_distance, 2)
                },
                'reasoning': f'同轴配合：轴心距{axis_distance:.2f}mm，轴线夹角{angle:.1f}°',
                'confidence': self._calc_confidence('concentric', axis_distance, angle),
                'feature_pair': ['cylinder', 'cylinder']
            }

        # ✅ 垂直配合
        if thresholds['perpendicular_angle_min'] < angle < thresholds['perpendicular_angle_max'] and \
           center_distance < thresholds['max_distance']:
            return {
                'type': 'perpendicular',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'angle': round(angle, 2),
                    'distance': round(center_distance, 2)
                },
                'reasoning': f'垂直配合：夹角{angle:.1f}°，距离{center_distance:.1f}mm',
                'confidence': self._calc_confidence('perpendicular', center_distance, angle),
                'feature_pair': ['cylinder', 'cylinder']
            }

        # ✅ 平行配合
        if angle < thresholds['parallel_angle'] and \
           10 < axis_distance < 200:
            return {
                'type': 'parallel',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'axis_distance': round(axis_distance, 2),
                    'angle': round(angle, 2)
                },
                'reasoning': f'平行配合：轴距{axis_distance:.1f}mm',
                'confidence': self._calc_confidence('parallel', axis_distance, angle),
                'feature_pair': ['cylinder', 'cylinder']
            }

        return None

    def _analyze_plane_pair(self, plane_a: Dict, plane_b: Dict,
                           part_a: str, part_b: str) -> Optional[Dict]:
        """分析平面-平面配合"""
        normal_a = plane_a['normal']
        normal_b = plane_b['normal']
        point_a = plane_a['point']
        point_b = plane_b['point']

        # 1. 法向夹角
        angle = self._calc_axis_angle(normal_a, normal_b)

        # 2. 点到平面距离
        point_dist = abs(sum(
            (point_a[i] - point_b[i]) * normal_b[i]
            for i in range(3)
        ))

        thresholds = self.config['thresholds']

        # ✅ 重合/接触
        if angle < thresholds['concentric_angle'] and \
           point_dist < thresholds['coincident_dist']:
            return {
                'type': 'coincident',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'angle': round(angle, 2),
                    'distance': round(point_dist, 3)
                },
                'reasoning': f'面接触：法向夹角{angle:.1f}°，间距{point_dist:.2f}mm',
                'confidence': self._calc_confidence('coincident', point_dist, angle),
                'feature_pair': ['plane', 'plane']
            }

        # ✅ 垂直
        if thresholds['perpendicular_angle_min'] < angle < thresholds['perpendicular_angle_max']:
            return {
                'type': 'perpendicular',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {'angle': round(angle, 2)},
                'reasoning': f'垂直：夹角{angle:.1f}°',
                'confidence': self._calc_confidence('perpendicular', 0, angle),
                'feature_pair': ['plane', 'plane']
            }

        return None

    def _analyze_thread_pair(self, feat_a: Dict, feat_b: Dict,
                            part_a: str, part_b: str) -> Optional[Dict]:
        """分析螺纹配合（圆锥+圆柱）"""
        cone = feat_a if feat_a['type'] == 'cone' else feat_b
        cylinder = feat_b if feat_a['type'] == 'cone' else feat_a

        # 检查锥角（螺纹通常30°-60°）
        semi_angle = cone.get('semi_angle_deg', 0)
        if not (30 < semi_angle < 60):
            return None

        # 检查轴线对齐
        axis_a = cone['axis']
        axis_b = cylinder['axis']
        angle = self._calc_axis_angle(axis_a, axis_b)

        if angle < 5.0:
            return {
                'type': 'screw',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'thread_angle': round(semi_angle * 2, 1),
                    'axis_angle': round(angle, 2)
                },
                'reasoning': f'螺纹配合：螺纹角{semi_angle*2:.1f}°',
                'confidence': 0.80,
                'feature_pair': ['cone', 'cylinder']
            }

        return None

    def _analyze_sphere_pair(self, sphere_a: Dict, sphere_b: Dict,
                            part_a: str, part_b: str) -> Optional[Dict]:
        """分析球面配合（球面轴承）"""
        center_a = sphere_a['center']
        center_b = sphere_b['center']
        radius_a = sphere_a['radius']
        radius_b = sphere_b['radius']

        distance = self._calc_distance(center_a, center_b)

        # 球心接触
        if distance < (radius_a + radius_b) * 1.05:
            return {
                'type': 'tangent',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'distance': round(distance, 2),
                    'radius_a': radius_a,
                    'radius_b': radius_b
                },
                'reasoning': f'球面接触：球心距{distance:.1f}mm',
                'confidence': 0.85,
                'feature_pair': ['sphere', 'sphere']
            }

        return None

    # ==================== 几何计算工具 ====================

    def _calc_axis_angle(self, axis_a: List[float], axis_b: List[float]) -> float:
        """计算两个轴线的夹角（度）"""
        dot = sum(a * b for a, b in zip(axis_a, axis_b))
        # 使用绝对值，避免180°和0°的混淆
        angle = math.degrees(math.acos(max(-1.0, min(1.0, abs(dot)))))
        return angle

    def _calc_distance(self, point_a: List[float], point_b: List[float]) -> float:
        """计算两点间距离"""
        return math.sqrt(sum((a - b)**2 for a, b in zip(point_a, point_b)))

    def _calc_axis_distance(self, center_a: List[float], axis_a: List[float],
                           center_b: List[float], axis_b: List[float]) -> float:
        """计算两条轴线的最短距离（异面直线距离）"""
        # 向量 center_a -> center_b
        vec_ab = [center_b[i] - center_a[i] for i in range(3)]

        # 叉积 axis_a × axis_b
        cross = [
            axis_a[1] * axis_b[2] - axis_a[2] * axis_b[1],
            axis_a[2] * axis_b[0] - axis_a[0] * axis_b[2],
            axis_a[0] * axis_b[1] - axis_a[1] * axis_b[0]
        ]

        cross_norm = math.sqrt(sum(c**2 for c in cross))

        if cross_norm < 1e-6:
            # 平行或重合，计算点到直线距离
            return self._point_to_line_distance(center_a, center_b, axis_b)

        # 异面直线距离 = |vec_ab · (axis_a × axis_b)| / |axis_a × axis_b|
        distance = abs(sum(vec_ab[i] * cross[i] for i in range(3))) / cross_norm
        return distance

    def _point_to_line_distance(self, point: List[float], line_point: List[float],
                                line_dir: List[float]) -> float:
        """点到直线的距离"""
        vec = [point[i] - line_point[i] for i in range(3)]
        proj_length = sum(vec[i] * line_dir[i] for i in range(3))
        proj_point = [line_point[i] + proj_length * line_dir[i] for i in range(3)]
        return math.sqrt(sum((point[i] - proj_point[i])**2 for i in range(3)))

    def _calc_confidence(self, constraint_type: str, distance: float, angle: float) -> float:
        """计算置信度（基于几何精度）"""
        thresholds = self.config['thresholds']

        if constraint_type == 'concentric':
            # 距离越小，置信度越高
            dist_score = max(0, 1 - distance / thresholds['concentric_axis_dist'])
            angle_score = max(0, 1 - angle / thresholds['concentric_angle'])
            return round((dist_score + angle_score) / 2, 2)

        elif constraint_type == 'perpendicular':
            # 角度越接近90°，置信度越高
            angle_dev = abs(angle - 90)
            angle_score = max(0, 1 - angle_dev / 2)
            return round(angle_score, 2)

        elif constraint_type == 'parallel':
            angle_score = max(0, 1 - angle / thresholds['parallel_angle'])
            return round(angle_score, 2)

        elif constraint_type == 'coincident':
            dist_score = max(0, 1 - distance / thresholds['coincident_dist'])
            return round(dist_score, 2)

        return 0.7  # 默认置信度

    # ==================== 规则学习 ====================

    def _learn_rules_from_constraints(self, constraints: List[Dict]):
        """从约束数据中学习规则（统计+聚类）"""
        print("\n🧠 开始规则学习...")

        # 1. 按类型分组
        grouped = defaultdict(list)
        for c in constraints:
            grouped[c['type']].append(c)

        # 2. 统计分析
        for ctype, items in grouped.items():
            print(f"  📊 分析 {ctype}: {len(items)} 个样本")

            self.statistics['constraint_types'][ctype] += len(items)

            # 提取参数分布
            for item in items:
                params = item.get('parameters', {})
                for key, value in params.items():
                    if isinstance(value, (int, float)):
                        self.statistics['parameter_distributions'][f'{ctype}_{key}'].append(value)

            # 3. 聚类生成规则
            learned = self._cluster_and_generate_rules(ctype, items)
            self.rules_db.extend(learned)

        print(f"  ✅ 学习完成：{len(self.rules_db)} 条规则")

    def _cluster_and_generate_rules(self, constraint_type: str, items: List[Dict]) -> List[Dict]:
        """聚类生成规则"""
        config = self.config['learning']

        if len(items) < config['min_samples']:
            return []

        # 简单统计规则（MVP版本）
        # TODO: 使用DBSCAN/K-Means进行参数聚类

        # 计算参数统计
        param_stats = {}
        all_params = [item.get('parameters', {}) for item in items]

        for key in all_params[0].keys():
            values = [p.get(key) for p in all_params if isinstance(p.get(key), (int, float))]
            if values:
                param_stats[key] = {
                    'mean': sum(values) / len(values),
                    'min': min(values),
                    'max': max(values),
                    'std': self._calc_std(values)
                }

        # 生成规则
        rule = {
            'rule_id': f'LEARNED_{constraint_type}_{datetime.now().strftime("%Y%m%d%H%M%S")}',
            'constraint_type': constraint_type,
            'feature_pair': items[0].get('feature_pair', []),
            'sample_count': len(items),
            'parameter_stats': param_stats,
            'confidence': sum(item.get('confidence', 0.5) for item in items) / len(items),
            'examples': items[:3],  # 保存前3个示例
            'created_at': datetime.now().isoformat()
        }

        return [rule]

    def _calc_std(self, values: List[float]) -> float:
        """计算标准差"""
        mean = sum(values) / len(values)
        variance = sum((x - mean)**2 for x in values) / len(values)
        return math.sqrt(variance)

    # ==================== 规则导出 ====================

    def export_rules(self, output_path: str):
        """导出规则库到JSON"""
        output = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_rules': len(self.rules_db),
                'total_constraints_analyzed': self.statistics['total_constraints'],
                'version': '2.0'
            },
            'statistics': {
                'constraint_types': dict(self.statistics['constraint_types']),
                'parameter_distributions': {
                    k: {
                        'mean': sum(v) / len(v) if v else 0,
                        'min': min(v) if v else 0,
                        'max': max(v) if v else 0
                    }
                    for k, v in self.statistics['parameter_distributions'].items()
                }
            },
            'rules': self.rules_db,
            'config': self.config
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\n💾 规则库已导出: {output_path}")
        print(f"   文件大小: {Path(output_path).stat().st_size / 1024:.1f} KB")


def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ConstraintRuleLearner.py <features_json> [output_rules_json]")
        print("\n示例:")
        print("  python ConstraintRuleLearner.py features.json rules_output.json")
        sys.exit(1)

    features_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'learned_rules.json'

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          装配约束规则学习器 v2.0                               ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    # 加载特征JSON
    with open(features_file, 'r', encoding='utf-8') as f:
        features_json = json.load(f)

    # 创建学习器
    learner = ConstraintRuleLearner()

    # 分析约束
    constraints = learner.analyze_features(features_json)

    # 导出规则
    learner.export_rules(output_file)

    print(f"\n🎉 完成! 共学习 {len(learner.rules_db)} 条规则")


if __name__ == '__main__':
    main()
