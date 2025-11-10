#!/usr/bin/env node
/**
 * 批量上传标准文档
 * 自动扫描kb_uploads_processed文件夹并上传所有文件
 */

const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')

const API_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjE3MjgzMjIsImV4cCI6MTc2MjMzMzEyMn0.F3N5wkNpKrmww0a6jdqmZ0s3X_liLcadshnNgsPT_C4'

// 配置
const SOURCE_DIR = path.join(__dirname, '../../kb_uploads_processed')
const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt']
const BATCH_SIZE = 5  // 每批上传5个文件
const DELAY_BETWEEN_BATCHES = 3000  // 批次间延迟3秒

console.log('='.repeat(80))
console.log('📦 批量上传标准文档')
console.log('='.repeat(80))
console.log(`源目录: ${SOURCE_DIR}`)
console.log(`支持格式: ${SUPPORTED_EXTENSIONS.join(', ')}`)
console.log('='.repeat(80))

/**
 * 获取知识库ID
 */
async function getKnowledgeBaseId() {
  try {
    const response = await fetch(`${API_URL}/knowledge/bases`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    })
    const result = await response.json()

    if (result.success && result.data && result.data.length > 0) {
      return result.data[0].id
    }

    throw new Error('没有找到知识库')
  } catch (error) {
    throw new Error(`获取知识库失败: ${error.message}`)
  }
}

/**
 * 递归扫描文件夹获取所有文件
 */
function scanDirectory(dir, files = []) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      scanDirectory(fullPath, files)
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase()
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push({
          path: fullPath,
          name: item,
          size: stat.size,
          relativePath: path.relative(SOURCE_DIR, fullPath)
        })
      }
    }
  }

  return files
}

/**
 * 上传单个文件
 */
async function uploadFile(file, kbId) {
  const form = new FormData()

  form.append('file', fs.createReadStream(file.path), {
    filename: file.name,
    contentType: 'application/octet-stream'
  })
  form.append('kb_id', kbId)
  form.append('domain', 'intelligent_standards')  // 使用智能分析

  try {
    const response = await fetch(`${API_URL}/knowledge/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    })

    const result = await response.json()
    return result
  } catch (error) {
    return {
      success: false,
      message: error.message
    }
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 检查源目录
    if (!fs.existsSync(SOURCE_DIR)) {
      console.error(`❌ 源目录不存在: ${SOURCE_DIR}`)
      process.exit(1)
    }

    // 2. 扫描所有文件
    console.log('\n📂 正在扫描文件...')
    const files = scanDirectory(SOURCE_DIR)

    if (files.length === 0) {
      console.log('⚠️  没有找到可上传的文件')
      process.exit(0)
    }

    console.log(`✅ 找到 ${files.length} 个文件`)

    // 按路径分组统计
    const stats = {}
    files.forEach(file => {
      const dir = path.dirname(file.relativePath)
      if (!stats[dir]) {
        stats[dir] = { count: 0, size: 0 }
      }
      stats[dir].count++
      stats[dir].size += file.size
    })

    console.log('\n📊 文件分布:')
    Object.entries(stats).forEach(([dir, stat]) => {
      console.log(`  ${dir}: ${stat.count} 个文件, ${formatSize(stat.size)}`)
    })

    // 3. 获取知识库ID
    console.log('\n🔍 获取知识库...')
    const kbId = await getKnowledgeBaseId()
    console.log(`✅ 知识库ID: ${kbId}`)

    // 4. 询问用户确认
    console.log('\n⚠️  准备上传到以下知识库:')
    console.log(`   知识库ID: ${kbId}`)
    console.log(`   文件数量: ${files.length}`)
    console.log(`   领域类型: intelligent_standards (智能标准文档)`)
    console.log('\n按 Ctrl+C 取消，或等待 5 秒自动开始...\n')

    await new Promise(resolve => setTimeout(resolve, 5000))

    // 5. 批量上传
    console.log('🚀 开始批量上传...\n')

    const results = {
      success: 0,
      failed: 0,
      errors: []
    }

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(files.length / BATCH_SIZE)

      console.log(`\n[批次 ${batchNum}/${totalBatches}] 上传 ${batch.length} 个文件...`)
      console.log('-'.repeat(80))

      // 并行上传当前批次
      const promises = batch.map(async (file, idx) => {
        const fileNum = i + idx + 1
        const progress = `[${fileNum}/${files.length}]`

        console.log(`${progress} 📤 ${file.relativePath} (${formatSize(file.size)})`)

        const result = await uploadFile(file, kbId)

        if (result.success) {
          console.log(`${progress} ✅ 成功: ${file.name}`)
          results.success++
        } else {
          console.log(`${progress} ❌ 失败: ${result.message}`)
          results.failed++
          results.errors.push({
            file: file.relativePath,
            error: result.message
          })
        }

        return result
      })

      await Promise.all(promises)

      // 批次间延迟
      if (i + BATCH_SIZE < files.length) {
        console.log(`\n⏳ 等待 ${DELAY_BETWEEN_BATCHES / 1000} 秒后继续...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    // 6. 输出统计结果
    console.log('\n' + '='.repeat(80))
    console.log('📊 上传完成！统计结果:')
    console.log('='.repeat(80))
    console.log(`✅ 成功: ${results.success} 个`)
    console.log(`❌ 失败: ${results.failed} 个`)
    console.log(`📈 成功率: ${((results.success / files.length) * 100).toFixed(2)}%`)

    if (results.errors.length > 0) {
      console.log('\n❌ 失败文件列表:')
      results.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error.file}`)
        console.log(`     错误: ${error.error}`)
      })
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ 批量上传任务完成！')
    console.log('='.repeat(80))

    process.exit(results.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n❌ 批量上传失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行
main()
