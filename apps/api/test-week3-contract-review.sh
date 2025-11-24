#!/bin/bash
set -e

echo "========================================="
echo "V3.0 Week 3 合同审查完整流程测试"
echo "========================================="

# 使用最新的 Token
TOKEN="${TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjMwOTI1NjUsImV4cCI6MTc2MzY5NzM2NX0.kZpt_sMbdpCJ8U3wv0JRPuBeT3CRzh6Qumd3rxA6-nk}"

echo ""
echo "步骤 1: 检查 AI 审查路由"
echo "----------------------------------------"
echo "GET /api/ai-review/jobs/:jobId"
curl -s http://localhost:3000/api/ai-review/jobs/test-job-id \
  -H "Authorization: Bearer $TOKEN" | jq -r '.message // .success'

echo ""
echo "步骤 2: 检查报告生成路由"
echo "----------------------------------------"
echo "POST /api/reports/generate"
curl -s -X POST http://localhost:3000/api/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId":"test-doc-id"}' | jq -r '.message // .success'

echo ""
echo "========================================="
echo "✅ Week 3 核心 API 端点测试完成"
echo "========================================="
