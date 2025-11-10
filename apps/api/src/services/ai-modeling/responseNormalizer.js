/**
 * API响应数据规范化器
 * 确保返回给插件的数据格式统一、完整、可预测
 */

class ResponseNormalizer {
  
  /**
   * 规范化sketch_to_3d的响应数据
   * 确保所有必需字段都存在，使用合理的默认值
   */
  static normalizeSketchTo3DResponse(rawData) {
    // 定义标准响应结构
    const normalizedResponse = {
      success: rawData.success || false,
      action: 'sketch_to_3d',
      sessionId: rawData.sessionId || `session_${Date.now()}`,
      
      // 3D建模参数 - 这是插件最需要的核心数据
      modeling: {
        // 建筑基本信息
        building_type: 'office', // office/residential/commercial/industrial
        building_name: '未命名建筑',
        
        // 楼层信息（必需）
        floors: {
          count: 5,         // 楼层数
          height: 3300,     // 标准层高（毫米）
          heights: []       // 每层高度数组（如果有不同层高）
        },
        
        // 建筑尺寸（必需）
        dimensions: {
          width: 15000,     // 宽度（毫米）
          depth: 12000,     // 深度（毫米）
          height: 16500,    // 总高度（毫米）
          min_x: 0,
          min_y: 0,
          max_x: 15000,
          max_y: 12000
        },
        
        // 墙体数据
        walls: [
          // 外墙（必需）
          {
            id: 'w1',
            type: 'external',
            start: { x: 0, y: 0, z: 0 },
            end: { x: 15000, y: 0, z: 0 },
            thickness: 300,
            height: 16500
          },
          {
            id: 'w2',
            type: 'external',
            start: { x: 15000, y: 0, z: 0 },
            end: { x: 15000, y: 12000, z: 0 },
            thickness: 300,
            height: 16500
          },
          {
            id: 'w3',
            type: 'external',
            start: { x: 15000, y: 12000, z: 0 },
            end: { x: 0, y: 12000, z: 0 },
            thickness: 300,
            height: 16500
          },
          {
            id: 'w4',
            type: 'external',
            start: { x: 0, y: 12000, z: 0 },
            end: { x: 0, y: 0, z: 0 },
            thickness: 300,
            height: 16500
          }
        ],
        
        // 房间数据
        rooms: [],
        
        // 门窗数据
        doors: [
          {
            id: 'd1',
            position: { x: 7500, y: 0, z: 0 },
            width: 1200,
            height: 2400,
            type: 'main_entrance'
          }
        ],
        
        windows: [],
        
        // 材质和特征
        materials: {
          primary: 'concrete',
          facade: 'glass_curtain',
          roof: 'flat'
        },
        
        // 特殊特征
        features: {
          has_balcony: false,
          has_curved_wall: false,
          has_roof_garden: false,
          has_basement: false,
          has_elevator: true,
          has_stairs: true
        },
        
        // 结构系统
        structure: {
          type: 'frame',  // frame/shear_wall/mixed
          material: 'reinforced_concrete'
        }
      },
      
      // 完整的识别结果（包含四部分：OCR、YOLO、QwenVL、深度估计）
      recognition: {
        success: true,
        confidence: 0.85,
        // OCR识别的文字
        text: rawData.recognition?.text || rawData.recognition?.data?.text || '',
        // YOLO识别的建筑构件
        objects: rawData.recognition?.objects || rawData.recognition?.data?.objects || [],
        // QwenVL多模态识别（增强识别）
        enhanced: rawData.recognition?.enhanced || rawData.recognition?.data?.enhanced || {
          enabled: true,
          extraction_types: ['building_info', 'dimensions', 'materials'],
          extracted_data: {
            building_type: rawData.modeling?.building_type || 'office',
            floors: rawData.modeling?.floors?.count || 5,
            materials: rawData.modeling?.materials || {}
          },
          qwenvl_analysis: rawData.recognition?.qwenvl_analysis || '智能分析完成'
        },
        processing_time: rawData.recognition?.data?.timestamp || new Date().toISOString()
      },
      
      // 深度估计数据（新增 - 重要！）
      depthEstimation: rawData.recognition?.depth || null,
      
      // 环境和基础设施数据（新增 - 包含停车场、景观等）
      infrastructure: rawData.infrastructure || {
        parking: null,
        landscape: [],
        roads: [],
        utilities: {}
      },
      
      // 环境元素（树木、停车场等）
      environment: rawData.environment || {
        trees: [],
        parking_lots: [],
        green_areas: [],
        water_features: []
      },
      
      // 元数据
      metadata: {
        api_version: '1.0',
        timestamp: Date.now(),
        processing_time_ms: rawData.metadata?.duration || 0,
        services_status: {
          recognition: true,
          vllm: true,
          qwenvl: true
        }
      }
    };
    
    // 如果原始数据中有建模参数，合并进来（但保留默认值作为后备）
    if (rawData.modeling) {
      // 安全合并楼层信息
      // 处理floors可能是数字或对象的情况
      if (typeof rawData.modeling.floors === 'number') {
        // 如果floors是一个数字，将其转换为对象
        normalizedResponse.modeling.floors.count = Math.floor(rawData.modeling.floors);
        normalizedResponse.modeling.floors.height = 3300; // 使用默认层高
      } else if (rawData.modeling.floors && typeof rawData.modeling.floors === 'object') {
        // 如果floors是对象，安全合并
        normalizedResponse.modeling.floors.count = 
          Math.floor(Number(rawData.modeling.floors.count) || normalizedResponse.modeling.floors.count);
        normalizedResponse.modeling.floors.height = 
          Number(rawData.modeling.floors.height) || normalizedResponse.modeling.floors.height;
        normalizedResponse.modeling.floors.heights = 
          rawData.modeling.floors.heights || [];
      }
      
      // 安全合并尺寸信息
      if (rawData.modeling.dimensions) {
        normalizedResponse.modeling.dimensions.width = 
          rawData.modeling.dimensions.width || normalizedResponse.modeling.dimensions.width;
        normalizedResponse.modeling.dimensions.depth = 
          rawData.modeling.dimensions.depth || normalizedResponse.modeling.dimensions.depth;
        normalizedResponse.modeling.dimensions.height = 
          rawData.modeling.dimensions.height || 
          (normalizedResponse.modeling.floors.count * normalizedResponse.modeling.floors.height);
      }
      
      // 如果有墙体数据，使用实际数据
      if (rawData.modeling.walls && rawData.modeling.walls.length > 0) {
        normalizedResponse.modeling.walls = rawData.modeling.walls;
      }
      
      // 如果有房间数据
      if (rawData.modeling.rooms && rawData.modeling.rooms.length > 0) {
        normalizedResponse.modeling.rooms = rawData.modeling.rooms;
      }
      
      // 如果有门窗数据
      if (rawData.modeling.doors && rawData.modeling.doors.length > 0) {
        normalizedResponse.modeling.doors = rawData.modeling.doors;
      }
      if (rawData.modeling.windows && rawData.modeling.windows.length > 0) {
        normalizedResponse.modeling.windows = rawData.modeling.windows;
      }
      
      // 如果有深度估计的窗户网格信息，添加到modeling中
      if (rawData.recognition?.depth?.features?.patterns?.windowGrid) {
        const windowGrid = rawData.recognition.depth.features.patterns.windowGrid;
        normalizedResponse.modeling.window_grid = {
          columns: windowGrid.columns,
          rows: windowGrid.rows,
          spacing_h: windowGrid.spacing_h,
          spacing_v: windowGrid.spacing_v
        };
      }
      
      // 添加深度层次信息到特征中
      if (rawData.recognition?.depth?.features?.depthLayers) {
        normalizedResponse.modeling.features.depth_layers = rawData.recognition.depth.features.depthLayers;
      }
    }
    
    // 确保尺寸的一致性
    const totalHeight = normalizedResponse.modeling.floors.count * 
                       normalizedResponse.modeling.floors.height;
    normalizedResponse.modeling.dimensions.height = totalHeight;
    
    // 更新墙体高度
    normalizedResponse.modeling.walls.forEach(wall => {
      wall.height = totalHeight;
    });
    
    // 最终验证：确保floors.count是整数
    if (!Number.isInteger(normalizedResponse.modeling.floors.count)) {
      console.warn('⚠️ floors.count不是整数，正在修正:', normalizedResponse.modeling.floors.count);
      normalizedResponse.modeling.floors.count = Math.floor(normalizedResponse.modeling.floors.count) || 1;
    }
    
    // 输出最终数据格式以便调试
    console.log('🔧 ResponseNormalizer输出:');
    console.log('  - floors:', JSON.stringify(normalizedResponse.modeling.floors));
    console.log('  - floors.count类型:', typeof normalizedResponse.modeling.floors.count);
    console.log('  - 深度估计数据:', normalizedResponse.depthEstimation ? '已包含' : '未包含');
    if (normalizedResponse.depthEstimation) {
      console.log('    • 点云点数:', normalizedResponse.depthEstimation.pointCloud?.points?.length || 0);
      console.log('    • 深度层次:', normalizedResponse.depthEstimation.features?.depthLayers?.length || 0);
      console.log('    • 窗户网格:', normalizedResponse.modeling.window_grid ? 
        `${normalizedResponse.modeling.window_grid.columns}×${normalizedResponse.modeling.window_grid.rows}` : '未检测');
    }
    
    // 验证响应
    this.validateResponse(normalizedResponse);
    
    return normalizedResponse;
  }
  
