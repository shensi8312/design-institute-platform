# 图纸比对功能设计文档

**功能名称**: 图纸比对（Drawing Comparison）
**所属模块**: 机械设计
**设计日期**: 2025-11-05
**设计状态**: 已验证，待实施

## 1. 功能概述

### 1.1 业务目标
为机械设计用户提供智能图纸版本对比功能，自动识别V1.0和V2.0版本间的所有差异，并生成可视化标注和结构化变更清单。

### 1.2 核心价值
- **自动化识别**：替代人工逐项对比，节省90%审图时间
- **零遗漏**：AI全面扫描，确保不遗漏任何变更
- **语义理解**：不只是"有差异"，而是理解"螺栓孔M6→M8"的工程意义

### 1.3 用户场景
1. 设计师完成图纸修改后，需要向审核人员说明变更点
2. 审核人员需要快速了解新版本相对于旧版本的所有改动
3. 项目经理需要生成版本对比报告归档

---

## 2. 系统架构

### 2.1 整体架构（4层分离）

```
┌─────────────────────────────────────────────────────────┐
│  前端层 (React + Ant Design + Canvas)                    │
│  - DrawingComparison.tsx                                │
│  - 三栏布局：操作区 | 画布区 | 差异列表区                   │
└─────────────────────────────────────────────────────────┘
                          ↓ REST API + WebSocket
┌─────────────────────────────────────────────────────────┐
│  后端层 (Node.js + Express)                              │
│  - DrawingComparisonController.js                       │
│  - DrawingComparisonService.js                          │
│  - Bull Queue (任务队列)                                 │
│  - Socket.io (进度推送)                                  │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP调用
┌─────────────────────────────────────────────────────────┐
│  AI服务层 (Python + Flask)                               │
│  - OpenCV: 图像配准 + 差异检测                            │
│  - Deepseek-OCR: 文字识别                                │
│  - Qwen-VL: 语义理解                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  存储层                                                  │
│  - PostgreSQL: 任务记录、差异结果                         │
│  - MinIO: 图纸文件、标注图                                │
│  - Redis: 任务队列、缓存                                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 服务复用策略

**与PID识别共享基础设施：**
```
services/document-recognition/
├── common/                      # 【新增】通用服务封装
│   ├── ocr_client.py           # Deepseek-OCR统一调用
│   ├── vision_client.py        # Qwen-VL统一调用
│   └── cv_utils.py             # OpenCV通用工具
├── pid_recognition/            # 【已有】PID识别
│   └── PIDRecognitionService.py
└── drawing_comparison/         # 【新增】图纸比对
    ├── image_aligner.py        # 图像配准
    ├── diff_detector.py        # 差异检测
    ├── diff_analyzer.py        # AI分析
    └── report_generator.py     # 报告生成
```

---

## 3. 前端设计

### 3.1 页面布局（三栏设计）

```
┌─────────────────────────────────────────────────────────────┐
│  机械设计 > 图纸比对                                  [导出] │
├──────────┬────────────────────────────────┬─────────────────┤
│          │                                │  发现 5 处差异    │
│ 旧版本   │                                │                 │
│ [上传V1] │                                │ ① 尺寸变更       │
│          │        V2.0 图纸               │ 位置: 主视图...  │
│ 新版本   │        + 差异标注              │ 变更: M6 → M8   │
│ [上传V2] │                                │                 │
│          │    [①]  [②]                   │ ② 标注修改       │
│ [开始比对]│                                │ ...             │
│          │         [③]                    │                 │
│ 处理进度  │                                │ ③ 新增元素       │
│ ① 上传文件│                                │ ...             │
│ ② 图像处理│    [④]        [⑤]             │                 │
│ ③ AI分析中│                                │ [点击定位]       │
│ ④ 生成结果│                                │                 │
│          │                                │                 │
│ 工具栏    │                                │                 │
│ [放大]   │                                │                 │
│ [缩小]   │                                │                 │
│ [适应]   │                                │                 │
└──────────┴────────────────────────────────┴─────────────────┘
   300px              自适应宽度                  350px
