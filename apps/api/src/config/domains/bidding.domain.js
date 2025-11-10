/**
 * 招投标文档领域配置
 * 支持自由编辑结构，多文件组合
 */

module.exports = {
  documentType: 'bidding',
  displayName: '招投标文档',
  icon: 'file-search',

  // ============================================
  // 章节编辑策略：自由结构
  // ============================================
  sectionPolicy: {
    mode: 'free',
    allowAdd: true, // 完全自由
    allowDelete: true,
    allowReorder: true,
    allowRename: true,
    allowEditContent: true,
    allowNesting: true, // 允许多级嵌套
    maxNestingLevel: 5, // 最多5级
    requireSectionCode: false,

    // 推荐的章节模板（不强制）
    suggestedTemplates: [
      {
        name: '投标文件',
        sections: [
          { title: '投标函及投标函附录', order: 1 },
          { title: '法定代表人身份证明', order: 2 },
          { title: '授权委托书', order: 3 },
          { title: '投标保证金', order: 4 },
          { title: '已标价工程量清单', order: 5 },
          { title: '施工组织设计', order: 6 },
          { title: '项目管理机构', order: 7 },
          { title: '资格审查资料', order: 8 },
          { title: '其他材料', order: 9 },
        ],
      },
      {
        name: '招标文件',
        sections: [
          { title: '招标公告', order: 1 },
          { title: '投标人须知', order: 2 },
          { title: '评标办法', order: 3 },
          { title: '合同条款及格式', order: 4 },
          { title: '工程量清单', order: 5 },
          { title: '图纸', order: 6 },
          { title: '技术标准和要求', order: 7 },
          { title: '投标文件格式', order: 8 },
        ],
      },
      {
        name: '技术标',
        sections: [
          { title: '施工组织总体设想', order: 1 },
          { title: '施工进度计划', order: 2 },
          { title: '施工方案与技术措施', order: 3 },
          { title: '质量管理体系', order: 4 },
          { title: '安全管理体系', order: 5 },
          { title: '环保措施', order: 6 },
          { title: '文明施工措施', order: 7 },
        ],
      },
      {
        name: '商务标',
        sections: [
          { title: '投标报价', order: 1 },
          { title: '工程量清单报价', order: 2 },
          { title: '主要材料价格表', order: 3 },
          { title: '资金使用计划', order: 4 },
        ],
      },
    ],
  },

  // ============================================
  // 模板相关配置
  // ============================================
  template: {
    parsing: {
      method: 'ai',
      supportedFormats: ['docx', 'pdf', 'zip'], // 支持压缩包
      extractSectionCode: false,
      extractMetadata: true,
      parseTableOfContents: true,
      extractTables: true, // 提取表格（报价单等）
      extractImages: true, // 提取图纸
      handleMultipleFiles: true, // 处理多文件
    },

    variables: [
      { key: 'projectName', label: '项目名称', type: 'text', required: true },
      { key: 'projectCode', label: '项目编号', type: 'text', required: true },
      { key: 'tenderee', label: '招标人', type: 'text', required: true },
      { key: 'bidder', label: '投标人', type: 'text', required: false },
      { key: 'projectLocation', label: '工程地点', type: 'text', required: false },
      { key: 'projectScale', label: '工程规模', type: 'text', required: false },
      { key: 'biddingMode', label: '招标方式', type: 'select', options: ['公开招标', '邀请招标', '竞争性谈判', '询价'], required: true },
      { key: 'estimatedAmount', label: '招标控制价', type: 'number', required: false },
      { key: 'bidValidityPeriod', label: '投标有效期', type: 'number', unit: '天', required: false },
      { key: 'bidOpeningDate', label: '开标日期', type: 'date', required: false },
      { key: 'bidOpeningLocation', label: '开标地点', type: 'text', required: false },
      { key: 'contactPerson', label: '联系人', type: 'text', required: false },
      { key: 'contactPhone', label: '联系电话', type: 'text', required: false },
    ],

    maintainPermission: 'department', // 经营部门维护
  },

  // ============================================
  // 内容编辑器配置
  // ============================================
  editor: {
    type: 'richtext',
    toolbar: [
      'bold', 'italic', 'underline', 'strikethrough',
      'heading', 'fontSize', 'fontColor', 'backgroundColor',
      'bulletList', 'orderedList', 'indent', 'outdent',
      'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
      'insertTable', 'insertImage', 'insertLink', 'insertFile',
      'pageBreak', // 招标文件常需要分页
      'undo', 'redo', 'clear',
    ],

    paste: {
      allowImages: true,
      allowTables: true,
      allowFiles: true, // 允许插入附件
      cleanFormatting: false,
    },

    autoSave: {
      enabled: true,
      interval: 30000,
    },

    // 特殊：支持表格计算
    tableFeatures: {
      allowFormulas: true, // 允许公式（报价单）
      autoSum: true, // 自动求和
      numberFormat: true, // 数字格式化
    },
  },

  // ============================================
  // 多文件管理
  // ============================================
  multiFileSupport: {
    enabled: true,

    // 文件分组
    fileGroups: [
      { id: 'main', name: '主文件', required: true, maxFiles: 1 },
      { id: 'attachments', name: '附件', required: false, maxFiles: 50 },
      { id: 'drawings', name: '图纸', required: false, maxFiles: 100 },
      { id: 'qualifications', name: '资质文件', required: false, maxFiles: 20 },
    ],

    // 文件类型限制
    allowedFileTypes: [
      'docx', 'doc', 'pdf', 'xlsx', 'xls',
      'jpg', 'jpeg', 'png',
      'dwg', 'dxf', // CAD图纸
      'rar', 'zip', '7z',
    ],

    // 文件大小限制
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxTotalSize: 500 * 1024 * 1024, // 500MB
  },

  // ============================================
  // AI 能力配置
  // ============================================
  aiCapabilities: [
    {
      id: 'generate_bidding_doc',
      name: '生成投标文档',
      description: '基于招标文件和项目信息，生成完整的投标文档',
      enabled: true,
      trigger: 'manual',
      llmModel: 'qwen',
      requireInputs: ['招标文件', '项目基本信息', '公司资质'],
    },
    {
      id: 'extract_requirements',
      name: '提取招标要求',
      description: '从招标文件中提取关键要求和评分标准',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      extractCategories: [
        '资格要求',
        '技术要求',
        '商务要求',
        '评分标准',
        '重要时间节点',
        '提交要求',
      ],
    },
    {
      id: 'check_completeness',
      name: '完整性检查',
      description: '对照招标文件要求，检查投标文件是否完整',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      checkItems: [
        '必要文件是否齐全',
        '格式是否符合要求',
        '签字盖章是否完整',
        '响应条款是否遗漏',
      ],
    },
    {
      id: 'optimize_tech_proposal',
      name: '优化技术方案',
      description: '优化施工组织设计、技术方案的描述',
      enabled: true,
      trigger: 'manual',
      llmModel: 'qwen',
    },
    {
      id: 'generate_pricing',
      name: '生成报价建议',
      description: '基于历史数据和市场信息，生成报价建议',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      requireInputs: ['工程量清单', '历史报价数据', '市场价格信息'],
    },
    {
      id: 'compare_bids',
      name: '标书对比分析',
      description: '对比多个投标方案，分析优劣势',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
    },
    {
      id: 'risk_assessment',
      name: '投标风险评估',
      description: '评估投标项目的风险点',
      enabled: true,
      trigger: 'manual',
      llmModel: 'deepseek',
      riskAreas: [
        '技术风险',
        '工期风险',
        '成本风险',
        '合规风险',
        '竞争风险',
      ],
    },
    {
      id: 'generate_qa',
      name: '生成质疑澄清',
      description: '针对招标文件中的问题，生成质疑澄清函',
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
    defaultOn: false, // 默认关闭，按需开启
    colorPool: [
      '#1890ff', '#52c41a', '#faad14', '#f5222d',
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
    ],
    autoAcceptAfterDays: null,
  },

  // ============================================
  // 审批工作流配置
  // ============================================
  approvalWorkflow: {
    enabled: true,
    mode: 'document', // 整体文档审批（不是章节级）

    stages: [
      {
        id: 'tech_review',
        name: '技术审核',
        description: '由技术负责人审核技术方案',
        required: true,
        roles: ['tech_lead', 'chief_engineer'],
        dueDays: 2,
      },
      {
        id: 'commercial_review',
        name: '商务审核',
        description: '由经营部门审核商务条款和报价',
        required: true,
        roles: ['commercial_manager', 'cost_engineer'],
        dueDays: 1,
      },
      {
        id: 'legal_review',
        name: '法务审核',
        description: '由法务审核合规性',
        required: false, // 可选
        roles: ['legal_counsel'],
        dueDays: 1,
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
      { value: 'tech_issue', label: '技术问题', severity: 'high', color: '#f5222d' },
      { value: 'price_issue', label: '报价问题', severity: 'high', color: '#fa8c16' },
      { value: 'missing_doc', label: '文件缺失', severity: 'high', color: '#ff7a45' },
      { value: 'format_issue', label: '格式问题', severity: 'medium', color: '#faad14' },
      { value: 'incomplete', label: '内容不完整', severity: 'medium', color: '#ffa940' },
      { value: 'suggestion', label: '优化建议', severity: 'low', color: '#52c41a' },
    ],

    // 投标金额阈值
    approvalThresholds: [
      { maxAmount: 1000000, stages: ['tech_review', 'commercial_review'] },
      { maxAmount: 5000000, stages: ['tech_review', 'commercial_review', 'executive_approval'] },
      { maxAmount: Infinity, stages: ['tech_review', 'commercial_review', 'legal_review', 'executive_approval'] },
    ],
  },

  // ============================================
  // 归档配置
  // ============================================
  archive: {
    enabled: true,
    requireApproval: true,

    autoMetadata: {
      category: 'bidding',
      extractKeywords: true,
      generateSummary: true,
      tagBiddingType: true, // 标注招投标类型
      tagProjectType: true, // 标注项目类型
      tagResult: true, // 标注中标结果
      extractPricing: true, // 提取报价信息
    },

    suggestedPermissionLevels: [
      'department', // 经营部门
      'branch', // 分院
      'enterprise', // 全企业（中标的重要项目）
    ],

    // 归档时记录投标结果
    recordBiddingResult: {
      enabled: true,
      fields: [
        'bidResult', // 中标/未中标
        'winningPrice', // 中标价
        'winningCompany', // 中标单位
        'bidRanking', // 投标排名
        'lossReason', // 未中标原因
      ],
    },
  },

  // ============================================
  // 内容验证规则
  // ============================================
  validation: {
    requiredSections: false, // 不强制章节

    contentLengthLimits: {
      minChars: 200,
      warnChars: 100000,
    },

    requiredFields: [
      'projectName',
      'projectCode',
      'tenderee',
      'biddingMode',
    ],

    // 招投标特定检查
    biddingSpecificRules: [
      {
        name: '文件完整性',
        check: 'file_completeness',
        message: '请检查所有必须提交的文件是否齐全',
      },
      {
        name: '签字盖章',
        check: 'signature_seal',
        message: '请确保所有需要签字盖章的地方已完成',
      },
      {
        name: '投标有效期',
        check: 'bid_validity',
        message: '投标有效期应满足招标文件要求',
      },
      {
        name: '报价格式',
        check: 'price_format',
        message: '报价应包含大写金额，并符合格式要求',
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
    },

    // 多人协作编制
    teamCollaboration: {
      enabled: true,
      allowRoleAssignment: true, // 分配角色任务
      roles: [
        { id: 'tech_writer', name: '技术编制', sections: ['施工组织设计', '技术方案'] },
        { id: 'commercial_writer', name: '商务编制', sections: ['报价', '工程量清单'] },
        { id: 'coordinator', name: '总协调', sections: ['all'] },
      ],
    },
  },

  // ============================================
  // 导出配置
  // ============================================
  export: {
    formats: ['docx', 'pdf', 'zip'],

    docx: {
      template: 'bidding_template.docx',
      includeTrackChanges: false,
      includeCoverPage: true,
      includeTableOfContents: true,
      includeSectionBreaks: true,
    },

    pdf: {
      watermark: false, // 投标文件通常不加水印
      includeMetadata: false, // 不暴露内部信息
      pageNumbers: true,
      headerFooter: true,
      lockEditing: true, // 锁定编辑
    },

    // 打包导出
    zip: {
      enabled: true,
      structure: 'grouped', // grouped | flat
      includeChecklist: true, // 包含清单
      includeCoverLetter: true, // 包含投标函
      fileNaming: {
        pattern: '{projectCode}_{documentType}_{version}_{fileName}',
        sanitize: true, // 清理文件名特殊字符
      },
    },
  },

  // ============================================
  // 权限配置
  // ============================================
  permissions: {
    canCreate: ['commercial_manager', 'project_manager', 'bidding_specialist'],
    canEdit: ['commercial_manager', 'bidding_specialist', 'tech_lead'],
    canReview: ['commercial_manager', 'tech_lead', 'chief_engineer', 'ceo'],
    canRequestArchive: ['commercial_manager', 'project_manager'],
    canDelete: ['commercial_manager'],
  },

  // ============================================
  // 招投标类型配置
  // ============================================
  biddingTypes: [
    { value: 'construction_bid', label: '施工投标', icon: 'build' },
    { value: 'design_bid', label: '设计投标', icon: 'design' },
    { value: 'epc_bid', label: 'EPC总承包投标', icon: 'global' },
    { value: 'consulting_bid', label: '咨询服务投标', icon: 'solution' },
    { value: 'equipment_bid', label: '设备采购投标', icon: 'tool' },
    { value: 'tender_doc', label: '招标文件', icon: 'file-done' },
  ],

  // ============================================
  // 评分标准模板
  // ============================================
  scoringTemplates: [
    {
      name: '综合评分法',
      weights: {
        technical: 0.6, // 技术标 60%
        commercial: 0.3, // 商务标 30%
        reputation: 0.1, // 信誉标 10%
      },
    },
    {
      name: '最低价中标',
      weights: {
        technical: 0, // 满足要求即可
        commercial: 1.0, // 价格 100%
        reputation: 0,
      },
    },
    {
      name: '技术优先',
      weights: {
        technical: 0.7,
        commercial: 0.2,
        reputation: 0.1,
      },
    },
  ],
};
