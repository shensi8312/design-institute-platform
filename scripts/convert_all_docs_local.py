#!/usr/bin/env python3
"""
本地DOC转DOCX脚本（保持文件夹结构）
只转换，不翻译
"""

import os
import sys
import subprocess
from pathlib import Path

# 配置
SOURCE_DIR = "docs/specs/Full Length"
OUTPUT_DIR = "docs/specs_docx/Full Length"  # 转换后的docx输出目录
LIBREOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice"

def convert_doc_to_docx(input_file: Path, output_file: Path) -> bool:
    """用 LibreOffice 转换 DOC → DOCX"""
    try:
        output_file.parent.mkdir(parents=True, exist_ok=True)

        result = subprocess.run([
            LIBREOFFICE,
            '--headless',
            '--convert-to', 'docx:MS Word 2007 XML',
            '--outdir', str(output_file.parent),
            str(input_file)
        ], capture_output=True, text=True, timeout=60)

        # LibreOffice 会生成同名的 .docx 文件
        generated_file = output_file.parent / (input_file.stem + '.docx')

        if generated_file.exists():
            if generated_file != output_file:
                # 重命名为目标文件名（如果需要）
                generated_file.rename(output_file)
            return True
        else:
            print(f"  ❌ 转换失败: {result.stderr}")
            return False

    except Exception as e:
        print(f"  ❌ 转换错误: {e}")
        return False


def main():
    source_path = Path(SOURCE_DIR)

    if not source_path.exists():
        print(f"❌ 源目录不存在: {SOURCE_DIR}")
        return

    # 获取所有子文件夹
    folders = sorted([d for d in source_path.iterdir() if d.is_dir() and not d.name.startswith('.')])

    print(f"\n{'='*70}")
    print(f"  🔄 本地批量转换 DOC → DOCX")
    print(f"{'='*70}")
    print(f"源目录: {SOURCE_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"文件夹: {len(folders)} 个")
    print(f"{'='*70}\n")

    total_success = 0
    total_fail = 0
    total_skip = 0

    for folder_idx, folder in enumerate(folders, 1):
        folder_name = folder.name

        print(f"\n{'#'*70}")
        print(f"# [{folder_idx}/{len(folders)}] {folder_name}")
        print(f"{'#'*70}")

        # 查找所有DOC文件
        files = sorted(list(folder.glob("*.DOC")) + list(folder.glob("*.doc")))
        files = [f for f in files if not f.name.startswith('~$') and not f.name.startswith('.')]

        print(f"找到 {len(files)} 个DOC文件")

        for file_idx, input_file in enumerate(files, 1):
            file_name = input_file.name

            # 输出到相同的文件夹结构
            output_folder = Path(OUTPUT_DIR).parent / folder_name
            output_file = output_folder / f"{input_file.stem}.docx"

            print(f"  [{file_idx}/{len(files)}] {file_name}", end='')

            if output_file.exists():
                print(f" → ⏭️  已存在")
                total_skip += 1
                continue

            print(f" → 转换中...", end='', flush=True)

            if convert_doc_to_docx(input_file, output_file):
                print(f" ✅")
                total_success += 1
            else:
                print(f" ❌")
                total_fail += 1

    print(f"\n\n{'='*70}")
    print(f"  📊 转换完成")
    print(f"{'='*70}")
    print(f"✅ 成功: {total_success}")
    print(f"⏭️  跳过: {total_skip}")
    print(f"❌ 失败: {total_fail}")
    print(f"{'='*70}\n")

    if total_success > 0:
        print(f"\n📁 转换后的文件在: {OUTPUT_DIR}")
        print(f"\n下一步：执行以下命令打包上传到服务器")
        print(f"  cd docs")
        print(f"  tar -czf specs_docx.tar.gz specs_docx/")
        print(f"  sshpass -p 'asd123465QWE' scp specs_docx.tar.gz aiuser@10.10.19.3:~/")


if __name__ == "__main__":
    main()
