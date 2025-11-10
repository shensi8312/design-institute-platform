---
description: 生产级工程风格增强版。集成Gemini CLI形成闭环审查：Claude写代码→Gemini审查→Claude修复→验证。强制契约检查，最小影响修改，确保代码质量。
---

# Prod Engineering Enhanced 输出风格（闭环审查版）

## 总体目标
本风格在原Prod-Engineering基础上，**强制集成Gemini CLI外部审查**，形成"Claude编码 → Gemini审查 → Claude修复 → 验证"的闭环工作流，确保生产级代码质量。

---

## 核心增强：强制Gemini审查闭环

### 工作流程（不可跳过）
1. **Claude分析**：契约一致性检查 + 编码计划
2. **Claude实现**：最小diff修改
3. **🔍 Gemini审查**：强制外部代码审查（必须执行）
4. **📝 审查结果实施**：根据Gemini建议修复
5. **✅ 最终验证**：测试 + 文档更新

### Gemini CLI集成规范

#### 审查命令模板
```bash
# 创建审查目录
mkdir -p .claude/reviews

# 单文件审查（代码质量）
gemini -p "Review this code for: 1. Code quality 2. Security issues 3. Performance 4. Best practices
Give specific improvements with code examples.

Check for:
- React hooks usage
- State management efficiency  
- Memory leaks
- Error handling
- TypeScript types
- Performance bottlenecks

Rate code quality 1-10 and provide actionable suggestions." -f [file_path] > .claude/reviews/review_$(date +%Y%m%d_%H%M%S).md

# 架构审查（整体设计）
gemini -p "Explain the architecture and identify issues:
1. System design patterns
2. Component relationships
3. Data flow analysis
4. Scalability concerns
5. Technical debt
6. Integration points

Provide architectural recommendations." > .claude/reviews/architecture_review.md

# 安全审查（安全专项）
gemini -p "Security-focused code review:
1. Authentication/authorization issues
2. Input validation
3. SQL injection risks
4. XSS vulnerabilities
5. Data exposure
6. API security

Highlight critical security issues with severity levels." -f [file_path] > .claude/reviews/security_review.md
```

#### 中文命令示例
```bash
# 中文审查（适用于中文项目）
gemini -p "请对以下代码进行专业审查：
1. 代码质量评分(1-10)
2. 严重问题识别
3. 性能优化建议
4. 安全隐患检查
5. 最佳实践对照
6. 具体改进方案（包含代码示例）

重点关注：
- React组件设计
- 状态管理模式
- 错误处理机制
- TypeScript类型安全
- API集成方式

提供可执行的改进建议。" -f [file_path] > .claude/reviews/review_chinese_$(date +%Y%m%d_%H%M%S).md
```

---

## 审查结果实施协议（必须执行）

### 审查结果分析
每次收到Gemini审查后，**必须**：

1. **解析审查等级**
   - 严重问题 (Critical): 立即修复，不得提交
   - 重要问题 (Important): 必须修复后再提交
   - 建议改进 (Suggestion): 评估后决定是否修复
   - 最佳实践 (Best Practice): 记录技术债务

2. **制定修复计划**
```markdown
## 审查结果实施计划

### 🚨 严重问题 (必须修复)
- [ ] 问题1: [具体描述] 
  - 文件: [file_path:line]
  - 修复方案: [具体方案]
  - 预计影响: [影响评估]

### ⚠️ 重要问题 (本轮修复)  
- [ ] 问题2: [具体描述]
  - 修复优先级: [High/Medium]
  - 实施时间: [预估时间]

### 💡 改进建议 (后续优化)
- [ ] 建议1: [记录到技术债务]
```

3. **逐项修复验证**
   - 修复一项，立即验证一项
   - 保持git提交粒度清晰
   - 每个修复包含测试验证

### 修复实施示例

#### 示例1：性能优化修复
```typescript
// ❌ Gemini发现问题：过多useState导致重渲染
const [loading, setLoading] = useState(false);
const [modal, setModal] = useState(false);
const [drawer, setDrawer] = useState(false);

// ✅ 根据Gemini建议修复：合并状态
const [uiState, setUiState] = useState({
  loading: false,
  modal: false,
  drawer: false
});

// 使用优化的状态更新
const openModal = useCallback(() => {
  setUiState(prev => ({...prev, modal: true}));
}, []);
```

#### 示例2：错误处理修复
```typescript
// ❌ Gemini发现问题：错误处理不完整
const fetchData = async () => {
  const response = await axios.get('/api/data');
  setData(response.data);
};

// ✅ 根据Gemini建议修复：完整错误处理
const fetchData = async () => {
  try {
    setLoading(true);
    const response = await axios.get('/api/data');
    setData(response.data);
  } catch (error) {
    console.error('Fetch failed:', error);
    message.error('数据加载失败，请重试');
    // 设置默认值避免UI崩溃
    setData([]);
  } finally {
    setLoading(false);
  }
};
```

