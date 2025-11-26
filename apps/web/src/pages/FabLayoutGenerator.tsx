import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, Form, InputNumber, Select, Button, Row, Col, Space, message, Spin, Descriptions, Tag, Divider, Alert, Slider } from 'antd'
import { ThunderboltOutlined, DownloadOutlined, ReloadOutlined, AreaChartOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined } from '@ant-design/icons'
import axios from '../utils/axios'

interface LayoutResult {
  success: boolean
  layout?: {
    site?: {
      boundary: Array<{ x: number; y: number }>
      boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
    }
    setbacks?: Array<{
      direction: string
      distance: number
      reason: string
    }>
    buildable_area?: {
      minX: number; maxX: number; minY: number; maxY: number
      polygon: Array<{ x: number; y: number }>
    }
    zones?: Array<{
      id: string
      type: string
      name: string
      x: number
      y: number
      width: number
      height: number
      area: number
      color: string
    }>
    buildings?: Array<{
      id: string
      type: string
      name: string
      geometry: { x: number; y: number; width: number; depth: number; height: number }
      area: number
      footprint: number
      color: string
    }>
    roads?: Array<{
      id: string
      name: string
      type: string
      geometry: { type: string; points?: Array<{ x: number; y: number }>; width: number }
      color: string
    }>
    greenSpaces?: Array<{
      id: string
      name: string
      type: string
      geometry: { type: string; x?: number; y?: number; width?: number; depth?: number }
      area: number
      color: string
    }>
    green_spaces?: Array<{
      id: string
      name: string
      type: string
      geometry: { type: string; x?: number; y?: number; width?: number; depth?: number }
      area: number
      color: string
    }>
    parking?: Array<{
      id: string
      name: string
      type: string
      geometry: { x: number; y: number; width: number; depth: number }
      area: number
      color: string
      properties?: { spaces: number; charging_stations?: number }
    }>
    pedestrianPaths?: Array<{
      id: string
      name: string
      geometry: { type?: string; points: Array<{ x: number; y: number }>; width: number }
      color: string
    }>
    pedestrian_paths?: Array<{
      id: string
      name: string
      geometry: { type?: string; points: Array<{ x: number; y: number }>; width: number }
      color: string
    }>
    crosswalks?: Array<{
      id: string
      name: string
      geometry: { x: number; y: number; width: number; height: number; rotation?: number }
    }>
  }
  areas?: Record<string, { value: number; name?: string; formula?: string; unit?: string }>
  um_table?: Record<string, any>
  error?: string
}

