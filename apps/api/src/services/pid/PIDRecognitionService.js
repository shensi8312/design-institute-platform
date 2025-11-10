const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs').promises
const os = require('os')

/**
 * PID图纸识别服务 (Node.js版本)
 * 调用Python服务进行OCR + OpenCV符号检测
 */
class PIDRecognitionService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, 'pid_recognition_cli.py')
  }

  /**
   * 识别PID图纸
   */
  async recognizePID(pdfBuffer, fileName = 'pid.pdf') {
    console.log(`🔍 [PID Recognition] 开始识别: ${fileName}`)

    try {
      // 保存PDF到临时文件
      const tempPdfPath = path.join(os.tmpdir(), `pid_${Date.now()}_${fileName}`)
      await fs.writeFile(tempPdfPath, pdfBuffer)

      // 调用Python服务
      const result = await this._callPythonService(tempPdfPath)

      // 清理临时文件
      try {
        await fs.unlink(tempPdfPath)
      } catch (err) {
        // 忽略清理错误
      }

      console.log(`  ✅ 识别完成: ${result.components.length} 个组件, ${result.connections.length} 条连接`)

      // 转换文件路径为URL
      const visualization_urls = this._convertPathsToUrls(result.visualization_images || [])

      return {
        success: true,
        components: result.components,
        connections: result.connections,
        legend: result.legend,
        page_count: result.page_count,
        visualization_urls,
        graph_analysis: result.graph_analysis
      }
    } catch (error) {
      console.error(`❌ [PID Recognition] 识别失败:`, error.message)
      throw error
    }
  }

  /**
   * 将绝对路径转换为HTTP URLs
   */
  _convertPathsToUrls(absolutePaths) {
    return absolutePaths.map(absPath => {
      // 提取 /uploads/... 部分
      const match = absPath.match(/\/uploads\/(.+)/)
      if (match) {
        return `/uploads/${match[1]}`
      }
      // 如果匹配失败,返回原路径
      console.warn(`⚠️  无法转换路径: ${absPath}`)
      return absPath
    })
  }

  /**
   * 调用Python服务
   */
  async _callPythonService(pdfPath) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScriptPath, pdfPath])

      let stdout = ''
      let stderr = ''

      python.stdout.on('data', (data) => {
        const text = data.toString()
        stdout += text

        // 实时输出日志（不包含JSON结果）
        if (!text.trim().startsWith('{')) {
          process.stdout.write(text)
        }
      })

      python.stderr.on('data', (data) => {
        stderr += data.toString()
        process.stderr.write(data)
      })

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python stderr:', stderr)
          reject(new Error(`Python service exited with code ${code}`))
          return
        }

        try {
          // 从stdout中提取JSON结果（最后一行）
          const lines = stdout.trim().split('\n')
          const jsonLine = lines[lines.length - 1]
          const result = JSON.parse(jsonLine)
          resolve(result)
        } catch (error) {
          console.error('Failed to parse Python output:', stdout.substring(0, 500))
          reject(new Error(`Failed to parse Python output: ${error.message}`))
        }
      })

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python service: ${error.message}`))
      })
    })
  }
}

module.exports = PIDRecognitionService
