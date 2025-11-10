#!/usr/bin/env node
/**
 * 批量上传测试版本 - 只上传前10个文件
 */

const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')

const API_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjE3MjgzMjIsImV4cCI6MTc2MjMzMzEyMn0.F3N5wkNpKrmww0a6jdqmZ0s3X_liLcadshnNgsPT_C4'
const SOURCE_DIR = path.join(__dirname, '../../kb_uploads_processed')
const TEST_LIMIT = 10  // 只上传10个文件测试

console.log('='.repeat(60))
console.log('🧪 批量上传测试 (前10个文件)')
console.log('='.repeat(60))

async function getKnowledgeBaseId() {
  const response = await fetch(`${API_URL}/knowledge/bases`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  })
  const result = await response.json()
  return result.data[0].id
}

function scanDirectory(dir, files = [], limit = TEST_LIMIT) {
  if (files.length >= limit) return files

  const items = fs.readdirSync(dir)

  for (const item of items) {
    if (files.length >= limit) break

    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      scanDirectory(fullPath, files, limit)
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase()
      if (['.pdf', '.doc', '.docx'].includes(ext)) {
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

async function uploadFile(file, kbId) {
  const form = new FormData()
  form.append('file', fs.createReadStream(file.path), {
    filename: file.name
  })
  form.append('kb_id', kbId)
  form.append('domain', 'intelligent_standards')

  const response = await fetch(`${API_URL}/knowledge/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      ...form.getHeaders()
    },
    body: form
  })

  return await response.json()
}

async function main() {
  try {
    console.log('\n📂 扫描文件...')
    const files = scanDirectory(SOURCE_DIR)
    console.log(`✅ 找到 ${files.length} 个文件`)

    console.log('\n🔍 获取知识库...')
    const kbId = await getKnowledgeBaseId()
    console.log(`✅ 知识库ID: ${kbId}`)

    console.log('\n🚀 开始上传...\n')

    let success = 0
    let failed = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const progress = `[${i + 1}/${files.length}]`

      console.log(`${progress} 📤 ${file.name}`)

      const result = await uploadFile(file, kbId)

      if (result.success) {
        console.log(`${progress} ✅ 成功`)
        success++
      } else {
        console.log(`${progress} ❌ 失败: ${result.message}`)
        failed++
      }

      // 每个文件间延迟1秒
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`✅ 成功: ${success}  ❌ 失败: ${failed}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    process.exit(1)
  }
}

main()
