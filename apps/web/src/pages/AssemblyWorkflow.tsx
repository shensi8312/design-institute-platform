import React from 'react'
import { Card, Steps, Typography, Alert, Space, Button, Divider, Row, Col, Timeline } from 'antd'
import { FileSearchOutlined, ExperimentOutlined, ToolOutlined, RobotOutlined, CheckCircleOutlined, ArrowRightOutlined, ClockCircleOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography
const { Step } = Steps

const AssemblyWorkflow: React.FC = () => {
  const navigate = useNavigate()

  const steps = [
    {
      title: '1. PID识别',
      description: '上传PID图纸，自动识别组件和连接关系',
      icon: <FileSearchOutlined />,
      path: '/mechanical-design/pid-recognition',
      color: '#1890ff',
      detail: {
        input: 'PID图纸PDF文件',
        output: '组件列表（位号、类型、参数）+ 连接关系',
        tech: 'OpenCV符号检测 + DeepSeek-OCR文字识别',
        time: '30秒 - 2分钟'
      }
    },
    {
      title: '2. 约束推理',
      description: '基于BOM和图纸，AI推理装配约束关系',
      icon: <ExperimentOutlined />,
      path: '/mechanical-design/assembly-constraint',
      color: '#52c41a',
      detail: {
        input: 'BOM Excel + 装配图纸（可选）',
        output: '装配约束列表（固定/配合/距离/角度）',
        tech: '几何特征分析 + 规则匹配 + LLM推理',
        time: '1-5分钟（取决于零件数量）'
      }
    },
    {
      title: '3. 人工审核',
      description: '查看推理任务，审核约束正确性',
      icon: <CheckCircleOutlined />,
      path: '/mechanical-design/assembly-tasks',
      color: '#faad14',
      detail: {
        input: 'AI推理的任务和约束',
        output: '审核通过的任务',
        tech: '人工确认/修改/拒绝',
        time: '按需审核'
      }
    },
    {
      title: '4. 规则管理',
      description: '管理装配规则，学习历史样本',
      icon: <ToolOutlined />,
      path: '/mechanical-design/assembly-rules',
      color: '#722ed1',
      detail: {
        input: '历史STEP装配文件',
        output: '学习到的装配规则',
        tech: '样本学习算法',
        time: '按需触发'
      }
    },
    {
      title: '5. 自动装配',
      description: '生成装配设计，导出到SolidWorks',
      icon: <RobotOutlined />,
      path: '/mechanical-design/assembly-designs',
      color: '#eb2f96',
      detail: {
        input: '审核通过的推理任务',
        output: '装配设计步骤 + 3D模型 + 装配指导PDF',
        tech: 'AI自动装配引擎',
        time: '2-10分钟'
      }
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title="🏗️ 装配约束推理系统 - 完整流程总览" bordered={false}>
        <Alert
          message="系统介绍"
          description={
            <div>
              <p>本系统通过<strong>AI自动推理装配约束</strong>，学习历史样本，生成装配设计。整个流程分为5个阶段，按顺序操作。</p>
              <p><strong>核心价值：</strong>将传统手工2-3天的装配设计工作缩短到1小时内，准确率可达80%以上。</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 流程图 */}
        <Timeline mode="left" style={{ marginTop: 32 }}>
          {steps.map((step, index) => (
            <Timeline.Item
              key={index}
              color={step.color}
              dot={<span style={{ fontSize: 24 }}>{step.icon}</span>}
              label={
                <div style={{ width: 120, textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 16 }}>{step.title}</Text>
                  <br />
                  <Text type="secondary">{step.detail.time}</Text>
                </div>
              }
            >
              <Card
                size="small"
                style={{ marginBottom: 16, borderLeft: `4px solid ${step.color}` }}
                hoverable
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>{step.description}</Text>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text type="secondary">输入：</Text>{step.detail.input}
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">输出：</Text>{step.detail.output}
                    </Col>
                  </Row>
                  <Text type="secondary">技术：{step.detail.tech}</Text>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => navigate(step.path)}
                    icon={<ArrowRightOutlined />}
                    style={{ background: step.color, borderColor: step.color }}
                  >
                    进入此阶段
                  </Button>
                </Space>
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>

        <Divider />

        {/* 详细说明 */}
        <Title level={3}>📋 各阶段详细说明</Title>
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <FileSearchOutlined style={{ color: '#1890ff' }} />
                  阶段1：PID识别
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Paragraph>
                <ul>
                  <li><strong>功能：</strong>从PID图纸提取组件和连接</li>
                  <li><strong>识别内容：</strong>泵、阀门、仪表、设备、管线</li>
                  <li><strong>技术亮点：</strong>
                    <ul>
                      <li>Hough圆检测识别泵和仪表</li>
                      <li>轮廓检测识别阀门和设备</li>
                      <li>OCR识别位号和参数</li>
                    </ul>
                  </li>
                  <li><strong>准确率：</strong>约70%（取决于图纸质量）</li>
                </ul>
              </Paragraph>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <ExperimentOutlined style={{ color: '#52c41a' }} />
                  阶段2：约束推理
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Paragraph>
                <ul>
                  <li><strong>功能：</strong>AI推理零件间装配约束</li>
                  <li><strong>约束类型：</strong>固定、配合、距离、角度</li>
                  <li><strong>推理方法：</strong>
                    <ul>
                      <li>几何特征分析（孔、轴、平面）</li>
                      <li>规则库匹配</li>
                      <li>LLM语义推理</li>
                    </ul>
                  </li>
                  <li><strong>优势：</strong>自动推理，无需手工标注</li>
                </ul>
              </Paragraph>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#faad14' }} />
                  阶段3：人工审核
                </Space>
              }
            >
              <Paragraph>
                <ul>
                  <li><strong>功能：</strong>查看和审核AI推理结果</li>
                  <li><strong>操作：</strong>确认/修改/拒绝约束</li>
                  <li><strong>反馈学习：</strong>审核结果自动学习，提升准确率</li>
                  <li><strong>导出：</strong>可下载约束JSON数据</li>
                </ul>
              </Paragraph>
            </Card>
          </Col>

          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <ToolOutlined style={{ color: '#722ed1' }} />
                  阶段4：规则管理
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Paragraph>
                <ul>
                  <li><strong>功能：</strong>管理装配规则库</li>
                  <li><strong>规则来源：</strong>
                    <ul>
                      <li>从历史STEP文件自动学习</li>
                      <li>专家手工编写</li>
                    </ul>
                  </li>
                  <li><strong>规则内容：</strong>
                    <ul>
                      <li>L型法兰配合规则</li>
                      <li>螺栓孔对齐规则</li>
                      <li>轴承装配顺序规则</li>
                    </ul>
                  </li>
                  <li><strong>管理：</strong>可启用/禁用规则，查看使用统计</li>
                </ul>
              </Paragraph>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <RobotOutlined style={{ color: '#eb2f96' }} />
                  阶段5：自动装配
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Paragraph>
                <ul>
                  <li><strong>功能：</strong>AI自动生成装配设计</li>
                  <li><strong>生成内容：</strong>
                    <ul>
                      <li>装配步骤序列</li>
                      <li>3D模型预览</li>
                      <li>装配指导PDF</li>
                    </ul>
                  </li>
                  <li><strong>导出格式：</strong>
                    <ul>
                      <li>SolidWorks装配文件(.SLDASM)</li>
                      <li>STEP通用格式(.stp)</li>
                    </ul>
                  </li>
                </ul>
              </Paragraph>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <FilePdfOutlined style={{ color: '#f5222d' }} />
                  最终交付物
                </Space>
              }
            >
              <Paragraph>
                <ul>
                  <li>📄 装配指导PDF（含步骤截图）</li>
                  <li>📊 BOM物料清单Excel</li>
                  <li>🗂️ 装配约束JSON数据</li>
                  <li>🖼️ 3D模型STEP文件</li>
                  <li>🔧 SolidWorks装配文件</li>
                </ul>
              </Paragraph>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* 快速开始 */}
        <Alert
          message="🚀 快速开始指南"
          description={
            <div>
              <Title level={5}>新手推荐流程：</Title>
              <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
                <li>
                  <strong>第一步：</strong>访问「<a onClick={() => navigate('/mechanical-design/pid-recognition')}>PID识别</a>」，上传一个测试PID图纸（如：<code>其他-301000050672-PID-V1.0.pdf</code>），查看识别效果
                </li>
                <li>
                  <strong>第二步：</strong>进入「<a onClick={() => navigate('/mechanical-design/assembly-constraint')}>约束推理</a>」，上传BOM Excel文件，查看AI推理的约束结果
                </li>
                <li>
                  <strong>第三步：</strong>在「<a onClick={() => navigate('/mechanical-design/assembly-tasks')}>人工审核</a>」中查看任务列表，点击「详情」查看约束数据
                </li>
                <li>
                  <strong>第四步：</strong>如果约束正确，点击「生成设计」，系统自动生成装配步骤
                </li>
                <li>
                  <strong>第五步：</strong>在「<a onClick={() => navigate('/mechanical-design/assembly-designs')}>装配设计</a>」查看最终结果，导出PDF和STEP文件
                </li>
              </ol>

              <Divider />

              <Title level={5}>⚡ 一键快速体验：</Title>
              <Space>
                <Button
                  type="primary"
                  size="large"
                  icon={<FileSearchOutlined />}
                  onClick={() => navigate('/mechanical-design/pid-recognition')}
                >
                  开始PID识别
                </Button>
                <Button
                  size="large"
                  icon={<ExperimentOutlined />}
                  onClick={() => navigate('/mechanical-design/assembly-constraint')}
                >
                  约束推理引擎
                </Button>
                <Button
                  size="large"
                  icon={<RobotOutlined />}
                  onClick={() => navigate('/mechanical-design/assembly-designs')}
                >
                  查看装配设计
                </Button>
              </Space>
            </div>
          }
          type="success"
          showIcon
          icon={<ClockCircleOutlined />}
        />

        <Divider />

        {/* 技术支持 */}
        <Card size="small" title="📞 技术支持" style={{ background: '#f6f8fa' }}>
          <Paragraph>
            <ul>
              <li><strong>遇到问题？</strong>查看各页面的「故障排查」面板</li>
              <li><strong>服务状态：</strong>
                <ul>
                  <li>后端API：/api/health</li>
                  <li>OCR服务：http://10.10.18.3:7000/health</li>
                  <li>后端日志：<code>/tmp/backend_final.log</code></li>
                </ul>
              </li>
              <li><strong>示例数据：</strong><code>docs/solidworks/</code> 目录下有测试PID和STEP文件</li>
            </ul>
          </Paragraph>
        </Card>
      </Card>
    </div>
  )
}

export default AssemblyWorkflow