```

### 3.2 交互流程

1. **上传阶段**
   - 拖拽或点击上传PDF/PNG/JPG
   - 实时预览缩略图
   - 文件校验（格式、大小<50MB）

2. **比对阶段**
   - 点击"开始比对"按钮
   - 显示4步进度条
   - WebSocket实时推送进度（20% → 50% → 80% → 100%）

3. **结果展示**
   - 画布渲染V2.0图纸 + 半透明彩色标注框
   - 标注框内显示编号（①②③...）
   - 右侧列表显示结构化差异详情

4. **交互操作**
   - 鼠标悬停标注框 → Tooltip快速提示
   - 点击标注框 → 右侧列表自动滚动
   - 点击列表项 → 画布自动缩放聚焦
   - 点击导出 → 下载PDF报告

### 3.3 UI组件

**关键组件：**
- `DrawingUploader`: 支持拖拽的文件上传组件
- `ComparisonCanvas`: Canvas/Konva.js实现的图纸标注画布
- `DifferenceList`: 差异列表卡片组件
- `ProgressTracker`: WebSocket驱动的进度显示组件

---

## 4. 后端设计

### 4.1 API接口

#### 4.1.1 创建比对任务
```http
POST /api/drawing-comparison/compare
Content-Type: multipart/form-data

参数:
- v1File: File
- v2File: File
- projectId?: String
- description?: String

响应:
{
  "taskId": "cmp_20250105_001",
  "status": "processing",
  "estimatedTime": 120
}
```

#### 4.1.2 WebSocket进度推送
```javascript
// WebSocket连接
ws://api/drawing-comparison/:taskId

// 推送消息格式
{
  "progress": 65,
  "status": "processing",
  "currentStep": "AI分析中",
  "message": "正在识别差异区域..."
}
```

#### 4.1.3 获取比对结果
```http
GET /api/drawing-comparison/result/:taskId

响应:
{
  "taskId": "cmp_20250105_001",
  "status": "completed",
  "v2ImageUrl": "https://minio/.../v2.png",
  "annotatedImageUrl": "https://minio/.../annotated.png",
  "differences": [
    {
      "id": 1,
      "category": "尺寸变更",
      "location": {"x": 320, "y": 450, "width": 80, "height": 60},
      "description": "螺栓孔直径 M6 → M8",
      "detail": "孔径从6mm增大至8mm，增幅33.3%",
      "severity": "medium"
    }
  ],
  "summary": {
    "totalDifferences": 5,
    "byCategory": {
      "dimension_change": 2,
      "annotation_change": 1,
      "new_element": 2
    }
  }
}
```

#### 4.1.4 导出报告
```http
GET /api/drawing-comparison/export/:taskId?format=pdf

响应: PDF文件下载
```

### 4.2 数据库设计

```sql
CREATE TABLE drawing_comparison_tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  project_id VARCHAR(50),

  -- 文件URL
  v1_file_url TEXT NOT NULL,
  v2_file_url TEXT NOT NULL,
  annotated_image_url TEXT,

  -- 任务状态
  status VARCHAR(20) NOT NULL,  -- pending/processing/completed/failed
  progress INTEGER DEFAULT 0,
  current_step VARCHAR(100),
  error_message TEXT,

  -- 结果数据（JSON格式）
  differences_json JSONB,

  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);
```

### 4.3 任务队列设计

**使用Bull Queue实现：**
```javascript
const compareQueue = new Queue('drawing-comparison', {
  redis: { host: 'localhost', port: 6379 },
  limiter: {
    max: 2,        // 同时最多处理2个任务
    duration: 1000
  }
});

// 任务超时: 5分钟
compareQueue.process(async (job) => {
  return await Promise.race([
    analyzeDrawingDiff(job.data),
    timeout(5 * 60 * 1000)
  ]);
});
```

---

## 5. AI服务设计

### 5.1 三阶段处理流程

**阶段1: 图像配准 + 差异检测（OpenCV）**
```python
def align_and_detect_differences(img1, img2):
    # 1. 特征点匹配（ORB算法）
    keypoints1, descriptors1 = orb.detectAndCompute(img1)
    keypoints2, descriptors2 = orb.detectAndCompute(img2)

    # 2. 计算变换矩阵
    matches = matcher.match(descriptors1, descriptors2)
    H, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC)

    # 3. 图像配准
    aligned_img1 = cv2.warpPerspective(img1, H, (width, height))

    # 4. 差异检测
    diff = cv2.absdiff(aligned_img1, img2)
    _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)

    # 5. 轮廓提取
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, ...)

    # 6. 过滤噪声、合并邻近区域
    regions = filter_and_merge_regions(contours)

    return regions
