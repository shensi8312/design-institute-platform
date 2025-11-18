# 设计院平台 V3.0 架构重构设计方案

**设计日期**: 2025-11-18
**设计目标**: 激进重构，对齐项目维度，为长远发展打好基础
**实施周期**: 8周，分4个阶段上线

---

## 一、项目背景与目标

### 1.1 当前问题

**架构问题**:
- 现有系统以"文档维度"为主，用户不知道去"项目"还是"文档管理"上传合同
- 知识库和业务文档混在一起，逻辑不清晰
- SPEC 文档在"文档管理"，但属于某个项目，逻辑有点乱

**用户困惑**:
- 法务/商务不知道在哪里上传合同和投标书
- 普通用户误以为可以上传到企业知识库
- 管理员没有统一的"知识入库车间"

### 1.2 设计目标

**核心目标**: 从"文档维度"升级为"项目维度"，建立清晰的业务流程

**具体目标**:
1. **项目中心成为业务主战场** - 所有业务文档（合同/标书/SPEC）都在项目里操作
2. **文档中心提供全局视图** - 跨项目文档管理，管理员视角
3. **知识库明确只读/可写** - 企业知识库只读，个人知识库可写
4. **知识入库独立成模块** - 管理员专用的"知识处理车间"
5. **合同审查能力上线** - 法务/商务能在项目中心进行 AI 审查并生成报告

---

## 二、整体架构设计

### 2.1 八大模块架构

```
🏠 首页

📁 项目中心（业务主入口）
   └─ 项目视角：合同/招标/投标/评标/SPEC

📄 文档中心（跨项目管理）
   └─ 全局视角：模板/审批/归档

📚 知识中心（知识资产库）
   └─ 企业知识库（只读）+ 个人知识库（可写）+ 问答 + 图谱

📂 知识入库管理（管理员专用）
   └─ 上传 → Docling解析 → 审核 → 发布到企业库

⚖️ 规则管理（专家专用）
   └─ 规则库 + 规则学习 + 规则审核

🤖 AI 工具（研发专用）
   └─ 工作流 + Agent + 调试工具

🔧 机械设计（行业垂直）
   └─ PID识别 + 装配设计 + 图纸比对

🛠 系统管理（管理员）
   └─ 用户/角色/权限/审计
```

### 2.2 双视角设计

| 视角 | 模块 | 主要用户 | 核心功能 |
|-----|------|---------|---------|
| **业务视角** | 项目中心 | 法务/商务/技术 | 上传文档、AI审查、生成报告 |
| **管理视角** | 文档中心 | 项目经理/管理员 | 跨项目文档管理、批量归档 |

---

## 三、核心页面重构设计

### 3.1 ProjectWorkspace（项目工作台 - 新建）

**路由**: `/projects/:id/workspace`

**页面布局**:
```
┌─────────────────────────────────────────────┐
│ 📁 项目名称：康桥二期集成电路生产厂房          │
│ 状态：进行中 | 负责人：张工 | 成员：15人      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ [📄 合同类] [📋 招标文件] [📘 我方投标]       │
│ [📗 对手投标] [📊 评标文件] [📁 其他附件]     │
└─────────────────────────────────────────────┘

┌──────────────────┬─────────────────────────┐
│ 文档列表          │ 快速操作 & 统计          │
│                  │ [📤 上传文档]            │
│ 📄 施工合同.docx  │ [🤖 批量审查]            │
│    2024-11-15    │                         │
│    待审核 ⚠️      │ 📈 项目统计              │
│    [详情][审查]  │ • 文档总数：15          │
│                  │ • 待审核：3             │
│ 📄 采购合同.pdf   │ • 已归档：8             │
│    2024-11-10    │                         │
│    已审核 ✅      │                         │
│    [详情][报告]  │                         │
└──────────────────┴─────────────────────────┘
```

**组件拆分**:
```typescript
ProjectWorkspace/
  ├─ ProjectHeader.tsx         // 项目信息头部
  ├─ DocumentTabs.tsx          // 文档类型Tab
  ├─ DocumentList.tsx          // 文档列表
  └─ ProjectStatsAside.tsx     // 统计侧边栏
```

