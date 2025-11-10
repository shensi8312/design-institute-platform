#!/usr/bin/env python3
"""
从STEP文件提取颜色信息
"""
import sys
import os
import json
from pathlib import Path

try:
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.TopExp import TopExp_Explorer
    from OCC.Core.TopAbs import TopAbs_SOLID
    from OCC.Core.Quantity import Quantity_Color, Quantity_TOC_RGB
    from OCC.Core.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorType
    from OCC.Core.XCAFApp import XCAFApp_Application
    from OCC.Core.TDocStd import TDocStd_Document
    from OCC.Core.STEPCAFControl import STEPCAFControl_Reader
    from OCC.Core.TDF import TDF_LabelSequence
    from OCC.Core.TCollection import TCollection_ExtendedString
except ImportError:
    print("❌ 需要pythonocc-core")
    sys.exit(1)

def extract_colors_from_step(step_file):
    """从STEP文件提取颜色"""
    colors = {}

    try:
        # 使用XCAFDoc读取颜色信息
        app = XCAFApp_Application.GetApplication()
        doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
        app.NewDocument(TCollection_ExtendedString("MDTV-XCAF"), doc)

        reader = STEPCAFControl_Reader()
        reader.SetColorMode(True)
        reader.SetNameMode(True)
        reader.SetLayerMode(True)

        status = reader.ReadFile(step_file)
        if status != 1:
            return None

        reader.Transfer(doc)

        # 获取颜色工具
        h_doc = doc.GetHandle()
        color_tool = XCAFDoc_DocumentTool.ColorTool(h_doc.GetObject().Label())
        shape_tool = XCAFDoc_DocumentTool.ShapeTool(h_doc.GetObject().Label())

        # 获取所有形状标签
        labels = TDF_LabelSequence()
        shape_tool.GetShapes(labels)

        # 提取颜色
        default_color = None

        for i in range(1, labels.Length() + 1):
            label = labels.Value(i)

            # 获取形状颜色
            color = Quantity_Color()
            if color_tool.GetColor(label, XCAFDoc_ColorType.XCAFDoc_ColorSurf, color):
                rgb = (
                    int(color.Red() * 255),
                    int(color.Green() * 255),
                    int(color.Blue() * 255)
                )

                if default_color is None:
                    default_color = rgb

        return default_color

    except Exception as e:
        print(f"  ⚠️  颜色提取失败: {e}")
        return None

def batch_extract_colors(step_dir, output_file):
    """批量提取颜色"""
    color_map = {}

    step_files = list(Path(step_dir).glob('*.STEP'))
    total = len(step_files)

    print(f"📂 找到 {total} 个STEP文件")
    print(f"🎨 开始提取颜色...\n")

    for i, step_file in enumerate(step_files, 1):
        part_name = step_file.stem
        print(f"[{i}/{total}] {part_name}")

        color = extract_colors_from_step(str(step_file))

        if color:
            color_map[part_name] = {
                'rgb': color,
                'hex': '#{:02x}{:02x}{:02x}'.format(*color)
            }
            print(f"    ✅ 颜色: {color_map[part_name]['hex']}")
        else:
            print(f"    ⏭️  使用默认颜色")

    # 保存颜色映射
    with open(output_file, 'w') as f:
        json.dump(color_map, f, indent=2)

    print(f"\n✅ 颜色映射已保存: {output_file}")
    print(f"📊 提取成功: {len(color_map)}/{total}")

    return color_map

if __name__ == "__main__":
    step_dir = "../../docs/solidworks"
    output_file = "src/uploads/step_colors.json"

    batch_extract_colors(step_dir, output_file)
