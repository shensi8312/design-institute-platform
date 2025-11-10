/**
 * CV+VL结果融合服务
 * 将OpenCV几何检测结果 + QwenVL语义识别结果 融合为统一的JSON Schema
 */

const axios = require('axios');
const QwenVLService = require('./qwenVLService');

class CVVLFusionService {
  
  /**
   * 主要入口：融合CV几何检测 + VL语义识别
   * @param {Buffer} imageBuffer - 原始图片
   * @param {Object} imageInfo - 图片信息 {width, height}
   * @param {Object} options - 配置选项
   * @returns {Object} 融合后的结果
   */
  async analyzeBuildingWithFusion(imageBuffer, imageInfo, options = {}) {
    console.log('🔄 开始CV+VL混合分析...');
    
    try {
      // 并行调用CV几何检测和VL语义识别
      const [cvResult, vlResult] = await Promise.allSettled([
        this.callCVGeometryDetection(imageBuffer),
        this.callVLSemanticAnalysis(imageBuffer)
      ]);
      
      // 检查结果状态
      const cvData = cvResult.status === 'fulfilled' ? cvResult.value : null;
      const vlData = vlResult.status === 'fulfilled' ? vlResult.value : null;
      
      console.log(`CV检测状态: ${cvData?.success ? '✅成功' : '❌失败'}`);
      console.log(`VL识别状态: ${vlData?.success ? '✅成功' : '❌失败'}`);
      
      // 结果融合
      const fusedResult = this.fuseResults(cvData, vlData, imageInfo);
      
      console.log('✅ CV+VL融合完成');
      return fusedResult;
      
    } catch (error) {
      console.error('❌ CV+VL混合分析失败:', error);
      return this.generateFallbackResult(imageInfo);
    }
  }
  
