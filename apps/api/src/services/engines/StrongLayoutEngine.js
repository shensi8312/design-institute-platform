/**
 * 强排图生成引擎
 * 根据单条规则生成对应的示意图布局结构
 *
 * 功能：
 * 1. 解析强排规则
 * 2. 生成布局约束
 * 3. 输出 SVG/JSON 格式的示意图数据
 */

const { createCanvas } = require('canvas');

class StrongLayoutEngine {
  constructor() {
    // 画布默认配置
    this.defaultConfig = {
      width: 800,
      height: 600,
      padding: 50,
      scale: 1,  // 米到像素的比例
      colors: {
        land: '#f5f5f5',           // 用地底色
        building: '#4a90d9',       // 建筑填充
        buildingStroke: '#2c5282', // 建筑边框
        redLine: '#ff4d4f',        // 红线
        setback: '#ffa940',        // 退距线
        spacing: '#52c41a',        // 间距标注
        text: '#333333',           // 文字
        dimension: '#666666',      // 标注线
        greenArea: '#95de64',      // 绿地
        road: '#d9d9d9',           // 道路
      },
      fonts: {
        title: 'bold 16px Arial',
        label: '12px Arial',
        dimension: '10px Arial',
      },
    };

    // 规则类型到生成器的映射
    this.generators = {
      building_spacing: this._generateBuildingSpacingDiagram.bind(this),
      setback: this._generateSetbackDiagram.bind(this),
      building_height: this._generateBuildingHeightDiagram.bind(this),
      floor_area_ratio: this._generateFARDiagram.bind(this),
      green_ratio: this._generateGreenRatioDiagram.bind(this),
      building_density: this._generateBuildingDensityDiagram.bind(this),
      sunlight_analysis: this._generateSunlightDiagram.bind(this),
      fire_distance: this._generateFireDistanceDiagram.bind(this),
      parking: this._generateParkingDiagram.bind(this),
    };
  }

  /**
   * 根据规则生成示意图
   * @param {Object} rule - 强排规则对象
   * @param {Object} options - 配置选项
   * @returns {Object} - 包含 svg, json, metadata 的结果
   */
  async generateDiagram(rule, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    const { rule_structure } = rule;

    if (!rule_structure || !rule_structure.subType) {
      throw new Error('无效的规则结构');
    }

    const generator = this.generators[rule_structure.subType];
    if (!generator) {
      return this._generateGenericDiagram(rule, config);
    }

    return await generator(rule, config);
  }

