#!/usr/bin/env python3
"""
AI自动装配引擎 - 基于规则库自动生成装配约束
"""
import json
import sys
import math
from pathlib import Path

def load_rules(rules_file):
    """加载装配规则"""
    if not Path(rules_file).exists():
        return []
    with open(rules_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('rules', [])

def calculate_confidence(rule, part1, part2):
    """计算约束置信度"""
    base_confidence = rule.get('probability', 0.5)

    # 根据零件名称相似度调整
    if 'flange' in part1.lower() and 'flange' in part2.lower():
        base_confidence *= 1.2

    return min(base_confidence, 1.0)

def generate_constraints(part_ids, rules):
    """生成装配约束"""
    constraints = []

    for i, part1_id in enumerate(part_ids):
        for part2_id in part_ids[i+1:]:
            # 应用规则
            for rule in rules:
                if rule.get('type') == 'mate_type_frequency':
                    mate_type = rule.get('mate_type', 'concentric')
                    confidence = rule.get('probability', 0.5)

                    if confidence > 0.3:  # 只使用高置信度规则
                        constraints.append({
                            'part1_id': part1_id,
                            'part2_id': part2_id,
                            'type': mate_type,
                            'confidence': confidence,
                            'rule_id': rule.get('rule_id')
                        })
                        break  # 每对零件只生成一个约束

    return constraints

def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'message': 'Usage: auto_assembly_engine.py <design_id> <part_ids_json> <rules_file>'
        }))
        sys.exit(1)

    design_id = sys.argv[1]
    part_ids = json.loads(sys.argv[2])
    rules_file = sys.argv[3]

    # 加载规则
    rules = load_rules(rules_file)

    if not rules:
        print(json.dumps({
            'success': False,
            'message': '未找到装配规则，请先进行规则学习'
        }))
        sys.exit(1)

    # 生成约束
    constraints = generate_constraints(part_ids, rules)

    # 输出结果
    result = {
        'success': True,
        'design_id': design_id,
        'constraints': constraints,
        'rules_used': len([r for r in rules if r.get('probability', 0) > 0.3]),
        'total_constraints': len(constraints)
    }

    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
