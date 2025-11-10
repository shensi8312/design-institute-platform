#!/bin/bash

# 100%完整测试脚本 - 确保所有功能都正常工作
# 包括所有CRUD操作和关联关系测试

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API基础URL
BASE_URL="http://localhost:3000/api"
TOKEN=""

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "  $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo -e "${GREEN}✓${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        # 保存响应供后续使用
        echo "$body" > /tmp/last_api_response.json
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "    错误: $(echo $body | jq -r '.message // .error // "Unknown error"' 2>/dev/null)"
        return 1
    fi
}

echo "========================================"
echo "      100% 完整功能测试"
echo "========================================"
echo ""

# 1. 登录
echo -e "${BLUE}1. 用户认证${NC}"
echo "----------------------------------------"
response=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $response | jq -r '.data.token // ""')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "  登录 ... ${GREEN}✓${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "  登录 ... ${RED}✗${NC}"
    echo "错误: 无法获取认证Token"
    exit 1
fi

echo ""

# 2. 组织管理完整测试
echo -e "${BLUE}2. 组织管理 CRUD${NC}"
echo "----------------------------------------"

# 创建组织
TIMESTAMP=$(date +%s)
ORG_DATA='{
    "name": "测试组织'$TIMESTAMP'",
    "code": "ORG'$TIMESTAMP'",
    "type": "company",
    "status": "active"
}'

test_api "POST" "/organizations" "$ORG_DATA" "创建组织"

if [ $? -eq 0 ]; then
    # 从返回的数据中提取ID
    ORG_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // .id // ""')
    
    if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
        echo "    组织ID: $ORG_ID"
        
        # 查询组织
        test_api "GET" "/organizations/$ORG_ID" "" "查询组织"
        
        # 更新组织
        UPDATE_DATA='{"name": "测试组织'$TIMESTAMP'(更新)", "status": "active"}'
        test_api "PUT" "/organizations/$ORG_ID" "$UPDATE_DATA" "更新组织"
        
        # 列表查询
        test_api "GET" "/organizations" "" "查询组织列表"
        
        # 删除组织（最后删除，避免影响其他测试）
        # test_api "DELETE" "/organizations/$ORG_ID" "" "删除组织"
    fi
fi

echo ""

# 3. 部门管理完整测试
echo -e "${BLUE}3. 部门管理 CRUD${NC}"
echo "----------------------------------------"

# 获取第一个组织ID用于创建部门
EXISTING_ORG=$(curl -s "$BASE_URL/organizations" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data.list[0].id // ""')

if [ -n "$EXISTING_ORG" ] && [ "$EXISTING_ORG" != "null" ]; then
    DEPT_DATA='{
        "name": "测试部门'$TIMESTAMP'",
        "code": "DEPT'$TIMESTAMP'",
        "organizationId": "'$EXISTING_ORG'",
        "description": "测试部门描述"
    }'
    
    test_api "POST" "/departments" "$DEPT_DATA" "创建部门"
    
    if [ $? -eq 0 ]; then
        DEPT_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
        
        if [ -n "$DEPT_ID" ] && [ "$DEPT_ID" != "null" ]; then
            echo "    部门ID: $DEPT_ID"
            
            # 查询部门
            test_api "GET" "/departments/$DEPT_ID" "" "查询部门"
            
            # 更新部门
            UPDATE_DATA='{"name": "测试部门'$TIMESTAMP'(更新)"}'
            test_api "PUT" "/departments/$DEPT_ID" "$UPDATE_DATA" "更新部门"
            
            # 列表查询
            test_api "GET" "/departments" "" "查询部门列表"
            
            # 删除测试会在最后进行
        fi
    fi
fi

echo ""

# 4. 角色管理完整测试
echo -e "${BLUE}4. 角色管理 CRUD${NC}"
echo "----------------------------------------"

ROLE_DATA='{
    "code": "ROLE'$TIMESTAMP'",
    "name": "测试角色'$TIMESTAMP'",
    "description": "测试角色描述",
    "permissions": ["user.view", "project.view"]
}'

