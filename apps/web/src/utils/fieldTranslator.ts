/**
 * 智能字段翻译器
 * 自动将技术字段名转换为中文标签
 */

// 通用词汇映射表
const vocabularyMap: Record<string, string> = {
  // 对象类型
  building: '建筑',
  site: '场地',
  land: '用地',
  space: '空间',
  room: '房间',
  floor: '楼层',
  structure: '结构',
  material: '材料',
  cleanroom: '洁净室',
  fab: 'FAB',
  fire: '消防',
  road: '道路',
  adjacent: '相邻',
  project: '项目',
  card: '卡片',
  location: '位置',
  
  // 属性
  type: '类型',
  height: '高度',
  width: '宽度',
  area: '面积',
  floors: '层数',
  spacing: '间距',
  setback: '退线距离',
  density: '密度',
  far: '容积率',
  green_ratio: '绿地率',
  ratio: '比率',
  class: '等级',
  temperature: '温度',
  humidity: '湿度',
  pressure: '压力',
  air_change: '换气次数',
  process: '工艺',
  capacity: '产能',
  clean_area: '洁净区面积',
  thickness: '厚度',
  fireRating: '防火等级',
  zone_area: '分区面积',
  evacuation_width: '疏散宽度',
  evacuation_distance: '疏散距离',
  load: '荷载',
  seismic: '抗震',
  wind_load: '风荷载',
  phase: '阶段',
  position: '位置',
  zoning: '分区',
  near_airport: '机场附近',
  
  // 常见组合
  'building.type': '建筑类型',
  'building.height': '建筑高度',
  'land.type': '用地类型',
  'site.type': '场地类型',
  'space.type': '空间类型',
  'road.type': '道路类型',
  'material.type': '材料类型',
  'project.type': '项目类型',
  'cleanroom.class': '洁净度等级',
  'fab.type': 'FAB类型',
  'card.type': '卡片类型',
};

// 动作词汇映射
const actionVocabularyMap: Record<string, string> = {
  set: '设置',
  setMax: '设置最大',
  setMin: '设置最小',
  setMaxValue: '设置上限',
  setMinValue: '设置下限',
  setMaxHeight: '限制高度',
  setMinDistance: '设置最小间距',
  setMaxDistance: '设置最大间距',
  setMaxDensity: '限制密度',
  setMinGreenRatio: '设置最低绿地率',
  setSetback: '设置退线',
  setRatio: '设置比率',
  setParameter: '设置参数',
  setRange: '设置范围',
  setTemperature: '设置温度',
  setHumidity: '设置湿度',
  setPressure: '设置压力',
  setAirChange: '设置换气次数',
  setCleanClass: '设置洁净等级',
  setMinThickness: '设置最小厚度',
  setProcess: '设置工艺',
  
  require: '要求',
  requirement: '设置要求',
  requireFireProof: '要求防火',
  requireFireLane: '要求消防通道',
  
  limit: '限制',
  limitDensity: '限制密度',
  restrictMaterial: '限制材料',
  
  calculate: '计算',
  formula: '公式计算',
  
  recommend: '推荐',
  recommendMaterial: '推荐材料',
  
  alert: '警告',
  warning: '警示',
  violation: '违规标记',
  
  interpretation: '解释',
  advice: '建议',
  prediction: '预测',
};

/**
 * 智能翻译字段名
 * @param field 技术字段名，如 "building.height" 或 "site.green_ratio"
 * @returns 中文标签
 */
export function translateField(field: string): string {
  if (!field) return '';
  
  // 1. 首先检查是否有完全匹配的映射
  if (vocabularyMap[field]) {
    return vocabularyMap[field];
  }
  
  // 2. 尝试分解字段名（支持点号和下划线）
  const parts = field.split(/[._]/);
  
  // 3. 翻译每个部分
  const translatedParts = parts.map(part => {
    // 先检查词汇表
    if (vocabularyMap[part]) {
      return vocabularyMap[part];
    }
    
    // 尝试驼峰命名转换 (如 fireRating -> fire Rating)
    const camelCaseWords = part.replace(/([A-Z])/g, ' $1').trim().split(' ');
    const translated = camelCaseWords.map(word => 
      vocabularyMap[word.toLowerCase()] || word
    ).join('');
    
    if (translated !== part) {
      return translated;
    }
    
    // 如果还是没有找到，返回原值
    return part;
  });
  
  // 4. 组合翻译结果
  // 如果是两部分且第二部分是"类型"、"高度"等属性，则直接连接
  if (parts.length === 2 && isAttribute(translatedParts[1])) {
    return translatedParts.join('');
  }
  
  // 否则用"的"连接
  return translatedParts.join('的');
}

/**
 * 翻译动作类型
 * @param actionType 动作类型，如 "setMaxValue"
 * @returns 中文标签
 */
export function translateAction(actionType: string): string {
  if (!actionType) return '';
  
  // 检查动作词汇表
  if (actionVocabularyMap[actionType]) {
    return actionVocabularyMap[actionType];
  }
  
  // 尝试分解驼峰命名
  const words = actionType.replace(/([A-Z])/g, ' $1').trim().toLowerCase().split(' ');
  const translated = words.map(word => 
    actionVocabularyMap[word] || vocabularyMap[word] || word
  ).join('');
  
  return translated || actionType;
}

/**
 * 翻译操作符
 * @param operator 操作符
 * @returns 中文标签
 */
export function translateOperator(operator: string): string {
  const operatorMap: Record<string, string> = {
    '==': '等于',
    '!=': '不等于',
    '>': '大于',
    '>=': '大于等于',
    '<': '小于',
    '<=': '小于等于',
    'contains': '包含',
    'not_contains': '不包含',
    'in': '在...中',
    'not_in': '不在...中',
    'between': '介于',
    'starts_with': '开始于',
    'ends_with': '结束于',
  };
  
  return operatorMap[operator] || operator;
}

/**
 * 判断是否是属性词
 */
function isAttribute(word: string): boolean {
  const attributes = [
    '类型', '高度', '宽度', '面积', '层数', '间距', '密度',
    '等级', '温度', '湿度', '压力', '厚度', '容积率', '绿地率',
    '比率', '荷载', '阶段', '位置', '分区'
  ];
  return attributes.includes(word);
}

/**
 * 批量翻译字段列表
 * @param fields 字段列表
 * @returns 翻译后的映射表
 */
export function translateFields(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  fields.forEach(field => {
    result[field] = translateField(field);
  });
  return result;
}

/**
 * 扩展词汇表（运行时动态添加）
 * @param newMappings 新的映射关系
 */
export function extendVocabulary(newMappings: Record<string, string>) {
  Object.assign(vocabularyMap, newMappings);
}

/**
 * 扩展动作词汇表
 * @param newMappings 新的动作映射关系
 */
export function extendActionVocabulary(newMappings: Record<string, string>) {
  Object.assign(actionVocabularyMap, newMappings);
}