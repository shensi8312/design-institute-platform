const axios = require('axios');
const MinioService = require('../utils/MinioService');
const knex = require('../../config/database');
const crypto = require('crypto');
const os = require('os');

/**
 * OnlyOffice文档服务
 * 提供在线编辑器集成
 */
class OnlyOfficeService {
  constructor() {
    this.documentServerUrl = process.env.ONLYOFFICE_SERVER || 'http://localhost:8880';
    this.callbackSecret = process.env.ONLYOFFICE_SECRET || 'design-institute-secret-2025';
    this.minioService = MinioService;
    this.apiPort = parseInt(process.env.PORT || '3000', 10);
    this.apiBaseUrl = process.env.API_URL || `http://localhost:${this.apiPort}`;
    // 外部ONLYOFFICE容器可访问的API地址（通常是宿主机IP），默认尝试自动检测
    this.apiUrlForOnlyOffice = this.resolveExternalApiUrl();
    console.log(`[OnlyOffice] API URL for Document Server: ${this.apiUrlForOnlyOffice}`);
  }

  resolveExternalApiUrl() {
    if (process.env.ONLYOFFICE_API_URL) {
      return process.env.ONLYOFFICE_API_URL;
    }

    if (process.env.SERVER_PUBLIC_URL) {
      return process.env.SERVER_PUBLIC_URL;
    }

    // API_URL如果不是localhost则直接复用
    if (this.apiBaseUrl && !this.apiBaseUrl.includes('localhost') && !this.apiBaseUrl.includes('127.0.0.1')) {
      return this.apiBaseUrl;
    }

    const detectedHostUrl = this.detectHostIpUrl();
    if (detectedHostUrl) {
      console.warn(`[OnlyOffice] 未配置ONLYOFFICE_API_URL，自动检测宿主机IP: ${detectedHostUrl}`);
      return detectedHostUrl;
    }

    return this.apiBaseUrl;
  }