const FabLayoutGenerator: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LayoutResult | null>(null)

  // 缩放和平移状态
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const svgContainerRef = useRef<HTMLDivElement>(null)

  // 生成布局
  const handleGenerate = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      setResult(null)

      const response = await axios.post('/api/fab-layout/generate', {
        site: {
          boundary: [
            { x: 0, y: 0 },
            { x: values.site_width, y: 0 },
            { x: values.site_width, y: values.site_height },
            { x: 0, y: values.site_height }
          ]
        },
        project: {
          chips_per_month: values.chips_per_month,
          cleanroom_area: values.cleanroom_area,
          technology_node: values.technology_node,
          process_type: values.process_type
        },
        options: {
          generateMultiple: values.generate_count > 1,
          count: values.generate_count
        }
      })

      if (response.data.success) {
        setResult(response.data)
        message.success('布局生成成功！')
      } else {
        message.error(response.data.error || '生成失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  // 下载JSON
  const handleDownload = () => {
    if (!result) return

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fab_layout_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已下载布局文件，可导入Revit使用')
  }

  // 缩放控制
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.min(5, Math.max(0.2, prev + delta)))
  }, [])

  const handleZoomIn = () => setZoom(prev => Math.min(5, prev + 0.2))
  const handleZoomOut = () => setZoom(prev => Math.max(0.2, prev - 0.2))
  const handleResetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // 平移控制
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }, [panOffset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
  }, [])

  // 渲染布局预览 (SVG)
  const renderLayoutPreview = () => {
    const layout = result?.layout
    if (!layout) return null

    // 优先使用 buildings，如果没有则使用 zones
    let buildings = layout?.buildings || layout?.zones
    if (!buildings || buildings.length === 0) return null

    // 过滤掉地下层建筑（Sub-FAB是洁净室下层，不应在2D平面图显示）
    buildings = buildings.filter((b: any) => {
      const z = b.geometry?.z ?? b.z ?? 0
      const isUnderground = b.id === 'subfab' || b.type === 'subfab' || z < 0
      return !isUnderground
    })

    // 从 geometry 或直接属性获取坐标
    const getX = (b: any) => b.geometry?.x ?? b.x ?? 0
    const getY = (b: any) => b.geometry?.y ?? b.y ?? 0
    const getW = (b: any) => b.geometry?.width ?? b.width ?? 50
    const getD = (b: any) => b.geometry?.depth ?? b.height ?? 50

    // 获取场地尺寸
    const site = layout?.site
    const siteWidth = site?.boundingBox?.width || Math.max(...buildings.map((b: any) => getX(b) + getW(b)))
    const siteHeight = site?.boundingBox?.height || Math.max(...buildings.map((b: any) => getY(b) + getD(b)))
    const scale = 500 / Math.max(siteWidth, siteHeight)

    // 退线距离
    const setbacks = layout?.setbacks || []
    const buildableArea = layout?.buildable_area

    // 道路
    const roads = layout?.roads || []
    // 绿化 (API returns green_spaces in snake_case)
    const greenSpaces = (layout as any)?.green_spaces || layout?.greenSpaces || []
    // 停车场
    const parking = layout?.parking || []
    // 人行道 (API returns pedestrian_paths in snake_case)
    const pedestrianPaths = (layout as any)?.pedestrian_paths || layout?.pedestrianPaths || []

    // 斑马线
    const crosswalks = layout?.crosswalks || []

    // 图例高度
    const legendHeight = 30
    const svgWidth = siteWidth * scale + 60
    const svgHeight = siteHeight * scale + 60 + legendHeight

    return (
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ border: '1px solid #d9d9d9', background: '#fafafa' }}
      >
        <defs>
          {/* 虚线模式（退线） */}
          <pattern id="setbackPattern" width="10" height="10" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="10" y2="10" stroke="#1890ff" strokeWidth="1"/>
          </pattern>
        </defs>

        <g transform="translate(30, 30)">
          {/* 0. 场地底色 - 硬化地面/道路基底 */}
          <rect
            x={0}
            y={0}
            width={siteWidth * scale}
            height={siteHeight * scale}
            fill="#D4D4D4"
            stroke="none"
          />

          {/* 1. 场地边界 (红线) */}
          <rect
            x={0}
            y={0}
            width={siteWidth * scale}
            height={siteHeight * scale}
            fill="none"
            stroke="#ff4d4f"
            strokeWidth="2"
            strokeDasharray="10,5"
          />
          <text x={siteWidth * scale / 2} y={-8} textAnchor="middle" fontSize="10" fill="#ff4d4f">
            用地红线 {siteWidth}m × {siteHeight}m
          </text>

          {/* 2. 退线（蓝色虚线） */}
          {buildableArea && (
            <rect
              x={buildableArea.minX * scale}
              y={buildableArea.minY * scale}
              width={(buildableArea.maxX - buildableArea.minX) * scale}
              height={(buildableArea.maxY - buildableArea.minY) * scale}
              fill="none"
              stroke="#1890ff"
              strokeWidth="1.5"
              strokeDasharray="8,4"
            />
          )}
          {setbacks.map((sb: any, idx: number) => (
            <text
              key={idx}
              x={sb.direction === 'west' ? 5 : sb.direction === 'east' ? siteWidth * scale - 5 : siteWidth * scale / 2}
              y={sb.direction === 'north' ? sb.distance * scale + 12 : sb.direction === 'south' ? siteHeight * scale - sb.distance * scale - 5 : siteHeight * scale / 2}
              textAnchor={sb.direction === 'west' ? 'start' : sb.direction === 'east' ? 'end' : 'middle'}
              fontSize="8"
              fill="#1890ff"
            >
              退{sb.distance}m
            </text>
          ))}

          {/* 3. 绿化带（底层渲染） */}
          {greenSpaces.map((green: any, idx: number) => {
            if (green.geometry.type === 'perimeter') {
              // 周边绿化 - 沿边界绘制
              const w = green.geometry.width || 5
              return (
                <g key={`green-${idx}`}>
                  {/* 四边绿化带 */}
                  <rect x={0} y={0} width={siteWidth * scale} height={w * scale} fill={green.color || '#90EE90'} opacity={0.6}/>
                  <rect x={0} y={(siteHeight - w) * scale} width={siteWidth * scale} height={w * scale} fill={green.color || '#90EE90'} opacity={0.6}/>
                  <rect x={0} y={0} width={w * scale} height={siteHeight * scale} fill={green.color || '#90EE90'} opacity={0.6}/>
                  <rect x={(siteWidth - w) * scale} y={0} width={w * scale} height={siteHeight * scale} fill={green.color || '#90EE90'} opacity={0.6}/>
                </g>
              )
            } else if (green.geometry.type === 'box' && green.geometry.x !== undefined) {
              return (
                <g key={`green-${idx}`}>
                  <rect
                    x={green.geometry.x * scale}
                    y={green.geometry.y * scale}
                    width={(green.geometry.width || 20) * scale}
                    height={(green.geometry.depth || 15) * scale}
                    fill={green.color || '#90EE90'}
                    stroke="#228B22"
                    strokeWidth="0.5"
                    opacity={0.7}
                  />
                  <text
                    x={(green.geometry.x + (green.geometry.width || 20) / 2) * scale}
                    y={(green.geometry.y + (green.geometry.depth || 15) / 2) * scale}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    fill="#006400"
                  >
                    🌿{green.name}
                  </text>
                </g>
              )
            }
            return null
          })}

          {/* 4. 道路 */}
          {roads.map((road: any, idx: number) => {
            const points = road.geometry.points || []
            const roadWidth = (road.geometry.width || 6) * scale

            if (road.geometry.type === 'line' && points.length >= 2) {
              // 直线道路
              return (
                <g key={`road-${idx}`}>
                  <line
                    x1={points[0].x * scale}
                    y1={points[0].y * scale}
                    x2={points[1].x * scale}
                    y2={points[1].y * scale}
                    stroke={road.color || '#A0A0A0'}
                    strokeWidth={roadWidth}
                    strokeLinecap="round"
                  />
                  {/* 道路中线 */}
                  <line
                    x1={points[0].x * scale}
                    y1={points[0].y * scale}
                    x2={points[1].x * scale}
                    y2={points[1].y * scale}
                    stroke="#FFD700"
                    strokeWidth="1"
                    strokeDasharray="10,5"
                  />
                </g>
              )
            } else if (road.geometry.type === 'polygon' && points.length >= 4) {
              // 环形道路
              const pathData = points.map((p: any, i: number) =>
                `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`
              ).join(' ') + ' Z'
              return (
                <g key={`road-${idx}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={road.color || '#A0A0A0'}
                    strokeWidth={roadWidth}
                    strokeLinejoin="round"
                  />
                </g>
              )
            }
            return null
          })}

          {/* 5. 人行道 */}
          {pedestrianPaths.map((path: any, idx: number) => {
            const points = path.geometry.points || []
            if (points.length >= 2) {
              const pathData = points.map((p: any, i: number) =>
                `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`
              ).join(' ')
              return (
                <path
                  key={`ped-${idx}`}
                  d={pathData}
                  fill="none"
                  stroke={path.color || '#E0E0E0'}
                  strokeWidth={(path.geometry.width || 2) * scale}
                  strokeLinecap="round"
                />
              )
            }
            return null
          })}

          {/* 6. 停车场 */}
          {parking.map((p: any, idx: number) => (
            <g key={`parking-${idx}`}>
              <rect
                x={p.geometry.x * scale}
                y={p.geometry.y * scale}
                width={p.geometry.width * scale}
                height={p.geometry.depth * scale}
                fill={p.color || '#E8E8E8'}
                stroke="#888"
                strokeWidth="0.5"
              />
              {/* 停车位线条 */}
              {Array.from({ length: Math.floor(p.geometry.width / 3) }).map((_, i) => (
                <line
                  key={i}
                  x1={(p.geometry.x + i * 3 + 1.5) * scale}
                  y1={p.geometry.y * scale}
                  x2={(p.geometry.x + i * 3 + 1.5) * scale}
                  y2={(p.geometry.y + p.geometry.depth) * scale}
                  stroke="#ccc"
                  strokeWidth="0.5"
                />
              ))}
              <text
                x={(p.geometry.x + p.geometry.width / 2) * scale}
                y={(p.geometry.y + p.geometry.depth / 2) * scale}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fill="#666"
              >
                🅿️{p.name}
              </text>
              <text
                x={(p.geometry.x + p.geometry.width / 2) * scale}
                y={(p.geometry.y + p.geometry.depth / 2 + 10) * scale}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fill="#888"
              >
                {p.properties?.spaces || 0}车位
                {p.properties?.charging_stations ? ` · ⚡${p.properties.charging_stations}充电桩` : ''}
              </text>
            </g>
          ))}

          {/* 7. 建筑物（最顶层） */}
          {buildings.map((building: any, idx: number) => {
            const x = getX(building)
            const y = getY(building)
            const w = getW(building)
            const d = getD(building)
            return (
              <g key={building.id || idx}>
                <rect
                  x={x * scale}
                  y={y * scale}
                  width={w * scale}
                  height={d * scale}
                  fill={building.color || '#ccc'}
                  stroke="#333"
                  strokeWidth="1"
                  opacity="0.9"
                />
                <text
                  x={(x + w / 2) * scale}
                  y={(y + d / 2) * scale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#000"
                  fontWeight="bold"
                >
                  {building.name}
                </text>
                <text
                  x={(x + w / 2) * scale}
                  y={(y + d / 2) * scale + 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="7"
                  fill="#333"
                >
                  {(building.area || building.footprint)?.toLocaleString()}㎡
                </text>
              </g>
            )
          })}

          {/* 6. 斑马线 */}
          {crosswalks.map((cw: any, idx: number) => {
            const g = cw.geometry
            const stripeCount = Math.floor(g.width / 1.2)
            const stripeWidth = g.width / stripeCount * 0.5
            return (
              <g key={`crosswalk-${idx}`} transform={`translate(${g.x * scale}, ${g.y * scale}) rotate(${g.rotation || 0})`}>
                {/* 白色条纹 */}
                {Array.from({ length: stripeCount }).map((_, i) => (
                  <rect
                    key={i}
                    x={i * (g.width / stripeCount) * scale}
                    y={0}
                    width={stripeWidth * scale}
                    height={g.height * scale}
                    fill="white"
                  />
                ))}
              </g>
            )
          })}

          {/* 图例（底部横向） */}
          <g transform={`translate(0, ${siteHeight * scale + 10})`}>
            <text x={0} y={0} fontSize="9" fontWeight="bold">图例：</text>
            {/* 第一行 */}
            <rect x={35} y={-6} width={10} height={6} fill="none" stroke="#ff4d4f" strokeWidth="1" strokeDasharray="2,1"/>
            <text x={48} y={0} fontSize="7">红线</text>
            <rect x={70} y={-6} width={10} height={6} fill="none" stroke="#1890ff" strokeWidth="1" strokeDasharray="2,1"/>
            <text x={83} y={0} fontSize="7">退线</text>
            <rect x={105} y={-6} width={10} height={6} fill="#D4D4D4"/>
            <text x={118} y={0} fontSize="7">地面</text>
            <rect x={140} y={-6} width={10} height={6} fill="#90EE90" opacity={0.7}/>
            <text x={153} y={0} fontSize="7">绿化</text>
            <rect x={175} y={-6} width={10} height={6} fill="#A0A0A0"/>
            <text x={188} y={0} fontSize="7">道路</text>
            <rect x={210} y={-6} width={10} height={6} fill="#E8E8E8" stroke="#888" strokeWidth="0.3"/>
            <text x={223} y={0} fontSize="7">停车</text>
            <rect x={245} y={-6} width={10} height={6} fill="#E0E0E0"/>
            <text x={258} y={0} fontSize="7">人行道</text>
            <g transform="translate(290, -6)">
              <rect x={0} y={0} width={10} height={6} fill="#A0A0A0"/>
              <rect x={1} y={0} width={1.5} height={6} fill="white"/>
              <rect x={4} y={0} width={1.5} height={6} fill="white"/>
              <rect x={7} y={0} width={1.5} height={6} fill="white"/>
            </g>
            <text x={303} y={0} fontSize="7">斑马线</text>
          </g>
        </g>
      </svg>
    )
  }

  // 渲染面积统计
  const renderAreaStats = () => {
    if (!result?.areas) return null

    const areas = result.areas
    const summary = areas._summary as any

    return (
      <Descriptions column={2} bordered size="small">
        {Object.entries(areas).map(([key, value]: [string, any]) => {
          if (key === '_summary') return null
          return (
            <Descriptions.Item key={key} label={value.name || key}>
              <Tag color="blue">{value.value?.toLocaleString()} {value.unit}</Tag>
            </Descriptions.Item>
          )
        })}
        <Descriptions.Item label="总建筑面积" span={2}>
          <Tag color="green" style={{ fontSize: 14 }}>
            {summary?.total_building_area?.toLocaleString()} ㎡
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="配置来源">
          <Tag color={summary?.config_source === 'database' ? 'green' : 'orange'}>
            {summary?.config_source === 'database' ? '数据库配置' : '默认配置'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        {/* 左侧：输入参数 */}
        <Col span={8}>
          <Card
            title={<><ThunderboltOutlined /> FAB布局生成器</>}
            extra={<Tag color="blue">强排规则 + UM表</Tag>}
          >
            <Alert
              message="数据来源"
              description="技术系数、CUB比例等参数从【工艺管理 → UM表管理】读取，强排规则从【规则管理 → 统一规则库】读取"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form form={form} layout="vertical" initialValues={{
              site_width: 300,
              site_height: 200,
              chips_per_month: 5000,
              technology_node: '28nm',
              process_type: 'logic',
              generate_count: 1
            }}>
              <Divider orientation="left">场地参数</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="site_width" label="场地宽度(m)" rules={[{ required: true }]}>
                    <InputNumber min={100} max={1000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="site_height" label="场地深度(m)" rules={[{ required: true }]}>
                    <InputNumber min={100} max={1000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">项目参数</Divider>

              <Form.Item name="chips_per_month" label="月产能(片/月)">
                <InputNumber min={1000} max={100000} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="cleanroom_area" label="洁净室面积(㎡) - 可选，留空则自动推算">
                <InputNumber min={1000} max={100000} style={{ width: '100%' }} placeholder="留空则根据月产能自动计算" />
              </Form.Item>

              <Form.Item name="technology_node" label="技术节点" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="3nm">3nm</Select.Option>
                  <Select.Option value="5nm">5nm</Select.Option>
                  <Select.Option value="7nm">7nm</Select.Option>
                  <Select.Option value="14nm">14nm</Select.Option>
                  <Select.Option value="28nm">28nm (成熟制程)</Select.Option>
                  <Select.Option value="40nm">40nm</Select.Option>
                  <Select.Option value="55nm">55nm</Select.Option>
                  <Select.Option value="65nm">65nm</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="process_type" label="工艺类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="logic">逻辑芯片</Select.Option>
                  <Select.Option value="memory">存储器</Select.Option>
                  <Select.Option value="analog">模拟芯片</Select.Option>
                  <Select.Option value="mems">MEMS器件</Select.Option>
                  <Select.Option value="power">功率器件</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="generate_count" label="生成方案数量">
                <Select>
                  <Select.Option value={1}>1个方案</Select.Option>
                  <Select.Option value={3}>3个方案对比</Select.Option>
                  <Select.Option value={5}>5个方案对比</Select.Option>
                </Select>
              </Form.Item>

              <Space style={{ width: '100%' }} direction="vertical">
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleGenerate}
                  loading={loading}
                  block
                  size="large"
                >
                  生成布局方案
                </Button>

                {result?.success && (
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                    block
                  >
                    下载JSON (Revit导入)
                  </Button>
                )}
              </Space>
            </Form>
          </Card>
        </Col>

        {/* 右侧：结果预览 */}
        <Col span={16}>
          <Card
            title={<><AreaChartOutlined /> 布局预览</>}
            extra={result?.success && (
              <Button icon={<ReloadOutlined />} onClick={handleGenerate}>
                重新生成
              </Button>
            )}
          >
            <Spin spinning={loading} tip="正在生成布局方案...">
              {!result && !loading && (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <AreaChartOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>设置参数后点击"生成布局方案"</div>
                </div>
              )}

              {result?.success && (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* 缩放控制栏 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
                    <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                    <Slider
                      style={{ width: 150 }}
                      min={0.2}
                      max={5}
                      step={0.1}
                      value={zoom}
                      onChange={(v) => setZoom(v)}
                      tooltip={{ formatter: (v) => `${Math.round((v || 1) * 100)}%` }}
                    />
                    <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                    <Button icon={<FullscreenOutlined />} onClick={handleResetView}>
                      重置
                    </Button>
                    <Tag color="blue">{Math.round(zoom * 100)}%</Tag>
                  </div>

                  {/* 布局图（可缩放和拖动） */}
                  <div
                    ref={svgContainerRef}
                    style={{
                      width: '100%',
                      minHeight: 400,
                      maxHeight: 600,
                      overflow: 'auto',
                      border: '1px solid #d9d9d9',
                      borderRadius: 4,
                      background: '#fafafa',
                      cursor: isPanning ? 'grabbing' : 'grab',
                      position: 'relative'
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '100%',
                        padding: 20
                      }}
                    >
                      {renderLayoutPreview()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
                    提示：滚轮缩放，拖拽平移
                  </div>

                  <Divider>面积统计 (UM表推导)</Divider>

                  {/* 面积统计 */}
                  {renderAreaStats()}
                </Space>
              )}

              {result && !result.success && (
                <Alert
                  message="生成失败"
                  description={result.error}
                  type="error"
                  showIcon
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default FabLayoutGenerator
