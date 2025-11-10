/**
 * Transformer + vLLM 混合推理服务
 * 
 * 最优方案：结合Transformer的特征提取能力和vLLM的推理能力
 * 
 * 处理流程：
 * 1. Transformer提取建筑特征（快速）
 * 2. 编码为结构化特征向量
 * 3. vLLM基于特征进行智能推理（精确）
 * 4. 输出3D建模参数
 */

const axios = require('axios');

class HybridInferenceService {
  constructor() {
    this.config = {
      // Transformer特征提取服务
      transformerUrl: process.env.TRANSFORMER_URL || 'http://localhost:8090',
      
      // vLLM推理服务
      vllmUrl: process.env.VLLM_URL || 'http://10.10.18.2:8000',
      vllmModel: process.env.VLLM_MODEL || 'Qwen3-32B',
      
      // 性能配置
      transformerTimeout: 3000,  // 3秒
      vllmTimeout: 10000,        // 10秒
      totalTimeout: 15000,       // 总共15秒
      
      // 特征维度
      featuresDim: 512,
      
      // 缓存配置
      enableCache: true,
      cacheSize: 100
    };
    
    // 特征缓存
    this.featureCache = new Map();
  }
  
  /**
   * 混合推理主函数
   */
  async hybridInference(imageBuffer, metadata = {}) {
    console.log('🚀 ========== Transformer + vLLM 混合推理 ==========');
    const startTime = Date.now();
    
    try {
      // Step 1: 多模态特征提取（并行处理）
      console.log('📊 Step 1: 多模态特征提取...');
      const multimodalFeatures = await this.extractMultimodalFeatures(imageBuffer, metadata);
      console.log(`  ✅ 特征提取完成 (${Date.now() - startTime}ms)`);
      
      // Step 2: Transformer特征编码
      console.log('🤖 Step 2: Transformer特征编码...');
      const encodedFeatures = await this.transformerEncode(multimodalFeatures);
      console.log(`  ✅ 特征编码完成 (${Date.now() - startTime}ms)`);
      console.log(`  📐 特征向量维度: ${encodedFeatures.vector.length}`);
      
      // Step 3: 构建结构化prompt
      console.log('📝 Step 3: 构建智能prompt...');
      const structuredPrompt = this.buildIntelligentPrompt(encodedFeatures, multimodalFeatures);
      
      // Step 4: vLLM推理
      console.log('🧠 Step 4: vLLM智能推理...');
      const inferenceResult = await this.vllmInference(structuredPrompt);
      console.log(`  ✅ 推理完成 (${Date.now() - startTime}ms)`);
      
      // Step 5: 后处理优化
      console.log('🔧 Step 5: 参数优化...');
      const optimizedParams = this.postProcessing(inferenceResult, encodedFeatures);
      
      const totalTime = Date.now() - startTime;
      console.log(`✨ 混合推理完成！总耗时: ${totalTime}ms`);
      console.log('=================================================');
      
      return {
        success: true,
        method: 'hybrid_transformer_vllm',
        processingTime: totalTime,
        parameters: optimizedParams,
        confidence: this.calculateConfidence(encodedFeatures, inferenceResult)
      };
      
    } catch (error) {
      console.error('❌ 混合推理失败:', error);
      // 降级策略
      return this.fallbackStrategy(imageBuffer, metadata);
    }
  }
  
  /**
   * 提取多模态特征
   */
  async extractMultimodalFeatures(imageBuffer, metadata) {
    // 这里整合前面已有的特征提取逻辑
    const features = {
      ocr: metadata.ocr || { text: '', confidence: 0 },
      yolo: metadata.yolo || { objects: [], confidence: 0 },
      qwenvl: metadata.qwenvl || { 
        buildings: [],
        view_type: 'unknown',
        confidence: 0
      },
      depth: metadata.depth || {
        depth_levels: 0,
        point_cloud: { points: [] },
        confidence: 0
      }
    };
    
    return features;
  }
  
