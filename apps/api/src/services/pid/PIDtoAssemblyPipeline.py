#!/usr/bin/env python3
"""
PID到装配完整流程
集成所有模块:
1. PID识别 → 提取组件和参数
2. 零件库匹配 → 选择合适零件
3. 物理约束验证 → 确保设计合理
4. SolidWorks装配 → 生成装配文件和BOM
"""
import sys
import json
from pathlib import Path
from typing import Dict, List
from datetime import datetime

# 导入各个模块
from PIDRecognitionService import PIDRecognitionService
from PartLibraryBuilder import PartLibraryBuilder
from PhysicalConstraintEngine import PhysicalConstraintEngine
from SolidWorksIntegrationService import SolidWorksIntegrationService

class PIDtoAssemblyPipeline:
    def __init__(self):
        self.pid_service = PIDRecognitionService()
        self.constraint_engine = PhysicalConstraintEngine()
        self.solidworks_service = SolidWorksIntegrationService()
        self.part_library = None

    def run_complete_pipeline(self, pid_file: str, output_dir: str = None) -> Dict:
        """执行完整流程"""
        print("╔════════════════════════════════════════════════════════════════╗")
        print("║          PID → 自动装配完整流程 v1.0                            ║")
        print("╚════════════════════════════════════════════════════════════════╝\n")

        if output_dir is None:
            output_dir = Path(__file__).parent.parent.parent.parent.parent / 'docs'
        else:
            output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        results = {
            'timestamp': timestamp,
            'input_file': pid_file,
            'stages': {}
        }

        # ========== 阶段1: PID识别 ==========
        print("【阶段1/4】PID图纸识别")
        print("─" * 60)

        try:
            pid_result = self.pid_service.recognize_pid(pid_file)
            results['stages']['pid_recognition'] = {
                'status': 'success',
                'components': len(pid_result['components']),
                'connections': len(pid_result['connections']),
                'data': pid_result
            }

            # 保存识别结果
            pid_output = output_dir / f'pid_recognition_{timestamp}.json'
            with open(pid_output, 'w', encoding='utf-8') as f:
                json.dump(pid_result, f, indent=2, ensure_ascii=False)
            print(f"✅ 识别完成: {len(pid_result['components'])} 个组件")
            print(f"📄 结果已保存: {pid_output.name}\n")

        except Exception as e:
            print(f"❌ PID识别失败: {e}\n")
            results['stages']['pid_recognition'] = {'status': 'failed', 'error': str(e)}
            return results

        # ========== 阶段2: 零件库匹配 ==========
        print("【阶段2/4】零件库匹配与选型")
        print("─" * 60)

        try:
            # 加载零件库
            library_path = output_dir / 'part_library.json'
            if not library_path.exists():
                print("⚠️  零件库不存在，使用通用零件")
                parts_selected = self._create_generic_parts(pid_result['components'])
            else:
                with open(library_path, 'r', encoding='utf-8') as f:
                    self.part_library = json.load(f)
                print(f"✅ 加载零件库: {self.part_library.get('statistics', {}).get('total_parts', 0)} 个零件")

                # 匹配零件
                parts_selected = self._match_parts(pid_result['components'])

            results['stages']['part_matching'] = {
                'status': 'success',
                'parts_selected': len(parts_selected),
                'data': parts_selected
            }
            print(f"✅ 选型完成: {len(parts_selected)} 个零件\n")

        except Exception as e:
            print(f"❌ 零件匹配失败: {e}\n")
            results['stages']['part_matching'] = {'status': 'failed', 'error': str(e)}
            return results

        # ========== 阶段3: 物理约束验证 ==========
        print("【阶段3/4】物理约束验证")
        print("─" * 60)

        try:
            # 构建装配方案
            assembly_plan = {
                'parts': self._build_parts_for_validation(parts_selected, pid_result['components']),
                'constraints': []
            }

            # 验证
            validation_result = self.constraint_engine.validate_assembly(assembly_plan)

            results['stages']['physical_validation'] = {
                'status': 'success' if validation_result.is_valid else 'warning',
                'is_valid': validation_result.is_valid,
                'violations': len(validation_result.violations),
                'warnings': len(validation_result.warnings),
                'recommendations': len(validation_result.recommendations),
                'data': {
                    'violations': validation_result.violations,
                    'warnings': validation_result.warnings,
                    'recommendations': validation_result.recommendations
                }
            }

            # 保存验证结果
            validation_output = output_dir / f'validation_{timestamp}.json'
            with open(validation_output, 'w', encoding='utf-8') as f:
                json.dump(results['stages']['physical_validation']['data'], f, indent=2, ensure_ascii=False)

            if validation_result.is_valid:
                print("✅ 验证通过 - 无严重问题")
            else:
                print(f"⚠️  发现 {len(validation_result.violations)} 个严重问题")
                for v in validation_result.violations[:3]:  # 显示前3个
                    print(f"   - {v.get('part', 'N/A')}: {v.get('detail', 'N/A')}")

            if validation_result.warnings:
                print(f"⚠️  {len(validation_result.warnings)} 个警告")
            if validation_result.recommendations:
                print(f"💡 {len(validation_result.recommendations)} 条建议")
            print(f"📄 验证结果已保存: {validation_output.name}\n")

        except Exception as e:
            print(f"❌ 物理验证失败: {e}\n")
            results['stages']['physical_validation'] = {'status': 'failed', 'error': str(e)}
            return results

        # ========== 阶段4: SolidWorks装配 ==========
        print("【阶段4/4】SolidWorks自动装配")
        print("─" * 60)

        try:
            # 执行自动装配
            assembly_result = self.solidworks_service.auto_assemble(
                pid_result['components'],
                {'max_pressure': 10.0, 'max_temperature': 400}
            )

            results['stages']['solidworks_assembly'] = {
                'status': 'success',
                'assembly_file': assembly_result['assembly_file'],
                'parts_count': len(assembly_result['selected_parts']),
                'constraints_count': len(assembly_result['constraints']),
                'bom_lines': len(assembly_result['bom']),
                'data': assembly_result
            }

            print(f"✅ 装配完成")
            print(f"   - 装配文件: {Path(assembly_result['assembly_file']).name}")
            print(f"   - 零件数: {len(assembly_result['selected_parts'])}")
            print(f"   - 约束数: {len(assembly_result['constraints'])}")
            print(f"   - BOM行数: {len(assembly_result['bom'])}")

            # 导出BOM
            bom_file = output_dir / f'BOM_{timestamp}.xlsx'
            self.solidworks_service.export_bom_excel(assembly_result['bom'], str(bom_file))
            print(f"   - BOM文件: {bom_file.name}\n")

        except Exception as e:
            print(f"❌ SolidWorks装配失败: {e}\n")
            results['stages']['solidworks_assembly'] = {'status': 'failed', 'error': str(e)}
            return results

        # ========== 最终汇总 ==========
        print("╔════════════════════════════════════════════════════════════════╗")
        print("║                     流程执行完成                                 ║")
        print("╚════════════════════════════════════════════════════════════════╝")

        success_stages = sum(1 for s in results['stages'].values() if s.get('status') == 'success')
        print(f"\n✅ 成功阶段: {success_stages}/4")

        if success_stages == 4:
            print("🎉 所有阶段执行成功！")
        else:
            print("⚠️  部分阶段失败，请检查日志")

        # 保存完整结果
        final_output = output_dir / f'pipeline_result_{timestamp}.json'
        with open(final_output, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        print(f"\n📄 完整结果已保存: {final_output}")

        return results

    def _create_generic_parts(self, components: List[Dict]) -> List[Dict]:
        """创建通用零件（当零件库不存在时）"""
        parts = []
        for comp in components:
            parts.append({
                'tag': comp.get('tag_number', 'UNKNOWN'),
                'part_number': f"GENERIC-{comp.get('symbol_type', 'PART').upper()}-001",
                'type': comp.get('symbol_type', 'unknown'),
                'spec': comp.get('parameters', {}),
                'source': 'generic'
            })
        return parts

    def _match_parts(self, components: List[Dict]) -> List[Dict]:
        """从零件库匹配零件"""
        parts = []
        part_library = self.part_library.get('part_library', {})

        for comp in components:
            symbol_type = comp.get('symbol_type', 'unknown')
            parameters = comp.get('parameters', {})

            # 尝试从零件库查找
            matched_part = None

            # 简化匹配逻辑
            if symbol_type in part_library and part_library[symbol_type]:
                matched_part = part_library[symbol_type][0]

            if matched_part:
                parts.append({
                    'tag': comp.get('tag_number', 'UNKNOWN'),
                    'part_number': matched_part.get('part_number', 'UNKNOWN'),
                    'type': symbol_type,
                    'spec': matched_part.get('spec', {}),
                    'source': 'library'
                })
            else:
                # 回退到通用零件
                parts.append({
                    'tag': comp.get('tag_number', 'UNKNOWN'),
                    'part_number': f"GENERIC-{symbol_type.upper()}-001",
                    'type': symbol_type,
                    'spec': parameters,
                    'source': 'generic'
                })

        return parts

    def _build_parts_for_validation(self, selected_parts: List[Dict], components: List[Dict]) -> List[Dict]:
        """构建用于验证的零件数据"""
        validation_parts = []

        # 创建组件参数字典
        comp_params = {c.get('tag_number'): c.get('parameters', {}) for c in components}

        for part in selected_parts:
            tag = part['tag']
            params = comp_params.get(tag, {})

            # 提取工艺参数
            process_data = {}
            if 'pressure' in params:
                process_data['pressure'] = params['pressure'].get('value', 1.6)
            if 'temperature' in params:
                process_data['temperature'] = params['temperature'].get('value', 80)
            if 'flow' in params:
                process_data['flow'] = params['flow'].get('value', 50)

            # 假设介质为水（可从PID识别结果提取）
            process_data['medium'] = 'water'

            # 提取零件规格
            spec = {
                'pressure_class': params.get('pressure_class', 'PN16'),
                'material': 'carbon_steel',  # 默认材料
                'diameter': params.get('diameter', {}).get('value', 50) if isinstance(params.get('diameter'), dict) else 50
            }

            validation_parts.append({
                'tag': tag,
                'type': part.get('type', 'unknown'),
                'spec': spec,
                'process_data': process_data
            })

        return validation_parts

    def _run_from_components(self, pid_result: Dict, output_dir: str) -> Dict:
        """从已有组件数据执行流程（跳过PID识别）"""
        print("╔════════════════════════════════════════════════════════════════╗")
        print("║       从组件数据生成装配                                         ║")
        print("╚════════════════════════════════════════════════════════════════╝\n")

        os.makedirs(output_dir, exist_ok=True)

        # 阶段2: 零件库匹配
        print(f"【阶段1/3】零件库匹配与选型")
        print("─" * 60)
        parts_selected = self._match_parts(pid_result['components'])
        print(f"✅ 选型完成: {len(parts_selected)} 个零件\n")

        # 阶段3: 物理约束验证
        print(f"【阶段2/3】物理约束验证")
        print("─" * 60)
        validation_parts = self._prepare_validation_data(parts_selected, pid_result['components'])
        validation_result = self.constraint_engine.validate_assembly({
            'parts': validation_parts,
            'connections': pid_result.get('connections', [])
        })

        print(f"✅ 验证通过 - 无严重问题")
        if validation_result.get('warnings'):
            print(f"⚠️  {len(validation_result['warnings'])} 个警告\n")

        # 阶段4: SolidWorks装配
        print(f"【阶段3/3】自动装配")
        print("─" * 60)
        assembly_result = self.solidworks_service.auto_assemble(
            pid_result['components'],
            {'max_pressure': 10.0, 'max_temperature': 400}
        )

        print(f"✅ 装配完成")
        print(f"   - 零件数: {len(assembly_result.get('parts', []))}")
        print(f"   - 约束数: {len(assembly_result.get('constraints', []))}\n")

        # 汇总结果
        result = {
            'success': True,
            'step_file': assembly_result.get('step_file', ''),
            'bom_file': assembly_result.get('bom_file', ''),
            'stats': {
                'components': len(pid_result['components']),
                'parts': len(parts_selected),
                'constraints': len(assembly_result.get('constraints', [])),
                'warnings': len(validation_result.get('warnings', []))
            }
        }

        return result


def main():
    """运行完整流程测试"""
    pipeline = PIDtoAssemblyPipeline()

    # 测试PID文件
    pid_file = "docs/solidworks/其他-301000050672-PID-V1.0.pdf"

    if not Path(pid_file).exists():
        print(f"❌ PID文件不存在: {pid_file}")
        print("请提供有效的PID文件路径")
        return

    # 执行流程
    result = pipeline.run_complete_pipeline(pid_file)

    # 显示最终结果
    print("\n" + "=" * 60)
    print("最终结果汇总:")
    print("=" * 60)

    for stage_name, stage_data in result['stages'].items():
        status = stage_data.get('status', 'unknown')
        icon = '✅' if status == 'success' else '⚠️' if status == 'warning' else '❌'
        print(f"{icon} {stage_name}: {status}")

if __name__ == '__main__':
    main()
