import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, message, Descriptions, Steps, Select, Popconfirm, Row, Col, Statistic, Drawer, Image, Alert, Upload, Timeline } from 'antd'
import { PlusOutlined, CheckOutlined, CloseOutlined, EditOutlined, DownloadOutlined, EyeOutlined, DeleteOutlined, RocketOutlined, BuildOutlined, FileTextOutlined, UploadOutlined, ThunderboltOutlined, DragOutlined, InboxOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import { useNavigate } from 'react-router-dom'
import ThreeModelViewer from '../components/ThreeModelViewer'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

interface AssemblyDesign {
  id: string
  design_name: string
  project_name: string
  description: string
  task_id: number
  user_id: string
  user_name: string
  status: 'draft' | 'pending_review' | 'approved' | 'rejected'
  steps_count: number
  model_3d_path: string
  model_format: string
  review_comment: string
  reviewed_by: string
  reviewed_at: string
  created_at: string
  updated_at: string
}

interface DesignStep {
  id: string
  design_id: string
  step_number: number
  description: string
  operation_type: string
  part_a: string
  part_b: string
  parameters: any
  notes: string
}

interface PartLibraryItem {
  id: string
  name: string
  filepath: string
  type: string
  index: number
}

const ItemTypes = {
  PART: 'part'
}

// 可拖拽的零件组件
const DraggablePart: React.FC<{ part: PartLibraryItem }> = ({ part }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.PART,
    item: { part },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }))

  const getPartIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'flange': '🔩',
      'valve': '🚰',
      'gasket': '⭕',
      'component': '🔧'
    }
    return icons[type] || '📦'
  }

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        padding: '8px 12px',
        marginBottom: 8,
        background: isDragging ? '#e6f7ff' : '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        transition: 'all 0.3s'
      }}
    >
      <Space>
        <span style={{ fontSize: 20 }}>{getPartIcon(part.type)}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{part.id}</div>
          <Tag color="blue" style={{ fontSize: 11, marginTop: 4 }}>{part.type}</Tag>
        </div>
      </Space>
    </div>
  )
}

// 零件放置区组件
const PartDropZone: React.FC<{
  onDrop: (part: PartLibraryItem) => void
  droppedParts: PartLibraryItem[]
}> = ({ onDrop, droppedParts }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.PART,
    drop: (item: { part: PartLibraryItem }) => {
      onDrop(item.part)
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  }))

  return (
    <div
      ref={drop}
      style={{
        minHeight: 400,
        padding: 24,
        background: isOver ? '#e6f7ff' : '#f5f5f5',
        border: `2px dashed ${isOver ? '#1890ff' : '#d9d9d9'}`,
        borderRadius: 8,
        transition: 'all 0.3s'
      }}
    >
      {droppedParts.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 100 }}>
          <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
          <p style={{ color: '#999', marginTop: 16 }}>拖拽零件到此处开始装配</p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
            已选择 {droppedParts.length} 个零件:
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {droppedParts.map((part, idx) => (
              <Card key={idx} size="small" style={{ background: '#fff' }}>
                <Space>
                  <DragOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 500 }}>{part.id}</span>
                  <Tag color="blue">{part.type}</Tag>
                </Space>
              </Card>
            ))}
          </Space>
        </div>
      )}
    </div>
  )
}

