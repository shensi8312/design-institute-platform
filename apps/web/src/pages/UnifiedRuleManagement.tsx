import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Row, Col, Statistic, Progress, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, SettingOutlined, BarChartOutlined, SyncOutlined } from '@ant-design/icons'
import axios from '../utils/axios'

const { Text } = Typography
const { TextArea } = Input

interface UnifiedRule {
  id: string
  rule_type: string
  rule_code: string
  rule_name: string
  rule_content: string
  category_id?: string
  priority: string
  confidence_score: number
  review_status: string
  is_active: boolean
  usage_count: number
  success_count: number
  learned_from?: string
  created_at: string
  updated_at: string
}

interface Statistics {
  total: number
  active: number
  pending: number
  successRate: number
}

const UnifiedRuleManagement: React.FC = () => {
  const [ruleType, setRuleType] = useState<string>('assembly')
  const [rules, setRules] = useState<UnifiedRule[]>([])
  const [statistics, setStatistics] = useState<Statistics>({ total: 0, active: 0, pending: 0, successRate: 0 })
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [statsModalVisible, setStatsModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<UnifiedRule | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadRules()
    loadStatistics()
  }, [ruleType])

  const loadRules = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/rules/${ruleType}`, {
        params: { page: 1, pageSize: 100 }
      })
      if (response.data.success) {
        setRules(response.data.data.list || [])
      }
    } catch (error) {
      message.error('加载规则失败')
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`/api/rules/${ruleType}/statistics`)
      if (response.data.success) {
        const stats = response.data.data
        setStatistics({
          total: stats.total_rules || 0,
          active: stats.active_rules || 0,
          pending: stats.pending_review || 0,
          successRate: stats.success_rate || 0
        })
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  const handleLearnRules = async () => {
    Modal.confirm({
      title: '开始规则学习',
      content: `确定要从现有数据中学习${getRuleTypeName(ruleType)}规则吗？`,
      onOk: async () => {
        try {
          const response = await axios.post(`/api/rules/${ruleType}/learn`, {
            sampleLimit: 50,
            minOccurrences: 3
          })
          if (response.data.success) {
            message.success(`学习到 ${response.data.rules_count} 条规则`)
            loadRules()
          }
        } catch (error) {
          message.error('规则学习失败')
        }
      }
    })
  }

  const handleApprove = async (ruleId: string) => {
    try {
      const response = await axios.post(`/api/rules/${ruleType}/${ruleId}/approve`, {
        comment: '规则已通过审核'
      })
      if (response.data.success) {
        message.success('规则已批准')
        loadRules()
        loadStatistics()
      }
    } catch (error) {
      message.error('批准失败')
    }
  }

  const handleReject = async (ruleId: string) => {
    Modal.confirm({
      title: '拒绝规则',
      content: (
        <Form.Item label="拒绝原因" name="comment">
          <TextArea rows={4} placeholder="请输入拒绝原因" />
        </Form.Item>
      ),
      onOk: async () => {
        try {
          const comment = form.getFieldValue('comment')
          if (!comment) {
            message.error('请输入拒绝原因')
            return
          }
          const response = await axios.post(`/api/rules/${ruleType}/${ruleId}/reject`, { comment })
          if (response.data.success) {
            message.success('规则已拒绝')
            loadRules()
            loadStatistics()
          }
        } catch (error) {
          message.error('拒绝失败')
        }
      }
    })
  }

  const handleDelete = async (ruleId: string) => {
    try {
      const response = await axios.delete(`/api/rules/${ruleType}/${ruleId}`)
      if (response.data.success) {
        message.success('规则已删除')
        loadRules()
        loadStatistics()
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await axios.put(`/api/rules/${ruleType}/${ruleId}`, { is_active: !isActive })
      if (response.data.success) {
        message.success(isActive ? '规则已停用' : '规则已激活')
        loadRules()
      }
    } catch (error) {
      message.error('切换状态失败')
    }
  }

  const handleAdd = () => {
    setEditingRule(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (rule: UnifiedRule) => {
    setEditingRule(rule)
    form.setFieldsValue(rule)
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingRule) {
        await axios.put(`/api/rules/${ruleType}/${editingRule.id}`, values)
        message.success('规则已更新')
      } else {
        await axios.post(`/api/rules/${ruleType}`, values)
        message.success('规则已创建')
      }
      setModalVisible(false)
      loadRules()
      loadStatistics()
    } catch (error) {
      message.error('保存失败')
    }
  }

  const getRuleTypeName = (type: string) => {
    const names: Record<string, string> = {
      assembly: '装配',
      pid: 'PID',
      building: '建筑',
      process: '工艺',
      strong_layout: '强排'
    }
    return names[type] || type
  }

  const columns = [
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (isActive: boolean, record: UnifiedRule) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggle(record.id, isActive)}
        />
      )
    },
    {
      title: '规则编码',
      dataIndex: 'rule_code',
      width: 120,
      render: (code: string) => <Tag color="blue">{code}</Tag>
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      width: 200
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (priority: string) => {
        const colors: Record<string, string> = {
          critical: 'red',
          high: 'orange',
          normal: 'blue',
          low: 'gray'
        }
        return <Tag color={colors[priority] || 'blue'}>{priority}</Tag>
      }
    },
    {
      title: '置信度',
      dataIndex: 'confidence_score',
      width: 120,
      render: (score: number) => (
        <Progress
          percent={Number((score * 100).toFixed(0))}
          size="small"
          status={score >= 0.8 ? 'success' : 'normal'}
        />
      )
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          approved: 'green',
          rejected: 'red'
        }
        return <Tag color={colors[status] || 'blue'}>{status}</Tag>
      }
    },
    {
      title: '使用统计',
      width: 150,
      render: (record: UnifiedRule) => {
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
      width: 300,
      fixed: 'right' as const,
      render: (record: UnifiedRule) => (
        <Space size="small">
          {record.review_status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                批准
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
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
            onConfirm={() => handleDelete(record.id)}
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
            <ExperimentOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>统一规则管理</span>
            <Select
              value={ruleType}
              onChange={setRuleType}
              style={{ width: 150 }}
              options={[
                { label: '装配规则', value: 'assembly' },
                { label: 'PID规则', value: 'pid' },
                { label: '建筑规则', value: 'building' },
                { label: '工艺规则', value: 'process' },
                { label: '强排规则', value: 'strong_layout' }
              ]}
            />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => setStatsModalVisible(true)}
            >
              统计报告
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setConfigModalVisible(true)}
            >
              学习配置
            </Button>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleLearnRules}
            >
              智能学习
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增规则
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总规则数"
                  value={statistics.total}
                  prefix={<ExperimentOutlined />}
                  suffix="条"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="激活规则"
                  value={statistics.active}
                  prefix={<CheckCircleOutlined />}
                  suffix="条"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待审核"
                  value={statistics.pending}
                  prefix={<CloseCircleOutlined />}
                  suffix="条"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="成功率"
                  value={statistics.successRate}
                  suffix="%"
                  precision={1}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={rules}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条规则`
            }}
          />
        </Space>
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="rule_code" label="规则编码" rules={[{ required: true }]}>
            <Input placeholder="例如: R001" disabled={!!editingRule} />
          </Form.Item>
          <Form.Item name="rule_name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="规则名称" />
          </Form.Item>
          <Form.Item name="rule_content" label="规则内容" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="规则内容描述" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="critical">Critical</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="low">Low</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="confidence_score" label="置信度" rules={[{ required: true }]}>
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UnifiedRuleManagement
