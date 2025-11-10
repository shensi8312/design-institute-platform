#!/usr/bin/env python3
"""
物理约束验证引擎
- 压力/温度/流量验证
- 材料相容性检查
- 热膨胀计算
- 强度校核
"""
from typing import Dict, List, Tuple
from dataclasses import dataclass
import math

@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    violations: List[Dict]
    warnings: List[Dict]
    recommendations: List[Dict]

class PhysicalConstraintEngine:
    def __init__(self):
        # 物理常数
        self.SAFETY_FACTOR = 1.5  # 安全系数

        # 材料数据库
        self.materials = self._load_material_database()

        # 压力等级标准
        self.pressure_ratings = self._load_pressure_ratings()

        # 密封类型数据
        self.sealing_types = self._load_sealing_data()

    def _load_material_database(self) -> Dict:
        """加载材料数据库"""
        return {
            'carbon_steel': {
                'tensile_strength': 400,  # MPa
                'yield_strength': 235,    # MPa
                'temp_range': (-20, 400),  # °C
                'density': 7850,           # kg/m³
                'thermal_expansion': 12e-6,  # /°C
                'corrosion_resistance': {
                    'water': 'fair',
                    'oil': 'good',
                    'acid': 'poor',
                    'alkali': 'poor'
                }
            },
            'stainless_steel_304': {
                'tensile_strength': 515,
                'yield_strength': 205,
                'temp_range': (-200, 800),
                'density': 8000,
                'thermal_expansion': 17e-6,
                'corrosion_resistance': {
                    'water': 'excellent',
                    'oil': 'excellent',
                    'acid': 'good',
                    'alkali': 'good'
                }
            },
            'stainless_steel_316L': {
                'tensile_strength': 485,
                'yield_strength': 170,
                'temp_range': (-200, 900),
                'density': 8000,
                'thermal_expansion': 16e-6,
                'corrosion_resistance': {
                    'water': 'excellent',
                    'oil': 'excellent',
                    'acid': 'excellent',
                    'alkali': 'excellent',
                    'seawater': 'excellent'
                }
            }
        }

    def _load_pressure_ratings(self) -> Dict:
        """加载压力等级标准"""
        return {
            'PN10': {'max_pressure': 1.0, 'test_pressure': 1.5},
            'PN16': {'max_pressure': 1.6, 'test_pressure': 2.4},
            'PN25': {'max_pressure': 2.5, 'test_pressure': 3.75},
            'PN40': {'max_pressure': 4.0, 'test_pressure': 6.0},
            'PN64': {'max_pressure': 6.4, 'test_pressure': 9.6},
            'Class150': {'max_pressure': 2.0, 'test_pressure': 3.0},
            'Class300': {'max_pressure': 5.0, 'test_pressure': 7.5},
            'Class600': {'max_pressure': 10.0, 'test_pressure': 15.0},
        }

    def _load_sealing_data(self) -> Dict:
        """加载密封数据"""
        return {
            'VCR': {
                'leak_rate': 1e-10,  # mbar·L/s
                'pressure_range': (0, 10),  # MPa
                'temp_range': (-200, 450),  # °C
                'applications': ['vacuum', 'semiconductor']
            },
            'Swagelok': {
                'leak_rate': 1e-8,
                'pressure_range': (0, 60),
                'temp_range': (-54, 200),
                'applications': ['instrumentation', 'process']
            },
            'flange_gasket': {
                'leak_rate': 1e-6,
                'pressure_range': (0, 100),
                'temp_range': (-200, 600),
                'applications': ['general', 'high_pressure']
            }
        }

    def validate_assembly(self, assembly_plan: Dict) -> ValidationResult:
        """验证装配方案"""
        print("🔬 物理约束验证...")

        violations = []
        warnings = []
        recommendations = []

        parts = assembly_plan.get('parts', [])
        constraints = assembly_plan.get('constraints', [])

        # 1. 压力验证
        pressure_issues = self._validate_pressure(parts)
        violations.extend(pressure_issues['violations'])
        warnings.extend(pressure_issues['warnings'])

        # 2. 温度验证
        temp_issues = self._validate_temperature(parts)
        violations.extend(temp_issues['violations'])
        warnings.extend(temp_issues['warnings'])

        # 3. 材料相容性
        material_issues = self._validate_material_compatibility(parts)
        violations.extend(material_issues['violations'])
        warnings.extend(material_issues['warnings'])

        # 4. 流体流速
        flow_issues = self._validate_flow_velocity(parts)
        warnings.extend(flow_issues['warnings'])
        recommendations.extend(flow_issues['recommendations'])

        # 5. 热膨胀
        thermal_issues = self._validate_thermal_expansion(parts, constraints)
        warnings.extend(thermal_issues['warnings'])
        recommendations.extend(thermal_issues['recommendations'])

        # 6. 强度校核
        strength_issues = self._validate_strength(parts)
        violations.extend(strength_issues['violations'])

        is_valid = len(violations) == 0

        print(f"  {'✅ 验证通过' if is_valid else '❌ 发现问题'}")
        print(f"    - 严重问题: {len(violations)}")
        print(f"    - 警告: {len(warnings)}")
        print(f"    - 建议: {len(recommendations)}")

        return ValidationResult(
            is_valid=is_valid,
            violations=violations,
            warnings=warnings,
            recommendations=recommendations
        )

    def _validate_pressure(self, parts: List[Dict]) -> Dict:
        """验证压力"""
        violations = []
        warnings = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            working_pressure = process_data.get('pressure')
            if not working_pressure:
                continue

            pressure_class = spec.get('pressure_class')
            if not pressure_class:
                warnings.append({
                    'part': part['tag'],
                    'issue': 'pressure_class_missing',
                    'detail': '未指定压力等级'
                })
                continue

            rating = self.pressure_ratings.get(pressure_class)
            if not rating:
                continue

            # 检查工作压力是否超过额定压力
            if working_pressure > rating['max_pressure']:
                violations.append({
                    'part': part['tag'],
                    'type': 'pressure_exceeded',
                    'severity': 'critical',
                    'detail': f"工作压力 {working_pressure} MPa 超过额定压力 {rating['max_pressure']} MPa",
                    'recommendation': f"建议使用 {self._recommend_pressure_class(working_pressure)}"
                })

            # 检查安全系数
            safety_margin = rating['max_pressure'] / working_pressure
            if safety_margin < self.SAFETY_FACTOR:
                warnings.append({
                    'part': part['tag'],
                    'type': 'low_safety_margin',
                    'detail': f"安全系数 {safety_margin:.2f} 小于推荐值 {self.SAFETY_FACTOR}",
                    'recommendation': f"建议使用更高压力等级"
                })

        return {'violations': violations, 'warnings': warnings}

    def _recommend_pressure_class(self, pressure: float) -> str:
        """推荐压力等级"""
        required_pressure = pressure * self.SAFETY_FACTOR

        for pn, rating in sorted(self.pressure_ratings.items(), key=lambda x: x[1]['max_pressure']):
            if rating['max_pressure'] >= required_pressure:
                return pn

        return "PN64+"

    def _validate_temperature(self, parts: List[Dict]) -> Dict:
        """验证温度"""
        violations = []
        warnings = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            temperature = process_data.get('temperature')
            if not temperature:
                continue

            material = spec.get('material')
            if not material:
                continue

            material_data = self.materials.get(material)
            if not material_data:
                continue

            temp_min, temp_max = material_data['temp_range']

            if not (temp_min <= temperature <= temp_max):
                violations.append({
                    'part': part['tag'],
                    'type': 'temperature_out_of_range',
                    'severity': 'critical',
                    'detail': f"温度 {temperature}°C 超出材料 {material} 的范围 {temp_min}~{temp_max}°C",
                    'recommendation': self._recommend_material_for_temp(temperature)
                })

        return {'violations': violations, 'warnings': warnings}

    def _recommend_material_for_temp(self, temperature: float) -> str:
        """根据温度推荐材料"""
        candidates = []
        for material, data in self.materials.items():
            temp_min, temp_max = data['temp_range']
            if temp_min <= temperature <= temp_max:
                candidates.append(material)

        if candidates:
            return f"建议使用: {', '.join(candidates)}"
        else:
            return "建议咨询材料专家"

    def _validate_material_compatibility(self, parts: List[Dict]) -> Dict:
        """验证材料相容性"""
        violations = []
        warnings = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            medium = process_data.get('medium')
            material = spec.get('material')

            if not medium or not material:
                continue

            material_data = self.materials.get(material)
            if not material_data:
                continue

            corrosion_resistance = material_data.get('corrosion_resistance', {})
            resistance = corrosion_resistance.get(medium, 'unknown')

            if resistance == 'poor':
                violations.append({
                    'part': part['tag'],
                    'type': 'material_incompatible',
                    'severity': 'critical',
                    'detail': f"材料 {material} 与介质 {medium} 不相容（耐腐蚀性差）",
                    'recommendation': self._recommend_material_for_medium(medium)
                })
            elif resistance == 'fair':
                warnings.append({
                    'part': part['tag'],
                    'type': 'material_compatibility_warning',
                    'detail': f"材料 {material} 与介质 {medium} 相容性一般",
                    'recommendation': "建议定期检查腐蚀情况"
                })

        return {'violations': violations, 'warnings': warnings}

    def _recommend_material_for_medium(self, medium: str) -> str:
        """根据介质推荐材料"""
        candidates = []
        for material, data in self.materials.items():
            resistance = data.get('corrosion_resistance', {}).get(medium)
            if resistance in ['excellent', 'good']:
                candidates.append(material)

        if candidates:
            return f"建议使用: {', '.join(candidates)}"
        else:
            return "建议咨询材料专家"

    def _validate_flow_velocity(self, parts: List[Dict]) -> Dict:
        """验证流体流速"""
        warnings = []
        recommendations = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            flow_rate = process_data.get('flow')  # m³/h
            diameter = spec.get('diameter')  # mm

            if not flow_rate or not diameter:
                continue

            # 计算流速 v = Q / A
            area = math.pi * (diameter / 1000 / 2) ** 2  # m²
            velocity = (flow_rate / 3600) / area  # m/s

            # 推荐流速范围（液体）
            if velocity > 3.0:
                warnings.append({
                    'part': part['tag'],
                    'type': 'high_velocity',
                    'detail': f"流速 {velocity:.2f} m/s 过高，可能导致冲刷腐蚀",
                    'recommendation': "建议增大管径或降低流量"
                })
            elif velocity < 0.5:
                recommendations.append({
                    'part': part['tag'],
                    'type': 'low_velocity',
                    'detail': f"流速 {velocity:.2f} m/s 较低，可能导致沉积",
                    'recommendation': "建议减小管径或定期冲洗"
                })

        return {'warnings': warnings, 'recommendations': recommendations}

    def _validate_thermal_expansion(self, parts: List[Dict], constraints: List[Dict]) -> Dict:
        """验证热膨胀"""
        warnings = []
        recommendations = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            temp_delta = process_data.get('temperature', 20) - 20  # 相对于常温

            if abs(temp_delta) < 50:  # 温差小于50°C，影响不大
                continue

            material = spec.get('material')
            if not material:
                continue

            material_data = self.materials.get(material)
            if not material_data:
                continue

            alpha = material_data['thermal_expansion']  # /°C

            # 估算管道长度（从约束推断）
            # 简化: 假设典型管段长度10m
            length = 10000  # mm

            # 热膨胀量 ΔL = α × L × ΔT
            expansion = alpha * length * temp_delta  # mm

            if abs(expansion) > 10:  # 超过10mm
                recommendations.append({
                    'part': part['tag'],
                    'type': 'thermal_expansion',
                    'detail': f"温度变化 {temp_delta}°C 导致膨胀 {expansion:.1f} mm",
                    'recommendation': "建议设置膨胀节或U型弯补偿"
                })

        return {'warnings': warnings, 'recommendations': recommendations}

    def _validate_strength(self, parts: List[Dict]) -> Dict:
        """强度校核"""
        violations = []

        for part in parts:
            process_data = part.get('process_data', {})
            spec = part.get('spec', {})

            pressure = process_data.get('pressure')
            diameter = spec.get('diameter')  # mm
            material = spec.get('material')

            if not all([pressure, diameter, material]):
                continue

            material_data = self.materials.get(material)
            if not material_data:
                continue

            # 简化薄壁圆筒应力计算: σ = P×D / (2×t)
            # 假设壁厚 t = D / 10（简化）
            thickness = diameter / 10  # mm

            # 环向应力 (MPa)
            hoop_stress = (pressure * diameter) / (2 * thickness)

            # 许用应力 [σ] = σs / n
            allowable_stress = material_data['yield_strength'] / self.SAFETY_FACTOR

            if hoop_stress > allowable_stress:
                violations.append({
                    'part': part['tag'],
                    'type': 'strength_insufficient',
                    'severity': 'critical',
                    'detail': f"环向应力 {hoop_stress:.1f} MPa 超过许用应力 {allowable_stress:.1f} MPa",
                    'recommendation': f"建议增加壁厚至 {diameter * pressure / (2 * allowable_stress):.1f} mm"
                })

        return {'violations': violations}

