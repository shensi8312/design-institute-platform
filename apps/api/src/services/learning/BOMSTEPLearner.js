const knex = require('../../config/database');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * BOM + STEP几何学习服务
 * 无需PID，仅从BOM和STEP文件学习装配约束
 */
class BOMSTEPLearner {
  /**
   * 从BOM和STEP文件学习装配规则
   * @param {Array} bomData - BOM数据 [{partNumber, partName, quantity, type}]
   * @param {Array} stepFiles - STEP文件路径列表
   * @returns {Array} - 学习到的规则
   */
  async learnFromBOMAndSTEP(bomData, stepFiles) {
    console.log(`🎓 [BOM+STEP学习] 开始学习...`);
    console.log(`  BOM零件数: ${bomData.length}, STEP文件数: ${stepFiles.length}`);

    const allRules = [];

    // 1. 从BOM学习配套规则
    const bomRules = await this._learnFromBOM(bomData);
    allRules.push(...bomRules);
    console.log(`  ✓ BOM配套规则: ${bomRules.length} 条`);

    // 2. 从STEP文件学习几何约束
    const stepRules = await this._learnFromSTEP(stepFiles, bomData);
    allRules.push(...stepRules);
    console.log(`  ✓ STEP几何约束: ${stepRules.length} 条`);

    // 3. 保存规则
    const savedRules = await this._saveRules(allRules);
    console.log(`✅ [BOM+STEP学习] 完成，保存 ${savedRules.length} 条规则`);

    return savedRules;
  }

