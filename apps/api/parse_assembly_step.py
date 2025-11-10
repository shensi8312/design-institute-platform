#!/usr/bin/env python3
"""
解析STEP装配体文件
提取子零件、变换矩阵、几何体
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

step_file = sys.argv[1]

reader = STEPControl_Reader()
status = reader.ReadFile(step_file)

if status != IFSelect_RetDone:
    print(json.dumps({"success": False, "error": "Failed to read STEP file"}))
    sys.exit(1)

reader.TransferRoots()
shape = reader.OneShape()

# 遍历所有实体
explorer = TopExp_Explorer(shape, TopAbs_SOLID)
parts = []
part_idx = 0

while explorer.More():
    solid = topods.Solid(explorer.Current())
    
    # 网格化
    mesh = BRepMesh_IncrementalMesh(solid, 0.1, False, 0.5, True)
    mesh.Perform()
    
    # 统计顶点
    face_explorer = TopExp_Explorer(solid, TopAbs_FACE)
    vertex_count = 0
    
    while face_explorer.More():
        face = face_explorer.Current()
        triangulation = BRep_Tool.Triangulation(face, face.Location())
        if triangulation:
            vertex_count += triangulation.NbNodes()
        face_explorer.Next()
    
    parts.append({
        "name": f"Part_{part_idx}",
        "vertices": vertex_count
    })
    
    part_idx += 1
    explorer.Next()

print(json.dumps({
    "success": True,
    "totalParts": len(parts),
    "parts": parts
}, indent=2))
