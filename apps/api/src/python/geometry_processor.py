#!/usr/bin/env python3
"""
几何处理服务
处理 DXF/SHP 文件解析和红线偏移计算
"""

import sys
import json
import traceback
from typing import List, Dict, Tuple

try:
    import ezdxf
    from shapely.geometry import Polygon, MultiPolygon, Point, LineString
    from shapely.ops import unary_union
    import shapely.affinity as affinity
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Required Python packages not installed. Please run: pip install ezdxf shapely"
    }))
    sys.exit(1)


class GeometryProcessor:
    """几何处理器"""

    def __init__(self):
        pass

    def parse_dxf(self, file_path: str) -> Dict:
        """
        解析DXF文件

        Args:
            file_path: DXF文件路径

        Returns:
            Dict包含解析结果
        """
        try:
            doc = ezdxf.readfile(file_path)
            msp = doc.modelspace()

            boundaries = []
            polylines = []
            points = []

            # 提取多边形边界
            for entity in msp:
                if entity.dxftype() == 'LWPOLYLINE':
                    coords = [(p[0], p[1]) for p in entity.get_points()]
                    if len(coords) >= 3:
                        polylines.append({
                            'type': 'LWPOLYLINE',
                            'coordinates': coords,
                            'closed': entity.closed
                        })

                        if entity.closed:
                            boundaries.append({
                                'type': 'polygon',
                                'coordinates': coords,
                                'area': self._calculate_polygon_area(coords)
                            })

                elif entity.dxftype() == 'POLYLINE':
                    coords = [(v.dxf.location.x, v.dxf.location.y)
                             for v in entity.vertices]
                    if len(coords) >= 3:
                        polylines.append({
                            'type': 'POLYLINE',
                            'coordinates': coords,
                            'closed': entity.is_closed
                        })

                elif entity.dxftype() == 'LINE':
                    start = entity.dxf.start
                    end = entity.dxf.end
                    polylines.append({
                        'type': 'LINE',
                        'coordinates': [
                            (start.x, start.y),
                            (end.x, end.y)
                        ]
                    })

                elif entity.dxftype() == 'POINT':
                    loc = entity.dxf.location
                    points.append({
                        'x': loc.x,
                        'y': loc.y,
                        'z': loc.z if hasattr(loc, 'z') else 0
                    })

            return {
                'success': True,
                'file_path': file_path,
                'boundaries': boundaries,
                'polylines': polylines,
                'points': points,
                'total_boundaries': len(boundaries),
                'total_entities': len(list(msp))
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'DXF parsing failed: {str(e)}',
                'traceback': traceback.format_exc()
            }

    def parse_shp(self, file_path: str) -> Dict:
        """
        解析SHP文件

        Args:
            file_path: SHP文件路径

        Returns:
            Dict包含解析结果
        """
        try:
            import geopandas as gpd

            gdf = gpd.read_file(file_path)

            boundaries = []
            for idx, row in gdf.iterrows():
                geom = row.geometry

                if geom.geom_type == 'Polygon':
                    coords = list(geom.exterior.coords)
                    boundaries.append({
                        'type': 'polygon',
                        'coordinates': coords,
                        'area': geom.area,
                        'properties': row.drop('geometry').to_dict()
                    })

                elif geom.geom_type == 'MultiPolygon':
                    for poly in geom.geoms:
                        coords = list(poly.exterior.coords)
                        boundaries.append({
                            'type': 'polygon',
                            'coordinates': coords,
                            'area': poly.area,
                            'properties': row.drop('geometry').to_dict()
                        })

            return {
                'success': True,
                'file_path': file_path,
                'boundaries': boundaries,
                'total_features': len(gdf),
                'crs': str(gdf.crs) if gdf.crs else None
            }

        except ImportError:
            return {
                'success': False,
                'error': 'geopandas not installed. Please run: pip install geopandas'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'SHP parsing failed: {str(e)}',
                'traceback': traceback.format_exc()
            }

    def calculate_setback(self, boundary_coords: List[Tuple[float, float]],
                         distance: float) -> Dict:
        """
        计算红线退距（向内偏移）

        Args:
            boundary_coords: 边界坐标列表 [(x1, y1), (x2, y2), ...]
            distance: 退距距离（米）

        Returns:
            Dict包含偏移后的边界
        """
        try:
            # 创建多边形
            polygon = Polygon(boundary_coords)

            if not polygon.is_valid:
                # 尝试修复无效多边形
                polygon = polygon.buffer(0)

            # 向内偏移（负值表示向内）
            offset_polygon = polygon.buffer(-distance)

            if offset_polygon.is_empty:
                return {
                    'success': False,
                    'error': f'Setback distance {distance}m is too large, resulting in empty polygon'
                }

            # 处理多个多边形的情况
            if isinstance(offset_polygon, MultiPolygon):
                # 取最大的多边形
                offset_polygon = max(offset_polygon.geoms, key=lambda p: p.area)

            # 提取坐标
            offset_coords = list(offset_polygon.exterior.coords)

            # 计算面积损失
            original_area = polygon.area
            offset_area = offset_polygon.area
            area_loss = original_area - offset_area
            area_loss_percent = (area_loss / original_area * 100) if original_area > 0 else 0

            return {
                'success': True,
                'original_polygon': {
                    'coordinates': boundary_coords,
                    'area': original_area
                },
                'offset_polygon': {
                    'coordinates': offset_coords,
                    'area': offset_area
                },
                'setback_distance': distance,
                'area_loss': area_loss,
                'area_loss_percent': round(area_loss_percent, 2)
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Setback calculation failed: {str(e)}',
                'traceback': traceback.format_exc()
            }

    def calculate_multiple_setbacks(self, boundary_coords: List[Tuple[float, float]],
                                    setbacks: Dict[str, float]) -> Dict:
        """
        计算多条边界的不同退距

        Args:
            boundary_coords: 边界坐标
            setbacks: 各边退距 {'north': 10, 'south': 15, 'east': 20, 'west': 5}

        Returns:
            Dict包含结果
        """
        try:
            polygon = Polygon(boundary_coords)

            if not polygon.is_valid:
                polygon = polygon.buffer(0)

            # 获取边界框
            minx, miny, maxx, maxy = polygon.bounds

            # 应用各边退距
            north_setback = setbacks.get('north', 0)
            south_setback = setbacks.get('south', 0)
            east_setback = setbacks.get('east', 0)
            west_setback = setbacks.get('west', 0)

            # 创建退距框
            setback_box = Polygon([
                (minx + west_setback, miny + south_setback),
                (maxx - east_setback, miny + south_setback),
                (maxx - east_setback, maxy - north_setback),
                (minx + west_setback, maxy - north_setback)
            ])

            # 与原多边形求交
            result_polygon = polygon.intersection(setback_box)

            if result_polygon.is_empty:
                return {
                    'success': False,
                    'error': 'Setbacks are too large, resulting in empty polygon'
                }

            if isinstance(result_polygon, MultiPolygon):
                result_polygon = max(result_polygon.geoms, key=lambda p: p.area)

            result_coords = list(result_polygon.exterior.coords)

            return {
                'success': True,
                'original_area': polygon.area,
                'result_area': result_polygon.area,
                'result_coordinates': result_coords,
                'setbacks_applied': setbacks
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Multiple setbacks calculation failed: {str(e)}',
                'traceback': traceback.format_exc()
            }

    def _calculate_polygon_area(self, coords: List[Tuple[float, float]]) -> float:
        """计算多边形面积（使用鞋带公式）"""
        n = len(coords)
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += coords[i][0] * coords[j][1]
            area -= coords[j][0] * coords[i][1]
        return abs(area) / 2.0


def main():
    """主函数 - 从标准输入读取JSON参数"""
    try:
        # 读取输入
        input_data = json.loads(sys.stdin.read())

        operation = input_data.get('operation')
        processor = GeometryProcessor()

        if operation == 'parse_dxf':
            file_path = input_data.get('file_path')
            result = processor.parse_dxf(file_path)

        elif operation == 'parse_shp':
            file_path = input_data.get('file_path')
            result = processor.parse_shp(file_path)

        elif operation == 'calculate_setback':
            boundary_coords = input_data.get('boundary_coords')
            distance = input_data.get('distance')
            result = processor.calculate_setback(boundary_coords, distance)

        elif operation == 'calculate_multiple_setbacks':
            boundary_coords = input_data.get('boundary_coords')
            setbacks = input_data.get('setbacks')
            result = processor.calculate_multiple_setbacks(boundary_coords, setbacks)

        else:
            result = {
                'success': False,
                'error': f'Unknown operation: {operation}'
            }

        # 输出结果
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
