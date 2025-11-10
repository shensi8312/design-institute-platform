#!/usr/bin/env python3
"""
检查Word文档中单位的实际字符编码
"""

from docx import Document
import sys

def check_unit_chars(docx_path):
    """检查文档中单位的字符"""
    print(f"\n{'='*70}")
    print(f"📄 检查单位字符: {docx_path}")
    print(f"{'='*70}\n")

    doc = Document(docx_path)

    # 查找包含单位的段落
    unit_keywords = ['kg/m', 'kg/sq', 'mm', 'cm']
    found_examples = []

    for i, para in enumerate(doc.paragraphs, 1):
        text = para.text
        for keyword in unit_keywords:
            if keyword in text.lower():
                # 找到单位周围的文本
                idx = text.lower().find(keyword)
                start = max(0, idx - 10)
                end = min(len(text), idx + 30)
                example = text[start:end]

                # 显示字符的Unicode编码
                print(f"[{i}] {example}")
                print(f"     原始字节: {example.encode('unicode_escape')}")

                # 详细显示关键字符
                for j, char in enumerate(example):
                    if char in ['²', '³', '/', '2', '3', 'm', 'g', 'k']:
                        print(f"     [{j}] '{char}' = U+{ord(char):04X}")

                found_examples.append(example)
                print()

                if len(found_examples) >= 5:
                    return

    print(f"共找到 {len(found_examples)} 个示例")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python3 check_unit_chars.py <docx文件>")
        sys.exit(1)

    check_unit_chars(sys.argv[1])
