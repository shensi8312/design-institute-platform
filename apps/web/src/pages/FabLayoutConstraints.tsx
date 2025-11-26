import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Tabs, Row, Col, Statistic, Typography, Tooltip } from 'antd'
import { SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, WarningOutlined, SafetyOutlined, SwapOutlined } from '@ant-design/icons'
import axios from '../utils/axios'

const { Text } = Typography

interface LayoutConstraint {
  id: string
  constraint_type: string
  source_zone: string
  target_zone: string
  rule_type: string
  value: number
  unit: string
  operator: string
  priority: number
  severity: string
  description: string
  is_active: boolean
}

interface ZoneAdjacency {
  id: string
  zone_a: string
  zone_b: string
  relationship: string
  reason: string
  priority: number
  is_active: boolean
}

interface TrafficRule {
  id: string
  rule_name: string
  traffic_type: string
  zones: string[]
  sequence_order: number
  description: string
  is_active: boolean
}

const constraintTypeColors: Record<string, string> = {
  vibration: 'red',
  wind: 'blue',
  hazard: 'orange',
  spacing: 'green',
  traffic: 'purple',
  adjacency: 'cyan'
}

const constraintTypeNames: Record<string, string> = {
  vibration: '震动约束',
  wind: '风向约束',
  hazard: '危险品约束',
  spacing: '间距约束',
  traffic: '动线约束',
  adjacency: '邻接约束'
}

const relationshipColors: Record<string, string> = {
  required: 'green',
  preferred: 'blue',
  discouraged: 'orange',
  prohibited: 'red'
}

const relationshipNames: Record<string, string> = {
  required: '必须相邻',
  preferred: '建议相邻',
  discouraged: '不建议相邻',
  prohibited: '禁止相邻'
}

