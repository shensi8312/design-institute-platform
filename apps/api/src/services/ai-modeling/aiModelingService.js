/**
 * AI建模服务 - 统一服务网关
 * 插件的唯一通信接口，负责协调所有后端微服务
 * 
 * 架构设计:
 *   SketchUp插件 
 *       ↓ (唯一连接)
 *   AIModelingService (本服务)
 *       ↓ (内部调用)
 *   ├── 文档识别服务 (8086)
 *   ├── vLLM推理服务 (8000) 
 *   ├── QwenVL视觉服务 (8001)
 *   └── 其他微服务
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const ResponseNormalizer = require('./responseNormalizer');
const DepthEstimationService = require('./depthEstimationService');
const PerformanceOptimizer = require('./performanceOptimizer');
const PerspectiveAnalysisService = require('./PerspectiveAnalysisService');
const GeometricPerspectiveReconstructor = require('./GeometricPerspectiveReconstructor');
const PerspectiveCalibration = require('./perspectiveCalibration');
const DirectWhiteBoxGenerator = require('./directWhiteBoxGenerator');
// AccuracyEnhancer和SketchPreprocessor功能已整合到主服务中
// const AccuracyEnhancer = require('./accuracyEnhancer');
// const SketchPreprocessor = require('./sketchPreprocessor');

class AIModelingService {
  constructor() {
    // 微服务配置
    this.services = {
      // 文档识别服务（OCR+YOLO+QwenVL）
      recognition: {
        endpoint: process.env.RECOGNITION_ENDPOINT || 'http://localhost:8086/api/recognize',
        timeout: 30000
      },
      // vLLM推理服务
      vllm: {
        endpoint: process.env.VLLM_ENDPOINT || 'http://10.10.18.2:8000/v1/chat/completions',
        model: process.env.VLLM_MODEL || 'Qwen3-32B',
        apiKey: process.env.VLLM_API_KEY,
        timeout: 60000
      },
      // QwenVL视觉理解服务
      qwenvl: {
        endpoint: process.env.QWENVL_ENDPOINT || 'http://10.10.18.2:8001/v1/chat/completions',
        model: 'Qwen2.5-VL-7B-Instruct',  // 修正为正确的模型名称
        timeout: 30000
      }
    };
    
    // 会话管理
    this.sessions = new Map();
    
    // 服务健康状态
    this.serviceHealth = {
      recognition: false,
      vllm: false,
      qwenvl: false
    };
    
    // 启动时检查服务健康状态
    this.checkServiceHealth();
  }

  /**
   * 根据中心点坐标获取相对位置描述
   */
  getRelativePosition(center) {
    if (!center || center.length < 2) return 'center';
    const [x, y] = center;
    
    if (x < 0.33) return 'left';
    if (x > 0.67) return 'right';
    if (y < 0.33) return 'back';
    if (y > 0.67) return 'front';
    return 'center';
  }

  /**
   * 统一入口：处理插件的所有请求
   * @param {Object} request - 请求对象
   * @param {string} request.action - 动作类型: sketch_to_3d, modify, chat, get_status
   * @param {Buffer} request.imageBuffer - 图片数据（可选）
   * @param {Object} request.params - 其他参数
   * @param {string} request.sessionId - 会话ID（可选）
   */
  async processRequest(request) {
    console.log('\n【==================== processRequest入口 ====================】');
    console.log('  📍 调用位置: aiModelingService.processRequest');
    console.log('  📊 request内容:');
    console.log('    - request键:', Object.keys(request));
    
    const { action, imageBuffer, params = {}, sessionId } = request;
    
    console.log(`\n🔄 处理插件请求: ${action}`);
    console.log(`   会话ID: ${sessionId || '新会话'}`);
    console.log(`   图片数据: ${imageBuffer ? `${imageBuffer.length} bytes` : '无'}`);
    console.log(`   参数键: ${Object.keys(params).join(', ')}`);
    console.log('【===========================================================】\n');
    
    try {
      switch (action) {
        // 草图转3D
        case 'sketch_to_3d':
          console.log('\n  ⚡ 进入sketch_to_3d分支');
          console.log('  📊 准备调用processSketchTo3D');
          console.log('  📊 imageBuffer长度:', imageBuffer ? imageBuffer.length : 0);
          console.log('  📊 params内容:', params);
          const sketchResult = await this.processSketchTo3D(imageBuffer, params);
          console.log('  ✅ processSketchTo3D执行完成');
          console.log('  📊 返回结果键:', Object.keys(sketchResult));
          return sketchResult;
        
        // 对话修改
        case 'modify':
          return await this.processModification(
            params.currentModel,
            params.command,
            sessionId
          );
        
        // 智能对话
        case 'chat':
          return await this.processChat(params.message, sessionId);
        
        // 获取服务状态
        case 'get_status':
          return await this.getServiceStatus();
        
        // 保存/加载会话
        case 'save_session':
          return await this.saveSession(sessionId, params.data);
        
        case 'load_session':
          return await this.loadSession(sessionId);
        
        // 批量处理
        case 'batch_process':
          return await this.processBatch(params.images, params.options);
        
        default:
          throw new Error(`不支持的操作: ${action}`);
      }
      
    } catch (error) {
      console.error(`请求处理失败 [${action}]:`, error);
      return {
        success: false,
        error: error.message,
        action: action
      };
    }
  }
  
  /**
   * 主处理流程：图片 → 识别 → 推理 → 3D参数
   */
  async processSketchTo3D(imageBuffer, options = {}) {
    // 创建处理日志数组，用于返回给插件端显示
    const processLogs = [];
    const addLog = (message, type = 'info') => {
      const logEntry = {
        time: new Date().toISOString(),
        type: type, // info, success, warning, error
        message: message
      };
      processLogs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
    };
    
    addLog('开始草图转3D处理流程', 'info');
    addLog(`输入图片大小: ${imageBuffer ? imageBuffer.length : 0} bytes`, 'info');
    
    // 生成会话ID
    const sessionId = options.sessionId || `sketch_${Date.now()}`;
    addLog(`会话ID: ${sessionId}`, 'info');
    
    try {
      // 🔥 新增：几何优先重建模式（Phase 0）
      if (options.useGeometricReconstruction) {
        addLog('【几何优先模式】启动Phase 0快速重建', 'info');
        
        try {
          const reconstructor = new GeometricPerspectiveReconstructor();
          const geometricResult = await reconstructor.reconstructFromPerspective(imageBuffer, {
            referenceHeight: options.floorHeight || 3.2,
            buildingType: options.building_type
          });
          
          addLog('✅ 几何重建成功', 'success');
          console.log('几何重建结果:', JSON.stringify(geometricResult, null, 2));
          
          // 返回SketchUp格式的数据
          return {
            success: true,
            mode: 'geometric_reconstruction',
            data: geometricResult,
            processLogs,
            sessionId
          };
        } catch (geoError) {
          addLog(`⚠️ 几何重建失败，降级到原始流程: ${geoError.message}`, 'warning');
          console.error('几何重建错误:', geoError);
          // 继续执行原始流程
        }
      }
      
      // 原始流程：调用透视图分析API
      addLog('【步骤1】调用透视图分析API', 'info');
      
      try {
        addLog('准备调用perspectiveAnalyzer...', 'info');
        const perspectiveAnalyzer = require('./perspectiveSketchAnalyzer');
        addLog('perspectiveAnalyzer加载成功', 'success');
        
        // 调用透视图分析
        addLog('开始调用analyzePerspectiveSketch...', 'info');
        let analysisResult;
        try {
          analysisResult = await perspectiveAnalyzer.analyzePerspectiveSketch(imageBuffer);
          addLog('透视图分析完成', 'success');
        } catch (innerError) {
          addLog(`透视图分析错误: ${innerError.message}`, 'error');
          throw innerError;
        }
        
        if (analysisResult.success) {
        addLog('透视图分析成功！', 'success');
        
        // 记录分析结果
        if (analysisResult.data?.analysis) {
          addLog(`识别到${analysisResult.data.analysis.buildings?.length || 0}栋建筑`, 'info');
        }
        
        // 转换数据格式以兼容插件
        const modelingData = this.convertToPluginFormat(analysisResult.data);
        
        console.log('\n📊 转换后的建模数据:');
        console.log('  - 楼层数:', modelingData.modeling?.floors?.count || 1);
        console.log('  - 建筑尺寸:', modelingData.modeling?.dimensions);
        console.log('  - 体块数:', modelingData.modeling?.volumes?.length || 0);
        
        // 保存会话数据
        this.sessions.set(sessionId, {
          timestamp: Date.now(),
          modelingData: modelingData.modeling,
          analysis: analysisResult.data
        });
        
        // 计算处理时间
        const endTime = Date.now();
        const startTime = endTime - 1000; // 临时值，应该在函数开始时记录
        
        // 确保dimensions字段名正确（Ruby插件期望width和depth）
        if (modelingData.modeling.dimensions) {
          // 如果有length字段，转换为depth
          if (modelingData.modeling.dimensions.length !== undefined && modelingData.modeling.dimensions.depth === undefined) {
            modelingData.modeling.dimensions.depth = modelingData.modeling.dimensions.length;
            delete modelingData.modeling.dimensions.length;
          }
        }
        
        // 同样修复volumes中的dimensions
        if (modelingData.modeling.volumes) {
          modelingData.modeling.volumes.forEach(vol => {
            if (vol.dimensions && vol.dimensions.length !== undefined && vol.dimensions.depth === undefined) {
              vol.dimensions.depth = vol.dimensions.length;
              delete vol.dimensions.length;
            }
          });
        }
        
        // 生成两种路线的输出（路线A：透视标定，路线B：直接生成）
        let rubyGeneration = null;
        try {
          // 获取图像尺寸信息
          const sharp = require('sharp');
          const imageMetadata = await sharp(imageBuffer).metadata();
          const imageInfo = {
            width: imageMetadata.width,
            height: imageMetadata.height,
            filename: options.filename || 'sketch.jpg'
          };
          
          // 生成两种路线的输出
          const bothRoutes = DirectWhiteBoxGenerator.generateBothRoutes(
            {
              modeling: modelingData.modeling,
              ...analysisResult.data.analysis
            },
            imageInfo
          );
          
          console.log('✅ 生成Ruby代码成功');
          console.log('🎯 推荐路线:', bothRoutes.recommendation.route);
          console.log('📊 原因:', bothRoutes.recommendation.reason);
          
          rubyGeneration = bothRoutes;
        } catch (genErr) {
          console.warn('⚠️ 生成Ruby代码失败:', genErr.message);
          console.error('生成错误详情:', genErr.stack);
        }
        
        return {
          success: true,
          action: 'sketch_to_3d',
          sessionId: sessionId,
          modeling: modelingData.modeling,  // 保持在modeling键下，Ruby插件期望这个结构
          analysis: analysisResult.data.analysis,  // 包含原始分析数据（空间关系、透视、阴影等）
          result: rubyGeneration,  // 包含两种路线的Ruby生成方案（兼容测试脚本）
          ruby: rubyGeneration,  // 保留向后兼容
          metadata: {
            duration: endTime - startTime,
            timestamp: endTime,
            action: 'sketch_to_3d',
            confidence: modelingData.modeling.metadata?.confidence || 0.8
          }
        };
        } else {
          console.error('  ❌ 透视图分析失败');
          throw new Error('透视图分析失败: ' + (analysisResult.error || '未知错误'));
        }
      } catch (perspectiveError) {
        console.error('  ❌ 透视图分析出错:', perspectiveError.message);
        console.error('  错误堆栈:', perspectiveError.stack);
        throw perspectiveError; // 直接抛出错误，不回退
      }
      
      // 步骤1: 手绘草图预处理
      console.log('\n\n【第1步】手绘草图预处理 ⚙️');
      console.log('────────────────────────────────────');
      console.log('目标: 清理杂乱线条，规整化手绘，提取建筑特征');
      let preprocessedImage = imageBuffer;
      let preprocessMetadata = {};
      
      try {
        console.log('  ⏳ 正在预处理手绘草图...');
        const preprocessResult = await SketchPreprocessor.preprocessSketch(imageBuffer, {
          denoise: true,
          regularizeLines: true,
          enhanceEdges: true,
          semanticSegmentation: true
        });
        
        if (preprocessResult.success) {
          console.log('  ✅ 预处理成功！');
          console.log('  📊 预处理结果:');
          console.log('    • 检测到主要线条:', preprocessResult.metadata.detectedLines);
          console.log('    • 窗户元素:', preprocessResult.extractedFeatures.windows?.length || 0, '个');
          console.log('    • 楼层线:', preprocessResult.extractedFeatures.floors?.length || 0, '条');
          console.log('    • 噪声去除:', preprocessResult.metadata.improvements.noiseReduction ? '✓' : '✗');
          console.log('    • 线条规整:', preprocessResult.metadata.improvements.lineRegularization ? '✓' : '✗');
          preprocessedImage = preprocessResult.processedImage;
          preprocessMetadata = preprocessResult.extractedFeatures;
        } else {
          console.log('  ⚠️ 预处理失败，使用原图继续');
        }
      } catch (e) {
        console.log('  ❌ 预处理异常:', e.message);
        console.log('  📌 使用原始图像继续...');
      }
      
      // 步骤2: OCR + YOLO识别
      console.log('\n\n【第2步】文档识别服务（OCR + YOLO） 📝');
      console.log('────────────────────────────────────');
      console.log('目标: 识别文字标注和建筑构件');
      console.log('  ⏳ 调用识别服务 (端口8086)...');
      const recognitionResult = await this.callRecognitionService(preprocessedImage, options);
      
      // 显示OCR和YOLO结果
      if (recognitionResult.text) {
        console.log('  ✅ OCR识别到文字:', recognitionResult.text.substring(0, 100) + '...');
      } else {
        console.log('  ⚠️ OCR未识别到文字');
      }
      
      if (recognitionResult.objects && recognitionResult.objects.length > 0) {
        console.log('  ✅ YOLO检测到', recognitionResult.objects.length, '个建筑元素:');
        recognitionResult.objects.slice(0, 5).forEach(obj => {
          console.log(`    • ${obj.chinese_name || obj.class}: 置信度 ${(obj.confidence * 100).toFixed(1)}%`);
        });
      } else {
        console.log('  ⚠️ YOLO未检测到建筑元素');
      }
      
      // 步骤3: QwenVL多模态识别
      console.log('\n\n【第3步】QwenVL多模态视觉识别 👁️');
      console.log('────────────────────────────────────');
      console.log('目标: 识别建筑场景类型、建筑数量、楼层数等');
      console.log('  ⏳ 调用QwenVL服务 (10.10.18.2:8001)...');
      const qwenvlResult = await this.callQwenVLService(preprocessedImage, options);
      
      // 显示QwenVL识别结果
      console.log('  📊 QwenVL识别结果:');
      if (qwenvlResult.scene_type) {
        console.log('    • 场景类型:', qwenvlResult.scene_type);
      }
      if (qwenvlResult.buildings && qwenvlResult.buildings.length > 0) {
        console.log('    ✅ 识别到', qwenvlResult.buildings.length, '栋建筑:');
        qwenvlResult.buildings.forEach((b, i) => {
          console.log(`      建筑${i+1} [${b.id}]: ${b.floors}层, ${b.building_type}类型, 位置:${b.position || '未知'}`);
        });
      } else {
        console.log('    ⚠️ QwenVL未识别到多建筑信息');
        if (qwenvlResult.floors) {
          console.log('    • 单建筑楼层数:', qwenvlResult.floors);
        }
      }
      console.log('    • 置信度:', qwenvlResult.confidence || '未知');
      
      // 步骤4: 深度估计和点云生成
      console.log('\n\n【第4步】深度估计与点云生成 🌊');
      console.log('────────────────────────────────────');
      console.log('目标: 生成深度图和3D点云数据');
      console.log('  ⏳ 调用深度估计服务 (端口8087)...');
      let depthResult;
      try {
        depthResult = await DepthEstimationService.processImage(preprocessedImage, {
          objects: recognitionResult.objects,
          floors: qwenvlResult.floors,
          building_type: qwenvlResult.building_type,
          // 传递预处理提取的特征
          preprocessed: {
            windows: preprocessMetadata.windows,
            floors: preprocessMetadata.floors,
            mainLines: preprocessMetadata.mainLines,
            outline: preprocessMetadata.outline
          }
        });
        
        if (depthResult.success) {
          console.log('  ✅ 深度估计成功！');
          console.log('    • 深度图生成:', !!depthResult.depth_map?.data ? '✓' : '✗');
          console.log('    • 点云点数:', depthResult.pointCloud?.points?.length || 0, '个');
          console.log('    • 深度层次:', depthResult.features?.depthLayers?.length || 0, '层');
          console.log('    • 主立面宽度:', depthResult.features?.mainFacade?.width || 0, 'mm');
          console.log('    • 窗户网格:', depthResult.features?.patterns?.windowGrid ? 
            `${depthResult.features.patterns.windowGrid.columns}×${depthResult.features.patterns.windowGrid.rows}` : '未检测到');
          console.log('    • 置信度:', depthResult.confidence);
        } else {
          console.log('  ⚠️ 深度估计失败');
        }
      } catch (depthError) {
        console.log('  ❌ 深度估计服务调用失败:', depthError.message);
        throw new Error(`深度估计返回数据格式错误：${depthError.message}`);
      }
      
      // 合并识别结果（四部分：OCR、YOLO、QwenVL、深度）
      const combinedRecognition = {
        text: recognitionResult.text || '',  // OCR文字
        objects: recognitionResult.objects || [],  // YOLO对象
        enhanced: {  // QwenVL增强识别
          enabled: true,
          extraction_types: ['building_info', 'dimensions', 'materials', 'layout'],
          extracted_data: qwenvlResult.extracted_data || qwenvlResult || {},  // 确保包含完整的qwenvl结果
          qwenvl_analysis: JSON.stringify(qwenvlResult) || qwenvlResult.text || qwenvlResult.analysis || '',
          // 重要：保存完整的建筑列表
          buildings: qwenvlResult.buildings || [],
          scene_type: qwenvlResult.scene_type || 'unknown',
          // 添加volumes数据（如果有）
          volumes: qwenvlResult.volumes
        },
        depth: {  // 深度信息（新增）
          enabled: depthResult.success,
          pointCloud: depthResult.pointCloud,
          features: depthResult.features,
          confidence: depthResult.confidence
        }
      };
      
      // 步骤5: 准备vLLM推理
      console.log('\n\n【第5步】准备智能推理 🧠');
      console.log('────────────────────────────────────');
      console.log('目标: 让vLLM Qwen3-32B进行智能推理');
      
      // 从QwenVL结果中提取视角类型和建筑类型供vLLM使用
      const viewType = qwenvlResult.view_type || 'unknown';
      const buildingType = qwenvlResult.buildings?.[0]?.building_type || 
                          qwenvlResult.building_type || 
                          'unknown';
      
      console.log('  📊 识别信息:');
      console.log('    • 视角类型:', viewType);
      console.log('    • 建筑类型:', buildingType);
      console.log('  💡 vLLM将基于这些信息进行智能推理');
      
      // 将视角和建筑类型信息添加到识别数据中供vLLM使用
      combinedRecognition.enhanced.view_type = viewType;
      combinedRecognition.enhanced.building_type = buildingType;
      
      // 步骤6: 直接基于识别结果生成3D参数（不需要语言模型推理）
      console.log('\n\n【第6步】基于识别结果生成3D参数 📐');
      console.log('────────────────────────────────────');
      console.log('目标: 直接使用QwenVL和深度估计的结果生成3D建模参数');
      console.log('  📊 已有数据:');
      console.log('    • OCR文字:', combinedRecognition.text?.length || 0, '字符');
      console.log('    • YOLO对象:', combinedRecognition.objects?.length || 0, '个');
      console.log('    • QwenVL建筑数:', combinedRecognition.enhanced?.buildings?.length || 0, '栋');
      console.log('    • 深度信息:', combinedRecognition.depth?.enabled ? '已包含' : '未包含');
      console.log('    • 点云数据:', combinedRecognition.depth?.pointCloud?.points?.length || 0, '个点');
      console.log('    • 视角类型:', viewType);
      
      // 直接从识别结果构建3D参数，不需要语言模型推理
      const modelingParams = this.buildModelingParamsFromRecognition(
        qwenvlResult, 
        depthResult, 
        combinedRecognition,
        options
      );
      
      console.log('  ✅ 3D参数构建完成！');
      console.log('  📊 生成结果:');
      console.log('    • 建筑类型:', modelingParams.building_type);
      console.log('    • 楼层数:', modelingParams.floors?.count || '未识别');
      console.log('    • 建筑尺寸:', modelingParams.dimensions ? `${modelingParams.dimensions.width/1000}m × ${modelingParams.dimensions.depth/1000}m` : '默认值');
      console.log('    • 墙体数量:', modelingParams.walls?.length || 0);
      console.log('    • 窗户网格:', modelingParams.window_grid ? `${modelingParams.window_grid.rows}×${modelingParams.window_grid.columns}` : '无');
      
      // 步骤7: 3D参数生成与优化
      console.log('\n\n【第7步】3D参数生成与优化 🏗️');
      console.log('────────────────────────────────────');
      console.log('目标: 生成完整的3D建模参数并优化');
      console.log('  ⏳ 验证和优化参数...');
      // vLLM已经做了推理，这里只需要验证和优化
      const validatedParams = this.validateAndOptimize(modelingParams);
      
      console.log('  ✅ 参数优化完成！');
      console.log('  📊 最终3D参数:');
      console.log('    • 建筑类型:', validatedParams.building_type);
      console.log('    • 楼层结构:', validatedParams.floors?.count ? `${validatedParams.floors.count}层 × ${validatedParams.floors.height}mm` : '未定义');
      console.log('    • 建筑尺寸:', validatedParams.dimensions ? 
        `宽${validatedParams.dimensions.width}mm × 深${validatedParams.dimensions.depth}mm × 高${validatedParams.dimensions.height}mm` : '未定义');
      console.log('    • 墙体数量:', validatedParams.walls?.length || 0, '面');
      console.log('    • 窗户数量:', validatedParams.windows?.length || 0, '个');
      console.log('    • 门数量:', validatedParams.doors?.length || 0, '个');
      console.log('    • 房间数量:', validatedParams.rooms?.length || 0, '个');
      
      // 点云和3D重建信息
      if (combinedRecognition.depth?.pointCloud) {
        console.log('\n  🎯 3D重建数据:');
        console.log('    • 点云点数:', combinedRecognition.depth.pointCloud.points?.length || 0);
        console.log('    • 深度层次:', combinedRecognition.depth.features?.depthLayers?.length || 0);
        console.log('    • 3D特征提取:', combinedRecognition.depth.features ? '✓' : '✗');
      }
      
      // 保存到会话
      this.sessions.set(sessionId, {
        recognition: combinedRecognition,
        modeling: validatedParams,
        timestamp: Date.now()
      });
      
      // 组装原始响应（包含完整的三部分识别结果）
      const rawResponse = {
        success: true,
        sessionId: sessionId,
        recognition: combinedRecognition,  // 包含OCR、YOLO、QwenVL的完整数据
        modeling: validatedParams,       // AI生成的建模参数
        confidence: this.calculateConfidence(combinedRecognition, validatedParams),
        serviceStatus: this.serviceHealth  // 服务状态
      };
      
      // 使用规范化器确保返回标准格式
      const normalizedResponse = ResponseNormalizer.normalizeSketchTo3DResponse(rawResponse);
      
      // 流程完成总结
      console.log('\n\n✅ ==================== 处理流程完成 ====================');
      console.log('📦 最终输出:');
      console.log('  • 处理状态:', normalizedResponse.success ? '成功' : '失败');
      console.log('  • 会话ID:', normalizedResponse.sessionId);
      console.log('  • 建筑数量:', normalizedResponse.modeling?.buildings?.length || 1, '栋');
      console.log('  • 楼层数:', normalizedResponse.modeling?.floors?.count || '未知');
      console.log('  • 建筑尺寸:', normalizedResponse.modeling?.dimensions ? 
        `${normalizedResponse.modeling.dimensions.width/1000}m × ${normalizedResponse.modeling.dimensions.depth/1000}m` : '未知');
      console.log('  • 墙体数量:', normalizedResponse.modeling?.walls?.length || 0);
      console.log('  • 点云数据:', normalizedResponse.recognition?.depth?.pointCloud ? '已包含' : '未包含');
      console.log('  • 置信度:', normalizedResponse.confidence || '未知');
      console.log('===========================================================\n');
      
      return normalizedResponse;
      
    } catch (error) {
      console.error('AI建模失败:', error);
      console.error('错误堆栈:', error.stack);
      
      // 不允许降级，直接抛出错误
      console.error('❌ 服务错误，不进行降级处理');
      throw error;
    }
  }

  /**
   * 检查所有服务健康状态
   */
  async checkServiceHealth() {
    console.log('🏥 检查服务健康状态...');
    
    // 检查QwenVL视觉服务（替代原8086端口的识别服务）
    try {
      const testResponse = await axios.get(this.services.qwenvl.endpoint.replace('/v1/chat/completions', '/v1/models'), 
        { timeout: 5000 });
      this.serviceHealth.qwenvl = true;
      this.serviceHealth.recognition = true; // 兼容性
      console.log('  ✅ QwenVL视觉服务正常');
    } catch (e) {
      this.serviceHealth.qwenvl = false;
      this.serviceHealth.recognition = false; // 兼容性
      console.log('  ❌ QwenVL视觉服务不可用');
    }
    
    // 检查vLLM服务
    try {
      await axios.get(this.services.vllm.endpoint.replace('/v1/chat/completions', '/health'),
        { timeout: 5000 });
      this.serviceHealth.vllm = true;
      console.log('  ✅ vLLM服务正常');
    } catch (e) {
      this.serviceHealth.vllm = false;
      console.log('  ❌ vLLM服务不可用');
    }
    
    // 定期检查（每分钟）
    setTimeout(() => this.checkServiceHealth(), 60000);
  }
  
  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    await this.checkServiceHealth();
    
    const status = {
      overall: Object.values(this.serviceHealth).every(v => v) ? 'healthy' : 'degraded',
      services: {
        recognition: {
          healthy: this.serviceHealth.recognition,
          endpoint: this.services.recognition.endpoint
        },
        vllm: {
          healthy: this.serviceHealth.vllm,
          endpoint: this.services.vllm.endpoint
        },
        qwenvl: {
          healthy: this.serviceHealth.qwenvl,
          endpoint: this.services.qwenvl.endpoint
        }
      },
      activeSessions: this.sessions.size,
      timestamp: new Date().toISOString()
    };
    
    return {
      success: true,
      data: status
    };
  }
  
  /**
   * 调用QwenVL视觉识别服务（替代本地8086端口）
   */
  async callQwenVLService(imageBuffer, options = {}, retryCount = 0) {
    try {
      // 验证输入参数
      console.log('\n🔍 验证QwenVL输入参数:');
      console.log('  - imageBuffer存在:', !!imageBuffer);
      console.log('  - imageBuffer类型:', typeof imageBuffer);
      console.log('  - 是Buffer:', Buffer.isBuffer(imageBuffer));
      
      if (imageBuffer) {
        console.log('  - imageBuffer长度:', imageBuffer.length, '字节');
        console.log('  - imageBuffer前10字节:', imageBuffer.slice(0, 10));
        
        // 检查是否为有效的图片数据
        const header = imageBuffer.slice(0, 4).toString('hex');
        if (header.startsWith('ffd8ff')) {
          console.log('  - 图片格式: JPEG');
        } else if (header.startsWith('89504e47')) {
          console.log('  - 图片格式: PNG');
        } else {
          console.warn('  ⚠️ 警告：未知的图片格式，header:', header);
        }
      }
      
      console.log('  - options:', JSON.stringify(options));
      console.log('  - retryCount:', retryCount);
      
      // 图像预处理增强
      let processedBuffer = imageBuffer;
      if (imageBuffer) {
        try {
          const sharp = require('sharp');
          
          // 获取图像信息
          const metadata = await sharp(imageBuffer).metadata();
          const shortEdge = Math.min(metadata.width, metadata.height);
          
          // 如果短边小于1024，进行放大
          if (shortEdge < 1024) {
            const scale = 1024 / shortEdge;
            const newWidth = Math.round(metadata.width * scale);
            const newHeight = Math.round(metadata.height * scale);
            
            processedBuffer = await sharp(imageBuffer)
              .resize(newWidth, newHeight, { 
                kernel: sharp.kernel.lanczos3,
                withoutEnlargement: false 
              })
              .sharpen()  // 锐化边缘
              .normalise()  // 对比度增强
              .toBuffer();
              
            console.log(`  📐 图像预处理: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight}`);
          } else {
            // 即使尺寸够大，也进行增强处理
            processedBuffer = await sharp(imageBuffer)
              .sharpen()
              .normalise()
              .toBuffer();
            console.log(`  ✨ 图像增强: 锐化+对比度优化`);
          }
        } catch (err) {
          console.warn('  ⚠️ 图像预处理失败，使用原始图像:', err.message);
        }
      }
      
      // 将图像转为base64
      const base64Image = processedBuffer ? processedBuffer.toString('base64') : '';
      
      if (!base64Image) {
        console.warn('⚠️ 没有图像数据，跳过QwenVL识别');
        return { floors: 1, building_type: 'unknown' };
      }
      
      console.log('  - Base64转换成功，长度:', base64Image.length);
      
      // 添加重试日志
      if (retryCount > 0) {
        console.log(`🔄 第${retryCount}次重试QwenVL服务...`);
      }
      
      // 构建请求 - 优化的提示词，强制实例级检测和bbox输出
      const messages = [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `你是视觉结构化引擎。请识别这张透视图中各个建筑之间的细节，包括以下内容：

1. 提取每栋建筑的顶点坐标和轮廓线坐标
2. 标记建筑之间的连廊或走廊部分，包括这些连接区域的起点和终点坐标，并说明它们连接的是哪两栋建筑
3. 对有凸起或者凹陷的建筑细节部分，也请提取这些区域的特征坐标
4. 识别遮挡关系：哪些建筑在前，哪些在后，以及遮挡的程度

以 JSON 格式输出所有数据，包括每个建筑、连廊的相对位置、各特征点坐标以及相互之间的连接关系。

要求：
- 坐标使用相对值（0-1范围）
- 识别所有独立建筑（忽略树/车/路人）
- 估计每栋建筑的楼层数（rough_floors）
- 判断前后关系（用底边y坐标和面积大小）

只输出符合下述模式的 JSON：
{
  "count": <int>,
  "view_type": "plan/elevation/perspective/section/aerial",
  "instances": [
    {
      "id": "B1",
      "bbox": [<float>,<float>,<float>,<float>],
      "vertices": [[x1,y1],[x2,y2],...],  // 建筑顶点坐标
      "contour": [[x1,y1],[x2,y2],...],   // 轮廓线坐标
      "center": [<float>,<float>],
      "confidence": <float>,
      "rough_floors": <int|null>,
      "roof_type": "gabled|flat|other",
      "building_type": "residential/office/commercial/industrial/mixed",
      "features": {
        "protrusions": [  // 凸起部分
          {"type": "balcony/bay_window/entrance", "vertices": [[x,y],...]},
        ],
        "recesses": [     // 凹陷部分
          {"type": "courtyard/indent/notch", "vertices": [[x,y],...]},
        ]
      },
      "occlusion": {
        "is_occluded": <bool>,
        "occluded_by": ["B2"],
        "occlusion_ratio": <float>
      },
      "dimensions": {
        "width": <float>,
        "depth": <float>,
        "height": <float>
      },
      "notes": "<string|null>"
    }
  ],
  "connectors": [  // 连廊/走廊
    {
      "id": "C1",
      "type": "corridor/bridge/walkway",
      "connects": ["B1", "B2"],
      "start_point": [x1, y1],
      "end_point": [x2, y2],
      "vertices": [[x,y],...],
      "floor_level": <int>
    }
  ],
  "relations": [
    {"src":"B1","dst":"B2","type":"left_of/right_of/front_of/behind/connected"},
    {"src":"B3","dst":"B2","type":"overlaps_front"},
    {"src":"B2","dst":"B4","type":"adjacent"}
  ],
  "spatial_arrangement": {
    "foreground": ["B1"],
    "middleground": ["B2", "B3"],
    "background": ["B4"]
  }
}`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }];
      
      // 构建完整的请求体
      const requestBody = {
        model: this.services.qwenvl.model,
        messages: messages,
        max_tokens: 2000,
        temperature: 0  // 设置为0以获得确定性结果，避免每次识别不同的楼层数
      };
      
      // 详细记录请求信息
      console.log('\n📤 ========== 发送给QwenVL的请求 ==========');
      console.log('请求URL:', this.services.qwenvl.endpoint);
      console.log('请求方法: POST');
      console.log('超时设置:', this.services.qwenvl.timeout, 'ms');
      console.log('\n请求体:');
      console.log('  - model:', requestBody.model);
      console.log('  - max_tokens:', requestBody.max_tokens);
      console.log('  - temperature:', requestBody.temperature);
      console.log('  - messages长度:', requestBody.messages.length);
      console.log('\n消息内容:');
      requestBody.messages.forEach((msg, idx) => {
        console.log(`  消息${idx + 1}:`);
        console.log('    - role:', msg.role);
        console.log('    - content数组长度:', msg.content ? msg.content.length : 0);
        
        // 验证content是否为数组
        if (!Array.isArray(msg.content)) {
          console.error('    ❌ 错误：content不是数组！类型:', typeof msg.content);
          console.error('    content内容:', msg.content);
          return;
        }
        
        msg.content.forEach((item, itemIdx) => {
          // 验证item是否有type属性
          if (!item.type) {
            console.error(`      ❌ 错误：内容${itemIdx + 1}缺少type属性`);
            console.error('      item内容:', JSON.stringify(item).substring(0, 100));
            return;
          }
          
          if (item.type === 'text') {
            if (!item.text) {
              console.error(`      ❌ 错误：text类型的内容缺少text字段`);
            } else {
              console.log(`      内容${itemIdx + 1} (text):`, item.text.substring(0, 100) + '...');
              console.log('        文本长度:', item.text.length, '字符');
            }
          } else if (item.type === 'image_url') {
            if (!item.image_url || !item.image_url.url) {
              console.error(`      ❌ 错误：image_url类型的内容缺少image_url.url字段`);
              console.error('      item.image_url:', item.image_url);
            } else {
              const base64Str = item.image_url.url;
              console.log(`      内容${itemIdx + 1} (image_url):`);
              console.log('        - Base64前缀:', base64Str.substring(0, 50) + '...');
              console.log('        - Base64总长度:', base64Str.length, '字符');
              
              // 检查base64格式
              if (!base64Str.startsWith('data:image/')) {
                console.error('        ❌ 错误：图片URL格式不正确，缺少data:image/前缀');
                console.error('        实际前缀:', base64Str.substring(0, 20));
              }
              
              // 检查是否有有效的base64数据
              const base64Parts = base64Str.split(',');
              if (base64Parts.length !== 2) {
                console.error('        ❌ 错误：Base64格式不正确，应该包含逗号分隔的header和data');
              } else if (base64Parts[1].length < 100) {
                console.error('        ❌ 错误：Base64数据部分太短，可能为空');
              }
            }
          } else {
            console.warn(`      ⚠️ 警告：未知的content type: ${item.type}`);
          }
        });
      });
      
      // 计算请求体大小
      const requestSize = JSON.stringify(requestBody).length;
      console.log('\n请求体总大小:', (requestSize / 1024).toFixed(2), 'KB');
      if (requestSize > 1024 * 1024) {
        console.warn('⚠️ 警告：请求体超过1MB，可能导致超时或500错误');
      }
      console.log('==========================================\n');
      
      const response = await axios.post(
        this.services.qwenvl.endpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: this.services.qwenvl.timeout
        }
      );
      
      // 解析响应
      const content = response.data.choices[0].message.content;
      console.log('✅ QwenVL识别完成');
      
      // 尝试解析JSON - 不要设置默认值，让QwenVL的结果完整传递
      let result = {};
      try {
        // 先清理响应内容（去掉markdown代码块标记）
        let cleanContent = content;
        if (content.includes('```json')) {
          cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }
        
        // 修复常见的JSON格式问题（如"2层"改为2）
        cleanContent = cleanContent
          .replace(/:\s*(\d+)层/g, ': $1')  // "2层" -> 2
          .replace(/第([一二三四五六七八九十]+)栋建筑/g, (match, num) => {
            const numMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
            return `"building_${numMap[num] || 1}"`;
          });
        
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          // 尝试解析，如果失败则进行更多修复
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (e) {
            // 进一步修复：处理可能的键名问题
            let fixedJson = jsonMatch[0]
              .replace(/([{,]\s*)([^":\s]+)(\s*:)/g, '$1"$2"$3')  // 给键名加引号
              .replace(/:\s*([^",\s}]+)([,}])/g, ': "$1"$2');     // 给值加引号（如果需要）
            result = JSON.parse(fixedJson);
          }
          // 处理QwenVL返回的不同格式
          // 格式1: {"独立建筑数量": 3, "建筑层数分布": {...}}
          if (result['独立建筑数量'] && result['建筑层数分布']) {
            const buildingCount = result['独立建筑数量'];
            const floorsInfo = result['建筑层数分布'];
            
            // 转换为标准格式
            result.scene_type = buildingCount > 1 ? 'multi_building' : 'single_building';
            result.buildings = [];
            
            let index = 1;
            for (const [key, floors] of Object.entries(floorsInfo)) {
              result.buildings.push({
                id: `building_${index}`,
                name: key,
                floors: typeof floors === 'number' ? floors : parseInt(floors) || 5,
                building_type: 'office',
                position: {
                  relative: index === 1 ? 'left' : index === 2 ? 'center' : 'right'
                }
              });
              index++;
            }
            
            result.confidence = 0.9;
            console.log(`✅ 成功解析QwenVL响应：识别到 ${buildingCount} 栋建筑`);
          }
          
          // 打印识别结果
          console.log('🏗️ QwenVL识别结果:');
          console.log('  - 场景类型:', result.scene_type || 'unknown');
          console.log('  - 建筑数量:', result.buildings?.length || 0);
          
          // 显示每栋建筑的信息
          if (result.buildings && result.buildings.length > 0) {
            result.buildings.forEach((building, index) => {
              console.log(`\n  🏢 建筑 ${building.id || index + 1}:`);
              console.log(`    - 名称: ${building.name || '未命名'}`);
              console.log(`    - 楼层数: ${building.floors}`);
              console.log(`    - 类型: ${building.building_type}`);
              console.log(`    - 位置: ${building.position?.relative || 'center'}`);
            });
          }
          
          // 显示建筑关系
          if (result.relationships && result.relationships.length > 0) {
            console.log('\n  🔗 建筑关系:');
            result.relationships.forEach(rel => {
              console.log(`    - ${rel.from} → ${rel.to}: ${rel.type} (${rel.connector})`);
            });
          }
          
          console.log('  - 置信度:', result.confidence);
          
          // 处理新的instances格式
          if (result.instances && result.instances.length > 0) {
            // 转换instances为buildings格式，包含bbox信息
            result.buildings = result.instances.map(inst => ({
              id: inst.id,
              name: inst.notes || `建筑${inst.id}`,
              floors: inst.rough_floors || 1,
              building_type: inst.building_type,
              bbox: inst.bbox,  // 关键：保留bbox信息！
              center: inst.center,  // 关键：保留center信息！
              confidence: inst.confidence,
              dimensions: inst.dimensions || {  // 添加dimensions
                width: 20,  // 默认20米
                depth: 15,  // 默认15米
                height: (inst.rough_floors || 1) * 3.2  // 楼层数 * 3.2米
              },
              position: {
                relative: this.getRelativePosition(inst.center),
                coordinates: { x: inst.center[0], y: inst.center[1] }
              },
              features: {
                roof_type: inst.roof_type
              }
            }));
            
            // 保存关系信息
            if (result.relations) {
              result.relationships = result.relations.map(rel => ({
                from: rel.src,
                to: rel.dst,
                type: rel.type,
                connector: 'none'
              }));
            }
            
            // 保存网格信息
            if (result.grid_hint) {
              result.layout = {
                arrangement: result.grid_hint.rows && result.grid_hint.cols ? 'grid' : 'linear',
                rows: result.grid_hint.rows,
                cols: result.grid_hint.cols
              };
            }
          }
          
          // 为了兼容旧代码，如果只有一栋建筑，提取其楼层数
          if (result.buildings && result.buildings.length === 1) {
            result.floors = result.buildings[0].floors;
            result.building_type = result.buildings[0].building_type;
          }
        }
      } catch (e) {
        console.error('解析QwenVL响应失败:', e);
        // 如果不是JSON，保留原始文本
        result.text = content;
      }
      
      return result;
    } catch (error) {
      console.error('❌ QwenVL服务调用失败:', error.message);
      
      // 记录详细错误信息
      if (error.response) {
        console.error('  - 响应状态码:', error.response.status);
        console.error('  - 响应错误详情:', JSON.stringify(error.response.data, null, 2));
        
        // 分析500错误的具体原因
        if (error.response.status === 500) {
          console.error('\n🔍 ========== QwenVL 500错误分析 ==========');
          console.error('500错误通常表示服务器内部错误，可能原因：');
          console.error('1. QwenVL模型未正确加载');
          console.error('2. GPU内存不足');
          console.error('3. 模型推理超时');
          console.error('4. 图片格式不兼容');
          console.error('5. API服务配置问题');
          
          if (error.response.data?.error) {
            console.error('\n具体错误信息:', error.response.data.error);
          }
          if (error.response.data?.message) {
            console.error('错误消息:', error.response.data.message);
          }
          if (error.response.data?.detail) {
            console.error('错误详情:', error.response.data.detail);
          }
          console.error('==========================================\n');
          
          // 如果重试次数少于3次，尝试重试
          if (retryCount < 3) {
            console.log(`⏳ 等待2秒后重试（第${retryCount + 1}次）...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.callQwenVLService(imageBuffer, options, retryCount + 1);
          } else {
            console.error('❌ 已重试3次，QwenVL服务仍然失败');
          }
        }
      } else if (error.request) {
        console.error('  - 请求发送失败，没有收到响应');
        console.error('  - 请求URL:', this.services.qwenvl.endpoint);
      } else {
        console.error('  - 错误详情:', error.message);
      }
      
      // 使用基于建筑类型的智能推断
      console.warn('⚠️ QwenVL服务暂时不可用，使用基于建筑类型的智能推断');
      
      // 根据建筑类型智能推断楼层数
      const buildingType = options.building_type || 'unknown';
      let estimatedFloors = 1;
      let estimatedHeight = 3600;
      
      switch(buildingType.toLowerCase()) {
        case 'factory':
        case 'warehouse':
        case '厂房':
        case '仓库':
          estimatedFloors = 1;  // 厂房通常1层
          estimatedHeight = 8000; // 层高8米
          break;
        case 'residential':
        case '住宅':
        case '公寓':
          estimatedFloors = 6;  // 住宅常见6层
          estimatedHeight = 3000; // 层高3米
          break;
        case 'office':
        case '办公':
        case '写字楼':
          estimatedFloors = 8;  // 办公楼常见8层
          estimatedHeight = 3600; // 层高3.6米
          break;
        case 'commercial':
        case '商业':
        case '商场':
          estimatedFloors = 3;  // 商业建筑常见3层
          estimatedHeight = 4500; // 层高4.5米
          break;
        case 'mixed':
        case '综合体':
          estimatedFloors = 5;  // 综合体常见5层
          estimatedHeight = 3800; // 层高3.8米
          break;
        default:
          // 如果用户提供了楼层数，使用用户的；否则使用保守估计
          estimatedFloors = options.floors || 2;
          estimatedHeight = 3300;
      }
      
      console.log(`  - 建筑类型: ${buildingType}`);
      console.log(`  - 推断楼层数: ${estimatedFloors}`);
      console.log(`  - 推断层高: ${estimatedHeight}mm`);
      
      // 不再降级处理，直接抛出错误
      console.error('❌ QwenVL服务必须可用，不允许降级处理');
      throw new Error(`QwenVL服务不可用: ${error.message}`);
    }
  }
  
  /**
   * 调用文档识别服务（8086端口）
   */
  async callRecognitionService(imageBuffer, options = {}) {
    const FormData = require('form-data');
    const form = new FormData();
    
    // 检查imageBuffer
    if (!imageBuffer) {
      console.warn('⚠️ 没有图片数据，跳过OCR识别');
      // 返回默认值而不是抛出错误
      return {
        text: '',
        objects: [],
        success: false,
        message: '没有图片数据'
      };
    }
    
    // 确保imageBuffer是Buffer类型
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    
    form.append('file', buffer, {
      filename: 'sketch.jpg',
      contentType: 'image/jpeg'
    });
    form.append('enhance', 'true');
    
    try {
      const response = await axios.post(
        this.services.recognition.endpoint,
        form,
        {
          headers: form.getHeaders(),
          timeout: this.services.recognition.timeout
        }
      );
      
      console.log('✅ 识别完成:', {
        text: response.data.text?.substring(0, 100) + '...',
        objects: response.data.objects?.length || 0
      });
      
      return response.data;
    } catch (error) {
      console.error('识别服务调用失败:', error.message);
      // 返回默认识别结果
      return {
        text: '建筑草图',
        objects: [],
        enhanced: {},
        error: error.message
      };
    }
  }

  /**
   * 直接从识别结果构建3D参数（不需要语言模型推理）
   */
  buildModelingParamsFromRecognition(qwenvlResult, depthResult, recognitionData, options = {}) {
    console.log('\n  🔧 开始构建3D建模参数...');
    
    // 优先从recognitionData中提取完整的QwenVL分析结果
    let actualQwenvlResult = qwenvlResult;
    
    // 优先检查enhanced.volumes（直接添加的）
    if (recognitionData?.enhanced?.volumes) {
      actualQwenvlResult = {
        ...qwenvlResult,
        volumes: recognitionData.enhanced.volumes,
        building_count: recognitionData.enhanced.volumes?.length || qwenvlResult.building_count
      };
      console.log('  ✅ 使用enhanced.volumes中的完整建筑数据');
    } else if (recognitionData?.enhanced?.extracted_data?.volumes) {
      // 其次检查extracted_data中的volumes
      actualQwenvlResult = recognitionData.enhanced.extracted_data;
      console.log('  ✅ 使用enhanced.extracted_data中的完整QwenVL结果');
    }
    
    // 调试：输出接收到的QwenVL结果
    console.log('  📥 接收到的QwenVL结果:');
    console.log('    - volumes数量:', actualQwenvlResult?.volumes?.length || 0);
    console.log('    - building_count:', actualQwenvlResult?.building_count);
    if (actualQwenvlResult?.volumes) {
      actualQwenvlResult.volumes.forEach((v, i) => {
        console.log(`    - volume ${i+1}: ${v.id} (${v.name}) - ${v.floors}层`);
      });
    }
    
    // 检查是否有多建筑
    const hasMultipleBuildings = actualQwenvlResult?.volumes?.length > 1 || 
                                 actualQwenvlResult?.building_count > 1;
    
    console.log(`    📊 识别模式: ${hasMultipleBuildings ? '多建筑群' : '单体建筑'}`);
    if (hasMultipleBuildings) {
      console.log(`    🏢 建筑数量: ${actualQwenvlResult.building_count || actualQwenvlResult.volumes?.length}`);
    }
    
    // 基础参数
    const modelingParams = {
      building_type: qwenvlResult?.building_type || options.building_type || 'office',
      building_count: qwenvlResult?.building_count || 1,
      is_building_group: hasMultipleBuildings,
      buildings: [],  // 新增：多建筑数组
      floors: null,
      dimensions: null,
      walls: [],
      windows: [],
      doors: [],
      rooms: [],
      materials: {},
      features: {},
      spatial_relationships: qwenvlResult?.spatial_relationships || []
    };
    
    // 1. 从QwenVL提取楼层数
    if (qwenvlResult?.floors) {
      modelingParams.floors = {
        count: qwenvlResult.floors,
        height: 3300,  // 默认层高3.3米
        heights: Array(qwenvlResult.floors).fill(3300)
      };
      console.log('    ✓ 从QwenVL获取楼层数:', qwenvlResult.floors);
    } else if (qwenvlResult?.buildings?.[0]?.floors) {
      modelingParams.floors = {
        count: qwenvlResult.buildings[0].floors,
        height: 3300,
        heights: Array(qwenvlResult.buildings[0].floors).fill(3300)
      };
      console.log('    ✓ 从建筑列表获取楼层数:', qwenvlResult.buildings[0].floors);
    } else {
      // 无法获取楼层数，报错
      const error = new Error('无法从识别结果获取楼层数，缺少必要的楼层信息');
      console.error('    ❌ 错误:', error.message);
      console.error('    QwenVL结果:', {
        floors: qwenvlResult?.floors,
        buildings: qwenvlResult?.buildings,
        volumes: actualQwenvlResult?.volumes?.map(v => ({
          id: v.id,
          floors: v.floors
        }))
      });
      throw error;
    }
    
    // 2. 从深度估计提取尺寸
    if (depthResult?.features?.mainFacade) {
      const facade = depthResult.features.mainFacade;
      modelingParams.dimensions = {
        width: facade.width,  // 毫米
        depth: facade.width * 0.6,  // 深度约为宽度的0.6倍
        height: modelingParams.floors.count * modelingParams.floors.height
      };
      console.log('    ✓ 从深度估计获取尺寸:', `${facade.width}mm × ${facade.width * 0.6}mm`);
    } else {
      // 无法从深度估计获取尺寸，报错
      const error = new Error('无法从深度估计获取建筑尺寸，缺少必要的尺寸数据');
      console.error('    ❌ 错误:', error.message);
      console.error('    深度估计结果:', JSON.stringify(depthResult, null, 2));
      throw error;
    }
    
    // 3. 从深度估计提取窗户网格
    if (depthResult?.features?.patterns?.windowGrid) {
      const grid = depthResult.features.patterns.windowGrid;
      modelingParams.window_grid = {
        rows: grid.rows || modelingParams.floors.count,
        columns: grid.columns || 5,
        spacing_h: grid.avgHorizontalSpacing || 3000,
        spacing_v: grid.avgVerticalSpacing || 3300
      };
      console.log('    ✓ 检测到窗户网格:', `${grid.rows}行 × ${grid.columns}列`);
      
      // 生成窗户位置
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.columns; col++) {
          modelingParams.windows.push({
            id: `window_${row}_${col}`,
            position: {
              x: col * grid.avgHorizontalSpacing,
              y: 0,  // 正立面
              z: row * grid.avgVerticalSpacing
            },
            width: 1500,
            height: 2000
          });
        }
      }
    }
    
    // 4. 生成墙体（基于dimensions）
    const { width, depth, height } = modelingParams.dimensions;
    modelingParams.walls = [
      { id: 'wall_front', type: 'exterior', position: 'front', dimensions: { width, height } },
      { id: 'wall_back', type: 'exterior', position: 'back', dimensions: { width, height } },
      { id: 'wall_left', type: 'exterior', position: 'left', dimensions: { width: depth, height } },
      { id: 'wall_right', type: 'exterior', position: 'right', dimensions: { width: depth, height } }
    ];
    
    // 5. 材质（从QwenVL提取）
    modelingParams.materials = {
      facade: qwenvlResult?.materials?.[0] || 'glass_curtain',
      roof: 'concrete',
      floor: 'concrete'
    };
    
    // 6. 特色功能
    if (qwenvlResult?.building_features) {
      modelingParams.features = {
        has_balconies: qwenvlResult.building_features.includes('balcony'),
        has_entrance: qwenvlResult.building_features.includes('entrance'),
        has_glass_facade: qwenvlResult.building_features.includes('glass')
      };
    }
    
    // 7. 如果有多栋建筑，生成建筑组
    // 优先使用转换后的buildings数据（包含bbox），其次才用volumes
    const buildingDataList = qwenvlResult?.buildings || actualQwenvlResult?.volumes || [];
    
    if (hasMultipleBuildings && buildingDataList.length > 0) {
      console.log('    🏗️ 生成多建筑群3D参数...');
      console.log(`    📊 使用数据源: ${qwenvlResult?.buildings ? 'buildings(带bbox)' : 'volumes(旧格式)'}`);
      
      // 获取空间关系，用于精确定位
      const spatialRelations = qwenvlResult?.relationships || actualQwenvlResult?.spatial_relationships || [];
      let currentX = 0;
      let currentY = 0;
      
      // 为每个建筑生成独立的3D参数
      buildingDataList.forEach((volume, index) => {
        console.log(`    📐 处理建筑 ${index + 1}: ${volume.name || volume.id}`);
        
        // 从QwenVL获取的建筑尺寸（应该是实际数值，单位：米）
        const buildingWidth = parseFloat(volume.dimensions?.width);
        const buildingDepth = parseFloat(volume.dimensions?.depth);
        const buildingHeight = parseFloat(volume.dimensions?.height);
        
        if (!buildingWidth || !buildingDepth) {
          throw new Error(`体块${volume.id}缺少尺寸信息(宽:${volume.dimensions?.width}, 深:${volume.dimensions?.depth})，无法生成3D模型`);
        }
        
        // 转换为毫米（如果数值小于200，认为是米）
        const widthMM = buildingWidth < 200 ? buildingWidth * 1000 : buildingWidth;
        const depthMM = buildingDepth < 200 ? buildingDepth * 1000 : buildingDepth;
        
        // 使用草图中的实际位置（0-1归一化坐标）
        // 将归一化坐标转换为实际坐标（假设草图范围为100米x100米）
        const sceneWidth = 100000;  // 100米宽的场景
        const sceneDepth = 100000;  // 100米深的场景
        
        let xPos = 0;
        let yPos = 0;
        let zPos = 0;
        
        // 优先级1：使用bbox信息（最准确）
        if (volume.bbox && volume.center) {
          // 基于图像坐标转换到3D世界坐标
          const sceneWidth = 100000;  // 100米
          const sceneDepth = 60000;   // 60米
          
          xPos = (volume.center[0] - 0.5) * sceneWidth;  // 中心为原点
          yPos = (0.5 - volume.center[1]) * sceneDepth;  // Y轴反向（图像Y向下，3D Y向前）
          
          console.log(`      📍 使用bbox精确定位: 图像(${volume.center[0].toFixed(3)}, ${volume.center[1].toFixed(3)}) → 3D(${Math.round(xPos)}, ${Math.round(yPos)})`);
        } 
        // 优先级2：使用position信息（旧格式）
        else if (volume.position && volume.position.x !== undefined) {
          // x坐标：从草图的相对x位置计算
          xPos = (volume.position.x - 0.5) * sceneWidth;
          
          // y坐标：基于z_order（前后层次）和relative_depth
          if (volume.position.z_order) {
            // z_order表示前后层次，1是最前，数字越大越靠后
            yPos = (volume.position.z_order - 1) * 15000;  // 每层相距15米
          } else if (volume.position.relative_depth) {
            // relative_depth是0-1的深度值
            yPos = volume.position.relative_depth * sceneDepth * 0.5;
          } else if (volume.position.y) {
            // 直接使用y坐标
            yPos = (volume.position.y - 0.5) * sceneDepth;
          }
          
          console.log(`      从草图提取位置: x=${volume.position.x}, y=${volume.position.y || 'N/A'}, z_order=${volume.position.z_order || 'N/A'}`);
        } 
        // 优先级3：根据空间关系推算
        else if (index > 0) {
          // 如果没有位置信息，根据空间关系推算
          const prevVolume = modelingParams.buildings[index - 1];
          const relation = spatialRelations.find(r => 
            (r.volume1 === volume.id && r.volume2 === prevVolume.id) ||
            (r.volume2 === volume.id && r.volume1 === prevVolume.id)
          );
          
          if (relation) {
            console.log(`      空间关系: ${relation.relation} (${relation.distance})`);
            
            // 根据关系和距离计算位置
            const distance = relation.distance === '近' ? 2000 : 
                           relation.distance === '中' ? 10000 : 
                           relation.distance === '远' ? 20000 : 5000;
            
            switch (relation.relation) {
              case '相邻':
              case '连接':
                // 相邻或连接，间距很小
                xPos = prevVolume.position.x + prevVolume.dimensions.width/2 + buildingWidth/2 + 1000;
                yPos = prevVolume.position.y;
                break;
              case '左右':
                // 左右关系，根据距离确定间隔
                xPos = prevVolume.position.x + prevVolume.dimensions.width/2 + buildingWidth/2 + distance;
                yPos = prevVolume.position.y;
                break;
              case '前后':
              case '前方':
                // 前方，y坐标减小（向观察者靠近）
                xPos = prevVolume.position.x;
                yPos = prevVolume.position.y - prevVolume.dimensions.depth/2 - buildingDepth/2 - distance;
                break;
              case '后方':
                // 后方，y坐标增大（远离观察者）
                xPos = prevVolume.position.x;
                yPos = prevVolume.position.y + prevVolume.dimensions.depth/2 + buildingDepth/2 + distance;
                break;
              case '分离':
                // 分离的建筑，根据距离确定间隔
                xPos = prevVolume.position.x + prevVolume.dimensions.width/2 + buildingWidth/2 + distance * 2;
                yPos = prevVolume.position.y;
                break;
              default:
                // 默认：根据索引横向排列
                xPos = index * 25000;
                yPos = 0;
            }
          } else {
            // 最后的fallback：根据索引排列
            xPos = index * 25000;
            yPos = 0;
            console.log(`      ⚠️ 无位置信息，使用默认排列`);
          }
        }
        
        // 获取每栋建筑的楼层数，如果没有就报错
        const floors = volume.floors;
        if (!floors) {
          throw new Error(`体块${volume.id}缺少楼层数信息，无法生成3D模型`);
        }
        const floorHeight = 3300;
        const heightMM = buildingHeight ? 
          (buildingHeight < 200 ? buildingHeight * 1000 : buildingHeight) :
          (floors * floorHeight);
        
        // 创建建筑对象
        const building = {
          id: volume.id,
          name: volume.name || `建筑${index + 1}`,
          type: volume.type,
          position: { x: xPos, y: yPos, z: zPos },
          dimensions: {
            width: widthMM,
            depth: depthMM,
            height: heightMM
          },
          floors: {
            count: floors,
            height: floorHeight,
            total_height: buildingHeight
          },
          walls: this.generateWallsForBuilding(xPos, yPos, buildingWidth, buildingDepth, buildingHeight, volume),
          windows: [],
          features: volume.features || [],
          shadow: volume.shadow,
          protrusions: volume.protrusions || []
        };
        
        // 添加窗户（如果有窗户特征）
        if (volume.features?.includes('窗户')) {
          building.windows = this.generateWindowsForBuilding(
            xPos, yPos, buildingWidth, buildingDepth, floors
          );
        }
        
        modelingParams.buildings.push(building);
        console.log(`      ✓ 位置: (${xPos}, ${yPos}, ${zPos})`);
        console.log(`      ✓ 尺寸: ${buildingWidth/1000}m × ${buildingDepth/1000}m × ${buildingHeight/1000}m`);
        console.log(`      ✓ 楼层: ${floors}层`);
      });
      
      // 更新整体尺寸（包围盒）
      if (modelingParams.buildings.length > 0) {
        const minX = Math.min(...modelingParams.buildings.map(b => b.position.x - b.dimensions.width/2));
        const maxX = Math.max(...modelingParams.buildings.map(b => b.position.x + b.dimensions.width/2));
        const maxHeight = Math.max(...modelingParams.buildings.map(b => b.dimensions.height));
        const maxDepth = Math.max(...modelingParams.buildings.map(b => b.dimensions.depth));
        
        modelingParams.dimensions = {
          width: maxX - minX,
          depth: maxDepth,
          height: maxHeight
        };
        
        // 使用第一栋建筑的楼层信息作为主楼层信息
        modelingParams.floors = modelingParams.buildings[0].floors;
      }
    } else if (qwenvlResult?.buildings && qwenvlResult.buildings.length > 1) {
      modelingParams.buildings = qwenvlResult.buildings.map((b, idx) => ({
        id: b.id || `building_${idx + 1}`,
        name: b.name || `建筑${idx + 1}`,
        type: b.building_type || 'office',
        floors: b.floors || 5,
        position: b.position || { x: idx * 20000, y: 0, z: 0 },
        dimensions: {
          width: 15000,
          depth: 9000,
          height: (b.floors || 5) * 3300
        }
      }));
      console.log('    ✓ 检测到多栋建筑:', qwenvlResult.buildings.length);
    }
    
    console.log('  ✅ 3D参数构建完成');
    return modelingParams;
  }
  
  /**
   * 调用vLLM推理服务（已废弃，保留以兼容旧代码）
   */
  async callVLLMInference(recognitionData, options = {}) {
    // 构建推理prompt
    const prompt = this.buildInferencePrompt(recognitionData);
    
    try {
      // 修正：使用正确的API格式
      const response = await axios.post(
        'http://10.10.18.2:8000/v1/chat/completions',
        {
          model: this.services.vllm.model,
          messages: [
            {
              role: "system",
              content: "你是专业的建筑师和3D建模专家，擅长从有限信息推理完整的建筑参数。返回严格的JSON格式。"
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          max_tokens: options.maxTokens || 4000,  // 增加token限制
          temperature: options.temperature || 0.2,  // 稍微增加一点创造性
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.services.vllm.apiKey ? 'Bearer ' + this.services.vllm.apiKey : undefined
          },
          timeout: this.services.vllm.timeout
        }
      );
      
      // 解析AI响应 - 修正为message.content
      const aiResponse = response.data.choices[0].message.content;
      console.log('✅ AI推理完成');
      
      // 尝试解析JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        // 如果不是JSON，尝试提取JSON部分
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          console.error('AI响应解析失败，原始响应:', aiResponse.substring(0, 500));
          throw new Error('AI响应格式错误');
        }
      }
      
      // 如果没有floors或floors.count，使用QwenVL的结果
      if (!parsedResponse.floors || 
          (typeof parsedResponse.floors === 'object' && !parsedResponse.floors.count)) {
        // 从recognitionData中提取QwenVL的楼层数
        try {
          const qwenvlAnalysis = recognitionData.enhanced?.qwenvl_analysis;
          if (qwenvlAnalysis) {
            const qMatch = qwenvlAnalysis.match(/"floors"\s*:\s*(\d+)/);
            if (qMatch) {
              const qwenvlFloors = parseInt(qMatch[1]);
              console.log('🏢 使用QwenVL识别的楼层数:', qwenvlFloors);
              parsedResponse.floors = {
                count: qwenvlFloors,
                height: 3300
              };
            }
          }
        } catch (e) {
          console.log('无法从响应中提取QwenVL楼层数');
        }
      }
      
      return parsedResponse;
      
    } catch (error) {
      throw new Error(`vLLM推理失败: ${error.message}`);
    }
  }

  /**
   * 构建推理Prompt - 使用固定3D重建模板
   */
  buildInferencePrompt(recognitionData) {
    // 引入3D重建模板
    // 3D重建模板已内置，不需要单独的模板文件
    // const ReconstructionTemplate = require('./3dReconstructionTemplate');
    // 从QwenVL结果中获取建筑信息
    let qwenvlBuildings = [];
    let sceneType = 'unknown';
    
    try {
      // 首先检查enhanced中的buildings数组
      if (recognitionData.enhanced?.buildings && recognitionData.enhanced.buildings.length > 0) {
        qwenvlBuildings = recognitionData.enhanced.buildings;
        sceneType = recognitionData.enhanced.scene_type || 'building_complex';
        console.log('\n📝 ========== 构建vLLM Prompt ==========');
        console.log('⭐ 从QwenVL结果中提取到', qwenvlBuildings.length, '栋建筑');
        console.log('场景类型:', sceneType);
        console.log('========================================\n');
      } else {
        // 尝试从qwenvl_analysis中解析
        const qwenvlAnalysis = recognitionData.enhanced?.qwenvl_analysis;
        if (qwenvlAnalysis) {
          const jsonMatch = qwenvlAnalysis.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const qwenvlData = JSON.parse(jsonMatch[0]);
            if (qwenvlData.buildings && qwenvlData.buildings.length > 0) {
              qwenvlBuildings = qwenvlData.buildings;
              sceneType = qwenvlData.scene_type || 'building_complex';
            }
          }
        }
      }
    } catch (e) {
      console.log('⚠️ 无法从QwenVL结果中提取建筑信息');
    }
    
    // 提取视角类型供vLLM使用
    const viewType = recognitionData.enhanced?.view_type || recognitionData.inference?.report?.view_type || '未知';
    
    const prompt = `你是一个专业的建筑设计师和3D建模专家，擅长从不完整信息中进行智能推理。

🎯 **你的核心任务**：
1. 分析识别结果，理解图纸视角类型（俯视图/立面图/透视图）
2. 根据视角类型的限制，推理缺失的信息
3. 运用建筑设计规范和专业知识，生成完整的3D建模参数
4. 清楚标注哪些是识别的，哪些是推理的

📐 **智能推理原则**：

【视角类型处理】
• 俯视图/平面图 → 能看到：建筑轮廓、布局、道路
                → 需推理：楼层数、高度、立面材质
                → 生成策略：简化体块，高度基于建筑类型标准
• 立面图 → 能看到：楼层数、高度、立面材质
         → 需推理：建筑进深、平面布局
         → 生成策略：标准进深15-20米
• 透视图 → 能看到：部分楼层、建筑风格
         → 需推理：完整尺寸、背面结构
• 手绘图 → 材质不可见，根据建筑类型推理材质

【建筑类型推理标准】
• 工厂：1层，层高8-12米，钢结构，金属板外墙
• 仓库：1-2层，层高10-15米，大型货门，少窗
• 住宅：6-33层，层高2.8-3.3米，规则窗户，阳台
• 办公：5-50层，层高3.6-4.8米，玻璃幕墙
• 商业：2-10层，首层5.5米，标准层4.5米

【比例推理】
• 使用黄金比例1.618作为长宽比默认值
• 多建筑时，主楼通常是附属楼的1.5-2倍
• 建筑间距：防火13米，日照1.2H

【基础设施推理】
• 大门：主入口8米宽，次入口4米宽
• 绿地：住宅35%，商业20%，工厂15%
• 围墙：工厂2.5米实墙，住宅1.8米栏杆
• 停车：住宅0.8车位/户，办公1车位/100㎡

【办公建筑】
• 办公层高：3.3-4.2m（标准层）、4.5-6m（大堂）
• 建筑密度：≤40%
• 绿地率：≥25%
• 核心筒：电梯井、楼梯、卫生间、设备间
• 特征：玻璃幕墙60-80%、标准柱网8.4m×8.4m

【工业建筑】
• 厂房层高：单层6-12m、多层4.5-5.5m
• 建筑密度：≤60%
• 绿化率：≥15%
• 柱网：6m×6m、9m×9m、12m×12m
• 特征：大跨度、高窗、天窗、货运通道
• 配套：仓库、办公楼、配电房、污水处理

【公共建筑】
• 学校：教室3.6-3.9m、礼堂6-9m、体育馆9-15m
• 医院：病房3.3m、门诊3.6m、手术室3.5-4m
• 文化：展厅5-8m、剧院15-25m、图书馆3.9-4.5m
• 体育：体育馆15-30m、游泳馆6-9m

🏗️ **材质配比标准**：
• 玻璃幕墙：办公楼60-80%、商业40-60%、住宅20-40%
• 混凝土：结构主体100%、外立面装饰30-50%
• 铝板/金属板：商业建筑20-40%、高档办公15-30%
• 石材：底层裙房40-60%、主楼点缀10-20%
• 涂料：经济住宅60-80%、别墅30-50%

${
  qwenvlBuildings.length > 0 ? `
⚠️ 重要：QwenVL已识别到 ${qwenvlBuildings.length} 栋建筑！
场景类型：${sceneType}
建筑详情：
${qwenvlBuildings.map((b, i) => 
  `建筑${i+1} [${b.id}]: ${b.floors}层 ${b.building_type}类型 位置:${b.position || '中心'}`
).join('\n')}

你必须为每栋建筑分别生成3D参数！
` : ''
}

【1. OCR文字识别】
${recognitionData.text || '无文字识别结果'}

【2. YOLO建筑构件识别】
检测到${recognitionData.objects?.length || 0}个建筑元素：
${recognitionData.objects?.slice(0, 10).map(obj => 
  `- ${obj.chinese_name || obj.class}: 置信度${(obj.confidence * 100).toFixed(1)}%`
).join('\n') || '无对象检测结果'}

【3. QwenVL多模态理解】
视角类型：${viewType}
场景类型：${sceneType}
建筑数量：${qwenvlBuildings.length || 1}栋
${recognitionData.enhanced?.qwenvl_analysis || '无多模态分析'}
提取的建筑信息：
${JSON.stringify(qwenvlBuildings.length > 0 ? qwenvlBuildings : recognitionData.enhanced?.extracted_data || {}, null, 2)}

【4. 深度估计与点云分析】（新增）
${recognitionData.depth?.enabled ? '✅ 深度信息已启用' : '❌ 深度信息不可用'}
${recognitionData.depth?.features ? `
深度层次分析：
${recognitionData.depth.features.depthLayers?.map(layer => 
  `- ${layer.depth}mm深度: ${(layer.percentage * 100).toFixed(1)}%`
).join('\n') || '无深度层次'}

主立面参数：
- 宽度: ${recognitionData.depth.features.mainFacade?.width || '未知'}mm
- 高度: ${recognitionData.depth.features.mainFacade?.height || '未知'}mm

窗户网格模式：
${recognitionData.depth.features.patterns?.windowGrid ? 
  `- ${recognitionData.depth.features.patterns.windowGrid.columns}列 × ${recognitionData.depth.features.patterns.windowGrid.rows}行
- 水平间距: ${recognitionData.depth.features.patterns.windowGrid.avgHorizontalSpacing?.toFixed(0) || '未知'}mm
- 垂直间距: ${recognitionData.depth.features.patterns.windowGrid.avgVerticalSpacing?.toFixed(0) || '未知'}mm
- 规则性: ${recognitionData.depth.features.patterns.windowGrid.isRegular ? '规则' : '不规则'}` :
  '未检测到窗户网格'}

楼层模式：
${recognitionData.depth.features.patterns?.floorPattern ?
  `- 楼层数: ${recognitionData.depth.features.patterns.floorPattern.floorCount}
- 平均层高: ${recognitionData.depth.features.patterns.floorPattern.avgFloorHeight?.toFixed(0) || '未知'}mm
- 均匀性: ${recognitionData.depth.features.patterns.floorPattern.isUniform ? '均匀' : '不均匀'}` :
  '未检测到楼层模式'}

点云关键点：
- 总点数: ${Array.isArray(recognitionData.depth?.pointCloud?.points) ? recognitionData.depth.pointCloud.points.length : 0}
- 墙角点: ${Array.isArray(recognitionData.depth?.pointCloud?.points) ? recognitionData.depth.pointCloud.points.filter(p => p.type === 'wall_corner').length : 0}
- 窗户点: ${Array.isArray(recognitionData.depth?.pointCloud?.points) ? recognitionData.depth.pointCloud.points.filter(p => p.type === 'window').length : 0}
` : '无深度特征数据'}

🧠 **3D重建推理任务**：
基于前三步的识别结果，填充固定的3D重建模板。

📊 **前三步信息汇总**：
步骤1 - OCR: ${recognitionData.text ? '有文字' : '无文字'}
步骤2 - YOLO: ${recognitionData.objects?.length || 0}个对象
步骤3 - QwenVL: 视角=${viewType}, 类型=${recognitionData.enhanced?.building_type || 'unknown'}
步骤4 - 深度: ${recognitionData.depth?.pointCloud?.points?.length || 0}个点

🏗️ **3D重建固定模板**（必须填充所有参数）：

根据识别到的建筑类型(${recognitionData.enhanced?.building_type || 'mixed'})和视角(${viewType})，
使用以下标准值：

${ReconstructionTemplate.getBuildingStandards(recognitionData.enhanced?.building_type || 'mixed').standards ? 
  JSON.stringify(ReconstructionTemplate.getBuildingStandards(recognitionData.enhanced?.building_type || 'mixed').standards, null, 2) : ''}

返回精简的JSON格式（固定3D重建参数）：

{
  "buildings": [
    {
      "id": "B1",
      "building_type": "${recognitionData.enhanced?.building_type || 'mixed'}",
      
      // 核心尺寸（必填）
      "dimensions": {
        "length": "从平面图提取或使用默认值(mm)",
        "width": "从平面图提取或使用默认值(mm)",
        "height": "楼层数×层高(mm)"
      },
      
      // 楼层参数（必填）
      "floors": {
        "count": "根据建筑类型推理",
        "height": "标准层高(mm)",
        "first_floor_height": "首层高度(mm)"
      },
      
      // 立面参数（俯视图需推理）
      "facade": {
        "windows": {
          "type": "落地窗/标准窗/条窗",
          "size": {"width": 1800, "height": 1500},
          "spacing": {"horizontal": 3600, "vertical": "层高"}
        },
        "entrance": {
          "main": {"width": 3000, "height": 3000},
          "secondary": {"width": 1800, "height": 2400}
        },
        "materials": {
          "primary": "根据建筑类型选择",
          "coverage": "百分比"
        }
      },
      
      // 结构参数（标准化）
      "structure": {
        "column_grid": {"x": 8400, "y": 8400},
        "wall_thickness": {"exterior": 250, "interior": 100}
      }
    }
  ],
  
  // 推理说明
  "inference_report": {
    "view_type": "${viewType}",
    "building_type": "${recognitionData.enhanced?.building_type || 'mixed'}",
    "confidence": "基于视角和识别质量的置信度",
    "key_inferences": [
      "俯视图看不到高度，根据${recognitionData.enhanced?.building_type || 'mixed'}类型推理楼层数和高度",
      "使用标准层高、标准材质、标准窗户尺寸"
    ]
  }
}

🎯 **推理要求**：
1. 基于前三步的识别结果，填充固定的3D重建模板
2. 俯视图无法看到的参数（高度、楼层、材质），使用建筑类型的标准值
3. 使用毫米(mm)作为所有尺寸单位
4. 必须返回严格的JSON格式，不要有注释

核心推理原则：
- 俯视图 → 推理高度 = 楼层数 × 标准层高
- 建筑类型决定层高：住宅3000mm，办公4200mm，商业5000mm，工业10000mm
- 建筑类型决定材质：住宅涂料，办公玻璃幕墙，商业混合，工业金属板
- 建筑类型决定楼层：住宅6-33层，办公5-20层，商业2-6层，工业1-2层`;

    return prompt;
  }

  /**
   * 智能推理系统 - 根据视角类型和建筑类型进行全面推理
   */
  applyIntelligentInference(recognitionData, viewType, buildingType) {
    console.log('\n🧠 ========== 智能推理系统 ==========');
    console.log('视角类型:', viewType);
    console.log('建筑类型:', buildingType);
    
    const inference = {
      recognized: {},  // 直接识别到的信息
      inferred: {},    // 推理得出的信息
      confidence: {},  // 各项推理的置信度
      reasoning: [],   // 推理过程说明
      proportions: {}, // 比例推理
      spatial: {},     // 空间关系推理
      infrastructure: {} // 基础设施推理
    };

    // 建筑类型标准参数库
    const buildingStandards = {
      // 工厂建筑标准
      factory: {
        floor_height: { min: 6000, typical: 8000, max: 12000 },  // 层高6-12米
        floors: { min: 1, typical: 1, max: 3 },  // 通常1-3层
        structure: 'steel_frame',  // 钢结构
        facade: { primary: 'metal_panel', secondary: 'glass' },
        features: ['large_span', 'high_ceiling', 'cargo_doors', 'ventilation'],
        reasoning: '工厂建筑通常采用钢结构大跨度设计，层高6-12米便于设备安装'
      },
      warehouse: {
        floor_height: { min: 8000, typical: 10000, max: 15000 },
        floors: { min: 1, typical: 1, max: 2 },
        structure: 'steel_frame',
        facade: { primary: 'metal_panel', secondary: 'concrete' },
        features: ['loading_dock', 'large_doors', 'minimal_windows'],
        reasoning: '仓库需要大型货车进出，通常单层高大空间设计'
      },
      residential: {
        floor_height: { min: 2800, typical: 3000, max: 3300 },
        floors: { min: 6, typical: 18, max: 33 },
        structure: 'reinforced_concrete',
        facade: { primary: 'paint', secondary: 'tile' },
        features: ['balcony', 'regular_windows', 'unit_entrance'],
        reasoning: '住宅楼层高通常2.8-3.3米，满足居住舒适度要求'
      },
      office: {
        floor_height: { min: 3600, typical: 4200, max: 4800 },
        floors: { min: 5, typical: 20, max: 50 },
        structure: 'reinforced_concrete',
        facade: { primary: 'glass_curtain', secondary: 'aluminum' },
        features: ['curtain_wall', 'core_tube', 'standard_floor'],
        reasoning: '办公楼需要良好采光和通风，层高3.6-4.8米适合办公空间'
      },
      commercial: {
        floor_height: { min: 4500, typical: 5500, max: 6500 },
        floors: { min: 2, typical: 5, max: 10 },
        structure: 'reinforced_concrete',
        facade: { primary: 'glass', secondary: 'led_screen' },
        features: ['large_windows', 'signage', 'entrance_canopy'],
        reasoning: '商业建筑首层通常较高，便于商业展示和人流通行'
      }
    };

    // 根据视角类型进行推理
    switch(viewType) {
      case 'plan_view':
      case 'aerial_view':
        inference.reasoning.push('📐 俯视图/航拍图分析模式');
        
        // 俯视图能识别的信息
        inference.recognized = {
          building_footprint: true,
          building_count: true,
          site_layout: true,
          road_system: true,
          parking_areas: true
        };
        
        // 俯视图需要推理的信息
        if (buildingType in buildingStandards) {
          const standard = buildingStandards[buildingType];
          
          // 推理楼层数
          inference.inferred.floors = standard.typical;
          inference.confidence.floors = 0.7;
          inference.reasoning.push(
            `⚡ 俯视图无法直接看到楼层数，基于${buildingType}类型建筑标准，推理为${standard.typical}层`
          );
          
          // 推理层高
          inference.inferred.floor_height = standard.floor_height.typical;
          inference.confidence.floor_height = 0.8;
          inference.reasoning.push(
            `⚡ 根据${buildingType}建筑规范，推理标准层高为${standard.floor_height.typical/1000}米`
          );
          
          // 推理总高度
          inference.inferred.total_height = standard.typical * standard.floor_height.typical;
          inference.confidence.total_height = 0.6;
          inference.reasoning.push(
            `⚡ 推理总高度 = ${standard.typical}层 × ${standard.floor_height.typical/1000}米 = ${(standard.typical * standard.floor_height.typical/1000).toFixed(1)}米`
          );
          
          // 推理材质
          inference.inferred.materials = standard.facade;
          inference.confidence.materials = 0.75;
          inference.reasoning.push(
            `⚡ ${buildingType}建筑通常使用${standard.facade.primary}作为主要立面材料`
          );
          
          // 添加标准说明
          inference.reasoning.push(`📚 ${standard.reasoning}`);
        }
        break;
        
      case 'elevation_view':
        inference.reasoning.push('🏢 立面图分析模式');
        
        // 立面图能识别的信息
        inference.recognized = {
          floor_count: true,
          window_pattern: true,
          facade_materials: true,
          building_height: true,
          entrance_location: true
        };
        
        // 立面图需要推理的信息
        inference.inferred.building_depth = 15000;  // 标准进深15米
        inference.confidence.building_depth = 0.6;
        inference.reasoning.push('⚡ 立面图只显示一个面，推理标准进深为15米');
        
        // 如果是多层建筑，从窗户推算楼层
        const windowRows = recognitionData.depth?.features?.patterns?.windowGrid?.rows;
        if (windowRows) {
          inference.recognized.floor_count_from_windows = windowRows;
          inference.reasoning.push(`✅ 从窗户排列识别到${windowRows}层`);
        }
        break;
        
      case 'perspective_view':
        inference.reasoning.push('🎨 透视图分析模式');
        
        // 透视图能识别的信息
        inference.recognized = {
          volume_relationship: true,
          partial_floors: true,
          architectural_style: true,
          material_texture: true
        };
        
        // 使用透视关系推理尺寸
        inference.inferred.depth_from_perspective = true;
        inference.confidence.depth = 0.7;
        inference.reasoning.push('⚡ 根据透视消失点推算建筑进深');
        break;
        
      case 'axonometric_view':
        inference.reasoning.push('📊 轴测图分析模式');
        
        // 轴测图能识别的信息
        inference.recognized = {
          three_dimensions: true,
          accurate_proportions: true,
          floor_count: true
        };
        inference.confidence.overall = 0.9;
        inference.reasoning.push('✅ 轴测图提供准确的三维信息');
        break;
        
      default:
        inference.reasoning.push('⚠️ 未知视角类型，使用通用推理');
    }

    // 特殊情况处理
    if (viewType === 'plan_view' && buildingType === 'factory') {
      inference.reasoning.push(
        '🏭 工厂俯视图特殊处理：',
        '- 工厂通常为单层大跨度结构',
        '- 如需多层请提供立面图或说明具体楼层需求',
        '- 当前按单层8米高标准厂房处理'
      );
    }
    
    // 推理建筑比例关系
    this.inferBuildingProportions(inference, recognitionData, viewType, buildingType);
    
    // 推理空间关系
    this.inferSpatialRelationships(inference, recognitionData, viewType);
    
    // 推理基础设施
    this.inferInfrastructure(inference, recognitionData, buildingType);

    // 综合置信度评估
    const confidenceValues = Object.values(inference.confidence);
    inference.overall_confidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : 0.5;

    // 生成推理报告
    inference.report = {
      view_type: viewType,
      building_type: buildingType,
      can_generate_3d: inference.overall_confidence > 0.5,
      limitations: this.getViewLimitations(viewType),
      recommendations: this.getRecommendations(viewType, buildingType),
      recognized_count: Object.keys(inference.recognized).length,
      inferred_count: Object.keys(inference.inferred).length
    };

    console.log('📊 识别项数:', inference.report.recognized_count);
    console.log('🔮 推理项数:', inference.report.inferred_count);
    console.log('💯 综合置信度:', (inference.overall_confidence * 100).toFixed(1) + '%');
    console.log('推理过程:', inference.reasoning.join('\n'));
    console.log('=========================================\n');

    return inference;
  }

  /**
   * 获取视角限制说明
   */
  getViewLimitations(viewType) {
    const limitations = {
      plan_view: [
        '无法准确判断建筑高度和楼层数',
        '立面材质和细节不可见',
        '需要基于建筑类型推理垂直信息'
      ],
      elevation_view: [
        '只能看到单个立面',
        '建筑进深需要推理',
        '无法判断建筑群布局'
      ],
      perspective_view: [
        '尺寸判断依赖参照物',
        '远处细节可能不清晰',
        '可能存在视角遮挡'
      ],
      aerial_view: [
        '高空视角细节损失',
        '楼层数判断困难',
        '立面细节不可见'
      ]
    };
    return limitations[viewType] || ['视角类型未知'];
  }

  /**
   * 获取改进建议
   */
  getRecommendations(viewType, buildingType) {
    const recommendations = [];
    
    if (viewType === 'plan_view') {
      recommendations.push(
        '建议补充立面图以准确确定楼层数',
        '或在描述中说明期望的楼层数'
      );
    }
    
    if (viewType === 'elevation_view') {
      recommendations.push(
        '建议补充平面图以了解建筑群整体布局'
      );
    }
    
    if (buildingType === 'factory' && viewType !== 'elevation_view') {
      recommendations.push(
        '工厂建筑建议提供剖面图以显示内部空间高度'
      );
    }
    
    return recommendations;
  }
  
  /**
   * 推理建筑比例关系
   */
  inferBuildingProportions(inference, recognitionData, viewType, buildingType) {
    console.log('  📏 推理建筑比例...');
    
    // 基于建筑类型的标准比例
    const standardProportions = {
      factory: {
        width_depth_ratio: 1.5,  // 宽深比 1.5:1
        span_module: 6000,       // 6米柱距模数
        bay_module: 8000,        // 8米开间模数
        reasoning: '工厂建筑采用标准柱网，便于设备布置'
      },
      residential: {
        width_depth_ratio: 2.0,  // 宽深比 2:1
        unit_width: 3600,        // 3.6米开间
        unit_depth: 5400,        // 5.4米进深
        reasoning: '住宅建筑考虑采光通风，进深不宜过大'
      },
      office: {
        width_depth_ratio: 1.8,
        grid_module: 8400,       // 8.4米标准柱网
        core_size: 0.2,          // 核心筒占比20%
        reasoning: '办公楼采用标准柱网，便于灵活分隔'
      }
    };
    
    // 如果能识别到建筑轮廓，推算比例
    const buildings = recognitionData.enhanced?.buildings || [];
    if (buildings.length > 0) {
      // 推理多建筑之间的比例关系
      if (buildings.length > 1) {
        inference.proportions.building_relationships = [];
        
        for (let i = 0; i < buildings.length - 1; i++) {
          for (let j = i + 1; j < buildings.length; j++) {
            const relation = {
              from: buildings[i].id || `B${i+1}`,
              to: buildings[j].id || `B${j+1}`,
              size_ratio: 1.0,  // 默认相等
              height_ratio: 1.0
            };
            
            // 基于建筑类型推理大小关系
            if (buildings[i].building_type === 'main' && buildings[j].building_type === 'auxiliary') {
              relation.size_ratio = 2.0;  // 主楼是附属楼的2倍
              relation.height_ratio = 1.5;
              inference.reasoning.push(`⚡ 主楼${relation.from}推理为附属楼${relation.to}的2倍大`);
            }
            
            inference.proportions.building_relationships.push(relation);
          }
        }
      }
      
      // 基于视角推理单体建筑比例
      const standard = standardProportions[buildingType];
      if (standard) {
        inference.proportions.width_depth_ratio = standard.width_depth_ratio;
        inference.proportions.module_system = {
          horizontal: standard.span_module || standard.grid_module || standard.unit_width,
          vertical: standard.bay_module || standard.unit_depth,
          reasoning: standard.reasoning
        };
        
        inference.confidence.proportions = 0.75;
        inference.reasoning.push(`📐 采用${buildingType}建筑标准比例系统`);
      }
    }
    
    // 如果是俯视图，使用黄金比例作为默认
    if (viewType === 'plan_view' && !inference.proportions.width_depth_ratio) {
      inference.proportions.width_depth_ratio = 1.618;  // 黄金比例
      inference.confidence.proportions = 0.6;
      inference.reasoning.push('⚡ 使用黄金比例作为建筑长宽比');
    }
  }
  
  /**
   * 推理空间关系
   */
  inferSpatialRelationships(inference, recognitionData, viewType) {
    console.log('  🗺️ 推理空间关系...');
    
    const buildings = recognitionData.enhanced?.buildings || [];
    
    if (buildings.length > 1) {
      inference.spatial = {
        layout_type: 'unknown',
        orientation: 'south',  // 默认南向
        spacing_rules: [],
        circulation: []
      };
      
      // 分析建筑布局模式
      if (buildings.length === 2) {
        inference.spatial.layout_type = 'parallel';  // 并列式
        inference.spatial.spacing_rules.push({
          type: 'minimum_distance',
          value: 13000,  // 13米最小间距（防火要求）
          reasoning: '满足防火间距要求'
        });
      } else if (buildings.length === 3) {
        inference.spatial.layout_type = 'L_shape';  // L型
      } else if (buildings.length === 4) {
        inference.spatial.layout_type = 'courtyard';  // 围合式
        inference.spatial.circulation.push({
          type: 'central_courtyard',
          size: { width: 30000, depth: 20000 },
          reasoning: '中央庭院提供共享空间'
        });
      } else {
        inference.spatial.layout_type = 'scattered';  // 散点式
      }
      
      // 推理朝向
      if (viewType === 'plan_view') {
        inference.spatial.orientation = 'south';  // 默认南向（北半球）
        inference.reasoning.push('⚡ 推理建筑朝南（北半球最佳朝向）');
      }
      
      // 推理建筑间距
      const buildingType = buildings[0].building_type;
      if (buildingType === 'residential') {
        inference.spatial.spacing_rules.push({
          type: 'sunlight_spacing',
          value: 18000,  // 1.2倍楼高
          reasoning: '满足日照间距要求（1.2H）'
        });
      }
      
      inference.confidence.spatial = 0.7;
      inference.reasoning.push(`🗺️ 识别为${inference.spatial.layout_type}布局`);
    }
  }
  
  /**
   * 推理基础设施
   */
  inferInfrastructure(inference, recognitionData, buildingType) {
    console.log('  🚧 推理基础设施...');
    
    inference.infrastructure = {
      roads: [],
      parking: {},
      landscape: [],
      utilities: {}
    };
    
    // 推理道路系统
    inference.infrastructure.roads.push({
      type: 'main_entrance_road',
      width: 7000,  // 7米主入口道路
      connection: 'south',  // 默认南侧接市政道路
      inferred: true,
      confidence: 0.8,
      reasoning: '主入口道路连接市政道路'
    });
    
    // 根据建筑类型推理停车需求
    const parkingStandards = {
      residential: { ratio: 0.8, type: 'underground' },  // 0.8车位/户
      office: { ratio: 1.0, type: 'surface_and_underground' },  // 1车位/100㎡
      commercial: { ratio: 1.2, type: 'underground' },
      factory: { ratio: 0.3, type: 'surface' }  // 地面停车
    };
    
    const standard = parkingStandards[buildingType];
    if (standard) {
      inference.infrastructure.parking = {
        type: standard.type,
        estimated_spaces: 50,  // 基础估算
        ratio: standard.ratio,
        inferred: true,
        confidence: 0.7,
        reasoning: `${buildingType}建筑标准停车配比`
      };
    }
    
    // 推理景观绿化
    inference.infrastructure.landscape.push({
      type: 'entrance_plaza',
      area: 500,  // 500平米入口广场
      location: 'main_entrance',
      inferred: true,
      confidence: 0.75
    });
    
    if (buildingType === 'residential') {
      inference.infrastructure.landscape.push({
        type: 'central_garden',
        area: 2000,
        greenery_rate: 0.35,  // 35%绿地率
        inferred: true,
        confidence: 0.8,
        reasoning: '住宅区标准绿地率要求'
      });
    }
    
    // 推理配套设施
    inference.infrastructure.utilities = {
      substation: { location: 'northeast', inferred: true },  // 配电房
      pump_room: { location: 'basement', inferred: true },    // 水泵房
      garbage_station: { location: 'northwest', inferred: true }  // 垃圾站
    };
    
    // 推理围墙和大门
    inference.infrastructure.fence = {
      type: buildingType === 'factory' ? 'wall' : 'railing',
      height: buildingType === 'factory' ? 2500 : 1800,
      gates: [
        {
          type: 'main_gate',
          width: 8000,
          location: 'south',
          inferred: true
        },
        {
          type: 'side_gate', 
          width: 4000,
          location: 'east',
          inferred: true
        }
      ],
      inferred: true,
      confidence: 0.8,
      reasoning: '标准围墙和出入口配置'
    };
    
    inference.confidence.infrastructure = 0.75;
    inference.reasoning.push('🚧 基于建筑类型推理基础设施配置');
  }

  /**
   * 处理单栋建筑的参数（兼容旧逻辑）
   */
  normalizeSingleBuildingParams(params) {
    // 如果是建筑群但只有一栋，提取单栋数据
    if (params.buildings && params.buildings.length === 1) {
      const building = params.buildings[0];
      return {
        building_type: building.building_type,
        floors: building.floors,
        dimensions: building.dimensions,
        walls: building.walls || [],
        rooms: building.rooms || [],
        materials: building.materials || {
          primary: "concrete",
          facade: "glass_curtain"
        },
        features: building.features || {
          has_balcony: false,
          has_curved_wall: false,
          has_roof_garden: false
        },
        special_elements: building.special_elements || []
      };
    }
    
    // 否则返回原参数
    return params;
  }

  /**
   * 处理对话式修改（支持会话上下文）
   */
  async processModification(currentModel, userCommand, sessionId) {
    console.log('\n========== 对话式修改 ==========');
    console.log('用户指令:', userCommand);
    console.log('会话ID:', sessionId);
    
    // 获取会话历史
    const sessionData = this.getSessionData(sessionId);
    const history = sessionData ? sessionData.history || [] : [];
    
    // 构建包含历史的prompt
    const prompt = '你是一个3D建模助手。用户想要修改现有的3D建筑模型。\n\n' +
      '会话历史:\n' +
      history.slice(-3).map(h => '- ' + h.command + ': ' + h.summary).join('\n') + '\n\n' +
      '当前模型参数：\n' +
      JSON.stringify(currentModel, null, 2) + '\n\n' +
      '用户指令：\n' +
      '"' + userCommand + '"\n\n' +
      '请理解用户意图，返回修改后的参数（JSON格式）。只修改相关部分，保持其他参数不变。\n\n' +
      '示例理解：\n' +
      '- "改成5层" → 修改floors.count为5\n' +
      '- "加个阳台" → features.has_balcony设为true\n' +
      '- "改成玻璃幕墙" → materials.facade改为"glass_curtain"\n' +
      '- "东侧加曲面" → 在walls中添加曲面墙体\n' +
      '- "加宽2米" → dimensions.width增加2000\n\n' +
      '返回完整的修改后JSON参数。';

    try {
      // 调用vLLM
      const response = await axios.post(
        this.services.vllm.endpoint,
        {
          model: this.services.vllm.model,
          prompt: prompt,
          max_tokens: 2048,
          temperature: 0  // 使用0获得确定性结果
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.services.vllm.apiKey ? 'Bearer ' + this.services.vllm.apiKey : undefined
          },
          timeout: this.services.vllm.timeout
        }
      );
      
      const modifiedParams = JSON.parse(response.data.choices[0].text);
      
      // 计算变化
      const changes = this.detectChanges(currentModel, modifiedParams);
      const changeMessage = this.generateChangeMessage(changes);
      
      // 更新会话历史
      if (sessionId) {
        this.updateSessionHistory(sessionId, {
          command: userCommand,
          changes: changes,
          summary: changeMessage,
          timestamp: Date.now()
        });
      }
      
      return {
        success: true,
        sessionId: sessionId,
        modified: modifiedParams,
        changes: changes,
        message: changeMessage
      };
      
    } catch (error) {
      // 不允许降级，直接抛出错误
      console.error('❌ AI推理失败，不使用规则引擎');
      throw error;
    }
  }

  /**
   * 验证和优化参数（vLLM已完成推理）
   */
  validateAndOptimize(params) {
    console.log('🔧 验证参数前:', JSON.stringify(params.floors));
    
    // vLLM已经完成了所有推理工作
    // 这里只需要确保参数格式正确
    
    // 如果vLLM返回了inference_report，处理视角相关的生成策略
    if (params.inference_report) {
      const viewType = params.inference_report.view_type;
      console.log('📊 应用vLLM推理结果...');
      console.log('  • 视角类型:', viewType);
      console.log('  • 推理置信度:', params.inference_report.confidence);
      
      // 如果是俯视图且vLLM标记为简化模式
      if ((viewType === 'plan_view' || viewType === 'aerial_view' || viewType === '俯视图') 
          && !params.simplified_mode) {
        console.log('  📐 应用俯视图简化体块模式');
        params.simplified_mode = true;
        if (!params.generation_note) {
          params.generation_note = 'vLLM推理：基于俯视图生成的简化体块模型';
        }
      }
    }
    
    // 确保必要字段
    // 处理floors字段：可能是数字、对象或不存在
    if (!params.floors || typeof params.floors === 'number') {
      const floorCount = typeof params.floors === 'number' ? params.floors : 1;
      params.floors = { 
        count: floorCount, 
        height: 3300,
        heights: [] // 每层高度数组
      };
    } else if (typeof params.floors === 'object') {
      // 确保对象有必需的字段
      // 重要：不要随意重置为1！
      if (params.floors.count === undefined || params.floors.count === null) {
        console.warn('⚠️ floors.count为undefined，设置为默认值1');
        params.floors.count = 1;
      } else if (typeof params.floors.count !== 'number') {
        // 尝试转换为数字
        params.floors.count = Number(params.floors.count) || 1;
      }
      if (!params.floors.height || typeof params.floors.height !== 'number') {
        params.floors.height = 3300;
      }
      if (!params.floors.heights) {
        params.floors.heights = [];
      }
    }
    
    if (!params.dimensions) {
      params.dimensions = {
        width: 10000,
        depth: 8000,
        height: params.floors.count * params.floors.height
      };
    }
    
    // 验证数值合理性
    // 确保count是整数
    params.floors.count = Math.floor(Number(params.floors.count) || 1);
    if (params.floors.count < 1) params.floors.count = 1;
    if (params.floors.count > 100) params.floors.count = 100;
    
    // 确保height是数字
    params.floors.height = Number(params.floors.height) || 3300;
    if (params.floors.height < 2200) params.floors.height = 2200;
    if (params.floors.height > 6000) params.floors.height = 6000;
    
    // 确保墙体闭合
    if (params.walls && params.walls.length > 0) {
      this.ensureWallClosure(params.walls);
    }
    
    return params;
  }

  /**
   * 确保墙体闭合
   */
  ensureWallClosure(walls) {
    if (walls.length < 2) return;
    
    const firstWall = walls[0];
    const lastWall = walls[walls.length - 1];
    
    // 计算距离
    const dx = lastWall.end.x - firstWall.start.x;
    const dy = lastWall.end.y - firstWall.start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 如果不闭合，添加连接墙
    if (distance > 100) {
      walls.push({
        id: 'wall_closing',
        type: 'external',
        start: lastWall.end,
        end: firstWall.start,
        thickness: 240
      });
    }
  }

  /**
   * 检测变化
   */
  detectChanges(original, modified) {
    const changes = [];
    
    // 检测楼层变化
    if (original.floors?.count !== modified.floors?.count) {
      changes.push({
        type: 'floors',
        from: original.floors.count,
        to: modified.floors.count
      });
    }
    
    // 检测材质变化
    if (original.materials?.facade !== modified.materials?.facade) {
      changes.push({
        type: 'material',
        from: original.materials.facade,
        to: modified.materials.facade
      });
    }
    
    // 检测特征变化
    for (let feature in modified.features) {
      if (original.features?.[feature] !== modified.features[feature]) {
        changes.push({
          type: 'feature',
          name: feature,
          value: modified.features[feature]
        });
      }
    }
    
    return changes;
  }

  /**
   * 生成变化消息
   */
  generateChangeMessage(changes) {
    if (changes.length === 0) {
      return '没有检测到变化';
    }
    
    const messages = changes.map(change => {
      switch (change.type) {
        case 'floors':
          return '楼层从' + change.from + '层改为' + change.to + '层';
        case 'material':
          return '材质从' + change.from + '改为' + change.to;
        case 'feature':
          return change.name + ': ' + change.value;
        default:
          return JSON.stringify(change);
      }
    });
    
    return messages.join(', ');
  }


  /**
   * 计算置信度
   */
  calculateConfidence(recognition, modeling) {
    let score = 0;
    let factors = 0;
    
    // 有文字识别
    if (recognition.text) {
      score += 0.3;
      factors += 0.3;
    }
    
    // 有对象识别
    if (recognition.objects && recognition.objects.length > 0) {
      score += 0.3;
      factors += 0.3;
    }
    
    // 有墙体数据
    if (modeling.walls && modeling.walls.length > 3) {
      score += 0.2;
      factors += 0.2;
    }
    
    // 有房间数据
    if (modeling.rooms && modeling.rooms.length > 0) {
      score += 0.2;
      factors += 0.2;
    }
    
    return factors > 0 ? score / factors : 0.5;
  }

  /**
   * 智能聊天处理
   */
  async processChat(message, sessionId) {
    console.log('\n💬 处理聊天消息:', message);
    
    // 获取会话上下文
    const sessionData = this.getSessionData(sessionId);
    
    // 构建智能对话prompt
    const prompt = '你是一个建筑设计AI助手。请根据用户的问题提供专业的建议。\n\n' +
      '当前模型信息:\n' +
      (sessionData ? JSON.stringify(sessionData.modeling, null, 2) : '无') + '\n\n' +
      '用户问题: ' + message + '\n\n' +
      '请提供专业、实用的建议。';
    
    try {
      const response = await axios.post(
        this.services.vllm.endpoint,
        {
          model: this.services.vllm.model,
          prompt: prompt,
          max_tokens: 1024,
          temperature: 0.7
        },
        {
          timeout: this.services.vllm.timeout
        }
      );
      
      const reply = response.data.choices[0].text;
      
      return {
        success: true,
        sessionId: sessionId,
        reply: reply
      };
      
    } catch (error) {
      return {
        success: false,
        error: '聊天服务暂时不可用',
        reply: '抱歉，我暂时无法回答您的问题。'
      };
    }
  }
  
  /**
   * 批量处理多张图片
   */
  async processBatch(images, options = {}) {
    console.log('\n📦 批量处理 ' + images.length + ' 张图片');
    
    const results = [];
    const batchId = 'batch_' + Date.now();
    
    for (let i = 0; i < images.length; i++) {
      console.log('\n处理第 ' + (i + 1) + '/' + images.length + ' 张...');
      
      const result = await this.processSketchTo3D(images[i], {
        ...options,
        sessionId: batchId + '_' + i
      });
      
      results.push({
        index: i,
        success: result.success,
        data: result.success ? result.modeling : null,
        error: result.error || null
      });
      
      // 避免过载，添加短暂延迟
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      batchId: batchId,
      total: images.length,
      successful: successCount,
      failed: images.length - successCount,
      results: results
    };
  }

  /**
   * 转换透视分析结果为插件期望的格式
   * 将新的分析格式转换为旧的建模数据格式
   */
  convertToPluginFormat(perspectiveData) {
    console.log('\n🔄 转换数据格式为插件兼容格式...');
    
    // 确保有数据
    if (!perspectiveData || !perspectiveData.reconstruction) {
      console.log('  ⚠️ 无有效重建数据，返回默认值');
      return this.getDefaultModelingData();
    }
    
    const { analysis, reconstruction } = perspectiveData;
    
    // 引入建筑群分析器 - 动态判断建筑结构类型
    const buildingGroupAnalyzer = require('./buildingGroupAnalyzer');
    
    // 分析建筑群结构类型
    const groupAnalysis = buildingGroupAnalyzer.analyzeEnclosedBuilding(
      analysis,
      analysis?.pointCloud?.features?.pointCloud?.points
    );
    
    console.log(`  🏢 建筑类型: ${groupAnalysis.type}`);
    
    // 检查是否有多建筑（但现在要区分是围合式还是分离式）
    const hasMultipleBuildings = analysis?.volumes?.length > 1 || analysis?.building_count > 1;
    const isEnclosedComplex = groupAnalysis.type === 'ENCLOSED_COMPLEX';
    
    // 添加调试日志
    console.log('\n  🔍 调试信息:');
    console.log(`    - analysis存在?: ${!!analysis}`);
    console.log(`    - analysis.volumes存在?: ${!!analysis?.volumes}`);
    console.log(`    - analysis.volumes长度: ${analysis?.volumes?.length || 0}`);
    console.log(`    - analysis.building_count: ${analysis?.building_count || 'undefined'}`);
    console.log(`    - hasMultipleBuildings: ${hasMultipleBuildings}`);
    console.log(`    - isEnclosedComplex: ${isEnclosedComplex}`);
    
    if (analysis?.volumes) {
      console.log(`    - 体块详情:`);
      analysis.volumes.forEach((v, i) => {
        console.log(`      ${i+1}. ${v.id || v.name}: ${v.floors || 1}层, 类型:${v.type}`);
      });
    }
    
    // 构建插件期望的数据结构
    const modelingData = {
      modeling: {
        // 视角信息（重要！）
        view_type: analysis?.view_type || 'perspective',
        viewing_angle: analysis?.viewing_angle || '正视角',
        light_direction: analysis?.light_direction || '左上',
        
        // 多建筑信息
        building_count: analysis?.building_count || 1,
        is_building_group: hasMultipleBuildings,
        buildings: [],  // 将在下面填充
        
        // 楼层信息（整体或第一栋）
        floors: {
          count: reconstruction.floors || analysis?.volumes?.[0]?.floors || 1,
          height: reconstruction.floor_height || 3300,  // 默认3.3米层高
          total_height: (reconstruction.floors || analysis?.volumes?.[0]?.floors || 1) * (reconstruction.floor_height || 3300)
        },
        
        // 建筑尺寸（毫米）
        dimensions: {
          width: reconstruction.dimensions?.width || 20000,    // 宽度（X轴）
          depth: reconstruction.dimensions?.depth || 15000,    // 深度（Y轴）
          height: reconstruction.dimensions?.height || 
                  ((reconstruction.floors || 1) * (reconstruction.floor_height || 3300))
        },
        
        // 墙体数据（如果是多建筑，稍后合并所有建筑的墙体）
        walls: [],  // 将在多建筑处理后填充
        
        // 体块数据（从volumes转换）
        volumes: this.convertVolumes(reconstruction.volumes || analysis?.volumes),
        
        // 建筑类型
        building_type: reconstruction.building_type || 'office',
        
        // 材质信息（Ruby插件需要）
        materials: {
          facade: '白模',  // 白模渲染，无材质
          walls: 'white',
          roof: 'white'
        },
        
        // 附加信息
        metadata: {
          confidence: perspectiveData.confidence || 0.8,
          analysis_type: 'perspective_sketch',
          features: reconstruction.features || [],
          spatial_relations: analysis?.spatial_relations || [],
          irregular_structures: analysis?.irregular_structures || []
        }
      }
    };
    
    // 根据建筑类型生成不同的结构
    if (isEnclosedComplex && groupAnalysis.mainStructure) {
      console.log('  🏗️ 生成围合式建筑群3D参数...');
      
      // 围合式建筑群 - 作为一个整体
      const complex = groupAnalysis.mainStructure;
      
      // 生成主体围合建筑
      const mainBuilding = {
        id: 'main_enclosure',
        name: complex.name || '围合式建筑群',
        type: 'ENCLOSED_COMPLEX',
        position: { x: 0, y: 0, z: 0 },
        dimensions: complex.outerDimensions,
        courtyard: complex.courtyard,
        floors: {
          count: Math.round(complex.outerDimensions.height / 3300),
          height: 3300,
          total_height: complex.outerDimensions.height
        },
        // 内部建筑块
        inner_blocks: complex.innerBuildings,
        connections: complex.connections,
        walls: [],
        features: ['围合式', '中庭', '连廊']
      };
      
      // 生成外围墙体
      mainBuilding.walls = this.generateEnclosedWalls(complex);
      
      modelingData.modeling.buildings.push(mainBuilding);
      modelingData.modeling.is_enclosed = true;
      modelingData.modeling.has_courtyard = true;
      modelingData.modeling.building_type = 'enclosed_complex';
      
      // 更新整体尺寸
      modelingData.modeling.dimensions = complex.outerDimensions;
      
      console.log(`  ✅ 围合建筑群生成完成:`);
      console.log(`     外围尺寸: ${complex.outerDimensions.width/1000}m × ${complex.outerDimensions.depth/1000}m × ${complex.outerDimensions.height/1000}m`);
      console.log(`     中庭尺寸: ${complex.courtyard.width/1000}m × ${complex.courtyard.depth/1000}m`);
      console.log(`     内部组团: ${complex.innerBuildings.length}个`);
      
    } else if (hasMultipleBuildings && analysis?.volumes) {
      console.log('  🏗️ 生成分离式建筑群3D参数...');
      console.log('  🎯 使用Phase 0工程化流水线：几何优先的透视恢复');
      
      // 不再依赖点云数据，直接使用QwenVL识别的体块
      const pointCloudContours = analysis?.pointCloud?.features?.pointCloud?.buildingContours || [];
      
      // 使用QwenVL识别的体块进行透视恢复
      analysis.volumes.forEach((volume, index) => {
        console.log(`\n  📐 处理建筑${index + 1}: ${volume.name || volume.id}`);
        
        // 获取点云轮廓（如果有）
        const contour = pointCloudContours[index];
        if (contour) {
            console.log(`  📐 建筑${index + 1}点云轮廓:`);
            console.log(`     边界: ${contour.boundingBox?.width}×${contour.boundingBox?.depth}×${contour.boundingBox?.height}`);
            console.log(`     中心: (${contour.centroid?.x}, ${contour.centroid?.y})`);
            console.log(`     点数: ${contour.pointCount}`);
            
            // 从QwenVL获取相对尺寸
            const visionWidth = parseFloat(volume.dimensions?.width) || 20;
            const visionDepth = parseFloat(volume.dimensions?.depth) || 15;
            const visionHeight = parseFloat(volume.dimensions?.height) || 10;
            
            console.log(`  👁️ QwenVL识别尺寸: 宽${visionWidth} × 深${visionDepth} × 高${visionHeight}`);
            
            // 从点云获取比例关系
            let widthRatio = 1.0;
            let depthRatio = 1.0;
            
            if (contour && contour.boundingBox) {
              // 点云的宽高比
              const boundingWidth = contour.boundingBox.width || 1;
              const boundingHeight = contour.boundingBox.height || 1;
              const boundingDepth = contour.boundingBox.depth || boundingHeight; // 2D图没有深度，用高度估算
              
              // 比例关系
              widthRatio = boundingWidth;
              depthRatio = boundingDepth;
              
              console.log(`     📐 点云比例: 宽:深 = ${widthRatio}:${depthRatio}`);
            }
            
            // 🎯 Phase 0: 两点透视几何恢复
            // 两点透视：有水平消失点VPx和深度消失点VPz
            // 建筑群排列通常沿着深度方向（z轴）
            
            // 从QwenVL分析获取透视信息
            const perspectiveInfo = analysis.perspective || {};
            const hasVanishingPoints = perspectiveInfo.vanishingPoints?.length > 0;
            
            // 计算相对深度（基于位置和大小）
            // 近处建筑：z_order小，看起来大
            // 远处建筑：z_order大，看起来小
            const relativeDepth = volume.position?.relative_depth || 
                                 volume.position?.z_order || 
                                 (index / analysis.volumes.length);
            
            // 🎯 关键：比例关系！不纠结绝对尺寸
            // 建筑群的相对比例才是最重要的
            
            // 基准单位（可以任意放大，比例对就行）
            const SCALE_FACTOR = 1000;  // 放大因子，让建筑看起来合理
            const referenceFloorHeight = 3200;  // 标准层高
            
            // visionWidth等变量已经在上面定义过了，直接使用
            
            // 根据建筑在画面中的位置，推算实际比例
            // 遮挡关系：前面的建筑遮挡后面的建筑
            // 建筑1（前）: 比例 1.0
            // 建筑2（中）: 比例 0.8  
            // 建筑3（后）: 比例 0.6
            const perspectiveRatio = 1.0 - (relativeDepth * 0.4);  // 深度越大，比例越小
            
            // 计算实际尺寸（保持相对比例）
            const actualWidth = visionWidth * SCALE_FACTOR * perspectiveRatio;
            const actualDepth = visionDepth * SCALE_FACTOR * perspectiveRatio;
            const floors = volume.floors || 1;
            const actualHeight = floors * referenceFloorHeight;
            
            console.log(`     🎯 两点透视恢复:`);
            console.log(`        - 相对深度: ${relativeDepth.toFixed(2)}`);
            console.log(`        - 透视比例: ${perspectiveRatio.toFixed(2)}`);
            console.log(`        - 视觉大小: 宽${visionWidth} × 深${visionDepth} × 高${visionHeight}`);
            console.log(`     🏗️ 恢复尺寸: ${(actualWidth/1000).toFixed(1)}m × ${(actualDepth/1000).toFixed(1)}m × ${(actualHeight/1000).toFixed(1)}m`);
            
            // 使用footprint（地面投影）方式定位
            // 两点透视中，建筑沿深度方向（z轴）排列
            const buildingSpacing = 8000;  // 建筑间距8米（符合防火规范）
            
            // 🏗️ 空间关系：建筑在3D空间中的真实位置
            // 空间 = X(左右) + Y(前后深度) + Z(高度)
            // 遮挡关系通过Y轴深度体现
            
            // 从QwenVL分析获取位置信息
            const relativeX = volume.position?.x || volume.position?.relative_x || 0.5;
            const relativeY = volume.position?.y || volume.position?.relative_y || 0.5;
            
            // 检测遮挡关系（基于spatial_relations）
            const hasOcclusion = analysis.spatial_relations?.some(r => 
              (r.from === volume.id || r.to === volume.id) && 
              (r.type === 'behind' || r.type === 'in_front_of')
            );
            
            // 判断建筑排列方式（基于相对位置）
            const isHorizontalLayout = Math.abs(relativeX - 0.5) > 0.2;  // 左右偏移大说明是横向排列
            const isDepthLayout = relativeDepth > 0.3;  // 深度差异大说明是前后排列
            
            // 计算真实地面坐标
            let groundX, groundY;
            
            if (isHorizontalLayout && !isDepthLayout) {
              // 主要是左右排列
              groundX = (relativeX - 0.5) * 60000;  // 左右最大偏移30米
              groundY = relativeDepth * 15000;      // 深度较小
            } else if (!isHorizontalLayout && isDepthLayout) {
              // 主要是前后排列
              groundX = (relativeX - 0.5) * 20000;  // 左右偏移较小
              groundY = relativeDepth * 30000;      // 深度较大
            } else {
              // 混合排列（斜向）
              groundX = (relativeX - 0.5) * 40000;  // 中等偏移
              groundY = relativeDepth * 25000;      // 中等深度
            }
            
            const building = {
              id: volume.id,
              name: volume.name || `建筑${index + 1}`,
              type: volume.type,
              // 两点透视的地面投影位置
              position: {
                x: groundX,      // 水平位置（可能有偏移）
                y: groundY,      // 深度位置（递增）
                z: 0            // 所有建筑底部对齐地面
              },
              // 恢复后的真实尺寸（每栋建筑独立）
              dimensions: {
                width: actualWidth,
                depth: actualDepth,
                height: actualHeight
              },
              // footprint（地面投影多边形）
              footprint_ground: [
                [groundX - actualWidth/2, groundY - actualDepth/2],
                [groundX + actualWidth/2, groundY - actualDepth/2],
                [groundX + actualWidth/2, groundY + actualDepth/2],
                [groundX - actualWidth/2, groundY + actualDepth/2]
              ],
              floors: {
                count: volume.floors || 3,
                height: 3300,
                total_height: (volume.floors || 3) * 3300
              },
              walls: [],
              windows: [],
              features: volume.features || [],
              // 保存点云信息
              pointCloudInfo: {
                pointCount: contour.pointCount,
                confidence: contour.confidence || 0.8
              }
            };
            
            // 生成墙体
            building.walls = this.generateWallsForBuilding(
              building.position.x,
              building.position.y,
              building.dimensions.width,
              building.dimensions.depth,
              building.dimensions.height,
              volume
            );
            
            modelingData.modeling.buildings.push(building);
            console.log(`    ✓ ${building.name}: ${(building.dimensions.width/1000).toFixed(1)}m × ${(building.dimensions.depth/1000).toFixed(1)}m × ${(building.dimensions.height/1000).toFixed(1)}m`);
            console.log(`       位置: (${(building.position.x/1000).toFixed(1)}, ${(building.position.y/1000).toFixed(1)}, ${(building.position.z/1000).toFixed(1)})m`);
        }  // 移除contour条件的结束括号
      });
      
      // 更新整体建模数据的尺寸（这是建筑群的包围盒，不是单个建筑的尺寸）
        if (modelingData.modeling.buildings.length > 0) {
          // 计算包围盒
          const minX = Math.min(...modelingData.modeling.buildings.map(b => b.position.x - b.dimensions.width/2));
          const maxX = Math.max(...modelingData.modeling.buildings.map(b => b.position.x + b.dimensions.width/2));
          const minY = Math.min(...modelingData.modeling.buildings.map(b => b.position.y - b.dimensions.depth/2));
          const maxY = Math.max(...modelingData.modeling.buildings.map(b => b.position.y + b.dimensions.depth/2));
          const maxHeight = Math.max(...modelingData.modeling.buildings.map(b => b.dimensions.height));
          
          // 这是整个建筑群的包围盒尺寸
          modelingData.modeling.bounding_box = {
            width: maxX - minX,
            depth: maxY - minY,
            height: maxHeight
          };
          
          // 第一栋建筑作为主建筑的参考尺寸（不是累加）
          const mainBuilding = modelingData.modeling.buildings[0];
          modelingData.modeling.dimensions = {
            width: mainBuilding.dimensions.width,      // 主建筑宽度
            depth: mainBuilding.dimensions.depth,      // 主建筑深度
            height: mainBuilding.dimensions.height     // 主建筑高度
          };
        }
      
      // 合并所有建筑的墙体到总墙体列表
      modelingData.modeling.walls = [];
      modelingData.modeling.buildings.forEach(building => {
        if (building.walls && building.walls.length > 0) {
          modelingData.modeling.walls.push(...building.walls);
        }
      });
      console.log(`    ✓ 总墙体数: ${modelingData.modeling.walls.length}面`);
    } else {
      // 单建筑情况，使用默认墙体
      modelingData.modeling.walls = this.extractWallsFromMesh(reconstruction.mesh);
    }
    
    console.log('  ✅ 数据格式转换完成');
    console.log('    - 建筑数量:', modelingData.modeling.building_count);
    console.log('    - 是否建筑群:', modelingData.modeling.is_building_group);
    console.log('    - 建筑详情数:', modelingData.modeling.buildings.length);
    console.log('    - 楼层数:', modelingData.modeling.floors.count);
    console.log('    - 建筑尺寸:', `${modelingData.modeling.dimensions.width/1000}m × ${modelingData.modeling.dimensions.depth/1000}m × ${modelingData.modeling.dimensions.height/1000}m`);
    console.log('    - 墙体数:', modelingData.modeling.walls.length);
    console.log('    - 体块数:', modelingData.modeling.volumes.length);
    
    return modelingData;
  }
  
  /**
   * 从mesh数据中提取墙体信息
   */
  extractWallsFromMesh(mesh) {
    if (!mesh || !mesh.faces) {
      return this.getDefaultWalls();
    }
    
    const walls = [];
    
    // 分析mesh faces，识别垂直面作为墙体
    mesh.faces.forEach((face, index) => {
      // 检查是否为垂直面（简化判断：检查法向量）
      if (this.isVerticalFace(face, mesh.vertices)) {
        walls.push({
          id: `wall_${index}`,
          points: face.map(vi => mesh.vertices[vi]),
          type: 'exterior',  // 简化：都作为外墙
          height: mesh.vertices[face[0]][2] || 3300
        });
      }
    });
    
    // 如果没有识别到墙体，返回默认墙体
    return walls.length > 0 ? walls : this.getDefaultWalls();
  }
  
  /**
   * 判断是否为垂直面
   */
  isVerticalFace(face, vertices) {
    if (!face || face.length < 3) return false;
    
    // 获取面的前三个顶点
    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];
    
    // 计算法向量（简化计算）
    const edge1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
    const edge2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
    
    // 叉积得到法向量
    const normal = [
      edge1[1]*edge2[2] - edge1[2]*edge2[1],
      edge1[2]*edge2[0] - edge1[0]*edge2[2],
      edge1[0]*edge2[1] - edge1[1]*edge2[0]
    ];
    
    // 归一化
    const len = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
    if (len > 0) {
      normal[0] /= len;
      normal[1] /= len;
      normal[2] /= len;
    }
    
    // 如果法向量的z分量接近0，说明是垂直面
    return Math.abs(normal[2]) < 0.3;
  }
  
  /**
   * 转换体块数据
   */
  convertVolumes(volumes) {
    if (!volumes || volumes.length === 0) {
      return [{
        id: 'main',
        type: 'main_building',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 20000, depth: 15000, height: 10000 }
      }];
    }
    
    return volumes.map((vol, index) => ({
      id: vol.id || `volume_${index}`,
      type: vol.type || 'main_building',
      position: {
        x: (vol.position?.relative_x || 0.5) * 20000 - 10000,
        y: (vol.position?.relative_y || 0.5) * 15000 - 7500,
        z: 0
      },
      dimensions: {
        width: typeof vol.dimensions?.width === 'string' 
          ? parseInt(vol.dimensions.width.replace(/[^\d.]/g, '') || '10') * 1000
          : (vol.dimensions?.width || 10) * (vol.dimensions?.width < 100 ? 1000 : 1),
        depth: typeof vol.dimensions?.depth === 'string'
          ? parseInt(vol.dimensions.depth.replace(/[^\d.]/g, '') || '8') * 1000  
          : (vol.dimensions?.depth || 8) * (vol.dimensions?.depth < 100 ? 1000 : 1),
        height: typeof vol.dimensions?.height === 'string'
          ? parseInt(vol.dimensions.height.replace(/[^\d.]/g, '') || '10') * 1000
          : (vol.dimensions?.height || 10) * (vol.dimensions?.height < 100 ? 1000 : 1)
      },
      features: vol.features || []
    }));
  }
  
  /**
   * 获取默认墙体数据
   */
  getDefaultWalls() {
    return [
      {
        id: 'wall_0',
        points: [[0,0,0], [20000,0,0], [20000,0,10000], [0,0,10000]],
        type: 'exterior',
        height: 10000
      },
      {
        id: 'wall_1',
        points: [[20000,0,0], [20000,15000,0], [20000,15000,10000], [20000,0,10000]],
        type: 'exterior',
        height: 10000
      },
      {
        id: 'wall_2',
        points: [[20000,15000,0], [0,15000,0], [0,15000,10000], [20000,15000,10000]],
        type: 'exterior',
        height: 10000
      },
      {
        id: 'wall_3',
        points: [[0,15000,0], [0,0,0], [0,0,10000], [0,15000,10000]],
        type: 'exterior',
        height: 10000
      }
    ];
  }
  
  /**
   * 获取默认建模数据
   */
  getDefaultModelingData() {
    return {
      modeling: {
        floors: { count: 3, height: 3300, total_height: 9900 },
        dimensions: { length: 20000, width: 15000, height: 9900 },
        walls: this.getDefaultWalls(),
        volumes: [{
          id: 'main',
          type: 'main_building',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { length: 20000, width: 15000, height: 9900 }
        }],
        building_type: 'office',
        metadata: {
          confidence: 0.5,
          analysis_type: 'default',
          features: [],
          spatial_relations: [],
          irregular_structures: []
        }
      }
    };
  }

  /**
   * 为单个建筑生成墙体（支持复杂形态）
   */
  /**
   * 生成围合式建筑的墙体
   */
  generateEnclosedWalls(complex) {
    const walls = [];
    const { outerDimensions, courtyard } = complex;
    
    // 外围墙体
    const outerHalfWidth = outerDimensions.width / 2;
    const outerHalfDepth = outerDimensions.depth / 2;
    
    // 内院尺寸
    const innerHalfWidth = courtyard.width / 2;
    const innerHalfDepth = courtyard.depth / 2;
    
    // 生成围合的外墙（带中空）
    // 前墙（带开口）
    walls.push({
      id: 'wall_front_left',
      type: 'exterior',
      points: [
        [-outerHalfWidth, -outerHalfDepth, 0],
        [-outerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [-innerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [-innerHalfWidth, -outerHalfDepth, 0]
      ]
    });
    
    walls.push({
      id: 'wall_front_right',
      type: 'exterior',
      points: [
        [innerHalfWidth, -outerHalfDepth, 0],
        [innerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, -outerHalfDepth, 0]
      ]
    });
    
    // 后墙（完整）
    walls.push({
      id: 'wall_back',
      type: 'exterior',
      points: [
        [-outerHalfWidth, outerHalfDepth, 0],
        [-outerHalfWidth, outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, outerHalfDepth, 0]
      ]
    });
    
    // 左墙
    walls.push({
      id: 'wall_left',
      type: 'exterior',
      points: [
        [-outerHalfWidth, -outerHalfDepth, 0],
        [-outerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [-outerHalfWidth, outerHalfDepth, outerDimensions.height],
        [-outerHalfWidth, outerHalfDepth, 0]
      ]
    });
    
    // 右墙
    walls.push({
      id: 'wall_right',
      type: 'exterior',
      points: [
        [outerHalfWidth, -outerHalfDepth, 0],
        [outerHalfWidth, -outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, outerHalfDepth, outerDimensions.height],
        [outerHalfWidth, outerHalfDepth, 0]
      ]
    });
    
    // 内院墙体
    walls.push({
      id: 'wall_courtyard_left',
      type: 'interior',
      points: [
        [-innerHalfWidth, -innerHalfDepth, 0],
        [-innerHalfWidth, -innerHalfDepth, outerDimensions.height],
        [-innerHalfWidth, innerHalfDepth, outerDimensions.height],
        [-innerHalfWidth, innerHalfDepth, 0]
      ]
    });
    
    walls.push({
      id: 'wall_courtyard_right',
      type: 'interior',
      points: [
        [innerHalfWidth, -innerHalfDepth, 0],
        [innerHalfWidth, -innerHalfDepth, outerDimensions.height],
        [innerHalfWidth, innerHalfDepth, outerDimensions.height],
        [innerHalfWidth, innerHalfDepth, 0]
      ]
    });
    
    walls.push({
      id: 'wall_courtyard_back',
      type: 'interior',
      points: [
        [-innerHalfWidth, innerHalfDepth, 0],
        [-innerHalfWidth, innerHalfDepth, outerDimensions.height],
        [innerHalfWidth, innerHalfDepth, outerDimensions.height],
        [innerHalfWidth, innerHalfDepth, 0]
      ]
    });
    
    return walls;
  }
  
  generateWallsForBuilding(x, y, width, depth, height, buildingData = {}) {
    const walls = [];
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    
    // 检查建筑是否有特殊形态（从QwenVL识别结果中获取）
    const hasSteps = buildingData.features?.includes('退台') || buildingData.features?.includes('错层');
    const hasRecess = buildingData.features?.includes('凹入') || buildingData.features?.includes('入口');
    const hasProtrusion = buildingData.features?.includes('突出') || buildingData.features?.includes('阳台');
    const buildingType = buildingData.type || 'standard';
    
    // 如果是连接体或有特殊形态，生成复杂墙体
    if (buildingType === '连接体' || hasSteps || hasRecess || hasProtrusion) {
      return this.generateComplexWalls(x, y, width, depth, height, buildingData);
    }
    
    // 标准矩形建筑的4面墙
    walls.push({
      id: `wall_front_${x}`,
      type: 'exterior',
      points: [
        [x - halfWidth, y - halfDepth, 0],
        [x - halfWidth, y - halfDepth, height],
        [x + halfWidth, y - halfDepth, height],
        [x + halfWidth, y - halfDepth, 0]
      ]
    });
    
    walls.push({
      id: `wall_back_${x}`,
      type: 'exterior',
      points: [
        [x + halfWidth, y + halfDepth, 0],
        [x + halfWidth, y + halfDepth, height],
        [x - halfWidth, y + halfDepth, height],
        [x - halfWidth, y + halfDepth, 0]
      ]
    });
    
    walls.push({
      id: `wall_left_${x}`,
      type: 'exterior',
      points: [
        [x - halfWidth, y - halfDepth, 0],
        [x - halfWidth, y + halfDepth, 0],
        [x - halfWidth, y + halfDepth, height],
        [x - halfWidth, y - halfDepth, height]
      ]
    });
    
    walls.push({
      id: `wall_right_${x}`,
      type: 'exterior',
      points: [
        [x + halfWidth, y - halfDepth, 0],
        [x + halfWidth, y - halfDepth, height],
        [x + halfWidth, y + halfDepth, height],
        [x + halfWidth, y + halfDepth, 0]
      ]
    });
    
    return walls;
  }
  
  /**
   * 生成复杂形态的墙体（高低错落、凹凸变化）
   */
  generateComplexWalls(x, y, width, depth, height, buildingData) {
    const walls = [];
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    
    // 根据建筑类型生成不同的墙体配置
    if (buildingData.type === '连接体') {
      // L型或T型连接体
      const mainWidth = width * 0.7;
      const sideWidth = width * 0.3;
      
      // 主体部分的墙
      walls.push(...this.generateBoxWalls(x, y, mainWidth, depth, height, 'main'));
      
      // 连接部分的墙（较低）
      const connectorHeight = height * 0.6;
      walls.push(...this.generateBoxWalls(
        x + mainWidth/2, 
        y + depth/2, 
        sideWidth, 
        depth * 0.5, 
        connectorHeight, 
        'connector'
      ));
    } else if (buildingData.features?.includes('退台')) {
      // 退台式建筑（每层逐渐缩小）
      const floors = buildingData.floors?.count || 3;
      const floorHeight = height / floors;
      
      for (let i = 0; i < floors; i++) {
        const reduction = i * 0.1; // 每层缩小10%
        const floorWidth = width * (1 - reduction);
        const floorDepth = depth * (1 - reduction);
        const floorZ = i * floorHeight;
        
        walls.push(...this.generateBoxWalls(
          x, y, floorWidth, floorDepth, floorHeight, 
          `floor_${i}`, floorZ
        ));
      }
    } else {
      // 带凹凸特征的建筑
      const baseWalls = this.generateBoxWalls(x, y, width, depth, height, 'base');
      walls.push(...baseWalls);
      
      // 添加凹入部分（如入口）
      if (buildingData.features?.includes('入口')) {
        const entranceWidth = width * 0.2;
        const entranceDepth = depth * 0.15;
        const entranceHeight = height * 0.25;
        
        walls.push(...this.generateRecessWalls(
          x, y - halfDepth, entranceWidth, entranceDepth, entranceHeight, 'entrance'
        ));
      }
      
      // 添加突出部分（如阳台）
      if (buildingData.features?.includes('阳台')) {
        const balconyWidth = width * 0.8;
        const balconyDepth = 1500; // 1.5米深阳台
        const balconyHeight = 1200; // 1.2米高栏杆
        const balconyFloors = buildingData.floors?.count || 3;
        
        for (let floor = 1; floor < balconyFloors; floor++) {
          walls.push(...this.generateProtrusionWalls(
            x, y - halfDepth - balconyDepth/2,
            balconyWidth, balconyDepth, balconyHeight,
            `balcony_${floor}`, floor * 3300
          ));
        }
      }
    }
    
    return walls;
  }
  
  /**
   * 生成盒子形状的墙体（辅助方法）
   */
  generateBoxWalls(x, y, width, depth, height, prefix, zOffset = 0) {
    const walls = [];
    const hw = width / 2;
    const hd = depth / 2;
    
    walls.push({
      id: `${prefix}_wall_front`,
      type: 'exterior',
      points: [
        [x - hw, y - hd, zOffset],
        [x - hw, y - hd, zOffset + height],
        [x + hw, y - hd, zOffset + height],
        [x + hw, y - hd, zOffset]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_back`,
      type: 'exterior',
      points: [
        [x + hw, y + hd, zOffset],
        [x + hw, y + hd, zOffset + height],
        [x - hw, y + hd, zOffset + height],
        [x - hw, y + hd, zOffset]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_left`,
      type: 'exterior',
      points: [
        [x - hw, y - hd, zOffset],
        [x - hw, y + hd, zOffset],
        [x - hw, y + hd, zOffset + height],
        [x - hw, y - hd, zOffset + height]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_right`,
      type: 'exterior',
      points: [
        [x + hw, y - hd, zOffset],
        [x + hw, y - hd, zOffset + height],
        [x + hw, y + hd, zOffset + height],
        [x + hw, y + hd, zOffset]
      ]
    });
    
    return walls;
  }
  
  /**
   * 生成凹入部分的墙体
   */
  generateRecessWalls(x, y, width, depth, height, prefix) {
    // 凹入部分需要3面墙（左、右、后）
    const walls = [];
    const hw = width / 2;
    
    walls.push({
      id: `${prefix}_wall_left`,
      type: 'interior',
      points: [
        [x - hw, y, 0],
        [x - hw, y + depth, 0],
        [x - hw, y + depth, height],
        [x - hw, y, height]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_right`,
      type: 'interior',
      points: [
        [x + hw, y, 0],
        [x + hw, y, height],
        [x + hw, y + depth, height],
        [x + hw, y + depth, 0]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_back`,
      type: 'interior',
      points: [
        [x - hw, y + depth, 0],
        [x - hw, y + depth, height],
        [x + hw, y + depth, height],
        [x + hw, y + depth, 0]
      ]
    });
    
    return walls;
  }
  
  /**
   * 生成突出部分的墙体（如阳台）
   */
  generateProtrusionWalls(x, y, width, depth, height, prefix, zOffset) {
    const walls = [];
    const hw = width / 2;
    const hd = depth / 2;
    
    // 阳台只需要前面和两侧的栏杆墙
    walls.push({
      id: `${prefix}_wall_front`,
      type: 'railing',
      points: [
        [x - hw, y - hd, zOffset],
        [x - hw, y - hd, zOffset + height],
        [x + hw, y - hd, zOffset + height],
        [x + hw, y - hd, zOffset]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_left`,
      type: 'railing',
      points: [
        [x - hw, y - hd, zOffset],
        [x - hw, y + hd, zOffset],
        [x - hw, y + hd, zOffset + height],
        [x - hw, y - hd, zOffset + height]
      ]
    });
    
    walls.push({
      id: `${prefix}_wall_right`,
      type: 'railing',
      points: [
        [x + hw, y - hd, zOffset],
        [x + hw, y - hd, zOffset + height],
        [x + hw, y + hd, zOffset + height],
        [x + hw, y + hd, zOffset]
      ]
    });
    
    return walls;
  }

  /**
   * 为单个建筑生成窗户
   */
  generateWindowsForBuilding(x, y, width, depth, floors) {
    const windows = [];
    const windowsPerFloor = 5;
    const windowWidth = 1500;
    const windowHeight = 2000;
    const floorHeight = 3300;
    const spacing = width / (windowsPerFloor + 1);
    
    for (let floor = 0; floor < floors; floor++) {
      for (let i = 0; i < windowsPerFloor; i++) {
        windows.push({
          id: `window_${x}_${floor}_${i}`,
          position: {
            x: x - width/2 + spacing * (i + 1),
            y: y - depth/2,  // 前立面
            z: floor * floorHeight + 1000  // 窗户离地1米
          },
          width: windowWidth,
          height: windowHeight
        });
      }
    }
    
    return windows;
  }
}

module.exports = new AIModelingService();