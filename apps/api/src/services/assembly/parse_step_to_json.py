#!/usr/bin/env python3
"""
STEP文件解析器 - 服务端方案
使用pythonocc-core解析STEP文件,输出Three.js兼容的JSON格式
"""

import sys
import json
import re
from pathlib import Path

def extract_color_from_step_text(step_file_path):
    """从STEP文本中提取颜色定义"""
    try:
        with open(step_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 查找COLOUR_RGB定义
        color_pattern = r'COLOUR_RGB\s*\([^,]*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)'
        matches = re.findall(color_pattern, content)

        if matches:
            r, g, b = matches[0]
            return {
                'r': float(r),
                'g': float(g),
                'b': float(b)
            }
    except Exception as e:
        print(f"颜色提取失败: {e}", file=sys.stderr)

    return {'r': 0.7, 'g': 0.7, 'b': 0.7}

def parse_step_with_pythonocc(step_file_path):
    """使用pythonocc解析STEP文件"""
    try:
        from OCC.Core.STEPControl import STEPControl_Reader
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_VERTEX
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
        from OCC.Core.Bnd import Bnd_Box
        from OCC.Core.BRepBndLib import brepbndlib_Add

        # 读取STEP文件
        reader = STEPControl_Reader()
        status = reader.ReadFile(step_file_path)

        if status != 1:  # IFSelect_RetDone
            raise Exception("STEP文件读取失败")

        reader.TransferRoots()
        shape = reader.OneShape()

        # 网格化
        mesh = BRepMesh_IncrementalMesh(shape, 0.1, False, 0.5, True)
        mesh.Perform()

        # 提取三角面片
        vertices = []
        normals = []

        explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while explorer.More():
            face = explorer.Current()
            location = face.Location()
            facing = BRep_Tool.Triangulation(face, location)

            if facing:
                for i in range(1, facing.NbTriangles() + 1):
                    triangle = facing.Triangle(i)
                    for j in range(1, 4):
                        vertex = facing.Node(triangle.Value(j))
                        vertices.extend([vertex.X(), vertex.Y(), vertex.Z()])
                        # 简化法向量计算
                        normals.extend([0, 0, 1])

            explorer.Next()

        # 计算包围盒
        bbox = Bnd_Box()
        brepbndlib_Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()

        return {
            'vertices': vertices,
            'normals': normals,
            'boundingBox': {
                'min': [xmin, ymin, zmin],
                'max': [xmax, ymax, zmax]
            }
        }
    except ImportError:
        # pythonocc未安装,返回降级方案
        return None
    except Exception as e:
        print(f"pythonocc解析失败: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': '缺少STEP文件路径参数'
        }))
        sys.exit(1)

    step_file = sys.argv[1]

    if not Path(step_file).exists():
        print(json.dumps({
            'success': False,
            'error': f'文件不存在: {step_file}'
        }))
        sys.exit(1)

    # 提取颜色
    color = extract_color_from_step_text(step_file)

    # 尝试使用pythonocc解析
    geometry = parse_step_with_pythonocc(step_file)

    if geometry:
        result = {
            'success': True,
            'geometry': geometry,
            'color': color,
            'boundingBox': geometry['boundingBox'],
            'metadata': {
                'parser': 'pythonocc-core',
                'vertexCount': len(geometry['vertices']) // 3
            }
        }
    else:
        # 降级方案:返回占位符数据
        result = {
            'success': True,
            'geometry': {
                'vertices': [],
                'normals': []
            },
            'color': color,
            'boundingBox': {
                'min': [0, 0, 0],
                'max': [50, 50, 50]
            },
            'metadata': {
                'parser': 'fallback',
                'error': 'pythonocc-core未安装或解析失败'
            }
        }

    print(json.dumps(result))

if __name__ == '__main__':
    main()
