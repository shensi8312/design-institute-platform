#!/usr/bin/env python3
"""
Redis队列消费者 - 监听文档识别完成事件并触发向量化
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
        password='postgres123'
    )

def process_vectorization_task(task_data):
    """处理向量化任务"""
    doc_id = task_data.get('doc_id')
    file_path = task_data.get('file_path')
    
    print(f"[{datetime.now()}] 处理向量化任务: {doc_id}")
    
    try:
        # 调用向量化服务
        with open(file_path, 'rb') as f:
            response = requests.post(
                'http://localhost:8085/api/vectorize',
                files={'file': f},
                data={
                    'doc_id': doc_id,
                    'namespace': 'default',
                    'metadata': json.dumps({
                        'source': 'queue_consumer',
                        'timestamp': datetime.now().isoformat()
                    })
                }
            )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 向量化成功: {doc_id}, 生成{result.get('chunks')}个块")
            
            # 更新数据库状态
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE knowledge_documents 
                SET vector_status = 'completed',
                    vector_chunks = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (result.get('chunks'), doc_id))
            conn.commit()
            cur.close()
            conn.close()
            
            # 触发GraphRAG处理
            redis_client.lpush('graphrag_queue', json.dumps({
                'doc_id': doc_id,
                'file_path': file_path,
                'chunks': result.get('chunks'),
                'timestamp': datetime.now().isoformat()
            }))
            print(f"📊 已添加到GraphRAG队列: {doc_id}")
            
            return True
        else:
            print(f"❌ 向量化失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return False

def main():
    print("""
    ╔═══════════════════════════════════════════════════════╗
    ║     Redis队列消费者 - 向量化服务                         ║
    ║     监听: vectorization_queue                          ║
    ║     处理: 文档向量化 → Milvus存储                        ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    
    while True:
        try:
            # 阻塞等待任务
            result = redis_client.brpop('vectorization_queue', timeout=5)
            
            if result:
                _, task_json = result
                task_data = json.loads(task_json)
                
                # 处理任务
                success = process_vectorization_task(task_data)
                
                # 记录处理结果
                redis_client.lpush('vectorization_log', json.dumps({
                    'doc_id': task_data.get('doc_id'),
                    'status': 'success' if success else 'failed',
                    'timestamp': datetime.now().isoformat()
                }))
                
        except Exception as e:
            print(f"❌ 队列处理错误: {e}")
            time.sleep(5)

if __name__ == '__main__':
    main()