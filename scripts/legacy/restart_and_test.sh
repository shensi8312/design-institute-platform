#!/bin/bash

echo "🔄 重启API服务并测试标定JSON生成"
echo "══════════════════════════════════════════════════════"
echo ""

# 1. 找到并停止当前运行的Node.js服务
echo "1️⃣ 停止当前服务..."
PID=$(ps aux | grep "node.*app.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$PID" ]; then
    echo "   找到进程 PID: $PID"
    kill $PID
    echo "   ✅ 服务已停止"
    sleep 2
else
    echo "   ℹ️ 服务未运行"
fi

# 2. 启动新服务
echo ""
echo "2️⃣ 启动API服务..."
cd apps/api
nohup node src/app.js > server.log 2>&1 &
echo "   ✅ 服务启动中..."
sleep 5

# 3. 检查服务状态
echo ""
echo "3️⃣ 检查服务状态..."
curl -s http://localhost:3000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 服务运行正常"
else
    echo "   ❌ 服务启动失败，请检查 apps/api/server.log"
    exit 1
fi

# 4. 测试标定JSON生成
echo ""
echo "4️⃣ 测试标定JSON生成..."
cd ../..
node test_calibration_json.js

echo ""
echo "══════════════════════════════════════════════════════"
echo "✅ 测试完成！"
echo ""
echo "如果calibration字段仍然不存在，请检查:"
echo "  1. apps/api/server.log 查看服务器日志"
echo "  2. 确认 perspectiveCalibration.js 模块已正确加载"
echo "  3. 检查是否有未捕获的错误"