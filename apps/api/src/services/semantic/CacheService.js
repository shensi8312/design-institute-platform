const redis = require('redis')
const crypto = require('crypto')

/**
 * Redis 缓存服务
 * 用于语义层查询结果缓存
 */
class CacheService {
  constructor() {
    this.client = null
    this.defaultTTL = parseInt(process.env.CACHE_TTL || 3600) // 默认 1 小时
    this.prefix = process.env.CACHE_PREFIX || 'semantic:'
  }

  /**
   * 初始化 Redis 连接
   */
  async initialize() {
    try {
      this.client = redis.createClient({
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        password: process.env.REDIS_PASSWORD || undefined
      })

      this.client.on('error', (err) => {
        console.error('[Cache] Redis 错误:', err)
      })

      await this.client.connect()
      console.log('✅ 缓存服务初始化成功 (Redis)')
      return true
    } catch (error) {
      console.error('[Cache] 初始化失败:', error)
      // 缓存失败不应阻塞主流程
      this.client = null
      return false
    }
  }

  /**
   * 生成缓存键
   */
  _generateKey(namespace, params) {
    const paramStr = JSON.stringify(params)
    const hash = crypto.createHash('md5').update(paramStr).digest('hex').substring(0, 12)
    return `${this.prefix}${namespace}:${hash}`
  }

  /**
   * 获取缓存
   */
  async get(namespace, params) {
    if (!this.client) return null

    try {
      const key = this._generateKey(namespace, params)
      const cached = await this.client.get(key)

      if (cached) {
        console.log(`[Cache] 命中: ${namespace}`)
        return JSON.parse(cached)
      }

      console.log(`[Cache] 未命中: ${namespace}`)
      return null
    } catch (error) {
      console.error('[Cache] 获取失败:', error)
      return null
    }
  }

  /**
   * 设置缓存
   */
  async set(namespace, params, value, ttl = null) {
    if (!this.client) return false

    try {
      const key = this._generateKey(namespace, params)
      const serialized = JSON.stringify(value)
      const expiry = ttl || this.defaultTTL

      await this.client.setEx(key, expiry, serialized)
      console.log(`[Cache] 已缓存: ${namespace} (TTL: ${expiry}s)`)
      return true
    } catch (error) {
      console.error('[Cache] 设置失败:', error)
      return false
    }
  }

  /**
   * 删除缓存
   */
  async del(namespace, params = null) {
    if (!this.client) return false

    try {
      if (params === null) {
        // 删除整个命名空间
        const pattern = `${this.prefix}${namespace}:*`
        const keys = await this.client.keys(pattern)

        if (keys.length > 0) {
          await this.client.del(keys)
          console.log(`[Cache] 已清空命名空间: ${namespace} (${keys.length} 个键)`)
        }
      } else {
        // 删除特定键
        const key = this._generateKey(namespace, params)
        await this.client.del(key)
        console.log(`[Cache] 已删除: ${namespace}`)
      }

      return true
    } catch (error) {
      console.error('[Cache] 删除失败:', error)
      return false
    }
  }

  /**
   * 批量失效缓存 (基于模式匹配)
   */
  async invalidatePattern(pattern) {
    if (!this.client) return false

    try {
      const fullPattern = `${this.prefix}${pattern}`
      const keys = await this.client.keys(fullPattern)

      if (keys.length > 0) {
        await this.client.del(keys)
        console.log(`[Cache] 批量失效: ${pattern} (${keys.length} 个键)`)
      }

      return true
    } catch (error) {
      console.error('[Cache] 批量失效失败:', error)
      return false
    }
  }

  /**
   * 获取缓存统计
   */
  async getStats() {
    if (!this.client) {
      return { enabled: false }
    }

    try {
      const info = await this.client.info('stats')
      const keys = await this.client.keys(`${this.prefix}*`)

      return {
        enabled: true,
        totalKeys: keys.length,
        prefix: this.prefix,
        defaultTTL: this.defaultTTL,
        info
      }
    } catch (error) {
      console.error('[Cache] 获取统计失败:', error)
      return { enabled: true, error: error.message }
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.client) {
      await this.client.quit()
      console.log('[Cache] 连接已关闭')
    }
  }
}

// 单例导出
module.exports = new CacheService()
