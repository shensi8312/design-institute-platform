const { spawn } = require('child_process')
const path = require('path')

/**
 * 几何处理服务
 * 调用Python脚本处理DXF/SHP文件和几何计算
 */
class GeometryProcessingService {
  constructor() {
    this.pythonScript = path.join(__dirname, '../../python/geometry_processor.py')
  }

  /**
   * 调用Python脚本
   * @param {Object} params - 参数对象
   * @returns {Promise<Object>} 结果
   */
  async callPython(params) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScript])

      let stdoutData = ''
      let stderrData = ''

      // 发送输入
      python.stdin.write(JSON.stringify(params))
      python.stdin.end()

      // 收集输出
      python.stdout.on('data', (data) => {
        stdoutData += data.toString()
      })

      python.stderr.on('data', (data) => {
        stderrData += data.toString()
      })

      python.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python script exited with code ${code}: ${stderrData}`))
        }

        try {
          const result = JSON.parse(stdoutData)
          resolve(result)
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${stdoutData}`))
        }
      })

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`))
      })
    })
  }

  /**
   * 解析DXF文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseDXF(filePath) {
    try {
      const result = await this.callPython({
        operation: 'parse_dxf',
        file_path: filePath
      })

      return result
    } catch (error) {
      console.error('DXF解析失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 解析SHP文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseSHP(filePath) {
    try {
      const result = await this.callPython({
        operation: 'parse_shp',
        file_path: filePath
      })

      return result
    } catch (error) {
      console.error('SHP解析失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 计算红线退距
   * @param {Array} boundaryCoords - 边界坐标 [[x1, y1], [x2, y2], ...]
   * @param {number} distance - 退距距离（米）
   * @returns {Promise<Object>} 计算结果
   */
  async calculateSetback(boundaryCoords, distance) {
    try {
      const result = await this.callPython({
        operation: 'calculate_setback',
        boundary_coords: boundaryCoords,
        distance: distance
      })

      return result
    } catch (error) {
      console.error('退距计算失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 计算多边退距
   * @param {Array} boundaryCoords - 边界坐标
   * @param {Object} setbacks - 各边退距 {north: 10, south: 15, east: 20, west: 5}
   * @returns {Promise<Object>} 计算结果
   */
  async calculateMultipleSetbacks(boundaryCoords, setbacks) {
    try {
      const result = await this.callPython({
        operation: 'calculate_multiple_setbacks',
        boundary_coords: boundaryCoords,
        setbacks: setbacks
      })

      return result
    } catch (error) {
      console.error('多边退距计算失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 从DXF/SHP文件计算场地退距
   * @param {string} filePath - 文件路径
   * @param {Object} setbackRules - 退距规则
   * @returns {Promise<Object>} 结果
   */
  async calculateSiteSetbackFromFile(filePath, setbackRules) {
    try {
      // 1. 解析文件
      let parseResult
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.dxf') {
        parseResult = await this.parseDXF(filePath)
      } else if (ext === '.shp') {
        parseResult = await this.parseSHP(filePath)
      } else {
        return {
          success: false,
          error: `Unsupported file format: ${ext}`
        }
      }

      if (!parseResult.success) {
        return parseResult
      }

      // 2. 对每个边界计算退距
      const results = []

      for (const boundary of parseResult.boundaries) {
        // 应用退距规则
        const setbackDistance = setbackRules.distance || 10

        const setbackResult = await this.calculateSetback(
          boundary.coordinates,
          setbackDistance
        )

        if (setbackResult.success) {
          results.push({
            original_boundary: boundary,
            setback_result: setbackResult,
            rules_applied: setbackRules
          })
        }
      }

      return {
        success: true,
        file_path: filePath,
        total_boundaries: parseResult.boundaries.length,
        results: results
      }
    } catch (error) {
      console.error('从文件计算退距失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 生成建筑轮廓
   * @param {Object} buildingParams - 建筑参数
   * @returns {Promise<Object>} 建筑轮廓
   */
  async generateBuildingFootprint(buildingParams) {
    try {
      const {
        site_boundary,
        setback_distance,
        building_area,
        aspect_ratio = 1.5  // 长宽比
      } = buildingParams

      // 1. 计算退距后的可用区域
      const setbackResult = await this.calculateSetback(
        site_boundary,
        setback_distance
      )

      if (!setbackResult.success) {
        return setbackResult
      }

      // 2. 在可用区域内生成矩形建筑轮廓
      const availableArea = setbackResult.offset_polygon.area

      if (building_area > availableArea) {
        return {
          success: false,
          error: `Required building area (${building_area}m²) exceeds available area (${availableArea.toFixed(2)}m²) after setback`
        }
      }

      // 计算建筑尺寸
      const width = Math.sqrt(building_area / aspect_ratio)
      const length = width * aspect_ratio

      // 计算可用区域的中心点
      const offsetCoords = setbackResult.offset_polygon.coordinates
      const centerX = offsetCoords.reduce((sum, coord) => sum + coord[0], 0) / offsetCoords.length
      const centerY = offsetCoords.reduce((sum, coord) => sum + coord[1], 0) / offsetCoords.length

      // 生成矩形建筑轮廓（居中）
      const buildingFootprint = [
        [centerX - length / 2, centerY - width / 2],
        [centerX + length / 2, centerY - width / 2],
        [centerX + length / 2, centerY + width / 2],
        [centerX - length / 2, centerY + width / 2],
        [centerX - length / 2, centerY - width / 2]  // 闭合
      ]

      return {
        success: true,
        site_boundary: site_boundary,
        setback_boundary: setbackResult.offset_polygon.coordinates,
        building_footprint: buildingFootprint,
        dimensions: {
          length: length.toFixed(2),
          width: width.toFixed(2),
          area: building_area,
          aspect_ratio: aspect_ratio
        },
        center: {
          x: centerX.toFixed(2),
          y: centerY.toFixed(2)
        }
      }
    } catch (error) {
      console.error('生成建筑轮廓失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = GeometryProcessingService
