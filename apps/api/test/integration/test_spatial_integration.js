#!/usr/bin/env node
/**
 * 测试空间分析特征集成
 * 验证所有空间算法是否正常工作
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3000';

// 使用test1.jpg测试图片
const testImagePath = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/test1.jpg';

async function testSpatialIntegration() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 测试空间分析特征集成');
  console.log('='.repeat(60));
  
  try {
    // 检查测试图片
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ 测试图片不存在:', testImagePath);
      return;
    }
    
    // 准备请求
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testImagePath));
    formData.append('action', 'sketch_to_3d');
    formData.append('sessionId', 'test_spatial_' + Date.now());
    
    console.log('\n📤 发送请求到 /api/ai-plugin/process');
    console.log('  图片:', testImagePath);
    
    // 发送请求
    const startTime = Date.now();
    const response = await axios.post(
      `${API_BASE}/api/ai-plugin/process`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 120000 // 2分钟超时
      }
    );
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ 请求成功 (耗时: ${duration}ms)`);
    
    // 分析响应
    const result = response.data;
    
    // 检查是否使用了空间分析特征
    console.log('\n📊 空间特征使用情况：');
    console.log('='.repeat(40));
    
    // 1. 检查透视分析
    if (result.analysis?.spatial?.perspective) {
      const perspective = result.analysis.spatial.perspective;
      console.log('✅ 透视分析:');
      console.log(`   - 类型: ${perspective.type || '未知'}`);
      console.log(`   - 消失点数: ${perspective.vanishingPoints?.length || 0}`);
      console.log(`   - 视角: ${perspective.viewAngle || 0}度`);
    } else {
      console.log('❌ 未使用透视分析');
    }
    
    // 2. 检查点云数据
    if (result.analysis?.pointCloud) {
      const pc = result.analysis.pointCloud;
      console.log('✅ 点云分析:');
      console.log(`   - 点数: ${pc.pointCloud?.pointCount || 0}`);
      console.log(`   - 建筑轮廓: ${pc.pointCloud?.buildingContours?.length || 0}个`);
      console.log(`   - 楼层模式: ${pc.pointCloud?.floorPatterns?.length || 0}层`);
    } else {
      console.log('❌ 未使用点云分析');
    }
    
    // 3. 检查阴影分析
    if (result.analysis?.shadows) {
      const shadows = result.analysis.shadows;
      console.log('✅ 阴影分析:');
      console.log(`   - 阴影区域: ${shadows.patterns?.length || 0}个`);
      console.log(`   - 光源角度: ${shadows.lightAngle || 0}度`);
      console.log(`   - 推断高度: ${shadows.volumeHeights?.join(', ') || '无'}`);
    } else {
      console.log('❌ 未使用阴影分析');
    }
    
    // 4. 检查空间关系
    if (result.analysis?.spatial?.spatialRelations) {
      const relations = result.analysis.spatial.spatialRelations;
      console.log('✅ 空间关系:');
      console.log(`   - 关系数: ${relations.length}`);
      if (relations.length > 0) {
        console.log(`   - 示例: ${relations[0].type} (${relations[0].confidence})`);
      }
    } else {
      console.log('❌ 未使用空间关系分析');
    }
    
    // 5. 检查生成的3D参数
    console.log('\n📐 3D重建参数：');
    console.log('='.repeat(40));
    
    if (result.modelingData?.volumes) {
      const volumes = result.modelingData.volumes;
      console.log(`体块数: ${volumes.length}`);
      
      volumes.forEach((vol, i) => {
        console.log(`\n体块${i+1}: ${vol.type}`);
        console.log(`  - 位置: (${vol.position?.x}, ${vol.position?.y}, ${vol.position?.z})`);
        console.log(`  - 尺寸: ${vol.dimensions?.width}×${vol.dimensions?.depth}×${vol.dimensions?.height}`);
        console.log(`  - 顶点数: ${vol.vertices?.length || 0}`);
        
        // 检查是否应用了旋转
        if (vol.vertices && vol.vertices.length > 0) {
          const v0 = vol.vertices[0];
          const v1 = vol.vertices[1];
          const angle = Math.atan2(v1[1] - v0[1], v1[0] - v0[0]) * 180 / Math.PI;
          if (Math.abs(angle) > 1) {
            console.log(`  - ✅ 检测到旋转: ${angle.toFixed(1)}度`);
          }
        }
      });
    }
    
    // 保存结果
    const outputPath = path.join(__dirname, 'spatial_test_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 完整结果已保存到: ${outputPath}`);
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    
    const features = [];
    if (result.analysis?.spatial?.perspective) features.push('透视分析');
    if (result.analysis?.pointCloud) features.push('点云提取');
    if (result.analysis?.shadows) features.push('阴影分析');
    if (result.analysis?.spatial?.spatialRelations) features.push('空间关系');
    
    if (features.length > 0) {
      console.log(`✅ 成功使用的空间特征: ${features.join(', ')}`);
    } else {
      console.log('❌ 未使用任何空间分析特征');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testSpatialIntegration();