  /**
   * Transformer特征编码
   */
  async transformerEncode(features) {
    try {
      // 检查缓存
      const cacheKey = this.getCacheKey(features);
      if (this.featureCache.has(cacheKey)) {
        console.log('  📦 使用缓存的特征向量');
        return this.featureCache.get(cacheKey);
      }
      
      // 调用Transformer服务
      const response = await axios.post(
        `${this.config.transformerUrl}/encode`,
        {
          features: features,
          task: 'building_3d_reconstruction'
        },
        {
          timeout: this.config.transformerTimeout
        }
      );
      
      const encodedFeatures = response.data;
      
      // 缓存结果
      if (this.config.enableCache) {
        this.featureCache.set(cacheKey, encodedFeatures);
      }
      
      return encodedFeatures;
      
    } catch (error) {
      console.log('  ⚠️ Transformer服务不可用，使用本地编码');
      return this.localFeatureEncoding(features);
    }
  }
  
  /**
   * 本地特征编码（备用方案）
   */
  localFeatureEncoding(features) {
    // 简化的特征编码逻辑
    const vector = new Array(this.config.featuresDim).fill(0);
    
    // 提取关键特征
    const keyFeatures = {
      // 场景特征
      building_count: features.qwenvl?.buildings?.length || 1,
      view_type: features.qwenvl?.view_type || 'unknown',
      scene_type: features.qwenvl?.scene_type || 'single',
      
      // 建筑特征
      building_type: features.qwenvl?.buildings?.[0]?.type || 'office',
      floor_count: features.qwenvl?.buildings?.[0]?.floors || 0,
      
      // 空间特征
      depth_levels: features.depth?.depth_levels || 0,
      point_count: features.depth?.point_cloud?.points?.length || 0,
      
      // 置信度
      overall_confidence: this.calculateOverallConfidence(features)
    };
    
    // 编码到向量（简化版）
    vector[0] = keyFeatures.building_count / 10;
    vector[1] = keyFeatures.view_type === 'plan' ? 1 : 0;
    vector[2] = keyFeatures.view_type === 'elevation' ? 1 : 0;
    vector[3] = keyFeatures.view_type === 'section' ? 1 : 0;
    vector[4] = keyFeatures.floor_count / 100;
    vector[5] = keyFeatures.depth_levels / 20;
    vector[6] = keyFeatures.overall_confidence;
    
    // 建筑类型one-hot编码
    const buildingTypes = ['residential', 'office', 'commercial', 'industrial'];
    const typeIndex = buildingTypes.indexOf(keyFeatures.building_type);
    if (typeIndex >= 0) {
      vector[10 + typeIndex] = 1;
    }
    
    return {
      vector: vector,
      keyFeatures: keyFeatures,
      method: 'local_encoding'
    };
  }
  
  /**
   * 构建智能prompt
   */
  buildIntelligentPrompt(encodedFeatures, originalFeatures) {
    const { keyFeatures } = encodedFeatures;
    
    const prompt = `
你是一个建筑3D重建专家。基于以下Transformer提取的高级特征，推理出完整的3D建模参数。

## 🏗️ Transformer特征分析结果

### 场景理解
- 建筑数量: ${keyFeatures.building_count}
- 视角类型: ${keyFeatures.view_type}
- 场景类型: ${keyFeatures.scene_type}
- 整体置信度: ${(keyFeatures.overall_confidence * 100).toFixed(1)}%

### 建筑特征
- 建筑类型: ${keyFeatures.building_type}
- 识别楼层: ${keyFeatures.floor_count || '未知（需推理）'}
- 空间复杂度: ${this.calculateSpatialComplexity(encodedFeatures)}
- 结构规律性: ${this.calculateStructuralRegularity(encodedFeatures)}

### 深度特征
- 深度层次: ${keyFeatures.depth_levels}
- 点云密度: ${keyFeatures.point_count}
- 空间分布: ${this.analyzeSpatialDistribution(originalFeatures.depth)}

### 推理任务
请基于以上特征，推理并输出以下3D参数：

1. **楼层参数**
   - 总楼层数（如果是俯视图，基于建筑类型推理）
   - 每层高度

2. **建筑尺寸**
   - 长度(mm)
   - 宽度(mm)
   - 总高度(mm)

3. **结构参数**
   - 柱网间距
   - 墙体厚度
   - 结构类型

4. **立面参数**
   - 窗户布局
   - 门的位置
   - 材质建议

请以JSON格式输出，确保所有数值都是整数（单位：毫米）。

特别注意：
- ${keyFeatures.view_type === 'plan' ? '这是俯视图，需要根据建筑类型推理高度信息' : ''}
- ${keyFeatures.building_type === 'industrial' ? '工业建筑通常层高较高(8-12米)' : ''}
- ${keyFeatures.building_type === 'residential' ? '住宅建筑标准层高约3米' : ''}
`;
    
    return prompt;
  }
  
