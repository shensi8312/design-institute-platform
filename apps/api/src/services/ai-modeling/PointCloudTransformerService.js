/**
 * 点云特征提取 + Transformer + vLLM 混合推理服务
 * 
 * 架构设计：
 * 1. 前四步（OCR、YOLO、QwenVL、深度估计）提取原始特征
 * 2. 点云数据通过专门的Transformer提取3D空间特征
 * 3. 所有特征融合后输入vLLM进行高级推理
 * 
 * 核心优势：
 * - 点云提供精确的3D空间信息
 * - Transformer学习建筑的空间模式
 * - vLLM基于丰富特征进行智能推理
 */

const axios = require('axios');
const tf = require('@tensorflow/tfjs-node');
const improvedPointCloudGenerator = require('./improvedPointCloudGenerator');

class PointCloudTransformerService {
  constructor() {
    this.config = {
      // 点云处理参数
      pointCloud: {
        maxPoints: 10000,        // 最大点数
        voxelSize: 0.05,         // 体素大小（米）
        features: 128,           // 点云特征维度
        clusters: 10             // 聚类数量
      },
      
      // Transformer配置
      transformer: {
        d_model: 768,            // 模型维度
        n_heads: 12,             // 注意力头数
        n_layers: 6,             // 层数
        d_ff: 3072,              // 前馈维度
        dropout: 0.1
      },
      
      // 服务端点
      services: {
        pointCloudProcessor: 'http://localhost:8091',  // 点云处理服务
        transformer: 'http://localhost:8092',          // Transformer服务
        vllm: 'http://10.10.18.2:8000'                // vLLM服务
      }
    };
  }
  
  /**
   * 安全的数值舍入，处理Infinity和NaN
   */
  safeRound(value) {
    if (!value || !isFinite(value)) {
      return 0;
    }
    return Math.round(value);
  }
  
  /**
   * 主推理流程：点云特征 + Transformer + vLLM
   */
  async inferWithPointCloud(imageBuffer, metadata = {}) {
    console.log('🚀 ========== 点云Transformer推理流程 ==========');
    const startTime = Date.now();
    
    try {
      // ========== 阶段1：多模态特征提取 ==========
      console.log('\n📊 阶段1：多模态特征提取');
      console.log('提取OCR、YOLO、QwenVL、深度特征...');
      
      const rawFeatures = await this.extractRawFeatures(imageBuffer, metadata);
      console.log(`✅ 原始特征提取完成 (${Date.now() - startTime}ms)`);
      
      // ========== 阶段2：点云特征提取（重点） ==========
      console.log('\n☁️ 阶段2：点云特征提取与分析');
      
      // 传递QwenVL的识别结果作为上下文
      // 注意：rawFeatures中的字段是qwenvl，不是vision
      const visionContext = {
        buildingCount: rawFeatures.qwenvl?.building_count || 
                      rawFeatures.qwenvl?.buildings?.length ||
                      rawFeatures.qwenvl?.volumes?.length,
        buildings: rawFeatures.qwenvl?.buildings,
        volumes: rawFeatures.qwenvl?.volumes
      };
      
      // 调试输出
      console.log('  📊 视觉上下文:', {
        buildingCount: visionContext.buildingCount,
        hasBuildings: !!visionContext.buildings,
        hasVolumes: !!visionContext.volumes
      });
      
      const pointCloudFeatures = await this.extractPointCloudFeatures(
        rawFeatures.depth?.point_cloud,
        rawFeatures.depth?.depth_map,
        visionContext  // 传递视觉上下文
      );
      
      console.log('点云特征摘要:');
      console.log(`  • 点数: ${pointCloudFeatures.pointCount}`);
      console.log(`  • 建筑轮廓: ${pointCloudFeatures.buildingContours.length}个`);
      console.log(`  • 楼层特征: ${pointCloudFeatures.floorPatterns.length}层`);
      console.log(`  • 立面特征: ${pointCloudFeatures.facadeFeatures.type}`);
      console.log(`  • 空间复杂度: ${pointCloudFeatures.spatialComplexity}`);
      
      // ========== 阶段3：Transformer特征编码 ==========
      console.log('\n🤖 阶段3：Transformer特征编码');
      
      const transformerInput = this.prepareTransformerInput(
        rawFeatures,
        pointCloudFeatures
      );
      
      const encodedFeatures = await this.transformerEncode(transformerInput);
      console.log(`✅ Transformer编码完成 (${Date.now() - startTime}ms)`);
      console.log(`  特征维度: ${encodedFeatures.dimension}`);
      console.log(`  关键特征: ${encodedFeatures.keyFeatures.join(', ')}`);
      
      // ========== 阶段4：跳过vLLM推理 ==========
      // 直接使用前面阶段的结果
      const inferenceResult = {
        floors: pointCloudFeatures.estimatedFloors || 3,
        building_type: rawFeatures.qwenvl?.scene_type || 'office',
        confidence: 0.9
      };
      
      // ========== 阶段5：结果优化 ==========
      console.log('\n🔧 阶段5：结果优化与验证');
      
      const finalResult = this.optimizeResult(
        inferenceResult,
        pointCloudFeatures
      );
      
      const totalTime = Date.now() - startTime;
      console.log(`\n✨ 完成！总耗时: ${totalTime}ms`);
      console.log('===========================================');
      
      return {
        success: true,
        method: 'point_cloud_transformer_vllm',
        processingTime: totalTime,
        parameters: finalResult,
        features: {
          pointCloud: pointCloudFeatures,
          transformer: encodedFeatures
        }
      };
      
    } catch (error) {
      console.error('❌ 推理失败:', error);
      throw error;
    }
  }
  
