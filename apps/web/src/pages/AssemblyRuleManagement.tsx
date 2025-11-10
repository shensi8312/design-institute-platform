import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, InputNumber, message, Popconfirm, Row, Col, Statistic, Tabs, Alert, Descriptions, Divider, Progress, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined, ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined, ImportOutlined, SyncOutlined, RobotOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

interface AssemblyRule {
  id: string
  rule_id: string
  name: string
  description: string
  priority: number
  constraint_type: string
  condition_logic: any
  action_template: any
  is_active: boolean
  usage_count: number
  success_count: number
  created_at: string
  source?: 'learned' | 'manual' // 新增：规则来源
}

interface LearnedRule {
  rule_id: string
  rule_name: string
  description: string
  priority: number
  constraint_type: string
  condition: any
  action: any
  confidence?: number
  sample_count?: number
}

const AssemblyRuleManagement: React.FC = () => {
  const navigate = useNavigate()
  const [rules, setRules] = useState<AssemblyRule[]>([])
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([])
  const [loading, setLoading] = useState(false)
  const [learningLoading, setLearningLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<AssemblyRule | null>(null)
  const [selectedLearnedRule, setSelectedLearnedRule] = useState<LearnedRule | null>(null)
  const [ruleDetailVisible, setRuleDetailVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadRules()
    loadLearnedRules()
  }, [])

  const loadRules = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/assembly/rules')
      if (response.data.success) {
        setRules(response.data.data)
      }
    } catch (error) {
      message.error('加载规则失败')
    } finally {
      setLoading(false)
    }
  }

  const loadLearnedRules = async () => {
    try {
      const response = await axios.get('/api/assembly/learned-rules')
      if (response.data.success) {
        setLearnedRules(response.data.data || [])
      }
    } catch (error) {
      console.error('加载学习规则失败:', error)
    }
  }

  const handleReLearn = async () => {
    setLearningLoading(true)
    try {
      const response = await axios.post('/api/assembly/learn-rules')
      if (response.data.success) {
        message.success(`✅ 规则学习完成！学习到 ${response.data.rules_count || 0} 条规则`)
        loadLearnedRules()
      }
    } catch (error) {
      message.error('❌ 规则学习失败')
    } finally {
      setLearningLoading(false)
    }
  }

  const handleImportRule = async (learnedRule: LearnedRule) => {
    try {
      const payload = {
        rule_id: learnedRule.rule_id,
        name: learnedRule.rule_name,
        description: learnedRule.description,
        priority: learnedRule.priority,
        constraint_type: learnedRule.constraint_type,
        condition_logic: learnedRule.condition,
        action_template: learnedRule.action,
        source: 'learned'
      }

      const response = await axios.post('/api/assembly/rules', payload)
      if (response.data.success) {
        message.success('✅ 规则已导入')
        loadRules()
      }
    } catch (error: any) {
      if (error.response?.data?.message?.includes('already exists')) {
        message.warning('⚠️ 该规则已存在')
      } else {
        message.error('❌ 导入规则失败')
      }
    }
  }

  const handleBatchImport = () => {
    if (learnedRules.length === 0) {
      message.warning('没有可导入的学习规则')
      return
    }

    Modal.confirm({
      title: '批量导入',
      content: `确定要导入全部 ${learnedRules.length} 条学习规则吗？`,
      onOk: async () => {
        let successCount = 0
        for (const rule of learnedRules) {
          try {
            await handleImportRule(rule)
            successCount++
          } catch (error) {
            console.error(`导入规则 ${rule.rule_id} 失败`, error)
          }
        }
        message.success(`✅ 成功导入 ${successCount}/${learnedRules.length} 条规则`)
        loadRules()
      }
    })
  }

  const handleAdd = () => {
    setEditingRule(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (rule: AssemblyRule) => {
    setEditingRule(rule)
    form.setFieldsValue({
      ...rule,
      condition_logic: JSON.stringify(rule.condition_logic, null, 2),
      action_template: JSON.stringify(rule.action_template, null, 2)
    })
    setModalVisible(true)
  }

  const handleDelete = async (ruleId: string) => {
    try {
      const response = await axios.delete(`/api/assembly/rules/${ruleId}`)
      if (response.data.success) {
        message.success('规则已删除')
        loadRules()
      }
    } catch (error) {
      message.error('删除规则失败')
    }
  }

  const handleToggle = async (ruleId: string) => {
    try {
      const response = await axios.patch(`/api/assembly/rules/${ruleId}/toggle`)
      if (response.data.success) {
        message.success(response.data.message)
        loadRules()
      }
    } catch (error) {
      message.error('切换规则状态失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const payload = {
        ...values,
        condition_logic: JSON.parse(values.condition_logic),
        action_template: JSON.parse(values.action_template)
      }

      if (editingRule) {
        await axios.put(`/api/assembly/rules/${editingRule.rule_id}`, payload)
        message.success('规则已更新')
      } else {
        await axios.post('/api/assembly/rules', payload)
        message.success('规则已创建')
      }

      setModalVisible(false)
      loadRules()
    } catch (error: any) {
      if (error.name === 'SyntaxError') {
        message.error('JSON格式错误，请检查')
      } else {
        message.error('保存规则失败')
      }
    }
  }

  const handleBatchActivate = () => {
    const inactiveRules = rules.filter(r => !r.is_active)
    if (inactiveRules.length === 0) {
      message.warning('所有规则已激活')
      return
    }

    Modal.confirm({
      title: '批量激活',
      content: `确定要激活全部 ${inactiveRules.length} 条未激活规则吗？`,
      onOk: async () => {
        for (const rule of inactiveRules) {
          await handleToggle(rule.rule_id)
        }
        message.success(`✅ 已激活 ${inactiveRules.length} 条规则`)
        loadRules()
      }
    })
  }

  const totalUsage = rules.reduce((sum, r) => sum + (r.usage_count || 0), 0)
  const totalSuccess = rules.reduce((sum, r) => sum + (r.success_count || 0), 0)
  const activeRules = rules.filter(r => r.is_active).length

  const learnedRulesColumns = [
    {
      title: '规则ID',
      dataIndex: 'rule_id',
      width: 100,
      render: (ruleId: string) => <Tag color="purple">{ruleId}</Tag>
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      width: 200
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      sorter: (a: LearnedRule, b: LearnedRule) => a.priority - b.priority,
      render: (priority: number) => (
        <Tag color={priority >= 9 ? 'red' : priority >= 7 ? 'orange' : 'blue'}>
          P{priority}
        </Tag>
      )
    },
    {
      title: '约束类型',
      dataIndex: 'constraint_type',
      width: 120,
      render: (type: string) => <Tag color="green">{type}</Tag>
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: (confidence: number) => {
        if (!confidence) return '-'
        const percentage = (confidence * 100).toFixed(0)
        return (
          <Progress
            percent={Number(percentage)}
            size="small"
            status={Number(percentage) >= 80 ? 'success' : 'normal'}
          />
        )
      }
    },
    {
      title: '样本数',
      dataIndex: 'sample_count',
      width: 80,
      render: (count: number) => <Tag color="blue">{count || 0}</Tag>
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      render: (record: LearnedRule) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => {
              setSelectedLearnedRule(record)
              setRuleDetailVisible(true)
            }}
          >
            详情
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<ImportOutlined />}
            onClick={() => handleImportRule(record)}
          >
            导入
          </Button>
        </Space>
      )
    }
  ]

  const columns = [
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (isActive: boolean, record: AssemblyRule) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggle(record.rule_id)}
        />
      )
    },
    {
      title: '规则ID',
      dataIndex: 'rule_id',
      width: 100,
      render: (ruleId: string, record: AssemblyRule) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{ruleId}</Tag>
          {record.source === 'learned' && (
            <Tag icon={<RobotOutlined />} color="purple" style={{ fontSize: 11 }}>
              AI学习
            </Tag>
          )}
          {record.source === 'manual' && (
            <Tag icon={<UserOutlined />} color="cyan" style={{ fontSize: 11 }}>
              手动创建
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 200
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      sorter: (a: AssemblyRule, b: AssemblyRule) => a.priority - b.priority,
      render: (priority: number) => (
        <Tag color={priority >= 9 ? 'red' : priority >= 7 ? 'orange' : 'blue'}>
          P{priority}
        </Tag>
      )
    },
    {
      title: '约束类型',
      dataIndex: 'constraint_type',
      width: 120,
      render: (type: string) => <Tag color="green">{type}</Tag>
    },
    {
      title: '使用统计',
      width: 150,
      render: (record: AssemblyRule) => {
        const successRate = record.usage_count ? ((record.success_count || 0) / record.usage_count * 100) : 0
        return (
          <Space direction="vertical" size={0}>
            <Tag color="blue">使用: {record.usage_count || 0}次</Tag>
            <Tag color="green">成功: {record.success_count || 0}次</Tag>
            <Tag color="purple">成功率: {successRate.toFixed(0)}%</Tag>
          </Space>
        )
      }
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right' as const,
      render: (record: AssemblyRule) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此规则？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.rule_id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ExperimentOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <span>模块2：规则推理</span>
            <Tag color="green">约束求解器 + 规则库管理</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/mechanical-design/assembly-designs')}>
              进入模块3：自动设计
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 统计卡片 */}
          <Row gutter={16}>
            <Col span={4}>
              <Card>
                <Statistic
                  title="学习规则"
                  value={learnedRules.length}
                  prefix={<RobotOutlined />}
                  suffix="条"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="数据库规则"
                  value={rules.length}
                  prefix={<ExperimentOutlined />}
                  suffix="条"
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="激活规则"
                  value={activeRules}
                  prefix={<CheckCircleOutlined />}
                  suffix="条"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="总应用次数"
                  value={totalUsage}
                  prefix={<ClockCircleOutlined />}
                  suffix="次"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="成功率"
                  value={totalUsage ? ((totalSuccess / totalUsage) * 100).toFixed(1) : 0}
                  prefix={<ThunderboltOutlined />}
                  suffix="%"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 工作流提示 */}
          <Alert
            message="📊 完整工作流"
            description={
              <div>
                <Text strong>步骤1：样本学习</Text> → 上传装配体样本 → AI提取规则 →{' '}
                <Text strong style={{ color: '#722ed1' }}>步骤2：规则管理（当前）</Text> → 导入规则到数据库 →{' '}
                <Text strong>步骤3：自动装配</Text> → 选择零件 → AI自动装配
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* Tabs: 学习规则 vs 数据库规则 */}
          <Tabs
            defaultActiveKey="learned"
            items={[
              {
                key: 'learned',
                label: (
                  <span>
                    <RobotOutlined />
                    学习规则 ({learnedRules.length})
                  </span>
                ),
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<SyncOutlined />}
                        onClick={handleReLearn}
                        loading={learningLoading}
                      >
                        {learningLoading ? '学习中...' : '重新学习规则'}
                      </Button>
                      <Button
                        icon={<ImportOutlined />}
                        onClick={handleBatchImport}
                        disabled={learnedRules.length === 0}
                      >
                        批量导入全部规则
                      </Button>
                      <Text type="secondary">
                        💡 从装配样本中提取的AI规则，可选择导入到数据库中使用
                      </Text>
                    </Space>

                    <Table
                      columns={learnedRulesColumns}
                      dataSource={learnedRules}
                      rowKey="rule_id"
                      loading={learningLoading}
                      scroll={{ x: 1200 }}
                      pagination={{
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条学习规则`
                      }}
                    />
                  </Space>
                )
              },
              {
                key: 'database',
                label: (
                  <span>
                    <ExperimentOutlined />
                    数据库规则 ({rules.length})
                  </span>
                ),
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Space>
                      <Button icon={<CheckCircleOutlined />} onClick={handleBatchActivate}>
                        批量激活规则
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        手动新增规则
                      </Button>
                      <Text type="secondary">
                        💡 数据库中的规则可用于AI自动装配
                      </Text>
                    </Space>

                    <Table
                      columns={columns}
                      dataSource={rules}
                      rowKey="id"
                      loading={loading}
                      scroll={{ x: 1200 }}
                      pagination={{
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条规则`
                      }}
                    />
                  </Space>
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="rule_id"
            label="规则ID"
            rules={[{ required: true, message: '请输入规则ID' }]}
          >
            <Input placeholder="例如: R1, R2" disabled={!!editingRule} />
          </Form.Item>

          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如: VCR接头同轴约束" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="规则描述" />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请输入优先级' }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="constraint_type"
            label="约束类型"
            rules={[{ required: true, message: '请输入约束类型' }]}
          >
            <Input placeholder="例如: CONCENTRIC, SCREW, COINCIDENT" />
          </Form.Item>

          <Form.Item
            name="condition_logic"
            label="条件逻辑 (JSON)"
            rules={[{ required: true, message: '请输入条件逻辑' }]}
            extra={'格式: {"type": "both", "field": "type", "value": "VCR接头"}'}
          >
            <Input.TextArea rows={5} placeholder='{"type": "both", "field": "type", "value": "VCR接头"}' />
          </Form.Item>

          <Form.Item
            name="action_template"
            label="动作模板 (JSON)"
            rules={[{ required: true, message: '请输入动作模板' }]}
            extra={'格式: {"type": "CONCENTRIC", "parameters": {"alignment": "ALIGNED"}}'}
          >
            <Input.TextArea rows={5} placeholder='{"type": "CONCENTRIC", "parameters": {"alignment": "ALIGNED"}}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 学习规则详情 Modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            学习规则详情
          </Space>
        }
        open={ruleDetailVisible}
        onCancel={() => setRuleDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRuleDetailVisible(false)}>
            关闭
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<ImportOutlined />}
            onClick={() => {
              if (selectedLearnedRule) {
                handleImportRule(selectedLearnedRule)
                setRuleDetailVisible(false)
              }
            }}
          >
            导入到数据库
          </Button>
        ]}
        width={700}
      >
        {selectedLearnedRule && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="规则ID">
              <Tag color="purple">{selectedLearnedRule.rule_id}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="规则名称">
              {selectedLearnedRule.rule_name}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedLearnedRule.description}
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={selectedLearnedRule.priority >= 9 ? 'red' : selectedLearnedRule.priority >= 7 ? 'orange' : 'blue'}>
                P{selectedLearnedRule.priority}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="约束类型">
              <Tag color="green">{selectedLearnedRule.constraint_type}</Tag>
            </Descriptions.Item>
            {selectedLearnedRule.confidence && (
              <Descriptions.Item label="置信度">
                <Progress
                  percent={Number((selectedLearnedRule.confidence * 100).toFixed(0))}
                  status={selectedLearnedRule.confidence >= 0.8 ? 'success' : 'normal'}
                />
              </Descriptions.Item>
            )}
            {selectedLearnedRule.sample_count && (
              <Descriptions.Item label="样本数">
                <Tag color="blue">{selectedLearnedRule.sample_count} 个</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="条件逻辑">
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                {JSON.stringify(selectedLearnedRule.condition, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="动作模板">
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                {JSON.stringify(selectedLearnedRule.action, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default AssemblyRuleManagement