def main():
    engine = PhysicalConstraintEngine()

    # 测试装配方案
    test_assembly = {
        'parts': [
            {
                'tag': 'P-101',
                'type': 'flange',
                'spec': {
                    'pressure_class': 'PN16',
                    'material': 'carbon_steel',
                    'diameter': 50
                },
                'process_data': {
                    'pressure': 1.6,
                    'temperature': 80,
                    'medium': 'water',
                    'flow': 50
                }
            },
            {
                'tag': 'V-101',
                'type': 'valve',
                'spec': {
                    'pressure_class': 'PN16',
                    'material': 'stainless_steel_316L',
                    'diameter': 50
                },
                'process_data': {
                    'pressure': 1.6,
                    'temperature': 200,
                    'medium': 'acid'
                }
            }
        ],
        'constraints': []
    }

    result = engine.validate_assembly(test_assembly)

    print("\n📋 验证结果:")
    if result.violations:
        print("\n❌ 严重问题:")
        for v in result.violations:
            print(f"  - {v['part']}: {v['detail']}")
            print(f"    建议: {v.get('recommendation', 'N/A')}")

    if result.warnings:
        print("\n⚠️  警告:")
        for w in result.warnings:
            print(f"  - {w['part']}: {w['detail']}")

    if result.recommendations:
        print("\n💡 建议:")
        for r in result.recommendations:
            print(f"  - {r['part']}: {r['detail']}")

if __name__ == '__main__':
    main()
