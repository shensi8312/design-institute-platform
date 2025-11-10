#!/usr/bin/env python3
"""
使用XCAFDoc提取STEP装配体的完整结构
包括零件名称、位置、颜色、装配层级
"""
import sys
import json
import re
from OCC.Core.STEPCAFControl import STEPCAFControl_Reader
from OCC.Core.TDocStd import TDocStd_Document
from OCC.Core.XCAFApp import XCAFApp_Application
from OCC.Core.XCAFDoc import (XCAFDoc_DocumentTool_ShapeTool,
                               XCAFDoc_DocumentTool_ColorTool,
                               XCAFDoc_DocumentTool_LayerTool)
from OCC.Core.TDF import TDF_LabelSequence, TDF_Label
from OCC.Core.TCollection import TCollection_ExtendedString
from OCC.Core.Quantity import Quantity_Color, Quantity_TOC_RGB
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_FACE
from OCC.Core.gp import gp_Trsf

def parse_step_assembly(step_file_path):
    """使用XCAF解析STEP装配体"""

    # 创建应用和文档
    app = XCAFApp_Application.GetApplication()
    doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
    app.InitDocument(doc)

    # 读取STEP文件
    reader = STEPCAFControl_Reader()
    reader.SetColorMode(True)
    reader.SetNameMode(True)
    reader.SetLayerMode(True)

    status = reader.ReadFile(step_file_path)
    if status != 1:  # IFSelect_RetDone
        return {"success": False, "error": "Failed to read STEP file"}

    reader.Transfer(doc)

    # 获取形状工具和颜色工具
    shape_tool = XCAFDoc_DocumentTool_ShapeTool(doc.Main())
    color_tool = XCAFDoc_DocumentTool_ColorTool(doc.Main())

    # 获取所有顶层组件
    labels = TDF_LabelSequence()
    shape_tool.GetFreeShapes(labels)

    geometries = []
    materials = []
    objects = []
    part_idx = 0

    print(f"找到 {labels.Length()} 个顶层组件", file=sys.stderr)

    def process_label(label, location=TopLoc_Location(), parent_name=""):
        """递归处理标签"""
        nonlocal part_idx

        # 获取形状
        if not shape_tool.IsShape(label):
            return

        shape = shape_tool.GetShape(label)

        # 获取名称
        name_str = ""
        if shape_tool.GetReferredShape(label)[0]:
            ref_label = shape_tool.GetReferredShape(label)[1]
            name = TCollection_ExtendedString()
            if shape_tool.GetName(ref_label, name):
                name_str = name.ToExtString()

        if not name_str:
            name = TCollection_ExtendedString()
            if shape_tool.GetName(label, name):
                name_str = name.ToExtString()

        if not name_str:
            name_str = f"Part_{part_idx}"

        # 获取位置
        if shape_tool.IsComponent(label):
            loc = shape_tool.GetLocation(label)
            location = location.Multiplied(loc)

        # 获取颜色
        color = Quantity_Color()
        has_color = color_tool.GetColor(label, 0, color)  # 0 = XCAFDoc_ColorSurf
        if not has_color:
            has_color = color_tool.GetColor(shape, 0, color)

        if not has_color:
            color.SetValues(0.7, 0.7, 0.7, Quantity_TOC_RGB)

        # 如果是简单形状（不是装配体），提取几何体
        if shape_tool.IsSimpleShape(label):
            print(f"处理零件: {name_str}", file=sys.stderr)

            # 应用位置变换
            shape_with_location = shape.Located(location)

            # 网格化
            mesh = BRepMesh_IncrementalMesh(shape_with_location, 0.1, False, 0.5, True)
            mesh.Perform()

            # 提取顶点
            vertices = []
            normals = []

            face_explorer = TopExp_Explorer(shape_with_location, TopAbs_FACE)
            while face_explorer.More():
                face = face_explorer.Current()
                facing = BRep_Tool.Triangulation(face, TopLoc_Location())

                if facing:
                    for i in range(1, facing.NbTriangles() + 1):
                        triangle = facing.Triangle(i)
                        for j in range(1, 4):
                            vertex = facing.Node(triangle.Value(j))
                            vertices.extend([vertex.X(), vertex.Y(), vertex.Z()])
                            normals.extend([0, 0, 1])

                face_explorer.Next()

            if len(vertices) > 0:
                # 几何体
                geometries.append({
                    "uuid": f"geo-{part_idx}",
                    "type": "BufferGeometry",
                    "data": {
                        "attributes": {
                            "position": {
                                "itemSize": 3,
                                "type": "Float32Array",
                                "array": vertices
                            },
                            "normal": {
                                "itemSize": 3,
                                "type": "Float32Array",
                                "array": normals
                            }
                        }
                    }
                })

                # 材质
                color_int = int(color.Red() * 255) << 16 | int(color.Green() * 255) << 8 | int(color.Blue() * 255)
                materials.append({
                    "uuid": f"mat-{part_idx}",
                    "type": "MeshStandardMaterial",
                    "color": color_int,
                    "metalness": 0.5,
                    "roughness": 0.5
                })

                # 对象 - 位置已经应用到顶点上，使用单位矩阵
                objects.append({
                    "uuid": f"obj-{part_idx}",
                    "type": "Mesh",
                    "name": name_str,
                    "geometry": f"geo-{part_idx}",
                    "material": f"mat-{part_idx}",
                    "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
                })

                part_idx += 1

        # 递归处理子组件
        if shape_tool.IsCompound(label) or shape_tool.IsAssembly(label):
            children = TDF_LabelSequence()
            shape_tool.GetComponents(label, children)

            for i in range(1, children.Length() + 1):
                child_label = children.Value(i)
                process_label(child_label, location, name_str)

    # 处理所有顶层组件
    for i in range(1, labels.Length() + 1):
        label = labels.Value(i)
        process_label(label)

    # 生成结果
    result = {
        "metadata": {
            "version": 4.5,
            "type": "Object",
            "generator": "XCAF-STEP-Assembly-Parser",
            "source": step_file_path.split('/')[-1]
        },
        "geometries": geometries,
        "materials": materials,
        "object": {
            "type": "Scene",
            "children": objects
        }
    }

    return {"success": True, "data": result}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing STEP file path"}))
        sys.exit(1)

    result = parse_step_assembly(sys.argv[1])
    print(json.dumps(result))
