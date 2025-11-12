import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Tabs,
  Table,
  Descriptions,
  Tag,
  Alert,
  Spin,
  Progress,
  Collapse,
  Statistic,
  Divider,
  Radio
} from 'antd';
import {
  CalculatorOutlined,
  BuildOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  DashboardOutlined,
  RocketOutlined,
  BulbOutlined,
  DollarOutlined,
  ExpandOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Panel } = Collapse;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface Boundary {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
}

interface WorkflowResult {
  success: boolean;
  workflow?: {
    setbacks: any[];
    areas: Record<string, any>;
    total_building_area: number;
    um_table: Record<string, any>;
    compliance: {
      compliant: boolean;
      checks: any[];
      violations: any[];
    };
  };
  summary?: {
    setback_rules_applied: number;
    area_rules_applied: number;
    um_rules_applied: number;
    compliance_checks: number;
    overall_compliant: boolean;
  };
}

const BuildingLayoutWorkbench: React.FC = () => {
  const [form] = Form.useForm();
  const [optimizeForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [rulesSummary, setRulesSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [optimizationStrategy, setOptimizationStrategy] = useState('balanced');

  // 获取规则摘要
  useEffect(() => {
    fetchRulesSummary();
  }, []);

  const fetchRulesSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/building-layout/rules-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setRulesSummary(response.data.summary);
      }
    } catch (error) {
      console.error('获取规则摘要失败:', error);
    }
  };

  // 运行完整工作流
  const runWorkflow = async (values: any) => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // 构建请求数据
      const requestData = {
        siteInfo: {
          building_height: values.building_height,
          building_type: values.building_type || 'fab',
          boundaries: [
            {
              id: 'b1',
              name: '东侧-高速公路',
              type: 'expressway'
            },
            {
              id: 'b2',
              name: '南侧-主干道',
              type: 'main_road'
            }
          ],
          spacing: values.spacing || 15,
          fire_resistance_rating: values.fire_resistance_rating || 2
        },
        projectParams: {
          chips_per_month: values.chips_per_month,
          process_type: 'semiconductor_fab',
          technology_node: values.technology_node || '28nm'
        }
      };

      const response = await axios.post('/api/building-layout/workflow', requestData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setWorkflowResult(response.data);
        setActiveTab('2'); // 切换到结果标签
        message.success('工作流执行成功！');
      } else {
        message.error(response.data.message || '工作流执行失败');
      }
    } catch (error: any) {
      console.error('工作流执行失败:', error);
      message.error(error.response?.data?.message || '工作流执行失败');
    } finally {
      setLoading(false);
    }
  };

  // 运行布局优化
  const runOptimization = async (values: any) => {
    setOptimizing(true);

    try {
      const token = localStorage.getItem('token');

      // 构建场地边界（示例：矩形场地）
      const siteBoundary = [
        [0, 0],
        [values.site_width || 200, 0],
        [values.site_width || 200, values.site_length || 150],
        [0, values.site_length || 150],
        [0, 0]
      ];

      const requestData = {
        site_boundary: siteBoundary,
        required_area: values.required_area,
        setback_distances: {
          north: values.setback_north || 10,
          south: values.setback_south || 10,
          east: values.setback_east || 10,
          west: values.setback_west || 10
        },
        options: {
          max_time_seconds: values.max_time || 60,
          num_solutions: values.num_solutions || 5
        }
      };

      // 根据策略选择不同的API端点
      let endpoint = '/api/building-layout/optimize';
      if (optimizationStrategy === 'cost') {
        endpoint = '/api/building-layout/optimize/cost';
      } else if (optimizationStrategy === 'space') {
        endpoint = '/api/building-layout/optimize/space';
      } else if (optimizationStrategy === 'green') {
        endpoint = '/api/building-layout/optimize/green';
      } else if (optimizationStrategy === 'batch') {
        endpoint = '/api/building-layout/optimize/batch';
      }

      const response = await axios.post(endpoint, requestData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setOptimizationResult(response.data);
        setActiveTab('3'); // 切换到优化结果标签
        message.success('布局优化完成！');
      } else {
        message.error(response.data.message || '优化失败');
      }
    } catch (error: any) {
      console.error('优化失败:', error);
      message.error(error.response?.data?.message || '优化失败');
    } finally {
      setOptimizing(false);
    }
  };

  // 渲染规则摘要
  const renderRulesSummary = () => {
    if (!rulesSummary) return null;

    const categories = [
      { key: 'layout_setback', name: '红线退距', color: 'blue' },
      { key: 'layout_area', name: '面积推导', color: 'green' },
      { key: 'layout_um', name: '能耗公式', color: 'orange' },
      { key: 'layout_compliance', name: '合规检查', color: 'red' }
    ];

    return (
      <Row gutter={[16, 16]}>
        {categories.map(cat => {
          const summary = rulesSummary[cat.key];
          return (
            <Col span={6} key={cat.key}>
              <Card>
                <Statistic
                  title={cat.name}
                  value={summary?.total || 0}
                  suffix="条规则"
                  valueStyle={{ color: cat.color }}
                />
                <div style={{ marginTop: 16 }}>
                  {summary?.rules?.slice(0, 3).map((rule: any) => (
                    <Tag key={rule.code} color={cat.color} style={{ marginBottom: 4 }}>
                      {rule.name}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  // 渲染退距结果
  const renderSetbacksResult = () => {
    if (!workflowResult?.workflow?.setbacks) return null;

    const columns = [
      {
        title: '边界',
        dataIndex: 'boundary_name',
        key: 'boundary_name'
      },
      {
        title: '边界类型',
        dataIndex: 'boundary_type',
        key: 'boundary_type',
        render: (type: string) => <Tag>{type}</Tag>
      },
      {
        title: '要求退距',
        dataIndex: 'required_distance',
        key: 'required_distance',
        render: (distance: number, record: any) => (
          <span><strong>{distance}</strong> {record.unit}</span>
        )
      },
      {
        title: '应用规则',
        key: 'rule',
        render: (_: any, record: any) => (
          <div>
            <div><Text code>{record.applied_rule?.rule_code}</Text></div>
            <div><Text type="secondary">{record.applied_rule?.rule_name}</Text></div>
          </div>
        )
      }
    ];

    return (
      <Card title={<><BuildOutlined /> 红线退距计算结果</>}>
        <Table
          dataSource={workflowResult.workflow.setbacks}
          columns={columns}
          rowKey="boundary_id"
          pagination={false}
        />
      </Card>
    );
  };

  // 渲染面积结果
  const renderAreasResult = () => {
    if (!workflowResult?.workflow?.areas) return null;

    const areas = workflowResult.workflow.areas;
    const totalArea = workflowResult.workflow.total_building_area;

    return (
      <Card title={<><DashboardOutlined /> 建筑面积分配</>}>
        <Descriptions bordered column={2}>
          {Object.entries(areas).map(([key, value]: [string, any]) => (
            <Descriptions.Item label={key} key={key}>
              <Space>
                <Statistic value={value.value} suffix={value.unit} precision={0} />
                <Tag color="blue">{value.rule_code}</Tag>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" code style={{ fontSize: 12 }}>
                  {value.formula}
                </Text>
              </div>
            </Descriptions.Item>
          ))}
        </Descriptions>
        <Divider />
        <Statistic
          title="总建筑面积"
          value={totalArea}
          suffix="m²"
          precision={0}
          valueStyle={{ color: '#3f8600', fontSize: 32 }}
        />
      </Card>
    );
  };

  // 渲染UM表
  const renderUMTable = () => {
    if (!workflowResult?.workflow?.um_table) return null;

    const umTable = workflowResult.workflow.um_table;

    return (
      <Card title={<><ThunderboltOutlined /> 能耗计算（UM表）</>}>
        <Row gutter={[16, 16]}>
          {Object.entries(umTable).map(([utilityType, data]: [string, any]) => (
            <Col span={12} key={utilityType}>
              <Card size="small">
                <Statistic
                  title={utilityType === 'power' ? '电力负荷' : '冷量需求'}
                  value={data.value}
                  suffix={data.unit}
                  precision={0}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color="orange">{data.rule_code}</Tag>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" code style={{ fontSize: 11 }}>
                    {data.formula}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    );
  };

  // 渲染合规检查
  const renderComplianceResult = () => {
    if (!workflowResult?.workflow?.compliance) return null;

    const compliance = workflowResult.workflow.compliance;

    return (
      <Card
        title={
          <Space>
            {compliance.compliant ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <WarningOutlined style={{ color: '#faad14' }} />
            )}
            合规检查结果
          </Space>
        }
      >
        <Alert
          message={compliance.compliant ? '所有检查均通过' : '存在不合规项'}
          type={compliance.compliant ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />

        {compliance.violations && compliance.violations.length > 0 && (
          <Collapse>
            {compliance.violations.map((violation: any, index: number) => (
              <Panel
                header={
                  <Space>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    {violation.rule_name}
                  </Space>
                }
                key={index}
              >
                <Descriptions column={1}>
                  <Descriptions.Item label="规范">{violation.standard}</Descriptions.Item>
                  <Descriptions.Item label="检查详情">
                    {JSON.stringify(violation.details, null, 2)}
                  </Descriptions.Item>
                </Descriptions>
              </Panel>
            ))}
          </Collapse>
        )}

        {compliance.checks && compliance.checks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Progress
              percent={(compliance.checks.filter((c: any) => c.passed).length / compliance.checks.length) * 100}
              status={compliance.compliant ? 'success' : 'active'}
            />
          </div>
        )}
      </Card>
    );
  };

  // 渲染优化结果
  const renderOptimizationResults = () => {
    if (!optimizationResult) return null;

    // 批量优化结果
    if (optimizationResult.strategies) {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message={`批量优化完成 - 成功策略: ${optimizationResult.successful_strategies}/${optimizationResult.total_strategies}`}
            type="success"
            showIcon
          />

          <Collapse defaultActiveKey={['0']}>
            {optimizationResult.strategies.map((strategy: any, idx: number) => (
              <Panel
                header={
                  <Space>
                    <Tag color="blue">{strategy.strategy_name}</Tag>
                    <span>{strategy.strategy_description}</span>
                    {strategy.result.best_solution && (
                      <Tag color="green">得分: {strategy.result.best_solution.scores.total_score}</Tag>
                    )}
                  </Space>
                }
                key={idx}
              >
                {renderSingleOptimizationResult(strategy.result)}
              </Panel>
            ))}
          </Collapse>
        </Space>
      );
    }

    // 单个优化结果
    return renderSingleOptimizationResult(optimizationResult);
  };

  const renderSingleOptimizationResult = (result: any) => {
    if (!result.best_solution) return null;

    const bestSolution = result.best_solution;

    const solutionColumns = [
      {
        title: '排名',
        dataIndex: 'rank',
        key: 'rank',
        width: 80
      },
      {
        title: '尺寸',
        key: 'dimensions',
        render: (_: any, record: any) => (
          <div>
            <div>长×宽: {record.dimensions.length}m × {record.dimensions.width}m</div>
            <div>面积: {record.dimensions.area}m²</div>
            <Tag>{record.dimensions.orientation === 'north-south' ? '南北向' : '东西向'}</Tag>
          </div>
        )
      },
      {
        title: '总得分',
        dataIndex: ['scores', 'total_score'],
        key: 'total_score',
        sorter: (a: any, b: any) => b.scores.total_score - a.scores.total_score,
        render: (score: number) => <Tag color="blue">{score}</Tag>
      },
      {
        title: '空间利用率',
        dataIndex: ['scores', 'space_utilization'],
        key: 'space_utilization',
        render: (util: number) => `${util}%`
      },
      {
        title: '日照得分',
        dataIndex: ['scores', 'sunlight_score'],
        key: 'sunlight_score'
      },
      {
        title: '能耗得分',
        dataIndex: ['scores', 'energy_score'],
        key: 'energy_score'
      },
      {
        title: '建造成本',
        dataIndex: ['scores', 'cost_per_meter'],
        key: 'cost',
        render: (cost: number) => `¥${cost.toLocaleString()}`
      }
    ];

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {result.solver_info && (
          <Card size="small">
            <Descriptions column={4} size="small">
              <Descriptions.Item label="求解状态">
                <Tag color={result.status === 'optimal' ? 'green' : 'orange'}>
                  {result.status === 'optimal' ? '最优解' : '可行解'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="求解时间">
                {result.solver_info.wall_time}秒
              </Descriptions.Item>
              <Descriptions.Item label="搜索分支">
                {result.solver_info.num_branches}
              </Descriptions.Item>
              <Descriptions.Item label="找到方案">
                {result.solver_info.num_solutions_found}个
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Card title={<><BuildOutlined /> 最佳方案</>}>
          <Row gutter={16}>
            <Col span={12}>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="建筑尺寸">
                  {bestSolution.dimensions.length}m × {bestSolution.dimensions.width}m
                </Descriptions.Item>
                <Descriptions.Item label="建筑面积">
                  {bestSolution.dimensions.area}m²
                </Descriptions.Item>
                <Descriptions.Item label="周长">
                  {bestSolution.dimensions.perimeter}m
                </Descriptions.Item>
                <Descriptions.Item label="朝向">
                  <Tag>{bestSolution.dimensions.orientation === 'north-south' ? '南北向' : '东西向'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="位置">
                  ({bestSolution.position.x}, {bestSolution.position.y})
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col span={12}>
              <Card size="small" title="性能指标">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Statistic
                    title="总得分"
                    value={bestSolution.scores.total_score}
                    valueStyle={{ color: '#3f8600' }}
                  />
                  <Progress
                    percent={bestSolution.scores.space_utilization}
                    format={(percent) => `空间利用率: ${percent}%`}
                  />
                  <Row gutter={8}>
                    <Col span={12}>
                      <Statistic title="日照得分" value={bestSolution.scores.sunlight_score} suffix="/100" />
                    </Col>
                    <Col span={12}>
                      <Statistic title="能耗得分" value={bestSolution.scores.energy_score} suffix="/100" />
                    </Col>
                  </Row>
                  <Statistic
                    title="建造成本"
                    value={bestSolution.scores.cost_per_meter}
                    prefix="¥"
                    precision={0}
                  />
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>

        {result.solutions && result.solutions.length > 1 && (
          <Card title={<><DashboardOutlined /> 所有方案对比</>}>
            <Table
              dataSource={result.solutions}
              columns={solutionColumns}
              rowKey="rank"
              pagination={false}
              size="small"
            />
          </Card>
        )}
      </Space>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <h1><BuildOutlined /> 建筑强排工作台</h1>
            <p>基于规则引擎的建筑布局自动计算系统</p>
          </div>

          {renderRulesSummary()}

          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="参数输入" key="1">
              <Form
                form={form}
                layout="vertical"
                onFinish={runWorkflow}
                initialValues={{
                  building_height: 30,
                  building_type: 'fab',
                  chips_per_month: 10000,
                  technology_node: '28nm',
                  spacing: 15,
                  fire_resistance_rating: 2
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="场地信息" size="small">
                      <Form.Item
                        name="building_height"
                        label="建筑高度（米）"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={200} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item name="building_type" label="建筑类型">
                        <Select>
                          <Select.Option value="fab">Fab厂房</Select.Option>
                          <Select.Option value="office">办公楼</Select.Option>
                          <Select.Option value="warehouse">仓库</Select.Option>
                        </Select>
                      </Form.Item>

                      <Form.Item name="spacing" label="建筑间距（米）">
                        <InputNumber min={1} max={50} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item name="fire_resistance_rating" label="耐火等级">
                        <Select>
                          <Select.Option value={1}>一级</Select.Option>
                          <Select.Option value={2}>二级</Select.Option>
                          <Select.Option value={3}>三级</Select.Option>
                        </Select>
                      </Form.Item>
                    </Card>
                  </Col>

                  <Col span={12}>
                    <Card title="项目参数" size="small">
                      <Form.Item
                        name="chips_per_month"
                        label="月产能（片/月）"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={100000} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item name="technology_node" label="技术节点">
                        <Select>
                          <Select.Option value="28nm">28nm</Select.Option>
                          <Select.Option value="14nm">14nm</Select.Option>
                          <Select.Option value="7nm">7nm</Select.Option>
                        </Select>
                      </Form.Item>
                    </Card>
                  </Col>
                </Row>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    icon={<RocketOutlined />}
                    block
                  >
                    运行强排工作流
                  </Button>
                </Form.Item>
              </Form>
            </TabPane>

            <TabPane tab="计算结果" key="2" disabled={!workflowResult}>
              {workflowResult && (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {workflowResult.summary && (
                    <Alert
                      message="工作流执行成功"
                      description={
                        <div>
                          <p>应用退距规则: {workflowResult.summary.setback_rules_applied} 条</p>
                          <p>应用面积规则: {workflowResult.summary.area_rules_applied} 条</p>
                          <p>应用能耗规则: {workflowResult.summary.um_rules_applied} 条</p>
                          <p>合规检查: {workflowResult.summary.compliance_checks} 项</p>
                          <p>
                            总体合规性:
                            {workflowResult.summary.overall_compliant ? (
                              <Tag color="success">合规</Tag>
                            ) : (
                              <Tag color="warning">待优化</Tag>
                            )}
                          </p>
                        </div>
                      }
                      type="success"
                      showIcon
                    />
                  )}

                  {renderSetbacksResult()}
                  {renderAreasResult()}
                  {renderUMTable()}
                  {renderComplianceResult()}
                </Space>
              )}
            </TabPane>

            <TabPane tab={<><BulbOutlined /> 布局优化</>} key="3">
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="OR-Tools 约束规划求解器"
                  description="基于Google OR-Tools CP-SAT求解器的多目标优化，支持成本、空间、日照、能耗多维度优化"
                  type="info"
                  showIcon
                />

                <Form
                  form={optimizeForm}
                  layout="vertical"
                  onFinish={runOptimization}
                  initialValues={{
                    site_width: 200,
                    site_length: 150,
                    required_area: 10000,
                    setback_north: 10,
                    setback_south: 10,
                    setback_east: 10,
                    setback_west: 10,
                    max_time: 60,
                    num_solutions: 5
                  }}
                >
                  <Card title="优化策略" size="small" style={{ marginBottom: 16 }}>
                    <Form.Item label="选择优化策略">
                      <Radio.Group
                        value={optimizationStrategy}
                        onChange={(e) => setOptimizationStrategy(e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="balanced">
                          <Space><DashboardOutlined /> 平衡方案</Space>
                        </Radio.Button>
                        <Radio.Button value="cost">
                          <Space><DollarOutlined /> 成本优先</Space>
                        </Radio.Button>
                        <Radio.Button value="space">
                          <Space><ExpandOutlined /> 空间优先</Space>
                        </Radio.Button>
                        <Radio.Button value="green">
                          <Space><EnvironmentOutlined /> 绿色建筑</Space>
                        </Radio.Button>
                        <Radio.Button value="batch">
                          <Space><BuildOutlined /> 批量对比</Space>
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                  </Card>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Card title="场地参数" size="small">
                        <Form.Item
                          name="site_width"
                          label="场地宽度（米）"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={50} max={500} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                          name="site_length"
                          label="场地长度（米）"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={50} max={500} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                          name="required_area"
                          label="要求建筑面积（m²）"
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={100} max={100000} style={{ width: '100%' }} />
                        </Form.Item>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card title="退距要求" size="small">
                        <Row gutter={8}>
                          <Col span={12}>
                            <Form.Item name="setback_north" label="北侧退距（米）">
                              <InputNumber min={0} max={50} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="setback_south" label="南侧退距（米）">
                              <InputNumber min={0} max={50} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="setback_east" label="东侧退距（米）">
                              <InputNumber min={0} max={50} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="setback_west" label="西侧退距（米）">
                              <InputNumber min={0} max={50} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  </Row>

                  <Card title="求解选项" size="small">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="max_time"
                          label="最大求解时间（秒）"
                          tooltip="求解器运行的最大时间限制"
                        >
                          <InputNumber min={10} max={300} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="num_solutions"
                          label="返回方案数量"
                          tooltip="找到的解决方案数量"
                        >
                          <InputNumber min={1} max={10} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={optimizing}
                      icon={<BulbOutlined />}
                      block
                    >
                      运行布局优化
                    </Button>
                  </Form.Item>
                </Form>

                {optimizationResult && renderOptimizationResults()}
              </Space>
            </TabPane>
          </Tabs>
        </Space>
      </Card>
    </div>
  );
};

export default BuildingLayoutWorkbench;
