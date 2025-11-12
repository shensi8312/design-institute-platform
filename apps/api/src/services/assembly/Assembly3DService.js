const db = require('../../config/database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Assembly 3D Visualization Service
 * 将PID识别结果+装配约束转换为3D可视化数据
 */
class Assembly3DService {
  constructor() {
    this.stepFilesDir = path.join(__dirname, '../../../../docs/solidworks');
    this.cacheDir = path.join(__dirname, '../../../uploads/3d-models');
  }

  /**
   * 生成装配任务的3D可视化数据
   * @param {string} taskId - 装配任务ID
   * @returns {Object} { parts: [...], constraints: [...] }
   */
  async generateAssemblyVisualization(taskId) {
    try {
      console.log(`[Assembly3D] 🎨 生成装配可视化: ${taskId}`);

      const DEMO_MODE = process.env.ASSEMBLY_DEMO_MODE === 'true'  // 🎭 演示模式

      // 1. 获取装配任务信息
      const task = await db('assembly_inference_tasks')
        .where({ id: taskId })
        .first();

      if (!task) {
        throw new Error(`装配任务不存在: ${taskId}`);
      }

      // 2. 获取BOM清单
      let bomData = JSON.parse(task.bom_data || '[]');

      // 🎭 演示模式：如果BOM为空，生成示例数据
      if (DEMO_MODE && bomData.length === 0) {
        console.log('[Assembly3D] 🎭 演示模式：生成示例BOM数据')
        bomData = [
          { part_number: 'V1', name: '气动阀V1', type: 'PNEUMATIC_VALVE' },
          { part_number: 'V2', name: '气动阀V2', type: 'PNEUMATIC_VALVE' },
          { part_number: 'MV1', name: '手动阀MV1', type: 'MANUAL_VALVE' },
          { part_number: 'MFC1', name: '质量流量计MFC1', type: 'MFC' },
          { part_number: 'PR1', name: '压力调节器PR1', type: 'PRESSURE_REGULATOR' },
          { part_number: 'F1', name: '过滤器F1', type: 'FILTER' }
        ]
      }

      console.log(`[Assembly3D] 📦 BOM清单: ${bomData.length}个零件`);

      // 3. 获取装配约束
      let constraints = await db('assembly_constraints')
        .where({ task_id: taskId })
        .select('*');

      // 🎭 演示模式：如果约束为空，生成示例约束
      if (DEMO_MODE && constraints.length === 0 && bomData.length >= 2) {
        console.log('[Assembly3D] 🎭 演示模式：生成示例约束')
        constraints = []
        for (let i = 0; i < Math.min(bomData.length - 1, 8); i++) {
          constraints.push({
            constraint_type: ['CONCENTRIC', 'COINCIDENT', 'PARALLEL'][i % 3],
            entity_a: bomData[i].part_number,
            entity_b: bomData[i + 1].part_number,
            confidence_score: 0.8 + Math.random() * 0.15,
            reasoning_trace: `演示约束：${bomData[i].name} 与 ${bomData[i + 1].name} 配合连接`
          })
        }
      }

      console.log(`[Assembly3D] 🔗 装配约束: ${constraints.length}个`);

      // 4. 匹配零件到STEP文件
      const parts = await this._matchPartsToStepFiles(bomData);

      // 5. 计算零件位置（基于约束）
      const positionedParts = await this._calculatePartPositions(parts, constraints);

      return {
        success: true,
        taskId,
        parts: positionedParts,
        constraints: constraints.map(c => ({
          type: c.constraint_type,
          partA: c.entity_a,
          partB: c.entity_b,
          confidence: c.confidence_score,
          reasoning: c.reasoning_trace
        })),
        stats: {
          totalParts: positionedParts.length,
          matchedStepFiles: positionedParts.filter(p => p.stepFile).length,
          constraintsCount: constraints.length
        }
      };
    } catch (error) {
      console.error('[Assembly3D] ❌ 生成可视化失败:', error);
      throw error;
    }
  }

  /**
   * 匹配BOM零件到STEP文件（从solidworks零件库）
   * 通过零件编号精确匹配
   */
  async _matchPartsToStepFiles(bomData) {
    const stepFiles = await fs.readdir(this.stepFilesDir);
    console.log(`[Assembly3D] 📁 零件库: ${stepFiles.length}个STEP文件`);

    const parts = [];

    for (const bomItem of bomData) {
      const partNumber = bomItem.part_number || bomItem.partNumber || bomItem.name;

      // 多策略匹配STEP文件
      const stepFile = this._findBestMatch(partNumber, stepFiles);

      // 检查对应的STL文件是否已转换
      let modelPath = null;
      let modelFormat = 'placeholder';

      if (stepFile) {
        const stlFileName = stepFile.replace(/\.STEP$/i, '.stl');
        const stlPath = path.join(this.stlCacheDir, stlFileName);

        try {
          await fs.access(stlPath);
          // STL文件存在，可以直接加载
          modelPath = `/api/assembly/models/${stlFileName}`;
          modelFormat = 'stl';
          console.log(`[Assembly3D] ✅ ${partNumber} -> ${stlFileName}`);
        } catch {
          // STL不存在，需要转换STEP
          modelPath = null;
          modelFormat = 'needs_conversion';
          console.log(`[Assembly3D] ⚠️  ${partNumber} -> ${stepFile} (待转换)`);
        }
      } else {
        console.log(`[Assembly3D] ❌ ${partNumber} 未找到STEP文件`);
      }

      parts.push({
        partNumber,
        name: bomItem.part_name || bomItem.name || partNumber,
        type: bomItem.part_type || bomItem.type || 'UNKNOWN',
        stepFile,
        modelPath,
        modelFormat,
        thread: bomItem.thread,
        sealing: bomItem.sealing,
        manufacturer: bomItem.manufacturer,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
    }

    const matchedCount = parts.filter(p => p.stepFile).length;
    const withStl = parts.filter(p => p.modelFormat === 'stl').length;
    console.log(`[Assembly3D] 📊 匹配结果: ${matchedCount}/${parts.length} 找到STEP, ${withStl}个已有STL`);

    return parts;
  }

  /**
   * 多策略查找STEP文件
   */
  _findBestMatch(partNumber, stepFiles) {
    // 策略1: 精确匹配（如 V1 -> 100001060023.STEP）
    let match = stepFiles.find(f =>
      f.toUpperCase().startsWith(partNumber.toUpperCase()) &&
      /\.STEP$/i.test(f)
    );
    if (match) return match;

    // 策略2: 提取数字部分匹配（如 MV1 -> 数字开头的文件）
    const numPart = partNumber.replace(/^[A-Z]+/i, '');
    if (numPart) {
      match = stepFiles.find(f => f.includes(numPart) && /\.STEP$/i.test(f));
      if (match) return match;
    }

    // 策略3: 去除特殊字符后模糊匹配
    const cleanPart = partNumber.replace(/[^A-Z0-9]/gi, '');
    match = stepFiles.find(f => {
      const cleanFile = f.replace(/[^A-Z0-9]/gi, '');
      return cleanFile.includes(cleanPart) && /\.STEP$/i.test(f);
    });

    return match || null;
  }

  /**
   * 计算零件位置（基于装配约束）
   * P0阶段：简单的网格布局
   * P1阶段：基于约束的智能定位
   */
  async _calculatePartPositions(parts, constraints) {
    console.log('[Assembly3D] 📐 计算零件位置（网格布局）');

    const gridSize = Math.ceil(Math.sqrt(parts.length));
    const spacing = 100; // 零件间距

    return parts.map((part, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      return {
        ...part,
        position: {
          x: col * spacing - (gridSize * spacing) / 2,
          y: 0,
          z: row * spacing - (gridSize * spacing) / 2
        }
      };
    });
  }
}

module.exports = new Assembly3DService();
