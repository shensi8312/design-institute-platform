const AssemblyReasoningService = require('../services/assembly/AssemblyReasoningService')
const PDFExportService = require('../services/assembly/PDFExportService')
const assembly3DService = require('../services/assembly/Assembly3DService')
const partsCatalog = require('../services/assembly/PartsCatalogService')
const layoutSolver = require('../services/assembly/LayoutSolver')
const validationService = require('../services/assembly/ValidationService')
const AssemblyPositionCalculator = require('../services/assembly/AssemblyPositionCalculator')
const db = require('../config/database')

class AssemblyController {
  constructor() {
    this.reasoningService = new AssemblyReasoningService()
    this.pdfExportService = PDFExportService
  }

  infer = async (req, res) => {
    try {
      const bomFile = req.files?.bom?.[0]
      const drawingFiles = req.files?.drawings || []

      // 至少需要BOM或STEP文件之一
      if (!bomFile && drawingFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'BOM文件或STEP文件至少上传一个'
        })
      }

      console.log('[AssemblyController] 收到推理请求:', {
        bomFile: bomFile?.originalname || '未上传',
        drawingsCount: drawingFiles.length,
        user: req.user?.username
      })

      const result = await this.reasoningService.inferConstraints(
        bomFile?.buffer || null,
        drawingFiles.map(f => ({ name: f.originalname, buffer: f.buffer })),
        req.user?.userId || 'guest',
        req.user?.username || 'Guest'
      )

      console.log('[AssemblyController] 准备返回结果:', {
        success: result.success,
        constraintsCount: result.constraints?.length,
        partsCount: result.metadata?.partsCount
      })

