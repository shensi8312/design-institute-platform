import React, { useState, useEffect } from 'react'
import { Card, Form, Input, InputNumber, Switch, Button, Select, message, Tabs, Row, Col, Statistic, Typography, Space } from 'antd'
import { SettingOutlined, BarChartOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons'
import axios from '../utils/axios'

const { Text } = Typography

interface LearningConfig {
  rule_type: string
  trigger_mode: string
  auto_approve_threshold: number
  min_confidence_threshold: number
  sample_limit: number
  min_occurrences: number
  batch_learning_interval: number
  require_human_review: boolean
  enable_feedback_learning: boolean
  feedback_weight: number
  conflict_resolution_strategy: string
}

interface LearningReport {
  ruleType: string
  period: string
  totalRules: number
  totalApplications: number
  successRate: string
  correctRate: string
  autoApplyRate: string
  avgConfidence: string
}

const RuleLearningConfig: React.FC = () => {
  const [ruleType, setRuleType] = useState<string>('assembly')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<LearningConfig | null>(null)
  const [report, setReport] = useState<LearningReport | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadConfig()
    loadReport()
  }, [ruleType])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/rules/${ruleType}/config`)
      if (response.data.success) {
        const cfg = response.data.data
        setConfig(cfg)
        form.setFieldsValue(cfg)
      }
    } catch (error) {
      message.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async () => {
    try {
      const response = await axios.get(`/api/rules/${ruleType}/learning-report`, {
        params: { days: 30 }
      })
      if (response.data.success) {
        setReport(response.data.data)
      }
    } catch (error) {
      console.error('加载报告失败:', error)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const response = await axios.put(`/api/rules/${ruleType}/config`, values)
      if (response.data.success) {
        message.success('配置已保存')
        loadConfig()
      }
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleBatchLearning = async () => {
    setLoading(true)
    try {
      const response = await axios.post(`/api/rules/${ruleType}/batch-learning`, {
        days: 30
      })
      if (response.data.success) {
        message.success(`批量学习完成，更新了 ${response.data.data.updated} 条规则`)
        loadReport()
      }
    } catch (error) {
      message.error('批量学习失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <SettingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>规则学习配置</span>
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
      >
        <Tabs
          items={[
            {
              key: 'config',
              label: '学习配置',
              children: (
                <Form form={form} layout="vertical">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="trigger_mode"
                        label="触发模式"
                        help="规则学习的触发方式"
                      >
                        <Select>
                          <Select.Option value="auto">自动触发</Select.Option>
                          <Select.Option value="manual">手动触发</Select.Option>
                          <Select.Option value="batch">批量处理</Select.Option>
                          <Select.Option value="scheduled">定时任务</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="auto_approve_threshold"
                        label="自动批准阈值"
                        help="置信度超过此值自动批准"
                      >
                        <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="min_confidence_threshold"
                        label="最小置信度"
                        help="低于此值的规则不会被采纳"
                      >
                        <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="sample_limit"
                        label="样本数量限制"
                        help="学习时最多分析的样本数"
                      >
                        <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="min_occurrences"
                        label="最小出现次数"
                        help="规则至少出现次数才会被提取"
                      >
                        <InputNumber min={1} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="batch_learning_interval"
                        label="批量学习间隔（天）"
                        help="定时批量学习的周期"
                      >
                        <InputNumber min={1} max={365} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="require_human_review"
                        label="要求人工审核"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="enable_feedback_learning"
                        label="启用反馈学习"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="feedback_weight"
                        label="反馈权重"
                        help="用户反馈对置信度的影响权重"
                      >
                        <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="conflict_resolution_strategy"
                        label="冲突解决策略"
                      >
                        <Select>
                          <Select.Option value="highest_confidence">最高置信度</Select.Option>
                          <Select.Option value="manual_select">人工选择</Select.Option>
                          <Select.Option value="weighted">加权评分</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item>
                    <Space>
                      <Button type="primary" onClick={handleSave} loading={loading}>
                        保存配置
                      </Button>
                      <Button onClick={loadConfig}>
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'report',
              label: '学习报告',
              children: report ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="总规则数"
                          value={report.totalRules}
                          suffix="条"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="总应用次数"
                          value={report.totalApplications}
                          suffix="次"
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="成功率"
                          value={report.successRate}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card>
                        <Statistic
                          title="正确率"
                          value={report.correctRate}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="自动应用率"
                          value={report.autoApplyRate}
                          prefix={<CheckCircleOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="平均置信度"
                          value={report.avgConfidence}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Button
                          type="primary"
                          icon={<SyncOutlined />}
                          onClick={handleBatchLearning}
                          loading={loading}
                          block
                        >
                          触发批量学习
                        </Button>
                      </Card>
                    </Col>
                  </Row>

                  <Card title="学习建议">
                    <Space direction="vertical">
                      <Text>📊 统计周期: {report.period}</Text>
                      <Text>✅ 系统运行正常，规则学习效果良好</Text>
                      <Text>💡 建议: 继续观察自动应用率，如低于80%可适当降低阈值</Text>
                    </Space>
                  </Card>
                </Space>
              ) : (
                <Text>暂无学习报告</Text>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}

export default RuleLearningConfig