  detectHostIpUrl() {
    const interfaces = os.networkInterfaces();
    const ipv4List = [];

    for (const [ifaceName, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      for (const detail of addresses) {
        if (detail && detail.family === 'IPv4' && !detail.internal) {
          ipv4List.push({ address: detail.address, iface: ifaceName });
        }
      }
    }

    if (ipv4List.length === 0) {
      return null;
    }

    // 优先选择局域网私有地址（OnlyOffice容器通常通过宿主机私网访问）
    const privateIp = ipv4List.find(ip => this.isPrivateIPv4(ip.address));
    if (privateIp) {
      return `http://${privateIp.address}:${this.apiPort}`;
    }

    // 避免选择 100.64.0.0/10（Tailscale/CGNAT）这类容器不可达的地址
    const nonCarrierNat = ipv4List.find(ip => !this.isCarrierGradeNat(ip.address));
    if (nonCarrierNat) {
      return `http://${nonCarrierNat.address}:${this.apiPort}`;
    }

    // 兜底返回第一个地址
    return `http://${ipv4List[0].address}:${this.apiPort}`;
  }

  isPrivateIPv4(address) {
    return address.startsWith('10.') ||
      address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(address);
  }

  isCarrierGradeNat(address) {
    const parts = address.split('.').map(Number);
    return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
  }

  /**
   * 获取编辑器配置
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @param {string} userName - 用户名
   * @returns {Promise<Object>}
   */
  async getEditorConfig(documentId, userId, userName) {
    const document = await knex('document_templates')
      .where({ id: documentId })
      .first();

    if (!document) {
      throw new Error('文档不存在');
    }

    // 生成可访问的文件URL
    const fileUrl = await this.getDocumentUrl(document);
    const callbackUrl = `${this.apiUrlForOnlyOffice}/api/onlyoffice/callback/${documentId}`;

    return {
      documentType: 'word',
      document: {
        title: document.name || document.file_name,
        url: fileUrl,
        fileType: 'docx',
        key: this.generateDocumentKey(documentId, document.updated_at),
        permissions: {
          edit: true,
          download: true,
          print: true,
          review: true,
          comment: true,
          chat: false
        }
      },
      editorConfig: {
        mode: 'edit',
        lang: 'zh-CN',
        callbackUrl: callbackUrl,
        user: {
          id: userId,
          name: userName
        },
        customization: {
          autosave: true,
          forcesave: true,
          comments: true,
          compactToolbar: false,
          feedback: false,
          help: false
        }
      },
      width: '100%',
      height: '100%',
    };
  }

  /**
   * 生成文档唯一key（每次修改后key会改变）
   * @param {string} documentId
   * @param {Date} updatedAt
   * @returns {string}
   */
  generateDocumentKey(documentId, updatedAt) {
    const date = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    return crypto.createHash('md5').update(`${documentId}_${date}`).digest('hex');
  }

  /**
   * 获取文档URL（从Minio或本地文件）
   * @param {Object} document
   * @returns {Promise<string>}
   */
  async getDocumentUrl(document) {
    if (!document.file_path) {
      throw new Error('文档文件路径不存在');
    }

    // 如果是本地文件路径，返回本地HTTP URL
    if (document.file_path.includes('/Users/') || document.file_path.includes('/var/') ||
        document.file_path.startsWith('uploads/')) {
      let localPath = document.file_path;

      // 去掉绝对路径前缀
      const apiPath = '/Users/shenguoli/Documents/projects/design-institute-platform/apps/api/';
      if (localPath.startsWith(apiPath)) {
        localPath = localPath.replace(apiPath, '');
      }

      const url = `${this.apiUrlForOnlyOffice}/${localPath}`;
      console.log(`[OnlyOffice] 使用本地文件URL: ${url}`);
      return url;
    }

    // Minio路径
    const bucketName = 'templates';
    let objectName = document.file_path;

    if (objectName.startsWith('uploads/templates/')) {
      objectName = objectName.replace('uploads/templates/', '');
    }

    const presignedUrl = await this.minioService.getPresignedUrl(bucketName, objectName, 7 * 24 * 3600);
    console.log(`[OnlyOffice] 生成Minio URL: ${presignedUrl}`);

    return presignedUrl;
  }

  /**
   * 处理OnlyOffice回调
   * @param {string} documentId
   * @param {Object} callbackData
   * @returns {Promise<Object>}
   */
  async handleCallback(documentId, callbackData) {
    const { status, url, users, key } = callbackData;

    console.log(`[OnlyOffice] 收到回调: documentId=${documentId}, status=${status}, key=${key}`);

    /**
     * OnlyOffice回调状态码:
     * 0 - 打开编辑器失败
     * 1 - 文档正在编辑中
     * 2 - 文档准备保存（用户保存或关闭）
     * 3 - 保存错误
     * 4 - 文档关闭，无修改
     * 6 - 正在编辑，强制保存
     * 7 - 保存错误（强制保存）
     */
    if (status === 2 || status === 6) {
      // 文档已修改，需要保存
      console.log(`[OnlyOffice] 开始保存文档: ${url}`);

      if (!url) {
        console.error(`[OnlyOffice] ❌ 回调缺少文件URL`);
        return { error: 1, message: '缺少文件URL' };
      }

      try {
        // 1. 从OnlyOffice服务器下载修改后的文件
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 60000 // 60秒超时
        });
        const fileBuffer = Buffer.from(response.data);

        console.log(`[OnlyOffice] 下载文件成功，大小: ${fileBuffer.length} bytes`);

        // 2. 获取文档信息
        const document = await knex('document_templates').where({ id: documentId }).first();
        if (!document) {
          throw new Error('文档不存在');
        }

        // 3. 上传到Minio
        const bucketName = 'templates';
        let objectName = document.file_path;

        if (objectName.startsWith('uploads/templates/')) {
          objectName = objectName.replace('uploads/templates/', '');
        }

        await this.minioService.uploadBuffer(
          fileBuffer,
          objectName,
          bucketName,
          { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
        );

        console.log(`[OnlyOffice] 文件已上传到Minio: ${bucketName}/${objectName}`);

        // 4. 更新数据库
        await knex('document_templates')
          .where({ id: documentId })
          .update({
            updated_at: knex.fn.now(),
            file_size: fileBuffer.length
          });

        console.log(`[OnlyOffice] ✅ 文档保存成功: ${documentId}`);
        return { error: 0 };

      } catch (error) {
        console.error(`[OnlyOffice] ❌ 保存失败:`, error.message);
        return { error: 1, message: error.message };
      }
    }

    // 其他状态（正在编辑、无修改关闭等）
    console.log(`[OnlyOffice] 状态${status}，无需保存`);
    return { error: 0 };
  }
}

module.exports = new OnlyOfficeService();
