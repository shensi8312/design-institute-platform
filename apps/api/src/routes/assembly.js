const express = require('express')
const multer = require('multer')
const AssemblyController = require('../controllers/AssemblyController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

/**
 * 装配约束推理引擎路由
 */

// 装配约束推理
router.post(
  '/infer',
  authenticate,
  upload.fields([
    { name: 'bom', maxCount: 1 },
    { name: 'drawings', maxCount: 10 }
  ]),
  AssemblyController.infer
)

// 导出到SolidWorks
router.post('/export/solidworks', authenticate, AssemblyController.exportToSolidWorks)

// 约束审核
router.post('/review', authenticate, AssemblyController.reviewConstraint)

// 约束转规则
router.post('/constraints/convert-to-rule', authenticate, AssemblyController.convertToRule)

// 获取推理任务列表
router.get('/tasks', authenticate, AssemblyController.getTasks)

// 获取任务详情
router.get('/tasks/:taskId', authenticate, AssemblyController.getTaskDetail)

// 获取任务约束数据
router.get('/tasks/:taskId/constraints', authenticate, AssemblyController.getTaskConstraints)

// 生成装配指导PDF
router.post('/tasks/:taskId/generate-guide', authenticate, AssemblyController.generateAssemblyGuide)

// ========== 规则管理 ==========

// 获取所有规则
router.get('/rules', authenticate, AssemblyController.getRules)

// 获取单个规则
router.get('/rules/:ruleId', authenticate, AssemblyController.getRule)

// 创建规则
router.post('/rules', authenticate, AssemblyController.createRule)

// 更新规则
router.put('/rules/:ruleId', authenticate, AssemblyController.updateRule)

// 删除规则
router.delete('/rules/:ruleId', authenticate, AssemblyController.deleteRule)

// 启用/禁用规则
router.patch('/rules/:ruleId/toggle', authenticate, AssemblyController.toggleRule)

// 反馈学习接口
router.post('/feedback', authenticate, AssemblyController.submitFeedback)

// ========== 装配设计管理 ==========

// 直接创建装配设计
router.post('/designs/create', authenticate, AssemblyController.createDesign)

// 生成装配设计（从任务）
router.post('/designs/generate', authenticate, AssemblyController.generateDesign)

// 🤖 模块4-自动设计：从任务自动生成装配设计
router.post('/designs/generate/:taskId', authenticate, AssemblyController.generateDesignFromTask)

// 获取设计列表
router.get('/designs', authenticate, AssemblyController.getDesigns)

// 获取设计详情
router.get('/designs/:designId', authenticate, AssemblyController.getDesignDetail)

// 更新装配设计
router.put('/designs/:designId', authenticate, AssemblyController.updateDesign)

// 删除装配设计
router.delete('/designs/:designId', authenticate, AssemblyController.deleteDesign)

// 添加装配步骤
router.post('/designs/:designId/steps', authenticate, AssemblyController.addDesignStep)

// 更新装配步骤
router.put('/designs/steps/:stepId', authenticate, AssemblyController.updateDesignStep)

// 删除装配步骤
router.delete('/designs/steps/:stepId', authenticate, AssemblyController.deleteDesignStep)

// 提交设计审核
router.post('/designs/:designId/submit-review', authenticate, AssemblyController.submitDesignReview)

// 审核设计
router.post('/designs/:designId/review', authenticate, AssemblyController.reviewDesign)

// 导出装配指导PDF
router.get('/designs/:designId/export-pdf', authenticate, AssemblyController.exportDesignPDF)

// 下载3D模型
router.get('/designs/:id/download', authenticate, AssemblyController.downloadModel)

// 上传3D模型
router.post('/designs/:designId/3d-model', authenticate, upload.single('model'), AssemblyController.upload3DModel)

// 获取3D模型（用于预览）
router.get('/designs/:id/3d-model', authenticate, AssemblyController.get3DModel)

// ========== MVP: PID → 装配图 ==========

// PID → 装配图完整流程
router.post('/pid-to-3d', authenticate, AssemblyController.pidTo3D)

// 导出装配数据 (STEP + BOM + 报告)
router.get('/export/:taskId', authenticate, AssemblyController.exportAssemblyData)

// ========== AI自动装配 ==========

// 🤖 AI自动装配
router.post('/designs/:designId/auto-assemble', authenticate, AssemblyController.autoAssemble)

// 获取装配报告
router.get('/designs/:id/report', authenticate, AssemblyController.getAssemblyReport)

// 获取零件库
router.get('/parts/library', authenticate, AssemblyController.getPartLibrary)

// ========== 规则学习与管理 ==========

// 获取学习到的规则（从JSON文件）
router.get('/learned-rules', authenticate, AssemblyController.getLearnedRules)

// 触发规则学习（执行Python脚本 - 从STEP文件学习几何约束）
router.post('/learn-rules', authenticate, AssemblyController.learnRules)

// 从STEP装配文件生成装配图
router.post('/generate-from-step', authenticate, AssemblyController.generateFromStep)

// ========== 历史案例学习 ==========

/**
 * @route POST /api/assembly/learn/upload-historical-bom
 * @desc 上传历史BOM样本用于统计学习配套规则
 * @body { files: BOM Excel files[], project_name: string, description: string }
 */
router.post('/learn/upload-historical-bom',
  authenticate,
  upload.array('bom_files', 20),  // 最多上传20个BOM文件
  AssemblyController.uploadHistoricalBOM
)

/**
 * @route GET /api/assembly/learn/historical-cases
 * @desc 获取已上传的历史案例列表
 */
router.get('/learn/historical-cases', authenticate, AssemblyController.getHistoricalCases)

/**
 * @route POST /api/assembly/learn/analyze-patterns
 * @desc 从已上传的历史BOM中统计分析配套模式
 */
router.post('/learn/analyze-patterns', authenticate, AssemblyController.analyzeMatchingPatterns)

/**
 * @route GET /api/assembly/learn/matching-rules
 * @desc 获取学习到的配套规则（主件→辅助件）
 */
router.get('/learn/matching-rules', authenticate, AssemblyController.getMatchingRules)

// ========== 基于规则的装配生成 ==========

/**
 * @route POST /api/assembly/generate-from-rules
 * @desc 基于学习到的装配规则生成装配体（验证规则提取的准确性）
 * @body { part_ids: string[], assembly_name: string }
 */
router.post('/generate-from-rules', authenticate, async (req, res) => {
  try {
    const { part_ids, assembly_name } = req.body
    const ruleBasedGenerator = require('../services/assembly/RuleBasedAssemblyGenerator')

    console.log(`[API] 收到规则装配请求: ${assembly_name || '未命名'}`)

    const assembly = await ruleBasedGenerator.generateAssembly({
      partIds: part_ids,
      assemblyName: assembly_name || 'Rule-Based Assembly'
    })

    // 导出Three.js格式 (await since it's now async)
    const threeJSON = await ruleBasedGenerator.exportToThreeJS()

    // 保存到文件
    const fs = require('fs')
    const path = require('path')
    const outputDir = path.join(__dirname, '../../uploads/assembly_output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filename = `rule_assembly_${Date.now()}.json`
    const filepath = path.join(outputDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(threeJSON, null, 2))

    console.log(`[API] ✅ 装配JSON已保存: ${filename}`)

    res.json({
      success: true,
      assembly,
      three_json_path: filepath,
      visualization_url: `/assembly-viewer.html?file=${filename}`
    })
  } catch (error) {
    console.error('[API] 规则装配生成失败:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// ========== 3D可视化 ==========

/**
 * @route GET /api/assembly/:taskId/visualization
 * @desc 获取装配任务的3D可视化数据（用于Three.js渲染）
 */
router.get('/:taskId/visualization', authenticate, AssemblyController.getAssemblyVisualization)

/**
 * @route GET /api/assembly/models/:filename
 * @desc 提供STL模型文件（从solidworks零件库转换后的文件）
 */
router.get('/models/:filename', authenticate, (req, res) => {
  try {
    const { filename } = req.params
    const path = require('path')

    // 安全检查
    if (!/^[\w-]+\.stl$/i.test(filename)) {
      return res.status(400).json({ success: false, message: '无效的文件名' })
    }

    const filePath = path.join(__dirname, '../../../uploads/3d-models', filename)

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[Assembly] STL文件不存在: ${filename}`)
        res.status(404).json({ success: false, message: 'STL文件不存在，需要转换' })
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误' })
  }
})

module.exports = router