```

**阶段2: 文字区域分析（Deepseek-OCR）**
```python
def analyze_text_differences(img1, img2, regions):
    text_changes = []

    for region in regions:
        # 裁剪差异区域
        crop1 = img1[y:y+h, x:x+w]
        crop2 = img2[y:y+h, x:x+w]

        # OCR识别
        text1 = deepseek_ocr.recognize(crop1)
        text2 = deepseek_ocr.recognize(crop2)

        if text1 != text2:
            text_changes.append({
                "location": region,
                "old_text": text1,
                "new_text": text2,
                "type": classify_text_type(text1, text2)
            })

    return text_changes
```

**阶段3: 语义理解（Qwen-VL）**
```python
def semantic_analysis(img1, img2, regions, text_changes):
    differences = []

    for i, region in enumerate(regions):
        prompt = f"""
        这是工程图纸的版本对比。
        左图：旧版本 V1.0，右图：新版本 V2.0

        红框区域发生了变化，请分析：
        1. 变更类型？（尺寸/形状/标注/新增/删除）
        2. 具体改了什么？用工程术语描述
        3. 影响程度？（低/中/高）

        OCR已识别: {text_changes[i]}

        JSON格式回答:
        {{"category": "尺寸变更", "description": "...", "severity": "medium"}}
        """

        # 裁剪上下文区域（比差异区域大20%）
        context1 = crop_with_context(img1, region, padding=0.2)
        context2 = crop_with_context(img2, region, padding=0.2)

        # 调用Qwen-VL
        result = qwen_vl.analyze([context1, context2], prompt)

        differences.append({
            "id": i + 1,
            "location": region,
            **result
        })

    return differences
```

### 5.2 服务调用流程

```python
@app.route('/api/drawing-diff/analyze', methods=['POST'])
def analyze_drawing_diff():
    task_id = request.json['taskId']
    v1_path = request.json['v1Path']
    v2_path = request.json['v2Path']

    # 建立WebSocket连接
    ws = connect_to_node_ws(task_id)

    # 阶段1: 图像配准
    ws.send({"progress": 20, "step": "图像配准中"})
    regions = align_and_detect_differences(v1_path, v2_path)

    # 阶段2: OCR识别
    ws.send({"progress": 50, "step": "OCR识别中"})
    text_changes = analyze_text_differences(v1_path, v2_path, regions)

    # 阶段3: AI语义分析
    ws.send({"progress": 80, "step": "AI语义分析中"})
    differences = semantic_analysis(v1_path, v2_path, regions, text_changes)

    # 生成标注图
    annotated = draw_annotations(v2_path, differences)

    ws.send({"progress": 100, "status": "completed", "result": differences})

    return jsonify({"success": True})
