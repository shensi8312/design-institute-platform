/**
 * 性能优化服务
 * 提供批处理、缓存、队列管理等优化功能
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PerformanceOptimizer extends EventEmitter {
  constructor() {
    super();
    
    // 缓存配置
    this.cacheConfig = {
      enabled: process.env.CACHE_ENABLED !== 'false',
      maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100, // 最大缓存项数
      ttl: parseInt(process.env.CACHE_TTL) || 900000, // 15分钟
      directory: path.join(__dirname, '../../cache')
    };
    
    // 批处理配置
    this.batchConfig = {
      maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 5,
      batchTimeout: parseInt(process.env.BATCH_TIMEOUT) || 5000, // 5秒
      concurrency: parseInt(process.env.BATCH_CONCURRENCY) || 2
    };
    
    // 内存缓存
    this.memoryCache = new Map();
    
    // 批处理队列
    this.batchQueue = [];
    this.processingBatch = false;
    
    // 性能指标
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchesProcessed: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      requestCount: 0
    };
    
    // 初始化
    this.initialize();
  }
  
  async initialize() {
    // 创建缓存目录
    if (this.cacheConfig.enabled) {
      try {
        await fs.mkdir(this.cacheConfig.directory, { recursive: true });
        console.log('📁 缓存目录已创建:', this.cacheConfig.directory);
      } catch (error) {
        console.error('创建缓存目录失败:', error);
      }
    }
    
    // 定期清理缓存
    setInterval(() => this.cleanupCache(), 60000); // 每分钟清理
    
    // 定期处理批次
    setInterval(() => this.processBatchQueue(), this.batchConfig.batchTimeout);
  }
  
  /**
   * 1. 缓存管理
   */
  
  // 生成缓存键
  generateCacheKey(data) {
    const hash = crypto.createHash('md5');
    
    if (typeof data === 'string') {
      hash.update(data);
    } else if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(JSON.stringify(data));
    }
    
    return hash.digest('hex');
  }
  
  // 获取缓存
  async getFromCache(key) {
    if (!this.cacheConfig.enabled) return null;
    
    // 先检查内存缓存
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (cached.expires > Date.now()) {
        this.metrics.cacheHits++;
        console.log('💾 内存缓存命中:', key.substring(0, 8) + '...');
        return cached.data;
      } else {
        this.memoryCache.delete(key);
      }
    }
    
    // 检查文件缓存
    try {
      const cacheFile = path.join(this.cacheConfig.directory, key + '.json');
      const stat = await fs.stat(cacheFile);
      
      // 检查是否过期
      const age = Date.now() - stat.mtime.getTime();
      if (age < this.cacheConfig.ttl) {
        const content = await fs.readFile(cacheFile, 'utf-8');
        const data = JSON.parse(content);
        
        // 加入内存缓存
        this.memoryCache.set(key, {
          data: data,
          expires: Date.now() + this.cacheConfig.ttl
        });
        
        this.metrics.cacheHits++;
        console.log('📄 文件缓存命中:', key.substring(0, 8) + '...');
        return data;
      }
    } catch (error) {
      // 缓存不存在或读取失败
    }
    
    this.metrics.cacheMisses++;
    return null;
  }
  
  // 设置缓存
  async setCache(key, data) {
    if (!this.cacheConfig.enabled) return;
    
    // 内存缓存
    this.memoryCache.set(key, {
      data: data,
      expires: Date.now() + this.cacheConfig.ttl
    });
    
    // 限制内存缓存大小
    if (this.memoryCache.size > this.cacheConfig.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    // 文件缓存（异步，不等待）
    const cacheFile = path.join(this.cacheConfig.directory, key + '.json');
    fs.writeFile(cacheFile, JSON.stringify(data)).catch(error => {
      console.error('写入缓存文件失败:', error);
    });
  }
  
  // 清理过期缓存
  async cleanupCache() {
    // 清理内存缓存
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires < now) {
        this.memoryCache.delete(key);
      }
    }
    
    // 清理文件缓存
    if (this.cacheConfig.enabled) {
      try {
        const files = await fs.readdir(this.cacheConfig.directory);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.cacheConfig.directory, file);
            const stat = await fs.stat(filePath);
            const age = now - stat.mtime.getTime();
            
            if (age > this.cacheConfig.ttl) {
              await fs.unlink(filePath);
              console.log('🗑️ 清理过期缓存:', file);
            }
          }
        }
      } catch (error) {
        console.error('清理缓存失败:', error);
      }
    }
  }
  
  /**
   * 2. 批处理优化
   */
  
  // 添加到批处理队列
  addToBatch(task) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        task: task,
        resolve: resolve,
        reject: reject,
        timestamp: Date.now()
      });
      
      // 如果队列满了，立即处理
      if (this.batchQueue.length >= this.batchConfig.maxBatchSize) {
        this.processBatchQueue();
      }
    });
  }
  
  // 处理批处理队列
  async processBatchQueue() {
    if (this.processingBatch || this.batchQueue.length === 0) {
      return;
    }
    
    this.processingBatch = true;
    
    // 取出一批任务
    const batch = this.batchQueue.splice(0, this.batchConfig.maxBatchSize);
    
    console.log(`⚡ 处理批次: ${batch.length} 个任务`);
    const startTime = Date.now();
    
    try {
      // 并发处理
      const chunks = this.chunkArray(batch, this.batchConfig.concurrency);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async item => {
            try {
              const result = await item.task();
              item.resolve(result);
            } catch (error) {
              item.reject(error);
            }
          })
        );
      }
      
      // 更新指标
      const processingTime = Date.now() - startTime;
      this.metrics.batchesProcessed++;
      this.metrics.totalProcessingTime += processingTime;
      this.metrics.averageProcessingTime = 
        this.metrics.totalProcessingTime / this.metrics.batchesProcessed;
      
      console.log(`✅ 批次处理完成: ${processingTime}ms`);
      
    } catch (error) {
      console.error('批处理失败:', error);
      // 拒绝所有任务
      batch.forEach(item => item.reject(error));
    } finally {
      this.processingBatch = false;
    }
  }
  
  // 数组分块
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * 3. 请求去重
   */
  
  // 进行中的请求
  pendingRequests = new Map();
  
  // 去重请求
  async deduplicateRequest(key, requestFn) {
    // 如果有相同的请求正在处理，等待其结果
    if (this.pendingRequests.has(key)) {
      console.log('🔄 重复请求，等待现有处理:', key.substring(0, 8) + '...');
      return await this.pendingRequests.get(key);
    }
    
    // 创建新请求
    const promise = requestFn();
    this.pendingRequests.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
  
  /**
   * 4. 优化的处理流程
   */
  
  async optimizedProcess(imageBuffer, processFn, options = {}) {
    const startTime = Date.now();
    this.metrics.requestCount++;
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(imageBuffer);
    
    // 1. 检查缓存
    if (options.useCache !== false) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        const processingTime = Date.now() - startTime;
        console.log(`⚡ 缓存返回: ${processingTime}ms`);
        return cached;
      }
    }
    
    // 2. 去重处理
    const result = await this.deduplicateRequest(cacheKey, async () => {
      // 3. 批处理（如果启用）
      if (options.useBatch && this.batchConfig.maxBatchSize > 1) {
        return await this.addToBatch(() => processFn(imageBuffer));
      } else {
        // 直接处理
        return await processFn(imageBuffer);
      }
    });
    
    // 4. 缓存结果
    if (options.useCache !== false) {
      await this.setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ 处理完成: ${processingTime}ms`);
    
    return result;
  }
  
  /**
   * 5. GPU加速支持（如果有CUDA）
   */
  
  checkGPUAvailable() {
    // 这需要在Python端检查
    // 这里仅作为标记
    return {
      cuda: process.env.CUDA_AVAILABLE === 'true',
      device: process.env.CUDA_DEVICE || 'cpu',
      memory: process.env.GPU_MEMORY || 'N/A'
    };
  }
  
  /**
   * 6. 性能监控
   */
  
  getMetrics() {
    const cacheHitRate = this.metrics.cacheHits / 
      (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    
    return {
      ...this.metrics,
      cacheHitRate: (cacheHitRate * 100).toFixed(2) + '%',
      memoryCacheSize: this.memoryCache.size,
      queueLength: this.batchQueue.length,
      gpuInfo: this.checkGPUAvailable()
    };
  }
  
  // 重置指标
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchesProcessed: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      requestCount: 0
    };
  }
  
  /**
   * 7. 预热缓存
   */
  
  async warmupCache(images) {
    console.log(`🔥 预热缓存: ${images.length} 张图片`);
    
    for (const image of images) {
      const key = this.generateCacheKey(image);
      
      // 检查是否已缓存
      const cached = await this.getFromCache(key);
      if (!cached) {
        // 触发处理但不等待
        this.emit('warmup', image);
      }
    }
  }
  
  /**
   * 8. 智能队列管理
   */
  
  priorityQueue = [];
  
  addToPriorityQueue(task, priority = 0) {
    this.priorityQueue.push({ task, priority });
    this.priorityQueue.sort((a, b) => b.priority - a.priority);
  }
  
  async processPriorityQueue() {
    if (this.priorityQueue.length === 0) return;
    
    const item = this.priorityQueue.shift();
    return await item.task();
  }
}

// 单例
module.exports = new PerformanceOptimizer();