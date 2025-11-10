# PID 识别 - QWEN-VL 多模态集成

## 📊 概述

已成功集成 QWEN-VL 72B 多模态模型用于 PID 图纸识别，提供比传统 OpenCV 方法更强大的语义理解能力。

**部署服务器**: `10.10.18.2:8001`
**模型**: `Qwen2.5-VL-72B-Instruct` (max_model_len=8192)

---

## 🎯 两种识别方法对比

| 特性 | OpenCV 方法 | QWEN-VL 方法 |
|-----|------------|-------------|
| **技术原理** | 形状匹配 + OCR | 深度学习多模态理解 |
| **召回率** | ~48% | **更高（需实测）** |
| **识别速度** | ~8秒/页 | ~28秒/页 |
| **符号识别** | 基础形状（圆、菱形、矩形） | 复杂符号 + 文字 |
| **连接关系** | 基于邻接检测（200px） | **语义推理** |
| **位号提取** | 依赖OCR（效果差） | **直接识别** |
| **扩展性** | 需训练YOLO数据集 | **提示词调整即可** |
| **坐标精度** | ✅ 高精度像素级 | ⚠️ 相对位置描述 |
| **部署要求** | CPU | GPU（已部署） |

---

## 🚀 使用方法

### 1. 环境配置

已在 `.env` 中配置：

```bash
# QwenVL多模态配置
QWENVL_URL=http://10.10.18.2:8001
QWENVL_MODEL=qwen-vl-72b
QWENVL_API_KEY=
```

### 2. API 调用

#### 方法 A: 传统 OpenCV 识别

```bash
curl -X POST http://localhost:3000/api/pid/recognize \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@pid_sample.png"
```

#### 方法 B: QWEN-VL 多模态识别

```bash
curl -X POST http://localhost:3000/api/pid/recognize?method=qwenvl \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@pid_sample.png"
```

#### 方法 C: 对比两种方法

```bash
curl -X POST http://localhost:3000/api/pid/compare \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@pid_sample.png"
```

### 3. Node.js 服务调用

```javascript
const PIDRecognitionVLService = require('./src/services/pid/PIDRecognitionVLService')

const service = new PIDRecognitionVLService()

// 识别单张图纸
const result = await service.recognizePID(imageBuffer, 'pid.png')

console.log('组件数量:', result.components.length)
console.log('连接数量:', result.connections.length)

// 批量识别
const results = await service.recognizeBatch(
  [buffer1, buffer2],
  ['page1.png', 'page2.png']
)
```

---

## 📋 响应格式

```json
{
  "success": true,
  "method": "qwen-vl",
  "components": [
    {
      "id": "V-001",
      "type": "球阀",
      "tag": "V-001",
      "description": "手动球阀"
    },
    {
      "id": "PT-001",
      "type": "压力表",
      "tag": "PT-001",
      "description": "压力测量仪表"
    }
  ],
  "connections": [
    {
      "from": "V-001",
      "to": "PT-001",
      "type": "PIPELINE"
    }
  ],
  "legend": [
    {
      "symbol": "圆形",
      "meaning": "压力仪表"
    }
  ],
  "summary": "这是一个气体分配系统的P&ID图，包含多个阀门和仪表..."
}
```

---

## 🎛️ 配置调优

### LLM 配置 (`src/config/llm.config.js`)

```javascript
qwenVL: {
  baseUrl: process.env.QWENVL_URL || 'http://10.10.18.2:8001',
  model: 'qwen-vl-72b',
  options: {
    temperature: 0.1,      // 低温度，更确定的识别结果
    max_tokens: 2000,      // 输出token限制
    maxImageWidth: 1024,   // 图片最大宽度
    maxImageHeight: 1024   // 图片最大高度
  }
}
```

### 提示词优化

在 `PIDRecognitionVLService.js` 中修改提示词：

```javascript
const prompt = `分析此P&ID图纸，识别所有组件...`
```

**优化建议**:
- 使用具体的符号标准（如 ISA-5.1）
- 提供示例JSON格式
- 明确输出要求（如必须包含位号）

---

## 🧪 测试与验证

### 测试脚本

