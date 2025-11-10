const GraphLearningService = require('../services/knowledge/GraphLearningService')
const db = require('../config/database')

// 创建学习服务实例
const learningService = new GraphLearningService()

class GraphLearningController {
  /**
   * 提交用户反馈进行学习
   */
  static async submitFeedback(req, res, next) {
    try {
      const { kbId } = req.params
      const feedback = req.body
      
      // 验证反馈数据
      if (!feedback.query || !feedback.rating) {
        return res.status(400).json({
          success: false,
          message: '反馈数据不完整'
        })
      }
      
      // 记录用户反馈
      const result = await learningService.learnFromFeedback(kbId, {
        query: feedback.query,
        expected: feedback.expected,
        actual: feedback.actual,
        rating: feedback.rating,
        correction: feedback.correction,
        userId: req.user?.id
      })
      
      res.json({
        success: true,
        message: '反馈已记录，系统将从中学习',
        data: result
      })
      
    } catch (error) {
      console.error('Submit feedback error:', error)
      res.status(500).json({
        success: false,
        message: '提交反馈失败'
      })
    }
  }
  
  /**
   * 触发查询模式学习
   */
  static async learnFromQueries(req, res, next) {
    try {
      const { kbId } = req.params
      
      // 执行查询模式学习
      const result = await learningService.learnFromQueries(kbId)
      
      res.json({
        success: true,
        message: '查询模式学习完成',
        data: result
      })
      
    } catch (error) {
      console.error('Learn from queries error:', error)
      res.status(500).json({
        success: false,
        message: '查询模式学习失败'
      })
    }
  }
  
  /**
   * 触发自主学习
   */
  static async triggerAutonomousLearning(req, res, next) {
    try {
      const { kbId } = req.params
      const { mode = 'full' } = req.body
      
      // 检查学习状态
      const lastLearning = await db('graph_learning_history')
        .where('project_id', kbId)
        .where('learning_type', 'autonomous')
        .orderBy('created_at', 'desc')
        .first()
      
      // 防止频繁学习
      if (lastLearning && 
          new Date() - new Date(lastLearning.created_at) < 3600000) {
        return res.status(429).json({
          success: false,
          message: '学习任务执行过于频繁，请稍后再试'
        })
      }
      
      // 异步执行自主学习
      learningService.autonomousLearning(kbId).then(result => {
        console.log('Autonomous learning completed:', result)
      }).catch(error => {
        console.error('Autonomous learning failed:', error)
      })
      
      res.json({
        success: true,
        message: '自主学习任务已启动',
        data: {
          taskId: `learning_${kbId}_${Date.now()}`,
          mode
        }
      })
      
    } catch (error) {
      console.error('Trigger autonomous learning error:', error)
      res.status(500).json({
        success: false,
        message: '启动自主学习失败'
      })
    }
  }
  
  /**
   * 检测概念漂移
   */
  static async detectConceptDrift(req, res, next) {
    try {
      const { kbId } = req.params
      
      // 执行概念漂移检测
      const result = await learningService.detectAndAdaptConceptDrift(kbId)
      
      res.json({
        success: true,
        message: '概念漂移检测完成',
        data: result
      })
      
    } catch (error) {
      console.error('Detect concept drift error:', error)
      res.status(500).json({
        success: false,
        message: '概念漂移检测失败'
      })
    }
  }
  
