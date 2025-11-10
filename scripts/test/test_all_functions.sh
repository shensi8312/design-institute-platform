#!/bin/bash

# 完整的系统功能测试脚本
# 测试所有基础管理功能

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API基础URL
BASE_URL="http://localhost:3000/api"

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果数组
declare -a TEST_RESULTS

# 测试函数
test_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "测试 $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo -e "${GREEN}✓${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ $description")
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ $description (HTTP $http_code)")
        echo "  响应: $body"
        return 1
    fi
}

echo "========================================"
echo "    设计院平台基础功能测试"
echo "========================================"
echo ""

# 1. 登录获取Token
echo "1. 用户认证"
echo "----------------------------------------"
response=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $response | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} 登录成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    TEST_RESULTS+=("✓ 用户登录")
else
    echo -e "${RED}✗${NC} 登录失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    TEST_RESULTS+=("✗ 用户登录")
    echo "无法获取认证Token，测试终止"
    exit 1
fi

echo ""

# 2. 组织管理测试
echo "2. 组织管理"
echo "----------------------------------------"
test_api "GET" "/organizations" "" "获取组织列表"

ORG_ID="org_test_$(date +%s)"
test_api "POST" "/organizations" '{
    "id": "'$ORG_ID'",
    "name": "测试组织'$(date +%s)'",
    "code": "TEST'$(date +%s)'",
    "type": "company"
}' "创建组织"

if [ $? -eq 0 ]; then
    test_api "PUT" "/organizations/$ORG_ID" '{"name": "更新的测试组织"}' "更新组织"
    test_api "DELETE" "/organizations/$ORG_ID" "" "删除组织"
fi

echo ""

# 3. 部门管理测试
echo "3. 部门管理"
echo "----------------------------------------"
test_api "GET" "/departments" "" "获取部门列表"

DEPT_ID="dept_test_$(date +%s)"
test_api "POST" "/departments" '{
    "name": "测试部门'$(date +%s)'",
    "code": "DEPT'$(date +%s)'",
    "organizationId": "org_1756593678682"
}' "创建部门"

echo ""

# 4. 角色管理测试
echo "4. 角色管理"
echo "----------------------------------------"
test_api "GET" "/roles" "" "获取角色列表"

ROLE_CODE="ROLE_$(date +%s)"
test_api "POST" "/roles" '{
    "code": "'$ROLE_CODE'",
    "name": "测试角色'$(date +%s)'",
    "description": "测试角色描述",
    "permissions": ["test.view", "test.create"]
}' "创建角色"

echo ""

# 5. 用户管理测试
echo "5. 用户管理"
echo "----------------------------------------"
test_api "GET" "/users" "" "获取用户列表"

USER_NAME="testuser$(date +%s)"
test_api "POST" "/users" '{
    "username": "'$USER_NAME'",
    "password": "Test123456",
    "realName": "测试用户",
    "email": "'$USER_NAME'@test.com"
}' "创建用户"

echo ""

# 6. 菜单管理测试
echo "6. 菜单管理"
echo "----------------------------------------"
test_api "GET" "/menus" "" "获取菜单列表"

test_api "POST" "/menus" '{
    "name": "测试菜单'$(date +%s)'",
    "icon": "test",
    "url": "/test'$(date +%s)'",
    "type": "page",
    "visible": true
}' "创建菜单"

echo ""

# 7. 项目管理测试
echo "7. 项目管理"
echo "----------------------------------------"
test_api "GET" "/projects" "" "获取项目列表"

PROJ_CODE="PROJ$(date +%s)"
test_api "POST" "/projects" '{
    "name": "测试项目'$(date +%s)'",
    "code": "'$PROJ_CODE'",
    "type": "design",
    "status": "planning",
    "department_id": "dept_1756595984638",
    "manager_id": "user_admin",
    "budget": 1000000
}' "创建项目"

echo ""

# 8. 权限管理测试
echo "8. 权限管理"
echo "----------------------------------------"
test_api "GET" "/permissions/list" "" "获取权限列表"

test_api "POST" "/permissions" '{
    "name": "测试权限'$(date +%s)'",
    "code": "test.permission.'$(date +%s)'",
    "resource": "test",
    "action": "view",
    "type": "api"
}' "创建权限"

echo ""
echo "========================================"
echo "         测试结果汇总"
echo "========================================"
echo ""

# 输出详细结果
echo "详细结果："
for result in "${TEST_RESULTS[@]}"; do
    echo "  $result"
done

echo ""
echo "----------------------------------------"
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"

# 计算通过率
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo "通过率: $PASS_RATE%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}✨ 所有测试通过！${NC}"
    else
        echo -e "\n${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败${NC}"
    fi
else
    echo "没有执行任何测试"
fi

echo ""
echo "测试完成时间: $(date)"
echo "========================================"

# 输出JSON格式的测试报告
cat > test_report.json << EOF
{
  "test_time": "$(date -Iseconds)",
  "total_tests": $TOTAL_TESTS,
  "passed_tests": $PASSED_TESTS,
  "failed_tests": $FAILED_TESTS,
  "pass_rate": "$PASS_RATE%",
  "results": [
$(for i in "${!TEST_RESULTS[@]}"; do
    if [[ $i -eq $((${#TEST_RESULTS[@]} - 1)) ]]; then
        echo "    \"${TEST_RESULTS[$i]}\""
    else
        echo "    \"${TEST_RESULTS[$i]}\","
    fi
done)
  ]
}
EOF

echo ""
echo "测试报告已保存到: test_report.json"

exit $FAILED_TESTS