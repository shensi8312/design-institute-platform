const CostQueryService = require('../../../../src/services/cost/CostQueryService')
const db = require('../../../../src/config/database')

describe('CostQueryService 单元测试', () => {
  let costService

  beforeAll(async () => {
    costService = new CostQueryService()

    // 确保测试数据存在（需要先运行seed_cost_and_suppliers.js）
    const supplierCount = await db('suppliers').count('* as count')
    const partCount = await db('standard_parts_catalog').count('* as count')

    if (parseInt(supplierCount[0].count) === 0 || parseInt(partCount[0].count) === 0) {
      console.warn('⚠️  测试数据不足，请先运行: node scripts/seed_cost_and_suppliers.js')
    }
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('查询最优价格', () => {
    test('应该返回M8螺栓的最优报价', async () => {
      const result = await costService.getBestPrice('GB/T70.1-M8', 100)

      expect(result.part_code).toBe('GB/T70.1-M8')
      expect(result.part_name).toContain('M8')
      expect(result.quantity).toBe(100)
      expect(result.best_quote).toBeDefined()
      expect(result.best_quote.unit_price).toBeGreaterThan(0)
      expect(result.best_quote.total_price).toBe(result.best_quote.unit_price * 100)
      expect(result.best_quote.supplier_name).toBeDefined()
      expect(result.best_quote.score).toBeGreaterThan(0)
    })

    test('应该在数量不满足MOQ时返回合适的提示', async () => {
      // SUP002的MOQ是500
      const result = await costService.getBestPrice('GB/T70.1-M8', 50)

      // 应该返回其他满足MOQ的报价（SUP001 MOQ=100, SUP004 MOQ=200）
      // 或者提示所有报价都不满足
      if (result.best_quote) {
        expect(result.best_quote.moq).toBeLessThanOrEqual(50)
      } else {
        expect(result.message).toContain('订货量')
      }
    })

    test('不存在的零件应抛出错误', async () => {
      await expect(costService.getBestPrice('NONEXISTENT-PART', 1))
        .rejects
        .toThrow('不存在')
    })

    test('无报价的零件应返回提示信息', async () => {
      // 创建一个无报价的测试零件
      const testPart = await db('standard_parts_catalog').insert({
        part_code: 'TEST-NO-QUOTE',
        part_name: '测试零件（无报价）',
        category: 'test',
        standard_system: 'TEST',
        specifications: { test: true }
      }).returning('id')

      const result = await costService.getBestPrice('TEST-NO-QUOTE', 1)

      expect(result.best_quote).toBeNull()
      expect(result.message).toContain('暂无报价')

      // 清理测试数据
      await db('standard_parts_catalog').where('part_code', 'TEST-NO-QUOTE').delete()
    })
  })

  describe('BOM成本估算', () => {
    test('应该计算多个零件的总成本', async () => {
      const bomParts = [
        { part_code: 'GB/T70.1-M8', quantity: 100 },
        { part_code: 'GB/T6170-M8', quantity: 100 },
        { part_code: 'GB/T97.1-M8', quantity: 100 }
      ]

      const result = await costService.estimateBOMCost(bomParts)

      expect(result.total_cost).toBeGreaterThan(0)
      expect(result.currency).toBe('CNY')
      expect(result.parts_with_quotes.length).toBeGreaterThan(0)
      expect(result.coverage_rate).toBeDefined()
      expect(parseFloat(result.coverage_rate)).toBeGreaterThan(0)
    })

    test('应该处理部分零件无报价的情况', async () => {
      const bomParts = [
        { part_code: 'GB/T70.1-M8', quantity: 100 },
        { part_code: 'NONEXISTENT-PART', quantity: 10 }
      ]

      const result = await costService.estimateBOMCost(bomParts)

      expect(result.parts_with_quotes.length).toBeGreaterThan(0)
      expect(result.missing_parts.length).toBeGreaterThan(0)
      expect(result.missing_parts[0].part_code).toBe('NONEXISTENT-PART')
      expect(parseFloat(result.coverage_rate)).toBeLessThan(100)
    })

    test('应该计算最大交货期', async () => {
      const bomParts = [
        { part_code: 'GB/T70.1-M8', quantity: 100 },
        { part_code: 'ANSI-150#-DN50', quantity: 5 } // 法兰交货期通常更长
      ]

      const result = await costService.estimateBOMCost(bomParts)

      expect(result.max_lead_time_days).toBeGreaterThan(0)
    })
  })

  describe('供应商比价分析', () => {
    test('应该返回M8螺栓的所有供应商报价', async () => {
      const result = await costService.compareSuppliers('GB/T70.1-M8')

      expect(result.part_code).toBe('GB/T70.1-M8')
      expect(result.suppliers.length).toBeGreaterThan(0)
      expect(result.suppliers[0].supplier_name).toBeDefined()
      expect(result.suppliers[0].unit_price).toBeGreaterThan(0)
      expect(result.suppliers[0].rating).toMatch(/^[ABC]$/)

      // 应该按价格升序排列
      if (result.suppliers.length > 1) {
        expect(result.suppliers[0].unit_price).toBeLessThanOrEqual(result.suppliers[1].unit_price)
      }
    })

    test('应该包含供应商详细信息', async () => {
      const result = await costService.compareSuppliers('GB/T70.1-M8')

      const firstSupplier = result.suppliers[0]
      expect(firstSupplier).toHaveProperty('supplier_code')
      expect(firstSupplier).toHaveProperty('rating')
      expect(firstSupplier).toHaveProperty('moq')
      expect(firstSupplier).toHaveProperty('lead_time_days')
      expect(firstSupplier).toHaveProperty('payment_terms')
    })
  })

  describe('历史价格趋势分析', () => {
    test('应该返回M8螺栓的价格历史', async () => {
      const result = await costService.getPriceTrend('GB/T70.1-M8', 6)

      expect(result.part_code).toBe('GB/T70.1-M8')

      if (result.statistics) {
        expect(result.statistics.avg_price).toBeGreaterThan(0)
        expect(result.statistics.min_price).toBeLessThanOrEqual(result.statistics.max_price)
        expect(result.statistics.trend).toMatch(/^(rising|falling|stable)$/)
        expect(result.statistics.sample_count).toBeGreaterThan(0)
      }
    })

    test('无采购历史的零件应返回提示', async () => {
      // GB/T70.1-M12可能没有采购历史
      const result = await costService.getPriceTrend('GB/T70.1-M12', 6)

      if (!result.trend) {
        expect(result.message).toContain('无采购记录')
      }
    })

    test('历史记录应包含详细信息', async () => {
      const result = await costService.getPriceTrend('GB/T70.1-M8', 6)

      if (result.history && result.history.length > 0) {
        const record = result.history[0]
        expect(record).toHaveProperty('date')
        expect(record).toHaveProperty('unit_price')
        expect(record).toHaveProperty('quantity')
        expect(record).toHaveProperty('supplier')
      }
    })
  })

  describe('供应商绩效评分', () => {
    test('应该返回所有供应商的绩效排名', async () => {
      const result = await costService.getSupplierPerformance()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // 应该按评分降序排列
      if (result.length > 1) {
        expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
      }
    })

    test('绩效评分应包含完整指标', async () => {
      const result = await costService.getSupplierPerformance()

      const topSupplier = result[0]
      expect(topSupplier).toHaveProperty('supplier_code')
      expect(topSupplier).toHaveProperty('supplier_name')
      expect(topSupplier).toHaveProperty('rating')
      expect(topSupplier).toHaveProperty('purchase_count')
      expect(topSupplier).toHaveProperty('total_amount')
      expect(topSupplier).toHaveProperty('score')
    })

    test('有采购记录的供应商应有质量评分', async () => {
      const result = await costService.getSupplierPerformance()

      const suppliersWithPurchases = result.filter(s => s.purchase_count > 0)
      if (suppliersWithPurchases.length > 0) {
        const supplier = suppliersWithPurchases[0]
        expect(supplier.avg_quality_rating).toBeGreaterThanOrEqual(1)
        expect(supplier.avg_quality_rating).toBeLessThanOrEqual(5)
        expect(supplier.on_time_rate).toBeDefined()
      }
    })
  })

  describe('综合评分算法', () => {
    test('优选供应商应获得额外加分', async () => {
      const result = await costService.getBestPrice('ANSI-150#-DN50', 5)

      if (result.best_quote && result.alternative_quotes) {
        // 检查是否有优选供应商获得高分
        const allQuotes = [result.best_quote, ...result.alternative_quotes]
        const preferredQuote = allQuotes.find(q => q.supplier_name.includes('Swagelok'))

        if (preferredQuote) {
          // Swagelok是A级优选供应商，应该获得高分
          expect(preferredQuote.score).toBeGreaterThan(100)
        }
      }
    })
  })
})