**核心功能**:

1. **文档类型分类**:
```typescript
const documentTypes = {
  contract: '合同类',           // 合同（甲方版/我方草稿/补充协议）
  bidding_doc: '招标文件',      // 招标文件（技术/商务）
  our_bid: '我方投标',          // 我方投标（技术标/商务标）
  competitor_bid: '对手投标',   // 对手投标
  evaluation: '评标文件',       // 评标文件
  other: '其他附件'             // 其他
};
```

2. **上传文档弹窗**:
```
┌────────────────────────────┐
│  上传文档到项目             │
├────────────────────────────┤
│  文件：[浏览...]            │
│  已选：施工合同.docx        │
│                            │
│  文档类型：                 │
│  ○ 合同（甲方版）           │
│  ○ 合同（我方草稿）         │
│  ○ 补充协议                │
│                            │
│  负责部门：[法务部 ▼]       │
│  文档密级：[内部 ▼]         │
│  ☐ 上传后立即触发 AI 审查   │
│                            │
│  [取消]  [上传]             │
└────────────────────────────┘
```

3. **AI 审查交互**:
```typescript
// 点击 [AI审查] 按钮
const handleAiReview = async (docId) => {
  // 1. 启动审查任务
  const { jobId } = await api.post('/api/ai-review/start', { docId });

  // 2. 打开 Drawer，显示"正在分析..."
  setReviewDrawer({ open: true, jobId, status: 'processing' });

  // 3. 轮询任务状态
  const interval = setInterval(async () => {
    const job = await api.get(`/api/ai-review/jobs/${jobId}`);
    if (job.status === 'completed') {
      setReviewDrawer({ status: 'completed', result: job.result });
      clearInterval(interval);
    }
  }, 2000);
};
```

**审查结果 Drawer**:
```
┌─────────────────────────────┐
│ 合同审查结果                 │
├─────────────────────────────┤
│ 📊 综合评分：72/100          │
│                             │
│ ⚠️ 风险列表（3项）           │
│ ├─ 🔴 高风险：付款条件不利   │
│ │   条款：第3.2条           │
│ │   建议：增加逾期付款条款   │
│ │   [跳转查看] [接受建议]    │
│ │                           │
│ ├─ 🟡 中风险：违约责任不明确 │
│ └─ 🟢 低风险：缺少仲裁条款   │
│                             │
│ 📝 建议条款（2项）           │
│                             │
│ [生成完整报告] [导出Word]    │
└─────────────────────────────┘
```

4. **权限控制矩阵**:

| Tab | 用户角色 | 可见操作 |
|-----|---------|---------|
| 合同类 | 法务 | [AI审查] [修改条款] [生成报告] [上传] |
| 合同类 | 商务 | [查看审查结果] [下载] |
| 合同类 | 技术 | [查看]（只读） |
| 我方投标 | 技术 | [AI审查] [编辑] [上传技术文档] |
| 我方投标 | 商务 | [AI审查] [编辑] [上传商务文档] |
| 对手投标 | 商务+技术 | [AI比对] [标注] [生成评标报告] |

```typescript
// 权限控制函数
const canPerformAction = (action, documentType, userRole) => {
  // 后端返回权限列表
  const permissions = user.permissions; // ['doc.ai_review.contract', 'doc.edit.contract', ...]

  return permissions.includes(`doc.${action}.${documentType}`);
};
```

---

### 3.2 DocumentManagement（文档管理 - 重构）

**定位**: 跨项目的文档管理视图（管理员、项目经理使用）

