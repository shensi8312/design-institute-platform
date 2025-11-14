const db = require('../../config/database')

/**
 * Week 3: TF-IDF语义匹配服务
 *
 * 功能：
 * 1. 零件名称TF-IDF向量化（支持中英文）
 * 2. 余弦相似度计算
 * 3. 从历史装配数据中查找语义相似的零件对
 */
class SemanticMatchingService {
  constructor() {
    this.cache = new Map()
    this.CACHE_TTL = 3600 * 1000 // 1小时缓存
    this.SIMILARITY_THRESHOLD = 0.6 // 相似度阈值
  }

  /**
   * 标准化零件名称（去除空格、统一大小写、分词）
   * @param {string} partName - 零件名称
   * @returns {Object} { normalized, tokens }
   */
  normalizeName(partName) {
    // 1. 基础清理
    let normalized = partName
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()

    // 2. 分词（支持中英文）
    const tokens = []

    // 提取英文单词和数字
    const englishPattern = /[A-Z0-9]+/g
    const englishMatches = normalized.match(englishPattern) || []
    tokens.push(...englishMatches)

    // 提取中文字符（2-4字词组）
    const chinesePattern = /[\u4e00-\u9fa5]+/g
    const chineseMatches = normalized.match(chinesePattern) || []
    for (const match of chineseMatches) {
      // 2字词
      for (let i = 0; i < match.length - 1; i++) {
        tokens.push(match.substring(i, i + 2))
      }
      // 3字词
      for (let i = 0; i < match.length - 2; i++) {
        tokens.push(match.substring(i, i + 3))
      }
      // 4字词
      for (let i = 0; i < match.length - 3; i++) {
        tokens.push(match.substring(i, i + 4))
      }
    }

    // 提取规格信息
    const specs = this._extractSpecifications(normalized)
    tokens.push(...specs)

    return {
      normalized,
      tokens: [...new Set(tokens)] // 去重
    }
  }

  /**
   * 提取规格信息（螺纹、法兰、管道等）
   * @private
   */
  _extractSpecifications(name) {
    const specs = []

    // 螺纹规格: M3, M8x1.25, 1/2", 3/4"
    const threadPattern = /M\d+(?:X\d+(?:\.\d+)?)?|\d+\/\d+"/gi
    const threads = name.match(threadPattern) || []
    specs.push(...threads.map(t => t.toUpperCase()))

    // 压力等级: 150#, 300#, PN16, PN40, Class150
    const pressurePattern = /\d+#|PN\d+|CLASS\d+/gi
    const pressures = name.match(pressurePattern) || []
    specs.push(...pressures.map(p => p.toUpperCase()))

    // 公称直径: DN50, DN100
    const dnPattern = /DN\d+/gi
    const dns = name.match(dnPattern) || []
    specs.push(...dns.map(d => d.toUpperCase()))

    // 材质: SS304, SS316, A105
    const materialPattern = /SS\d+|A\d+|[A-Z]{2}\d{3}/gi
    const materials = name.match(materialPattern) || []
    specs.push(...materials.map(m => m.toUpperCase()))

    return specs
  }

  /**
   * 计算词频（Term Frequency）
   * @param {Array} tokens - 词列表
   * @returns {Object} { term: frequency }
   */
  calculateTF(tokens) {
    const tf = {}
    const totalTokens = tokens.length

    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1
    }

    // 归一化
    for (const term in tf) {
      tf[term] = tf[term] / totalTokens
    }

