const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const { createError } = require('../../utils/error')

/**
 * RAGFlow服务封装
 * 将RAGFlow的API封装成内部服务，并加入权限控制
 */
class RagFlowService {
  constructor() {
    this.baseURL = process.env.RAGFLOW_BASE_URL || 'http://localhost:9380'
    this.apiKey = process.env.RAGFLOW_API_KEY || ''
    
    // 创建axios实例
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 30000
    })
    
    // 请求拦截器
    this.client.interceptors.request.use(
      config => {
        console.log(`[RAGFlow] ${config.method.toUpperCase()} ${config.url}`)
        return config
      },
      error => {
        console.error('[RAGFlow] Request error:', error)
        return Promise.reject(error)
      }
    )
    
    // 响应拦截器
    this.client.interceptors.response.use(
      response => {
        return response.data
      },
      error => {
        console.error('[RAGFlow] Response error:', error.response?.data || error.message)
        throw createError(
          error.response?.status || 500,
          error.response?.data?.message || 'RAGFlow服务错误'
        )
      }
    )
  }
  
  /**
   * 创建知识库
   * @param {Object} user 当前用户
   * @param {Object} data 知识库数据
   */
  async createKnowledgeBase(user, data) {
    const payload = {
      name: data.name,
      description: data.description,
      permission: data.permissionLevel || 'personal',
      language: data.language || 'Chinese',
      embedding_model: data.embeddingModel || 'BAAI/bge-large-zh-v1.5',
      chunk_method: data.chunkMethod || 'manual',
      parser_config: {
        chunk_token_count: data.chunkTokenCount || 128,
        chunk_overlap_count: data.chunkOverlapCount || 16,
        ...data.parserConfig
      }
    }
    
    // 添加元数据用于权限控制
    payload.metadata = {
      owner_id: user.id,
      organization_id: user.organization_id,
      department_id: user.department_id,
      project_id: data.projectId,
      permission_level: data.permissionLevel,
      created_by: user.id
    }
    
    const response = await this.client.post('/api/v1/kb/create', payload)
    return response.data
  }
  
  /**
   * 获取知识库列表
   * @param {Object} user 当前用户
   * @param {Object} filters 过滤条件
   */
  async getKnowledgeBases(user, filters = {}) {
    const response = await this.client.get('/api/v1/kb/list', {
      params: {
        page: filters.page || 1,
        page_size: filters.pageSize || 20,
        order_by: filters.orderBy || 'create_time',
        order: filters.order || 'desc'
      }
    })
    
    // 根据用户权限过滤知识库
    const knowledgeBases = response.data?.kbs || []
    return this._filterByPermission(user, knowledgeBases)
  }
  
  /**
   * 上传文档到知识库
   * @param {Object} user 当前用户
   * @param {string} kbId 知识库ID
   * @param {Object} file 文件对象
   * @param {Object} options 选项
   */
  async uploadDocument(user, kbId, file, options = {}) {
    // 检查知识库访问权限
    const kb = await this.getKnowledgeBase(user, kbId)
    if (!kb) {
      throw createError(403, '无权限访问该知识库')
    }
    
    const formData = new FormData()
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype
    })
    formData.append('kb_id', kbId)
    
    // 添加文档元数据
    const metadata = {
      owner_id: user.id,
      uploaded_by: user.id,
      category_id: options.categoryId,
      tags: options.tags || [],
      permission_level: options.permissionLevel || kb.metadata.permission_level
    }
    formData.append('metadata', JSON.stringify(metadata))
    
    const response = await this.client.post('/api/v1/document/upload', formData, {
      headers: formData.getHeaders()
    })
    
    return response.data
  }
  
  /**
   * 创建对话助手
   * @param {Object} user 当前用户
   * @param {Object} data 助手配置
   */
  async createAssistant(user, data) {
    const payload = {
      name: data.name,
      description: data.description,
      icon: data.icon,
      prompt_config: {
        system: data.systemPrompt,
        prologue: data.prologue || '您好，我是AI助手，有什么可以帮助您的吗？'
      },
      llm_id: data.llmId,
      kb_ids: data.kbIds || [],
      top_n: data.topN || 6,
      top_k: data.topK || 1024,
      similarity_threshold: data.similarityThreshold || 0.2,
      metadata: {
        owner_id: user.id,
        organization_id: user.organization_id,
        department_id: user.department_id,
        project_id: data.projectId,
        permission_level: data.permissionLevel || 'personal'
      }
    }
    
    const response = await this.client.post('/api/v1/dialog/set', payload)
    return response.data
  }
  
  /**
   * 对话问答
   * @param {Object} user 当前用户
   * @param {string} assistantId 助手ID
   * @param {string} message 用户消息
   * @param {string} conversationId 会话ID
   */
  async chat(user, assistantId, message, conversationId) {
    // 检查助手访问权限
    const assistant = await this.getAssistant(user, assistantId)
    if (!assistant) {
      throw createError(403, '无权限访问该助手')
    }
    
    const payload = {
      messages: [{
        role: 'user',
        content: message
      }],
      conversation_id: conversationId,
      stream: false
    }
    
    const response = await this.client.post(`/api/v1/dialog/${assistantId}/chat`, payload)
    return response.data
  }
  
  /**
   * 流式对话问答
   * @param {Object} user 当前用户
   * @param {string} assistantId 助手ID
   * @param {string} message 用户消息
   * @param {string} conversationId 会话ID
   * @param {Function} onChunk 处理流式数据的回调
   */
  async chatStream(user, assistantId, message, conversationId, onChunk) {
    // 检查助手访问权限
    const assistant = await this.getAssistant(user, assistantId)
    if (!assistant) {
      throw createError(403, '无权限访问该助手')
    }
    
    const payload = {
      messages: [{
        role: 'user',
        content: message
      }],
      conversation_id: conversationId,
      stream: true
    }
    
    const response = await this.client.post(`/api/v1/dialog/${assistantId}/chat`, payload, {
      responseType: 'stream'
    })
    
    // 处理流式响应
    response.data.on('data', chunk => {
      const lines = chunk.toString().split('\n').filter(line => line.trim())
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onChunk(null, true)
          } else {
            try {
              const parsed = JSON.parse(data)
              onChunk(parsed, false)
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
    })
    
    response.data.on('end', () => {
      onChunk(null, true)
    })
    
    response.data.on('error', error => {
      onChunk({ error: error.message }, true)
    })
  }
  
  /**
   * 获取单个知识库信息
   * @param {Object} user 当前用户
   * @param {string} kbId 知识库ID
   */
  async getKnowledgeBase(user, kbId) {
    try {
      const response = await this.client.get(`/api/v1/kb/${kbId}`)
      const kb = response.data
      
      // 检查权限
      if (!this._checkPermission(user, kb)) {
        return null
      }
      
      return kb
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }
  
  /**
   * 获取单个助手信息
   * @param {Object} user 当前用户
   * @param {string} assistantId 助手ID
   */
  async getAssistant(user, assistantId) {
    try {
      const response = await this.client.get(`/api/v1/dialog/${assistantId}`)
      const assistant = response.data
      
      // 检查权限
      if (!this._checkPermission(user, assistant)) {
        return null
      }
      
      return assistant
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }
  
  /**
   * 根据权限过滤资源列表
   * @private
   */
  _filterByPermission(user, resources) {
    return resources.filter(resource => this._checkPermission(user, resource))
  }
  
  /**
   * 检查用户对资源的访问权限
   * @private
   */
  _checkPermission(user, resource) {
    const metadata = resource.metadata || {}
    const permissionLevel = metadata.permission_level || 'personal'
    
    switch (permissionLevel) {
      case 'personal':
        return metadata.owner_id === user.id
        
      case 'project':
        return user.projectIds?.includes(metadata.project_id)
        
      case 'department':
        return user.department_id === metadata.department_id
        
      case 'organization':
        return user.organization_id === metadata.organization_id
        
      default:
        return false
    }
  }
}

module.exports = new RagFlowService()