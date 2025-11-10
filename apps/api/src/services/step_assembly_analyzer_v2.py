#!/usr/bin/env python3
"""
STEP装配文件智能分析器 V2 - pythonOCC版本
精确的几何特征提取和装配约束分析

安装依赖:
    conda create -n pythonocc python=3.10
    conda activate pythonocc
    conda install -c conda-forge pythonocc-core

如果无法安装pythonOCC，系统会自动回退到正则解析模式
"""

import re
import json
import math
import sys
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Tuple, Optional, Any, TYPE_CHECKING

# 尝试导入pythonOCC
try:
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.STEPCAFControl import STEPCAFControl_Reader
    from OCC.Core.TDocStd import TDocStd_Document
    from OCC.Core.TCollection import TCollection_ExtendedString
    from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
    from OCC.Core.TopExp import TopExp_Explorer
    from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE, TopAbs_VERTEX
    from OCC.Core.GeomAbs import (
        GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone,
        GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface
    )
    from OCC.Core.gp import gp_Trsf, gp_Pnt, gp_Dir, gp_Ax1, gp_Vec
    from OCC.Core.BRepExtrema import BRepExtrema_DistShapeShape
    from OCC.Core.XCAFDoc import XCAFDoc_DocumentTool

    PYTHONOCC_AVAILABLE = True
    print("✅ pythonOCC已加载，使用精确几何分析")
except ImportError:
    PYTHONOCC_AVAILABLE = False
    # 定义占位类型避免类型错误
    gp_Trsf = Any
    BRepAdaptor_Surface = Any
    print("⚠️  pythonOCC未安装，使用正则解析模式（精度较低）")


