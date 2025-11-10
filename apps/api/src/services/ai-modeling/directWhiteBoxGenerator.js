/**
 * 直接白模生成器
 * 路线B：从世界坐标尺寸直接生成SketchUp Ruby代码
 */

class DirectWhiteBoxGenerator {
  /**
   * 从分析结果生成Ruby代码（路线B：直接生成）
   * @param {Object} analysisData - 包含建筑尺寸和位置的分析数据
   * @returns {Object} 包含Ruby代码和JSON数据
   */
  static generateRubyCode(analysisData) {
    console.log('\n🎯 生成直接白模Ruby代码...');
    
    // 提取建筑数据
    const buildings = this.extractBuildingData(analysisData);
    
    // 生成Ruby数组定义 - 支持角点数据和透视校正
    const rubyBuildings = buildings.map(b => {
      if (b.hasFootprint && b.footprint_world) {
        // 使用透视校正后的世界坐标
        const worldFootprint = b.footprint_world.map(([wx, wy]) => [
          parseFloat(wx.toFixed(2)),  // 保留2位小数
          parseFloat(wy.toFixed(2))
        ]);
        
        return `  {name:"${b.name}", h:${b.h}, x:${b.x}, y:${b.y}, z:${b.z}, rot:${b.rot}, footprint:${JSON.stringify(worldFootprint)}, method:"perspective_corrected"}`;
      } else if (b.hasFootprint && b.footprint_px) {
        // 回退：简单缩放（用于测试）
        const scaledFootprint = b.footprint_px.map(([px, py]) => [
          parseFloat(((px / 800) * b.w - b.w/2).toFixed(2)),
          parseFloat(((py / 600) * b.d - b.d/2).toFixed(2))
        ]);
        
        return `  {name:"${b.name}", h:${b.h}, x:${b.x}, y:${b.y}, z:${b.z}, rot:${b.rot}, footprint:${JSON.stringify(scaledFootprint)}, method:"simple_scaled"}`;
      } else {
        // 传统矩形方式
        return `  {name:"${b.name}", w:${b.w}, d:${b.d}, h:${b.h}, x:${b.x}, y:${b.y}, z:${b.z}, rot:${b.rot}, method:"rectangle"}`;
      }
    }).join(",\n");
    
    // 生成完整的Ruby脚本
    const rubyCode = `# === Qwen-VL输出 → 直接生成白模盒子（单位：米）===
# 生成时间: ${new Date().toISOString()}
# 建筑数量: ${buildings.length}

buildings = [
${rubyBuildings}
]

m = Sketchup.active_model
m.start_operation("QwenVL→WhiteMass", true)

# 单色白模外观
ro = m.rendering_options
ro['DisplayTextures'] = false
ro['FaceColorMode']   = 1
ro['DisplayEdges']    = true
ro['EdgeDisplayMode'] = 1
mat = (m.materials['MST_White'] || m.materials.add('MST_White'))
mat.color=[255,255,255]

buildings.each do |b|
  grp = m.entities.add_group
  grp.name = "MASS_#{b[:name]}"
  
  # 🎯 新功能：支持角点数据生成多边形体块（透视校正版）
  if b[:footprint] && b[:footprint].is_a?(Array) && b[:footprint].size >= 4
    # 方法A：基于透视校正角点的精确多边形体块
    method = b[:method] || "unknown"
    puts "  📐 生成多边形体块: #{b[:name]} (#{b[:footprint].size}个角点, #{method})"
    
    # 将角点坐标转换为SketchUp 3D点
    footprint_3d = b[:footprint].map { |xy| [xy[0], xy[1], 0] }
    pts = footprint_3d.map { |p| Geom::Point3d.new(p) }
    
    # 检查点的顺序，确保能正确形成面
    begin
      face = grp.entities.add_face(pts)
      face.reverse! if face.normal.z < 0
      
      # 向上拉伸
      face.pushpull(b[:h])
      
      puts "    ✅ 多边形体块创建成功"
    rescue => e
      puts "    ⚠️  多边形创建失败: #{e.message}，回退到矩形"
      # 回退到矩形模式
      w, d, h = 10, 8, b[:h]  # 默认尺寸
      pts = [[0,0,0],[w,0,0],[w,d,0],[0,d,0]].map{ |p| Geom::Point3d.new(p) }
      face = grp.entities.add_face(pts)
      face.reverse! if face.normal.z < 0
      face.pushpull(h)
    end
    
  else
    # 方法B：传统矩形体块（向后兼容）
    puts "  📦 生成矩形体块: #{b[:name]} (#{b[:w]}×#{b[:d]}×#{b[:h]})"
    w,d,h = b.values_at(:w,:d,:h)
    
    # 以自身局部(0,0,0)为底角画底面
    pts = [[0,0,0],[w,0,0],[w,d,0],[0,d,0]].map{ |p| Geom::Point3d.new(p) }
    face = grp.entities.add_face(pts)
    face.reverse! if face.normal.z < 0
    face.pushpull(h)
  end
  
  # 应用材质
  grp.entities.grep(Sketchup::Face).each{|f| f.material=mat; f.back_material=mat }

  # 旋转+平移到世界位置（rot 以度为单位，绕 Z 轴）
  cx, cy, cz = b.values_at(:x,:y,:z)
  t_move = Geom::Transformation.translation([cx, cy, cz])
  t_rot  = Geom::Transformation.rotation([cx, cy, cz], Z_AXIS, (b[:rot]||0.0).to_f.degrees)
  grp.transform!(t_rot * t_move)
end

m.commit_operation
UI.messagebox("白模生成完成（#{buildings.size} 个量体）")`;

    return {
      rubyCode: rubyCode,
      buildings: buildings,
      metadata: {
        method: 'direct_generation',
        buildingCount: buildings.length,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * 从分析数据提取建筑信息
   */
  static extractBuildingData(analysisData) {
    const buildings = [];
    
    console.log('🔍 检查角点数据可用性...');
    const hasFootprints = this.checkFootprintData(analysisData);
    
    // 定义基准尺寸（可配置）
    const BASE_WIDTH = 20;  // 主楼基准宽度20米（增大比例）
    const FLOOR_HEIGHT = 3.5;  // 标准层高3.5米（稍微增高）
    
    // 优先使用modeling数据（已经有世界坐标）
    if (analysisData.modeling?.buildings) {
      analysisData.modeling.buildings.forEach((b, index) => {
        buildings.push({
          name: b.name || b.id || `B${index + 1}`,
          w: (b.dimensions?.width || 15000) / 1000,    // 毫米转米
          d: (b.dimensions?.depth || 10000) / 1000,
          h: (b.dimensions?.height || 9600) / 1000,
          x: (b.position?.x || 0) / 1000,
          y: (b.position?.y || 0) / 1000,
          z: (b.position?.z || 0) / 1000,
          rot: b.rotation || 0
        });
      });
    }
    // 使用volumes数据（相对比例）
    else if (analysisData.volumes) {
      let xOffset = 0;
      
      analysisData.volumes.forEach((vol, index) => {
        // 将相对比例转换为实际尺寸（处理负数和零值）
        const w = vol.size_hint?.w && vol.size_hint.w > 0 ? vol.size_hint.w * BASE_WIDTH : BASE_WIDTH;
        const d = vol.size_hint?.d && vol.size_hint.d > 0 ? vol.size_hint.d * BASE_WIDTH : BASE_WIDTH * 0.6;
        const h = vol.size_hint?.h && vol.size_hint.h > 0 ? vol.size_hint.h * BASE_WIDTH : 
                  (vol.levels && vol.levels > 0 ? vol.levels * FLOOR_HEIGHT : FLOOR_HEIGHT * 3);
        
        const building = {
          name: vol.name || vol.id || `B${index + 1}`,
          w: w,
          d: d,
          h: h,
          x: xOffset,
          y: 0,
          z: 0,
          rot: vol.yaw_deg || 0
        };
        
        // 🎯 关键改进：添加角点数据支持和透视校正
        if (hasFootprints && vol.footprint_px && vol.footprint_px.length >= 4) {
          // 导入透视变换模块
          const PerspectiveTransform = require('./perspectiveTransform');
          
          // 模拟图片信息（实际应从调用参数传入）
          const imageInfo = { width: 1554, height: 1079 };
          const referenceSize = { width: w, depth: d };
          
          // 执行透视变换
          const worldFootprint = PerspectiveTransform.transformFootprint(
            vol.footprint_px, 
            analysisData, 
            imageInfo, 
            referenceSize
          );
          
          building.footprint_px = vol.footprint_px;  // 保留原始像素坐标
          building.footprint_world = worldFootprint;  // 世界坐标
          building.hasFootprint = true;
          console.log(`  ✅ 建筑 "${building.name}" 透视校正: ${vol.footprint_px.length}个角点`);
        } else {
          building.hasFootprint = false;
          console.log(`  ⚠️  建筑 "${building.name}" 使用矩形近似`);
        }
        
        buildings.push(building);
        
        // 自动排列，建筑间留5米间距
        xOffset += w + 5;
      });
    }
    // 使用instances数据（QwenVL新格式）
    else if (analysisData.instances) {
      analysisData.instances.forEach((inst, index) => {
        // 根据bbox和位置计算世界坐标
        const centerX = inst.center?.[0] || 0.5;
        const relativeX = (centerX - 0.5) * 50;  // 相对中心的偏移
        
        buildings.push({
          name: inst.id || `B${index + 1}`,
          w: inst.dimensions?.width || 15,
          d: inst.dimensions?.depth || 10,
          h: inst.dimensions?.height || (inst.rough_floors || 3) * 3.2,
          x: relativeX,
          y: index * 5,  // 前后错开
          z: 0,
          rot: 0
        });
      });
    }
    
    // 添加连廊（如果有显式定义）
    if (analysisData.connectors && analysisData.connectors.length > 0) {
      const BASE_WIDTH = 15;  // 与上面保持一致
      const FLOOR_HEIGHT = 3.2;
      
      analysisData.connectors.forEach((conn, index) => {
        // 查找对应的建筑
        const fromVolume = analysisData.volumes?.find(v => v.id === conn.from);
        const toVolume = analysisData.volumes?.find(v => v.id === conn.to);
        const b1 = buildings.find(b => b.name === (fromVolume?.name || conn.from));
        const b2 = buildings.find(b => b.name === (toVolume?.name || conn.to));
        
        if (b1 && b2) {
          // 连廊宽度：相对比例转实际尺寸，确保合理范围
          const corridorWidth = conn.width_hint ? Math.max(conn.width_hint * BASE_WIDTH, 3) : 4;
          // 连廊高度：应该足够高以便人员通行，建议2.8-4.0米
          const corridorHeight = conn.height_hint ? 
            Math.max(conn.height_hint * Math.min(b1.h, b2.h), 3.0) : 
            Math.min(Math.min(b1.h, b2.h) * 0.25, 4.0); // 较低建筑的25%，最大4米
          const corridorElev = conn.elev_hint ? (conn.elev_hint - 1) * FLOOR_HEIGHT : Math.min(b1.h, b2.h) * 0.6;
          
          // 计算连廊位置和长度（确保端点对接）
          const startX = b1.x + b1.w / 2;  // 建筑1中心
          const endX = b2.x + b2.w / 2;    // 建筑2中心
          const bridgeLength = Math.abs(endX - startX) - (b1.w + b2.w) / 4;  // 减去重叠部分
          
          buildings.push({
            name: `Bridge_${conn.from}_${conn.to}`,
            w: bridgeLength,              // 连廊长度
            d: corridorWidth,              // 连廊宽度
            h: corridorHeight,             // 连廊高度
            x: (startX + endX) / 2,        // 连廊中心位置
            y: (b1.y + b2.y) / 2,          // Y位置取平均
            z: corridorElev,               // 连廊标高
            rot: 0
          });
        }
      });
    } else if (buildings.length >= 2) {
      // 后处理规则：智能推断连廊
      console.log('🌉 应用连廊推断规则...');
      
      // 根据建筑位置排序
      const sortedBuildings = [...buildings].sort((a, b) => a.x - b.x);
      
      // 检测相邻建筑并生成连廊
      for (let i = 0; i < sortedBuildings.length - 1; i++) {
        const b1 = sortedBuildings[i];
        const b2 = sortedBuildings[i + 1];
        
        // 计算中心距离
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const centerDistance = Math.sqrt(dx * dx + dy * dy);
        
        // 检查投影区间重叠（Y轴方向）
        const y1Min = b1.y - b1.d / 2;
        const y1Max = b1.y + b1.d / 2;
        const y2Min = b2.y - b2.d / 2;
        const y2Max = b2.y + b2.d / 2;
        const yOverlap = Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min);
        
        // 计算连廊参数（精确对接）
        const b1EdgeX = b1.x + b1.w;      // 建筑1右边缘
        const b2EdgeX = b2.x;             // 建筑2左边缘  
        const bridgeLength = Math.abs(b2EdgeX - b1EdgeX);  // 实际间距
        
        // 判断条件：
        // 1. 中心距离在阈值内（建议：主体最大尺寸的2倍）
        // 2. Y轴投影有重叠 或 距离很近
        // 3. 连廊长度合理
        const maxDimension = Math.max(b1.w, b1.d, b2.w, b2.d);
        const distanceThreshold = maxDimension * 2;
        
        if (centerDistance < distanceThreshold && 
            (yOverlap > 0 || Math.abs(dy) < 10) && 
            bridgeLength > 0 && bridgeLength < 20) {
          
          // 连廊宽度：取较小建筑的较小边的20%
          const minDimension = Math.min(b1.w, b1.d, b2.w, b2.d);
          const corridorWidth = Math.max(minDimension * 0.2, 2.4);  // 最小2.4米
          
          buildings.push({
            name: `Bridge${i + 1}`,
            w: bridgeLength,              // 连廊长度
            d: Math.min(corridorWidth, 4), // 连廊宽度（最大4米）
            h: Math.min(Math.min(b1.h, b2.h) * 0.25, 4.0), // 连廊高度：较低建筑的25%，最大4米
            x: (b1EdgeX + b2EdgeX) / 2,    // 连廊中心位置（两边缘中点）
            y: (b1.y + b2.y) / 2,          // Y位置取平均
            z: Math.min(b1.h, b2.h) * 0.6, // 连廊标高：较低建筑的60%高度
            rot: Math.atan2(dy, dx) * 180 / Math.PI  // 旋转角度
          });
          
          console.log(`  ✅ 推断连廊 Bridge${i + 1}:`);
          console.log(`     - 连接: ${b1.name} ↔ ${b2.name}`);
          console.log(`     - 中心距离: ${centerDistance.toFixed(1)}m`);
          console.log(`     - Y轴重叠: ${yOverlap.toFixed(1)}m`);
          console.log(`     - 连廊尺寸: ${bridgeLength.toFixed(1)}m × ${corridorWidth.toFixed(1)}m`);
        }
      }
    }
    
    return buildings;
  }
  
  /**
   * 决定使用哪条路线（支持新的Two-Point格式）
   */
  static recommendRoute(analysisData) {
    // 优先检查Two-Point格式的标定数据
    const hasCalibration = !!(
      analysisData.calibration?.img_rect_px &&
      Array.isArray(analysisData.calibration.img_rect_px) &&
      analysisData.calibration.img_rect_px.length === 4
    );
    
    // 检查是否有footprint_px（像素脚印）
    const hasFootprints = !!(
      analysisData.volumes?.[0]?.footprint_px ||
      analysisData.instances?.[0]?.footprint_px
    );
    
    // 检查是否有完整的世界坐标数据
    const hasWorldCoords = !!(
      analysisData.modeling?.buildings?.[0]?.position &&
      analysisData.modeling?.buildings?.[0]?.dimensions
    );
    
    // 检查是否有复杂轮廓
    const hasComplexContours = !!(
      analysisData.instances?.[0]?.vertices ||
      analysisData.instances?.[0]?.contour ||
      (hasFootprints && analysisData.volumes?.[0]?.footprint_px?.length > 4)
    );
    
    // 路线A优先：有标定矩形和像素脚印（最精确）
    if (hasCalibration && hasFootprints) {
      return {
        route: 'A',
        reason: '有标定矩形和像素脚印，使用透视标定获得最精确结果',
        confidence: 0.95
      };
    }
    // 路线A：有复杂轮廓需要透视校正
    else if (hasComplexContours || hasFootprints) {
      return {
        route: 'A', 
        reason: '检测到复杂轮廓或像素脚印，需要透视标定处理',
        confidence: 0.85
      };
    }
    // 路线B：有世界坐标，直接生成
    else if (hasWorldCoords) {
      return {
        route: 'B',
        reason: '已有世界坐标和尺寸，直接生成最快',
        confidence: 0.9
      };
    }
    // 默认路线B
    else {
      return {
        route: 'B',
        reason: '默认使用直接生成（可能需要调整参数）',
        confidence: 0.6
      };
    }
  }
  
  /**
   * 检查是否有足够的角点数据
   */
  static checkFootprintData(analysisData) {
    if (analysisData.volumes) {
      const validFootprints = analysisData.volumes.filter(vol => 
        vol.footprint_px && Array.isArray(vol.footprint_px) && vol.footprint_px.length >= 4
      );
      return validFootprints.length > 0;
    }
    if (analysisData.instances) {
      const validFootprints = analysisData.instances.filter(inst => 
        inst.footprint_px && Array.isArray(inst.footprint_px) && inst.footprint_px.length >= 4
      );
      return validFootprints.length > 0;
    }
    return false;
  }

  /**
   * 生成两种路线的输出
   */
  static generateBothRoutes(analysisData, imageInfo) {
    const result = {
      recommendation: this.recommendRoute(analysisData),
      routeA: null,
      routeB: null
    };
    
    // 路线A：透视标定（之前的方法）
    try {
      const PerspectiveCalibration = require('./perspectiveCalibration');
      result.routeA = {
        type: 'perspective_calibration',
        data: PerspectiveCalibration.generateCalibrationJSON(analysisData, imageInfo),
        description: '需要标定矩形+像素轮廓，适合复杂形状'
      };
    } catch (err) {
      console.warn('路线A生成失败:', err.message);
    }
    
    // 路线B：直接生成（新方法）
    try {
      const rubyGeneration = this.generateRubyCode(analysisData);
      result.routeB = {
        type: 'direct_generation',
        rubyCode: rubyGeneration.rubyCode,
        buildings: rubyGeneration.buildings,
        description: '直接用世界坐标生成，最快最简单'
      };
    } catch (err) {
      console.warn('路线B生成失败:', err.message);
    }
    
    return result;
  }
}

module.exports = DirectWhiteBoxGenerator;