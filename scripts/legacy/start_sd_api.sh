#!/bin/bash
# SD WebUI 启动脚本 - 建筑专用配置

echo "🚀 启动Stable Diffusion WebUI (建筑专用配置)"

# 检查是否在正确目录
if [ ! -f "webui.py" ]; then
    echo "❌ 请在stable-diffusion-webui目录下运行此脚本"
    exit 1
fi

# 启动参数
ARGS="--api --listen --port 7860"
ARGS="$ARGS --enable-insecure-extension-access"
ARGS="$ARGS --xformers"  # 如果支持xformers加速
ARGS="$ARGS --opt-split-attention"  # 内存优化
ARGS="$ARGS --medvram"  # 中等显存模式，可根据显卡调整

echo "启动参数: $ARGS"
echo "API地址: http://localhost:7860"

# 启动WebUI
python webui.py $ARGS
