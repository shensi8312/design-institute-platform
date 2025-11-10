const Minio = require('minio');

/**
 * MinIO客户端服务
 * 用于文件上传和下载URL生成
 */
class MinioClient {
  constructor() {
    this.client = null;
    this.init();
  }

  init() {
    try {
      const config = {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT) || 9000,
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
      };

      this.client = new Minio.Client(config);
      console.log(`✅ MinIO客户端初始化成功: ${config.endPoint}:${config.port}`);
    } catch (error) {
      console.error('❌ MinIO客户端初始化失败:', error);
    }
  }

  /**
   * 上传文件
   * @param {string} bucketName - 桶名称
   * @param {string} objectName - 对象名称（文件路径）
   * @param {Buffer} buffer - 文件Buffer
   * @param {Object} metadata - 元数据
   */
  async upload(bucketName, objectName, buffer, metadata = {}) {
    try {
      // 确保bucket存在
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        await this.client.makeBucket(bucketName, 'us-east-1');
        console.log(`✅ 创建Bucket: ${bucketName}`);
      }

      // 上传文件
      await this.client.putObject(bucketName, objectName, buffer, buffer.length, metadata);
      console.log(`✅ 文件上传成功: ${bucketName}/${objectName}`);

      return {
        bucket: bucketName,
        objectName,
        size: buffer.length
      };
    } catch (error) {
      console.error('❌ 文件上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 获取下载URL（带过期时间）
   * @param {string} bucketName - 桶名称
   * @param {string} objectName - 对象名称
   * @param {number} expiry - 过期时间（秒），默认7天
   */
  async getDownloadUrl(bucketName, objectName, expiry = 7 * 24 * 3600) {
    try {
      const url = await this.client.presignedGetObject(bucketName, objectName, expiry);
      return url;
    } catch (error) {
      console.error('❌ 生成下载URL失败:', error);
      throw new Error(`生成下载URL失败: ${error.message}`);
    }
  }

  /**
   * 删除文件
   * @param {string} bucketName - 桶名称
   * @param {string} objectName - 对象名称
   */
  async remove(bucketName, objectName) {
    try {
      await this.client.removeObject(bucketName, objectName);
      console.log(`✅ 文件删除成功: ${bucketName}/${objectName}`);
    } catch (error) {
      console.error('❌ 文件删除失败:', error);
      throw new Error(`文件删除失败: ${error.message}`);
    }
  }

  /**
   * 列出文件
   * @param {string} bucketName - 桶名称
   * @param {string} prefix - 前缀
   */
  async listObjects(bucketName, prefix = '') {
    try {
      const objects = [];
      const stream = this.client.listObjectsV2(bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => objects.push(obj));
        stream.on('error', reject);
        stream.on('end', () => resolve(objects));
      });
    } catch (error) {
      console.error('❌ 列出文件失败:', error);
      throw new Error(`列出文件失败: ${error.message}`);
    }
  }

  /**
   * 下载文件（返回Buffer）
   * @param {string} bucketName - 桶名称
   * @param {string} objectName - 对象名称
   */
  async download(bucketName, objectName) {
    try {
      const chunks = [];
      const stream = await this.client.getObject(bucketName, objectName);

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      console.error('❌ 下载文件失败:', error);
      throw new Error(`下载文件失败: ${error.message}`);
    }
  }
}

// 创建单例
const minioClient = new MinioClient();

module.exports = minioClient;