  /**
   * 调用OpenCV几何检测服务
   */
  async callCVGeometryDetection(imageBuffer) {
    try {
      console.log('🔧 调用CV几何检测...');
      
      const base64Image = imageBuffer.toString('base64');
      const response = await axios.post('http://localhost:8088/api/detect-geometry', {
        image_base64: base64Image
      }, { 
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = response.data;
      console.log(`CV检测: 质量${(result.quality_score * 100).toFixed(0)}%, 线段${result.lines?.count || 0}条`);
      
      return result;
      
    } catch (error) {
      console.error('❌ CV几何检测失败:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 调用VL语义识别服务
   */
  async callVLSemanticAnalysis(imageBuffer) {
    try {
      console.log('🧠 调用VL语义分析...');
      
      const result = await QwenVLService.analyzeBuildingSemantics(imageBuffer, {
        temperature: 0.1,
        max_tokens: 2000
      });
      
      if (result.success && result.data) {
        console.log(`VL识别: ${result.data.building_count || 0}栋建筑`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ VL语义识别失败:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 融合CV几何数据和VL语义数据
   */
  fuseResults(cvData, vlData, imageInfo) {
    console.log('🔗 开始结果融合...');
    
    // 基础结构
    const fusedResult = {
      success: true,
      fusion_info: {
        cv_available: cvData?.success || false,
        vl_available: vlData?.success || false,
        cv_quality: cvData?.quality_score || 0,
        vl_confidence: this.extractVLConfidence(vlData),
        fusion_strategy: 'cv_geometry_vl_semantics'
      },
      view_type: 'two_point',
      building_count: 0,
      volumes: [],
      connectors: [],
      vanishing_points_norm: null,
      image_info: imageInfo
    };
    
    // 1. 提取几何信息（优先CV）
    if (cvData?.success && cvData.quality_score > 0.5) {
      console.log('✅ 使用CV几何数据');
      fusedResult.vanishing_points_norm = cvData.vanishing_points;
      fusedResult.cv_geometry = {
        lines: cvData.lines,
        corners: cvData.corners,
        footprints: cvData.footprints,
        quality_score: cvData.quality_score
      };
    } else {
      console.log('⚠️ CV几何质量不足，使用默认几何');
      fusedResult.vanishing_points_norm = {
        vx_left: [0.2, 0.5],
        vx_right: [0.8, 0.5],
        confidence: 0.3
      };
    }
    
    // 2. 提取语义信息（优先VL）
    if (vlData?.success && vlData.data) {
      console.log('✅ 使用VL语义数据');
      
      const vlSemantics = vlData.data;
      fusedResult.building_count = vlSemantics.building_count || 0;
      fusedResult.view_type = vlSemantics.view_type || 'two_point';
      fusedResult.scene_description = vlSemantics.scene_description;
      
      // 转换VL的buildings为标准volumes格式
      if (vlSemantics.buildings && vlSemantics.buildings.length > 0) {
        fusedResult.volumes = this.convertVLBuildingsToVolumes(
          vlSemantics.buildings, 
          cvData?.footprints, 
          imageInfo
        );
      }
      
      // 转换空间关系为connectors
      if (vlSemantics.spatial_relationships) {
        fusedResult.connectors = this.convertSpatialRelationsToConnectors(
          vlSemantics.spatial_relationships
        );
      }
      
      fusedResult.vl_semantics = {
        perspective_analysis: vlSemantics.perspective_analysis,
        original_buildings: vlSemantics.buildings
      };
      
    } else {
      console.log('⚠️ VL语义识别失败，使用默认语义');
      fusedResult.building_count = 1;
      fusedResult.volumes = [this.generateDefaultVolume(imageInfo)];
    }
    
    // 3. 质量评估
    fusedResult.fusion_quality = this.assessFusionQuality(cvData, vlData);
    
    console.log(`融合完成: ${fusedResult.building_count}栋建筑, 质量${(fusedResult.fusion_quality.total_score * 100).toFixed(0)}%`);
    
    return fusedResult;
  }
  
  /**
   * 将VL的buildings转换为标准volumes格式
   */
  convertVLBuildingsToVolumes(vlBuildings, cvFootprints, imageInfo) {
    return vlBuildings.map((building, index) => {
      // 基础信息来自VL
      const volume = {
        id: building.id || `v${index + 1}`,
        name: building.name || `建筑${index + 1}`,
        role: building.role || 'main',
        building_type: building.building_type,
        architectural_style: building.architectural_style,
        confidence: building.confidence || 0.7
      };
      
      // 几何信息：优先使用CV检测的脚印
      if (cvFootprints && cvFootprints[index]) {
        volume.footprint_px = cvFootprints[index];
        volume.geometry_source = 'cv_detection';
      } else {
        // 生成估算脚印
        volume.footprint_px = this.estimateFootprintFromSemantics(
          building, index, imageInfo
        );
        volume.geometry_source = 'estimated';
      }
      
      // 包围盒
      if (volume.footprint_px) {
        const xs = volume.footprint_px.map(p => p[0]);
        const ys = volume.footprint_px.map(p => p[1]);
        volume.bbox_px = [
          Math.min(...xs), Math.min(...ys),
          Math.max(...xs), Math.max(...ys)
        ];
      }
      
      // 尺寸和层数信息来自VL
      if (building.scale_info) {
        volume.levels = building.scale_info.levels || 3;
        volume.size_hint = {
          w: building.scale_info.size_ratio || 1.0,
          d: building.scale_info.size_ratio * 0.8 || 0.8,
          h: (building.scale_info.levels || 3) * 0.15 // 每层按0.15相对高度
        };
      }
      
      // 视觉特征
      volume.visual_features = building.visual_features;
      
      return volume;
    });
  }
  
  /**
   * 从语义信息估算脚印
   */
  estimateFootprintFromSemantics(building, index, imageInfo) {
    const { width, height } = imageInfo;
    
    // 根据building的relative_size确定大小
    let sizeFactor = 0.3; // 默认中等大小
    if (building.scale_info?.relative_size === 'large') sizeFactor = 0.4;
    if (building.scale_info?.relative_size === 'small') sizeFactor = 0.2;
    
    // 根据index确定位置（简单布局）
    const baseX = width * (0.3 + index * 0.2);
    const baseY = height * 0.6;
    
    const w = width * sizeFactor;
    const h = height * sizeFactor * 0.6;
    
    return [
      [baseX - w/2, baseY - h/2],
      [baseX + w/2, baseY - h/2],
      [baseX + w/2, baseY + h/2],
      [baseX - w/2, baseY + h/2]
    ];
  }
  
  /**
   * 转换空间关系为connectors
   */
  convertSpatialRelationsToConnectors(spatialRelations) {
    return spatialRelations
      .filter(rel => rel.relationship === 'connected')
      .map(rel => ({
        from: rel.from,
        to: rel.to,
        type: rel.connection_type === 'bridge' ? 'bridge' : 'corridor',
        width_hint: 0.2, // 默认20%宽度
        height_hint: 0.15,
        elev_hint: rel.connection_level || 2,
        confidence: rel.confidence || 0.7
      }));
  }
  
  /**
   * 评估融合质量
   */
  assessFusionQuality(cvData, vlData) {
    let geometryScore = 0;
    let semanticsScore = 0;
    
    // 几何质量评估
    if (cvData?.success) {
      geometryScore = cvData.quality_score || 0;
    } else {
      geometryScore = 0.2; // 默认几何质量
    }
    
    // 语义质量评估
    if (vlData?.success && vlData.data) {
      const data = vlData.data;
      if (data.buildings && data.buildings.length > 0) {
        const avgConfidence = data.buildings.reduce((sum, b) => 
          sum + (b.confidence || 0.5), 0) / data.buildings.length;
        semanticsScore = avgConfidence;
      } else {
        semanticsScore = 0.3;
      }
    } else {
      semanticsScore = 0.2;
    }
    
    const totalScore = (geometryScore * 0.6 + semanticsScore * 0.4);
    
    return {
      geometry_score: geometryScore,
      semantics_score: semanticsScore,
      total_score: totalScore,
      quality_level: totalScore > 0.7 ? 'high' : totalScore > 0.4 ? 'medium' : 'low'
    };
  }
  
  /**
   * 提取VL置信度
   */
  extractVLConfidence(vlData) {
    if (!vlData?.success || !vlData.data?.buildings) return 0;
    
    const buildings = vlData.data.buildings;
    const avgConfidence = buildings.reduce((sum, b) => sum + (b.confidence || 0.5), 0) / buildings.length;
    return avgConfidence;
  }
  
  /**
   * 生成默认volume
   */
  generateDefaultVolume(imageInfo) {
    return {
      id: 'v1',
      name: '建筑1',
      role: 'main',
      building_type: 'unknown',
      footprint_px: this.generateDefaultFootprint(imageInfo),
      bbox_px: [
        imageInfo.width * 0.3, imageInfo.height * 0.4,
        imageInfo.width * 0.7, imageInfo.height * 0.8
      ],
      size_hint: { w: 1.0, d: 0.8, h: 0.6 },
      levels: 3,
      confidence: 0.3,
      geometry_source: 'default'
    };
  }
  
  /**
   * 生成默认脚印
   */
  generateDefaultFootprint(imageInfo) {
    const cx = imageInfo.width / 2;
    const cy = imageInfo.height * 0.6;
    const w = imageInfo.width * 0.2;
    const h = imageInfo.height * 0.15;
    
    return [
      [cx - w, cy - h],
      [cx + w, cy - h],
      [cx + w, cy + h],
      [cx - w, cy + h]
    ];
  }
  
  /**
   * 生成后备结果
   */
  generateFallbackResult(imageInfo = {width: 800, height: 600}) {
    return {
      success: false,
      fusion_info: {
        cv_available: false,
        vl_available: false,
        error: 'Both CV and VL services failed',
        fusion_strategy: 'fallback'
      },
      building_count: 1,
      view_type: 'two_point',
      vanishing_points_norm: {
        vx_left: [0.2, 0.5],
        vx_right: [0.8, 0.5],
        confidence: 0.1
      },
      volumes: [this.generateDefaultVolume(imageInfo)],
      connectors: [],
      fusion_quality: {
        geometry_score: 0.1,
        semantics_score: 0.1,
        total_score: 0.1,
        quality_level: 'low'
      }
    };
  }
}

module.exports = new CVVLFusionService();