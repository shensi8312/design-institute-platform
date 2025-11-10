import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, message, Tabs, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'

const { TabPane } = Tabs

interface EntityType {
  id: string
  name: string
  color: string
  icon: string
  description: string
  is_active: boolean
  sort_order: number
}

interface RelationType {
  id: string
  name: string
  color: string
  description: string
  is_active: boolean
  is_directed: boolean
  sort_order: number
}

const GraphConfig: React.FC = () => {
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [relationTypes, setRelationTypes] = useState<RelationType[]>([])
  const [entityModalVisible, setEntityModalVisible] = useState(false)
  const [relationModalVisible, setRelationModalVisible] = useState(false)
  const [editingEntity, setEditingEntity] = useState<EntityType | null>(null)
  const [editingRelation, setEditingRelation] = useState<RelationType | null>(null)
  const [entityForm] = Form.useForm()
  const [relationForm] = Form.useForm()

  const API_BASE = '/api'
  const token = localStorage.getItem('token')

  // 加载实体类型
  const loadEntityTypes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph/config/entity-types`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setEntityTypes(res.data.data)
    } catch (error) {
      message.error('加载实体类型失败')
    }
  }

  // 加载关系类型
  const loadRelationTypes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph/config/relationship-types`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRelationTypes(res.data.data)
    } catch (error) {
      message.error('加载关系类型失败')
    }
  }

  useEffect(() => {
    loadEntityTypes()
    loadRelationTypes()
  }, [])

  // 保存实体类型
  const saveEntityType = async (values: any) => {
    try {
      if (editingEntity) {
        await axios.put(`${API_BASE}/graph/config/entity-types/${editingEntity.id}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        })
        message.success('更新成功')
      } else {
        await axios.post(`${API_BASE}/graph/config/entity-types`, values, {
          headers: { Authorization: `Bearer ${token}` }
        })
        message.success('创建成功')
      }
      setEntityModalVisible(false)
      entityForm.resetFields()
      loadEntityTypes()
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 保存关系类型
  const saveRelationType = async (values: any) => {
    try {
      if (editingRelation) {
        await axios.put(`${API_BASE}/graph/config/relationship-types/${editingRelation.id}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        })
        message.success('更新成功')
      } else {
        await axios.post(`${API_BASE}/graph/config/relationship-types`, values, {
          headers: { Authorization: `Bearer ${token}` }
        })
        message.success('创建成功')
      }
      setRelationModalVisible(false)
      relationForm.resetFields()
      loadRelationTypes()
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 删除实体类型
  const deleteEntityType = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/graph/config/entity-types/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      message.success('删除成功')
      loadEntityTypes()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 删除关系类型
  const deleteRelationType = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/graph/config/relationship-types/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      message.success('删除成功')
      loadRelationTypes()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const entityColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, backgroundColor: color, marginRight: 8 }} />
          {color}
        </div>
      )
    },
    { title: '图标', dataIndex: 'icon', key: 'icon' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: EntityType) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingEntity(record)
              entityForm.setFieldsValue(record)
              setEntityModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteEntityType(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  const relationColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, backgroundColor: color, marginRight: 8 }} />
          {color}
        </div>
      )
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '有向',
      dataIndex: 'is_directed',
      key: 'is_directed',
      render: (directed: boolean) => (directed ? '是' : '否')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RelationType) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRelation(record)
              relationForm.setFieldsValue(record)
              setRelationModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteRelationType(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Card title="知识图谱配置">
      <Tabs defaultActiveKey="entity">
        <TabPane tab="实体类型" key="entity">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingEntity(null)
              entityForm.resetFields()
              setEntityModalVisible(true)
            }}
            style={{ marginBottom: 16 }}
          >
            新建实体类型
          </Button>
          <Table dataSource={entityTypes} columns={entityColumns} rowKey="id" />
        </TabPane>

        <TabPane tab="关系类型" key="relation">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRelation(null)
              relationForm.resetFields()
              setRelationModalVisible(true)
            }}
            style={{ marginBottom: 16 }}
          >
            新建关系类型
          </Button>
          <Table dataSource={relationTypes} columns={relationColumns} rowKey="id" />
        </TabPane>
      </Tabs>

      {/* 实体类型编辑弹窗 */}
      <Modal
        title={editingEntity ? '编辑实体类型' : '新建实体类型'}
        open={entityModalVisible}
        onOk={() => entityForm.submit()}
        onCancel={() => setEntityModalVisible(false)}
      >
        <Form form={entityForm} onFinish={saveEntityType} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input disabled={!!editingEntity} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="颜色" rules={[{ required: true }]}>
            <Input type="color" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关系类型编辑弹窗 */}
      <Modal
        title={editingRelation ? '编辑关系类型' : '新建关系类型'}
        open={relationModalVisible}
        onOk={() => relationForm.submit()}
        onCancel={() => setRelationModalVisible(false)}
      >
        <Form form={relationForm} onFinish={saveRelationType} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input disabled={!!editingRelation} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="颜色" rules={[{ required: true }]}>
            <Input type="color" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="is_directed" label="是否有向" valuePropName="checked" initialValue={true}>
            <Select>
              <Select.Option value={true}>是</Select.Option>
              <Select.Option value={false}>否</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default GraphConfig
