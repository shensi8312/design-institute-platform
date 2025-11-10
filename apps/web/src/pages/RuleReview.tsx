import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Typography, Descriptions } from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'

const { TextArea } = Input
const { Text, Paragraph } = Typography

interface Rule {
  id: string
  rule_code: string
  rule_name: string
  rule_content: string
  parameters: any
  category_id: string
  category_name: string
  document_name: string
  confidence_score: number
  applicable_scope: string
  priority: string
  review_status: string
  created_at: string
}

const RuleReview: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewModal, setReviewModal] = useState(false)
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const API_BASE = '/api'
  const token = localStorage.getItem('token')

  const loadPendingRules = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/rules/pending`, {
        params: { page, pageSize },
        headers: { Authorization: `Bearer ${token}` }
      })
      setRules(res.data.data.list || [])
      setPagination({
        current: res.data.data.page,
        pageSize: res.data.data.pageSize,
        total: res.data.data.total
      })
    } catch (error) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRule) return

    try {
      await form.validateFields()
      const values = form.getFieldsValue()

      await axios.put(
        `${API_BASE}/rules/${selectedRule.id}/review`,
        { status, comment: values.comment },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      message.success(status === 'approved' ? '已批准' : '已拒绝')
      setReviewModal(false)
      form.resetFields()
      loadPendingRules(pagination.current, pagination.pageSize)
    } catch (error) {
      message.error('审核失败')
    }
  }

  useEffect(() => {
    loadPendingRules()
  }, [])

  const priorityColor: Record<string, string> = {
    critical: 'red',
    high: 'orange',
    normal: 'blue',
    low: 'default'
  }

  const columns: ColumnsType<Rule> = [
    {
      title: '规则编号',
      dataIndex: 'rule_code',
      key: 'rule_code',
      width: 180,
      ellipsis: true
    },
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      key: 'rule_name',
      ellipsis: true,
      width: 200
    },
    {
      title: '类别',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 120
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={priorityColor[priority]}>
          {priority}
        </Tag>
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 100,
      render: (score: number) => `${(score * 100).toFixed(0)}%`
    },
    {
      title: '来源文档',
      dataIndex: 'document_name',
      key: 'document_name',
      ellipsis: true,
      width: 200
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: Rule) => (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            setSelectedRule(record)
            setReviewModal(true)
          }}
        >
          审核
        </Button>
      )
    }
  ]

  return (
    <Card
      title="设计规则审核"
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => loadPendingRules(pagination.current, pagination.pageSize)}
          loading={loading}
        >
          刷新
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => loadPendingRules(page, pageSize)
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="审核规则"
        open={reviewModal}
        onCancel={() => {
          setReviewModal(false)
          form.resetFields()
        }}
        footer={null}
        width={900}
      >
        {selectedRule && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="规则编号" span={2}>
                <Text strong>{selectedRule.rule_code}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="规则名称" span={2}>
                {selectedRule.rule_name}
              </Descriptions.Item>
              <Descriptions.Item label="类别">
                {selectedRule.category_name}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityColor[selectedRule.priority]}>
                  {selectedRule.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="适用范围">
                {selectedRule.applicable_scope}
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {(selectedRule.confidence_score * 100).toFixed(0)}%
              </Descriptions.Item>
              <Descriptions.Item label="来源文档" span={2}>
                {selectedRule.document_name}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Text strong>规则内容：</Text>
              <Paragraph style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                {selectedRule.rule_content}
              </Paragraph>
            </div>

            {selectedRule.parameters && Object.keys(selectedRule.parameters).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>参数：</Text>
                <pre style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  {JSON.stringify(selectedRule.parameters, null, 2)}
                </pre>
              </div>
            )}

            <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
              <Form.Item
                name="comment"
                label="审核意见"
                rules={[{ required: true, message: '请输入审核意见' }]}
              >
                <TextArea rows={4} placeholder="请输入审核意见..." />
              </Form.Item>
            </Form>

            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleReview('approved')}
              >
                批准
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReview('rejected')}
              >
                拒绝
              </Button>
              <Button onClick={() => {
                setReviewModal(false)
                form.resetFields()
              }}>
                取消
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default RuleReview
