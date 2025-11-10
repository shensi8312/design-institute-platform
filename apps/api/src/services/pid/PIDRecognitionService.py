#!/usr/bin/env python3
"""
PID图纸识别服务
- DeepSeek-OCR识别位号和参数
- OpenCV多尺度符号检测
- 生成可视化标注图
"""
import os
import json
import re
import requests
from pathlib import Path
from typing import List, Dict, Tuple
import tempfile
import uuid
import base64

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    print("⚠️  PyMuPDF未安装，PDF功能受限")
    HAS_PYMUPDF = False

try:
    import cv2
    import numpy as np
    HAS_OPENCV = True
except ImportError:
    print("⚠️  OpenCV未安装，符号检测功能受限")
    HAS_OPENCV = False

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    print("⚠️  EasyOCR未安装，图例文字识别受限")
    EASYOCR_AVAILABLE = False

# Global EasyOCR reader instance (lazy initialization)
_easyocr_reader = None

class PIDRecognitionService:
    def __init__(self):
        # DeepSeek-OCR服务地址
        self.ocr_service_url = os.getenv('DOCUMENT_RECOGNITION_SERVICE', 'http://10.10.18.3:7000/ocr')

        # PID符号正则表达式
        self.tag_patterns = {
            'pump': r'P-\d+[A-Z]?',
            'valve': r'V-\d+[A-Z]?',
            'tank': r'T-\d+[A-Z]?',
            'heat_exchanger': r'E-\d+[A-Z]?',
            'pressure_indicator': r'PI-\d+[A-Z]?',
            'temperature_indicator': r'TI-\d+[A-Z]?',
            'flow_indicator': r'FI-\d+[A-Z]?',
            'level_indicator': r'LI-\d+[A-Z]?',
            'control_valve': r'CV-\d+[A-Z]?',
        }

        # 工艺参数正则
        self.parameter_patterns = {
            'pressure': r'(\d+\.?\d*)\s*(MPa|bar|kPa|psi)',
            'temperature': r'(\d+\.?\d*)\s*(°C|℃|K|°F)',
            'flow': r'(\d+\.?\d*)\s*(m³/h|L/min|kg/h|t/h)',
            'diameter': r'DN\s*(\d+)',
            'pressure_class': r'(PN\d+|Class\d+)'
        }

    def recognize_pid(self, pdf_path: str) -> Dict:
        """识别PID图纸（含可视化）"""
        print(f"🔍 识别PID图纸: {Path(pdf_path).name}")

        # 步骤1: PDF转图片
        images = self._pdf_to_images(pdf_path)
        print(f"  ✅ 提取 {len(images)} 页图片")

        # 步骤2: DeepSeek-OCR识别所有文字
        all_text_regions = []
        for page_num, img_path in enumerate(images):
            try:
                page_text = self._ocr_with_deepseek(img_path, page_num)
                all_text_regions.extend(page_text)
            except Exception as e:
                print(f"  ⚠️  第{page_num+1}页OCR失败: {e}")

        print(f"  ✅ 识别文字: {len(all_text_regions)} 个区域")

        # 步骤3: 提取图例（CHART OF SYMBOLS）
        legend_symbols = []
        if HAS_OPENCV and len(images) > 0:
            try:
                legend_symbols = self._extract_legend(images[0], all_text_regions)
                print(f"  ✅ 提取图例: {len(legend_symbols)} 个符号定义")
            except Exception as e:
                print(f"  ⚠️  图例提取失败: {e}")

        # 步骤4: 多尺度符号检测（使用图例模板）
        all_symbols = []
        original_image_paths = []

        if HAS_OPENCV:
            for page_num, img_path in enumerate(images):
                try:
                    page_symbols = self._detect_symbols_multiscale(img_path, page_num, legend_symbols)
                    all_symbols.extend(page_symbols)
                    original_image_paths.append(img_path)
                except Exception as e:
                    print(f"  ⚠️  第{page_num+1}页符号检测失败: {e}")
            print(f"  ✅ 检测符号: {len(all_symbols)} 个")
        else:
            print(f"  ⚠️  OpenCV未安装，跳过符号检测")

        # 步骤4: 从文字中提取组件
        text_components = self._extract_components_from_text(all_text_regions)
        print(f"  ✅ 从文字提取组件: {len(text_components)} 个")

        # 步骤5: 检测引线（连接文字和符号的细线）
        first_image = original_image_paths[0] if len(original_image_paths) > 0 else None
        leader_lines = []
        if HAS_OPENCV and first_image:
            try:
                leader_lines = self._detect_leader_lines(first_image)
                print(f"  ✅ 检测引线: {len(leader_lines)} 条")
            except Exception as e:
                print(f"  ⚠️  引线检测失败: {e}")

        # 步骤6: 引线追踪（文字→符号关联）
        text_to_symbol_map = {}
        if leader_lines and all_text_regions and all_symbols:
            try:
                text_to_symbol_map = self._trace_text_to_symbol(all_text_regions, leader_lines, all_symbols)
                print(f"  ✅ 引线追踪: 关联 {len(text_to_symbol_map)} 个文字-符号对")
            except Exception as e:
                print(f"  ⚠️  引线追踪失败: {e}")

        # 步骤7: 合并组件（使用引线追踪代替邻近匹配）
        try:
            components = self._merge_with_leader_trace(text_components, all_symbols, text_to_symbol_map)
            print(f"  ✅ 合并后组件: {len(components)} 个")
        except Exception as e:
            print(f"  ⚠️  组件合并失败，回退到邻近匹配: {e}")
            components = self._merge_text_and_symbols(text_components, all_symbols, all_text_regions)
            print(f"  ✅ 合并后组件(回退): {len(components)} 个")

        # 步骤8: 推断连接（基于端口邻接）
        connections = []
        if first_image and components:
            try:
                connections = self._infer_connections_by_ports(components, leader_lines, first_image)
                print(f"  ✅ 推断连接(端口邻接): {len(connections)} 条")
            except Exception as e:
                print(f"  ⚠️  端口连接推断失败，回退到旧方法: {e}")
                connections = self._infer_connections(components, first_image)
                print(f"  ✅ 推断连接(回退): {len(connections)} 条")

        # 步骤9: 生成可视化标注图
        visualization_paths = []
        upload_dir = None

        if HAS_OPENCV and len(original_image_paths) > 0:
            for page_num, img_path in enumerate(original_image_paths):
                page_components = [c for c in components if c.get('page') == page_num]
                vis_path = self._create_visualization(img_path, page_components, page_num, legend_symbols)
                if vis_path:
                    visualization_paths.append(vis_path)
                    upload_dir = Path(vis_path).parent

        # 步骤8: 图拓扑分析
        graph_analysis = None
        if len(components) > 0:
            try:
                import sys
                import os
                sys.path.insert(0, os.path.dirname(__file__))
                from PIDGraphAnalyzer import PIDGraphAnalyzer

                analyzer = PIDGraphAnalyzer()
                graph_analysis = analyzer.analyze(components, connections)

                # 导出图可视化
                if upload_dir and HAS_OPENCV:
                    graph_vis_path = upload_dir / f'graph_topology_{uuid.uuid4().hex[:8]}.png'
                    G = analyzer._build_graph(components, connections)
                    analyzer.export_graph_visualization(G, str(graph_vis_path))
                    visualization_paths.append(str(graph_vis_path))

            except Exception as e:
                print(f"  ⚠️  图分析失败: {e}")
                graph_analysis = {'error': str(e)}

        # 清理临时图片
        for img_path in images:
            try:
                if img_path not in original_image_paths:
                    os.unlink(img_path)
            except:
                pass

        return {
            'components': components,
            'connections': connections,
            'legend': legend_symbols,
            'page_count': len(images),
            'visualization_images': visualization_paths,
            'graph_analysis': graph_analysis
        }

    def _pdf_to_images(self, pdf_path: str) -> List[str]:
        """PDF转图片 (使用PyMuPDF)"""
        if not HAS_PYMUPDF:
            print("  ❌ PyMuPDF未安装")
            return []

        images = []
        try:
            doc = fitz.open(pdf_path)
            for page_num in range(min(doc.page_count, 10)):
                page = doc[page_num]

                # 渲染为PNG (3倍分辨率，提高OCR准确率)
                mat = fitz.Matrix(3, 3)
                pix = page.get_pixmap(matrix=mat)

                # 保存到临时文件
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix='.png',
                    prefix=f'pid_page_{page_num}_'
                )
                pix.save(temp_file.name)
                images.append(temp_file.name)
                temp_file.close()

            doc.close()
            return images
        except Exception as e:
            print(f"  ❌ PDF转图片失败: {e}")
            return []

    def _ocr_with_deepseek(self, image_path: str, page_num: int) -> List[Dict]:
        """调用DeepSeek-OCR识别（大图降采样）"""
        try:
            # 读取图片检查尺寸
            img = cv2.imread(image_path)
            if img is None:
                return []

            h, w = img.shape[:2]
            print(f"  🚀 调用DeepSeek-OCR识别第{page_num+1}页 ({w}x{h}px)...")

            # 如果图片过大，缩小到1200px以内
            max_size = 1200
            scale = 1.0
            ocr_image_path = image_path

            if w > max_size or h > max_size:
                scale = min(max_size / w, max_size / h)
                new_w = int(w * scale)
                new_h = int(h * scale)
                print(f"  📐 图片过大，缩放至 {new_w}x{new_h}px")
                resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

                # 保存临时缩放图
                temp_resized = f"/tmp/ocr_resized_{uuid.uuid4().hex[:8]}.png"
                cv2.imwrite(temp_resized, resized)
                ocr_image_path = temp_resized

            # 调用OCR
            try:
                with open(ocr_image_path, 'rb') as f:
                    files = {'file': (os.path.basename(ocr_image_path), f, 'image/png')}
                    response = requests.post(self.ocr_service_url, files=files, timeout=90)

                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') and data.get('text'):
                        # 解析并还原坐标（如果缩放过）
                        regions = self._parse_ocr_response(data, page_num)
                        if scale != 1.0:
                            for region in regions:
                                if 'bbox' in region:
                                    bx, by, bw, bh = region['bbox']
                                    region['bbox'] = (int(bx/scale), int(by/scale), int(bw/scale), int(bh/scale))
                                if 'position' in region:
                                    px, py = region['position']
                                    region['position'] = (int(px/scale), int(py/scale))
                        return regions
                    else:
                        print(f"  ⚠️  OCR返回失败: {data.get('text', '')}")
            finally:
                # 清理临时文件
                if ocr_image_path != image_path and os.path.exists(ocr_image_path):
                    os.remove(ocr_image_path)

            print(f"  ⚠️  OCR服务无响应，使用纯符号检测模式")
            return []

        except Exception as e:
            print(f"  ❌ OCR异常: {e}")
            return []

    def _parse_ocr_response(self, data: Dict, page_num: int) -> List[Dict]:
        """解析OCR响应"""
        text = data.get('text', '')
        print(f"  ✅ OCR成功: {len(text)} 字符")
        if len(text) > 0:
            print(f"  📝 OCR文字预览: {text[:200]}...")

        # 将文字拆分成多个文本区域（按行）
        text_regions = []
        for i, line in enumerate(text.split('\n')):
            if line.strip():
                text_regions.append({
                    'text': line.strip(),
                    'page': page_num,
                    'line': i
                })

        return text_regions

    def _extract_components_from_text(self, text_regions: List[Dict]) -> List[Dict]:
        """从OCR文字中提取组件"""
        components = []

        for region in text_regions:
            text = region['text']
            page = region['page']

            # 匹配位号
            tag_number = None
            symbol_type = None

            for tag_type, pattern in self.tag_patterns.items():
                match = re.search(pattern, text)
                if match:
                    tag_number = match.group(0)
                    symbol_type = tag_type
                    break

            if not tag_number:
                continue

            # 提取参数
            parameters = {}
            for param_type, pattern in self.parameter_patterns.items():
                match = re.search(pattern, text)
                if match:
                    try:
                        parameters[param_type] = {
                            'value': float(match.group(1)),
                            'unit': match.group(2)
                        }
                    except:
                        pass

            components.append({
                'symbol_type': symbol_type,
                'tag_number': tag_number,
                'parameters': parameters,
                'page': page,
                'source': 'ocr',
                'source_text': text,
                'confidence': 0.9
            })

        return components

    def _detect_symbols_multiscale(self, image_path: str, page_num: int, legend_symbols: List[Dict] = None) -> List[Dict]:
        """多尺度符号检测（增强版：圆+菱形+三角+小矩形+端口提取，基于图例匹配）"""
        if legend_symbols is None:
            legend_symbols = []

        if not HAS_OPENCV:
            return []

        img = cv2.imread(image_path)
        if img is None:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        print(f"  🔍 符号检测输入图片: {w}x{h}px")

        # 有效区域：排除图例和标题栏（放宽到85%避免漏检）
        valid_y_max = int(h * 0.85)
        valid_x_max = int(w * 0.95)

        symbols = []

        # 1. 圆形检测（仅检测真正的仪表圆，严格控制）
        # 只检测单一尺寸范围（18-35px半径）
        circles = self._detect_circles(gray, minR=18, maxR=35, minDist=60)
        for x, y, r in circles:
            if y < valid_y_max and x < valid_x_max:
                symbols.append({
                    'symbol_type': 'indicator',
                    'shape': 'circle',
                    'position': [int(x), int(y)],
                    'radius': int(r),
                    'page': page_num,
                    'confidence': 0.85,
                    'source': 'opencv_circle',
                    'ports': [(int(x), int(y-r)), (int(x), int(y+r)), (int(x-r), int(y)), (int(x+r), int(y))]
                })

        # 2. 轮廓检测（菱形、三角形、矩形） - 增强版
        # 使用二值化代替Canny，检测更完整的轮廓
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # 形态学闭运算，连接断裂边缘
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

        # 排除图例区域
        binary[valid_y_max:, :] = 0
        binary[:, valid_x_max:] = 0

        contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        # 调试：统计顶点分布
        vertex_counts = {}

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 60:  # 过小噪点
                continue
            if area > 50000:  # 过大边框
                continue

            # 多边形近似（尝试多个epsilon值，选择最佳）
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue

            # 先用更保守的参数尝试
            approx = cv2.approxPolyDP(cnt, 0.03 * perimeter, True)  # 从0.02调回0.03
            vertices = len(approx)

            vertex_counts[vertices] = vertex_counts.get(vertices, 0) + 1

            # 中心点
            M = cv2.moments(cnt)
            if M['m00'] == 0:
                continue
            cx = int(M['m10'] / M['m00'])
            cy = int(M['m01'] / M['m00'])

            if cy >= valid_y_max or cx >= valid_x_max:
                continue

            # 外接矩形
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h if h > 0 else 0
            bbox_area = w * h
            area_ratio = area / bbox_area if bbox_area > 0 else 0

            # 3. 三角形（手动阀门、流向指示）
            if vertices == 3 and 30 < area < 8000:  # 降低下限从80→30
                ports = [tuple(pt[0].astype(int)) for pt in approx]
                symbols.append({
                    'symbol_type': 'manual_valve',
                    'shape': 'triangle',
                    'position': [cx, cy],
                    'bbox': (x, y, w, h),
                    'page': page_num,
                    'confidence': 0.8,
                    'source': 'opencv_triangle',
                    'ports': ports
                })

            # 4. 四边形 - 区分菱形和矩形
            elif vertices == 4:
                # 菱形：宽高比0.4-2.5，面积比0.2-0.8（进一步放宽）
                if 0.4 < aspect_ratio < 2.5 and 0.20 < area_ratio < 0.80 and 30 < area < 15000:  # 降低下限从80→30
                    ports = [tuple(pt[0].astype(int)) for pt in approx]
                    symbols.append({
                        'symbol_type': 'valve',
                        'shape': 'diamond',
                        'position': [cx, cy],
                        'bbox': (x, y, w, h),
                        'page': page_num,
                        'confidence': 0.85,
                        'source': 'opencv_diamond',
                        'ports': ports
                    })

                # 正方形矩形（控制器、过滤器）
                elif 0.7 < aspect_ratio < 1.4 and area_ratio > 0.75 and 60 < area < 2000:
                    ports = [tuple(pt[0].astype(int)) for pt in approx]
                    symbols.append({
                        'symbol_type': 'filter_or_controller',
                        'shape': 'rectangle',
                        'position': [cx, cy],
                        'bbox': (x, y, w, h),
                        'page': page_num,
                        'confidence': 0.75,
                        'source': 'opencv_square_rect',
                        'ports': ports
                    })

                # 长矩形（流量计、管道配件）
                elif (aspect_ratio > 1.4 or aspect_ratio < 0.7) and area_ratio > 0.75 and 100 < area < 4000:
                    ports = [tuple(pt[0].astype(int)) for pt in approx]
                    symbols.append({
                        'symbol_type': 'flow_meter',
                        'shape': 'rectangle',
                        'position': [cx, cy],
                        'bbox': (x, y, w, h),
                        'page': page_num,
                        'confidence': 0.7,
                        'source': 'opencv_long_rect',
                        'ports': ports
                    })

        circle_count = len([s for s in symbols if s['shape'] == 'circle'])
        diamond_count = len([s for s in symbols if s['shape'] == 'diamond'])
        triangle_count = len([s for s in symbols if s['shape'] == 'triangle'])
        rect_count = len([s for s in symbols if s['shape'] == 'rectangle'])

        print(f"  🔍 轮廓顶点分布: {sorted(vertex_counts.items())}")
        print(f"  ✅ 检测符号: {len(symbols)} 个 (圆:{circle_count}, 菱形:{diamond_count}, 三角:{triangle_count}, 矩:{rect_count})")

        return self._deduplicate_symbols(symbols)

    def _detect_leader_lines(self, image_path: str) -> List[Dict]:
        """检测引线（细线，通常连接文字和符号）- 简化版，禁用以提高性能"""
        # 引线检测在没有OCR文字的情况下意义不大，暂时禁用
        # 返回空列表，避免过多无用的线段检测
        print(f"  ⚠️  引线检测已禁用（需要OCR文字才有意义）")
        return []

    def _trace_text_to_symbol(self, text_regions: List[Dict], leader_lines: List[Dict],
                               symbols: List[Dict]) -> Dict[str, Dict]:
        """追踪文字→引线→符号的关联"""
        text_to_symbol = {}

        for text_region in text_regions:
            if 'bbox' not in text_region:
                continue

            tx, ty, tw, th = text_region['bbox']
            text_center = (tx + tw//2, ty + th//2)
            text_content = text_region.get('text', '')

            # 从文字框8个出射点寻找最近引线
            shoot_pts = [
                (tx, ty), (tx+tw//2, ty), (tx+tw, ty),
                (tx, ty+th//2), (tx+tw, ty+th//2),
                (tx, ty+th), (tx+tw//2, ty+th), (tx+tw, ty+th)
            ]

            closest_line = None
            min_dist = float('inf')

            for shoot_pt in shoot_pts:
                for line in leader_lines:
                    dist_start = self._point_distance(shoot_pt, line['start'])
                    dist_end = self._point_distance(shoot_pt, line['end'])
                    dist = min(dist_start, dist_end)

                    if dist < min_dist and dist < 10:  # 10px容差
                        min_dist = dist
                        closest_line = line

            if closest_line:
                # 引线另一端找最近符号
                line_far_end = closest_line['end'] if self._point_distance(text_center, closest_line['start']) < \
                                                       self._point_distance(text_center, closest_line['end']) \
                                else closest_line['start']

                closest_symbol = None
                min_sym_dist = float('inf')

                for symbol in symbols:
                    if 'position' not in symbol:
                        continue
                    sym_pos = tuple(symbol['position'])
                    dist = self._point_distance(line_far_end, sym_pos)

                    # 检查是否在端口附近
                    if 'ports' in symbol:
                        for port in symbol['ports']:
                            port_dist = self._point_distance(line_far_end, port)
                            if port_dist < dist:
                                dist = port_dist

                    if dist < min_sym_dist and dist < 30:  # 30px容差
                        min_sym_dist = dist
                        closest_symbol = symbol

                if closest_symbol:
                    text_to_symbol[text_content] = closest_symbol
                    print(f"  📍 引线关联: '{text_content}' → {closest_symbol.get('symbol_type', 'unknown')}")

        return text_to_symbol

    def _merge_with_leader_trace(self, text_components: List[Dict], symbols: List[Dict],
                                  text_to_symbol_map: Dict[str, Dict]) -> List[Dict]:
        """用引线追踪结果合并文字和符号"""
        merged = []
        symbol_counter = {}

        # 先添加有引线关联的组件
        for text_comp in text_components:
            tag = text_comp.get('tag_number', '')
            if tag in text_to_symbol_map:
                symbol = text_to_symbol_map[tag]
                merged.append({
                    'tag_number': tag,
                    'symbol_type': symbol.get('symbol_type'),
                    'position': symbol.get('position'),
                    'shape': symbol.get('shape'),
                    'ports': symbol.get('ports', []),
                    'page': symbol.get('page'),
                    'source': 'leader_traced',
                    'confidence': min(text_comp.get('confidence', 0.9), symbol.get('confidence', 0.8))
                })

        # 剩余未关联符号分配自动位号
        for symbol in symbols:
            already_used = any(m.get('position') == symbol.get('position') for m in merged)
            if already_used:
                continue

            symbol_type = symbol.get('symbol_type', 'unknown')
            if symbol_type not in symbol_counter:
                symbol_counter[symbol_type] = 0
            symbol_counter[symbol_type] += 1

            auto_tag = self._generate_auto_tag(symbol_type, symbol_counter[symbol_type])
            merged.append({
                'tag_number': auto_tag,
                'symbol_type': symbol_type,
                'position': symbol.get('position'),
                'shape': symbol.get('shape'),
                'ports': symbol.get('ports', []),
                'page': symbol.get('page'),
                'source': 'auto_generated',
                'confidence': symbol.get('confidence', 0.7)
            })

        print(f"  ✅ 合并后组件: {len(merged)} 个 (引线关联:{len([m for m in merged if m['source']=='leader_traced'])}, 自动生成:{len([m for m in merged if m['source']=='auto_generated'])})")
        return merged

    def _generate_auto_tag(self, symbol_type: str, index: int) -> str:
        """生成自动位号"""
        prefix_map = {
            'indicator': 'PI',
            'pump_or_instrument': 'P',
            'tank_or_equipment': 'E',
            'valve': 'V',
            'manual_valve': 'MV',
            'filter_or_controller': 'FC'
        }
        prefix = prefix_map.get(symbol_type, 'X')
        return f"{prefix}-{index:03d}"

    def _infer_connections_by_ports(self, components: List[Dict], leader_lines: List[Dict],
                                     image_path: str = None) -> List[Dict]:
        """基于端口邻接推断连接"""
        connections = []

        # 端口对端口连接检测
        for i, comp1 in enumerate(components):
            if 'ports' not in comp1 or not comp1['ports']:
                continue

            for j, comp2 in enumerate(components[i+1:], start=i+1):
                if 'ports' not in comp2 or not comp2['ports']:
                    continue

                # 检查任意端口对之间的距离
                for port1 in comp1['ports']:
                    for port2 in comp2['ports']:
                        dist = self._point_distance(port1, port2)

                        # 端口距离小于200px认为连接（放宽阈值以提高检测率）
                        if dist < 200:
                            connections.append({
                                'from': comp1['tag_number'],
                                'to': comp2['tag_number'],
                                'port_distance': round(dist, 2),
                                'confidence': max(0.3, 1.0 - dist / 200),  # 调整置信度计算
                                'page': comp1['page']
                            })
                            break  # 找到一对即可
                    else:
                        continue
                    break  # 双重循环break

        print(f"  ✅ 推断连接: {len(connections)} 条（基于端口邻接）")
        return connections

    def _detect_circles(self, gray_img, minR: int, maxR: int, minDist: int) -> List[Tuple[int, int, int]]:
        """检测指定尺寸范围的圆形符号"""
        edges = cv2.Canny(gray_img, 50, 150)

        # 形态学闭运算
        kernel = np.ones((3,3), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

        circles = cv2.HoughCircles(
            edges,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=minDist,
            param1=100,
            param2=30,  # 平衡阈值：既减少误检又保持检测率
            minRadius=minR,
            maxRadius=maxR
        )

        if circles is None:
            return []

        circles = np.round(circles[0, :]).astype("int")
        return [(x, y, r) for x, y, r in circles]

    def _detect_diamonds(self, gray_img) -> List[Tuple[int, int, int]]:
        """检测菱形符号（阀门）"""
        edges = cv2.Canny(gray_img, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        diamonds = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100 or area > 2000:
                continue

            # 近似多边形
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.04 * peri, True)

            # 4个顶点的多边形
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = float(w) / h if h > 0 else 0

                # 接近正方形（菱形的外接矩形）
                if 0.8 < aspect_ratio < 1.2:
                    diamonds.append((x + w//2, y + h//2, max(w, h)))

        return diamonds

    def _detect_rectangles(self, gray_img) -> List[Tuple[int, int, int, int]]:
        """检测矩形符号"""
        _, binary = cv2.threshold(gray_img, 200, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        rectangles = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 1000 or area > 80000:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = float(w) / h if h > 0 else 0

            # 矩形或长方形
            if 0.3 < aspect_ratio < 3.0:
                rectangles.append((x, y, w, h))

        return rectangles

    def _deduplicate_symbols(self, symbols: List[Dict]) -> List[Dict]:
        """去重：合并重叠的符号"""
        if len(symbols) == 0:
            return []

        filtered = []

        for sym in symbols:
            pos1 = sym.get('position')
            if not pos1:
                continue

            x1, y1 = pos1
            is_dup = False

            for j, existing in enumerate(filtered):
                pos2 = existing.get('position')
                if not pos2:
                    continue

                x2, y2 = pos2
                distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)

                # 距离小于40px认为重复
                if distance < 40:
                    # 保留置信度更高的
                    if sym.get('confidence', 0) > existing.get('confidence', 0):
                        filtered[j] = sym
                    is_dup = True
                    break

            if not is_dup:
                filtered.append(sym)

        return filtered

    def _merge_text_and_symbols(self, text_components: List[Dict], symbols: List[Dict], all_text_regions: List[Dict]) -> List[Dict]:
        """合并文字和符号检测结果"""
        merged = []

        # 先添加所有文字识别的组件（这些有真实位号）
        for comp in text_components:
            merged.append(comp)

        # 为没有匹配文字的符号分配位号
        symbol_counter = {}

        for symbol in symbols:
            pos = symbol.get('position')
            if not pos:
                continue

            # 检查附近是否有文字位号
            nearby_tag = self._find_nearby_tag(pos, all_text_regions)

            if nearby_tag:
                # 检查是否已经存在该位号
                existing = next((c for c in merged if c.get('tag_number') == nearby_tag['tag']), None)

                if existing:
                    # 更新位置信息
                    existing['position'] = pos
                    existing['shape'] = symbol.get('shape')
                    if 'radius' in symbol:
                        existing['radius'] = symbol['radius']
                    if 'bbox' in symbol:
                        existing['bbox'] = symbol['bbox']
                else:
                    # 新建组件
                    merged.append({
                        'tag_number': nearby_tag['tag'],
                        'symbol_type': nearby_tag.get('type', symbol.get('symbol_type')),
                        'parameters': nearby_tag.get('parameters', {}),
                        'page': symbol['page'],
                        'position': pos,
                        'shape': symbol.get('shape'),
                        'source': 'symbol_with_text',
                        'confidence': min(symbol.get('confidence', 0.7), nearby_tag.get('confidence', 0.9))
                    })
            else:
                # 没有找到附近文字,生成自动位号
                symbol_type = symbol.get('symbol_type', 'unknown')

                if symbol_type not in symbol_counter:
                    symbol_counter[symbol_type] = 1

                # 根据符号类型生成前缀
                tag_prefix = {
                    'pump_or_instrument': 'P',
                    'indicator': 'PI',
                    'valve': 'V',
                    'equipment': 'E',
                    'tank_or_equipment': 'T',
                }.get(symbol_type, 'X')

                merged.append({
                    'tag_number': f"{tag_prefix}-{symbol_counter[symbol_type]:03d}",
                    'symbol_type': symbol_type,
                    'parameters': {},
                    'page': symbol['page'],
                    'position': pos,
                    'shape': symbol.get('shape'),
                    'radius': symbol.get('radius'),
                    'bbox': symbol.get('bbox'),
                    'size': symbol.get('size'),
                    'source': 'symbol_detection',
                    'confidence': symbol.get('confidence', 0.7)
                })

                symbol_counter[symbol_type] += 1

        return merged

    def _find_nearby_tag(self, position: List[int], text_regions: List[Dict]) -> Dict:
        """在符号附近查找位号文字"""
        x, y = position

        for region in text_regions:
            text = region.get('text', '')

            # 检查是否包含位号
            for tag_type, pattern in self.tag_patterns.items():
                match = re.search(pattern, text)
                if match:
                    tag = match.group(0)

                    # 提取参数
                    parameters = {}
                    for param_type, param_pattern in self.parameter_patterns.items():
                        param_match = re.search(param_pattern, text)
                        if param_match:
                            try:
                                parameters[param_type] = {
                                    'value': float(param_match.group(1)),
                                    'unit': param_match.group(2)
                                }
                            except:
                                pass

                    return {
                        'tag': tag,
                        'type': tag_type,
                        'parameters': parameters,
                        'confidence': 0.9
                    }

        return None

    def _point_distance(self, p1, p2):
        """计算两点距离"""
        return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    def _point_to_line_distance(self, px, py, x1, y1, x2, y2):
        """计算点到线段的最短距离"""
        # 线段长度的平方
        line_len_sq = (x2 - x1)**2 + (y2 - y1)**2

        if line_len_sq == 0:
            # 线段退化为点
            return np.sqrt((px - x1)**2 + (py - y1)**2)

        # 计算投影参数t
        t = max(0, min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / line_len_sq))

        # 投影点坐标
        proj_x = x1 + t * (x2 - x1)
        proj_y = y1 + t * (y2 - y1)

        # 点到投影点的距离
        return np.sqrt((px - proj_x)**2 + (py - proj_y)**2)

    def _point_position_on_line(self, point, line):
        """计算点在线段上的投影位置（用于排序）"""
        px, py = point
        x1, y1, x2, y2 = line

        line_len_sq = (x2 - x1)**2 + (y2 - y1)**2
        if line_len_sq == 0:
            return 0

        t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / line_len_sq
        return max(0, min(1, t))

    def _detect_pipe_lines(self, image_path: str) -> List[Dict]:
        """检测PID图中的管线（过滤边框）"""
        img = cv2.imread(image_path)
        if img is None:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # 排除底部和右侧区域（图例和标题栏）
        valid_y_min = 50  # 排除顶部边框
        valid_y_max = int(h * 0.75)
        valid_x_min = 50  # 排除左侧边框
        valid_x_max = int(w * 0.90)

        # 边缘检测
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)

        # 只保留有效区域
        edges[:valid_y_min, :] = 0
        edges[valid_y_max:, :] = 0
        edges[:, :valid_x_min] = 0
        edges[:, valid_x_max:] = 0

        # Hough直线检测（降低阈值）
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi/180,
            threshold=60,       # 进一步降低到60
            minLineLength=80,   # 降低最小长度到80
            maxLineGap=20       # 增加允许间隙到20
        )

        detected_lines = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]

                # 过滤边框线
                is_top_edge = y1 < 100 and y2 < 100
                is_bottom_edge = y1 > h - 100 and y2 > h - 100
                is_left_edge = x1 < 100 and x2 < 100
                is_right_edge = x1 > w - 100 and x2 > w - 100

                if is_top_edge or is_bottom_edge or is_left_edge or is_right_edge:
                    continue

                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)

                # 放宽长度限制
                if 80 < length < 1500:  # 80-1500px
                    # 只保留接近水平或垂直的线段
                    angle = np.abs(np.arctan2(y2-y1, x2-x1) * 180 / np.pi)
                    is_horizontal = angle < 15 or angle > 165  # 放宽到15度
                    is_vertical = 75 < angle < 105  # 放宽到75-105度

                    if is_horizontal or is_vertical:
                        detected_lines.append({
                            'endpoints': (x1, y1, x2, y2),
                            'length': length,
                            'angle': angle
                        })

        print(f"  ✅ 检测管线: {len(detected_lines)} 条")
        return detected_lines

    def _infer_connections(self, components: List[Dict], image_path: str = None) -> List[Dict]:
        """推断连接关系（基于管线检测）"""
        connections = []

        # 如果有图片，检测管线
        if image_path and os.path.exists(image_path):
            lines = self._detect_pipe_lines(image_path)

            # 对每条线，找出附近的组件（使用点到线段距离）
            for line in lines:
                x1, y1, x2, y2 = line['endpoints']

                # 找所有在管线附近的组件（50px以内）
                nearby_comps = []
                for comp in components:
                    if 'position' not in comp:
                        continue
                    cx, cy = comp['position']
                    dist = self._point_to_line_distance(cx, cy, x1, y1, x2, y2)
                    if dist < 50:  # 50px阈值
                        nearby_comps.append((comp, dist))

                # 如果有2个或更多组件在这条管线上，它们相互连接
                if len(nearby_comps) >= 2:
                    # 按在管线上的位置排序
                    nearby_comps.sort(key=lambda c: self._point_position_on_line(c[0]['position'], (x1, y1, x2, y2)))

                    # 顺序连接
                    for i in range(len(nearby_comps) - 1):
                        comp1, dist1 = nearby_comps[i]
                        comp2, dist2 = nearby_comps[i+1]

                        connections.append({
                            'from': comp1['tag_number'],
                            'to': comp2['tag_number'],
                            'line_length': round(line['length'], 2),
                            'confidence': 0.8,
                            'page': comp1['page']
                        })
        else:
            # 降级到邻近检测（距离阈值增加到300px）
            for i, comp1 in enumerate(components):
                if 'position' not in comp1:
                    continue

                x1, y1 = comp1['position']

                for j, comp2 in enumerate(components[i+1:], start=i+1):
                    if 'position' not in comp2:
                        continue

                    x2, y2 = comp2['position']
                    distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)

                    # 增加到300px阈值，并要求组件在同一水平或垂直线上
                    if distance < 300:
                        # 检查是否水平对齐（y坐标差小于50）或垂直对齐（x坐标差小于50）
                        is_horizontal = abs(y2 - y1) < 50
                        is_vertical = abs(x2 - x1) < 50

                        if is_horizontal or is_vertical:
                            confidence = max(0.3, 1.0 - distance / 300)
                            connections.append({
                                'from': comp1['tag_number'],
                                'to': comp2['tag_number'],
                                'distance': round(distance, 2),
                                'confidence': round(confidence, 2),
                                'page': comp1['page']
                            })

        return connections

    def _create_visualization(self, image_path: str, components: List[Dict], page_num: int, legend_symbols: List[Dict] = None) -> str:
        """创建可视化标注图"""
        img = cv2.imread(image_path)
        if img is None:
            return None

        annotated = img.copy()
        h, w = img.shape[:2]

        # 统计各类型组件数量
        stats = {}
        for comp in components:
            symbol_type = comp.get('symbol_type', 'unknown')
            shape = comp.get('shape', '')

            # 分类统计
            if 'indicator' in symbol_type or shape == 'circle':
                category = '仪表(PI/TI/FI)'
            elif 'valve' in symbol_type and 'manual' in symbol_type:
                category = '手动阀'
            elif 'valve' in symbol_type or shape == 'diamond':
                category = '阀门'
            elif 'flow_meter' in symbol_type or shape == 'rectangle':
                category = '流量计'
            else:
                category = '其他'

            stats[category] = stats.get(category, 0) + 1

        # 在图片顶部绘制统计信息
        y_offset = 30
        line_height = 35

        # 绘制半透明白色背景
        overlay = annotated.copy()
        info_lines = 3 + len(stats) + (1 if legend_symbols else 0)
        cv2.rectangle(overlay, (10, 10), (w - 10, 10 + info_lines * line_height + 20), (255, 255, 255), -1)
        cv2.addWeighted(overlay, 0.85, annotated, 0.15, 0, annotated)

        # 标题
        cv2.putText(annotated, f"AI识别结果：检测到 {len(components)} 个设备组件",
                   (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
        y_offset += line_height

        # 图例统计（使用英文，因为cv2.putText不支持中文）
        if legend_symbols is not None and len(legend_symbols) > 0:
            legend_text = f"Legend Symbols: {len(legend_symbols)} definitions"
            cv2.putText(annotated, legend_text,
                       (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
            y_offset += line_height

        # 分类统计标题
        cv2.putText(annotated, "颜色标注说明：",
                   (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        y_offset += line_height

        # 分类统计详情
        color_map = {
            '仪表(PI/TI/FI)': (255, 255, 0),  # 青色
            '阀门': (0, 165, 255),  # 橙色
            '手动阀': (0, 255, 255),  # 黄色
            '流量计': (255, 0, 255)  # 紫色
        }

        for category, count in sorted(stats.items()):
            color = color_map.get(category, (128, 128, 128))
            # 绘制颜色圆点
            cv2.circle(annotated, (35, y_offset - 8), 10, color, -1)
            cv2.circle(annotated, (35, y_offset - 8), 10, (0, 0, 0), 1)
            # 绘制文字
            cv2.putText(annotated, f"{category} ({count}个)",
                       (55, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
            y_offset += line_height

        cv2.putText(annotated, "每个设备旁边的白色标签显示自动分配的位号(如PI-001, V-001等)",
                   (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)

        # 在每个组件上画框和标签
        for comp in components:
            if 'position' not in comp:
                continue

            x, y = comp['position']
            tag = comp.get('tag_number', 'Unknown')
            symbol_type = comp.get('symbol_type', '')
            shape = comp.get('shape', '')

            # 根据类型和形状选择颜色和绘制方式
            if 'valve' in symbol_type or shape == 'diamond':
                color = (0, 165, 255)  # 橙色 - 阀门
                size = 20
                # 绘制菱形
                pts = np.array([[x, y-size], [x+size, y], [x, y+size], [x-size, y]], np.int32)
                cv2.polylines(annotated, [pts], True, color, 2)
            elif 'indicator' in symbol_type or shape == 'small_circle':
                color = (255, 255, 0)  # 青色 - 指示器
                radius = comp.get('radius', 15)
                cv2.circle(annotated, (x, y), radius, color, 2)
            elif 'pump' in symbol_type or 'instrument' in symbol_type:
                color = (0, 255, 0)  # 绿色 - 泵/仪表
                radius = comp.get('radius', 25)
                cv2.circle(annotated, (x, y), radius, color, 2)
            elif 'tank' in symbol_type or 'equipment' in symbol_type or shape == 'rectangle':
                color = (255, 0, 255)  # 紫色 - 设备
                bbox = comp.get('bbox')
                if bbox and len(bbox) == 4:
                    bx, by, bw, bh = bbox
                    cv2.rectangle(annotated, (bx, by), (bx+bw, by+bh), color, 2)
                else:
                    # 没有bbox时画圆
                    cv2.circle(annotated, (x, y), 30, color, 2)
            else:
                color = (128, 128, 128)  # 灰色 - 其他
                cv2.circle(annotated, (x, y), 15, color, 2)

            # 添加位号标签（白色背景）
            font_scale = 0.6
            thickness = 2
            text_size = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0]

            # 绘制白色背景
            bg_x1, bg_y1 = x + 10, y - 15
            bg_x2, bg_y2 = bg_x1 + text_size[0] + 4, bg_y1 + text_size[1] + 4
            cv2.rectangle(annotated, (bg_x1, bg_y1), (bg_x2, bg_y2), (255, 255, 255), -1)

            # 绘制文字
            cv2.putText(annotated, tag, (bg_x1 + 2, bg_y2 - 2),
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)

        # 保存到uploads目录
        upload_dir = Path(__file__).parent.parent.parent / 'uploads' / 'pid_annotations'
        upload_dir.mkdir(parents=True, exist_ok=True)

        filename = f'annotated_{page_num}_{uuid.uuid4().hex[:8]}.png'
        output_path = upload_dir / filename

        cv2.imwrite(str(output_path), annotated)
        print(f"  ✅ 已保存标注图: {filename}")

        return str(output_path)

    def _extract_legend(self, image_path: str, text_regions: List[Dict]) -> List[Dict]:
        """提取图例（CHART OF SYMBOLS）"""
        if not HAS_OPENCV:
            return []

        print(f"  🔍 提取图例...")

        img = cv2.imread(image_path)
        if img is None:
            return []

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 1. 定位图例区域 - 扫描底部左侧60%宽度（包含CHART OF SYMBOLS两列，排除右侧标题栏）
        legend_y_start = int(h * 0.75)
        legend_x_end = int(w * 0.60)  # 图例表格通常占左边60%，右边40%是标题栏

        # 使用默认图例区域（底部左侧）
        x1, y1 = 0, legend_y_start
        x2, y2 = legend_x_end, h

        legend_roi = gray[y1:y2, x1:x2]
        legend_roi_color = img[y1:y2, x1:x2]

        # 2. 使用EasyOCR识别整个图例区域的文字
        ocr_texts = []
        if EASYOCR_AVAILABLE:
            global _easyocr_reader
            if _easyocr_reader is None:
                print(f"  📥 加载EasyOCR模型...")
                _easyocr_reader = easyocr.Reader(['en'], gpu=False)

            print(f"  🔍 OCR识别图例区域 ({legend_roi.shape[1]}x{legend_roi.shape[0]}px)...")
            results = _easyocr_reader.readtext(legend_roi_color, detail=1)

            for bbox, text, conf in results:
                # bbox是相对于legend_roi的坐标，转换为绝对坐标
                x_min = int(min([p[0] for p in bbox])) + x1
                y_min = int(min([p[1] for p in bbox])) + y1
                x_max = int(max([p[0] for p in bbox])) + x1
                y_max = int(max([p[1] for p in bbox])) + y1

                ocr_texts.append({
                    'text': text,
                    'confidence': conf,
                    'bbox': (x_min, y_min, x_max - x_min, y_max - y_min),
                    'center': ((x_min + x_max) // 2, (y_min + y_max) // 2)
                })

            print(f"  ✅ OCR识别: {len(ocr_texts)} 个文字区域")

        # 4. 检测图例表格中的符号
        candidate_symbols = []

        # 二值化
        _, binary = cv2.threshold(legend_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # 检测轮廓 - 使用RETR_EXTERNAL只获取外部轮廓
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 提取小型符号（图例中的符号都比较小）
        for cnt in contours:
            area = cv2.contourArea(cnt)

            # 更宽松的面积过滤：图例符号通常在50-2000px²之间
            if not (50 < area < 2000):
                continue

            # 多边形近似
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue

            # 获取边界框
            bx, by, bw, bh = cv2.boundingRect(cnt)

            # 过滤掉太小的噪声
            if bw < 5 or bh < 5:
                continue

            approx = cv2.approxPolyDP(cnt, 0.03 * perimeter, True)
            vertices = len(approx)

            # 计算绝对坐标
            abs_x = x1 + bx + bw // 2
            abs_y = y1 + by + bh // 2

            # 判断形状类型
            aspect_ratio = float(bw) / bh if bh > 0 else 0
            symbol_type = 'unknown'
            if vertices == 3:
                symbol_type = 'triangle'
            elif vertices == 4:
                if 0.4 < aspect_ratio < 1.6:
                    symbol_type = 'diamond'
                else:
                    symbol_type = 'rectangle'
            elif 5 <= vertices <= 12:
                # 可能是圆形或多边形近似
                circularity = 4 * 3.14159 * area / (perimeter * perimeter) if perimeter > 0 else 0
                if circularity > 0.7:
                    symbol_type = 'circle'

            candidate_symbols.append({
                'type': symbol_type,
                'position': (abs_x, abs_y),
                'bbox': (bx, by, bw, bh),
                'vertices': vertices,
                'area': area,
                'y': abs_y  # 用于行分组
            })

        # 5. 过滤掉表格标题区域的符号（"CHART OF SYMBOLS"以下的区域）
        # 从OCR文字中找到"CHART OF SYMBOLS"的Y坐标
        chart_title_y = None
        for ocr_text in ocr_texts:
            if "CHART OF SYMBOLS" in ocr_text['text']:
                chart_title_y = ocr_text['center'][1]
                break

        # 如果找到表格标题，过滤掉标题以下的符号
        if chart_title_y:
            candidate_symbols = [s for s in candidate_symbols if s['y'] < chart_title_y - 20]

        # 6. 基于Y坐标进行行分组（图例表格每行一个符号）
        # 按Y坐标排序
        candidate_symbols.sort(key=lambda s: s['y'])

        # 分组：Y坐标差小于30px的算同一行
        rows = []
        current_row = []
        last_y = -100

        for sym in candidate_symbols:
            if abs(sym['y'] - last_y) < 30:  # 同一行
                current_row.append(sym)
            else:  # 新行
                if current_row:
                    rows.append(current_row)
                current_row = [sym]
            last_y = sym['y']

        if current_row:
            rows.append(current_row)

        # 7. 每行只保留最左侧的符号，并匹配OCR文字
        legend_symbols = []
        for row_idx, row in enumerate(rows):
            # 选择X坐标最小的符号
            leftmost = min(row, key=lambda s: s['position'][0])

            # 在OCR文字中查找符号右侧的描述
            description = ''
            min_dist = float('inf')

            sym_x, sym_y = leftmost['position']
            for ocr_text in ocr_texts:
                text_x, text_y = ocr_text['center']

                # 文字应该在符号右侧（x > sym_x）且Y坐标接近
                if text_x > sym_x and abs(text_y - sym_y) < 50:
                    dist = abs(text_x - sym_x)
                    if dist < min_dist and dist < 600:
                        min_dist = dist
                        description = ocr_text['text']

            legend_symbols.append({
                'type': leftmost['type'],
                'position': leftmost['position'],
                'description': description,
                'bbox': leftmost['bbox'],
                'vertices': leftmost['vertices'],
                'area': leftmost['area']
            })

        # 8. 从OCR文字直接构建图例（基于ITEM编号）
        # 查找所有数字的OCR文字（1-99），这些是图例的序号
        ocr_based_legend = []

        # 调试：列出所有OCR识别的文字
        all_texts = [t['text'].strip() for t in ocr_texts]
        digit_candidates = [t for t in all_texts if any(c.isdigit() for c in t)]
        print(f"  🔍 OCR识别文字: {len(all_texts)} 个，含数字: {digit_candidates[:15]}")

        for ocr_text in ocr_texts:
            text = ocr_text['text'].strip()
            # 查找数字（图例序号，支持1-99）
            if text.isdigit() and 1 <= len(text) <= 2 and 1 <= int(text) <= 99:
                item_num = int(text)
                item_x, item_y = ocr_text['center']

                # 在同一行右侧查找描述文字（X距离<600px，Y距离<80px - 放宽以捕获更多）
                # 收集所有候选词，然后选择最长的或组合多个词
                candidates = []
                for desc_text in ocr_texts:
                    desc_x, desc_y = desc_text['center']
                    if desc_x > item_x and abs(desc_y - item_y) < 80 and abs(desc_x - item_x) < 600:
                        desc_candidate = desc_text['text'].strip()
                        # 过滤掉其他数字、表头、单字符
                        if (not desc_candidate.isdigit() and
                            'ITEM' not in desc_candidate.upper() and
                            'SYMBOL' not in desc_candidate.upper() and
                            'NOTE' not in desc_candidate.upper() and
                            'DESCRIPTION' not in desc_candidate.upper() and
                            len(desc_candidate) > 1):
                            candidates.append({
                                'text': desc_candidate,
                                'x': desc_x,
                                'y': desc_y,
                                'x_dist': desc_x - item_x,
                                'y_dist': abs(desc_y - item_y)
                            })

                # 选择X距离最近且Y距离最小的描述
                if candidates:
                    # 按Y距离排序（同一行），然后按X距离排序（最近的）
                    best = min(candidates, key=lambda c: (c['y_dist'], c['x_dist']))
                    description = best['text']

                    ocr_based_legend.append({
                        'item': item_num,
                        'description': description,
                        'position': (item_x, item_y),
                        'type': 'unknown'
                    })

        # 按序号排序
        ocr_based_legend.sort(key=lambda x: x['item'])

        # 调试信息
        print(f"  📊 符号检测图例: {len(legend_symbols)} 个")
        print(f"  📊 OCR编号图例: {len(ocr_based_legend)} 个")

        # 如果OCR提取的条目更多，使用OCR版本
        final_legend = ocr_based_legend if len(ocr_based_legend) > len(legend_symbols) else legend_symbols

        print(f"  ✅ 提取图例: {len(final_legend)} 个符号定义")
        if len(ocr_based_legend) > 0:
            items_preview = [f"ITEM {item['item']}: {item['description']}" for item in ocr_based_legend[:3]]
            print(f"  📝 OCR图例详情: {items_preview}")
        return final_legend

    def _find_legend_description(self, symbol_x: int, symbol_y: int, legend_roi_gray, x1: int, y1: int) -> str:
        """从图例区域直接提取符号右侧的文字（使用EasyOCR识别）"""
        global _easyocr_reader

        try:
            # 提取符号右侧区域（通常文字在符号右侧50-300px内）
            roi_x_start = symbol_x - x1 + 50  # 相对于legend_roi的坐标
            roi_x_end = min(legend_roi_gray.shape[1], roi_x_start + 350)
            roi_y_start = max(0, symbol_y - y1 - 20)
            roi_y_end = min(legend_roi_gray.shape[0], symbol_y - y1 + 20)

            if roi_x_start >= roi_x_end or roi_y_start >= roi_y_end:
                return ''

            text_roi = legend_roi_gray[roi_y_start:roi_y_end, roi_x_start:roi_x_end]

            # 使用EasyOCR识别文字
            if EASYOCR_AVAILABLE:
                # 懒加载EasyOCR Reader（只初始化一次）
                if _easyocr_reader is None:
                    _easyocr_reader = easyocr.Reader(['en'], gpu=False)

                # 识别文字
                results = _easyocr_reader.readtext(text_roi, detail=0)

                if results:
                    # 合并所有识别到的文字
                    text = ' '.join(results).strip()
                    if text:
                        return text

            # 回退：检测文字轮廓（无法识别内容但可以判断是否有文字）
            _, binary = cv2.threshold(text_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # 过滤噪声
            char_contours = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 10 < area < 500:
                    x, y, w, h = cv2.boundingRect(cnt)
                    aspect = h / (w + 0.1)
                    if 0.5 < aspect < 4.0:
                        char_contours.append(x)

            if len(char_contours) >= 3:
                return f"[{len(char_contours)} chars]"

            return ''

        except Exception as e:
            return ''
