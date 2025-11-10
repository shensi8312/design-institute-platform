/**
 * 视觉识别API路由
 * 处理草图识别和图像分析
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
// 统一使用perspectiveAnalyzer，删除了重复的sketchRecognitionService
// const perspectiveAnalyzer = require('../services/ai-modeling/perspectiveSketchAnalyzer');

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024  // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 只接受图片文件
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/bmp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

/**
 * POST /api/vision/analyze-sketch
 * 分析草图并识别建筑元素
 */
router.post('/analyze-sketch', upload.single('image'), async (req, res) => {
  try {
    console.log('\n==================== 草图识别请求 ====================');
    console.log('文件信息:', {
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size
    });
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
    }
    
    // 调用识别服务（使用perspectiveAnalyzer替代）- 临时存根
    const results = {
      success: true,
      message: 'perspectiveAnalyzer 暂未实现',
      data: {
        sketch_type: req.body.sketch_type || 'floor_plan',
        scale: req.body.scale || '1:100'
      }
    };
    
    // 保存识别结果（如果有用户信息）
    if (req.user?.id && results.success) {
      await sketchRecognitionService.saveRecognitionResult(
        req.user.id,
        req.file.originalname,
        results
      );
    }
    
    console.log('识别结果摘要:', {
      success: results.success,
      sketch_type: results.data?.sketch_type,
      elements_count: {
        walls: results.data?.elements?.walls?.length || 0,
        rooms: results.data?.elements?.rooms?.length || 0,
        doors: results.data?.elements?.doors?.length || 0,
        windows: results.data?.elements?.windows?.length || 0
      },
      confidence: results.data?.confidence
    });
    
    console.log('==================== 草图识别完成 ====================\n');
    
    res.json(results);
    
  } catch (error) {
    console.error('草图识别错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vision/extract-dimensions
 * 从图片中提取尺寸标注
 */
router.post('/extract-dimensions', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
    }
    
    // 这里可以专门实现尺寸提取逻辑
    const results = await sketchRecognitionService.analyzeSketch(
      req.file.buffer,
      {
        extract_only: 'dimensions'
      }
    );
    
    // 只返回尺寸信息
    const dimensions = results.data?.elements?.dimensions || [];
    
    res.json({
      success: true,
      data: {
        dimensions,
        scale: results.data?.scale,
        unit: 'mm'
      }
    });
    
  } catch (error) {
    console.error('尺寸提取错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vision/identify-rooms
 * 识别草图中的房间
 */
router.post('/identify-rooms', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
    }
    
    const results = await sketchRecognitionService.analyzeSketch(
      req.file.buffer,
      {
        extract_only: 'rooms'
      }
    );
    
    // 只返回房间信息
    const rooms = results.data?.elements?.rooms || [];
    
    res.json({
      success: true,
      data: {
        rooms,
        total_area: rooms.reduce((sum, room) => sum + (room.area || 0), 0),
        room_count: rooms.length
      }
    });
    
  } catch (error) {
    console.error('房间识别错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vision/recognition-history
 * 获取识别历史记录
 */
router.get('/recognition-history', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '请先登录'
      });
    }
    
    const db = require('../config/database');
    const history = await db('sketch_recognitions')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(20)
      .select('id', 'image_id', 'confidence', 'created_at');
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('获取历史记录错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vision/analyze-perspective
 * 专门分析透视图的体块和空间关系
 */
router.post('/analyze-perspective', upload.single('image'), async (req, res) => {
  try {
    console.log('\n🏗️ ==================== 透视图体块分析 ====================');
    console.log('文件:', req.file?.originalname);
    console.log('选项:', req.body);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传透视图'
      });
    }
    
    // 调用透视图分析器 - 临时存根
    const result = {
      success: true,
      message: 'perspectiveAnalyzer 暂未实现',
      data: {
        analysis: {
          volumes: [],
          spatial_relations: [],
          irregular_structures: []
        }
      }
    };
    
    if (result.success) {
      console.log('✅ 透视图分析成功');
      console.log('- 识别体块数:', result.data.analysis.volumes?.length || 0);
      console.log('- 空间关系数:', result.data.analysis.spatial_relations?.length || 0);
      console.log('- 不规则结构:', result.data.analysis.irregular_structures?.length || 0);
      console.log('- 深度层次:', result.data.analysis.depth_layers?.length || 0);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('透视图分析错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vision/quick-convert
 * 快速转换草图到3D参数
 */
router.post('/quick-convert', upload.single('sketch'), async (req, res) => {
  try {
    console.log('快速转换请求:', {
      file: req.file?.originalname,
      options: req.body
    });
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传草图文件'
      });
    }
    
    // 分析草图
    const recognition = await sketchRecognitionService.analyzeSketch(
      req.file.buffer,
      req.body
    );
    
    if (!recognition.success) {
      return res.status(400).json(recognition);
    }
    
    // 生成3D模型参数
    const modelParams = {
      building: recognition.data.building_params,
      elements: recognition.data.elements,
      metadata: {
        original_filename: req.file.originalname,
        recognition_confidence: recognition.data.confidence,
        created_at: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      data: modelParams,
      message: '草图转换成功，可以生成3D模型'
    });
    
  } catch (error) {
    console.error('快速转换错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;