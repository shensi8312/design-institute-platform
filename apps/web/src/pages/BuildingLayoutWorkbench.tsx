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
  Divider
} from 'antd';
import {
  CalculatorOutlined,
  BuildOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  DashboardOutlined,
  RocketOutlined
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
  const [loading, setLoading] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [rulesSummary, setRulesSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('1');

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
          </Tabs>
        </Space>
      </Card>
    </div>
  );
};

export default BuildingLayoutWorkbench;