**页面布局**:
```
┌─────────────────────────────────────────────┐
│ 📄 文档管理                                  │
├─────────────────────────────────────────────┤
│ 筛选器：                                     │
│ 项目：[全部 ▼]  类型：[全部 ▼]  状态：[全部 ▼] │
│ 文档范围：[全部 ▼]                           │
│   - 全部                                    │
│   - 仅项目文档                               │
│   - 仅全局文档                               │
│ 搜索：[_______] [搜索]  [上传全局文档]       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 文档列表                                     │
├──────┬────────┬──────┬────────┬────────────┤
│ 项目 │ 文档名 │ 类型 │ 审查状态│ 操作        │
├──────┼────────┼──────┼────────┼────────────┤
│ P001 │施工合同│合同  │✅ 已通过│[详情][下载] │
│ P001 │技术标  │投标  │⚠️ 有风险│[详情][审查] │
│ 🌐全局│制度文件│其他  │⏳ 未审查│[详情][编辑] │
└──────┴────────┴──────┴────────┴────────────┘
```

**优化点**:
1. **筛选器增加"文档范围"** - 区分项目文档和全局文档
2. **表格显示全局文档标记** - 项目列显示 🌐 全局文档
3. **上传提示** - "⚠ 项目文档请到【项目中心】上传"
4. **编辑约束** - 仅限修改元数据，不能编辑正文
5. **审查状态列** - 显示风险概览（3高/2中/0低）
6. **项目列可跳转** - 点击项目名跳转到项目工作台

**与 ProjectWorkspace 的区别**:

| 特性 | ProjectWorkspace | DocumentManagement |
|------|-----------------|-------------------|
| 视角 | 单个项目 | 跨项目 |
| 主要用户 | 业务人员 | 管理员、项目经理 |
| 上传 | 项目文档 | 全局文档 |
| 筛选 | 按文档类型 Tab | 按项目+类型+状态 |
| 操作 | 深度编辑、审查 | 元数据管理、批量操作 |

---

### 3.3 KnowledgeManage 拆分（知识入库管理）

**拆分策略**: 拆成 4 个独立页面

| 新菜单 | 文件 | 功能 |
|-------|------|------|
| 上传原始知识 | KnowledgeUpload.tsx（复用） | 上传 PDF/Word 等原始文件 |
| 解析任务 | KnowledgeParseTask.tsx（新建） | 查看 Docling 解析任务状态 |
| 内容审核 | ContentReview.tsx（复用） | 专家审核解析后的内容 |
| 入库发布 | KnowledgePublish.tsx（新建） | 发布到企业库+语义层+图谱 |

**完整流程**:
```
上传原始文档
    ↓
Docling 解析（异步）
    ↓
人工审核（质量检查）
    ↓
入库发布
  ├─ 企业知识库
  ├─ 语义层（Milvus）
  ├─ 知识图谱（Neo4j）
  └─ 规则库（可选）
```

**新建页面：KnowledgeParseTask.tsx**:
```
┌─────────────────────────────────────────┐
│ 📂 解析任务管理                          │
├─────────────────────────────────────────┤
│ 筛选：状态：[全部 ▼]  时间：[最近7天 ▼]   │
└─────────────────────────────────────────┘

┌──────┬──────┬──────┬────────┬──────────┐
│ 文档 │ 状态 │ 进度 │ 开始时间│ 操作      │
├──────┼──────┼──────┼────────┼──────────┤
│ 规范A│ 解析中│ 45% │ 10:30  │[查看日志] │
│ 合同B│ 成功 │ 100%│ 10:25  │[预览][发布]│
│ 标准C│ 失败 │ 30% │ 10:20  │[错误][重试]│
└──────┴──────┴──────┴────────┴──────────┘
```

**新建页面：KnowledgePublish.tsx**:
```
┌────────────────────────────┐
│  发布到企业知识库           │
├────────────────────────────┤
│  文档：规范A                │
│                            │
│  发布到：                   │
│  ☑ 企业知识库               │
│  ☑ 语义层（Milvus）         │
│  ☑ 知识图谱（Neo4j）        │
│  ☐ 规则库（可选）           │
│                            │
│  访问权限：                 │
│  ○ 全企业可见               │
│  ○ 指定部门：[技术部 ▼]     │
│  ○ 指定项目：[项目A ▼]      │
│                            │
│  知识类型：                 │
│  ○ 规范类（国标/地标）      │
│  ○ 合同标准条款库           │
│  ○ 评标评分规则             │
│  ○ 技术参数规则             │
│                            │
│  [取消]  [确认发布]         │
└────────────────────────────┘
```

