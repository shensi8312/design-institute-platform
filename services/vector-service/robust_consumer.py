#!/usr/bin/env python3
"""
更健壮的文档识别队列消费者
- 更好的错误处理
- 详细的日志
- 失败重试机制
"""

import redis
import json
import time
import requests
from datetime import datetime
import psycopg2
import traceback
import sys

# 配置
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
POSTGRES_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'design_platform',
    'user': 'postgres',
    'password': 'postgres'
}

# Redis连接
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

def get_db_connection():
    """获取数据库连接"""
    return psycopg2.connect(**POSTGRES_CONFIG)

def log(message, level="INFO"):
    """统一的日志输出"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    prefix = {
        "INFO": "ℹ️",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "WARNING": "⚠️",
        "PROCESSING": "🔄"
    }.get(level, "📝")
    
    print(f"[{timestamp}] {prefix} {message}", flush=True)

def update_status(doc_id, field, status):
    """更新文档状态"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(f"""
            UPDATE knowledge_documents 
            SET {field} = %s, updated_at = NOW()
            WHERE id = %s
        """, (status, doc_id))
        conn.commit()
        cur.close()
        conn.close()
        log(f"状态更新: {doc_id} - {field}={status}", "INFO")
        return True
    except Exception as e:
        log(f"状态更新失败: {e}", "ERROR")
        return False

def process_vectorization(doc_id, text, kb_id, filename):
    """处理向量化"""
    log(f"开始向量化: {doc_id}", "PROCESSING")
    
    # 先更新为processing
    update_status(doc_id, 'vector_status', 'processing')
    
    try:
        response = requests.post(
            'http://localhost:8085/api/vectorize',
            json={
                'doc_id': doc_id,
                'content': text,
                'kb_id': kb_id,
                'namespace': f'kb_{kb_id}',
                'chunk_size': 500,
                'chunk_overlap': 50,
                'metadata': {
                    'filename': filename,
                    'source': 'robust_consumer',
                    'timestamp': datetime.now().isoformat()
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            chunks = result.get('chunks', 0)
            log(f"向量化成功: {chunks} 个块", "SUCCESS")
            update_status(doc_id, 'vector_status', 'completed')
            return True
        else:
            log(f"向量化失败: HTTP {response.status_code}", "ERROR")
            log(f"响应: {response.text[:200]}", "ERROR")
            update_status(doc_id, 'vector_status', 'failed')
            return False
            
    except requests.exceptions.Timeout:
        log(f"向量化超时", "ERROR")
        update_status(doc_id, 'vector_status', 'failed')
        return False
    except Exception as e:
        log(f"向量化异常: {e}", "ERROR")
        update_status(doc_id, 'vector_status', 'failed')
        return False

def process_graph_extraction(doc_id, text, filename):
    """处理图谱提取"""
    log(f"开始图谱提取: {doc_id}", "PROCESSING")
    
    # 先更新为processing
    update_status(doc_id, 'graph_status', 'processing')
    
    try:
        # 限制文本长度
        text_for_graph = text[:10000] if len(text) > 10000 else text
        
        response = requests.post(
            'http://localhost:8081/api/extract',
            json={
                'doc_id': doc_id,
                'text': text_for_graph,
                'metadata': {
                    'filename': filename,
                    'source': 'robust_consumer'
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            entities = len(result.get('entities', []))
            relations = len(result.get('relations', []))
            log(f"图谱提取成功: {entities} 实体, {relations} 关系", "SUCCESS")
            update_status(doc_id, 'graph_status', 'completed')
            return True
        else:
            log(f"图谱提取失败: HTTP {response.status_code}", "ERROR")
            log(f"响应: {response.text[:200]}", "ERROR")
            update_status(doc_id, 'graph_status', 'failed')
            return False
            
    except requests.exceptions.Timeout:
        log(f"图谱提取超时", "ERROR")
        update_status(doc_id, 'graph_status', 'failed')
        return False
    except Exception as e:
        log(f"图谱提取异常: {e}", "ERROR")
        update_status(doc_id, 'graph_status', 'failed')
        return False

def process_recognition_result(recognition_data):
    """处理识别结果"""
    doc_id = recognition_data.get('doc_id')
    kb_id = recognition_data.get('kb_id')
    filename = recognition_data.get('filename', 'unknown')
    
    log(f"处理文档: {filename} ({doc_id})", "INFO")
    
    try:
        # 提取文本
        recognition = recognition_data.get('recognition', {})
        extracted_text = ''
        
        if recognition.get('type') == 'pdf' and recognition.get('pages'):
            texts = []
            for page in recognition.get('pages', []):
                if page.get('text'):
                    texts.append(page['text'])
            extracted_text = '\n'.join(texts).strip()
        elif recognition.get('text'):
            extracted_text = recognition.get('text', '')
        
        # 如果recognition_data直接有text字段，优先使用
        if recognition_data.get('text'):
            extracted_text = recognition_data.get('text')
        
        if not extracted_text:
            log(f"无法提取文本内容", "ERROR")
            update_status(doc_id, 'recognition_status', 'failed')
            update_status(doc_id, 'vector_status', 'failed')
            update_status(doc_id, 'graph_status', 'failed')
            return False
        
        log(f"提取文本: {len(extracted_text)} 字符", "INFO")
        
        # 保存文本到数据库
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE knowledge_documents 
            SET content_text = %s,
                recognition_status = 'completed',
                updated_at = NOW()
            WHERE id = %s
        """, (extracted_text, doc_id))
        conn.commit()
        cur.close()
        conn.close()
        log(f"文本已保存到数据库", "SUCCESS")
        
        # 并行处理向量化和图谱（实际上是串行，但互不影响）
        vector_success = process_vectorization(doc_id, extracted_text, kb_id, filename)
        graph_success = process_graph_extraction(doc_id, extracted_text, filename)
        
        if vector_success and graph_success:
            log(f"文档处理完成: {filename}", "SUCCESS")
        elif vector_success or graph_success:
            log(f"文档部分成功: {filename}", "WARNING")
        else:
            log(f"文档处理失败: {filename}", "ERROR")
        
        return True
        
    except Exception as e:
        log(f"处理异常: {e}", "ERROR")
        traceback.print_exc()
        return False

