/**
 * SPEC 文档领域配置
 * CSI MasterFormat 标准规范
 */

module.exports = {
  documentType: 'spec',
  displayName: '技术规范文档',
  icon: 'file-text',

  // ============================================
  // 章节编辑策略：固定结构
  // ============================================
  sectionPolicy: {
    mode: 'fixed',
    allowAdd: false, // 不允许新增章节
    allowDelete: false, // 不允许删除章节
    allowReorder: false, // 不允许调整顺序
    allowRename: false, // 不允许重命名
    allowEditContent: true, // 允许编辑内容
    requireSectionCode: true, // 必须有章节编码
    sectionCodeFormat: /^\d{2}(\s\d{2}){0,3}(\.\d{2})?$/, // 08 11 13.16 格式
  },

  // ============================================
  // 模板相关配置
  // ============================================
  template: {
    // 模板解析策略
    parsing: {
      method: 'ai', // AI解析
      supportedFormats: ['docx', 'pdf'],
      extractSectionCode: true, // 提取章节编码
      extractMetadata: true, // 提取元数据
      parseTableOfContents: true, // 解析目录
    },

    // 模板变量
    variables: [
      { key: 'projectName', label: '项目名称', type: 'text', required: true },
      { key: 'projectCode', label: '项目编号', type: 'text', required: true },
      { key: 'clientName', label: '业主单位', type: 'text', required: false },
      { key: 'designPhase', label: '设计阶段', type: 'select', options: ['方案设计', '初步设计', '施工图设计'], required: true },
      { key: 'preparedBy', label: '编制人', type: 'text', required: true },
      { key: 'reviewedBy', label: '审核人', type: 'text', required: false },
      { key: 'approvedBy', label: '批准人', type: 'text', required: false },
      { key: 'preparedDate', label: '编制日期', type: 'date', required: true },
    ],

    // 模板维护权限
    maintainPermission: 'department', // 部门级维护
  },

  // ============================================
  // 内容编辑器配置
  // ============================================
  editor: {
    type: 'richtext', // 富文本编辑器
    toolbar: [
      'bold', 'italic', 'underline', 'strikethrough',
      'heading', 'fontSize', 'fontColor', 'backgroundColor',
      'bulletList', 'orderedList', 'indent', 'outdent',
      'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
      'insertTable', 'insertImage', 'insertLink',
      'undo', 'redo', 'clear',
    ],

    // 粘贴配置
    paste: {
      allowImages: true,
      allowTables: true,
      cleanFormatting: false, // 保留原格式
    },

    // 自动保存
    autoSave: {
      enabled: true,
      interval: 30000, // 30秒
    },
  },

  // ============================================
  // AI 能力配置
  // ============================================
  aiCapabilities: [
    {
      id: 'generate_content',
      name: '生成章节内容',
      description: '基于章节标题和上下文，生成符合规范的内容',
      enabled: true,
      trigger: 'manual', // manual | auto
      llmModel: 'qwen', // 默认使用通义千问
      promptTemplate: '根据以下信息生成SPEC规范章节内容:\n章节编号: {{sectionCode}}\n章节标题: {{title}}\n项目信息: {{projectInfo}}\n历史参考: {{historicalReferences}}',
    },
    {
      id: 'improve_writing',
      name: '改进写作',
      description: '优化语言表达，提高规范性和专业性',
      enabled: true,
      trigger: 'manual',
      llmModel: 'qwen',
    },
    {
      id: 'check_consistency',
      name: '一致性检查',
      description: '检查全文术语、单位、标准引用的一致性',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
    {
      id: 'extract_requirements',
      name: '提取技术要求',
      description: '从章节内容中提取结构化的技术要求',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
    {
      id: 'suggest_standards',
      name: '推荐相关标准',
      description: '基于章节内容推荐相关国家标准、行业规范',
      enabled: true,
      trigger: 'manual',
      llmModel: 'qwen',
    },
    {
      id: 'compare_versions',
      name: '版本对比分析',
      description: '对比新旧版本，生成变更摘要',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
  ],

  // ============================================
  // 修订追踪配置
  // ============================================
  revisionTracking: {
    enabled: true,
    defaultOn: false, // 默认关闭
    colorPool: [
      '#1890ff', '#52c41a', '#faad14', '#f5222d',
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
    ],
    autoAcceptAfterDays: null, // 不自动接受
  },

  // ============================================
  // 审批工作流配置
  // ============================================
  approvalWorkflow: {
    enabled: true,
    mode: 'section', // 章节级审批

    // 审批阶段
    stages: [
      {
        id: 'tech_review',
        name: '专业审核',
        description: '由专业负责人审核技术内容',
        required: true,
        roles: ['tech_lead', 'discipline_lead'],
        dueDays: 3,
      },
      {
        id: 'quality_review',
        name: '质量审核',
        description: '由质量部门审核规范符合性',
        required: true,
        roles: ['quality_manager'],
        dueDays: 2,
      },
      {
        id: 'final_approval',
        name: '最终批准',
        description: '由项目负责人或总工批准',
        required: false,
        roles: ['project_manager', 'chief_engineer'],
        dueDays: 1,
      },
    ],

    // 问题类型
    issueTypes: [
      { value: 'technical_error', label: '技术错误', severity: 'high', color: '#f5222d' },
      { value: 'standard_violation', label: '标准不符', severity: 'high', color: '#fa8c16' },
      { value: 'inconsistency', label: '前后矛盾', severity: 'medium', color: '#faad14' },
      { value: 'unclear_description', label: '描述不清', severity: 'medium', color: '#1890ff' },
      { value: 'suggestion', label: '优化建议', severity: 'low', color: '#52c41a' },
    ],
  },

  // ============================================
  // 归档配置
  // ============================================
  archive: {
    enabled: true,
    requireApproval: true, // 需要知识管理员审批

    // 归档时自动生成的元数据
    autoMetadata: {
      category: 'technical_specification',
      extractKeywords: true, // AI提取关键词
      generateSummary: true, // AI生成摘要
      tagStandards: true, // 标注引用的标准
      tagDisciplines: true, // 标注涉及的专业
    },

    // 推荐权限级别
    suggestedPermissionLevels: [
      'enterprise', // 全企业
      'branch', // 分院
      'department', // 部门
    ],
  },

  // ============================================
  // 内容验证规则
  // ============================================
  validation: {
    // 章节必填检查
    requiredSections: true,

    // 内容长度限制
    contentLengthLimits: {
      minChars: 50, // 最少50字
      warnChars: 10000, // 超过10000字警告
    },

    // 必填字段检查
    requiredFields: [
      'projectName',
      'projectCode',
      'designPhase',
      'preparedBy',
      'preparedDate',
    ],

    // 格式检查
    formatRules: [
      {
        name: '标准引用格式',
        pattern: /GB[\/T]?\s*\d{4,5}[-\d]*/g,
        message: '标准编号格式应为 GB XXXXX-XXXX 或 GB/T XXXXX-XXXX',
      },
      {
        name: '章节编号格式',
        pattern: /^\d{2}(\s\d{2}){0,3}(\.\d{2})?$/,
        message: '章节编号应符合 CSI MasterFormat 格式',
      },
    ],
  },

  // ============================================
  // 协作配置
  // ============================================
  collaboration: {
    // 实时协作
    realtime: {
      enabled: true,
      showCursors: true, // 显示其他用户光标
      showSelections: true, // 显示选中文本
      lockTimeout: 1800000, // 30分钟无操作自动解锁
    },

    // 评论
    comments: {
      enabled: true,
      allowThreads: true, // 允许评论回复
      allowAnchoring: true, // 允许锚定到文本
      notifyMentioned: true, // @提及时通知
    },
  },

  // ============================================
  // 导出配置
  // ============================================
  export: {
    formats: ['docx', 'pdf'],

    // Word导出配置
    docx: {
      template: 'spec_template.docx', // 使用的Word模板
      includeTrackChanges: true, // 包含修订标记
      includeCoverPage: true, // 包含封面
      includeTableOfContents: true, // 包含目录
      includeSectionBreaks: true, // 章节分页
    },

    // PDF导出配置
    pdf: {
      watermark: true, // 添加水印
      includeMetadata: true, // 包含元数据
      pageNumbers: true, // 页码
      headerFooter: true, // 页眉页脚
    },
  },

  // ============================================
  // 权限配置
  // ============================================
  permissions: {
    // 文档创建权限
    canCreate: ['project_member', 'tech_lead', 'project_manager'],

    // 内容编辑权限
    canEdit: ['project_member', 'tech_lead'],

    // 审批权限
    canReview: ['tech_lead', 'quality_manager', 'project_manager'],

    // 归档申请权限
    canRequestArchive: ['project_manager', 'tech_lead'],

    // 删除权限
    canDelete: ['project_manager'],
  },
};
