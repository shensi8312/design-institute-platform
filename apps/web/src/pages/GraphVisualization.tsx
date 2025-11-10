import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Space, message, Form, Input, Drawer, Select } from 'antd'
import { SaveOutlined, PlusOutlined } from '@ant-design/icons'
import { Graph } from '@antv/g6'
import axios from 'axios'

interface Node {
  id: string
  entity_name: string
  entity_type: string
  properties: any
}

interface Relationship {
  id: string
  source_node_id: string
  target_node_id: string
  relationship_type: string
  properties: any
}

interface Props {
  documentId?: string
}

const GraphVisualization: React.FC<Props> = ({ documentId }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [nodeForm] = Form.useForm()

  const API_BASE = '/api'
  const token = localStorage.getItem('token')

  // 加载图谱数据
  const loadGraphData = async () => {
    if (!documentId) return

    try {
      const res = await axios.get(`${API_BASE}/graph/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const graphData = res.data.graph
      renderGraph(graphData.nodes || [], graphData.relationships || [])
    } catch (error) {
      message.error('加载图谱失败')
    }
  }

  // 渲染图谱
  const renderGraph = (nodeList: Node[], edgeList: Relationship[]) => {
    if (!containerRef.current) return

    // 清除旧图
    if (graphRef.current) {
      graphRef.current.destroy()
    }

    // 转换数据格式
    const g6Nodes = nodeList.map(node => ({
      id: node.id,
      label: node.entity_name,
      type: 'circle',
      size: 40,
      style: {
        fill: getNodeColor(node.entity_type),
        stroke: '#fff',
        lineWidth: 2
      }
    }))

    const g6Edges = edgeList.map(edge => ({
      source: edge.source_node_id,
      target: edge.target_node_id,
      label: edge.relationship_type,
      type: 'line'
    }))

    const graph = new Graph({
      container: containerRef.current!,
      width: containerRef.current.offsetWidth,
      height: 600,
      data: { nodes: g6Nodes, edges: g6Edges },
      node: {
        style: {
          size: 40,
          lineWidth: 2,
          stroke: '#5B8FF9',
          fill: '#C6E5FF'
        }
      },
      edge: {
        style: {
          stroke: '#e2e2e2',
          lineWidth: 2
        }
      },
      layout: {
        type: 'force',
        preventOverlap: true,
        linkDistance: 150
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
    })

    graph.render()

    // 点击节点事件
    graph.on('node:click', (e: any) => {
      const nodeId = e.item.getModel().id
      const node = nodeList.find(n => n.id === nodeId)
      if (node) {
        setSelectedNode(node)
        nodeForm.setFieldsValue({
          entity_name: node.entity_name,
          entity_type: node.entity_type,
          description: node.properties?.description
        })
        setDrawerVisible(true)
      }
    })

    graphRef.current = graph
  }

  // 根据实体类型获取颜色
  const getNodeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      '人物': '#1890ff',
      '组织': '#52c41a',
      '地点': '#faad14',
      '概念': '#722ed1',
      '技术': '#eb2f96',
      '产品': '#13c2c2',
      '其他': '#8c8c8c'
    }
    return colorMap[type] || '#8c8c8c'
  }

  // 更新节点
  const updateNode = async (values: any) => {
    if (!selectedNode) return

    try {
      await axios.put(`${API_BASE}/graph/nodes/${selectedNode.id}`, {
        entity_name: values.entity_name,
        entity_type: values.entity_type,
        properties: {
          ...selectedNode.properties,
          description: values.description
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      message.success('更新成功')
      setDrawerVisible(false)
      loadGraphData()
    } catch (error) {
      message.error('更新失败')
    }
  }

  useEffect(() => {
    loadGraphData()

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy()
      }
    }
  }, [documentId])

  return (
    <Card
      title="知识图谱可视化"
      extra={
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => message.info('导出功能开发中')}>
            导出图谱
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('手动添加节点开发中')}>
            添加节点
          </Button>
        </Space>
      }
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 600,
          border: '1px solid #e8e8e8',
          borderRadius: 4
        }}
      />

      {/* 节点编辑抽屉 */}
      <Drawer
        title="编辑节点"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={400}
      >
        <Form form={nodeForm} onFinish={updateNode} layout="vertical">
          <Form.Item name="entity_name" label="实体名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="entity_type" label="实体类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="人物">人物</Select.Option>
              <Select.Option value="组织">组织</Select.Option>
              <Select.Option value="地点">地点</Select.Option>
              <Select.Option value="概念">概念</Select.Option>
              <Select.Option value="技术">技术</Select.Option>
              <Select.Option value="产品">产品</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setDrawerVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default GraphVisualization
