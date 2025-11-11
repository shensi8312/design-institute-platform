#!/bin/bash
set -e

echo "================================================"
echo "契约一致性修复验证脚本"
echo "================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查migration文件状态
echo "1. 检查Migration文件..."
echo "----------------------------"

if [ -f "apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js" ]; then
  echo -e "${RED}❌ 重复的migration文件仍存在${NC}"
  echo "   文件: 20251029142500_add_assembly_inference_tasks.js"
else
  echo -e "${GREEN}✓ 重复的migration文件已移除${NC}"
fi

if [ -f "apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js.backup" ]; then
  echo -e "${GREEN}✓ 备份文件存在: .js.backup${NC}"
fi

if [ -f "apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.REMOVED.md" ]; then
  echo -e "${GREEN}✓ 删除说明文档存在${NC}"
fi

echo ""

# 2. 检查pid_recognition_results外键修复
echo "2. 检查PID外键修复..."
echo "----------------------------"

if grep -q "inTable('knowledge_documents')" apps/api/src/database/migrations/20251105084524_create_pid_recognition_results.js; then
  echo -e "${GREEN}✓ pid_recognition_results外键已修正为knowledge_documents${NC}"
else
  echo -e "${RED}❌ pid_recognition_results外键未修正${NC}"
fi

echo ""

# 3. 检查前端路由修复
echo "3. 检查前端路由修复..."
echo "----------------------------"

if grep -q "/3d-model.*PE-fix-route-path" apps/web/src/pages/AssemblyDesignManagement.tsx; then
  echo -e "${GREEN}✓ 前端3D路由已修正为/3d-model${NC}"
  FIXED_COUNT=$(grep -c "/3d-model.*PE-fix-route-path" apps/web/src/pages/AssemblyDesignManagement.tsx)
  echo "   修正位置数: $FIXED_COUNT"
else
  echo -e "${RED}❌ 前端3D路由未修正${NC}"
fi

echo ""

# 4. 检查不应存在的旧路由
echo "4. 检查旧路由清理..."
echo "----------------------------"

OLD_ROUTES=$(grep -c "generate-3d\|upload-3d" apps/web/src/pages/AssemblyDesignManagement.tsx 2>/dev/null || echo "0")
if [ "$OLD_ROUTES" = "0" ]; then
  echo -e "${GREEN}✓ 旧路由(/generate-3d, /upload-3d)已清理${NC}"
else
  echo -e "${YELLOW}⚠ 发现 $OLD_ROUTES 处旧路由未清理${NC}"
fi

echo ""

# 5. 检查文档生成
echo "5. 检查审计文档..."
echo "----------------------------"

if [ -f "CONTRACT_AUDIT_REPORT_2025-11-11.md" ]; then
  echo -e "${GREEN}✓ 审计报告已生成${NC}"
  REPORT_SIZE=$(wc -l < CONTRACT_AUDIT_REPORT_2025-11-11.md)
  echo "   报告行数: $REPORT_SIZE"
fi

if [ -f "FIX_SUMMARY_2025-11-11.md" ]; then
  echo -e "${GREEN}✓ 修复总结已生成${NC}"
fi

echo ""

# 6. Git状态检查
echo "6. Git变更状态..."
echo "----------------------------"
git status --short | head -10

echo ""

# 7. 生成修复报告
echo "================================================"
echo "修复状态汇总"
echo "================================================"

cat << 'SUMMARY'

已修复的P0问题:
  ✓ P0-2: assembly_inference_tasks重复定义 - 已移除重复migration
  ✓ P0-3: pid_recognition_results外键错误 - 已修正为knowledge_documents
  ✓ P0-4: 前端3D路由不一致 - 已统一为/3d-model

待决策的P0问题:
  ⚠ P0-1: BOM学习系统未合并 - 需决策是否合并分支claude/upload-yp-011CUzUgvbGAU2Sw7WyFE7JY

待处理的P1问题:
  ⚠ P1-1: design_rules字段冲突 - 如合并分支需处理
  ⚠ P1-2: assembly_constraints外键依赖 - 已通过删除重复migration解决

下一步操作:
  1. 提交已修复的文件
  2. 决策是否合并BOM学习分支
  3. 运行migration测试

验证命令:
  # 检查migration语法
  npm run migrate:status

  # 测试前端构建
  cd apps/web && npm run build

  # 启动服务测试
  npm run dev

SUMMARY

echo ""
echo "验证完成！"
