#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NjY5MjAsImV4cCI6MTc2MzM3MTcyMH0.QSoyCPNTBMsCCyCPzBNPa2qXS0r3CaIpWfN1ec96oXU"

echo "===================================="
echo "  完整流程测试"
echo "===================================="

echo -e "\n[Step 1] PID识别..."
RESULT=$(curl -s -X POST "http://localhost:3000/api/pid/recognize?method=qwenvl" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@uploads/test_pid.png")

echo "$RESULT" | jq '.'

COMPONENTS=$(echo "$RESULT" | jq -r '.components | length')
echo "✅ 识别到 $COMPONENTS 个零件"

echo -e "\n[Step 2] 生成装配..."
ASSEMBLY_DATA=$(cat <<EOF
{
  "pid_data": $RESULT,
  "catalog_version": "v1.0",
  "templates_version": "v1.0"
}
EOF
)

ASSEMBLY_RESULT=$(curl -s -X POST http://localhost:3000/api/assembly/generate-from-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ASSEMBLY_DATA")

echo "$ASSEMBLY_RESULT" | jq '.'

TASK_ID=$(echo "$ASSEMBLY_RESULT" | jq -r '.task_id')
echo "✅ 任务ID: $TASK_ID"

echo -e "\n[Step 3] 导出带STEP的装配JSON..."
curl -s -X GET "http://localhost:3000/api/assembly/export/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  > uploads/assembly_output/test_with_step.json

PARTS_COUNT=$(cat uploads/assembly_output/test_with_step.json | jq '.parts | length')
echo "✅ 导出完成: $PARTS_COUNT 个零件"

echo -e "\n[Step 4] 在浏览器打开:"
echo "http://localhost:5555/test_occt_real.html"
echo "修改HTML加载: assembly_output/test_with_step.json"

echo -e "\n===================================="
echo "  ✅ 测试完成!"
echo "===================================="