  /**
   * 从BOM学习配套规则
   * 分析零件类型、名称、数量关系
   */
  async _learnFromBOM(bomData) {
    const rules = [];

    // 1. 螺栓-螺母配对规则
    const bolts = bomData.filter(p => /螺栓|bolt/i.test(p.partName));
    const nuts = bomData.filter(p => /螺母|nut/i.test(p.partName));

    bolts.forEach(bolt => {
      const matchingNuts = nuts.filter(nut =>
        this._threadMatches(bolt.partName, nut.partName)
      );

      matchingNuts.forEach(nut => {
        rules.push({
          rule_id: `BOM_BOLT_NUT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `螺栓-螺母配对: ${bolt.partNumber} + ${nut.partNumber}`,
          description: `${bolt.partName} 需要配套 ${nut.partName}`,
          priority: 10,
          constraint_type: 'SCREW',
          condition_logic: {
            type: 'bolt_nut_pair',
            bolt: bolt.partNumber,
            nut: nut.partNumber,
            thread: this._extractThread(bolt.partName)
          },
          action_template: {
            type: 'SCREW',
            parameters: { revolutions: 8 }
          },
          source: 'bom_matching',
          confidence: 0.9,
          sample_count: 1
        });
      });
    });

    // 2. 法兰-密封件配对规则
    const flanges = bomData.filter(p => /法兰|flange/i.test(p.partName));
    const gaskets = bomData.filter(p => /密封|垫片|gasket|o-ring/i.test(p.partName));

    flanges.forEach(flange => {
      const matchingGaskets = gaskets.filter(gasket =>
        this._sizeMatches(flange.partName, gasket.partName)
      );

      matchingGaskets.forEach(gasket => {
        rules.push({
          rule_id: `BOM_FLANGE_GASKET_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `法兰-密封件配对: ${flange.partNumber} + ${gasket.partNumber}`,
          description: `${flange.partName} 需要配套 ${gasket.partName}`,
          priority: 9,
          constraint_type: 'COINCIDENT',
          condition_logic: {
            type: 'flange_gasket_pair',
            flange: flange.partNumber,
            gasket: gasket.partNumber
          },
          action_template: {
            type: 'COINCIDENT',
            parameters: { alignment: 'ALIGNED', flip: false }
          },
          source: 'bom_matching',
          confidence: 0.85,
          sample_count: 1
        });
      });
    });

    // 3. VCR接头配对规则
    const vcrParts = bomData.filter(p => /VCR|vcr/i.test(p.partName));

    for (let i = 0; i < vcrParts.length; i++) {
      for (let j = i + 1; j < vcrParts.length; j++) {
        const part1 = vcrParts[i];
        const part2 = vcrParts[j];

        if (this._sizeMatches(part1.partName, part2.partName)) {
          rules.push({
            rule_id: `BOM_VCR_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: `VCR接头配对: ${part1.partNumber} + ${part2.partNumber}`,
            description: `VCR接头同轴配合`,
            priority: 10,
            constraint_type: 'CONCENTRIC',
            condition_logic: {
              type: 'vcr_pair',
              part1: part1.partNumber,
              part2: part2.partNumber,
              size: this._extractSize(part1.partName)
            },
            action_template: {
              type: 'CONCENTRIC',
              parameters: { alignment: 'ALIGNED' }
            },
            source: 'bom_matching',
            confidence: 0.95,
            sample_count: 1
          });
        }
      }
    }

    return rules;
  }

  /**
   * 从STEP文件学习几何约束
   * 调用Python脚本分析STEP装配
   */
  async _learnFromSTEP(stepFiles, bomData) {
    if (stepFiles.length === 0) {
      return [];
    }

    try {
      const scriptPath = path.join(__dirname, '../assembly/ConstraintRuleLearner.py');
      const outputFile = path.join(__dirname, '../../../../temp/learned_constraints.json');

      console.log(`  🔍 调用Python脚本分析 ${stepFiles.length} 个STEP文件...`);

      // 调用Python脚本
      const pythonOutput = await this._runPythonLearner(scriptPath, stepFiles, outputFile);

      // 读取学习结果
      const constraintsData = await fs.readFile(outputFile, 'utf8');
      const constraints = JSON.parse(constraintsData);

      console.log(`  ✓ Python学习完成: ${constraints.length} 个约束`);

      // 转换为规则格式
      return this._convertConstraintsToRules(constraints, bomData);
    } catch (error) {
      console.error('  ❌ STEP学习失败:', error.message);
      return [];
    }
  }

  /**
   * 运行Python学习脚本
   */
  _runPythonLearner(scriptPath, stepFiles, outputFile) {
    return new Promise((resolve, reject) => {
      const args = [scriptPath, ...stepFiles, '--output', outputFile];
      const python = spawn('python3', args);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', data => { stdout += data.toString(); });
      python.stderr.on('data', data => { stderr += data.toString(); });

      python.on('close', code => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });

      python.on('error', err => {
        reject(new Error(`Failed to spawn python: ${err.message}`));
      });
    });
  }

  /**
   * 将STEP约束转换为装配规则
   */
  _convertConstraintsToRules(constraints, bomData) {
    return constraints.map(constraint => {
      const { type, part1, part2, parameters, confidence } = constraint;

      return {
        rule_id: `STEP_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `STEP几何约束: ${part1} + ${part2}`,
        description: `从STEP文件学习的${type}约束`,
        priority: 7,
        constraint_type: type.toUpperCase(),
        condition_logic: {
          type: 'geometry_learned',
          part1,
          part2,
          learned_from: 'step'
        },
        action_template: {
          type: type.toUpperCase(),
          parameters: parameters || {}
        },
        source: 'step_geometry',
        confidence: confidence || 0.7,
        sample_count: 1
      };
    });
  }

  /**
   * 提取螺纹规格
   */
  _extractThread(partName) {
    const threadMatch = partName.match(/M(\d+)|(\d+\/\d+)["']|#(\d+)/i);
    return threadMatch ? threadMatch[0] : null;
  }

  /**
   * 提取尺寸规格
   */
  _extractSize(partName) {
    const sizeMatch = partName.match(/(\d+\/\d+)["']|(\d+)mm|DN(\d+)/i);
    return sizeMatch ? sizeMatch[0] : null;
  }

  /**
   * 螺纹匹配判断
   */
  _threadMatches(name1, name2) {
    const thread1 = this._extractThread(name1);
    const thread2 = this._extractThread(name2);
    return thread1 && thread2 && thread1 === thread2;
  }

  /**
   * 尺寸匹配判断
   */
  _sizeMatches(name1, name2) {
    const size1 = this._extractSize(name1);
    const size2 = this._extractSize(name2);
    return size1 && size2 && size1 === size2;
  }

  /**
   * 保存规则到数据库
   */
  async _saveRules(rules) {
    const saved = [];

    for (const rule of rules) {
      try {
        const [savedRule] = await knex('assembly_rules')
          .insert(rule)
          .returning('*');
        saved.push(savedRule);
      } catch (error) {
        console.error(`  ❌ 保存规则失败: ${rule.rule_id}`, error.message);
      }
    }

    return saved;
  }
}

module.exports = new BOMSTEPLearner();
