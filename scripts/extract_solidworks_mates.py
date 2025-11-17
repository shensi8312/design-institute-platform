"""
SolidWorks装配体配合关系提取脚本
在Windows上运行，需要安装SolidWorks

使用方法：
1. 将10个.sldasm文件放在 assemblies/ 文件夹
2. 运行: python extract_solidworks_mates.py
3. 输出: assembly_mates.json
"""

import win32com.client
import pythoncom
import os
import json
from pathlib import Path

class SolidWorksMateExtractor:
    def __init__(self):
        self.sw_app = None
        self.results = {}

    def connect_solidworks(self):
        """连接SolidWorks应用"""
        try:
            pythoncom.CoInitialize()
            self.sw_app = win32com.client.Dispatch("SldWorks.Application")
            self.sw_app.Visible = True
            print("✅ 已连接到SolidWorks")
            return True
        except Exception as e:
            print(f"❌ 连接SolidWorks失败: {e}")
            return False

    def extract_mates(self, assembly_path):
        """提取单个装配体的配合关系"""
        print(f"\n📂 处理装配体: {os.path.basename(assembly_path)}")

        # 打开装配体
        doc_type = 2  # swDocASSEMBLY
        options = 1   # swOpenDocOptions_Silent
        errors = 0
        warnings = 0

        model = self.sw_app.OpenDoc6(
            assembly_path, doc_type, options, "", errors, warnings
        )

        if not model:
            print(f"❌ 无法打开装配体: {assembly_path}")
            return None

        print(f"✅ 装配体已打开")

        # 获取装配体对象
        assembly = model.GetAssembly()
        if not assembly:
            print(f"❌ 无法获取装配体对象")
            model.Close()
            return None

        # 提取配合关系
        mates = []
        mate_count = assembly.GetMateCount()
        print(f"📊 找到 {mate_count} 个配合关系")

        for i in range(mate_count):
            mate = assembly.GetMateByIndex(i)
            if not mate:
                continue

            try:
                mate_info = self._extract_mate_info(mate, model)
                if mate_info:
                    mates.append(mate_info)
                    print(f"  ✓ {mate_info['type']}: {mate_info['part1_name']} ↔ {mate_info['part2_name']}")
            except Exception as e:
                print(f"  ⚠️  提取配合失败: {e}")
                continue

        # 关闭文档
        model.Close()

        return {
            'assembly_name': os.path.basename(assembly_path),
            'mate_count': len(mates),
            'mates': mates
        }

    def _extract_mate_info(self, mate, model):
        """提取单个配合的详细信息"""
        mate_type = mate.GetMateType()
        mate_alignment = mate.Alignment

        # 配合类型映射
        mate_type_map = {
            0: "UNKNOWN",
            1: "COINCIDENT",     # 重合（面贴合）
            2: "PARALLEL",       # 平行
            3: "PERPENDICULAR",  # 垂直
            4: "TANGENT",        # 相切
            5: "CONCENTRIC",     # 同心（孔轴配合）
            6: "DISTANCE",       # 距离
            7: "ANGLE",          # 角度
            8: "LOCK",           # 锁定
            9: "SCREW",          # 螺旋（螺纹）
            10: "GEAR",          # 齿轮
            11: "CAM"            # 凸轮
        }

        mate_type_name = mate_type_map.get(mate_type, f"TYPE_{mate_type}")

        # 获取配合的两个实体
        mate_entities = mate.GetMateEntities()
        if not mate_entities or len(mate_entities) < 2:
            return None

        entity1 = mate_entities[0]
        entity2 = mate_entities[1]

        # 获取零件名称
        part1_name = self._get_component_name(entity1)
        part2_name = self._get_component_name(entity2)

        if not part1_name or not part2_name:
            return None

        # 获取配合参数
        parameters = {}

        if mate_type == 6:  # DISTANCE
            try:
                parameters['distance'] = mate.MateEntity(0).EntityParams(8)  # distance value
            except:
                pass
        elif mate_type == 7:  # ANGLE
            try:
                parameters['angle'] = mate.MateEntity(0).EntityParams(8)
            except:
                pass
        elif mate_type == 9:  # SCREW
            try:
                parameters['pitch'] = mate.MateEntity(0).EntityParams(8)
                parameters['revolutions'] = mate.MateEntity(0).EntityParams(9)
            except:
                pass

        return {
            'type': mate_type_name,
            'alignment': 'ALIGNED' if mate_alignment == 0 else 'ANTI_ALIGNED',
            'part1_name': part1_name,
            'part2_name': part2_name,
            'parameters': parameters
        }

    def _get_component_name(self, mate_entity):
        """获取配合实体对应的零件名称"""
        try:
            ref_component = mate_entity.ReferenceComponent
            if ref_component:
                # 获取组件名称
                comp_name = ref_component.Name2
                # 移除实例编号（例如："Part1-1" → "Part1"）
                if '-' in comp_name:
                    comp_name = comp_name.split('-')[0]
                return comp_name
        except:
            pass
        return None

    def process_directory(self, assembly_dir):
        """处理目录下所有.sldasm文件"""
        assembly_dir = Path(assembly_dir)

        if not assembly_dir.exists():
            print(f"❌ 目录不存在: {assembly_dir}")
            return False

        # 查找所有.sldasm文件
        assembly_files = list(assembly_dir.glob("*.sldasm"))

        if not assembly_files:
            print(f"❌ 目录下没有找到.sldasm文件: {assembly_dir}")
            return False

        print(f"\n📁 找到 {len(assembly_files)} 个装配体文件")
        print("=" * 60)

        # 处理每个装配体
        for assembly_file in assembly_files:
            result = self.extract_mates(str(assembly_file.absolute()))
            if result:
                self.results[result['assembly_name']] = result

        return True

    def save_results(self, output_file="assembly_mates.json"):
        """保存结果到JSON文件"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 60)
        print(f"✅ 结果已保存到: {output_file}")
        print(f"📊 统计信息:")
        print(f"   - 装配体数量: {len(self.results)}")

        total_mates = sum(r['mate_count'] for r in self.results.values())
        print(f"   - 配合关系总数: {total_mates}")

        # 统计配合类型
        mate_types = {}
        for result in self.results.values():
            for mate in result['mates']:
                mate_type = mate['type']
                mate_types[mate_type] = mate_types.get(mate_type, 0) + 1

        print(f"   - 配合类型分布:")
        for mate_type, count in sorted(mate_types.items(), key=lambda x: x[1], reverse=True):
            print(f"     • {mate_type}: {count}")

    def disconnect(self):
        """断开SolidWorks连接"""
        if self.sw_app:
            # 不关闭SolidWorks，让用户手动关闭
            # self.sw_app.ExitApp()
            self.sw_app = None
        pythoncom.CoUninitialize()

def main():
    print("=" * 60)
    print("SolidWorks装配体配合关系提取工具")
    print("=" * 60)

    # 设置装配体文件夹路径（可根据实际情况修改）
    assembly_dir = input("请输入装配体文件夹路径 (默认: ./assemblies): ").strip()
    if not assembly_dir:
        assembly_dir = "./assemblies"

    # 创建提取器
    extractor = SolidWorksMateExtractor()

    # 连接SolidWorks
    if not extractor.connect_solidworks():
        print("❌ 无法连接到SolidWorks，请确保：")
        print("   1. SolidWorks已安装")
        print("   2. 已安装 pywin32: pip install pywin32")
        return

    try:
        # 处理所有装配体
        if extractor.process_directory(assembly_dir):
            # 保存结果
            extractor.save_results("assembly_mates.json")
            print("\n✅ 提取完成！")
            print("\n📌 下一步:")
            print("   将 assembly_mates.json 复制到Mac开发机")
            print("   然后运行学习脚本进行规则提取")
        else:
            print("\n❌ 提取失败")

    finally:
        # 断开连接
        extractor.disconnect()

if __name__ == "__main__":
    main()
