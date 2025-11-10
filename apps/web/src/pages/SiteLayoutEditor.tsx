import React, { useState } from 'react'
import { Card, Button, Space, message, Tag, InputNumber, Select, Modal, Form } from 'antd'
import {
  ThunderboltOutlined,
  SaveOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import axios from 'axios'

const { Option } = Select

interface Building {
  id: string
  name: string
  x: number
  y: number
  width: number
  length: number
  height: number
  floors: number
}

const SiteLayoutEditor: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(false)
  const [violations, setViolations] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const handleOptimize = async () => {
    if (buildings.length < 2) {
      message.warning('至少需要2栋建筑才能优化')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post('/api/spatial/optimize', {
        layout: {
          site: { width: 200, height: 150 },
          buildings,
          constraints: {
            maxPlotRatio: 2.5,
            minGreenRatio: 0.3,
            sunlightSpacing: 1.5,
            fireSpacing: 9
          }
        },
        generations: 50
      })

      if (res.data.success) {
        setBuildings(res.data.data.solution.buildings)
        message.success('优化完成！')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '优化失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddBuilding = async () => {
    try {
      const values = await form.validateFields()
      const newBuilding: Building = {
        id: `B${buildings.length + 1}`,
        name: values.name,
        x: 20,
        y: 20,
        width: values.width,
        length: values.length,
        height: values.height,
        floors: values.floors
      }
      setBuildings([...buildings, newBuilding])
      setModalVisible(false)
      form.resetFields()
      message.success('建筑已添加')
    } catch (error) {
      console.error('添加失败:', error)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleOptimize}
            loading={loading}
          >
            自动优化
          </Button>
          <Button icon={<SaveOutlined />}>保存方案</Button>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            添加建筑
          </Button>
          {violations.length > 0 ? (
            <Tag icon={<WarningOutlined />} color="error">
              {violations.length}项违规
            </Tag>
          ) : (
            <Tag icon={<CheckCircleOutlined />} color="success">
              合规
            </Tag>
          )}
        </Space>

        <div style={{
          border: '1px solid #d9d9d9',
          width: 600,
          height: 450,
          backgroundColor: '#f5f5f5',
          position: 'relative'
        }}>
          <p style={{ textAlign: 'center', paddingTop: 200 }}>
            总图编辑区域 (200m × 150m)
          </p>
          <p style={{ textAlign: 'center' }}>
            当前建筑数: {buildings.length}
          </p>
          {buildings.map(b => (
            <div key={b.id} style={{ padding: 4 }}>
              {b.name}: {b.width}m × {b.length}m, {b.floors}层
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title="添加建筑"
        open={modalVisible}
        onOk={handleAddBuilding}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="建筑名称" name="name" rules={[{ required: true }]}>
            <input placeholder="例如: 1#楼" style={{ width: '100%', padding: 4 }} />
          </Form.Item>
          <Form.Item label="宽度(m)" name="width" rules={[{ required: true }]}>
            <InputNumber min={10} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="进深(m)" name="length" rules={[{ required: true }]}>
            <InputNumber min={10} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="高度(m)" name="height" rules={[{ required: true }]}>
            <InputNumber min={5} max={150} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="楼层数" name="floors" rules={[{ required: true }]}>
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SiteLayoutEditor
