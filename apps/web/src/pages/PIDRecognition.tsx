import React, { useState } from 'react'
import {
  Upload,
  Button,
  Image,
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
  Tooltip,
  Modal,
  Form,
  Input,
  Select,
  Progress,
  message
} from 'antd'
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  WarningOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import axios from '../utils/axios'

interface Component {
  tag_number: string
  symbol_type: string
  position: [number, number]
  confidence: number
  parameters: any
  source: string
  matched_part?: string
  user_confirmed?: boolean
}

const PIDRecognition: React.FC = () => {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [visualizationUrl, setVisualizationUrl] = useState<string | null>(null)
  const [graphUrl, setGraphUrl] = useState<string | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/pid/recognize?method=qwenvl', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success) {
        setResult(response.data.data)

        // 获取可视化URL（需要拼接完整URL，不经过/api代理）
        const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
        const baseUrl = API_BASE.replace('/api', '') // 去掉/api后缀

        const urls = response.data.data.visualization_urls || []
        if (urls.length > 0) {
          setVisualizationUrl(`${baseUrl}${urls[0]}`) // 第一张是标注图
          if (urls.length > 1) {
            setGraphUrl(`${baseUrl}${urls[1]}`) // 第二张是拓扑图
          }
        }

        message.success(`识别完成! 检测到 ${response.data.data.components.length} 个组件`)
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '识别失败')
      console.error('识别失败:', error)
    } finally {
      setUploading(false)
    }
  }

  // 计算识别质量指标
  const getQualityMetrics = () => {
    if (!result) return null

    const totalComponents = result.components.length
    const avgConfidence = totalComponents > 0
      ? result.components.reduce((sum: number, c: Component) => sum + c.confidence, 0) / totalComponents
      : 0

    // 根据图纸尺寸估算预期组件数
    const expectedComponents = 25 // 简化版,实际应该基于图纸分析
    const recallRate = totalComponents / expectedComponents

    return {
      totalComponents,
      avgConfidence: (avgConfidence * 100).toFixed(0),
      recallRate: (recallRate * 100).toFixed(0),
      expectedComponents,
      hasIsolatedNodes: result.graph_analysis?.connectivity?.isolated_nodes?.length > 0,
      violationCount: result.graph_analysis?.validation?.num_violations || 0,
      pipelineCount: result.graph_analysis?.pipelines?.length || 0,
      edgeCount: result.graph_analysis?.graph?.edges || 0
    }
  }

  const metrics = getQualityMetrics()

  // 组件类型中文映射
  const typeMapping: Record<string, { label: string; color: string; parts: string[] }> = {
    'indicator': {
      label: '压力表/仪表',
      color: 'cyan',
      parts: ['pressure_gauge_DN50.skp', 'temperature_gauge_DN50.skp', 'flow_meter_DN50.skp']
    },
    'valve': {
      label: '阀门',
      color: 'orange',
      parts: ['gate_valve_DN50.skp', 'ball_valve_DN50.skp', 'control_valve_DN50.skp']
    },
    'equipment': {
      label: '设备/容器',
      color: 'purple',
      parts: ['tank_vertical_1000L.skp', 'heat_exchanger.skp', 'separator.skp']
    },
    'pump_or_instrument': {
      label: '泵/仪表',
      color: 'green',
      parts: ['centrifugal_pump.skp', 'screw_pump.skp']
    },
    'filter_or_controller': {
      label: '过滤器/控制器',
      color: 'blue',
      parts: ['filter_cartridge.skp', 'pid_controller.skp']
    },
    'manual_valve': {
      label: '手动阀',
      color: 'gold',
      parts: ['manual_valve_DN50.skp']
    },
    'tank_or_equipment': {
      label: '储罐/设备',
      color: 'magenta',
      parts: ['storage_tank.skp', 'reactor.skp']
    }
  }

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '位号',
      dataIndex: 'tag_number',
      key: 'tag_number',
      width: 120,
      render: (tag: string, record: Component) => (
        <Space>
          <Tag color={record.user_confirmed ? 'success' : 'default'}>
            {tag}
          </Tag>
          {record.user_confirmed && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'symbol_type',
      key: 'symbol_type',
      width: 150,
      render: (type: string) => {
        const info = typeMapping[type] || { label: type, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '位置坐标',
      dataIndex: 'position',
      key: 'position',
      width: 120,
      render: (pos: [number, number]) => pos ? `(${pos[0]}, ${pos[1]})` : '-'
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
      render: (conf: number) => (
        <Progress
          percent={Math.round(conf * 100)}
          size="small"
          status={conf > 0.8 ? 'success' : conf > 0.6 ? 'normal' : 'exception'}
        />
      )
    },
    {
      title: '匹配零件',
      dataIndex: 'matched_part',
      key: 'matched_part',
      width: 200,
      render: (_: any, record: Component) => {
        const parts = typeMapping[record.symbol_type]?.parts || []
        return parts.length > 0 ? (
          <Select
            defaultValue={parts[0]}
            style={{ width: '100%' }}
            size="small"
            placeholder="选择零件"
          >
            {parts.map(part => (
              <Select.Option key={part} value={part}>{part}</Select.Option>
            ))}
          </Select>
        ) : <Tag>未匹配</Tag>
      }
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => {
        const sourceMap: Record<string, { label: string; color: string }> = {
          'ocr': { label: 'OCR', color: 'blue' },
          'symbol_detection': { label: '符号检测', color: 'green' },
          'symbol_with_text': { label: 'OCR+符号', color: 'cyan' }
        }
        const info = sourceMap[source] || { label: source, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Component) => (
        <Space>
          <Tooltip title="确认">
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              size="small"
              style={{ color: record.user_confirmed ? '#52c41a' : undefined }}
              onClick={() => handleConfirm(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<CloseCircleOutlined />}
              size="small"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  const handleConfirm = (component: Component) => {
    const updated = result.components.map((c: Component) =>
      c.tag_number === component.tag_number
        ? { ...c, user_confirmed: true }
        : c
    )
    setResult({ ...result, components: updated })
    message.success(`已确认 ${component.tag_number}`)
  }

  const handleEdit = (component: Component) => {
    setSelectedComponent(component)
    form.setFieldsValue({
      tag_number: component.tag_number,
      symbol_type: component.symbol_type,
      matched_part: typeMapping[component.symbol_type]?.parts[0]
    })
    setEditModalVisible(true)
  }

  const handleDelete = (component: Component) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除组件 ${component.tag_number} 吗?`,
      onOk: () => {
        const updated = result.components.filter((c: Component) =>
          c.tag_number !== component.tag_number
        )
        setResult({ ...result, components: updated })
        message.success('删除成功')
      }
    })
  }

  const handleSaveEdit = () => {
    form.validateFields().then(values => {
      const updated = result.components.map((c: Component) =>
        c.tag_number === selectedComponent?.tag_number
          ? { ...c, ...values }
          : c
      )
      setResult({ ...result, components: updated })
      setEditModalVisible(false)
      message.success('更新成功')
    })
  }

  const handleGenerateAssembly = async () => {
    const confirmedCount = result.components.filter((c: Component) => c.user_confirmed).length
    const totalCount = result.components.length

    if (confirmedCount < totalCount * 0.5) {
      Modal.warning({
        title: '确认组件不足',
        content: `仅确认了 ${confirmedCount}/${totalCount} 个组件。建议至少确认50%以上再生成装配。`,
      })
      return
    }

    try {
      // 1. 先保存识别结果
      message.loading({ content: '正在保存识别结果...', key: 'save' })

      const saveResponse = await axios.post('/api/pid/save', {
        file_name: result.file_name || 'pid_diagram.pdf',
        file_path: result.file_path || '',
        components: result.components,
        connections: result.connections || [],
        visualization_urls: result.visualization_urls || [],
        page_count: result.page_count || 1
      })

      if (!saveResponse.data.success) {
        throw new Error('保存失败')
      }

      const pidResultId = saveResponse.data.data.id
      message.success({ content: '✅ 识别结果已保存', key: 'save' })

      // 2. 转为装配任务
      message.loading({ content: '正在生成装配任务...', key: 'assembly' })

      const assemblyResponse = await axios.post(
        `/api/pid/results/${pidResultId}/to-assembly`,
        {
          taskName: `PID装配-${result.file_name || 'Untitled'}`,
          description: `基于PID识别的${totalCount}个组件生成装配任务`
        }
      )

      if (!assemblyResponse.data.success) {
        throw new Error('生成装配任务失败')
      }

      const { taskId, componentCount, constraintsCount } = assemblyResponse.data.data

      message.success({
        content: `✅ 装配任务创建成功！组件:${componentCount}, 约束:${constraintsCount}`,
        key: 'assembly',
        duration: 3
      })

      // 3. 跳转到装配任务列表
      Modal.success({
        title: '装配任务创建成功',
        content: (
          <div>
            <p>✅ 已识别 {componentCount} 个组件</p>
            <p>✅ 已推理 {constraintsCount} 个装配约束</p>
            <p>即将跳转到装配任务列表...</p>
          </div>
        ),
        onOk: () => {
          window.location.href = `/assembly/tasks?highlight=${taskId}`
        }
      })

    } catch (error: any) {
      message.error({
        content: error.response?.data?.message || '生成装配任务失败',
        key: 'assembly'
      })
      console.error('生成装配失败:', error)
    }
  }

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card
        title="🔍 PID图纸识别与验证"
        style={{ marginBottom: 24 }}
      >
        <Upload.Dragger
          accept=".pdf,.png,.jpg,.jpeg"
          beforeUpload={(file) => {
            handleUpload(file)
            return false
          }}
          showUploadList={false}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽上传PID图纸</p>
          <p className="ant-upload-hint">支持 PDF, PNG, JPG 格式,最大50MB</p>
        </Upload.Dragger>

        {uploading && (
          <Alert
            message="正在识别中,请稍候..."
            description="正在进行符号检测、OCR识别和拓扑分析"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {result && (
        <>
          {/* 识别质量报告 */}
          {metrics && (
            <Card
              title="📊 识别质量报告"
              style={{ marginBottom: 24 }}
              extra={<Tag color="processing">自动生成</Tag>}
            >
              <Row gutter={16}>
                <Col span={4}>
                  <Statistic
                    title="检测组件数"
                    value={metrics.totalComponents}
                    suffix="个"
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="平均置信度"
                    value={metrics.avgConfidence}
                    suffix="%"
                    valueStyle={{ color: parseInt(metrics.avgConfidence) > 70 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="预估召回率"
                    value={metrics.recallRate}
                    suffix="%"
                    valueStyle={{ color: parseInt(metrics.recallRate) > 70 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="连接数"
                    value={metrics.edgeCount}
                    suffix="条"
                    valueStyle={{ color: metrics.edgeCount > 0 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="管线路径"
                    value={metrics.pipelineCount}
                    suffix="条"
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="规则违规"
                    value={metrics.violationCount}
                    suffix="条"
                    valueStyle={{ color: metrics.violationCount > 0 ? '#cf1322' : '#3f8600' }}
                  />
                </Col>
              </Row>

              <div style={{ marginTop: 16 }}>
                {metrics.edgeCount === 0 && (
                  <Alert
                    message="⚠️ 未检测到管道连接"
                    description={`检测到${metrics.totalComponents}个设备，但没有找到它们之间的管道连接。这可能是因为：1) 图纸中管道线条太细 2) 设备距离太远 3) 需要YOLO模型提升检测精度。您可以在下方手动添加连接关系。`}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                )}

                {metrics.hasIsolatedNodes && metrics.edgeCount > 0 && (
                  <Alert
                    message="检测到孤立组件"
                    description="部分组件未连接到管线,可能是连接识别失败或图纸问题"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                )}

                {parseInt(metrics.recallRate) < 50 && (
                  <Alert
                    message={`检测覆盖率: ${metrics.recallRate}%`}
                    description={
                      <div>
                        <p>实际检测到 <strong>{metrics.totalComponents}个</strong> 设备，预期约 <strong>{metrics.expectedComponents}个</strong>。</p>
                        <p style={{ marginBottom: 0 }}>
                          <strong>提升建议:</strong>
                          1) 使用更高分辨率的PID图纸
                          2) 标注数据训练YOLO模型
                          3) 手动补充遗漏的设备
                        </p>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                )}

                {metrics.violationCount > 0 && (
                  <Alert
                    message={`发现 ${metrics.violationCount} 条规则违规`}
                    description="部分组件不符合P&ID标准,请在下方组件列表中查看详情"
                    type="info"
                    showIcon
                  />
                )}
              </div>
            </Card>
          )}

          <Row gutter={16}>
            {/* 左侧: 可视化标注图 */}
            <Col span={12}>
              <Card
                title={<><EyeOutlined /> AI识别可视化</>}
                style={{ marginBottom: 16 }}
              >
                <Alert
                  message={`AI识别结果：检测到 ${result.components.length} 个设备组件${result.legend && result.legend.length > 0 ? `，图例符号 ${result.legend.length} 个定义` : ''}`}
                  description={
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>颜色标注说明：</strong>
                      </div>
                      <Space wrap>
                        {(() => {
                          // 统计实际识别到的组件类型
                          const typeMap: { [key: string]: { color: string; icon: string; label: string; count: number } } = {
                            'indicator': { color: 'cyan', icon: '🔵', label: '仪表(PI/TI/FI)', count: 0 },
                            'valve': { color: 'orange', icon: '🟠', label: '阀门', count: 0 },
                            'manual_valve': { color: 'gold', icon: '🟡', label: '手动阀', count: 0 },
                            'pump_or_instrument': { color: 'purple', icon: '🟣', label: '泵/设备', count: 0 },
                            'tank_or_equipment': { color: 'purple', icon: '🟣', label: '容器/设备', count: 0 },
                            'filter_or_controller': { color: 'green', icon: '🟢', label: '控制器/过滤器', count: 0 },
                            'flow_meter': { color: 'magenta', icon: '🟪', label: '流量计', count: 0 }
                          }

                          // 统计各类型数量
                          result.components.forEach((comp: any) => {
                            const type = comp.symbol_type || 'unknown'
                            if (typeMap[type]) {
                              typeMap[type].count++
                            }
                          })

                          // 只显示存在的类型
                          return Object.entries(typeMap)
                            .filter(([_, info]) => info.count > 0)
                            .map(([type, info]) => (
                              <Tag key={type} color={info.color}>
                                {info.icon} {info.label} ({info.count}个)
                              </Tag>
                            ))
                        })()}
                      </Space>
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                        每个设备旁边的白色标签显示自动分配的位号(如PI-001, V-001等)
                      </div>
                    </div>
                  }
                  type="info"
                  style={{ marginBottom: 16 }}
                />

                {visualizationUrl ? (
                  <Image
                    src={visualizationUrl}
                    alt="PID识别标注图"
                    style={{ width: '100%' }}
                    preview={{
                      mask: <div>点击查看大图</div>
                    }}
                  />
                ) : (
                  <Alert message="暂无可视化图片" type="warning" />
                )}
              </Card>

              {/* 拓扑图 */}
              {graphUrl && (
                <Card title="📈 设备连接关系图">
                  <Alert
                    message="关系图谱说明"
                    description="这张图展示了所有检测到的设备及它们之间的管道连接关系，圆圈代表设备，线条代表管道连接"
                    type="info"
                    style={{ marginBottom: 16 }}
                  />
                  <Image
                    src={graphUrl}
                    alt="设备连接关系图"
                    style={{ width: '100%' }}
                    preview={{
                      mask: <div>点击查看大图</div>
                    }}
                  />
                </Card>
              )}
            </Col>

            {/* 右侧: 组件列表 */}
            <Col span={12}>
              <Card
                title={`🔧 识别组件列表 (共 ${result.components.length} 个)`}
                extra={
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => message.info('手动添加功能开发中')}
                    >
                      手动添加
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => message.info('导出功能开发中')}
                    >
                      导出清单
                    </Button>
                  </Space>
                }
              >
                <Table
                  dataSource={result.components}
                  columns={columns}
                  rowKey="tag_number"
                  pagination={{ pageSize: 10 }}
                  size="small"
                  scroll={{ y: 500, x: 1000 }}
                />
              </Card>

              {/* 底部操作按钮 */}
              <Card style={{ marginTop: 16 }}>
                <Space style={{ width: '100%', justifyContent: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CheckCircleOutlined />}
                    onClick={handleGenerateAssembly}
                  >
                    ✓ 确认识别结果,生成装配
                  </Button>
                  <Button
                    size="large"
                    icon={<ReloadOutlined />}
                    onClick={() => setResult(null)}
                  >
                    重新上传
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* 编辑组件模态框 */}
      <Modal
        title="编辑组件"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveEdit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="位号"
            name="tag_number"
            rules={[{ required: true, message: '请输入位号' }]}
          >
            <Input placeholder="例如: PI-201" />
          </Form.Item>
          <Form.Item
            label="类型"
            name="symbol_type"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select>
              {Object.entries(typeMapping).map(([key, value]) => (
                <Select.Option key={key} value={key}>{value.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="匹配零件" name="matched_part">
            <Select placeholder="选择零件模型">
              {(typeMapping[selectedComponent?.symbol_type || '']?.parts || []).map(part => (
                <Select.Option key={part} value={part}>{part}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PIDRecognition
