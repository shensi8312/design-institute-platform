/**
 * 合同文档领域配置
 * 支持法律风险识别、关键条款标注
 */

module.exports = {
  documentType: 'contract',
  displayName: '合同文档',
  icon: 'file-protect',

  // ============================================
  // 章节编辑策略：半灵活结构
  // ============================================
  sectionPolicy: {
    mode: 'semi_flexible',
    allowAdd: true, // 允许新增章节
    allowDelete: true, // 允许删除非核心章节
    allowReorder: true, // 允许调整顺序
    allowRename: true, // 允许重命名
    allowEditContent: true,
    requireSectionCode: false, // 不强制章节编码

    // 核心章节（不可删除）
    coreSections: [
      '合同双方',
      '项目概况',
      '合同价款',
      '工期要求',
      '质量标准',
      '付款方式',
      '违约责任',
      '争议解决',
    ],

    // 建议章节模板
    suggestedSections: [
      { title: '合同双方', order: 1, required: true },
      { title: '项目概况', order: 2, required: true },
      { title: '合同范围', order: 3, required: false },
      { title: '合同价款', order: 4, required: true },
      { title: '付款方式', order: 5, required: true },
      { title: '工期要求', order: 6, required: true },
      { title: '质量标准', order: 7, required: true },
      { title: '材料供应', order: 8, required: false },
      { title: '权利义务', order: 9, required: false },
      { title: '违约责任', order: 10, required: true },
      { title: '保险条款', order: 11, required: false },
      { title: '争议解决', order: 12, required: true },
      { title: '其他约定', order: 13, required: false },
    ],
  },

  // ============================================
  // 模板相关配置
  // ============================================
  template: {
    parsing: {
      method: 'ai',
      supportedFormats: ['docx', 'pdf'],
      extractSectionCode: false,
      extractMetadata: true,
      parseTableOfContents: true,
      identifyKeyFields: true, // 识别关键字段
    },

    variables: [
      { key: 'contractNumber', label: '合同编号', type: 'text', required: true },
      { key: 'contractTitle', label: '合同名称', type: 'text', required: true },
      { key: 'partyA', label: '甲方（发包方）', type: 'text', required: true },
      { key: 'partyB', label: '乙方（承包方）', type: 'text', required: true },
      { key: 'projectName', label: '项目名称', type: 'text', required: true },
      { key: 'projectLocation', label: '项目地点', type: 'text', required: false },
      { key: 'contractAmount', label: '合同金额', type: 'number', required: true },
      { key: 'currency', label: '币种', type: 'select', options: ['人民币', '美元', '欧元'], required: true },
      { key: 'signingDate', label: '签订日期', type: 'date', required: true },
      { key: 'effectiveDate', label: '生效日期', type: 'date', required: false },
      { key: 'expiryDate', label: '到期日期', type: 'date', required: false },
    ],

    maintainPermission: 'department', // 法务部门维护
  },

  // ============================================
  // 内容编辑器配置
  // ============================================
  editor: {
    type: 'richtext',
    toolbar: [
      'bold', 'italic', 'underline',
      'heading', 'fontSize',
      'bulletList', 'orderedList',
      'alignLeft', 'alignCenter', 'alignRight',
      'insertTable', 'insertLink',
      'highlightField', // 特殊：标注关键字段
      'undo', 'redo',
    ],

    paste: {
      allowImages: false, // 合同一般不需要图片
      allowTables: true,
      cleanFormatting: true, // 清理格式
    },

    autoSave: {
      enabled: true,
      interval: 30000,
    },
  },

  // ============================================
  // 关键字段标注配置
  // ============================================
  fieldAnnotation: {
    enabled: true,

    // 字段类型定义
    fieldTypes: [
      { value: 'party', label: '合同主体', color: '#1890ff', icon: 'team' },
      { value: 'amount', label: '金额条款', color: '#f5222d', icon: 'dollar' },
      { value: 'date', label: '时间条款', color: '#52c41a', icon: 'calendar' },
      { value: 'payment', label: '付款条件', color: '#faad14', icon: 'pay-circle' },
      { value: 'liability', label: '责任条款', color: '#fa8c16', icon: 'warning' },
      { value: 'warranty', label: '质保条款', color: '#722ed1', icon: 'safety' },
      { value: 'termination', label: '终止条款', color: '#eb2f96', icon: 'stop' },
      { value: 'confidentiality', label: '保密条款', color: '#13c2c2', icon: 'lock' },
      { value: 'intellectual_property', label: '知识产权', color: '#2f54eb', icon: 'copyright' },
      { value: 'dispute_resolution', label: '争议解决', color: '#a0d911', icon: 'solution' },
    ],

    // AI自动标注
    autoDetect: true,
    aiConfidenceThreshold: 0.7, // 置信度阈值
  },

  // ============================================
  // AI 能力配置
  // ============================================
  aiCapabilities: [
    {
      id: 'detect_risk',
      name: '法律风险识别',
      description: '自动识别合同中的法律风险点和不利条款',
      enabled: true,
      trigger: 'auto', // 实时检测
      llmModel: 'deepseek',
      riskLevels: ['low', 'medium', 'high', 'critical'],
      riskCategories: [
        '权利义务不对等',
        '付款条件不明确',
        '违约责任不清晰',
        '争议解决条款缺失',
        '知识产权归属不明',
        '保密条款不完善',
        '终止条件不合理',
        '责任限制过度',
      ],
    },
    {
      id: 'extract_key_terms',
      name: '提取关键条款',
      description: '自动提取并结构化关键合同条款',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      extractFields: [
        'contractParties', 'contractAmount', 'paymentTerms',
        'deliveryDate', 'warrantyPeriod', 'liabilityLimit',
        'terminationConditions', 'disputeResolution',
      ],
    },
    {
      id: 'compare_templates',
      name: '对比标准模板',
      description: '将当前合同与标准模板对比，发现缺失条款',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
    {
      id: 'suggest_improvements',
      name: '条款优化建议',
      description: '基于法律法规和最佳实践，提供条款改进建议',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
    {
      id: 'check_compliance',
      name: '合规性检查',
      description: '检查合同是否符合相关法律法规要求',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      checkAreas: [
        '民法典合同编',
        '建筑法',
        '招投标法',
        '政府采购法',
        '税法相关规定',
      ],
    },
    {
      id: 'generate_checklist',
      name: '生成审查清单',
      description: '根据合同类型自动生成审查要点清单',
      enabled: true,
      trigger: 'manual',
      llmModel: 'qwen',
    },
  ],

  // ============================================
  // 修订追踪配置
  // ============================================
  revisionTracking: {
    enabled: true,
    defaultOn: true, // 合同默认开启修订追踪
    colorPool: [
      '#1890ff', '#52c41a', '#faad14', '#f5222d',
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
    ],
    autoAcceptAfterDays: null,

    // 重要：合同修订需要审批
    requireApprovalForAccept: true,
  },

  // ============================================
  // 审批工作流配置
  // ============================================
  approvalWorkflow: {
    enabled: true,
    mode: 'section',

    stages: [
      {
        id: 'business_review',
        name: '业务审核',
        description: '由项目负责人审核业务条款',
        required: true,
        roles: ['project_manager', 'business_lead'],
        dueDays: 2,
      },
      {
        id: 'legal_review',
        name: '法务审核',
        description: '由法务部门审核法律条款和风险',
        required: true,
        roles: ['legal_counsel', 'legal_manager'],
        dueDays: 3,
      },
      {
        id: 'financial_review',
        name: '财务审核',
        description: '由财务部门审核金额和付款条款',
        required: true,
        roles: ['financial_manager'],
        dueDays: 2,
      },
      {
        id: 'executive_approval',
        name: '领导审批',
        description: '由公司领导最终审批',
        required: true,
        roles: ['ceo', 'vice_president'],
        dueDays: 1,
      },
    ],

    issueTypes: [
      { value: 'legal_risk', label: '法律风险', severity: 'critical', color: '#f5222d' },
      { value: 'unfavorable_term', label: '不利条款', severity: 'high', color: '#fa8c16' },
      { value: 'ambiguous_clause', label: '表述模糊', severity: 'medium', color: '#faad14' },
      { value: 'missing_clause', label: '条款缺失', severity: 'high', color: '#ff7a45' },
      { value: 'formatting_issue', label: '格式问题', severity: 'low', color: '#1890ff' },
      { value: 'suggestion', label: '优化建议', severity: 'low', color: '#52c41a' },
    ],

    // 审批金额阈值
    approvalThresholds: [
      { maxAmount: 100000, stages: ['business_review', 'legal_review'] },
      { maxAmount: 500000, stages: ['business_review', 'legal_review', 'financial_review'] },
      { maxAmount: Infinity, stages: ['business_review', 'legal_review', 'financial_review', 'executive_approval'] },
    ],
  },

  // ============================================
  // 归档配置
  // ============================================
  archive: {
    enabled: true,
    requireApproval: true,

    autoMetadata: {
      category: 'contract',
      extractKeywords: true,
      generateSummary: true,
      tagContractType: true, // 标注合同类型
      tagParties: true, // 标注合同主体
      tagAmount: true, // 标注金额范围
      extractRisks: true, // 提取风险点
    },

    // 合同归档更严格的权限控制
    suggestedPermissionLevels: [
      'department', // 部门（法务部、合约部）
      'project', // 项目组
    ],

    // 归档前必须检查
    preArchiveChecks: [
      'all_sections_approved', // 所有章节已审批
      'no_pending_revisions', // 无待处理的修订
      'no_open_issues', // 无未解决的问题
      'risk_acknowledged', // 风险点已确认
    ],
  },

  // ============================================
  // 内容验证规则
  // ============================================
  validation: {
    requiredSections: true,

    contentLengthLimits: {
      minChars: 100,
      warnChars: 50000,
    },

    requiredFields: [
      'contractNumber',
      'contractTitle',
      'partyA',
      'partyB',
      'projectName',
      'contractAmount',
      'signingDate',
    ],

    // 合同特定验证规则
    contractSpecificRules: [
      {
        name: '金额格式',
        check: 'amount_format',
        message: '金额应包含大写和小写两种形式',
      },
      {
        name: '日期逻辑',
        check: 'date_logic',
        message: '生效日期应晚于签订日期，到期日期应晚于生效日期',
      },
      {
        name: '必要条款',
        check: 'required_clauses',
        requiredClauses: [
          '合同双方',
          '合同价款',
          '付款方式',
          '违约责任',
          '争议解决',
        ],
        message: '合同缺少必要条款',
      },
    ],

    // 风险检查
    riskChecks: [
      {
        name: '无期限合同',
        pattern: /未约定|不限期|永久|无限期/g,
        level: 'high',
        message: '合同未明确约定期限，存在法律风险',
      },
      {
        name: '单方有利',
        keywords: ['单方解释', '单方决定', '单方认定'],
        level: 'high',
        message: '条款单方有利，建议修改为双方协商',
      },
      {
        name: '责任不明',
        keywords: ['双方协商', '另行约定', '具体商定'],
        level: 'medium',
        message: '责任约定不明确，建议细化',
      },
    ],
  },

  // ============================================
  // 协作配置
  // ============================================
  collaboration: {
    realtime: {
      enabled: true,
      showCursors: true,
      showSelections: true,
      lockTimeout: 1800000,
    },

    comments: {
      enabled: true,
      allowThreads: true,
      allowAnchoring: true,
      notifyMentioned: true,

      // 合同评论需要标注类型
      requireCommentType: true,
      commentTypes: ['question', 'risk', 'suggestion', 'approval'],
    },

    // 合同会签
    countersignature: {
      enabled: true,
      requireAllParties: true, // 需要所有相关方签字
      trackSignatures: true, // 追踪签字状态
    },
  },

  // ============================================
  // 导出配置
  // ============================================
  export: {
    formats: ['docx', 'pdf'],

    docx: {
      template: 'contract_template.docx',
      includeTrackChanges: false, // 合同导出通常不含修订
      includeFieldAnnotations: true, // 包含字段标注
      includeRiskMarkers: true, // 包含风险标记
      includeSignaturePages: true, // 包含签字页
      includeCoverPage: true,
    },

    pdf: {
      watermark: true,
      includeMetadata: true,
      digitallySigned: true, // PDF数字签名
      lockEditing: true, // 锁定编辑
      pageNumbers: true,
      headerFooter: true,
    },

    // 合同特殊导出格式
    legalFormat: {
      enabled: true,
      includeLineNumbers: true, // 包含行号（便于引用）
      includeClauseNumbers: true, // 包含条款编号
      includeIndexPage: true, // 包含索引页
    },
  },

  // ============================================
  // 权限配置
  // ============================================
  permissions: {
    canCreate: ['project_manager', 'legal_counsel', 'contract_manager'],
    canEdit: ['project_manager', 'legal_counsel'],
    canReview: ['legal_counsel', 'legal_manager', 'financial_manager', 'ceo'],
    canRequestArchive: ['project_manager', 'legal_manager'],
    canDelete: ['legal_manager'], // 合同删除权限更严格
  },

  // ============================================
  // 合同类型配置
  // ============================================
  contractTypes: [
    { value: 'construction', label: '施工合同', template: 'construction_contract_template' },
    { value: 'design', label: '设计合同', template: 'design_contract_template' },
    { value: 'consulting', label: '咨询合同', template: 'consulting_contract_template' },
    { value: 'procurement', label: '采购合同', template: 'procurement_contract_template' },
    { value: 'service', label: '服务合同', template: 'service_contract_template' },
    { value: 'labor', label: '劳务合同', template: 'labor_contract_template' },
    { value: 'partnership', label: '合作协议', template: 'partnership_agreement_template' },
    { value: 'nda', label: '保密协议', template: 'nda_template' },
    { value: 'other', label: '其他', template: 'general_contract_template' },
  ],
};
