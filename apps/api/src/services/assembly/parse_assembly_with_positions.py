#!/usr/bin/env python3
"""
完整解析STEP装配体 - 保持装配关系
正确提取每个零件的位置和旋转
"""
import sys
import json
import re
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_FACE
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopoDS import topods
from OCC.Core.TopLoc import TopLoc_Location

def parse_assembly_step(step_file_path):
    """解析STEP装配体 - 保持装配位置"""
    reader = STEPControl_Reader()
    status = reader.ReadFile(step_file_path)

    if status != IFSelect_RetDone:
        return {"success": False, "error": "Failed to read STEP file"}

    reader.TransferRoots()
    shape = reader.OneShape()

    # 遍历所有实体
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    geometries = []
    materials = []
    objects = []
    part_idx = 0

    while explorer.More():
        solid = topods.Solid(explorer.Current())

        # 获取位置信息 - 这是关键！
        location = solid.Location()
        trsf = location.Transformation()

        # 提取位置和旋转矩阵
        translation = trsf.TranslationPart()

        # 获取旋转矩阵 (3x3)
        rot_matrix = trsf.VectorialPart()
        m11, m12, m13 = rot_matrix.Value(1,1), rot_matrix.Value(1,2), rot_matrix.Value(1,3)
        m21, m22, m23 = rot_matrix.Value(2,1), rot_matrix.Value(2,2), rot_matrix.Value(2,3)
        m31, m32, m33 = rot_matrix.Value(3,1), rot_matrix.Value(3,2), rot_matrix.Value(3,3)

        # 网格化（不应用变换，保持原始几何体）
        mesh = BRepMesh_IncrementalMesh(solid, 0.1, False, 0.5, True)
        mesh.Perform()

        # 提取三角面片
        vertices = []
        normals = []

        face_explorer = TopExp_Explorer(solid, TopAbs_FACE)
        while face_explorer.More():
            face = face_explorer.Current()
            # 不使用location，提取原始几何体
            facing = BRep_Tool.Triangulation(face, TopLoc_Location())

            if facing:
                for i in range(1, facing.NbTriangles() + 1):
                    triangle = facing.Triangle(i)
                    for j in range(1, 4):
                        vertex = facing.Node(triangle.Value(j))
                        vertices.extend([vertex.X(), vertex.Y(), vertex.Z()])
                        normals.extend([0, 0, 1])

            face_explorer.Next()

        if len(vertices) == 0:
            explorer.Next()
            continue

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
        colors = [
            0x999999, 0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa8dadc,
            0xf1faee, 0xe63946, 0x457b9d, 0x1d3557, 0x95b8d1
        ]
        materials.append({
            "uuid": f"mat-{part_idx}",
            "type": "MeshStandardMaterial",
            "color": colors[part_idx % len(colors)],
            "metalness": 0.5,
            "roughness": 0.5
        })

        # 对象 - 使用正确的4x4变换矩阵
        matrix = [
            m11, m21, m31, 0,
            m12, m22, m32, 0,
            m13, m23, m33, 0,
            translation.X(), translation.Y(), translation.Z(), 1
        ]

        objects.append({
            "uuid": f"obj-{part_idx}",
            "type": "Mesh",
            "name": f"Part_{part_idx}",
            "geometry": f"geo-{part_idx}",
            "material": f"mat-{part_idx}",
            "matrix": matrix
        })

        part_idx += 1
        explorer.Next()

    # 生成Three.js装配体JSON
    result = {
        "metadata": {
            "version": 4.5,
            "type": "Object",
            "generator": "STEP-Assembly-with-Correct-Transform",
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
