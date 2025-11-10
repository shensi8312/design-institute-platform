#!/bin/bash

echo "=== OnlyOffice文档访问测试 ==="
echo ""

# 1. 获取登录token
echo "1️⃣ 获取认证token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ 登录失败"
  exit 1
fi
echo "✅ Token获取成功: ${TOKEN:0:20}..."
echo ""

# 2. 获取OnlyOffice配置
echo "2️⃣ 获取OnlyOffice编辑器配置..."
CONFIG=$(curl -s "http://localhost:3000/api/onlyoffice/config/2cd687bc-f4b6-46fd-b846-b790865fc7ea" \
  -H "Authorization: Bearer $TOKEN")

echo "$CONFIG" | jq '.'
echo ""

# 3. 提取文档URL
DOC_URL=$(echo "$CONFIG" | jq -r '.data.document.url')
echo "📄 文档URL: $DOC_URL"
echo ""

# 4. 测试从本机访问文档
echo "3️⃣ 从本机访问文档..."
curl -I "$DOC_URL" 2>&1 | grep -E "HTTP/|Content-Type|Content-Length"
echo ""

# 5. 测试从OnlyOffice容器访问文档
echo "4️⃣ 从OnlyOffice容器访问文档..."
docker exec onlyoffice-docs curl -I "$DOC_URL" 2>&1 | grep -E "HTTP/|Content-Type|Content-Length"
echo ""

# 6. 测试OnlyOffice容器能否访问API服务器
CALLBACK_URL=$(echo "$CONFIG" | jq -r '.data.editorConfig.callbackUrl')
echo "5️⃣ 测试回调URL访问..."
echo "🔙 回调URL: $CALLBACK_URL"
docker exec onlyoffice-docs curl -I "http://10.10.6.95:3000/api/health" 2>&1 | grep -E "HTTP/|Content"
echo ""

# 7. 检查OnlyOffice配置
echo "6️⃣ 检查OnlyOffice配置..."
docker exec onlyoffice-docs cat /etc/onlyoffice/documentserver/local.json 2>&1
echo ""

echo "=== 测试完成 ==="
