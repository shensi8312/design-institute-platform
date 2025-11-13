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
   * 生成规则ID（限制20字符）
   */
  _generateRuleId(type) {
    const typeMap = {
      'BOLT_NUT': 'BLT',
      'FLANGE_GASKET': 'FLG',
      'VCR': 'VCR',
      'VALVE_GASKET': 'VLV',
      'SENSOR_SUPPORT': 'SNS',
      'PIPE_FITTING': 'PIP',
      'STEP': 'STP'
    };
    const shortType = typeMap[type] || 'UNK';
    const timestamp = Date.now().toString(36).substr(-6);
    const random = Math.random().toString(36).substr(2, 2);
    return `BM_${shortType}_${timestamp}_${random}`;
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
    const bolts = bomData.filter(p => /螺栓|bolt/i.test(p.partName) && !/螺母|nut/i.test(p.partName));
    const screws = bomData.filter(p => /screw/i.test(p.partName) && !/螺母|nut/i.test(p.partName) && !/螺栓|bolt/i.test(p.partName));
    const nuts = bomData.filter(p => /螺母|nut/i.test(p.partName));

    // 合并螺栓和螺丝
    const allBolts = [...bolts, ...screws];

    console.log(`  📌 识别到 ${allBolts.length} 个螺栓/螺丝 (${bolts.length} 螺栓 + ${screws.length} 螺丝), ${nuts.length} 个螺母`);

    allBolts.forEach(bolt => {
      // 🔧 只匹配螺母，不匹配其他螺栓/螺丝
      const matchingNuts = nuts.filter(nut => {
        // 防止自匹配
        if (bolt.partNumber === nut.partNumber) return false;

        // 防止同类零件配对（名称相似度检查）
        const nameSimilarity = this._calculateSemanticSimilarity(bolt.partName, nut.partName);
        if (nameSimilarity > 0.8) {
          console.log(`  ⚠️  阻止同类配对: "${bolt.partName}" ↔ "${nut.partName}" (相似度: ${nameSimilarity.toFixed(2)})`);
          return false;
        }

        // 检查螺纹规格匹配
        return this._threadMatches(bolt.partName, nut.partName);
      });

      matchingNuts.forEach(nut => {
        rules.push({
          rule_id: this._generateRuleId('BOLT_NUT'),
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
    const flanges = bomData.filter(p => /法兰|flange/i.test(p.partName) && !/密封|垫片|gasket|seal/i.test(p.partName));
    const gaskets = bomData.filter(p => /密封|垫片|gasket|o-ring|seal/i.test(p.partName) && !/法兰|flange/i.test(p.partName));

    console.log(`  📌 识别到 ${flanges.length} 个法兰, ${gaskets.length} 个密封件`);

    flanges.forEach(flange => {
      const matchingGaskets = gaskets.filter(gasket => {
        // 防止自匹配
        if (flange.partNumber === gasket.partNumber) return false;

        // 防止同类零件配对
        const nameSimilarity = this._calculateSemanticSimilarity(flange.partName, gasket.partName);
        if (nameSimilarity > 0.8) {
          console.log(`  ⚠️  阻止同类配对: "${flange.partName}" ↔ "${gasket.partName}" (相似度: ${nameSimilarity.toFixed(2)})`);
          return false;
        }

        return this._sizeMatches(flange.partName, gasket.partName);
      });

      matchingGaskets.forEach(gasket => {
        rules.push({
          rule_id: this._generateRuleId('FLANGE_GASKET'),
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

    // 3. VCR接头配对规则（按功能分类配对）
    // VCR系统分为：Gland（螺纹接头）、Cap/Plug（封堵件）
    // 只有不同功能类的才配对，同类不配对
    const vcrGlands = bomData.filter(p =>
      /VCR|vcr/i.test(p.partName) &&
      /gland/i.test(p.partName) &&
      !/gasket|seal|nut/i.test(p.partName)
    );

    const vcrCapsPlugs = bomData.filter(p =>
      /VCR|vcr/i.test(p.partName) &&
      /cap|plug/i.test(p.partName) &&
      !/gasket|seal|nut/i.test(p.partName)
    );

    console.log(`  📌 识别到 ${vcrGlands.length} 个VCR Gland（螺纹接头）, ${vcrCapsPlugs.length} 个VCR Cap/Plug（封堵件）`);

    // 🔍 详细记录所有VCR零件
    console.log(`  🔍 [VCR详细] Gland清单:`);
    vcrGlands.forEach(g => console.log(`     - ${g.partNumber}: ${g.partName}`));
    console.log(`  🔍 [VCR详细] Cap/Plug清单:`);
    vcrCapsPlugs.forEach(c => console.log(`     - ${c.partNumber}: ${c.partName}`));

    // 只配对：Gland ↔ Cap/Plug（不同功能的才配对）
    let vcrPairCount = 0;
    vcrGlands.forEach(gland => {
      vcrCapsPlugs.forEach(capPlug => {
        // 防止自匹配
        if (gland.partNumber === capPlug.partNumber) {
          console.log(`  ⚠️  [VCR] 自匹配阻止: ${gland.partNumber} (${gland.partName})`);
          return;
        }

        if (this._sizeMatches(gland.partName, capPlug.partName)) {
          console.log(`  ✅ [VCR配对] ${gland.partNumber}(${gland.partName}) ↔ ${capPlug.partNumber}(${capPlug.partName})`);
          vcrPairCount++;
          rules.push({
            rule_id: this._generateRuleId('VCR'),
            name: `VCR接头配对: ${gland.partNumber} + ${capPlug.partNumber}`,
            description: `${gland.partName} 需要配套 ${capPlug.partName}`,
            priority: 10,
            constraint_type: 'CONCENTRIC',
            condition_logic: {
              type: 'vcr_pair',
              gland: gland.partNumber,
              capPlug: capPlug.partNumber,
              size: this._extractSize(gland.partName)
            },
            action_template: {
              type: 'CONCENTRIC',
              parameters: { alignment: 'ALIGNED' }
            },
            source: 'bom_matching',
            confidence: 0.95,
            sample_count: 1
          });
        } else {
          console.log(`  ❌ [VCR不配对] ${gland.partNumber}(${gland.partName}) ✗ ${capPlug.partNumber}(${capPlug.partName}) - 尺寸不匹配`);
        }
      });
    });

    console.log(`  📊 [VCR统计] 生成 ${vcrPairCount} 个VCR配对规则`);

    // 🆕 4. 阀门-垫片配对规则
    const valves = bomData.filter(p => /阀|valve/i.test(p.partName) && !/密封|垫片|gasket|seal/i.test(p.partName));
    console.log(`  📌 识别到 ${valves.length} 个阀门`);

    valves.forEach(valve => {
      gaskets.forEach(gasket => {
        // 防止自匹配
        if (valve.partNumber === gasket.partNumber) return;

        // 防止同类零件配对
        const nameSimilarity = this._calculateSemanticSimilarity(valve.partName, gasket.partName);
        if (nameSimilarity > 0.8) {
          console.log(`  ⚠️  阻止同类配对: "${valve.partName}" ↔ "${gasket.partName}" (相似度: ${nameSimilarity.toFixed(2)})`);
          return;
        }

        // 阀门通常需要垫片
        rules.push({
          rule_id: this._generateRuleId('VALVE_GASKET'),
          name: `阀门-垫片配对: ${valve.partNumber} + ${gasket.partNumber}`,
          description: `${valve.partName} 可能需要配套 ${gasket.partName}`,
          priority: 6,
          constraint_type: 'COINCIDENT',
          condition_logic: {
            type: 'valve_gasket',
            valve: valve.partNumber,
            gasket: gasket.partNumber
          },
          action_template: {
            type: 'COINCIDENT',
            parameters: { alignment: 'ALIGNED', flip: false }
          },
          source: 'bom_matching',
          confidence: 0.7,
          sample_count: 1
        });
      });
    });

    // 🆕 5. 传感器-支架配对规则
    const sensors = bomData.filter(p => /sensor|transducer|switch|detector|传感器/i.test(p.partName) && !/support|bracket|支架/i.test(p.partName));
    const supports = bomData.filter(p => /support|bracket|支架/i.test(p.partName) && !/sensor|transducer|switch|detector|传感器/i.test(p.partName));
    console.log(`  📌 识别到 ${sensors.length} 个传感器, ${supports.length} 个支架`);

    sensors.forEach(sensor => {
      supports.forEach(support => {
        // 防止自匹配
        if (sensor.partNumber === support.partNumber) return;

        // 防止同类零件配对
        const nameSimilarity = this._calculateSemanticSimilarity(sensor.partName, support.partName);
        if (nameSimilarity > 0.8) {
          console.log(`  ⚠️  阻止同类配对: "${sensor.partName}" ↔ "${support.partName}" (相似度: ${nameSimilarity.toFixed(2)})`);
          return;
        }

        rules.push({
          rule_id: this._generateRuleId('SENSOR_SUPPORT'),
          name: `传感器-支架配对: ${sensor.partNumber} + ${support.partNumber}`,
          description: `${sensor.partName} 需要配套 ${support.partName}`,
          priority: 7,
          constraint_type: 'FIXED',
          condition_logic: {
            type: 'sensor_support',
            sensor: sensor.partNumber,
            support: support.partNumber
          },
          action_template: {
            type: 'FIXED',
            parameters: {}
          },
          source: 'bom_matching',
          confidence: 0.8,
          sample_count: 1
        });
      });
    });

    // 🆕 6. 管道-接头配对规则
    const pipes = bomData.filter(p => /pipe|tube|tubing|hose|管/i.test(p.partName) && !/fitting|connector|接头/i.test(p.partName));
    const fittings = bomData.filter(p => /fitting|connector|接头/i.test(p.partName) && !/valve/i.test(p.partName) && !/pipe|tube|tubing|hose|管/i.test(p.partName));
    console.log(`  📌 识别到 ${pipes.length} 个管道, ${fittings.length} 个接头`);

    pipes.forEach(pipe => {
      fittings.forEach(fitting => {
        // 防止自匹配
        if (pipe.partNumber === fitting.partNumber) return;

        // 防止同类零件配对
        const nameSimilarity = this._calculateSemanticSimilarity(pipe.partName, fitting.partName);
        if (nameSimilarity > 0.8) {
          console.log(`  ⚠️  阻止同类配对: "${pipe.partName}" ↔ "${fitting.partName}" (相似度: ${nameSimilarity.toFixed(2)})`);
          return;
        }

        rules.push({
          rule_id: this._generateRuleId('PIPE_FITTING'),
          name: `管道-接头配对: ${pipe.partNumber} + ${fitting.partNumber}`,
          description: `${pipe.partName} 需要配套 ${fitting.partNumber}`,
          priority: 8,
          constraint_type: 'CONCENTRIC',
          condition_logic: {
            type: 'pipe_fitting',
            pipe: pipe.partNumber,
            fitting: fitting.partNumber
          },
          action_template: {
            type: 'CONCENTRIC',
            parameters: { alignment: 'ALIGNED' }
          },
          source: 'bom_matching',
          confidence: 0.85,
          sample_count: 1
        });
      });
    });

    console.log(`✅ [AI学习] BOM分析完成，生成 ${rules.length} 条配套规则`);
    console.log(`  - 螺栓-螺母: ${rules.filter(r => r.constraint_type === 'SCREW').length} 条`);
    console.log(`  - 法兰-密封: ${rules.filter(r => r.condition_logic.type === 'flange_gasket_pair').length} 条`);
    console.log(`  - VCR接头: ${rules.filter(r => r.condition_logic.type === 'vcr_pair').length} 条`);
    console.log(`  - 阀门-垫片: ${rules.filter(r => r.condition_logic.type === 'valve_gasket').length} 条`);
    console.log(`  - 传感器-支架: ${rules.filter(r => r.condition_logic.type === 'sensor_support').length} 条`);
    console.log(`  - 管道-接头: ${rules.filter(r => r.condition_logic.type === 'pipe_fitting').length} 条`);

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
        rule_id: this._generateRuleId('STEP'),
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
  _smartMatch(name1, name2, extractFn, requireDifferent = false) {
    // 🔧 防止自匹配：相同名称不应配对
    if (name1 === name2) {
      return { match: false, score: 0, method: 'self-match-blocked' };
    }

    // 🔧 防止高相似度误匹配：如果两个名称过于相似（>90%），可能是同类零件
    if (requireDifferent) {
      const baseSimilarity = this._calculateSemanticSimilarity(name1, name2);
      if (baseSimilarity > 0.9) {
        return { match: false, score: baseSimilarity, method: 'too-similar-blocked' };
      }
    }

    // 1. 优先使用精确匹配（规则）
    const value1 = extractFn(name1);
    const value2 = extractFn(name2);
    if (value1 && value2 && value1 === value2) {
      return { match: true, score: 1.0, method: 'exact' };
    }

    // 2. 退而求其次：语义相似度（AI）
    const similarity = this._calculateSemanticSimilarity(name1, name2);
    if (similarity >= this.SIMILARITY_THRESHOLD && similarity <= 0.9) {
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
      this._extractThread.bind(this),
      true  // 🔧 启用相似度阻断：防止Screw+Screw这种误匹配
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
      this._extractSize.bind(this),
      false  // 法兰-垫片可以名称相似，只要尺寸匹配
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
        // 🔧 映射字段名：confidence → confidence_boost, source → learned_from
        const dbRule = {
          rule_id: rule.rule_id,
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          constraint_type: rule.constraint_type,
          condition_logic: rule.condition_logic,
          action_template: rule.action_template,
          confidence_boost: rule.confidence || 0,  // 🔧 confidence → confidence_boost
          learned_from: rule.source || 'bom_step',  // 🔧 source → learned_from
          is_active: true
        };

        const [savedRule] = await knex('assembly_rules')
          .insert(dbRule)
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
