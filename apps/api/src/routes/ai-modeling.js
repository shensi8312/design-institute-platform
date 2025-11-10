/**
 * AI建模路由 - 完整的草图到3D工作流
 * 集成文档识别(8086) + vLLM推理(8000) + QwenVL视觉(8001)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const CVVLFusionService = require('../services/ai-modeling/CVVLFusionService');

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 服务配置
const SERVICES = {
  // 文档识别服务 - Mac本地
  recognition: 'http://localhost:8086/api/recognize',
  // vLLM服务 - GPU服务器
  vllm: 'http://10.10.18.2:8000/v1/chat/completions',
  // QwenVL服务 - GPU服务器（已在文档识别服务中调用）
  qwenvl: 'http://10.10.18.2:8001/v1/chat/completions'
};

/**
 * POST /api/ai-modeling/sketch-to-3d
 * 完整的草图转3D流程：识别 + 推理 + 参数生成
 */
router.post('/sketch-to-3d', upload.single('image'), async (req, res) => {
  console.log('\n==================== 草图转3D完整流程 ====================');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传草图文件'
      });
    }
    
    // 使用简化的sketchAnalyzer
    const sketchAnalyzer = require('../services/ai-modeling/sketchAnalyzer');
    const result = await sketchAnalyzer.analyze(req.file.buffer, {
      sessionId: req.body.sessionId || null,
      imageWidth: 1024,
      imageHeight: 768,
      filename: req.file.originalname
    });
    
    // 返回结果
    res.json(result);
    
  } catch (error) {
    console.error('草图转3D失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-modeling/cv-vl-fusion
 * CV+VL混合建筑识别接口
 */
router.post('/cv-vl-fusion', express.json({ limit: '10mb' }), async (req, res) => {
  console.log('🔄 接收CV+VL混合识别请求...');
  
  try {
    const { image_base64, image_info, options } = req.body;
    
    if (!image_base64) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IMAGE_DATA',
        message: '缺少图片数据，请提供image_base64字段'
      });
    }
    
    // 解码图片数据
    const imageBuffer = Buffer.from(image_base64, 'base64');
    console.log(`图片大小: ${(imageBuffer.length/1024).toFixed(1)}KB`);
    
    // 图片信息处理
    let processedImageInfo = image_info || {};
    if (!processedImageInfo.width || !processedImageInfo.height) {
      const sharp = require('sharp');
      const metadata = await sharp(imageBuffer).metadata();
      processedImageInfo = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
        ...processedImageInfo
      };
    }
    
    console.log(`图片信息: ${processedImageInfo.width}×${processedImageInfo.height}px`);
    
    const startTime = Date.now();
    
    // 调用CV+VL混合服务
    const result = await CVVLFusionService.analyzeBuildingWithFusion(
      imageBuffer,
      processedImageInfo,
      options || {}
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ CV+VL分析完成，耗时: ${(processingTime/1000).toFixed(2)}秒`);
    
    // 添加处理信息
    result.processing_info = {
      ...(result.processing_info || {}),
      processing_time_ms: processingTime,
      image_info: processedImageInfo,
      request_timestamp: new Date().toISOString(),
      api_version: '1.0'
    };
    
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
 * GET /api/ai-modeling/cv-vl-fusion/health
 * CV+VL混合服务健康检查
 */
router.get('/cv-vl-fusion/health', async (req, res) => {
  try {
    // 检查CV服务
    const cvHealthy = await checkServiceHealth('http://localhost:8088/health');
    
    // 检查VL服务  
    const vlEndpoint = SERVICES.qwenvl.replace('/v1/chat/completions', '/v1/models');
    const vlHealthy = await checkServiceHealth(vlEndpoint);
    
    const overallHealthy = cvHealthy && vlHealthy;
    
    res.json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        cv_geometry_detection: { 
          status: cvHealthy ? 'up' : 'down',
          endpoint: 'http://localhost:8088'
        },
        vl_semantic_analysis: { 
          status: vlHealthy ? 'up' : 'down',
          endpoint: SERVICES.qwenvl
        }
      }
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/ai-modeling/modify
 * AI驱动的模型修改
 */
router.post('/modify', express.json(), async (req, res) => {
  console.log('\n==================== AI模型修改 ====================');
  
  try {
    const { currentModel, command } = req.body;
    
    if (!currentModel || !command) {
      return res.status(400).json({
        success: false,
        error: '需要当前模型参数和修改指令'
      });
    }
    
    console.log('用户指令:', command);
    
    // 调用vLLM理解并执行修改
    const modifiedParams = await callVLLMForModification(currentModel, command);
    
    // 检测变化
    const changes = detectChanges(currentModel, modifiedParams);
    
    res.json({
      success: true,
      message: '模型修改成功',
      data: {
        modified: modifiedParams,
        changes: changes,
        summary: generateChangeSummary(changes)
      }
    });
    
  } catch (error) {
    console.error('模型修改失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 调用文档识别服务
 */
async function callRecognitionService(imageBuffer) {
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: 'sketch.jpg',
    contentType: 'image/jpeg'
  });
  form.append('enhance', 'true');  // 启用增强识别
  
  try {
    const response = await axios.post(
      SERVICES.recognition,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('文档识别服务调用失败:', error.message);
    throw new Error('文档识别服务不可用');
  }
}

/**
 * 调用vLLM生成3D建模参数
 */
async function callVLLMForModeling(recognitionData) {
  // 构建prompt
  const prompt = buildModelingPrompt(recognitionData);
  
  try {
    const response = await axios.post(
      SERVICES.vllm,
      {
        model: "Qwen2.5-7B-Instruct",  // 或其他部署的模型
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.3,
        stop: ["```", "\n\n\n"]
      },
      {
        timeout: 60000
      }
    );
    
    const aiOutput = response.data.choices[0].text;
    
    // 解析JSON响应
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const params = JSON.parse(jsonMatch[0]);
      return validateAndOptimizeParams(params);
    } else {
      throw new Error('AI未能生成有效的JSON参数');
    }
    
  } catch (error) {
    console.error('vLLM调用失败:', error.message);
    // 返回默认参数
    return getDefaultModelingParams(recognitionData);
  }
}

