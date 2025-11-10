#!/usr/bin/env python3
"""
批量STEP文件分析脚本
遍历目录中的所有STEP文件，提取几何特征和装配约束，并学习规则
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from step_assembly_analyzer_v2 import StepAssemblyAnalyzerV2
sys.path.append(str(Path(__file__).parent / 'assembly'))
from ConstraintRuleLearner import ConstraintRuleLearner


class BatchStepAnalyzer:
    """批量STEP文件分析器"""

    def __init__(self, use_pythonocc=True):
        self.use_pythonocc = use_pythonocc
        self.results = []
        self.all_constraints = []
        self.statistics = {
            'total_files': 0,
            'assembly_files': 0,
            'part_files': 0,
            'total_parts': 0,
            'total_constraints': 0,
            'failed_files': []
        }

    def process_directory(self, directory_path: str, output_dir: str = None):
        """批量处理目录中的STEP文件"""
        directory = Path(directory_path)

        if not directory.exists():
            print(f"\n❌ 目录不存在: {directory}")
            return

        # 查找所有STEP文件
        step_extensions = {'.step', '.stp', '.STEP', '.STP'}
        step_files = [
            f for f in directory.iterdir()
            if f.is_file() and f.suffix in step_extensions
        ]

        if not step_files:
            print(f"\n⚠️  目录中没有STEP文件: {directory}")
            return

        print(f"\n{'='*70}")
        print(f"🔍 扫描目录: {directory}")
        print(f"📦 找到 {len(step_files)} 个STEP文件")
        print(f"{'='*70}\n")

        # 设置输出目录
        if output_dir is None:
            output_dir = directory / 'analysis_results'
        else:
            output_dir = Path(output_dir)

        output_dir.mkdir(parents=True, exist_ok=True)

        # 批量处理
        for i, step_file in enumerate(step_files, 1):
            print(f"\n[{i}/{len(step_files)}] 处理: {step_file.name}")
            print(f"   大小: {step_file.stat().st_size / 1024:.1f} KB")

            try:
                # 创建分析器
                analyzer = StepAssemblyAnalyzerV2(use_pythonocc=self.use_pythonocc)

                # 解析文件
                result = analyzer.parse_step_file(str(step_file))

                # 保存单个文件结果
                output_file = output_dir / f"{step_file.stem}_analysis.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)

                # 统计
                self.statistics['total_files'] += 1
                if result['file_type'] == 'assembly':
                    self.statistics['assembly_files'] += 1
                else:
                    self.statistics['part_files'] += 1

                if result['parser_mode'] == 'pythonocc':
                    self.statistics['total_parts'] += result['metadata']['parts_count']
                    self.statistics['total_constraints'] += result['metadata']['constraints_count']
                    # 收集约束用于学习
                    self.all_constraints.extend(result.get('constraints', []))
                else:
                    self.statistics['total_parts'] += result['metadata']['products_count']
                    self.statistics['total_constraints'] += result['metadata']['constraints_count']
                    self.all_constraints.extend(result.get('constraints', []))

                self.results.append({
                    'file_name': step_file.name,
                    'file_type': result['file_type'],
                    'parser_mode': result['parser_mode'],
                    'metadata': result['metadata'],
                    'output_file': str(output_file)
                })

                print(f"   ✅ 完成")

            except Exception as e:
                print(f"   ❌ 失败: {e}")
                self.statistics['failed_files'].append({
                    'file_name': step_file.name,
                    'error': str(e)
                })

        print(f"\n{'='*70}")
        print(f"✅ 批量处理完成!")
        print(f"{'='*70}\n")

        # 打印统计
        self.print_summary()

        # 保存汇总结果
        summary_file = output_dir / 'batch_summary.json'
        self.save_summary(summary_file)

        return output_dir

    def learn_rules(self, output_dir: Path):
        """从所有约束中学习规则"""
        if not self.all_constraints:
            print("\n⚠️  没有约束数据，跳过规则学习")
            return None

        print(f"\n{'='*70}")
        print(f"🧠 开始规则学习...")
        print(f"   约束总数: {len(self.all_constraints)}")
        print(f"{'='*70}\n")

        # 构建features_json格式
        features_json = {
            'parts': []
        }

        # 从约束中提取零件信息（简化版）
        parts_map = {}
        for constraint in self.all_constraints:
            part_a = constraint.get('part_a', '')
            part_b = constraint.get('part_b', '')

            if part_a and part_a not in parts_map:
                parts_map[part_a] = {'part_id': part_a, 'features': []}
            if part_b and part_b not in parts_map:
                parts_map[part_b] = {'part_id': part_b, 'features': []}

        features_json['parts'] = list(parts_map.values())

        # 创建规则学习器
        learner = ConstraintRuleLearner()

        # 直接使用约束学习（跳过特征匹配）
        learner._learn_rules_from_constraints(self.all_constraints)

        # 导出规则
        rules_file = output_dir / 'learned_rules.json'
        learner.export_rules(str(rules_file))

        print(f"✅ 规则学习完成: {len(learner.rules_db)} 条规则")

        return rules_file

    def print_summary(self):
        """打印统计摘要"""
        stats = self.statistics

        print("📊 处理统计:")
        print(f"  总文件数: {stats['total_files']}")
        print(f"  装配文件: {stats['assembly_files']}")
        print(f"  零件文件: {stats['part_files']}")
        print(f"  失败文件: {len(stats['failed_files'])}")
        print(f"\n  总零件数: {stats['total_parts']}")
        print(f"  总约束数: {stats['total_constraints']}")

        if stats['failed_files']:
            print(f"\n❌ 失败文件:")
            for failed in stats['failed_files']:
                print(f"  - {failed['file_name']}: {failed['error']}")

    def save_summary(self, output_file: Path):
        """保存汇总结果"""
        summary = {
            'generated_at': datetime.now().isoformat(),
            'statistics': self.statistics,
            'files': self.results
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        print(f"\n💾 汇总结果已保存: {output_file}")
        print(f"   文件大小: {output_file.stat().st_size / 1024:.1f} KB")


def main():
    if len(sys.argv) < 2:
        print("Usage: python batch_analyze_step_files.py <directory> [output_dir] [--regex] [--learn]")
        print("\n选项:")
        print("  --regex    强制使用正则解析模式")
        print("  --learn    学习装配规则")
        print("\n示例:")
        print("  python batch_analyze_step_files.py docs/solidworks/")
        print("  python batch_analyze_step_files.py docs/solidworks/ /tmp/results --learn")
        sys.exit(1)

    directory = sys.argv[1]
    output_dir = None
    use_pythonocc = True
    learn_rules = False

    # 解析参数
    for arg in sys.argv[2:]:
        if arg == '--regex':
            use_pythonocc = False
        elif arg == '--learn':
            learn_rules = True
        elif not output_dir and not arg.startswith('--'):
            output_dir = arg

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          批量STEP文件分析器 v2.0                               ║")
    print("╚════════════════════════════════════════════════════════════════╝")

    # 创建批量分析器
    batch_analyzer = BatchStepAnalyzer(use_pythonocc=use_pythonocc)

    # 处理目录
    result_dir = batch_analyzer.process_directory(directory, output_dir)

    # 学习规则（如果启用）
    if learn_rules and result_dir:
        batch_analyzer.learn_rules(result_dir)

    print(f"\n🎉 完成!")


if __name__ == '__main__':
    main()
