const db = require('../../config/database')
const MilvusService = require('../rag/MilvusService')
const EmbeddingService = require('../rag/EmbeddingService')

/**
 * Week 3: 语义匹配服务（基于Milvus向量库 + BGE embedding）
 *
 * 功能：
 * 1. 零件名称向量化（使用BGE-Large-Zh模型）
 * 2. 向量相似度搜索（Milvus）
 * 3. 从历史装配数据中查找语义相似的零件对
 */
class SemanticMatchingService {
  constructor() {
    this.embeddingService = new EmbeddingService()
    this.milvusService = new MilvusService()

    // 装配零件向量集合
    this.collectionName = 'assembly_parts_vectors'
    this.dimension = 1024 // bge-large-zh-v1.5 的维度

    this.SIMILARITY_THRESHOLD = 0.75 // 余弦相似度阈值（向量模型更准确，可以提高阈值）
  }

  /**
   * 初始化Milvus集合
   */
  async initCollection() {
    try {
      const hasCollection = await this.milvusService.client.hasCollection({
        collection_name: this.collectionName
      })

      if (hasCollection.value) {
        console.log(`✅ Milvus集合已存在: ${this.collectionName}`)
        return { success: true }
      }

      // 创建装配零件向量集合
      await this.milvusService.client.createCollection({
        collection_name: this.collectionName,
        fields: [
          {
            name: 'id',
            data_type: 5, // Int64
            is_primary_key: true,
            autoID: true
          },
          {
            name: 'part_name',
            data_type: 21, // VarChar
            max_length: 200
          },
          {
            name: 'part_name_normalized',
            data_type: 21, // VarChar
            max_length: 200
          },
          {
            name: 'category',
            data_type: 21, // VarChar
            max_length: 50
          },
          {
            name: 'occurrence_count',
            data_type: 5 // Int64
          },
          {
            name: 'embedding',
            data_type: 101, // FloatVector
            dim: this.dimension
          }
        ],
        enable_dynamic_field: true
      })

      // 创建向量索引
      await this.milvusService.client.createIndex({
        collection_name: this.collectionName,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'IP', // 内积距离（适合归一化向量）
        params: { nlist: 128 }
      })

      // 加载集合到内存
      await this.milvusService.client.loadCollection({
        collection_name: this.collectionName
      })

      console.log(`✅ Milvus集合创建成功: ${this.collectionName}`)
      return { success: true }
    } catch (error) {
      console.error('❌ 初始化Milvus集合失败:', error)
      throw error
    }
  }

  /**
   * 标准化零件名称
   * @param {string} partName - 零件名称
   * @returns {string} 标准化后的名称
   */
  normalizeName(partName) {
    return partName
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
  }

  /**
   * 推断零件类别（基于名称和规格）
   * @param {string} partName - 零件名称
   * @returns {string} 类别
   */
  inferCategory(partName) {
    const name = partName.toUpperCase()

    // 螺栓类
    if (/螺栓|BOLT|HEX.*HEAD/i.test(name)) return 'bolt'
    if (/螺母|NUT/i.test(name)) return 'nut'
    if (/垫圈|WASHER/i.test(name)) return 'washer'
    if (/螺钉|SCREW/i.test(name)) return 'screw'

    // 法兰类
    if (/法兰|FLANGE/i.test(name)) return 'flange'
    if (/垫片|GASKET/i.test(name)) return 'gasket'

    // 阀门类
    if (/阀|VALVE/i.test(name)) return 'valve'
    if (/球阀|BALL.*VALVE/i.test(name)) return 'ball_valve'
    if (/闸阀|GATE.*VALVE/i.test(name)) return 'gate_valve'

    // 管件类
    if (/管|PIPE|TUBE/i.test(name)) return 'pipe'
    if (/三通|TEE/i.test(name)) return 'tee'
    if (/弯头|ELBOW/i.test(name)) return 'elbow'
    if (/异径|REDUCER/i.test(name)) return 'reducer'

    return 'unknown'
  }

