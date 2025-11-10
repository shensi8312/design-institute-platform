#!/bin/bash

# 使用base64编码图片
IMAGE_BASE64=$(base64 -i docs/test1.jpg)

# 调用API
curl -X POST http://localhost:3000/api/ai-modeling/process \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$IMAGE_BASE64\",
    \"options\": {
      \"enable_depth\": true,
      \"enable_qwenvl\": true,
      \"enable_vllm\": true,
      \"debug\": true
    }
  }" | python3 -m json.tool