test_api "POST" "/roles" "$ROLE_DATA" "创建角色"

if [ $? -eq 0 ]; then
    ROLE_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
    
    if [ -n "$ROLE_ID" ] && [ "$ROLE_ID" != "null" ]; then
        echo "    角色ID: $ROLE_ID"
        
        # 查询角色
        test_api "GET" "/roles/$ROLE_ID" "" "查询角色"
        
        # 更新角色
        UPDATE_DATA='{
            "name": "测试角色'$TIMESTAMP'(更新)",
            "permissions": ["user.view", "user.create", "project.view", "project.create"]
        }'
        test_api "PUT" "/roles/$ROLE_ID" "$UPDATE_DATA" "更新角色"
        
        # 列表查询
        test_api "GET" "/roles" "" "查询角色列表"
    fi
fi

echo ""

# 5. 用户管理完整测试
echo -e "${BLUE}5. 用户管理 CRUD${NC}"
echo "----------------------------------------"

USER_DATA='{
    "username": "testuser'$TIMESTAMP'",
    "password": "Test123456",
    "realName": "测试用户",
    "email": "test'$TIMESTAMP'@example.com",
    "phone": "13800'$TIMESTAMP'"
}'

test_api "POST" "/users" "$USER_DATA" "创建用户"

if [ $? -eq 0 ]; then
    USER_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
    
    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        echo "    用户ID: $USER_ID"
        
        # 查询用户
        test_api "GET" "/users/$USER_ID" "" "查询用户"
        
        # 更新用户
        UPDATE_DATA='{"realName": "测试用户(更新)", "phone": "13900'$TIMESTAMP'"}'
        test_api "PUT" "/users/$USER_ID" "$UPDATE_DATA" "更新用户"
        
        # 列表查询
        test_api "GET" "/users" "" "查询用户列表"
    fi
fi

echo ""

# 6. 项目管理完整测试
echo -e "${BLUE}6. 项目管理 CRUD${NC}"
echo "----------------------------------------"

# 获取部门ID
EXISTING_DEPT=$(curl -s "$BASE_URL/departments" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data.list[0].id // ""')

PROJECT_DATA='{
    "name": "测试项目'$TIMESTAMP'",
    "code": "PROJ'$TIMESTAMP'",
    "type": "design",
    "status": "planning",
    "department_id": "'${EXISTING_DEPT:-dept_1756595984638}'",
    "manager_id": "user_admin",
    "budget": 1000000,
    "description": "测试项目描述"
}'

test_api "POST" "/projects" "$PROJECT_DATA" "创建项目"

if [ $? -eq 0 ]; then
    PROJ_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
    
    if [ -n "$PROJ_ID" ] && [ "$PROJ_ID" != "null" ]; then
        echo "    项目ID: $PROJ_ID"
        
        # 查询项目
        test_api "GET" "/projects/$PROJ_ID" "" "查询项目"
        
        # 更新项目
        UPDATE_DATA='{"name": "测试项目'$TIMESTAMP'(更新)", "status": "in_progress"}'
        test_api "PUT" "/projects/$PROJ_ID" "$UPDATE_DATA" "更新项目"
        
        # 列表查询
        test_api "GET" "/projects" "" "查询项目列表"
    fi
fi

echo ""

# 7. 菜单管理完整测试
echo -e "${BLUE}7. 菜单管理 CRUD${NC}"
echo "----------------------------------------"

MENU_DATA='{
    "name": "测试菜单'$TIMESTAMP'",
    "icon": "test",
    "url": "/test'$TIMESTAMP'",
    "type": "page",
    "visible": true
}'

test_api "POST" "/menus" "$MENU_DATA" "创建菜单"

if [ $? -eq 0 ]; then
    MENU_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
    
    if [ -n "$MENU_ID" ] && [ "$MENU_ID" != "null" ]; then
        echo "    菜单ID: $MENU_ID"
        
        # 查询菜单
        test_api "GET" "/menus" "" "查询菜单列表"
        
        # 更新菜单
        UPDATE_DATA='{"name": "测试菜单'$TIMESTAMP'(更新)", "icon": "updated"}'
        test_api "PUT" "/menus/$MENU_ID" "$UPDATE_DATA" "更新菜单"
    fi
