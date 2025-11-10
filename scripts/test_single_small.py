#!/usr/bin/env python3
"""
测试单个小文件翻译 - 验证专业prompt效果
"""

import sys
from pathlib import Path

# 强制刷新输出
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# 添加脚本目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from translate_docs_vllm import process_doc_file

# 测试最小的文件
test_file = Path("docs/specs/Full Length/01 - GENERAL REQUIREMENTS/012300 FL - Alternates.DOC")
output_file = Path("docs/specs_zh/test_small.docx")

print("="*60)
print("测试小文件翻译 - 验证专业建筑术语翻译")
print("="*60)
print(f"输入: {test_file.name}")
print(f"大小: 只有59行 (最小文件)")
print(f"输出: {output_file}")
print("="*60)
print()

try:
    process_doc_file(test_file, output_file)
    print("\n✅ 测试完成！")
    print(f"请检查: {output_file}")
except Exception as e:
    print(f"\n❌ 失败: {e}")
    import traceback
    traceback.print_exc()
