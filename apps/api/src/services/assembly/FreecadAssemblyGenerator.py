#!/usr/bin/env python3
"""
FreeCAD装配生成器 - 根据位置数据生成STEP装配文件
"""
import sys
import os
import json

# FreeCAD路径配置
FREECAD_PATH = "/Applications/FreeCAD.app/Contents/Resources/lib"
if os.path.exists(FREECAD_PATH):
    sys.path.append(FREECAD_PATH)

import FreeCAD
import Part
import Import

class FreecadAssemblyGenerator:
    def __init__(self, parts_dir):
        self.parts_dir = parts_dir
        self.doc = FreeCAD.newDocument("Assembly")

    def load_part_file(self, family, part_id):
        """加载零件STEP文件"""
        # 尝试多种文件名模式
        patterns = [
            f"{part_id}.STEP",
            f"{part_id}.step",
            f"{family.upper()}-*.STEP",
        ]

        for pattern in patterns:
            import glob
            files = glob.glob(os.path.join(self.parts_dir, pattern))
            if files:
                return files[0]

        return None

    def create_simple_geometry(self, family):
        """创建简单几何体代替实际零件"""
        if family == 'valve':
            return Part.makeBox(150, 100, 100)
        elif family == 'flange':
            return Part.makeCylinder(75, 20)
        elif family == 'pipe':
            return Part.makeCylinder(25, 200)
        elif family == 'bolt':
            return Part.makeCylinder(8, 60)
        elif family == 'gasket':
            return Part.makeCylinder(50, 3)
        else:
            return Part.makeBox(50, 50, 50)

    def add_part(self, placement_data):
        """添加零件到装配"""
        family = placement_data.get('family', 'unknown')
        tag = placement_data.get('tag', 'PART')
        part_id = placement_data.get('part_id', family.upper())
        pos = placement_data.get('position', {})
        rot = placement_data.get('rotation', {})

        x = pos.get('x', 0)
        y = pos.get('y', 0)
        z = pos.get('z', 0)

        # 尝试加载实际零件文件
        part_file = self.load_part_file(family, part_id)

        if part_file and os.path.exists(part_file):
            # 导入STEP文件
            Import.insert(part_file, self.doc.Name)
            # 获取最后添加的对象
            if len(self.doc.Objects) > 0:
                obj = self.doc.Objects[-1]
                obj.Label = tag
            else:
                # 如果导入失败，使用简单几何体
                shape = self.create_simple_geometry(family)
                obj = self.doc.addObject("Part::Feature", tag)
                obj.Shape = shape
        else:
            # 使用简单几何体
            shape = self.create_simple_geometry(family)
            obj = self.doc.addObject("Part::Feature", tag)
            obj.Shape = shape

        # 设置位置
        obj.Placement = FreeCAD.Placement(
            FreeCAD.Vector(x, y, z),
            FreeCAD.Rotation(
                rot.get('x', 0),
                rot.get('y', 0),
                rot.get('z', 0)
            )
        )

        return obj

    def generate_assembly(self, placements, output_file):
        """生成装配文件"""
        print(f"[FreecadAssemblyGenerator] 开始生成装配: {len(placements)} 个零件")

        for i, placement in enumerate(placements):
            try:
                obj = self.add_part(placement)
                print(f"  [{i+1}/{len(placements)}] ✅ {placement.get('tag', 'PART')}")
            except Exception as e:
                print(f"  [{i+1}/{len(placements)}] ❌ {placement.get('tag', 'PART')}: {e}")

        # 导出STEP文件
        self.doc.recompute()

        # 创建输出目录
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # 导出
        Part.export(self.doc.Objects, output_file)
        print(f"[FreecadAssemblyGenerator] ✅ 装配文件已生成: {output_file}")

        return output_file

def main():
    if len(sys.argv) < 4:
        print("用法: python3 FreecadAssemblyGenerator.py <placements.json> <parts_dir> <output.step>")
        sys.exit(1)

    placements_file = sys.argv[1]
    parts_dir = sys.argv[2]
    output_file = sys.argv[3]

    # 读取位置数据
    with open(placements_file, 'r') as f:
        placements = json.load(f)

    # 生成装配
    generator = FreecadAssemblyGenerator(parts_dir)
    generator.generate_assembly(placements, output_file)

    print(f"✅ 装配完成: {output_file}")

if __name__ == '__main__':
    main()