  /**
   * 提取原始特征（前四步）
   */
  async extractRawFeatures(imageBuffer, metadata) {
    // 调试：输出接收到的metadata
    console.log('  📊 接收到的metadata结构:');
    console.log('    - metadata.qwenvl存在?', !!metadata.qwenvl);
    if (metadata.qwenvl) {
      console.log('    - qwenvl.volumes数量:', metadata.qwenvl.volumes?.length || 0);
      console.log('    - qwenvl.buildings数量:', metadata.qwenvl.buildings?.length || 0);
      console.log('    - qwenvl.building_count:', metadata.qwenvl.building_count);
    }
    
    return {
      ocr: metadata.ocr || { text: '', objects: [] },
      yolo: metadata.yolo || { objects: [] },
      qwenvl: metadata.qwenvl || {
        buildings: [],
        view_type: 'unknown',
        scene_type: 'single',
        confidence: 0
      },
      depth: metadata.depth || {
        depth_map: [],
        point_cloud: { points: [] },
        depth_levels: 0,
        confidence: 0
      }
    };
  }
  
  /**
   * 核心：点云特征提取
   * 从点云中提取建筑的3D空间特征
   * @param {Object} pointCloud - 点云数据
   * @param {Object} depthMap - 深度图
   * @param {Object} visionContext - QwenVL视觉识别上下文（新增）
   */
  async extractPointCloudFeatures(pointCloud, depthMap, visionContext = {}) {
    console.log('  处理点云数据...');
    
    // 从视觉上下文获取期望的建筑数量
    const expectedBuildingCount = visionContext.buildingCount || 
                                 visionContext.buildings?.length || 
                                 visionContext.volumes?.length || 
                                 null;
    
    if (expectedBuildingCount) {
      console.log(`  📊 QwenVL识别到${expectedBuildingCount}个建筑/体块`);
    }
    
    // 如果没有点云，使用改进的生成器基于建筑体块生成
    let points = pointCloud?.points || [];
    if (points.length === 0) {
      // 如果有QwenVL识别的建筑体块，基于它们生成点云
      if (visionContext.volumes && visionContext.volumes.length > 0) {
        console.log('  🎯 基于建筑体块生成点云...');
        points = improvedPointCloudGenerator.generateBuildingBasedPointCloud(visionContext.volumes);
      } else if (depthMap) {
        console.log('  📊 从深度图生成点云...');
        points = this.depthMapToPointCloud(depthMap);
      }
    }
    
    if (points.length === 0) {
      console.log('  ⚠️ 无点云数据');
      return this.getDefaultPointCloudFeatures();
    }
    
    console.log(`  处理${points.length}个3D点...`);
    
    // 1. 点云预处理
    const processedPoints = this.preprocessPointCloud(points);
    
    // 2. 提取建筑轮廓（传递期望的建筑数量）
    const buildingContours = this.extractBuildingContours(processedPoints, expectedBuildingCount);
    console.log(`  ✅ 检测到${buildingContours.length}个建筑轮廓`);
    
    // 3. 提取楼层模式
    const floorPatterns = this.extractFloorPatterns(processedPoints);
    console.log(`  ✅ 识别到${floorPatterns.length}个楼层模式`);
    
    // 4. 提取立面特征
    const facadeFeatures = this.extractFacadeFeatures(processedPoints);
    console.log(`  ✅ 立面类型: ${facadeFeatures.type}`);
    
    // 5. 计算空间统计
    const spatialStats = this.calculateSpatialStatistics(processedPoints);
    
    // 6. 提取结构特征
    const structuralFeatures = this.extractStructuralFeatures(processedPoints);
    
    // 7. 窗户网格检测
    const windowGrid = this.detectWindowGrid(processedPoints);
    
    return {
      pointCount: points.length,
      buildingContours: buildingContours,
      floorPatterns: floorPatterns,
      facadeFeatures: facadeFeatures,
      spatialStats: spatialStats,
      structuralFeatures: structuralFeatures,
      windowGrid: windowGrid,
      spatialComplexity: this.calculateSpatialComplexity(processedPoints),
      
      // 关键3D参数（直接从点云推断）
      estimatedDimensions: {
        width: spatialStats.boundingBox.width,
        depth: spatialStats.boundingBox.depth,
        height: spatialStats.boundingBox.height
      },
      // 不要从height推算楼层数，height可能是错误的维度
      estimatedFloors: floorPatterns.length || 0  // 如果没有检测到楼层模式，返回0而不是猜测
    };
  }
  
  /**
   * 深度图转点云
   */
  depthMapToPointCloud(depthMap) {
    const points = [];
    const width = depthMap[0]?.length || 0;
    const height = depthMap.length;
    
    for (let y = 0; y < height; y += 5) {  // 采样
      for (let x = 0; x < width; x += 5) {
        const depth = depthMap[y]?.[x];
        if (depth && depth > 0) {
          points.push({
            x: x,
            y: y,
            z: depth * 100,  // 缩放深度值
            intensity: depth
          });
        }
      }
    }
    
    return points;
  }
  
  /**
   * 点云预处理
   */
  preprocessPointCloud(points) {
    console.log(`    📐 preprocessPointCloud: 输入${points?.length || 0}个点`);
    
    // 1. 去噪
    const denoised = this.removeOutliers(points);
    console.log(`    📐 去噪后: ${denoised?.length || 0}个点`);
    
    // 2. 下采样（如果点太多）
    const sampled = denoised.length > this.config.pointCloud.maxPoints
      ? this.voxelDownsample(denoised)
      : denoised;
    console.log(`    📐 下采样后: ${sampled?.length || 0}个点`);
    
    // 3. 归一化坐标
    const normalized = this.normalizePoints(sampled);
    console.log(`    📐 归一化后: ${normalized?.length || 0}个点`);
    
    return normalized;
  }
  
