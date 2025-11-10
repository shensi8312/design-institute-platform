import React from 'react';
import {
  Card,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Badge
} from 'antd';
import {
  RobotOutlined,
  FileSearchOutlined,
  CalculatorOutlined,
  SafetyCertificateOutlined,
  BuildOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ApiOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  capabilities: string[];
  status: 'active' | 'inactive' | 'beta';
}

interface AgentSelectorProps {
  onSelect: (agentId: string) => void;
  selectedAgent?: string;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ onSelect, selectedAgent }) => {
  const agents: Agent[] = [
    {
      id: 'general',
      name: '通用助手',
      description: '基础问答，适合一般查询',
      icon: <RobotOutlined />,
      capabilities: ['文档检索', '问答对话', '总结归纳'],
      status: 'active'
    },
    {
      id: 'spec_checker',
      name: '规范检查助手',
      description: '检查设计是否符合建筑规范',
      icon: <SafetyCertificateOutlined />,
      capabilities: ['规范查询', '合规检查', '条文解释', '整改建议'],
      status: 'active'
    },
    {
      id: 'quantity_calc',
      name: '工程量计算助手',
      description: '自动计算工程量和造价',
      icon: <CalculatorOutlined />,
      capabilities: ['工程量计算', '材料统计', '造价估算', '清单生成'],
      status: 'active'
    },
    {
      id: 'design_review',
      name: '设计审查助手',
      description: '审查图纸和设计方案',
      icon: <FileSearchOutlined />,
      capabilities: ['图纸审查', '方案评审', '问题识别', '优化建议'],
      status: 'active'
    },
    {
      id: 'bim_analyzer',
      name: 'BIM分析助手',
      description: '分析BIM模型和提取信息',
      icon: <BuildOutlined />,
      capabilities: ['模型解析', '碰撞检测', '空间分析', '属性提取'],
      status: 'beta'
    },
    {
      id: 'data_analyst',
      name: '数据分析助手',
      description: '项目数据统计和分析',
      icon: <BarChartOutlined />,
      capabilities: ['数据统计', '趋势分析', '报表生成', '可视化'],
      status: 'active'
    },
    {
      id: 'sql_expert',
      name: '数据库查询助手',
      description: '自然语言转SQL查询',
      icon: <DatabaseOutlined />,
      capabilities: ['SQL生成', '数据查询', '报表导出', '数据分析'],
      status: 'active'
    },
    {
      id: 'workflow',
      name: '工作流助手',
      description: '多步骤复杂任务处理',
      icon: <ApiOutlined />,
      capabilities: ['流程编排', '任务自动化', '批量处理', '集成调用'],
      status: 'beta'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge status="success" text="可用" />;
      case 'beta':
        return <Badge status="processing" text="测试" />;
      case 'inactive':
        return <Badge status="default" text="维护" />;
      default:
        return null;
    }
  };

  return (
    <Card title="选择智能助手" size="small">
      <Row gutter={[16, 16]}>
        {agents.map(agent => (
          <Col span={12} key={agent.id}>
            <Card
              hoverable
              style={{
                borderColor: selectedAgent === agent.id ? '#1890ff' : undefined,
                borderWidth: selectedAgent === agent.id ? 2 : 1,
                cursor: agent.status === 'inactive' ? 'not-allowed' : 'pointer',
                opacity: agent.status === 'inactive' ? 0.5 : 1
              }}
              onClick={() => {
                if (agent.status !== 'inactive') {
                  onSelect(agent.id);
                }
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span style={{ fontSize: 24 }}>{agent.icon}</span>
                  <div>
                    <Text strong>{agent.name}</Text>
                    <div>{getStatusBadge(agent.status)}</div>
                  </div>
                </Space>
                
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {agent.description}
                </Text>
                
                <Space size={[0, 4]} wrap>
                  {agent.capabilities.map(cap => (
                    <Tag key={cap} color="blue" style={{ fontSize: 11 }}>
                      {cap}
                    </Tag>
                  ))}
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 16, padding: '8px 12px', background: '#f0f2f5', borderRadius: 4 }}>
        <Space>
          <QuestionCircleOutlined />
          <Text type="secondary" style={{ fontSize: 12 }}>
            提示：不同助手针对特定任务优化，选择合适的助手可获得更好的结果
          </Text>
        </Space>
      </div>
    </Card>
  );
};

export default AgentSelector;
