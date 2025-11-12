const knex = require('../../config/database');

/**
 * PID拓扑学习服务
 * 从确认的PID识别结果中学习装配规则
 */
class PIDTopologyLearner {
  /**
   * 从PID识别结果学习规则
   * @param {string} pidResultId - PID识别结果ID
   * @returns {Array} - 学习到的规则列表
   */
  async learnFromPID(pidResultId) {
    console.log(`🎓 [PID学习] 开始从 ${pidResultId} 学习...`);

    // 1. 获取已确认的PID识别结果
    const pidResult = await knex('pid_recognition_results')
      .where('id', pidResultId)
      .where('status', 'confirmed')
      .first();

    if (!pidResult) {
      throw new Error('PID识别结果不存在或未确认');
    }

    const { components, connections, graph_analysis } = pidResult;
    console.log(`  组件数: ${components.length}, 连接数: ${connections.length}`);

    // 2. 提取拓扑模式
    const patterns = this._extractTopologyPatterns(components, connections);
    console.log(`  ✓ 提取 ${patterns.length} 个拓扑模式`);

    // 3. 生成装配规则
    const rules = await this._generateAssemblyRules(patterns, pidResultId);
    console.log(`  ✓ 生成 ${rules.length} 条装配规则`);

    // 4. 保存到数据库
    const savedRules = await this._saveRules(rules);
    console.log(`✅ [PID学习] 完成，保存 ${savedRules.length} 条规则`);

    return savedRules;
  }

  /**
   * 批量学习（从所有已确认的PID结果）
   */
  async learnFromAllConfirmed() {
    const confirmedResults = await knex('pid_recognition_results')
      .where('status', 'confirmed')
      .select('id');

    console.log(`🎓 批量学习：${confirmedResults.length} 个已确认PID结果`);

    const allRules = [];
    for (const result of confirmedResults) {
      try {
        const rules = await this.learnFromPID(result.id);
        allRules.push(...rules);
      } catch (error) {
        console.error(`  ❌ 学习失败 ${result.id}:`, error.message);
      }
    }

    return allRules;
  }

  /**
   * 提取拓扑模式
   * 模式类型:
   * - sequence: 设备顺序 (MFC → Valve → Filter)
   * - distance: 设备间距离约束
   * - branching: 分支拓扑 (一进多出/多进一出)
   */
  _extractTopologyPatterns(components, connections) {
    const patterns = [];

    // 1. 提取设备序列模式
    const sequences = this._extractSequences(components, connections);
    patterns.push(...sequences);

    // 2. 提取距离约束模式
    const distances = this._extractDistances(components, connections);
    patterns.push(...distances);

    // 3. 提取分支拓扑模式
    const branches = this._extractBranches(components, connections);
    patterns.push(...branches);

    return patterns;
  }

  /**
   * 提取设备序列 (A → B → C)
   */
  _extractSequences(components, connections) {
    const sequences = [];
    const deviceMap = new Map();

    // 只关注设备
    components.filter(c => c.category === 'device').forEach(c => {
      deviceMap.set(c.tag, c);
    });

    // 构建连接图
    const graph = new Map();
    connections.forEach(conn => {
      if (!graph.has(conn.from)) graph.set(conn.from, []);
      graph.get(conn.from).push(conn.to);
    });

    // DFS提取序列（长度2-4的子路径）
    for (const [start, _] of deviceMap) {
      const paths = this._findPaths(start, graph, deviceMap, 4);
      paths.forEach(path => {
        if (path.length >= 2) {
          sequences.push({
            type: 'sequence',
            pattern: path.map(tag => deviceMap.get(tag).type).join(' → '),
            tags: path,
            frequency: 1
          });
        }
      });
    }

    // 合并相同模式
    return this._mergePatterns(sequences);
  }

  /**
   * DFS查找路径
   */
  _findPaths(current, graph, deviceMap, maxDepth, path = [], visited = new Set()) {
    if (path.length >= maxDepth || visited.has(current)) {
      return path.length >= 2 ? [path.slice()] : [];
    }

    if (!deviceMap.has(current)) return [];

    visited.add(current);
    path.push(current);

    const neighbors = graph.get(current) || [];
    const allPaths = path.length >= 2 ? [path.slice()] : [];

    for (const next of neighbors) {
      if (deviceMap.has(next)) {
        const subPaths = this._findPaths(next, graph, deviceMap, maxDepth, path, visited);
        allPaths.push(...subPaths);
      }
    }

    path.pop();
    visited.delete(current);

    return allPaths;
  }

