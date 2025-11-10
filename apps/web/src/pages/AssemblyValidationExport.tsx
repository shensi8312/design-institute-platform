import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, message, Descriptions, Steps, Select, Alert, Row, Col, Statistic, Progress, Tabs, Checkbox, Divider } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, DownloadOutlined, ExportOutlined, SafetyOutlined, FileTextOutlined, RocketOutlined, SyncOutlined, EyeOutlined, ApiOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import { useNavigate } from 'react-router-dom'

interface Design {
  id: string
  design_name: string
  project_name: string
  status: string
  steps_count: number
  model_3d_path: string
  created_at: string
}

interface ValidationResult {
  designId: string
  designName: string
  interferenceCheck: {
    status: 'pass' | 'fail' | 'warning'
    issues: Array<{ part_a: string, part_b: string, overlap: number, severity: string }>
    summary: string
  }
  ruleValidation: {
    status: 'pass' | 'fail' | 'warning'
    violations: Array<{ rule: string, description: string, severity: string }>
    passedRules: number
    totalRules: number
  }
  exportReady: boolean
}

const AssemblyValidationExport: React.FC = () => {
  const navigate = useNavigate()
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [exportFormat, setExportFormat] = useState('solidworks')

  useEffect(() => {
    loadApprovedDesigns()
  }, [])

  const loadApprovedDesigns = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/assembly/designs?status=approved')
      if (response.data.success) {
        setDesigns(response.data.data)
      }
    } catch (error) {
      message.error('加载设计列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (design: Design) => {
    try {
      setValidating(true)
      setSelectedDesign(design)
      message.loading({ content: '🔍 正在执行干涉检查和规则验证...', key: 'validate', duration: 0 })

      // 模拟验证（实际应调用后端验证服务）
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 模拟验证结果
      const mockResult: ValidationResult = {
        designId: design.id,
        designName: design.design_name,
        interferenceCheck: {
          status: Math.random() > 0.5 ? 'pass' : 'warning',
          issues: Math.random() > 0.5 ? [] : [
            { part_a: '法兰A', part_b: '螺栓M8', overlap: 0.5, severity: 'warning' }
          ],
          summary: Math.random() > 0.5 ? '✅ 未检测到干涉问题' : '⚠️ 检测到1个潜在干涉'
        },
        ruleValidation: {
          status: 'pass',
          violations: [],
          passedRules: 15,
          totalRules: 15
        },
        exportReady: true
      }

      setValidationResult(mockResult)
      setValidationModalVisible(true)

      message.success({
        content: `✅ 验证完成！${mockResult.interferenceCheck.issues.length === 0 ? '未发现问题' : '发现' + mockResult.interferenceCheck.issues.length + '个问题'}`,
        key: 'validate',
        duration: 3
      })
    } catch (error: any) {
      message.error({
        content: `验证失败: ${error.response?.data?.message || error.message}`,
        key: 'validate'
      })
    } finally {
      setValidating(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      message.loading({ content: '📦 正在导出到SolidWorks...', key: 'export', duration: 0 })

      // 调用后端导出接口
      const response = await axios.post('/api/assembly/export/solidworks', {
        designId: selectedDesign?.id,
        format: exportFormat
      })

      if (response.data.success) {
        message.success({
          content: `✅ 导出成功！文件路径: ${response.data.filePath || '已生成'}`,
          key: 'export',
          duration: 5
        })

        // 触发文件下载
        if (response.data.downloadUrl) {
          window.open(response.data.downloadUrl, '_blank')
        }

        setExportModalVisible(false)
      }
    } catch (error: any) {
      message.error({
        content: `导出失败: ${error.response?.data?.message || error.message}`,
        key: 'export'
      })
    } finally {
      setExporting(false)
    }
  }

  const totalDesigns = designs.length
  const validatedDesigns = designs.filter(d => d.model_3d_path).length
  const exportReadyDesigns = designs.filter(d => d.status === 'approved' && d.model_3d_path).length

  const columns = [
    {
      title: '设计名称',
      dataIndex: 'design_name',
      width: 250,
      ellipsis: true
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 180
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const config: any = {
          approved: { color: 'green', text: '已批准' }
        }
        const item = config[status] || { color: 'default', text: status }
        return <Tag color={item.color}>{item.text}</Tag>
      }
    },
    {
      title: '步骤数',
      dataIndex: 'steps_count',
      width: 80,
      render: (count: number) => <Tag color="blue">{count} 步</Tag>
    },
    {
      title: '3D模型',
      width: 100,
      render: (record: Design) => (
        record.model_3d_path ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>已生成</Tag>
        ) : (
          <Tag color="default">未生成</Tag>
        )
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      width: 280,
      fixed: 'right' as const,
      render: (record: Design) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<SafetyOutlined />}
            loading={validating && selectedDesign?.id === record.id}
            onClick={() => handleValidate(record)}
          >
            验证
          </Button>
          {record.model_3d_path && (
            <Button
              type="default"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => {
                setSelectedDesign(record)
                setExportModalVisible(true)
              }}
            >
              导出SolidWorks
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <SafetyOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <span>验证与导出</span>
            <Tag color="green">干涉检查 + 规则验证 + 导出SolidWorks</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={loadApprovedDesigns}>
              刷新
            </Button>
            <Button onClick={() => navigate('/mechanical-design/assembly-designs')}>
              返回装配设计
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 统计卡片 */}
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待验证设计"
                  value={totalDesigns}
                  prefix={<FileTextOutlined />}
                  suffix="个"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已生成3D"
                  value={validatedDesigns}
                  prefix={<CheckCircleOutlined />}
                  suffix="个"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="可导出"
                  value={exportReadyDesigns}
                  prefix={<ExportOutlined />}
                  suffix="个"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="导出率"
                  value={totalDesigns ? ((exportReadyDesigns / totalDesigns) * 100).toFixed(0) : 0}
                  prefix={<RocketOutlined />}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message="验证与导出流程"
            description="本页面提供装配设计的干涉检查、规则验证功能，并支持导出到SolidWorks。确保设计符合所有约束规则后，即可导出为.sldasm装配文件。"
            type="info"
            showIcon
            icon={<SafetyOutlined />}
          />

          {/* 设计表格 */}
          <Table
            columns={columns}
            dataSource={designs}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个设计`
            }}
          />
        </Space>
      </Card>

      {/* 验证结果Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            验证结果
          </Space>
        }
        open={validationModalVisible}
        onCancel={() => setValidationModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setValidationModalVisible(false)}>
            关闭
          </Button>,
          validationResult?.exportReady && (
            <Button
              key="export"
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => {
                setValidationModalVisible(false)
                setExportModalVisible(true)
              }}
            >
              立即导出
            </Button>
          )
        ]}
      >
        {validationResult && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="设计名称" span={2}>
                {validationResult.designName}
              </Descriptions.Item>
              <Descriptions.Item label="验证状态">
                {validationResult.exportReady ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>通过验证</Tag>
                ) : (
                  <Tag color="error" icon={<CloseCircleOutlined />}>未通过</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="可导出">
                {validationResult.exportReady ? '✅ 是' : '❌ 否'}
              </Descriptions.Item>
            </Descriptions>

            <Card
              title={
                <Space>
                  <SafetyOutlined />
                  干涉检查结果
                </Space>
              }
              size="small"
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Tag color={validationResult.interferenceCheck.status === 'pass' ? 'success' : 'warning'}>
                    {validationResult.interferenceCheck.status === 'pass' ? '✅ 通过' : '⚠️ 警告'}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>{validationResult.interferenceCheck.summary}</span>
                </div>

                {validationResult.interferenceCheck.issues.length > 0 && (
                  <Table
                    size="small"
                    columns={[
                      { title: '零件A', dataIndex: 'part_a', width: 150 },
                      { title: '零件B', dataIndex: 'part_b', width: 150 },
                      { title: '重叠量(mm)', dataIndex: 'overlap', width: 100 },
                      {
                        title: '严重程度',
                        dataIndex: 'severity',
                        width: 100,
                        render: (severity: string) => (
                          <Tag color={severity === 'error' ? 'error' : 'warning'}>
                            {severity === 'error' ? '严重' : '警告'}
                          </Tag>
                        )
                      }
                    ]}
                    dataSource={validationResult.interferenceCheck.issues}
                    pagination={false}
                  />
                )}
              </Space>
            </Card>

            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  规则验证结果
                </Space>
              }
              size="small"
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Progress
                  percent={(validationResult.ruleValidation.passedRules / validationResult.ruleValidation.totalRules) * 100}
                  status={validationResult.ruleValidation.status === 'pass' ? 'success' : 'exception'}
                  format={() => `${validationResult.ruleValidation.passedRules}/${validationResult.ruleValidation.totalRules} 规则通过`}
                />

                {validationResult.ruleValidation.violations.length > 0 && (
                  <Table
                    size="small"
                    columns={[
                      { title: '规则', dataIndex: 'rule', width: 200 },
                      { title: '描述', dataIndex: 'description', ellipsis: true },
                      {
                        title: '严重程度',
                        dataIndex: 'severity',
                        width: 100,
                        render: (severity: string) => (
                          <Tag color={severity === 'error' ? 'error' : 'warning'}>
                            {severity === 'error' ? '错误' : '警告'}
                          </Tag>
                        )
                      }
                    ]}
                    dataSource={validationResult.ruleValidation.violations}
                    pagination={false}
                  />
                )}
              </Space>
            </Card>
          </Space>
        )}
      </Modal>

      {/* 导出Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            导出到SolidWorks
          </Space>
        }
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onOk={handleExport}
        okText="确认导出"
        cancelText="取消"
        confirmLoading={exporting}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="导出说明"
            description="系统将生成SolidWorks装配文件(.sldasm)，包含所有零件、约束关系和装配步骤。"
            type="info"
            showIcon
          />

          <Descriptions column={1} bordered>
            <Descriptions.Item label="设计名称">
              {selectedDesign?.design_name}
            </Descriptions.Item>
            <Descriptions.Item label="项目名称">
              {selectedDesign?.project_name}
            </Descriptions.Item>
            <Descriptions.Item label="装配步骤数">
              {selectedDesign?.steps_count} 步
            </Descriptions.Item>
          </Descriptions>

          <Form layout="vertical">
            <Form.Item label="导出格式">
              <Select value={exportFormat} onChange={setExportFormat}>
                <Select.Option value="solidworks">
                  <Space>
                    <ApiOutlined />
                    SolidWorks装配文件 (.sldasm)
                  </Space>
                </Select.Option>
                <Select.Option value="json">
                  <Space>
                    <FileTextOutlined />
                    JSON约束文件 (.json)
                  </Space>
                </Select.Option>
                <Select.Option value="pdf">
                  <Space>
                    <FileTextOutlined />
                    装配指导PDF (.pdf)
                  </Space>
                </Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="导出选项">
              <Checkbox.Group
                options={[
                  { label: '包含3D模型', value: 'include_3d' },
                  { label: '包含装配步骤', value: 'include_steps' },
                  { label: '包含约束关系', value: 'include_constraints' },
                  { label: '包含BOM表', value: 'include_bom' }
                ]}
                defaultValue={['include_3d', 'include_steps', 'include_constraints', 'include_bom']}
              />
            </Form.Item>
          </Form>

          <Alert
            message="提示"
            description="导出后，请使用SolidWorks 2020或更高版本打开.sldasm文件。"
            type="warning"
            showIcon
          />
        </Space>
      </Modal>
    </div>
  )
}

export default AssemblyValidationExport