  /**
   * 生成建筑间距示意图
   */
  async _generateBuildingSpacingDiagram(rule, config) {
    const { value, unit, constraintType, scope } = rule.rule_structure;
    const spacing = parseFloat(value);

    // 计算画布比例
    const pixelPerMeter = Math.min(
      (config.width - config.padding * 2) / (spacing * 3),
      (config.height - config.padding * 2) / (spacing * 2)
    );

    // 生成布局数据
    const layoutData = {
      type: 'building_spacing',
      rule: {
        spacing,
        unit: unit || 'm',
        constraintType,
      },
      elements: {
        land: {
          type: 'rect',
          x: 0,
          y: 0,
          width: spacing * 3,
          height: spacing * 2,
          fill: config.colors.land,
          stroke: config.colors.redLine,
          strokeWidth: 2,
          label: '用地范围',
        },
        buildings: [
          {
            type: 'rect',
            id: 'building_A',
            x: spacing * 0.3,
            y: spacing * 0.5,
            width: spacing * 0.8,
            height: spacing * 0.6,
            fill: config.colors.building,
            stroke: config.colors.buildingStroke,
            strokeWidth: 2,
            label: '建筑A',
          },
          {
            type: 'rect',
            id: 'building_B',
            x: spacing * 1.9,
            y: spacing * 0.5,
            width: spacing * 0.8,
            height: spacing * 0.6,
            fill: config.colors.building,
            stroke: config.colors.buildingStroke,
            strokeWidth: 2,
            label: '建筑B',
          },
        ],
        dimensions: [
          {
            type: 'dimension',
            from: { x: spacing * 1.1, y: spacing * 0.8 },
            to: { x: spacing * 1.9, y: spacing * 0.8 },
            value: `≥${spacing}${unit || 'm'}`,
            color: config.colors.spacing,
            label: '建筑间距',
          },
        ],
        annotations: [
          {
            type: 'text',
            x: spacing * 1.5,
            y: spacing * 1.6,
            text: `建筑间距要求: ${constraintType === 'MIN' ? '不小于' : ''}${spacing}${unit || 'm'}`,
            font: config.fonts.label,
            color: config.colors.text,
          },
        ],
      },
      scale: pixelPerMeter,
      metadata: {
        ruleName: rule.name,
        ruleCode: rule.code,
        scope,
      },
    };

    // 生成 SVG
    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'building_spacing',
        generatedAt: new Date().toISOString(),
        dimensions: { width: config.width, height: config.height },
      },
    };
  }

  /**
   * 生成红线退距示意图
   */
  async _generateSetbackDiagram(rule, config) {
    const { value, unit, constraintType, scope } = rule.rule_structure;
    const setback = parseFloat(value);

    const landSize = setback * 4;
    const pixelPerMeter = Math.min(
      (config.width - config.padding * 2) / landSize,
      (config.height - config.padding * 2) / landSize
    );

    const layoutData = {
      type: 'setback',
      rule: {
        setback,
        unit: unit || 'm',
        constraintType,
      },
      elements: {
        land: {
          type: 'rect',
          x: 0,
          y: 0,
          width: landSize,
          height: landSize,
          fill: config.colors.land,
          stroke: config.colors.redLine,
          strokeWidth: 3,
          strokeDasharray: '10,5',
          label: '用地红线',
        },
        buildableArea: {
          type: 'rect',
          x: setback,
          y: setback,
          width: landSize - setback * 2,
          height: landSize - setback * 2,
          fill: 'rgba(74, 144, 217, 0.1)',
          stroke: config.colors.setback,
          strokeWidth: 2,
          strokeDasharray: '5,3',
          label: '可建范围',
        },
        building: {
          type: 'rect',
          x: setback + (landSize - setback * 2) * 0.2,
          y: setback + (landSize - setback * 2) * 0.2,
          width: (landSize - setback * 2) * 0.6,
          height: (landSize - setback * 2) * 0.6,
          fill: config.colors.building,
          stroke: config.colors.buildingStroke,
          strokeWidth: 2,
          label: '建筑',
        },
        dimensions: [
          {
            type: 'dimension',
            from: { x: 0, y: landSize / 2 },
            to: { x: setback, y: landSize / 2 },
            value: `≥${setback}${unit || 'm'}`,
            color: config.colors.setback,
            label: '退距',
            direction: 'horizontal',
          },
          {
            type: 'dimension',
            from: { x: landSize / 2, y: 0 },
            to: { x: landSize / 2, y: setback },
            value: `≥${setback}${unit || 'm'}`,
            color: config.colors.setback,
            label: '退距',
            direction: 'vertical',
          },
        ],
        road: {
          type: 'rect',
          x: -setback,
          y: landSize,
          width: landSize + setback * 2,
          height: setback,
          fill: config.colors.road,
          label: '道路',
        },
      },
      scale: pixelPerMeter,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'setback',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成建筑高度示意图（立面图）
   */
  async _generateBuildingHeightDiagram(rule, config) {
    const { value, unit, constraintType } = rule.rule_structure;
    const maxHeight = parseFloat(value);

    const groundWidth = maxHeight * 2;
    const pixelPerMeter = Math.min(
      (config.width - config.padding * 2) / groundWidth,
      (config.height - config.padding * 2) / (maxHeight * 1.3)
    );

    const layoutData = {
      type: 'building_height',
      rule: {
        maxHeight,
        unit: unit || 'm',
        constraintType,
      },
      elements: {
        ground: {
          type: 'line',
          x1: 0,
          y1: maxHeight * 1.2,
          x2: groundWidth,
          y2: maxHeight * 1.2,
          stroke: '#333',
          strokeWidth: 2,
          label: '地面线',
        },
        heightLimit: {
          type: 'line',
          x1: 0,
          y1: maxHeight * 0.2,
          x2: groundWidth,
          y2: maxHeight * 0.2,
          stroke: config.colors.redLine,
          strokeWidth: 2,
          strokeDasharray: '10,5',
          label: `限高线 ${maxHeight}${unit || 'm'}`,
        },
        building: {
          type: 'rect',
          x: groundWidth * 0.3,
          y: maxHeight * 0.3,
          width: groundWidth * 0.4,
          height: maxHeight * 0.9,
          fill: config.colors.building,
          stroke: config.colors.buildingStroke,
          strokeWidth: 2,
          label: '建筑',
        },
        dimensions: [
          {
            type: 'dimension',
            from: { x: groundWidth * 0.75, y: maxHeight * 1.2 },
            to: { x: groundWidth * 0.75, y: maxHeight * 0.2 },
            value: `≤${maxHeight}${unit || 'm'}`,
            color: config.colors.dimension,
            direction: 'vertical',
          },
        ],
      },
      scale: pixelPerMeter,
      viewType: 'elevation',  // 立面图
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'building_height',
        viewType: 'elevation',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成容积率示意图
   */
  async _generateFARDiagram(rule, config) {
    const { value, constraintType } = rule.rule_structure;
    const far = parseFloat(value);

    // 假设用地面积100㎡
    const landArea = 100;
    const totalFloorArea = landArea * far;
    const floors = Math.ceil(far);  // 层数
    const footprint = totalFloorArea / floors;  // 单层面积
    const footprintRatio = footprint / landArea;  // 底层占地比

    const layoutData = {
      type: 'floor_area_ratio',
      rule: { far, constraintType },
      elements: {
        land: {
          type: 'rect',
          x: 0, y: 0,
          width: 100, height: 100,
          fill: config.colors.land,
          stroke: config.colors.redLine,
          strokeWidth: 2,
          label: `用地面积: ${landArea}㎡`,
        },
        building: {
          type: 'rect',
          x: (100 - Math.sqrt(footprintRatio) * 100) / 2,
          y: (100 - Math.sqrt(footprintRatio) * 100) / 2,
          width: Math.sqrt(footprintRatio) * 100,
          height: Math.sqrt(footprintRatio) * 100,
          fill: config.colors.building,
          stroke: config.colors.buildingStroke,
          strokeWidth: 2,
          label: '建筑底面',
        },
        info: {
          type: 'text',
          x: 50, y: 85,
          text: `容积率 ≤ ${far}\n建筑面积: ${totalFloorArea}㎡\n约 ${floors} 层`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'floor_area_ratio',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成绿地率示意图
   */
  async _generateGreenRatioDiagram(rule, config) {
    const { value, constraintType } = rule.rule_structure;
    const greenRatio = parseFloat(value) / 100;

    const layoutData = {
      type: 'green_ratio',
      rule: { greenRatio: value, constraintType },
      elements: {
        land: {
          type: 'rect',
          x: 0, y: 0,
          width: 100, height: 100,
          fill: config.colors.land,
          stroke: config.colors.redLine,
          strokeWidth: 2,
        },
        building: {
          type: 'rect',
          x: 30, y: 20,
          width: 40, height: 40,
          fill: config.colors.building,
          label: '建筑',
        },
        greenAreas: [
          {
            type: 'rect',
            x: 5, y: 5,
            width: 20, height: 90,
            fill: config.colors.greenArea,
            label: '绿地',
          },
          {
            type: 'rect',
            x: 75, y: 5,
            width: 20, height: 90,
            fill: config.colors.greenArea,
          },
          {
            type: 'rect',
            x: 30, y: 65,
            width: 40, height: 30,
            fill: config.colors.greenArea,
          },
        ],
        info: {
          type: 'text',
          x: 50, y: 95,
          text: `绿地率 ≥ ${value}%`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'green_ratio',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成建筑密度示意图
   */
  async _generateBuildingDensityDiagram(rule, config) {
    const { value, constraintType } = rule.rule_structure;
    const density = parseFloat(value) / 100;

    const buildingSize = Math.sqrt(density) * 100;

    const layoutData = {
      type: 'building_density',
      rule: { density: value, constraintType },
      elements: {
        land: {
          type: 'rect',
          x: 0, y: 0,
          width: 100, height: 100,
          fill: config.colors.land,
          stroke: config.colors.redLine,
          strokeWidth: 2,
          label: '用地范围',
        },
        building: {
          type: 'rect',
          x: (100 - buildingSize) / 2,
          y: (100 - buildingSize) / 2,
          width: buildingSize,
          height: buildingSize,
          fill: config.colors.building,
          stroke: config.colors.buildingStroke,
          strokeWidth: 2,
          label: `建筑占地 ${value}%`,
        },
        info: {
          type: 'text',
          x: 50, y: 95,
          text: `建筑密度 ≤ ${value}%`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'building_density',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成日照分析示意图
   */
  async _generateSunlightDiagram(rule, config) {
    const { value, unit } = rule.rule_structure;

    const layoutData = {
      type: 'sunlight_analysis',
      rule: { hours: value, unit: unit || 'h' },
      elements: {
        sun: {
          type: 'circle',
          cx: 80, cy: 20,
          r: 15,
          fill: '#ffcc00',
          stroke: '#ff9900',
          label: '太阳',
        },
        sunRays: {
          type: 'path',
          d: 'M80,35 L60,80 M80,35 L100,80 M80,35 L80,85',
          stroke: '#ffcc00',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        building: {
          type: 'rect',
          x: 20, y: 50,
          width: 30, height: 40,
          fill: config.colors.building,
          label: '被遮挡建筑',
        },
        shadowBuilding: {
          type: 'rect',
          x: 60, y: 50,
          width: 20, height: 50,
          fill: '#666',
          label: '遮挡建筑',
        },
        window: {
          type: 'rect',
          x: 35, y: 60,
          width: 10, height: 15,
          fill: '#87CEEB',
          stroke: '#333',
          label: '窗户',
        },
        info: {
          type: 'text',
          x: 50, y: 95,
          text: `日照时数 ≥ ${value}${unit || '小时'}`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
      viewType: 'section',  // 剖面图
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'sunlight_analysis',
        viewType: 'section',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成消防间距示意图
   */
  async _generateFireDistanceDiagram(rule, config) {
    const { value, unit } = rule.rule_structure;
    const distance = parseFloat(value);

    const layoutData = {
      type: 'fire_distance',
      rule: { distance, unit: unit || 'm' },
      elements: {
        buildings: [
          {
            type: 'rect',
            x: 10, y: 30,
            width: 30, height: 40,
            fill: config.colors.building,
            label: '建筑A',
          },
          {
            type: 'rect',
            x: 60, y: 30,
            width: 30, height: 40,
            fill: config.colors.building,
            label: '建筑B',
          },
        ],
        firePassage: {
          type: 'rect',
          x: 40, y: 25,
          width: 20, height: 50,
          fill: 'rgba(255, 77, 79, 0.2)',
          stroke: config.colors.redLine,
          strokeDasharray: '5,5',
          label: '消防通道',
        },
        dimension: {
          type: 'dimension',
          from: { x: 40, y: 50 },
          to: { x: 60, y: 50 },
          value: `≥${distance}${unit || 'm'}`,
          color: config.colors.redLine,
        },
        info: {
          type: 'text',
          x: 50, y: 90,
          text: `消防间距 ≥ ${distance}${unit || 'm'}`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'fire_distance',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成停车配置示意图
   */
  async _generateParkingDiagram(rule, config) {
    const { value, unit } = rule.rule_structure;

    const layoutData = {
      type: 'parking',
      rule: { count: value, unit: unit || '个' },
      elements: {
        land: {
          type: 'rect',
          x: 0, y: 0,
          width: 100, height: 100,
          fill: config.colors.land,
          stroke: config.colors.redLine,
        },
        building: {
          type: 'rect',
          x: 10, y: 10,
          width: 50, height: 40,
          fill: config.colors.building,
          label: '建筑',
        },
        parkingLot: {
          type: 'rect',
          x: 10, y: 55,
          width: 80, height: 35,
          fill: config.colors.road,
          stroke: '#666',
          label: '停车场',
        },
        parkingSpaces: Array.from({ length: Math.min(parseInt(value), 8) }, (_, i) => ({
          type: 'rect',
          x: 15 + i * 9,
          y: 60,
          width: 7,
          height: 25,
          fill: '#fff',
          stroke: '#333',
        })),
        info: {
          type: 'text',
          x: 50, y: 95,
          text: `停车位 ≥ ${value}${unit || '个'}`,
          textAlign: 'center',
        },
      },
      scale: (config.width - config.padding * 2) / 100,
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'parking',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 生成通用示意图
   */
  _generateGenericDiagram(rule, config) {
    const layoutData = {
      type: 'generic',
      rule: rule.rule_structure,
      elements: {
        title: {
          type: 'text',
          x: config.width / 2,
          y: 50,
          text: rule.name,
          font: config.fonts.title,
          textAlign: 'center',
        },
        content: {
          type: 'text',
          x: config.width / 2,
          y: config.height / 2,
          text: rule.content,
          font: config.fonts.label,
          textAlign: 'center',
        },
      },
    };

    const svg = this._layoutDataToSVG(layoutData, config);

    return {
      svg,
      json: layoutData,
      metadata: {
        ruleType: 'generic',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 将布局数据转换为 SVG
   */
  _layoutDataToSVG(layoutData, config) {
    const { width, height, padding } = config;
    const scale = layoutData.scale || 1;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

    // 添加背景
    svgContent += `<rect x="0" y="0" width="${width}" height="${height}" fill="white"/>`;

    // 添加标题
    if (layoutData.rule) {
      svgContent += `<text x="${width / 2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">${this._getRuleTitle(layoutData.type)}</text>`;
    }

    // 创建变换组（居中和缩放）
    svgContent += `<g transform="translate(${padding}, ${padding + 20})">`;

    // 渲染元素
    const elements = layoutData.elements;
    for (const [key, element] of Object.entries(elements)) {
      if (Array.isArray(element)) {
        element.forEach(el => {
          svgContent += this._elementToSVG(el, scale);
        });
      } else if (element && typeof element === 'object') {
        svgContent += this._elementToSVG(element, scale);
      }
    }

    svgContent += '</g>';
    svgContent += '</svg>';

    return svgContent;
  }

  /**
   * 将单个元素转换为 SVG
   */
  _elementToSVG(element, scale) {
    if (!element || !element.type) return '';

    const s = scale;

    switch (element.type) {
      case 'rect':
        return `<rect x="${element.x * s}" y="${element.y * s}" width="${element.width * s}" height="${element.height * s}"
          fill="${element.fill || 'none'}" stroke="${element.stroke || 'none'}" stroke-width="${element.strokeWidth || 1}"
          ${element.strokeDasharray ? `stroke-dasharray="${element.strokeDasharray}"` : ''}/>
          ${element.label ? `<text x="${(element.x + element.width / 2) * s}" y="${(element.y + element.height / 2) * s}"
          text-anchor="middle" dominant-baseline="middle" font-size="10">${element.label}</text>` : ''}`;

      case 'circle':
        return `<circle cx="${element.cx * s}" cy="${element.cy * s}" r="${element.r * s}"
          fill="${element.fill || 'none'}" stroke="${element.stroke || 'none'}"/>`;

      case 'line':
        return `<line x1="${element.x1 * s}" y1="${element.y1 * s}" x2="${element.x2 * s}" y2="${element.y2 * s}"
          stroke="${element.stroke || '#333'}" stroke-width="${element.strokeWidth || 1}"
          ${element.strokeDasharray ? `stroke-dasharray="${element.strokeDasharray}"` : ''}/>`;

      case 'path':
        return `<path d="${element.d}" fill="${element.fill || 'none'}" stroke="${element.stroke || '#333'}"
          stroke-width="${element.strokeWidth || 1}"
          ${element.strokeDasharray ? `stroke-dasharray="${element.strokeDasharray}"` : ''}/>`;

      case 'text':
        return `<text x="${element.x * s}" y="${element.y * s}"
          text-anchor="${element.textAlign || 'start'}" font-size="${element.fontSize || 12}"
          fill="${element.color || '#333'}">${element.text}</text>`;

      case 'dimension':
        return this._renderDimension(element, s);

      default:
        return '';
    }
  }

  /**
   * 渲染标注线
   */
  _renderDimension(dim, scale) {
    const s = scale;
    const from = dim.from;
    const to = dim.to;
    const color = dim.color || '#666';
    const arrowSize = 5;

    let svg = '';

    // 主线
    svg += `<line x1="${from.x * s}" y1="${from.y * s}" x2="${to.x * s}" y2="${to.y * s}"
      stroke="${color}" stroke-width="1"/>`;

    // 端点标记
    svg += `<line x1="${from.x * s - arrowSize}" y1="${from.y * s}" x2="${from.x * s + arrowSize}" y2="${from.y * s}"
      stroke="${color}" stroke-width="2"/>`;
    svg += `<line x1="${to.x * s - arrowSize}" y1="${to.y * s}" x2="${to.x * s + arrowSize}" y2="${to.y * s}"
      stroke="${color}" stroke-width="2"/>`;

    // 标注文字
    const midX = (from.x + to.x) / 2 * s;
    const midY = (from.y + to.y) / 2 * s - 5;
    svg += `<text x="${midX}" y="${midY}" text-anchor="middle" font-size="10" fill="${color}">${dim.value}</text>`;

    return svg;
  }

  /**
   * 获取规则类型标题
   */
  _getRuleTitle(type) {
    const titles = {
      building_spacing: '建筑间距规则示意图',
      setback: '红线退距规则示意图',
      building_height: '建筑高度限制示意图',
      floor_area_ratio: '容积率规则示意图',
      green_ratio: '绿地率规则示意图',
      building_density: '建筑密度规则示意图',
      sunlight_analysis: '日照分析规则示意图',
      fire_distance: '消防间距规则示意图',
      parking: '停车配置规则示意图',
      generic: '规则示意图',
    };
    return titles[type] || '规则示意图';
  }

  /**
   * 批量生成多条规则的示意图
   */
  async generateBatchDiagrams(rules, options = {}) {
    const results = [];

    for (const rule of rules) {
      try {
        const diagram = await this.generateDiagram(rule, options);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: true,
          ...diagram,
        });
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

module.exports = new StrongLayoutEngine();
