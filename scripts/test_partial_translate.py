#!/usr/bin/env python3
"""
快速测试翻译几个段落，验证bug是否修复
"""

import sys
import tempfile
from pathlib import Path
from docx import Document

# 导入翻译函数
sys.path.insert(0, str(Path(__file__).parent))
from batch_convert_and_translate import (
    preprocess_text,
    protect_units,
    restore_units,
    translate_batch,
    apply_translation_with_colors
)

def test_partial_translation(docx_path: str):
    """测试翻译文档中有问题的几个段落"""

    print(f"\n{'='*70}")
    print(f"📄 快速测试翻译")
    print(f"{'='*70}\n")

    doc = Document(docx_path)

    # 找到包含单位的段落（这些是有问题的）
    test_paragraphs = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text.strip()

        # 查找包含单位的段落
        if '0.16' in text or 'kg/sq' in text.lower() or 'SECTION' in text.upper():
            test_paragraphs.append({
                'index': i,
                'paragraph': para,
                'original_text': text[:100]
            })

            if len(test_paragraphs) >= 5:  # 只测试5个段落
                break

    print(f"找到 {len(test_paragraphs)} 个测试段落\n")

    # 测试每个段落的处理流程
    for item in test_paragraphs:
        para = item['paragraph']
        original = item['original_text']

        print(f"[{item['index']}] 原文: {original}")

        # 1. 预处理
        preprocessed = preprocess_text(para.text, para.style.name if para.style else None)
        print(f"     预处理: {preprocessed[:80]}")

        # 2. 保护单位
        protected, units_map = protect_units(preprocessed)
        print(f"     保护单位: {protected[:80]}")
        if units_map:
            for k, v in list(units_map.items())[:2]:
                print(f"       {k} = {v}")

        # 3. 翻译（调用VLLM）
        try:
            translated = translate_batch([protected])
            if translated and translated[0]:
                translated_text = translated[0]
                print(f"     翻译: {translated_text[:80]}")

                # 4. 恢复单位
                restored = restore_units(translated_text, units_map)
                print(f"     恢复单位: {restored[:80]}")

                # 检查结果
                if 'kg/m²' in restored or 'kg/m³' in restored:
                    print(f"     ✅ 单位转换成功！")
                if '⟨⟨UNIT' in restored or 'MARKER' in restored:
                    print(f"     ❌ 占位符残留！")

        except Exception as e:
            print(f"     ❌ 翻译失败: {e}")

        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 test_partial_translate.py <docx文件>")
        sys.exit(1)

    test_partial_translation(sys.argv[1])
