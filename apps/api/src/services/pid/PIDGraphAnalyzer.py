#!/usr/bin/env python3
"""
PID图拓扑分析服务
- NetworkX构建管线连接图
- 工艺流程路径分析
- 规则验证(P&ID标准)
- 装配约束提取
"""
import networkx as nx
from typing import List, Dict, Tuple
import json
import math

try:
    import matplotlib
    matplotlib.use('Agg')  # 非GUI后端
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    print("⚠️  Matplotlib未安装，图可视化功能受限")
    HAS_MATPLOTLIB = False

class PIDGraphAnalyzer:
    def __init__(self):
        # P&ID规则库
        self.rules = {
            # 入口组件类型
            'inlet_types': ['pump', 'pump_or_instrument'],

            # 出口组件类型
            'outlet_types': ['tank_or_equipment', 'equipment'],

            # 必须成对的组件
            'paired_components': {
                'pump': ['valve'],  # 泵后必须有阀
                'filter_or_controller': ['indicator'],  # 过滤器需要压差指示
            },

            # 串联顺序规则
            'sequence_rules': [
                ('pump', 'valve'),  # 泵→阀门
                ('valve', 'filter_or_controller'),  # 阀门→过滤器
                ('filter_or_controller', 'indicator'),  # 过滤器→仪表
            ]
        }

    def analyze(self, components: List[Dict], connections: List[Dict]) -> Dict:
        """完整分析PID图拓扑"""
        print("🔍 开始图拓扑分析...")

        # 1. 构建NetworkX图
        G = self._build_graph(components, connections)
        print(f"  ✅ 构建图: {G.number_of_nodes()} 节点, {G.number_of_edges()} 边")

        # 2. 分析连通性
        connectivity = self._analyze_connectivity(G)
        print(f"  ✅ 连通性分析: {connectivity['num_components']} 个连通子图")

        # 3. 识别管线路径
        pipelines = self._identify_pipelines(G, components)
        print(f"  ✅ 识别管线: {len(pipelines)} 条")

        # 4. 规则验证
        validation = self._validate_rules(G, components, pipelines)
        print(f"  ✅ 规则验证: {validation['num_violations']} 个违规")

        # 5. 提取装配约束
        constraints = self._extract_assembly_constraints(G, components, pipelines)
        print(f"  ✅ 装配约束: {len(constraints)} 条")

        # 6. 生成工艺流程报告
        process_flow = self._generate_process_flow(pipelines, components)

        return {
            'graph': {
                'nodes': G.number_of_nodes(),
                'edges': G.number_of_edges(),
                'density': round(nx.density(G), 3) if G.number_of_nodes() > 0 else 0
            },
            'connectivity': connectivity,
            'pipelines': pipelines,
            'validation': validation,
            'assembly_constraints': constraints,
            'process_flow': process_flow
        }

    def _build_graph(self, components: List[Dict], connections: List[Dict]) -> nx.DiGraph:
        """构建NetworkX有向图"""
        G = nx.DiGraph()

        # 添加节点(组件)
        for comp in components:
            G.add_node(
                comp['tag_number'],
                type=comp.get('symbol_type'),
                position=comp.get('position'),
                parameters=comp.get('parameters', {}),
                confidence=comp.get('confidence', 0)
            )

        # 添加边(连接)
        for conn in connections:
            G.add_edge(
                conn['from'],
                conn['to'],
                distance=conn.get('distance'),
                confidence=conn.get('confidence', 0)
            )

        return G

    def _analyze_connectivity(self, G: nx.DiGraph) -> Dict:
        """分析图连通性"""
        # 转为无向图分析连通子图
        G_undirected = G.to_undirected()

        connected_components = list(nx.connected_components(G_undirected))

        # 检测孤立节点
        isolated = list(nx.isolates(G))

        # 检测度中心性(哪些节点是关键连接点)
        if G.number_of_nodes() > 0:
            degree_centrality = nx.degree_centrality(G)
            top_hubs = sorted(degree_centrality.items(), key=lambda x: x[1], reverse=True)[:5]
        else:
            top_hubs = []

        return {
            'num_components': len(connected_components),
            'component_sizes': [len(c) for c in connected_components],
            'isolated_nodes': isolated,
            'top_hubs': [{'node': node, 'centrality': round(cent, 3)} for node, cent in top_hubs],
            'is_connected': nx.is_weakly_connected(G) if G.number_of_nodes() > 0 else False
        }

    def _identify_pipelines(self, G: nx.DiGraph, components: List[Dict]) -> List[Dict]:
        """识别管线路径"""
        pipelines = []

        # 找出所有入口节点(泵)
        inlet_nodes = [
            node for node, data in G.nodes(data=True)
            if data.get('type') in self.rules['inlet_types']
        ]

        # 找出所有出口节点(容器/设备)
        outlet_nodes = [
            node for node, data in G.nodes(data=True)
            if data.get('type') in self.rules['outlet_types']
        ]

        # 如果没有明确入口/出口,使用度数判断
        if not inlet_nodes:
            inlet_nodes = [node for node in G.nodes() if G.in_degree(node) == 0]

        if not outlet_nodes:
            outlet_nodes = [node for node in G.nodes() if G.out_degree(node) == 0]

        # 遍历所有入口→出口路径
        pipeline_id = 1
        for inlet in inlet_nodes:
            for outlet in outlet_nodes:
                if inlet == outlet:
                    continue

                try:
                    # 找出所有简单路径
                    paths = list(nx.all_simple_paths(G, inlet, outlet, cutoff=20))

                    for path in paths:
                        # 提取路径上的组件信息
                        path_components = []
                        for node in path:
                            node_data = G.nodes[node]
                            path_components.append({
                                'tag': node,
                                'type': node_data.get('type'),
                                'position': node_data.get('position')
                            })

                        pipelines.append({
                            'id': f'LINE-{pipeline_id:03d}',
                            'inlet': inlet,
                            'outlet': outlet,
                            'length': len(path),
                            'path': path,
                            'components': path_components
                        })
                        pipeline_id += 1
                except nx.NetworkXNoPath:
                    continue

        return pipelines

    def _validate_rules(self, G: nx.DiGraph, components: List[Dict], pipelines: List[Dict]) -> Dict:
        """验证P&ID规则"""
        violations = []

        # 规则1: 泵后必须有阀门
        for node, data in G.nodes(data=True):
            if 'pump' in data.get('type', ''):
                successors = list(G.successors(node))
                has_valve = any(
                    'valve' in G.nodes[s].get('type', '')
                    for s in successors
                )
                if not has_valve:
                    violations.append({
                        'rule': 'pump_must_have_valve',
                        'component': node,
                        'severity': 'warning',
                        'message': f'泵 {node} 后缺少阀门'
                    })

        # 规则2: 孤立组件检查
        isolated = list(nx.isolates(G))
        for node in isolated:
            violations.append({
                'rule': 'no_isolated_components',
                'component': node,
                'severity': 'error',
                'message': f'组件 {node} 未连接到任何管线'
            })

        # 规则3: 仪表必须在主管线上
        for node, data in G.nodes(data=True):
            if 'indicator' in data.get('type', ''):
                # 检查是否在任何管线路径上
                on_pipeline = any(node in p['path'] for p in pipelines)
                if not on_pipeline and G.degree(node) == 0:
                    violations.append({
                        'rule': 'indicator_on_pipeline',
                        'component': node,
                        'severity': 'warning',
                        'message': f'仪表 {node} 不在主管线上'
                    })

        return {
            'num_violations': len(violations),
            'violations': violations,
            'passed': len(violations) == 0
        }

    def _extract_assembly_constraints(self, G: nx.DiGraph, components: List[Dict], pipelines: List[Dict]) -> List[Dict]:
        """提取装配约束"""
        constraints = []

        # 约束1: 管线路径约束
        for pipeline in pipelines:
            for i in range(len(pipeline['path']) - 1):
                from_comp = pipeline['path'][i]
                to_comp = pipeline['path'][i + 1]

                constraints.append({
                    'type': 'connection',
                    'from': from_comp,
                    'to': to_comp,
                    'pipeline': pipeline['id'],
                    'constraint': 'must_connect',
                    'priority': 'high'
                })

        # 约束2: 位置约束(基于实际坐标)
        for comp in components:
            pos = comp.get('position')
            if pos:
                # 找出附近的组件
                nearby = []
                for other in components:
                    if other['tag_number'] == comp['tag_number']:
                        continue

                    other_pos = other.get('position')
                    if other_pos:
                        dist = math.sqrt((pos[0] - other_pos[0])**2 + (pos[1] - other_pos[1])**2)
                        if dist < 100:  # 100px内
                            nearby.append({
                                'tag': other['tag_number'],
                                'distance': round(dist, 2)
                            })

                if nearby:
                    constraints.append({
                        'type': 'proximity',
                        'component': comp['tag_number'],
                        'nearby_components': nearby,
                        'constraint': 'maintain_proximity',
                        'priority': 'medium'
                    })

        # 约束3: 方向约束(基于流向)
        for pipeline in pipelines:
            constraints.append({
                'type': 'flow_direction',
                'pipeline': pipeline['id'],
                'from': pipeline['inlet'],
                'to': pipeline['outlet'],
                'constraint': 'flow_from_inlet_to_outlet',
                'priority': 'high'
            })

        return constraints

    def _generate_process_flow(self, pipelines: List[Dict], components: List[Dict]) -> Dict:
        """生成工艺流程报告"""
        # 统计各类组件数量
        component_stats = {}
        for comp in components:
            comp_type = comp.get('symbol_type', 'unknown')
            component_stats[comp_type] = component_stats.get(comp_type, 0) + 1

        # 生成流程描述
        flow_descriptions = []
        for pipeline in pipelines:
            desc = f"管线 {pipeline['id']}: "
            desc += " → ".join([
                f"{c['tag']}({c['type']})"
                for c in pipeline['components']
            ])
            flow_descriptions.append(desc)

        return {
            'num_pipelines': len(pipelines),
            'component_statistics': component_stats,
            'flow_descriptions': flow_descriptions
        }

    def export_graph_visualization(self, G: nx.DiGraph, output_path: str):
        """导出图可视化"""
        if not HAS_MATPLOTLIB:
            print("  ⚠️  Matplotlib未安装，跳过图可视化")
            return

        try:
            plt.figure(figsize=(20, 15))

            # 使用spring布局
            pos = nx.spring_layout(G, k=2, iterations=50)

            # 绘制节点(按类型着色)
            node_colors = []
            for node in G.nodes():
                node_type = G.nodes[node].get('type', 'unknown')
                if 'pump' in node_type:
                    node_colors.append('lightblue')
                elif 'valve' in node_type:
                    node_colors.append('orange')
                elif 'indicator' in node_type:
                    node_colors.append('lightgreen')
                elif 'equipment' in node_type:
                    node_colors.append('purple')
                else:
                    node_colors.append('gray')

            nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=500, alpha=0.9)
            nx.draw_networkx_edges(G, pos, edge_color='gray', arrows=True, arrowsize=20, alpha=0.5)
            nx.draw_networkx_labels(G, pos, font_size=8)

            plt.title("PID Topology Graph", fontsize=16)
            plt.axis('off')
            plt.tight_layout()
            plt.savefig(output_path, dpi=150, bbox_inches='tight')
            plt.close()

            print(f"  ✅ 图可视化已保存: {output_path}")
        except Exception as e:
            print(f"  ⚠️  图可视化失败: {e}")
