import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Row, Col, Statistic, Progress, Typography, Tooltip } from 'antd'
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

interface RuleTypeOption {
  value: string
  label: string
  labelEn?: string
  description?: string
}

const UnifiedRuleManagement: React.FC = () => {
  const [ruleType, setRuleType] = useState<string>('assembly')
  const [ruleTypes, setRuleTypes] = useState<RuleTypeOption[]>([])
  const [rules, setRules] = useState<UnifiedRule[]>([])
  const [statistics, setStatistics] = useState<Statistics>({ total: 0, active: 0, pending: 0, successRate: 0 })
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [statsModalVisible, setStatsModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<UnifiedRule | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadRuleTypes()
  }, [])

  useEffect(() => {
    loadRules()
    loadStatistics()
  }, [ruleType])

  const loadRuleTypes = async () => {
    try {
      const response = await axios.get('/api/rules/types')
      if (response.data.success) {
        setRuleTypes(response.data.data)
        // 如果当前选中的类型不在列表中，选择第一个
        if (response.data.data.length > 0 && !response.data.data.find((t: RuleTypeOption) => t.value === ruleType)) {
          setRuleType(response.data.data[0].value)
        }
      }
    } catch (error) {
      console.error('加载规则类型失败:', error)
      // 使用默认值
      setRuleTypes([
        { value: 'assembly', label: '装配规则' },
        { value: 'pid', label: 'PID规则' },
        { value: 'building', label: '建筑规则' },
        { value: 'process', label: '工艺规则' },
        { value: 'strong_layout', label: '强排规则' },
        { value: 'fab_standard', label: 'FAB规范' }
      ])
    }
  }

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
    const found = ruleTypes.find(t => t.value === type)
    return found?.label || type
  }

  const columns = [
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 60,
      render: (isActive: boolean, record: UnifiedRule) => (
        <Switch
          size="small"
          checked={isActive}
          onChange={() => handleToggle(record.id, isActive)}
        />
      )
    },
    {
      title: '规则编码',
      dataIndex: 'rule_code',
      width: 140,
      render: (code: string) => <Tag color="blue">{code}</Tag>
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      width: 180
    },
    {
      title: '约束类型',
      width: 100,
      render: (record: any) => {
        const structure = record.rule_structure
        if (!structure) return '-'
        const subType = structure.subType
        const typeNames: Record<string, string> = {
          setback: '退距',
          floor_area_ratio: '容积率',
          building_height: '限高',
          green_ratio: '绿地率',
          building_density: '密度',
          building_spacing: '间距',
          fire_distance: '消防',
          parking: '停车',
          sunlight_analysis: '日照'
        }
        return <Tag>{typeNames[subType] || subType}</Tag>
      }
    },
    {
      title: '约束值',
      width: 120,
      render: (record: any) => {
        const structure = record.rule_structure
        if (!structure) return '-'
        const { value, unit, constraintType } = structure
        const typeLabel = constraintType === 'MIN' ? '≥' : constraintType === 'MAX' ? '≤' : '='
        return <Tag color="green" style={{ fontSize: 14, fontWeight: 600 }}>{typeLabel} {value}{unit || ''}</Tag>
      }
    },
    {
      title: '适用范围',
      width: 120,
      render: (record: any) => {
        const structure = record.rule_structure
        if (!structure) return '-'
        const scopeNames: Record<string, string> = {
          main_road: '主干道',
          secondary_road: '次干道',
          industrial: '工业用地',
          residential: '住宅',
          high_rise: '高层',
          fire_resistance_1_2: '一二级耐火'
        }
        return <Text type="secondary">{scopeNames[structure.scope] || structure.scope}</Text>
      }
    },
    {
      title: '操作',
      width: 150,
      render: (record: UnifiedRule) => (
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
              options={ruleTypes}
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
