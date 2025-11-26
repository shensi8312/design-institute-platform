#!/usr/bin/env python3
"""
CSI MasterSpec DOCX 解析器

使用 python-docx 解析 CSI MasterSpec 文档的样式，识别层级结构。

CSI 样式映射：
- SCT: Section 标题 (如 SECTION 092900 - GYPSUM BOARD)
- PRT: Part 标题 (如 PART 1 - GENERAL)
- ART: Article (如 1.1, 1.2, 2.1...)
- PR1: Paragraph Level 1 (A., B., C.)
- PR2: Paragraph Level 2 (1., 2., 3.)
- PR3: Paragraph Level 3 (a., b., c.)
- PR4: Paragraph Level 4 (1), 2), 3))
- PR5: Paragraph Level 5 (a), b), c))
- CMT: Comment (注释，不显示)
- TIP: Tips (提示，不显示)
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from docx import Document
from docx.oxml.ns import qn


@dataclass
class CSINode:
    """CSI 章节节点"""
    id: str
    full_code: str           # 完整编号
    division: str            # Division 编号
    section_code: str        # Section 编号
    level: int               # 层级数字
    level_type: str          # 层级类型: DIV/SEC/PRT/ART/PR1/PR2/PR3/PR4/PR5
    level_label: str         # 层级标签: A./1./a./1)/a)
    title_en: str            # 英文标题
    title_zh: str = ""       # 中文标题
    parent_code: str = ""    # 父节点编号
    sort_order: int = 0      # 排序
    content: str = ""        # 内容文本
    children: List['CSINode'] = None

    def __post_init__(self):
        if self.children is None:
            self.children = []

    def to_dict(self) -> Dict:
        """转换为字典"""
        result = asdict(self)
        result['children'] = [child.to_dict() for child in self.children]
        return result


class CSIDocxParser:
    """CSI MasterSpec DOCX 解析器"""

    # CSI 样式到层级的映射
    STYLE_LEVEL_MAP = {
        'SCT': {'level': 1, 'type': 'SEC'},    # Section
        'PRT': {'level': 2, 'type': 'PRT'},    # Part
        'ART': {'level': 3, 'type': 'ART'},    # Article
        'PR1': {'level': 4, 'type': 'PR1'},    # Paragraph Level 1
        'PR2': {'level': 5, 'type': 'PR2'},    # Paragraph Level 2
        'PR3': {'level': 6, 'type': 'PR3'},    # Paragraph Level 3
        'PR4': {'level': 7, 'type': 'PR4'},    # Paragraph Level 4
        'PR5': {'level': 8, 'type': 'PR5'},    # Paragraph Level 5
    }

    # 忽略的样式（注释、提示等）
    IGNORE_STYLES = {'CMT', 'TIP', 'EXT', 'EXN', 'NOT'}

    def __init__(self):
        self.nodes: List[CSINode] = []
        self.current_section_code = ""
        self.current_division = ""
        self.node_counter = 0
        self.part_counter = 0  # Track PART number for auto-increment
        self.article_counter = 0  # Track Article number within current PART
        self.current_part_num = "1"  # Track current PART number
        # 自动编号计数器（当原文没有编号时自动生成）
        self.pr1_counter = 0  # A, B, C...
        self.pr2_counter = 0  # 1, 2, 3...
        self.pr3_counter = 0  # a, b, c...
        self.pr4_counter = 0  # 1), 2), 3)...
        self.pr5_counter = 0  # a), b), c)...

    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        解析 CSI MasterSpec DOCX 文件

        Args:
            file_path: DOCX 文件路径

        Returns:
            解析结果字典
        """
        doc = Document(file_path)
        self.nodes = []
        self.node_counter = 0
        self.part_counter = 0
        self.article_counter = 0
        self.current_part_num = "1"
        self.pr1_counter = 0
        self.pr2_counter = 0
        self.pr3_counter = 0
        self.pr4_counter = 0
        self.pr5_counter = 0

        # 解析所有段落
        for para in doc.paragraphs:
            self._process_paragraph(para)

        # 构建树形结构
        tree = self._build_tree()

        # 生成扁平列表
        flat_list = self._flatten(tree)

        return {
            'file_path': file_path,
            'section_code': self.current_section_code,
            'division': self.current_division,
            'tree': [node.to_dict() for node in tree],
            'flat_list': [node.to_dict() for node in flat_list],
            'stats': {
                'total_nodes': len(flat_list),
                'by_level': self._count_by_level(flat_list)
            }
        }

    def _process_paragraph(self, para) -> Optional[CSINode]:
        """处理单个段落"""
        style_name = self._get_style_name(para)
        text = para.text.strip()

        if not text or not style_name:
            return None

        # 忽略注释和提示样式
        if style_name in self.IGNORE_STYLES:
            return None

        # 获取层级信息
        level_info = self.STYLE_LEVEL_MAP.get(style_name)
        if not level_info:
            return None

        # 解析节点
        node = self._create_node(text, style_name, level_info)
        if node:
            self.nodes.append(node)
            return node

        return None

    def _get_style_name(self, para) -> str:
        """获取段落样式名称"""
        if para.style and para.style.name:
            return para.style.name.upper()
        return ""

    def _create_node(self, text: str, style_name: str, level_info: Dict) -> Optional[CSINode]:
        """创建 CSI 节点"""
        self.node_counter += 1
        level = level_info['level']
        level_type = level_info['type']

        # Section 标题解析
        if style_name == 'SCT':
            return self._parse_section_title(text, level, level_type)

        # Part 标题解析
        if style_name == 'PRT':
            return self._parse_part_title(text, level, level_type)

        # Article 解析
        if style_name == 'ART':
            return self._parse_article(text, level, level_type)

        # Paragraph 解析
        if style_name.startswith('PR'):
            return self._parse_paragraph(text, style_name, level, level_type)

        return None

    def _parse_section_title(self, text: str, level: int, level_type: str) -> CSINode:
        """解析 Section 标题"""
        # 格式: SECTION 092900 - GYPSUM BOARD
        match = re.match(r'SECTION\s+(\d{2})\s*(\d{2})\s*(\d{2})\s*[-–]\s*(.+)', text, re.IGNORECASE)

        if match:
            div, sub1, sub2, title = match.groups()
            self.current_division = div
            self.current_section_code = f"{div}{sub1}{sub2}"
            # CSI标准格式：09 29 00（带空格）
            full_code = f"{div} {sub1} {sub2}"

            return CSINode(
                id=f"node_{self.node_counter}",
                full_code=full_code,
                division=self.current_division,
                section_code=self.current_section_code,
                level=level,
                level_type=level_type,
                level_label="",
                title_en=title.strip(),
                sort_order=self.node_counter
            )

        # 兼容其他格式
        return CSINode(
            id=f"node_{self.node_counter}",
            full_code=self.current_section_code or "UNKNOWN",
            division=self.current_division or "00",
            section_code=self.current_section_code or "000000",
            level=level,
            level_type=level_type,
            level_label="",
            title_en=text,
            sort_order=self.node_counter
        )

    def _parse_part_title(self, text: str, level: int, level_type: str) -> CSINode:
        """解析 Part 标题"""
        # 格式: PART 1 - GENERAL 或 PART 1  GENERAL
        match = re.match(r'PART\s+(\d+)\s*[-–]?\s*(.+)', text, re.IGNORECASE)

        if match:
            part_num, title = match.groups()
            title = title.strip()
        else:
            # No number in text - use auto-increment counter
            self.part_counter += 1
            part_num = str(self.part_counter)
            title = text.strip()

        # Save current part number and reset article counter
        self.current_part_num = part_num
        self.article_counter = 0

        full_code = f"{self.current_section_code}.P{part_num}"

        return CSINode(
            id=f"node_{self.node_counter}",
            full_code=full_code,
            division=self.current_division,
            section_code=self.current_section_code,
            level=level,
            level_type=level_type,
            level_label=f"PART {part_num}",
            title_en=title,
            parent_code=self.current_section_code,
            sort_order=self.node_counter
        )

    def _parse_article(self, text: str, level: int, level_type: str) -> CSINode:
        """解析 Article"""
        # 格式: 1.1 SUMMARY 或 2.3 MATERIALS
        match = re.match(r'^(\d+)\.(\d+)\s+(.+)', text)

        if match:
            part_num, art_num, title = match.groups()
            # Update current_part_num if different
            self.current_part_num = part_num
        else:
            # No number in text - use auto-increment counter
            self.article_counter += 1
            part_num = self.current_part_num
            art_num = str(self.article_counter)
            title = text.strip()

        full_code = f"{self.current_section_code}.{part_num}.{art_num}"
        parent_code = f"{self.current_section_code}.P{part_num}"
        label = f"{part_num}.{art_num}"

        # 遇到新的 Article，重置 PR1 计数器
        self.pr1_counter = 0

        return CSINode(
            id=f"node_{self.node_counter}",
            full_code=full_code,
            division=self.current_division,
            section_code=self.current_section_code,
            level=level,
            level_type=level_type,
            level_label=label,
            title_en=title.strip() if isinstance(title, str) else title,
            parent_code=parent_code,
            sort_order=self.node_counter
        )

    def _parse_paragraph(self, text: str, style_name: str, level: int, level_type: str) -> CSINode:
        """解析 Paragraph 层级"""
        # 提取层级标签
        label = ""
        content = text

        if level_type == 'PR1':
            # A. B. C. - 先尝试匹配，匹配不到则自动生成
            match = re.match(r'^([A-Z])\.?\s+(.+)', text)
            if match:
                label, content = match.groups()
                label = f"{label}."
                # 更新计数器
                self.pr1_counter = ord(label[0]) - ord('A') + 1
            else:
                # 自动生成编号
                self.pr1_counter += 1
                label = f"{chr(ord('A') + self.pr1_counter - 1)}."
            # 重置下级计数器
            self.pr2_counter = 0
        elif level_type == 'PR2':
            # 1. 2. 3.
            match = re.match(r'^(\d+)\.?\s+(.+)', text)
            if match:
                label, content = match.groups()
                label = f"{label}."
                self.pr2_counter = int(label[:-1])
            else:
                # 自动生成编号
                self.pr2_counter += 1
                label = f"{self.pr2_counter}."
            # 重置下级计数器
            self.pr3_counter = 0
        elif level_type == 'PR3':
            # a. b. c.
            match = re.match(r'^([a-z])\.?\s+(.+)', text)
            if match:
                label, content = match.groups()
                label = f"{label}."
                self.pr3_counter = ord(label[0]) - ord('a') + 1
            else:
                # 自动生成编号
                self.pr3_counter += 1
                label = f"{chr(ord('a') + self.pr3_counter - 1)}."
            # 重置下级计数器
            self.pr4_counter = 0
        elif level_type == 'PR4':
            # 1) 2) 3)
            match = re.match(r'^(\d+)\)\s+(.+)', text)
            if match:
                label, content = match.groups()
                label = f"{label})"
                self.pr4_counter = int(label[:-1])
            else:
                # 自动生成编号
                self.pr4_counter += 1
                label = f"{self.pr4_counter})"
            # 重置下级计数器
            self.pr5_counter = 0
        elif level_type == 'PR5':
            # a) b) c)
            match = re.match(r'^([a-z])\)\s+(.+)', text)
            if match:
                label, content = match.groups()
                label = f"{label})"
                self.pr5_counter = ord(label[0]) - ord('a') + 1
            else:
                # 自动生成编号
                self.pr5_counter += 1
                label = f"{chr(ord('a') + self.pr5_counter - 1)})"

        # 构建 full_code（需要找到父节点）
        full_code = f"{self.current_section_code}.{level_type}_{self.node_counter}"

        return CSINode(
            id=f"node_{self.node_counter}",
            full_code=full_code,
            division=self.current_division,
            section_code=self.current_section_code,
            level=level,
            level_type=level_type,
            level_label=label,
            title_en=content.strip() if content != text else "",
            content=text,
            sort_order=self.node_counter
        )

    def _build_tree(self) -> List[CSINode]:
        """构建树形结构"""
        if not self.nodes:
            return []

        root_nodes = []
        stack = []

        for node in self.nodes:
            # 清空到合适的层级
            while stack and stack[-1].level >= node.level:
                stack.pop()

            if stack:
                # 设置父节点
                parent = stack[-1]
                node.parent_code = parent.full_code
                parent.children.append(node)
            else:
                # 根节点
                root_nodes.append(node)

            stack.append(node)

        return root_nodes

    def _flatten(self, tree: List[CSINode]) -> List[CSINode]:
        """扁平化树结构"""
        result = []

        def traverse(nodes):
            for node in nodes:
                # 创建无 children 的副本
                flat_node = CSINode(
                    id=node.id,
                    full_code=node.full_code,
                    division=node.division,
                    section_code=node.section_code,
                    level=node.level,
                    level_type=node.level_type,
                    level_label=node.level_label,
                    title_en=node.title_en,
                    title_zh=node.title_zh,
                    parent_code=node.parent_code,
                    sort_order=node.sort_order,
                    content=node.content
                )
                result.append(flat_node)

                if node.children:
                    traverse(node.children)

        traverse(tree)
        return result

    def _count_by_level(self, flat_list: List[CSINode]) -> Dict[str, int]:
        """按层级统计"""
        counts = {}
        for node in flat_list:
            level_type = node.level_type
            counts[level_type] = counts.get(level_type, 0) + 1
        return counts


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Usage: python csi_docx_parser.py <file_path>'
        }))
        sys.exit(1)

    file_path = sys.argv[1]

    if not Path(file_path).exists():
        print(json.dumps({
            'error': f'File not found: {file_path}'
        }))
        sys.exit(1)

    try:
        parser = CSIDocxParser()
        result = parser.parse(file_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
