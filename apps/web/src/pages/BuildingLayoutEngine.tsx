import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Steps,
  Divider,
  Alert,
  Tag,
  Typography,
  Collapse,
  List,
  Badge,
  message,
  Descriptions,
  Table,
  Progress
} from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  BulbOutlined,
  SafetyCertificateOutlined,
  BuildOutlined
} from '@ant-design/icons';
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Step } = Steps;

type TestSuggestionType = 'success' | 'info' | 'warning' | 'error';

interface TestSuggestion {
  type: TestSuggestionType;
  message: string;
}

interface TestResults {
  success: boolean;
  executionTime: string;
  appliedRules: string[];
  metrics: Record<string, number>;
  suggestions: TestSuggestion[];
}

interface ExtractedRule {
  id: string;
  name: string;
  category: string;
  condition: string;
  action: string;
  source: string;
  confidence: number;
  relatedKnowledge: string[];
}

const BuildingLayoutEngine: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extractedRules, setExtractedRules] = useState<ExtractedRule[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [testResults, setTestResults] = useState<TestResults | null>(null);

  // 模拟从知识库提取规则的过程
  const extractRulesFromKnowledge = async () => {
    setLoading(true);
    message.info('开始从知识库提取强排规则...');

    try {
      // 模拟调用知识提取API
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟提取的规则
      const rules: ExtractedRule[] = [
        {
          id: 'rule_1',
          name: '高层建筑间距规则',
          category: '消防间距',
          condition: 'building.height > 24 && building.type === "residential"',
          action: 'setMinDistance(adjacentBuilding, Math.max(13, building.height * 0.5))',
          source: '《建筑设计防火规范》GB 50016-2014 第5.2节',
          confidence: 95,
          relatedKnowledge: ['防火间距', '高层建筑', '居住建筑']
        },
        {
          id: 'rule_2',
          name: '日照间距规则',
          category: '日照采光',
          condition: 'building.type === "residential" && building.location.latitude > 30',
          action: 'setSunlightDistance(southBuilding, building.height * 1.2)',
          source: '《城市居住区规划设计标准》GB 50180-2018',
          confidence: 92,
          relatedKnowledge: ['日照标准', '居住建筑', '南北间距']
        },
        {
          id: 'rule_3',
          name: '容积率限制规则',
          category: '规划指标',
          condition: 'site.zoning === "R2" && site.area > 10000',
          action: 'setMaxFAR(2.5)',
          source: '地方规划条件',
          confidence: 88,
          relatedKnowledge: ['容积率', '用地性质', '规划指标']
        },
        {
          id: 'rule_4',
          name: '建筑密度规则',
          category: '规划指标',
          condition: 'site.zoning === "R2"',
          action: 'setMaxCoverage(0.3)',
          source: '《城市规划管理技术规定》',
          confidence: 90,
          relatedKnowledge: ['建筑密度', '覆盖率', '绿地率']
        },
        {
          id: 'rule_5',
          name: '绿地率要求',
          category: '环境指标',
          condition: 'site.type === "residential" && site.area > 20000',
          action: 'setMinGreenRatio(0.35)',
          source: '《城市绿化条例》',
          confidence: 87,
          relatedKnowledge: ['绿地率', '景观设计', '生态环境']
        },
        {
          id: 'rule_6',
          name: '停车位配置',
          category: '配套设施',
          condition: 'building.type === "residential"',
          action: 'setParkingSpaces(building.units * 1.2)',
          source: '《城市停车规划规范》',
          confidence: 85,
          relatedKnowledge: ['停车配建', '交通规划', '配套设施']
        }
      ];

      setExtractedRules(rules);
      message.success(`成功提取 ${rules.length} 条强排规则`);
      setCurrentStep(1);
    } catch (error) {
      message.error('规则提取失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成引擎代码
  const generateEngineCode = () => {
    setLoading(true);
    message.info('正在生成强排引擎代码...');

    setTimeout(() => {
      const code = `
/**
 * 强排引擎 - 自动生成的建筑布局规则引擎
 * 基于知识库提取的规则自动生成
 * 生成时间: ${new Date().toISOString()}
 */

class BuildingLayoutEngine {
  constructor() {
    this.rules = [];
    this.results = [];
    this.initializeRules();
  }

  initializeRules() {
    // 从知识库提取的规则
${extractedRules.map(rule => `
    this.addRule({
      id: '${rule.id}',
      name: '${rule.name}',
      category: '${rule.category}',
      source: '${rule.source}',
      confidence: ${rule.confidence},
      evaluate: (context) => {
        const { building, site, adjacentBuilding, southBuilding } = context;
        if (${rule.condition}) {
          return {
            applied: true,
            action: () => {
              ${rule.action};
            },
            message: '应用规则: ${rule.name}'
          };
        }
        return { applied: false };
      }
    });`).join('')}
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  // 执行强排分析
  analyze(siteData, buildingData) {
    const context = {
      site: siteData,
      building: buildingData,
      adjacentBuilding: this.findAdjacentBuildings(buildingData),
      southBuilding: this.findSouthBuilding(buildingData)
    };

    const results = {
      appliedRules: [],
      violations: [],
      suggestions: [],
      metrics: {}
    };

    // 应用所有规则
    for (const rule of this.rules) {
      const result = rule.evaluate(context);
      if (result.applied) {
        results.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          confidence: rule.confidence,
          source: rule.source
        });
        
        // 执行规则动作
        if (result.action) {
          result.action();
        }
      }
    }

    // 计算关键指标
    results.metrics = this.calculateMetrics(context);

    // 生成优化建议
    results.suggestions = this.generateSuggestions(results);

    return results;
  }

  calculateMetrics(context) {
    return {
      容积率: context.site.far || 0,
      建筑密度: context.site.coverage || 0,
      绿地率: context.site.greenRatio || 0,
      建筑间距: this.calculateSpacing(context),
      日照满足率: this.calculateSunlight(context),
      停车位配比: context.site.parkingRatio || 0
    };
  }

  generateSuggestions(results) {
    const suggestions = [];
    
    if (results.metrics.容积率 > 2.5) {
      suggestions.push({
        type: 'warning',
        message: '容积率超标，建议减少建筑面积或增加用地面积'
      });
    }

    if (results.metrics.绿地率 < 0.35) {
      suggestions.push({
        type: 'warning',
        message: '绿地率不足，建议增加绿化面积'
      });
    }

    return suggestions;
  }

  // 辅助方法
  findAdjacentBuildings(building) {
    // 实际实现中从空间数据库查询
    return [];
  }

  findSouthBuilding(building) {
    // 实际实现中从空间数据库查询
    return null;
  }

  calculateSpacing(context) {
    // 计算建筑间距
    return 13; // 米
  }

  calculateSunlight(context) {
    // 计算日照满足率
    return 0.95; // 95%
  }

  // 辅助设置方法
  setMinDistance(building, distance) {
    console.log(\`设置最小间距: \${distance}米\`);
  }

  setSunlightDistance(building, distance) {
    console.log(\`设置日照间距: \${distance}米\`);
  }

  setMaxFAR(value) {
    console.log(\`设置最大容积率: \${value}\`);
  }

  setMaxCoverage(value) {
    console.log(\`设置最大覆盖率: \${value * 100}%\`);
  }

  setMinGreenRatio(value) {
    console.log(\`设置最小绿地率: \${value * 100}%\`);
  }

  setParkingSpaces(count) {
    console.log(\`设置停车位数量: \${count}个\`);
  }
}

// 导出引擎
export default BuildingLayoutEngine;

// 使用示例
const engine = new BuildingLayoutEngine();
const results = engine.analyze(
  { 
    zoning: 'R2', 
    area: 15000,
    location: { latitude: 31.2 }
  },
  { 
    height: 80, 
    type: 'residential',
    units: 200
  }
);

console.log('强排分析结果:', results);
`;

      setGeneratedCode(code);
      message.success('引擎代码生成成功');
      setCurrentStep(2);
      setLoading(false);
    }, 2000);
  };

  // 测试引擎
  const testEngine = async () => {
    setLoading(true);
    message.info('正在测试强排引擎...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const testResult: TestResults = {
        success: true,
        executionTime: '23ms',
        appliedRules: [
          '高层建筑间距规则',
          '日照间距规则',
          '容积率限制规则',
          '建筑密度规则',
          '绿地率要求',
          '停车位配置'
        ],
        metrics: {
          容积率: 2.3,
          建筑密度: 0.28,
          绿地率: 0.36,
          建筑间距: 15,
          日照满足率: 0.92,
          停车位配比: 1.2
        },
        suggestions: [
          { type: 'success', message: '各项指标均满足规范要求' },
          { type: 'info', message: '建议优化南向建筑布局以提高日照满足率' }
        ]
      };

      setTestResults(testResult);
      message.success('引擎测试完成');
      setCurrentStep(3);
    } catch (error) {
      message.error('引擎测试失败');
    } finally {
      setLoading(false);
    }
  };

  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <SafetyCertificateOutlined />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const colors: Record<string, string> = {
          '消防间距': 'red',
          '日照采光': 'orange',
          '规划指标': 'blue',
          '环境指标': 'green',
          '配套设施': 'purple'
        };
        return <Tag color={colors[category]}>{category}</Tag>;
      }
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      ellipsis: true
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress percent={confidence} size="small" strokeColor={confidence > 90 ? '#52c41a' : '#faad14'} />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>
          <BuildOutlined /> 强排引擎示例
        </Title>
        <Paragraph>
          演示如何从文档、知识库、向量数据库中自动提取规则，生成建筑强排引擎
        </Paragraph>

        <Alert
          message="智能规则提取"
          description="系统将自动从已上传的建筑规范文档、知识图谱、向量数据库中提取强排相关规则，并生成可执行的引擎代码"
          type="info"
          showIcon
          icon={<BulbOutlined />}
          style={{ marginBottom: 24 }}
        />

        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          <Step title="提取规则" description="从知识库提取" icon={<DatabaseOutlined />} />
          <Step title="生成代码" description="自动生成引擎" icon={<CodeOutlined />} />
          <Step title="测试验证" description="运行测试用例" icon={<ThunderboltOutlined />} />
          <Step title="部署上线" description="发布到生产" icon={<RocketOutlined />} />
        </Steps>

        {currentStep === 0 && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    <Title level={4}>文档库</Title>
                    <Text type="secondary">15个建筑规范文档</Text>
                    <List
                      size="small"
                      dataSource={[
                        '建筑设计防火规范.pdf',
                        '城市居住区规划设计标准.pdf',
                        '城市规划管理技术规定.docx'
                      ]}
                      renderItem={item => (
                        <List.Item>
                          <Text ellipsis>{item}</Text>
                        </List.Item>
                      )}
                    />
                  </Space>
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <DatabaseOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                    <Title level={4}>向量数据库</Title>
                    <Text type="secondary">3,456条规则向量</Text>
                    <List
                      size="small"
                      dataSource={[
                        '建筑间距规则集',
                        '消防规范条款',
                        '日照标准要求'
                      ]}
                      renderItem={item => (
                        <List.Item>
                          <Text ellipsis>{item}</Text>
                        </List.Item>
                      )}
                    />
                  </Space>
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <BranchesOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                    <Title level={4}>知识图谱</Title>
                    <Text type="secondary">892个知识节点</Text>
                    <List
                      size="small"
                      dataSource={[
                        '建筑类型关系',
                        '规范条款关联',
                        '地方政策映射'
                      ]}
                      renderItem={item => (
                        <List.Item>
                          <Text ellipsis>{item}</Text>
                        </List.Item>
                      )}
                    />
                  </Space>
                </Card>
              </Col>
            </Row>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={extractRulesFromKnowledge}
              >
                开始提取规则
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && extractedRules.length > 0 && (
          <div>
            <Card title="提取的规则" style={{ marginBottom: 16 }}>
              <Table
                dataSource={extractedRules}
                columns={ruleColumns}
                rowKey="id"
                pagination={false}
              />
            </Card>

            <Collapse defaultActiveKey={['1']} style={{ marginBottom: 16 }}>
              <Panel header="规则详情" key="1">
                <List
                  dataSource={extractedRules}
                  renderItem={rule => (
                    <List.Item>
                      <Descriptions title={rule.name} column={1} size="small">
                        <Descriptions.Item label="条件">
                          <Text code>{rule.condition}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="动作">
                          <Text code>{rule.action}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="相关知识">
                          <Space>
                            {rule.relatedKnowledge.map(k => (
                              <Tag key={k}>{k}</Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                      </Descriptions>
                    </List.Item>
                  )}
                />
              </Panel>
            </Collapse>

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<CodeOutlined />}
                loading={loading}
                onClick={generateEngineCode}
              >
                生成引擎代码
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && generatedCode && (
          <div>
            <Card 
              title="生成的引擎代码" 
              extra={
                <Space>
                  <Button icon={<CheckCircleOutlined />}>语法检查</Button>
                  <Button>导出代码</Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <pre style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                maxHeight: 400,
                overflow: 'auto',
                fontSize: 12
              }}>
                {generatedCode}
              </pre>
            </Card>

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={testEngine}
              >
                测试引擎
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && testResults && (
          <div>
            <Alert
              message="测试通过"
              description={`引擎执行成功，耗时 ${testResults.executionTime}`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="应用的规则">
          <List
            dataSource={testResults.appliedRules}
            renderItem={(rule: string) => (
              <List.Item>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                {rule}
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="计算指标">
                  <Descriptions column={2} size="small">
                    {Object.entries(testResults.metrics).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        <Badge
                          status={typeof value === 'number' && value > 0.9 ? 'success' : 'processing'}
                          text={typeof value === 'number' ? 
                            (value > 1 ? value : `${(value * 100).toFixed(1)}%`) : 
                            value
                          }
                        />
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            <Card title="优化建议" style={{ marginTop: 16 }}>
              <List
                dataSource={testResults.suggestions}
                renderItem={(item: TestSuggestion) => (
                  <Alert
                    message={item.message}
                    type={item.type}
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                )}
              />
            </Card>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Space size="large">
                <Button size="large">保存为草稿</Button>
                <Button type="primary" size="large" icon={<RocketOutlined />}>
                  部署到生产环境
                </Button>
                <Button type="primary" size="large" icon={<BranchesOutlined />}>
                  添加到工作流
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BuildingLayoutEngine;