def main():
    """主函数"""
    print("""
╔════════════════════════════════════════════════════════════════╗
║  🤖 健壮的文档识别队列消费者                                      ║
║  监听: doc_recognition_queue                                    ║
║  处理: 识别结果 → 向量化 + 图谱提取                               ║
╚════════════════════════════════════════════════════════════════╝
    """, flush=True)
    
    # 检查服务状态
    log("检查服务状态...", "INFO")
    
    # 检查向量服务
    try:
        r = requests.get('http://localhost:8085/health', timeout=2)
        log("向量服务: 运行中", "SUCCESS")
    except:
        log("向量服务: 未响应（将继续尝试）", "WARNING")
    
    # 检查GraphRAG服务
    try:
        r = requests.get('http://localhost:8081/health', timeout=2)
        log("GraphRAG服务: 运行中", "SUCCESS")
    except:
        log("GraphRAG服务: 未响应（将继续尝试）", "WARNING")
    
    # 检查队列
    queue_len = redis_client.llen('doc_recognition_queue')
    if queue_len > 0:
        log(f"发现 {queue_len} 个待处理任务", "INFO")
    
    processed_count = 0
    error_count = 0
    
    log("开始监听队列...", "INFO")
    
    while True:
        try:
            # 阻塞等待任务
            result = redis_client.brpop('doc_recognition_queue', timeout=5)
            
            if result:
                _, task_json = result
                try:
                    recognition_data = json.loads(task_json)
                    
                    # 处理任务
                    success = process_recognition_result(recognition_data)
                    
                    if success:
                        processed_count += 1
                    else:
                        error_count += 1
                    
                    # 定期报告
                    if (processed_count + error_count) % 10 == 0:
                        log(f"统计: 成功={processed_count}, 失败={error_count}", "INFO")
                        
                except json.JSONDecodeError as e:
                    log(f"无效的JSON数据: {e}", "ERROR")
                    error_count += 1
                except Exception as e:
                    log(f"处理失败: {e}", "ERROR")
                    traceback.print_exc()
                    error_count += 1
                    
        except KeyboardInterrupt:
            log(f"停止处理", "INFO")
            log(f"最终统计: 成功={processed_count}, 失败={error_count}", "INFO")
            break
        except Exception as e:
            log(f"队列错误: {e}", "ERROR")
            time.sleep(5)

if __name__ == '__main__':
    main()