/**
 * 构建建模Prompt
 */
function buildModelingPrompt(recognitionData) {
  return `你是一个专业的建筑3D建模专家。请根据以下草图识别结果，生成精确的3D建模参数。

## 识别数据

### OCR识别的文字：
${recognitionData.text || '未识别到文字'}

### YOLO识别的建筑元素：
${JSON.stringify(recognitionData.objects?.slice(0, 5) || [], null, 2)}

### 增强识别信息：
${JSON.stringify(recognitionData.enhanced?.extracted_data || {}, null, 2)}

## 任务要求

请分析上述信息，生成3D建模参数。严格按照以下JSON格式返回：

\`\`\`json
{
  "building_type": "residential/office/commercial",
  "floors": {
    "count": 楼层数(如果识别到"3层"就是3),
    "height": 每层高度(毫米),
    "heights": [每层的具体高度]
  },
  "dimensions": {
    "width": 建筑宽度(毫米),
    "depth": 建筑深度(毫米),
    "height": 总高度(毫米)
  },
  "walls": [
    {
      "id": "w1",
      "type": "external",
      "start": {"x": 0, "y": 0},
      "end": {"x": 10000, "y": 0},
      "thickness": 240
    }
  ],
  "rooms": [],
  "materials": {
    "primary": "concrete",
    "facade": "如果识别到玻璃幕墙则为glass_curtain"
  },
  "features": {
    "has_balcony": false,
    "has_curved_wall": 如果识别到曲面则为true,
    "has_roof_garden": false
  }
}
\`\`\`

## 重要规则：
1. 楼层数必须与识别文字匹配（如"5层"→count:5）
2. 没有尺寸时使用默认值（住宅10×8米，办公15×12米）
3. 识别到"曲面"、"弧形"时，has_curved_wall必须为true
4. 墙体必须形成闭合空间`;
}

/**
 * 调用vLLM进行模型修改
 */
async function callVLLMForModification(currentModel, command) {
  const prompt = `你是一个3D建模助手。请根据用户指令修改建筑模型参数。

## 当前模型参数：
${JSON.stringify(currentModel, null, 2)}

## 用户指令：
"${command}"

## 修改规则：
- "改成5层" → 修改floors.count为5
- "加2层" → floors.count增加2
- "玻璃幕墙" → materials.facade改为"glass_curtain"
- "加个阳台" → features.has_balcony改为true
- "加宽2米" → dimensions.width增加2000
- "东侧加曲面" → features.has_curved_wall改为true，并在walls中添加曲面墙

请返回完整的修改后的JSON参数，格式与输入相同。`;

  try {
    const response = await axios.post(
      SERVICES.vllm,
      {
        model: "Qwen2.5-7B-Instruct",
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.3
      },
      {
        timeout: 60000
      }
    );
    
    const aiOutput = response.data.choices[0].text;
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
  } catch (error) {
    console.error('vLLM修改调用失败:', error.message);
  }
  
  // 备用：规则引擎处理
  return applyRuleBasedModification(currentModel, command);
}

/**
 * 规则引擎修改（备用）
 */
