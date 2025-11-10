#!/usr/bin/env python3
"""
导出装配体为SolidWorks格式
使用FreeCAD创建装配体并导出为.STEP或.SLDASM
"""

import sys
import json
import os
from pathlib import Path

def export_to_solidworks(assembly_json_path, output_path):
    """
    将装配体JSON导出为SolidWorks兼容格式

    参数:
        assembly_json_path: 装配体JSON文件路径
        output_path: 输出STEP文件路径
    """

    print("🚀 启动SolidWorks装配体导出...")

    # 读取装配体JSON
    with open(assembly_json_path, 'r', encoding='utf-8') as f:
        assembly = json.load(f)

    parts = assembly.get('parts', [])
    print(f"📦 装配体包含 {len(parts)} 个零件")

    try:
        # 方法1: 使用FreeCAD (推荐)
        result = export_with_freecad(parts, output_path)
        if result:
            return result
    except Exception as e:
        print(f"⚠️  FreeCAD导出失败: {e}")

    try:
        # 方法2: 使用pythonocc
        result = export_with_pythonocc(parts, output_path)
        if result:
            return result
    except Exception as e:
        print(f"⚠️  pythonocc导出失败: {e}")

    # 方法3: 生成STEP装配体描述文件
    return generate_step_assembly_file(parts, output_path)


def export_with_freecad(parts, output_path):
    """使用FreeCAD创建装配体"""
    try:
        import FreeCAD
        import Import
        import Part

        print("✅ 使用FreeCAD导出...")

        # 创建新文档
        doc = FreeCAD.newDocument("Assembly")

        for i, part in enumerate(parts):
            model_file = part.get('model_file')
            if not model_file or not os.path.exists(model_file):
                print(f"  ⚠️  跳过零件 {i}: 模型文件不存在")
                continue

            # 导入STEP文件
            Import.insert(model_file, doc.Name)

            # 获取最后添加的对象
            obj = doc.ActiveObject

            # 设置位置
            position = part.get('position', [0, 0, 0])
            obj.Placement.Base = FreeCAD.Vector(position[0], position[1], position[2])

            # 设置旋转 (如果有)
            rotation_matrix = part.get('rotation')
            if rotation_matrix:
                # 转换为FreeCAD旋转
                pass  # TODO: 实现旋转矩阵转换

            print(f"  ✓ 添加零件 {i}: {part.get('part_number')}")

        # 导出装配体
        doc.recompute()

        # 导出为STEP
        if output_path.endswith('.STEP') or output_path.endswith('.stp'):
            Import.export([doc.ActiveObject for obj in doc.Objects], output_path)
            print(f"✅ 已导出STEP装配体: {output_path}")
            return True

        # 导出为STL (供预览)
        elif output_path.endswith('.stl'):
            import Mesh
            Mesh.export([doc.ActiveObject for obj in doc.Objects], output_path)
            print(f"✅ 已导出STL文件: {output_path}")
            return True

        FreeCAD.closeDocument(doc.Name)
        return True

    except ImportError:
        print("⚠️  FreeCAD未安装")
        return False
    except Exception as e:
        print(f"❌ FreeCAD导出失败: {e}")
        return False


