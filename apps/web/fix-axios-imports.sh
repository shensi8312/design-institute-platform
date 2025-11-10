#!/bin/bash

# 修复所有axios导入（除了axios.ts本身）
FILES=$(grep -rl "^import axios from ['\"]axios['\"]" src --include="*.tsx" --include="*.ts" | grep -v "utils/axios.ts")

for file in $FILES; do
  # 计算相对路径深度
  depth=$(echo "$file" | tr -cd '/' | wc -c)
  
  # 根据深度生成相对路径前缀
  prefix=""
  if [ $depth -eq 1 ]; then
    # src/file.tsx -> ./utils/axios
    prefix="./utils/axios"
  elif [ $depth -eq 2 ]; then
    # src/pages/file.tsx -> ../utils/axios
    prefix="../utils/axios"
  elif [ $depth -eq 3 ]; then
    # src/pages/subfolder/file.tsx -> ../../utils/axios
    prefix="../../utils/axios"
  else
    # src/pages/subfolder/deep/file.tsx -> ../../../utils/axios
    prefix="../../../utils/axios"
  fi
  
  echo "Fixing $file with import from '$prefix'"
  sed -i '' "s|import axios from ['\"]axios['\"]|import axios from '$prefix'|g" "$file"
done

echo "Fixed $(echo "$FILES" | wc -l) files"