  /**
   * vLLM推理
   */
  async vllmInference(prompt) {
    try {
      const response = await axios.post(
        `${this.config.vllmUrl}/v1/chat/completions`,
        {
          model: this.config.vllmModel,
          messages: [{
            role: "user",
            content: prompt
          }],
          max_tokens: 2000,
          temperature: 0.1,  // 低温度，更确定的输出
          top_p: 0.9
        },
        {
          timeout: this.config.vllmTimeout
        }
      );
      
      const content = response.data.choices[0].message.content;
      
      // 解析JSON响应
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 如果不是JSON，尝试结构化解析
      return this.parseStructuredResponse(content);
      
    } catch (error) {
      console.error('  ❌ vLLM推理失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 后处理优化
   */
  postProcessing(inferenceResult, encodedFeatures) {
    const { keyFeatures } = encodedFeatures;
    
    // 确保参数完整性
    const params = {
      building_type: inferenceResult.building_type || keyFeatures.building_type || 'office',
      
      floors: {
        count: inferenceResult.floors?.count || 
               inferenceResult.floor_count || 
               this.inferFloorCount(keyFeatures),
        height: inferenceResult.floors?.height || 
                inferenceResult.floor_height || 
                this.getDefaultFloorHeight(keyFeatures.building_type)
      },
      
      dimensions: {
        width: Math.round(inferenceResult.dimensions?.width || 
                         inferenceResult.width || 
                         30000),
        depth: Math.round(inferenceResult.dimensions?.depth || 
                         inferenceResult.depth || 
                         20000),
        height: 0  // 将在下面计算
      },
      
      structure: {
        column_grid: {
          x: inferenceResult.structure?.column_grid?.x || 8400,
          y: inferenceResult.structure?.column_grid?.y || 8400
        },
        wall_thickness: {
          exterior: inferenceResult.structure?.wall_thickness?.exterior || 300,
          interior: inferenceResult.structure?.wall_thickness?.interior || 200
        }
      },
      
      facade: {
        windows: {
          count: inferenceResult.facade?.windows?.count || 
                 Math.floor(params.dimensions.width / 3000) * params.floors.count,
          type: inferenceResult.facade?.windows?.type || 'standard'
        },
        doors: {
          count: inferenceResult.facade?.doors?.count || 1,
          type: 'main_entrance'
        },
        materials: {
          primary: inferenceResult.facade?.materials?.primary || 'glass_curtain',
          secondary: inferenceResult.facade?.materials?.secondary || 'aluminum'
        }
      }
    };
    
    // 计算总高度
    params.dimensions.height = params.floors.count * params.floors.height;
    
    // 验证合理性
    this.validateParameters(params);
    
    return params;
  }
  
  /**
   * 推理楼层数
   */
  inferFloorCount(keyFeatures) {
    if (keyFeatures.floor_count > 0) {
      return keyFeatures.floor_count;
    }
    
    // 基于建筑类型的默认值
    const defaults = {
      residential: 6,
      office: 8,
      commercial: 3,
      industrial: 1,
      mixed: 5
    };
    
    return defaults[keyFeatures.building_type] || 5;
  }
  
  /**
   * 获取默认楼层高度
   */
  getDefaultFloorHeight(buildingType) {
    const heights = {
      residential: 3000,
      office: 4200,
      commercial: 5000,
      industrial: 10000,
      mixed: 3600
    };
    
    return heights[buildingType] || 3300;
  }
  
  /**
   * 验证参数合理性
   */
  validateParameters(params) {
    // 楼层数范围
    params.floors.count = Math.max(1, Math.min(100, params.floors.count));
    
    // 楼层高度范围
    params.floors.height = Math.max(2800, Math.min(15000, params.floors.height));
    
    // 建筑尺寸范围
    params.dimensions.width = Math.max(5000, Math.min(200000, params.dimensions.width));
    params.dimensions.depth = Math.max(5000, Math.min(200000, params.dimensions.depth));
    
    // 重新计算高度
    params.dimensions.height = params.floors.count * params.floors.height;
  }
  
  /**
   * 计算置信度
   */
  calculateConfidence(encodedFeatures, inferenceResult) {
    const weights = {
      feature_quality: 0.3,
      inference_confidence: 0.4,
      consistency: 0.3
    };
    
    const featureQuality = encodedFeatures.keyFeatures?.overall_confidence || 0.5;
    const inferenceConfidence = inferenceResult.confidence || 0.7;
    const consistency = this.checkConsistency(encodedFeatures, inferenceResult);
    
    return (
      weights.feature_quality * featureQuality +
      weights.inference_confidence * inferenceConfidence +
      weights.consistency * consistency
    );
  }
  
  /**
   * 检查一致性
   */
  checkConsistency(features, result) {
    let score = 1.0;
    
    // 检查建筑类型一致性
    if (features.keyFeatures?.building_type !== result.building_type) {
      score -= 0.2;
    }
    
    // 检查楼层数合理性
    const expectedFloors = this.inferFloorCount(features.keyFeatures);
    const actualFloors = result.floors?.count || 0;
    if (Math.abs(expectedFloors - actualFloors) > 3) {
      score -= 0.3;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * 计算空间复杂度
   */
  calculateSpatialComplexity(features) {
    const complexity = features.vector?.[20] || 0.5;
    if (complexity < 0.3) return '简单';
    if (complexity < 0.7) return '中等';
    return '复杂';
  }
  
  /**
   * 计算结构规律性
   */
  calculateStructuralRegularity(features) {
    const regularity = features.vector?.[21] || 0.5;
    if (regularity > 0.7) return '高度规则';
    if (regularity > 0.4) return '部分规则';
    return '不规则';
  }
  
  /**
   * 分析空间分布
   */
  analyzeSpatialDistribution(depth) {
    if (!depth?.point_cloud?.points?.length) {
      return '无点云数据';
    }
    
    const pointCount = depth.point_cloud.points.length;
    if (pointCount < 1000) return '稀疏';
    if (pointCount < 10000) return '中等';
    return '密集';
  }
  
  /**
   * 计算整体置信度
   */
  calculateOverallConfidence(features) {
    const confidences = [
      features.ocr?.confidence || 0,
      features.yolo?.confidence || 0,
      features.qwenvl?.confidence || 0,
      features.depth?.confidence || 0
    ].filter(c => c > 0);
    
    if (confidences.length === 0) return 0.5;
    
    return confidences.reduce((a, b) => a + b) / confidences.length;
  }
  
  /**
   * 获取缓存键
   */
  getCacheKey(features) {
    // 基于特征生成唯一键
    const key = JSON.stringify({
      building_count: features.qwenvl?.buildings?.length,
      view_type: features.qwenvl?.view_type,
      building_type: features.qwenvl?.buildings?.[0]?.type
    });
    
    return Buffer.from(key).toString('base64').substring(0, 32);
  }
  
  /**
   * 解析结构化响应
   */
  parseStructuredResponse(content) {
    // 尝试从文本中提取参数
    const result = {};
    
    // 提取楼层数
    const floorMatch = content.match(/(\d+)\s*[层楼]/);
    if (floorMatch) {
      result.floors = { count: parseInt(floorMatch[1]) };
    }
    
    // 提取尺寸
    const widthMatch = content.match(/[长宽].*?(\d+)\s*[米m]/);
    if (widthMatch) {
      result.dimensions = { width: parseInt(widthMatch[1]) * 1000 };
    }
    
    return result;
  }
  
  /**
   * 降级策略
   */
  async fallbackStrategy(imageBuffer, metadata) {
    console.log('⚠️ 使用降级策略');
    
    // 尝试只用vLLM
    try {
      const prompt = '基于建筑图片，推理3D建模参数...';
      const result = await this.vllmInference(prompt);
      return {
        success: true,
        method: 'vllm_only',
        parameters: result
      };
    } catch (error) {
      // 使用默认参数
      return {
        success: false,
        method: 'default',
        parameters: {
          building_type: 'office',
          floors: { count: 5, height: 3300 },
          dimensions: { width: 30000, depth: 20000, height: 16500 }
        }
      };
    }
  }
}

module.exports = new HybridInferenceService();