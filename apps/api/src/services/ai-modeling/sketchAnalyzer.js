/**
 * 草图分析器 - 协调QwenVL和其他服务
 */

const qwenVLService = require('./qwenVLService');
const DirectWhiteBoxGenerator = require('./directWhiteBoxGenerator');
const PerspectiveCalibration = require('./perspectiveCalibration');

class SketchAnalyzer {
  
  /**
   * 分析草图并生成3D数据
   * @param {Buffer} imageBuffer - 图片buffer
   * @param {Object} options - 选项
   * @returns {Object} 分析结果
   */
  async analyze(imageBuffer, options = {}) {
    console.log('\n========== 草图分析开始 ==========');
    
    try {
      // 1. 调用QwenVL识别
      console.log('📷 步骤1: 调用QwenVL识别...');
      const qwenResult = await qwenVLService.analyzeBuildingSketch(imageBuffer, {
        prompt: options.customPrompt || qwenVLService.getTwoPointPrompt()
      });
      
      console.log('✅ QwenVL识别完成');
      console.log('  - 格式:', qwenResult.format);
      console.log('  - 成功:', qwenResult.success);
      
      if (!qwenResult.success || !qwenResult.data) {
        throw new Error('QwenVL识别失败');
      }
      
      // 2. 转换为统一格式
      const analysisData = this.normalizeQwenResponse(qwenResult.data);
      console.log('  - 建筑数量:', analysisData.building_count || 0);
      console.log('  - 连廊数量:', analysisData.connectors?.length || 0);
      
      // 3. 生成3D数据（两种路线）
      console.log('\n📐 步骤2: 生成3D数据...');
      const result = this.generate3DData(analysisData, options);
      
      console.log('✅ 分析完成');
      
      return {
        success: true,
        qwenResult: qwenResult.data,
        analysis: analysisData,
        ...result
      };
      
    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 标准化QwenVL响应
   */
  normalizeQwenResponse(qwenData) {
    // 如果是新格式（Two-Point）
    if (qwenData.view_type === 'two_point') {
      return qwenData;
    }
    
    // 如果是旧格式，转换
    const normalized = {
      building_count: qwenData.building_count || qwenData.count || 0,
      view_type: qwenData.view_type || 'perspective',
      volumes: [],
      connectors: []
    };
    
    // 转换buildings/volumes/instances
    const buildings = qwenData.buildings || qwenData.volumes || qwenData.instances || [];
    normalized.volumes = buildings.map((b, i) => ({
      id: b.id || `v${i+1}`,
      name: b.name || `建筑${i+1}`,
      role: b.type === '主体' ? 'main' : b.type === '附属' ? 'annex' : 'connector',
      size_hint: {
        w: b.dimensions?.width || b.size?.w || null,
        d: b.dimensions?.depth || b.size?.d || null,
        h: b.dimensions?.height || b.size?.h || null
      },
      levels: b.floors?.count || b.levels || null,
      confidence: b.confidence || 0.8,
      // 保留原始数据
      ...b
    }));
    
    // 保留连廊信息
    normalized.connectors = qwenData.connectors || [];
    
    return normalized;
  }
  
  /**
   * 生成3D数据
   */
  generate3DData(analysisData, options) {
    const imageInfo = {
      width: options.imageWidth || 1024,
      height: options.imageHeight || 768,
      filename: options.filename || 'sketch.jpg'
    };
    
    // 判断使用哪条路线
    const hasCalibration = !!(
      analysisData.calibration?.img_rect_px && 
      analysisData.calibration.img_rect_px.length === 4
    );
    
    const hasFootprints = analysisData.volumes?.some(v => 
      v.footprint_px && v.footprint_px.length >= 4
    );
    
    const result = {
      routeA: null,
      routeB: null,
      recommendation: null
    };
    
    // 路线A：透视标定（有标定矩形或脚印）
    if (hasCalibration || hasFootprints) {
      try {
        result.routeA = {
          type: 'perspective_calibration',
          data: PerspectiveCalibration.generateCalibrationJSON(analysisData, imageInfo),
          description: '透视标定路线'
        };
      } catch (e) {
        console.warn('路线A生成失败:', e.message);
      }
    }
    
    // 路线B：直接生成（总是可用）
    try {
      const rubyGeneration = DirectWhiteBoxGenerator.generateRubyCode({
        modeling: { buildings: this.convertToModelingFormat(analysisData) },
        ...analysisData
      });
      
      result.routeB = {
        type: 'direct_generation',
        rubyCode: rubyGeneration.rubyCode,
        buildings: rubyGeneration.buildings,
        description: '直接生成路线'
      };
    } catch (e) {
      console.warn('路线B生成失败:', e.message);
    }
    
    // 推荐路线
    if (result.routeA && (hasCalibration || hasFootprints)) {
      result.recommendation = {
        route: 'A',
        reason: '有标定数据或像素轮廓，使用透视标定更精确',
        confidence: 0.9
      };
    } else {
      result.recommendation = {
        route: 'B',
        reason: '使用世界坐标直接生成',
        confidence: 0.8
      };
    }
    
    return result;
  }
  
  /**
   * 转换为modeling格式（用于路线B）
   */
  convertToModelingFormat(analysisData) {
    return analysisData.volumes.map(v => ({
      id: v.id,
      name: v.name,
      position: {
        x: (v.size_hint?.w || 15) * (parseInt(v.id.replace('v', '')) - 2) * 1.5 * 1000, // 自动排列
        y: 0,
        z: 0
      },
      dimensions: {
        width: (v.size_hint?.w || 15) * 1000,
        depth: (v.size_hint?.d || 10) * 1000,
        height: (v.size_hint?.h || ((v.levels || 3) * 3.2)) * 1000
      },
      floors: {
        count: v.levels || 3
      }
    }));
  }
}

module.exports = new SketchAnalyzer();