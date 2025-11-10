import React, { useEffect, useRef, useState } from 'react'
import { Button, Spin } from 'antd'
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import axios from '../utils/axios'

interface ThreeModelViewerProps {
  modelUrl: string
  modelFormat: string
  onError?: (error: Error) => void
}

const ThreeModelViewer: React.FC<ThreeModelViewerProps> = ({
  modelUrl,
  modelFormat,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    )
    camera.position.set(200, 200, 200)
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

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(200, 200, 200)
    scene.add(directionalLight)

    const gridHelper = new THREE.GridHelper(500, 50, 0xcccccc, 0xeeeeee)
    scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(100)
    scene.add(axesHelper)

    loadModel(scene, camera, controls)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      controls.dispose()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  const loadModel = async (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls
  ) => {
    setLoading(true)
    setError(null)

    try {
      // 先通过axios获取文件（会自动带token）
      const response = await axios.get(modelUrl, {
        responseType: 'blob'
      })

      const blob = response.data
      const blobUrl = URL.createObjectURL(blob)
      objectUrlRef.current = blobUrl

      let geometry: THREE.BufferGeometry | undefined

      const format = modelFormat.toLowerCase()

      if (format === 'stl') {
        const loader = new STLLoader()
        geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
          loader.load(
            blobUrl,
            (geo) => resolve(geo),
            undefined,
            (err) => reject(err)
          )
        })
      } else if (format === 'obj') {
        const loader = new OBJLoader()
        const object = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(
            blobUrl,
            (obj) => resolve(obj),
            undefined,
            (err) => reject(err)
          )
        })

        if (modelRef.current) {
          scene.remove(modelRef.current)
        }

        modelRef.current = object
        scene.add(object)

        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = camera.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
        cameraZ *= 1.5

        camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
        camera.lookAt(center)
        controls.target.copy(center)
        controls.update()

        setLoading(false)
        return
      } else {
        throw new Error(`不支持的文件格式: ${format}。当前仅支持 STL 和 OBJ 格式。`)
      }

      if (geometry) {
        if (modelRef.current) {
          scene.remove(modelRef.current)
        }

        const material = new THREE.MeshPhongMaterial({
          color: 0x00a0ff,
          specular: 0x111111,
          shininess: 200,
          side: THREE.DoubleSide
        })

        const mesh = new THREE.Mesh(geometry, material)
        modelRef.current = mesh
        scene.add(mesh)

        geometry.computeBoundingBox()
        const boundingBox = geometry.boundingBox!
        const center = new THREE.Vector3()
        boundingBox.getCenter(center)
        const size = new THREE.Vector3()
        boundingBox.getSize(size)

        mesh.geometry.center()

        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = camera.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
        cameraZ *= 1.5

        camera.position.set(cameraZ, cameraZ, cameraZ)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()
      }

      setLoading(false)
    } catch (err: any) {
      console.error('加载3D模型失败:', err)
      setError(err.message || '加载模型失败')
      setLoading(false)
      onError?.(err)
    }
  }

  const handleReset = () => {
    if (!cameraRef.current || !controlsRef.current || !sceneRef.current) return

    loadModel(sceneRef.current, cameraRef.current, controlsRef.current)
  }

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '500px'
        }}
      />

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}
        >
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>加载3D模型中...</div>
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
            color: '#ff4d4f'
          }}
        >
          <div>加载失败: {error}</div>
          <Button type="primary" onClick={handleReset} style={{ marginTop: 16 }}>
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
    </div>
  )
}

export default ThreeModelViewer
