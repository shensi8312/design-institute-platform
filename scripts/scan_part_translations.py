#!/usr/bin/env python3
"""
扫描所有已翻译文档，检查PART标题翻译情况
"""

import os
import sys
from pathlib import Path
from docx import Document
import re

def scan_document(docx_path: str):
    """扫描单个文档的PART标题"""
    try:
        doc = Document(docx_path)

        untranslated_parts = []
        translated_parts = []

        for i, para in enumerate(doc.paragraphs, 1):
            text = para.text.strip()
            if not text:
                continue

            # 检查是否是PART标题格式
            # 未翻译: PART 1 - GENERAL, PART 2 - PRODUCTS, PART 3 - EXECUTION
            if re.match(r'^PART\s+\d+\s*-\s*[A-Z]+', text, re.IGNORECASE):
                untranslated_parts.append((i, text))

            # 已翻译: 第1部分 - 总则, 第2部分 - 产品, 第3部分 - 施工
            elif re.match(r'^第\d+部分\s*[-－]\s*', text):
                translated_parts.append((i, text))

        return {
            'path': docx_path,
            'untranslated': untranslated_parts,
            'translated': translated_parts,
            'has_issue': len(untranslated_parts) > 0
        }
    except Exception as e:
        return {
            'path': docx_path,
            'error': str(e),
            'has_issue': False
        }

def main():
    """扫描所有文档"""
    specs_zh_dir = Path('specs_zh')

    if not specs_zh_dir.exists():
        print(f"❌ 目录不存在: {specs_zh_dir}")
        sys.exit(1)

    print("🔍 扫描所有已翻译文档中的PART标题...\n")
    print("="*80)

    # 收集所有docx文件
    docx_files = []
    for root, dirs, files in os.walk(specs_zh_dir):
        for file in files:
            if file.endswith('.docx') and not file.startswith('.'):
                docx_files.append(os.path.join(root, file))

    print(f"找到 {len(docx_files)} 个文档\n")

    # 扫描每个文档
    issues = []
    good = []
    errors = []

    for idx, docx_path in enumerate(docx_files, 1):
        rel_path = os.path.relpath(docx_path, 'specs_zh')
        print(f"[{idx}/{len(docx_files)}] 检查: {rel_path}")

        result = scan_document(docx_path)

        if 'error' in result:
            errors.append(result)
            print(f"    ⚠️  读取错误: {result['error']}")
        elif result['has_issue']:
            issues.append(result)
            print(f"    ❌ 发现 {len(result['untranslated'])} 个未翻译的PART标题")
            for para_num, text in result['untranslated'][:3]:  # 只显示前3个
                print(f"       段落 {para_num}: {text}")
        elif len(result['translated']) > 0:
            good.append(result)
            print(f"    ✅ {len(result['translated'])} 个PART标题已正确翻译")
        else:
            print(f"    ℹ️  无PART标题")

    # 生成报告
    print("\n" + "="*80)
    print("📊 扫描结果汇总")
    print("="*80)

    print(f"\n总文档数: {len(docx_files)}")
    print(f"  ✅ 正确翻译: {len(good)} 个")
    print(f"  ❌ 需要修复: {len(issues)} 个")
    print(f"  ⚠️  读取错误: {len(errors)} 个")

    if issues:
        print("\n❌ 需要修复的文档:")
        print("-"*80)
        for result in issues:
            rel_path = os.path.relpath(result['path'], 'specs_zh')
            print(f"\n📄 {rel_path}")
            print(f"   未翻译的PART标题 ({len(result['untranslated'])} 个):")
            for para_num, text in result['untranslated']:
                print(f"     段落 {para_num}: {text}")

    if errors:
        print("\n⚠️  读取错误的文档:")
        print("-"*80)
        for result in errors:
            rel_path = os.path.relpath(result['path'], 'specs_zh')
            print(f"  {rel_path}: {result['error']}")

    print("\n" + "="*80)

    # 返回状态码
    sys.exit(0 if len(issues) == 0 else 1)

if __name__ == "__main__":
    main()
