import React, { useEffect, useRef, useState } from 'react'
import { Button, Spin, message, Tag } from 'antd'
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import axios from '../utils/axios'

interface AssemblyPart {
  partNumber: string
  name: string
  type: string
  modelPath: string | null
  modelFormat: string | null
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  needsConversion?: boolean
  stepFile?: string | null
}

interface AssemblyConstraint {
  type: string
  partA: string
  partB: string
  confidence: number
}

interface AssemblyViewer3DProps {
  taskId: string
}

const AssemblyViewer3D: React.FC<AssemblyViewer3DProps> = ({ taskId }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<AssemblyPart[]>([])
  const [constraints, setConstraints] = useState<AssemblyConstraint[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    initScene()
    loadAssemblyData()

    return () => {
      cleanup()
    }
  }, [taskId])

  const initScene = () => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      1,
      5000
    )
    camera.position.set(400, 400, 400)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight1.position.set(300, 300, 300)
    scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-300, 200, -300)
    scene.add(directionalLight2)

    const gridHelper = new THREE.GridHelper(1000, 20, 0xcccccc, 0xeeeeee)
    scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(150)
    scene.add(axesHelper)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)
  }

  const loadAssemblyData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/assembly/${taskId}/visualization`)
      const { parts, constraints, stats } = response.data.data

      setParts(parts)
      setConstraints(constraints)
      setStats(stats)

      // 渲染零件（使用占位符）
      renderPartsAsPlaceholders(parts, constraints)

      message.success(`装配加载成功: ${stats.totalParts}个零件, ${stats.constraintsCount}个约束`)
      setLoading(false)
    } catch (err: any) {
      console.error('加载装配数据失败:', err)
      setError(err.response?.data?.message || '加载装配数据失败')
      setLoading(false)
    }
  }

  /**
   * 渲染零件：优先加载STL模型，无法加载则使用彩色占位符
   */
  const renderPartsAsPlaceholders = (parts: AssemblyPart[], constraints: AssemblyConstraint[]) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current

    // 清除旧的零件模型
    scene.children = scene.children.filter(
      child => !(child as any).userData?.isPart && !(child as any).userData?.isLabel && !(child as any).userData?.isConnection
    )

    // 为每个零件创建占位符或加载模型
    parts.forEach((part, index) => {
      if (part.modelPath && part.modelFormat === 'stl') {
        // 有STL文件，加载实际模型
        loadActualModel(part)
      } else {
        // 无STL文件，使用彩色占位符
        renderPlaceholder(part)
      }
    })

    // 绘制约束连线
    renderConstraintLines(parts, constraints)

    console.log(`[Assembly3D] ✅ 渲染了 ${parts.length} 个零件和 ${constraints.length} 条约束连线`)
  }

  /**
   * 加载实际的STL模型文件
   */
  const loadActualModel = async (part: AssemblyPart) => {
    if (!sceneRef.current || !part.modelPath) return

    const scene = sceneRef.current
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')

    try {
      const response = await axios.get(part.modelPath, { responseType: 'blob' })
      const blob = response.data
      const blobUrl = URL.createObjectURL(blob)

      const loader = new STLLoader()
      loader.load(blobUrl, (geometry) => {
        const color = getColorByPartType(part.type)
        const material = new THREE.MeshPhongMaterial({
          color,
          opacity: 0.9,
          transparent: true,
          shininess: 50
        })

        const mesh = new THREE.Mesh(geometry, material)

        // 缩放到合适大小（STEP文件单位可能是mm）
        const box = new THREE.Box3().setFromGeometry(geometry)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 40 / maxDim  // 缩放到40单位大小
        mesh.scale.set(scale, scale, scale)

        mesh.position.set(part.position.x, part.position.y, part.position.z)
        mesh.userData = { isPart: true, partNumber: part.partNumber, partData: part }

        scene.add(mesh)

        // 添加标签
        addLabel(part)

        URL.revokeObjectURL(blobUrl)
      })
    } catch (error) {
      console.error(`加载STL失败: ${part.partNumber}`, error)
      // 加载失败，使用占位符
      renderPlaceholder(part)
    }
  }

  /**
   * 渲染彩色占位符（方块）
   */
  const renderPlaceholder = (part: AssemblyPart) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    const geometry = new THREE.BoxGeometry(40, 40, 40)

    // 根据零件类型选择颜色
    const color = getColorByPartType(part.type)
    const material = new THREE.MeshPhongMaterial({
      color,
      opacity: 0.85,
      transparent: true,
      shininess: 30
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(part.position.x, part.position.y, part.position.z)
    mesh.userData = { isPart: true, partNumber: part.partNumber, partData: part }

    // 添加边框
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    mesh.add(wireframe)

    scene.add(mesh)

    // 添加标签
    addLabel(part)
  }

  /**
   * 添加文字标签
   */
  const addLabel = (part: AssemblyPart) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 512
    canvas.height = 128
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#cccccc'
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    context.fillStyle = '#333333'
    context.font = 'bold 32px Arial'
    context.textAlign = 'center'
    context.fillText(part.partNumber, canvas.width / 2, 48)
    context.font = '24px Arial'
    context.fillStyle = '#666666'
    const truncatedName = part.name.length > 20 ? part.name.substring(0, 20) + '...' : part.name
    context.fillText(truncatedName, canvas.width / 2, 88)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.set(part.position.x, part.position.y + 35, part.position.z)
    sprite.scale.set(80, 20, 1)
    sprite.userData = { isLabel: true }

    scene.add(sprite)
  }

  const renderConstraintLines = (parts: AssemblyPart[], constraints: AssemblyConstraint[]) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current

    constraints.forEach(constraint => {
      const partA = parts.find(p => p.partNumber === constraint.partA)
      const partB = parts.find(p => p.partNumber === constraint.partB)

      if (!partA || !partB) return

      const points = [
        new THREE.Vector3(partA.position.x, partA.position.y, partA.position.z),
        new THREE.Vector3(partB.position.x, partB.position.y, partB.position.z)
      ]

      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const color = getColorByConstraintType(constraint.type)
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        opacity: 0.6,
        transparent: true
      })
      const line = new THREE.Line(geometry, material)
      line.userData = { isConnection: true, constraint }

      scene.add(line)
    })
  }

  const getColorByPartType = (type: string): number => {
    const colorMap: { [key: string]: number } = {
      PNEUMATIC_VALVE: 0x4CAF50,     // 绿色
      MANUAL_VALVE: 0x2196F3,        // 蓝色
      MFC: 0xFF9800,                  // 橙色
      PRESSURE_REGULATOR: 0x9C27B0,  // 紫色
      FILTER: 0xFFC107,              // 黄色
      NEEDLE_VALVE: 0x00BCD4,        // 青色
      CHECK_VALVE: 0xE91E63,         // 粉红
      PRESSURE_TRANSDUCER: 0x3F51B5, // 靛蓝
      VACUUM_SWITCH: 0xFF5722        // 深橙
    }
    return colorMap[type] || 0x9E9E9E
  }

  const getColorByConstraintType = (type: string): number => {
    const colorMap: { [key: string]: number } = {
      CONCENTRIC: 0x00ff00,  // 绿色 - 同心约束
      SCREW: 0xff6600,       // 橙色 - 螺纹连接
      COINCIDENT: 0x0088ff,  // 蓝色 - 重合约束
      DISTANCE: 0xffaa00     // 黄色 - 距离约束
    }
    return colorMap[type] || 0x888888
  }

  const cleanup = () => {
    if (rendererRef.current && containerRef.current) {
      try {
        containerRef.current.removeChild(rendererRef.current.domElement)
      } catch (e) {
        // Element may already be removed
      }
      rendererRef.current.dispose()
    }
    if (controlsRef.current) {
      controlsRef.current.dispose()
    }
  }

  const handleReset = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(400, 400, 400)
      cameraRef.current.lookAt(0, 0, 0)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
    loadAssemblyData()
  }

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '600px'
        }}
      />

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '24px 32px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>加载装配数据中...</div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'white',
            padding: '24px 32px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ color: '#ff4d4f', marginBottom: 16 }}>加载失败: {error}</div>
          <Button type="primary" onClick={handleReset}>
            重试
          </Button>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 8
        }}
      >
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置视图
        </Button>
        <Button icon={<FullscreenOutlined />} onClick={handleFullscreen}>
          全屏
        </Button>
      </div>

      {stats && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            maxWidth: 200
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>装配统计</div>
          <div style={{ marginBottom: 4 }}>
            <Tag color="blue">总零件: {stats.totalParts}</Tag>
          </div>
          <div style={{ marginBottom: 4 }}>
            <Tag color="green">已匹配: {stats.matchedStepFiles}</Tag>
          </div>
          <div>
            <Tag color="purple">约束: {stats.constraintsCount}</Tag>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 12,
            color: '#666'
          }}
        >
          <div>🖱️ 左键拖动: 旋转</div>
          <div>🖱️ 右键拖动: 平移</div>
          <div>🖱️ 滚轮: 缩放</div>
        </div>
      )}

      {!loading && !error && constraints.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 12,
            maxWidth: 180
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>约束类型</div>
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: '#00ff00' }}>●</span> CONCENTRIC
          </div>
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: '#ff6600' }}>●</span> SCREW
          </div>
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: '#0088ff' }}>●</span> COINCIDENT
          </div>
        </div>
      )}
    </div>
  )
}

export default AssemblyViewer3D
