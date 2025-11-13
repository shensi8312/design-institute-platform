const knex = require('../../config/database');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const natural = require('natural');

/**
 * BOM + STEP几何学习服务
 * 无需PID，仅从BOM和STEP文件学习装配约束
 *
 * 🧠 AI增强：
 * - TF-IDF语义相似度匹配
 * - 中英文混合识别
 * - 同义词自动匹配
 */
class BOMSTEPLearner {
  constructor() {
    // 初始化TF-IDF
    this.tfidf = new natural.TfIdf();

    // 零件名称分词器（支持中英文）
    this.tokenizer = new natural.WordTokenizer();

    // 语义相似度阈值
    this.SIMILARITY_THRESHOLD = 0.65;
  }
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
   *
   * 🧠 AI增强：使用语义相似度扩展匹配范围
   */
  async _learnFromBOM(bomData) {
    const rules = [];

    console.log('🧠 [AI学习] 开始分析BOM数据...');

    // 1. 螺栓-螺母配对规则（支持中英文混合）
    const bolts = bomData.filter(p => /螺栓|bolt|screw/i.test(p.partName));
    const nuts = bomData.filter(p => /螺母|nut/i.test(p.partName));

    console.log(`  📌 识别到 ${bolts.length} 个螺栓, ${nuts.length} 个螺母`);

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

    // 2. 法兰-密封件配对规则（支持多种表述）
    const flanges = bomData.filter(p => /法兰|flange/i.test(p.partName));
    const gaskets = bomData.filter(p => /密封|垫片|gasket|o-ring|seal/i.test(p.partName));

    console.log(`  📌 识别到 ${flanges.length} 个法兰, ${gaskets.length} 个密封件`);

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

    console.log(`  📌 识别到 ${vcrParts.length} 个VCR接头`);

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

    console.log(`✅ [AI学习] BOM分析完成，生成 ${rules.length} 条配套规则`);
    console.log(`  - 螺栓-螺母: ${rules.filter(r => r.constraint_type === 'SCREW').length} 条`);
    console.log(`  - 法兰-密封: ${rules.filter(r => r.constraint_type === 'COINCIDENT').length} 条`);
    console.log(`  - VCR接头: ${rules.filter(r => r.constraint_type === 'CONCENTRIC').length} 条`);

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
   * 🧠 AI增强：语义相似度计算
   * 使用 TF-IDF + 余弦相似度
   */
  _calculateSemanticSimilarity(name1, name2) {
    try {
      // 预处理：统一大小写、去除特殊字符
      const clean1 = name1.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ');
      const clean2 = name2.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ');

      // 计算 Jaro-Winkler 距离（适合短字符串）
      const jaroWinkler = natural.JaroWinklerDistance(clean1, clean2);

      // 计算 Dice 系数（基于二元组）
      const dice = natural.DiceCoefficient(clean1, clean2);

      // 组合得分 (70% Jaro-Winkler + 30% Dice)
      const similarity = jaroWinkler * 0.7 + dice * 0.3;

      return similarity;
    } catch (error) {
      console.warn('语义相似度计算失败:', error.message);
      return 0;
    }
  }

  /**
   * 🧠 AI增强：智能匹配（规则 + 语义）
   * 结合正则表达式和语义相似度
   */
  _smartMatch(name1, name2, extractFn) {
    // 1. 优先使用精确匹配（规则）
    const value1 = extractFn(name1);
    const value2 = extractFn(name2);
    if (value1 && value2 && value1 === value2) {
      return { match: true, score: 1.0, method: 'exact' };
    }

    // 2. 退而求其次：语义相似度（AI）
    const similarity = this._calculateSemanticSimilarity(name1, name2);
    if (similarity >= this.SIMILARITY_THRESHOLD) {
      return { match: true, score: similarity, method: 'semantic' };
    }

    return { match: false, score: similarity, method: 'none' };
  }

  /**
   * 螺纹匹配判断（AI增强版）
   */
  _threadMatches(name1, name2) {
    const result = this._smartMatch(
      name1,
      name2,
      this._extractThread.bind(this)
    );

    if (result.match) {
      console.log(`  🎯 螺纹匹配: "${name1}" ↔ "${name2}" (${result.method}, score: ${result.score.toFixed(2)})`);
    }

    return result.match;
  }

  /**
   * 尺寸匹配判断（AI增强版）
   */
  _sizeMatches(name1, name2) {
    const result = this._smartMatch(
      name1,
      name2,
      this._extractSize.bind(this)
    );

    if (result.match) {
      console.log(`  🎯 尺寸匹配: "${name1}" ↔ "${name2}" (${result.method}, score: ${result.score.toFixed(2)})`);
    }

    return result.match;
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
