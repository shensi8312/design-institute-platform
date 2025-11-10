# 统一文档管理系统 设计方案

**版本**: v1.0
**日期**: 2025-11-05
**状态**: 详细设计

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构设计](#2-整体架构设计)
3. [模块与权限设计](#3-模块与权限设计)
4. [数据库设计](#4-数据库设计)
5. [核心服务设计](#5-核心服务设计)
6. [领域层设计](#6-领域层设计)
7. [AI集成方案](#7-ai集成方案)
8. [前端组件设计](#8-前端组件设计)
9. [API接口设计](#9-api接口设计)
10. [实施计划](#10-实施计划)

---

## 1. 项目概述

### 1.1 背景

设计院需要一个统一的文档管理系统来处理多种类型的专业文档：
- **SPEC规范文档** (CSI MasterFormat标准)
- **合同文档** (工程合同、采购合同等)
- **招投标文档** (技术标、商务标等)

这些文档虽然类型不同，但共享以下核心需求：
- 结构化内容管理（章节树 + 富文本编辑）
- 模板复用机制
- 协作编辑与修订追踪（类似Word修订模式）
- 多级审批流程
- 细粒度权限控制
- AI智能辅助
- 版本管理与对比
- 知识库归档

### 1.2 设计目标

1. **统一平台**：三种文档类型使用同一套UI和核心能力
2. **差异化配置**：通过领域配置实现不同文档类型的特殊需求
3. **AI优先**：所有能用AI减少人工的地方都要集成AI
4. **权限细粒度**：支持全院/分院/部门/项目/专业/个人等多级权限
5. **工作流优化**：简化审批流程，提高协作效率

### 1.3 核心创新点

- **项目优先 + 专业工作台** 混合信息架构
- **修订追踪模式**：实时显示谁改了什么（类似Word修订）
- **章节级审批**：审批人可以对具体章节标记问题点
- **归档审核流程**：知识管理员审核后才能入库，设置细粒度权限
- **AI全流程参与**：从模板解析到内容生成、合规检查、风险检测

---

## 2. 整体架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React + Ant Design)               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  项目工作区      │  │  专业工作台      │                │
│  │  - 项目文档列表  │  │  - SPEC标准管理  │                │
│  │  - 文档编辑器    │  │  - 合同管理      │                │
│  │  - 协作与审批    │  │  - 投标管理      │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Express.js)                       │
│  - DocumentController                                       │
│  - TemplateController                                       │
│  - ApprovalController                                       │
│  - ArchiveController                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      服务层                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DocumentService                                      │  │
│  │  - 文档CRUD                                           │  │
│  │  - 章节管理                                           │  │
│  │  - 协作锁定                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TemplateService                                      │  │
│  │  - 模板上传解析                                       │  │
│  │  - 模板版本管理                                       │  │
│  │  - 从模板创建文档                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  RevisionTrackingService                              │  │
│  │  - 修订记录                                           │  │
│  │  - 接受/拒绝修订                                      │  │
│  │  - 实时同步                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ApprovalService                                      │  │
│  │  - 章节级审批                                         │  │
│  │  - 问题标记                                           │  │
│  │  - 审批历史                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DocumentAIService                                    │  │
│  │  - 内容生成                                           │  │
│  │  - 合规检查                                           │  │
│  │  - 风险检测                                           │  │
│  │  - 智能助手                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   核心层 (Core Layer)                        │
│  - SectionTreeManager (章节树管理)                         │
│  - VersionManager (版本管理)                                │
│  - CommentManager (批注管理)                                │
│  - PermissionManager (权限管理)                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   领域层 (Domain Layer)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │SpecDomain│  │Contract  │  │Bidding   │                 │
│  │          │  │Domain    │  │Domain    │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│  • 各自的业务规则                                           │
│  • 章节编辑策略                                             │
│  • 合规检查规则                                             │
│  • AI能力配置                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 基础设施层 (Infrastructure)                  │
│  - PostgreSQL (文档、章节、审批、权限等数据)               │
│  - MinIO (文件存储)                                         │
│  - Milvus (向量库 - RAG检索)                                │
│  - WebSocket (实时协作)                                     │
│  - UnifiedLLMService (AI服务)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

**前端**:
- React 18.3 + TypeScript
- Ant Design 5.27
- react-router-dom 7.8
- axios 1.11
- react-quill (富文本编辑器)
- socket.io-client (实时协作)

**后端**:
- Node.js + Express.js
- Knex.js (SQL查询构建器)
- PostgreSQL 14+
- Socket.IO (WebSocket)

**存储**:
- PostgreSQL (结构化数据)
- MinIO (文件存储)
- Milvus (向量数据库)

**AI服务**:
- 复用现有 UnifiedLLMService
- 支持 Qwen/DeepSeek/Claude 多模型

---

## 3. 模块与权限设计

### 3.1 混合信息架构

采用 **项目优先 + 专业工作台** 的混合方案：

#### 3.1.1 项目工作区（面向项目成员）

```
菜单结构：
📁 项目中心 (projects)
├─ 项目列表
└─ [点击进入某项目]
   ├─ 📐 Architecture (SPEC文档)
   ├─ 📄 Contracts (合同文档)
   ├─ 📊 Bidding (投标文档)
   ├─ 💬 Collaboration (协作讨论)
   └─ 📈 Dashboard (项目概览)
```

**使用场景**：
- 设计师/项目经理 → 进入"某项目" → 看到该项目所有文档
- 文档以项目为中心组织，便于项目组协作

#### 3.1.2 专业工作台（面向职能部门）

```
菜单结构：
🔧 专业工作台 (professional-workspace)
├─ 📐 SPEC标准管理 (技术标准部)
│  ├─ 模板库
│  ├─ 模板编辑器
│  └─ 跨项目SPEC审核
│
├─ 📄 合同管理 (法务部)
│  ├─ 合同模板库
│  ├─ 待审合同列表（所有项目）
│  └─ 风险文档预警
│
└─ 📊 投标管理 (商务部)
   ├─ 投标模板库
   ├─ 投标任务看板（所有项目）
   └─ 中标案例库
```

**使用场景**：
- 法务部 → 进入"合同管理" → 看到所有项目待审的合同
- 商务部 → 进入"投标管理" → 看到所有项目的投标任务

### 3.2 权限体系

#### 3.2.1 文档权限级别

```javascript
const PERMISSION_LEVELS = {
  // 全院级别
  enterprise: {
    level: 1,
    label: '全院共享',
    scope: 'all_users',
    color: 'green'
  },

  // 分院级别
  branch: {
    level: 2,
    label: '分院共享',
    scope: 'branch',  // 需要指定branch_id
    color: 'blue'
  },

  // 部门级别
  department: {
    level: 3,
    label: '部门共享',
    scope: 'department', // 需要指定department_id
    color: 'cyan'
  },

  // 项目级别
  project: {
    level: 4,
    label: '项目共享',
    scope: 'project', // 需要指定project_id
    color: 'purple'
  },

  // 专业级别（项目内）
  discipline: {
    level: 5,
    label: '专业共享',
    scope: 'discipline', // 需要指定project_id + discipline_code
    color: 'orange'
  },

  // 个人级别
  personal: {
    level: 6,
    label: '个人私有',
    scope: 'user',
    color: 'red'
  }
};
```

#### 3.2.2 角色权限矩阵

| 角色 | 模板管理 | 项目文档创建 | 文档编辑 | 文档审批 | 归档审核 |
|------|---------|-------------|---------|---------|---------|
| 超级管理员 | ✅ 全部 | ✅ | ✅ 全部 | ✅ 全部 | ✅ |
| 技术标准部 | ✅ SPEC模板 | ✅ | ✅ SPEC | ✅ SPEC | ❌ |
| 法务部 | ✅ 合同模板 | ❌ | ✅ 合同 | ✅ 合同 | ❌ |
| 商务部 | ✅ 投标模板 | ✅ | ✅ 投标 | ✅ 投标 | ❌ |
| 项目经理 | 🔍 查看 | ✅ | ✅ 本项目 | ❌ | ❌ |
| 设计师 | 🔍 查看 | ❌ | ✅ 分配章节 | ❌ | ❌ |
| 知识管理员 | 🔍 查看 | ❌ | ❌ | ❌ | ✅ |

### 3.3 归档审核流程

```
用户操作：完成项目文档
        ↓
[申请归档] - 填写归档理由、建议分类
        ↓
进入【归档审核池】（待审核状态）
        ↓
知识管理员审核
   ├─ 审核文档质量
   ├─ 设置权限级别（全院/分院/部门/项目/专业）
   └─ 添加分类标签
        ↓
   ┌────┴────┐
   ↓         ↓
拒绝      批准
   ↓         ↓
退回      进入知识库
修改      (按权限可见)
```

**关键特性**：
- 用户只负责申请归档
- 知识管理员审核并设置权限
- 避免权限混乱和滥用

---

## 4. 数据库设计

### 4.1 ER图概览

```
┌──────────────────┐
│document_templates│ 模板表
└────────┬─────────┘
         │ 1:N
         ↓
┌──────────────────┐      ┌──────────────────┐
│project_documents │───N:1─│   projects       │
└────────┬─────────┘      └──────────────────┘
         │ 1:N
         ↓
┌──────────────────┐      ┌──────────────────┐
│document_sections │───N:1─│section_revisions │ 修订追踪
└────────┬─────────┘      └──────────────────┘
         │ 1:N
         ├──────────────────┐
         ↓                  ↓
┌──────────────────┐  ┌──────────────────┐
│document_comments │  │section_approval_ │ 章节审批
└──────────────────┘  │tasks             │
                      └──────────────────┘
                               │ 1:N
                               ↓
                      ┌──────────────────┐
                      │section_review_   │ 审批问题点
                      │issues            │
                      └──────────────────┘

┌──────────────────┐      ┌──────────────────┐
│archive_requests  │      │document_         │
└──────────────────┘      │permissions       │ 权限表
                          └──────────────────┘
```

### 4.2 核心表结构

#### 4.2.1 模板表

```sql
CREATE TABLE document_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- 'spec' | 'contract' | 'bidding'
  version VARCHAR(20) DEFAULT 'v1.0',
  description TEXT,

  -- 文件信息
  file_path VARCHAR(500),
  file_name VARCHAR(200),
  file_type VARCHAR(50),
  file_size BIGINT,

  -- 章节结构（JSON）
  section_structure JSONB NOT NULL,

  -- 变量定义
  variables JSONB DEFAULT '[]',

  -- 配置
  config JSONB DEFAULT '{}',

  -- 状态
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'published' | 'archived'

  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  published_by VARCHAR(50)
);
```

#### 4.2.2 项目文档表

```sql
CREATE TABLE project_documents (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- 'spec' | 'contract' | 'bidding'

  -- 关联关系
  project_id VARCHAR(50) NOT NULL,
  template_id VARCHAR(50),
  template_version VARCHAR(20),

  -- 状态
  status VARCHAR(20) DEFAULT 'draft',
  -- 'draft' | 'in_review' | 'completed' | 'archive_pending' | 'archived'

  -- 密级（归档后才设置）
  security_level VARCHAR(20),

  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 完成信息
  completed_at TIMESTAMP,
  completed_by VARCHAR(50),

  -- 归档信息
  archived_at TIMESTAMP,
  archived_by VARCHAR(50),

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (template_id) REFERENCES document_templates(id)
);
```

#### 4.2.3 章节表

```sql
CREATE TABLE document_sections (
  id VARCHAR(50) PRIMARY KEY,
  document_id VARCHAR(50) NOT NULL,

  -- 章节信息
  section_code VARCHAR(50), -- 如 08 11 13.16
  title VARCHAR(200) NOT NULL,
  level INTEGER NOT NULL, -- 层级（1/2/3/4）
  parent_id VARCHAR(50),
  sort_order INTEGER DEFAULT 0,

  -- 内容
  content TEXT,
  content_format VARCHAR(20) DEFAULT 'html',

  -- 元数据
  from_template BOOLEAN DEFAULT false,
  template_section_id VARCHAR(50),
  editable BOOLEAN DEFAULT true,
  deletable BOOLEAN DEFAULT true,

  -- AI标记
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),

  -- 审批状态
  approval_status VARCHAR(20) DEFAULT 'draft',
  -- 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'revision_needed'
  current_reviewer_id VARCHAR(50),
  current_reviewer_name VARCHAR(100),
  last_submitted_at TIMESTAMP,
  last_approved_at TIMESTAMP,
  last_approved_by VARCHAR(50),
  pending_issues_count INTEGER DEFAULT 0,

  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES document_sections(id) ON DELETE CASCADE
);
```

#### 4.2.4 修订追踪表

```sql
CREATE TABLE section_revisions (
  id VARCHAR(50) PRIMARY KEY,
  section_id VARCHAR(50) NOT NULL,
  document_id VARCHAR(50) NOT NULL,

  -- 修订类型
  revision_type VARCHAR(20) NOT NULL, -- 'insert' | 'delete' | 'replace'

  -- 修改位置
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,

  -- 修改内容
  original_text TEXT,
  new_text TEXT,

  -- 修订状态
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'

  -- 修改人信息
  author_id VARCHAR(50) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_color VARCHAR(20), -- 每个作者分配颜色

  -- 接受/拒绝信息
  reviewed_by VARCHAR(50),
  reviewed_at TIMESTAMP,
  review_comment TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (section_id) REFERENCES document_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE
);
```

#### 4.2.5 章节审批表

```sql
CREATE TABLE section_approval_tasks (
  id VARCHAR(50) PRIMARY KEY,
  section_id VARCHAR(50) NOT NULL,
  document_id VARCHAR(50) NOT NULL,

  -- 提交信息
  submitted_by VARCHAR(50) NOT NULL,
  submitted_by_name VARCHAR(100),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submission_message TEXT,

  -- 审批人
  reviewer_id VARCHAR(50) NOT NULL,
  reviewer_name VARCHAR(100),
  reviewer_role VARCHAR(100),

  -- 审批状态
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending' | 'reviewing' | 'approved' | 'rejected' | 'returned'

  -- 审批结果
  review_decision VARCHAR(20),
  review_comment TEXT,
  reviewed_at TIMESTAMP,

  -- 修改要求
  revision_required BOOLEAN DEFAULT false,
  revision_count INTEGER DEFAULT 0,

  -- 审批时限
  due_date TIMESTAMP,
  is_overdue BOOLEAN DEFAULT false,

  -- 章节快照
  section_snapshot JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (section_id) REFERENCES document_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE
);

CREATE TABLE section_review_issues (
  id VARCHAR(50) PRIMARY KEY,
  approval_task_id VARCHAR(50) NOT NULL,
  section_id VARCHAR(50) NOT NULL,

  -- 问题类型
  issue_type VARCHAR(50) NOT NULL, -- 'error' | 'warning' | 'suggestion' | 'question'
  severity VARCHAR(20) DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'

  -- 文本位置
  start_offset INTEGER,
  end_offset INTEGER,
  selected_text TEXT,

  -- 问题描述
  issue_title VARCHAR(200) NOT NULL,
  issue_description TEXT NOT NULL,
  suggested_fix TEXT,

  -- 状态
  status VARCHAR(20) DEFAULT 'open', -- 'open' | 'fixed' | 'wont_fix' | 'disputed'

  -- 修复信息
  fixed_by VARCHAR(50),
  fixed_at TIMESTAMP,
  fix_comment TEXT,

  -- 审批人确认
  verified_by_reviewer BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,

  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (approval_task_id) REFERENCES section_approval_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES document_sections(id) ON DELETE CASCADE
);
```

#### 4.2.6 归档与权限表

```sql
CREATE TABLE archive_requests (
  id VARCHAR(50) PRIMARY KEY,
  document_id VARCHAR(50) NOT NULL,

  -- 申请信息
  requester_id VARCHAR(50) NOT NULL,
  request_reason TEXT,
  suggested_category VARCHAR(100),
  suggested_tags JSONB DEFAULT '[]',

  -- 审核状态
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewer_id VARCHAR(50),
  review_comment TEXT,
  reviewed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE
);

CREATE TABLE document_permissions (
  id VARCHAR(50) PRIMARY KEY,
  document_id VARCHAR(50) NOT NULL,

  -- 权限级别
  permission_level VARCHAR(20) NOT NULL,
  -- 'enterprise' | 'branch' | 'department' | 'project' | 'discipline' | 'personal'

  -- 权限范围
  branch_id VARCHAR(50),
  department_id VARCHAR(50),
  project_id VARCHAR(50),
  discipline_code VARCHAR(50),
  user_id VARCHAR(50),

  -- 权限类型
  permission_type VARCHAR(20) DEFAULT 'view', -- 'view' | 'download' | 'reference'

  -- 设置信息
  granted_by VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES project_documents(id) ON DELETE CASCADE
);
```

**完整的表结构请参考附录A：数据库DDL脚本**

---

## 5. 核心服务设计

### 5.1 DocumentService

**职责**：文档和章节的CRUD操作

**主要方法**：
```javascript
class DocumentService {
  // 创建文档
  async createDocument(projectId, templateId, data, userId)

  // 加载文档
  async getDocument(documentId, userId)

  // 更新文档状态
  async updateDocumentStatus(documentId, status, userId)

  // 删除文档
  async deleteDocument(documentId, userId)

  // 章节操作
  async createSection(documentId, sectionData, userId)
  async updateSection(sectionId, content, userId)
  async deleteSection(sectionId, userId)
  async reorderSections(documentId, sectionOrders, userId)
}
```

### 5.2 TemplateService

**职责**：模板管理和解析

**主要方法**：
```javascript
class TemplateService {
  // 上传模板 → AI解析 → 保存
  async createTemplateFromUpload(file, metadata, userId)

  // AI解析模板结构
  async aiParseTemplateStructure(file)

  // 从模板创建项目文档
  async createDocumentFromTemplate(templateId, projectId, variableValues, userId)

  // 检查模板更新
  async checkTemplateUpdates(documentId)

  // 同步模板更新
  async syncTemplateUpdates(documentId, selectedSections, userId)
}
```

### 5.3 RevisionTrackingService

**职责**：修订追踪（类似Word修订模式）

**主要方法**：
```javascript
class RevisionTrackingService {
  // 开启/关闭修订追踪
  async enableTrackChanges(documentId, userId)
  async disableTrackChanges(documentId, userId)

  // 记录修订
  async recordRevision(sectionId, revisionData, userId)

  // 获取修订列表
  async getSectionRevisions(sectionId, status)

  // 接受修订
  async acceptRevision(revisionId, userId)

  // 拒绝修订
  async rejectRevision(revisionId, userId, comment)

  // 批量操作
  async acceptAllRevisions(sectionId, userId)
  async rejectAllRevisions(sectionId, userId, comment)

  // 为用户分配颜色
  async assignUserColor(documentId, userId)
}
```

### 5.4 SectionApprovalService

**职责**：章节级审批流程

**主要方法**：
```javascript
class SectionApprovalService {
  // 提交章节给审批人
  async submitSectionForReview(sectionId, reviewerId, userId, message)

  // 审批人开始审批
  async startReview(taskId, reviewerId)

  // 添加修改点
  async addReviewIssue(taskId, reviewerId, issueData)

  // 提交审批结果
  async submitReviewDecision(taskId, reviewerId, decision)

  // 作者查看审批意见
  async getReviewResult(taskId, userId)

  // 修复问题点
  async fixIssue(issueId, userId, fixData)

  // 所有问题修复后再次提交
  async resubmitForReview(sectionId, reviewerId, userId, message)

  // 获取审批历史
  async getSectionApprovalHistory(sectionId)
}
```

### 5.5 ArchiveService

**职责**：归档审核和权限管理

**主要方法**：
```javascript
class ArchiveService {
  // 用户申请归档
  async requestArchive(documentId, userId, requestData)

  // 知识管理员审核
  async reviewArchiveRequest(requestId, reviewerId, decision)

  // 设置文档权限
  async setDocumentPermissions(trx, documentId, permissions, adminId)

  // 检查查看权限
  async checkViewPermission(documentId, userId)

  // 查询用户可见的文档
  async searchDocuments(userId, filters)
}
```

---

## 6. 领域层设计

### 6.1 领域配置驱动

每种文档类型有独立的领域配置文件：

**apps/api/src/config/domains/spec.domain.js**
```javascript
module.exports = {
  type: 'spec',
  displayName: 'SPEC规范文档',

  // 章节编辑权限
  sectionEditPolicy: 'fixed', // 章节结构固定

  sectionStructure: {
    numberingFormat: 'csi', // CSI MasterFormat编号
    allowReorder: false,
    allowDelete: false,
    allowAdd: false,
    maxLevel: 4
  },

  contentValidation: {
    required: true,
    minLength: 50,
    checkCompleteness: true
  },

  aiCapabilities: {
    autoGenerate: true,
    smartSuggestion: true,
    complianceCheck: {
      enabled: true,
      rules: ['csi_standard', 'enterprise_spec_rules']
    }
  },

  approvalWorkflow: {
    enabled: true,
    stages: [
      { role: 'technical_reviewer', name: '技术审核' },
      { role: 'quality_manager', name: '质量把关' },
      { role: 'project_manager', name: '项目经理确认' }
    ]
  },

  exportFormats: ['docx', 'pdf'],

  templateSync: {
    mode: 'manual',
    allowPartialSync: true
  }
};
```

**apps/api/src/config/domains/contract.domain.js**
```javascript
module.exports = {
  type: 'contract',
  displayName: '合同文档',

  sectionEditPolicy: 'semi-flexible', // 可增删部分章节

  // 合同特有：字段标注
  fieldAnnotation: {
    enabled: true,
    autoDetect: true,
    fieldTypes: [
      { type: 'party', label: '甲方/乙方', color: '#1890ff' },
      { type: 'amount', label: '金额', color: '#f5222d' },
      { type: 'date', label: '日期/期限', color: '#faad14' },
      { type: 'liability', label: '违约责任', color: '#722ed1' },
      { type: 'payment', label: '付款条件', color: '#52c41a' }
    ]
  },

  // AI风险检查
  aiCapabilities: {
    autoGenerate: true,
    complianceCheck: {
      enabled: true,
      rules: ['contract_law', 'enterprise_legal_rules']
    },
    riskDetection: {
      enabled: true,
      checkItems: [
        'unbalanced_clauses',
        'unclear_liability',
        'missing_key_terms',
        'amount_anomaly'
      ]
    }
  },

  approvalWorkflow: {
    enabled: true,
    stages: [
      { role: 'legal_reviewer', name: '法务审核', required: true },
      { role: 'financial_reviewer', name: '财务审核' },
      { role: 'department_manager', name: '部门经理' }
    ]
  }
};
```

### 6.2 领域服务

**apps/api/src/services/document/domains/BaseDomain.js**
```javascript
class BaseDomain {
  constructor(config) {
    this.config = config;
  }

  // 验证章节操作是否允许
  validateSectionOperation(operation, context) {
    const policy = this.config.sectionEditPolicy;

    if (policy === 'fixed') {
      if (['add', 'delete', 'reorder'].includes(operation.action)) {
        return { valid: false, reason: 'SPEC文档章节结构固定' };
      }
    }

    return { valid: true };
  }

  // 内容验证
  async validateContent(sectionId, content) { /* ... */ }

  // AI完整性检查（由子类实现）
  async aiCheckCompleteness(sectionId, content) { /* ... */ }
}
```

**apps/api/src/services/document/domains/ContractDomain.js**
```javascript
class ContractDomain extends BaseDomain {
  // 合同特有：AI风险检测
  async detectRisks(content) {
    const riskConfig = this.config.aiCapabilities.riskDetection;
    // 调用LLM检测风险
  }

  // 合同特有：AI字段识别
  async identifyFields(content) {
    // 调用LLM识别关键字段
  }
}
```

### 6.3 领域工厂

```javascript
// apps/api/src/services/document/DomainFactory.js
class DomainFactory {
  static create(documentType) {
    const domains = {
      'spec': () => new SpecDomain(specConfig),
      'contract': () => new ContractDomain(contractConfig),
      'bidding': () => new BiddingDomain(biddingConfig)
    };

    return domains[documentType]();
  }
}
```

---

## 7. AI集成方案

### 7.1 AI能力清单

| 能力 | 触发时机 | 使用模型 | 成本 |
|-----|---------|---------|------|
| **模板解析** | 上传模板时 | Qwen-VL | 中 |
| **生成初稿** | 章节为空时点击 | DeepSeek | 高 |
| **续写内容** | 点击"续写"按钮 | Qwen | 中 |
| **改进文本** | 选中文本后点击 | Qwen | 低 |
| **SPEC合规检查** | 保存时自动 | Qwen | 中 |
| **合同风险检测** | 提交审批前 | DeepSeek | 高 |
| **字段自动识别** | 编辑合同时实时 | Qwen | 低 |
| **智能助手问答** | 侧边栏提问 | DeepSeek | 中 |
| **版本变更摘要** | 对比版本时 | Qwen | 低 |
| **翻译** | 选中文本后点击 | Qwen | 低 |

### 7.2 AI服务架构

```javascript
// apps/api/src/services/document/DocumentAIService.js
class DocumentAIService {
  constructor() {
    this.llmService = new UnifiedLLMService(); // 复用现有服务
    this.vectorService = new VectorService();
  }

  // 统一AI调用入口
  async invoke(capability, context, userId) {
    const config = AI_CAPABILITIES[capability];

    // RAG增强
    if (config.useRAG) {
      context.ragContext = await this.fetchRAGContext(context);
    }

    // 构建prompt
    const prompt = this.buildPrompt(config, context);

    // 调用LLM
    const result = await this.llmService.chat(prompt, {
      model: config.model,
      temperature: config.temperature || 0.7,
      stream: config.streaming || false
    });

    // 记录历史
    await this.logAIInvocation(capability, context, result, userId);

    return result;
  }

  // 具体AI能力实现
  async generateSectionDraft(sectionId, context) { /* ... */ }
  async detectContractRisks(documentId) { /* ... */ }
  async identifyContractFields(sectionId, content) { /* ... */ }
  async chatAssistant(documentId, userMessage, chatHistory) { /* ... */ }
}
```

### 7.3 RAG增强

对于内容生成类AI任务，使用RAG从知识库检索历史相关文档：

```javascript
async fetchRAGContext(context) {
  const results = await this.vectorService.search({
    query: context.sectionTitle,
    filters: {
      document_type: context.documentType,
      section_code: context.sectionCode
    },
    limit: 3
  });

  return results.map(r => r.content).join('\n\n');
}
```

---

## 8. 前端组件设计

### 8.1 集成到现有架构

**复用现有技术栈**：
- Dashboard.tsx 布局
- 动态菜单加载
- axios配置
- Ant Design 5.27组件

**新增页面路由** (apps/web/src/router/index.tsx)：

```javascript
// 模板管理
{
  path: 'template-management',
  children: [
    {
      path: 'spec',
      element: <LazyWrapper Component={SpecTemplateManagement} />
    },
    {
      path: 'contract',
      element: <LazyWrapper Component={ContractTemplateManagement} />
    },
    {
      path: 'bidding',
      element: <LazyWrapper Component={BiddingTemplateManagement} />
    },
    {
      path: 'editor/:templateId',
      element: <LazyWrapper Component={TemplateEditor} />
    }
  ]
},

// 项目文档
{
  path: 'projects/:projectId/documents',
  children: [
    {
      index: true,
      element: <LazyWrapper Component={ProjectDocumentList} />
    },
    {
      path: ':documentId/edit',
      element: <LazyWrapper Component={DocumentEditor} />
    },
    {
      path: ':documentId/review',
      element: <LazyWrapper Component={DocumentReview} />
    }
  ]
},

// 知识库归档审核（扩展现有knowledge路由）
{
  path: 'knowledge/archive-review',
  element: <LazyWrapper Component={ArchiveReviewList} />
}
```

### 8.2 可复用组件

**apps/web/src/components/UnifiedDocumentEditor/index.tsx**

统一文档编辑器，支持三种文档类型：

```tsx
interface UnifiedDocumentEditorProps {
  documentId: string;
  documentType: 'spec' | 'contract' | 'bidding';
  mode: 'edit' | 'review' | 'view';
  currentUser: any;
}

const UnifiedDocumentEditor: React.FC<UnifiedDocumentEditorProps> = ({
  documentId,
  documentType,
  mode,
  currentUser
}) => {
  const {
    document,
    sections,
    selectedSection,
    trackChangesEnabled,
    handleSectionUpdate,
    toggleTrackChanges
  } = useDocumentEditor(documentId);

  const { collaborators, locks } = useRealTimeCollaboration(documentId);

  return (
    <Layout>
      {/* 左侧：章节树 */}
      <Sider>
        <SectionTree
          sections={sections}
          selectedSectionId={selectedSection?.id}
          documentType={documentType}
          onSelect={handleSectionSelect}
          locks={locks}
          mode={mode}
        />
      </Sider>

      {/* 中间：内容编辑器 */}
      <Content>
        {trackChangesEnabled ? (
          <RevisionTrackingEditor
            sectionId={selectedSection.id}
            content={selectedSection.content}
            currentUser={currentUser}
            mode={mode}
          />
        ) : (
          <ContentEditor
            section={selectedSection}
            documentType={documentType}
            currentUser={currentUser}
            mode={mode}
          />
        )}
      </Content>

      {/* 右侧：批注侧边栏 */}
      <Sider>
        <CommentsSidebar
          documentId={documentId}
          sectionId={selectedSection?.id}
          mode={mode}
        />
      </Sider>
    </Layout>
  );
};
```

**核心组件列表**：
- `SectionTree.tsx` - 章节树
- `ContentEditor.tsx` - 富文本编辑器（带AI工具栏）
- `RevisionTrackingEditor.tsx` - 修订追踪编辑器
- `AIAssistantPanel.tsx` - AI助手侧边栏
- `CommentsSidebar.tsx` - 批注侧边栏
- `VersionHistory.tsx` - 版本历史
- `ApprovalPanel.tsx` - 审批面板
- `ReviewIssueMarker.tsx` - 问题标记工具

### 8.3 实时协作

使用Socket.IO实现实时协作：

```typescript
// apps/web/src/hooks/useRealTimeCollaboration.ts
export const useRealTimeCollaboration = (documentId: string, userId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [locks, setLocks] = useState<Record<string, any>>({});

  useEffect(() => {
    const newSocket = io('http://localhost:3000');

    newSocket.emit('join:document', { documentId, userId });

    newSocket.on('collaborators:update', (data) => {
      setCollaborators(data.collaborators);
    });

    newSocket.on('section:locked', (data) => {
      setLocks(prev => ({ ...prev, [data.sectionId]: data }));
    });

    newSocket.on('revision:new', (data) => {
      // 处理其他用户的修订
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [documentId, userId]);

  return { collaborators, locks };
};
```

---

## 9. API接口设计

### 9.1 模板管理

```
POST   /api/templates/upload          上传模板文件（带AI解析）
GET    /api/templates                 获取模板列表
GET    /api/templates/:id             获取模板详情
PUT    /api/templates/:id             更新模板
DELETE /api/templates/:id             删除模板
POST   /api/templates/:id/publish     发布模板
```

### 9.2 文档管理

```
POST   /api/documents                 创建文档（从模板）
GET    /api/documents/:id             获取文档详情
PUT    /api/documents/:id             更新文档
DELETE /api/documents/:id             删除文档
GET    /api/documents/:id/sections    获取文档章节树
POST   /api/documents/:id/sections    创建章节
PUT    /api/documents/sections/:id    更新章节内容
DELETE /api/documents/sections/:id    删除章节
```

### 9.3 修订追踪

```
POST   /api/documents/:id/track-changes/enable   开启修订追踪
POST   /api/documents/:id/track-changes/disable  关闭修订追踪
GET    /api/documents/sections/:id/revisions     获取章节修订列表
POST   /api/documents/sections/:id/revisions     记录修订
POST   /api/documents/revisions/:id/accept       接受修订
POST   /api/documents/revisions/:id/reject       拒绝修订
POST   /api/documents/sections/:id/revisions/accept-all  批量接受
POST   /api/documents/sections/:id/revisions/reject-all  批量拒绝
```

### 9.4 章节审批

```
POST   /api/documents/sections/:id/submit-review        提交审批
GET    /api/documents/approval-tasks/:id                获取审批任务
POST   /api/documents/approval-tasks/:id/start          开始审批
POST   /api/documents/approval-tasks/:id/issues         添加问题点
PUT    /api/documents/review-issues/:id                 更新问题点
POST   /api/documents/approval-tasks/:id/decision       提交审批决定
GET    /api/documents/sections/:id/approval-history     审批历史
```

### 9.5 归档管理

```
POST   /api/documents/:id/archive/request               申请归档
GET    /api/documents/archive/requests                  获取待审核列表
POST   /api/documents/archive/requests/:id/review       审核归档申请
GET    /api/knowledge/documents                         查询知识库文档（带权限过滤）
```

### 9.6 AI服务

```
POST   /api/ai/generate-section            生成章节初稿
POST   /api/ai/improve-text                改进文本
POST   /api/ai/continue-writing            续写内容
POST   /api/ai/translate                   翻译
POST   /api/ai/check-compliance            合规检查
POST   /api/ai/detect-risks                风险检测
POST   /api/ai/identify-fields             字段识别
POST   /api/ai/chat                        智能助手对话
POST   /api/ai/summarize-changes           版本变更摘要
```

---

## 10. 实施计划

### 10.1 阶段划分

#### 阶段1：基础架构（2周）

**后端**：
- ✅ 数据库表创建（DDL脚本）
- ✅ 基础路由和控制器
- ✅ 核心服务框架（DocumentService, TemplateService）
- ✅ 领域层框架（DomainFactory, BaseDomain）

**前端**：
- ✅ 路由配置
- ✅ 菜单数据库配置
- ✅ 基础页面框架
- ✅ 统一文档编辑器组件骨架

#### 阶段2：模板系统（1周）

- ✅ 模板上传与存储
- ✅ AI模板解析
- ✅ 模板编辑器
- ✅ 从模板创建文档
- ✅ 模板版本管理

#### 阶段3：文档编辑与协作（2周）

- ✅ 章节树操作
- ✅ 富文本编辑器集成
- ✅ 实时协作（Socket.IO）
- ✅ 协作锁定机制
- ✅ 在线用户显示

#### 阶段4：修订追踪（1周）

- ✅ 修订记录机制
- ✅ 修订高亮显示
- ✅ 接受/拒绝修订
- ✅ 修订列表侧边栏

#### 阶段5：审批流程（2周）

- ✅ 章节级审批任务
- ✅ 问题标记工具
- ✅ 审批面板UI
- ✅ 审批历史记录
- ✅ 通知提醒

#### 阶段6：AI集成（2周）

- ✅ DocumentAIService实现
- ✅ 模板解析AI
- ✅ 内容生成AI
- ✅ 合规检查AI
- ✅ 风险检测AI
- ✅ 智能助手AI
- ✅ RAG增强

#### 阶段7：归档与权限（1周）

- ✅ 归档申请流程
- ✅ 归档审核界面
- ✅ 细粒度权限控制
- ✅ 知识库查询（带权限过滤）

#### 阶段8：测试与优化（2周）

- ✅ 单元测试
- ✅ 集成测试
- ✅ 性能优化
- ✅ 用户体验优化

**总计：13周**

### 10.2 技术风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| AI解析准确率不足 | 模板解析可能需要大量人工调整 | 提供可视化调整界面，允许人工修正 |
| 实时协作冲突 | 多人同时编辑可能造成冲突 | 使用Operational Transform算法或锁定机制 |
| 大文档性能问题 | 章节很多时加载慢 | 懒加载、虚拟滚动、章节分页 |
| 权限体系复杂 | 查询性能下降 | 权限缓存、索引优化 |

### 10.3 依赖关系

- **必需**：现有的UnifiedLLMService、VectorService、项目管理模块
- **可选**：现有的工作流引擎（可用于审批流程）

---

## 附录A：数据库DDL脚本

完整的数据库创建脚本请参考：`/apps/api/src/database/migrations/create_unified_document_system.sql`

包含以下表：
1. 模板相关（2个表）
2. 文档和章节（2个表）
3. 修订追踪（3个表）
4. 审批流程（5个表）
5. 归档与权限（2个表）
6. 版本与批注（3个表）
7. 辅助表（10个表）

**总计：27个表**

---

## 附录B：菜单配置SQL

```sql
-- 插入顶级菜单：文档管理
INSERT INTO menus (code, name, path, icon, parent_id, sort_order, status) VALUES
('document_management', '文档管理', 'documents', 'FileTextOutlined', NULL, 6, 'active');

-- 获取刚插入的父菜单ID（假设为 menu_doc_mgmt_id）
-- 插入子菜单：专业工作台
INSERT INTO menus (code, name, path, icon, parent_id, sort_order, status, permission_code) VALUES
('template_management', '模板管理', 'template-management', 'FileAddOutlined', 'menu_doc_mgmt_id', 1, 'active', 'template:manage'),
('template_spec', 'SPEC模板', 'template-management/spec', 'FileTextOutlined', 'menu_template_mgmt_id', 1, 'active', 'template:spec'),
('template_contract', '合同模板', 'template-management/contract', 'FileProtectOutlined', 'menu_template_mgmt_id', 2, 'active', 'template:contract'),
('template_bidding', '投标模板', 'template-management/bidding', 'FundOutlined', 'menu_template_mgmt_id', 3, 'active', 'template:bidding');

-- 项目文档（动态路由，在项目详情页内显示）
INSERT INTO menus (code, name, path, icon, parent_id, sort_order, status, visible) VALUES
('project_documents', '项目文档', 'projects/:projectId/documents', 'FolderOutlined', 'menu_projects_id', 10, 'active', false);

-- 知识库归档审核
INSERT INTO menus (code, name, path, icon, parent_id, sort_order, status, permission_code) VALUES
('archive_review', '归档审核', 'knowledge/archive-review', 'AuditOutlined', 'menu_knowledge_id', 10, 'active', 'knowledge:admin');
```

---

## 附录C：领域配置文件完整示例

请参考：
- `/apps/api/src/config/domains/spec.domain.js`
- `/apps/api/src/config/domains/contract.domain.js`
- `/apps/api/src/config/domains/bidding.domain.js`

---

## 总结

本设计方案为设计院提供了一个统一、灵活、智能的文档管理系统，核心特点：

1. **统一平台**：SPEC、合同、投标三种文档共享核心能力
2. **领域驱动**：通过配置实现不同文档类型的差异化需求
3. **协作优先**：实时协作、修订追踪、章节级审批
4. **AI深度集成**：从模板解析到内容生成、合规检查全流程AI参与
5. **权限细粒度**：支持全院/分院/部门/项目/专业等多级权限
6. **架构扩展性强**：基于现有平台，易于集成和扩展

通过13周的分阶段实施，可以逐步落地整个系统。