```

---

## 6. 错误处理

### 6.1 边界情况处理

| 场景 | 检测方法 | 处理策略 |
|------|---------|---------|
| 文件过大(>50MB) | 前端文件大小检测 | 阻止上传，提示压缩 |
| 文件格式错误 | 前端MIME类型检测 | 阻止上传，提示支持格式 |
| 图像配准失败 | OpenCV特征点<10 | 降级为直接对比模式 |
| OCR服务不可用 | HTTP连接超时 | 重试3次，失败后跳过OCR |
| Qwen-VL未启动 | 启动时健康检查 | 降级为CV+OCR模式 |
| 并发过载 | Bull Queue限流 | 排队等待，显示队列位置 |
| 任务超时(>5分钟) | Promise.race超时 | 标记失败，释放资源 |
| 无差异检测 | regions数组为空 | 返回成功，提示可能完全相同 |
| WebSocket断连 | onclose事件 | 自动重连或降级为轮询 |

### 6.2 用户友好的错误提示

```javascript
const ERROR_MESSAGES = {
  'ALIGNMENT_FAILED': {
    title: '图纸配准失败',
    message: '两张图纸可能不是同一图纸的版本',
    suggestions: [
      '确认上传的是正确的V1和V2版本',
      '检查图纸方向是否一致',
      '确认图纸清晰度是否足够'
    ]
  },
  'SERVICE_UNAVAILABLE': {
    title: 'AI服务暂时不可用',
    message: '系统已切换到基础模式',
    suggestions: [
      '基础模式仅检测视觉差异',
      '无法生成语义化描述',
      '建议稍后重试获得完整分析'
    ]
  }
}
```

---

## 7. 测试策略

### 7.1 测试金字塔

**单元测试（Python）**
- 图像配准算法测试
- 差异检测算法测试
- OCR结果解析测试

**集成测试（Node.js）**
- 完整流程测试（上传→比对→获取结果）
- 错误场景测试（非同一图纸、服务不可用）
- 并发场景测试（多用户同时上传）

**E2E测试（Playwright）**
- 用户完整操作流程
- 交互测试（点击差异项、画布聚焦）
- 报告导出功能测试

### 7.2 测试数据集

**准备测试图纸：**
1. `test_identical.pdf` - 完全相同的两个版本
2. `test_dimension_change.pdf` - V1(M6) vs V2(M8)
3. `test_rotation.pdf` - V1 vs V1旋转5度
4. `test_different_drawings.pdf` - 完全不同的两张图纸
5. `test_low_quality.pdf` - 低质量扫描件

---

## 8. 实施计划

### 8.1 开发周期：2周（10工作日）

**第一周：基础功能**
- Day 1-2: 数据库表 + 后端基础API
- Day 3-4: Python服务重构（提取common模块）+ OpenCV配准
- Day 5: 前端UI开发（三栏布局）

**第二周：AI集成 + 优化**
- Day 6-7: AI服务集成（OCR + Qwen-VL）
- Day 8: WebSocket + 任务队列
- Day 9: 前端完善（Canvas标注渲染）
- Day 10: 测试 + 部署

### 8.2 技术栈

**前端：** React 18 + TypeScript + Ant Design 5 + Canvas API
**后端：** Node.js + Express + Bull Queue + Socket.io
**AI服务：** Python 3.9 + OpenCV + Deepseek-OCR + Qwen-VL
**基础设施：** PostgreSQL + Redis + MinIO

### 8.3 依赖安装

**Qwen-VL部署（需用户安装）：**
```bash
git clone https://github.com/QwenLM/Qwen-VL.git
cd Qwen-VL
pip install -r requirements.txt
huggingface-cli download Qwen/Qwen-VL-Chat --local-dir ./models
python openai_api.py --model-path ./models --port 8001

export QWEN_VL_URL=http://10.10.18.3:8001/v1/chat/completions
```

**Python依赖：**
```bash
pip install opencv-python numpy requests Flask flask-cors python-socketio
```

**Node.js依赖：**
```bash
npm install bull socket.io form-data sharp
```

---

## 9. 菜单集成

### 9.1 数据库菜单配置

**新增菜单项：**
```sql
-- 需要插入到 menus 表
INSERT INTO menus (menu_id, name, path, parent_id, sort_order, icon) VALUES
  ('menu_drawing_comparison', '图纸比对', '/mechanical-design/drawing-comparison',
   '机械设计菜单的parent_id', 7, 'CompareOutlined');
```

**对应路由：**
```javascript
// apps/web/src/router/index.tsx
{
  path: 'mechanical-design/drawing-comparison',
  element: <LazyWrapper Component={DrawingComparison} />
}
```

### 9.2 权限配置

**默认权限：**
- 机械设计组：读写权限
- 审核人员：只读权限
- 管理员：完整权限

---

## 10. 监控与维护

### 10.1 关键指标监控

- 任务处理时长（平均/P95/P99）
- 任务成功率
- AI服务可用率
- 配准成功率

### 10.2 日志记录

```javascript
logger.info('Drawing comparison started', {
  taskId,
  userId,
  fileSize: { v1: size1, v2: size2 }
});

logger.error('Alignment failed', {
  taskId,
  error: err.message,
  featurePoints: matches.length
});
```

---

## 11. 未来优化方向

1. **批量比对**：支持一次上传多个版本（V1 vs V2 vs V3）
2. **历史记录**：保存所有比对任务，支持检索和复查
3. **变更分类学习**：基于用户反馈优化AI分类准确度
4. **3D模型比对**：扩展支持STEP/SLDPRT文件的几何比对
5. **协同标注**：支持多用户在比对结果上添加评论

---

## 12. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Qwen-VL内存占用高 | 高 | 中 | 限制并发数为2，考虑模型量化 |
| 图纸格式兼容性 | 中 | 中 | 支持主流格式，提供格式转换工具 |
| 配准算法失败率 | 高 | 低 | 提供手动对齐辅助工具 |
| AI识别准确率不足 | 中 | 中 | 降级为人工审核模式 |

---

**设计验证状态：✅ 已通过用户确认**
**准备状态：✅ 可进入实施阶段**