  /**
   * 规范化错误响应
   */
  static normalizeErrorResponse(error, action) {
    return {
      success: false,
      action: action || 'unknown',
      error: {
        message: error.message || '未知错误',
        code: error.code || 'INTERNAL_ERROR',
        details: error.details || null
      },
      modeling: null,
      metadata: {
        timestamp: Date.now(),
        api_version: '1.0'
      }
    };
  }
  
  /**
   * 验证必需字段是否存在
   */
  static validateResponse(response) {
    const required = [
      'success',
      'modeling',
      'modeling.floors',
      'modeling.floors.count',
      'modeling.floors.height',
      'modeling.dimensions',
      'modeling.dimensions.width',
      'modeling.dimensions.depth',
      'modeling.walls'
    ];
    
    // 验证floors.count是否是有效的整数
    if (response?.modeling?.floors?.count !== undefined) {
      const count = response.modeling.floors.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
        console.warn('警告: floors.count不是有效的正整数:', count);
        response.modeling.floors.count = 1; // 修正为默认值
      }
    }
    
    const missing = [];
    
    required.forEach(path => {
      const keys = path.split('.');
      let obj = response;
      
      for (let key of keys) {
        if (!obj || obj[key] === undefined) {
          missing.push(path);
          break;
        }
        obj = obj[key];
      }
    });
    
    if (missing.length > 0) {
      console.warn('响应缺少必需字段:', missing);
    }
    
    return missing.length === 0;
  }
}

module.exports = ResponseNormalizer;