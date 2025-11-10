#!/usr/bin/env python3
"""
测试翻译质量：检查SECTION处理、单位保留、列表编号等
"""

import sys
import re
from pathlib import Path
from docx import Document

def check_translation_quality(docx_file: Path):
    """检查翻译质量"""
    print(f"\n{'='*70}")
    print(f"📄 检查文件: {docx_file.name}")
    print(f"{'='*70}\n")

    try:
        doc = Document(str(docx_file))

        # 统计
        total_paras = 0
        section_found = []
        units_found = []
        list_numbers_found = []
        colors_found = []

        print("🔍 正在扫描文档...\n")

        for i, para in enumerate(doc.paragraphs, 1):
            if not para.text.strip():
                continue

            total_paras += 1
            text = para.text

            # 1. 检查SECTION处理（应该没有"SECTION"开头，但有编号）
            if re.search(r'^SECTION\s+\d', text, re.IGNORECASE):
                section_found.append({
                    'line': i,
                    'text': text[:100],
                    'issue': '❌ SECTION前缀未删除'
                })
            elif re.search(r'^\d{6,}\.\d+\s*-', text):
                section_found.append({
                    'line': i,
                    'text': text[:100],
                    'issue': '✅ SECTION前缀已删除'
                })

            # 2. 检查单位保留（应该保留英文单位，如kg/m²）
            unit_patterns = [
                (r'\d+(?:\.\d+)?\s*kg/m²', 'kg/m²'),
                (r'\d+(?:\.\d+)?\s*kg/m³', 'kg/m³'),
                (r'\d+(?:\.\d+)?\s*mm', 'mm'),
                (r'\d+(?:\.\d+)?\s*cm', 'cm'),
                (r'\d+(?:\.\d+)?\s*m²', 'm²'),
                (r'\d+(?:\.\d+)?\s*m³', 'm³'),
                (r'\d+(?:\.\d+)?\s*Pa', 'Pa'),
                (r'\d+(?:\.\d+)?\s*kPa', 'kPa'),
                (r'\d+(?:\.\d+)?\s*MPa', 'MPa'),
            ]

            for pattern, unit in unit_patterns:
                matches = re.findall(pattern, text)
                if matches:
                    units_found.append({
                        'line': i,
                        'unit': unit,
                        'count': len(matches),
                        'example': matches[0]
                    })

            # 3. 检查被错误翻译的单位（如"千克/平方米"）
            wrong_units = [
                r'千克/平方米',
                r'千克/立方米',
                r'毫米',
                r'厘米',
                r'平方米',
                r'立方米',
                r'帕斯卡',
            ]

            for wrong in wrong_units:
                if wrong in text:
                    units_found.append({
                        'line': i,
                        'unit': wrong,
                        'count': 1,
                        'example': text[:100],
                        'issue': '❌ 单位被错误翻译'
                    })

            # 4. 检查列表编号（应该保留原样）
            list_patterns = [
                (r'^([a-z]\.\s+)', '字母编号'),
                (r'^([A-Z]\.\s+)', '大写字母编号'),
                (r'^(\d+\.\s+)', '数字编号'),
                (r'^(\([a-z]\)\s+)', '括号字母编号'),
            ]

            for pattern, desc in list_patterns:
                match = re.match(pattern, text)
                if match:
                    list_numbers_found.append({
                        'line': i,
                        'type': desc,
                        'marker': match.group(1),
                        'text': text[:50]
                    })

            # 5. 检查颜色（run级别）
            for run in para.runs:
                if run.font.color and run.font.color.rgb:
                    rgb = run.font.color.rgb
                    colors_found.append({
                        'line': i,
                        'rgb': f'{rgb}',
                        'text': run.text[:30]
                    })

        # 输出统计
        print(f"{'='*70}")
        print(f"📊 统计结果")
        print(f"{'='*70}\n")
        print(f"总段落数: {total_paras}\n")

        # SECTION处理
        if section_found:
            print(f"🔢 SECTION处理 ({len(section_found)} 个):")
            for item in section_found[:5]:  # 只显示前5个
                print(f"  [{item['line']}] {item['issue']}")
                print(f"      {item['text']}")
            if len(section_found) > 5:
                print(f"  ... 还有 {len(section_found) - 5} 个")
            print()
        else:
            print("🔢 SECTION处理: 未发现SECTION相关内容\n")

        # 单位保留
        if units_found:
            print(f"📏 单位保留 ({len(units_found)} 处):")
            for item in units_found[:10]:  # 只显示前10个
                if 'issue' in item:
                    print(f"  [{item['line']}] {item['issue']}: {item['example']}")
                else:
                    print(f"  [{item['line']}] ✅ {item['unit']} - {item['example']}")
            if len(units_found) > 10:
                print(f"  ... 还有 {len(units_found) - 10} 处")
            print()
        else:
            print("📏 单位保留: 未发现单位\n")

        # 列表编号
        if list_numbers_found:
            print(f"🔤 列表编号 ({len(list_numbers_found)} 个):")
            for item in list_numbers_found[:10]:
                print(f"  [{item['line']}] {item['type']}: {item['marker']}{item['text']}")
            if len(list_numbers_found) > 10:
                print(f"  ... 还有 {len(list_numbers_found) - 10} 个")
            print()
        else:
            print("🔤 列表编号: 未发现列表编号\n")

        # 颜色保留
        if colors_found:
            print(f"🎨 颜色保留 ({len(colors_found)} 处):")
            unique_colors = {}
            for item in colors_found:
                rgb = item['rgb']
                if rgb not in unique_colors:
                    unique_colors[rgb] = []
                unique_colors[rgb].append(item)

            for rgb, items in list(unique_colors.items())[:5]:
                print(f"  ✅ RGB{rgb}: {len(items)} 处")
                print(f"      示例: {items[0]['text']}")
            if len(unique_colors) > 5:
                print(f"  ... 还有 {len(unique_colors) - 5} 种颜色")
            print()
        else:
            print("🎨 颜色保留: 未发现彩色文本\n")

        print(f"{'='*70}\n")

        return True

    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 test_translation_quality.py <docx文件路径>")
        print("\n示例:")
        print("  python3 test_translation_quality.py 'docs/specs_zh/07 - 保温与防潮/070150.19 FL - 屋顶翻新准备.docx'")
        sys.exit(1)

    docx_path = Path(sys.argv[1])

    if not docx_path.exists():
        print(f"❌ 文件不存在: {docx_path}")
        sys.exit(1)

    if not docx_path.suffix.lower() in ['.docx', '.doc']:
        print(f"❌ 不是Word文档: {docx_path}")
        sys.exit(1)

    success = check_translation_quality(docx_path)
    sys.exit(0 if success else 1)
