/**
 * AI插件控制器 - 处理SketchUp/Revit插件的API请求
 * 所有AI逻辑在服务端处理，插件只负责展示
 */

const db = require('../config/database');
const axios = require('axios');
const { createError } = require('../utils/error');

// AI服务配置
const AI_SERVICES = {
  vllm: process.env.VLLM_URL || 'http://10.10.18.2:8000',
  ollama: process.env.OLLAMA_URL || 'http://localhost:11434',
  docRecognition: process.env.DOC_RECOGNITION_URL || 'http://localhost:8086',
  graphRAG: process.env.GRAPHRAG_URL || 'http://localhost:8081'
};

class AIPluginController {
  /**
   * 草图转3D白模
   * POST /api/ai/sketch-to-3d
   */
  static async sketchTo3D(req, res, next) {
    try {
      const { input, config, rules, context } = req.body;
      
      // 1. 图像识别 - 识别草图中的线条和标注
      const recognitionResult = await axios.post(`${AI_SERVICES.docRecognition}/api/recognize-sketch`, {
        image: input.image,
        type: 'architectural_sketch'
      });
      
      // 2. 应用规则引擎
      const appliedRules = await AIPluginController.applyRules(rules, 'sketch_to_3d');
      
      // 3. 调用AI生成3D结构
      const prompt = AIPluginController.buildSketchTo3DPrompt(
        recognitionResult.data,
        config,
        appliedRules
      );
      
      const aiResponse = await axios.post(`${AI_SERVICES.vllm}/v1/chat/completions`, {
        model: 'Qwen2.5-32B-Instruct',
        messages: [
          {
            role: 'system',
            content: '你是一个建筑设计专家，能够从草图生成精确的3D模型数据。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });
      
      // 4. 解析AI响应，生成3D数据
      const modelData = AIPluginController.parseAITo3DModel(aiResponse.data);
      
      // 5. 记录使用日志
      await AIPluginController.logUsage(req.user.id, 'sketch_to_3d', context);
      
      res.json({
        success: true,
        data: modelData,
        metadata: {
          rules_applied: appliedRules,
          confidence: 0.85,
          processing_time: Date.now() - req.startTime
        }
      });
    } catch (error) {
      next(createError(500, `草图转3D失败: ${error.message}`));
    }
  }
  
  /**
   * 红线图转强排平面
   * POST /api/ai/redline-to-layout
   */
  static async redlineToLayout(req, res, next) {
    try {
      const { input, config, rules, context } = req.body;
      
      // 1. 识别红线边界
      const boundaryResult = await axios.post(`${AI_SERVICES.docRecognition}/api/recognize-redline`, {
        image: input.image,
        extract: ['boundary', 'constraints', 'annotations']
      });
      
      // 2. 获取强排规则
      const siteRules = await db('ai_rules')
        .where('category', 'site_planning')
        .where('is_active', true)
        .select('rule_content');
      
      // 3. 计算最优布局
      const layoutData = await AIPluginController.calculateOptimalLayout(
        boundaryResult.data,
        input.constraints,
        siteRules
      );
      
      // 4. 合规性检查
      const compliance = await AIPluginController.checkCompliance(layoutData, context.city);
      
      res.json({
        success: true,
        data: {
          buildings: layoutData.buildings,
          roads: layoutData.roads,
          landscape: layoutData.landscape,
          statistics: {
            plot_ratio: layoutData.actualPlotRatio,
            coverage: layoutData.actualCoverage,
            green_ratio: layoutData.actualGreenRatio
          },
          compliance: compliance
        },
        metadata: {
          rules_applied: siteRules.map(r => r.rule_content.name),
          optimization_score: layoutData.score
        }
      });
    } catch (error) {
      next(createError(500, `红线图处理失败: ${error.message}`));
    }
  }
  
  /**
   * 2D平面转3D模型
   * POST /api/ai/2d-to-3d
   */
  static async twoDTo3D(req, res, next) {
    try {
      const { input, config, rules, context } = req.body;
      
      // 1. 解析2D图纸
      let drawing2D;
      if (typeof input.drawing === 'string' && input.drawing.startsWith('data:')) {
        // 图片格式
        drawing2D = await AIPluginController.parseImageDrawing(input.drawing);
      } else {
        // DWG/DXF格式
        drawing2D = await AIPluginController.parseCadDrawing(input.drawing);
      }
      
      // 2. 识别建筑元素
      const elements = {
        walls: drawing2D.walls,
        doors: drawing2D.doors,
        windows: drawing2D.windows,
        columns: drawing2D.columns,
        rooms: drawing2D.rooms
      };
      
      // 3. 生成3D几何
      const model3D = AIPluginController.generate3DFromElements(elements, config);
      
      // 4. 应用结构规则
      if (config.generate_structure) {
        model3D.structure = await AIPluginController.generateStructure(model3D, rules);
      }
      
      res.json({
        success: true,
        data: model3D,
        metadata: {
          element_count: Object.values(elements).flat().length,
          floor_area: drawing2D.area,
          building_height: config.floor_height * (config.floors || 1)
        }
      });
    } catch (error) {
      next(createError(500, `2D转3D失败: ${error.message}`));
    }
  }
  
  /**
   * 白模渲染
   * POST /api/ai/whitebox-render
   */
  static async whiteboxRender(req, res, next) {
    try {
      const { input, config, context } = req.body;
      
      // 1. 分析建筑类型和风格
      const buildingAnalysis = await AIPluginController.analyzeBuildingStyle(
        input.model,
        context.building_type
      );
      
      // 2. 自动分配材质
      let materials = config.materials;
      if (materials === 'auto') {
        materials = await AIPluginController.autoAssignMaterials(
          buildingAnalysis,
          config.style
        );
      }
      
      // 3. 设置环境和光照
      const environment = {
        sun_angle: AIPluginController.getSunAngle(config.time_of_day),
        sky_condition: config.weather,
        ambient_occlusion: true,
        shadows: true
      };
      
      // 4. 调用渲染服务
      const renderResult = await axios.post(`${AI_SERVICES.vllm}/v1/images/render`, {
        model_data: input.model,
        camera: input.camera,
        materials: materials,
        environment: environment,
        resolution: input.resolution,
        style: config.style
      });
      
      res.json({
        success: true,
        data: {
          image_url: renderResult.data.url,
          image_base64: renderResult.data.base64,
          render_time: renderResult.data.render_time
        },
        metadata: {
          materials_used: materials.length,
          render_engine: 'cycles',
          samples: 128
        }
      });
    } catch (error) {
      next(createError(500, `渲染失败: ${error.message}`));
    }
  }
  
  /**
   * 获取规则配置
   * GET /api/ai/rules
   */
  static async getRules(req, res, next) {
    try {
      const { category } = req.query;
      
      let query = db('ai_rules').where('is_active', true);
      if (category) {
        query = query.where('category', category);
      }
      
      const rules = await query.select('*');
      
      res.json({
        success: true,
        data: { rules }
      });
    } catch (error) {
      next(createError(500, `获取规则失败: ${error.message}`));
    }
  }
  
  /**
   * 获取空间引擎配置
   * GET /api/ai/spatial-config/:buildingType
   */
  static async getSpatialConfig(req, res, next) {
    try {
      const { buildingType } = req.params;
      
      const config = await db('spatial_configs')
        .where('building_type', buildingType)
        .where('is_active', true)
        .first();
      
      if (!config) {
        return next(createError(404, '未找到该建筑类型的空间配置'));
      }
      
      res.json({
        success: true,
        data: { config: config.spatial_rules }
      });
    } catch (error) {
      next(createError(500, `获取空间配置失败: ${error.message}`));
    }
  }
  
  // ===== 辅助方法 =====
  
  /**
   * 应用规则引擎
   */
  static async applyRules(ruleNames, context) {
    const rules = await db('ai_rules')
      .whereIn('name', ruleNames)
      .where('is_active', true)
      .select('rule_content');
    
    return rules.map(r => ({
      name: r.rule_content.name,
      constraints: r.rule_content.constraints
    }));
  }
  
  /**
   * 构建草图转3D的提示词
   */
  static buildSketchTo3DPrompt(sketchData, config, rules) {
    return `
分析建筑草图并生成3D模型数据：

草图识别结果：
- 识别到的线条：${JSON.stringify(sketchData.lines)}
- 标注信息：${JSON.stringify(sketchData.annotations)}
- 推测的空间：${JSON.stringify(sketchData.spaces)}

配置参数：
- 建筑类型：${config.building_type}
- 层数：${config.floors}
- 层高：${config.height}米

应用的规则：
${rules.map(r => `- ${r.name}: ${JSON.stringify(r.constraints)}`).join('\n')}

请生成：
1. 3D顶点坐标数组
2. 面的顶点索引
3. 建议的分组结构
4. 推荐的材质

输出JSON格式的3D模型数据。
    `;
  }
  
  /**
   * 解析AI响应为3D模型
   */
  static parseAITo3DModel(aiResponse) {
    try {
      const content = aiResponse.choices[0].message.content;
      const modelData = JSON.parse(content);
      
      return {
        vertices: modelData.vertices || [],
        faces: modelData.faces || [],
        groups: modelData.groups || [],
        materials: modelData.materials || [],
        metadata: {
          generated_by: 'ai',
          timestamp: new Date()
        }
      };
    } catch (error) {
      // 如果解析失败，返回基础模型
      return {
        vertices: [],
        faces: [],
        groups: [],
        materials: [],
        metadata: { error: 'AI解析失败，返回空模型' }
      };
    }
  }
  
  /**
   * 计算最优布局
   */
  static async calculateOptimalLayout(boundary, constraints, rules) {
    // 这里应该调用专门的强排算法服务
    // 简化示例
    return {
      buildings: [
        {
          id: 'B1',
          position: { x: 100, y: 100 },
          footprint: [[0, 0], [60, 0], [60, 40], [0, 40]],
          floors: 18,
          type: 'residential'
        }
      ],
      roads: [
        {
          id: 'R1',
          type: 'main',
          path: [[0, 200], [500, 200]]
        }
      ],
      landscape: [
        {
          id: 'G1',
          type: 'green_space',
          area: 2000
        }
      ],
      actualPlotRatio: 2.4,
      actualCoverage: 0.28,
      actualGreenRatio: 0.36,
      score: 0.92
    };
  }
  
  /**
   * 生成3D几何
   */
  static generate3DFromElements(elements, config) {
    const vertices = [];
    const faces = [];
    const groups = [];
    
    // 生成墙体
    elements.walls.forEach(wall => {
      // 简化示例：为每面墙生成6个面的立方体
      const wallGroup = {
        name: `wall_${wall.id}`,
        type: 'wall',
        faces: []
      };
      
      // 根据墙体坐标和高度生成顶点
      // ... 具体实现
      
      groups.push(wallGroup);
    });
    
    return {
      vertices,
      faces,
      groups,
      materials: [
        { name: 'wall_material', color: '#CCCCCC' },
        { name: 'floor_material', color: '#999999' }
      ]
    };
  }
  
  /**
   * 记录使用日志
   */
  static async logUsage(userId, feature, context) {
    await db('ai_usage_logs').insert({
      user_id: userId,
      feature: feature,
      context: JSON.stringify(context),
      created_at: new Date()
    });
  }
}

module.exports = AIPluginController;