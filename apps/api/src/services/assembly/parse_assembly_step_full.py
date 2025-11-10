#!/usr/bin/env python3
"""
完整解析STEP装配体
提取所有子零件的几何体、变换矩阵、生成Three.js JSON
"""
import sys
import json
import re
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_VERTEX
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopoDS import topods
from OCC.Core.gp import gp_Trsf
from OCC.Core.TopLoc import TopLoc_Location

def extract_color_from_step_text(step_file_path):
    """从STEP文本中提取颜色"""
    try:
        with open(step_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        color_pattern = r'COLOUR_RGB\s*\([^,]*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)'
        matches = re.findall(color_pattern, content)

        if matches:
            r, g, b = matches[0]
            return {'r': float(r), 'g': float(g), 'b': float(b)}
    except Exception:
        pass

    return {'r': 0.7, 'g': 0.7, 'b': 0.7}

def parse_assembly_step(step_file_path):
    """解析STEP装配体"""
    reader = STEPControl_Reader()
    status = reader.ReadFile(step_file_path)

    if status != IFSelect_RetDone:
        return {"success": False, "error": "Failed to read STEP file"}

    reader.TransferRoots()
    shape = reader.OneShape()

    # 提取默认颜色
    default_color = extract_color_from_step_text(step_file_path)

    # 遍历所有实体
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    geometries = []
    materials = []
    objects = []
    part_idx = 0

    while explorer.More():
        solid = topods.Solid(explorer.Current())
        location = solid.Location()

        # 网格化
        mesh = BRepMesh_IncrementalMesh(solid, 0.1, False, 0.5, True)
        mesh.Perform()

        # 提取三角面片
        vertices = []
        normals = []

        face_explorer = TopExp_Explorer(solid, TopAbs_FACE)
        while face_explorer.More():
            face = face_explorer.Current()
            facing = BRep_Tool.Triangulation(face, location)

            if facing:
                for i in range(1, facing.NbTriangles() + 1):
                    triangle = facing.Triangle(i)
                    for j in range(1, 4):
                        vertex = facing.Node(triangle.Value(j))
                        vertices.extend([vertex.X(), vertex.Y(), vertex.Z()])
                        normals.extend([0, 0, 1])  # 简化法向量

            face_explorer.Next()

        if len(vertices) == 0:
            explorer.Next()
            continue

        # 提取变换矩阵
        trsf = location.Transformation()
        translation = trsf.TranslationPart()

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

        # 材质（使用不同颜色区分）
        colors = [
            0x999999, 0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa8dadc,
            0xf1faee, 0xe63946, 0x457b9d, 0x1d3557
        ]
        materials.append({
            "uuid": f"mat-{part_idx}",
            "type": "MeshStandardMaterial",
            "color": colors[part_idx % len(colors)],
            "metalness": 0.5,
            "roughness": 0.5
        })

        # 对象
        objects.append({
            "uuid": f"obj-{part_idx}",
            "type": "Mesh",
            "name": f"Part_{part_idx}",
            "geometry": f"geo-{part_idx}",
            "material": f"mat-{part_idx}",
            "matrix": [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                translation.X(), translation.Y(), translation.Z(), 1
            ]
        })

        part_idx += 1
        explorer.Next()

    # 生成Three.js装配体JSON
    result = {
        "metadata": {
            "version": 4.5,
            "type": "Object",
            "generator": "Real-STEP-Assembly-Parser",
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

    result = parse_assembly_step(sys.argv[1])
    print(json.dumps(result))
