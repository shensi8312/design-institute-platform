const SemanticMatchingService = require('../../../../src/services/semantic/SemanticMatchingService')
const db = require('../../../../src/config/database')

describe('SemanticMatchingService 单元测试', () => {
  let semanticService

  beforeAll(async () => {
    semanticService = new SemanticMatchingService()

    // 准备测试数据：插入一些assembly_dataset记录
    await db('assembly_dataset').insert([
      {
        dataset_name: '242装配体',
        part_a: 'GB/T 70.1 M8x1.25 六角头螺栓',
        part_b: 'GB/T 6170 M8x1.25 六角螺母',
        constraint_type: 'SCREW',
        parameters: { pitch: 1.25, preload: 5000 },
        source: 'step_file',
        confidence: 0.95
      },
      {
        dataset_name: '242装配体',
        part_a: 'ANSI B16.5 150# DN50 法兰',
        part_b: 'ANSI B16.20 DN50 垫片',
        constraint_type: 'COINCIDENT',
        parameters: { offset: 0 },
        source: 'step_file',
        confidence: 0.92
      }
    ])
  })

  afterAll(async () => {
    // 清理测试数据
    await db('part_name_vectors').where('part_name', 'like', '%测试%').delete()
    await db('assembly_dataset').where('dataset_name', '242装配体').delete()
    await db.destroy()
  })

  describe('零件名称标准化', () => {
    test('应该正确提取中文词组', () => {
      const result = semanticService.normalizeName('六角头螺栓')

      expect(result.normalized).toBe('六角头螺栓')
      expect(result.tokens).toContain('六角')
      expect(result.tokens).toContain('角头')
      expect(result.tokens).toContain('头螺')
      expect(result.tokens).toContain('螺栓')
    })

    test('应该正确提取螺纹规格', () => {
      const result = semanticService.normalizeName('GB/T 70.1 M8x1.25 六角头螺栓')

      expect(result.tokens).toContain('M8X1.25')
    })

    test('应该正确提取法兰规格', () => {
      const result = semanticService.normalizeName('ANSI B16.5 150# DN50 法兰')

      expect(result.tokens).toContain('150#')
      expect(result.tokens).toContain('DN50')
    })

    test('应该去除重复词', () => {
      const result = semanticService.normalizeName('M8 M8 螺栓')

      const m8Count = result.tokens.filter(t => t === 'M8').length
      expect(m8Count).toBe(1)
    })
  })

  describe('词频计算', () => {
    test('应该正确计算TF值', () => {
      const tokens = ['M8', '螺栓', 'M8', '螺母']
      const tf = semanticService.calculateTF(tokens)

      expect(tf['M8']).toBe(0.5) // 2/4
      expect(tf['螺栓']).toBe(0.25) // 1/4
      expect(tf['螺母']).toBe(0.25) // 1/4
    })
  })

  describe('零件类别推断', () => {
    test('应该识别螺栓', () => {
      const category = semanticService.inferCategory('GB/T 70.1 六角头螺栓')
      expect(category).toBe('bolt')
    })

    test('应该识别螺母', () => {
      const category = semanticService.inferCategory('GB/T 6170 六角螺母')
      expect(category).toBe('nut')
    })

    test('应该识别法兰', () => {
      const category = semanticService.inferCategory('ANSI B16.5 法兰')
      expect(category).toBe('flange')
    })

    test('应该识别垫片', () => {
      const category = semanticService.inferCategory('ANSI B16.20 垫片')
      expect(category).toBe('gasket')
    })

    test('应该识别阀门', () => {
      const category = semanticService.inferCategory('球阀 DN50')
      expect(category).toBe('ball_valve')
    })
  })

  describe('余弦相似度计算', () => {
    test('应该返回1.0对于相同向量', () => {
      const vectorA = { 'M8': 0.5, '螺栓': 0.3 }
      const vectorB = { 'M8': 0.5, '螺栓': 0.3 }

      const similarity = semanticService.cosineSimilarity(vectorA, vectorB)
      expect(similarity).toBeCloseTo(1.0, 4)
    })

    test('应该返回0.0对于正交向量', () => {
      const vectorA = { 'M8': 1.0 }
      const vectorB = { 'M10': 1.0 }

      const similarity = semanticService.cosineSimilarity(vectorA, vectorB)
      expect(similarity).toBe(0)
    })

    test('应该计算部分重叠向量的相似度', () => {
      const vectorA = { 'M8': 0.5, '螺栓': 0.5 }
      const vectorB = { 'M8': 0.5, '螺母': 0.5 }

      const similarity = semanticService.cosineSimilarity(vectorA, vectorB)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(1)
    })
  })

  describe('零件向量化', () => {
    test('应该成功向量化新零件', async () => {
      const partName = '测试螺栓 M8x1.25'
      const vector = await semanticService.vectorizePart(partName)

      expect(vector.part_name).toBe(partName)
      expect(vector.category).toBe('bolt')
      expect(vector.tfidf_vector).toBeDefined()
      expect(vector.occurrence_count).toBe(1)
    })

    test('重复向量化应增加出现次数', async () => {
      const partName = '测试螺栓 M10'

      await semanticService.vectorizePart(partName)
      const second = await semanticService.vectorizePart(partName)

      expect(second.occurrence_count).toBe(2)
    })
  })

  describe('相似零件查找', () => {
    test('应该找到相似的螺栓', async () => {
      // 先向量化一些测试零件
      await semanticService.vectorizePart('GB/T 70.1 M8 六角头螺栓')
      await semanticService.vectorizePart('GB/T 70.1 M8x1.25 六角头螺栓')
      await semanticService.vectorizePart('DIN 933 M8 六角头螺栓')

      const similar = await semanticService.findSimilarParts('M8 六角螺栓', 5)

      expect(similar.length).toBeGreaterThan(0)
      expect(similar[0].similarity).toBeGreaterThanOrEqual(0.6)
      expect(similar[0]).toHaveProperty('part_name')
      expect(similar[0]).toHaveProperty('category')
    })

    test('相似度应该降序排列', async () => {
      const similar = await semanticService.findSimilarParts('M8 六角螺栓', 5)

      if (similar.length >= 2) {
        expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity)
      }
    })
  })

  describe('装配约束推荐', () => {
    test('应该基于语义匹配推荐约束', async () => {
      // 先向量化历史数据中的零件
      await semanticService.vectorizeDataset('242装配体')

      // 查询相似零件对的约束
      const recommendations = await semanticService.recommendConstraints(
        'M8 螺栓',
        'M8 螺母'
      )

      if (recommendations.length > 0) {
        const firstRec = recommendations[0]
        expect(firstRec).toHaveProperty('constraint_type')
        expect(firstRec).toHaveProperty('confidence')
        expect(firstRec).toHaveProperty('reason')
        expect(firstRec.confidence).toBeGreaterThan(0)
        expect(firstRec.confidence).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('批量向量化', () => {
    test('应该成功向量化数据集中的所有零件', async () => {
      const results = await semanticService.vectorizeDataset('242装配体')

      expect(results.length).toBeGreaterThan(0)

      // 验证数据库中确实存储了向量
      const vectors = await db('part_name_vectors')
        .whereIn('part_name', [
          'GB/T 70.1 M8x1.25 六角头螺栓',
          'GB/T 6170 M8x1.25 六角螺母'
        ])

      expect(vectors.length).toBe(2)
    })
  })
})
