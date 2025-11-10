#!/bin/bash

# 完整的CRUD和关联关系测试脚本
# 测试所有增删查改操作和模块之间的依赖关系

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API基础URL
BASE_URL="http://localhost:3000/api"

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果数组
declare -a TEST_RESULTS

# 创建的资源ID记录（用于清理）
declare -a CREATED_ORGS
declare -a CREATED_DEPTS
declare -a CREATED_USERS
declare -a CREATED_ROLES
declare -a CREATED_PROJECTS
declare -a CREATED_MENUS
declare -a CREATED_PERMISSIONS

# 测试函数
test_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_code=${5:-200}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "  $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" == "$expected_code" ]] || [[ "$http_code" -ge 200 && "$http_code" -lt 300 && "$expected_code" == "200" ]]; then
        echo -e "${GREEN}✓${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ $description")
        
        # 返回响应体供后续使用
        echo "$body" > /tmp/last_response.json
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $http_code, 期望 $expected_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ $description (HTTP $http_code)")
        echo "    响应: $body" | head -1
        return 1
    fi
}

# 提取ID的函数
get_id_from_response() {
    cat /tmp/last_response.json | jq -r '.data.id // .data[0].id // ""'
}

echo "========================================"
echo "   设计院平台完整CRUD和关联测试"
echo "========================================"
echo ""

# 1. 登录获取Token
echo -e "${BLUE}步骤 1: 用户认证${NC}"
echo "----------------------------------------"
response=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $response | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} 登录成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${RED}✗${NC} 登录失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo "无法获取认证Token，测试终止"
    exit 1
fi

echo ""

# 2. 组织管理完整CRUD
echo -e "${BLUE}步骤 2: 组织管理 (完整CRUD)${NC}"
echo "----------------------------------------"

# 创建组织
ORG_NAME="测试组织$(date +%s)"
ORG_CODE="ORG$(date +%s)"
test_api "POST" "/organizations" '{
    "name": "'$ORG_NAME'",
    "code": "'$ORG_CODE'",
    "type": "company",
    "status": "active"
}' "创建组织" 201

if [ $? -eq 0 ]; then
    ORG_ID=$(get_id_from_response)
    CREATED_ORGS+=($ORG_ID)
    echo "    创建的组织ID: $ORG_ID"
    
    # 查询组织
    test_api "GET" "/organizations/$ORG_ID" "" "查询组织详情"
    
    # 更新组织
    test_api "PUT" "/organizations/$ORG_ID" '{
        "name": "'$ORG_NAME'(已更新)",
        "status": "active"
    }' "更新组织"
    
    # 查询组织列表
    test_api "GET" "/organizations" "" "查询组织列表"
fi

echo ""

# 3. 部门管理（依赖组织）
echo -e "${BLUE}步骤 3: 部门管理 (依赖组织)${NC}"
echo "----------------------------------------"

# 使用已存在的组织创建部门
DEPT_NAME="测试部门$(date +%s)"
DEPT_CODE="DEPT$(date +%s)"
test_api "POST" "/departments" '{
    "name": "'$DEPT_NAME'",
    "code": "'$DEPT_CODE'",
    "organizationId": "'${CREATED_ORGS[0]:-org_1756593678682}'",
    "description": "测试部门描述"
}' "创建部门" 201

if [ $? -eq 0 ]; then
    DEPT_ID=$(get_id_from_response)
    CREATED_DEPTS+=($DEPT_ID)
    echo "    创建的部门ID: $DEPT_ID"
    
    # 查询部门
    test_api "GET" "/departments/$DEPT_ID" "" "查询部门详情"
    
    # 更新部门
    test_api "PUT" "/departments/$DEPT_ID" '{
        "name": "'$DEPT_NAME'(已更新)",
        "description": "更新后的描述"
    }' "更新部门"
    
    # 查询部门列表
    test_api "GET" "/departments" "" "查询部门列表"
fi

# 创建第二个部门（用于测试多部门用户）
DEPT2_NAME="测试部门2_$(date +%s)"
DEPT2_CODE="DEPT2_$(date +%s)"
test_api "POST" "/departments" '{
    "name": "'$DEPT2_NAME'",
    "code": "'$DEPT2_CODE'",
    "organizationId": "'${CREATED_ORGS[0]:-org_1756593678682}'"
}' "创建第二个部门"

if [ $? -eq 0 ]; then
    DEPT2_ID=$(get_id_from_response)
    CREATED_DEPTS+=($DEPT2_ID)
fi

echo ""

# 4. 角色管理
echo -e "${BLUE}步骤 4: 角色管理 (完整CRUD)${NC}"
echo "----------------------------------------"

ROLE_NAME="测试角色$(date +%s)"
ROLE_CODE="ROLE$(date +%s)"
test_api "POST" "/roles" '{
    "code": "'$ROLE_CODE'",
    "name": "'$ROLE_NAME'",
    "description": "测试角色描述",
    "permissions": ["user.view", "user.create", "project.view"]
}' "创建角色" 201

