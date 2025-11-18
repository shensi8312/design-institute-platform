require('dotenv').config()

/**
 * 环境变量检查 - 在启动时验证必需的配置
 */
function validateEnvironment() {
  const provider = process.env.LLM_PROVIDER || 'vllm'

  // 根据provider检查对应的环境变量
  const requiredVars = {
    vllm: ['VLLM_URL', 'VLLM_MODEL'],
    ollama: ['OLLAMA_URL', 'OLLAMA_MODEL'],
    qwenVL: ['QWENVL_URL', 'QWENVL_MODEL']
  }

  const required = requiredVars[provider] || []
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error('❌ 环境变量检查失败!')
    console.error(`❌ 当前LLM Provider: ${provider}`)
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`)
    console.error('💡 请检查 .env 文件，确保配置了正确的值')
    process.exit(1)
  }

  console.log('✅ 环境变量检查通过')
  console.log(`✅ LLM Provider: ${provider}`)
}

// 在加载其他模块前先检查环境变量
validateEnvironment()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const path = require('path')

// 导入中间件
const { errorHandler, notFound } = require('./utils/error')

// 导入路由
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const departmentRoutes = require('./routes/departments')
const roleRoutes = require('./routes/roles')
const organizationRoutes = require('./routes/organizations')
const permissionRoutes = require('./routes/permissions')
const projectRoutes = require('./routes/projects')
const knowledgeRoutes = require('./routes/knowledge')
const graphRoutes = require('./routes/graph')
const learningRoutes = require('./routes/learning')
const systemRoutes = require('./routes/system')
const menuRoutes = require('./routes/menus')
const annotationRoutes = require('./routes/annotations')
const logRoutes = require('./routes/logs')
const workflowRoutes = require('./routes/workflow')
const engineRoutes = require('./routes/engines')
const workflowTemplateRoutes = require('./routes/workflowTemplate')
const aiPluginRoutes = require('./routes/ai-plugin')  // AI插件统一接口
const cvVlFusionRoutes = require('./routes/cv-vl-fusion')  // CV+VL混合服务
const digitalSiteRoutes = require('./routes/digitalSite')
const rulesRoutes = require('./routes/rules')  // 规则引擎（旧版）
const unifiedRulesRoutes = require('./routes/unifiedRules')  // 统一规则系统
const assemblyRoutes = require('./routes/assembly')  // 装配约束推理引擎
const buildingLayoutRoutes = require('./routes/building-layout')  // 建筑强排系统
const chatHistoryRoutes = require('./routes/chatHistory')  // 聊天历史
const extractionRoutes = require('./routes/extraction')  // 动态提取系统
const pidRoutes = require('./routes/pid')  // PID识别
// const templatesRoutes = require('./routes/templates')  // 模板管理
const unifiedDocumentRoutes = require('./routes/unifiedDocument')  // 统一文档系统
const drawingComparisonRoutes = require('./routes/drawingComparison')  // 图纸比对
const onlyofficeRoutes = require('./routes/onlyoffice')  // OnlyOffice在线编辑器
const aiReviewRoutes = require('./routes/aiReview')  // V3.0 AI审查
const { initDigitalSiteWebSocket } = require('./services/system/DigitalSiteWebSocket')
const digitalSiteIngestor = require('./services/system/DigitalSiteIngestor')

// 导入并初始化模板管理器
const TemplateManager = require('./services/document/TemplateManager')

const app = express()

// CORS配置 - 从环境变量读取
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:8000', 'http://localhost:5173'];

console.log('🔐 CORS允许的源:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // 允许没有origin的请求（Postman、本地文件、SSE）
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS拒绝来自: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}))

// 基础中间件 - OnlyOffice需要宽松的安全策略
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" }
})) // 安全头设置
app.use(compression()) // 响应压缩

// 请求日志
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// 请求解析 - 从环境变量读取文件大小限制
const maxBodySize = process.env.MAX_FILE_SIZE ? `${Math.ceil(parseInt(process.env.MAX_FILE_SIZE) / 1024 / 1024)}mb` : '500mb'
console.log(`📦 Body解析限制: ${maxBodySize}`)
app.use(express.json({ limit: maxBodySize }))
app.use(express.urlencoded({ extended: true, limit: maxBodySize }))

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use('/stl', express.static(path.join(__dirname, '../uploads/3d-models')))
app.use('/exports', express.static(path.join(__dirname, '../exports')))
app.use('/assembly-output', express.static(path.join(__dirname, '../uploads/assembly_output')))
// STEP文件服务（用于OCCT.js直接加载）
app.use('/step', express.static(path.join(__dirname, '../../docs/solidworks')))
// 3D装配查看器（提供web/public下的静态文件）
app.use(express.static(path.join(__dirname, '../../web/public')))

// API路由前缀
const API_PREFIX = process.env.API_PREFIX || '/api'

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })
})

// API路由
app.use(`${API_PREFIX}/auth`, authRoutes)
app.use(`${API_PREFIX}/users`, userRoutes)
app.use(`${API_PREFIX}/departments`, departmentRoutes)
app.use(`${API_PREFIX}/roles`, roleRoutes)
app.use(`${API_PREFIX}/organizations`, organizationRoutes)
app.use(`${API_PREFIX}/permissions`, permissionRoutes)
app.use(`${API_PREFIX}/projects`, projectRoutes)
app.use(`${API_PREFIX}/digital-site`, digitalSiteRoutes)
app.use(`${API_PREFIX}/knowledge`, knowledgeRoutes)
app.use(`${API_PREFIX}/chat/history`, chatHistoryRoutes)  // 聊天历史管理
app.use(`${API_PREFIX}/extraction`, extractionRoutes)  // 动态提取系统
// app.use(`${API_PREFIX}/templates`, templatesRoutes)  // 模板管理
app.use(`${API_PREFIX}/graph`, graphRoutes)
app.use(`${API_PREFIX}/graphs`, graphRoutes)  // 添加复数形式路由
app.use(`${API_PREFIX}/workflow`, workflowRoutes)
app.use(`${API_PREFIX}/workflows`, workflowRoutes)  // 添加复数形式路由
app.use(`${API_PREFIX}/engines`, engineRoutes)
app.use(`${API_PREFIX}/workflow-template`, workflowTemplateRoutes)
app.use(`${API_PREFIX}/cv-vl-fusion`, cvVlFusionRoutes)
app.use(`${API_PREFIX}/rules`, unifiedRulesRoutes)  // 统一规则系统（新版）
app.use(`${API_PREFIX}/rules-legacy`, rulesRoutes)  // 旧版规则引擎（向后兼容）
app.use(`${API_PREFIX}/assembly`, assemblyRoutes)  // 装配约束推理引擎
app.use(`${API_PREFIX}/building-layout`, buildingLayoutRoutes)  // 建筑强排系统
app.use(`${API_PREFIX}/pid`, pidRoutes)  // PID识别
app.use(`${API_PREFIX}/unified-document`, unifiedDocumentRoutes)  // 统一文档系统
app.use(`${API_PREFIX}/drawing-comparison`, drawingComparisonRoutes)  // 图纸比对
app.use(`${API_PREFIX}/onlyoffice`, onlyofficeRoutes)  // OnlyOffice在线编辑器
app.use(`${API_PREFIX}/ai-review`, aiReviewRoutes)  // V3.0 AI审查

// 节点管理（统一的节点系统）
const nodesRouter = require('./routes/nodes')
app.use(`${API_PREFIX}/nodes`, nodesRouter)

// 智能聊天路由（集成GraphRAG）
const intelligentChatRoutes = require('./routes/intelligentChat')
app.use(`${API_PREFIX}/intelligent-chat`, intelligentChatRoutes)

// 服务健康检查和诊断路由
const serviceHealthRoutes = require('./routes/serviceHealth')
app.use(`${API_PREFIX}/service-health`, serviceHealthRoutes)

// 空间引擎路由
const spatialRoutes = require('./routes/spatial')
app.use(`${API_PREFIX}/spatial`, spatialRoutes)

// AI审核路由
const auditRoutes = require('./routes/audit')
app.use(`${API_PREFIX}/audit`, auditRoutes)

// RAG路由
const ragRoutes = require('./routes/rag')
app.use(`${API_PREFIX}/rag`, ragRoutes)

// 视觉识别路由（草图转3D）
const visionRoutes = require('./routes/vision')
app.use(`${API_PREFIX}/vision`, visionRoutes)

// AI插件统一接口（插件的唯一入口）
app.use(`${API_PREFIX}/ai-plugin`, aiPluginRoutes)

// AI建模路由（支持草图转3D）
const aiModelingRoutes = require('./routes/ai-modeling')
app.use(`${API_PREFIX}/ai-modeling`, aiModelingRoutes)

// 引擎管理路由已在上面注册，移除重复的

app.use(`${API_PREFIX}/learning`, learningRoutes)
app.use(`${API_PREFIX}/system`, systemRoutes)
app.use(`${API_PREFIX}/menus`, menuRoutes)
app.use(`${API_PREFIX}/annotations`, annotationRoutes)
app.use(`${API_PREFIX}/logs`, logRoutes)

// 健康检查路由
const healthRoutes = require('./routes/health')
app.use(`${API_PREFIX}/health`, healthRoutes)

// STEP文件加载路由（服务端解析）
const stepLoaderRoutes = require('./routes/stepLoader')
app.use(`${API_PREFIX}/step-loader`, stepLoaderRoutes)

// 404处理
app.use(notFound)

// 错误处理中间件
app.use(errorHandler)

// 初始化引擎系统
const { getEngineCore } = require('./core/EngineCore')
const { getWorkflowOrchestrator } = require('./core/WorkflowOrchestrator')
const { registerRulesEngine } = require('./engines/RulesEngineAdapter')
const { registerSimpleTarotEngine } = require('./engines/SimpleTarotEngine')

async function initializeEngineSystem() {
  try {
    console.log('🔧 正在初始化引擎系统...')
    
    // 初始化核心系统
    const engineCore = getEngineCore()
    await engineCore.initialize()

    await registerRulesEngine(engineCore)
    await registerSimpleTarotEngine(engineCore)
    
    // 初始化工作流编排器
    const orchestrator = getWorkflowOrchestrator()
    await orchestrator.initialize()
    
    // 从数据库加载已激活的引擎
    // 引擎已经在 engineCore.initialize() 中从数据库加载了
    
    // 获取统计信息
    const stats = await engineCore.getStatistics()
    console.log(`📊 引擎系统就绪: ${stats.engines.total} 个引擎已加载`)
    
    // 如果没有引擎，提示用户可以通过API或界面添加
    if (stats.engines.total === 0) {
      console.log('💡 提示: 当前没有激活的引擎')
      console.log('   可以通过以下方式添加引擎:')
      console.log('   1. POST /api/engines/generate - 从文档生成引擎')
      console.log('   2. POST /api/engines/register - 注册自定义引擎')
      console.log('   3. GET /api/engines/marketplace - 从市场下载引擎')
    }
    
  } catch (error) {
    console.error('❌ 引擎系统初始化失败:', error)
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000
const HOST = '0.0.0.0'  // 监听所有网络接口，允许远程访问
const server = app.listen(PORT, HOST, async () => {
  console.log(`🚀 服务器启动成功`)
  console.log(`📍 本地地址: http://localhost:${PORT}`)
  console.log(`📍 网络地址: http://10.10.6.95:${PORT}`)
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`)

  // 显示当前LLM配置
  const { LLMConfig } = require('./config/llm.config')
  const currentConfig = LLMConfig.getCurrent()
  console.log(`🤖 LLM服务: ${LLMConfig.provider.toUpperCase()} - ${currentConfig.baseUrl}`)
  console.log(`📝 LLM模型: ${currentConfig.model}`)

  // 初始化引擎系统
  await initializeEngineSystem()

  // 初始化模板管理器
  await TemplateManager.init()

  console.log(`📡 API前缀: ${API_PREFIX}`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws/document-process`)
  console.log(`🔌 协作WebSocket: ws://localhost:${PORT}/ws/document-collab`)
})

