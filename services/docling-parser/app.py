#!/usr/bin/env python3
"""
Docling 文档解析服务
提供 HTTP API 接口用于解析 PDF/Word 文档
"""

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import tempfile
import os
import traceback

# Docling 导入
try:
    from docling.document_converter import DocumentConverter
    DOCLING_AVAILABLE = True
except ImportError:
    print("⚠️  Docling 未安装,请运行: pip install docling")
    DOCLING_AVAILABLE = False

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB 最大文件


class DoclingParser:
    """Docling 解析器封装"""

    def __init__(self):
        if not DOCLING_AVAILABLE:
            raise RuntimeError("Docling 未安装")
        self.converter = DocumentConverter()

    def parse_document(self, file_path):
        """解析文档并返回结构化数据"""
        try:
            print(f"[Docling] 开始解析: {file_path}")

            # 使用 Docling 转换文档
            result = self.converter.convert(file_path)

            # 提取结构化数据
            structured_data = {
                "success": True,
                "structure": {
                    "sections": self._extract_sections(result),
                    "tables": self._extract_tables(result),
                    "metadata": self._extract_metadata(result)
                },
                "raw_text": self._extract_text(result),
                "total_pages": self._get_page_count(result)
            }

            print(f"[Docling] ✅ 解析成功: {len(structured_data['structure']['sections'])} 个章节")
            return structured_data

        except Exception as e:
            print(f"[Docling] ❌ 解析失败: {str(e)}")
            traceback.print_exc()
            raise

    def _extract_sections(self, doc):
        """提取章节结构"""
        sections = []

        # Docling 解析出的文档对象包含层级结构
        # 遍历所有标题元素
        for item in doc.document.body:
            if hasattr(item, 'label') and item.label.startswith('heading'):
                # 提取章节编号和标题
                section_data = {
                    "code": self._extract_section_code(item.text),
                    "title": self._extract_section_title(item.text),
                    "level": self._get_heading_level(item.label),
                    "content": self._get_section_content(item),
                    "page": getattr(item, 'page_number', 0)
                }
                sections.append(section_data)

        return sections

    def _extract_section_code(self, text):
        """从文本中提取章节编号 (如 "1.1", "2.3.4")"""
        import re
        # 匹配常见的章节编号格式
        match = re.match(r'^([\d\.]+)\s+', text)
        if match:
            return match.group(1).rstrip('.')
        return ""

    def _extract_section_title(self, text):
        """提取章节标题 (去掉编号)"""
        import re
        # 去掉前面的编号
        title = re.sub(r'^[\d\.\s]+', '', text)
        return title.strip()

    def _get_heading_level(self, label):
        """获取标题级别 (heading-1 -> 1)"""
        import re
        match = re.search(r'heading-?(\d+)', label, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 1

    def _get_section_content(self, heading_item):
        """获取章节内容 (标题后的段落)"""
        # TODO: 实现获取标题后的段落内容
        # 需要遍历文档树获取同级或子级的段落
        return ""

    def _extract_tables(self, doc):
        """提取表格数据"""
        tables = []

        for item in doc.document.body:
            if hasattr(item, 'label') and item.label == 'table':
                table_data = {
                    "page": getattr(item, 'page_number', 0),
                    "caption": getattr(item, 'caption', ''),
                    "data": self._convert_table_to_array(item)
                }
                tables.append(table_data)

        return tables

    def _convert_table_to_array(self, table_item):
        """将表格转换为二维数组"""
        # TODO: 实现表格数据提取
        # Docling 表格对象需要转换为标准的二维数组格式
        return []

    def _extract_metadata(self, doc):
        """提取文档元数据"""
        metadata = {}
        if hasattr(doc.document, 'metadata'):
            metadata = {
                "title": getattr(doc.document.metadata, 'title', ''),
                "author": getattr(doc.document.metadata, 'author', ''),
                "creation_date": str(getattr(doc.document.metadata, 'creation_date', ''))
            }
        return metadata

    def _extract_text(self, doc):
        """提取完整文本"""
        if hasattr(doc.document, 'export_to_text'):
            return doc.document.export_to_text()
        elif hasattr(doc, 'text'):
            return doc.text
        return ""

    def _get_page_count(self, doc):
        """获取页数"""
        if hasattr(doc.document, 'num_pages'):
            return doc.document.num_pages
        return 1


# 初始化解析器
parser = None
if DOCLING_AVAILABLE:
    try:
        parser = DoclingParser()
        print("✅ Docling 解析器初始化成功")
    except Exception as e:
        print(f"❌ Docling 解析器初始化失败: {e}")


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        "status": "ok",
        "docling_available": DOCLING_AVAILABLE,
        "parser_ready": parser is not None
    })


@app.route('/parse', methods=['POST'])
def parse_document():
    """解析文档接口"""

    # 检查 Docling 是否可用
    if not DOCLING_AVAILABLE or parser is None:
        return jsonify({
            "success": False,
            "error": "Docling 解析器不可用,请检查依赖安装"
        }), 500

    # 检查文件上传
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "未找到上传文件"
        }), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "文件名为空"
        }), 400

    # 保存临时文件
    try:
        filename = secure_filename(file.filename)
        suffix = os.path.splitext(filename)[1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # 解析文档
        result = parser.parse_document(tmp_path)

        # 清理临时文件
        os.unlink(tmp_path)

        return jsonify(result)

    except Exception as e:
        # 清理临时文件
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass

        print(f"[API] 解析失败: {str(e)}")
        traceback.print_exc()

        return jsonify({
            "success": False,
            "error": f"文档解析失败: {str(e)}"
        }), 500


@app.route('/', methods=['GET'])
def index():
    """根路径"""
    return jsonify({
        "service": "Docling Document Parser",
        "version": "1.0.0",
        "endpoints": {
            "/health": "GET - 健康检查",
            "/parse": "POST - 解析文档 (multipart/form-data)"
        }
    })


if __name__ == '__main__':
    print("🚀 启动 Docling 文档解析服务...")
    print("📍 监听端口: 7001")
    print("📖 API 文档: http://localhost:7001/")

    app.run(
        host='0.0.0.0',
        port=7001,
        debug=True
    )
