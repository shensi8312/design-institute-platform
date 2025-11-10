#!/usr/bin/env python3
"""
调试翻译问题
"""

import sys
import os
import shutil
from pathlib import Path

# 导入主翻译脚本的函数
sys.path.insert(0, str(Path(__file__).parent))
from batch_convert_and_translate import (
    translate_docx,
    convert_doc_to_docx
)

def debug_translate(input_file: Path, output_file: Path):
    """调试翻译过程"""
    print(f"\n{'='*70}")
    print(f"📄 调试翻译测试")
    print(f"{'='*70}")
    print(f"输入: {input_file}")
    print(f"输出: {output_file}")
    print(f"输入存在: {input_file.exists()}")
    print(f"{'='*70}\n")

    # 创建输出目录
    output_file.parent.mkdir(parents=True, exist_ok=True)
    print(f"✅ 输出目录已创建: {output_file.parent}")
    print(f"✅ 输出目录存在: {output_file.parent.exists()}")

    # 步骤1：转换DOC到DOCX
    if input_file.suffix.upper() == '.DOC':
        print("\n🔄 转换 DOC → DOCX...")
        temp_docx = output_file.parent / f"{input_file.stem}_temp.docx"
        print(f"临时文件路径: {temp_docx}")

        if convert_doc_to_docx(input_file, temp_docx):
            print("✅ 转换成功")
            print(f"✅ 临时文件存在: {temp_docx.exists()}")
            if temp_docx.exists():
                print(f"✅ 临时文件大小: {temp_docx.stat().st_size} 字节")
            working_file = temp_docx
        else:
            print("❌ 转换失败")
            return False
    else:
        working_file = output_file.parent / f"{input_file.stem}_temp.docx"
        shutil.copy(str(input_file), str(working_file))
        print(f"✅ 复制文件: {working_file}")

    print(f"\n📍 工作文件: {working_file}")
    print(f"📍 工作文件存在: {working_file.exists()}")
    if working_file.exists():
        print(f"📍 工作文件大小: {working_file.stat().st_size} 字节")

    # 步骤2：翻译
    print("\n📝 开始翻译...")
    try:
        success = translate_docx(working_file)
        print(f"\n📍 翻译返回: {success}")
    except Exception as e:
        print(f"\n❌ 翻译异常: {e}")
        import traceback
        traceback.print_exc()
        return False

    if success:
        print(f"\n📍 翻译后工作文件存在: {working_file.exists()}")
        if working_file.exists():
            print(f"📍 翻译后工作文件大小: {working_file.stat().st_size} 字节")

        # 重命名为最终文件
        if working_file != output_file:
            print(f"\n🔄 移动文件...")
            print(f"   源: {working_file}")
            print(f"   目标: {output_file}")
            print(f"   源存在: {working_file.exists()}")
            print(f"   目标存在: {output_file.exists()}")

            try:
                # 如果目标文件已存在，先删除
                if output_file.exists():
                    print(f"   删除已存在的目标文件...")
                    output_file.unlink()
                    print(f"   ✅ 已删除")

                print(f"   执行shutil.move...")
                result = shutil.move(str(working_file), str(output_file))
                print(f"   ✅ shutil.move返回: {result}")
                print(f"   移动后源存在: {working_file.exists()}")
                print(f"   移动后目标存在: {output_file.exists()}")

                if output_file.exists():
                    print(f"   ✅ 目标文件大小: {output_file.stat().st_size} 字节")
                else:
                    print(f"   ❌ 目标文件不存在！")
                    return False

            except Exception as e:
                print(f"   ❌ 移动文件失败: {e}")
                import traceback
                traceback.print_exc()
                return False

        print(f"\n✅ 翻译完成！")
        print(f"输出: {output_file}")
        return True
    else:
        print("\n❌ 翻译失败")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使用方法: python3 debug_translate.py <输入文件> <输出文件>")
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

    success = debug_translate(input_path, output_path)
    sys.exit(0 if success else 1)
