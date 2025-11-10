/**
 * STEP文件加载和转换服务
 * 将STEP文件转换为STL格式供Three.js加载
 */

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

class STEPLoaderService {
  constructor() {
    this.stepBaseDir = path.join(__dirname, '../../../../docs/solidworks')
    this.stlCacheDir = path.join(__dirname, '../../../uploads/stl_cache')
    this.ensureCacheDir()
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.stlCacheDir)) {
      fs.mkdirSync(this.stlCacheDir, { recursive: true })
    }
  }

  async convertSTEPToSTL(stepFilename) {
    const stepPath = path.join(this.stepBaseDir, stepFilename)
    const stlFilename = stepFilename.replace('.STEP', '.stl')
    const stlPath = path.join(this.stlCacheDir, stlFilename)

    // 检查缓存
    if (fs.existsSync(stlPath)) {
      console.log(`[STEPLoader] 使用缓存: ${stlFilename}`)
      return `/stl/${stlFilename}`
    }

    // 检查STEP文件是否存在
    if (!fs.existsSync(stepPath)) {
      throw new Error(`STEP文件不存在: ${stepFilename}`)
    }

    // 使用FreeCAD命令行转换
    const freecadCmd = this.getFreecadCommand()
    if (!freecadCmd) {
      console.warn('[STEPLoader] FreeCAD未安装,使用占位STL')
      return this.createPlaceholderSTL(stepFilename)
    }

    try {
      const script = `
import FreeCAD
import Mesh
import Part

doc = FreeCAD.newDocument()
shape = Part.Shape()
shape.read("${stepPath}")
mesh = Mesh.Mesh(shape.tessellate(0.1))
mesh.write("${stlPath}")
FreeCAD.closeDocument(doc.Name)
      `.trim()

      const scriptPath = path.join(this.stlCacheDir, `convert_${Date.now()}.py`)
      fs.writeFileSync(scriptPath, script)

      await execPromise(`${freecadCmd} ${scriptPath}`, { timeout: 30000 })
      fs.unlinkSync(scriptPath)

      console.log(`[STEPLoader] ✅ 转换完成: ${stepFilename} → ${stlFilename}`)
      return `/stl/${stlFilename}`
    } catch (error) {
      console.error(`[STEPLoader] 转换失败: ${error.message}`)
      return this.createPlaceholderSTL(stepFilename)
    }
  }

  getFreecadCommand() {
    const paths = [
      '/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd',
      '/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd',
      '/usr/bin/freecadcmd',
      'freecadcmd'
    ]

    for (const cmd of paths) {
      if (fs.existsSync(cmd)) return cmd
    }

    return null
  }

  createPlaceholderSTL(stepFilename) {
    const stlFilename = stepFilename.replace('.STEP', '.stl')
    const stlPath = path.join(this.stlCacheDir, stlFilename)

    // 创建简单立方体STL占位
    const stlContent = `solid placeholder
  facet normal 0 0 1
    outer loop
      vertex 0 0 50
      vertex 50 0 50
      vertex 50 50 50
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 50
      vertex 50 50 50
      vertex 0 50 50
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 50 50 0
      vertex 50 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 50 0
      vertex 50 50 0
    endloop
  endfacet
endsolid placeholder`

    fs.writeFileSync(stlPath, stlContent)
    console.log(`[STEPLoader] 创建占位STL: ${stlFilename}`)
    return `/stl/${stlFilename}`
  }

  async getSTLUrl(modelPath) {
    if (!modelPath || !modelPath.includes('.STEP')) {
      return null
    }

    const stepFilename = path.basename(modelPath)
    return await this.convertSTEPToSTL(stepFilename)
  }
}

module.exports = new STEPLoaderService()
