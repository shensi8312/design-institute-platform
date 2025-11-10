#!/usr/bin/env python3
"""
视觉LLM服务 - 用多模态大模型识别PID图纸
"""
import os
import base64
import requests
import json
from typing import List, Dict
from pathlib import Path

class VisionLLMService:
    def __init__(self):
        # Qwen-VL服务地址（假设在8001端口）
        self.vl_url = os.getenv('QWEN_VL_URL', 'http://10.10.18.3:8001/v1/chat/completions')
        self.model = os.getenv('QWEN_VL_MODEL', 'Qwen-VL')

    def recognize_pid_with_vision(self, image_path: str) -> Dict:
        """
        使用视觉大模型识别PID图纸

        Returns:
            {
                'components': [...],  # 检测到的组件
                'raw_response': str,  # LLM原始输出
                'confidence': float   # 整体置信度
            }
        """
        print(f"🤖 使用视觉LLM识别PID图纸: {Path(image_path).name}")

        # 1. 读取图片并转base64
        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')

        # 2. 构建Prompt
        prompt = self._build_pid_prompt()

        # 3. 调用Qwen-VL API
        try:
            response = self._call_vision_api(image_data, prompt)

            # 4. 解析LLM输出
            components = self._parse_llm_response(response)

            print(f"  ✅ 视觉LLM识别完成: {len(components)} 个组件")

            return {
                'components': components,
                'raw_response': response,
                'confidence': 0.85  # 视觉模型默认置信度
            }

        except Exception as e:
            print(f"  ⚠️  视觉LLM识别失败: {e}")
            return {
                'components': [],
                'raw_response': str(e),
                'confidence': 0.0
            }

    def _build_pid_prompt(self) -> str:
        """构建PID识别Prompt"""
        return """你是一个专业的P&ID图纸识别专家。请仔细分析这张工艺流程图(P&ID)，识别所有的设备和仪表。

请按以下JSON格式输出（只输出JSON，不要其他文字）:

```json
{
  "components": [
    {
      "tag_number": "位号(如PI-101, V-201)",
      "symbol_type": "类型(valve/pump/indicator/tank/heat_exchanger等)",
      "position": [x坐标像素, y坐标像素],
      "description": "设备描述",
      "confidence": 0.9
    }
  ]
}
```

识别规则:
1. 仔细识别每一个符号，包括：
   - 圆形符号：可能是仪表(PI/TI/FI/LI)、泵
   - 菱形符号：阀门(V)
   - 矩形符号：设备、容器、热交换器
   - 三角形符号：过滤器、特殊设备

2. 如果能看到位号文字，使用实际位号；否则按序号生成(PI-001, V-001等)

3. 尽可能标注每个符号的坐标位置（图片左上角为(0,0)）

4. 确保输出标准JSON格式，可被Python json.loads()解析

开始识别:"""

    def _call_vision_api(self, image_base64: str, prompt: str) -> str:
        """调用Qwen-VL API"""

        # OpenAI兼容格式
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.1,  # 低温度提高准确性
            "max_tokens": 4000
        }

        response = requests.post(
            self.vl_url,
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            raise Exception(f"API错误: {response.status_code} - {response.text}")

        result = response.json()
        return result['choices'][0]['message']['content']

    def _parse_llm_response(self, response: str) -> List[Dict]:
        """解析LLM返回的JSON"""

        # 提取JSON部分（去掉markdown代码块）
        if '```json' in response:
            start = response.find('```json') + 7
            end = response.find('```', start)
            json_str = response[start:end].strip()
        elif '```' in response:
            start = response.find('```') + 3
            end = response.find('```', start)
            json_str = response[start:end].strip()
        else:
            json_str = response.strip()

        try:
            data = json.loads(json_str)
            components = data.get('components', [])

            # 验证和标准化
            standardized = []
            for comp in components:
                if 'tag_number' in comp and 'symbol_type' in comp:
                    standardized.append({
                        'tag_number': comp['tag_number'],
                        'symbol_type': comp['symbol_type'],
                        'position': comp.get('position', [0, 0]),
                        'source': 'vision_llm',
                        'confidence': comp.get('confidence', 0.85),
                        'description': comp.get('description', '')
                    })

            return standardized

        except json.JSONDecodeError as e:
            print(f"  ⚠️  JSON解析失败: {e}")
            print(f"  原始输出: {response[:500]}")
            return []

# 单元测试
if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("用法: python3 VisionLLMService.py <image_path>")
        sys.exit(1)

    service = VisionLLMService()
    result = service.recognize_pid_with_vision(sys.argv[1])

    print("\n" + "="*70)
    print(f"识别结果: {len(result['components'])} 个组件")
    print("="*70)

    for i, comp in enumerate(result['components'], 1):
        print(f"{i}. {comp['tag_number']}: {comp['symbol_type']} @ {comp['position']}")

    print("\n原始输出:")
    print(result['raw_response'])
