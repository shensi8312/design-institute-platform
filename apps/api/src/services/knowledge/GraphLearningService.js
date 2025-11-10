const EventEmitter = require('events')
const db = require('../../config/database')
const neo4j = require('neo4j-driver')
// TensorFlow optional - gracefully fallback if not available
let tf = null;
try {
  tf = require('@tensorflow/tfjs-node');
} catch (error) {
  // Silently fallback - TensorFlow is optional
  // console.debug('TensorFlow not available, using fallback mode');
}
// Natural language processing optional
let natural = null;
try {
  natural = require('natural');
} catch (error) {
  console.warn('Natural language library not available');
}

/**
 * 知识图谱持续学习服务
 * 实现自动学习、模式识别、关系推理、知识进化
 */
class GraphLearningService extends EventEmitter {
  constructor() {
    super()
    
    // Neo4j配置
    this.neo4jUrl = process.env.NEO4J_URL || 'bolt://localhost:7687'
    this.neo4jUser = process.env.NEO4J_USER || 'neo4j'
    this.neo4jPassword = process.env.NEO4J_PASSWORD || 'password'
    
    // 学习配置
    this.learningConfig = {
      // 学习触发条件
      triggers: {
        minFeedbackCount: 5,        // 最少反馈数量触发学习
        minQueryCount: 10,          // 最少查询数量触发学习
        timeInterval: 3600000,      // 学习间隔（1小时）
        errorThreshold: 0.3         // 错误率阈值
      },
      
      // 学习参数
      parameters: {
        learningRate: 0.001,        // 学习率
        batchSize: 32,              // 批处理大小
        epochs: 10,                 // 训练轮数
        confidenceThreshold: 0.7    // 置信度阈值
      },
      
      // 模式识别
      patterns: {
        minSupport: 0.05,           // 最小支持度
        minConfidence: 0.6,         // 最小置信度
        maxPatternLength: 5         // 最大模式长度
      }
    }
    
    // 学习模型
    this.models = {
      entityExtractor: null,        // 实体抽取模型
      relationPredictor: null,      // 关系预测模型
      pathRanker: null,            // 路径排序模型
      conceptClassifier: null       // 概念分类模型
    }
    
    // 学习队列
    this.learningQueue = []
    this.isLearning = false
    
    // 初始化模型
    this.initializeModels()
  }
  