---

## 四、菜单结构设计（3级结构）

### 4.1 菜单层级定义

- **1级菜单**（directory）：大模块，侧边栏显示
- **2级菜单**（menu）：具体页面，点击跳转
- **3级菜单**（button）：页面内操作，控制权限

### 4.2 完整菜单树

```
🏠 首页

📁 项目中心
   ├─ 我的项目（2级 menu）
   │   └─ [创建项目]（3级 button）
   │   └─ [进入项目]（3级 button）
   └─ 所有项目（2级 menu）
       └─ [分配成员]（3级 button）
       └─ [删除项目]（3级 button）

📄 文档中心
   ├─ 文档管理（2级 menu）
   │   └─ [上传全局文档]（3级 button - 仅管理员）
   │   └─ [批量下载]（3级 button）
   │   └─ [删除文档]（3级 button - 仅管理员）
   ├─ 模板管理（2级 menu）
   │   └─ [新建模板]（3级 button）
   │   └─ [编辑模板]（3级 button）
   │   ⚠️ 页面内用 Tab 切换：[合同模板] [技术标模板] [商务标模板]
   ├─ 审批任务（2级 menu）
   └─ 归档管理（2级 menu）

📚 知识中心
   ├─ 企业知识库（2级 menu - 只读）
   ├─ 个人知识库（2级 menu - 可写）
   ├─ 智能问答（2级 menu）
   └─ 知识图谱（2级 menu）

📂 知识入库管理（管理员专用）
   ├─ 上传原始知识（2级 menu）
   ├─ 解析任务（2级 menu）
   ├─ 内容审核（2级 menu）
   └─ 入库发布（2级 menu）

⚖️ 规则管理（专家专用）
   ├─ 统一规则库（2级 menu）
   ├─ 规则学习配置（2级 menu）
   └─ 规则审核（2级 menu）

🤖 AI 工具（研发专用）
   ├─ 我的任务
   ├─ 工作流编排
   ├─ Agent 工作流
   ├─ 引擎管理
   ├─ 图纸识别
   ├─ 数据标注
   └─ 调试工具

🔧 机械设计
   ├─ PID识别
   ├─ 装配规则库管理
   ├─ 样本学习
   ├─ 装配设计
   └─ 图纸比对

🛠 系统管理（管理员）
   ├─ 用户管理
   ├─ 角色管理
   ├─ 部门管理
   ├─ 组织管理
   ├─ 菜单管理
   ├─ 权限管理
   ├─ 项目分配
   ├─ AI模型配置
   └─ 操作审计
```

### 4.3 角色与菜单可见性

| 角色 | 可见的1级菜单 |
|-----|-------------|
| 法务 | 项目中心、文档中心、知识中心（部分）、审批任务 |
| 商务/市场 | 项目中心、文档中心（文档管理）、知识中心（问答、个人库） |
| 技术 | 项目中心、文档中心、知识中心（全部）、机械设计 |
| 项目经理 | 项目中心（全部）、文档中心、知识中心、审批任务 |
| 知识管理员 | 项目中心、文档中心、知识中心、知识入库管理 |
| 规则专家 | 规则管理、知识中心 |
| AI工程师 | AI工具、知识入库管理、规则管理 |
| 管理员 | 所有模块 |

---

## 五、数据库设计

### 5.1 新增字段