if [ $? -eq 0 ]; then
    ROLE_ID=$(get_id_from_response)
    CREATED_ROLES+=($ROLE_ID)
    echo "    创建的角色ID: $ROLE_ID"
    
    # 查询角色
    test_api "GET" "/roles/$ROLE_ID" "" "查询角色详情"
    
    # 更新角色
    test_api "PUT" "/roles/$ROLE_ID" '{
        "name": "'$ROLE_NAME'(已更新)",
        "permissions": ["user.view", "user.create", "user.update", "project.view", "project.create"]
    }' "更新角色"
    
    # 查询角色列表
    test_api "GET" "/roles" "" "查询角色列表"
fi

echo ""

# 5. 用户管理（依赖部门和角色）
echo -e "${BLUE}步骤 5: 用户管理 (依赖部门和角色)${NC}"
echo "----------------------------------------"

USER_NAME="testuser$(date +%s)"
test_api "POST" "/users" '{
    "username": "'$USER_NAME'",
    "password": "Test123456",
    "realName": "测试用户",
    "email": "'$USER_NAME'@test.com",
    "phone": "13800138000",
    "departmentId": "'${CREATED_DEPTS[0]}'",
    "departmentIds": ["'${CREATED_DEPTS[0]}'", "'${CREATED_DEPTS[1]}'"],
    "roleId": "'${CREATED_ROLES[0]}'"
}' "创建用户(多部门)" 201

if [ $? -eq 0 ]; then
    USER_ID=$(get_id_from_response)
    CREATED_USERS+=($USER_ID)
    echo "    创建的用户ID: $USER_ID"
    
    # 查询用户
    test_api "GET" "/users/$USER_ID" "" "查询用户详情"
    
    # 更新用户
    test_api "PUT" "/users/$USER_ID" '{
        "realName": "测试用户(已更新)",
        "phone": "13900139000"
    }' "更新用户"
    
    # 查询用户列表
    test_api "GET" "/users" "" "查询用户列表"
fi

echo ""

# 6. 项目管理（依赖部门和用户）
echo -e "${BLUE}步骤 6: 项目管理 (依赖部门和用户)${NC}"
echo "----------------------------------------"

PROJ_NAME="测试项目$(date +%s)"
PROJ_CODE="PROJ$(date +%s)"
test_api "POST" "/projects" '{
    "name": "'$PROJ_NAME'",
    "code": "'$PROJ_CODE'",
    "type": "design",
    "status": "planning",
    "department_id": "'${CREATED_DEPTS[0]}'",
    "manager_id": "'${CREATED_USERS[0]:-user_admin}'",
    "budget": 5000000,
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "description": "测试项目描述"
}' "创建项目" 201

if [ $? -eq 0 ]; then
    PROJ_ID=$(get_id_from_response)
    CREATED_PROJECTS+=($PROJ_ID)
    echo "    创建的项目ID: $PROJ_ID"
    
    # 查询项目
    test_api "GET" "/projects/$PROJ_ID" "" "查询项目详情"
    
    # 更新项目
    test_api "PUT" "/projects/$PROJ_ID" '{
        "name": "'$PROJ_NAME'(已更新)",
        "status": "in_progress",
        "budget": 6000000
    }' "更新项目"
    
    # 查询项目列表
    test_api "GET" "/projects" "" "查询项目列表"
fi

echo ""

# 7. 菜单管理
echo -e "${BLUE}步骤 7: 菜单管理 (完整CRUD)${NC}"
echo "----------------------------------------"

MENU_NAME="测试菜单$(date +%s)"
test_api "POST" "/menus" '{
    "name": "'$MENU_NAME'",
    "icon": "test-icon",
    "url": "/test-menu",
    "type": "page",
    "sort_order": 99,
    "visible": true
}' "创建菜单" 201

if [ $? -eq 0 ]; then
    MENU_ID=$(get_id_from_response)
    CREATED_MENUS+=($MENU_ID)
    echo "    创建的菜单ID: $MENU_ID"
    
    # 创建子菜单
    test_api "POST" "/menus" '{
        "name": "'$MENU_NAME'-子菜单",
        "parent_id": "'$MENU_ID'",
        "url": "/test-menu/sub",
        "type": "page",
        "visible": true
    }' "创建子菜单"
    
    if [ $? -eq 0 ]; then
        SUB_MENU_ID=$(get_id_from_response)
        CREATED_MENUS+=($SUB_MENU_ID)
    fi
    
    # 查询菜单列表
    test_api "GET" "/menus" "" "查询菜单列表"
    
    # 更新菜单
    test_api "PUT" "/menus/$MENU_ID" '{
        "name": "'$MENU_NAME'(已更新)",
        "icon": "updated-icon"
    }' "更新菜单"
fi

echo ""

