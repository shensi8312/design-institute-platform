#!/usr/bin/env python3
"""
单文件翻译测试（使用优化后的翻译逻辑）
"""

import sys
import os
from pathlib import Path

# 导入主翻译脚本的函数
sys.path.insert(0, str(Path(__file__).parent))
from batch_convert_and_translate import (
    translate_docx,
    convert_doc_to_docx,
    translate_folder_name,
    translate_file_name
)

def translate_single_file(input_file: Path, output_file: Path):
    """翻译单个文件"""
    print(f"\n{'='*70}")
    print(f"📄 翻译文件测试")
    print(f"{'='*70}")
    print(f"输入: {input_file}")
    print(f"输出: {output_file}")
    print(f"{'='*70}\n")

    # 创建输出目录
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # 步骤1：转换DOC到DOCX
    if input_file.suffix.upper() == '.DOC':
        print("🔄 转换 DOC → DOCX...")
        temp_docx = output_file.parent / f"{input_file.stem}_temp.docx"

        if convert_doc_to_docx(input_file, temp_docx):
            print("✅ 转换成功")
            working_file = temp_docx
        else:
            print("❌ 转换失败")
            return False
    else:
        # 如果已经是DOCX，先复制一份
        import shutil
        working_file = output_file.parent / f"{input_file.stem}_temp.docx"
        shutil.copy(str(input_file), str(working_file))

    # 步骤2：翻译
    print("\n📝 开始翻译...")
    success = translate_docx(working_file)

    if success:
        # 重命名为最终文件
        if working_file != output_file:
            import shutil
            # 如果目标文件已存在，先删除
            if output_file.exists():
                output_file.unlink()
            shutil.move(str(working_file), str(output_file))
        print(f"\n✅ 翻译完成！")
        print(f"输出: {output_file}")
        return True
    else:
        print("\n❌ 翻译失败")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使用方法: python3 test_single_translate.py <输入文件> <输出文件>")
        print("\n示例:")
        print('  python3 test_single_translate.py \\')
        print('    "docs/specs/Full Length/07 - THERMAL AND MOISTURE PROTECTION/070150.19 FL - Preparation for Reroofing.DOC" \\')
        print('    "docs/specs_zh/07 - 保温与防潮/070150.19 FL - 屋顶翻新准备.docx"')
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"❌ 输入文件不存在: {input_path}")
        sys.exit(1)

    # 测试VLLM连接
    print("🔌 测试VLLM连接...")
    import requests
    VLLM_URL = os.getenv("VLLM_URL", "http://10.10.18.3:8000")

    try:
        response = requests.get(f"{VLLM_URL}/v1/models", timeout=5)
        if response.status_code == 200:
            print(f"✅ VLLM连接成功\n")
        else:
            print(f"⚠️  VLLM响应异常")
    except Exception as e:
        print(f"❌ VLLM连接失败: {e}")
        sys.exit(1)

    success = translate_single_file(input_path, output_path)
    sys.exit(0 if success else 1)
