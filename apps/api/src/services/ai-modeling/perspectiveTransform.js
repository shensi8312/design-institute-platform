/**
 * 透视变换算法 - CV+VL混合版本
 * 从像素脚点坐标 + 灭点数据 → 世界坐标
 */

const axios = require('axios');

class PerspectiveTransform {
  
  /**
   * 主要入口：透视校正 (CV+VL混合版)
   * @param {Array} footprintPx - 像素脚点坐标 [[x,y],...]
   * @param {Object} perspectiveData - 透视数据 {vanishing_points_norm, horizon_y_norm}
   * @param {Object} imageInfo - 图片信息 {width, height}
   * @param {Object} referenceSize - 参考尺寸 {width, depth} 米
   * @param {Buffer} imageBuffer - 原始图片数据 (用于CV检测)
   * @returns {Array} 世界坐标 [[x,y],...]
   */
  static async transformFootprint(footprintPx, perspectiveData, imageInfo, referenceSize = {width: 20, depth: 15}, imageBuffer = null) {
    console.log('🔄 开始CV+VL混合透视变换...');
    
    if (!footprintPx || footprintPx.length < 3) {
      console.warn('⚠️ 脚点数据不足，使用矩形近似');
      return this.generateRectangleFootprint(referenceSize);
    }
    
    // 检查是否为假数据
    if (this.isFakeFootprint(footprintPx)) {
      console.warn('⚠️ 检测到VL模型示例数据，尝试CV几何检测...');
      
      // 尝试CV几何检测
      if (imageBuffer) {
        const cvResult = await this.callCVGeometryDetection(imageBuffer);
        if (cvResult.success && cvResult.quality_score > 0.6) {
          console.log('✅ CV检测成功，使用CV几何数据');
          return this.useCVGeometryResult(cvResult, referenceSize, imageInfo);
        } else {
          console.log('⚠️ CV检测质量不足，回退到透视估算');
        }
      }
      
      // 回退方案：使用透视估算
      return this.estimateFootprintFromPerspective(footprintPx, perspectiveData, imageInfo, referenceSize);
    }
    
    // 真实数据：执行透视校正
    return this.performPerspectiveCorrection(footprintPx, perspectiveData, imageInfo, referenceSize);
  }
  