  /**
   * 提取距离约束
   */
  _extractDistances(components, connections) {
    const distances = [];

    connections.forEach(conn => {
      const fromComp = components.find(c => c.tag === conn.from);
      const toComp = components.find(c => c.tag === conn.to);

      if (fromComp && toComp && fromComp.bbox && toComp.bbox) {
        const dist = this._calculateDistance(fromComp.bbox, toComp.bbox);

        distances.push({
          type: 'distance',
          pattern: `${fromComp.type} → ${toComp.type}`,
          distance: Math.round(dist),
          fromType: fromComp.type,
          toType: toComp.type,
          frequency: 1
        });
      }
    });

    return this._mergePatterns(distances);
  }

  /**
   * 提取分支拓扑
   */
  _extractBranches(components, connections) {
    const branches = [];
    const inDegree = new Map();
    const outDegree = new Map();

    components.forEach(c => {
      inDegree.set(c.tag, 0);
      outDegree.set(c.tag, 0);
    });

    connections.forEach(conn => {
      outDegree.set(conn.from, (outDegree.get(conn.from) || 0) + 1);
      inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
    });

    // 找到分支点 (出度>1 或 入度>1)
    components.forEach(c => {
      const out = outDegree.get(c.tag);
      const inD = inDegree.get(c.tag);

      if (out > 1) {
        branches.push({
          type: 'branch_out',
          pattern: `${c.type} → ${out} outputs`,
          device: c.type,
          count: out,
          frequency: 1
        });
      }

      if (inD > 1) {
        branches.push({
          type: 'branch_in',
          pattern: `${inD} inputs → ${c.type}`,
          device: c.type,
          count: inD,
          frequency: 1
        });
      }
    });

    return this._mergePatterns(branches);
  }

  /**
   * 计算bbox中心距离
   */
  _calculateDistance(bbox1, bbox2) {
    const [x1, y1, x2, y2] = bbox1;
    const [x3, y3, x4, y4] = bbox2;
    const cx1 = (x1 + x2) / 2, cy1 = (y1 + y2) / 2;
    const cx2 = (x3 + x4) / 2, cy2 = (y3 + y4) / 2;
    return Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2);
  }

  /**
   * 合并相同模式（统计频率）
   */
  _mergePatterns(patterns) {
    const merged = new Map();

    patterns.forEach(p => {
      const key = p.pattern;
      if (merged.has(key)) {
        merged.get(key).frequency++;
      } else {
        merged.set(key, { ...p });
      }
    });

    return Array.from(merged.values());
  }

  /**
   * 生成装配规则
   */
  async _generateAssemblyRules(patterns, sourceId) {
    const rules = [];

    for (const pattern of patterns) {
      // 只保留频率>=1的模式 (可以调整阈值)
      if (pattern.frequency < 1) continue;

      const rule = this._patternToRule(pattern, sourceId);
      if (rule) rules.push(rule);
    }

    return rules;
  }

  /**
   * 将模式转换为装配规则
   */
  _patternToRule(pattern, sourceId) {
    const confidence = Math.min(0.5 + pattern.frequency * 0.1, 0.95);

    switch (pattern.type) {
      case 'sequence':
        return {
          rule_id: `PID_SEQ_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `PID序列: ${pattern.pattern}`,
          description: `从PID学习到的设备序列模式`,
          priority: 5,
          constraint_type: 'SEQUENCE',
          condition_logic: {
            type: 'pid_sequence',
            sequence: pattern.tags,
            pattern: pattern.pattern
          },
          action_template: {
            type: 'SEQUENCE',
            parameters: {
              order: pattern.tags,
              connection_type: 'PIPE'
            }
          },
          source: 'pid_topology',
          source_id: sourceId,
          confidence,
          sample_count: pattern.frequency
        };

      case 'distance':
        return {
          rule_id: `PID_DIST_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `${pattern.fromType} → ${pattern.toType} 距离约束`,
          description: `平均距离: ${pattern.distance}px`,
          priority: 3,
          constraint_type: 'DISTANCE',
          condition_logic: {
            type: 'device_pair',
            from: pattern.fromType,
            to: pattern.toType
          },
          action_template: {
            type: 'DISTANCE',
            parameters: {
              distance: pattern.distance,
              tolerance: 0.2
            }
          },
          source: 'pid_topology',
          source_id: sourceId,
          confidence,
          sample_count: pattern.frequency
        };

      case 'branch_out':
      case 'branch_in':
        return {
          rule_id: `PID_BRANCH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `分支拓扑: ${pattern.pattern}`,
          description: `${pattern.device} ${pattern.type === 'branch_out' ? '分出' : '汇入'} ${pattern.count} 条管路`,
          priority: 4,
          constraint_type: 'BRANCH',
          condition_logic: {
            type: pattern.type,
            device: pattern.device,
            count: pattern.count
          },
          action_template: {
            type: 'BRANCH',
            parameters: {
              direction: pattern.type === 'branch_out' ? 'OUT' : 'IN',
              count: pattern.count
            }
          },
          source: 'pid_topology',
          source_id: sourceId,
          confidence,
          sample_count: pattern.frequency
        };

      default:
        return null;
    }
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

module.exports = new PIDTopologyLearner();