function applyRuleBasedModification(model, command) {
  const modified = JSON.parse(JSON.stringify(model));
  
  // 楼层修改
  const floorMatch = command.match(/(\d+)\s*层/);
  if (floorMatch) {
    modified.floors.count = parseInt(floorMatch[1]);
    modified.dimensions.height = modified.floors.count * modified.floors.height;
  }
  
  // 材质修改
  if (command.includes('玻璃')) {
    modified.materials.facade = 'glass_curtain';
  }
  
  // 特征修改
  if (command.includes('阳台')) {
    modified.features.has_balcony = true;
  }
  
  if (command.includes('曲面') || command.includes('弧形')) {
    modified.features.has_curved_wall = true;
  }
  
  return modified;
}

/**
 * 验证和优化参数
 */
function validateAndOptimizeParams(params) {
  // 确保必要字段存在
  params.building_type = params.building_type || 'residential';
  params.floors = params.floors || { count: 1, height: 3300 };
  params.dimensions = params.dimensions || { 
    width: 10000, 
    depth: 8000, 
    height: params.floors.count * params.floors.height 
  };
  
  // 验证数值合理性
  if (params.floors.count < 1) params.floors.count = 1;
  if (params.floors.count > 100) params.floors.count = 100;
  
  // 确保墙体闭合
  if (params.walls && params.walls.length > 0) {
    ensureWallClosure(params.walls);
  }
  
  return params;
}

/**
 * 确保墙体闭合
 */
function ensureWallClosure(walls) {
  if (walls.length < 2) return;
  
  const first = walls[0];
  const last = walls[walls.length - 1];
  
  const dx = last.end.x - first.start.x;
  const dy = last.end.y - first.start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 100) {
    walls.push({
      id: 'wall_closing',
      type: 'external',
      start: last.end,
      end: first.start,
      thickness: 240
    });
  }
}

/**
 * 获取默认参数
 */
function getDefaultModelingParams(recognitionData) {
  // 尝试从文字中提取楼层数
  let floors = 1;
  const floorMatch = recognitionData.text?.match(/(\d+)\s*[层楼F]/);
  if (floorMatch) {
    floors = parseInt(floorMatch[1]);
  }
  
  return {
    building_type: 'residential',
    floors: {
      count: floors,
      height: 3300,
      heights: Array(floors).fill(3300)
    },
    dimensions: {
      width: 10000,
      depth: 8000,
      height: floors * 3300
    },
    walls: [
      { id: 'w1', type: 'external', start: {x: 0, y: 0}, end: {x: 10000, y: 0}, thickness: 240 },
      { id: 'w2', type: 'external', start: {x: 10000, y: 0}, end: {x: 10000, y: 8000}, thickness: 240 },
      { id: 'w3', type: 'external', start: {x: 10000, y: 8000}, end: {x: 0, y: 8000}, thickness: 240 },
      { id: 'w4', type: 'external', start: {x: 0, y: 8000}, end: {x: 0, y: 0}, thickness: 240 }
    ],
    rooms: [],
    materials: {
      primary: 'concrete',
      facade: 'paint'
    },
    features: {
      has_balcony: false,
      has_curved_wall: false,
      has_roof_garden: false
    }
  };
}

/**
 * 计算置信度
 */
function calculateConfidence(recognition, modeling) {
  let score = 0;
  
  if (recognition.text) score += 0.3;
  if (recognition.objects?.length > 0) score += 0.3;
  if (recognition.enhanced?.enabled) score += 0.2;
  if (modeling.walls?.length > 3) score += 0.2;
  
  return Math.min(score, 1.0);
}

/**
 * 检测变化
 */
function detectChanges(original, modified) {
  const changes = [];
  
  if (original.floors?.count !== modified.floors?.count) {
    changes.push({
      type: 'floors',
      from: original.floors.count,
      to: modified.floors.count
    });
  }
  
  if (original.materials?.facade !== modified.materials?.facade) {
    changes.push({
      type: 'material',
      from: original.materials.facade,
      to: modified.materials.facade
    });
  }
  
  return changes;
}

/**
 * 生成变化摘要
 */
function generateChangeSummary(changes) {
  if (changes.length === 0) return '无变化';
  
  return changes.map(c => {
    if (c.type === 'floors') {
      return `楼层从${c.from}改为${c.to}`;
    }
    if (c.type === 'material') {
      return `材质从${c.from}改为${c.to}`;
    }
    return JSON.stringify(c);
  }).join(', ');
}

/**
 * 检查服务健康状态
 */
async function checkServiceHealth(endpoint) {
  try {
    const response = await axios.get(endpoint, { timeout: 3000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = router;