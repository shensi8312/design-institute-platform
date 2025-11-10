#!/usr/bin/env python3
"""
快速检查原始DOC文件中是否有PART标题
使用textutil转换为txt快速检查
"""

import subprocess
import os
import re
import sys

def quick_check_doc(doc_path: str):
    """快速检查DOC文件中的PART标题"""
    try:
        # 使用textutil转换为txt（macOS自带）
        result = subprocess.run(
            ['textutil', '-convert', 'txt', '-stdout', doc_path],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            return None

        text = result.stdout

        # 查找 PART 标题
        part_matches = []
        for line in text.split('\n'):
            line = line.strip()
            if re.match(r'^PART\s+\d+\s*-\s*[A-Z]+', line, re.IGNORECASE):
                part_matches.append(line)

        return part_matches

    except Exception as e:
        return None

def main():
    # 测试几个文档
    test_docs = [
        "specs/Full Length/32 - EXTERIOR IMPROVEMENTS/321813 FL - Synthetic Grass Surfacing.DOC",
        "specs/Full Length/32 - EXTERIOR IMPROVEMENTS/321216 FL - Asphalt Paving.DOC",
        "specs/Full Length/32 - EXTERIOR IMPROVEMENTS/323300 FL - Site Furnishings.DOC",
    ]

    print("🔍 快速检查原始文档中的PART标题\n")
    print("="*80)

    found_any = False

    for doc_path in test_docs:
        if not os.path.exists(doc_path):
            print(f"❌ 文件不存在: {doc_path}")
            continue

        print(f"\n📄 {os.path.basename(doc_path)}")

        parts = quick_check_doc(doc_path)

        if parts is None:
            print("   ⚠️  无法读取")
        elif len(parts) == 0:
            print("   ℹ️  无PART标题")
        else:
            print(f"   ✅ 找到 {len(parts)} 个PART标题:")
            for part in parts:
                print(f"      {part}")
            found_any = True

    print("\n" + "="*80)

    if found_any:
        print("✅ 发现包含PART标题的文档")
    else:
        print("ℹ️  测试的文档中未发现PART标题")

if __name__ == "__main__":
    main()
