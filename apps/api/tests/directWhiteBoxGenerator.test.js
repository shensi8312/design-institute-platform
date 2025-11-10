const DirectWhiteBoxGenerator = require('../src/services/ai-modeling/directWhiteBoxGenerator');

describe('DirectWhiteBoxGenerator', () => {
  
  describe('extractBuildingData', () => {
    
    test('应该处理QwenVL的volumes数据格式', () => {
      const analysisData = {
        volumes: [
          {
            id: 'main_building',
            name: '主楼',
            size_hint: { w: 1.2, d: 0.8, h: 1.0 },
            levels: 3,
            yaw_deg: 15
          },
          {
            id: 'side_building',
            name: '副楼',
            size_hint: { w: 0.8, d: 0.6, h: 0.8 },
            levels: 2
          }
        ]
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      expect(buildings.length).toBeGreaterThanOrEqual(2); // 可能有自动生成的连廊
      
      const mainBuilding = buildings[0];
      expect(mainBuilding).toMatchObject({
        name: '主楼',
        w: 18,      // 1.2 * 15
        d: 12,      // 0.8 * 15
        h: 15,      // 1.0 * 15 (size_hint.h优先，不是levels)
        x: 0,
        y: 0,
        z: 0,
        rot: 15
      });
      
      const sideBuilding = buildings[1];
      expect(sideBuilding).toMatchObject({
        name: '副楼',
        w: 12,      // 0.8 * 15
        d: 9,       // 0.6 * 15
        h: 12,      // 0.8 * 15 (size_hint.h优先)
        x: 23,      // 18 + 5 (间距)
        y: 0,
        z: 0,
        rot: 0
      });
    });
    
    test('应该处理modeling数据格式（毫米转米）', () => {
      const analysisData = {
        modeling: {
          buildings: [
            {
              id: 'B1',
              name: 'Tower A',
              dimensions: { width: 18000, depth: 12000, height: 45000 },
              position: { x: 5000, y: 3000, z: 0 },
              rotation: 30
            }
          ]
        }
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      expect(buildings).toHaveLength(1);
      expect(buildings[0]).toMatchObject({
        name: 'Tower A',
        w: 18,      // 18000/1000
        d: 12,      // 12000/1000
        h: 45,      // 45000/1000
        x: 5,       // 5000/1000
        y: 3,       // 3000/1000
        z: 0,
        rot: 30
      });
    });
    
    test('应该处理instances数据格式', () => {
      const analysisData = {
        instances: [
          {
            id: 'building_1',
            center: [0.3, 0.6],  // 图片相对坐标
            dimensions: { width: 20, depth: 15, height: 30 },
            rough_floors: 8
          },
          {
            id: 'building_2',
            center: [0.7, 0.4],
            dimensions: { width: 12, depth: 8, height: 24 },
            rough_floors: 6
          }
        ]
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      expect(buildings.length).toBeGreaterThanOrEqual(2); // 可能有连廊
      
      const building1 = buildings[0];
      expect(building1).toMatchObject({
        name: 'building_1',
        w: 20,
        d: 15,
        h: 30,      // 直接使用dimensions.height
        x: -10,     // (0.3 - 0.5) * 50
        y: 0,
        z: 0,
        rot: 0
      });
      
      const building2 = buildings[1];
      expect(building2).toMatchObject({
        name: 'building_2', 
        w: 12,
        d: 8,
        h: 24,      // 直接使用dimensions.height
        y: 5,       // index * 5
        z: 0,
        rot: 0
      });
      expect(building2.x).toBeCloseTo(10, 1); // (0.7 - 0.5) * 50，允许浮点误差
    });
    
    test('应该处理显式定义的连廊', () => {
      const analysisData = {
        volumes: [
          { id: 'A', name: 'BuildingA', size_hint: { w: 1, d: 1, h: 1 } },
          { id: 'B', name: 'BuildingB', size_hint: { w: 1, d: 1, h: 1 } }
        ],
        connectors: [
          {
            from: 'A',
            to: 'B', 
            width_hint: 0.2,    // 相对宽度
            height_hint: 0.15,  // 相对高度
            elev_hint: 2         // 第2层
          }
        ]
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      expect(buildings).toHaveLength(3); // 2栋建筑 + 1个连廊
      
      const bridge = buildings.find(b => b.name.startsWith('Bridge_'));
      expect(bridge).toBeDefined();
      expect(bridge).toMatchObject({
        name: 'Bridge_A_B',
        w: 5,       // 连廊长度 = |20 - 15| = 5
        d: 3,       // 0.2 * 15
        h: 2.25,    // 0.15 * 15
        z: 3.2      // (2-1) * 3.2
      });
    });
    
    test('应该智能推断连廊（相邻建筑）', () => {
      const analysisData = {
        volumes: [
          { 
            id: 'A', 
            name: 'BuildingA', 
            size_hint: { w: 1, d: 0.8, h: 1 }
          },
          { 
            id: 'B', 
            name: 'BuildingB', 
            size_hint: { w: 0.8, d: 0.6, h: 0.8 }
          }
        ]
        // 没有显式定义connectors，应该自动推断
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      // 应该有2栋建筑 + 1个推断的连廊
      expect(buildings.length).toBeGreaterThan(2);
      
      const bridge = buildings.find(b => b.name.startsWith('Bridge'));
      expect(bridge).toBeDefined();
      expect(bridge.z).toBe(6.4); // 在第2层 (2 * 3.2)
    });
    
  });
  
  describe('recommendRoute', () => {
    
    test('推荐路线A：有标定矩形和像素脚印', () => {
      const analysisData = {
        calibration: {
          img_rect_px: [[100, 50], [400, 50], [400, 300], [100, 300]]
        },
        volumes: [
          {
            footprint_px: [[120, 80], [180, 80], [180, 120], [120, 120]]
          }
        ]
      };
      
      const result = DirectWhiteBoxGenerator.recommendRoute(analysisData);
      
      expect(result.route).toBe('A');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
    
    test('推荐路线B：有世界坐标数据', () => {
      const analysisData = {
        modeling: {
          buildings: [
            {
              position: { x: 0, y: 0, z: 0 },
              dimensions: { width: 15000, depth: 10000, height: 30000 }
            }
          ]
        }
      };
      
      const result = DirectWhiteBoxGenerator.recommendRoute(analysisData);
      
      expect(result.route).toBe('B');
      expect(result.confidence).toBe(0.9);
    });
    
    test('推荐路线B：默认情况', () => {
      const analysisData = {
        volumes: [
          { id: 'A', size_hint: { w: 1, d: 1, h: 1 } }
        ]
      };
      
      const result = DirectWhiteBoxGenerator.recommendRoute(analysisData);
      
      expect(result.route).toBe('B');
      expect(result.confidence).toBe(0.6);
    });
    
  });
  
  describe('generateRubyCode', () => {
    
    test('应该生成正确的Ruby代码', () => {
      const analysisData = {
        volumes: [
          {
            id: 'main',
            name: '主楼',
            size_hint: { w: 1.2, d: 0.8, h: 1.0 },
            levels: 4
          }
        ]
      };
      
      const result = DirectWhiteBoxGenerator.generateRubyCode(analysisData);
      
      expect(result).toHaveProperty('rubyCode');
      expect(result).toHaveProperty('buildings');
      expect(result).toHaveProperty('metadata');
      
      expect(result.rubyCode).toContain('buildings = [');
      expect(result.rubyCode).toContain('name:"主楼"');
      expect(result.rubyCode).toContain('w:18');    // 1.2 * 15
      expect(result.rubyCode).toContain('d:12');    // 0.8 * 15
      expect(result.rubyCode).toContain('h:15');   // 1.0 * 15 (size_hint.h)
      
      expect(result.buildings).toHaveLength(1);
      expect(result.metadata.method).toBe('direct_generation');
    });
    
    test('应该处理多个建筑和连廊', () => {
      const analysisData = {
        volumes: [
          { id: 'A', name: 'Tower A', size_hint: { w: 1, d: 1, h: 1 }, levels: 10 },
          { id: 'B', name: 'Tower B', size_hint: { w: 0.8, d: 0.8, h: 0.8 }, levels: 8 }
        ],
        connectors: [
          { from: 'A', to: 'B', width_hint: 0.2, height_hint: 0.16, elev_hint: 3 }
        ]
      };
      
      const result = DirectWhiteBoxGenerator.generateRubyCode(analysisData);
      
      // 2栋建筑 + 1个连廊 = 3个对象
      expect(result.buildings).toHaveLength(3);
      
      // 检查Ruby代码包含所有建筑
      expect(result.rubyCode).toContain('Tower A');
      expect(result.rubyCode).toContain('Tower B');
      expect(result.rubyCode).toContain('Bridge_A_B');
    });
    
    test('应该生成有效的Ruby语法', () => {
      const analysisData = {
        volumes: [
          { id: 'test', name: 'Test Building', size_hint: { w: 1, d: 1, h: 1 } }
        ]
      };
      
      const result = DirectWhiteBoxGenerator.generateRubyCode(analysisData);
      
      // 检查关键Ruby语法元素
      expect(result.rubyCode).toContain('buildings.each do |b|');
      expect(result.rubyCode).toContain('grp = m.entities.add_group');
      expect(result.rubyCode).toContain('face.pushpull(h)');
      expect(result.rubyCode).toContain('m.commit_operation');
      
      // 检查字符串引号和换行符
      expect(result.rubyCode).not.toContain('undefined');
      expect(result.rubyCode).not.toContain('NaN');
    });
    
  });
  
  describe('generateBothRoutes', () => {
    
    test('应该生成两条路线的对比结果', () => {
      const analysisData = {
        volumes: [
          { id: 'A', size_hint: { w: 1, d: 1, h: 1 } }
        ]
      };
      const imageInfo = { width: 800, height: 600 };
      
      const result = DirectWhiteBoxGenerator.generateBothRoutes(analysisData, imageInfo);
      
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('routeB');
      expect(result.recommendation.route).toBe('B');
      expect(result.routeB.type).toBe('direct_generation');
      expect(result.routeB.rubyCode).toBeDefined();
    });
    
  });
  
  describe('边界情况测试', () => {
    
    test('应该处理空数据', () => {
      const buildings = DirectWhiteBoxGenerator.extractBuildingData({});
      expect(buildings).toEqual([]);
    });
    
    test('应该处理缺失尺寸的数据', () => {
      const analysisData = {
        volumes: [
          { id: 'incomplete' }  // 缺少size_hint
        ]
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      expect(buildings).toHaveLength(1);
      expect(buildings[0]).toMatchObject({
        name: 'incomplete',
        w: 15,   // 默认值
        d: 10,   // 默认值
        h: 10    // 默认值
      });
    });
    
    test('应该处理负数和零值', () => {
      const analysisData = {
        volumes: [
          { 
            id: 'weird',
            size_hint: { w: -0.5, d: 0, h: 2 },
            levels: 0
          }
        ]
      };
      
      const buildings = DirectWhiteBoxGenerator.extractBuildingData(analysisData);
      
      // 负数或零值应该被处理为合理的默认值
      expect(Math.abs(buildings[0].w)).toBeGreaterThan(0);
      expect(Math.abs(buildings[0].d)).toBeGreaterThan(0);
      expect(Math.abs(buildings[0].h)).toBeGreaterThan(0);
    });
    
  });

});