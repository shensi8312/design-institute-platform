# 批量上传标准文档使用说明

## 📋 功能说明

自动批量上传kb_uploads_processed文件夹中的所有国标和地标文档，并使用**智能分析系统**自动：
- 识别文档类型（技术规程/设计规范/施工标准/计价定额等）
- 识别专业领域（建筑结构/暖通空调/给排水/装配式等）
- 并行提取6种规则类型：
  1. 🏗️ **设计规则** - 尺寸要求、计算公式、选型标准
  2. 🔧 **装配规则** - 安装顺序、连接方式、配合要求
  3. 👷 **施工规则** - 工艺流程、操作要求、质量控制
  4. ✅ **检验规则** - 检测方法、验收标准、合格指标
  5. 📦 **材料规则** - 材料性能、规格型号、适用范围
  6. ⚠️  **约束条件** - 适用条件、限制条件、禁止事项

## 🚀 使用步骤

### 1. 确保服务运行

```bash
# 检查Docker容器状态
docker ps | grep -E "postgres|minio|redis"

# 如果MinIO未运行，启动它
docker start milvus-minio

# 检查后端是否运行
curl http://localhost:3000/api/health
```

### 2. 测试上传（推荐先测试）

```bash
cd /Users/shenguoli/Documents/projects/design-institute-platform/apps/api

# 测试上传前10个文件
node batch_upload_test.js
```

### 3. 批量上传全部文件

⚠️ **注意：共有1118个文件，预计需要1-2小时**

```bash
# 批量上传所有文件
node batch_upload_standards.js

# 上传会分批进行：
# - 每批5个文件
# - 批次间延迟3秒
# - 自动统计成功/失败
```

## 📊 文件统计

当前kb_uploads_processed文件夹：
- **国标文档**: ~689个文件
- **地标文档**: ~429个文件
- **总计**: 1118个PDF/DOC/DOCX文件

## ⚙️ 配置说明

### 修改批次大小

编辑 `batch_upload_standards.js`:

```javascript
const BATCH_SIZE = 5  // 每批上传数量（默认5）
const DELAY_BETWEEN_BATCHES = 3000  // 批次延迟（默认3秒）
```

### 支持的文件格式

- PDF (.pdf)
- Word文档 (.doc, .docx)
- 纯文本 (.txt)

### TOKEN更新

如果TOKEN过期，更新脚本中的TOKEN：

```javascript
const TOKEN = '你的新TOKEN'
```

## 📝 上传结果

脚本会自动显示：
- ✅ 成功上传数量
- ❌ 失败文件列表
- 📈 成功率统计
- 📂 文件分布情况

## 🎯 智能分析特点

### 上传时 - 无需手动选择

- ✨ **自动识别**: 系统自动判断文档类型和领域
- 🔄 **并行提取**: 同时提取6种规则类型
- 📚 **知识图谱**: 自动构建实体关系网络
- 🏷️ **智能标签**: 自动添加标准编号、关键词等

### 查询时 - 多维度检索

- 按文档类型筛选
- 按专业领域筛选
- 按规则类型筛选
- 按标准层级筛选（国标/地标/行标）

## 🐛 常见问题

### Q1: 上传失败 "MinIO upload failed"

**A:** MinIO服务未启动

```bash
docker start milvus-minio
# 等待3-5秒后重试
```

### Q2: 上传失败 "File too large"

**A:** 文件超过限制（默认500MB）

解决方案：
1. 跳过过大的文件
2. 或修改后端上传限制

### Q3: 部分文件上传失败

**A:** 查看失败文件列表，可能原因：
- 文件损坏
- 文件格式不支持
- 文件名特殊字符

可以单独处理失败文件。

### Q4: 想暂停上传

**A:** 按 `Ctrl+C` 即可停止

已上传的文件不会丢失，下次会跳过。

## 📞 技术支持

- 查看后端日志：`docker logs -f milvus-standalone`
- 查看MinIO日志：`docker logs -f milvus-minio`
- 检查数据库：`PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d design_platform`

## 🎉 完成后

上传完成后，可以在前端：
1. 进入【企业知识库】或【个人知识库】
2. 查看所有已上传文档
3. 使用智能问答功能
4. 浏览知识图谱
