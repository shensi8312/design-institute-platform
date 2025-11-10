#!/usr/bin/env python3
"""
STEP批量转换为STL
使用方法: python3 convert_step_to_stl.py

依赖:
1. FreeCAD (推荐): brew install freecad
2. 或 trimesh + pythonocc: pip3 install trimesh pythonocc-core
"""

import os
import sys
import subprocess
from pathlib import Path

STEP_DIR = Path(__file__).parent.parent / "docs" / "solidworks"
STL_DIR = Path(__file__).parent.parent / "apps" / "api" / "uploads" / "3d-models"

def check_freecad():
    """检查FreeCAD是否可用"""
    # macOS: 检查.app安装
    mac_path = "/Applications/FreeCAD.app/Contents/MacOS/FreeCAD"
    if os.path.exists(mac_path):
        return mac_path

    # Linux/其他: 检查命令行工具
    try:
        result = subprocess.run(['freecad', '--version'],
                              capture_output=True,
                              timeout=5)
        if result.returncode == 0:
            return 'freecad'
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    return None

def convert_with_freecad(step_file, stl_file, freecad_cmd):
    """使用FreeCAD转换STEP到STL"""

    # 创建临时转换脚本
    script_content = f"""
import sys
import FreeCAD
import Mesh
import Import

step_path = r"{step_file}"
stl_path = r"{stl_file}"

try:
    # 导入STEP文件
    Import.insert(step_path, "Unnamed")
    doc = FreeCAD.ActiveDocument

    if not doc:
        print("ERROR: Failed to create document")
        sys.exit(1)

    # 获取所有可导出的对象
    objects = [obj for obj in doc.Objects if hasattr(obj, 'Shape')]

    if not objects:
        print("ERROR: No geometry found in STEP file")
        sys.exit(1)

    # 创建网格并合并
    meshes = []
    for obj in objects:
        try:
            mesh = Mesh.Mesh()
            # 使用0.1mm精度进行网格化
            mesh.addFacets(obj.Shape.tessellate(0.1))
            meshes.append(mesh)
        except Exception as e:
            print(f"WARNING: Failed to convert object {{obj.Label}}: {{e}}")

    if not meshes:
        print("ERROR: All objects failed to convert")
        sys.exit(1)

    # 合并所有网格
    combined = meshes[0]
    for mesh in meshes[1:]:
        combined.addMesh(mesh)

    # 导出STL
    combined.write(stl_path)
    print(f"SUCCESS: {{len(meshes)}} objects -> {{stl_path}}")

except Exception as e:
    print(f"ERROR: {{e}}")
    sys.exit(1)
"""

    script_path = "/tmp/freecad_convert_temp.py"
    with open(script_path, 'w') as f:
        f.write(script_content)

    try:
        result = subprocess.run(
            [freecad_cmd, '-c', script_path],
            capture_output=True,
            text=True,
            timeout=120
        )

        if "SUCCESS:" in result.stdout:
            return True
        else:
            print(f"    FreeCAD输出: {result.stdout}")
            print(f"    错误: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        print(f"    转换超时（>120秒）")
        return False
    except Exception as e:
        print(f"    执行失败: {e}")
        return False

def batch_convert():
    """批量转换所有STEP文件"""

    # 检查FreeCAD
    freecad_cmd = check_freecad()
    if not freecad_cmd:
        print("❌ FreeCAD未安装")
        print("\n安装方法:")
        print("  macOS:  brew install --cask freecad")
        print("  Ubuntu: sudo apt install freecad")
        print("  或访问: https://www.freecad.org/downloads.php")
        return

    print(f"✅ FreeCAD已安装: {freecad_cmd}")
    print("")

    # 确保输出目录存在
    STL_DIR.mkdir(parents=True, exist_ok=True)

    # 获取所有STEP文件
    step_files = list(STEP_DIR.glob("*.STEP")) + list(STEP_DIR.glob("*.step"))

    if not step_files:
        print(f"❌ 未找到STEP文件: {STEP_DIR}")
        return

    print(f"📦 找到 {len(step_files)} 个STEP文件")
    print(f"📁 输入: {STEP_DIR}")
    print(f"📁 输出: {STL_DIR}")
    print("=" * 70)

    success_count = 0
    skip_count = 0
    fail_count = 0

    for i, step_file in enumerate(step_files, 1):
        stl_name = step_file.stem + ".stl"
        stl_file = STL_DIR / stl_name

        # 跳过已转换的
        if stl_file.exists():
            file_size = stl_file.stat().st_size
            if file_size > 1024:  # 大于1KB才算有效
                print(f"[{i}/{len(step_files)}] ⏭️  已存在: {stl_name} ({file_size/1024:.1f}KB)")
                skip_count += 1
                continue

        print(f"[{i}/{len(step_files)}] 🔄 转换: {step_file.name}")

        success = convert_with_freecad(str(step_file), str(stl_file), freecad_cmd)

        if success:
            success_count += 1
            file_size = stl_file.stat().st_size if stl_file.exists() else 0
            print(f"    ✅ 完成 ({file_size/1024:.1f}KB)")
        else:
            fail_count += 1
            print(f"    ❌ 失败")

    print("=" * 70)
    print(f"\n📊 转换结果:")
    print(f"  ✅ 成功: {success_count}")
    print(f"  ⏭️  跳过: {skip_count}")
    print(f"  ❌ 失败: {fail_count}")
    print(f"  📈 成功率: {success_count / (len(step_files) - skip_count) * 100:.1f}%")

    # 显示转换后的总大小
    total_size = sum(f.stat().st_size for f in STL_DIR.glob("*.stl"))
    print(f"  💾 总大小: {total_size / (1024*1024):.1f}MB")

if __name__ == "__main__":
    try:
        batch_convert()
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        sys.exit(1)
