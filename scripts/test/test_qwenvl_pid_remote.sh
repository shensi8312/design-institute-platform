#!/bin/bash
#
# 在服务器上远程运行 QWEN-VL PID 识别测试
#
# 用法: ./test_qwenvl_pid_remote.sh <image_path>
#

SERVER="aiuser@10.10.19.3"
IMAGE_PATH="$1"

if [ -z "$IMAGE_PATH" ]; then
  echo "用法: $0 <image_path>"
  echo "示例: $0 ./uploads/pid_sample.png"
  exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
  echo "错误: 文件不存在 $IMAGE_PATH"
  exit 1
fi

# 获取文件名
FILENAME=$(basename "$IMAGE_PATH")
REMOTE_IMAGE="/tmp/$FILENAME"

echo "📤 上传图片到服务器..."
scp "$IMAGE_PATH" "$SERVER:$REMOTE_IMAGE"

echo ""
echo "🔍 在服务器上执行 QWEN-VL 识别..."
ssh "$SERVER" bash <<'ENDSSH'

# 设置变量
IMAGE_PATH="REMOTE_IMAGE_PLACEHOLDER"
OUTPUT_JSON="${IMAGE_PATH%.png}_result.json"

# 读取图片为 base64
IMAGE_BASE64=$(base64 -w 0 "$IMAGE_PATH")
IMAGE_EXT="${IMAGE_PATH##*.}"
MIME_TYPE="image/${IMAGE_EXT}"

# 构建请求
cat > /tmp/qwenvl_request.json <<'EOF'
{
  "model": "qwen-vl-72b",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "你是一个专业的 P&ID（管道与仪表流程图）识别专家。请仔细分析这张 PID 图纸并提取以下信息：\n\n1. **仪表符号识别**：识别图中所有的仪表符号（如压力表、温度计、流量计、液位计等），并标注其位号（Tag Number）\n2. **阀门识别**：识别所有阀门类型（球阀、闸阀、调节阀、安全阀等）及其位号\n3. **设备识别**：识别主要设备（泵、容器、换热器、过滤器等）及其编号\n4. **管线识别**：识别主要管线及其连接关系\n5. **连接关系**：描述各组件之间的连接拓扑\n\n请以如下 JSON 格式返回结果：\n{\n  \"components\": [\n    {\n      \"id\": \"组件唯一ID\",\n      \"type\": \"组件类型（valve/instrument/equipment/pipe）\",\n      \"subtype\": \"具体类型（如 ball_valve, pressure_gauge 等）\",\n      \"tag\": \"位号（如 PI-101）\",\n      \"description\": \"组件描述\",\n      \"location\": \"在图中的大致位置描述\",\n      \"confidence\": 0.95\n    }\n  ],\n  \"connections\": [\n    {\n      \"from\": \"起始组件ID\",\n      \"to\": \"目标组件ID\",\n      \"type\": \"连接类型（如 process_line, signal_line）\",\n      \"description\": \"连接描述\"\n    }\n  ],\n  \"legend\": [\n    {\n      \"symbol\": \"图例符号描述\",\n      \"meaning\": \"符号含义\"\n    }\n  ],\n  \"summary\": \"整体流程描述\"\n}\n\n请仔细观察图纸细节，尽可能多地识别组件和连接关系。"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:IMAGE_MIME_TYPE;base64,IMAGE_BASE64_PLACEHOLDER"
          }
        }
      ]
    }
  ],
  "temperature": 0.1,
  "max_tokens": 4000
}
EOF

# 替换占位符
sed -i "s|IMAGE_MIME_TYPE|$MIME_TYPE|g" /tmp/qwenvl_request.json
sed -i "s|IMAGE_BASE64_PLACEHOLDER|$IMAGE_BASE64|g" /tmp/qwenvl_request.json

echo "⏳ 调用 QWEN-VL API (http://localhost:8001/v1/chat/completions)..."
START_TIME=$(date +%s)

# 调用 API
RESPONSE=$(curl -s -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @/tmp/qwenvl_request.json)

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "✅ API 调用完成 (耗时 ${ELAPSED}s)"
echo ""
echo "📄 QWEN-VL 响应:"
echo "================================================================================"
echo "$RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null || echo "$RESPONSE"
echo "================================================================================"

# 保存结果
echo "$RESPONSE" | jq -r '.choices[0].message.content' > "$OUTPUT_JSON" 2>/dev/null || echo "$RESPONSE" > "$OUTPUT_JSON"
echo ""
echo "💾 结果已保存至: $OUTPUT_JSON"

# 统计信息
COMPONENTS=$(echo "$RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null | jq '.components | length' 2>/dev/null || echo "N/A")
CONNECTIONS=$(echo "$RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null | jq '.connections | length' 2>/dev/null || echo "N/A")

echo ""
echo "📊 识别统计:"
echo "  组件数量: $COMPONENTS"
echo "  连接数量: $CONNECTIONS"

ENDSSH

# 替换占位符
ssh "$SERVER" "sed -i 's|REMOTE_IMAGE_PLACEHOLDER|$REMOTE_IMAGE|g' /tmp/qwenvl_test.sh && bash /tmp/qwenvl_test.sh"

echo ""
echo "📥 下载结果..."
scp "$SERVER:${REMOTE_IMAGE%.png}_result.json" "$(dirname $IMAGE_PATH)/"

echo ""
echo "✅ 测试完成"
