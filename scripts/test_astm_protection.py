#!/usr/bin/env python3
"""
测试ASTM标准编号保护是否正常工作
"""

import sys
sys.path.insert(0, '/Users/shenguoli/Documents/projects/design-institute-platform/scripts')

from batch_convert_and_translate import protect_units, restore_units

def test_astm_protection():
    """测试ASTM标准编号保护"""
    print("\n" + "="*70)
    print("🧪 测试ASTM标准编号保护")
    print("="*70 + "\n")

    # 测试用例
    test_cases = [
        "Base sheet: ASTM D4601/D4601M, Type II",
        "Glass fiber mat: ASTM D2178/D2178M, Type IV",
        "ASTM C1177/C1177M or ASTM C1278/C1278M",
        "Asphalt primer: ASTM D41/D41M",
        "Roofing asphalt: ASTM D312/D312M, Type III or Type IV",
        "Mixed: 100 kg/m² and ASTM D4601M standard with 25 mm thickness"
    ]

    for i, text in enumerate(test_cases, 1):
        print(f"\n[测试 {i}]")
        print(f"原文: {text}")

        # 保护单位和ASTM
        protected, units_map = protect_units(text)
        print(f"保护后: {protected}")

        # 检查ASTM是否被保护
        astm_count = sum(1 for k in units_map.keys() if 'ASTM' in k)
        print(f"ASTM保护数量: {astm_count}")

        # 显示映射表
        if units_map:
            print(f"映射表 ({len(units_map)} 项):")
            for placeholder, original in units_map.items():
                print(f"  {placeholder} → {original}")

        # 恢复
        restored = restore_units(protected, units_map)
        print(f"恢复后: {restored}")

        # 验证
        if restored == text:
            print("✅ 测试通过")
        else:
            print("❌ 测试失败 - 恢复后文本不匹配")

    print("\n" + "="*70)
    print("测试完成")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_astm_protection()
