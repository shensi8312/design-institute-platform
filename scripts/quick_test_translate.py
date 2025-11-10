#!/usr/bin/env python3
"""
快速测试翻译 - 只测试前20个段落
用于验证翻译逻辑，不需要等待完整文档翻译
"""

import sys
from pathlib import Path
from docx import Document
from batch_convert_and_translate import (
    preprocess_text,
    postprocess_translation,
    translate_batch,
    protect_units,
    restore_units,
    SECTION_HEADINGS
)

def quick_test(docx_path: str):
    """快速测试前20个段落"""
    print("\n" + "="*70)
    print("⚡ 快速翻译测试（前20个段落）")
    print("="*70 + "\n")

    doc = Document(docx_path)

    # 只取前20个非空段落
    test_paras = []
    for para in doc.paragraphs:
        if para.text.strip():
            test_paras.append(para)
            if len(test_paras) >= 20:
                break

    print(f"找到 {len(test_paras)} 个测试段落\n")

    # 测试每个段落的完整处理流程
    for i, para in enumerate(test_paras, 1):
        original = para.text[:80]
        style = para.style.name if para.style else 'None'

        print(f"\n[{i}] 样式={style}")
        print(f"原文: {original}")

        # 1. 预处理
        preprocessed, is_translated = preprocess_text(para.text, style)
        if preprocessed != para.text:
            print(f"预处理: {preprocessed[:80]} (已翻译: {is_translated})")

        # 如果已翻译，直接使用
        if is_translated:
            print(f"✅ 已预翻译: {preprocessed[:80]}")
            continue

        # 2. 保护单位
        protected, units_map = protect_units(preprocessed)
        if units_map:
            print(f"保护单位: {len(units_map)} 个")

        # 3. 翻译
        try:
            translated = translate_batch([protected])
            if translated and translated[0]:
                trans_text = translated[0]
                print(f"翻译: {trans_text[:80]}")

                # 4. 恢复单位
                restored = restore_units(trans_text, units_map)

                # 5. 后处理
                final = postprocess_translation(restored, style)
                print(f"✅ 最终: {final[:80]}")

                # 检查问题
                if final.startswith(tuple(f'{i}.' for i in range(1, 20))):
                    print(f"⚠️ 仍有编号！")
                if '⟨⟨UNIT' in final or 'MARKER' in final:
                    print(f"⚠️ 占位符残留！")
        except Exception as e:
            print(f"❌ 翻译失败: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 quick_test_translate.py <docx文件>")
        sys.exit(1)

    quick_test(sys.argv[1])