  /**
   * 获取学习历史
   */
  static async getLearningHistory(req, res, next) {
    try {
      const { kbId } = req.params
      const { page = 1, pageSize = 20 } = req.query
      
      const offset = (page - 1) * pageSize
      
      // 查询学习历史
      const history = await db('graph_learning_history')
        .where('project_id', kbId)
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset(offset)
      
      // 获取总数
      const total = await db('graph_learning_history')
        .where('project_id', kbId)
        .count('* as count')
        .first()
      
      res.json({
        success: true,
        data: {
          list: history,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: parseInt(total.count),
            pages: Math.ceil(total.count / pageSize)
          }
        }
      })
      
    } catch (error) {
      console.error('Get learning history error:', error)
      res.status(500).json({
        success: false,
        message: '获取学习历史失败'
      })
    }
  }
  
  /**
   * 获取学习统计
   */
  static async getLearningStats(req, res, next) {
    try {
      const { kbId } = req.params
      
      // 获取各类统计数据
      const [
        totalLearnings,
        feedbackCount,
        autonomousCount,
        driftDetections,
        recentImprovements
      ] = await Promise.all([
        // 总学习次数
        db('graph_learning_history')
          .where('project_id', kbId)
          .count('* as count')
          .first(),
        
        // 反馈次数
        db('graph_learning_feedback')
          .where('project_id', kbId)
          .count('* as count')
          .first(),
        
        // 自主学习次数
        db('graph_learning_history')
          .where('project_id', kbId)
          .where('learning_type', 'autonomous')
          .count('* as count')
          .first(),
        
        // 概念漂移检测次数
        db('graph_learning_history')
          .where('project_id', kbId)
          .where('learning_type', 'concept_drift')
          .count('* as count')
          .first(),
        
        // 最近的改进
        db('graph_learning_history')
          .where('project_id', kbId)
          .where('created_at', '>', new Date(Date.now() - 7 * 24 * 3600000))
          .select('applied_changes')
      ])
      
      // 计算改进指标
      let totalRelations = 0
      let totalSynonyms = 0
      let totalCorrections = 0
      
      recentImprovements.forEach(item => {
        if (item.applied_changes) {
          const changes = JSON.parse(item.applied_changes)
          totalRelations += changes.relations || 0
          totalSynonyms += changes.synonyms || 0
          totalCorrections += changes.corrections || 0
        }
      })
      
      res.json({
        success: true,
        data: {
          totalLearnings: parseInt(totalLearnings.count),
          feedbackCount: parseInt(feedbackCount.count),
          autonomousCount: parseInt(autonomousCount.count),
          driftDetections: parseInt(driftDetections.count),
          recentImprovements: {
            relations: totalRelations,
            synonyms: totalSynonyms,
            corrections: totalCorrections
          },
          learningRate: {
            daily: Math.round(parseInt(totalLearnings.count) / 30), // 假设30天
            weekly: Math.round(parseInt(totalLearnings.count) / 4)   // 假设4周
          }
        }
      })
      
    } catch (error) {
      console.error('Get learning stats error:', error)
      res.status(500).json({
        success: false,
        message: '获取学习统计失败'
      })
    }
  }
  
  /**
   * 配置学习参数
   */
  static async configureLearning(req, res, next) {
    try {
      const { kbId } = req.params
      const config = req.body
      
      // 验证配置参数
      const validParams = [
        'learningRate',
        'batchSize',
        'confidenceThreshold',
        'minSupport',
        'minConfidence'
      ]
      
      const updates = {}
      for (const param of validParams) {
        if (config[param] !== undefined) {
          updates[param] = config[param]
        }
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有有效的配置参数'
        })
      }
      
      // 保存配置
      await db('graph_learning_config')
        .insert({
          project_id: kbId,
          config: JSON.stringify(updates),
          created_at: new Date()
        })
        .onConflict('project_id')
        .merge()
      
      // 更新服务配置
      if (updates.learningRate) {
        learningService.learningConfig.parameters.learningRate = updates.learningRate
      }
      if (updates.batchSize) {
        learningService.learningConfig.parameters.batchSize = updates.batchSize
      }
      if (updates.confidenceThreshold) {
        learningService.learningConfig.parameters.confidenceThreshold = updates.confidenceThreshold
      }
      
      res.json({
        success: true,
        message: '学习参数已更新',
        data: updates
      })
      
    } catch (error) {
      console.error('Configure learning error:', error)
      res.status(500).json({
        success: false,
        message: '配置学习参数失败'
      })
    }
  }
  
  /**
   * 导出学习模型
   */
  static async exportModel(req, res, next) {
    try {
      const { kbId } = req.params
      const { format = 'tensorflow' } = req.query
      
      // 获取最新的模型检查点
      const checkpoint = await db('model_checkpoints')
        .where('model_type', 'graph_learning')
        .orderBy('created_at', 'desc')
        .first()
      
      if (!checkpoint) {
        return res.status(404).json({
          success: false,
          message: '没有可用的模型'
        })
      }
      
      // 根据格式导出模型
      let exportPath
      switch (format) {
        case 'tensorflow':
          exportPath = checkpoint.checkpoint_path
          break
        case 'onnx':
          // TODO: 转换为ONNX格式
          exportPath = checkpoint.checkpoint_path.replace('.tf', '.onnx')
          break
        default:
          return res.status(400).json({
            success: false,
            message: '不支持的导出格式'
          })
      }
      
      res.json({
        success: true,
        message: '模型导出成功',
        data: {
          format,
          path: exportPath,
          metrics: JSON.parse(checkpoint.metrics),
          createdAt: checkpoint.created_at
        }
      })
      
    } catch (error) {
      console.error('Export model error:', error)
      res.status(500).json({
        success: false,
        message: '导出模型失败'
      })
    }
  }
}

// 监听学习事件
learningService.on('learningCompleted', (data) => {
  console.log('Learning completed:', data)
})

learningService.on('graphUpdated', (data) => {
  console.log('Graph updated:', data)
})

module.exports = GraphLearningController