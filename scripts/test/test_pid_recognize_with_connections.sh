#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NDA4NDIsImV4cCI6MTc2MzM0NTY0Mn0.9YE6_G96703XIXLHTBq1d0r-Rs4j7NsCZXgWK4VHnIo"
PDF_FILE="/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks/其他-301000050672-PID-V1.0.pdf"

echo "🔄 重启API服务以应用新prompt..."
pkill -f "node.*src/app.js" 2>/dev/null
sleep 2

cd /Users/shenguoli/Documents/projects/design-institute-platform/apps/api
nohup node src/app.js > /tmp/api-restart.log 2>&1 &
echo "   等待服务启动..."
sleep 5

echo ""
echo "🔍 使用新prompt识别PID (包含连接关系)..."
curl -s -X POST "http://localhost:3000/api/pid/recognize?method=qwenvl" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$PDF_FILE" \
  -o /tmp/pid_with_connections.json

echo ""
echo "📊 识别结果统计:"
cat /tmp/pid_with_connections.json | jq -r '
  .data |
  "组件数: \(.components | length)",
  "连接数: \(.connections | length)",
  "图例数: \(.legend | length)"
'

echo ""
echo "🔗 连接关系样本 (前10个):"
cat /tmp/pid_with_connections.json | jq -r '.data.connections[0:10] | .[] | "  \(.from) → \(.to) (DN\(.dn // "?"))"'

echo ""
echo "💾 完整结果: /tmp/pid_with_connections.json"
