import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tabs,
  List,
  Popconfirm
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { Stage, Layer, Image, Rect, Text, Transformer } from 'react-konva'
import useImage from 'use-image'
import axios from 'axios'

const { Option } = Select

interface Detection {
  id: string
  class: string
  bbox: [number, number, number, number] // [x, y, width, height]
  confidence: number
  attributes: {
    floors?: number
    building_type?: string
    dimension?: string
    unit?: string
  }
}

interface DrawingData {
  id: string
  image_url: string
  detections: Detection[]
  created_at: string
  status: 'pending' | 'reviewed' | 'approved'
}

// Canvas中的矩形组件
const DetectionRect: React.FC<{
  detection: Detection
  isSelected: boolean
  onSelect: () => void
  onChange: (newAttrs: any) => void
}> = ({ detection, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef<any>()
  const trRef = useRef<any>()

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  const getColorByClass = (cls: string) => {
    const colors: Record<string, string> = {
      building: '#1890ff',
      window: '#52c41a',
      door: '#faad14',
      dimension: '#f5222d',
      text: '#722ed1'
    }
    return colors[cls] || '#d9d9d9'
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={detection.bbox[0]}
        y={detection.bbox[1]}
        width={detection.bbox[2]}
        height={detection.bbox[3]}
        stroke={getColorByClass(detection.class)}
        strokeWidth={isSelected ? 3 : 2}
        fill={isSelected ? `${getColorByClass(detection.class)}20` : 'transparent'}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...detection,
            bbox: [e.target.x(), e.target.y(), detection.bbox[2], detection.bbox[3]]
          })
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            ...detection,
            bbox: [
              node.x(),
              node.y(),
              Math.max(5, node.width() * scaleX),
              Math.max(5, node.height() * scaleY)
            ]
          })
        }}
      />
      {isSelected && <Transformer ref={trRef} />}
    </>
  )
}

// Canvas背景图片
const BackgroundImage: React.FC<{ src: string }> = ({ src }) => {
  const [image] = useImage(src)
  return <Image image={image} />
}