```sql
-- 1. project_documents 表增加字段
ALTER TABLE project_documents
ADD COLUMN document_type VARCHAR(50),  -- 'contract'/'bidding_doc'/'our_bid'/'competitor_bid'/'evaluation'/'other'
ADD COLUMN document_subtype VARCHAR(50),  -- 'tech'/'commercial'/'draft'/'final'
ADD COLUMN responsible_department VARCHAR(100);

-- 2. knowledge_documents 表增加字段
ALTER TABLE knowledge_documents
ADD COLUMN knowledge_type VARCHAR(50);  -- 'spec'/'contract_clause'/'rule'/'tech_param'

-- 3. 创建报告模板配置表
CREATE TABLE report_templates (
  id UUID PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,  -- 'contract_review'/'technical_review'/...
  template_file VARCHAR(255),
  output_name_pattern VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 菜单更新脚本

菜单 SQL 更新脚本已生成：
`apps/api/src/database/migrations/20251118000000_restructure_menus_v3.js`

---

## 六、分阶段实施计划（8周）

### 第1阶段（3周）：项目中心 + 合同审查核心功能

**目标**: 让法务和商务能在项目中心上传合同并进行 AI 审查

#### Week 1：数据库和后端基础
- ✅ 数据库字段增加（document_type, document_subtype, responsible_department）
- ✅ 后端 API 开发：
  - `POST /api/projects/:id/documents/upload`
  - `GET /api/projects/:id/documents?type=`
  - `POST /api/ai-review/start`
  - `GET /api/ai-review/jobs/:jobId`
  - `POST /api/reports/generate`
- ✅ 权限系统：生成 permission codes，配置角色映射

#### Week 2：前端页面开发
- ✅ 新建页面：`ProjectWorkspace.tsx`
- ✅ 新建组件：
  - `ProjectHeader.tsx`
  - `DocumentTabs.tsx`
  - `DocumentList.tsx`
  - `ProjectStatsAside.tsx`
  - `UploadDocumentModal.tsx`
  - `ReviewDrawer.tsx`
- ✅ 重构页面：`ProjectManagement.tsx`

#### Week 3：集成测试和优化
- ✅ 集成 ContractReviewAgent
- ✅ 测试完整流程：上传 → AI审查 → 生成报告 → 导出Word
- ✅ 权限测试（法务、商务、技术）
- ✅ **内测 Pilot**：找1个法务 + 1个商务走完整流程，收集反馈

**交付物**:
- ✅ 法务能在项目中心上传合同并进行 AI 审查（完整版）
- ✅ 商务能上传投标书并进行 AI 审查（基础版：结构/完整性/显性风险）
- ✅ 生成审查报告并导出 Word（通用模板）

**说明**:
- 投标 AI 审查为基础版，第3阶段升级为深度版（规范+规则驱动）
- 报告模板先用通用模板，第2/3阶段再拆分

---

### 第2阶段（2周）：文档中心 + 知识中心重组

**目标**: 完成跨项目文档管理和知识库的只读/可写区分

#### Week 4：文档中心开发
- ✅ 重构页面：`DocumentManagement.tsx`
  - 增加筛选器（文档范围：全部/项目/全局）
  - 增加全局文档上传（仅管理员）
  - 增加审查状态列（风险概览）
  - 项目列可跳转到项目工作台
- ✅ 重构页面：`TemplateManagement.tsx`
  - 页面内 Tab 切换模板类型
- ✅ 后端 API：
  - `POST /api/documents/upload-global`
  - `GET /api/documents?projectId=&type=&scope=`

#### Week 5：知识中心重组
- ✅ 页面调整：
  - `EnterpriseKnowledge.tsx`（移除上传按钮，增加只读提示）
  - `PersonalKnowledge.tsx`（保留上传功能）
  - `IntelligentQA.tsx`（无改动）
  - `KnowledgeGraph.tsx`（无改动）
- ✅ UI 文案：
  - 企业知识库："企业知识库为只读。如需增加内容，请到【知识入库管理】模块"
  - 个人知识库："个人知识库仅您可见"

**交付物**:
- ✅ 文档中心支持跨项目文档管理
- ✅ 知识中心明确只读/可写区分

---

### 第3阶段（2周）：知识入库管理 + 规则管理

**目标**: 完成管理员的知识处理车间和规则管理

#### Week 6：知识入库管理
- ✅ 新建页面：
  - `KnowledgeParseTask.tsx`
  - `KnowledgePublish.tsx`
- ✅ 复用页面：
  - `KnowledgeUpload.tsx`
  - `ContentReview.tsx`
- ✅ 后端 API：
  - `GET /api/knowledge-ingestion/parse-tasks`
  - `POST /api/knowledge-ingestion/parse-tasks/:id/retry`
  - `GET /api/knowledge-ingestion/ready-to-publish`
  - `POST /api/knowledge-ingestion/:id/publish`
- ✅ 功能实现：
  - Docling 解析任务监控
  - 解析日志查看
  - 发布到企业库+语义层+知识图谱
  - 知识类型分类（规范/合同条款/规则/参数）

#### Week 7：规则管理完善
- ✅ 页面调整：无大改动
- ✅ 权限配置：规则管理仅专家、管理员可见
- ✅ **投标 AI 审查升级**：集成规范库和规则引擎，实现深度审查

**交付物**:
- ✅ 管理员能完成 上传 → 解析 → 审核 → 发布 完整流程
- ✅ 规则管理权限隔离完成
- ✅ 投标 AI 审查升级为深度版

---

### 第4阶段（1周）：菜单切换 + 用户培训

**目标**: 统一切换到新菜单，培训用户

#### Week 8：菜单切换和培训
- ✅ 菜单切换：
  - 执行菜单 SQL 更新脚本
  - 配置角色与菜单可见性映射
  - 测试各角色登录后的菜单
- ✅ 用户培训：
  - 编写用户手册（按角色）
    - 法务：如何在项目中心上传合同并审查
    - 商务：如何上传投标书并评标
    - 技术：如何查看 SPEC 和技术标
    - 管理员：如何管理知识入库
- ✅ 回归测试：
  - 全流程测试
  - 权限测试
  - 性能测试

**交付物**:
- ✅ 新菜单结构正式上线
- ✅ 用户培训完成
- ✅ 系统稳定运行

---

## 七、技术细节要点

### 7.1 ProjectWorkspace 数据流

```typescript
// 状态提升到 ProjectWorkspace
const [activeType, setActiveType] = useState<DocumentType>('contract');

