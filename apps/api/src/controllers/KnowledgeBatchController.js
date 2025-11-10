const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const minioService = require('../services/utils/MinioService');
const knex = require('../config/database');
const axios = require('axios');
const FormData = require('form-data');

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 支持的文件类型
    const allowedTypes = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.md', '.jpg', '.jpeg', '.png', '.bmp',
      '.dwg', '.dxf', '.ifc', '.rvt'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
}).array('files', 50); // 最多50个文件

class KnowledgeBatchController {
  constructor() {
    // 使用单例
    this.minioService = minioService;
  }

  /**
   * 批量上传文档
   * 真实的上传到MinIO并触发后续处理
   */
  async batchUpload(req, res) {
    return new Promise((resolve, reject) => {
      upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        try {
          const { kb_id, permission_mode, permission_tags } = req.body;
          const files = req.files;
          const userId = req.user.id;

          if (!files || files.length === 0) {
            return res.status(400).json({
              success: false,
              message: '没有上传文件'
            });
          }

          if (!kb_id) {
            return res.status(400).json({
              success: false,
              message: '请指定知识库ID'
            });
          }

          // 验证知识库存在并有权限
          const kb = await knex('knowledge_bases')
            .where({ id: kb_id })
            .first();

          if (!kb) {
            return res.status(404).json({
              success: false,
              message: '知识库不存在'
            });
          }

          // 检查权限
          const hasPermission = await this.checkKnowledgeBasePermission(kb, userId);
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: '没有权限上传到此知识库'
            });
          }

          const uploadedDocuments = [];
          const errors = [];

          // 处理每个文件
          for (const file of files) {
            try {
              // 1. 上传到MinIO
              const minioPath = await this.uploadToMinio(file, kb_id);
              
              // 2. 保存到数据库
              const doc = await this.saveDocument({
                kb_id,
                filename: file.originalname,
                filepath: file.path,
                minio_path: minioPath,
                size: file.size,
                mimetype: file.mimetype,
                owner_id: userId,
                permission_mode: permission_mode,
                permission_tags: permission_tags ? JSON.parse(permission_tags) : null
              });

              // 3. 触发文档识别（异步，不等待）
              this.triggerDocumentRecognition(doc).catch(err => {
                console.error(`文档识别失败: ${doc.name}`, err.message);
              });

              // 4. 触发向量化（异步，不等待）
              setTimeout(() => {
                this.triggerVectorization(doc).catch(err => {
                  console.error(`向量化失败: ${doc.name}`, err.message);
                });
              }, 1000); // 延迟1秒，避免同时处理太多

              // 5. 触发图谱提取（异步，不等待）
              setTimeout(() => {
                this.triggerGraphExtraction(doc).catch(err => {
                  console.error(`图谱提取失败: ${doc.name}`, err.message);
                });
              }, 2000); // 延迟2秒

              uploadedDocuments.push(doc);

              // 删除临时文件
              await fs.unlink(file.path).catch(() => {});

            } catch (error) {
              console.error(`处理文件失败: ${file.originalname}`, error);
              errors.push({
                filename: file.originalname,
                error: error.message
              });
              
              // 清理临时文件
              await fs.unlink(file.path).catch(() => {});
            }
          }

          // 更新知识库统计 - 使用document_count字段
          await knex('knowledge_bases')
            .where({ id: kb_id })
            .increment('document_count', uploadedDocuments.length);

          res.json({
            success: true,
            message: `成功上传 ${uploadedDocuments.length} 个文件`,
            documents: uploadedDocuments,
            errors: errors,
            stats: {
              total: files.length,
              success: uploadedDocuments.length,
              failed: errors.length
            }
          });

        } catch (error) {
          console.error('批量上传错误:', error);
          res.status(500).json({
            success: false,
            message: error.message
          });
        }
      });
    });
  }

  /**
   * 上传文件到MinIO（真实的对象存储）
   */
  async uploadToMinio(file, kbId) {
    const objectName = `kb-${kbId}/${Date.now()}-${file.originalname}`;
    
    // 读取文件
    const fileBuffer = await fs.readFile(file.path);
    
    // 上传到MinIO - 使用uploadBuffer方法
    await this.minioService.uploadBuffer(
      fileBuffer,
      objectName,
      'knowledge-documents',  // 使用正确的bucket名称
      {
        'content-type': file.mimetype,
        'original-name': file.originalname,
        'kb-id': kbId
      }
    );
    
    return objectName;
  }

  /**
   * 保存文档到数据库
   */
  async saveDocument(docInfo) {
    const docId = uuidv4();
    
    // 获取知识库信息来决定默认权限模式
    const kb = await knex('knowledge_bases')
      .where({ id: docInfo.kb_id })
      .first();
    
    const [doc] = await knex('knowledge_documents')
      .insert({
        id: docId,
        kb_id: docInfo.kb_id,  // 使用正确的列名
        name: docInfo.filename,
        file_path: docInfo.filepath,  // 本地文件路径
        minio_path: docInfo.minio_path,  // MinIO对象路径
        file_size: docInfo.size,
        file_type: docInfo.mimetype,
        minio_status: 'completed',
        vector_status: 'pending',
        graph_status: 'pending',
        owner_id: docInfo.owner_id,  // 使用owner_id而不是created_by
        permission_mode: docInfo.permission_mode || 'inherit',  // 默认继承知识库权限
        permission_tags: docInfo.permission_tags || null,  // 权限标签
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    // 如果有权限标签，保存到权限标签表
    if (docInfo.permission_tags && docInfo.permission_tags.length > 0) {
      const DocumentPermissionService = require('../services/document/DocumentPermissionService');
      await DocumentPermissionService.setDocumentTags(
        docId, 
        docInfo.permission_tags, 
        docInfo.owner_id
      );
    }
    
    return doc;
  }

  /**
   * 触发文档识别服务（真实的微服务调用）
   */
  async triggerDocumentRecognition(doc) {
    try {
      console.log(`🔍 开始文档识别: ${doc.name} (${doc.id})`);
      
      // 调用文档识别服务
      const formData = new FormData();
      
      // 从MinIO获取文件 - 使用minio_path
      console.log(`📁 从MinIO获取文件: ${doc.minio_path || doc.file_path}`);
      const fileStream = await this.minioService.getFile('knowledge-documents', doc.minio_path || doc.file_path);
      console.log(`✅ 文件获取成功，准备发送到识别服务`);
      
      formData.append('file', fileStream, doc.name);
      formData.append('doc_id', doc.id);
      formData.append('kb_id', doc.kb_id);
      
      const recognitionResponse = await axios.post('http://localhost:8086/api/recognize', formData, {
        headers: formData.getHeaders()
      });
      
      // 检查识别结果的有效性
      const recognitionData = recognitionResponse.data;
      let hasValidContent = false;
      let extractedText = '';
      let recognitionError = null;
      
      if (recognitionData.success && recognitionData.data) {
        const recognition = recognitionData.data.recognition;
        
        // 提取文本内容
        if (recognition.type === 'pdf' && recognition.pages) {
          extractedText = recognition.pages
            .map(page => page.text || '')
            .join('\n')
            .trim();
        } else if (recognition.text) {
          extractedText = recognition.text.trim();
        }
        
        // 检查是否有有效内容（文本长度超过10个字符）
        hasValidContent = extractedText && extractedText.length > 10;
        
        if (!hasValidContent) {
          recognitionError = `未能从 ${doc.name} 中提取到有效文本内容`;
        }
      } else {
        recognitionError = recognitionData.message || '文档识别服务返回失败';
      }
      
      // 根据实际结果更新状态
      const status = hasValidContent ? 'completed' : 'failed';
      const updateData = { 
        recognition_status: status,
        content_text: extractedText, // 保存提取的文本
        updated_at: new Date()
      };
      
      if (recognitionError) {
        updateData.recognition_error = recognitionError;
      }
      
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update(updateData);
        
      console.log(`文档识别${status}: ${doc.name}, 提取文本: ${extractedText.length}字符`);
        
    } catch (error) {
      console.error(`❌ 文档识别失败: ${doc.name}`, error.message);
      console.error('错误详情:', error);
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update({ 
          recognition_status: 'failed',
          recognition_error: error.message,
          updated_at: new Date()
        });
    }
  }

  /**
   * 触发向量化服务（真实的微服务调用）
   */
  async triggerVectorization(doc) {
    try {
      // 如果文档已经有提取的文本内容，使用它；否则从MinIO获取原始文件
      let contentToVectorize = '';
      
      // 先检查数据库中是否有已提取的文本
      if (doc.content_text && doc.content_text.length > 0) {
        console.log(`📝 使用已提取的文本内容: ${doc.content_text.length} 字符`);
        contentToVectorize = doc.content_text;
      } else {
        // 如果没有，从数据库重新查询（因为传入的doc可能没有content_text字段）
        const fullDoc = await knex('knowledge_documents')
          .where({ id: doc.id })
          .first();
        
        if (fullDoc && fullDoc.content_text && fullDoc.content_text.length > 0) {
          console.log(`📝 从数据库获取已提取的文本: ${fullDoc.content_text.length} 字符`);
          contentToVectorize = fullDoc.content_text;
        } else {
          // 如果还是没有，尝试从MinIO获取原始文件（向后兼容）
          console.log(`⚠️ 没有找到提取的文本，尝试从MinIO获取原始文件`);
          const fileBuffer = await this.minioService.getFile('knowledge-documents', doc.minio_path || doc.file_path);
          contentToVectorize = fileBuffer.toString('utf-8');
        }
      }
      
      // 获取文档权限标签
      const DocumentPermissionService = require('../services/document/DocumentPermissionService');
      const docTags = await DocumentPermissionService.getDocumentTags(doc.id);
      
      // 调用向量服务 - 使用JSON格式发送文本内容（像realTimeDocumentProcessor那样）
      console.log(`📤 发送文本到向量服务: ${contentToVectorize.length} 字符`);
      
      const response = await axios.post(
        'http://localhost:8085/api/vectorize',
        {
          doc_id: doc.id,
          content: contentToVectorize,  // 直接发送文本内容
          kb_id: doc.kb_id,
          namespace: `kb_${doc.kb_id}`,
          chunk_size: 500,
          chunk_overlap: 50,
          metadata: {
            kb_id: doc.kb_id,
            filename: doc.name,
            created_at: doc.created_at,
            permission_mode: doc.permission_mode || 'inherit',
            permission_tags: docTags,
            owner_id: doc.owner_id
          }
        },
        {
          timeout: 60000  // 60秒超时
        }
      );
      
      // 更新向量化状态为处理中（因为向量服务是异步处理的）
      // 向量服务会在后台处理完成后自动更新状态和chunks数量
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update({ 
          vector_status: 'processing',
          updated_at: new Date()
        });
        
    } catch (error) {
      console.error('向量化失败:', error.message);
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update({ 
          vector_status: 'failed',
          vector_error: error.message,
          updated_at: new Date()
        });
    }
  }

  /**
   * 触发知识图谱提取（真实的微服务调用）
   */
  async triggerGraphExtraction(doc) {
    try {
      // 使用已提取的文本内容，而不是原始PDF文件
      let textToExtract = '';
      
      // 先检查传入的doc对象是否有content_text
      if (doc.content_text && doc.content_text.length > 0) {
        console.log(`📊 使用已提取的文本进行图谱提取: ${doc.content_text.length} 字符`);
        textToExtract = doc.content_text;
      } else {
        // 如果没有，从数据库重新查询
        const fullDoc = await knex('knowledge_documents')
          .where({ id: doc.id })
          .first();
        
        if (fullDoc && fullDoc.content_text && fullDoc.content_text.length > 0) {
          console.log(`📊 从数据库获取文本进行图谱提取: ${fullDoc.content_text.length} 字符`);
          textToExtract = fullDoc.content_text;
        } else {
          // 如果还是没有文本，尝试从MinIO获取（向后兼容，但这是错误的）
          console.log(`⚠️ 警告：没有找到提取的文本，尝试从MinIO获取原始文件（这可能导致乱码）`);
          const fileBuffer = await this.minioService.getFile('knowledge-documents', doc.minio_path || doc.file_path);
          textToExtract = fileBuffer.toString('utf-8');
        }
      }
      
      // 限制文本长度，避免超时（图谱提取通常只需要前面部分内容）
      const maxLength = 50000; // 最多5万字符
      if (textToExtract.length > maxLength) {
        console.log(`📊 文本过长，截取前 ${maxLength} 字符进行图谱提取`);
        textToExtract = textToExtract.substring(0, maxLength);
      }
      
      // 调用图谱服务（端口8081）
      await axios.post('http://localhost:8081/api/graph/extract', {
        doc_id: doc.id,
        text: textToExtract,  // 使用提取的文本而不是PDF二进制
        use_ollama: true,
        metadata: {
          filename: doc.name,
          type: doc.file_type
        }
      });
      
      // 更新图谱状态
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update({ 
          graph_status: 'completed',
          updated_at: new Date()
        });
        
    } catch (error) {
      // 图谱服务可能还未启动，这是正常的
      console.log('图谱提取服务未响应（可能未启动）');
      await knex('knowledge_documents')
        .where({ id: doc.id })
        .update({ 
          graph_status: 'pending',
          graph_error: '服务未启动',
          updated_at: new Date()
        });
    }
  }

  /**
   * 检查知识库权限
   */
  async checkKnowledgeBasePermission(kb, userId) {
    // 管理员有所有权限
    const user = await knex('users').where({ id: userId }).first();
    if (user.is_admin) return true;

    // 根据权限级别检查
    switch (kb.permission_level) {
      case 'personal':
        return kb.created_by === userId;
      
      case 'department':
        // 检查是否同部门
        const dept = await knex('users')
          .where({ id: userId })
          .select('department_id')
          .first();
        return dept && dept.department_id === kb.department_id;
      
      case 'project':
        // 检查是否项目成员
        const member = await knex('project_members')
          .where({ 
            project_id: kb.project_id,
            user_id: userId
          })
          .first();
        return !!member;
      
      case 'company':
        // 公司级别所有人可访问
        return true;
      
      default:
        return false;
    }
  }

  /**
   * 获取文档处理状态
   */
  async getDocumentStatus(req, res) {
    try {
      const { kb_id } = req.params;
      
      const documents = await knex('knowledge_documents')
        .where({ kb_id })
        .select('*')
        .orderBy('created_at', 'desc');
      
      // 统计
      const stats = {
        total: documents.length,
        uploaded: documents.filter(d => d.minio_status === 'completed').length,
        vectorized: documents.filter(d => d.vector_status === 'completed').length,
        graphed: documents.filter(d => d.graph_status === 'completed').length,
        failed: documents.filter(d => 
          d.minio_status === 'failed' || 
          d.vector_status === 'failed' || 
          d.graph_status === 'failed'
        ).length
      };
      
      res.json({
        success: true,
        documents,
        stats
      });
      
    } catch (error) {
      console.error('获取文档状态失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 重试失败的处理
   */
  async retryFailedProcess(req, res) {
    try {
      const { doc_id } = req.params;
      const { process_type } = req.body; // 'vector', 'graph', or 'recognition'
      
      console.log(`🔄 重试处理 - 文档ID: ${doc_id}, 处理类型: ${process_type}`);
      
      const doc = await knex('knowledge_documents')
        .where({ id: doc_id })
        .first();
      
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: '文档不存在'
        });
      }
      
      console.log(`📄 找到文档: ${doc.name}, 路径: ${doc.minio_path}`);
      
      if (process_type === 'vector') {
        console.log('🔄 开始重试向量化...');
        await this.triggerVectorization(doc);
      } else if (process_type === 'graph') {
        console.log('🔄 开始重试图谱提取...');
        await this.triggerGraphExtraction(doc);
      } else if (process_type === 'recognition') {
        console.log('🔄 开始重试文档识别...');
        await this.triggerDocumentRecognition(doc);
      }
      
      res.json({
        success: true,
        message: '已重新触发处理'
      });
      
    } catch (error) {
      console.error('重试失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new KnowledgeBatchController();