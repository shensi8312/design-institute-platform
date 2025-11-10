#!/usr/bin/env python3
"""
修复Milvus中错误的文本数据
将二进制数据替换为PostgreSQL中的正确文本内容
"""

import psycopg2
from pymilvus import connections, Collection, utility
import json
import numpy as np
import requests
from tqdm import tqdm
import time

# 配置
PG_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'design_platform',
    'user': 'postgres',
    'password': 'postgres'
}

MILVUS_CONFIG = {
    'host': 'localhost',
    'port': '19530'
}

OLLAMA_URL = 'http://localhost:11434/api/embeddings'

def get_postgres_documents():
    """从PostgreSQL获取所有已完成向量化的文档及其文本内容"""
    conn = psycopg2.connect(**PG_CONFIG)
    cursor = conn.cursor()
    
    query = """
        SELECT id, name, content_text, knowledge_base_id
        FROM knowledge_documents
        WHERE vector_status = 'completed'
        AND content_text IS NOT NULL
        AND length(content_text) > 100
    """
    
    cursor.execute(query)
    documents = []
    for row in cursor.fetchall():
        documents.append({
            'doc_id': row[0],
            'name': row[1],
            'content': row[2],
            'kb_id': row[3] or 'default'
        })
    
    cursor.close()
    conn.close()
    
    print(f"从PostgreSQL获取了 {len(documents)} 个文档")
    return documents

def chunk_text(text, chunk_size=1000, overlap=200):
    """将文本分块"""
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end]
        
        # 尝试在句号、问号、感叹号处断开
        if end < text_len:
            for sep in ['。', '！', '？', '.', '!', '?', '\n']:
                last_sep = chunk.rfind(sep)
                if last_sep > chunk_size * 0.8:
                    chunk = text[start:start + last_sep + 1]
                    end = start + last_sep + 1
                    break
        
        chunks.append(chunk)
        start = end - overlap if end < text_len else end
    
    return chunks

def generate_embedding(text):
    """使用Ollama生成向量"""
    try:
        response = requests.post(OLLAMA_URL, json={
            'model': 'nomic-embed-text',
            'prompt': text
        }, timeout=30)
        
        if response.status_code == 200:
            return response.json()['embedding']
        else:
            print(f"生成向量失败: {response.status_code}")
            return np.random.rand(768).tolist()
    except Exception as e:
        print(f"生成向量异常: {e}")
        return np.random.rand(768).tolist()

def recreate_collection():
    """重新创建collection并修复数据"""
    # 连接Milvus
    connections.connect(**MILVUS_CONFIG)
    
    # 备份旧collection名称
    old_collection_name = 'knowledge_documents'
    new_collection_name = 'knowledge_documents_fixed'
    
    # 检查并删除新collection（如果存在）
    if utility.has_collection(new_collection_name):
        utility.drop_collection(new_collection_name)
        print(f"删除旧的修复collection: {new_collection_name}")
    
    # 从旧collection获取schema信息
    old_collection = Collection(old_collection_name)
    old_collection.load()
    
    # 创建新collection（使用正确的schema）
    from pymilvus import FieldSchema, CollectionSchema, DataType
    
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=100),
        FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=100),
        FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),  # 增加文本长度限制
        FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=768),
        FieldSchema(name="namespace", dtype=DataType.VARCHAR, max_length=100),
        FieldSchema(name="metadata", dtype=DataType.VARCHAR, max_length=65535),
        FieldSchema(name="chunk_index", dtype=DataType.INT64),
        FieldSchema(name="created_at", dtype=DataType.INT64)
    ]
    
    schema = CollectionSchema(fields, description="Fixed Knowledge Documents")
    new_collection = Collection(name=new_collection_name, schema=schema)
    
    print(f"创建新collection: {new_collection_name}")
    
    # 创建索引
    index_params = {
        "metric_type": "L2",
        "index_type": "IVF_FLAT",
        "params": {"nlist": 1024}
    }
    new_collection.create_index(field_name="vector", index_params=index_params)
    
    return new_collection

