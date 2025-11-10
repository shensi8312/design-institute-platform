#!/bin/bash

#########################################
# 批量文档翻译脚本
#########################################

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  文档批量翻译工具${NC}"
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

# 获取API Token
if [ -z "$API_TOKEN" ]; then
    echo -e "${YELLOW}请输入API Token:${NC}"
    read -s API_TOKEN
    export API_TOKEN
fi

# 选择模式
echo ""
echo "请选择运行模式:"
echo "  1) 测试模式 (只翻译1个文件)"
echo "  2) 小批量测试 (翻译前10个文件)"
echo "  3) 完整批量翻译 (所有文件)"
echo ""
read -p "请输入选项 [1-3]: " mode

case $mode in
    1)
        echo -e "${YELLOW}运行测试模式...${NC}"
        python3 scripts/test_translate_single.py
        ;;
    2)
        echo -e "${YELLOW}运行小批量测试...${NC}"
        python3 scripts/translate_docs.py --test
        ;;
    3)
        echo -e "${YELLOW}运行完整批量翻译...${NC}"
        echo -e "${RED}警告: 这将翻译约966个文档，可能需要很长时间！${NC}"
        read -p "确认继续? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            python3 scripts/translate_docs.py
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