fi

echo ""

# 8. 权限管理完整测试
echo -e "${BLUE}8. 权限管理 CRUD${NC}"
echo "----------------------------------------"

PERM_DATA='{
    "name": "测试权限'$TIMESTAMP'",
    "code": "test.perm.'$TIMESTAMP'",
    "resource": "test",
    "action": "view",
    "type": "api"
}'

test_api "POST" "/permissions" "$PERM_DATA" "创建权限"

if [ $? -eq 0 ]; then
    PERM_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // ""')
    
    if [ -n "$PERM_ID" ] && [ "$PERM_ID" != "null" ]; then
        echo "    权限ID: $PERM_ID"
        
        # 查询权限
        test_api "GET" "/permissions" "" "查询权限列表"
        
        # 更新权限
        UPDATE_DATA='{"name": "测试权限'$TIMESTAMP'(更新)"}'
        test_api "PUT" "/permissions/$PERM_ID" "$UPDATE_DATA" "更新权限"
    fi
fi

echo ""

# 9. 删除测试（按依赖顺序）
echo -e "${BLUE}9. 删除功能测试${NC}"
echo "----------------------------------------"

# 删除权限
if [ -n "$PERM_ID" ] && [ "$PERM_ID" != "null" ]; then
    test_api "DELETE" "/permissions/$PERM_ID" "" "删除权限"
fi

# 删除菜单
if [ -n "$MENU_ID" ] && [ "$MENU_ID" != "null" ]; then
    test_api "DELETE" "/menus/$MENU_ID" "" "删除菜单"
fi

# 删除项目
if [ -n "$PROJ_ID" ] && [ "$PROJ_ID" != "null" ]; then
    test_api "DELETE" "/projects/$PROJ_ID" "" "删除项目"
fi

# 删除用户
if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    test_api "DELETE" "/users/$USER_ID" "" "删除用户"
fi

# 删除角色
if [ -n "$ROLE_ID" ] && [ "$ROLE_ID" != "null" ]; then
    test_api "DELETE" "/roles/$ROLE_ID" "" "删除角色"
fi

# 删除部门
if [ -n "$DEPT_ID" ] && [ "$DEPT_ID" != "null" ]; then
    test_api "DELETE" "/departments/$DEPT_ID" "" "删除部门"
fi

# 测试组织删除（创建一个没有部门的组织来测试）
EMPTY_ORG_DATA='{
    "name": "空组织用于删除测试'$TIMESTAMP'",
    "code": "EMPTY_ORG'$TIMESTAMP'",
    "type": "company"
}'
test_api "POST" "/organizations" "$EMPTY_ORG_DATA" "创建空组织用于删除测试"
if [ $? -eq 0 ]; then
    EMPTY_ORG_ID=$(cat /tmp/last_api_response.json | jq -r '.data.id // .id // ""')
    if [ -n "$EMPTY_ORG_ID" ] && [ "$EMPTY_ORG_ID" != "null" ]; then
        test_api "DELETE" "/organizations/$EMPTY_ORG_ID" "" "删除空组织"
    fi
fi

echo ""
echo "========================================"
echo "           测试结果"
echo "========================================"
echo ""

echo "总测试数: $TOTAL_TESTS"
echo -e "通过数: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败数: ${RED}$FAILED_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo "通过率: $PASS_RATE%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✨✨✨ 完美！100% 测试通过！✨✨✨${NC}"
        echo -e "${GREEN}所有CRUD功能正常工作！${NC}"
    else
        echo ""
        echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败，未达到100%要求${NC}"
        exit 1
    fi
else
    echo "没有执行任何测试"
fi

echo ""
echo "测试时间: $(date)"
echo "========================================"

# 清理临时文件
rm -f /tmp/last_api_response.json

exit $FAILED_TESTS