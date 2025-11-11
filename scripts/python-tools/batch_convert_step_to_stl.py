#!/usr/bin/env python3
"""
批量转换STEP文件到STL（用于Three.js加载）
"""
import sys
import os
from pathlib import Path

try:
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.StlAPI import StlAPI_Writer
    from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
except ImportError:
    print("❌ 需要安装 pythonocc-core")
    print("安装: conda install -c conda-forge pythonocc-core")
    sys.exit(1)

def convert_step_to_stl(step_file, stl_file, deflection=0.1):
    """转换STEP到STL"""
    print(f"  📥 {os.path.basename(step_file)}")

    reader = STEPControl_Reader()
    status = reader.ReadFile(step_file)

    if status != 1:
        print(f"    ❌ 读取失败")
        return False

    reader.TransferRoots()
    shape = reader.OneShape()

    # 生成网格
    mesh = BRepMesh_IncrementalMesh(shape, deflection)
    mesh.Perform()

    if not mesh.IsDone():
        print(f"    ❌ 网格生成失败")
        return False

    # 写入STL
    stl_writer = StlAPI_Writer()
    stl_writer.Write(shape, stl_file)

    size_kb = os.path.getsize(stl_file) / 1024
    print(f"    ✅ {size_kb:.1f}KB")
    return True

def batch_convert(step_dir, output_dir, part_names):
    """批量转换指定零件"""
    os.makedirs(output_dir, exist_ok=True)

    converted = 0
    failed = 0

    for part_name in part_names:
        step_file = os.path.join(step_dir, f"{part_name}.STEP")
        stl_file = os.path.join(output_dir, f"{part_name}.stl")

        if not os.path.exists(step_file):
            print(f"  ⚠️  {part_name}.STEP 不存在")
            failed += 1
            continue

        if os.path.exists(stl_file):
            print(f"  ⏭️  {part_name}.stl 已存在")
            converted += 1
            continue

        try:
            if convert_step_to_stl(step_file, stl_file):
                converted += 1
            else:
                failed += 1
        except Exception as e:
            print(f"    ❌ 转换失败: {e}")
            failed += 1

    return converted, failed

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python batch_convert_step_to_stl.py <零件名称列表文件>")
        sys.exit(1)

    parts_file = sys.argv[1]
    step_dir = "../../docs/solidworks"
    output_dir = "src/uploads/stl_cache"

    print(f"📂 STEP目录: {step_dir}")
    print(f"📂 STL输出: {output_dir}\n")

    # 读取零件列表
    with open(parts_file, 'r') as f:
        part_names = [line.strip() for line in f if line.strip()]

    print(f"🔄 开始转换 {len(part_names)} 个零件...\n")

    converted, failed = batch_convert(step_dir, output_dir, part_names)

    print(f"\n📊 转换完成:")
    print(f"  ✅ 成功: {converted}")
    print(f"  ❌ 失败: {failed}")
