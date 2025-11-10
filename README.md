# MST-AI 建筑设计智能平台

## 🚀 快速开始

```bash
# 开发环境一键启动
./start.sh              # 启动所有服务
./stop.sh               # 停止所有服务

# 使用Makefile
make dev                # 开发模式
make test               # 运行测试
make clean              # 清理

# 生产环境
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

## 📚 项目文档

- **[项目结构详解](docs/PROJECT_STRUCTURE_GUIDE.md)** 👈 **必读！理解整个项目**
- [API接口文档](docs/CLAUDE.md) - 详细的API说明
- [Repository Guidelines](AGENTS.md) - 贡献流程与协作规范
- [归档记录](docs/CLEANUP_REPORT.md) - 根目录清理与归档说明
- [重构记录](docs/REFACTORING_COMPLETE.md) - 架构演进历史

## 🔧 核心功能

- 🏗️ **建筑文档智能处理** - PDF/CAD/BIM自动解析
- 🧠 **知识图谱管理** - Neo4j构建专业知识网络
- 🔍 **向量检索** - Milvus实现语义搜索
- 💬 **AI对话助手** - 基于RAG的智能问答
- 👥 **企业协作** - 5级权限管理体系
- 🔄 **工作流编排** - 可视化流程设计

## 📁 目录结构

```
design-institute-platform/
├── apps/           # 🎯 应用层 (前端+API源码)
├── services/       # ⚙️ 微服务 (Python服务源码)
├── packages/       # 📦 共享包 (公共模块源码)
├── infrastructure/ # 🏗️ 基础设施 (配置文件)
└── plugins/        # 🔌 插件 (扩展功能源码)
```

## 📊 服务端口

| 服务 | 端口 | 说明 |
|-----|------|------|
| React前端 | 5173 | 用户界面 |
| Node.js API | 3000 | 后端接口 |
| 文档识别 | 8086 | OCR/PDF处理 |
| 向量服务 | 8085 | 文档向量化 |
| GraphRAG | 8081 | 知识图谱 |
| PostgreSQL | 5433 | 主数据库 |
| Redis | 6379 | 缓存队列 |
| Neo4j | 7687 | 图数据库 |
| Milvus | 19530 | 向量库 |
| MinIO | 9000 | 文件存储 |

## 🛠️ 技术栈

**前端**: React 18 + TypeScript + Ant Design 5 + Vite  
**后端**: Node.js + Express + PostgreSQL + Redis  
**AI服务**: Python + FastAPI + LangChain + Ollama  
**数据库**: PostgreSQL + Neo4j + Milvus + MinIO  
**运维**: Docker + Nginx + Prometheus + Grafana

## 📖 详细文档

更多详细信息请查看 [项目结构指南](docs/PROJECT_STRUCTURE_GUIDE.md)

---
*企业级AI建筑设计平台 - 专业、可靠、智能*