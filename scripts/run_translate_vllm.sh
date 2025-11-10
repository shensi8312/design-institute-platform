#!/bin/bash

#########################################
# 批量文档翻译脚本 - VLLM版本
# 使用本地Qwen3-32B模型，无需API Token
#########################################

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  文档批量翻译工具 (VLLM版)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 检查源目录
if [ ! -d "docs/specs" ]; then
    echo -e "${RED}错误: 源目录 docs/specs 不存在${NC}"
    exit 1
fi

# 检查python-docx
if ! python3 -c "import docx" 2>/dev/null; then
    echo -e "${YELLOW}检测到缺少 python-docx 库，正在安装...${NC}"
    pip3 install python-docx --break-system-packages
fi

# 检查requests
if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${YELLOW}检测到缺少 requests 库，正在安装...${NC}"
    pip3 install requests --break-system-packages
fi

# VLLM配置
VLLM_URL="${VLLM_URL:-http://10.10.18.3:8000}"

echo -e "${BLUE}配置信息:${NC}"
echo -e "  VLLM服务: ${VLLM_URL}"
echo -e "  模型: Qwen3-32B"
echo ""

# 选择模式
echo "请选择运行模式:"
echo "  1) 测试模式 (只翻译1个文件)"
echo "  2) 小批量测试 (翻译前10个文件)"
echo "  3) 完整批量翻译 (所有约966个文件)"
echo ""
read -p "请输入选项 [1-3]: " mode

case $mode in
    1)
        echo -e "${YELLOW}运行测试模式 (1个文件)...${NC}"
        python3 scripts/translate_docs_vllm.py --test --vllm-url "$VLLM_URL"
        ;;
    2)
        echo -e "${YELLOW}运行小批量测试 (10个文件)...${NC}"
        python3 scripts/translate_docs_vllm.py --small --vllm-url "$VLLM_URL"
        ;;
    3)
        echo -e "${YELLOW}运行完整批量翻译...${NC}"
        echo -e "${RED}警告: 这将翻译约966个文档，可能需要很长时间！${NC}"
        echo -e "${YELLOW}预计时间: 3-8小时${NC}"
        echo ""
        read -p "确认继续? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            python3 scripts/translate_docs_vllm.py --vllm-url "$VLLM_URL"
        else
            echo "已取消"
            exit 0
        fi
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "翻译后的文档保存在: docs/specs_zh/"
echo ""