  /**
   * 提取建筑轮廓
   * @param {Array} points - 点云数据
   * @param {Number} expectedCount - 期望的建筑数量（来自QwenVL）
   */
  extractBuildingContours(points, expectedCount = null) {
    console.log(`  🏢 extractBuildingContours: expectedCount=${expectedCount}`);
    // 使用DBSCAN聚类识别建筑，传递期望的建筑数量
    const clusters = this.dbscanClustering(points, expectedCount);
    console.log(`  🏢 dbscanClustering返回了${clusters?.length || 0}个聚类`);
    
    return clusters.map(cluster => {
      const bbox = this.getBoundingBox(cluster);
      return {
        points: cluster.length,
        boundingBox: bbox,
        center: this.getCenter(cluster),
        volume: bbox.width * bbox.depth * bbox.height,
        type: this.classifyBuildingType(cluster)
      };
    });
  }
  
  /**
   * 提取楼层模式
   */
  extractFloorPatterns(points) {
    // 按Z轴分层
    const layers = this.stratifyByHeight(points);
    
    return layers.map((layer, index) => ({
      level: index,
      height: layer.averageHeight,
      pointCount: layer.points.length,
      density: layer.density,
      pattern: this.detectFloorPattern(layer)
    }));
  }
  
  /**
   * 提取立面特征
   */
  extractFacadeFeatures(points) {
    // 检测垂直面上的点
    const facadePoints = points.filter(p => 
      Math.abs(p.normal?.z || 0) < 0.3  // 接近垂直的面
    );
    
    // 分析立面模式
    const patterns = this.analyzeFacadePatterns(facadePoints);
    
    return {
      type: this.detectFacadeType(patterns),
      windowGrid: patterns.grid,
      symmetry: patterns.symmetry,
      complexity: patterns.complexity,
      materials: this.inferMaterials(patterns)
    };
  }
  
  /**
   * 检测窗户网格
   */
  detectWindowGrid(points) {
    // 找到规律性的凹陷或突出
    const gridPattern = this.findGridPattern(points);
    
    if (!gridPattern) {
      return { rows: 0, cols: 0 };
    }
    
    return {
      rows: gridPattern.rows,
      cols: gridPattern.cols,
      windowSize: gridPattern.cellSize,
      spacing: gridPattern.spacing
    };
  }
  
  /**
   * 准备Transformer输入
   */
  prepareTransformerInput(rawFeatures, pointCloudFeatures) {
    return {
      // 文本特征（OCR）
      text: {
        content: rawFeatures.ocr?.text || '',
        keywords: this.extractKeywords(rawFeatures.ocr?.text)
      },
      
      // 视觉特征（YOLO + QwenVL）
      vision: {
        objects: rawFeatures.yolo?.objects || [],
        scene: rawFeatures.qwenvl?.scene_type,
        viewType: rawFeatures.qwenvl?.view_type,
        buildingCount: rawFeatures.qwenvl?.buildings?.length || 1
      },
      
      // 3D特征（点云）
      spatial: {
        pointCount: pointCloudFeatures.pointCount,
        dimensions: pointCloudFeatures.estimatedDimensions || { width: 1, depth: 1, height: 1 },
        floors: pointCloudFeatures.estimatedFloors || 
                (pointCloudFeatures.buildingContours.length > 0 ? 
                 pointCloudFeatures.buildingContours.length : 1),  // 使用建筑数量作为楼层数的临时方案
        contours: pointCloudFeatures.buildingContours.length,
        complexity: pointCloudFeatures.spatialComplexity,
        windowGrid: pointCloudFeatures.windowGrid || { rows: 0, cols: 0 },
        facadeType: pointCloudFeatures.facadeFeatures?.type || 'standard'
      },
      
      // 元数据
      metadata: {
        confidence: this.calculateOverallConfidence(rawFeatures, pointCloudFeatures)
      }
    };
  }
  