# 8. 权限管理
echo -e "${BLUE}步骤 8: 权限管理 (完整CRUD)${NC}"
echo "----------------------------------------"

PERM_NAME="测试权限$(date +%s)"
PERM_CODE="test.permission.$(date +%s)"
test_api "POST" "/permissions" '{
    "name": "'$PERM_NAME'",
    "code": "'$PERM_CODE'",
    "resource": "test_resource",
    "action": "test_action",
    "type": "api",
    "description": "测试权限描述"
}' "创建权限" 201

if [ $? -eq 0 ]; then
    PERM_ID=$(get_id_from_response)
    CREATED_PERMISSIONS+=($PERM_ID)
    echo "    创建的权限ID: $PERM_ID"
    
    # 查询权限列表
    test_api "GET" "/permissions/list" "" "查询权限列表"
fi

echo ""

# 9. 测试关联关系和依赖
echo -e "${BLUE}步骤 9: 测试关联关系和依赖${NC}"
echo "----------------------------------------"

# 测试删除有依赖的组织（应该失败）
if [ ${#CREATED_DEPTS[@]} -gt 0 ]; then
    test_api "DELETE" "/organizations/${CREATED_ORGS[0]}" "" "删除有部门的组织(应失败)" 400
fi

# 测试删除有依赖的部门（应该失败）
if [ ${#CREATED_USERS[@]} -gt 0 ]; then
    test_api "DELETE" "/departments/${CREATED_DEPTS[0]}" "" "删除有用户的部门(应失败)" 400
fi

# 测试删除有依赖的角色（应该失败）
if [ ${#CREATED_USERS[@]} -gt 0 ] && [ ${#CREATED_ROLES[@]} -gt 0 ]; then
    test_api "DELETE" "/roles/${CREATED_ROLES[0]}" "" "删除有用户的角色(应失败)" 400
fi

echo ""

# 10. 清理测试数据（按依赖顺序删除）
echo -e "${BLUE}步骤 10: 清理测试数据 (按依赖顺序)${NC}"
echo "----------------------------------------"

# 删除子菜单
if [ -n "$SUB_MENU_ID" ]; then
    test_api "DELETE" "/menus/$SUB_MENU_ID" "" "删除子菜单"
fi

# 删除菜单
for menu_id in "${CREATED_MENUS[@]}"; do
    test_api "DELETE" "/menus/$menu_id" "" "删除菜单 $menu_id"
done

# 删除权限
for perm_id in "${CREATED_PERMISSIONS[@]}"; do
    test_api "DELETE" "/permissions/$perm_id" "" "删除权限 $perm_id"
done

# 删除项目
for proj_id in "${CREATED_PROJECTS[@]}"; do
    test_api "DELETE" "/projects/$proj_id" "" "删除项目 $proj_id"
done

# 删除用户
for user_id in "${CREATED_USERS[@]}"; do
    test_api "DELETE" "/users/$user_id" "" "删除用户 $user_id"
done

# 删除角色
for role_id in "${CREATED_ROLES[@]}"; do
    test_api "DELETE" "/roles/$role_id" "" "删除角色 $role_id"
done

# 删除部门
for dept_id in "${CREATED_DEPTS[@]}"; do
    test_api "DELETE" "/departments/$dept_id" "" "删除部门 $dept_id"
done

# 删除组织
for org_id in "${CREATED_ORGS[@]}"; do
    test_api "DELETE" "/organizations/$org_id" "" "删除组织 $org_id"
done

echo ""
echo "========================================"
echo "         测试结果汇总"
echo "========================================"
echo ""

# 输出测试统计
echo "测试统计："
echo "----------------------------------------"
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"

# 计算通过率
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo "通过率: $PASS_RATE%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}✨ 完美！所有测试通过！${NC}"
        echo -e "${GREEN}✨ 所有CRUD操作正常！${NC}"
        echo -e "${GREEN}✨ 所有关联关系正确！${NC}"
    else
        echo -e "\n${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败${NC}"
    fi
else
    echo "没有执行任何测试"
fi

echo ""
echo "测试完成时间: $(date)"
echo "========================================"

# 生成详细的JSON测试报告
cat > complete_test_report.json << EOF
{
  "test_time": "$(date -Iseconds)",
  "test_type": "完整CRUD和关联测试",
  "statistics": {
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "pass_rate": "$PASS_RATE%"
  },
  "tested_modules": [
    "组织管理(CRUD)",
    "部门管理(CRUD+依赖)",
    "角色管理(CRUD)",
    "用户管理(CRUD+多部门)",
    "项目管理(CRUD+依赖)",
    "菜单管理(CRUD+层级)",
    "权限管理(CRUD)",
    "关联关系验证",
    "依赖删除测试"
  ],
  "test_results": [
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
echo "详细测试报告已保存到: complete_test_report.json"

# 清理临时文件
rm -f /tmp/last_response.json

exit $FAILED_TESTS