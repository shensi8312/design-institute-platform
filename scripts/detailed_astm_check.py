#!/usr/bin/env python3
"""
详细检查ASTM标准编号的颜色
"""

import sys
from docx import Document
from docx.shared import RGBColor

def detailed_check(docx_path: str):
    """详细检查ASTM相关段落"""
    print("\n" + "="*70)
    print("🔍 详细检查ASTM颜色")
    print("="*70 + "\n")

    doc = Document(docx_path)
    TEAL_COLOR = RGBColor(0, 176, 176)

    for para_idx, para in enumerate(doc.paragraphs, 1):
        text = para.text

        # 只检查包含ASTM的段落
        if 'ASTM' in text or 'PART' in text:
            print(f"\n段落 {para_idx}:")
            print(f"完整文本: {text[:100]}")
            print(f"Run数量: {len(para.runs)}")

            # 检查每个run
            for run_idx, run in enumerate(para.runs):
                run_text = run.text
                if not run_text.strip():
                    continue

                # 获取颜色
                color_info = "无颜色"
                if run.font.color and run.font.color.rgb:
                    rgb = run.font.color.rgb
                    color_info = f"RGB({rgb[0]},{rgb[1]},{rgb[2]})"
                    if rgb == TEAL_COLOR:
                        color_info += " ⚠️ 蓝绿色"

                print(f"  Run {run_idx}: '{run_text}' - {color_info}")

            print("-" * 70)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 detailed_astm_check.py <docx文件>")
        sys.exit(1)

    detailed_check(sys.argv[1])