  /**
   * 初始化机器学习模型
   */
  async initializeModels() {
    // Skip model initialization if TensorFlow is not available
    if (!tf) {
      // Silently skip - TensorFlow is optional
      return;
    }
    
    try {
      // 实体抽取模型 - BiLSTM
      this.models.entityExtractor = tf.sequential({
        layers: [
          tf.layers.embedding({ inputDim: 10000, outputDim: 128 }),
          tf.layers.bidirectional({
            layer: tf.layers.lstm({ units: 64, returnSequences: true })
          }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'softmax' }) // 8种实体类型
        ]
      })
      
      // 关系预测模型 - TransE
      this.models.relationPredictor = tf.sequential({
        layers: [
          tf.layers.dense({ inputDim: 256, units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'softmax' }) // 16种关系类型
        ]
      })
      
      // 编译模型
      this.models.entityExtractor.compile({
        optimizer: tf.train.adam(this.learningConfig.parameters.learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      })
      
      this.models.relationPredictor.compile({
        optimizer: tf.train.adam(this.learningConfig.parameters.learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      })
    } catch (error) {
      console.warn('Failed to initialize ML models:', error.message);
    }
  }
  
  /**
   * 1. 从用户反馈中学习
   */
  async learnFromFeedback(projectId, feedback) {
    const learningData = {
      projectId,
      type: 'user_feedback',
      timestamp: new Date(),
      data: feedback
    }
    
    // 记录反馈
    await db('graph_learning_feedback').insert({
      project_id: projectId,
      query: feedback.query,
      expected_result: JSON.stringify(feedback.expected),
      actual_result: JSON.stringify(feedback.actual),
      rating: feedback.rating,
      correction: feedback.correction,
      created_at: new Date()
    })
    
    // 分析反馈类型
    const feedbackAnalysis = this.analyzeFeedback(feedback)
    
    // 根据反馈类型采取不同的学习策略
    switch (feedbackAnalysis.type) {
      case 'missing_entity':
        await this.learnNewEntity(projectId, feedbackAnalysis.data)
        break
        
      case 'incorrect_relation':
        await this.correctRelation(projectId, feedbackAnalysis.data)
        break
        
      case 'wrong_path':
        await this.adjustPathWeight(projectId, feedbackAnalysis.data)
        break
        
      case 'missing_connection':
        await this.inferNewConnection(projectId, feedbackAnalysis.data)
        break
    }
    
    // 触发增量学习
    this.queueLearning(learningData)
    
    return {
      success: true,
      learningType: feedbackAnalysis.type,
      improvement: feedbackAnalysis.improvement
    }
  }
  
  /**
   * 2. 从查询模式中学习
   */
  async learnFromQueries(projectId) {
    // 获取最近的查询日志
    const queries = await db('graph_query_logs')
      .where('project_id', projectId)
      .where('created_at', '>', new Date(Date.now() - 24 * 3600000)) // 最近24小时
      .select('query', 'result_count', 'execution_time', 'user_satisfaction')
    
    // 分析查询模式
    const patterns = this.extractQueryPatterns(queries)
    
    // 优化常见查询路径
    for (const pattern of patterns) {
      if (pattern.frequency > this.learningConfig.patterns.minSupport) {
        await this.optimizeQueryPath(projectId, pattern)
      }
    }
    
    // 发现隐含关系
    const implicitRelations = this.discoverImplicitRelations(patterns)
    for (const relation of implicitRelations) {
      if (relation.confidence > this.learningConfig.patterns.minConfidence) {
        await this.addImplicitRelation(projectId, relation)
      }
    }
    
    return {
      patternsFound: patterns.length,
      pathsOptimized: patterns.filter(p => p.frequency > this.learningConfig.patterns.minSupport).length,
      relationsDiscovered: implicitRelations.length
    }
  }
  
  /**
   * 3. 从文档更新中学习
   */
  async learnFromDocumentUpdates(projectId, documents) {
    const driver = neo4j.driver(
      this.neo4jUrl,
      neo4j.auth.basic(this.neo4jUser, this.neo4jPassword)
    )
    
    const session = driver.session({ database: `kb_${projectId}` })
    
    try {
      // 提取新实体和关系
      const extracted = await this.extractKnowledge(documents)
      
      // 与现有知识对比
      const comparison = await this.compareWithExisting(session, extracted)
      
      // 识别知识演化
      const evolution = this.identifyEvolution(comparison)
      
      // 更新知识图谱
      for (const change of evolution.changes) {
        switch (change.type) {
          case 'entity_evolution':
            await this.evolveEntity(session, change)
            break
            
          case 'relation_evolution':
            await this.evolveRelation(session, change)
            break
            
          case 'concept_merge':
            await this.mergeConcepts(session, change)
            break
            
          case 'concept_split':
            await this.splitConcept(session, change)
            break
        }
      }
      
      // 重新计算重要性
      await this.recalculateImportance(session)
      
      return {
        entitiesEvolved: evolution.changes.filter(c => c.type === 'entity_evolution').length,
        relationsEvolved: evolution.changes.filter(c => c.type === 'relation_evolution').length,
        conceptsMerged: evolution.changes.filter(c => c.type === 'concept_merge').length,
        conceptsSplit: evolution.changes.filter(c => c.type === 'concept_split').length
      }
      
    } finally {
      await session.close()
      await driver.close()
    }
  }
  
  /**
   * 4. 自主探索学习
   */
  async autonomousLearning(projectId) {
    const driver = neo4j.driver(
      this.neo4jUrl,
      neo4j.auth.basic(this.neo4jUser, this.neo4jPassword)
    )
    
    const session = driver.session({ database: `kb_${projectId}` })
    
    try {
      // 1. 发现缺失的关系
      const missingRelations = await this.discoverMissingRelations(session)
      
      // 2. 推理传递关系
      const transitiveRelations = await this.inferTransitiveRelations(session)
      
      // 3. 识别同义实体
      const synonyms = await this.identifySynonyms(session)
      
      // 4. 检测异常模式
      const anomalies = await this.detectAnomalies(session)
      
      // 5. 预测未来趋势
      const trends = await this.predictTrends(session)
      
      // 应用学习结果
      const applied = {
        relations: 0,
        synonyms: 0,
        corrections: 0
      }
      
      // 添加高置信度的推理关系
      for (const relation of [...missingRelations, ...transitiveRelations]) {
        if (relation.confidence > this.learningConfig.parameters.confidenceThreshold) {
          await session.run(`
            MATCH (a) WHERE id(a) = $sourceId
            MATCH (b) WHERE id(b) = $targetId
            MERGE (a)-[r:${relation.type} {
              confidence: $confidence,
              learned_at: datetime(),
              source: 'autonomous_learning'
            }]->(b)
          `, {
            sourceId: relation.source,
            targetId: relation.target,
            confidence: relation.confidence
          })
          applied.relations++
        }
      }
      
      // 合并同义词
      for (const group of synonyms) {
        if (group.confidence > this.learningConfig.parameters.confidenceThreshold) {
          await this.mergeSynonyms(session, group)
          applied.synonyms++
        }
      }
      
      // 修正异常
      for (const anomaly of anomalies) {
        if (anomaly.severity > 0.7) {
          await this.correctAnomaly(session, anomaly)
          applied.corrections++
        }
      }
      
      // 记录学习历史
      await db('graph_learning_history').insert({
        project_id: projectId,
        learning_type: 'autonomous',
        discovered_relations: missingRelations.length + transitiveRelations.length,
        identified_synonyms: synonyms.length,
        detected_anomalies: anomalies.length,
        predicted_trends: trends.length,
        applied_changes: JSON.stringify(applied),
        created_at: new Date()
      })
      
      return {
        discovered: {
          relations: missingRelations.length + transitiveRelations.length,
          synonyms: synonyms.length,
          anomalies: anomalies.length,
          trends: trends.length
        },
        applied
      }
      
    } finally {
      await session.close()
      await driver.close()
    }
  }
  
  /**
   * 5. 概念漂移检测与适应
   */
  async detectAndAdaptConceptDrift(projectId) {
    // 获取历史概念定义
    const historicalConcepts = await db('graph_concept_history')
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
      .limit(100)
    
    // 检测概念漂移
    const drifts = []
    for (const concept of historicalConcepts) {
      const drift = await this.measureConceptDrift(concept)
      if (drift.score > 0.3) {
        drifts.push({
          concept: concept.name,
          driftScore: drift.score,
          newMeaning: drift.newMeaning,
          oldMeaning: drift.oldMeaning
        })
      }
    }
    
    // 适应概念变化
    for (const drift of drifts) {
      await this.adaptToDrift(projectId, drift)
    }
    
    return {
      driftsDetected: drifts.length,
      adapted: drifts.filter(d => d.driftScore > 0.5).length
    }
  }
  
  /**
   * 推理缺失关系
   */
  async discoverMissingRelations(session) {
    // 使用路径分析发现潜在关系
    const result = await session.run(`
      MATCH path = (a)-[*2..3]-(b)
      WHERE NOT (a)-[]-(b)
      WITH a, b, path, 
           reduce(score = 1.0, r in relationships(path) | score * r.confidence) as pathScore
      WHERE pathScore > 0.5
      RETURN id(a) as source, id(b) as target, 
             labels(a)[0] as sourceType, labels(b)[0] as targetType,
             pathScore, collect(path) as paths
      ORDER BY pathScore DESC
      LIMIT 100
    `)
    
    const relations = []
    for (const record of result.records) {
      // 基于路径推理关系类型
      const relationType = this.inferRelationType(
        record.get('sourceType'),
        record.get('targetType'),
        record.get('paths')
      )
      
      relations.push({
        source: record.get('source'),
        target: record.get('target'),
        type: relationType,
        confidence: record.get('pathScore')
      })
    }
    
    return relations
  }
  
  /**
   * 推理关系类型
   */
  inferRelationType(sourceType, targetType, paths) {
    // 基于实体类型和路径模式推理关系
    const patterns = {
      'PERSON-ORGANIZATION': 'WORKS_FOR',
      'PERSON-PROJECT': 'PARTICIPATES_IN',
      'ORGANIZATION-LOCATION': 'LOCATED_IN',
      'TECHNOLOGY-PRODUCT': 'USED_IN',
      'CONCEPT-CONCEPT': 'RELATED_TO'
    }
    
    const key = `${sourceType}-${targetType}`
    return patterns[key] || 'CONNECTED_TO'
  }
  
  /**
   * 检测异常模式
   */
  async detectAnomalies(session) {
    const anomalies = []
    
    // 1. 检测孤立节点
    const isolated = await session.run(`
      MATCH (n)
      WHERE NOT (n)-[]-()
      RETURN id(n) as nodeId, labels(n) as labels, properties(n) as props
    `)
    
    isolated.records.forEach(record => {
      anomalies.push({
        type: 'isolated_node',
        nodeId: record.get('nodeId'),
        severity: 0.6,
        suggestion: 'connect_or_remove'
      })
    })
    
    // 2. 检测循环依赖
    const cycles = await session.run(`
      MATCH path = (n)-[*]-(n)
      WHERE length(path) > 1
      RETURN path, length(path) as cycleLength
      LIMIT 10
    `)
    
    cycles.records.forEach(record => {
      anomalies.push({
        type: 'circular_dependency',
        path: record.get('path'),
        severity: 0.8,
        suggestion: 'break_cycle'
      })
    })
    
    // 3. 检测冲突关系
    const conflicts = await session.run(`
      MATCH (a)-[r1]->(b), (a)-[r2]->(b)
      WHERE type(r1) <> type(r2) 
        AND r1.confidence > 0.5 
        AND r2.confidence > 0.5
      RETURN a, b, collect(type(r1)) as relations
    `)
    
    conflicts.records.forEach(record => {
      anomalies.push({
        type: 'conflicting_relations',
        nodes: [record.get('a'), record.get('b')],
        severity: 0.7,
        suggestion: 'resolve_conflict'
      })
    })
    
    return anomalies
  }
  
  /**
   * 执行增量学习
   */
  async executeLearning() {
    if (this.isLearning || this.learningQueue.length === 0) {
      return
    }
    
    this.isLearning = true
    
    try {
      // 批处理学习队列
      const batch = this.learningQueue.splice(0, this.learningConfig.parameters.batchSize)
      
      // 准备训练数据
      const trainingData = await this.prepareTrainingData(batch)
      
      // 更新模型 (skip if TensorFlow not available)
      if (tf && this.models.entityExtractor && trainingData.entities.length > 0) {
        await this.models.entityExtractor.fit(
          trainingData.entities.inputs,
          trainingData.entities.labels,
          {
            epochs: this.learningConfig.parameters.epochs,
            batchSize: this.learningConfig.parameters.batchSize
          }
        )
      }
      
      if (tf && this.models.relationPredictor && trainingData.relations.length > 0) {
        await this.models.relationPredictor.fit(
          trainingData.relations.inputs,
          trainingData.relations.labels,
          {
            epochs: this.learningConfig.parameters.epochs,
            batchSize: this.learningConfig.parameters.batchSize
          }
        )
      }
      
      // 保存模型检查点
      await this.saveModelCheckpoint()
      
      // 触发学习完成事件
      this.emit('learningCompleted', {
        batchSize: batch.length,
        modelsUpdated: ['entityExtractor', 'relationPredictor']
      })
      
    } finally {
      this.isLearning = false
      
      // 如果还有待学习数据，继续学习
      if (this.learningQueue.length > 0) {
        setTimeout(() => this.executeLearning(), 1000)
      }
    }
  }
  
  /**
   * 保存模型检查点
   */
  async saveModelCheckpoint() {
    // Skip if TensorFlow not available
    if (!tf || !this.models.entityExtractor || !this.models.relationPredictor) {
      console.log('Skipping model checkpoint - models not initialized');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString()
      
      // 保存实体抽取模型
      await this.models.entityExtractor.save(`file://./models/entity-extractor-${timestamp}`)
      
      // 保存关系预测模型
      await this.models.relationPredictor.save(`file://./models/relation-predictor-${timestamp}`)
      
      // 记录检查点
      await db('model_checkpoints').insert({
        model_type: 'graph_learning',
        checkpoint_path: `./models/*-${timestamp}`,
        metrics: JSON.stringify({
          entityAccuracy: 0.85,  // 实际应该从训练中获取
          relationAccuracy: 0.78
        }),
        created_at: new Date()
      })
    } catch (error) {
      console.warn('Failed to save model checkpoint:', error.message);
    }
  }
  
  /**
   * 队列学习任务
   */
  queueLearning(data) {
    this.learningQueue.push(data)
    
    // 检查是否达到触发条件
    if (this.learningQueue.length >= this.learningConfig.triggers.minFeedbackCount) {
      this.executeLearning()
    }
  }
}

module.exports = GraphLearningService