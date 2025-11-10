#!/usr/bin/env python3
"""
PID识别命令行工具
供Node.js服务调用
"""
import sys
import json
import numpy as np
from pathlib import Path

# 添加当前目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from PIDRecognitionService import PIDRecognitionService

class NumpyEncoder(json.JSONEncoder):
    """处理NumPy类型的JSON编码器"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 pid_recognition_cli.py <pdf_path>'
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]

    if not Path(pdf_path).exists():
        print(json.dumps({
            'success': False,
            'error': f'File not found: {pdf_path}'
        }))
        sys.exit(1)

    try:
        service = PIDRecognitionService()
        result = service.recognize_pid(pdf_path)

        # 输出JSON结果到stdout（供Node.js解析）
        print(json.dumps(result, ensure_ascii=False, cls=NumpyEncoder))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'components': [],
            'connections': [],
            'page_count': 0
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
