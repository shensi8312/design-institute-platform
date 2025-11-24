/**
 * 语义层核心数据类型
 */

/**
 * 领域枚举
 */
const SemanticDomain = {
  CONTRACT: 'contract',     // 合同
  SPEC: 'spec',            // 规范
  RULE: 'rule',            // 规则
  KNOWLEDGE: 'knowledge',   // 知识库
  GRAPH: 'graph',          // 知识图谱
  PID: 'pid',              // PID图纸
  BOM: 'bom'               // BOM清单
}

/**
 * 类型枚举
 */
const SemanticType = {
  // 合同
  CLAUSE: 'clause',         // 条款
  TERM: 'term',            // 术语

  // 规范
  SECTION: 'section',      // 章节
  REQUIREMENT: 'requirement', // 要求

  // 规则
  RULE: 'rule',            // 规则

  // 知识库
  CHUNK: 'chunk',          // 文本块
  QA: 'qa',                // 问答对

  // 图谱
  NODE: 'node',            // 节点
  RELATION: 'relation',    // 关系

  // PID
  COMPONENT: 'component',   // 部件
  CONNECTION: 'connection', // 连接

  // BOM
  PART: 'part'             // 零件
}

/**
 * 语义块数据类
 */
class SemanticChunk {
  constructor({
    id,
    domain,
    type,
    text,
    metadata = {},
    embedding = null,
    tenantId = null,
    projectId = null,
    embeddingModel = null,
    embeddingVersion = null,
    isActive = true
  }) {
    this.id = id
    this.domain = domain
    this.type = type
    this.text = text
    this.metadata = metadata
    this.embedding = embedding
    this.tenantId = tenantId
    this.projectId = projectId
    this.embeddingModel = embeddingModel
    this.embeddingVersion = embeddingVersion
    this.isActive = isActive
  }

  /**
   * 验证数据合法性
   */
  validate() {
    if (!this.id) throw new Error('id is required')
    if (!this.domain) throw new Error('domain is required')
    if (!this.type) throw new Error('type is required')
    if (!this.text) throw new Error('text is required')

    if (!Object.values(SemanticDomain).includes(this.domain)) {
      throw new Error(`Invalid domain: ${this.domain}`)
    }

    if (!Object.values(SemanticType).includes(this.type)) {
      throw new Error(`Invalid type: ${this.type}`)
    }

    return true
  }

  /**
   * 转为数据库记录
   */
  toDBRecord() {
    return {
      id: this.id,
      domain: this.domain,
      type: this.type,
      text: this.text,
      metadata: JSON.stringify(this.metadata),
      tenant_id: this.tenantId,
      project_id: this.projectId,
      embedding_model: this.embeddingModel,
      embedding_version: this.embeddingVersion,
      is_active: this.isActive
    }
  }

  /**
   * 从数据库记录创建
   */
  static fromDBRecord(record) {
    return new SemanticChunk({
      id: record.id,
      domain: record.domain,
      type: record.type,
      text: record.text,
      metadata: typeof record.metadata === 'string'
        ? JSON.parse(record.metadata)
        : record.metadata,
      tenantId: record.tenant_id,
      projectId: record.project_id,
      embeddingModel: record.embedding_model,
      embeddingVersion: record.embedding_version,
      isActive: record.is_active !== false
    })
  }
}

module.exports = {
  SemanticChunk,
  SemanticDomain,
  SemanticType
}
