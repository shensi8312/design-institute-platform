#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NDA4NDIsImV4cCI6MTc2MzM0NTY0Mn0.9YE6_G96703XIXLHTBq1d0r-Rs4j7NsCZXgWK4VHnIo"
PDF_FILE="/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks/其他-301000050672-PID-V1.0.pdf"

echo "🔍 重新识别PID..."
curl -s -X POST "http://localhost:3000/api/pid/recognize?method=qwenvl" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$PDF_FILE" \
  -o /tmp/pid_new_recognition.json

echo ""
echo "📊 统计结果:"
cat /tmp/pid_new_recognition.json | jq -r '
  .data |
  "组件数: \(.components | length)",
  "连接数: \(.connections | length)",
  "图例数: \(.legend | length)"
'

echo ""
echo "💾 完整结果已保存到: /tmp/pid_new_recognition.json"
echo ""
echo "🔗 连接关系样本 (前5个):"
cat /tmp/pid_new_recognition.json | jq -r '.data.connections[0:5]'
