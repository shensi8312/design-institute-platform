---
name: rag-ingest
description: RAG 端到端摄取与自愈。单样本打通上传→解析→分块→嵌入(Milvus)→入图(Neo4j)→可查询；失败即进入错误处理协议并在原文件上最小修复。
tools: Read, LS, Grep, Glob, Edit, MultiEdit, Bash
---

# RAG 端到端摄取与自愈（Ingest E2E）

> **目标**：用一个固定样本在本地端到端跑通，给出**里程碑统计与延迟**，并固化为脚本与测试。  
> **风格约束**：遵循 Prod-Engineering；先计划后修改；最小 diff；不可跳过失败。

## 前提（若缺失请最小添加）
- 示例样本：`fixtures/rag/sample.pdf`
- Make 入口（或 npm/pip 脚本）：
  - `make health`：依赖服务健康检查（MinIO/Milvus/Postgres/Redis/Neo4j）
  - `make ingest SAMPLE=fixtures/rag/sample.pdf`
  - `make chat_e2e`：最小 10 轮问答健康检查（可选）
- `.env`/compose 变量齐全（S3/Milvus/DB/Neo4j/Redis/模型名）

## 执行步骤（标准输出必须包含里程碑）
1) 健康检查（必要时给出一键修复脚本 / 缺失索引创建语句）
2) 上传样本（或本地 API 直调）
3) 解析/OCR→分块（统计 chunk 数）
4) 嵌入并写入向量库（统计 vectors_written；校验维度/索引存在）
5) 抽取三元组入 Neo4j（nodes/rels 增量）
6) 索引/缓存预热（可选）
7) 生成 JSON 报告（路径例如 `out/ingest_report.json`）

## 里程碑字段（报告 JSON 必须包含）
```json
{
  "sample": "fixtures/rag/sample.pdf",
  "uploaded_bytes": 12345,
  "pages_ocr": 12,
  "chunks": 240,
  "vectors_written": 240,
  "milvus": {"collection": "docs", "dim": 768, "index": "HNSW"},
  "graph": {"nodes_created": 180, "rels_created": 220},
  "pg_rows": 240,
  "queue_backlog": 0,
  "latency_ms": {
    "upload": 320,
    "parse": 1400,
    "embed": 2800,
    "graph": 1200,
    "total": 6200
  }
}