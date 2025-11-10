#!/usr/bin/env python3
"""
翻译所有文件夹和文件名
保持目录结构，只翻译名称
"""

import os
import sys
import json
from pathlib import Path
import requests

# 强制刷新输出
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# 配置
SOURCE_DIR = "docs/specs/Full Length"
OUTPUT_FILE = "docs/specs/filenames_translation.json"
VLLM_URL = "http://10.10.18.3:8000"
VLLM_MODEL = "/mnt/data/models/Qwen3-32B"

def translate_name(name: str) -> str:
    """翻译文件或文件夹名"""
    # 移除扩展名
    name_without_ext = name.replace('.DOC', '').replace('.docx', '')

    prompt = f"""翻译成中文，保留编号和FL标记:

{name_without_ext}

翻译:"""

    try:
        response = requests.post(
            f"{VLLM_URL}/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            json={
                "model": VLLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 100
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content'].strip()

            # 移除<think>标签内容
            if '<think>' in content:
                # 找到</think>后的内容
                if '</think>' in content:
                    content = content.split('</think>')[-1].strip()
                else:
                    # 如果没有闭合，直接返回原名
                    return name_without_ext

            # 移除可能的"翻译:"前缀和引号
            content = content.replace('翻译:', '').replace('翻译：', '').strip()
            content = content.replace('"', '').replace(''', '').replace(''', '').replace(':', '').replace('：', '')
            content = content.split('\n')[0].strip()  # 只取第一行

            return content if content else name_without_ext
        else:
            print(f"  ⚠️  翻译失败: {response.status_code}")
            return name_without_ext
    except Exception as e:
        print(f"  ❌ 错误: {e}")
        return name_without_ext

def scan_and_translate():
    """扫描并翻译所有文件夹和文件名"""
    source_path = Path(SOURCE_DIR)

    if not source_path.exists():
        print(f"错误: 源目录不存在: {SOURCE_DIR}")
        return

    print("="*60)
    print("扫描并翻译文件夹和文件名")
    print("="*60)
    print(f"源目录: {SOURCE_DIR}")
    print()

    # 存储翻译结果
    translations = {
        "folders": {},
        "files": {}
    }

    # 1. 翻译文件夹名
    print("📁 翻译文件夹名...")
    folders = sorted([d for d in source_path.iterdir() if d.is_dir() and not d.name.startswith('.')])

    for i, folder in enumerate(folders, 1):
        folder_name = folder.name
        print(f"[{i}/{len(folders)}] {folder_name}")
        translated = translate_name(folder_name)
        print(f"        → {translated}")
        translations["folders"][folder_name] = translated

    print()

    # 2. 翻译文件名（只取每个文件夹的前3个作为示例）
    print("📄 翻译文件名（示例）...")
    file_count = 0
    for folder in folders[:5]:  # 只处理前5个文件夹
        files = sorted([f for f in folder.glob("*.DOC")])[:3]  # 每个文件夹只取前3个

        for f in files:
            file_count += 1
            file_name = f.name
            print(f"[{file_count}] {folder.name}/{file_name}")
            translated = translate_name(file_name)
            print(f"    → {translated}")
            translations["files"][file_name] = translated

    # 保存翻译结果
    output_path = Path(OUTPUT_FILE)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    print()
    print("="*60)
    print("✅ 完成！")
    print(f"翻译结果已保存到: {OUTPUT_FILE}")
    print(f"文件夹: {len(translations['folders'])} 个")
    print(f"文件: {len(translations['files'])} 个（示例）")
    print("="*60)

if __name__ == "__main__":
    scan_and_translate()