def migrate_data(new_collection, documents):
    """迁移数据到新collection"""
    print("开始迁移数据...")
    
    batch_size = 100
    total_chunks = 0
    
    for doc in tqdm(documents, desc="处理文档"):
        # 分块文本
        chunks = chunk_text(doc['content'])
        
        # 准备数据
        ids = []
        doc_ids = []
        texts = []
        vectors = []
        namespaces = []
        metadatas = []
        chunk_indices = []
        created_ats = []
        
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc['doc_id']}_{i}"
            
            # 生成向量
            embedding = generate_embedding(chunk)
            
            # 准备metadata
            metadata = {
                'kb_id': doc['kb_id'],
                'filename': doc['name'],
                'created_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z')
            }
            
            ids.append(chunk_id)
            doc_ids.append(doc['doc_id'])
            texts.append(chunk[:65535])  # 确保不超过最大长度
            vectors.append(embedding)
            namespaces.append(f"kb_{doc['kb_id']}")
            metadatas.append(json.dumps(metadata, ensure_ascii=False))
            chunk_indices.append(i)
            created_ats.append(int(time.time() * 1000))
        
        # 批量插入
        if ids:
            try:
                new_collection.insert([
                    ids,
                    doc_ids,
                    texts,
                    vectors,
                    namespaces,
                    metadatas,
                    chunk_indices,
                    created_ats
                ])
                total_chunks += len(ids)
                
                # 定期flush
                if total_chunks % 1000 == 0:
                    new_collection.flush()
                    print(f"已插入 {total_chunks} 个文本块")
                    
            except Exception as e:
                print(f"插入失败 {doc['doc_id']}: {e}")
                continue
    
    # 最终flush
    new_collection.flush()
    print(f"迁移完成！共插入 {total_chunks} 个文本块")
    
    return total_chunks

def verify_migration(collection_name='knowledge_documents_fixed'):
    """验证迁移结果"""
    print("\n验证迁移结果...")
    
    collection = Collection(collection_name)
    collection.load()
    
    # 统计信息
    num_entities = collection.num_entities
    print(f"新collection中的实体数: {num_entities}")
    
    # 测试搜索
    test_query = "cleanroom semiconductor Fab 洁净室 半导体"
    print(f"\n测试搜索: '{test_query}'")
    
    embedding = generate_embedding(test_query)
    
    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 10}
    }
    
    results = collection.search(
        data=[embedding],
        anns_field="vector",
        param=search_params,
        limit=5,
        output_fields=["doc_id", "text"]
    )
    
    print("\n搜索结果:")
    for i, hit in enumerate(results[0]):
        text = hit.entity.get('text', '')
        # 只显示可读文本
        if text and not text.startswith('�'):
            print(f"\n{i+1}. Score: {hit.score:.4f}")
            print(f"   Doc ID: {hit.entity.get('doc_id')}")
            print(f"   Text: {text[:200]}...")

def main():
    """主函数"""
    print("=== Milvus文本数据修复工具 ===\n")
    
    # 1. 获取PostgreSQL中的文档
    documents = get_postgres_documents()
    
    if not documents:
        print("没有找到需要处理的文档")
        return
    
    # 2. 创建新的collection
    new_collection = recreate_collection()
    
    # 3. 迁移数据
    total_chunks = migrate_data(new_collection, documents)
    
    # 4. 验证结果
    verify_migration()
    
    print("\n修复完成！")
    print("\n下一步操作：")
    print("1. 验证新collection工作正常")
    print("2. 备份旧collection: knowledge_documents")
    print("3. 删除旧collection并重命名新collection：")
    print("   - utility.drop_collection('knowledge_documents')")
    print("   - utility.rename_collection('knowledge_documents_fixed', 'knowledge_documents')")

if __name__ == "__main__":
    main()