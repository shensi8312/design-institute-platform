#!/usr/bin/env python3
"""
生成所有文件名的翻译对照表
直接使用预定义的翻译规则
"""

import json
from pathlib import Path

# 建筑专业术语翻译字典
TRANSLATIONS = {
    # 通用术语
    "FL": "FL",  # Full Length，保留
    "Alternates": "替代方案",
    "General Requirements": "总体要求",
    "Unit Prices": "单价",
    "Payment Procedures": "支付程序",
    "Product Requirements": "产品要求",
    "Construction Waste Management": "施工废弃物管理",
    "Disposal": "处置",

    # 材料类
    "Concrete": "混凝土",
    "Paving": "铺装",
    "Asphalt": "沥青",
    "Synthetic Grass": "人造草坪",
    "Surfacing": "表面",
    "Transplanting": "移植",
    "Fences": "围栏",
    "Gates": "大门",
    "Metal": "金属",
    "Security": "安防",
    "Decorative": "装饰性",
    "Parking Bumpers": "停车挡块",
    "Pavement Markings": "路面标线",
    "Unit Paving": "单元铺装",
    "Porous": "透水",
    "Retaining Walls": "挡土墙",
    "Segmental": "分段式",
    "Site Furnishings": "场地设施",
    "Planting Irrigation": "植物灌溉",
    "Turf": "草坪",
    "Grasses": "草类",
    "Imprinted": "压印",

    # 设备类
    "HVAC": "暖通空调",
    "Equipment": "设备",
    "Electrical": "电气",
    "Plumbing": "给排水",
    "Fire Suppression": "消防",
    "Communications": "通讯",
    "Safety": "安全",

    # 其他
    "Existing": "既有",
    "Conditions": "条件",
    "Requirements": "要求",
    "Procurement": "采购",
    "Contracting": "合同",
    "Information": "信息",
    "Hazardous Material": "危险材料",
}

def translate_filename(filename: str) -> str:
    """翻译单个文件名"""
    # 移除扩展名
    name = filename.replace('.DOC', '').replace('.docx', '')

    # 提取编号和标记
    parts = name.split(' - ', 1)
    if len(parts) == 2:
        number = parts[0].strip()
        title = parts[1].strip()

        # 翻译标题部分
        translated_title = title
        for en, zh in TRANSLATIONS.items():
            if en in translated_title:
                translated_title = translated_title.replace(en, zh)

        # 如果翻译后还是英文，保留原文
        if translated_title == title:
            # 简单规则：常见词汇
            words = {
                'and': '和',
                'the': '',
                'for': '用于',
                'with': '带',
                'of': '的',
            }
            for word, trans in words.items():
                translated_title = translated_title.replace(f' {word} ', f' {trans} ' if trans else ' ')

        return f"{number} - {translated_title}"

    return name

def main():
    """生成所有文件的翻译对照表"""
    source_dir = Path("docs/specs/Full Length")
    output_file = Path("docs/specs/文件名翻译对照表_完整版.json")

    print("="*60)
    print("生成文件名翻译对照表")
    print("="*60)

    translations = {
        "folders": {
            "00 - PROCUREMENT AND CONTRACTING REQUIREMENTS": "00 - 采购与合同要求",
            "01 - GENERAL REQUIREMENTS": "01 - 总体要求",
            "02 - EXISTING CONDITIONS": "02 - 既有条件",
            "03 - CONCRETE": "03 - 混凝土",
            "04 - MASONRY": "04 - 砌体",
            "05 - METALS": "05 - 金属",
            "06 - WOOD, PLASTICS, AND COMPOSITES": "06 - 木材、塑料和复合材料",
            "07 - THERMAL AND MOISTURE PROTECTION": "07 - 保温与防潮",
            "08 - OPENINGS": "08 - 门窗开口",
            "09 - FINISHES": "09 - 装饰装修",
            "10 - SPECIALTIES": "10 - 专项",
            "11 - EQUIPMENT": "11 - 设备",
            "12 - FURNISHINGS": "12 - 家具",
            "13 - SPECIAL CONSTRUCTION": "13 - 特殊结构",
            "14 - CONVEYING EQUIPMENT": "14 - 输送设备",
            "21 - FIRE SUPPRESSION": "21 - 消防",
            "22 - PLUMBING": "22 - 给排水",
            "23 - HEATING, VENTILATING, AND AIR CONDITIONING (HVAC)": "23 - 暖通空调",
            "26 - ELECTRICAL": "26 - 电气",
            "27 - COMMUNICATIONS": "27 - 通讯",
            "28 - ELECTRONIC SAFETY AND SECURITY": "28 - 电子安防",
            "31 - EARTHWORK": "31 - 土方工程",
            "32 - EXTERIOR IMPROVEMENTS": "32 - 室外工程",
            "33 - UTILITIES": "33 - 市政公用设施"
        },
        "files": {}
    }

    # 获取所有文件
    files = sorted(source_dir.rglob("*.DOC"))

    print(f"找到 {len(files)} 个文件")
    print("正在翻译...")

    for i, file_path in enumerate(files, 1):
        filename = file_path.name
        translated = translate_filename(filename)
        translations["files"][filename] = translated

        if i % 100 == 0:
            print(f"  已处理 {i}/{len(files)} 个文件...")

    # 保存
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    print()
    print("="*60)
    print("✅ 完成！")
    print(f"文件夹: {len(translations['folders'])} 个")
    print(f"文件: {len(translations['files'])} 个")
    print(f"保存到: {output_file}")
    print("="*60)

    # 显示前10个示例
    print("\n示例翻译:")
    for i, (orig, trans) in enumerate(list(translations['files'].items())[:10], 1):
        print(f"{i}. {orig}")
        print(f"   → {trans}")

if __name__ == "__main__":
    main()
