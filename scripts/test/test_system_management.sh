#!/bin/bash

# 设计院平台系统管理功能端到端测试脚本

API_URL="http://localhost:3000/api"
TOKEN=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 打印测试结果
print_result() {
  TOTAL_TESTS=$((TOTAL_TESTS+1))
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
    PASSED_TESTS=$((PASSED_TESTS+1))
  else
    echo -e "${RED}✗${NC} $2"
    FAILED_TESTS=$((FAILED_TESTS+1))
  fi
}

# 打印分隔线
print_separator() {
  echo "=========================================="
  echo "$1"
  echo "=========================================="
}

print_separator "开始系统管理功能测试"

# 1. 测试管理员登录
print_separator "1. 用户认证测试"

echo "测试管理员登录..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('token', ''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
  print_result 0 "管理员登录成功"
else
  print_result 1 "管理员登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

# 2. 用户管理测试
print_separator "2. 用户管理测试"

# 创建测试用户
echo "创建新用户..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "test_'$(date +%s)'",
    "password": "Test123456",
    "email": "test'$(date +%s)'@test.com",
    "realName": "测试用户",
    "phone": "13800138000",
    "organizationId": "org_default",
    "departmentId": "dept_admin"
  }')

USER_ID=$(echo "$CREATE_USER_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null)

if [ -n "$USER_ID" ]; then
  print_result 0 "创建用户成功 (ID: $USER_ID)"
else
  print_result 1 "创建用户失败"
  echo "响应: $CREATE_USER_RESPONSE"
fi

# 获取用户列表
echo "获取用户列表..."
USERS_LIST_RESPONSE=$(curl -s -X GET "$API_URL/users?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN")

USER_COUNT=$(echo "$USERS_LIST_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('data', {}).get('list', [])))" 2>/dev/null)

if [ "$USER_COUNT" -gt 0 ]; then
  print_result 0 "获取用户列表成功 (共 $USER_COUNT 个用户)"
else
  print_result 1 "获取用户列表失败"
fi

# 3. 组织管理测试
print_separator "3. 组织管理测试"

# 获取组织列表
echo "获取组织列表..."
ORGS_RESPONSE=$(curl -s -X GET "$API_URL/organizations" \
  -H "Authorization: Bearer $TOKEN")

ORG_CODE=$(echo "$ORGS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$ORG_CODE" = "200" ]; then
  print_result 0 "获取组织列表成功"
else
  print_result 1 "获取组织列表失败"
fi

# 4. 部门管理测试
print_separator "4. 部门管理测试"

# 获取部门列表
echo "获取部门列表..."
DEPTS_RESPONSE=$(curl -s -X GET "$API_URL/departments" \
  -H "Authorization: Bearer $TOKEN")

DEPT_CODE=$(echo "$DEPTS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$DEPT_CODE" = "200" ]; then
  print_result 0 "获取部门列表成功"
else
  print_result 1 "获取部门列表失败"
fi

# 5. 角色管理测试
print_separator "5. 角色管理测试"

# 获取角色列表
echo "获取角色列表..."
ROLES_RESPONSE=$(curl -s -X GET "$API_URL/roles" \
  -H "Authorization: Bearer $TOKEN")

ROLE_CODE=$(echo "$ROLES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$ROLE_CODE" = "200" ]; then
  print_result 0 "获取角色列表成功"
else
  print_result 1 "获取角色列表失败"
fi

# 6. 权限管理测试
print_separator "6. 权限管理测试"

# 获取权限列表
echo "获取权限列表..."
PERMS_RESPONSE=$(curl -s -X GET "$API_URL/permissions" \
  -H "Authorization: Bearer $TOKEN")

PERM_CODE=$(echo "$PERMS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$PERM_CODE" = "200" ]; then
  print_result 0 "获取权限列表成功"
else
  print_result 1 "获取权限列表失败"
fi

# 7. 菜单管理测试
print_separator "7. 菜单管理测试"

# 获取菜单列表
echo "获取菜单列表..."
MENUS_RESPONSE=$(curl -s -X GET "$API_URL/menus" \
  -H "Authorization: Bearer $TOKEN")

MENU_CODE=$(echo "$MENUS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$MENU_CODE" = "200" ]; then
  print_result 0 "获取菜单列表成功"
else
  print_result 1 "获取菜单列表失败"
fi

# 8. 项目管理测试
print_separator "8. 项目管理测试"

# 获取项目列表
echo "获取项目列表..."
PROJECTS_RESPONSE=$(curl -s -X GET "$API_URL/projects" \
  -H "Authorization: Bearer $TOKEN")

PROJECT_CODE=$(echo "$PROJECTS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('code', 0))" 2>/dev/null)

if [ "$PROJECT_CODE" = "200" ]; then
  print_result 0 "获取项目列表成功"
else
  print_result 1 "获取项目列表失败"
fi

# 测试总结
print_separator "测试总结"
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}有 $FAILED_TESTS 个测试失败${NC}"
  exit 1
fi
