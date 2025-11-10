# 路由映射问题分析

## 数据库菜单路径 vs 实际路由配置

### 问题1：缺失的路由
这些路径在数据库中存在，但在router/index.tsx中没有定义：

| 菜单名称 | 数据库路径 | 应该映射到的组件 |
|---------|-----------|----------------|
| 我的文档 | knowledge/documents | MyDocuments (已存在) |
| 图纸预览 | knowledge/documents | 需要创建或重用 |
| 我的任务 | workflow | 需要创建MyTasks组件 |
| 进度查看 | system/monitor | ServiceMonitor (已存在) |
| 规范查询 | knowledge/search | KnowledgeSearch (已存在) |
| AI助手 | knowledge/chat | KnowledgeChat (已存在) |

### 问题2：路径不一致
这些菜单的路径与路由配置不匹配：

| 菜单名称 | 数据库路径 | 路由配置路径 | 组件 |
|---------|-----------|------------|------|
| 我的项目 | projects | /projects | ProjectManagement |
| 创建项目 | projects | 无 | 需要添加路由 |
| 项目分配 | projects | 无 | 需要添加路由 |
| 企业知识库 | knowledge/manage | /knowledge/manage | KnowledgeManage |
| 部门知识库 | knowledge/manage | /knowledge/manage | KnowledgeManage |
| 我的知识库 | knowledge/manage | /knowledge/manage | KnowledgeManage |

### 问题3：缺失的页面组件
需要创建的组件：
- AgentWorkflow (在路由中引用但文件不存在)
- MyTasks (我的任务)
- ProjectCreate (创建项目)
- ProjectAssign (项目分配)

## 关于工作流和引擎的理解

### 工作流 (Workflow)
- **定义**：流程编排系统
- **功能**：将多个处理节点串联成完整流程
- **示例**：节点1(文档识别) → 节点2(知识提取) → 节点3(入库)

### 引擎 (Engine)
- **定义**：智能提取器/专用处理器
- **功能**：从已有知识库中学习并提取特定规则
- **示例**：红线框墙条规则提取引擎 - 自动学习并提取建筑规范
- **特点**：引擎可以作为工作流的一个节点使用

### 区别
- 工作流 = 流程编排器（how to process）
- 引擎 = 智能处理器（what to extract/process）
- 引擎可以被工作流调用作为处理节点