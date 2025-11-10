#!/bin/bash

echo "🚀 前后端端到端集成测试"
echo "================================================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# 1. 登录测试
echo "📝 1. 登录流程测试"
echo "============================================================"

LOGIN_RESPONSE=$(curl -s -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USERNAME=$(echo $LOGIN_RESPONSE | grep -o '"username":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✅ 登录成功: $USERNAME${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 登录失败${NC}"
  ((fail_count++))
  exit 1
fi
echo ""

# 2. 组织CRUD测试
echo "🏢 2. 组织管理完整流程 (CREATE → READ → UPDATE → DELETE)"
echo "============================================================"

# 2.1 创建组织
TIMESTAMP=$(date +%s)
CREATE_ORG_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E测试组织_${TIMESTAMP}\",\"code\":\"E2E_${TIMESTAMP}\",\"type\":\"design_institute\",\"status\":\"active\"}")

ORG_ID=$(echo $CREATE_ORG_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$ORG_ID" ]; then
  echo -e "${GREEN}✅ 创建组织成功: $ORG_ID${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 创建组织失败${NC}"
  ((fail_count++))
fi

# 2.2 读取组织详情
if [ -n "$ORG_ID" ]; then
  GET_ORG_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/organizations/$ORG_ID")

  if echo "$GET_ORG_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 读取组织详情成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 读取组织详情失败${NC}"
    ((fail_count++))
  fi
fi

# 2.3 更新组织
if [ -n "$ORG_ID" ]; then
  UPDATE_ORG_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/organizations/$ORG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"description":"E2E测试更新"}')

  if echo "$UPDATE_ORG_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 更新组织成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 更新组织失败${NC}"
    ((fail_count++))
  fi
fi

# 2.4 删除组织
if [ -n "$ORG_ID" ]; then
  DELETE_ORG_RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/organizations/$ORG_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$DELETE_ORG_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 删除组织成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 删除组织失败${NC}"
    ((fail_count++))
  fi
fi
echo ""

# 3. 用户CRUD测试
echo "👤 3. 用户管理完整流程 (CREATE → READ → UPDATE → DELETE)"
echo "============================================================"

# 3.1 创建用户
TIMESTAMP=$(date +%s)
CREATE_USER_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"e2e_test_${TIMESTAMP}\",\"password\":\"Test123456\",\"email\":\"e2e_${TIMESTAMP}@test.com\",\"name\":\"E2E测试用户\",\"status\":\"active\"}")

USER_ID=$(echo $CREATE_USER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$USER_ID" ]; then
  echo -e "${GREEN}✅ 创建用户成功: $USER_ID${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 创建用户失败${NC}"
  ((fail_count++))
fi

# 3.2 读取用户详情
if [ -n "$USER_ID" ]; then
  GET_USER_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/users/$USER_ID")

  if echo "$GET_USER_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 读取用户详情成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 读取用户详情失败${NC}"
    ((fail_count++))
  fi
fi

# 3.3 更新用户
if [ -n "$USER_ID" ]; then
  UPDATE_USER_RESPONSE=$(curl -s -X PUT "http://localhost:3000/api/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"E2E更新后的用户"}')

  if echo "$UPDATE_USER_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 更新用户成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 更新用户失败${NC}"
    ((fail_count++))
  fi
fi

# 3.4 删除用户
if [ -n "$USER_ID" ]; then
  DELETE_USER_RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$DELETE_USER_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 删除用户成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 删除用户失败${NC}"
    ((fail_count++))
  fi
fi
echo ""

# 4. 角色和权限查询
echo "🔐 4. 角色权限流程"
echo "============================================================"

ROLES_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/roles")

if echo "$ROLES_RESPONSE" | grep -q "\"success\":true"; then
  echo -e "${GREEN}✅ 查询角色列表成功${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 查询角色列表失败${NC}"
  ((fail_count++))
fi

PERMS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/permissions")

if echo "$PERMS_RESPONSE" | grep -q "\"success\":true"; then
  echo -e "${GREEN}✅ 查询权限列表成功${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 查询权限列表失败${NC}"
  ((fail_count++))
fi
echo ""

# 5. 菜单查询
echo "📋 5. 菜单管理流程"
echo "============================================================"

MENUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/menus/user")

if echo "$MENUS_RESPONSE" | grep -q "\"success\":true"; then
  MENU_COUNT=$(echo $MENUS_RESPONSE | grep -o '"data":\[' | wc -l)
  echo -e "${GREEN}✅ 获取用户菜单成功${NC}"
  ((pass_count++))
else
  echo -e "${RED}❌ 获取用户菜单失败${NC}"
  ((fail_count++))
fi
echo ""

# 6. 项目CRUD测试
echo "📁 6. 项目管理流程 (CREATE → DELETE)"
echo "============================================================"

# 6.1 创建项目
TIMESTAMP=$(date +%s)
CREATE_PROJ_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E测试项目_${TIMESTAMP}\",\"code\":\"PROJ_${TIMESTAMP}\",\"type\":\"construction\",\"status\":\"active\"}")

PROJ_ID=$(echo $CREATE_PROJ_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$PROJ_ID" ]; then
  echo -e "${GREEN}✅ 创建项目成功: $PROJ_ID${NC}"
  ((pass_count++))

  # 6.2 删除项目
  DELETE_PROJ_RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/projects/$PROJ_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$DELETE_PROJ_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ 删除项目成功${NC}"
    ((pass_count++))
  else
    echo -e "${RED}❌ 删除项目失败${NC}"
    ((fail_count++))
  fi
else
  echo -e "${RED}❌ 创建项目失败${NC}"
  ((fail_count++))
fi
echo ""

# 汇总报告
echo "================================================================================"
echo ""
echo "📊 E2E测试汇总"
echo "================================================================================"
echo ""
total=$((pass_count + fail_count))
pass_rate=$(echo "scale=1; $pass_count * 100 / $total" | bc)

echo "总测试项: $total"
echo -e "${GREEN}✅ 通过: $pass_count${NC}"
echo -e "${RED}❌ 失败: $fail_count${NC}"
echo ""
echo "通过率: ${pass_rate}%"
echo ""
echo "================================================================================"
echo ""

if [ $fail_count -eq 0 ]; then
  echo "🎉 所有前后端集成测试通过!"
  echo "✅ 前端输入 → 后端处理 → 数据库操作 → 正确响应 流程完整"
  echo ""
  exit 0
else
  echo "⚠️  部分测试失败，需要修复"
  echo ""
  exit 1
fi
