const db = require('../../config/database')
const MilvusService = require('../rag/MilvusService')
const EmbeddingService = require('../rag/EmbeddingService')

/**
 * 语义匹配服务
 * 使用Milvus向量库和vLLM BGE嵌入模型
 */
class SemanticMatchingService {
  constructor() {
    this.embeddingService = new EmbeddingService()
    this.milvusService = new MilvusService()
    this.collectionName = 'assembly_parts_vectors'
    this.dimension = 1024 // bge-large-zh-v1.5 的维度
    this.SIMILARITY_THRESHOLD = 0.75
  }

  /**
   * 初始化Milvus集合
   */
  async initCollection() {
    const hasCollection = await this.milvusService.client.hasCollection({
      collection_name: this.collectionName
    })

    if (!hasCollection.value) {
      await this.milvusService.client.createCollection({
        collection_name: this.collectionName,
        fields: [
          { name: 'id', data_type: 5, is_primary_key: true, autoID: true },
          { name: 'part_name', data_type: 21, max_length: 200 },
          { name: 'part_name_normalized', data_type: 21, max_length: 200 },
          { name: 'category', data_type: 21, max_length: 50 },
          { name: 'occurrence_count', data_type: 5 },
          { name: 'embedding', data_type: 101, dim: this.dimension }
        ]
      })

      await this.milvusService.client.createIndex({
        collection_name: this.collectionName,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'IP',
        params: { nlist: 128 }
      })

      console.log(`✅ Milvus collection created: ${this.collectionName}`)
    }

    await this.milvusService.client.loadCollection({
      collection_name: this.collectionName
    })
  }

  /**
   * 向量化单个零件名称
   */
  async vectorizePart(partName) {
    const normalized = this.normalizeName(partName)
    const category = this.inferCategory(partName)

    const embeddingResult = await this.embeddingService.generateEmbedding(partName)
    const embedding = embeddingResult.embedding

    await this.milvusService.client.insert({
      collection_name: this.collectionName,
      data: [{
        part_name: partName,
        part_name_normalized: normalized,
        category,
        occurrence_count: 1,
        embedding
      }]
    })

    const [record] = await db('part_name_vectors').insert({
      part_name: partName,
      part_name_normalized: normalized,
      tfidf_vector: {},
      category,
      occurrence_count: 1
    }).onConflict('part_name').merge(['occurrence_count']).returning('*')

    return record
  }

  /**
   * 向量化整个数据集
   */
  async vectorizeDataset(datasetName) {
    const assemblyData = await db('assembly_dataset')
      .where({ dataset_name: datasetName })
      .select('part_a', 'part_b')

    const uniqueParts = new Set()
    assemblyData.forEach(row => {
      uniqueParts.add(row.part_a)
      uniqueParts.add(row.part_b)
    })

    const results = []
    for (const partName of uniqueParts) {
      const result = await this.vectorizePart(partName)
      results.push(result)
    }

    return results
  }

  /**
   * 查找相似零件
   */
  async findSimilarParts(partName, topK = 5) {
    const embeddingResult = await this.embeddingService.generateEmbedding(partName)

    const searchResult = await this.milvusService.client.search({
      collection_name: this.collectionName,
      vectors: [embeddingResult.embedding],
      search_params: {
        anns_field: 'embedding',
        topk: topK + 1,
        metric_type: 'IP',
        params: { nprobe: 10 }
      },
      output_fields: ['part_name', 'category', 'occurrence_count']
    })

    return searchResult.results
      .filter(hit => hit.part_name !== partName && hit.score >= this.SIMILARITY_THRESHOLD)
      .map(hit => ({
        part_name: hit.part_name,
        category: hit.category,
        similarity: parseFloat(hit.score.toFixed(4)),
        occurrence_count: hit.occurrence_count
      }))
      .slice(0, topK)
  }

  /**
   * 推荐装配约束
   */
  async recommendConstraints(partA, partB) {
    const similarToA = await this.findSimilarParts(partA, 3)
    const similarToB = await this.findSimilarParts(partB, 3)

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
          const semanticConfidence = (simA.similarity + simB.similarity) / 2
          const combinedConfidence = record.confidence * semanticConfidence

          constraints.push({
            constraint_type: record.constraint_type,
            parameters: record.parameters,
            confidence: parseFloat(combinedConfidence.toFixed(4)),
            reason: `基于相似零件对 (${simA.part_name} ↔ ${simB.part_name})`
          })
        }
      }
    }

    return this._deduplicateConstraints(constraints)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
  }

  /**
   * 规范化名称
   */
  normalizeName(name) {
    return name
      .replace(/\s+/g, '_')
      .replace(/[×xX]/g, '*')
      .toLowerCase()
  }

  /**
   * 推断零件分类
   */
  inferCategory(name) {
    const nameLower = name.toLowerCase()

    if (nameLower.includes('螺栓') || nameLower.includes('bolt')) return 'bolt'
    if (nameLower.includes('螺母') || nameLower.includes('nut')) return 'nut'
    if (nameLower.includes('法兰') || nameLower.includes('flange')) return 'flange'
    if (nameLower.includes('垫片') || nameLower.includes('gasket')) return 'gasket'
    if (nameLower.includes('阀') || nameLower.includes('valve')) return 'valve'
    if (nameLower.includes('传感器') || nameLower.includes('sensor')) return 'sensor'
    if (nameLower.includes('vcr') || nameLower.includes('接头')) return 'fitting'
    if (nameLower.includes('执行器') || nameLower.includes('actuator')) return 'actuator'

    return 'other'
  }

  /**
   * 去重约束推荐
   */
  _deduplicateConstraints(constraints) {
    const seen = new Map()

    for (const constraint of constraints) {
      const key = `${constraint.constraint_type}:${JSON.stringify(constraint.parameters)}`
      if (!seen.has(key) || seen.get(key).confidence < constraint.confidence) {
        seen.set(key, constraint)
      }
    }

    return Array.from(seen.values())
  }
}

module.exports = SemanticMatchingService
