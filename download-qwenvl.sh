#!/bin/bash

set -e

echo "📥 开始下载 Qwen2.5-VL-72B 模型..."

# 定义变量
MODEL_DIR="/home/test/models/qwen-vl/models/Qwen2.5-VL-72B"
MODEL_NAME="Qwen/Qwen2.5-VL-72B-Instruct"

# 创建目录
mkdir -p "$MODEL_DIR"

# 使用 huggingface-cli 下载
echo "使用 huggingface-cli 下载模型..."
cd "$MODEL_DIR"

# 安装 huggingface_hub 如果没有
pip3 show huggingface_hub > /dev/null 2>&1 || pip3 install -U "huggingface_hub[cli]"

# 下载模型（使用镜像加速）
export HF_ENDPOINT=https://hf-mirror.com
huggingface-cli download "$MODEL_NAME" --local-dir "$MODEL_DIR" --local-dir-use-symlinks False --resume-download

echo "✅ 模型下载完成！"
echo "📂 模型位置: $MODEL_DIR"
echo "📊 模型大小:"
du -sh "$MODEL_DIR"