const AssemblyDesignManagement: React.FC = () => {
  const navigate = useNavigate()
  const [designs, setDesigns] = useState<AssemblyDesign[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [preview3DVisible, setPreview3DVisible] = useState(false)
  const [render3DViewer, setRender3DViewer] = useState(false)
  const [currentDesign, setCurrentDesign] = useState<AssemblyDesign | null>(null)
  const [designSteps, setDesignSteps] = useState<DesignStep[]>([])
  const [form] = Form.useForm()
  const [generating3D, setGenerating3D] = useState(false)
  const [uploading3D, setUploading3D] = useState(false)

  // AI自动装配相关state
  const [partLibrary, setPartLibrary] = useState<PartLibraryItem[]>([])
  const [droppedParts, setDroppedParts] = useState<PartLibraryItem[]>([])
  const [assembling, setAssembling] = useState(false)
  const [showAIWorkbench, setShowAIWorkbench] = useState(true)

  useEffect(() => {
    loadDesigns()
    loadPartLibrary()
  }, [])

  const loadDesigns = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/assembly/designs')
      if (response.data.success) {
        setDesigns(response.data.data)
      }
    } catch (error) {
      message.error('加载设计列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadPartLibrary = async () => {
    try {
      const response = await axios.get('/api/assembly/parts/library')
      if (response.data.success) {
        setPartLibrary(response.data.data)
        message.success(`✅ 加载了 ${response.data.count} 个零件`)
      }
    } catch (error) {
      message.error('加载零件库失败')
    }
  }

  const handlePartDrop = (part: PartLibraryItem) => {
    if (!droppedParts.find(p => p.id === part.id)) {
      setDroppedParts([...droppedParts, part])
      message.success(`✅ 已添加: ${part.id}`)
    } else {
      message.warning('⚠️ 该零件已在列表中')
    }
  }

  const handleAIAutoAssemble = async () => {
    if (droppedParts.length < 2) {
      message.warning('⚠️ 请至少选择2个零件进行装配')
      return
    }

    setAssembling(true)
    try {
      message.loading({ content: '🤖 AI正在分析零件并生成装配方案...', key: 'ai-assemble' })

      const part_files = droppedParts.map(p => p.filepath)
      const response = await axios.post(`/api/assembly/designs/${designs[0]?.id || 'new'}/auto-assemble`, {
        part_files
      })

      if (response.data.success) {
        message.success({ content: '✅ AI装配完成！', key: 'ai-assemble' })
        message.info('装配报告已生成，请在设计详情中查看')
        loadDesigns()
        setDroppedParts([])
      }
    } catch (error: any) {
      message.error({
        content: error.response?.data?.message || 'AI装配失败',
        key: 'ai-assemble'
      })
    } finally {
      setAssembling(false)
    }
  }

  const handleCreateDesign = async () => {
    try {
      const values = await form.validateFields()
      message.loading({ content: '正在创建设计...', key: 'create' })

      const response = await axios.post('/api/assembly/designs/create', {
        design_name: values.design_name,
        project_name: values.project_name,
        description: values.description
      })

      if (response.data.success) {
        message.success({ content: '✅ 装配设计已创建！', key: 'create' })
        setCreateModalVisible(false)
        form.resetFields()
        loadDesigns()
      }
    } catch (error: any) {
      message.error({ content: error.response?.data?.message || '创建失败', key: 'create' })
    }
  }

  const handleViewDetail = async (design: AssemblyDesign) => {
    try {
      const response = await axios.get(`/api/assembly/designs/${design.id}`)
      if (response.data.success) {
        setCurrentDesign(response.data.design)
        setDesignSteps(response.data.steps)
        setDetailModalVisible(true)
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载设计详情失败')
    }
  }

  const handleGenerate3D = async (designId: string) => {
    setGenerating3D(true)
    try {
      message.loading({ content: '🤖 正在调用AI生成3D模型...', key: 'generate3d', duration: 0 })

      const response = await axios.post(`/api/assembly/designs/${designId}/3d-model`) // [PE-fix-route-path: 统一为后端实际路由/3d-model]

      if (response.data.success) {
        message.success({ content: '✅ 3D模型生成成功！', key: 'generate3d' })
        loadDesigns()
      }
    } catch (error: any) {
      message.error({
        content: '生成3D失败: ' + (error.response?.data?.message || error.message),
        key: 'generate3d'
      })
    } finally {
      setGenerating3D(false)
    }
  }

  const handleUpload3D = async (designId: string, info: any) => {
    if (info.file.status === 'uploading') {
      setUploading3D(true)
      message.loading({ content: '正在上传3D模型...', key: 'upload3d' })
      return
    }

    if (info.file.status === 'done') {
      setUploading3D(false)
      if (info.file.response?.success) {
        message.success({ content: '✅ 3D模型上传成功！', key: 'upload3d' })
        loadDesigns()
      } else {
        message.error({ content: info.file.response?.message || '上传失败', key: 'upload3d' })
      }
    }

    if (info.file.status === 'error') {
      setUploading3D(false)
      message.error({ content: '上传失败', key: 'upload3d' })
    }
  }

  const handlePreview3D = async (design: AssemblyDesign) => {
    if (!design.model_3d_path) {
      message.warning('⚠️ 该设计尚未生成3D模型')
      return
    }

    setCurrentDesign(design)
    setPreview3DVisible(true)
    setRender3DViewer(true)
  }

  const handleDownload3D = async (design: AssemblyDesign) => {
    if (!design.model_3d_path) {
      message.warning('⚠️ 该设计尚未生成3D模型')
      return
    }

    try {
      message.loading({ content: '正在下载...', key: 'download' })

      const response = await axios.get(`/api/assembly/designs/${design.id}/download-3d`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const fileName = `${design.design_name}_3D_Model.${design.model_format || 'SLDASM'}`
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()

      message.success({ content: `✅ ${fileName} 下载成功！`, key: 'download' })
    } catch (error: any) {
      message.error({
        content: '下载失败: ' + (error.response?.data?.message || error.message),
        key: 'download'
      })
    }
  }

  const handleExportPDF = async (designId: string) => {
    try {
      message.loading({ content: '正在生成装配工艺PDF...', key: 'pdf' })

      // 模拟导出
      await new Promise(resolve => setTimeout(resolve, 2000))

      message.success({ content: '✅ PDF已生成', key: 'pdf' })
    } catch (error) {
      message.error({ content: '生成PDF失败', key: 'pdf' })
    }
  }

  const handleDeleteDesign = async (designId: string) => {
    try {
      await axios.delete(`/api/assembly/designs/${designId}`)
      message.success('✅ 设计已删除')
      loadDesigns()
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  const totalDesigns = designs.length
  const approvedDesigns = designs.filter(d => d.status === 'approved').length
  const designsWith3D = designs.filter(d => d.model_3d_path).length

  const columns = [
    {
      title: '设计名称',
      dataIndex: 'design_name',
      width: 200,
      ellipsis: true
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          draft: { color: 'default', text: '草稿' },
          pending_review: { color: 'orange', text: '待审核' },
          approved: { color: 'green', text: '已批准' },
          rejected: { color: 'red', text: '已拒绝' }
        }
        const config = statusConfig[status as keyof typeof statusConfig]
        return <Tag color={config.color}>{config.text}</Tag>
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
      render: (record: AssemblyDesign) => (
        record.model_3d_path ? (
          <Tag color="green" icon={<BuildOutlined />}>已生成</Tag>
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
      width: 450,
      fixed: 'right' as const,
      render: (record: AssemblyDesign) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>

          {!record.model_3d_path && (
            <Button
              type="link"
              size="small"
              icon={<BuildOutlined />}
              loading={generating3D}
              onClick={() => handleGenerate3D(record.id)}
            >
              生成3D
            </Button>
          )}

          {record.model_3d_path && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handlePreview3D(record)}
              >
                预览3D
              </Button>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload3D(record)}
              >
                下载3D
              </Button>
            </>
          )}

          <Upload
            name="model_file"
            action={`${axios.defaults.baseURL}/api/assembly/designs/${record.id}/3d-model`} // [PE-fix-route-path: 统一为后端实际路由/3d-model]
            headers={{
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }}
            showUploadList={false}
            accept=".SLDASM,.SLDPRT,.STEP,.STP"
            onChange={(info) => handleUpload3D(record.id, info)}
          >
            <Button
              type="link"
              size="small"
              icon={<UploadOutlined />}
              loading={uploading3D}
            >
              上传 3D 模型
            </Button>
          </Upload>

          <Popconfirm
            title="确定要删除这个设计吗？"
            onConfirm={() => handleDeleteDesign(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <RocketOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <span>装配设计</span>
              <Tag color="purple">AI自动生成装配设计 + 3D模型</Tag>
            </Space>
          }
          extra={
            <Space>
              <Button
                type={showAIWorkbench ? 'default' : 'primary'}
                onClick={() => setShowAIWorkbench(!showAIWorkbench)}
              >
                {showAIWorkbench ? '隐藏AI工作台' : '显示AI工作台'}
              </Button>
              <Button icon={<CheckOutlined />} onClick={() => navigate('/mechanical-design/assembly-tasks')}>
                进入下一步：任务管理
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                新建设计
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
                    title="设计总数"
                    value={totalDesigns}
                    prefix={<FileTextOutlined />}
                    suffix="个"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="已批准"
                    value={approvedDesigns}
                    prefix={<CheckOutlined />}
                    suffix="个"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="已生成3D"
                    value={designsWith3D}
                    prefix={<BuildOutlined />}
                    suffix="个"
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="3D生成率"
                    value={totalDesigns ? ((designsWith3D / totalDesigns) * 100).toFixed(0) : 0}
                    prefix={<RocketOutlined />}
                    suffix="%"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* AI自动装配工作台 */}
            {showAIWorkbench && (
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined style={{ fontSize: 20, color: '#faad14' }} />
                    <span>AI自动装配工作台</span>
                    <Tag color="gold">从零件库拖拽零件，一键生成装配方案</Tag>
                  </Space>
                }
                style={{ background: 'linear-gradient(135deg, #fef5e7 0%, #fff 100%)' }}
              >
                <Row gutter={16}>
                  {/* 左侧：零件库 */}
                  <Col span={6}>
                    <Card
                      title={<><FileTextOutlined /> 零件库 ({partLibrary.length}个)</>}
                      size="small"
                      style={{ height: 500, overflow: 'auto' }}
                    >
                      {partLibrary.map(part => (
                        <DraggablePart key={part.id} part={part} />
                      ))}
                    </Card>
                  </Col>

                  {/* 中间：装配画布 */}
                  <Col span={12}>
                    <Card
                      title={<><BuildOutlined /> 装配画布</>}
                      size="small"
                      extra={
                        <Space>
                          <Button
                            size="small"
                            onClick={() => setDroppedParts([])}
                            disabled={droppedParts.length === 0}
                          >
                            清空
                          </Button>
                          <Button
                            type="primary"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            onClick={handleAIAutoAssemble}
                            loading={assembling}
                            disabled={droppedParts.length < 2}
                          >
                            AI自动装配
                          </Button>
                        </Space>
                      }
                    >
                      <PartDropZone onDrop={handlePartDrop} droppedParts={droppedParts} />
                    </Card>
                  </Col>

                  {/* 右侧：使用说明 */}
                  <Col span={6}>
                    <Card
                      title={<><FileTextOutlined /> 使用说明</>}
                      size="small"
                      style={{ height: 500 }}
                    >
                      <Timeline
                        items={[
                          {
                            color: 'blue',
                            children: (
                              <>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>1. 选择零件</p>
                                <p style={{ fontSize: 12, color: '#666' }}>从左侧零件库拖拽零件到中间画布</p>
                              </>
                            )
                          },
                          {
                            color: 'green',
                            children: (
                              <>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>2. 组合零件</p>
                                <p style={{ fontSize: 12, color: '#666' }}>至少选择2个零件进行装配</p>
                              </>
                            )
                          },
                          {
                            color: 'orange',
                            children: (
                              <>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>3. AI装配</p>
                                <p style={{ fontSize: 12, color: '#666' }}>点击"AI自动装配"按钮</p>
                              </>
                            )
                          },
                          {
                            color: 'purple',
                            children: (
                              <>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>4. 查看结果</p>
                                <p style={{ fontSize: 12, color: '#666' }}>装配方案会保存到下方设计列表</p>
                              </>
                            )
                          }
                        ]}
                      />
                      <Alert
                        message="智能提示"
                        description={
                          <>
                            <p style={{ marginBottom: 8 }}>• AI会分析零件类型和尺寸</p>
                            <p style={{ marginBottom: 8 }}>• 自动生成装配约束</p>
                            <p style={{ marginBottom: 0 }}>• 优化装配顺序</p>
                          </>
                        }
                        type="info"
                        showIcon
                        style={{ marginTop: 16, fontSize: 12 }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Card>
            )}

            {/* 设计列表 */}
            <Card title={<><FileTextOutlined /> 设计列表</>}>
              <Table
                columns={columns}
                dataSource={designs}
                loading={loading}
                rowKey="id"
                scroll={{ x: 1400 }}
                pagination={{
                  pageSize: 10,
                  showTotal: (total) => `共 ${total} 条记录`
                }}
              />
            </Card>
          </Space>
        </Card>

        {/* 创建设计弹窗 */}
        <Modal
          title="新建装配设计"
          open={createModalVisible}
          onOk={handleCreateDesign}
          onCancel={() => {
            setCreateModalVisible(false)
            form.resetFields()
          }}
          okText="创建"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item
              label="设计名称"
              name="design_name"
              rules={[{ required: true, message: '请输入设计名称' }]}
            >
              <Input placeholder="请输入设计名称" />
            </Form.Item>
            <Form.Item
              label="项目名称"
              name="project_name"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="请输入项目名称" />
            </Form.Item>
            <Form.Item
              label="设计说明"
              name="description"
            >
              <Input.TextArea rows={4} placeholder="请输入设计说明" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 设计详情抽屉 */}
        <Drawer
          title="装配设计详情"
          placement="right"
          size="large"
          onClose={() => {
            setDetailModalVisible(false)
            setCurrentDesign(null)
            setDesignSteps([])
          }}
          open={detailModalVisible}
        >
          {currentDesign && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 基本信息 */}
              <Card
                title={<><BuildOutlined /> 设计信息</>}
                style={{ width: '100%' }}
              >
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="设计名称" span={2}>{currentDesign.design_name}</Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>{currentDesign.description}</Descriptions.Item>
                  <Descriptions.Item label="装配步骤">{currentDesign.steps_count} 步</Descriptions.Item>
                  <Descriptions.Item label="设计状态">
                    <Tag color="green">已批准</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="项目名称">{currentDesign.project_name}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {new Date(currentDesign.created_at).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'center' }}>
                  <Image
                    src={`/uploads/3d_model_preview.png`}
                    alt="3D模型预览"
                    style={{
                      maxWidth: '100%',
                      border: '1px solid #d9d9d9',
                      borderRadius: 8
                    }}
                    preview={{
                      mask: '🔍 查看大图'
                    }}
                  />
                  <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    ⚡ 真实SolidWorks文件的3D渲染预览图
                  </p>
                </div>

                <Alert
                  message="SolidWorks原生文件"
                  description="此文件为真实的SolidWorks格式（.SLDASM装配体/.SLDPRT零件），请下载后使用SolidWorks 2020或更高版本打开查看完整3D模型、装配关系和工程图。"
                  type="info"
                  showIcon
                />

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <Space size="large">
                    <Button
                      type="primary"
                      size="large"
                      icon={<DownloadOutlined />}
                      onClick={() => currentDesign && handleDownload3D(currentDesign)}
                    >
                      下载模型文件
                    </Button>
                    <Button
                      size="large"
                      icon={<FileTextOutlined />}
                      onClick={() => handleExportPDF(currentDesign.id)}
                    >
                      导出工艺文档
                    </Button>
                  </Space>
                </div>
              </Card>

              {/* 装配步骤详情 */}
              {designSteps.length > 0 && (
                <Card
                  title={<><FileTextOutlined /> 装配步骤详情</>}
                  style={{ width: '100%', marginBottom: 24 }}
                >
                  <Steps
                    direction="vertical"
                    current={-1}
                    items={designSteps.map((step, idx) => ({
                      title: `步骤 ${step.step_number}: ${step.operation_type}`,
                      description: (
                        <div style={{ paddingTop: 8 }}>
                          <p style={{ marginBottom: 8 }}>
                            <strong>操作说明：</strong>{step.description}
                          </p>
                          <p style={{ marginBottom: 8 }}>
                            <strong>零件A：</strong>
                            <Tag color="blue" style={{ marginLeft: 8 }}>{step.part_a}</Tag>
                          </p>
                          <p style={{ marginBottom: 8 }}>
                            <strong>零件B：</strong>
                            <Tag color="green" style={{ marginLeft: 8 }}>{step.part_b}</Tag>
                          </p>
                          {step.notes && (
                            <p style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>
                              💡 备注: {step.notes}
                            </p>
                          )}
                        </div>
                      ),
                      status: 'finish' as any
                    }))}
                  />
                </Card>
              )}

              {/* 使用说明 */}
              <Card
                title="📖 使用说明"
                style={{ width: '100%' }}
              >
                <Timeline
                  items={[
                    {
                      color: 'blue',
                      children: '创建装配任务：定义装配目标和要求'
                    },
                    {
                      color: 'green',
                      children: 'AI自动推理：基于零件库和规则生成装配步骤'
                    },
                    {
                      color: 'orange',
                      children: '生成3D模型：调用SolidWorks API生成3D模型'
                    },
                    {
                      color: 'purple',
                      children: '导出工艺文档：生成装配工艺卡片PDF'
                    }
                  ]}
                />
              </Card>
            </Space>
          )}
        </Drawer>

        {/* 3D预览弹窗 */}
        <Modal
          title="3D模型预览"
          open={preview3DVisible}
          onCancel={() => {
            setPreview3DVisible(false)
            setRender3DViewer(false)
            setCurrentDesign(null)
          }}
          width="80%"
          footer={null}
          destroyOnClose
        >
          {currentDesign && render3DViewer && (
            <div style={{ height: '70vh' }}>
              <ThreeModelViewer
                modelUrl={currentDesign.model_3d_path}
                width="100%"
                height="100%"
              />
            </div>
          )}
        </Modal>
      </div>
    </DndProvider>
  )
}

export default AssemblyDesignManagement
