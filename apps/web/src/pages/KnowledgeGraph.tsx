import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, message, Spin, Tabs, Space, Tag } from 'antd'
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import ForceGraph2D from 'react-force-graph-2d'
import ForceGraph3D from 'react-force-graph-3d'

const KnowledgeGraph: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [graphData, setGraphData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('2d')
  const fg2dRef = useRef<any>()
  const fg3dRef = useRef<any>()

  const loadGraphData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/graph')
      if (res.data.success) {
        const data = res.data.data

        // 确保数据格式正确
        const formattedData = {
          nodes: data.nodes?.map((node: any) => ({
            id: node.id,
            name: node.label || node.entity_name || '未命名',
            type: node.type || node.entity_type || 'default',
            val: 10,
            color: getNodeColor(node.type || node.entity_type)
          })) || [],
          links: data.links?.map((link: any) => ({
            source: link.source || link.source_node_id,
            target: link.target || link.target_node_id,
            type: link.type || link.relationship_type || 'related',
            label: link.type || link.relationship_type
          })) || []
        }

        setGraphData(formattedData)
        message.success(`图谱加载成功: ${formattedData.nodes.length}个节点, ${formattedData.links.length}个关系`)
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      'person': '#FF6B6B',
      'organization': '#4ECDC4',
      'project': '#45B7D1',
      'document': '#FFA07A',
      'concept': '#98D8C8',
      'location': '#F7DC6F',
      'event': '#BB8FCE',
      'default': '#95A5A6'
    }
    return colors[type?.toLowerCase()] || colors.default
  }

  useEffect(() => {
    loadGraphData()
  }, [])

  useEffect(() => {
    if (graphData && activeTab === '2d' && fg2dRef.current) {
      fg2dRef.current.zoomToFit(400, 50)
    }
    if (graphData && activeTab === '3d' && fg3dRef.current) {
      fg3dRef.current.zoomToFit(400, 50)
    }
  }, [graphData, activeTab])

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            知识图谱可视化
            {graphData && (
              <>
                <Tag color="blue">{graphData.nodes?.length || 0} 节点</Tag>
                <Tag color="green">{graphData.links?.length || 0} 关系</Tag>
              </>
            )}
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadGraphData}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '2d',
              label: (
                <span>
                  <EyeOutlined /> 2D视图
                </span>
              ),
              children: (
                <div style={{
                  height: 600,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  backgroundColor: '#fafafa',
                  position: 'relative'
                }}>
                  {loading ? (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <Spin tip="加载中..." />
                    </div>
                  ) : graphData && graphData.nodes.length > 0 ? (
                    <ForceGraph2D
                      ref={fg2dRef}
                      graphData={graphData}
                      nodeLabel={(node: any) => `${node.name} (${node.type})`}
                      nodeColor={(node: any) => node.color}
                      nodeRelSize={8}
                      nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                        const label = node.name
                        const fontSize = 12/globalScale
                        ctx.font = `${fontSize}px Sans-Serif`
                        const textWidth = ctx.measureText(label).width
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2)

                        // 绘制节点圆形
                        ctx.fillStyle = node.color
                        ctx.beginPath()
                        ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false)
                        ctx.fill()

                        // 绘制文字背景
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 12, bckgDimensions[0], bckgDimensions[1])

                        // 绘制文字
                        ctx.textAlign = 'center'
                        ctx.textBaseline = 'top'
                        ctx.fillStyle = '#333'
                        ctx.fillText(label, node.x, node.y + 13)
                      }}
                      nodePointerAreaPaint={(node: any, color: string, ctx: any) => {
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false)
                        ctx.fill()
                      }}
                      linkLabel={(link: any) => link.label || link.type}
                      linkWidth={2}
                      linkColor={() => '#999'}
                      linkDirectionalArrowLength={4}
                      linkDirectionalArrowRelPos={1}
                      linkCurvature={0.25}
                      onNodeClick={(node: any) => {
                        console.log('节点点击:', node)
                      }}
                      width={1200}
                      height={600}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                    }}>
                      <p>暂无图谱数据</p>
                      <p style={{ color: '#999', fontSize: 12 }}>
                        请先上传文档并等待知识图谱提取完成
                      </p>
                    </div>
                  )}
                </div>
              )
            },
            {
              key: '3d',
              label: (
                <span>
                  <EyeOutlined /> 3D视图
                </span>
              ),
              children: (
                <div style={{
                  height: 600,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  backgroundColor: '#000',
                  position: 'relative'
                }}>
                  {loading ? (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <Spin tip="加载中..." />
                    </div>
                  ) : graphData && graphData.nodes.length > 0 ? (
                    <ForceGraph3D
                      ref={fg3dRef}
                      graphData={graphData}
                      nodeLabel={(node: any) => node.name}
                      nodeColor={(node: any) => node.color}
                      nodeRelSize={6}
                      nodeResolution={16}
                      nodeVal={(node: any) => node.val}
                      linkLabel={(link: any) => link.label || link.type}
                      linkWidth={2}
                      linkColor={() => '#999'}
                      linkOpacity={0.6}
                      linkDirectionalArrowLength={4}
                      linkDirectionalArrowRelPos={1}
                      linkDirectionalArrowColor={() => '#666'}
                      linkCurvature={0.25}
                      onNodeClick={(node: any) => {
                        console.log('节点点击:', node)
                      }}
                      width={1200}
                      height={600}
                      backgroundColor="#000"
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      color: '#fff'
                    }}>
                      <p>暂无图谱数据</p>
                      <p style={{ color: '#666', fontSize: 12 }}>
                        请先上传文档并等待知识图谱提取完成
                      </p>
                    </div>
                  )}
                </div>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}

export default KnowledgeGraph
