#!/bin/bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NjY5MjAsImV4cCI6MTc2MzM3MTcyMH0.QSoyCPNTBMsCCyCPzBNPa2qXS0r3CaIpWfN1ec96oXU"

PDF_FILE="/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks/其他-301000050672-PID-V1.0.pdf"

echo "======================================"
echo "  PID → 装配体 → 3D显示 完整流程"
echo "======================================"

echo -e "\n[1/3] 识别PID图..."
PID_RESULT=$(curl -s -X POST "http://localhost:3000/api/pid/recognize?method=qwenvl" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$PDF_FILE")

echo "$PID_RESULT" | jq '.' > /tmp/pid_full_result.json

COMPONENTS=$(echo "$PID_RESULT" | jq -r '.data.components | length' 2>/dev/null || echo "0")
echo "✅ 识别到 $COMPONENTS 个组件"

if [ "$COMPONENTS" -eq "0" ]; then
  echo "❌ PID识别失败，请检查服务"
  cat /tmp/pid_full_result.json
  exit 1
fi

echo -e "\n[2/3] 生成装配体..."
ASSEMBLY_INPUT=$(cat <<EOF
{
  "pid_data": $(cat /tmp/pid_full_result.json | jq '.data'),
  "catalog_version": "v1.0",
  "templates_version": "v1.0"
}
EOF
)

ASSEMBLY_RESULT=$(curl -s -X POST http://localhost:3000/api/assembly/generate-from-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ASSEMBLY_INPUT")

echo "$ASSEMBLY_RESULT" | jq '.' > /tmp/assembly_full_result.json

TASK_ID=$(echo "$ASSEMBLY_RESULT" | jq -r '.task_id // empty')
PARTS_COUNT=$(echo "$ASSEMBLY_RESULT" | jq -r '.assembly.parts | length')

echo "✅ 生成装配: $PARTS_COUNT 个零件"

if [ -z "$TASK_ID" ]; then
  echo "⚠️  无task_id，直接从装配结果提取零件"
  # 直接使用装配结果中的零件
  node - <<'NODESCRIPT'
const fs = require('fs')
const path = require('path')

async function main() {
  const assemblyResult = JSON.parse(fs.readFileSync('/tmp/assembly_full_result.json', 'utf-8'))
  const solidworksDir = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks'

  const parts = []
  let loadedCount = 0

  for (let i = 0; i < assemblyResult.assembly.parts.length; i++) {
    const part = assemblyResult.assembly.parts[i]
    const partNumber = part.part_id.replace('PART-', '')
    const stepFile = path.join(solidworksDir, `${partNumber}.STEP`)

    try {
      const stepData = fs.readFileSync(stepFile, 'utf-8')
      console.log(`✅ [${i+1}/${assemblyResult.assembly.parts.length}] ${partNumber}.STEP`)

      const spacing = 80
      const cols = 12
      const row = Math.floor(i / cols)
      const col = i % cols

      parts.push({
        id: `part_${i}`,
        part_number: partNumber,
        position: [col * spacing, row * spacing, 0],
        rotation: [[1,0,0],[0,1,0],[0,0,1]],
        step_data: stepData
      })
      loadedCount++
    } catch (err) {
      console.log(`⚠️  [${i+1}/${assemblyResult.assembly.parts.length}] 跳过 ${partNumber}.STEP`)
    }
  }

  const assembly = {
    task_id: 'pid-assembly',
    parts,
    metadata: {
      timestamp: new Date().toISOString(),
      total_parts: parts.length,
      pid_components: assemblyResult.assembly.parts.length
    }
  }

  const outputFile = '/Users/shenguoli/Documents/projects/design-institute-platform/apps/api/uploads/assembly_output/test_with_step.json'
  fs.writeFileSync(outputFile, JSON.stringify(assembly, null, 2))

  const stat = fs.statSync(outputFile)
  console.log(`\n✅ 生成完成: ${(stat.size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`   加载零件: ${loadedCount}/${assemblyResult.assembly.parts.length}`)
}

main().catch(console.error)
NODESCRIPT
else
  echo "✅ 任务ID: $TASK_ID"
  echo -e "\n[3/3] 导出3D模型数据..."
  curl -s -X GET "http://localhost:3000/api/assembly/export/$TASK_ID" \
    -H "Authorization: Bearer $TOKEN" \
    > uploads/assembly_output/test_with_step.json

  EXPORTED_COUNT=$(cat uploads/assembly_output/test_with_step.json | jq '.parts | length' 2>/dev/null || echo "0")
  echo "✅ 导出 $EXPORTED_COUNT 个零件的STEP数据"
fi

echo -e "\n======================================"
echo "  ✅ 完成！"
echo "======================================"
echo ""
echo "🌐 在浏览器打开: http://localhost:5555/test_occt_real.html"
echo "   （按 Cmd+Shift+R 强制刷新）"