      res.json(result)
    } catch (error) {
      console.error('[AssemblyController] 推理失败:', error)
      res.status(500).json({
        success: false,
        message: '装配约束推理失败: ' + error.message
      })
    }
  }

  reviewConstraint = async (req, res) => {
    try {
      const { constraintId, action, comment, modifications } = req.body

      if (!constraintId || !action) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        })
      }

      // 更新约束审核状态
      const reviewStatus = action === 'approve' || action === 'modify' ? 'approved' : 'rejected'

      await db('assembly_constraints')
        .where({ id: constraintId })
        .update({
          review_status: reviewStatus,
          parameters: modifications ? JSON.stringify(modifications) : db.raw('parameters'),
          updated_at: db.fn.now()
        })

      // 记录审核历史
      await db('assembly_reviews').insert({
        constraint_id: constraintId,
        reviewer_id: req.user.id,
        reviewer_name: req.user.username,
        action,
        comment,
        modifications: modifications ? JSON.stringify(modifications) : null
      })

      console.log(`[AssemblyController] 约束审核: ${constraintId} -> ${action}`)

      res.json({
        success: true,
        message: `约束已${reviewStatus === 'approved' ? '批准' : '拒绝'}`
      })
    } catch (error) {
      console.error('[AssemblyController] 审核失败:', error)
      res.status(500).json({
        success: false,
        message: '审核失败: ' + error.message
      })
    }
  }

  getTasks = async (req, res) => {
    try {
      const { page = 1, pageSize = 20, status } = req.query
      const offset = (page - 1) * pageSize

      // ✅ 直接使用字符串插值（安全：来自认证用户）
      let query = `
        SELECT * FROM assembly_inference_tasks
        WHERE user_id = '${req.user.id}'
      `

      if (status) {
        query += ` AND status = '${status}'`
      }

      query += ` ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`

      const result = await db.raw(query)
      const tasks = result.rows

      const countQuery = `
        SELECT COUNT(*) as count FROM assembly_inference_tasks
        WHERE user_id = '${req.user.id}'
      `
      const countResult = await db.raw(countQuery)

      res.json({
        success: true,
        data: tasks,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(countResult.rows[0].count)
        }
      })
    } catch (error) {
      console.error('[AssemblyController] 获取任务列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取任务列表失败: ' + error.message
      })
    }
  }

  getTaskDetail = async (req, res) => {
    try {
      const { taskId } = req.params

      const task = await db('assembly_inference_tasks')
        .where({ id: taskId })
        .first()

      if (!task) {
        return res.status(404).json({
          success: false,
          message: '任务不存在'
        })
      }

      const constraints = await db('assembly_constraints')
        .where({ task_id: taskId })

      res.json({
        success: true,
        data: {
          ...task,
          constraints
        }
      })
    } catch (error) {
      console.error('[AssemblyController] 获取任务详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取任务详情失败: ' + error.message
      })
    }
  }

  // ========== 规则管理 ==========

  getRules = async (req, res) => {
    try {
      const { isActive } = req.query

      let query = db('assembly_rules').orderBy('priority', 'desc')

      if (isActive !== undefined) {
        query = query.where({ is_active: isActive === 'true' })
      }

      const rules = await query

      res.json({
        success: true,
        data: rules
      })
    } catch (error) {
      console.error('[AssemblyController] 获取规则列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取规则列表失败: ' + error.message
      })
    }
  }

  getRule = async (req, res) => {
    try {
      const { ruleId } = req.params

      const rule = await db('assembly_rules')
        .where({ rule_id: ruleId })
        .first()

      if (!rule) {
        return res.status(404).json({
          success: false,
          message: '规则不存在'
        })
      }

      res.json({
        success: true,
        data: rule
      })
    } catch (error) {
      console.error('[AssemblyController] 获取规则失败:', error)
      res.status(500).json({
        success: false,
        message: '获取规则失败: ' + error.message
      })
    }
  }

  createRule = async (req, res) => {
    try {
      const { rule_id, name, description, priority, constraint_type, condition_logic, action_template } = req.body

      if (!rule_id || !name || !constraint_type) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        })
      }

      const [newRule] = await db('assembly_rules')
        .insert({
          rule_id,
          name,
          description,
          priority: priority || 5,
          constraint_type,
          condition_logic: JSON.stringify(condition_logic),
          action_template: JSON.stringify(action_template),
          created_by: req.user.id
        })
        .returning('*')

      console.log(`[AssemblyController] 创建规则: ${rule_id}`)

      res.json({
        success: true,
        data: newRule
      })
    } catch (error) {
      console.error('[AssemblyController] 创建规则失败:', error)
      res.status(500).json({
        success: false,
        message: '创建规则失败: ' + error.message
      })
    }
  }

  updateRule = async (req, res) => {
    try {
      const { ruleId } = req.params
      const { name, description, priority, constraint_type, condition_logic, action_template } = req.body

      await db('assembly_rules')
        .where({ rule_id: ruleId })
        .update({
          name,
          description,
          priority,
          constraint_type,
          condition_logic: condition_logic ? JSON.stringify(condition_logic) : db.raw('condition_logic'),
          action_template: action_template ? JSON.stringify(action_template) : db.raw('action_template'),
          updated_at: db.fn.now()
        })

      console.log(`[AssemblyController] 更新规则: ${ruleId}`)

      res.json({
        success: true,
        message: '规则已更新'
      })
    } catch (error) {
      console.error('[AssemblyController] 更新规则失败:', error)
      res.status(500).json({
        success: false,
        message: '更新规则失败: ' + error.message
      })
    }
  }

  deleteRule = async (req, res) => {
    try {
      const { ruleId } = req.params

      await db('assembly_rules')
        .where({ rule_id: ruleId })
        .delete()

      console.log(`[AssemblyController] 删除规则: ${ruleId}`)

      res.json({
        success: true,
        message: '规则已删除'
      })
    } catch (error) {
      console.error('[AssemblyController] 删除规则失败:', error)
      res.status(500).json({
        success: false,
        message: '删除规则失败: ' + error.message
      })
    }
  }

  toggleRule = async (req, res) => {
    try {
      const { ruleId } = req.params

      const rule = await db('assembly_rules')
        .where({ rule_id: ruleId })
        .first()

      if (!rule) {
        return res.status(404).json({
          success: false,
          message: '规则不存在'
        })
      }

      await db('assembly_rules')
        .where({ rule_id: ruleId })
        .update({
          is_active: !rule.is_active,
          updated_at: db.fn.now()
        })

      console.log(`[AssemblyController] 切换规则状态: ${ruleId} -> ${!rule.is_active}`)

      res.json({
        success: true,
        message: `规则已${!rule.is_active ? '启用' : '禁用'}`
      })
    } catch (error) {
      console.error('[AssemblyController] 切换规则状态失败:', error)
      res.status(500).json({
        success: false,
        message: '切换规则状态失败: ' + error.message
      })
    }
  }

  getTaskConstraints = async (req, res) => {
    try {
      const { taskId } = req.params

      const constraints = await db('assembly_constraints')
        .where({ task_id: taskId })
        .orderBy('id')

      res.json({
        success: true,
        data: constraints
      })
    } catch (error) {
      console.error('[AssemblyController] 获取约束数据失败:', error)
      res.status(500).json({
        success: false,
        message: '获取约束数据失败: ' + error.message
      })
    }
  }

  generateAssemblyGuide = async (req, res) => {
    try {
      const { taskId } = req.params

      // 获取任务和约束
      const task = await db('assembly_inference_tasks')
        .where({ id: taskId })
        .first()

      if (!task) {
        return res.status(404).json({
          success: false,
          message: '任务不存在'
        })
      }

      const constraints = await db('assembly_constraints')
        .where({ task_id: taskId })
        .orderBy('id')

      // 生成装配步骤（基于装配顺序）
      const assemblySteps = this._generateAssemblySteps(constraints)

      // 转换为PDF
      const PDFDocument = require('pdfkit')
      const pdf = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 72, right: 72 }
      })

      // 设置响应头
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=assembly_guide_${taskId}.pdf`)

      // 管道输出
      pdf.pipe(res)

      // 添加中文字体支持
      const fontPath = '/System/Library/Fonts/PingFang.ttc'
      try {
        pdf.font(fontPath)
      } catch (e) {
        console.warn('[AssemblyController] 无法加载中文字体，使用默认字体')
      }

      // 生成PDF内容
      pdf.fontSize(20).text('装配指导书', { align: 'center' })
      pdf.moveDown()

      pdf.fontSize(12).text(`任务ID: ${task.id}`)
      pdf.text(`BOM文件: ${task.bom_file_path}`)
      pdf.text(`零件数量: ${task.parts_count}`)
      pdf.text(`识别约束: ${task.constraints_count}`)
      pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`)
      pdf.moveDown(2)

      // 装配步骤
      pdf.fontSize(16).text('装配步骤', { underline: true })
      pdf.moveDown()

      assemblySteps.forEach((step, index) => {
        pdf.fontSize(14).text(`步骤 ${index + 1}: ${step.title}`)
        pdf.fontSize(10)
        pdf.text(`零件: ${step.parts.join(', ')}`)
        pdf.text(`约束类型: ${step.constraintType}`)
        pdf.text(`操作: ${step.operation}`)
        pdf.moveDown()
      })

      // 约束详情表
      pdf.addPage()
      pdf.fontSize(16).text('约束详情', { underline: true })
      pdf.moveDown()

      constraints.forEach((c, index) => {
        pdf.fontSize(12).text(`${index + 1}. ${c.constraint_type}`)
        pdf.fontSize(10)
        pdf.text(`   零件对: ${c.part_a} ↔ ${c.part_b}`)
        pdf.text(`   置信度: ${(c.confidence * 100).toFixed(0)}%`)
        if (c.reasoning) {
          pdf.text(`   推理: ${c.reasoning}`)
        }
        pdf.moveDown(0.5)
      })

      // 完成PDF
      pdf.end()

      console.log(`[AssemblyController] 生成装配指导PDF: 任务${taskId}`)
    } catch (error) {
      console.error('[AssemblyController] 生成PDF失败:', error)
      res.status(500).json({
        success: false,
        message: '生成装配指导书失败: ' + error.message
      })
    }
  }

  _generateAssemblySteps(constraints) {
    // 根据约束生成装配步骤
    return constraints.map((c, index) => {
      const operationMap = {
        'SCREW': `使用螺栓将 ${c.part_a} 固定到 ${c.part_b}`,
        'CONCENTRIC': `将 ${c.part_a} 与 ${c.part_b} 对齐（同轴）`,
        'COINCIDENT': `将 ${c.part_a} 与 ${c.part_b} 重合`,
        'DISTANCE': `保持 ${c.part_a} 与 ${c.part_b} 的间距`,
        'PARALLEL': `保持 ${c.part_a} 与 ${c.part_b} 平行`,
        'PERPENDICULAR': `保持 ${c.part_a} 与 ${c.part_b} 垂直`
      }

      return {
        title: operationMap[c.constraint_type] || `装配 ${c.part_a} 和 ${c.part_b}`,
        parts: [c.part_a, c.part_b],
        constraintType: c.constraint_type,
        operation: operationMap[c.constraint_type] || '按约束要求装配',
        parameters: c.parameters
      }
    })
  }

  exportToSolidWorks = async (req, res) => {
    try {
      const { designId, format = 'solidworks' } = req.body

      if (!designId) {
        return res.status(400).json({
          success: false,
          message: '缺少设计ID'
        })
      }

      // 获取设计信息
      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      // 获取装配步骤
      const steps = await db('assembly_design_steps')
        .where('design_id', designId)
        .orderBy('step_number', 'asc')

      // 获取约束
      const constraints = design.task_id
        ? await db('assembly_constraints').where('task_id', design.task_id)
        : []

      console.log(`[AssemblyController] 导出设计: ${design.design_name}, 格式: ${format}`)

      let result
      if (format === 'pdf') {
        result = await this.pdfExportService.generateAssemblyGuidePDF(design, steps, constraints)
      } else {
        result = await this.pdfExportService.exportSolidWorksJSON(design, steps, constraints)
      }

      res.json({
        success: true,
        message: '导出成功',
        filePath: result.url,
        downloadUrl: result.url,
        filename: result.filename
      })
    } catch (error) {
      console.error('[AssemblyController] 导出失败:', error)
      res.status(500).json({
        success: false,
        message: '导出失败: ' + error.message
      })
    }
  }

  submitFeedback = async (req, res) => {
    try {
      const { constraintId, isCorrect, correction } = req.body

      await this.reasoningService.learnFromFeedback({
        constraintId,
        isCorrect,
        correction,
        userId: req.user?.userId || 'guest',
        timestamp: new Date()
      })

      res.json({
        success: true,
        message: '反馈已记录，用于持续优化'
      })
    } catch (error) {
      console.error('[AssemblyController] 反馈记录失败:', error)
      res.status(500).json({
        success: false,
        message: '反馈提交失败: ' + error.message
      })
    }
  }

  _mapConstraintToSWMateType(constraintType) {
    const mapping = {
      'CONCENTRIC': 'swMateCONCENTRIC',
      'SCREW': 'swMateSCREW',
      'DISTANCE': 'swMateDISTANCE',
      'PARALLEL': 'swMatePARALLEL',
      'PERPENDICULAR': 'swMatePERPENDICULAR',
      'COINCIDENT': 'swMateCOINCIDENT'
    }
    return mapping[constraintType] || 'swMateCOINCIDENT'
  }

  /**
   * 将约束转换为规则
   */
  convertToRule = async (req, res) => {
    try {
      const { constraint } = req.body
      const db = require('../config/database')

      console.log('[AssemblyController] 转换约束为规则:', constraint)

      // 提取零件模式
      const partPatterns = this._extractPartPatterns(constraint.entities)

      // 生成规则名称
      const ruleName = `${constraint.type}_rule_${Date.now()}`

      // 生成规则描述
      const ruleDescription = constraint.reasoning || `从约束 ${constraint.id} 自动生成的规则`

      // 生成条件（兼容推理引擎）
      const conditionLogic = (() => {
        const partAName = constraint.part_a || constraint.partA || constraint.entities?.[0]
        const partBName = constraint.part_b || constraint.partB || constraint.entities?.[1]

        if (partPatterns.partA.type && partPatterns.partA.type === partPatterns.partB.type) {
          return { type: 'both', field: 'type', value: partPatterns.partA.type }
        }

        const sharedFeature = partPatterns.partA.features?.find(feat =>
          partPatterns.partB.features?.includes(feat)
        )

        if (sharedFeature) {
          return { type: 'name_contains', field: 'name', value: sharedFeature }
        }

        if (partAName && partBName) {
          return { type: 'specific_pair', parts: [partAName, partBName] }
        }

        return { type: 'always' }
      })()

      // 生成动作模板
      const actionTemplate = {
        constraint_type: (constraint.type || 'GENERIC').toUpperCase(),
        parameters: constraint.parameters || {}
      }

      // 插入规则到数据库
      const [ruleId] = await db('assembly_rules').insert({
        rule_id: `rule_${Date.now()}`,
        name: ruleName,
        description: ruleDescription,
        priority: Math.max(1, Math.round((constraint.confidence || 0.6) * 100)),
        constraint_type: actionTemplate.constraint_type,
        condition_logic: JSON.stringify(conditionLogic),
        action_template: JSON.stringify(actionTemplate),
        is_active: true,
        created_by: req.user.id,
        learned_from: 'constraint_conversion',
        confidence_boost: 0,
        usage_count: 0,
        success_count: 0,
        metadata: JSON.stringify({
          sourceConstraintId: constraint.id,
          originalConfidence: constraint.confidence,
          convertedAt: new Date().toISOString()
        })
      }).returning('rule_id')

      const createdRuleId = typeof ruleId === 'object' ? ruleId.rule_id : ruleId

      console.log('[AssemblyController] ✅ 成功创建规则:', createdRuleId)

      res.json({
        success: true,
        message: '约束已成功转换为规则',
        ruleId: createdRuleId,
        ruleName
      })
    } catch (error) {
      console.error('[AssemblyController] 转换规则失败:', error)
      res.status(500).json({
        success: false,
        message: '转换规则失败: ' + error.message
      })
    }
  }

  /**
   * 从零件名称提取模式特征
   */
  _extractPartPatterns(entities) {
    const extractFeatures = (partName) => {
      const features = {
        type: null,
        features: []
      }

      // 提取零件类型
      if (/螺栓|螺钉|screw|bolt/i.test(partName)) {
        features.type = 'BOLT'
        features.features.push('threaded')
      } else if (/螺母|nut/i.test(partName)) {
        features.type = 'NUT'
        features.features.push('threaded')
      } else if (/轴|shaft|axis/i.test(partName)) {
        features.type = 'SHAFT'
        features.features.push('cylindrical')
      } else if (/孔|hole/i.test(partName)) {
        features.type = 'HOLE'
        features.features.push('cylindrical')
      } else if (/板|plate|panel/i.test(partName)) {
        features.type = 'PLATE'
        features.features.push('flat')
      }

      // 提取规格特征
      const sizeMatch = partName.match(/M(\d+)|(\d+)mm/)
      if (sizeMatch) {
        features.features.push(`size_${sizeMatch[1] || sizeMatch[2]}`)
      }

      return features
    }

    return {
      partA: extractFeatures(entities[0] || ''),
      partB: extractFeatures(entities[1] || '')
    }
  }

  /**
   * 生成装配设计
   */
  generateDesign = async (req, res) => {
    try {
      const { taskId } = req.body
      const db = require('../config/database')

      console.log('[AssemblyController] 生成装配设计, 任务:', taskId)

      // 1. 获取任务约束
      const constraints = await db('assembly_constraints')
        .where('task_id', taskId)
        .select('*')

      if (!constraints || constraints.length === 0) {
        return res.status(404).json({
          success: false,
          message: '未找到约束数据'
        })
      }

      // 2. 根据约束生成装配步骤
      const steps = this._generateDesignSteps(constraints)

      // 3. 创建装配设计记录
      const [designId] = await db('assembly_designs').insert({
        task_id: taskId,
        user_id: req.user.id,
        user_name: req.user.username,
        status: 'draft',
        steps_count: steps.length,
        metadata: JSON.stringify({
          generatedAt: new Date().toISOString(),
          constraintsCount: constraints.length
        })
      }).returning('id')

      // 4. 批量插入装配步骤
      const stepsData = steps.map((step, index) => ({
        design_id: designId,
        step_number: index + 1,
        description: step.description,
        operation_type: step.operationType,
        part_a: step.partA,
        part_b: step.partB,
        parameters: JSON.stringify(step.parameters || {}),
        notes: step.notes || ''
      }))

      await db('assembly_design_steps').insert(stepsData)

      console.log('[AssemblyController] ✅ 成功生成装配设计:', designId)

      res.json({
        success: true,
        message: '装配设计已生成',
        designId,
        stepsCount: steps.length
      })
    } catch (error) {
      console.error('[AssemblyController] 生成装配设计失败:', error)
      res.status(500).json({
        success: false,
        message: '生成装配设计失败: ' + error.message
      })
    }
  }

  /**
   * 直接创建装配设计（不依赖推理任务）
   */
  createDesign = async (req, res) => {
    try {
      const { design_name, project_name, description } = req.body
      const db = require('../config/database')

      console.log('[AssemblyController] 创建装配设计:', design_name)

      // 创建装配设计记录
      const [designId] = await db('assembly_designs').insert({
        design_name,
        project_name,
        description,
        user_id: req.user.id,
        user_name: req.user.username || req.user.real_name,
        status: 'draft',
        steps_count: 0,
        metadata: JSON.stringify({
          createdAt: new Date().toISOString(),
          source: 'manual'
        })
      }).returning('id')

      console.log('[AssemblyController] ✅ 成功创建装配设计:', designId)

      res.json({
        success: true,
        message: '装配设计已创建',
        designId
      })
    } catch (error) {
      console.error('[AssemblyController] 创建装配设计失败:', error)
      res.status(500).json({
        success: false,
        message: '创建装配设计失败: ' + error.message
      })
    }
  }

  /**
   * 更新装配设计
   */
  updateDesign = async (req, res) => {
    try {
      const { designId } = req.params
      const { design_name, project_name, description } = req.body
      const db = require('../config/database')

      console.log('[AssemblyController] 更新装配设计:', designId)

      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      await db('assembly_designs')
        .where('id', designId)
        .update({
          design_name,
          project_name,
          description,
          updated_at: db.fn.now()
        })

      console.log('[AssemblyController] ✅ 设计已更新')

      res.json({
        success: true,
        message: '设计已更新'
      })
    } catch (error) {
      console.error('[AssemblyController] 更新设计失败:', error)
      res.status(500).json({
        success: false,
        message: '更新设计失败: ' + error.message
      })
    }
  }

  /**
   * 删除装配设计
   */
  deleteDesign = async (req, res) => {
    try {
      const { designId } = req.params
      const db = require('../config/database')

      console.log('[AssemblyController] 删除装配设计:', designId)

      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      // 删除所有步骤
      await db('assembly_design_steps').where('design_id', designId).del()

      // 删除设计
      await db('assembly_designs').where('id', designId).del()

      console.log('[AssemblyController] ✅ 设计已删除')

      res.json({
        success: true,
        message: '设计已删除'
      })
    } catch (error) {
      console.error('[AssemblyController] 删除设计失败:', error)
      res.status(500).json({
        success: false,
        message: '删除设计失败: ' + error.message
      })
    }
  }

  /**
   * 添加装配步骤
   */
  addDesignStep = async (req, res) => {
    try {
      const { designId } = req.params
      const { operation_type, part_a, part_b, description, notes } = req.body
      const db = require('../config/database')

      // 获取当前步骤数
      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      const step_number = design.steps_count + 1

      // 添加步骤
      await db('assembly_design_steps').insert({
        design_id: designId,
        step_number,
        description,
        operation_type,
        part_a,
        part_b,
        notes: notes || ''
      })

      // 更新步骤数
      await db('assembly_designs')
        .where('id', designId)
        .update({
          steps_count: step_number,
          updated_at: db.fn.now()
        })

      res.json({
        success: true,
        message: '步骤已添加'
      })
    } catch (error) {
      console.error('[AssemblyController] 添加步骤失败:', error)
      res.status(500).json({
        success: false,
        message: '添加步骤失败: ' + error.message
      })
    }
  }

  /**
   * 删除装配步骤
   */
  deleteDesignStep = async (req, res) => {
    try {
      const { stepId } = req.params
      const db = require('../config/database')

      // 获取步骤信息
      const step = await db('assembly_design_steps').where('id', stepId).first()
      if (!step) {
        return res.status(404).json({
          success: false,
          message: '步骤不存在'
        })
      }

      // 删除步骤
      await db('assembly_design_steps').where('id', stepId).del()

      // 重新排序剩余步骤
      const remainingSteps = await db('assembly_design_steps')
        .where('design_id', step.design_id)
        .orderBy('step_number')

      for (let i = 0; i < remainingSteps.length; i++) {
        await db('assembly_design_steps')
          .where('id', remainingSteps[i].id)
          .update({ step_number: i + 1 })
      }

      // 更新步骤数
      await db('assembly_designs')
        .where('id', step.design_id)
        .update({
          steps_count: remainingSteps.length,
          updated_at: db.fn.now()
        })

      res.json({
        success: true,
        message: '步骤已删除'
      })
    } catch (error) {
      console.error('[AssemblyController] 删除步骤失败:', error)
      res.status(500).json({
        success: false,
        message: '删除步骤失败: ' + error.message
      })
    }
  }

  /**
   * 获取装配设计列表
   */
  getDesigns = async (req, res) => {
    try {
      const { page = 1, pageSize = 20, status } = req.query
      const offset = (page - 1) * pageSize
      const db = require('../config/database')

      let query = db('assembly_designs')
        .where('user_id', req.user.id)
        .orderBy('created_at', 'desc')

      if (status) {
        query = query.where('status', status)
      }

      const designs = await query.limit(pageSize).offset(offset)
      const countResult = await db('assembly_designs')
        .where('user_id', req.user.id)
        .count('* as count')
        .first()

      res.json({
        success: true,
        data: designs,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(countResult.count)
        }
      })
    } catch (error) {
      console.error('[AssemblyController] 获取设计列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取设计列表失败: ' + error.message
      })
    }
  }

  /**
   * 获取装配设计详情
   */
  getDesignDetail = async (req, res) => {
    try {
      const { designId } = req.params
      const db = require('../config/database')

      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      const steps = await db('assembly_design_steps')
        .where('design_id', designId)
        .orderBy('step_number', 'asc')

      res.json({
        success: true,
        design,
        steps
      })
    } catch (error) {
      console.error('[AssemblyController] 获取设计详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取设计详情失败: ' + error.message
      })
    }
  }

  /**
   * 更新装配步骤
   */
  updateDesignStep = async (req, res) => {
    try {
      const { stepId } = req.params
      const { description, notes } = req.body
      const db = require('../config/database')

      await db('assembly_design_steps')
        .where('id', stepId)
        .update({
          description,
          notes,
          is_modified: true,
          updated_at: db.fn.now()
        })

      res.json({
        success: true,
        message: '步骤已更新'
      })
    } catch (error) {
      console.error('[AssemblyController] 更新步骤失败:', error)
      res.status(500).json({
        success: false,
        message: '更新步骤失败: ' + error.message
      })
    }
  }

  /**
   * 提交设计审核
   */
  submitDesignReview = async (req, res) => {
    try {
      const { designId } = req.params
      const db = require('../config/database')

      await db('assembly_designs')
        .where('id', designId)
        .update({
          status: 'pending_review',
          updated_at: db.fn.now()
        })

      res.json({
        success: true,
        message: '已提交审核'
      })
    } catch (error) {
      console.error('[AssemblyController] 提交审核失败:', error)
      res.status(500).json({
        success: false,
        message: '提交审核失败: ' + error.message
      })
    }
  }

  /**
   * 审核装配设计
   */
  reviewDesign = async (req, res) => {
    try {
      const { designId } = req.params
      const { action, comment } = req.body // action: approve | reject
      const db = require('../config/database')

      await db('assembly_designs')
        .where('id', designId)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          review_comment: comment,
          reviewed_by: req.user.id,
          reviewed_at: db.fn.now(),
          updated_at: db.fn.now()
        })

      res.json({
        success: true,
        message: action === 'approve' ? '设计已批准' : '设计已拒绝'
      })
    } catch (error) {
      console.error('[AssemblyController] 审核失败:', error)
      res.status(500).json({
        success: false,
        message: '审核失败: ' + error.message
      })
    }
  }

  /**
   * 导出装配指导PDF
   */
  exportDesignPDF = async (req, res) => {
    try {
      const { designId } = req.params
      const db = require('../config/database')
      const PDFDocument = require('pdfkit')
      const path = require('path')
      const fs = require('fs')

      const design = await db('assembly_designs').where('id', designId).first()
      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      const steps = await db('assembly_design_steps')
        .where('design_id', designId)
        .orderBy('step_number', 'asc')

      const pdf = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 72, right: 72 }
      })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=assembly_guide_${designId}.pdf`)
      pdf.pipe(res)

      // 标题
      pdf.fontSize(20).text('装配工艺指导书', { align: 'center' })
      pdf.moveDown()

      // 基本信息
      pdf.fontSize(12)
      pdf.text(`设计名称: ${design.design_name || '未命名'}`)
      pdf.text(`项目名称: ${design.project_name || '未指定'}`)
      pdf.text(`设计编号: ${design.id}`)
      pdf.text(`状态: ${this._getStatusText(design.status)}`)
      pdf.text(`创建时间: ${new Date(design.created_at).toLocaleString('zh-CN')}`)
      pdf.text(`总步骤数: ${design.steps_count}`)
      if (design.description) {
        pdf.text(`设计说明: ${design.description}`)
      }
      pdf.moveDown(2)

      // 装配步骤
      pdf.fontSize(16).text('装配步骤', { underline: true })
      pdf.moveDown()

      steps.forEach((step, index) => {
        pdf.fontSize(14).text(`步骤 ${step.step_number}: ${step.operation_type || '操作'}`)
        pdf.fontSize(11).text(step.description, { indent: 20 })
        pdf.fontSize(10).text(`零件A: ${step.part_a}`, { indent: 20 })
        pdf.fontSize(10).text(`零件B: ${step.part_b}`, { indent: 20 })
        if (step.notes) {
          pdf.fontSize(10).fillColor('gray').text(`备注: ${step.notes}`, { indent: 20 })
          pdf.fillColor('black')
        }
        pdf.moveDown()

        if ((index + 1) % 5 === 0 && index < steps.length - 1) {
          pdf.addPage()
        }
      })

      // 页脚
      pdf.fontSize(8).fillColor('gray')
      pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 72, pdf.page.height - 50, { align: 'right' })

      pdf.end()
      console.log('[AssemblyController] ✅ 成功生成装配指导PDF')
    } catch (error) {
      console.error('[AssemblyController] 生成PDF失败:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '生成PDF失败: ' + error.message
        })
      }
    }
  }

  /**
   * 生成装配步骤（从约束）
   */
  _generateDesignSteps(constraints) {
    return constraints.map((c, index) => {
      const operationMap = {
        'SCREW': '螺栓连接',
        'CONCENTRIC': '同轴对齐',
        'COINCIDENT': '平面重合',
        'DISTANCE': '间距定位',
        'PARALLEL': '平行对齐',
        'PERPENDICULAR': '垂直对齐'
      }

      const descriptionMap = {
        'SCREW': `使用螺栓将 ${c.part_a} 固定到 ${c.part_b}`,
        'CONCENTRIC': `将 ${c.part_a} 与 ${c.part_b} 对齐（同轴安装）`,
        'COINCIDENT': `将 ${c.part_a} 与 ${c.part_b} 的表面贴合`,
        'DISTANCE': `保持 ${c.part_a} 与 ${c.part_b} 的间距为 ${c.parameters?.distance || '指定值'}mm`,
        'PARALLEL': `确保 ${c.part_a} 与 ${c.part_b} 保持平行`,
        'PERPENDICULAR': `确保 ${c.part_a} 与 ${c.part_b} 保持垂直`
      }

      return {
        operationType: c.type,
        description: descriptionMap[c.type] || `装配 ${c.part_a} 和 ${c.part_b}`,
        partA: c.part_a,
        partB: c.part_b,
        parameters: c.parameters,
        notes: `置信度: ${(c.confidence * 100).toFixed(0)}%, 规则: ${c.rule_id || '自动推理'}`
      }
    })
  }

  _getStatusText(status) {
    const statusMap = {
      'draft': '草稿',
      'pending_review': '待审核',
      'approved': '已批准',
      'rejected': '已拒绝'
    }
    return statusMap[status] || status
  }

  /**
   * 🤖 模块4-自动设计：从学习的规则自动生成装配设计
   */
  generateDesignFromTask = async (req, res) => {
    try {
      const { taskId } = req.params
      const { design_name, project_name, description } = req.body

      console.log('[模块4-自动设计] 从任务生成装配设计:', taskId)

      const task = await db('assembly_inference_tasks').where('id', taskId).first()
      if (!task || task.status !== 'completed') {
        return res.status(400).json({ success: false, message: '学习任务未完成' })
      }

      const constraints = await db('assembly_constraints')
        .where({ task_id: taskId, status: 'active' })
        .select('*')

      if (constraints.length === 0) {
        return res.status(400).json({ success: false, message: '无可用约束规则' })
      }

      console.log(`[模块4-自动设计] 应用${constraints.length}条规则自动生成装配步骤`)

      const solverResult = task.solver_result || {}
      const assemblySequence = solverResult.sequence || []

      const designId = require('uuid').v4()
      await db('assembly_designs').insert({
        id: designId,
        task_id: taskId,
        user_id: req.user.id,
        user_name: req.user.username,
        design_name: design_name || `AI自动设计_${Date.now()}`,
        project_name: project_name || '自动生成项目',
        description: description || `基于${constraints.length}条规则AI自动生成`,
        status: 'draft',
        steps_count: 0,
        metadata: JSON.stringify({
          sourceTaskId: taskId,
          autoGenerated: true,
          generatedAt: new Date().toISOString(),
          constraintsApplied: constraints.length
        })
      })

      const steps = this._generateStepsFromConstraints(constraints, assemblySequence)

      if (steps.length > 0) {
        await db('assembly_design_steps').insert(
          steps.map((step, index) => ({
            id: require('uuid').v4(),
            design_id: designId,
            step_number: index + 1,
            description: step.description,
            operation_type: step.operation_type,
            part_a: step.part_a,
            part_b: step.part_b,
            parameters: JSON.stringify(step.parameters || {}),
            notes: step.notes || '',
            is_modified: false
          }))
        )

        await db('assembly_designs').where('id', designId).update({ steps_count: steps.length })

        console.log(`[模块4-自动设计] ✅ 自动生成${steps.length}个装配步骤`)
      }

      res.json({
        success: true,
        message: `AI自动生成装配设计成功，包含${steps.length}个步骤`,
        designId: { id: designId },
        stepsCount: steps.length
      })
    } catch (error) {
      console.error('[模块4-自动设计] 失败:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  }

  /**
   * 🧠 AI自动生成装配步骤（模块4核心算法）
   */
  _generateStepsFromConstraints(constraints, sequence = []) {
    const steps = []

    for (const constraint of constraints) {
      const params = typeof constraint.parameters === 'string'
        ? JSON.parse(constraint.parameters)
        : constraint.parameters

      let step = null

      switch (constraint.constraint_type) {
        case 'SCREW':
          step = {
            operation_type: '螺栓连接',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `使用螺栓将 ${constraint.part_a} 固定到 ${constraint.part_b}`,
            parameters: {
              pitch: params.pitch || 1.5,
              revolutions: params.revolutions || 8,
              torque: Math.round((params.pitch || 1.5) * 10)
            },
            notes: `拧紧扭矩: ${Math.round((params.pitch || 1.5) * 10)} N·m`
          }
          break

        case 'CONCENTRIC':
          step = {
            operation_type: '同轴对齐',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `将 ${constraint.part_a} 与 ${constraint.part_b} 同轴对齐`,
            parameters: { tolerance: 0.05 },
            notes: '确保轴线重合，公差±0.05mm'
          }
          break

        case 'COINCIDENT':
          step = {
            operation_type: '平面重合',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `使 ${constraint.part_a} 与 ${constraint.part_b} 平面贴合`,
            parameters: { alignment: 'ALIGNED' },
            notes: '检查接触面清洁，确保平整'
          }
          break

        case 'DISTANCE':
          step = {
            operation_type: '距离约束',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `保持 ${constraint.part_a} 与 ${constraint.part_b} 距离为 ${params.distance}mm`,
            parameters: { distance: params.distance || 0 },
            notes: '使用垫片保持固定距离'
          }
          break

        case 'PARALLEL':
          step = {
            operation_type: '平行约束',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `确保 ${constraint.part_a} 与 ${constraint.part_b} 保持平行`,
            parameters: {},
            notes: '使用水平仪检查平行度'
          }
          break

        case 'PERPENDICULAR':
          step = {
            operation_type: '垂直约束',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `使 ${constraint.part_a} 与 ${constraint.part_b} 垂直装配`,
            parameters: {},
            notes: '使用直角尺检查垂直度'
          }
          break

        default:
          step = {
            operation_type: '装配',
            part_a: constraint.part_a,
            part_b: constraint.part_b,
            description: `装配 ${constraint.part_a} 到 ${constraint.part_b}`,
            parameters: params,
            notes: `约束类型: ${constraint.constraint_type}`
          }
      }

      if (step) steps.push(step)
    }

    if (steps.length > 0 && sequence.length > 0) {
      steps.unshift({
        operation_type: '准备',
        part_a: '工作台',
        part_b: sequence[0],
        description: `将基础零件 ${sequence[0]} 放置在工作台上`,
        parameters: {},
        notes: '确保工作台平稳，清理异物'
      })
    }

    return steps
  }

  /**
   * 上传3D模型
   */
  upload3DModel = async (req, res) => {
    try {
      const { designId } = req.params
      const file = req.file

      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请上传3D模型文件'
        })
      }

      const allowedFormats = ['.stl', '.obj', '.step', '.stp', '.sldprt', '.sldasm']
      const ext = require('path').extname(file.originalname).toLowerCase()

      if (!allowedFormats.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: '不支持的文件格式。支持: STL, OBJ, STEP, SLDPRT, SLDASM'
        })
      }

      const maxSize = 100 * 1024 * 1024
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: '文件大小不能超过100MB'
        })
      }

      const path = require('path')
      const fs = require('fs').promises
      const uploadDir = path.join(__dirname, '../../uploads/3d-models')

      await fs.mkdir(uploadDir, { recursive: true })

      const timestamp = Date.now()
      const fileName = `${designId}_${timestamp}${ext}`
      const filePath = path.join(uploadDir, fileName)
      const relativePath = `uploads/3d-models/${fileName}`

      await fs.writeFile(filePath, file.buffer)

      const db = require('../config/database')
      await db('assembly_designs')
        .where({ id: designId })
        .update({
          model_3d_path: relativePath,
          model_format: ext.substring(1).toUpperCase(),
          original_format: ext.substring(1).toUpperCase(),
          file_size: file.size,
          conversion_status: 'none',
          updated_at: db.fn.now()
        })

      console.log(`[上传3D模型成功]: ${fileName} (${file.size} bytes)`)

      res.json({
        success: true,
        message: '3D模型上传成功',
        data: {
          filePath: relativePath,
          fileName: fileName,
          fileSize: file.size,
          format: ext.substring(1).toUpperCase()
        }
      })
    } catch (error) {
      console.error('[上传3D模型失败]:', error)
      res.status(500).json({
        success: false,
        message: '上传失败: ' + error.message
      })
    }
  }

  /**
   * 获取3D模型（用于预览）
   */
  get3DModel = async (req, res) => {
    try {
      const { id } = req.params
      const db = require('../config/database')

      const design = await db('assembly_designs')
        .where({ id })
        .select('model_3d_path', 'model_format', 'file_size', 'original_format')
        .first()

      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      if (!design.model_3d_path) {
        return res.status(404).json({
          success: false,
          message: '该设计没有3D模型'
        })
      }

      const path = require('path')
      const fs = require('fs')
      const filePath = path.join(__dirname, '../../', design.model_3d_path)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        })
      }

      const contentType = {
        'STL': 'model/stl',
        'OBJ': 'model/obj',
        'STEP': 'model/step',
        'STP': 'model/step',
        'SLDPRT': 'application/octet-stream',
        'SLDASM': 'application/octet-stream'
      }[design.model_format] || 'application/octet-stream'

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
      res.sendFile(filePath)
    } catch (error) {
      console.error('[获取3D模型失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 🤖 AI自动装配 - 基于规则引擎
   */
  autoAssemble = async (req, res) => {
    try {
      const { designId } = req.params
      const { part_files } = req.body  // STEP文件路径列表

      console.log(`[自动装配] 设计ID: ${designId}, 零件数: ${part_files?.length || 0}`)

      if (!part_files || part_files.length < 2) {
        return res.status(400).json({
          success: false,
          message: '至少需要2个零件才能进行装配'
        })
      }

      // 1. 调用Python自动装配引擎
      const { spawn } = require('child_process')
      const path = require('path')

      const pythonScript = path.join(__dirname, '../services/auto_assembly_engine.py')
      const rulesFile = path.join(__dirname, '../../../docs/assembly_rules.json')
      const args = [pythonScript, rulesFile, ...part_files]

      console.log('[自动装配] 执行命令:', 'python3', args.join(' '))

      const pythonProcess = spawn('python3', args)

      let outputData = ''
      let errorData = ''

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString()
        console.log('[Python输出]:', data.toString())
      })

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString()
        console.error('[Python错误]:', data.toString())
      })

      await new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Python进程退出码: ${code}\n错误信息: ${errorData}`))
          }
        })
      })

      // 2. 读取生成的装配报告
      const fs = require('fs').promises
      const reportPath = path.join(__dirname, '../../assembly_output.json')
      const reportData = await fs.readFile(reportPath, 'utf-8')
      const report = JSON.parse(reportData)

      console.log('[自动装配] 报告解析成功:', {
        parts: report.metadata.total_parts,
        steps: report.metadata.total_steps
      })

      // 3. 保存装配步骤到数据库
      const db = require('../config/database')
      const steps = report.assembly_steps

      // 清空旧步骤
      await db('assembly_design_steps')
        .where({ design_id: designId })
        .delete()

      // 插入新步骤
      for (const step of steps) {
        await db('assembly_design_steps').insert({
          id: `step_${designId}_${step.step_number}_${Date.now()}`,
          design_id: designId,
          step_number: step.step_number,
          description: step.description,
          operation_type: step.mate_type,
          part_a: step.part_id,
          part_b: step.reference_part_id,
          parameters: JSON.stringify({
            position: step.position,
            rotation: step.rotation
          }),
          notes: step.notes,
          created_at: db.fn.now()
        })
      }

      // 4. 更新设计状态
      await db('assembly_designs')
        .where({ id: designId })
        .update({
          steps_count: steps.length,
          status: 'pending_review',
          updated_at: db.fn.now()
        })

      console.log(`[自动装配成功] 设计${designId}生成${steps.length}个装配步骤`)

      res.json({
        success: true,
        message: `✅ 自动装配完成，生成${steps.length}个步骤`,
        data: {
          design_id: designId,
          steps_count: steps.length,
          parts_count: report.metadata.total_parts,
          steps: steps,
          report_url: `/api/assembly/designs/${designId}/report`
        }
      })

    } catch (error) {
      console.error('[自动装配失败]:', error)
      res.status(500).json({
        success: false,
        message: '自动装配失败: ' + error.message
      })
    }
  }

  /**
   * 获取装配报告
   */
  getAssemblyReport = async (req, res) => {
    try {
      const { id } = req.params
      const db = require('../config/database')

      const design = await db('assembly_designs').where({ id }).first()

      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      const steps = await db('assembly_design_steps')
        .where({ design_id: id })
        .orderBy('step_number', 'asc')

      const report = {
        design: {
          id: design.id,
          design_name: design.design_name,
          project_name: design.project_name,
          status: design.status,
          steps_count: design.steps_count,
          model_3d_path: design.model_3d_path
        },
        steps: steps.map(s => ({
          step_number: s.step_number,
          description: s.description,
          mate_type: s.operation_type,
          part_a: s.part_a,
          part_b: s.part_b,
          parameters: JSON.parse(s.parameters || '{}'),
          notes: s.notes
        }))
      }

      res.json({
        success: true,
        data: report
      })

    } catch (error) {
      console.error('[获取装配报告失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 获取零件库列表
   */
  getPartLibrary = async (req, res) => {
    try {
      const path = require('path')
      const fs = require('fs').promises

      const solidworksDir = path.join(__dirname, '../../../../docs/solidworks')

      // 读取目录中的所有STEP文件（排除装配体A开头的）
      const files = await fs.readdir(solidworksDir)
      const partFiles = files.filter(f =>
        (f.endsWith('.STEP') || f.endsWith('.step')) &&
        !f.startsWith('A')  // 排除装配体
      )

      const parts = partFiles.map((filename, index) => ({
        id: filename.replace('.STEP', '').replace('.step', ''),
        name: filename,
        filepath: path.join(solidworksDir, filename),
        type: this._guessPartType(filename),
        index: index
      }))

      console.log(`[零件库] 加载${parts.length}个零件`)

      res.json({
        success: true,
        data: parts,
        count: parts.length
      })

    } catch (error) {
      console.error('[获取零件库失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 根据文件名猜测零件类型
   */
  _guessPartType(filename) {
    const name = filename.toUpperCase()

    if (name.includes('FLANGE') || name.startsWith('P')) {
      return 'flange'
    } else if (name.includes('VALVE') || name.includes('101')) {
      return 'valve'
    } else if (name.includes('PIPE')) {
      return 'pipe'
    } else if (name.includes('100001')) {
      return 'gasket'
    } else if (name.includes('BOLT') || name.includes('SCREW')) {
      return 'bolt'
    }

    return 'component'
  }

  /**
   * 下载3D模型
   */
  downloadModel = async (req, res) => {
    try {
      const { id } = req.params
      const path = require('path')
      const fs = require('fs')
      const db = require('../config/database')

      const design = await db('assembly_designs')
        .where({ id })
        .first()

      if (!design) {
        return res.status(404).json({
          success: false,
          message: '设计不存在'
        })
      }

      if (!design.model_3d_path) {
        return res.status(404).json({
          success: false,
          message: '该设计没有3D模型'
        })
      }

      const filePath = path.join(__dirname, '../../', design.model_3d_path)

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        })
      }

      const fileName = path.basename(filePath)
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('[下载失败]:', err)
        }
      })
    } catch (error) {
      console.error('[下载3D模型失败]:', error)
      res.status(500).json({
        success: false,
        message: '下载失败: ' + error.message
      })
    }
  }

  /**
   * 获取学习到的规则（从 assembly_rules.json）
   */
  getLearnedRules = async (req, res) => {
    try {
      const path = require('path')
      const fs = require('fs').promises

      const rulesFile = path.join(__dirname, '../../../../docs/assembly_rules.json')

      // 检查文件是否存在
      try {
        await fs.access(rulesFile)
      } catch {
        // 文件不存在，返回空数组
        return res.json({
          success: true,
          data: [],
          message: '规则文件不存在，请先进行规则学习'
        })
      }

      // 读取规则文件
      const content = await fs.readFile(rulesFile, 'utf-8')
      const rulesData = JSON.parse(content)

      // 转换规则格式
      const learnedRules = (rulesData.rules || []).map(rule => ({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        description: rule.description || '',
        priority: rule.priority || 5,
        constraint_type: rule.constraint_type,
        condition: rule.condition,
        action: rule.action,
        confidence: rule.confidence || null,
        sample_count: rule.sample_count || null
      }))

      console.log(`[学习规则] 加载 ${learnedRules.length} 条规则`)

      res.json({
        success: true,
        data: learnedRules,
        count: learnedRules.length
      })

    } catch (error) {
      console.error('[获取学习规则失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 触发规则学习（执行Python脚本）
   */
  learnRules = async (req, res) => {
    try {
      const path = require('path')
      const { spawn } = require('child_process')

      const extractScript = path.join(__dirname, '../services/extract_assembly_rules.py')
      const solidworksDir = path.join(__dirname, '../../../../docs/solidworks')
      const outputFile = path.join(__dirname, '../../../../docs/assembly_rules.json')

      console.log(`[规则学习] 开始学习...`)
      console.log(`[规则学习] 脚本: ${extractScript}`)
      console.log(`[规则学习] 输入目录: ${solidworksDir}`)
      console.log(`[规则学习] 输出文件: ${outputFile}`)

      // 执行Python脚本
      const python = spawn('python3', [extractScript, solidworksDir, outputFile])

      let stdout = ''
      let stderr = ''

      python.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log('[Python学习]:', data.toString())
      })

      python.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error('[Python错误]:', data.toString())
      })

      python.on('close', async (code) => {
        if (code === 0) {
          try {
            // 读取生成的规则文件
            const fs = require('fs').promises
            const content = await fs.readFile(outputFile, 'utf-8')
            const rulesData = JSON.parse(content)
            const rules = rulesData.rules || []

            console.log(`[规则学习] ✅ Python提取完成，共${rules.length}条规则`)
            console.log(`[规则学习] 开始保存到数据库...`)

            // 🆕 保存规则到assembly_rules表
            let savedCount = 0
            let skippedCount = 0

            for (const rule of rules) {
              try {
                // 检查规则是否已存在
                const existing = await db('assembly_rules')
                  .where({ rule_id: rule.rule_id })
                  .first()

                if (existing) {
                  // 更新已有规则
                  await db('assembly_rules')
                    .where({ rule_id: rule.rule_id })
                    .update({
                      name: rule.description || rule.type,
                      description: JSON.stringify(rule),
                      priority: this._calculatePriority(rule),
                      constraint_type: this._mapToConstraintType(rule.type),
                      condition_logic: this._buildConditionLogic(rule),
                      action_template: this._buildActionTemplate(rule),
                      confidence_boost: rule.confidence === 'high' ? 0.3 : (rule.confidence === 'medium' ? 0.15 : 0),
                      learned_from: 'step_analysis',
                      updated_at: new Date()
                    })
                  skippedCount++
                  console.log(`  🔄 更新规则: ${rule.rule_id}`)
                } else {
                  // 插入新规则
                  await db('assembly_rules').insert({
                    rule_id: rule.rule_id,
                    name: rule.description || rule.type,
                    description: JSON.stringify(rule),
                    priority: this._calculatePriority(rule),
                    constraint_type: this._mapToConstraintType(rule.type),
                    condition_logic: this._buildConditionLogic(rule),
                    action_template: this._buildActionTemplate(rule),
                    is_active: true,
                    learned_from: 'step_analysis',
                    confidence_boost: rule.confidence === 'high' ? 0.3 : (rule.confidence === 'medium' ? 0.15 : 0),
                    usage_count: 0,
                    success_count: 0,
                    created_by: req.user?.username || 'system'
                  })
                  savedCount++
                  console.log(`  ✅ 新增规则: ${rule.rule_id}`)
                }
              } catch (err) {
                console.error(`  ❌ 保存规则失败 ${rule.rule_id}:`, err.message)
              }
            }

            console.log(`[规则学习] 💾 数据库保存完成: 新增${savedCount}条, 更新${skippedCount}条`)

            res.json({
              success: true,
              message: '规则学习完成并保存到数据库',
              rules_count: rules.length,
              saved_count: savedCount,
              updated_count: skippedCount,
              statistics: rulesData.statistics,
              output: stdout
            })
          } catch (error) {
            console.error('[规则学习] 读取或保存规则失败:', error)
            res.status(500).json({
              success: false,
              message: '规则学习失败: ' + error.message
            })
          }
        } else {
          console.error(`[规则学习] ❌ Python脚本退出码: ${code}`)
          res.status(500).json({
            success: false,
            message: `规则学习失败 (exit code: ${code})`,
            error: stderr
          })
        }
      })

    } catch (error) {
      console.error('[规则学习失败]:', error)
      res.status(500).json({
        success: false,
        message: '启动学习失败: ' + error.message
      })
    }
  }

  /**
   * 🆕 计算规则优先级
   */
  _calculatePriority(rule) {
    if (rule.type === 'mate_type_frequency') {
      // 配合类型频率规则：概率越高，优先级越高
      return Math.min(Math.floor(rule.probability * 20), 10)
    } else if (rule.type === 'typical_distance') {
      // 距离规则：出现次数越多，优先级越高
      return Math.min(Math.floor(rule.occurrences / 10), 10)
    } else if (rule.type === 'axis_alignment') {
      return 7
    }
    return 5
  }

  /**
   * 🆕 映射规则类型到约束类型
   */
  _mapToConstraintType(ruleType) {
    const mapping = {
      'mate_type_frequency': 'GENERIC',
      'typical_distance': 'DISTANCE',
      'axis_alignment': 'AXIS_ALIGN'
    }
    return mapping[ruleType] || 'GENERIC'
  }

  /**
   * 🆕 构建条件逻辑（JSONB）
   */
  _buildConditionLogic(rule) {
    if (rule.type === 'mate_type_frequency') {
      return {
        mate_type: rule.mate_type,
        min_probability: rule.probability
      }
    } else if (rule.type === 'typical_distance') {
      return {
        distance_range: {
          min: rule.distance_mm - (rule.std_dev || 10),
          max: rule.distance_mm + (rule.std_dev || 10)
        }
      }
    } else if (rule.type === 'axis_alignment') {
      return {
        preferred_axis: rule.axis
      }
    }
    return {}
  }

  /**
   * 🆕 构建动作模板（JSONB）
   */
  _buildActionTemplate(rule) {
    if (rule.type === 'mate_type_frequency') {
      return {
        constraint_type: rule.mate_type.toUpperCase(),
        parameters: {}
      }
    } else if (rule.type === 'typical_distance') {
      return {
        constraint_type: 'DISTANCE',
        parameters: {
          distance: rule.distance_mm,
          tolerance: rule.std_dev || 5
        }
      }
    } else if (rule.type === 'axis_alignment') {
      return {
        constraint_type: 'AXIS_ALIGN',
        parameters: {
          axis: rule.axis
        }
      }
    }
    return {}
  }

  /**
   * @route GET /api/assembly/:taskId/visualization
   * @desc 获取装配任务的3D可视化数据
   */
  getAssemblyVisualization = async (req, res) => {
    try {
      const { taskId } = req.params

      console.log(`[AssemblyController] 获取装配可视化: ${taskId}`)

      const visualization = await assembly3DService.generateAssemblyVisualization(taskId)

      res.json({
        success: true,
        data: visualization
      })
    } catch (error) {
      console.error('[AssemblyController] 获取3D可视化失败:', error)
      res.status(500).json({
        success: false,
        message: error.message || '获取3D可视化失败'
      })
    }
  }

  /**
   * PID → 装配图完整流程 (MVP)
   * POST /api/assembly/pid-to-3d
   */
  pidTo3D = async (req, res) => {
    try {
      const { pid_result_id, mock_data, line_class } = req.body

      let pidTopology, components

      if (mock_data) {
        // Mock data mode - use provided test data
        console.log('[pidTo3D] 使用Mock数据模式')
        pidTopology = { nodes: mock_data.nodes || [], edges: mock_data.edges || [] }
        components = (mock_data.nodes || [])
          .filter(n => n.type !== 'start' && n.type !== 'end')
          .map(n => ({
            id: n.id,
            type: n.type,
            component_type: n.type,
            tag: n.id.toUpperCase(),
            dn: n.dn || 50,
            pn: n.pn || 16
          }))
      } else {
        // Real PID result mode
        if (!pid_result_id) {
          return res.status(400).json({
            success: false,
            message: '缺少PID识别结果ID'
          })
        }

        // 1. 获取PID识别结果
        const pidResult = await db('pid_recognition_results')
          .where({ id: pid_result_id })
          .first()

        if (!pidResult) {
          return res.status(404).json({ success: false, message: 'PID结果不存在' })
        }

        pidTopology = typeof pidResult.graph_analysis === 'string'
          ? JSON.parse(pidResult.graph_analysis)
          : (pidResult.graph_analysis || {})
        components = typeof pidResult.components === 'string'
          ? JSON.parse(pidResult.components)
          : (pidResult.components || [])
      }

      // 2. 获取LineClass标准映射
      const stdMapping = await partsCatalog.getStandardMapping(line_class || 'LC-A1')

      // 3. 属性推断与零件选择
      const selectedParts = []
      const uncertainties = []

      for (const comp of components) {
        const attrs = {
          family: comp.type || comp.component_type,
          dn: comp.dn || comp.size,
          pn: comp.pn || stdMapping?.pn || 16,
          end_type: comp.end_type || stdMapping?.end_type || 'flanged',
          face_type: comp.face_type || stdMapping?.face_type || 'rf',
          mat: comp.material || stdMapping?.mat,
          std: comp.standard || stdMapping?.std
        }

        try {
          const selection = await partsCatalog.selectPart(attrs)

          selectedParts.push({
            ...comp,
            ...selection.part,
            selection_score: selection.score,
            selection_uncertain: selection.uncertain,
            alternatives: selection.alternatives
          })

          if (selection.uncertain) {
            uncertainties.push({
              component: comp.tag || comp.id,
              selected: selection.part.part_id,
              score: selection.score,
              alternatives: selection.alternatives
            })
          }
        } catch (error) {
          console.warn(`[pidTo3D] 零件选择失败: ${comp.tag}`, error.message)
        }
      }

      // 4. 连接模板匹配 + 自动添加紧固件
      const templates = []
      const fastenerParts = []  // 存储紧固件

      for (let i = 0; i < selectedParts.length - 1; i++) {
        const partA = selectedParts[i]
        const partB = selectedParts[i + 1]

        if (Math.abs((partA.dn || 0) - (partB.dn || 0)) <= 1) {
          try {
            const template = await partsCatalog.getConnectionTemplate(
              partA.family,
              partB.family,
              { dn: partA.dn, pn: partA.pn, end_type: partA.end_type, face_type: partA.face_type }
            )
            templates.push(template)

            console.log(`[pidTo3D] 模板匹配成功: ${partA.family}↔${partB.family}`)
            console.log(`[pidTo3D] 模板数据:`, JSON.stringify(template, null, 2))

            // 如果模板包含紧固件，自动添加螺栓和垫片
            if (template.fasteners) {
              console.log(`[pidTo3D] 发现紧固件规格:`, template.fasteners)
              const fasteners = typeof template.fasteners === 'string'
                ? JSON.parse(template.fasteners)
                : template.fasteners

              // 添加螺栓
              if (fasteners.bolt_count && fasteners.bolt_spec) {
                try {
                  const bolt = await db('parts_catalog')
                    .where({ family: 'bolt' })
                    .where('part_id', 'like', `%${fasteners.bolt_spec}%`)
                    .first()

                  if (bolt) {
                    console.log(`[pidTo3D] 找到螺栓:`, bolt.part_id, `数量: ${fasteners.bolt_count}`)
                    fastenerParts.push({
                      ...bolt,
                      quantity: fasteners.bolt_count,
                      role: 'fastener',
                      connection_id: `${partA.tag || partA.id}-${partB.tag || partB.id}`
                    })
                  } else {
                    console.log(`[pidTo3D] 未找到螺栓: ${fasteners.bolt_spec}`)
                  }
                } catch (err) {
                  console.warn(`[pidTo3D] 查询螺栓失败: ${fasteners.bolt_spec}`, err)
                }
              }

              // 添加垫片
              if (fasteners.gasket) {
                try {
                  const gasket = await db('parts_catalog')
                    .where({ family: 'gasket' })
                    .where(qb => {
                      qb.where({ part_id: fasteners.gasket })
                        .orWhere('part_id', 'like', `%DN${partA.dn}%RF%`)
                    })
                    .first()

                  if (gasket) {
                    console.log(`[pidTo3D] 找到垫片:`, gasket.part_id)
                    fastenerParts.push({
                      ...gasket,
                      quantity: 1,
                      role: 'seal',
                      connection_id: `${partA.tag || partA.id}-${partB.tag || partB.id}`
                    })
                  } else {
                    console.log(`[pidTo3D] 未找到垫片: ${fasteners.gasket}`)
                  }
                } catch (err) {
                  console.warn(`[pidTo3D] 查询垫片失败: ${fasteners.gasket}`, err)
                }
              }
            }
          } catch (error) {
            console.warn(`[pidTo3D] 连接模板缺失: ${partA.family}↔${partB.family}`)
          }
        }
      }

      // 合并主零件和紧固件
      const allParts = [...selectedParts, ...fastenerParts]
      console.log(`[pidTo3D] 零件汇总: 主零件${selectedParts.length}个, 紧固件${fastenerParts.length}个, 总计${allParts.length}个`)

      // 5. 位姿求解
      const layoutResult = await layoutSolver.solve(pidTopology, selectedParts, templates)

      // 5.5 使用真实装配位置计算器
      console.log('[pidTo3D] Step 5.5: 计算真实装配位置...')
      const positionCalculator = new AssemblyPositionCalculator()

      // 构建连接约束(基于 templates)
      const connections = templates.map((tmpl, idx) => {
        const partA = selectedParts[idx]
        const partB = selectedParts[idx + 1]
        return {
          id: `CONN-${idx + 1}`,
          from_tag: partA.tag || partA.id,
          to_tag: partB.tag || partB.id,
          type: 'connection',
          fasteners: tmpl.fasteners
        }
      })

      // 计算真实装配位置(包含主零件和自动生成的紧固件)
      const assemblyPlacements = positionCalculator.calculateAssemblyPositions(
        selectedParts,  // 只传主零件,紧固件由计算器生成
        connections
      )

      console.log(`[pidTo3D] 装配位置计算完成: ${assemblyPlacements.length} 个零件(含自动生成紧固件)`)

      // 替换 layoutResult 的 placements 为真实装配位置
      layoutResult.placements = assemblyPlacements

      // 更新 allParts 为包含计算器生成紧固件的完整列表
      const calculatedParts = assemblyPlacements.filter(p => !p.role || p.role === 'main')
      const calculatedFasteners = assemblyPlacements.filter(p => p.role === 'fastener' || p.role === 'seal')
      const finalAllParts = [...calculatedParts, ...calculatedFasteners]

      console.log(`[pidTo3D] 最终零件: 主零件${calculatedParts.length}个, 紧固件${calculatedFasteners.length}个, 总计${finalAllParts.length}个`)

      // 5.6 导出Three.js场景
      console.log('[pidTo3D] Step 5.6: 导出Three.js场景...')
      const AssemblyExporter = require('../services/assembly/AssemblyExporter')
      const fs = require('fs')
      const path = require('path')

      const threeJSScene = AssemblyExporter.exportToThreeJS(layoutResult.placements, finalAllParts)

      // 保存到文件
      const assemblyOutputDir = path.join(__dirname, '../../uploads/assembly_output')
      fs.mkdirSync(assemblyOutputDir, {recursive: true})
      const assemblyFile = path.join(assemblyOutputDir, `assembly_${require('uuid').v4()}.json`)
      fs.writeFileSync(assemblyFile, JSON.stringify(threeJSScene, null, 2))

      console.log(`[pidTo3D] ✅ Three.js场景已生成: ${assemblyFile}`)
      layoutResult.assembly_file = assemblyFile

      // 6. 五类校验（传入包含紧固件的完整零件列表）
      const validationReport = await validationService.validate(
        layoutResult.placements,
        templates,
        finalAllParts,  // 使用计算器生成的完整零件列表
        pidTopology
      )

      // 7. 创建装配任务
      const [taskId] = await db('assembly_inference_tasks').insert({
        user_id: req.user.id,
        user_name: req.user.username,
        pid_result_id,
        status: validationReport.overall_status === 'fail' ? 'failed' : 'completed',
        parts_count: finalAllParts.length,  // 包含主零件和紧固件的总数
        constraints_count: templates.length,
        solver_result: JSON.stringify({
          placements: layoutResult.placements,
          elevation_layers: layoutResult.elevation_layers,
          conflicts: layoutResult.conflicts,
          all_parts: finalAllParts  // 保存包括紧固件的完整零件列表
        })
      }).returning('id')

      // 8. 保存验证报告
      await db('assembly_validation_reports').insert({
        task_id: taskId.id || taskId,
        overall_status: validationReport.overall_status,
        checks: JSON.stringify(validationReport.checks),
        summary: JSON.stringify(validationReport.summary)
      })

      const nextSteps = []
      if (validationReport.overall_status === 'fail') nextSteps.push('❌ 修复校验失败项')
      if (uncertainties.length > 0) nextSteps.push(`⚠️ 确认${uncertainties.length}个不确定零件`)
      if (layoutResult.conflicts.length > 0) nextSteps.push(`🔧 处理${layoutResult.conflicts.length}个布局冲突`)
      if (nextSteps.length === 0) nextSteps.push('✅ 导出STEP + BOM')

      res.json({
        success: true,
        task_id: taskId.id || taskId,
        parts: finalAllParts.length,  // 包含主零件+紧固件的总数
        main_parts: calculatedParts.length,  // 主零件数
        fasteners: calculatedFasteners.length,  // 紧固件数
        placements: layoutResult.placements.length,
        validation: validationReport.summary,
        uncertainties,
        conflicts: layoutResult.conflicts,
        next_steps: nextSteps
      })

    } catch (error) {
      console.error('[pidTo3D] 失败:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  }

  /**
   * 导出STEP + BOM + 报告
   * GET /api/assembly/export/:taskId
   */
  exportAssemblyData = async (req, res) => {
    try {
      const { taskId } = req.params
      const { format } = req.query  // step | bom | report | all

      const task = await db('assembly_inference_tasks')
        .where({ id: taskId })
        .first()

      if (!task) {
        return res.status(404).json({ success: false, message: '任务不存在' })
      }

      const solverResult = typeof task.solver_result === 'string'
        ? JSON.parse(task.solver_result)
        : (task.solver_result || {})
      const placements = solverResult.placements || []
      const allParts = solverResult.all_parts || []  // 包含紧固件的完整列表

      if (format === 'bom' || format === 'all') {
        const rows = [['序号', '零件编号', '名称', '规格', '数量', '角色', 'X', 'Y', 'Z']]

        // 主零件（有位姿）
        placements.forEach((p, i) => {
          rows.push([
            i + 1,
            p.part_number || '',
            p.type || p.family || '',
            `DN${p.dn || ''} PN${p.pn || ''}`,
            1,
            '主零件',
            (p.position?.x || 0).toFixed(2),
            (p.position?.y || 0).toFixed(2),
            (p.position?.z || 0).toFixed(2)
          ])
        })

        // 紧固件（无独立位姿）
        const fasteners = allParts.filter(p => p.role === 'fastener' || p.role === 'seal')
        let fastenerIndex = placements.length + 1
        fasteners.forEach(f => {
          rows.push([
            fastenerIndex++,
            f.part_id || '',
            f.family || f.type || '',
            f.part_id || `DN${f.dn || ''} PN${f.pn || ''}`,
            f.quantity || 1,
            f.role === 'fastener' ? '螺栓' : '垫片',
            '-',
            '-',
            '-'
          ])
        })

        const bomCsv = rows.map(r => r.join(',')).join('\n')

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="BOM_${taskId}.csv"`)
        return res.send('\uFEFF' + bomCsv)  // UTF-8 BOM
      }

      if (format === 'report' || format === 'all') {
        const report = await db('assembly_validation_reports')
          .where({ task_id: taskId })
          .first()

        const checks = typeof report?.checks === 'string'
          ? JSON.parse(report.checks)
          : (report?.checks || [])
        const summary = typeof report?.summary === 'string'
          ? JSON.parse(report.summary)
          : (report?.summary || {})

        return res.json({
          task_id: taskId,
          validation: checks,
          summary: summary,
          build_info: {
            timestamp: task.created_at,
            catalog_version: task.catalog_version || 'v1.0.0',
            templates_version: task.templates_version || 'v1.0.0'
          }
        })
      }

      // Default: Return assembly JSON with STEP data embedded
      const path = require('path')
      const fs = require('fs').promises
      const solidworksDir = path.join(__dirname, '../../../../docs/solidworks')

      const parts = await Promise.all(placements.map(async (p, i) => {
        const partNumber = p.part_number || p.part_id
        const modelFile = path.join(solidworksDir, `${partNumber}.STEP`)

        let stepData = null
        try {
          stepData = await fs.readFile(modelFile, 'utf-8')
        } catch (err) {
          console.error(`[exportAssemblyData] 无法读取STEP文件: ${modelFile}`, err.message)
        }

        return {
          id: `part_${i}`,
          part_number: partNumber,
          type: p.type || p.family || 'unknown',
          model_file: modelFile,
          position: [
            p.position?.x || 0,
            p.position?.y || 0,
            p.position?.z || 0
          ],
          rotation: p.rotation || [[1,0,0],[0,1,0],[0,0,1]],
          step_data: stepData
        }
      }))

      res.json({
        task_id: taskId,
        parts: parts.filter(p => p.step_data !== null), // Only include parts with valid STEP data
        constraints: solverResult.constraints || [],
        metadata: {
          timestamp: task.created_at,
          catalog_version: task.catalog_version || 'v1.0.0',
          templates_version: task.templates_version || 'v1.0.0'
        }
      })

    } catch (error) {
      console.error('[exportAssemblyData] 失败:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  }

  /**
   * 从STEP装配文件生成装配图
   * POST /api/assembly/generate-from-step
   */
  generateFromStep = async (req, res) => {
    try {
      const { assembly_file } = req.body

      if (!assembly_file) {
        return res.status(400).json({
          success: false,
          message: '缺少assembly_file参数'
        })
      }

      const RuleBasedAssemblyGenerator = require('../services/assembly/RuleBasedAssemblyGenerator')
      const path = require('path')

      const assemblyPath = path.join(__dirname, '../../../../docs/solidworks', assembly_file)

      console.log('[装配生成] 开始生成装配图:', assemblyPath)

      const assembly = await RuleBasedAssemblyGenerator.generateFromStepAssembly(assemblyPath)

      const threeJSON = RuleBasedAssemblyGenerator.exportToThreeJS()

      const fs = require('fs').promises
      const outputPath = path.join(__dirname, '../../../web/public/assembly.json')
      await fs.writeFile(outputPath, JSON.stringify(threeJSON, null, 2))

      console.log('[装配生成] ✅ 装配图已生成:', outputPath)

      res.json({
        success: true,
        message: '装配图生成成功',
        data: {
          assembly,
          viewer_url: '/test-viewer.html'
        }
      })
    } catch (error) {
      console.error('[装配生成失败]:', error)
      res.status(500).json({
        success: false,
        message: '装配生成失败: ' + error.message
      })
    }
  }

  // ========== 历史案例学习 ==========

  /**
   * 上传历史BOM样本
   */
  async uploadHistoricalBOM(req, res) {
    try {
      const { project_name, description } = req.body
      const files = req.files

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请上传至少一个BOM文件'
        })
      }

      console.log(`[历史案例学习] 收到${files.length}个BOM文件`)

      const XLSX = require('xlsx')
      const historicalCases = []

      // 解析每个BOM文件
      for (const file of files) {
        try {
          const workbook = XLSX.read(file.buffer, { type: 'buffer' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const bomData = XLSX.utils.sheet_to_json(sheet)

          const historicalCase = {
            file_name: file.originalname,
            project_name: project_name || file.originalname,
            description: description || '',
            upload_date: new Date(),
            bom_items: bomData.map(row => ({
              part_number: row['图号'] || row['零件编号'] || row['part_number'] || '',
              part_name: row['名称'] || row['零件名称'] || row['name'] || '',
              specification: row['规格'] || row['spec'] || '',
              material: row['材质'] || row['material'] || '',
              quantity: parseInt(row['数量'] || row['quantity'] || 1),
              unit: row['单位'] || row['unit'] || '个',
              remark: row['备注'] || row['remark'] || ''
            }))
          }

          historicalCases.push(historicalCase)

          console.log(`[历史案例] 解析完成: ${file.originalname}, ${bomData.length}个零件`)
        } catch (parseError) {
          console.error(`[历史案例] 解析失败 ${file.originalname}:`, parseError.message)
        }
      }

      // 保存到数据库
      const savedCases = await Promise.all(
        historicalCases.map(async (caseData) => {
          const result = await db.query(`
            INSERT INTO historical_cases
            (project_name, description, bom_data, uploaded_by, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, project_name, created_at
          `, [
            caseData.project_name,
            caseData.description,
            JSON.stringify(caseData.bom_items),
            req.user.id
          ])
          return result.rows[0]
        })
      )

      res.json({
        success: true,
        message: `成功上传${savedCases.length}个历史案例`,
        data: {
          uploaded_count: savedCases.length,
          cases: savedCases
        }
      })
    } catch (error) {
      console.error('[历史案例上传失败]:', error)
      res.status(500).json({
        success: false,
        message: '上传失败: ' + error.message
      })
    }
  }

  /**
   * 获取历史案例列表
   */
  async getHistoricalCases(req, res) {
    try {
      const result = await db.query(`
        SELECT
          id,
          project_name,
          description,
          jsonb_array_length(bom_data) as item_count,
          uploaded_by,
          created_at
        FROM historical_cases
        ORDER BY created_at DESC
      `)

      res.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      console.error('[获取历史案例失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 分析配套模式 - 从历史BOM中统计学习
   */
  async analyzeMatchingPatterns(req, res) {
    try {
      console.log('[配套模式分析] 开始统计分析...')

      // 获取所有历史案例
      const casesResult = await db.query(`
        SELECT id, project_name, bom_data
        FROM historical_cases
        ORDER BY created_at DESC
      `)

      const cases = casesResult.rows

      if (cases.length === 0) {
        return res.json({
          success: false,
          message: '没有历史案例数据,请先上传BOM样本'
        })
      }

      console.log(`[配套模式] 分析${cases.length}个历史案例...`)

      // 统计配套模式
      const patterns = this._analyzeCoOccurrencePatterns(cases)

      // 生成配套规则
      const matchingRules = this._generateMatchingRules(patterns)

      // 保存规则到数据库
      const savedRules = await Promise.all(
        matchingRules.map(async (rule) => {
          const result = await db.query(`
            INSERT INTO design_rules
            (rule_id, rule_name, rule_type, condition_data, action_data,
             source, confidence, sample_count, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (rule_id) DO UPDATE SET
              confidence = $7,
              sample_count = $8,
              updated_at = NOW()
            RETURNING rule_id, rule_name, confidence
          `, [
            rule.rule_id,
            rule.rule_name,
            'matching',
            JSON.stringify(rule.condition),
            JSON.stringify(rule.action),
            'learned_from_history',
            rule.confidence,
            rule.sample_count
          ])
          return result.rows[0]
        })
      )

      res.json({
        success: true,
        message: `分析完成,生成${savedRules.length}条配套规则`,
        data: {
          analyzed_cases: cases.length,
          rules_generated: savedRules.length,
          rules: savedRules
        }
      })
    } catch (error) {
      console.error('[配套模式分析失败]:', error)
      res.status(500).json({
        success: false,
        message: '分析失败: ' + error.message
      })
    }
  }

  /**
   * 获取配套规则
   */
  async getMatchingRules(req, res) {
    try {
      const result = await db.query(`
        SELECT
          rule_id,
          rule_name,
          rule_type,
          condition_data,
          action_data,
          source,
          confidence,
          sample_count,
          created_at
        FROM design_rules
        WHERE rule_type = 'matching'
        ORDER BY confidence DESC, sample_count DESC
      `)

      res.json({
        success: true,
        data: result.rows
      })
    } catch (error) {
      console.error('[获取配套规则失败]:', error)
      res.status(500).json({
        success: false,
        message: '获取失败: ' + error.message
      })
    }
  }

  /**
   * 分析共现模式(内部方法)
   */
  _analyzeCoOccurrencePatterns(cases) {
    const patterns = {}

    // 关键词识别
    const mainPartKeywords = ['阀门', '球阀', '闸阀', '截止阀', '泵', '离心泵', '齿轮泵']
    const flangeKeywords = ['法兰', 'flange']
    const boltKeywords = ['螺栓', '螺钉', 'bolt']
    const nutKeywords = ['螺母', 'nut']
    const gasketKeywords = ['垫片', 'gasket']

    for (const caseData of cases) {
      const bom = caseData.bom_data

      // 查找主件
      for (const item of bom) {
        const itemName = (item.part_name || '').toLowerCase()
        const itemSpec = (item.specification || '').toLowerCase()

        // 判断是否为主件
        let isMainPart = false
        let mainPartType = ''
        let dn = this._extractDN(itemSpec)

        for (const keyword of mainPartKeywords) {
          if (itemName.includes(keyword)) {
            isMainPart = true
            mainPartType = keyword
            break
          }
        }

        if (!isMainPart || !dn) continue

        // 查找配套的法兰
        const flanges = bom.filter(part => {
          const name = (part.part_name || '').toLowerCase()
          const spec = (part.specification || '').toLowerCase()
          return flangeKeywords.some(kw => name.includes(kw)) &&
                 this._extractDN(spec) === dn
        })

        if (flanges.length > 0) {
          const key = `${mainPartType}_DN${dn}_needs_flanges`
          if (!patterns[key]) {
            patterns[key] = {
              main_part_type: mainPartType,
              dn: dn,
              matching_parts: [],
              count: 0
            }
          }
          patterns[key].count++
          patterns[key].matching_parts.push({
            type: '法兰',
            spec: `DN${dn}`,
            quantity: flanges.length
          })
        }

        // 查找配套的螺栓
        const bolts = bom.filter(part => {
          const name = (part.part_name || '').toLowerCase()
          return boltKeywords.some(kw => name.includes(kw))
        })

        if (bolts.length > 0) {
          const key = `${mainPartType}_DN${dn}_needs_bolts`
          if (!patterns[key]) {
            patterns[key] = {
              main_part_type: mainPartType,
              dn: dn,
              matching_parts: [],
              count: 0
            }
          }
          patterns[key].count++

          const boltSpec = this._extractThreadSpec(bolts[0].specification || '')
          patterns[key].matching_parts.push({
            type: '螺栓',
            spec: boltSpec,
            quantity: bolts.reduce((sum, b) => sum + (b.quantity || 1), 0)
          })
        }
      }
    }

    console.log(`[配套模式] 发现${Object.keys(patterns).length}个配套模式`)
    return patterns
  }

  /**
   * 生成配套规则(内部方法)
   */
  _generateMatchingRules(patterns) {
    const rules = []
    const totalCases = Object.values(patterns)[0]?.count || 1

    for (const [key, pattern] of Object.entries(patterns)) {
      // 只保留出现频率>=50%的模式
      const confidence = pattern.count / totalCases
      if (confidence < 0.5) continue

      // 计算配套件的平均数量
      const avgMatching = {}
      for (const part of pattern.matching_parts) {
        if (!avgMatching[part.type]) {
          avgMatching[part.type] = { spec: part.spec, quantity: 0, count: 0 }
        }
        avgMatching[part.type].quantity += part.quantity
        avgMatching[part.type].count++
      }

      const addParts = Object.entries(avgMatching).map(([type, data]) => ({
        type,
        spec: data.spec,
        quantity: Math.round(data.quantity / data.count),
        reasoning: `统计${pattern.count}个案例,平均配套数量`
      }))

      rules.push({
        rule_id: `LEARNED_${key.toUpperCase()}`,
        rule_name: `${pattern.main_part_type}DN${pattern.dn}配套规则`,
        rule_type: 'matching',
        condition: {
          part_type: pattern.main_part_type,
          dn: pattern.dn
        },
        action: {
          add_parts: addParts
        },
        confidence: Math.min(0.95, confidence),
        sample_count: pattern.count
      })
    }

    return rules
  }

  /**
   * 提取DN口径(内部方法)
   */
  _extractDN(text) {
    if (!text) return null
    const match = text.match(/DN\s*(\d+)/i) || text.match(/dn\s*(\d+)/i)
    return match ? parseInt(match[1]) : null
  }

  /**
   * 提取螺纹规格(内部方法)
   */
  _extractThreadSpec(text) {
    if (!text) return 'M16'
    const match = text.match(/M(\d+)/i)
    return match ? `M${match[1]}` : 'M16'
  }
}

module.exports = new AssemblyController()
