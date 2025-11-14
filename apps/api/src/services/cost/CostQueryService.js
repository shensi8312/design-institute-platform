const db = require('../../config/database')

/**
 * 成本查询服务
 * Week 2: 提供标准件成本查询、供应商比价、历史价格分析
 */
class CostQueryService {
  constructor() {
    this.cache = new Map()
    this.CACHE_TTL = 3600 * 1000 // 1小时缓存
  }

  /**
   * 查询零件的最优价格（考虑价格+交货期+供应商评级）
   * @param {string} partCode - 零件编码
   * @param {number} quantity - 采购数量
   * @returns {Object} 最优报价信息
   */
  async getBestPrice(partCode, quantity = 1) {
    // 1. 查询零件ID
    const part = await db('standard_parts_catalog')
      .where({ part_code: partCode, is_active: true })
      .first()

    if (!part) {
      throw new Error(`零件 ${partCode} 不存在`)
    }

    // 2. 查询所有当前有效报价
    const quotes = await db('standard_parts_cost as spc')
      .join('suppliers as s', 'spc.supplier_id', 's.id')
      .where('spc.part_id', part.id)
      .where('spc.is_current', true)
      .where('spc.valid_from', '<=', db.fn.now())
      .where(function() {
        this.whereNull('spc.valid_to').orWhere('spc.valid_to', '>=', db.fn.now())
      })
      .where('s.is_active', true)
      .select(
        'spc.*',
        's.supplier_code',
        's.supplier_name',
        's.rating as supplier_rating',
        's.is_preferred',
        's.payment_terms',
        's.delivery_time_days as supplier_delivery_days'
      )

    if (quotes.length === 0) {
      return {
        part_code: partCode,
        part_name: part.part_name,
        quantity,
        best_quote: null,
        message: '暂无报价'
      }
    }

    // 3. 计算每个报价的综合评分
    const scoredQuotes = quotes.map(q => {
      // 过滤不满足MOQ的报价
      if (quantity < q.moq) {
        return { ...q, score: -1, reason: `不满足最小订货量(${q.moq})` }
      }

      let score = 100
      const totalPrice = q.unit_price * quantity

      // 价格评分 (40%)
      const minPrice = Math.min(...quotes.filter(x => quantity >= x.moq).map(x => x.unit_price))
      const priceRatio = q.unit_price / minPrice
      const priceScore = Math.max(0, 40 - (priceRatio - 1) * 40)
      score += priceScore

      // 交货期评分 (30%)
      const deliveryScore = Math.max(0, 30 - q.lead_time_days)
      score += deliveryScore

      // 供应商评级评分 (20%)
      const ratingScores = { 'A': 20, 'B': 10, 'C': 5 }
      score += ratingScores[q.supplier_rating] || 0

      // 优选供应商加分 (10%)
      if (q.is_preferred) {
        score += 10
      }

      return {
        ...q,
        total_price: parseFloat(totalPrice.toFixed(2)),
        score: Math.round(score),
        reason: '综合评分最优'
      }
    }).filter(q => q.score >= 0)

    if (scoredQuotes.length === 0) {
      return {
        part_code: partCode,
        part_name: part.part_name,
        quantity,
        best_quote: null,
        all_quotes: quotes,
        message: `所有报价均不满足最小订货量要求(需${quantity}件)`
      }
    }

    // 4. 选择最优报价
    const bestQuote = scoredQuotes.sort((a, b) => b.score - a.score)[0]

    return {
      part_code: partCode,
      part_name: part.part_name,
      category: part.category,
      quantity,
      best_quote: {
        supplier_code: bestQuote.supplier_code,
        supplier_name: bestQuote.supplier_name,
        supplier_rating: bestQuote.supplier_rating,
        unit_price: parseFloat(bestQuote.unit_price),
        total_price: bestQuote.total_price,
        currency: bestQuote.currency,
        moq: bestQuote.moq,
        lead_time_days: bestQuote.lead_time_days,
        payment_terms: bestQuote.payment_terms,
        score: bestQuote.score
      },
      alternative_quotes: scoredQuotes.slice(1, 3).map(q => ({
        supplier_name: q.supplier_name,
        unit_price: parseFloat(q.unit_price),
        total_price: q.total_price,
        lead_time_days: q.lead_time_days,
        score: q.score
      }))
    }
  }