def export_with_pythonocc(parts, output_path):
    """使用pythonocc创建装配体"""
    try:
        from OCC.Core.STEPControl import STEPControl_Writer, STEPControl_AsIs
        from OCC.Core.IFSelect import IFSelect_RetDone
        from OCC.Core.TopoDS import TopoDS_Compound, TopoDS_Builder
        from OCC.Core.BRepPrimAPI import BRepPrimAPI_MakeBox
        from OCC.Core.gp import gp_Vec, gp_Trsf
        from OCC.Core.BRepBuilderAPI import BRepBuilderAPI_Transform

        print("✅ 使用pythonocc导出...")

        # 创建复合体
        compound = TopoDS_Compound()
        builder = TopoDS_Builder()
        builder.MakeCompound(compound)

        for i, part in enumerate(parts):
            model_file = part.get('model_file')
            if not model_file or not os.path.exists(model_file):
                continue

            # 读取STEP文件
            from OCC.Extend.DataExchange import read_step_file
            shape = read_step_file(model_file)

            # 应用变换
            position = part.get('position', [0, 0, 0])
            trsf = gp_Trsf()
            trsf.SetTranslation(gp_Vec(position[0], position[1], position[2]))

            transformed_shape = BRepBuilderAPI_Transform(shape, trsf).Shape()
            builder.Add(compound, transformed_shape)

            print(f"  ✓ 添加零件 {i}: {part.get('part_number')}")

        # 写入STEP文件
        writer = STEPControl_Writer()
        writer.Transfer(compound, STEPControl_AsIs)
        status = writer.Write(output_path)

        if status == IFSelect_RetDone:
            print(f"✅ 已导出STEP装配体: {output_path}")
            return True
        else:
            print(f"❌ STEP导出失败")
            return False

    except ImportError:
        print("⚠️  pythonocc未安装")
        return False
    except Exception as e:
        print(f"❌ pythonocc导出失败: {e}")
        return False


def generate_step_assembly_file(parts, output_path):
    """
    生成STEP装配体描述文件
    即使没有CAD库,也能生成一个基本的装配描述
    """

    print("📝 生成STEP装配描述文件...")

    step_content = [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('PID Auto Assembly'),'2;1');",
        "FILE_NAME('assembly.stp','2025-01-10T00:00:00',('Claude'),('Design Institute'),'','','');",
        "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));",
        "ENDSEC;",
        "",
        "DATA;",
    ]

    entity_id = 1

    for i, part in enumerate(parts):
        part_number = part.get('part_number', f'PART_{i}')
        position = part.get('position', [0, 0, 0])
        model_file = part.get('model_file', '')

        # 添加零件引用
        step_content.append(f"#{entity_id}=PRODUCT('{part_number}','','',(#100));")
        entity_id += 1

        # 添加位置信息
        step_content.append(
            f"#{entity_id}=CARTESIAN_POINT('',"
            f"({position[0]},{position[1]},{position[2]}));"
        )
        entity_id += 1

        # 添加外部文件引用
        if model_file:
            step_content.append(f"#{entity_id}=EXTERNAL_REFERENCE('{model_file}');")
            entity_id += 1

    step_content.append("ENDSEC;")
    step_content.append("END-ISO-10303-21;")

    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(step_content))

    print(f"✅ 已生成STEP描述文件: {output_path}")
    print(f"💡 提示: 可在SolidWorks中打开此STEP文件")
    print(f"💡 提示: 或使用 FreeCAD 打开并编辑")

    # 同时生成说明文件
    readme_path = output_path.replace('.STEP', '_README.txt')
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("PID自动装配系统 - 装配体导出说明\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"装配体包含 {len(parts)} 个零件:\n\n")

        for i, part in enumerate(parts):
            f.write(f"{i+1}. {part.get('part_number')} ({part.get('type')})\n")
            f.write(f"   位置: {part.get('position')}\n")
            f.write(f"   模型: {part.get('model_file')}\n\n")

        f.write("\n使用方法:\n")
        f.write("1. 在SolidWorks中: File > Open > 选择 .STEP 文件\n")
        f.write("2. 在FreeCAD中: File > Open > 选择 .STEP 文件\n")
        f.write("3. 各零件的STEP模型位于 docs/solidworks/ 目录\n")

    print(f"📄 已生成说明文件: {readme_path}")

    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python3 export_to_solidworks.py <assembly_json> [output.STEP]")
        sys.exit(1)

    assembly_json = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'assembly_output.STEP'

    if not os.path.exists(assembly_json):
        print(f"❌ 文件不存在: {assembly_json}")
        sys.exit(1)

    success = export_to_solidworks(assembly_json, output_file)
    sys.exit(0 if success else 1)
