#!/usr/bin/env python3
"""
文档识别队列消费者 - 监听文档识别完成事件并触发向量化和图谱提取
正确处理doc_recognition_queue中的消息
"""

import redis
import json
import time
import requests
from datetime import datetime
import psycopg2
from pathlib import Path

# Redis连接
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

# PostgreSQL连接
def get_db_connection():
    return psycopg2.connect(
        host='localhost',
        port=5433,
        database='design_platform',
        user='postgres',
        password='postgres'
    )

def process_recognition_result(recognition_data):
    """处理文档识别结果"""
    doc_id = recognition_data.get('doc_id')
    kb_id = recognition_data.get('kb_id')
    filename = recognition_data.get('filename')
    recognition = recognition_data.get('recognition', {})
    
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 处理文档: {filename} ({doc_id})")
    
    # 从识别结果中提取文本
    extracted_text = ''
    if recognition.get('type') == 'pdf' and recognition.get('pages'):
        # PDF格式：从pages数组提取文本
        texts = []
        for page in recognition.get('pages', []):
            if page.get('text'):
                texts.append(page['text'])
        extracted_text = '\n'.join(texts).strip()
    elif recognition.get('text'):
        # 其他格式：直接从text字段获取
        extracted_text = recognition.get('text', '')
    
    if not extracted_text:
        print(f"❌ 无法提取文本内容")
        return False
    
    print(f"📝 提取文本: {len(extracted_text)} 字符")
    
    # 保存提取的文本到数据库
    try:
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
        print(f"✅ 文本已保存到数据库")
    except Exception as e:
        print(f"❌ 保存文本失败: {e}")
        return False
    
    # 触发向量化（使用提取的文本，不是文件）
    vector_success = False
    try:
        print(f"🔄 开始向量化...")
        response = requests.post(
            'http://localhost:8085/api/vectorize',
            json={
                'doc_id': doc_id,
                'content': extracted_text,  # 使用提取的文本
                'kb_id': kb_id,
                'namespace': f'kb_{kb_id}',
                'chunk_size': 500,
                'chunk_overlap': 50,
                'metadata': {
                    'filename': filename,
                    'source': 'queue_consumer',
                    'timestamp': datetime.now().isoformat()
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 向量化成功: 生成 {result.get('chunks')} 个块")
            vector_success = True
            
            # 更新向量化状态
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET vector_status = 'completed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
            print(f"✅ 已更新向量化状态为completed")
        else:
            print(f"❌ 向量化失败: {response.text}")
            # 更新失败状态
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET vector_status = 'failed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
    except Exception as e:
        print(f"❌ 向量化异常: {e}")
        # 更新失败状态
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET vector_status = 'failed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
        except:
            pass
    
    # 触发图谱提取（使用提取的文本）
    graph_success = False
    try:
        print(f"🔄 开始图谱提取...")
        # 限制文本长度避免超时
        text_for_graph = extracted_text[:50000] if len(extracted_text) > 50000 else extracted_text
        
        response = requests.post(
            'http://localhost:8081/api/extract',  # 新版本的API路径
            json={
                'doc_id': doc_id,
                'text': text_for_graph,  # 使用提取的文本
                'metadata': {
                    'filename': filename,
                    'source': 'queue_consumer'
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            print(f"✅ 图谱提取成功")
            graph_success = True
            
            # 更新图谱状态
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET graph_status = 'completed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
            print(f"✅ 已更新图谱状态为completed")
        else:
            print(f"⚠️ 图谱提取失败（服务可能未启动）")
            # 更新失败状态
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET graph_status = 'failed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
    except Exception as e:
        print(f"⚠️ 图谱提取异常: {e}")
        # 更新失败状态
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET graph_status = 'failed',
                    updated_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            cur.close()
            conn.close()
        except:
            pass
    
    return True

def main():
    print("""
    ╔═══════════════════════════════════════════════════════╗
    ║     文档识别队列消费者                                   ║
    ║     监听: doc_recognition_queue                        ║
    ║     处理: 识别结果 → 向量化 + 图谱提取                    ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    
    # 检查队列中的积压消息
    queue_length = redis_client.llen('doc_recognition_queue')
    if queue_length > 0:
        print(f"📊 发现 {queue_length} 条待处理消息\n")
    
    processed_count = 0
    
    while True:
        try:
            # 阻塞等待任务（使用FIFO，从队列右侧取）
            result = redis_client.brpop('doc_recognition_queue', timeout=5)
            
            if result:
                _, task_json = result
                recognition_data = json.loads(task_json)
                
                # 处理任务
                success = process_recognition_result(recognition_data)
                processed_count += 1
                
                if processed_count % 10 == 0:
                    remaining = redis_client.llen('doc_recognition_queue')
                    print(f"\n📊 已处理: {processed_count} 条，剩余: {remaining} 条\n")
                
        except KeyboardInterrupt:
            print(f"\n\n👋 停止处理，共处理 {processed_count} 条消息")
            break
        except Exception as e:
            print(f"❌ 队列处理错误: {e}")
            time.sleep(5)

if __name__ == '__main__':
    main()