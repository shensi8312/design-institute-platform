#!/usr/bin/env python3
"""
建筑布局优化器 - 基于OR-Tools CP-SAT求解器
Building Layout Optimizer using OR-Tools CP-SAT Solver

功能:
- 多目标优化 (成本、空间利用率、日照、能耗)
- 约束求解 (退距、面积、间距、合规)
- 建筑位置和尺寸优化
"""

import sys
import json
from ortools.sat.python import cp_model
import math


class BuildingLayoutOptimizer:
    """建筑布局优化器"""

    def __init__(self):
        self.model = None
        self.solver = None

    def optimize_layout(self, params):
        """
        优化建筑布局

        参数:
            params (dict): 优化参数
                - site_boundary: 场地边界坐标 [[x1,y1], [x2,y2], ...]
                - required_area: 要求建筑面积 (m²)
                - setback_distances: 退距要求 {north, south, east, west}
                - objectives: 优化目标 {cost_weight, space_weight, sunlight_weight, energy_weight}
                - constraints: 额外约束
                - options: 求解选项 {max_time_seconds, num_solutions}

        返回:
            dict: 优化结果
        """
        try:
            # 提取参数
            site_boundary = params.get('site_boundary', [])
            required_area = params.get('required_area', 10000)
            setback_distances = params.get('setback_distances', {})
            objectives = params.get('objectives', {
                'cost_weight': 0.4,
                'space_weight': 0.3,
                'sunlight_weight': 0.2,
                'energy_weight': 0.1
            })
            constraints_config = params.get('constraints', {})
            options = params.get('options', {
                'max_time_seconds': 60,
                'num_solutions': 5
            })

            # 计算场地边界
            site_bbox = self._calculate_bbox(site_boundary)

            # 应用退距
            setback_bbox = self._apply_setbacks(site_bbox, setback_distances)

            # 创建CP-SAT模型
            model = cp_model.CpModel()

            # ========== 决策变量 ==========

            # 建筑尺寸 (缩放到整数, 单位: 0.1m)
            min_dim = 100  # 10m
            max_width = int((setback_bbox['max_x'] - setback_bbox['min_x']) * 10)
            max_length = int((setback_bbox['max_y'] - setback_bbox['min_y']) * 10)

            building_width = model.NewIntVar(min_dim, max_width, 'building_width')
            building_length = model.NewIntVar(min_dim, max_length, 'building_length')

            # 建筑位置 (左下角坐标, 缩放到整数)
            building_x = model.NewIntVar(
                int(setback_bbox['min_x'] * 10),
                int(setback_bbox['max_x'] * 10),
                'building_x'
            )
            building_y = model.NewIntVar(
                int(setback_bbox['min_y'] * 10),
                int(setback_bbox['max_y'] * 10),
                'building_y'
            )

            # 建筑方向 (0=正向, 1=旋转90度)
            building_orientation = model.NewBoolVar('building_orientation')

            # ========== 约束条件 ==========

            # 1. 面积约束 (width * length >= required_area)
            required_area_scaled = int(required_area * 100)  # 转换为 (0.1m)²
            area = model.NewIntVar(0, max_width * max_length, 'area')
            model.AddMultiplicationEquality(area, [building_width, building_length])
            model.Add(area >= required_area_scaled)

            # 2. 边界约束 (建筑必须在退距后的范围内)
            # 根据方向选择实际占用的宽度和长度
            actual_width = model.NewIntVar(min_dim, max(max_width, max_length), 'actual_width')
            actual_length = model.NewIntVar(min_dim, max(max_width, max_length), 'actual_length')

            # 如果orientation=0: actual_width=width, actual_length=length
            # 如果orientation=1: actual_width=length, actual_length=width
            model.Add(actual_width == building_width).OnlyEnforceIf(building_orientation.Not())
            model.Add(actual_length == building_length).OnlyEnforceIf(building_orientation.Not())
            model.Add(actual_width == building_length).OnlyEnforceIf(building_orientation)
            model.Add(actual_length == building_width).OnlyEnforceIf(building_orientation)

            # 建筑右上角必须在边界内
            model.Add(building_x + actual_width <= int(setback_bbox['max_x'] * 10))
            model.Add(building_y + actual_length <= int(setback_bbox['max_y'] * 10))

            # 3. 长宽比约束 (1.2 <= length/width <= 2.5)
            # 为了处理整数，使用: 12*width <= 10*length <= 25*width
            model.Add(12 * building_width <= 10 * building_length)
            model.Add(10 * building_length <= 25 * building_width)

            # 4. 额外约束
            if constraints_config.get('min_spacing_to_site_boundary'):
                min_spacing = int(constraints_config['min_spacing_to_site_boundary'] * 10)
                model.Add(building_x >= int(setback_bbox['min_x'] * 10) + min_spacing)
                model.Add(building_y >= int(setback_bbox['min_y'] * 10) + min_spacing)

            if constraints_config.get('prefer_square_shape'):
                # 尽量接近正方形: |width - length| 最小化
                diff = model.NewIntVar(-max(max_width, max_length), max(max_width, max_length), 'shape_diff')
                model.Add(diff == building_width - building_length)

            # ========== 优化目标 ==========

            # 目标1: 最小化建造成本 (假设成本 = 周长 * 单位成本)
            perimeter = model.NewIntVar(0, 2 * (max_width + max_length), 'perimeter')
            model.Add(perimeter == 2 * (building_width + building_length))

            # 目标2: 最大化空间利用率 (面积 / 可用面积)
            available_area = int((setback_bbox['max_x'] - setback_bbox['min_x']) *
                                (setback_bbox['max_y'] - setback_bbox['min_y']) * 100)
            space_utilization = model.NewIntVar(0, 100, 'space_utilization')
            # space_utilization = (area / available_area) * 100
            if available_area > 0:
                model.AddDivisionEquality(space_utilization, area * 100, available_area)

            # 目标3: 优化日照 (南向优先, orientation=0时日照更好)
            sunlight_score = model.NewIntVar(0, 100, 'sunlight_score')
            model.Add(sunlight_score == 100).OnlyEnforceIf(building_orientation.Not())
            model.Add(sunlight_score == 60).OnlyEnforceIf(building_orientation)

            # 目标4: 能耗优化 (紧凑形状, 周长越小能耗越低)
            # 标准化周长得分: (max_perimeter - perimeter) / max_perimeter * 100
            max_perimeter = 2 * (max_width + max_length)
            energy_score = model.NewIntVar(0, 100, 'energy_score')
            if max_perimeter > 0:
                model.AddDivisionEquality(
                    energy_score,
                    (max_perimeter - perimeter) * 100,
                    max_perimeter
                )

            # 加权多目标优化
            cost_weight = int(objectives.get('cost_weight', 0.4) * 100)
            space_weight = int(objectives.get('space_weight', 0.3) * 100)
            sunlight_weight = int(objectives.get('sunlight_weight', 0.2) * 100)
            energy_weight = int(objectives.get('energy_weight', 0.1) * 100)

            # 总得分 = 空间利用率*权重 + 日照得分*权重 + 能耗得分*权重 - 成本*权重
            total_score = model.NewIntVar(-1000000, 1000000, 'total_score')
            model.Add(
                total_score ==
                space_utilization * space_weight +
                sunlight_score * sunlight_weight +
                energy_score * energy_weight -
                perimeter * cost_weight // 100  # 降低成本的权重
            )

            # 最大化总得分
            model.Maximize(total_score)

            # ========== 求解 ==========

            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = options.get('max_time_seconds', 60)
            solver.parameters.num_search_workers = 8  # 并行搜索
            solver.parameters.log_search_progress = False

            # 收集多个解决方案
            class SolutionCollector(cp_model.CpSolverSolutionCallback):
                def __init__(self, variables, limit):
                    cp_model.CpSolverSolutionCallback.__init__(self)
                    self._variables = variables
                    self._solution_limit = limit
                    self._solutions = []

                def on_solution_callback(self):
                    if len(self._solutions) < self._solution_limit:
                        solution = {}
                        for var_name, var in self._variables.items():
                            solution[var_name] = self.Value(var)
                        self._solutions.append(solution)

                def get_solutions(self):
                    return self._solutions

            solution_collector = SolutionCollector(
                {
                    'building_width': building_width,
                    'building_length': building_length,
                    'building_x': building_x,
                    'building_y': building_y,
                    'building_orientation': building_orientation,
                    'area': area,
                    'perimeter': perimeter,
                    'space_utilization': space_utilization,
                    'sunlight_score': sunlight_score,
                    'energy_score': energy_score,
                    'total_score': total_score
                },
                options.get('num_solutions', 5)
            )

            status = solver.Solve(model, solution_collector)

            # ========== 处理结果 ==========

            if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
                solutions = solution_collector.get_solutions()

                if len(solutions) == 0:
                    # 如果没有收集到解决方案，使用最优解
                    solutions = [{
                        'building_width': solver.Value(building_width),
                        'building_length': solver.Value(building_length),
                        'building_x': solver.Value(building_x),
                        'building_y': solver.Value(building_y),
                        'building_orientation': solver.Value(building_orientation),
                        'area': solver.Value(area),
                        'perimeter': solver.Value(perimeter),
                        'space_utilization': solver.Value(space_utilization),
                        'sunlight_score': solver.Value(sunlight_score),
                        'energy_score': solver.Value(energy_score),
                        'total_score': solver.Value(total_score)
                    }]

                # 格式化所有解决方案
                formatted_solutions = []
                for idx, sol in enumerate(solutions):
                    # 转换回实际单位
                    width = sol['building_width'] / 10.0
                    length = sol['building_length'] / 10.0
                    x = sol['building_x'] / 10.0
                    y = sol['building_y'] / 10.0
                    orientation = sol['building_orientation']

                    # 根据方向计算实际占用
                    if orientation == 0:
                        actual_width = width
                        actual_length = length
                    else:
                        actual_width = length
                        actual_length = width

                    # 生成建筑轮廓
                    footprint = [
                        [x, y],
                        [x + actual_width, y],
                        [x + actual_width, y + actual_length],
                        [x, y + actual_length],
                        [x, y]  # 闭合
                    ]

                    formatted_solutions.append({
                        'rank': idx + 1,
                        'building_footprint': footprint,
                        'dimensions': {
                            'width': round(width, 2),
                            'length': round(length, 2),
                            'area': round(sol['area'] / 100.0, 2),
                            'perimeter': round(sol['perimeter'] / 10.0, 2),
                            'orientation': 'north-south' if orientation == 0 else 'east-west'
                        },
                        'position': {
                            'x': round(x, 2),
                            'y': round(y, 2)
                        },
                        'scores': {
                            'total_score': sol['total_score'],
                            'space_utilization': round(sol['space_utilization'], 1),
                            'sunlight_score': sol['sunlight_score'],
                            'energy_score': sol['energy_score'],
                            'cost_per_meter': round(sol['perimeter'] / 10.0 * 1000, 2)  # 假设1000元/米
                        }
                    })

                return {
                    'success': True,
                    'status': 'optimal' if status == cp_model.OPTIMAL else 'feasible',
                    'solver_info': {
                        'wall_time': round(solver.WallTime(), 2),
                        'num_branches': solver.NumBranches(),
                        'num_conflicts': solver.NumConflicts(),
                        'num_solutions_found': len(solutions)
                    },
                    'site_info': {
                        'site_boundary': site_boundary,
                        'setback_boundary': [
                            [setback_bbox['min_x'], setback_bbox['min_y']],
                            [setback_bbox['max_x'], setback_bbox['min_y']],
                            [setback_bbox['max_x'], setback_bbox['max_y']],
                            [setback_bbox['min_x'], setback_bbox['max_y']],
                            [setback_bbox['min_x'], setback_bbox['min_y']]
                        ],
                        'required_area': required_area
                    },
                    'solutions': formatted_solutions,
                    'best_solution': formatted_solutions[0] if formatted_solutions else None
                }

            else:
                return {
                    'success': False,
                    'status': 'infeasible',
                    'message': 'No feasible solution found. Try relaxing constraints or increasing site area.',
                    'solver_info': {
                        'wall_time': round(solver.WallTime(), 2)
                    }
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _calculate_bbox(self, boundary):
        """计算边界框"""
        xs = [point[0] for point in boundary]
        ys = [point[1] for point in boundary]

        return {
            'min_x': min(xs),
            'max_x': max(xs),
            'min_y': min(ys),
            'max_y': max(ys)
        }

    def _apply_setbacks(self, bbox, setbacks):
        """应用退距"""
        north = setbacks.get('north', 10)
        south = setbacks.get('south', 10)
        east = setbacks.get('east', 10)
        west = setbacks.get('west', 10)

        return {
            'min_x': bbox['min_x'] + west,
            'max_x': bbox['max_x'] - east,
            'min_y': bbox['min_y'] + south,
            'max_y': bbox['max_y'] - north
        }


def main():
    """主函数 - 从stdin读取参数，输出到stdout"""
    try:
        # 读取输入
        input_data = sys.stdin.read()
        params = json.loads(input_data)

        operation = params.get('operation')

        if operation == 'optimize_layout':
            optimizer = BuildingLayoutOptimizer()
            result = optimizer.optimize_layout(params)
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown operation: {operation}'
            }))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))


if __name__ == '__main__':
    main()
