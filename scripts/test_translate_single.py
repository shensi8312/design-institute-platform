#!/usr/bin/env python3
"""
测试单个文档翻译
"""

import os
import sys
from pathlib import Path

# 添加脚本目录到路径
sys.path.insert(0, str(Path(__file__).parent))

def test_single_doc():
    """测试单个DOC文件翻译"""
    from translate_docs import process_doc_file

    # 选择一个测试文件
    test_file = Path("docs/specs/Full Length/32 - EXTERIOR IMPROVEMENTS/321216 FL - Asphalt Paving.DOC")
    output_file = Path("docs/specs_zh/test_output.docx")

    if not test_file.exists():
        print(f"测试文件不存在: {test_file}")
        return

    print("="*60)
    print("测试单个文档翻译")
    print("="*60)
    print(f"输入文件: {test_file}")
    print(f"输出文件: {output_file}")
    print()

    # 设置API Token
    if 'API_TOKEN' not in os.environ:
        token = input("请输入API Token（直接回车跳过翻译测试格式保留）: ").strip()
        if token:
            os.environ['API_TOKEN'] = token

    try:
        process_doc_file(test_file, output_file)
        print("\n测试完成！请检查输出文件:")
        print(f"  {output_file}")
    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_single_doc()
