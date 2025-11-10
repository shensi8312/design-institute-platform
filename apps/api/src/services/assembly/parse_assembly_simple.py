#!/usr/bin/env python3
"""
简化版STEP装配体解析 - 不使用XCAF
直接使用STEPControl_Reader提取实体和位置
"""
import sys
import json
import traceback
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_FACE
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopoDS import topods
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties

def parse_assembly(step_file_path):
    """简化版解析"""
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

        # 遍历所有实体
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

                # 获取质心作为位置
                props = GProp_GProps()
                brepgprop_VolumeProperties(solid, props)
                center = props.CentreOfMass()

                print(f"零件 {part_idx}: 质心 ({center.X():.2f}, {center.Y():.2f}, {center.Z():.2f})", file=sys.stderr)

                # 网格化
                mesh = BRepMesh_IncrementalMesh(solid, 0.5, False, 0.5, True)
                mesh.Perform()

                vertices = []
                normals = []

                face_explorer = TopExp_Explorer(solid, TopAbs_FACE)
                while face_explorer.More():
                    face = face_explorer.Current()
                    facing = BRep_Tool.Triangulation(face, TopLoc_Location())

                    # 修复：直接检查facing是否为None,不使用IsNull()
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

                    objects.append({
                        "uuid": f"obj-{part_idx}",
                        "type": "Mesh",
                        "name": f"Part_{part_idx}",
                        "geometry": f"geo-{part_idx}",
                        "material": f"mat-{part_idx}",
                        "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
                    })

                    print(f"  ✓ {len(vertices)//3} 顶点", file=sys.stderr)
                    part_idx += 1

            except Exception as e:
                print(f"⊗ 处理实体失败: {e}", file=sys.stderr)

            explorer.Next()

        print(f"\n最终: {part_idx} 个零件", file=sys.stderr)

        result = {
            "metadata": {
                "version": 4.5,
                "type": "Object",
                "generator": "Simple-STEP-Parser",
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
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(error_msg, file=sys.stderr)
        return {"success": False, "error": error_msg}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing file path"}))
        sys.exit(1)

    result = parse_assembly(sys.argv[1])
    print(json.dumps(result))