  /**
   * 批量查询BOM成本（装配约束推理时使用）
   * @param {Array} bomParts - BOM零件列表 [{partCode, quantity}]
   * @returns {Object} 总成本估算
   */
  async estimateBOMCost(bomParts) {
    const results = []
    let totalCost = 0
    let missingParts = []

    for (const bomPart of bomParts) {
      try {
        const quote = await this.getBestPrice(bomPart.partCode || bomPart.part_code, bomPart.quantity || 1)

        if (quote.best_quote) {
          results.push({
            part_code: quote.part_code,
            part_name: quote.part_name,
            quantity: quote.quantity,
            unit_price: quote.best_quote.unit_price,
            total_price: quote.best_quote.total_price,
            supplier: quote.best_quote.supplier_name,
            lead_time_days: quote.best_quote.lead_time_days
          })
          totalCost += quote.best_quote.total_price
        } else {
          missingParts.push({
            part_code: bomPart.partCode || bomPart.part_code,
            message: quote.message
          })
        }
      } catch (error) {
        missingParts.push({
          part_code: bomPart.partCode || bomPart.part_code,
          message: error.message
        })
      }
    }

    return {
      total_cost: parseFloat(totalCost.toFixed(2)),
      currency: 'CNY',
      parts_with_quotes: results,
      missing_parts: missingParts,
      coverage_rate: ((results.length / bomParts.length) * 100).toFixed(1) + '%',
      max_lead_time_days: results.length > 0 ? Math.max(...results.map(r => r.lead_time_days)) : 0
    }
  }

  /**
   * 供应商比价分析
   * @param {string} partCode - 零件编码
   * @returns {Array} 所有供应商报价对比
   */
  async compareSuppliers(partCode) {
    const part = await db('standard_parts_catalog')
      .where({ part_code: partCode, is_active: true })
      .first()

    if (!part) {
      throw new Error(`零件 ${partCode} 不存在`)
    }

    const quotes = await db('standard_parts_cost as spc')
      .join('suppliers as s', 'spc.supplier_id', 's.id')
      .where('spc.part_id', part.id)
      .where('spc.is_current', true)
      .where('s.is_active', true)
      .select(
        's.supplier_code',
        's.supplier_name',
        's.rating',
        's.is_preferred',
        's.payment_terms',
        'spc.unit_price',
        'spc.currency',
        'spc.moq',
        'spc.lead_time_days',
        'spc.valid_from',
        'spc.valid_to'
      )
      .orderBy('spc.unit_price', 'asc')

    return {
      part_code: partCode,
      part_name: part.part_name,
      suppliers: quotes.map(q => ({
        supplier_code: q.supplier_code,
        supplier_name: q.supplier_name,
        rating: q.rating,
        is_preferred: q.is_preferred,
        unit_price: parseFloat(q.unit_price),
        currency: q.currency,
        moq: q.moq,
        lead_time_days: q.lead_time_days,
        payment_terms: q.payment_terms,
        valid_from: q.valid_from,
        valid_to: q.valid_to
      }))
    }
  }