const DrawingReview: React.FC = () => {
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // 从URL参数获取图纸ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const drawingId = params.get('id')
    if (drawingId) {
      loadDrawingData(drawingId)
    }
  }, [])

  // 加载图纸数据
  const loadDrawingData = async (id: string) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/drawings/${id}`)
      setDrawingData(res.data.data)
      setDetections(res.data.data.detections)
    } catch (error) {
      message.error('加载图纸数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 选中检测对象
  const handleSelectDetection = (id: string) => {
    setSelectedId(id)
    const detection = detections.find(d => d.id === id)
    if (detection) {
      form.setFieldsValue({
        class: detection.class,
        confidence: detection.confidence,
        ...detection.attributes
      })
    }
  }

  // 更新检测对象
  const handleUpdateDetection = (id: string, newAttrs: Partial<Detection>) => {
    setDetections(prev =>
      prev.map(d => (d.id === id ? { ...d, ...newAttrs } : d))
    )
  }

  // 保存修改
  const handleSave = async () => {
    try {
      if (!selectedId) {
        message.warning('请先选择一个检测对象')
        return
      }

      const values = await form.validateFields()

      // 更新选中对象的属性
      handleUpdateDetection(selectedId, {
        class: values.class,
        attributes: {
          floors: values.floors,
          building_type: values.building_type,
          dimension: values.dimension,
          unit: values.unit
        }
      })

      message.success('修改已保存')
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 保存所有修改到服务器
  const handleSaveAll = async () => {
    setLoading(true)
    try {
      await axios.put(`/api/drawings/${drawingData!.id}`, {
        detections
      })

      message.success('所有修改已保存')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 重新识别
  const handleReRecognize = async () => {
    setLoading(true)
    try {
      await axios.post(`/api/drawings/${drawingData!.id}/re-recognize`)

      message.success('重新识别已提交,请稍后刷新')

      // 5秒后自动刷新
      setTimeout(() => {
        loadDrawingData(drawingData!.id)
      }, 5000)
    } catch (error) {
      message.error('重新识别失败')
    } finally {
      setLoading(false)
    }
  }

  // 导出JSON
  const handleExport = () => {
    const dataStr = JSON.stringify(detections, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `drawing_${drawingData!.id}_detections.json`
    link.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  // 删除检测对象
  const handleDelete = () => {
    if (!selectedId) return

    setDetections(prev => prev.filter(d => d.id !== selectedId))
    setSelectedId(null)
    form.resetFields()
    message.success('已删除')
  }

  // 审核通过
  const handleApprove = async () => {
    setLoading(true)
    try {
      await axios.post(`/api/drawings/${drawingData!.id}/approve`, {
        detections
      })

      message.success('审核通过')

      // 跳转回列表
      window.history.back()
    } catch (error) {
      message.error('审核失败')
    } finally {
      setLoading(false)
    }
  }

  if (!drawingData) {
    return <Card loading={true}>加载中...</Card>
  }

  const selectedDetection = detections.find(d => d.id === selectedId)

  return (
    <div className="drawing-review" style={{ padding: 24 }}>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            loading={loading}
          >
            保存所有修改
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReRecognize}
            loading={loading}
          >
            重新识别
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出JSON
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleApprove}
            loading={loading}
          >
            审核通过
          </Button>
        </Space>
      </Card>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧: Canvas预览 */}
        <Card title="图纸预览" style={{ flex: 1 }}>
          <Stage width={800} height={600}>
            <Layer>
              <BackgroundImage src={drawingData.image_url} />
              {detections.map(detection => (
                <DetectionRect
                  key={detection.id}
                  detection={detection}
                  isSelected={detection.id === selectedId}
                  onSelect={() => handleSelectDetection(detection.id)}
                  onChange={(newAttrs) => handleUpdateDetection(detection.id, newAttrs)}
                />
              ))}
            </Layer>
          </Stage>

          <div style={{ marginTop: 16 }}>
            <Space>
              <Tag color="blue">🟦 建筑</Tag>
              <Tag color="green">🟩 窗户</Tag>
              <Tag color="orange">🟨 门</Tag>
              <Tag color="red">🟥 标注</Tag>
              <Tag color="purple">🟪 文字</Tag>
            </Space>
          </div>
        </Card>

        {/* 右侧: 识别结果编辑 */}
        <Card
          title={`识别结果 (${detections.length}个)`}
          style={{ width: 400 }}
        >
          <Tabs>
            <Tabs.TabPane tab="列表" key="list">
              <List
                dataSource={detections}
                renderItem={(detection) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      backgroundColor: detection.id === selectedId ? '#e6f7ff' : 'transparent'
                    }}
                    onClick={() => handleSelectDetection(detection.id)}
                    actions={[
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectDetection(detection.id)
                        }}
                      />
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag>{detection.class}</Tag>
                          {detection.attributes.floors && (
                            <span>{detection.attributes.floors}层</span>
                          )}
                        </Space>
                      }
                      description={`置信度: ${(detection.confidence * 100).toFixed(1)}%`}
                    />
                  </List.Item>
                )}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="编辑" key="edit" disabled={!selectedDetection}>
              {selectedDetection && (
                <Form form={form} layout="vertical">
                  <Form.Item label="对象类型" name="class" rules={[{ required: true }]}>
                    <Select>
                      <Option value="building">建筑</Option>
                      <Option value="window">窗户</Option>
                      <Option value="door">门</Option>
                      <Option value="dimension">标注</Option>
                      <Option value="text">文字</Option>
                    </Select>
                  </Form.Item>

                  {selectedDetection.class === 'building' && (
                    <>
                      <Form.Item label="楼层数" name="floors">
                        <InputNumber min={1} max={100} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item label="建筑类型" name="building_type">
                        <Select>
                          <Option value="residential">住宅</Option>
                          <Option value="office">办公</Option>
                          <Option value="commercial">商业</Option>
                          <Option value="industrial">工业</Option>
                        </Select>
                      </Form.Item>
                    </>
                  )}

                  {selectedDetection.class === 'dimension' && (
                    <>
                      <Form.Item label="尺寸数值" name="dimension">
                        <Input placeholder="30000" />
                      </Form.Item>

                      <Form.Item label="单位" name="unit">
                        <Select>
                          <Option value="mm">mm</Option>
                          <Option value="m">m</Option>
                          <Option value="cm">cm</Option>
                        </Select>
                      </Form.Item>
                    </>
                  )}

                  <Form.Item label="置信度" name="confidence">
                    <InputNumber
                      min={0}
                      max={1}
                      step={0.1}
                      style={{ width: '100%' }}
                      disabled
                    />
                  </Form.Item>

                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="位置">
                      X: {Math.round(selectedDetection.bbox[0])}, Y: {Math.round(selectedDetection.bbox[1])}
                    </Descriptions.Item>
                    <Descriptions.Item label="尺寸">
                      W: {Math.round(selectedDetection.bbox[2])}, H: {Math.round(selectedDetection.bbox[3])}
                    </Descriptions.Item>
                  </Descriptions>

                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} block>
                      保存修改
                    </Button>
                    <Popconfirm
                      title="确定删除此检测对象吗?"
                      onConfirm={handleDelete}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </Form>
              )}
            </Tabs.TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default DrawingReview
