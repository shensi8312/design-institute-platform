import React, { useState } from 'react'
import { Card, Upload, Button, Table, Space, Tag, Modal, Form, Input, InputNumber, message, Descriptions, Collapse, Tabs, Steps, Row, Col, Statistic, Alert } from 'antd'
import { UploadOutlined, CheckOutlined, CloseOutlined, EditOutlined, DownloadOutlined, FileExcelOutlined, UnorderedListOutlined, ThunderboltOutlined, RobotOutlined, ExperimentOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'

interface AssemblyConstraint {
  id: string
  type: string
  entities: string[]
  parameters: any
  reasoning: string
  confidence: number
  ruleId: string
  review_status?: 'pending' | 'approved' | 'rejected'
}

interface InferResult {
  success: boolean
  taskId: string
  constraints: AssemblyConstraint[]
  explainability: {
    reasoning_path: string[]
    rules_fired: string[]
  }
  metadata: {
    partsCount: number
    constraintsCount: number
    rulesApplied: number
    llmEnhanced: boolean
  }
}

const AssemblyConstraintEngine: React.FC = () => {
  const navigate = useNavigate()
  const [bomFile, setBomFile] = useState<any>(null)
  const [drawingFiles, setDrawingFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [inferResult, setInferResult] = useState<InferResult | null>(null)
  const [constraints, setConstraints] = useState<AssemblyConstraint[]>([])
  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [currentConstraint, setCurrentConstraint] = useState<AssemblyConstraint | null>(null)
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)

  const handleInfer = async () => {
    if (!bomFile) {
      message.warning('请上传BOM文件')
      return
    }

    setLoading(true)
    setCurrentStep(0)

    try {
      setCurrentStep(1)

      const reader = new FileReader()
      reader.onload = async (e: any) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

          let headerRow = 0
          for (let i = 0; i < Math.min(3, rawData.length); i++) {
            const keywordMatches = rawData[i].filter((cell: any) =>
              cell && typeof cell === 'string' &&
              /NO|PN|Part.*Name|Vendor|Brand|Q[\`']?TY|Remark/i.test(cell)
            ).length
            if (keywordMatches >= 3) {
              headerRow = i + 1
              break
            }
          }

          const bomData = []
          for (let i = headerRow; i < rawData.length; i++) {
            const row = rawData[i]
            if (!row || row.length < 3) continue
            bomData.push({
              partNumber: row[1] || '',
              partName: row[2] || '',
              quantity: parseInt(row[5]) || 1
            })
          }

          if (bomData.length === 0) {
            message.error('BOM文件解析失败，未找到有效数据')
            setLoading(false)
            setCurrentStep(0)
            return
          }

          setCurrentStep(2)

          const learnResponse = await axios.post('/api/assembly/learn-from-bom-step', {
            bomData: bomData,
            stepFiles: []
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000
          })

          setCurrentStep(3)

          if (learnResponse.data.success) {
            const learnedRules = learnResponse.data.data || []

            const formattedConstraints = learnedRules.map((rule: any) => {
              const entities = rule.condition_logic || {}
              const part1 = entities.valve || entities.sensor || entities.pipe || entities.bolt || entities.gland || entities.part1 || ''
              const part2 = entities.gasket || entities.support || entities.fitting || entities.nut || entities.capPlug || entities.part2 || ''

              return {
                id: rule.id || rule.rule_id,
                type: rule.constraint_type || 'UNKNOWN',
                entities: [part1, part2],
                parameters: rule.action_template?.parameters || {},
                reasoning: rule.description || rule.name,
                confidence: parseFloat(rule.confidence_boost || rule.confidence || 0),
                ruleId: rule.rule_id,
                review_status: 'pending' as const
              }
            })

            setConstraints(formattedConstraints)
            setInferResult({
              success: true,
              taskId: Date.now().toString(),
              constraints: formattedConstraints,
              explainability: {
                reasoning_path: [`解析BOM文件: ${bomData.length} 个零件`, `AI学习装配规则`, `生成 ${formattedConstraints.length} 个装配约束`],
                rules_fired: learnedRules.map((r: any) => r.rule_id)
              },
              metadata: {
                partsCount: bomData.length,
                constraintsCount: formattedConstraints.length,
                rulesApplied: formattedConstraints.length,
                llmEnhanced: true
              }
            })

            message.success(`✅ 学习完成！识别到 ${formattedConstraints.length} 个装配约束`)
          } else {
            message.error(learnResponse.data.message || '学习失败')
          }
        } catch (error: any) {
          message.error(`学习失败: ${error.response?.data?.message || error.message || '请检查文件格式'}`)
          setCurrentStep(0)
        } finally {
          setLoading(false)
        }
      }

      reader.onerror = () => {
        message.error('文件读取失败')
        setLoading(false)
        setCurrentStep(0)
      }

      reader.readAsArrayBuffer(bomFile)
    } catch (error: any) {
      setCurrentStep(0)
      message.error(`学习失败: ${error.message || '请检查文件格式'}`)
      setLoading(false)
    }
  }

  const handleReview = (constraint: AssemblyConstraint, action: 'approve' | 'reject' | 'modify') => {
    setCurrentConstraint(constraint)

    if (action === 'approve') {
      submitReview(constraint.id, 'approve', '约束合理', constraint.parameters)
    } else if (action === 'reject') {
      submitReview(constraint.id, 'reject', '约束不合理', {})
    } else {
      form.setFieldsValue({
        comment: '',
        ...constraint.parameters
      })
      setReviewModalVisible(true)
    }
  }

  const submitReview = async (constraintId: string, action: string, comment: string, modifications: any) => {
    try {
      const response = await axios.post('/api/assembly/review', {
        constraintId,
        action,
        comment,
        modifications
      })

      if (response.data.success) {
        message.success(response.data.message)
        setConstraints(prev => prev.map(c =>
          c.id === constraintId
            ? { ...c, review_status: action === 'approve' || action === 'modify' ? 'approved' : 'rejected', parameters: modifications }
            : c
        ))
      }
    } catch (error) {
      message.error('审核失败')
    }
  }

  const handleModifySubmit = async () => {
    try {
      const values = await form.validateFields()
      const { comment, ...params } = values

      if (currentConstraint) {
        await submitReview(currentConstraint.id, 'modify', comment, params)
        setReviewModalVisible(false)
      }
    } catch (error) {
      message.error('提交修改失败')
    }
  }

  const handleConvertToRule = async (constraint: AssemblyConstraint) => {
    try {
      message.loading({ content: '正在转换为规则...', key: 'convert' })

      const response = await axios.post('/api/assembly/constraints/convert-to-rule', {
        constraint: {
          id: constraint.id,
          type: constraint.type,
          entities: constraint.entities,
          parameters: constraint.parameters,
          reasoning: constraint.reasoning,
          confidence: constraint.confidence
        }
      })

      if (response.data.success) {
        message.success({ content: `✅ 已成功转换为规则！规则ID: ${response.data.ruleId}`, key: 'convert', duration: 3 })
      } else {
        message.error({ content: response.data.message || '转换失败', key: 'convert' })
      }
    } catch (error: any) {
      message.error({ content: error.response?.data?.message || '转换失败', key: 'convert' })
    }
  }

  const handleGenerateDesign = () => {
    if (!inferResult?.taskId) {
      message.error('请先完成样本学习')
      return
    }
    message.success('🎯 学习完成！现在可以进入模块2进行规则推理')
    setTimeout(() => {
      navigate('/mechanical-design/assembly-rules')
    }, 1500)
  }

  const handleReset = () => {
    Modal.confirm({
      title: '确认重新学习？',
      content: '当前学习结果将被清空，确定要重新开始吗？',
      onOk: () => {
        setBomFile(null)
        setDrawingFiles([])
        setInferResult(null)
        setConstraints([])
        setCurrentStep(0)
        message.success('已重置，可以重新上传文件学习')
      }
    })
  }

  const handleDeleteConstraint = async (constraintId: string) => {
    try {
      await axios.delete(`/api/assembly/constraints/${constraintId}`)
      setConstraints(prev => prev.filter(c => c.id !== constraintId))
      message.success('约束已删除')
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleExportConstraints = () => {
    const dataStr = JSON.stringify(constraints, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `constraints_${Date.now()}.json`
    a.click()
    window.URL.revokeObjectURL(url)
    message.success('约束数据已导出')
  }

  const handleBatchApprove = () => {
    const pendingConstraints = constraints.filter(c => c.review_status === 'pending')
    if (pendingConstraints.length === 0) {
      message.warning('没有待审核的约束')
      return
    }

    Modal.confirm({
      title: '批量批准',
      content: `确定要批准全部 ${pendingConstraints.length} 个待审核约束吗？`,
      onOk: async () => {
        for (const constraint of pendingConstraints) {
          await submitReview(constraint.id, 'approve', '批量批准', constraint.parameters)
        }
        message.success(`✅ 已批准 ${pendingConstraints.length} 个约束`)
      }
    })
  }

  const constraintColumns = [
    {
      title: '状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'orange', text: '待审核' },
          approved: { color: 'green', text: '已批准' },
          rejected: { color: 'red', text: '已拒绝' }
        }
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '约束类型',
      dataIndex: 'type',
      width: 120,
      render: (type: string) => <Tag color="blue">{type}</Tag>
    },
    {
      title: '零件对',
      dataIndex: 'entities',
      width: 250,
      render: (entities: string[]) => (
        <Space direction="vertical" size={0}>
          <span>🔹 {entities[0]}</span>
          <span>🔹 {entities[1]}</span>
        </Space>
      )
    },
    {
      title: 'AI推理依据',
      dataIndex: 'reasoning',
      ellipsis: true
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: (confidence: number) => (
        <Tag color={confidence >= 0.8 ? 'green' : confidence >= 0.6 ? 'orange' : 'red'}>
          {(confidence * 100).toFixed(0)}%
        </Tag>
      ),
      sorter: (a: AssemblyConstraint, b: AssemblyConstraint) => a.confidence - b.confidence
    },
    {
      title: '操作',
      width: 350,
      fixed: 'right' as const,
      render: (record: AssemblyConstraint) => {
        if (record.review_status === 'pending') {
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleReview(record, 'approve')}
              >
                批准
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleReview(record, 'modify')}
              >
                修改
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReview(record, 'reject')}
              >
                拒绝
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteConstraint(record.id)}
              >
                删除
              </Button>
            </Space>
          )
        }
        if (record.review_status === 'approved') {
          return (
            <Space size="small">
              <Tag color="green">✅ 已批准</Tag>
              <Button
                type="primary"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => handleConvertToRule(record)}
              >
                转为规则
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteConstraint(record.id)}
              >
                删除
              </Button>
            </Space>
          )
        }
        return (
          <Space size="small">
            <Tag color="red">❌ 已拒绝</Tag>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteConstraint(record.id)}
            >
              删除
            </Button>
          </Space>
        )
      }
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ExperimentOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>模块1：样本学习</span>
            <Tag color="blue">BOM解析 + AI约束学习</Tag>
          </Space>
        }
        extra={
          <Button
            icon={<UnorderedListOutlined />}
            onClick={() => navigate('/mechanical-design/assembly-tasks')}
          >
            查看历史学习任务
          </Button>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 流程说明 */}
          <Card type="inner" title="📖 学习流程" size="small">
            <Steps
              current={currentStep}
              items={[
                {
                  title: '上传样本',
                  description: 'BOM表 + PDF图纸',
                  icon: <UploadOutlined />
                },
                {
                  title: 'BOM解析',
                  description: '提取零件信息',
                  icon: <FileExcelOutlined />
                },
                {
                  title: 'AI学习',
                  description: '识别装配关系',
                  icon: <RobotOutlined />
                },
                {
                  title: '生成约束',
                  description: '输出到知识库',
                  icon: <CheckOutlined />
                }
              ]}
            />
          </Card>

          {/* 文件上传区 */}
          <Card
            type="inner"
            title="📁 样本文件上传"
            extra={inferResult && (
              <Button
                icon={<CloseOutlined />}
                onClick={handleReset}
                danger
              >
                清空重新学习
              </Button>
            )}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Upload
                accept=".xlsx,.xls,.csv"
                maxCount={1}
                beforeUpload={(file) => {
                  setBomFile(file)
                  return false
                }}
                onRemove={() => setBomFile(null)}
                disabled={loading}
              >
                <Button icon={<FileExcelOutlined />} size="large" disabled={loading}>
                  ① 上传BOM表 (Excel/CSV) *必填
                </Button>
              </Upload>

              <Upload
                accept=".pdf,.dwg,.png,.jpg,.step,.stp,.STEP,.STP"
                multiple
                maxCount={10}
                beforeUpload={(file) => {
                  setDrawingFiles(prev => [...prev, file])
                  return false
                }}
                onRemove={(file) => {
                  setDrawingFiles(prev => prev.filter(f => f.uid !== file.uid))
                }}
                disabled={loading}
              >
                <Button icon={<UploadOutlined />} size="large" disabled={loading}>
                  ② 上传装配图纸/STEP模型 (PDF/CAD/STEP) 可选
                </Button>
              </Upload>

              <Alert
                message="💡 提示"
                description="上传STEP文件可自动提取：装配关系、孔方向约束、空间位置、配合类型"
                type="info"
                showIcon
                style={{ marginTop: 8 }}
              />

              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleInfer}
                disabled={!bomFile && drawingFiles.length === 0}
                icon={<RobotOutlined />}
                block
                style={{ height: 50, fontSize: 16 }}
              >
                🚀 开始AI学习
              </Button>
            </Space>
          </Card>

          {/* 学习结果 */}
          {inferResult && (
            <>
              {/* 统计卡片 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="零件数量"
                      value={inferResult.metadata.partsCount}
                      prefix={<FileExcelOutlined />}
                      suffix="个"
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="识别约束"
                      value={inferResult.metadata.constraintsCount}
                      prefix={<ThunderboltOutlined />}
                      suffix="个"
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="应用规则"
                      value={inferResult.metadata.rulesApplied}
                      prefix={<CheckOutlined />}
                      suffix="条"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="AI增强"
                      value={inferResult.metadata.llmEnhanced ? '已启用' : '未启用'}
                      prefix={<RobotOutlined />}
                      valueStyle={{ color: inferResult.metadata.llmEnhanced ? '#cf1322' : '#999' }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* 约束列表 */}
              <Card
                type="inner"
                title="🎯 学习到的装配约束"
                extra={
                  <Space>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={handleExportConstraints}
                    >
                      导出数据
                    </Button>
                    <Button
                      icon={<CheckOutlined />}
                      onClick={handleBatchApprove}
                    >
                      批量批准
                    </Button>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleGenerateDesign}
                    >
                      进入下一步：规则库管理
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={constraintColumns}
                  dataSource={constraints}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1400 }}
                />
              </Card>

              {/* 学习路径 */}
              <Card type="inner" title="🧠 AI学习路径" size="small">
                <Collapse>
                  <Collapse.Panel header="查看详细推理过程" key="1">
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      {(inferResult.explainability.reasoning_path || []).map((step, idx) => (
                        <Card key={idx} size="small">
                          <Space>
                            <Tag color="blue">{idx + 1}</Tag>
                            <span>{step}</span>
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  </Collapse.Panel>
                </Collapse>
              </Card>
            </>
          )}
        </Space>
      </Card>

      {/* 修改约束Modal */}
      <Modal
        title="修改约束参数"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleModifySubmit}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="comment" label="修改原因">
            <Input.TextArea rows={2} placeholder="请输入修改原因" />
          </Form.Item>
          {currentConstraint && Object.keys(currentConstraint.parameters).map(key => (
            <Form.Item key={key} name={key} label={key} initialValue={currentConstraint.parameters[key]}>
              {typeof currentConstraint.parameters[key] === 'number' ? (
                <InputNumber style={{ width: '100%' }} />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

export default AssemblyConstraintEngine
