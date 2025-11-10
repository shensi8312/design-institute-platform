/**
 * AI插件统一路由 - 插件的唯一通信接口
 * 
 * 设计理念：
 *   - 插件只需要调用一个端点: POST /api/ai-plugin/process
 *   - 通过action参数区分不同操作
 *   - 服务端负责内部的微服务调度
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiModelingService = require('../services/ai-modeling/aiModelingService');
const ImageHelper = require('../utils/imageHelper');

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 50 * 1024 * 1024,  // 50MB限制
    files: 10  // 最多10个文件（为批量处理）
  }
});

/**
 * POST /api/ai-plugin/process
 * 统一处理接口 - 插件的唯一入口
 * 
 * 请求格式:
 * - action: 操作类型
 * - sessionId: 会话ID（可选）
 * - data: JSON数据（可选）
 * - file/files: 文件（可选）
 */
router.post('/process', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 解析请求
    const { action, sessionId, data } = req.body;
    
    // 打印请求信息
    console.log('\n' + '='.repeat(60));
    console.log('🔌 插件请求接收');
    console.log('='.repeat(60));
    console.log('  操作:', action);
    console.log('  会话:', sessionId || '新会话');
    console.log('  文件:', req.file ? req.file.originalname : '无');
    console.log('  时间:', new Date().toISOString());
    
    // 验证action
    if (!action) {
      return res.status(400).json({
        success: false,
        error: '缺少action参数'
      });
    }
    
    // 解析data参数
    let parsedData = {};
    if (data) {
      try {
        console.log('  📝 原始data类型:', typeof data);
        console.log('  📝 原始data前100字符:', data.substring(0, 100));
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('  📝 解析后的data键:', Object.keys(parsedData));
        
        // 如果有input字段，输出其内容
        if (parsedData.input) {
          console.log('  📝 input字段键:', Object.keys(parsedData.input));
          if (parsedData.input.image) {
            console.log('  📝 input.image存在，长度:', parsedData.input.image.length);
          }
        }
      } catch (e) {
        console.error('解析data失败:', e);
        parsedData = {};
      }
    }
    
    // 使用ImageHelper统一处理图片数据
    // 支持多种输入方式：
    // 1. 文件上传 (multipart/form-data)
    // 2. base64字符串 (JSON)
    // 3. 二进制数据
    console.log('  🔍 提取图片数据...');
    console.log('  🔍 req.file存在?', !!req.file);
    console.log('  🔍 req.body.image存在?', !!req.body.image);
    console.log('  🔍 req.body.data存在?', !!req.body.data);
    
    // 先尝试从req中直接提取
    let imageBuffer = ImageHelper.extractFromRequest(req);
    
    // 如果没有找到，再尝试从parsedData中提取
    if (!imageBuffer) {
      if (parsedData.image) {
        console.log('  🔍 从parsedData.image提取图片...');
        imageBuffer = ImageHelper.toBuffer(parsedData.image);
      } else if (parsedData.input && parsedData.input.image) {
        console.log('  🔍 从parsedData.input.image提取图片...');
        imageBuffer = ImageHelper.toBuffer(parsedData.input.image);
      }
    }
    
    // 输出提取结果
    if (imageBuffer) {
      console.log(`  ✅ 成功提取图片 (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
    } else {
      console.log('  ⚠️ 未提取到图片数据');
    }
    
    // 构建请求对象
    const request = {
      action: action,
      sessionId: sessionId,
      imageBuffer: imageBuffer,
      params: parsedData.params || parsedData || {}
    };
    
    // 调用统一服务
    console.log('\n  ====== 准备调用aiModelingService.processRequest ======');
    console.log('  📊 request.action:', request.action);
    console.log('  📊 request.sessionId:', request.sessionId);
    console.log('  📊 request.imageBuffer长度:', request.imageBuffer ? request.imageBuffer.length : 0);
    console.log('  📊 request.params键:', Object.keys(request.params));
    
    const result = await aiModelingService.processRequest(request);
    
    console.log('\n  ====== aiModelingService.processRequest返回 ======');
    console.log('  📊 result.success:', result.success);
    console.log('  📊 result键:', Object.keys(result));
    
    // 计算处理时间
    const duration = Date.now() - startTime;
    console.log(`\n✅ 处理完成 (耗时: ${duration}ms)`);
    
    // 添加元数据
    result.metadata = {
      duration: duration,
      timestamp: Date.now(),
      action: action
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ 处理失败:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    });
  }
});

/**
 * POST /api/ai-plugin/batch
 * 批量处理接口
 */
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    const { action, options } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }
    
    console.log(`\n📦 批量处理: ${req.files.length} 个文件`);
    
    const request = {
      action: 'batch_process',
      params: {
        images: req.files.map(f => f.buffer),
        options: options ? JSON.parse(options) : {}
      }
    };
    
    const result = await aiModelingService.processRequest(request);
    res.json(result);
    
  } catch (error) {
    console.error('批量处理失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-plugin/status
 * 获取服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const result = await aiModelingService.processRequest({
      action: 'get_status'
    });
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-plugin/session/:sessionId
 * 获取会话信息
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const result = await aiModelingService.processRequest({
      action: 'load_session',
      sessionId: req.params.sessionId
    });
    
    res.json(result);
    
  } catch (error) {
    res.status(404).json({
      success: false,
      error: '会话不存在'
    });
  }
});

/**
 * 简化的快捷接口（为了兼容性）
 */

// 草图转3D
router.post('/sketch-to-3d', upload.single('image'), async (req, res) => {
  req.body.action = 'sketch_to_3d';
  req.body.data = JSON.stringify(req.body);
  
  // 重定向到统一接口
  return router.handle(req, res);
});

// 修改模型
router.post('/modify', express.json(), async (req, res) => {
  const request = {
    action: 'modify',
    sessionId: req.body.sessionId,
    params: {
      currentModel: req.body.currentModel,
      command: req.body.command
    }
  };
  
  const result = await aiModelingService.processRequest(request);
  res.json(result);
});

/**
 * GET /api/ai-plugin/health
 * 健康检查接口
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        services: {
          sketch_to_3d: 'active',
          parametric_modeling: 'active',
          fab_factory: 'active'
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '健康检查失败',
      error: error.message
    });
  }
});

module.exports = router;