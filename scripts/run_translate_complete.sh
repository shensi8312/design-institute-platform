#!/bin/bash

#########################################
# 完整文档翻译脚本 - 一键运行
# ✅ 翻译内容（保持格式）
# ✅ 翻译文件夹名
# ✅ 翻译文件名
# ✅ 移除页眉页脚
#########################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  完整文档翻译工具 🚀${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 检查依赖
echo -e "${BLUE}检查依赖...${NC}"
if ! python3 -c "import docx" 2>/dev/null; then
    echo -e "${YELLOW}安装 python-docx...${NC}"
    pip3 install python-docx --break-system-packages
fi

if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${YELLOW}安装 requests...${NC}"
    pip3 install requests --break-system-packages
fi

# 配置
VLLM_URL="${VLLM_URL:-http://10.10.18.3:8000}"

echo -e "${BLUE}配置:${NC}"
echo -e "  VLLM: ${VLLM_URL}"
echo -e "  模型: Qwen3-32B"
echo -e "  批量: 10段/次"
echo ""

# 选择模式
echo "选择运行模式:"
echo "  1) 🧪 测试模式 (1个文件)"
echo "  2) 📦 小批量 (10个文件)"
echo "  3) 🚀 完整翻译 (所有文件)"
echo ""
read -p "请选择 [1-3]: " mode

case $mode in
    1)
        echo -e "${YELLOW}运行测试模式...${NC}"
        python3 scripts/translate_docs_complete.py --test
        ;;
    2)
        echo -e "${YELLOW}运行小批量模式...${NC}"
        python3 scripts/translate_docs_complete.py --small
        ;;
    3)
        echo -e "${RED}警告: 将翻译所有文档！${NC}"
        echo ""
        read -p "确认? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            python3 scripts/translate_docs_complete.py
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
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  ✅ 完成！${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "翻译后的文档: docs/specs_zh/"
echo ""