  /**
   * 历史价格趋势分析
   * @param {string} partCode - 零件编码
   * @param {number} months - 回溯月数
   * @returns {Object} 价格趋势数据
   */
  async getPriceTrend(partCode, months = 6) {
    const part = await db('standard_parts_catalog')
      .where({ part_code: partCode, is_active: true })
      .first()

    if (!part) {
      throw new Error(`零件 ${partCode} 不存在`)
    }

    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // 查询采购历史
    const history = await db('purchase_history as ph')
      .join('suppliers as s', 'ph.supplier_id', 's.id')
      .where('ph.part_id', part.id)
      .where('ph.purchase_date', '>=', startDate.toISOString().split('T')[0])
      .select(
        'ph.purchase_date',
        'ph.unit_price',
        'ph.quantity',
        'ph.total_amount',
        'ph.currency',
        's.supplier_name',
        'ph.quality_rating'
      )
      .orderBy('ph.purchase_date', 'asc')

    if (history.length === 0) {
      return {
        part_code: partCode,
        part_name: part.part_name,
        message: `最近${months}个月无采购记录`,
        trend: null
      }
    }

    // 计算统计数据
    const prices = history.map(h => parseFloat(h.unit_price))
    const avgPrice = (prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(4)
    const minPrice = Math.min(...prices).toFixed(4)
    const maxPrice = Math.max(...prices).toFixed(4)
    const latestPrice = prices[prices.length - 1].toFixed(4)

    // 价格趋势判断
    let trend = 'stable'
    if (prices.length >= 2) {
      const firstHalf = prices.slice(0, Math.ceil(prices.length / 2))
      const secondHalf = prices.slice(Math.ceil(prices.length / 2))
      const avgFirst = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length

      if (avgSecond > avgFirst * 1.1) trend = 'rising'
      else if (avgSecond < avgFirst * 0.9) trend = 'falling'
    }

    return {
      part_code: partCode,
      part_name: part.part_name,
      period: `${months}个月`,
      statistics: {
        avg_price: parseFloat(avgPrice),
        min_price: parseFloat(minPrice),
        max_price: parseFloat(maxPrice),
        latest_price: parseFloat(latestPrice),
        trend,
        sample_count: history.length
      },
      history: history.map(h => ({
        date: h.purchase_date,
        unit_price: parseFloat(h.unit_price),
        quantity: h.quantity,
        supplier: h.supplier_name,
        quality_rating: h.quality_rating
      }))
    }
  }

  /**
   * 供应商绩效评分
   * @returns {Array} 供应商排名
   */
  async getSupplierPerformance() {
    // 查询所有供应商及其采购历史
    const suppliers = await db('suppliers')
      .where('is_active', true)
      .select('*')

    const performance = []

    for (const supplier of suppliers) {
      // 查询采购记录
      const purchases = await db('purchase_history')
        .where('supplier_id', supplier.id)
        .select('*')

      if (purchases.length === 0) {
        performance.push({
          supplier_code: supplier.supplier_code,
          supplier_name: supplier.supplier_name,
          rating: supplier.rating,
          is_preferred: supplier.is_preferred,
          purchase_count: 0,
          total_amount: 0,
          avg_quality_rating: null,
          avg_delivery_time: supplier.delivery_time_days,
          score: 0
        })
        continue
      }

      // 计算指标
      const totalAmount = purchases.reduce((sum, p) => sum + parseFloat(p.total_amount), 0)
      const qualityRatings = purchases.filter(p => p.quality_rating).map(p => p.quality_rating)
      const avgQuality = qualityRatings.length > 0
        ? (qualityRatings.reduce((sum, r) => sum + r, 0) / qualityRatings.length)
        : null

      // 计算准时交货率
      const onTimeDeliveries = purchases.filter(p => {
        if (!p.delivery_date) return false
        const orderDate = new Date(p.purchase_date)
        const deliveryDate = new Date(p.delivery_date)
        const diffDays = Math.ceil((deliveryDate - orderDate) / (1000 * 60 * 60 * 24))
        return diffDays <= (supplier.delivery_time_days + 2) // 允许2天延迟
      }).length
      const onTimeRate = purchases.length > 0 ? (onTimeDeliveries / purchases.length) : 0

      // 综合评分
      let score = 0
      score += avgQuality ? avgQuality * 15 : 0 // 质量分 (最高75分)
      score += onTimeRate * 25 // 准时率 (最高25分)
      const ratingScores = { 'A': 20, 'B': 10, 'C': 5 }
      score += ratingScores[supplier.rating] || 0

      performance.push({
        supplier_code: supplier.supplier_code,
        supplier_name: supplier.supplier_name,
        rating: supplier.rating,
        is_preferred: supplier.is_preferred,
        purchase_count: purchases.length,
        total_amount: parseFloat(totalAmount.toFixed(2)),
        avg_quality_rating: avgQuality ? parseFloat(avgQuality.toFixed(1)) : null,
        on_time_rate: parseFloat((onTimeRate * 100).toFixed(1)),
        payment_terms: supplier.payment_terms,
        score: Math.round(score)
      })
    }

    return performance.sort((a, b) => b.score - a.score)
  }
}

module.exports = CostQueryService
