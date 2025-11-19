# Docling 文档解析服务

基于 IBM Docling 的结构化文档解析微服务,用于解析 PDF/Word 文档并提取章节结构、表格等信息。

## 功能特性

- ✅ PDF 结构化解析 (保留章节层级、编号、表格)
- ✅ Word 文档解析
- ✅ 自动提取标题层级 (1.1, 2.3.4 等)
- ✅ 表格数据提取
- ✅ 页眉页脚识别
- ✅ HTTP API 接口

## 技术栈

- Python 3.9+
- Flask (Web 框架)
- Docling (文档解析引擎)

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
python app.py
```

服务默认运行在 `http://localhost:7001`

## API 接口

### POST /parse

解析文档并返回结构化数据

**请求:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` (PDF/DOCX 文件)

**响应示例:**
```json
{
  "success": true,
  "structure": {
    "sections": [
      {
        "code": "1.1",
        "title": "项目概述",
        "level": 2,
        "content": "...",
        "page": 1
      }
    ],
    "tables": [
      {
        "page": 5,
        "caption": "设备清单",
        "data": [[...]]
      }
    ]
  },
  "raw_text": "完整文本内容...",
  "total_pages": 50
}
```

## 与主系统集成

主系统通过 HTTP 调用此服务:

```javascript
// Node.js 示例
const FormData = require('form-data');
const axios = require('axios');

const form = new FormData();
form.append('file', fileBuffer, { filename: 'document.pdf' });

const response = await axios.post('http://localhost:7001/parse', form, {
  headers: form.getHeaders()
});

console.log(response.data.structure);
```

## Docker 部署

```bash
docker build -t docling-parser .
docker run -p 7001:7001 docling-parser
```
