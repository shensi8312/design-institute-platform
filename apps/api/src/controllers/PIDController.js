const PIDRecognitionService = require('../services/pid/PIDRecognitionService')
const PIDRecognitionVLService = require('../services/pid/PIDRecognitionVLService')
const PIDTopologyLearner = require('../services/learning/PIDTopologyLearner')
const db = require('../config/database')

const pidService = new PIDRecognitionService()
const pidVLService = new PIDRecognitionVLService()

class PIDController {
  /**
   * 识别PID图纸
   */
  async recognizePID(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传PID文件'
        })
      }

      // 获取识别方法和切片模式参数
      const method = req.query.method || process.env.PID_RECOGNITION_METHOD || 'qwenvl'
      const tiling = req.query.tiling === 'true' || req.query.tiling === '1'

      console.log(`[PID Controller] 开始识别: ${req.file.originalname} (方法: ${method}, 切片: ${tiling})`)

      let result

      if (tiling && method === 'qwenvl') {
        // 使用切片识别模式
        result = await pidVLService.recognizePIDWithTiling(req.file.buffer, req.file.originalname)
      } else if (method === 'ocr') {
        // 使用OCR+QwenVL两阶段增强识别
        result = await pidVLService.recognizePIDWithOCR(req.file.buffer, req.file.originalname)
      } else if (method === 'qwenvl') {
        // 使用QWEN-VL多模态识别
        result = await pidVLService.recognizePID(req.file.buffer, req.file.originalname)
      } else {
        // 使用传统OpenCV识别
        result = await pidService.recognizePID(req.file.buffer, req.file.originalname)
      }

      // ⚠️ 暂时不保存到数据库，直接返回识别结果
      // 用户确认后再通过 /api/pid/save 保存
      console.log(`[PID Controller] 识别完成: ${(result.components || []).length} 个组件`)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[PID Controller] 识别失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 对比两种识别方法
   */
  async compareRecognitionMethods(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传PID文件'
        })
      }

      console.log(`[PID Controller] 对比识别方法: ${req.file.originalname}`)

      // 并行执行两种识别
      const [opencvResult, qwenvlResult] = await Promise.allSettled([
        pidService.recognizePID(req.file.buffer, req.file.originalname),
        pidVLService.recognizePID(req.file.buffer, req.file.originalname)
      ])

      res.json({
        success: true,
        data: {
          opencv: opencvResult.status === 'fulfilled' ? opencvResult.value : { error: opencvResult.reason.message },
          qwenvl: qwenvlResult.status === 'fulfilled' ? qwenvlResult.value : { error: qwenvlResult.reason.message },
          comparison: {
            opencv_components: opencvResult.status === 'fulfilled' ? opencvResult.value.components?.length : 0,
            qwenvl_components: qwenvlResult.status === 'fulfilled' ? qwenvlResult.value.components?.length : 0,
            opencv_connections: opencvResult.status === 'fulfilled' ? opencvResult.value.connections?.length : 0,
            qwenvl_connections: qwenvlResult.status === 'fulfilled' ? qwenvlResult.value.connections?.length : 0
          }
        }
      })
    } catch (error) {
      console.error('[PID Controller] 对比失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 保存PID识别结果
   */
  async saveRecognitionResult(req, res) {
    try {
      const {
        file_name,
        file_path,
        components = [],
        connections = [],
        visualization_urls = [],
        graph_analysis,
        page_count = 1,
        user_notes = ''
      } = req.body

      if (!file_name) {
        return res.status(400).json({
          success: false,
          message: '缺少文件名'
        })
      }

      if (!components || components.length === 0) {
        return res.status(400).json({
          success: false,
          message: '识别结果为空，无法保存'
        })
      }

      console.log(`[PID Controller] 保存识别结果: ${file_name}, ${components.length} 个组件`)

      const [result] = await db('pid_recognition_results')
        .insert({
          file_name,
          file_path,
          components: JSON.stringify(components),
          connections: JSON.stringify(connections),
          visualization_urls: JSON.stringify(visualization_urls),
          graph_analysis: graph_analysis ? JSON.stringify(graph_analysis) : null,
          page_count,
          component_count: components.length,
          connection_count: connections.length,
          status: 'draft',
          user_notes,
          created_by: req.user.id,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')

      res.json({
        success: true,
        message: 'PID识别结果已保存',
        data: result
      })
    } catch (error) {
      console.error('[PID Controller] 保存失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 查询PID识别结果列表
   */
  async getRecognitionResults(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        created_by
      } = req.query

      const offset = (page - 1) * limit

      let query = db('pid_recognition_results')
        .select(
          'pid_recognition_results.*',
          'users.username as creator_name',
          'confirmer.username as confirmer_name'
        )
        .leftJoin('users', 'pid_recognition_results.created_by', 'users.id')
        .leftJoin('users as confirmer', 'pid_recognition_results.confirmed_by', 'confirmer.id')
        .orderBy('pid_recognition_results.created_at', 'desc')

      // 过滤条件
      if (status) {
        query = query.where('pid_recognition_results.status', status)
      }

      if (created_by) {
        query = query.whereRaw('pid_recognition_results.created_by::text = ?', [created_by])
      }

      // 如果不是管理员，只能查看自己的
      if (!req.user.isAdmin) {
        query = query.whereRaw('pid_recognition_results.created_by::text = ?', [req.user.id])
      }

      // 获取总数
      const [{ count }] = await query.clone().count('* as count')

      // 获取分页数据
      const results = await query.limit(limit).offset(offset)

      res.json({
        success: true,
        data: {
          items: results,
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      })
    } catch (error) {
      console.error('[PID Controller] 查询列表失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 查询单个PID识别结果
   */
  async getRecognitionResultById(req, res) {
    try {
      const { id } = req.params

      const result = await db('pid_recognition_results')
        .select(
          'pid_recognition_results.*',
          'users.username as creator_name',
          'confirmer.username as confirmer_name'
        )
        .leftJoin('users', 'pid_recognition_results.created_by', 'users.id')
        .leftJoin('users as confirmer', 'pid_recognition_results.confirmed_by', 'confirmer.id')
        .where('pid_recognition_results.id', id)
        .first()

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'PID识别结果不存在'
        })
      }

      // 权限检查：非管理员只能查看自己的
      if (!req.user.isAdmin && result.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此识别结果'
        })
      }

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[PID Controller] 查询详情失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 更新PID识别结果（确认/拒绝）
   */
  async updateRecognitionResult(req, res) {
    try {
      const { id } = req.params
      const { status, user_notes } = req.body

      if (!['draft', 'confirmed', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        })
      }

      // 检查记录是否存在
      const existing = await db('pid_recognition_results')
        .where({ id })
        .first()

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'PID识别结果不存在'
        })
      }

      // 权限检查
      if (!req.user.isAdmin && existing.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权修改此识别结果'
        })
      }

      const updateData = {
        status,
        user_notes,
        updated_at: new Date()
      }

      // 如果是确认状态，记录确认人和时间
      if (status === 'confirmed') {
        updateData.confirmed_by = req.user.id
        updateData.confirmed_at = new Date()
      }

      await db('pid_recognition_results')
        .where({ id })
        .update(updateData)

      const updated = await db('pid_recognition_results')
        .where({ id })
        .first()

      res.json({
        success: true,
        message: '更新成功',
        data: updated
      })
    } catch (error) {
      console.error('[PID Controller] 更新失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 删除PID识别结果
   */
  async deleteRecognitionResult(req, res) {
    try {
      const { id } = req.params

      const existing = await db('pid_recognition_results')
        .where({ id })
        .first()

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'PID识别结果不存在'
        })
      }

      // 权限检查：只有管理员或创建者可以删除
      if (!req.user.isAdmin && existing.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权删除此识别结果'
        })
      }

      await db('pid_recognition_results')
        .where({ id })
        .delete()

      res.json({
        success: true,
        message: '删除成功'
      })
    } catch (error) {
      console.error('[PID Controller] 删除失败:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 测试OCR连接
   */
  async testOCR(req, res) {
    try {
      const axios = require('axios')
      const ocrUrl = process.env.DOCUMENT_RECOGNITION_SERVICE || 'http://10.10.18.3:7000/ocr'

      const healthCheck = await axios.get(ocrUrl.replace('/ocr', '/health'), { timeout: 5000 })

      res.json({
        success: true,
        message: 'OCR服务正常',
        data: healthCheck.data
      })
    } catch (error) {
      res.json({
        success: false,
        message: 'OCR服务连接失败',
        error: error.message
      })
    }
  }

  /**
   * 将PID识别结果转为装配任务并应用规则推理
   */
  async createAssemblyFromPID(req, res) {
    const { pidResultId } = req.params
    const { taskName, description } = req.body

    try {
      // 1. 获取PID识别结果
      const pidResult = await db('pid_recognition_results')
        .where({ id: pidResultId })
        .first()

      if (!pidResult) {
        return res.status(404).json({ success: false, message: 'PID识别结果不存在' })
      }

      if (pidResult.assembly_task_id) {
        return res.status(400).json({
          success: false,
          message: '该PID已生成装配任务',
          data: { taskId: pidResult.assembly_task_id }
        })
      }

      // 2. 解析组件（42个：V1-V15, MV1-5, PT1-5等）
      const components = JSON.parse(pidResult.components || '[]')
      const connections = JSON.parse(pidResult.connections || '[]')

      if (components.length === 0) {
        return res.status(400).json({ success: false, message: 'PID识别结果中没有组件' })
      }

      console.log(`[PID→Assembly] 处理${components.length}个组件`)

      // 3. 将PID组件映射为零件清单(BOM)
      const bomData = components.map((comp, index) => {
        const partInfo = this._inferPartInfoFromPID(comp)
        return {
          item_number: index + 1,
          part_number: comp.tag || comp.id,
          part_name: partInfo.partName,
          part_type: partInfo.partType,
          description: comp.description || partInfo.description,
          quantity: 1,
          material: partInfo.material || '',
          thread: partInfo.thread,
          sealing: partInfo.sealing,
          manufacturer: partInfo.manufacturer || '',
          metadata: {
            original_type: comp.type,
            pid_tag: comp.tag,
            from_pid: true
          }
        }
      })

      // 4. 创建装配推理任务
      const [task] = await db('assembly_inference_tasks')
        .insert({
          user_id: req.user.id,
          user_name: req.user.username,
          bom_data: JSON.stringify(bomData),
          parts_count: components.length,
          status: 'pending',
          metadata: JSON.stringify({
            source: 'pid_recognition',
            pid_result_id: pidResultId,
            pid_file: pidResult.file_name,
            component_stats: this._groupByType(components)
          }),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')

      console.log(`[PID→Assembly] 创建任务: ${task.id}`)

      // 5. 调用装配推理引擎（应用规则）
      const AssemblyReasoningService = require('../services/assembly/AssemblyReasoningService')
      const reasoningService = new AssemblyReasoningService()

      let constraints = []
      try {
        const result = await reasoningService.inferConstraintsFromBOM(
          bomData,
          task.id,
          req.user.id
        )
        constraints = result.constraints || []

        // 更新任务状态
        await db('assembly_inference_tasks')
          .where({ id: task.id })
          .update({
            status: 'completed',
            constraints_count: constraints.length,
            updated_at: new Date()
          })

        console.log(`[PID→Assembly] 推理完成: ${constraints.length}个约束`)
      } catch (error) {
        console.error('[PID→Assembly] 规则推理失败:', error)
        // 即使推理失败，任务也已创建
        await db('assembly_inference_tasks')
          .where({ id: task.id })
          .update({ status: 'failed', updated_at: new Date() })
      }

      // 6. 关联PID结果和装配任务
      await db('pid_recognition_results')
        .where({ id: pidResultId })
        .update({ assembly_task_id: task.id, updated_at: new Date() })

      res.json({
        success: true,
        message: '装配任务创建成功',
        data: {
          taskId: task.id,
          componentCount: components.length,
          constraintsCount: constraints.length,
          bomSample: bomData.slice(0, 5),
          appliedRules: constraints.length > 0
        }
      })
    } catch (error) {
      console.error('[PID→Assembly] 失败:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  }

  /**
   * 将PID组件映射为标准零件信息
   */
  _inferPartInfoFromPID(component) {
    const typeMap = {
      '气动阀': {
        partType: 'PNEUMATIC_VALVE',
        partName: '气动调节阀',
        description: '气动驱动调节阀',
        material: '不锈钢316L',
        thread: '1/2"NPT',
        manufacturer: 'Swagelok'
      },
      '手动阀': {
        partType: 'MANUAL_VALVE',
        partName: '手动球阀',
        description: '手动操作球阀',
        material: '不锈钢304',
        thread: '1/4"NPT'
      },
      '压力传感器': {
        partType: 'PRESSURE_SENSOR',
        partName: '压力变送器',
        description: '压力测量传感器',
        thread: '1/4"NPT',
        manufacturer: 'Rosemount'
      },
      '压力开关': {
        partType: 'PRESSURE_SWITCH',
        partName: '真空压力开关',
        description: '压力控制开关',
        thread: '1/4"NPT'
      },
      '质量流量控制器': {
        partType: 'MFC',
        partName: '质量流量控制器',
        description: '气体流量控制器',
        thread: '1/4"VCR',
        sealing: 'VCR金属密封',
        manufacturer: 'Brooks'
      },
      '压力调节器': {
        partType: 'PRESSURE_REGULATOR',
        partName: '气体减压阀',
        description: '压力调节装置',
        thread: '1/2"NPT'
      },
      '过滤器': {
        partType: 'FILTER',
        partName: '管道过滤器',
        description: '介质过滤装置',
        thread: '1/4"NPT'
      },
      '针阀': {
        partType: 'NEEDLE_VALVE',
        partName: '精密针阀',
        description: '精密流量调节阀',
        thread: '1/4"NPT'
      },
      '止回阀': {
        partType: 'CHECK_VALVE',
        partName: '单向止回阀',
        description: '防止介质倒流',
        thread: '1/4"NPT'
      }
    }

    return typeMap[component.type] || {
      partType: 'UNKNOWN',
      partName: component.type || 'Unknown Part',
      description: component.description || '',
      material: '',
      thread: null,
      sealing: null
    }
  }

  /**
   * 按类型分组统计
   */
  _groupByType(components) {
    const stats = {}
    components.forEach(c => {
      stats[c.type] = (stats[c.type] || 0) + 1
    })
    return stats
  }

  /**
   * 生成装配文件（占位符，后续实现）
   */
  async generateAssembly(req, res) {
    res.status(501).json({
      success: false,
      message: '功能开发中'
    })
  }

  /**
   * 从PID识别结果学习装配规则
   * POST /api/pid/:id/learn
   */
  async learnFromPID(req, res) {
    try {
      const { id } = req.params

      console.log(`[PID学习] 开始从 ${id} 学习规则...`)

      const rules = await PIDTopologyLearner.learnFromPID(id)

      res.json({
        success: true,
        message: `成功学习到 ${rules.length} 条规则`,
        data: rules,
        count: rules.length
      })
    } catch (error) {
      console.error('[PID学习失败]:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 批量学习（所有已确认的PID）
   * POST /api/pid/learn/batch
   */
  async learnBatch(req, res) {
    try {
      console.log('[PID批量学习] 开始...')

      const rules = await PIDTopologyLearner.learnFromAllConfirmed()

      res.json({
        success: true,
        message: `批量学习完成，共学习到 ${rules.length} 条规则`,
        data: rules,
        count: rules.length
      })
    } catch (error) {
      console.error('[PID批量学习失败]:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 获取从PID学习到的规则
   * GET /api/pid/learned-rules
   */
  async getLearnedRules(req, res) {
    try {
      const rules = await db('assembly_rules')
        .where('source', 'pid_topology')
        .orderBy('confidence', 'desc')
        .orderBy('sample_count', 'desc')

      res.json({
        success: true,
        data: rules,
        count: rules.length
      })
    } catch (error) {
      console.error('[获取PID学习规则失败]:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
}

module.exports = PIDController
