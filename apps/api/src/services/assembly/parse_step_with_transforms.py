#!/usr/bin/env python3
"""
STEP装配体解析 - 正确提取零件位置和旋转
"""
import sys
import json
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_FACE
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopoDS import topods
from OCC.Core.TopLoc import TopLoc_Location

def parse_assembly(step_file_path):
    try:
        print(f"开始解析: {step_file_path}", file=sys.stderr)

        reader = STEPControl_Reader()
        status = reader.ReadFile(step_file_path)

        if status != IFSelect_RetDone:
            return {"success": False, "error": f"读取失败 status={status}"}

        print("✓ 文件读取成功", file=sys.stderr)

        reader.TransferRoots()
        shape = reader.OneShape()
        print("✓ 形状提取成功", file=sys.stderr)

        explorer = TopExp_Explorer(shape, TopAbs_SOLID)
        geometries = []
        materials = []
        objects = []
        part_idx = 0

        colors = [
            0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa8dadc, 0x95b8d1,
            0xf1faee, 0xe63946, 0x457b9d, 0x1d3557, 0x999999
        ]

        while explorer.More():
            try:
                solid = topods.Solid(explorer.Current())

                # 获取装配位置
                location = solid.Location()
                trsf = location.Transformation()

                # 提取位移
                trans = trsf.TranslationPart()
                tx, ty, tz = trans.X(), trans.Y(), trans.Z()

                # 提取旋转矩阵
                rot = trsf.VectorialPart()
                m11 = rot.Value(1, 1)
                m12 = rot.Value(1, 2)
                m13 = rot.Value(1, 3)
                m21 = rot.Value(2, 1)
                m22 = rot.Value(2, 2)
                m23 = rot.Value(2, 3)
                m31 = rot.Value(3, 1)
                m32 = rot.Value(3, 2)
                m33 = rot.Value(3, 3)

                print(f"零件 {part_idx}: 位置=({tx:.1f},{ty:.1f},{tz:.1f})", file=sys.stderr)

                # 网格化（不应用变换，保持原始几何）
                mesh = BRepMesh_IncrementalMesh(solid, 0.5, False, 0.5, True)
                mesh.Perform()

                vertices = []
                normals = []

                face_explorer = TopExp_Explorer(solid, TopAbs_FACE)
                while face_explorer.More():
                    face = face_explorer.Current()
                    facing = BRep_Tool.Triangulation(face, TopLoc_Location())

                    if facing is not None:
                        for i in range(1, facing.NbTriangles() + 1):
                            triangle = facing.Triangle(i)
                            for j in range(1, 4):
                                vertex = facing.Node(triangle.Value(j))
                                vertices.extend([vertex.X(), vertex.Y(), vertex.Z()])
                                normals.extend([0, 0, 1])

                    face_explorer.Next()

                if len(vertices) > 0:
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

                    materials.append({
                        "uuid": f"mat-{part_idx}",
                        "type": "MeshStandardMaterial",
                        "color": colors[part_idx % len(colors)],
                        "metalness": 0.5,
                        "roughness": 0.5
                    })

                    # Three.js矩阵: 列主序
                    matrix = [
                        m11, m21, m31, 0,
                        m12, m22, m32, 0,
                        m13, m23, m33, 0,
                        tx, ty, tz, 1
                    ]

                    objects.append({
                        "uuid": f"obj-{part_idx}",
                        "type": "Mesh",
                        "name": f"Part_{part_idx}",
                        "geometry": f"geo-{part_idx}",
                        "material": f"mat-{part_idx}",
                        "matrix": matrix
                    })

                    print(f"  ✓ {len(vertices)//3} 顶点", file=sys.stderr)
                    part_idx += 1

            except Exception as e:
                print(f"⊗ 错误: {e}", file=sys.stderr)

            explorer.Next()

        print(f"\n✓ 解析完成: {part_idx} 个零件", file=sys.stderr)

        result = {
            "metadata": {
                "version": 4.5,
                "type": "Object",
                "generator": "STEP-Assembly-with-Transforms",
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

    except Exception as e:
        print(f"⊗ 致命错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少文件路径"}))
        sys.exit(1)

    result = parse_assembly(sys.argv[1])
    print(json.dumps(result))
