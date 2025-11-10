import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  Space,
  message,
  Drawer,
  Descriptions,
  Badge,
  Tabs,
  InputNumber,
  Checkbox,
  Popconfirm
} from 'antd'
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  UploadOutlined,
  FilterOutlined
} from '@ant-design/icons'
import axios from 'axios'

const { Search } = Input
const { Option } = Select
const { TextArea } = Input

interface Rule {
  id: string
  category_id: string
  rule_code: string
  rule_name: string
  rule_content: string
  rule_structure: any
  parameters: {
    min?: { value: number; unit: string }
    max?: { value: number; unit: string }
    value?: { value: number; unit: string }
  }
  applicable_scope: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  review_status: 'pending' | 'approved' | 'rejected'
  confidence_score: number
  created_at: string
}

interface RuleCategory {
  id: string
  name: string
  code: string
  level: string
  count?: number
}

const RuleManagement: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<RuleCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 筛选条件
  const [filters, setFilters] = useState({
    category_id: 'all',
    review_status: 'all',
    priority: 'all',
    search: ''
  })

  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })

  // 加载分类统计
  useEffect(() => {
    loadCategories()
  }, [])

  // 加载规则列表
  useEffect(() => {
    loadRules()
  }, [filters, pagination.current])

  const loadCategories = async () => {
    try {
      const res = await axios.get('/api/rules/categories/stats')
      setCategories(res.data.data)
    } catch (error) {
      message.error('加载分类失败')
    }
  }

  const loadRules = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: pagination.current,
        limit: pagination.pageSize
      }

      if (filters.category_id !== 'all') params.category_id = filters.category_id
      if (filters.review_status !== 'all') params.review_status = filters.review_status
      if (filters.priority !== 'all') params.priority = filters.priority
      if (filters.search) params.search = filters.search

      const res = await axios.get('/api/rules', { params })

      setRules(res.data.data.rules)
      setPagination(prev => ({
        ...prev,
        total: res.data.data.total
      }))
    } catch (error) {
      message.error('加载规则失败')
    } finally {
      setLoading(false)
    }
  }

  // 查看详情
  const handleViewDetail = (rule: Rule) => {
    setSelectedRule(rule)
    setDrawerVisible(true)
  }

  // 编辑规则
  const handleEdit = (rule: Rule) => {
    setSelectedRule(rule)
    form.setFieldsValue({
      rule_name: rule.rule_name,
      rule_content: rule.rule_content,
      applicable_scope: rule.applicable_scope,
      priority: rule.priority,
      parameters: rule.parameters
    })
    setEditModalVisible(true)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields()

      await axios.put(`/api/rules/${selectedRule!.id}`, values)

      message.success('保存成功')
      setEditModalVisible(false)
      loadRules()
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 审核通过
  const handleApprove = async (ruleId: string) => {
    try {
      await axios.post(`/api/rules/${ruleId}/approve`, {
        reviewed_by: localStorage.getItem('user_id'),
        review_comment: '通过'
      })

      message.success('审核通过')
      loadRules()
    } catch (error) {
      message.error('审核失败')
    }
  }

  // 审核拒绝
  const handleReject = async (ruleId: string, reason: string) => {
    try {
      await axios.post(`/api/rules/${ruleId}/reject`, {
        reviewed_by: localStorage.getItem('user_id'),
        review_comment: reason
      })

      message.success('已拒绝')
      loadRules()
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 批量审核
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择规则')
      return
    }

    try {
      await axios.post('/api/rules/batch-approve', {
        rule_ids: selectedRowKeys,
        reviewed_by: localStorage.getItem('user_id')
      })

      message.success(`成功审核 ${selectedRowKeys.length} 条规则`)
      setSelectedRowKeys([])
      loadRules()
    } catch (error) {
      message.error('批量审核失败')
    }
  }

  // 优先级颜色
  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: 'red',
      high: 'orange',
      normal: 'blue',
      low: 'default'
    }
    return colors[priority as keyof typeof colors]
  }

  // 审核状态颜色
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'gold',
      approved: 'green',
      rejected: 'red'
    }
    return colors[status as keyof typeof colors]
  }

  // 表格列定义
  const columns = [
    {
      title: '规则编号',
      dataIndex: 'rule_code',
      key: 'rule_code',
      width: 180,
      render: (text: string, record: Rule) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          {text}
        </Button>
      )
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      key: 'rule_name',
      ellipsis: true
    },
    {
      title: '类别',
      dataIndex: 'category_id',
      key: 'category_id',
      width: 100,
      render: (categoryId: string) => {
        const category = categories.find(c => c.id === categoryId)
        return <Tag>{category?.name || '未知'}</Tag>
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>
          {priority === 'critical' ? '关键' : priority === 'high' ? '高' : priority === 'normal' ? '普通' : '低'}
        </Tag>
      )
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 100,
      render: (status: string) => (
        <Badge
          status={status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'error'}
          text={status === 'approved' ? '已通过' : status === 'pending' ? '待审核' : '已拒绝'}
        />
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 100,
      render: (score: number) => `${(score * 100).toFixed(1)}%`
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Rule) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.review_status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Popconfirm
                title="拒绝原因"
                onConfirm={(e) => {
                  const reason = (e?.target as any)?.value || '不符合规范'
                  handleReject(record.id, reason)
                }}
              >
                <Button type="link" danger icon={<CloseCircleOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="rule-management" style={{ padding: 24 }}>
      {/* 顶部筛选栏 */}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Select
                style={{ width: 150 }}
                value={filters.category_id}
                onChange={(value) => setFilters({ ...filters, category_id: value })}
              >
                <Option value="all">全部类别</Option>
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.count || 0})
                  </Option>
                ))}
              </Select>

              <Select
                style={{ width: 120 }}
                value={filters.review_status}
                onChange={(value) => setFilters({ ...filters, review_status: value })}
              >
                <Option value="all">全部状态</Option>
                <Option value="pending">待审核</Option>
                <Option value="approved">已通过</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>

              <Select
                style={{ width: 120 }}
                value={filters.priority}
                onChange={(value) => setFilters({ ...filters, priority: value })}
              >
                <Option value="all">全部优先级</Option>
                <Option value="critical">关键</Option>
                <Option value="high">高</Option>
                <Option value="normal">普通</Option>
                <Option value="low">低</Option>
              </Select>

              <Search
                placeholder="搜索规则编号或名称"
                style={{ width: 300 }}
                onSearch={(value) => setFilters({ ...filters, search: value })}
                allowClear
              />
            </Space>

            <Space>
              <Button icon={<UploadOutlined />}>上传规范文档</Button>
              {selectedRowKeys.length > 0 && (
                <Button type="primary" onClick={handleBatchApprove}>
                  批量审核 ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </div>

          {/* 统计卡片 */}
          <Space size="large">
            {categories.map(cat => (
              <Card
                key={cat.id}
                size="small"
                style={{ width: 150, cursor: 'pointer' }}
                onClick={() => setFilters({ ...filters, category_id: cat.id })}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold' }}>{cat.count || 0}</div>
                  <div style={{ color: '#999' }}>{cat.name}</div>
                </div>
              </Card>
            ))}
          </Space>
        </Space>
      </Card>

      {/* 规则列表 */}
      <Card style={{ marginTop: 16 }}>
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys
          }}
          columns={columns}
          dataSource={rules}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            onChange: (page) => setPagination({ ...pagination, current: page })
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="规则详情"
        width={720}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedRule && (
          <Tabs>
            <Tabs.TabPane tab="基本信息" key="basic">
              <Descriptions column={1} bordered>
                <Descriptions.Item label="规则编号">
                  {selectedRule.rule_code}
                </Descriptions.Item>
                <Descriptions.Item label="规则名称">
                  {selectedRule.rule_name}
                </Descriptions.Item>
                <Descriptions.Item label="所属类别">
                  {categories.find(c => c.id === selectedRule.category_id)?.name}
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <Tag color={getPriorityColor(selectedRule.priority)}>
                    {selectedRule.priority}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="审核状态">
                  <Badge
                    status={selectedRule.review_status === 'approved' ? 'success' : 'warning'}
                    text={selectedRule.review_status === 'approved' ? '已通过' : '待审核'}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="置信度">
                  {(selectedRule.confidence_score * 100).toFixed(1)}%
                </Descriptions.Item>
              </Descriptions>

              <Descriptions
                column={1}
                bordered
                style={{ marginTop: 16 }}
                title="规则原文"
              >
                <Descriptions.Item label="内容">
                  {selectedRule.rule_content}
                </Descriptions.Item>
              </Descriptions>
            </Tabs.TabPane>

            <Tabs.TabPane tab="提取参数" key="parameters">
              <Descriptions column={1} bordered>
                {selectedRule.parameters.min && (
                  <Descriptions.Item label="最小值">
                    {selectedRule.parameters.min.value} {selectedRule.parameters.min.unit}
                  </Descriptions.Item>
                )}
                {selectedRule.parameters.max && (
                  <Descriptions.Item label="最大值">
                    {selectedRule.parameters.max.value} {selectedRule.parameters.max.unit}
                  </Descriptions.Item>
                )}
                {selectedRule.parameters.value && (
                  <Descriptions.Item label="标准值">
                    {selectedRule.parameters.value.value} {selectedRule.parameters.value.unit}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="适用范围">
                  {selectedRule.applicable_scope}
                </Descriptions.Item>
              </Descriptions>
            </Tabs.TabPane>

            <Tabs.TabPane tab="关联规则" key="relationships">
              <p>关联规则图谱展示 (待实现知识图谱可视化)</p>
            </Tabs.TabPane>
          </Tabs>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑规则"
        visible={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="规则名称"
            name="rule_name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="规则内容"
            name="rule_content"
            rules={[{ required: true, message: '请输入规则内容' }]}
          >
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item label="提取参数">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <span>最小值:</span>
                <Form.Item name={['parameters', 'min', 'value']} noStyle>
                  <InputNumber style={{ width: 100 }} />
                </Form.Item>
                <Form.Item name={['parameters', 'min', 'unit']} noStyle>
                  <Select style={{ width: 80 }}>
                    <Option value="m">m</Option>
                    <Option value="mm">mm</Option>
                    <Option value="cm">cm</Option>
                    <Option value="℃">℃</Option>
                  </Select>
                </Form.Item>
              </Space>

              <Space>
                <span>最大值:</span>
                <Form.Item name={['parameters', 'max', 'value']} noStyle>
                  <InputNumber style={{ width: 100 }} />
                </Form.Item>
                <Form.Item name={['parameters', 'max', 'unit']} noStyle>
                  <Select style={{ width: 80 }}>
                    <Option value="m">m</Option>
                    <Option value="mm">mm</Option>
                    <Option value="cm">cm</Option>
                  </Select>
                </Form.Item>
              </Space>
            </Space>
          </Form.Item>

          <Form.Item
            label="适用范围"
            name="applicable_scope"
          >
            <Checkbox.Group>
              <Checkbox value="residential">住宅建筑</Checkbox>
              <Checkbox value="public">公共建筑</Checkbox>
              <Checkbox value="industrial">工业建筑</Checkbox>
              <Checkbox value="high-rise">高层建筑</Checkbox>
              <Checkbox value="multi-story">多层建筑</Checkbox>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="critical">关键</Option>
              <Option value="high">高</Option>
              <Option value="normal">普通</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RuleManagement