class StepAssemblyAnalyzerV2:
    """STEP装配分析器 - 支持pythonOCC和正则两种模式"""

    def __init__(self, use_pythonocc=True):
        self.use_pythonocc = use_pythonocc and PYTHONOCC_AVAILABLE

        # 存储解析结果
        self.parts = []
        self.constraints = []
        self.file_type = 'unknown'

        # 正则模式的数据结构（兼容旧版）
        self.entities = {}
        self.products = {}
        self.assemblies = []
        self.placements = {}
        self.positions = {}
        self.directions = {}
        self.cylinders = []

    def parse_step_file(self, filepath: str) -> Dict:
        """解析STEP文件 - 入口方法"""
        filename = Path(filepath).name
        print(f"\n{'='*70}")
        print(f"📂 解析STEP文件: {filename}")
        print(f"   模式: {'pythonOCC精确分析' if self.use_pythonocc else '正则快速解析'}")
        print(f"{'='*70}\n")

        if self.use_pythonocc:
            return self._parse_with_pythonocc(filepath)
        else:
            return self._parse_with_regex(filepath)

    # ==================== pythonOCC精确解析 ====================

    def _parse_with_pythonocc(self, filepath: str) -> Dict:
        """使用pythonOCC进行精确几何分析"""
        try:
            # Step 1: 读取STEP文件
            reader = STEPCAFControl_Reader()
            status = reader.ReadFile(filepath)

            if status != 1:  # IFSelect_RetDone
                raise Exception(f"STEP文件读取失败: {filepath}")

            # Step 2: 创建XCAF文档（包含装配结构）
            doc = TDocStd_Document(TCollection_ExtendedString('MDTV-XCAF'))
            reader.Transfer(doc)

            # Step 3: 获取形状和颜色工具
            shape_tool = XCAFDoc_DocumentTool.ShapeTool(doc.Main())

            # Step 4: 判断文件类型
            self.file_type = self._identify_file_type_pythonocc(shape_tool)
            print(f"  🔍 文件类型: {self.file_type}")

            # Step 5: 遍历装配树
            if self.file_type == 'assembly':
                self._traverse_assembly_tree(shape_tool, shape_tool.Label())
            else:
                # 单个零件
                shape = shape_tool.GetShape(shape_tool.Label())
                features = self._extract_features_from_shape(shape, gp_Trsf())
                self.parts.append({
                    'part_id': Path(filepath).stem,
                    'file_name': Path(filepath).name,
                    'features': features
                })

            # Step 6: 分析约束
            self._analyze_constraints_pythonocc()

            print(f"\n✅ pythonOCC解析完成:")
            print(f"   零件数: {len(self.parts)}")
            print(f"   约束数: {len(self.constraints)}")

            return self._export_results()

        except Exception as e:
            print(f"❌ pythonOCC解析失败: {e}")
            print("   回退到正则解析模式...")
            self.use_pythonocc = False
            return self._parse_with_regex(filepath)

    def _identify_file_type_pythonocc(self, shape_tool) -> str:
        """使用pythonOCC判断文件类型"""
        label = shape_tool.Label()

        # 检查是否为装配体
        if shape_tool.IsAssembly(label):
            return 'assembly'

        # 检查子节点数量
        if label.NbChildren() > 1:
            return 'assembly'

        return 'part'

    def _traverse_assembly_tree(self, shape_tool, label, level=0, parent_trsf=None):
        """递归遍历装配树（核心算法）"""
        if parent_trsf is None:
            parent_trsf = gp_Trsf()

        # 获取当前节点的名称
        try:
            from OCC.Core.TDataStd import TDataStd_Name
            name_attr = TDataStd_Name()
            if label.FindAttribute(TDataStd_Name.GetID(), name_attr):
                part_name = name_attr.Get().ToExtString()
            else:
                part_name = f"Part_{label.Tag()}"
        except:
            part_name = f"Part_{label.Tag()}"

        # 检查是否为装配体
        if shape_tool.IsAssembly(label):
            print(f"  {'  '*level}📦 装配体: {part_name}")

            # 遍历子节点
            for i in range(1, label.NbChildren() + 1):
                child_label = label.FindChild(i)

                # 获取局部变换矩阵
                loc = shape_tool.GetLocation(child_label)
                local_trsf = loc.Transformation() if loc else gp_Trsf()

                # 计算全局变换（累积）
                global_trsf = gp_Trsf(parent_trsf)
                global_trsf.Multiply(local_trsf)

                # 递归处理子节点
                self._traverse_assembly_tree(shape_tool, child_label, level+1, global_trsf)

        else:
            # 叶子节点 = 零件
            print(f"  {'  '*level}🔩 零件: {part_name}")

            shape = shape_tool.GetShape(label)
            if not shape.IsNull():
                # 提取几何特征（应用全局变换）
                features = self._extract_features_from_shape(shape, parent_trsf)

                self.parts.append({
                    'part_id': part_name,
                    'file_name': part_name,
                    'features': features,
                    'transform': self._trsf_to_dict(parent_trsf)
                })

    def _extract_features_from_shape(self, shape, trsf) -> List[Dict]:
        """从单个零件中提取所有几何特征（核心算法）"""
        features = []

        # 遍历所有面
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        face_count = 0

        while face_explorer.More():
            face = face_explorer.Current()
            surf_adaptor = BRepAdaptor_Surface(face)
            surf_type = surf_adaptor.GetType()

            # 根据曲面类型提取特征
            if surf_type == GeomAbs_Plane:
                feature = self._extract_plane(surf_adaptor, trsf)
                if feature:
                    features.append(feature)

            elif surf_type == GeomAbs_Cylinder:
                feature = self._extract_cylinder(surf_adaptor, trsf)
                if feature:
                    features.append(feature)

            elif surf_type == GeomAbs_Cone:
                feature = self._extract_cone(surf_adaptor, trsf)
                if feature:
                    features.append(feature)

            elif surf_type == GeomAbs_Sphere:
                feature = self._extract_sphere(surf_adaptor, trsf)
                if feature:
                    features.append(feature)

            elif surf_type == GeomAbs_Torus:
                feature = self._extract_torus(surf_adaptor, trsf)
                if feature:
                    features.append(feature)

            face_count += 1
            face_explorer.Next()

        print(f"      提取特征: {len(features)} 个（来自 {face_count} 个面）")
        return features

    def _extract_plane(self, surf, trsf) -> Optional[Dict]:
        """提取平面特征"""
        plane = surf.Plane()

        # 局部坐标
        local_pos = plane.Location()
        local_normal = plane.Axis().Direction()

        # 转换到世界坐标
        world_pos = local_pos.Transformed(trsf)
        world_normal_vec = gp_Vec(local_normal).Transformed(trsf)
        world_normal = gp_Dir(world_normal_vec)

        return {
            'type': 'plane',
            'normal': [world_normal.X(), world_normal.Y(), world_normal.Z()],
            'point': [world_pos.X(), world_pos.Y(), world_pos.Z()],
            'u_range': [surf.FirstUParameter(), surf.LastUParameter()],
            'v_range': [surf.FirstVParameter(), surf.LastVParameter()]
        }

    def _extract_cylinder(self, surf, trsf) -> Optional[Dict]:
        """提取圆柱面特征"""
        cylinder = surf.Cylinder()

        # 局部坐标
        local_axis = cylinder.Axis()
        local_center = local_axis.Location()
        local_direction = local_axis.Direction()
        radius = cylinder.Radius()

        # 转换到世界坐标
        world_center = local_center.Transformed(trsf)
        world_dir_vec = gp_Vec(local_direction).Transformed(trsf)
        world_direction = gp_Dir(world_dir_vec)

        # 判断孔/轴（启发式）
        feature_type = 'hole' if radius < 50.0 else 'shaft'

        return {
            'type': 'cylinder',
            'subtype': feature_type,
            'axis': [world_direction.X(), world_direction.Y(), world_direction.Z()],
            'center': [world_center.X(), world_center.Y(), world_center.Z()],
            'radius': radius,
            'u_range': [surf.FirstUParameter(), surf.LastUParameter()],
            'v_range': [surf.FirstVParameter(), surf.LastVParameter()]
        }

    def _extract_cone(self, surf, trsf) -> Optional[Dict]:
        """提取圆锥面特征（螺纹、倒角常见）"""
        cone = surf.Cone()

        local_axis = cone.Axis()
        local_apex = cone.Apex()
        local_direction = local_axis.Direction()
        semi_angle = cone.SemiAngle()  # 半锥角（弧度）

        world_apex = local_apex.Transformed(trsf)
        world_dir_vec = gp_Vec(local_direction).Transformed(trsf)
        world_direction = gp_Dir(world_dir_vec)

        return {
            'type': 'cone',
            'axis': [world_direction.X(), world_direction.Y(), world_direction.Z()],
            'apex': [world_apex.X(), world_apex.Y(), world_apex.Z()],
            'semi_angle_deg': math.degrees(semi_angle),
            'u_range': [surf.FirstUParameter(), surf.LastUParameter()],
            'v_range': [surf.FirstVParameter(), surf.LastVParameter()]
        }

    def _extract_sphere(self, surf, trsf) -> Optional[Dict]:
        """提取球面特征"""
        sphere = surf.Sphere()

        local_center = sphere.Location()
        radius = sphere.Radius()

        world_center = local_center.Transformed(trsf)

        return {
            'type': 'sphere',
            'center': [world_center.X(), world_center.Y(), world_center.Z()],
            'radius': radius
        }

    def _extract_torus(self, surf, trsf) -> Optional[Dict]:
        """提取环面特征（圆角过渡）"""
        torus = surf.Torus()

        local_axis = torus.Axis()
        local_center = local_axis.Location()
        local_direction = local_axis.Direction()
        major_radius = torus.MajorRadius()
        minor_radius = torus.MinorRadius()

        world_center = local_center.Transformed(trsf)
        world_dir_vec = gp_Vec(local_direction).Transformed(trsf)
        world_direction = gp_Dir(world_dir_vec)

        return {
            'type': 'torus',
            'axis': [world_direction.X(), world_direction.Y(), world_direction.Z()],
            'center': [world_center.X(), world_center.Y(), world_center.Z()],
            'major_radius': major_radius,
            'minor_radius': minor_radius
        }

    def _analyze_constraints_pythonocc(self):
        """使用pythonOCC精确分析装配约束"""
        print("\n🔍 分析装配约束（pythonOCC模式）...")

        # 遍历所有零件对
        for i, part_a in enumerate(self.parts):
            for part_b in self.parts[i+1:]:
                # 遍历特征对
                for feat_a in part_a['features']:
                    for feat_b in part_b['features']:
                        constraint = self._match_constraint_pythonocc(
                            feat_a, feat_b,
                            part_a['part_id'], part_b['part_id']
                        )
                        if constraint:
                            self.constraints.append(constraint)

        print(f"  ✅ 识别约束: {len(self.constraints)}")

    def _match_constraint_pythonocc(self, feat_a: Dict, feat_b: Dict,
                                    part_a_id: str, part_b_id: str) -> Optional[Dict]:
        """精确匹配两个特征的约束关系"""

        # Cylinder - Cylinder 配合
        if feat_a['type'] == 'cylinder' and feat_b['type'] == 'cylinder':
            return self._analyze_cylinder_pair(feat_a, feat_b, part_a_id, part_b_id)

        # Plane - Plane 配合
        if feat_a['type'] == 'plane' and feat_b['type'] == 'plane':
            return self._analyze_plane_pair(feat_a, feat_b, part_a_id, part_b_id)

        # Cone - Cylinder 配合（螺纹）
        if (feat_a['type'] == 'cone' and feat_b['type'] == 'cylinder') or \
           (feat_a['type'] == 'cylinder' and feat_b['type'] == 'cone'):
            return self._analyze_thread_pair(feat_a, feat_b, part_a_id, part_b_id)

        return None

    def _analyze_cylinder_pair(self, cyl_a: Dict, cyl_b: Dict,
                               part_a: str, part_b: str) -> Optional[Dict]:
        """分析圆柱-圆柱配合"""
        axis_a = cyl_a['axis']
        axis_b = cyl_b['axis']
        center_a = cyl_a['center']
        center_b = cyl_b['center']

        # 1. 计算轴线夹角
        dot = sum(a*b for a, b in zip(axis_a, axis_b))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, abs(dot)))))

        # 2. 计算轴心距
        axis_distance = self._point_to_line_distance(center_a, center_b, axis_b)

        # 3. 计算中心距
        center_distance = math.sqrt(sum((a-b)**2 for a, b in zip(center_a, center_b)))

        # 判断约束类型

        # 同轴配合（精确判断）
        if angle < 2.0 and axis_distance < 0.5:
            return {
                'type': 'CONCENTRIC',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'axis_distance': round(axis_distance, 3),
                    'angle': round(angle, 2),
                    'radius_a': cyl_a['radius'],
                    'radius_b': cyl_b['radius']
                },
                'reasoning': f'同轴配合：轴心距{axis_distance:.2f}mm，轴线夹角{angle:.1f}°',
                'confidence': 0.95,
                'source': 'pythonocc'
            }

        # 垂直配合
        if 88.0 < angle < 92.0 and center_distance < 300:
            return {
                'type': 'PERPENDICULAR',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'angle': round(angle, 2),
                    'distance': round(center_distance, 2)
                },
                'reasoning': f'垂直配合：夹角{angle:.1f}°，距离{center_distance:.1f}mm',
                'confidence': 0.90,
                'source': 'pythonocc'
            }

        # 平行配合
        if angle < 5.0 and 10 < axis_distance < 200:
            return {
                'type': 'PARALLEL',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'axis_distance': round(axis_distance, 2),
                    'angle': round(angle, 2)
                },
                'reasoning': f'平行配合：轴距{axis_distance:.1f}mm',
                'confidence': 0.85,
                'source': 'pythonocc'
            }

        return None

    def _analyze_plane_pair(self, plane_a: Dict, plane_b: Dict,
                           part_a: str, part_b: str) -> Optional[Dict]:
        """分析平面-平面配合"""
        normal_a = plane_a['normal']
        normal_b = plane_b['normal']
        point_a = plane_a['point']
        point_b = plane_b['point']

        # 1. 法向夹角
        dot = sum(a*b for a, b in zip(normal_a, normal_b))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, abs(dot)))))

        # 2. 点到平面距离
        point_dist = abs(sum((point_a[i] - point_b[i]) * normal_b[i] for i in range(3)))

        # 重合/接触
        if angle < 2.0 and point_dist < 0.1:
            return {
                'type': 'COINCIDENT',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'angle': round(angle, 2),
                    'distance': round(point_dist, 3)
                },
                'reasoning': f'面接触：法向夹角{angle:.1f}°，间距{point_dist:.2f}mm',
                'confidence': 0.95,
                'source': 'pythonocc'
            }

        # 垂直
        if 88.0 < angle < 92.0:
            return {
                'type': 'PERPENDICULAR',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {'angle': round(angle, 2)},
                'reasoning': f'垂直：夹角{angle:.1f}°',
                'confidence': 0.90,
                'source': 'pythonocc'
            }

        return None

    def _analyze_thread_pair(self, feat_a: Dict, feat_b: Dict,
                            part_a: str, part_b: str) -> Optional[Dict]:
        """分析螺纹配合（圆锥+圆柱）"""
        cone = feat_a if feat_a['type'] == 'cone' else feat_b
        cylinder = feat_b if feat_a['type'] == 'cone' else feat_a

        # 检查锥角是否符合螺纹特征（30°-60°）
        semi_angle = cone.get('semi_angle_deg', 0)
        if not (30 < semi_angle < 60):
            return None

        # 检查轴线是否对齐
        axis_a = cone['axis']
        axis_b = cylinder['axis']
        dot = sum(a*b for a, b in zip(axis_a, axis_b))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, abs(dot)))))

        if angle < 5.0:
            return {
                'type': 'SCREW',
                'part_a': part_a,
                'part_b': part_b,
                'parameters': {
                    'thread_angle': round(semi_angle * 2, 1),
                    'axis_angle': round(angle, 2)
                },
                'reasoning': f'螺纹配合：螺纹角{semi_angle*2:.1f}°',
                'confidence': 0.80,
                'source': 'pythonocc'
            }

        return None

    # ==================== 正则解析（兼容模式） ====================

    def _parse_with_regex(self, filepath: str) -> Dict:
        """使用正则表达式快速解析（兼容旧版）"""
        filename = Path(filepath).name

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 提取所有实体
        entity_pattern = r'#(\d+)\s*=\s*([A-Z_0-9]+)\s*\((.*?)\);'
        for match in re.finditer(entity_pattern, content, re.DOTALL):
            entity_id = match.group(1)
            entity_type = match.group(2)
            entity_data = match.group(3)
            self.entities[entity_id] = {
                'type': entity_type,
                'data': entity_data
            }

        print(f"  ✅ 提取 {len(self.entities)} 个实体")

        # 解析产品
        self._parse_products_regex()

        # 解析装配关系
        self._parse_assemblies_regex()

        # 判断文件类型
        self.file_type = self._identify_file_type_regex(filename)
        print(f"  🔍 文件类型: {self.file_type}")

        # 解析几何
        self._parse_geometry_regex()

        # 解析圆柱面
        self._parse_cylinders_regex()

        # 解析圆锥面（新增）
        self._parse_cones_regex()

        # 分析约束
        self._analyze_constraints_regex()

        return self._export_results()

    def _identify_file_type_regex(self, filename: str) -> str:
        """正则模式：识别文件类型"""
        if filename.startswith('A') and filename[1:].split('.')[0].isdigit():
            return 'assembly'
        elif len(self.assemblies) > 0 or len(self.products) > 1:
            return 'assembly'
        return 'part'

    def _parse_products_regex(self):
        """正则模式：提取产品"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'PRODUCT':
                name_match = re.search(r"'([^']*)'", entity['data'])
                if name_match:
                    self.products[entity_id] = {
                        'id': entity_id,
                        'name': name_match.group(1)
                    }
        print(f"  🔹 产品数量: {len(self.products)}")

    def _parse_assemblies_regex(self):
        """正则模式：提取装配关系"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'NEXT_ASSEMBLY_USAGE_OCCURRENCE':
                refs = re.findall(r'#(\d+)', entity['data'])
                if len(refs) >= 2:
                    self.assemblies.append({
                        'id': entity_id,
                        'parent': refs[0],
                        'child': refs[1]
                    })
        print(f"  🔗 装配关系: {len(self.assemblies)}")

    def _parse_geometry_regex(self):
        """正则模式：解析几何"""
        # 解析坐标点
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'CARTESIAN_POINT':
                coords = re.findall(r'([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)', entity['data'])
                coords = [c for c in coords if c]
                if len(coords) >= 3:
                    try:
                        self.positions[entity_id] = [float(coords[0]), float(coords[1]), float(coords[2])]
                    except ValueError:
                        pass

        # 解析方向向量
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'DIRECTION':
                coords = re.findall(r'([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)', entity['data'])
                coords = [c for c in coords if c]
                if len(coords) >= 3:
                    try:
                        self.directions[entity_id] = [float(coords[0]), float(coords[1]), float(coords[2])]
                    except ValueError:
                        pass

        # 解析AXIS2_PLACEMENT_3D
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'AXIS2_PLACEMENT_3D':
                refs = re.findall(r'#(\d+)', entity['data'])
                if len(refs) >= 1:
                    placement = {'id': entity_id}
                    if refs[0] in self.positions:
                        placement['position'] = self.positions[refs[0]]
                    if len(refs) >= 2 and refs[1] in self.directions:
                        placement['z_axis'] = self.directions[refs[1]]
                    if len(refs) >= 3 and refs[2] in self.directions:
                        placement['x_axis'] = self.directions[refs[2]]
                    if 'position' in placement:
                        self.placements[entity_id] = placement

        print(f"  📍 位置数据: {len(self.positions)}")
        print(f"  🎯 空间变换: {len(self.placements)}")

    def _parse_cylinders_regex(self):
        """正则模式：提取圆柱面"""
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'CYLINDRICAL_SURFACE':
                refs = re.findall(r'#(\d+)', entity['data'])
                if refs:
                    placement_id = refs[0]
                    radius_match = re.search(r',\s*([\d.E+-]+)\s*\)', entity['data'])
                    radius = float(radius_match.group(1)) if radius_match else None

                    if placement_id in self.placements and radius:
                        self.cylinders.append({
                            'id': entity_id,
                            'placement': self.placements[placement_id],
                            'radius': radius,
                            'type': 'hole' if radius < 50 else 'shaft'
                        })
        print(f"  🕳️  圆柱特征: {len(self.cylinders)}")

    def _parse_cones_regex(self):
        """正则模式：提取圆锥面（新增）"""
        cone_count = 0
        for entity_id, entity in self.entities.items():
            if entity['type'] == 'CONICAL_SURFACE':
                refs = re.findall(r'#(\d+)', entity['data'])
                radius_angle_match = re.findall(r'([\d.E+-]+)', entity['data'])

                if refs and len(radius_angle_match) >= 2:
                    placement_id = refs[0]
                    try:
                        radius = float(radius_angle_match[-2])
                        semi_angle = float(radius_angle_match[-1])

                        if placement_id in self.placements:
                            # 添加到圆柱列表（临时）
                            self.cylinders.append({
                                'id': entity_id,
                                'placement': self.placements[placement_id],
                                'radius': radius,
                                'semi_angle': semi_angle,
                                'type': 'cone'
                            })
                            cone_count += 1
                    except (ValueError, IndexError):
                        pass
        print(f"  🔺 圆锥特征: {cone_count}")

    def _analyze_constraints_regex(self):
        """正则模式：分析约束"""
        print("\n🔍 分析装配约束（正则模式）...")

        placements_list = list(self.placements.values())

        # 1. 轴向配合
        for i, p1 in enumerate(placements_list):
            for p2 in placements_list[i+1:]:
                constraint = self._analyze_mate_type_regex(p1, p2)
                if constraint:
                    self.constraints.append(constraint)

        # 2. 孔对孔约束
        for i, c1 in enumerate(self.cylinders):
            for c2 in self.cylinders[i+1:]:
                constraint = self._analyze_hole_constraint_regex(c1, c2)
                if constraint:
                    self.constraints.append(constraint)

        print(f"  ✅ 识别约束: {len(self.constraints)}")

    def _analyze_mate_type_regex(self, p1: Dict, p2: Dict) -> Optional[Dict]:
        """正则模式：分析配合类型"""
        if 'z_axis' not in p1 or 'z_axis' not in p2:
            return None
        if 'position' not in p1 or 'position' not in p2:
            return None

        z1 = p1['z_axis']
        z2 = p2['z_axis']
        pos1 = p1['position']
        pos2 = p2['position']

        dot = sum(a*b for a, b in zip(z1, z2))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, dot))))
        distance = math.sqrt(sum((a-b)**2 for a, b in zip(pos1, pos2)))

        if distance > 300:
            return None

        mate_type = None
        if angle < 5 or angle > 175:
            mate_type = 'CONCENTRIC'
        elif 85 < angle < 95:
            mate_type = 'PERPENDICULAR'
        else:
            mate_type = f'ANGLE_{int(angle)}'

        return {
            'type': mate_type,
            'part_a': f'Placement#{p1["id"]}',
            'part_b': f'Placement#{p2["id"]}',
            'parameters': {
                'distance': round(distance, 2),
                'angle': round(angle, 2)
            },
            'reasoning': f'{mate_type}配合（距离{distance:.1f}mm）',
            'confidence': 0.6,
            'source': 'regex'
        }

    def _analyze_hole_constraint_regex(self, c1: Dict, c2: Dict) -> Optional[Dict]:
        """正则模式：孔-孔约束"""
        p1 = c1['placement']
        p2 = c2['placement']

        if 'position' not in p1 or 'position' not in p2:
            return None

        pos1 = p1['position']
        pos2 = p2['position']
        distance = math.sqrt(sum((a-b)**2 for a, b in zip(pos1, pos2)))

        if distance < 200:
            return {
                'type': 'HOLE_SPACING',
                'part_a': f'Hole#{c1["id"]}',
                'part_b': f'Hole#{c2["id"]}',
                'parameters': {
                    'distance': round(distance, 2),
                    'radius1': c1['radius'],
                    'radius2': c2['radius']
                },
                'reasoning': f'孔间距约束（{distance:.1f}mm）',
                'confidence': 0.8,
                'source': 'regex'
            }

        return None

    # ==================== 工具方法 ====================

    def _trsf_to_dict(self, trsf) -> Dict:
        """变换矩阵转字典"""
        return {
            'translation': [
                trsf.TranslationPart().X(),
                trsf.TranslationPart().Y(),
                trsf.TranslationPart().Z()
            ],
            'rotation': [
                [trsf.Value(i, j) for j in range(1, 4)]
                for i in range(1, 4)
            ]
        }

    def _point_to_line_distance(self, point: List[float], line_point: List[float],
                                line_dir: List[float]) -> float:
        """点到直线的距离"""
        # 向量 point - line_point
        vec = [point[i] - line_point[i] for i in range(3)]

        # 投影长度
        proj_length = sum(vec[i] * line_dir[i] for i in range(3))

        # 投影点
        proj_point = [line_point[i] + proj_length * line_dir[i] for i in range(3)]

        # 距离
        return math.sqrt(sum((point[i] - proj_point[i])**2 for i in range(3)))

    def _export_results(self) -> Dict:
        """导出分析结果"""
        if self.use_pythonocc:
            # pythonOCC模式
            return {
                'file_type': self.file_type,
                'parser_mode': 'pythonocc',
                'metadata': {
                    'parts_count': len(self.parts),
                    'constraints_count': len(self.constraints),
                    'total_features': sum(len(p['features']) for p in self.parts)
                },
                'parts': self.parts,
                'constraints': self.constraints
            }
        else:
            # 正则模式
            return {
                'file_type': self.file_type,
                'parser_mode': 'regex',
                'metadata': {
                    'products_count': len(self.products),
                    'assemblies_count': len(self.assemblies),
                    'placements_count': len(self.placements),
                    'cylinders_count': len(self.cylinders),
                    'constraints_count': len(self.constraints)
                },
                'products': list(self.products.values()),
                'assemblies': self.assemblies,
                'cylinders': [{
                    'id': c['id'],
                    'type': c['type'],
                    'radius': c['radius'],
                    'position': c['placement'].get('position'),
                    'axis': c['placement'].get('z_axis')
                } for c in self.cylinders],
                'constraints': self.constraints
            }


