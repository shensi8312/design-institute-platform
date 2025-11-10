#!/usr/bin/env python3
"""
创建修复后的完整翻译脚本
"""
import re

# 读取原始脚本
with open('/tmp/translate_docs_from_server.py', 'r', encoding='utf-8') as f:
    original_script = f.read()

# 修复1: 在第769行后（页脚删除后）插入文本框删除代码
textbox_deletion_code = '''
        # ========== 删除所有文本框（包括TIP框）==========
        print("  🗑️  删除文本框...")
        deleted_textbox_count = 0
        try:
            # 方法1: 删除段落中的文本框
            paragraphs_with_textbox = []
            for para in doc.paragraphs:
                para_xml = para._element.xml
                if b'<w:txbxContent>' in para_xml or b'<v:textbox>' in para_xml:
                    paragraphs_with_textbox.append(para)

            for para in paragraphs_with_textbox:
                p_element = para._element
                p_element.getparent().remove(p_element)
                deleted_textbox_count += 1

            # 方法2: 删除body中的独立shape对象
            body = doc._element.body

            # 删除现代格式的文本框 (drawing with txbx)
            for drawing in body.findall('.//w:drawing', namespaces=body.nsmap):
                if drawing.find('.//wps:txbx', namespaces=body.nsmap) is not None:
                    parent = drawing.getparent()
                    if parent is not None:
                        parent.remove(drawing)
                        deleted_textbox_count += 1

            # 删除VML格式的文本框（旧版Word）
            for shape in body.findall('.//v:shape', namespaces={'v': 'urn:schemas-microsoft-com:vml'}):
                if shape.find('.//v:textbox', namespaces={'v': 'urn:schemas-microsoft-com:vml'}) is not None:
                    parent = shape.getparent()
                    if parent is not None:
                        parent.remove(shape)
                        deleted_textbox_count += 1

            print(f"  ✅ 已删除 {deleted_textbox_count} 个文本框")
        except Exception as e:
            print(f"  ⚠️  文本框删除警告: {e}")
'''

# 修复2: 改进占位符处理，确保周围文本被翻译
improved_placeholder_handling = '''    # 改进的占位符处理：简化但保留标记，让整句一起翻译
    def replace_placeholder(match):
        content = match.group(1).strip()
        # 简化占位符为中文，但保持简短
        simple_placeholders = {
            'name': '姓名',
            'Name': '姓名',
            'license #': '证号',
            'license': '证书',
            'load': '荷载',
        }
        for key, value in simple_placeholders.items():
            if key.lower() in content.lower():
                return f'〈{value}〉'
        return '〈待填〉'

    # 替换占位符但保留在句子中
    text = re.sub(r'<Insert\\s+([^>]+)>', replace_placeholder, text, flags=re.IGNORECASE)
    text = re.sub(r'<([^>]{1,50})>', replace_placeholder, text)'''

# 应用修复
fixed_script = original_script

# 插入文本框删除代码（在第768行 even_page_footer 清空后）
insertion_point = fixed_script.find("section.even_page_footer._element.clear()")
if insertion_point != -1:
    # 找到这行的结尾
    line_end = fixed_script.find('\n', insertion_point)
    fixed_script = fixed_script[:line_end+1] + textbox_deletion_code + fixed_script[line_end+1:]
    print("✅ 已插入文本框删除代码")
else:
    print("⚠️  未找到插入点")

# 替换占位符处理代码
old_placeholder_pattern = r'''    # 替换模板占位符为中文.*?text = re\.sub\(r'<Insert\\s\+\(\[^>\]\+\)>', replace_placeholder, text, flags=re\.IGNORECASE\)'''

if re.search(old_placeholder_pattern, fixed_script, re.DOTALL):
    fixed_script = re.sub(old_placeholder_pattern, improved_placeholder_handling, fixed_script, flags=re.DOTALL)
    print("✅ 已替换占位符处理代码")
else:
    print("⚠️  未找到占位符处理代码")

# 保存修复后的脚本
output_path = '/Users/shenguoli/Documents/projects/design-institute-platform/scripts/translate_docs_fixed.py'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(fixed_script)

print(f"\n✅ 修复后的脚本已保存到: {output_path}")
print("\n修复内容：")
print("1. ✅ 添加完整的文本框删除代码（支持新旧格式）")
print("2. ✅ 改进占位符处理，确保周围英文文本被翻译")
print(f"\n脚本大小: {len(fixed_script)} 字符")
