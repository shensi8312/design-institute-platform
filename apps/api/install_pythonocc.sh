#!/bin/bash
echo "正在安装pythonocc-core..."
conda install -c conda-forge pythonocc-core -y
python3 -c "from OCC.Core.STEPControl import STEPControl_Reader; print('✅ pythonocc-core安装成功')"
