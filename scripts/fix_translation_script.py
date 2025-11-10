#!/usr/bin/env python3
"""
修复翻译脚本的补丁
解决问题：
1. 删除所有文本框（包括TIP框）
2. 修复占位符周围文本未翻译的问题
"""

import sys

def create_fixed_script():
    """生成修复后的翻译脚本"""

    # 在translate_docx函数中，页眉页脚删除后，添加文本框删除代码
    textbox_removal_code = '''
        # ========== 新增：删除所有文本框（包括TIP框）==========
        print("  🗑️  删除文本框...")
        deleted_textbox_count = 0
        try:
            # 遍历所有段落，查找并删除包含文本框的段落
            for para in doc.paragraphs[:]:  # 使用切片创建副本，避免修改时出错
                # 检查段落的XML元素中是否包含文本框
                para_xml = para._element.xml
                if b'<w:txbxContent>' in para_xml or b'<v:textbox>' in para_xml:
                    # 删除整个段落（包括文本框）
                    p_element = para._element
                    p_element.getparent().remove(p_element)
                    deleted_textbox_count += 1

            # 同时删除独立的shape对象（浮动文本框）
            from docx.oxml.shared import qn
            body = doc._element.body

            # 删除所有包含文本框的drawing元素
            drawings_to_remove = []
            for drawing in body.findall('.//w:drawing', namespaces=body.nsmap):
                # 检查drawing中是否包含文本框
                if drawing.find('.//wps:txbx', namespaces=body.nsmap) is not None:
                    drawings_to_remove.append(drawing)

            for drawing in drawings_to_remove:
                parent = drawing.getparent()
                if parent is not None:
                    parent.remove(drawing)
                    deleted_textbox_count += 1

            # 删除VML格式的文本框（旧版Word）
            vml_shapes_to_remove = []
            for shape in body.findall('.//v:shape', namespaces={'v': 'urn:schemas-microsoft-com:vml'}):
                if shape.find('.//v:textbox', namespaces={'v': 'urn:schemas-microsoft-com:vml'}) is not None:
                    vml_shapes_to_remove.append(shape)

            for shape in vml_shapes_to_remove:
                parent = shape.getparent()
                if parent is not None:
                    parent.remove(shape)
                    deleted_textbox_count += 1

            print(f"  ✅ 已删除 {deleted_textbox_count} 个文本框")
        except Exception as e:
            print(f"  ⚠️  文本框删除警告: {e}")
        # ========== 文本框删除代码结束 ==========
'''

    # 修改preprocess_text函数，改进占位符处理
    improved_placeholder_code = '''
def preprocess_text(text: str, style_name: str = None) -> tuple[str, bool]:
    """预处理文本（去掉SECTION前缀，去掉列表编号，删除英制单位，翻译章节标题）

    返回: (处理后的文本, 是否已翻译为中文)
    """
    import re

    # 检查是否是章节标题，直接替换为中文
    text_upper = text.strip().upper()
    if text_upper in SECTION_HEADINGS:
        return (SECTION_HEADINGS[text_upper], True)  # 已翻译

    # 处理 "PART 数字 - 标题" 模式
    part_match = re.match(r'^PART\\s+(\\d+)\\s*-?\\s*(.*)$', text_upper)
    if part_match:
        part_num = part_match.group(1)
        part_title = part_match.group(2).strip()
        part_titles = {
            "GENERAL": "总则",
            "PRODUCTS": "产品",
            "EXECUTION": "施工",
            "SUBMITTALS": "提交件",
        }
        if part_title in part_titles:
            return (f"第{part_num}部分 - {part_titles[part_title]}", True)
        elif part_title:
            translated_title = translate_single(part_title)
            return (f"第{part_num}部分 - {translated_title}", True)
        else:
            return (f"第{part_num}部分", True)

    # 处理 "END OF SECTION 数字" 模式
    end_of_section_match = re.match(r'^END OF SECTION\\s+([\\d\\.]+)\\s*$', text_upper)
    if end_of_section_match:
        section_num = end_of_section_match.group(1)
        return (f"第 {section_num} 节结束", True)

    # 去掉 "SECTION " 前缀
    if text_upper.startswith("SECTION "):
        text = re.sub(r'^SECTION\\s+', '', text, flags=re.IGNORECASE)

    # 如果是列表样式，去掉文本开头的编号
    if style_name and any(s in style_name.upper() for s in ['PR', 'LIST', 'CMT']):
        text = re.sub(r'^\\d+[\\.\\)]\\s+', '', text)

    # 删除英制单位表达式
    imperial_patterns = [
        r'\\d+(?:\\.\\d+)?\\s*lb/\\d+(?:\\.\\d+)?\\s*sq\\.\\s*ft\\.?',
        r'\\d+(?:\\.\\d+)?\\s*lb/\\d+(?:\\.\\d+)?\\s*sq\\s+ft\\.?',
        r'\\d+(?:\\.\\d+)?\\s*oz/\\d+(?:\\.\\d+)?\\s*sq\\.\\s*ft\\.?',
        r'\\d+(?:\\.\\d+)?\\s*psi',
        r'\\d+(?:\\.\\d+)?\\s*°F',
    ]

    for pattern in imperial_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # 清理多余的逗号和空格
    text = re.sub(r',\\s*,', ',', text)
    text = re.sub(r'\\s+,', ',', text)
    text = re.sub(r',\\s+\\(', ' (', text)
    text = re.sub(r'\\s{2,}', ' ', text)

    # ========== 改进的占位符处理 ==========
    # 将占位符简化为中文标记，但保留在文本中让整句一起翻译
    # 例如："A. Architect: <Insert name>."
    # 预处理为："A. Architect: 〈待填〉."
    # 然后整句送去翻译，得到："A. 建筑师：〈待填〉。"

    def replace_placeholder(match):
        content = match.group(1).strip()
        # 简化常见占位符，但保留占位符标记让翻译模型知道这是要保留的
        placeholders_map = {
            'name': '姓名',
            'license #': '许可证号',
            'Insert': '待填',
            'load': '荷载值',
        }
        # 尝试匹配简化规则
        for key, value in placeholders_map.items():
            if key.lower() in content.lower():
                return f'〈{value}〉'
        # 默认：简化为"待填"
        return '〈待填〉'

    # 替换所有 <Insert xxx> 格式的占位符
    text = re.sub(r'<Insert\\s+([^>]+)>', replace_placeholder, text, flags=re.IGNORECASE)
    # 替换单独的 <...> 占位符
    text = re.sub(r'<([^>]{1,50})>', replace_placeholder, text)

    # ========== 占位符处理结束 ==========

    return (text, False)  # 未翻译，需要送VLLM
'''

    print("📝 修复脚本补丁已生成")
    print("\n修复内容：")
    print("1. ✅ 在translate_docx()开头添加删除所有文本框的代码")
    print("2. ✅ 改进preprocess_text()中的占位符处理，确保周围文本被翻译")
    print("\n请将以下代码段手动添加到服务器脚本中：")
    print("\n" + "="*60)
    print("【代码段1：在translate_docx函数第769行后添加】")
    print("="*60)
    print(textbox_removal_code)
    print("\n" + "="*60)
    print("【代码段2：替换原有的preprocess_text函数（约128-223行）】")
    print("="*60)
    print(improved_placeholder_code)

    return textbox_removal_code, improved_placeholder_code

if __name__ == "__main__":
    create_fixed_script()