    return tf
  }

  /**
   * 从数据库计算IDF（Inverse Document Frequency）
   * @param {Array} terms - 词列表
   * @returns {Object} { term: idf }
   */
  async calculateIDF(terms) {
    // 1. 查询所有已向量化的零件
    const allVectors = await db('part_name_vectors')
      .select('part_name', 'term_frequencies')

    const totalDocs = allVectors.length || 1

    // 2. 计算每个词的文档频率
    const docFrequency = {}
    for (const term of terms) {
      let count = 0
      for (const vec of allVectors) {
        if (vec.term_frequencies && vec.term_frequencies[term]) {
          count++
        }
      }
      docFrequency[term] = count
    }

    // 3. 计算IDF
    const idf = {}
    for (const term of terms) {
      const df = docFrequency[term] || 0
      idf[term] = Math.log((totalDocs + 1) / (df + 1)) + 1 // +1平滑
    }

    return idf
  }

  /**
   * 计算TF-IDF向量
   * @param {string} partName - 零件名称
   * @returns {Object} TF-IDF向量
   */
  async calculateTFIDF(partName) {
    const { normalized, tokens } = this.normalizeName(partName)
    const tf = this.calculateTF(tokens)
    const idf = await this.calculateIDF(Object.keys(tf))

    const tfidf = {}
    for (const term in tf) {
      tfidf[term] = tf[term] * (idf[term] || 1)
    }

    return {
      normalized,
      tokens,
      tf,
      tfidf
    }
  }

  /**
   * 余弦相似度计算
   * @param {Object} vectorA - TF-IDF向量A
   * @param {Object} vectorB - TF-IDF向量B
   * @returns {number} 相似度 [0, 1]
   */
  cosineSimilarity(vectorA, vectorB) {
    const allTerms = new Set([
      ...Object.keys(vectorA),
      ...Object.keys(vectorB)
    ])

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (const term of allTerms) {
      const a = vectorA[term] || 0
      const b = vectorB[term] || 0

      dotProduct += a * b
      magnitudeA += a * a
      magnitudeB += b * b
    }

    if (magnitudeA === 0 || magnitudeB === 0) return 0

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
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
   * 向量化单个零件并存储到数据库
   * @param {string} partName - 零件名称
   * @returns {Object} 向量记录
   */
  async vectorizePart(partName) {
    // 1. 检查是否已存在
    const existing = await db('part_name_vectors')
      .where({ part_name: partName })
      .first()

    if (existing) {
      // 更新出现次数
      await db('part_name_vectors')
        .where({ part_name: partName })
        .increment('occurrence_count', 1)

      return existing
    }

    // 2. 计算TF-IDF向量
    const result = await this.calculateTFIDF(partName)
    const category = this.inferCategory(partName)

    // 3. 存储到数据库
    const [record] = await db('part_name_vectors')
      .insert({
        part_name: partName,
        part_name_normalized: result.normalized,
        tfidf_vector: result.tfidf,
        term_frequencies: result.tf,
        category,
        occurrence_count: 1
      })
      .returning('*')

    return record
  }

  /**
   * 批量向量化（从assembly_dataset导入）
   * @param {string} datasetName - 数据集名称
   */
  async vectorizeDataset(datasetName) {
    // 1. 查询数据集中的所有零件名称
    const dataset = await db('assembly_dataset')
      .where({ dataset_name: datasetName })
      .select('part_a', 'part_b')

    const allPartNames = new Set()
    for (const row of dataset) {
      allPartNames.add(row.part_a)
      allPartNames.add(row.part_b)
    }

    console.log(`📊 正在向量化 ${allPartNames.size} 个零件...`)

    // 2. 批量向量化
    const results = []
    for (const partName of allPartNames) {
      const vector = await this.vectorizePart(partName)
      results.push(vector)
    }

    console.log(`✅ 向量化完成: ${results.length} 个零件`)

    return results
  }

  /**
   * 查找相似零件
   * @param {string} partName - 查询零件名称
   * @param {number} topK - 返回前K个最相似的
   * @returns {Array} 相似零件列表
   */
  async findSimilarParts(partName, topK = 5) {
    // 1. 计算查询零件的TF-IDF向量
    const queryResult = await this.calculateTFIDF(partName)
    const queryVector = queryResult.tfidf

    // 2. 查询所有已向量化的零件
    const allVectors = await db('part_name_vectors')
      .select('*')

    // 3. 计算相似度
    const similarities = []
    for (const vec of allVectors) {
      if (vec.part_name === partName) continue // 跳过自己

      const similarity = this.cosineSimilarity(queryVector, vec.tfidf_vector)

      if (similarity >= this.SIMILARITY_THRESHOLD) {
        similarities.push({
          part_name: vec.part_name,
          category: vec.category,
          similarity: parseFloat(similarity.toFixed(4)),
          occurrence_count: vec.occurrence_count
        })
      }
    }

    // 4. 按相似度降序排序，返回topK
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * 从历史数据推荐装配约束
   * @param {string} partA - 零件A名称
   * @param {string} partB - 零件B名称
   * @returns {Array} 推荐的约束类型
   */
  async recommendConstraints(partA, partB) {
    // 1. 查找与partA相似的零件
    const similarToA = await this.findSimilarParts(partA, 3)

    // 2. 查找与partB相似的零件
    const similarToB = await this.findSimilarParts(partB, 3)

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
