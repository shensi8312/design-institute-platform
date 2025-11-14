"""
从SolidWorks配合关系中学习装配规则
在Mac开发机上运行

输入: assembly_mates.json (从Windows提取的配合关系)
输出: learned_assembly_rules.json (学习到的规则)

使用方法:
python learn_assembly_rules_from_mates.py assembly_mates.json
"""

import json
import sys
from collections import defaultdict
import re

class AssemblyRuleLearner:
    def __init__(self):
        self.raw_mates = []
        self.rules = []
        self.part_name_features = defaultdict(list)  # 零件名称特征库
        self.mate_patterns = defaultdict(int)  # 配对模式统计

    def load_mates(self, json_file):
        """加载提取的配合关系数据"""
        print(f"📂 加载配合数据: {json_file}")

        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        total_mates = 0
        for assembly_name, assembly_data in data.items():
            print(f"  ✓ {assembly_name}: {assembly_data['mate_count']} 个配合")
            for mate in assembly_data['mates']:
                self.raw_mates.append({
                    'assembly': assembly_name,
                    **mate
                })
                total_mates += 1

        print(f"✅ 共加载 {total_mates} 个配合关系")
        return total_mates > 0

    def extract_part_features(self, part_name):
        """从零件名称提取特征关键词"""
        part_name_lower = part_name.lower()

        features = []

        # 零件类型关键词
        type_keywords = {
            'valve': ['valve', '阀'],
            'gland': ['gland'],
            'cap': ['cap'],
            'plug': ['plug'],
            'gasket': ['gasket', 'seal', '密封', '垫片'],
            'nut': ['nut', '螺母'],
            'bolt': ['bolt', 'screw', '螺栓', '螺丝'],
            'sensor': ['sensor', 'transducer', 'switch', 'detector', '传感器'],
            'support': ['support', 'bracket', '支架'],
            'pipe': ['pipe', 'tube', 'tubing', 'hose', '管'],
            'fitting': ['fitting', 'connector', '接头'],
            'flange': ['flange', '法兰']
        }

        for type_name, keywords in type_keywords.items():
            for keyword in keywords:
                if keyword in part_name_lower:
                    features.append(f"TYPE_{type_name.upper()}")
                    break

        # 尺寸特征
        size_match = re.search(r'(\d+/\d+)["\']?|(\d+)mm|DN(\d+)', part_name, re.I)
        if size_match:
            size_value = size_match.group(0)
            features.append(f"SIZE_{size_value}")

        # VCR系列特征
        if 'vcr' in part_name_lower or 'VCR' in part_name:
            features.append("SERIES_VCR")
            if 'micro' in part_name_lower:
                features.append("VCR_MICRO")
            if 'short' in part_name_lower:
                features.append("VCR_SHORT")
            if 'long' in part_name_lower:
                features.append("VCR_LONG")

        # IGS系列特征
        if 'igs' in part_name_lower or 'IGS' in part_name:
            features.append("SERIES_IGS")

        return features

    def learn_patterns(self):
        """学习配对模式"""
        print("\n🧠 开始学习配对模式...")

        # 统计每种配对模式的出现次数
        for mate in self.raw_mates:
            part1_name = mate['part1_name']
            part2_name = mate['part2_name']
            mate_type = mate['type']

            # 提取特征
            features1 = self.extract_part_features(part1_name)
            features2 = self.extract_part_features(part2_name)

            # 生成配对模式（使用类型特征）
            type_features1 = [f for f in features1 if f.startswith('TYPE_')]
            type_features2 = [f for f in features2 if f.startswith('TYPE_')]

            if type_features1 and type_features2:
                # 按字母顺序排序，保证一致性
                pattern_parts = sorted([type_features1[0], type_features2[0]])
                pattern_key = f"{pattern_parts[0]}+{pattern_parts[1]}→{mate_type}"
                self.mate_patterns[pattern_key] += 1

                # 记录示例
                if pattern_key not in self.part_name_features:
                    self.part_name_features[pattern_key] = []

                self.part_name_features[pattern_key].append({
                    'part1': part1_name,
                    'part2': part2_name,
                    'features1': features1,
                    'features2': features2,
                    'mate_type': mate_type,
                    'alignment': mate.get('alignment', 'ALIGNED')
                })

        # 输出学习到的模式
        print(f"\n📊 学习到 {len(self.mate_patterns)} 种配对模式:")
        for pattern, count in sorted(self.mate_patterns.items(), key=lambda x: x[1], reverse=True):
            print(f"  {pattern}: {count} 次")

            # 显示示例
            if pattern in self.part_name_features and self.part_name_features[pattern]:
                example = self.part_name_features[pattern][0]
                print(f"    示例: {example['part1']} ↔ {example['part2']}")

    def generate_rules(self):
        """生成装配规则"""
        print("\n🎯 生成装配规则...")

        rule_id = 1
        for pattern, count in self.mate_patterns.items():
            # 只保留出现2次以上的模式（过滤噪声）
            if count < 2:
                continue

            examples = self.part_name_features[pattern]

            # 解析模式
            parts = pattern.split('→')
            type_pair = parts[0]
            mate_type = parts[1]

            type1, type2 = type_pair.split('+')

            # 提取共同特征
            common_features1 = self._extract_common_features(examples, 'features1')
            common_features2 = self._extract_common_features(examples, 'features2')

            # 生成规则
            rule = {
                'rule_id': f"LEARNED_{rule_id:03d}",
                'name': f"自动学习规则: {type1} + {type2}",
                'description': f"从{count}个样本中学习到的配对规则",
                'priority': min(10, count),  # 出现次数越多优先级越高
                'constraint_type': mate_type,
                'condition_logic': {
                    'type': 'learned_pattern',
                    'part1_features': common_features1,
                    'part2_features': common_features2,
                    'min_match_score': 0.5  # 至少50%特征匹配
                },
                'action_template': {
                    'type': mate_type,
                    'parameters': self._extract_common_parameters(examples)
                },
                'source': 'solidworks_learning',
                'confidence': min(1.0, count / 10.0),  # 置信度基于样本数量
                'sample_count': count,
                'examples': [
                    {
                        'part1': ex['part1'],
                        'part2': ex['part2'],
                        'assembly': self._find_assembly(ex['part1'], ex['part2'])
                    }
                    for ex in examples[:3]  # 最多保留3个示例
                ]
            }

            self.rules.append(rule)
            rule_id += 1

            print(f"  ✓ 规则 {rule['rule_id']}: {rule['name']} (置信度: {rule['confidence']:.2f})")

    def _extract_common_features(self, examples, feature_key):
        """提取多个示例中的共同特征"""
        if not examples:
            return []

        # 统计每个特征的出现次数
        feature_counts = defaultdict(int)
        for ex in examples:
            for feature in ex[feature_key]:
                feature_counts[feature] += 1

        # 保留出现在超过50%示例中的特征
        threshold = len(examples) * 0.5
        common_features = [
            feature for feature, count in feature_counts.items()
            if count >= threshold
        ]

        return common_features

    def _extract_common_parameters(self, examples):
        """提取配合的通用参数"""
        parameters = {}

        # 统计alignment
        alignments = [ex.get('alignment', 'ALIGNED') for ex in examples]
        most_common_alignment = max(set(alignments), key=alignments.count)
        parameters['alignment'] = most_common_alignment

        # TODO: 提取其他参数（距离、角度等）

        return parameters

    def _find_assembly(self, part1, part2):
        """查找零件所在的装配体"""
        for mate in self.raw_mates:
            if mate['part1_name'] == part1 and mate['part2_name'] == part2:
                return mate['assembly']
        return 'unknown'

    def save_rules(self, output_file='learned_assembly_rules.json'):
        """保存学习到的规则"""
        output_data = {
            'metadata': {
                'total_mates_analyzed': len(self.raw_mates),
                'patterns_discovered': len(self.mate_patterns),
                'rules_generated': len(self.rules)
            },
            'rules': self.rules
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n✅ 规则已保存到: {output_file}")
        print(f"📊 统计:")
        print(f"   - 分析的配合关系: {len(self.raw_mates)}")
        print(f"   - 发现的模式: {len(self.mate_patterns)}")
        print(f"   - 生成的规则: {len(self.rules)}")

def main():
    if len(sys.argv) < 2:
        print("用法: python learn_assembly_rules_from_mates.py <assembly_mates.json>")
        sys.exit(1)

    input_file = sys.argv[1]

    print("=" * 60)
    print("装配规则学习工具")
    print("=" * 60)

    learner = AssemblyRuleLearner()

    # 1. 加载配合数据
    if not learner.load_mates(input_file):
        print("❌ 加载配合数据失败")
        sys.exit(1)

    # 2. 学习配对模式
    learner.learn_patterns()

    # 3. 生成规则
    learner.generate_rules()

    # 4. 保存规则
    learner.save_rules('learned_assembly_rules.json')

    print("\n✅ 学习完成！")
    print("\n📌 下一步:")
    print("   1. 将 learned_assembly_rules.json 导入到数据库")
    print("   2. 当新PID来时，系统会自动应用这些规则")
    print("   3. 生成装配约束指导")

if __name__ == "__main__":
    main()