// DocumentTabs
<DocumentTabs
  activeType={activeType}
  onChange={setActiveType}
/>

// DocumentList
<DocumentList
  projectId={projectId}
  documentType={activeType}
  onAiReview={handleAiReview}
  onUpload={openUploadModal}
/>
```

### 7.2 权限控制

```typescript
// 后端返回权限列表
user.permissions = [
  'doc.ai_review.contract',
  'doc.edit.contract',
  'doc.upload.our_bid',
  ...
];

// 前端判断
const canReview = permissions.includes(`doc.ai_review.${documentType}`);
```

### 7.3 AI 审查长任务处理

```typescript
// 1. 启动任务
const { jobId } = await api.post('/api/ai-review/start', { docId });

// 2. 轮询状态
const interval = setInterval(async () => {
  const job = await api.get(`/api/ai-review/jobs/${jobId}`);
  if (job.status === 'completed') {
    // 显示结果
    clearInterval(interval);
  }
}, 2000);
```

### 7.4 报告生成

```typescript
POST /api/reports/generate
{
  "projectId": "P2024-001",
  "documentId": "D123",
  "reportType": "contract_review",  // 'technical_review'/'commercial_review'/'bid_comparison'
  "format": "docx"
}

// 报告模板配置（config/report-templates.json）
{
  "contract_review": {
    "templateFile": "templates/合同审查报告_v1.docx",
    "outputName": "合同审查报告_{documentName}_{date}.docx"
  }
}
```

---

## 八、风险与应对

### 8.1 技术风险

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| Docling 解析不稳定 | 知识入库失败 | 增加降级方案（pdf-parse）、重试机制 |
| AI 审查超时 | 用户体验差 | 异步任务+轮询、超时提示 |
| 大文件上传慢 | 用户等待时间长 | 分片上传、进度条、后台上传 |
| 权限配置错误 | 数据泄露 | 严格测试权限矩阵、审计日志 |

### 8.2 业务风险

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| 用户习惯迁移成本高 | 抵触新系统 | Week 3 内测 Pilot、角色培训、渐进式引导 |
| AI 审查结果不准确 | 信任度下降 | 明确基础版/深度版、提供人工修正 |
| 知识库内容质量差 | 影响 AI 效果 | 严格审核流程、质量检查清单 |

---

## 九、成功标准

### 9.1 第1阶段成功标准
- [ ] 法务能在项目中心上传合同并完成 AI 审查（成功率 > 90%）
- [ ] 商务能上传投标书并获得基础审查结果
- [ ] 生成报告并导出 Word（格式正确）
- [ ] 内测用户反馈积极（满意度 > 4/5）

### 9.2 第2阶段成功标准
- [ ] 文档中心能正确筛选项目文档和全局文档
- [ ] 企业知识库明确只读（无上传按钮）
- [ ] 个人知识库能正常上传和管理

### 9.3 第3阶段成功标准
- [ ] 管理员能完成知识入库全流程（上传 → 解析 → 审核 → 发布）
- [ ] 解析任务状态监控正常
- [ ] 投标深度审查能调用规范库和规则引擎

### 9.4 第4阶段成功标准
- [ ] 新菜单结构上线，所有角色菜单显示正确
- [ ] 用户培训完成（≥80%用户参加）
- [ ] 回归测试通过（无阻断性 bug）
- [ ] 系统稳定运行（7天无严重故障）

---

## 十、后续优化方向

1. **AI 能力增强**（3-6个月）
   - 合同条款自动改写
   - 投标书自动生成
   - 评标智能评分

2. **知识图谱深化**（6-12个月）
   - 规范之间的关联关系
   - 合同条款知识图谱
   - 项目经验知识库

3. **协作增强**（6个月）
   - 多人同时编辑文档
   - 实时批注和讨论
   - 版本对比可视化

4. **移动端支持**（9个月）
   - 移动端审批
   - 移动端查看审查结果
   - 移动端智能问答

---

## 附录

### A. 页面复用映射表

| 新菜单 | 复用/新建 | 文件 |
|-------|---------|------|
| 我的项目 | 复用 | ProjectManagement.tsx（mode="my"） |
| 所有项目 | 复用 | ProjectManagement.tsx（mode="all"） |
| 项目工作台 | **新建** | ProjectWorkspace.tsx |
| 文档管理 | **重构** | DocumentManagement.tsx |
| 模板管理 | 复用 | TemplateManagement.tsx |
| 审批任务 | 复用 | ApprovalTasks.tsx |
| 归档管理 | 复用 | ArchiveManagement.tsx |
| 企业知识库 | 复用 | EnterpriseKnowledge.tsx |
| 个人知识库 | 复用 | PersonalKnowledge.tsx |
| 智能问答 | 复用 | IntelligentQA.tsx |
| 知识图谱 | 复用 | KnowledgeGraph.tsx |
| 上传原始知识 | 复用 | KnowledgeUpload.tsx |
| 解析任务 | **新建** | KnowledgeParseTask.tsx |
| 内容审核 | 复用 | ContentReview.tsx |
| 入库发布 | **新建** | KnowledgePublish.tsx |

**需要新建的页面**: 3个
**需要重构的页面**: 2个
**直接复用的页面**: 10个

### B. API 接口清单

**项目中心相关**:
- `POST /api/projects/:id/documents/upload` - 项目文档上传
- `GET /api/projects/:id/documents?type=` - 获取项目文档列表
- `POST /api/ai-review/start` - 启动 AI 审查
- `GET /api/ai-review/jobs/:jobId` - 查询审查状态
- `POST /api/reports/generate` - 生成报告

**文档中心相关**:
- `POST /api/documents/upload-global` - 上传全局文档
- `GET /api/documents?projectId=&type=&scope=` - 跨项目文档查询
- `POST /api/documents/batch-archive` - 批量归档

**知识入库相关**:
- `GET /api/knowledge-ingestion/parse-tasks` - 解析任务列表
- `POST /api/knowledge-ingestion/parse-tasks/:id/retry` - 重试解析
- `GET /api/knowledge-ingestion/ready-to-publish` - 待发布列表
- `POST /api/knowledge-ingestion/:id/publish` - 发布到企业库

---

**设计完成日期**: 2025-11-18
**预计开始实施**: 2025-11-25
**预计完成日期**: 2026-01-20（8周后）