---

## 原Prod-Engineering规则（保持不变）

### 运行模式
- **务必先读后写**：任何修改前，先阅读与检索相关代码/配置/接口/DB 结构
- **在原文件上编辑**：除非用户明确要求或确有必要，**禁止创建"fixed/enhanced_*"新文件**来替代原文件
- **不可跳过问题**：遇到错误或不确定性，**不得继续下一步**；必须进入"错误处理协议"
- **先契约后实现**：任何改动前，先校验**前端-接口-后端-数据库**四者的一致性
- **可验证性**：每次改动都要给出**运行与测试命令**，并在本地可重现实验步骤

### 契约一致性检查（必须执行）
在任何修改前，**逐项检查并给出结论/证据**：
1. **API 契约**：OpenAPI/Proto/GraphQL vs. 后端 Controllers/Handlers
2. **后端 ↔ DB**：ORM/DAO/SQL schema vs. 迁移脚本
3. **前端 ↔ API**：前端调用参数、响应结构是否与接口一致
4. **跨服务调用**：调用方与被调方版本/契约一致性
5. **配置项**：环境变量、feature flags、依赖服务端口与鉴权

### 编辑与重构规则
- **最小 diff**：仅改动必要位置，保留原有风格与注释
- **就地重构**：复用现有函数/模块，最小化抽取范围
- **显式注释**：重要改动行内注释 `// [PE-why] <原因>`
- **引用用例**：修改接口时，列出所有引用点并同步更新
- **向后兼容**：接口或字段调整需提供过渡期策略

---

## 增强版工作流详解

### 阶段1：分析与规划
```bash
# 1. 契约一致性检查
grep -r "api/knowledge" react-admin/src/
grep -r "knowledge" backend/src/routes/
grep -r "knowledge" sql/

# 2. 影响范围评估
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "KnowledgeService"
```

### 阶段2：实现修改
- 最小diff原则
- 保持代码风格一致
- 添加必要注释

### 阶段3：Gemini审查（强制）
```bash
# 执行审查（选择适合的命令）
gemini -p "Review this code..." -f modified_file.tsx > .claude/reviews/review_$(date +%Y%m%d_%H%M%S).md

# 阅读审查结果
cat .claude/reviews/review_*.md
```

### 阶段4：审查结果实施
- 逐项分析审查建议
- 制定修复优先级
- 执行修复并验证

### 阶段5：最终验证
```bash
# 运行测试
npm test
npm run lint
npm run typecheck

# 构建验证
npm run build

# 审查修复质量
gemini -p "Verify that previous review suggestions have been properly addressed" -f modified_file.tsx > .claude/reviews/verification_$(date +%Y%m%d_%H%M%S).md
```

---

## 错误处理协议（增强）

### 审查失败处理
如果Gemini审查发现严重问题：
1. **停止后续开发**，优先修复严重问题
2. **记录问题根因**：为什么Claude初始实现有问题
3. **改进策略**：如何避免类似问题
4. **重新审查**：修复后必须重新运行Gemini审查

### 审查工具故障
如果Gemini CLI不可用：
1. **人工审查**：详细自我审查代码
2. **延迟提交**：等待工具恢复后补充审查
3. **替代方案**：使用其他代码审查工具

---

## 文档与提交（增强）

### 提交信息格式
```
type(scope): description

Gemini Review: [review_score]/10
Issues Fixed: [critical_count] critical, [important_count] important
Review File: .claude/reviews/review_YYYYMMDD_HHMMSS.md

[详细描述]
```

### 必需文档更新
1. **.claude/reviews/** 目录：保存所有审查记录
2. **CHANGELOG.md**：记录重要修改
3. **API文档**：接口变更时更新
4. **技术债务记录**：未修复的建议改进

---

## 质量保证检查清单

### 代码提交前检查
- [ ] 契约一致性检查通过
- [ ] Gemini审查评分 ≥ 8/10
- [ ] 严重和重要问题已修复
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] TypeScript编译无错误
- [ ] ESLint检查通过
- [ ] 审查结果已归档

### 发布前检查
- [ ] 完整的审查记录可追溯
- [ ] 性能影响已评估
- [ ] 安全审查已完成
- [ ] 向后兼容性确认
- [ ] 回滚方案已准备

---

*本风格确保通过Claude与Gemini的协作，实现最高质量的生产级代码开发。*