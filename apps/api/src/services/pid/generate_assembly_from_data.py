#!/usr/bin/env python3
"""
从PID识别结果生成装配文件
"""
import sys
import json
from pathlib import Path
from datetime import datetime

# 添加服务目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from PIDtoAssemblyPipeline import PIDtoAssemblyPipeline

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 generate_assembly_from_data.py <json_file>'
        }))
        sys.exit(1)

    json_file = sys.argv[1]

    try:
        # 读取JSON数据
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        components = data.get('components', [])
        connections = data.get('connections', [])

        if not components:
            print(json.dumps({
                'success': False,
                'error': 'No components found'
            }))
            sys.exit(1)

        print(f"📊 收到 {len(components)} 个组件, {len(connections)} 条连接")

        # 初始化流程
        pipeline = PIDtoAssemblyPipeline()

        # 生成装配
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = f'docs/assembly_output_{timestamp}'

        # 创建模拟的PID识别结果
        pid_result = {
            'components': components,
            'connections': connections,
            'page_count': 1
        }

        # 执行流程（跳过PID识别阶段）
        result = pipeline._run_from_components(pid_result, output_dir)

        # 输出结果
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
