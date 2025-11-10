# 文档批量翻译工具

## 功能

- ✅ 批量翻译 DOC/DOCX 和 PDF 文档
- ✅ **1:1 保留原始格式**（字体、样式、表格、图片等）
- ✅ 自动移除页眉页脚
- ✅ 保持原有目录结构
- ✅ 支持增量翻译（已翻译的文件不会重复处理）

## 快速开始

### 1. 准备 API Token

从平台获取翻译 API 的 Token：

```bash
export API_TOKEN="your_token_here"
```

或者在运行脚本时手动输入。

### 2. 运行翻译

```bash
# 方式1: 使用交互式脚本（推荐）
./scripts/run_translate.sh

# 方式2: 直接运行Python脚本
python3 scripts/translate_docs.py --token "your_token"
```

### 3. 选择模式

- **测试模式**: 只翻译1个文件，用于验证功能
- **小批量测试**: 翻译前10个文件，用于验证批量处理
- **完整翻译**: 翻译所有文档（约966个）

## 目录结构

```
docs/
├── specs/                          # 原始文档（英文）
│   ├── CSI 目录清单.pdf
│   ├── CSI 目录逻辑.pdf
│   └── Full Length/
│       ├── 32 - EXTERIOR IMPROVEMENTS/
│       │   ├── 321216 FL - Asphalt Paving.DOC
│       │   └── ...
│       └── ...
│
└── specs_zh/                       # 翻译后的文档（中文）
    ├── CSI 目录清单.pdf
    ├── CSI 目录逻辑.pdf
    └── Full Length/
        ├── 32 - EXTERIOR IMPROVEMENTS/
        │   ├── 321216 FL - Asphalt Paving.docx
        │   └── ...
        └── ...
```

## 技术细节

### DOC/DOCX 处理流程

1. **格式转换**: 将旧的 `.DOC` 格式转换为 `.DOCX`（使用 macOS `textutil`）
2. **内容提取**: 使用 `python-docx` 读取文档结构
3. **移除页眉页脚**: 清空所有页眉和页脚内容
4. **格式保留翻译**:
   - 遍历所有段落和表格
   - 提取文本内容
   - 调用翻译 API
   - **保留原有格式**（字体、颜色、大小、粗体、斜体等）
   - 替换为翻译后的文本
5. **保存**: 生成新的 `.docx` 文档

### PDF 处理流程

1. **文本提取**: 使用 `pdfplumber` 提取文本
2. **翻译**: 调用翻译 API
3. **重新生成**: 使用 `reportlab` 生成新 PDF

### 格式保留实现

```python
# 保存原有格式属性
original_format = {
    'bold': run.bold,
    'italic': run.italic,
    'underline': run.underline,
    'font_name': run.font.name,
    'font_size': run.font.size,
    'font_color': run.font.color.rgb
}

# 翻译文本
translated_text = translate_api(original_text)

# 应用原有格式到翻译后的文本
new_run = paragraph.add_run(translated_text)
new_run.bold = original_format['bold']
new_run.font.name = original_format['font_name']
# ... 应用其他格式属性
```

## 命令行选项

```bash
python3 scripts/translate_docs.py [OPTIONS]

选项:
  --source PATH    源目录 (默认: docs/specs)
  --output PATH    输出目录 (默认: docs/specs_zh)
  --test           测试模式，只处理前3个文件
  --token TOKEN    API Token
  -h, --help       显示帮助信息
```

## 依赖安装

```bash
# Python 依赖
pip3 install python-docx pdfplumber reportlab --break-system-packages

# macOS 系统工具（通常已预装）
# - textutil: DOC到DOCX转换
```

## 故障排除

### 1. 找不到 `python-docx`

```bash
pip3 install python-docx --break-system-packages
```

### 2. DOC 文件转换失败

- 确保运行在 macOS 系统（使用 `textutil`）
- 或者手动预先将 DOC 转换为 DOCX

### 3. 翻译 API 失败

- 检查 API Token 是否正确
- 确认后端服务正在运行
- 检查网络连接

### 4. 格式丢失

- 某些复杂格式可能无法完美保留
- 建议人工检查重要文档
- 可以调整脚本中的格式保留逻辑

## 性能估算

- **单个文件**: 10-30秒（取决于文件大小和API响应）
- **10个文件**: 2-5分钟
- **966个文件**: 约3-8小时

建议分批处理大量文件。

## 进度监控

脚本会实时显示:
- 当前处理的文件
- 进度百分比
- 翻译的段落数
- 错误信息

```
[125/966] 处理文档文件...
处理文档: 321216 FL - Asphalt Paving.DOC
  翻译段落 1/45: SECTION 321216 - ASPHALT PAVING...
  翻译段落 2/45: PART 1 - GENERAL...
  ...
✓ 已保存: docs/specs_zh/Full Length/32 - EXTERIOR IMPROVEMENTS/321216 FL - Asphalt Paving.docx
```

## 注意事项

1. **备份原文件**: 翻译前确保原文件已备份
2. **检查输出**: 翻译后人工抽查部分文件，确保质量
3. **格式限制**: 极复杂的格式可能无法100%保留
4. **增量处理**: 可以多次运行，已存在的文件会被跳过（可选实现）
5. **磁盘空间**: 确保有足够空间存储翻译后的文档

## 许可

内部工具，仅供项目使用。