  /**
   * 调用CV几何检测服务
   */
  static async callCVGeometryDetection(imageBuffer) {
    try {
      console.log('🔧 调用OpenCV几何检测服务...');
      
      const base64Image = imageBuffer.toString('base64');
      const response = await axios.post('http://localhost:8088/api/detect-geometry', {
        image_base64: base64Image
      }, { 
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = response.data;
      console.log(`CV检测结果: 质量分${(result.quality_score * 100).toFixed(0)}%, 线段${result.lines.count}条, 脚印${result.footprints?.length || 0}个`);
      
      return result;
      
    } catch (error) {
      console.error('❌ CV几何检测失败:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 使用CV检测的几何结果
   */
  static useCVGeometryResult(cvResult, referenceSize, imageInfo) {
    console.log('📐 使用CV检测的几何数据进行透视变换...');
    
    const { vanishing_points, footprints } = cvResult;
    
    // 使用CV检测的灭点数据 (优先级更高)
    let vxLeft = vanishing_points?.vx_left;
    let vxRight = vanishing_points?.vx_right;
    
    // 转换CV灭点为像素坐标
    if (vxLeft && vxRight) {
      const leftVP = [vxLeft[0] * imageInfo.width, vxLeft[1] * imageInfo.height];
      const rightVP = [vxRight[0] * imageInfo.width, vxRight[1] * imageInfo.height];
      const horizon = (leftVP[1] + rightVP[1]) / 2;
      
      console.log(`CV灭点: 左[${leftVP[0].toFixed(0)}, ${leftVP[1].toFixed(0)}] 右[${rightVP[0].toFixed(0)}, ${rightVP[1].toFixed(0)}]`);
      
      // 使用CV检测的脚印
      if (footprints && footprints.length > 0) {
        const footprint = footprints[0]; // 使用第一个脚印
        console.log(`CV脚印: ${footprint.length}个角点`);
        
        return this.convertToWorldCoordinates(footprint, leftVP, rightVP, horizon, referenceSize);
      }
    }
    
    // 如果CV数据不完整，回退到默认方法
    console.warn('CV数据不完整，使用默认矩形');
    return this.generateRectangleFootprint(referenceSize);
  }
  
  /**
   * 检测是否为假脚点数据
   */
  static isFakeFootprint(footprintPx) {
    // 检查1：所有坐标是否为50的倍数
    const isRoundNumbers = footprintPx.every(([x, y]) => x % 50 === 0 && y % 50 === 0);
    
    // 检查2：是否为完美矩形
    const isPerfectRect = this.isPerfectRectangle(footprintPx);
    
    // 检查3：坐标范围是否过小（相对于图片）
    const minX = Math.min(...footprintPx.map(p => p[0]));
    const maxX = Math.max(...footprintPx.map(p => p[0]));
    const minY = Math.min(...footprintPx.map(p => p[1]));
    const maxY = Math.max(...footprintPx.map(p => p[1]));
    
    const width = maxX - minX;
    const height = maxY - minY;
    const isTooSmall = width <= 300 && height <= 200; // 小于300x200px
    
    console.log(`脚点质量检查:`);
    console.log(`  规整数字: ${isRoundNumbers ? '❌ 是' : '✅ 否'}`);  
    console.log(`  完美矩形: ${isPerfectRect ? '❌ 是' : '✅ 否'}`);
    console.log(`  尺寸过小: ${isTooSmall ? '❌ 是' : '✅ 否'} (${width}×${height}px)`);
    
    return isRoundNumbers && isPerfectRect && isTooSmall;
  }
  
  /**
   * 检查是否为完美矩形
   */
  static isPerfectRectangle(points) {
    if (points.length !== 4) return false;
    
    const [p1, p2, p3, p4] = points;
    
    // 检查是否有完全水平和垂直的边
    const isHorizontal1 = Math.abs(p1[1] - p2[1]) < 1;
    const isHorizontal2 = Math.abs(p3[1] - p4[1]) < 1;
    const isVertical1 = Math.abs(p2[0] - p3[0]) < 1;
    const isVertical2 = Math.abs(p4[0] - p1[0]) < 1;
    
    return isHorizontal1 && isHorizontal2 && isVertical1 && isVertical2;
  }
  
  /**
   * 基于透视数据估算真实脚点（用于假数据情况）
   */
  static estimateFootprintFromPerspective(fakePx, perspectiveData, imageInfo, refSize) {
    console.log('🎯 使用透视数据估算真实脚点...');
    
    if (!perspectiveData?.vanishing_points_norm) {
      console.warn('无灭点数据，使用默认矩形');
      return this.generateRectangleFootprint(refSize);
    }
    
    const { vx_left, vx_right } = perspectiveData.vanishing_points_norm;
    
    if (!vx_left || !vx_right) {
      return this.generateRectangleFootprint(refSize);
    }
    
    // 转换为像素坐标
    const leftVP = [vx_left[0] * imageInfo.width, vx_left[1] * imageInfo.height];
    const rightVP = [vx_right[0] * imageInfo.width, vx_right[1] * imageInfo.height];
    const horizon = (leftVP[1] + rightVP[1]) / 2;
    
    console.log(`灭点: 左[${leftVP[0].toFixed(0)}, ${leftVP[1].toFixed(0)}] 右[${rightVP[0].toFixed(0)}, ${rightVP[1].toFixed(0)}]`);
    console.log(`地平线: Y=${horizon.toFixed(0)}px`);
    
    // 估算建筑在图片中的大致位置和形状
    const centerX = imageInfo.width / 2;
    const centerY = horizon - 100; // 地平线上方100px
    
    // 透视校正：距离地平线越近，宽度越小
    const distanceToHorizon = Math.abs(centerY - horizon);
    const perspectiveFactor = Math.max(0.3, distanceToHorizon / imageInfo.height);
    
    // 计算透视矩形
    const baseWidth = refSize.width * 20; // 基础像素宽度
    const baseDepth = refSize.depth * 15; // 基础像素深度
    
    const perspectiveWidth = baseWidth * perspectiveFactor;
    const perspectiveDepth = baseDepth * perspectiveFactor * 0.5; // 深度受透视影响更大
    
    // 生成透视矩形的4个角点
    const footprint = [
      [centerX - perspectiveWidth/2, centerY + perspectiveDepth/2],  // 左下
      [centerX + perspectiveWidth/2, centerY + perspectiveDepth/2],  // 右下
      [centerX + perspectiveWidth/2, centerY - perspectiveDepth/2],  // 右上
      [centerX - perspectiveWidth/2, centerY - perspectiveDepth/2]   // 左上
    ];
    
    console.log(`估算脚点: ${perspectiveWidth.toFixed(0)}×${perspectiveDepth.toFixed(0)}px @ [${centerX.toFixed(0)}, ${centerY.toFixed(0)}]`);
    
    // 转换为世界坐标
    return this.convertToWorldCoordinates(footprint, leftVP, rightVP, horizon, refSize);
  }
  
  /**
   * 执行真实透视校正（用于真实数据情况）
   */
  static performPerspectiveCorrection(footprintPx, perspectiveData, imageInfo, refSize) {
    console.log('🎨 执行透视校正...');
    
    if (!perspectiveData?.vanishing_points_norm) {
      console.warn('无透视数据，直接缩放');
      return this.simpleScale(footprintPx, imageInfo, refSize);
    }
    
    const { vx_left, vx_right } = perspectiveData.vanishing_points_norm;
    
    // 转换为像素坐标
    const leftVP = [vx_left[0] * imageInfo.width, vx_left[1] * imageInfo.height];
    const rightVP = [vx_right[0] * imageInfo.width, vx_right[1] * imageInfo.height];
    const horizon = (leftVP[1] + rightVP[1]) / 2;
    
    return this.convertToWorldCoordinates(footprintPx, leftVP, rightVP, horizon, refSize);
  }
  
  /**
   * 将像素坐标转换为世界坐标
   */
  static convertToWorldCoordinates(pixelPoints, leftVP, rightVP, horizon, refSize) {
    console.log('📐 转换为世界坐标...');
    
    // 透视校正算法
    const worldPoints = pixelPoints.map(([px, py]) => {
      
      // 1. 计算到地平线的距离（深度指标）
      const distanceToHorizon = horizon - py;
      const depthFactor = Math.max(0.1, distanceToHorizon / 200); // 归一化深度
      
      // 2. 计算透视比例
      // 距离地平线越远，实际尺寸越大
      const perspectiveScale = 1 + (distanceToHorizon / horizon) * 2;
      
      // 3. 基于灭点计算X方向的校正
      // 左灭点影响：越靠近左灭点，X校正越大
      const distToLeftVP = Math.abs(px - leftVP[0]);
      const distToRightVP = Math.abs(px - rightVP[0]);
      const totalDist = distToLeftVP + distToRightVP;
      
      // X方向透视校正
      const xCorrection = (distToLeftVP - distToRightVP) / totalDist * 0.5;
      
      // 4. 转换为世界坐标（米）
      const worldX = ((px - leftVP[0] - rightVP[0])/2) / 50 * refSize.width + xCorrection;
      const worldY = distanceToHorizon / 100 * refSize.depth * perspectiveScale;
      
      return [worldX, worldY];
    });
    
    console.log(`转换完成: ${pixelPoints.length}个点 → 世界坐标`);
    return worldPoints;
  }
  
  /**
   * 简单缩放（备用方案）
   */
  static simpleScale(footprintPx, imageInfo, refSize) {
    console.log('📏 使用简单缩放...');
    
    const scaleX = refSize.width / 400;  // 假设400px对应建筑宽度
    const scaleY = refSize.depth / 300;  // 假设300px对应建筑深度
    
    return footprintPx.map(([px, py]) => [
      (px - imageInfo.width/2) * scaleX / 20,
      (py - imageInfo.height/2) * scaleY / 20
    ]);
  }
  
  /**
   * 生成默认矩形脚点
   */
  static generateRectangleFootprint(refSize) {
    console.log('📦 生成默认矩形脚点...');
    
    const w = refSize.width;
    const d = refSize.depth;
    
    return [
      [-w/2, -d/2],  // 左下
      [w/2, -d/2],   // 右下
      [w/2, d/2],    // 右上
      [-w/2, d/2]    // 左上
    ];
  }
  
  /**
   * 分析透视质量
   */
  static analyzePerspectiveQuality(perspectiveData, imageInfo) {
    console.log('\n📊 透视数据质量分析:');
    
    if (!perspectiveData?.vanishing_points_norm) {
      console.log('❌ 无灭点数据');
      return { quality: 'poor', score: 0 };
    }
    
    const { vx_left, vx_right } = perspectiveData.vanishing_points_norm;
    
    if (!vx_left || !vx_right) {
      console.log('❌ 灭点数据不完整');
      return { quality: 'poor', score: 0.2 };
    }
    
    // 转换为像素坐标
    const leftPx = [vx_left[0] * imageInfo.width, vx_left[1] * imageInfo.height];
    const rightPx = [vx_right[0] * imageInfo.width, vx_right[1] * imageInfo.height];
    
    // 质量评估
    let score = 0;
    const criteria = [];
    
    // 1. 灭点Y坐标一致性
    const yDiff = Math.abs(leftPx[1] - rightPx[1]);
    if (yDiff < 20) {
      score += 0.3;
      criteria.push('✅ 地平线一致性好');
    } else {
      criteria.push(`⚠️ 地平线偏差${yDiff.toFixed(0)}px`);
    }
    
    // 2. 灭点距离合理性
    const vpDistance = Math.abs(leftPx[0] - rightPx[0]);
    if (vpDistance > imageInfo.width * 0.5) {
      score += 0.3;
      criteria.push('✅ 灭点距离合理');
    } else {
      criteria.push('⚠️ 灭点距离过近');
    }
    
    // 3. 地平线位置合理性
    const horizonRatio = (leftPx[1] + rightPx[1]) / 2 / imageInfo.height;
    if (horizonRatio > 0.3 && horizonRatio < 0.7) {
      score += 0.2;
      criteria.push(`✅ 地平线位置合理 (${(horizonRatio*100).toFixed(0)}%)`);
    } else {
      criteria.push(`⚠️ 地平线位置异常 (${(horizonRatio*100).toFixed(0)}%)`);
    }
    
    // 4. 灭点位置合理性
    const leftValid = leftPx[0] < imageInfo.width && leftPx[0] > -imageInfo.width;
    const rightValid = rightPx[0] < imageInfo.width * 2 && rightPx[0] > 0;
    
    if (leftValid && rightValid) {
      score += 0.2;
      criteria.push('✅ 灭点位置合理');
    } else {
      criteria.push('⚠️ 灭点位置异常');
    }
    
    criteria.forEach(c => console.log(c));
    
    let quality = 'poor';
    if (score > 0.8) quality = 'excellent';
    else if (score > 0.6) quality = 'good';
    else if (score > 0.4) quality = 'fair';
    
    console.log(`总分: ${(score*100).toFixed(0)}/100 (${quality})`);
    
    return { quality, score, criteria };
  }
}

module.exports = PerspectiveTransform;