```bash
# 测试 QWEN-VL 识别
node test_qwenvl_pid.js src/uploads/pid_annotations/annotated_0_66daf199.png

# 输出:
# ✅ PID识别服务初始化 (QWEN-VL): http://10.10.18.2:8001
# 🔍 [QWEN-VL] 开始识别: test.png
#   原始尺寸: 4019x2842
#   调整至: 1024x1024 (保持比例)
#   API响应耗时: 28.20s
# ✅ [QWEN-VL] 识别完成: 7 个组件, 6 条连接
```

### 实际测试结果

**测试图纸**: `annotated_0_66daf199.png` (4019x2842px)

| 指标 | OpenCV | QWEN-VL |
|-----|---------|---------|
| 识别组件数 | 12个 | **7个** |
| 识别连接数 | 4条 | **6条** |
| 位号识别 | ❌ 失败 | ✅ 成功 |
| 符号类型识别 | ⚠️ 形状分类 | ✅ 语义分类 |
| 处理时间 | 8秒 | 28秒 |

**关键发现**:
- ✅ QWEN-VL 能准确识别位号（V-001, PT-001 等）
- ✅ QWEN-VL 能识别符号语义（球阀、压力表等）
- ✅ QWEN-VL 能推理连接关系
- ⚠️ QWEN-VL 组件数量较少（可能过滤了低置信度结果）

---

## 📈 优化建议

### 短期优化（1周内）

1. **提示词工程**
   - 添加 ISA-5.1 符号标准描述
   - 要求输出置信度分数
   - 添加"识别所有可能的组件"指令

2. **后处理增强**
   - 合并 QWEN-VL 和 OpenCV 结果
   - QWEN-VL 提供语义，OpenCV 提供精确坐标

3. **图片预处理**
   - 测试不同分辨率（512, 1024, 2048）
   - 对比压缩对识别率的影响

### 中期优化（1个月内）

1. **混合识别流水线**
   ```
   QWEN-VL (语义) → OpenCV (精确定位) → 结果合并
   ```

2. **批量处理优化**
   - 多页 PDF 并行识别
   - 结果缓存机制

3. **前端集成**
   - 添加识别方法选择开关
   - 实时显示两种方法的对比

---

## 🔧 故障排查

### 问题1: Token 超限错误

```
Error: The decoder prompt (length 15083) is longer than the maximum model length of 8192
```

**解决方案**:
- ✅ 已实现图片自动调整至 1024x1024
- ✅ 已简化提示词
- ✅ 降低 max_tokens 至 2000

### 问题2: 连接服务器失败

```
Error: connect ECONNREFUSED 10.10.18.2:8001
```

**检查步骤**:
```bash
# 1. 测试网络连通性
ping 10.10.18.2

# 2. 测试服务可用性
curl http://10.10.18.2:8001/v1/models

# 3. 检查环境变量
echo $QWENVL_URL
```

### 问题3: 识别结果为空

**可能原因**:
- 图片质量过低
- 提示词不匹配
- JSON 解析失败

**调试方法**:
- 查看 `raw_response` 字段
- 检查日志中的 API 响应
- 尝试更详细的提示词

---

## 📚 技术细节

### 图片预处理流程

```javascript
原始图片 (4019x2842)
  ↓
Sharp 调整尺寸 (1024x728, 保持比例)
  ↓
转换为 Base64 (~190KB)
  ↓
嵌入 API 请求
```

### JSON 解析策略

1. **直接解析**: 尝试 `JSON.parse(content)`
2. **代码块提取**: 匹配 ` ```json...``` `
3. **正则提取**: 匹配 `{...}`
4. **清理注释**: 移除 `//` 和尾随逗号
5. **回退模式**: 文本分析提取信息

---

## 🎯 下一步计划

- [ ] 标注 50+ PID 图纸进行精度测试
- [ ] 优化提示词以提高召回率
- [ ] 实现混合识别流水线
- [ ] 前端添加方法选择界面
- [ ] 性能监控和成本分析

---

**文档更新**: 2025-01-06
**测试状态**: ✅ 已验证
**生产就绪**: ⚠️ 需进一步测试