  /**
   * 向量化单个零件并存储到Milvus
   * @param {string} partName - 零件名称
   * @returns {Object} 向量记录
   */
  async vectorizePart(partName) {
    try {
      const normalized = this.normalizeName(partName)
      const category = this.inferCategory(partName)

      // 1. 检查PostgreSQL中是否已存在（用于计数）
      let pgRecord = await db('part_name_vectors')
        .where({ part_name: partName })
        .first()

      if (pgRecord) {
        // 更新出现次数
        await db('part_name_vectors')
          .where({ part_name: partName })
          .increment('occurrence_count', 1)

        console.log(`  ⏭️  零件已向量化: ${partName}`)
        return pgRecord
      }

      // 2. 生成embedding
      console.log(`  🔄 正在向量化: ${partName}`)
      const embeddingResult = await this.embeddingService.generateEmbedding(partName)

      if (!embeddingResult.success) {
        throw new Error(`Embedding生成失败: ${embeddingResult.error}`)
      }

      const embedding = embeddingResult.embedding

      // 3. 插入到Milvus
      const insertResult = await this.milvusService.client.insert({
        collection_name: this.collectionName,
        data: [{
          part_name: partName,
          part_name_normalized: normalized,
          category,
          occurrence_count: 1,
          embedding
        }]
      })

      console.log(`  ✅ Milvus插入成功: ${partName}, ID=${insertResult.insert_cnt}`)

      // 4. 保存到PostgreSQL（用于计数和查询）
      const [record] = await db('part_name_vectors')
        .insert({
          part_name: partName,
          part_name_normalized: normalized,
          tfidf_vector: {}, // 保留字段兼容性
          term_frequencies: {},
          category,
          occurrence_count: 1
        })
        .returning('*')

      return record
    } catch (error) {
      console.error(`❌ 向量化失败: ${partName}`, error.message)
      throw error
    }
  }

  /**
   * 批量向量化（从assembly_dataset导入）
   * @param {string} datasetName - 数据集名称
   */
  async vectorizeDataset(datasetName) {
    console.log(`📊 开始向量化数据集: ${datasetName}`)

    // 1. 确保Milvus集合已创建
    await this.initCollection()

    // 2. 查询数据集中的所有零件名称
    const dataset = await db('assembly_dataset')
      .where({ dataset_name: datasetName })
      .select('part_a', 'part_b')

    const allPartNames = new Set()
    for (const row of dataset) {
      allPartNames.add(row.part_a)
      allPartNames.add(row.part_b)
    }

    console.log(`  找到 ${allPartNames.size} 个唯一零件`)

    // 3. 批量向量化
    const results = []
    for (const partName of allPartNames) {
      try {
        const vector = await this.vectorizePart(partName)
        results.push(vector)
      } catch (error) {
        console.error(`  ⚠️  跳过零件 ${partName}: ${error.message}`)
      }
    }

    console.log(`✅ 向量化完成: ${results.length}/${allPartNames.size} 个零件`)

    return results
  }

