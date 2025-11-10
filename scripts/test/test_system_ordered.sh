#!/bin/bash

# 系统管理功能按顺序测试脚本
# 测试顺序：组织 → 部门 → 用户（支持多部门） → 角色 → 权限 → 菜单

# API基础URL
BASE_URL="http://localhost:3000/api"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_api() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "测试: $test_name"
    echo "方法: $method"
    echo "端点: $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ 测试通过${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # 提取并保存ID
        if [[ "$body" =~ \"id\":\"([^\"]+)\" ]]; then
            extracted_id="${BASH_REMATCH[1]}"
            echo "提取的ID: $extracted_id"
            
            # 根据测试名称保存ID
            if [[ "$test_name" == *"组织"* ]] && [[ "$test_name" == *"创建"* ]]; then
                ORG_ID=$extracted_id
            elif [[ "$test_name" == *"部门"* ]] && [[ "$test_name" == *"创建"* ]]; then
                if [ -z "$DEPT_ID" ]; then
                    DEPT_ID=$extracted_id
                else
                    DEPT_ID2=$extracted_id
                fi
            elif [[ "$test_name" == *"用户"* ]] && [[ "$test_name" == *"创建"* ]]; then
                USER_ID=$extracted_id
            elif [[ "$test_name" == *"角色"* ]] && [[ "$test_name" == *"创建"* ]]; then
                ROLE_ID=$extracted_id
            elif [[ "$test_name" == *"权限"* ]] && [[ "$test_name" == *"创建"* ]]; then
                PERM_ID=$extracted_id
            elif [[ "$test_name" == *"菜单"* ]] && [[ "$test_name" == *"创建"* ]]; then
                MENU_ID=$extracted_id
            fi
        fi
    else
        echo -e "${RED}✗ 测试失败${NC} (期望: $expected_status, 实际: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "响应内容: $body"
    fi
    
    echo
}

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║               系统管理功能端到端测试 (按正确顺序)                   ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo

# 步骤0: 用户登录获取TOKEN
echo -e "${YELLOW}步骤0: 用户登录${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

login_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "username": "admin",
        "password": "admin123"
    }' \
    "$BASE_URL/auth/login")

if [[ "$login_response" =~ \"token\":\"([^\"]+)\" ]]; then
    TOKEN="${BASH_REMATCH[1]}"
    echo -e "${GREEN}✓ 登录成功${NC}"
    echo "Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}✗ 登录失败${NC}"
    echo "$login_response"
    exit 1
fi

echo

# 步骤1: 测试组织管理
echo -e "${YELLOW}步骤1: 测试组织管理${NC}"

test_api "获取组织列表" "GET" "/organizations" "" "200"

test_api "创建组织" "POST" "/organizations" '{
    "name": "测试设计院",
    "code": "TEST001",
    "type": "design_institute",
    "address": "北京市朝阳区",
    "contact": "张三",
    "phone": "13800138000",
    "email": "test@design.com",
    "description": "测试用设计院"
}' "201"

if [ ! -z "$ORG_ID" ]; then
    test_api "获取组织详情" "GET" "/organizations/$ORG_ID" "" "200"
    
    test_api "更新组织" "PUT" "/organizations/$ORG_ID" '{
        "name": "测试设计院(更新)",
        "description": "更新后的描述"
    }' "200"
fi

# 步骤2: 测试部门管理
echo -e "${YELLOW}步骤2: 测试部门管理${NC}"

test_api "获取部门列表" "GET" "/departments" "" "200"

test_api "创建主部门" "POST" "/departments" '{
    "name": "建筑设计部",
    "code": "ARCH001",
    "organizationId": "'"$ORG_ID"'",
    "parentId": null,
    "manager": "李四",
    "description": "主要负责建筑设计"
}' "201"

test_api "创建兼职部门" "POST" "/departments" '{
    "name": "BIM中心",
    "code": "BIM001",
    "organizationId": "'"$ORG_ID"'",
    "parentId": null,
    "manager": "王五",
    "description": "BIM技术支持中心"
}' "201"

if [ ! -z "$DEPT_ID" ]; then
    test_api "获取部门详情" "GET" "/departments/$DEPT_ID" "" "200"
    
    test_api "更新部门" "PUT" "/departments/$DEPT_ID" '{
        "name": "建筑设计一部",
        "description": "更新后的建筑设计部"
    }' "200"
fi

# 步骤3: 测试用户管理（支持多部门）
echo -e "${YELLOW}步骤3: 测试用户管理（支持多部门）${NC}"

test_api "获取用户列表" "GET" "/users" "" "200"

test_api "创建用户（带多部门）" "POST" "/users" '{
    "username": "zhangsan",
    "password": "Pass123456",
    "email": "zhangsan@test.com",
    "realName": "张三",
    "phone": "13900139000",
    "departmentId": "'"$DEPT_ID"'",
    "secondaryDepartments": ["'"$DEPT_ID2"'"],
    "position": "高级建筑师",
    "status": "active"
}' "201"

