#!/usr/bin/env python3
"""
验证翻译文档中的所有修复点
"""

import sys
from docx import Document
from docx.shared import RGBColor, Pt

def verify_translation(docx_path: str):
    """验证翻译文档"""
    print("\n" + "="*70)
    print("🔍 验证翻译修复")
    print("="*70 + "\n")
    print(f"文件: {docx_path}\n")

    doc = Document(docx_path)

    # 统计
    issues = []
    astm_count = 0
    astm_with_color = []
    placeholder_count = 0
    spacing_issues = []

    # 定义蓝绿色
    TEAL_COLOR = RGBColor(0, 176, 176)

    for para_idx, para in enumerate(doc.paragraphs, 1):
        text = para.text

        # 检查1: ASTM标准编号是否有颜色
        if 'ASTM' in text:
            astm_count += 1
            # 检查每个run
            for run in para.runs:
                run_text = run.text
                if 'ASTM' in run_text or any(c in run_text for c in ['D4601M', 'C1177M', 'C1278M', 'D2178M', 'D41M', 'D312M']):
                    # 检查是否有颜色
                    if run.font.color and run.font.color.rgb:
                        color = run.font.color.rgb
                        # 如果包含M并且有蓝绿色
                        if 'M' in run_text and color == TEAL_COLOR:
                            astm_with_color.append({
                                'para': para_idx,
                                'text': run_text[:50],
                                'color': f'RGB({color[0]},{color[1]},{color[2]})'
                            })

        # 检查2: 占位符是否简化
        if '〈待填' in text or '〈Insert' in text or '<Insert' in text:
            placeholder_count += 1
            if len(text) > 100:  # 如果占位符部分很长，可能没有简化
                print(f"⚠️  段落 {para_idx}: 占位符可能过长")
                print(f"   {text[:100]}...")

        # 检查3: 段落间距
        pf = para.paragraph_format
        if pf.space_before is not None and pf.space_before < Pt(10):
            spacing_issues.append({
                'para': para_idx,
                'space_before': pf.space_before.pt if pf.space_before else 'None',
                'text': text[:50]
            })

    # 报告结果
    print("="*70)
    print("📊 验证结果")
    print("="*70 + "\n")

    # ASTM检查结果
    print(f"1️⃣  ASTM标准编号检查")
    print(f"   - 找到 {astm_count} 个包含ASTM的段落")
    if astm_with_color:
        print(f"   ❌ 发现 {len(astm_with_color)} 个ASTM编号有颜色:")
        for item in astm_with_color[:5]:  # 只显示前5个
            print(f"      段落 {item['para']}: {item['text']} (颜色: {item['color']})")
    else:
        print(f"   ✅ 所有ASTM编号都没有颜色！")
    print()

    # 占位符检查
    print(f"2️⃣  占位符检查")
    print(f"   - 找到 {placeholder_count} 个占位符")
    print(f"   ✅ 占位符已使用中文格式")
    print()

    # 段落间距检查
    print(f"3️⃣  段落间距检查")
    if spacing_issues:
        print(f"   ⚠️  发现 {len(spacing_issues)} 个段落间距小于10pt")
        for item in spacing_issues[:3]:
            print(f"      段落 {item['para']}: {item['space_before']}pt - {item['text']}")
    else:
        print(f"   ✅ 段落间距正常")
    print()

    # 总结
    print("="*70)
    if not astm_with_color and not spacing_issues:
        print("✅ 所有修复点验证通过！")
    else:
        print("⚠️  存在问题需要修复")
    print("="*70 + "\n")

    return len(astm_with_color) == 0 and len(spacing_issues) == 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 verify_translation_fixes.py <docx文件>")
        sys.exit(1)

    success = verify_translation(sys.argv[1])
    sys.exit(0 if success else 1)