  /**
   * 查找相似零件（基于Milvus向量搜索）
   * @param {string} partName - 查询零件名称
   * @param {number} topK - 返回前K个最相似的
   * @returns {Array} 相似零件列表
   */
  async findSimilarParts(partName, topK = 5) {
    try {
      // 1. 生成查询向量
      const embeddingResult = await this.embeddingService.generateEmbedding(partName)

      if (!embeddingResult.success) {
        throw new Error(`Embedding生成失败: ${embeddingResult.error}`)
      }

      // 2. Milvus向量搜索
      const searchResult = await this.milvusService.client.search({
        collection_name: this.collectionName,
        vectors: [embeddingResult.embedding],
        search_params: {
          anns_field: 'embedding',
          topk: topK + 1, // +1因为可能包含自己
          metric_type: 'IP',
          params: { nprobe: 10 }
        },
        output_fields: ['part_name', 'category', 'occurrence_count']
      })

      if (!searchResult.results || searchResult.results.length === 0) {
        return []
      }

      // 3. 过滤并格式化结果
      const similarities = searchResult.results
        .filter(hit => {
          // 跳过自己
          return hit.part_name !== partName && hit.score >= this.SIMILARITY_THRESHOLD
        })
        .map(hit => ({
          part_name: hit.part_name,
          category: hit.category,
          similarity: parseFloat(hit.score.toFixed(4)),
          occurrence_count: hit.occurrence_count
        }))
        .slice(0, topK)

      return similarities
    } catch (error) {
      console.error('❌ 向量搜索失败:', error.message)
      return []
    }
  }

  /**
   * 从历史数据推荐装配约束
   * @param {string} partA - 零件A名称
   * @param {string} partB - 零件B名称
   * @returns {Array} 推荐的约束类型
   */
  async recommendConstraints(partA, partB) {
    try {
      // 1. 查找与partA相似的零件
      const similarToA = await this.findSimilarParts(partA, 3)

      // 2. 查找与partB相似的零件
      const similarToB = await this.findSimilarParts(partB, 3)

      if (similarToA.length === 0 || similarToB.length === 0) {
        console.log(`  ℹ️  未找到足够的相似零件 (A: ${similarToA.length}, B: ${similarToB.length})`)
        return []
      }

      // 3. 查询历史装配数据
      const constraints = []

      for (const simA of similarToA) {
        for (const simB of similarToB) {
          const history = await db('assembly_dataset')
            .where(function() {
              this.where({ part_a: simA.part_name, part_b: simB.part_name })
                .orWhere({ part_a: simB.part_name, part_b: simA.part_name })
            })
            .select('constraint_type', 'parameters', 'confidence')

          for (const record of history) {
            // 计算综合置信度 = 历史置信度 × 语义相似度
            const semanticConfidence = (simA.similarity + simB.similarity) / 2
            const combinedConfidence = record.confidence * semanticConfidence

            constraints.push({
              constraint_type: record.constraint_type,
              parameters: record.parameters,
              confidence: parseFloat(combinedConfidence.toFixed(4)),
              reason: `基于相似零件对 (${simA.part_name} ↔ ${simB.part_name})`,
              similarity_a: simA.similarity,
              similarity_b: simB.similarity,
              historical_confidence: record.confidence
            })
          }
        }
      }

      // 4. 去重并按置信度排序
      const uniqueConstraints = this._deduplicateConstraints(constraints)

      return uniqueConstraints
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
    } catch (error) {
      console.error('❌ 约束推荐失败:', error.message)
      return []
    }
  }

  /**
   * 去重约束（相同类型的取最高置信度）
   * @private
   */
  _deduplicateConstraints(constraints) {
    const map = new Map()

    for (const c of constraints) {
      const key = c.constraint_type
      if (!map.has(key) || map.get(key).confidence < c.confidence) {
        map.set(key, c)
      }
    }

    return Array.from(map.values())
  }

  /**
   * 获取装配模式统计
   * @param {string} category - 零件类别
   * @returns {Array} 常见模式
   */
  async getAssemblyPatterns(category = null) {
    let query = db('assembly_patterns')
      .select('*')
      .orderBy('support_count', 'desc')
      .limit(10)

    if (category) {
      query = query.whereRaw("part_pattern->>'partA_type' = ? OR part_pattern->>'partB_type' = ?", [category, category])
    }

    const patterns = await query

    return patterns.map(p => ({
      pattern_name: p.pattern_name,
      description: p.description,
      constraint_type: p.constraint_type,
      support_count: p.support_count,
      confidence: parseFloat(p.confidence),
      is_validated: p.is_validated
    }))
  }
}

module.exports = SemanticMatchingService
