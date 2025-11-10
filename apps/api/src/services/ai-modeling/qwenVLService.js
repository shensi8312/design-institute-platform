/**
 * QwenVL服务 - 单一职责：调用QwenVL并返回结果
 */

const axios = require('axios');

class QwenVLService {
  constructor() {
    this.endpoint = process.env.QWENVL_ENDPOINT || 'http://10.10.18.2:8001/v1/chat/completions';
    this.model = 'Qwen2.5-VL-7B-Instruct';
    this.timeout = 45000;  // 稍放宽
    this.maxTokens = 2200;
  }

  /**
   * 调用QwenVL识别建筑草图
   * @param {Buffer} imageBuffer - 图片buffer
   * @param {Object} options - 选项
   * @returns {Object} QwenVL原始响应
   */
  async analyzeBuildingSketch(imageBuffer, options = {}) {
    const mime = this.detectMime(imageBuffer) || 'image/jpeg';
    const base64Image = imageBuffer.toString('base64');
    const prompt = options.prompt || this.getTwoPointPrompt();
    
    const body = {
      model: this.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: this.wrapGuard(prompt) },  // 强约束
          { 
            type: 'image_url', 
            image_url: { 
              url: `data:${mime};base64,${base64Image}` 
            }
          }
        ]
      }],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? this.maxTokens
    };
    
    try {
      const response = await axios.post(this.endpoint, body, { timeout: this.timeout });
      let content = response?.data?.choices?.[0]?.message?.content || '';
      let parsed = this.parseStrictJson(content);
      
      // 窄化重试
      if (!parsed) {
        console.log('📝 首次解析失败，尝试窄化重试...');
        const retryPrompt = this.narrowRetryPrompt(content);
        const retry = await axios.post(this.endpoint, {
          ...body,
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: retryPrompt }]
          }]
        }, { timeout: this.timeout });
        content = retry?.data?.choices?.[0]?.message?.content || '';
        parsed = this.parseStrictJson(content);
      }
      
      if (!parsed) {
        return { success: false, error: 'JSON_PARSE_FAILED', raw: content };
      }
      
      return {
        success: true,
        format: 'json',
        data: parsed.data,
        raw: parsed.raw
      };
      
    } catch (error) {
      console.error('QwenVL调用失败:', error.message);
      return { success: false, error: 'QWEN_CALL_FAILED', message: error.message };
    }
  }
  
  /**
   * 检测图片MIME类型
   */
  detectMime(buf) {
    const sig = buf.slice(0, 4).toString('hex');
    if (sig.startsWith('89504e47')) return 'image/png';
    if (sig.startsWith('ffd8ff'))   return 'image/jpeg';
    if (sig.startsWith('52494646')) return 'image/webp';
    return null;
  }
  
  /**
   * 加强约束包装
   */
  wrapGuard(prompt) {
    return `系统指令：你只能输出JSON，对应我给的Schema；不得输出解释文本。
若无法完全确定，请对不可确定的字段填null，并给出confidence。
${prompt}
（严禁输出除JSON外的任何字符）`;
  }
  
  /**
   * 严格JSON解析
   */
  parseStrictJson(content) {
    // 1) 去掉代码块标记
    let stripped = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 2) 尝试找到最外层的JSON对象（使用递归平衡的方式）
    const jsonStart = stripped.indexOf('{');
    if (jsonStart === -1) return null;
    
    let depth = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = jsonStart; i < stripped.length; i++) {
      const char = stripped[i];
      
      if (!escaped) {
        if (char === '"' && !inString) {
          inString = true;
        } else if (char === '"' && inString) {
          inString = false;
        } else if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') {
            depth--;
            if (depth === 0) {
              // 找到完整的JSON对象
              const jsonStr = stripped.substring(jsonStart, i + 1);
              try {
                const data = JSON.parse(jsonStr);
                return { data, raw: jsonStr };
              } catch (e) {
                // 继续寻找下一个可能的JSON
              }
            }
          }
        }
        escaped = (char === '\\');
      } else {
        escaped = false;
      }
    }
    
    // 3) 如果上面的方法失败，尝试直接解析整个内容
    try {
      const data = JSON.parse(stripped);
      return { data, raw: stripped };
    } catch (_) {}
    
    return null;
  }
  
  /**
   * 窄化重试prompt
   */
  narrowRetryPrompt(prev) {
    return `仅输出JSON。保持已有字段不变，只补齐缺字段。禁止任何解释性文字。
如果某些字段不确定，填null，并给出confidence。
原返回内容如下：
${prev}`;
  }
  
  /**
   * CV+VL混合模式：语义识别专用prompt（不要几何坐标）
   */
  getSemanticOnlyPrompt() {
    return `你是"建筑语义分析"专家。专注识别建筑的语义信息，不要提供具体的像素坐标。

【任务】
分析建筑手绘图的语义特征，识别建筑类型、功能、层数、空间关系等信息。

【语义分析要点】
1. **建筑分类**: 主楼/附楼/连廊/独立建筑
2. **功能推断**: 办公楼/住宅楼/商业建筑/教学楼
3. **规模估算**: 楼层数、相对大小关系
4. **风格特征**: 现代/传统/混合风格
5. **空间关系**: 建筑间的连接、相邻、独立关系

【输出Schema - 纯语义版】
{
  "building_count": number,
  "view_type": "two_point|one_point|orthographic",
  "scene_description": "整体场景描述",
  
  "buildings": [
    {
      "id": "v1",
      "name": "主楼|附楼|建筑A",
      "role": "main|annex|connector|independent",
      "building_type": "office|residential|commercial|educational|mixed",
      "architectural_style": "modern|traditional|mixed",
      
      "scale_info": {
        "relative_size": "large|medium|small",
        "size_ratio": 1.0,  // 相对最大建筑的比例
        "levels": number,   // 楼层数
        "level_confidence": 0.8
      },
      
      "visual_features": {
        "has_windows": boolean,
        "window_pattern": "regular|irregular|none",
        "roof_type": "flat|pitched|complex",
        "facade_complexity": "simple|moderate|complex"
      },
      
      "confidence": 0.8
    }
  ],
  
  "spatial_relationships": [
    {
      "from": "v1",
      "to": "v2",
      "relationship": "connected|adjacent|separate",
      "connection_type": "bridge|corridor|direct|none",
      "connection_level": number,  // 第几层连接
      "confidence": 0.8
    }
  ],
  
  "perspective_analysis": {
    "viewing_angle": "bird_eye|eye_level|worm_eye",
    "viewing_direction": "northeast|southeast|northwest|southwest",
    "depth_perception": "strong|moderate|weak",
    "horizon_visible": boolean
  }
}

【关键指令】
🚫 **绝对禁止输出像素坐标！** 不要footprint_px、bbox_px等几何数据
✅ **专注语义标签**: 建筑类型、层数、关系、风格等
✅ **相对比例**: 用large/medium/small和数值比例描述大小
✅ **置信度**: 为每个判断给出confidence评分`;
  }
  
  /**
   * 传统几何检测prompt (保持兼容)
   */
  getTwoPointPrompt() {
    return `你是"建筑两点透视"分析专家。必须输出规范JSON，禁止出现undefined/NaN/Infinity/注释/解释性文字。

【任务】
分析建筑手绘图，识别建筑之间的比例关系和精确的几何轮廓。

🎯 **CRITICAL**: 必须精确标注每栋建筑的角点坐标！
【关键几何信息识别】
1. **建筑轮廓角点**: 沿建筑边缘逆时针标注所有拐点 (footprint_px)
2. **灭点位置**: 透视消失点的精确像素坐标 (vanishing_points_norm)  
3. **地平线**: 水平消失线的Y坐标位置 (horizon_y_norm)
4. **建筑底边**: 与地面接触的边线，用于深度推算

【比例分析要点】
- 以最大建筑为基准(1.0)，其他建筑相对比例
- 观察高宽比：是方正(1:1)、扁平(1:2)还是细长(2:1)
- 楼层数根据窗户排列或层线推断
- 连廊宽度通常是主体建筑宽度的15-25%

【必须输出的JSON Schema】
{
  "building_count": number,
  "view_type": "two_point",
  "horizon_y_norm": number|null,
  "vanishing_points_norm": {"vx_left":[x,y]|null, "vx_right":[x,y]|null},
  "calibration": {
    "img_rect_px": [[x,y],[x,y],[x,y],[x,y]]|null,
    "real_size": {"w":1.0, "d":1.0},  // 相对单位
    "origin_world": [0,0]
  },
  "volumes": [
    {
      "id": "v1",
      "name": "主楼|附楼|建筑1",
      "role": "main|annex|connector",
      "footprint_px": [[x,y],...],  // ⚡ 必须>=4点，沿轮廓逆时针精确标注每个角点
      "bbox_px": [x_min,y_min,x_max,y_max],
      "yaw_deg": number|null,
      "size_hint": {"w":1.0, "d":0.8, "h":0.6},  // 相对比例
      "levels": 3,  // 根据层线/窗户估算
      "confidence": 0.8
    }
  ],
  "connectors": [
    {
      "from":"v1",
      "to":"v2", 
      "type":"bridge",
      "width_hint":0.2,  // 主体宽度的20%
      "height_hint":0.15,  // 相对高度
      "elev_hint":2,  // 第几层(2=第二层)
      "confidence":0.8
    }
  ]
}

【强制要求】
🎯 1. **footprint_px是核心！** 必须精确标注每个建筑的角点，>=4点，沿轮廓逆时针
🎯 2. **vanishing_points_norm必须准确！** 左右灭点的归一化坐标 [0-1]
🎯 3. **horizon_y_norm地平线位置** 透视消失线的Y坐标 (归一化)
4. size_hint使用相对比例值：最大建筑=1.0，其他相对缩放  
5. levels根据可见的层线、窗户排列估算
6. 连廊width_hint为相对于主体的比例(0.15-0.25)
7. 示例比例：
   - 主楼：w:1.0, d:0.8, h:0.6 (扁平)
   - 附楼：w:0.6, d:0.5, h:0.4 (较小)
   - 连廊：width:0.2 (主楼宽度的20%)`;
  }
  
  /**
   * 语义分析专用调用
   */
  async analyzeBuildingSemantics(imageBuffer, options = {}) {
    const prompt = options.prompt || this.getSemanticOnlyPrompt();
    return this.analyzeBuildingSketch(imageBuffer, { ...options, prompt });
  }
  
}

module.exports = new QwenVLService();