def main():
    if len(sys.argv) < 2:
        print("Usage: python step_assembly_analyzer_v2.py <step_file> [output_json] [--regex]")
        print("\n选项:")
        print("  --regex    强制使用正则解析模式（即使pythonOCC可用）")
        sys.exit(1)

    step_file = sys.argv[1]
    output_file = None
    use_pythonocc = True

    # 解析参数
    for arg in sys.argv[2:]:
        if arg == '--regex':
            use_pythonocc = False
        elif not output_file:
            output_file = arg

    if not output_file:
        output_file = Path(step_file).stem + '_analysis.json'

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║          STEP装配智能分析器 V2.0                               ║")
    print("║          pythonOCC精确分析 + 正则快速解析                      ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    analyzer = StepAssemblyAnalyzerV2(use_pythonocc=use_pythonocc)
    results = analyzer.parse_step_file(step_file)

    # 输出结果
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n💾 结果已导出: {output_file}")
    print(f"   文件大小: {Path(output_file).stat().st_size / 1024:.1f} KB")

    print("\n📊 分析摘要:")
    print(f"  解析模式: {results['parser_mode']}")
    print(f"  文件类型: {results['file_type']}")
    if results['parser_mode'] == 'pythonocc':
        print(f"  零件数: {results['metadata']['parts_count']}")
        print(f"  总特征数: {results['metadata']['total_features']}")
    else:
        print(f"  产品数: {results['metadata']['products_count']}")
        print(f"  装配关系: {results['metadata']['assemblies_count']}")
    print(f"  约束数: {results['metadata']['constraints_count']}")


if __name__ == '__main__':
    main()
