/**
 * QWEN-VL 多模态 PID 识别测试脚本
 *
 * 用法:
 * node test_qwenvl_pid.js <image_path>
 *
 * 示例:
 * node test_qwenvl_pid.js ./uploads/pid_sample.png
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// QWEN-VL 配置
const QWENVL_CONFIG = {
  baseUrl: process.env.QWENVL_URL || 'http://10.10.18.2:8001',
  model: 'qwen-vl-72b',
  temperature: 0.1,  // 低温度以获得更确定的结果
  max_tokens: 2000,  // 降低输出 token，为图片留出更多空间
  // 图片处理配置
  maxImageWidth: 1024,  // 最大图片宽度
  maxImageHeight: 1024  // 最大图片高度
}

/**
 * 调整图片大小并转换为 base64
 */
async function imageToBase64(imagePath, maxWidth = 1024, maxHeight = 1024) {
  try {
    const metadata = await sharp(imagePath).metadata()
    console.log(`  原始图片尺寸: ${metadata.width}x${metadata.height}`)

    // 如果图片太大，需要调整尺寸
    let imageBuffer
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      console.log(`  调整图片尺寸至: ${maxWidth}x${maxHeight} (保持比例)`)
      imageBuffer = await sharp(imagePath)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer()
    } else {
      imageBuffer = fs.readFileSync(imagePath)
    }

    const base64 = imageBuffer.toString('base64')
    const sizeKB = (base64.length / 1024).toFixed(2)
    console.log(`  Base64 编码大小: ${sizeKB} KB`)

    return base64
  } catch (error) {
    console.error('图片处理失败:', error.message)
    // 如果 sharp 处理失败，回退到直接读取
    const imageBuffer = fs.readFileSync(imagePath)
    return imageBuffer.toString('base64')
  }
}

/**
 * 调用 QWEN-VL API 识别 PID 图纸
 */
async function recognizePIDWithQwenVL(imagePath) {
  console.log(`\n🔍 使用 QWEN-VL 识别 PID 图纸: ${imagePath}`)
  console.log(`📡 API: ${QWENVL_CONFIG.baseUrl}/v1/chat/completions`)

  try {
    // 读取并调整图片
    const imageBase64 = await imageToBase64(
      imagePath,
      QWENVL_CONFIG.maxImageWidth,
      QWENVL_CONFIG.maxImageHeight
    )
    const imageExt = path.extname(imagePath).substring(1)
    const mimeType = `image/${imageExt === 'jpg' ? 'jpeg' : imageExt}`

    // 构建提示词 - 简化版本以控制 token 数量
    const prompt = `分析此P&ID图纸，识别所有组件（仪表、阀门、设备）及其位号，以及管线连接关系。以JSON格式返回：
{
  "components": [{"id":"ID","type":"类型","tag":"位号","description":"描述"}],
  "connections": [{"from":"ID1","to":"ID2","type":"连接类型"}],
  "summary":"流程描述"
}`

    // 调用 QWEN-VL API
    console.log('\n⏳ 正在调用 QWEN-VL API...')
    const startTime = Date.now()

    const response = await axios.post(
      `${QWENVL_CONFIG.baseUrl}/v1/chat/completions`,
      {
        model: QWENVL_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: QWENVL_CONFIG.temperature,
        max_tokens: QWENVL_CONFIG.max_tokens
      },
      {
        timeout: 120000,  // 2分钟超时
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ API 调用成功 (耗时 ${elapsed}s)`)

    // 解析响应
    const result = response.data
    const content = result.choices[0].message.content

    console.log('\n📄 QWEN-VL 响应:')
    console.log('=' .repeat(80))
    console.log(content)
    console.log('=' .repeat(80))

    // 尝试提取 JSON 部分
    let structuredData = null
    try {
      // 尝试直接解析
      structuredData = JSON.parse(content)
    } catch (e) {
      // 如果直接解析失败，尝试提取 JSON 代码块
      const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/) ||
                       content.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        try {
          structuredData = JSON.parse(jsonMatch[1])
        } catch (e2) {
          console.warn('⚠️  无法解析为 JSON，返回原始文本')
        }
      }
    }

    console.log('\n📊 识别统计:')
    if (structuredData) {
      console.log(`  组件数量: ${structuredData.components?.length || 0}`)
      console.log(`  连接数量: ${structuredData.connections?.length || 0}`)
      console.log(`  图例数量: ${structuredData.legend?.length || 0}`)

      // 保存结果
      const outputPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '_qwenvl_result.json')
      fs.writeFileSync(outputPath, JSON.stringify(structuredData, null, 2), 'utf-8')
      console.log(`\n💾 结果已保存至: ${outputPath}`)
    } else {
      console.log('  (无结构化数据)')

      // 保存原始响应
      const outputPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '_qwenvl_result.txt')
      fs.writeFileSync(outputPath, content, 'utf-8')
      console.log(`\n💾 原始响应已保存至: ${outputPath}`)
    }

    // 返回结果
    return {
      success: true,
      raw_response: content,
      structured_data: structuredData,
      elapsed_time: elapsed,
      model: QWENVL_CONFIG.model
    }

  } catch (error) {
    console.error('\n❌ 识别失败:', error.message)
    if (error.response) {
      console.error('API 响应错误:', error.response.status, error.response.data)
    }
    throw error
  }
}

/**
 * 对比 QWEN-VL 和传统方法的识别效果
 */
async function compareRecognitionMethods(imagePath) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 PID 识别方法对比测试')
  console.log('='.repeat(80))

  // 方法1: QWEN-VL 多模态识别
  console.log('\n【方法1】QWEN-VL 多模态识别')
  console.log('-'.repeat(80))
  const qwenvlResult = await recognizePIDWithQwenVL(imagePath)

  // 方法2: 传统 OpenCV + OCR 方法 (如果可用)
  console.log('\n【方法2】传统 OpenCV + OCR 识别 (参考)')
  console.log('-'.repeat(80))
  console.log('当前召回率: 48%')
  console.log('识别速度: ~8秒/页')
  console.log('组件检测: 基于形状匹配 (圆形、菱形、三角形、矩形)')
  console.log('局限性: 复杂符号漏检，需要 YOLO 训练数据集')

  // 总结
  console.log('\n' + '='.repeat(80))
  console.log('📈 结论')
  console.log('='.repeat(80))
  console.log('QWEN-VL 优势:')
  console.log('  ✅ 可直接理解图像语义，无需形状匹配')
  console.log('  ✅ 可通过提示词灵活调整识别目标')
  console.log('  ✅ 可识别更复杂的符号和文字')
  console.log('  ✅ 可提取连接关系和流程描述')
  console.log('\nQWEN-VL 劣势:')
  console.log('  ⚠️  推理速度较慢（需要 GPU）')
  console.log('  ⚠️  精确坐标定位可能不如 OpenCV')
  console.log('  ⚠️  依赖外部 API 服务')
  console.log('\n建议: 结合使用两种方法，QWEN-VL 用于初步识别，OpenCV 用于精确定位')
  console.log('='.repeat(80))
}

// 主函数
async function main() {
  const imagePath = process.argv[2]

  if (!imagePath) {
    console.error('用法: node test_qwenvl_pid.js <image_path>')
    console.error('示例: node test_qwenvl_pid.js ./uploads/pid_sample.png')
    process.exit(1)
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在 ${imagePath}`)
    process.exit(1)
  }

  try {
    await compareRecognitionMethods(imagePath)
    console.log('\n✅ 测试完成')
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = { recognizePIDWithQwenVL }
