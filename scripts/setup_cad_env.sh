#!/bin/bash
echo "🔧 创建Python 3.12 CAD环境..."

# 创建新环境
conda create -n cad python=3.12 -y

# 激活并安装pythonocc-core
source $(conda info --base)/etc/profile.d/conda.sh
conda activate cad
conda install -c conda-forge pythonocc-core -y

# 验证安装
python -c "from OCC.Core.STEPControl import STEPControl_Reader; print('✅ pythonocc-core安装成功')"

# 显示Python路径
echo ""
echo "📍 CAD环境Python路径:"
which python
python --version

echo ""
echo "✅ CAD环境已就绪"