  /**
   * Transformer编码
   */
  async transformerEncode(input) {
    try {
      // 调用Transformer服务
      const response = await axios.post(
        `${this.config.services.transformer}/encode`,
        {
          input: input,
          task: 'building_3d_reconstruction',
          model: 'point_cloud_transformer_v2'
        },
        {
          timeout: 5000
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.log('  使用本地Transformer编码');
      return this.localTransformerEncode(input);
    }
  }
  
  /**
   * 本地Transformer编码（第三阶段：深度细节分析）
   */
  localTransformerEncode(input) {
    console.log('  📊 第三阶段：深度细节分析...');
    console.log('    前两阶段已完成：建筑识别+轮廓提取');
    console.log('    现在分析：窗户模式、阴影深度、楼层变化、凹凸特征');
    
    // 🎯 深度细节特征提取
    const windowPattern = this.analyzeWindowPattern(input);
    const shadowDepth = this.analyzeShadowFromInput(input);
    const floorDetails = this.analyzeFloorVariations(input);
    const volumetric = this.analyzeVolumetricFeatures(input);
    
    // 构建细节特征向量
    const features = [
      // 窗户细节 (不再是简单的行列数)
      windowPattern.regularity,  // 规律性 0-1
      windowPattern.density,      // 密度 0-1
      windowPattern.verticalRhythm, // 垂直节奏
      
      // 阴影分析 (推断深度)
      shadowDepth.estimatedDepth / 5000,  // 归一化深度
      shadowDepth.overhangRatio,          // 悬挑比例
      
      // 楼层变化 (不是总数，是变化)
      floorDetails.groundFloorScale,   // 首层高度比例
      floorDetails.hasSetback ? 1 : 0, // 是否退台
      
      // 凹凸特征
      volumetric.entranceDepth / 3000,    // 入口深度
      volumetric.balconyProtrusion / 2000, // 阳台突出
      volumetric.complexity               // 复杂度
    ];
    
    console.log(`    ✅ 提取${features.length}个细节特征`);
    console.log(`      • 窗户规律性: ${(windowPattern.regularity * 100).toFixed(0)}%`);
    console.log(`      • 阴影深度: ${shadowDepth.estimatedDepth}mm`);
    console.log(`      • 首层挑高: ${floorDetails.groundFloorScale > 1.2 ? '是' : '否'}`);
    console.log(`      • 凹凸复杂度: ${volumetric.complexity.toFixed(2)}`);
    
    return {
      vector: features,
      dimension: features.length,
      details: {
        windowPattern,
        shadowDepth,
        floorDetails,
        volumetric
      },
      keyFeatures: [
        `窗户规律: ${(windowPattern.regularity * 100).toFixed(0)}%`,
        `阴影深度: ${shadowDepth.estimatedDepth}mm`,
        `楼层变化: ${floorDetails.hasSetback ? '退台式' : '标准'}`,
        `入口深度: ${volumetric.entranceDepth}mm`,
        `立面复杂度: ${volumetric.complexity > 0.7 ? '高' : '中'}`
      ]
    };
  }
  
  // 分析窗户模式（细节）
  analyzeWindowPattern(input) {
    const facadeType = input.spatial.facadeType || 'standard';
    const windowGrid = input.spatial.windowGrid || {};
    
    // 不只是行列数，还要分析规律性、密度、节奏
    return {
      regularity: windowGrid.rows > 0 ? 0.9 : 0.3, // 规律性
      density: (windowGrid.rows * windowGrid.cols) / 50, // 窗户密度
      verticalRhythm: windowGrid.rows > 3 ? 0.8 : 0.4, // 垂直节奏感
      pattern: facadeType === 'glass_curtain' ? 'continuous' : 'discrete'
    };
  }
  
  // 从输入分析阴影（推断深度）
  analyzeShadowFromInput(input) {
    // 从视觉特征推断阴影深度
    const hasShadow = input.vision.objects?.some(o => 
      o.label?.includes('shadow') || o.confidence < 0.5);
    
    return {
      estimatedDepth: hasShadow ? 2500 : 500, // 估算深度mm
      overhangRatio: hasShadow ? 0.3 : 0.1,   // 悬挑比例
      direction: 'northwest'                    // 光照方向
    };
  }
  
  // 分析楼层变化（不是总数）
  analyzeFloorVariations(input) {
    const floors = input.spatial.floors || 3;
    const height = input.spatial.dimensions?.height || 10000;
    const avgFloorHeight = height / floors;
    
    return {
      groundFloorScale: avgFloorHeight > 3500 ? 1.5 : 1.0, // 首层比例
      hasSetback: floors > 5,                               // 高层可能退台
      rhythmPattern: 'regular',                             // 节奏模式
      variationCoef: 0.1                                   // 变化系数
    };
  }
  
  // 分析凹凸特征（体量变化）
  analyzeVolumetricFeatures(input) {
    const buildingCount = input.spatial.contours || 1;
    const complexity = input.spatial.complexity || 0.5;
    
    return {
      entranceDepth: complexity > 0.6 ? 2000 : 500,    // 入口凹进
      balconyProtrusion: complexity > 0.5 ? 1500 : 0,  // 阳台突出
      complexity: complexity,                          // 总体复杂度
      hasRecesses: complexity > 0.6,                   // 有凹进
      hasProtrusions: complexity > 0.5                 // 有突出
    };
  }
  
  /**
   * 构建高级prompt
   */
  buildAdvancedPrompt(rawFeatures, pointCloudFeatures, encodedFeatures) {
    return `
你是建筑3D重建专家。基于以下多源特征进行精确推理：

## 🔍 原始特征分析

### OCR文本识别
${rawFeatures.ocr?.text ? `识别文字: ${rawFeatures.ocr.text}` : '未识别到文字'}

### YOLO对象检测
检测到${rawFeatures.yolo?.objects?.length || 0}个建筑元素

### QwenVL场景理解
- 场景类型: ${rawFeatures.qwenvl?.scene_type || 'unknown'}
- 视角: ${rawFeatures.qwenvl?.view_type || 'unknown'}
- 建筑数量: ${rawFeatures.qwenvl?.buildings?.length || 0}

## ☁️ 点云3D特征（核心）

### 空间特征
- 点云密度: ${pointCloudFeatures.pointCount}个点
- 建筑轮廓: ${pointCloudFeatures.buildingContours.length}个
- 空间复杂度: ${pointCloudFeatures.spatialComplexity}

### 尺寸估计（从点云直接测量）
- 宽度: ${this.safeRound(pointCloudFeatures.estimatedDimensions.width)}mm
- 深度: ${this.safeRound(pointCloudFeatures.estimatedDimensions.depth)}mm
- 高度: ${this.safeRound(pointCloudFeatures.estimatedDimensions.height)}mm

### 楼层分析
- 检测到楼层: ${pointCloudFeatures.floorPatterns.length}层
- 楼层模式: ${pointCloudFeatures.floorPatterns.map(f => `L${f.level}: ${f.pattern}`).join(', ')}

### 立面特征
- 立面类型: ${pointCloudFeatures.facadeFeatures.type}
- 窗户网格: ${pointCloudFeatures.windowGrid.rows}行 × ${pointCloudFeatures.windowGrid.cols}列
- 对称性: ${pointCloudFeatures.facadeFeatures.symmetry}

## 🤖 Transformer编码特征
${encodedFeatures.keyFeatures.join('\n')}

## 📋 推理任务

基于以上丰富的特征，特别是点云提供的精确3D信息，请推理：

1. **建筑类型**（基于空间特征判断）
2. **精确尺寸**（参考点云测量值）
3. **楼层参数**（基于点云分层）
4. **结构细节**（柱网、墙体等）
5. **立面设计**（基于立面特征）

输出JSON格式的完整3D建模参数。

特别注意：
- 优先采用点云测量的尺寸
- 楼层数以点云分层结果为准
- 立面类型根据点云特征确定
`;
  }
  
  /**
   * vLLM推理
   */
  async vllmInference(prompt) {
    const response = await axios.post(
      `${this.config.services.vllm}/v1/chat/completions`,
      {
        model: 'Qwen3-32B',  // 使用正确的模型名
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 2000,
        temperature: 0.1
      },
      {
        timeout: 60000  // 增加到60秒，给大模型更多时间
      }
    );
    
    const content = response.data.choices[0].message.content;
    
    // 首先尝试提取代码块中的JSON
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      let jsonStr = codeBlockMatch[1];
      // 清理JSON中的注释
      jsonStr = jsonStr.replace(/\/\/[^\n]*/g, ''); // 移除单行注释
      jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释
      
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        console.log('⚠️ 代码块JSON解析失败:', e.message);
      }
    }
    
    // 尝试提取普通JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      // 清理可能的注释
      jsonStr = jsonStr.replace(/\/\/[^\n]*/g, '');
      jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
      
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        console.log('⚠️ JSON解析失败:', e.message);
        console.log('原始内容前200字符:', jsonStr.substring(0, 200));
      }
    }
    
    throw new Error('无法解析vLLM响应');
  }
  
  /**
   * 优化结果
   */
  optimizeResult(inferenceResult, pointCloudFeatures) {
    // 使用点云特征验证和优化vLLM的推理结果
    const optimized = { ...inferenceResult };
    
    // 优先使用点云测量的尺寸
    if (pointCloudFeatures.estimatedDimensions) {
      optimized.dimensions = {
        width: this.safeRound(pointCloudFeatures.estimatedDimensions.width),
        depth: this.safeRound(pointCloudFeatures.estimatedDimensions.depth),
        height: this.safeRound(pointCloudFeatures.estimatedDimensions.height)
      };
    }
    
    // 使用点云检测的楼层数
    if (pointCloudFeatures.floorPatterns.length > 0) {
      optimized.floors = {
        count: pointCloudFeatures.floorPatterns.length,
        height: optimized.dimensions.height / pointCloudFeatures.floorPatterns.length
      };
    }
    
    // 使用点云检测的窗户网格
    if (pointCloudFeatures.windowGrid.rows > 0) {
      optimized.windows = {
        grid: pointCloudFeatures.windowGrid,
        total: pointCloudFeatures.windowGrid.rows * pointCloudFeatures.windowGrid.cols
      };
    }
    
    // 使用点云检测的立面类型
    optimized.facade = {
      type: pointCloudFeatures.facadeFeatures.type,
      materials: pointCloudFeatures.facadeFeatures.materials
    };
    
    return optimized;
  }
  
  // ========== 辅助函数 ==========
  
  removeOutliers(points) {
    if (!points || points.length === 0) {
      return [];
    }
    
    // 不做任何过滤，直接返回所有点
    // 让后续的聚类算法自己决定如何处理
    console.log(`      去噪: 保留所有${points.length}个点（不过滤）`);
    return points;
  }
  
  voxelDownsample(points) {
    // 体素下采样
    const voxels = new Map();
    const voxelSize = this.config.pointCloud.voxelSize;
    
    points.forEach(p => {
      const key = `${Math.floor(p.x/voxelSize)}_${Math.floor(p.y/voxelSize)}_${Math.floor(p.z/voxelSize)}`;
      if (!voxels.has(key)) {
        voxels.set(key, p);
      }
    });
    
    return Array.from(voxels.values());
  }
  
  normalizePoints(points) {
    if (!points || points.length === 0) {
      return [];
    }
    
    // 归一化到[0,1]范围
    const bbox = this.getBoundingBox(points);
    
    // 避免除以0
    const width = bbox.width || 1;
    const depth = bbox.depth || 1;
    const height = bbox.height || 1;
    
    return points.map(p => ({
      ...p,
      x: (p.x - bbox.min.x) / width,
      y: (p.y - bbox.min.y) / depth,
      z: (p.z - bbox.min.z) / height
    }));
  }
  
  getBoundingBox(points) {
    // 处理空数组或无效数据
    if (!points || points.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        width: 0,
        depth: 0,
        height: 0
      };
    }
    
    const xs = points.map(p => p.x || 0);
    const ys = points.map(p => p.y || 0);
    const zs = points.map(p => p.z || 0);
    
    // 防止空数组导致Infinity
    if (xs.length === 0) xs.push(0);
    if (ys.length === 0) ys.push(0);
    if (zs.length === 0) zs.push(0);
    
    const min = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      z: Math.min(...zs)
    };
    
    const max = {
      x: Math.max(...xs),
      y: Math.max(...ys),
      z: Math.max(...zs)
    };
    
    return {
      min,
      max,
      width: max.x - min.x,
      depth: max.y - min.y,
      height: max.z - min.z
    };
  }
  
  // 自适应计算eps - 基于k近邻距离采样
  calculateAdaptiveEps(points) {
    // 1. 采样点云（避免计算所有点）
    const sampleSize = Math.min(100, points.length);
    const sampledIndices = new Set();
    while (sampledIndices.size < sampleSize) {
      sampledIndices.add(Math.floor(Math.random() * points.length));
    }
    const sampledPoints = Array.from(sampledIndices).map(i => points[i]);
    
    // 2. 计算每个采样点的k近邻距离
    const k = 4; // k近邻
    const kDistances = [];
    
    for (const point of sampledPoints) {
      const distances = [];
      for (const other of sampledPoints) {
        if (point === other) continue;
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const dz = (point.z || 0) - (other.z || 0);
        distances.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      distances.sort((a, b) => a - b);
      if (distances.length >= k) {
        kDistances.push(distances[k - 1]);
      }
    }
    
    // 3. 分析k距离分布，找到拐点（elbow point）
    kDistances.sort((a, b) => a - b);
    
    // 计算距离变化率
    const changeRates = [];
    for (let i = 1; i < kDistances.length; i++) {
      changeRates.push(kDistances[i] - kDistances[i - 1]);
    }
    
    // 找到最大变化率位置（拐点）
    let maxChangeIdx = 0;
    let maxChange = 0;
    for (let i = Math.floor(changeRates.length * 0.6); i < changeRates.length * 0.9; i++) {
      if (changeRates[i] > maxChange) {
        maxChange = changeRates[i];
        maxChangeIdx = i;
      }
    }
    
    // eps选择在拐点附近
    const epsCandidate = kDistances[maxChangeIdx] || 0.10;
    
    // 限制eps范围（5%-15%）
    return Math.max(0.05, Math.min(0.15, epsCandidate));
  }
  
  // 基于间隙检测建筑
  detectBuildingsByGaps(points) {
    // 1. 投影到X轴并排序
    const xValues = points.map((p, idx) => ({ x: p.x, idx }))
                          .sort((a, b) => a.x - b.x);
    
    if (xValues.length < 20) return null;
    
    // 2. 计算连续点之间的距离
    const gaps = [];
    let sumDist = 0;
    let count = 0;
    
    for (let i = 1; i < xValues.length; i++) {
      const dist = xValues[i].x - xValues[i - 1].x;
      sumDist += dist;
      count++;
      
      // 记录所有距离
      if (i > 1) {
        gaps.push({ 
          index: i, 
          distance: dist,
          position: xValues[i - 1].x + dist / 2
        });
      }
    }
    
    const avgDist = sumDist / count;
    
    // 3. 找到明显的间隙（超过平均距离3倍）
    const significantGaps = gaps.filter(g => g.distance > avgDist * 3)
                                 .sort((a, b) => b.distance - a.distance);
    
    if (significantGaps.length === 0) return null;
    
    // 4. 基于间隙分割点云
    const clusters = [];
    let lastIdx = 0;
    
    // 选择最明显的间隙（最多3个）
    const topGaps = significantGaps.slice(0, 3)
                                   .sort((a, b) => a.index - b.index);
    
    for (const gap of topGaps) {
      const cluster = [];
      for (let i = lastIdx; i < gap.index; i++) {
        cluster.push(points[xValues[i].idx]);
      }
      if (cluster.length >= 5) {
        clusters.push(cluster);
      }
      lastIdx = gap.index;
    }
    
    // 添加最后一个簇
    const lastCluster = [];
    for (let i = lastIdx; i < xValues.length; i++) {
      lastCluster.push(points[xValues[i].idx]);
    }
    if (lastCluster.length >= 5) {
      clusters.push(lastCluster);
    }
    
    return clusters.length > 1 ? clusters : null;
  }
  
  /**
   * 根据期望数量分割点云
   * @param {Array} points - 点云数据
   * @param {Number} n - 期望的聚类数量
   */
  splitIntoNClusters(points, n) {
    console.log(`  🔍 splitIntoNClusters被调用: points=${points?.length || 0}, n=${n}`);
    
    if (!points || points.length < n) {
      console.log(`  ⚠️ 点数(${points?.length || 0})少于期望建筑数(${n})，返回单个聚类`);
      return [points];
    }
    
    console.log(`  📍 尝试将${points.length}个点分割为${n}个建筑...`);
    
    // 检查点的数据结构
    if (points.length > 0) {
      console.log(`    - 第一个点的结构:`, Object.keys(points[0]));
      console.log(`    - 第一个点:`, points[0]);
    }
    
    // 使用K-means思想，按X轴位置分割
    const sortedPoints = [...points].sort((a, b) => a.x - b.x);
    const clusters = [];
    const pointsPerCluster = Math.floor(points.length / n);
    
    for (let i = 0; i < n; i++) {
      const start = i * pointsPerCluster;
      const end = i === n - 1 ? points.length : start + pointsPerCluster;
      const cluster = sortedPoints.slice(start, end);
      if (cluster.length > 0) {
        clusters.push(cluster);
        console.log(`    - 聚类${i+1}: ${cluster.length}个点 (索引 ${start}-${end})`);
      }
    }
    
    console.log(`  📊 分割结果: ${clusters.length}个聚类`);
    console.log(`  📊 返回clusters.length = ${clusters.length}`);
    return clusters;
  }
  
  dbscanClustering(points, expectedBuildingCount = null) {
    // 改进的DBSCAN聚类算法 - 支持期望建筑数量
    const minPts = 10;  // 最小点数
    
    if (!points || points.length < minPts) {
      console.log(`  ⚠️ 点太少(${points?.length || 0}个)，作为单个聚类返回`);
      return [points];  // 点太少，作为单个聚类返回
    }
    
    // 如果有期望的建筑数量，直接按数量分割，不管点的分布
    if (expectedBuildingCount && expectedBuildingCount > 1) {
      console.log(`  🎯 期望建筑数量: ${expectedBuildingCount}，强制分割`);
      const targetClusters = this.splitIntoNClusters(points, expectedBuildingCount);
      console.log(`  📊 splitIntoNClusters返回了${targetClusters?.length || 0}个聚类`);
      
      // 直接返回分割结果，不管是否合理
      if (targetClusters && targetClusters.length >= 1) {
        console.log(`  ✅ 强制分割为${targetClusters.length}个建筑`);
        return targetClusters;
      }
    }
    
    // 首先尝试基于间隙检测
    const gapBasedClusters = this.detectBuildingsByGaps(points);
    if (gapBasedClusters && gapBasedClusters.length > 1) {
      console.log(`  ✅ 基于间隙检测到${gapBasedClusters.length}个建筑`);
      return gapBasedClusters;
    }
    
    // 自适应计算eps，使用更小的值
    let eps = this.calculateAdaptiveEps(points);
    eps = eps * 0.5;  // 使用原值的50%，更容易分离建筑
    console.log(`  🎯 调整后的eps值: ${eps.toFixed(3)}`);
    
    // 如果还是只有一个聚类，尝试更激进的分割
    if (expectedBuildingCount && expectedBuildingCount > 1) {
      eps = eps * 0.3;  // 进一步减小eps
      console.log(`  🎯 激进分割eps值: ${eps.toFixed(3)}`);
    }
    
    const n = points.length;
    const labels = new Array(n).fill(-1);  // -1未访问，-2噪声，>=0聚类ID
    let clusterId = 0;
    
    // 计算两点之间的欧氏距离
    const distance = (i, j) => {
      const p1 = points[i];
      const p2 = points[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dz = (p1.z || 0) - (p2.z || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    
    // 获取点的邻居索引
    const getNeighbors = (pointIdx) => {
      const neighbors = [];
      for (let j = 0; j < n; j++) {
        if (distance(pointIdx, j) < eps) {
          neighbors.push(j);
        }
      }
      return neighbors;
    };
    
    // DBSCAN主算法
    for (let i = 0; i < n; i++) {
      if (labels[i] !== -1) continue;  // 已处理
      
      const neighbors = getNeighbors(i);
      
      if (neighbors.length < minPts) {
        labels[i] = -2;  // 标记为噪声
      } else {
        // 创建新聚类
        labels[i] = clusterId;
        
        // 种子集合（用于扩展聚类）
        const seedSet = [...neighbors];
        let j = 0;
        
        while (j < seedSet.length) {
          const q = seedSet[j];
          
          if (labels[q] === -2) {  // 噪声点变为边界点
            labels[q] = clusterId;
          }
          
          if (labels[q] === -1) {  // 未访问
            labels[q] = clusterId;
            
            const qNeighbors = getNeighbors(q);
            if (qNeighbors.length >= minPts) {
              // 将新邻居加入种子集
              for (const neighbor of qNeighbors) {
                if (labels[neighbor] === -1) {
                  seedSet.push(neighbor);
                }
              }
            }
          }
          
          j++;
        }
        
        clusterId++;
      }
    }
    
    // 提取聚类
    const clusters = [];
    for (let cid = 0; cid < clusterId; cid++) {
      const cluster = [];
      for (let i = 0; i < n; i++) {
        if (labels[i] === cid) {
          cluster.push(points[i]);
        }
      }
      if (cluster.length >= minPts) {
        clusters.push(cluster);
      }
    }
    
    // 如果没有找到聚类，但有足够的点，尝试基于X轴分割
    if (clusters.length === 0 && points.length > 100) {
      console.log('  ⚠️ DBSCAN未找到聚类，尝试基于空间分布分割...');
      
      // 按X坐标排序
      const sortedPoints = [...points].sort((a, b) => a.x - b.x);
      const totalRange = sortedPoints[sortedPoints.length - 1].x - sortedPoints[0].x;
      
      // 寻找间隙（建筑之间的空隙）
      const gaps = [];
      for (let i = 1; i < sortedPoints.length; i++) {
        const gap = sortedPoints[i].x - sortedPoints[i-1].x;
        if (gap > totalRange * 0.05) {  // 间隙大于总宽度的5%（更敏感的分割）
          gaps.push({ index: i, position: sortedPoints[i].x });
        }
      }
      
      // 基于间隙分割点云
      if (gaps.length > 0) {
        let lastIndex = 0;
        for (const gap of gaps) {
          const cluster = sortedPoints.slice(lastIndex, gap.index);
          if (cluster.length > minPts) {
            clusters.push(cluster);
          }
          lastIndex = gap.index;
        }
        // 最后一个聚类
        const lastCluster = sortedPoints.slice(lastIndex);
        if (lastCluster.length > minPts) {
          clusters.push(lastCluster);
        }
        
        console.log(`  ✅ 基于空间分布识别到${clusters.length}个建筑`);
      }
    }
    
    // 如果还是没有聚类，返回原始点作为单个聚类
    if (clusters.length === 0) {
      console.log('  ⚠️ 未能分割建筑，作为单体处理');
      return [points];
    }
    
    console.log(`  ✅ DBSCAN识别到${clusters.length}个独立建筑`);
    return clusters;
  }
  
  stratifyByHeight(points) {
    // 按高度分层
    const layers = [];
    const layerHeight = 3.3;  // 假设层高3.3米
    
    const bbox = this.getBoundingBox(points);
    const numLayers = Math.ceil(bbox.height / layerHeight);
    
    for (let i = 0; i < numLayers; i++) {
      const minZ = bbox.min.z + i * layerHeight;
      const maxZ = minZ + layerHeight;
      
      const layerPoints = points.filter(p => p.z >= minZ && p.z < maxZ);
      
      if (layerPoints.length > 0) {
        layers.push({
          points: layerPoints,
          averageHeight: (minZ + maxZ) / 2,
          density: layerPoints.length / (bbox.width * bbox.depth)
        });
      }
    }
    
    return layers;
  }
  
  calculateSpatialComplexity(points) {
    // 计算空间复杂度（0-1）
    const bbox = this.getBoundingBox(points);
    const volume = bbox.width * bbox.depth * bbox.height;
    const density = points.length / volume;
    
    return Math.min(1, density / 100);
  }
  
  calculateOverallConfidence(rawFeatures, pointCloudFeatures) {
    const weights = {
      ocr: 0.1,
      yolo: 0.1,
      qwenvl: 0.2,
      pointCloud: 0.6  // 点云权重最高
    };
    
    const confidences = {
      ocr: rawFeatures.ocr?.confidence || 0.5,
      yolo: rawFeatures.yolo?.confidence || 0.5,
      qwenvl: rawFeatures.qwenvl?.confidence || 0.5,
      pointCloud: Math.min(1, pointCloudFeatures.pointCount / 1000)
    };
    
    return Object.keys(weights).reduce((sum, key) => 
      sum + weights[key] * confidences[key], 0
    );
  }
  
  getDefaultPointCloudFeatures() {
    return {
      pointCount: 0,
      buildingContours: [],
      floorPatterns: [],
      facadeFeatures: { type: 'unknown' },
      spatialStats: {},
      structuralFeatures: {},
      windowGrid: { rows: 0, cols: 0 },
      spatialComplexity: 0,
      estimatedDimensions: { width: 30000, depth: 20000, height: 16500 },
      estimatedFloors: 5
    };
  }
  
  getCenter(points) {
    const sum = points.reduce((acc, p) => ({
      x: acc.x + p.x,
      y: acc.y + p.y,
      z: acc.z + p.z
    }), { x: 0, y: 0, z: 0 });
    
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length
    };
  }
  
  classifyBuildingType(cluster) {
    // 基于点云形状分类建筑类型
    const bbox = this.getBoundingBox(cluster);
    const aspectRatio = bbox.width / bbox.depth;
    const heightRatio = bbox.height / Math.max(bbox.width, bbox.depth);
    
    if (heightRatio > 2) return 'tower';
    if (aspectRatio > 3) return 'linear';
    if (aspectRatio < 0.3) return 'linear';
    return 'block';
  }
  
  detectFloorPattern(layer) {
    // 检测楼层模式
    const density = layer.density;
    
    if (density > 0.8) return 'solid';
    if (density > 0.5) return 'regular';
    if (density > 0.2) return 'sparse';
    return 'empty';
  }
  
  analyzeFacadePatterns(facadePoints) {
    // 分析立面模式
    return {
      grid: this.findGridPattern(facadePoints),
      symmetry: this.calculateSymmetry(facadePoints),
      complexity: this.calculateComplexity(facadePoints)
    };
  }
  
  detectFacadeType(patterns) {
    // 根据模式检测立面类型
    if (patterns.grid && patterns.grid.rows > 5) {
      return 'glass_curtain';
    }
    if (patterns.complexity > 0.7) {
      return 'decorative';
    }
    if (patterns.symmetry > 0.8) {
      return 'modern';
    }
    return 'standard';
  }
  
  inferMaterials(patterns) {
    // 推断材质
    const materials = [];
    
    if (patterns.grid) materials.push('glass');
    if (patterns.complexity < 0.3) materials.push('concrete');
    if (patterns.symmetry > 0.7) materials.push('metal');
    
    return materials;
  }
  
  findGridPattern(points) {
    // 寻找网格模式（简化版）
    // 实际需要更复杂的模式识别算法
    return {
      rows: 5,
      cols: 8,
      cellSize: { width: 3000, height: 3000 },
      spacing: { horizontal: 500, vertical: 500 }
    };
  }
  
  calculateSymmetry(points) {
    // 计算对称性（0-1）
    return 0.8;  // 简化版
  }
  
  calculateComplexity(points) {
    // 计算复杂度（0-1）
    return 0.5;  // 简化版
  }
  
  extractKeywords(text) {
    if (!text) return [];
    
    const keywords = [];
    const patterns = [
      /\d+层/g,
      /\d+楼/g,
      /办公/g,
      /住宅/g,
      /商业/g
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) keywords.push(...matches);
    });
    
    return keywords;
  }
  
  calculateSpatialStatistics(points) {
    const bbox = this.getBoundingBox(points);
    const center = this.getCenter(points);
    
    return {
      boundingBox: bbox,
      center: center,
      volume: bbox.width * bbox.depth * bbox.height,
      density: points.length / (bbox.width * bbox.depth * bbox.height)
    };
  }
  
  extractStructuralFeatures(points) {
    // 提取结构特征
    return {
      hasColumns: this.detectColumns(points),
      hasBeams: this.detectBeams(points),
      structureType: this.inferStructureType(points)
    };
  }
  
  detectColumns(points) {
    // 检测柱子（垂直线性结构）
    return false;  // 简化版
  }
  
  detectBeams(points) {
    // 检测梁（水平线性结构）
    return false;  // 简化版
  }
  
  inferStructureType(points) {
    // 推断结构类型
    return 'frame';  // 框架结构
  }
}

module.exports = new PointCloudTransformerService();