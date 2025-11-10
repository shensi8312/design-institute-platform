#!/bin/bash

echo "🔍 平台基础功能测试"
echo "============================================================"

# 1. 登录获取token
echo -e "\n1️⃣ 认证测试"
LOGIN_RESPONSE=$(curl -s -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "   ❌ 登录失败"
  exit 1
else
  echo "   ✅ 登录成功"
fi

# 2. 测试各模块
echo -e "\n2️⃣ 核心模块API测试"

modules=(
  "组织:/organizations"
  "部门:/departments"
  "用户:/users"
  "角色:/roles"
  "权限:/permissions"
  "菜单:/menus"
  "项目:/projects"
  "知识库:/knowledge/bases"
)

pass_count=0
total=${#modules[@]}

for item in "${modules[@]}"; do
  name="${item%%:*}"
  path="${item##*:}"

  response=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api$path")

  if echo "$response" | grep -q '"success":true'; then
    count=$(echo "$response" | grep -o '"data":\[' | wc -l)
    echo "   ✅ $name: API正常"
    ((pass_count++))
  else
    echo "   ❌ $name: $(echo $response | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
  fi
done

# 3. 前端检查
echo -e "\n3️⃣ 前端服务"
if curl -s -m 2 http://localhost:5173 > /dev/null 2>&1; then
  echo "   ✅ 前端运行中 (端口: 5173)"
else
  echo "   ❌ 前端未运行"
fi

# 4. 数据库检查
echo -e "\n4️⃣ 数据库数据"
docker exec design-postgres psql -U postgres -d design_platform -t -c "
  SELECT
    '组织: ' || COUNT(*) FROM organizations UNION ALL
    SELECT '部门: ' || COUNT(*) FROM departments UNION ALL
    SELECT '用户: ' || COUNT(*) FROM users UNION ALL
    SELECT '角色: ' || COUNT(*) FROM roles UNION ALL
    SELECT '权限: ' || COUNT(*) FROM permissions UNION ALL
    SELECT '菜单: ' || COUNT(*) FROM menus UNION ALL
    SELECT '项目: ' || COUNT(*) FROM projects;
" | sed 's/^/   ✅ /'

# 5. 汇总
echo -e "\n============================================================"
echo -e "\n📊 测试结果: $pass_count/$total 模块通过"

if [ $pass_count -eq $total ]; then
  echo -e "\n✅ 所有基础功能正常，可以开始知识库开发！"
else
  echo -e "\n⚠️  部分模块需要检查"
fi