if [ ! -z "$USER_ID" ]; then
    test_api "获取用户详情" "GET" "/users/$USER_ID" "" "200"
    
    test_api "更新用户信息" "PUT" "/users/$USER_ID" '{
        "realName": "张三(更新)",
        "phone": "13900139001",
        "secondaryDepartments": ["'"$DEPT_ID2"'"]
    }' "200"
    
    test_api "重置用户密码" "POST" "/users/$USER_ID/reset-password" '{
        "newPassword": "NewPass123456"
    }' "200"
fi

# 步骤4: 测试角色管理
echo -e "${YELLOW}步骤4: 测试角色管理${NC}"

test_api "获取角色列表" "GET" "/roles" "" "200"

test_api "创建角色" "POST" "/roles" '{
    "name": "项目经理",
    "description": "负责项目管理的角色",
    "permissions": ["project.view", "project.create", "project.update", "user.view"]
}' "201"

if [ ! -z "$ROLE_ID" ]; then
    test_api "获取角色详情" "GET" "/roles/$ROLE_ID" "" "200"
    
    test_api "更新角色" "PUT" "/roles/$ROLE_ID" '{
        "name": "高级项目经理",
        "description": "更新后的项目经理角色",
        "permissions": ["project.view", "project.create", "project.update", "project.delete", "user.view", "user.create"]
    }' "200"
    
    # 为用户分配角色
    if [ ! -z "$USER_ID" ]; then
        test_api "为用户分配角色" "POST" "/users/$USER_ID/roles" '{
            "roleIds": ["'"$ROLE_ID"'"]
        }' "200"
    fi
fi

# 步骤5: 测试权限管理
echo -e "${YELLOW}步骤5: 测试权限管理${NC}"

test_api "获取权限列表" "GET" "/permissions" "" "200"

test_api "获取系统权限组" "GET" "/permissions/groups" "" "200"

test_api "创建权限" "POST" "/permissions" '{
    "code": "custom.test",
    "name": "自定义测试权限",
    "category": "自定义",
    "description": "测试用自定义权限"
}' "201"

if [ ! -z "$PERM_ID" ]; then
    test_api "获取权限详情" "GET" "/permissions/$PERM_ID" "" "200"
    
    test_api "更新权限" "PUT" "/permissions/$PERM_ID" '{
        "name": "自定义测试权限(更新)",
        "description": "更新后的权限描述"
    }' "200"
fi

# 步骤6: 测试菜单管理
echo -e "${YELLOW}步骤6: 测试菜单管理${NC}"

test_api "获取菜单列表" "GET" "/menus" "" "200"

test_api "创建菜单" "POST" "/menus" '{
    "name": "测试菜单",
    "path": "/test",
    "component": "TestComponent",
    "icon": "test-icon",
    "parentId": null,
    "sortOrder": 100,
    "visible": true,
    "permissions": ["custom.test"]
}' "201"

if [ ! -z "$MENU_ID" ]; then
    test_api "获取菜单详情" "GET" "/menus/$MENU_ID" "" "200"
    
    test_api "更新菜单" "PUT" "/menus/$MENU_ID" '{
        "name": "测试菜单(更新)",
        "sortOrder": 101
    }' "200"
    
    # 测试菜单权限关联
    if [ ! -z "$ROLE_ID" ]; then
        test_api "为角色分配菜单权限" "POST" "/roles/$ROLE_ID/menus" '{
            "menuIds": ["'"$MENU_ID"'"]
        }' "200"
    fi
fi

# 步骤7: 测试项目管理
echo -e "${YELLOW}步骤7: 测试项目管理${NC}"

test_api "获取项目列表" "GET" "/projects" "" "200"

test_api "创建项目" "POST" "/projects" '{
    "name": "测试建筑项目",
    "code": "PROJ001",
    "type": "commercial",
    "status": "planning",
    "managerId": "'"$USER_ID"'",
    "departmentId": "'"$DEPT_ID"'",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "budget": 1000000,
    "description": "测试用建筑项目"
}' "201"

# 步骤8: 清理测试数据（可选）
echo -e "${YELLOW}步骤8: 清理测试数据${NC}"

if [ ! -z "$MENU_ID" ]; then
    test_api "删除菜单" "DELETE" "/menus/$MENU_ID" "" "200"
fi

if [ ! -z "$PERM_ID" ]; then
    test_api "删除权限" "DELETE" "/permissions/$PERM_ID" "" "200"
fi

if [ ! -z "$USER_ID" ]; then
    test_api "删除用户" "DELETE" "/users/$USER_ID" "" "200"
fi

if [ ! -z "$ROLE_ID" ]; then
    test_api "删除角色" "DELETE" "/roles/$ROLE_ID" "" "200"
fi

if [ ! -z "$DEPT_ID2" ]; then
    test_api "删除兼职部门" "DELETE" "/departments/$DEPT_ID2" "" "200"
fi

if [ ! -z "$DEPT_ID" ]; then
    test_api "删除主部门" "DELETE" "/departments/$DEPT_ID" "" "200"
fi

if [ ! -z "$ORG_ID" ]; then
    test_api "删除组织" "DELETE" "/organizations/$ORG_ID" "" "200"
fi

# 输出测试报告
echo
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                           测试报告                                 ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo
    echo -e "${RED}❌ 有测试失败，请检查错误日志${NC}"
    exit 1
fi