// 初始化WebSocket服务（文档处理进度推送）
const DocumentProcessWebSocket = require('./services/document/documentProcessWebSocket')
new DocumentProcessWebSocket(server)
console.log('✅ 文档处理 WebSocket 已启动')

// 初始化文档协作WebSocket服务
const DocumentCollaborationWebSocket = require('./services/document/DocumentCollaborationWebSocket')
new DocumentCollaborationWebSocket(server)
console.log('✅ 文档协作 WebSocket 已启动')

const digitalSiteWsService = initDigitalSiteWebSocket(server)
if (digitalSiteWsService) {
  console.log('✅ 数字工地 WebSocket 已启动')
}

digitalSiteIngestor.start()

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('👋 收到SIGTERM信号，开始优雅关闭...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})

// 启动Redis队列Worker
const { startWorker } = require('./workers/documentWorker')
startWorker()

// 启动GraphRAG自动处理服务（补充处理遗漏的文档）
const AutoGraphRAGService = require('./services/knowledge/AutoGraphRAGService')
AutoGraphRAGService.startAutoProcessor()

process.on('SIGINT', () => {
  console.log('👋 收到SIGINT信号，开始优雅关闭...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('💥 未捕获的异常:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason)
  console.error('Promise:', promise)
  // 不要退出进程，只记录错误（Milvus连接失败不应该导致整个系统崩溃）
  // process.exit(1)
})

module.exports = app
