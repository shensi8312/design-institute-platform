/**
 * Agent工作流设计器
 * 可视化拖拽式工作流编排界面
 */

import React, { useState, useCallback, useRef } from 'react'
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  Panel,
  MarkerType
} from 'reactflow'
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection
} from 'reactflow'
import 'reactflow/dist/style.css'
import { 
  Card, 
  Button, 
  Space, 
  Drawer, 
  Form, 
  Input, 
  
  Switch,
  message,
  Modal,
  Tabs,
  Badge,
  Divider,
  Tag
} from 'antd'
import {
  PlayCircleOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SettingOutlined,
  EyeOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons'

// 自定义节点组件
import AgentNode from './nodes/AgentNode'
import ConditionNode from './nodes/ConditionNode'
import ParallelNode from './nodes/ParallelNode'

// Agent注册表（模拟）
const AGENT_REGISTRY = [
  {
    id: 'document_recognition_agent',
    name: '文档识别',
    category: 'process',
    icon: '📄',
    description: '识别和解析各类文档',
    inputs: ['file'],
    outputs: ['text', 'tables', 'images']
  },
  {
    id: 'vectorization_agent',
    name: '向量化',
    category: 'process',
    icon: '🔢',
    description: '文本向量化和语义搜索',
    inputs: ['text'],
    outputs: ['embeddings']
  },
  {
    id: 'knowledge_graph_agent',
    name: '知识图谱',
    category: 'process',
    icon: '🕸️',
    description: '构建知识图谱',
    inputs: ['text', 'entities'],
    outputs: ['graph', 'relations']
  },
  {
    id: 'rule_engine_agent',
    name: '规则引擎',
    category: 'decision',
    icon: '⚖️',
    description: '规则判断和决策',
    inputs: ['data'],
    outputs: ['result', 'score']
  },
  {
    id: 'storage_agent',
    name: '存储',
    category: 'output',
    icon: '💾',
    description: '数据持久化存储',
    inputs: ['data'],
    outputs: ['status']
  }
]

// 节点类型
const nodeTypes = {
  agent: AgentNode,
  condition: ConditionNode,
  parallel: ParallelNode
}

// 初始节点
const initialNodes: Node[] = []

// 初始边
const initialEdges: Edge[] = []

const WorkflowDesigner: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [_executionStatus, setExecutionStatus] = useState<any>({})
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { project } = useReactFlow()
  const [form] = Form.useForm()

  // 处理节点变化
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  // 处理边变化
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  // 处理连接
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed
        }
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    []
  )

  // 处理节点点击
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setConfigDrawerVisible(true)
    form.setFieldsValue(node.data.config || {})
  }, [form])

  // 添加新节点
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      const type = event.dataTransfer.getData('application/reactflow')

      if (!type || !reactFlowBounds) {
        return
      }

      const agentData = JSON.parse(event.dataTransfer.getData('agent'))
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode: Node = {
        id: `${agentData.id}_${Date.now()}`,
        type: 'agent',
        position,
        data: {
          label: agentData.name,
          agent: agentData,
          config: {},
          status: 'idle'
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [project]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // 保存节点配置
  const saveNodeConfig = () => {
    if (!selectedNode) return

    const values = form.getFieldsValue()
    const updatedNodes = nodes.map(node => {
      if (node.id === selectedNode.id) {
        return {
          ...node,
          data: {
            ...node.data,
            config: values
          }
        }
      }
      return node
    })
    
    setNodes(updatedNodes)
    setConfigDrawerVisible(false)
    message.success('配置已保存')
  }

  // 执行工作流
  const executeWorkflow = async () => {
    setExecuting(true)
    setExecutionStatus({})
    
    // 模拟执行过程
    for (const node of nodes) {
      setExecutionStatus((prev: any) => ({
        ...prev,
        [node.id]: 'running'
      }))
      
      // 更新节点状态
      const updatedNodes = nodes.map(n => {
        if (n.id === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              status: 'running'
            }
          }
        }
        return n
      })
      setNodes(updatedNodes)
      
      // 模拟处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setExecutionStatus((prev: any) => ({
        ...prev,
        [node.id]: 'success'
      }))
      
      // 更新节点状态
      const completedNodes = nodes.map(n => {
        if (n.id === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              status: 'success'
            }
          }
        }
        return n
      })
      setNodes(completedNodes)
    }
    
    setExecuting(false)
    message.success('工作流执行完成')
  }

  // 保存工作流
  const saveWorkflow = () => {
    const workflow = {
      id: `workflow_${Date.now()}`,
      name: '自定义工作流',
      nodes: nodes,
      edges: edges,
      metadata: {
        created_at: new Date().toISOString()
      }
    }
    
    console.log('保存工作流:', workflow)
    localStorage.setItem('current_workflow', JSON.stringify(workflow))
    message.success('工作流已保存')
  }

  // 加载模板
  const loadTemplate = (templateId: string) => {
    // 这里应该从后端加载模板
    message.info(`加载模板: ${templateId}`)
    setTemplateModalVisible(false)
  }

  // Agent拖拽开始
  const onDragStart = (event: React.DragEvent, agent: any) => {
    event.dataTransfer.setData('application/reactflow', 'agent')
    event.dataTransfer.setData('agent', JSON.stringify(agent))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      {/* 左侧Agent列表 */}
      <Card 
        title="Agent组件库" 
        style={{ width: 280, margin: 0, borderRadius: 0 }}
        bodyStyle={{ padding: 12 }}
      >
        <Tabs defaultActiveKey="all" size="small">
          <Tabs.TabPane tab="全部" key="all">
            <Space direction="vertical" style={{ width: '100%' }}>
              {AGENT_REGISTRY.map(agent => (
                <Card
                  key={agent.id}
                  size="small"
                  draggable
                  onDragStart={(e) => onDragStart(e, agent)}
                  style={{ cursor: 'move' }}
                  hoverable
                >
                  <Space>
                    <span style={{ fontSize: 24 }}>{agent.icon}</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{agent.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {agent.description}
                      </div>
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>
          </Tabs.TabPane>
          <Tabs.TabPane tab="输入" key="input">
            {/* 输入类Agent */}
          </Tabs.TabPane>
          <Tabs.TabPane tab="处理" key="process">
            {/* 处理类Agent */}
          </Tabs.TabPane>
          <Tabs.TabPane tab="输出" key="output">
            {/* 输出类Agent */}
          </Tabs.TabPane>
        </Tabs>
        
        <Divider />
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            block
            onClick={() => message.info('添加条件节点')}
          >
            条件节点
          </Button>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            block
            onClick={() => message.info('添加并行节点')}
          >
            并行节点
          </Button>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            block
            onClick={() => message.info('添加循环节点')}
          >
            循环节点
          </Button>
        </Space>
      </Card>

      {/* 中间画布 */}
      <div style={{ flex: 1 }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Panel position="top-left">
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={executeWorkflow}
                loading={executing}
                disabled={nodes.length === 0}
              >
                运行工作流
              </Button>
              <Button
                icon={<SaveOutlined />}
                onClick={saveWorkflow}
              >
                保存
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => setTemplateModalVisible(true)}
              >
                模板
              </Button>
              <Button
                icon={<CloudUploadOutlined />}
                onClick={() => message.info('导出功能开发中')}
              >
                导出
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => message.info('预览功能开发中')}
              >
                预览
              </Button>
            </Space>
          </Panel>
          
          <Panel position="top-right">
            {executing && (
              <Badge status="processing" text="执行中..." />
            )}
          </Panel>
          
          <Controls />
          <MiniMap />
          <Background gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* 右侧配置面板 */}
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            节点配置
          </Space>
        }
        placement="right"
        width={400}
        visible={configDrawerVisible}
        onClose={() => setConfigDrawerVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setConfigDrawerVisible(false)}>
              取消
            </Button>
            <Button type="primary" onClick={saveNodeConfig}>
              保存配置
            </Button>
          </Space>
        }
      >
        {selectedNode && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space>
                <span style={{ fontSize: 24 }}>
                  {selectedNode.data.agent?.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {selectedNode.data.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    ID: {selectedNode.id}
                  </div>
                </div>
              </Space>
            </Card>
            
            <Form
              form={form}
              layout="vertical"
              initialValues={selectedNode.data.config}
            >
              <Form.Item label="节点名称" name="name">
                <Input placeholder="自定义节点名称" />
              </Form.Item>
              
              <Form.Item label="超时时间（秒）" name="timeout">
                <Input type="number" placeholder="300" />
              </Form.Item>
              
              <Form.Item label="重试次数" name="retry">
                <Input type="number" placeholder="3" />
              </Form.Item>
              
              <Form.Item label="并行处理" name="parallel">
                <Switch />
              </Form.Item>
              
              {selectedNode.data.agent?.id === 'document_recognition_agent' && (
                <>
                  <Form.Item label="启用OCR" name="enable_ocr">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Form.Item label="提取表格" name="extract_tables">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Form.Item label="提取图片" name="extract_images">
                    <Switch defaultChecked />
                  </Form.Item>
                </>
              )}
              
              {selectedNode.data.agent?.id === 'vectorization_agent' && (
                <>
                  <Form.Item label="块大小" name="chunk_size">
                    <Input type="number" placeholder="2000" />
                  </Form.Item>
                  <Form.Item label="重叠大小" name="overlap">
                    <Input type="number" placeholder="200" />
                  </Form.Item>
                  <Form.Item label="工作线程数" name="max_workers">
                    <Input type="number" placeholder="4" />
                  </Form.Item>
                </>
              )}
              
              <Form.Item label="自定义参数（JSON）" name="custom_params">
                <Input.TextArea rows={4} placeholder="{}" />
              </Form.Item>
            </Form>
          </>
        )}
      </Drawer>

      {/* 模板选择弹窗 */}
      <Modal
        title="选择工作流模板"
        visible={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card
            hoverable
            onClick={() => loadTemplate('document_knowledge_extraction')}
          >
            <Space>
              <span style={{ fontSize: 32 }}>🧠</span>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                  智能文档知识提取
                </div>
                <div style={{ color: '#666' }}>
                  从文档中自动提取知识，构建知识图谱并向量化存储
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Tag color="blue">文档处理</Tag>
                  <Tag color="green">知识图谱</Tag>
                  <Tag color="orange">向量化</Tag>
                </Space>
              </div>
            </Space>
          </Card>
          
          <Card
            hoverable
            onClick={() => loadTemplate('building_code_check')}
          >
            <Space>
              <span style={{ fontSize: 32 }}>⚖️</span>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                  建筑规范审查
                </div>
                <div style={{ color: '#666' }}>
                  自动检查建筑设计是否符合相关规范和标准
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Tag color="red">规则引擎</Tag>
                  <Tag color="purple">合规性</Tag>
                </Space>
              </div>
            </Space>
          </Card>
          
          <Card
            hoverable
            onClick={() => loadTemplate('smart_qa')}
          >
            <Space>
              <span style={{ fontSize: 32 }}>💬</span>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                  智能问答系统
                </div>
                <div style={{ color: '#666' }}>
                  基于知识库的智能问答，支持多轮对话
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Tag color="cyan">检索增强</Tag>
                  <Tag color="magenta">对话管理</Tag>
                </Space>
              </div>
            </Space>
          </Card>
        </Space>
      </Modal>
    </div>
  )
}

// 包装组件
const WorkflowDesignerWrapper: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowDesigner />
    </ReactFlowProvider>
  )
}

export default WorkflowDesignerWrapper