const FabLayoutConstraints: React.FC = () => {
  const [constraints, setConstraints] = useState<LayoutConstraint[]>([])
  const [adjacencies, setAdjacencies] = useState<ZoneAdjacency[]>([])
  const [trafficRules, setTrafficRules] = useState<TrafficRule[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'constraint' | 'adjacency' | 'traffic'>('constraint')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [constraintsRes, adjacencyRes, trafficRes] = await Promise.all([
        axios.get('/api/fab-layout/constraints'),
        axios.get('/api/fab-layout/adjacency'),
        axios.get('/api/fab-layout/traffic-rules')
      ])

      if (constraintsRes.data.success) setConstraints(constraintsRes.data.data || [])
      if (adjacencyRes.data.success) setAdjacencies(adjacencyRes.data.data || [])
      if (trafficRes.data.success) setTrafficRules(trafficRes.data.data || [])
    } catch (error) {
      console.error('加载约束数据失败:', error)
      message.error('加载约束数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = (type: 'constraint' | 'adjacency' | 'traffic') => {
    setModalType(type)
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: any, type: 'constraint' | 'adjacency' | 'traffic') => {
    setModalType(type)
    setEditingItem(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string, type: string) => {
    try {
      const endpoint = type === 'constraint' ? 'constraints' : type === 'adjacency' ? 'adjacency' : 'traffic-rules'
      await axios.delete(`/api/fab-layout/${endpoint}/${id}`)
      message.success('删除成功')
      loadAllData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleToggle = async (id: string, isActive: boolean, type: string) => {
    try {
      const endpoint = type === 'constraint' ? 'constraints' : type === 'adjacency' ? 'adjacency' : 'traffic-rules'
      await axios.put(`/api/fab-layout/${endpoint}/${id}`, { is_active: !isActive })
      message.success(isActive ? '已禁用' : '已启用')
      loadAllData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const endpoint = modalType === 'constraint' ? 'constraints' : modalType === 'adjacency' ? 'adjacency' : 'traffic-rules'

      if (editingItem) {
        await axios.put(`/api/fab-layout/${endpoint}/${editingItem.id}`, values)
        message.success('更新成功')
      } else {
        await axios.post(`/api/fab-layout/${endpoint}`, values)
        message.success('创建成功')
      }

      setModalVisible(false)
      loadAllData()
    } catch (error) {
      message.error('保存失败')
    }
  }

  const constraintColumns = [
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 60,
      render: (active: boolean, record: LayoutConstraint) => (
        <Switch size="small" checked={active} onChange={() => handleToggle(record.id, active, 'constraint')} />
      )
    },
    {
      title: '约束类型',
      dataIndex: 'constraint_type',
      width: 100,
      render: (type: string) => (
        <Tag color={constraintTypeColors[type]}>{constraintTypeNames[type] || type}</Tag>
      )
    },
    {
      title: '源区域',
      dataIndex: 'source_zone',
      width: 100
    },
    {
      title: '目标区域',
      dataIndex: 'target_zone',
      width: 100
    },
    {
      title: '规则',
      dataIndex: 'rule_type',
      width: 100
    },
    {
      title: '约束值',
      width: 100,
      render: (record: LayoutConstraint) => (
        <Tag color="blue">{record.operator || '≥'} {record.value} {record.unit}</Tag>
      )
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 80,
      render: (severity: string) => (
        <Tag color={severity === 'critical' ? 'red' : severity === 'warning' ? 'orange' : 'blue'}>
          {severity}
        </Tag>
      )
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '操作',
      width: 120,
      render: (record: LayoutConstraint) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record, 'constraint')} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id, 'constraint')}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  const adjacencyColumns = [
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 60,
      render: (active: boolean, record: ZoneAdjacency) => (
        <Switch size="small" checked={active} onChange={() => handleToggle(record.id, active, 'adjacency')} />
      )
    },
    {
      title: '区域A',
      dataIndex: 'zone_a',
      width: 120
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      width: 100,
      render: (rel: string) => (
        <Tag color={relationshipColors[rel]}>{relationshipNames[rel] || rel}</Tag>
      )
    },
    {
      title: '区域B',
      dataIndex: 'zone_b',
      width: 120
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80
    },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true
    },
    {
      title: '操作',
      width: 120,
      render: (record: ZoneAdjacency) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record, 'adjacency')} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id, 'adjacency')}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  const trafficColumns = [
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 60,
      render: (active: boolean, record: TrafficRule) => (
        <Switch size="small" checked={active} onChange={() => handleToggle(record.id, active, 'traffic')} />
      )
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      width: 150
    },
    {
      title: '动线类型',
      dataIndex: 'traffic_type',
      width: 100,
      render: (type: string) => {
        const colors: Record<string, string> = { people: 'blue', material: 'green', chemical: 'orange', waste: 'red', emergency: 'purple' }
        const names: Record<string, string> = { people: '人流', material: '物流', chemical: '化学品', waste: '废物', emergency: '应急' }
        return <Tag color={colors[type]}>{names[type] || type}</Tag>
      }
    },
    {
      title: '顺序',
      dataIndex: 'sequence_order',
      width: 60
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '操作',
      width: 120,
      render: (record: TrafficRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record, 'traffic')} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id, 'traffic')}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  const renderModalForm = () => {
    if (modalType === 'constraint') {
      return (
        <>
          <Form.Item name="constraint_type" label="约束类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="vibration">震动约束</Select.Option>
              <Select.Option value="wind">风向约束</Select.Option>
              <Select.Option value="hazard">危险品约束</Select.Option>
              <Select.Option value="spacing">间距约束</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_zone" label="源区域">
                <Input placeholder="如: cleanroom" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_zone" label="目标区域">
                <Input placeholder="如: gasyard" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rule_type" label="规则类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="min_distance">最小距离</Select.Option>
                  <Select.Option value="max_distance">最大距离</Select.Option>
                  <Select.Option value="prohibited">禁止</Select.Option>
                  <Select.Option value="downwind">下风向</Select.Option>
                  <Select.Option value="upwind">上风向</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="value" label="数值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="单位">
                <Input placeholder="m" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重程度">
                <Select>
                  <Select.Option value="critical">严重</Select.Option>
                  <Select.Option value="warning">警告</Select.Option>
                  <Select.Option value="info">提示</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </>
      )
    } else if (modalType === 'adjacency') {
      return (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="zone_a" label="区域A" rules={[{ required: true }]}>
                <Input placeholder="如: cleanroom" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="zone_b" label="区域B" rules={[{ required: true }]}>
                <Input placeholder="如: cub" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="relationship" label="关系" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="required">必须相邻</Select.Option>
              <Select.Option value="preferred">建议相邻</Select.Option>
              <Select.Option value="discouraged">不建议相邻</Select.Option>
              <Select.Option value="prohibited">禁止相邻</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input.TextArea rows={2} />
          </Form.Item>
        </>
      )
    } else {
      return (
        <>
          <Form.Item name="rule_name" label="规则名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="traffic_type" label="动线类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="people">人流</Select.Option>
              <Select.Option value="material">物流</Select.Option>
              <Select.Option value="chemical">化学品</Select.Option>
              <Select.Option value="waste">废物</Select.Option>
              <Select.Option value="emergency">应急</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sequence_order" label="顺序">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </>
      )
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <SettingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>FAB布局约束管理</span>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="震动/风向/危险品约束"
                value={constraints.filter(c => ['vibration', 'wind', 'hazard'].includes(c.constraint_type)).length}
                prefix={<WarningOutlined />}
                suffix="条"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="间距约束"
                value={constraints.filter(c => c.constraint_type === 'spacing').length}
                prefix={<SafetyOutlined />}
                suffix="条"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="邻接关系"
                value={adjacencies.length}
                prefix={<SwapOutlined />}
                suffix="条"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="动线规则"
                value={trafficRules.length}
                prefix={<ThunderboltOutlined />}
                suffix="条"
              />
            </Card>
          </Col>
        </Row>

        <Tabs
          items={[
            {
              key: 'constraints',
              label: `布局约束 (${constraints.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('constraint')}>
                      新增约束
                    </Button>
                  </div>
                  <Table
                    columns={constraintColumns}
                    dataSource={constraints}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )
            },
            {
              key: 'adjacency',
              label: `邻接关系 (${adjacencies.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('adjacency')}>
                      新增邻接关系
                    </Button>
                  </div>
                  <Table
                    columns={adjacencyColumns}
                    dataSource={adjacencies}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )
            },
            {
              key: 'traffic',
              label: `动线规则 (${trafficRules.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('traffic')}>
                      新增动线规则
                    </Button>
                  </div>
                  <Table
                    columns={trafficColumns}
                    dataSource={trafficRules}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑' : '新增'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          {renderModalForm()}
        </Form>
      </Modal>
    </div>
  )
}

export default FabLayoutConstraints
