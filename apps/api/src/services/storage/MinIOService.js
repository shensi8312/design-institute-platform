const Minio = require('minio')
const crypto = require('crypto')
const path = require('path')

/**
 * MinIO 对象存储服务
 * 用于存储原始文档、解析结果等
 */
class MinIOService {
  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    })

    this.defaultBucket = process.env.MINIO_BUCKET || 'semantic-documents'
  }

  /**
   * 初始化 - 确保 bucket 存在
   */
  async initialize() {
    try {
      const exists = await this.client.bucketExists(this.defaultBucket)

      if (!exists) {
        await this.client.makeBucket(this.defaultBucket, 'us-east-1')
        console.log(`[MinIO] 创建 bucket: ${this.defaultBucket}`)
      } else {
        console.log(`[MinIO] 连接到 bucket: ${this.defaultBucket}`)
      }

      console.log('✅ MinIO 服务初始化成功')
      return true
    } catch (error) {
      console.error('[MinIO] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 上传文件
   *
   * @param {Buffer} fileBuffer - 文件内容
   * @param {string} fileName - 原始文件名
   * @param {Object} metadata - 元数据
   * @returns {Object} 上传结果
   */
  async uploadFile(fileBuffer, fileName, metadata = {}) {
    try {
      // 生成唯一文件 ID
      const fileId = this._generateFileId(fileName)
      const ext = path.extname(fileName)
      const objectName = `${fileId}${ext}`

      // 准备元数据
      const metaData = {
        'Content-Type': this._getContentType(ext),
        'X-Original-Name': fileName,
        'X-Upload-Time': new Date().toISOString(),
        ...this._flattenMetadata(metadata)
      }

      // 上传到 MinIO
      await this.client.putObject(
        this.defaultBucket,
        objectName,
        fileBuffer,
        fileBuffer.length,
        metaData
      )

      console.log(`[MinIO] 文件上传成功: ${objectName}`)

      return {
        success: true,
        fileId,
        objectName,
        bucket: this.defaultBucket,
        size: fileBuffer.length,
        url: this.getFileUrl(objectName)
      }
    } catch (error) {
      console.error('[MinIO] 上传失败:', error)
      throw error
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(objectName) {
    try {
      const stream = await this.client.getObject(this.defaultBucket, objectName)

      // 将 stream 转为 buffer
      const chunks = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      console.log(`[MinIO] 文件下载成功: ${objectName}`)
      return buffer
    } catch (error) {
      console.error('[MinIO] 下载失败:', error)
      throw error
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(objectName) {
    try {
      const stat = await this.client.statObject(this.defaultBucket, objectName)
      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        metadata: stat.metaData
      }
    } catch (error) {
      console.error('[MinIO] 获取文件信息失败:', error)
      throw error
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(objectName) {
    try {
      await this.client.removeObject(this.defaultBucket, objectName)
      console.log(`[MinIO] 文件删除成功: ${objectName}`)
      return { success: true }
    } catch (error) {
      console.error('[MinIO] 删除失败:', error)
      throw error
    }
  }

  /**
   * 列出文件
   */
  async listFiles(prefix = '', limit = 100) {
    try {
      const stream = this.client.listObjects(this.defaultBucket, prefix, false)
      const files = []

      for await (const obj of stream) {
        files.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag
        })

        if (files.length >= limit) break
      }

      return files
    } catch (error) {
      console.error('[MinIO] 列出文件失败:', error)
      throw error
    }
  }

  /**
   * 获取文件访问 URL (临时)
   */
  async getPresignedUrl(objectName, expirySeconds = 3600) {
    try {
      const url = await this.client.presignedGetObject(
        this.defaultBucket,
        objectName,
        expirySeconds
      )
      return url
    } catch (error) {
      console.error('[MinIO] 生成 URL 失败:', error)
      throw error
    }
  }

  /**
   * 获取永久 URL (如果 bucket 是公开的)
   */
  getFileUrl(objectName) {
    const { endPoint, port, useSSL } = this.client
    const protocol = useSSL ? 'https' : 'http'
    const portStr = port ? `:${port}` : ''
    return `${protocol}://${endPoint}${portStr}/${this.defaultBucket}/${objectName}`
  }

  /**
   * 生成唯一文件 ID
   */
  _generateFileId(fileName) {
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex')
    const hash = crypto.createHash('md5').update(fileName).digest('hex').substring(0, 8)
    return `${timestamp}_${hash}_${random}`
  }

  /**
   * 获取 MIME 类型
   */
  _getContentType(ext) {
    const types = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv'
    }
    return types[ext.toLowerCase()] || 'application/octet-stream'
  }

  /**
   * 扁平化元数据 (MinIO 只支持字符串值)
   */
  _flattenMetadata(metadata) {
    const flattened = {}
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'object') {
        flattened[`X-Meta-${key}`] = JSON.stringify(value)
      } else {
        flattened[`X-Meta-${key}`] = String(value)
      }
    }
    return flattened
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.client.bucketExists(this.defaultBucket)
      return { status: 'ok', bucket: this.defaultBucket }
    } catch (error) {
      return { status: 'error', error: error.message }
    }
  }
}

module.exports = new MinIOService()
