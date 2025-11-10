/**
 * CV+VL混合识别API路由
 * 为SketchUp插件提供CV+VL混合建筑识别服务
 */

const express = require('express');
const multer = require('multer');
const CVVLFusionService = require('../services/ai-modeling/CVVLFusionService');
const sharp = require('sharp');

const router = express.Router();

// 配置文件上传
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'), false);
    }
  }
});

/**
 * POST /api/ai-modeling/cv-vl-fusion
 * CV+VL混合识别主接口
 */
router.post('/cv-vl-fusion', async (req, res) => {
  console.log('🔄 接收CV+VL混合识别请求...');
  
  try {
    let imageBuffer;
    let imageInfo;
    
    // 处理不同的输入格式
    if (req.body.image_base64) {
      // Base64格式 (从SketchUp Ruby脚本)
      console.log('📥 处理Base64图片数据...');
      imageBuffer = Buffer.from(req.body.image_base64, 'base64');
      imageInfo = req.body.image_info || {};
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IMAGE_DATA',
        message: '缺少图片数据，请提供image_base64字段'
      });
    }
    
    // 获取图片元数据
    if (!imageInfo.width || !imageInfo.height) {
      console.log('📏 获取图片尺寸...');
      const metadata = await sharp(imageBuffer).metadata();
      imageInfo = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length
      };
    }
    
    console.log(`图片信息: ${imageInfo.width}×${imageInfo.height}px, ${(imageBuffer.length/1024).toFixed(1)}KB`);
    
    // 提取选项参数
    const options = req.body.options || {};
    
    console.log('🔄 开始CV+VL混合分析...');
    const startTime = Date.now();
    
    // 调用CV+VL混合服务
    const result = await CVVLFusionService.analyzeBuildingWithFusion(
      imageBuffer, 
      imageInfo, 
      options
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ CV+VL分析完成，耗时: ${(processingTime/1000).toFixed(2)}秒`);
    
    // 添加处理时间和请求信息
    result.processing_info = {
      ...(result.processing_info || {}),
      processing_time_ms: processingTime,
      image_info: imageInfo,
      request_timestamp: new Date().toISOString(),
      api_version: '1.0'
    };
    
    // 返回结果
    res.json(result);
    
  } catch (error) {
    console.error('❌ CV+VL混合识别失败:', error.message);
    console.error(error.stack);
    
    res.status(500).json({
      success: false,
      error: 'CV_VL_FUSION_FAILED',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/ai-modeling/cv-vl-fusion/file
 * 文件上传版本的CV+VL混合识别
 */
router.post('/cv-vl-fusion/file', upload.single('image'), async (req, res) => {
  console.log('🔄 接收文件上传CV+VL混合识别请求...');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE_UPLOADED',
        message: '未上传图片文件'
      });
    }
    
    const imageBuffer = req.file.buffer;
    console.log(`上传文件: ${req.file.originalname}, ${(imageBuffer.length/1024).toFixed(1)}KB`);
    
    // 获取图片信息
    const metadata = await sharp(imageBuffer).metadata();
    const imageInfo = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length,
      filename: req.file.originalname
    };
    
    // 处理选项参数
    const options = req.body.options ? JSON.parse(req.body.options) : {};
    
    console.log('🔄 开始CV+VL混合分析...');
    const startTime = Date.now();
    
    // 调用CV+VL混合服务
    const result = await CVVLFusionService.analyzeBuildingWithFusion(
      imageBuffer, 
      imageInfo, 
      options
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ CV+VL分析完成，耗时: ${(processingTime/1000).toFixed(2)}秒`);
    
    // 添加处理信息
    result.processing_info = {
      ...(result.processing_info || {}),
      processing_time_ms: processingTime,
      image_info: imageInfo,
      request_timestamp: new Date().toISOString(),
      api_version: '1.0'
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ 文件上传CV+VL识别失败:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'FILE_CV_VL_FUSION_FAILED',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ai-modeling/cv-vl-fusion/health
 * CV+VL混合服务健康检查
 */
router.get('/cv-vl-fusion/health', async (req, res) => {
  try {
    // 检查CV服务
    const cvHealthy = await checkCVServiceHealth();
    
    // 检查VL服务
    const vlHealthy = await checkVLServiceHealth();
    
    const overallHealthy = cvHealthy && vlHealthy;
    
    const healthStatus = {
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        cv_geometry_detection: {
          status: cvHealthy ? 'up' : 'down',
          endpoint: 'http://localhost:8088'
        },
        vl_semantic_analysis: {
          status: vlHealthy ? 'up' : 'down', 
          endpoint: process.env.QWENVL_ENDPOINT || 'http://10.10.18.2:8001'
        }
      },
      fusion_service: {
        status: 'up',
        version: '1.0'
      }
    };
    
    res.status(overallHealthy ? 200 : 503).json(healthStatus);
    
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ai-modeling/cv-vl-fusion/info
 * 获取CV+VL混合服务信息
 */
router.get('/cv-vl-fusion/info', (req, res) => {
  res.json({
    service_name: 'CV+VL混合建筑识别服务',
    version: '1.0.0',
    description: '结合OpenCV几何检测和VL语义识别的混合建筑分析服务',
    capabilities: {
      geometry_detection: {
        provider: 'OpenCV',
        features: ['线段检测', '灭点计算', '角点检测', '轮廓重建']
      },
      semantic_analysis: {
        provider: 'QwenVL-7B',
        features: ['建筑分类', '功能识别', '空间关系', '语义标签']
      },
      fusion_algorithm: {
        strategy: 'geometry_cv_semantics_vl',
        quality_assessment: true,
        fallback_support: true
      }
    },
    input_formats: ['image/jpeg', 'image/png', 'image/webp'],
    max_file_size: '10MB',
    typical_processing_time: '5-15秒',
    endpoints: [
      'POST /api/ai-modeling/cv-vl-fusion',
      'POST /api/ai-modeling/cv-vl-fusion/file',
      'GET /api/ai-modeling/cv-vl-fusion/health',
      'GET /api/ai-modeling/cv-vl-fusion/info'
    ]
  });
});

// 健康检查辅助函数
async function checkCVServiceHealth() {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:8088/health', { timeout: 3000 });
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

async function checkVLServiceHealth() {
  try {
    const axios = require('axios');
    const endpoint = process.env.QWENVL_ENDPOINT || 'http://10.10.18.2:8001';
    const response = await axios.get(`${endpoint}/v1/models`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = router;