#!/usr/bin/env node
/**
 * 测试领域配置在文档上传中的应用
 * 测试建筑和机械两个领域的文档处理
 */

const fs = require('fs')
const FormData = require('form-data')
const fetch = require('node-fetch')

const API_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjE3MjgzMjIsImV4cCI6MTc2MjMzMzEyMn0.F3N5wkNpKrmww0a6jdqmZ0s3X_liLcadshnNgsPT_C4'

console.log('='.repeat(60))
console.log('🧪 领域配置文档上传测试')
console.log('='.repeat(60))

async function getKnowledgeBases() {
  const response = await fetch(`${API_URL}/knowledge/bases`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  })
  const result = await response.json()
  return result.data || []
}

async function uploadDocument(kbId, fileName, content, domain) {
  const form = new FormData()

  // 创建临时文件buffer
  const buffer = Buffer.from(content, 'utf-8')
  form.append('file', buffer, {
    filename: fileName,
    contentType: 'text/plain'
  })
  form.append('kb_id', kbId)
  form.append('domain', domain)

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

async function getGraphNodes(docId) {
  const db = require('./src/config/database')
  const nodes = await db('knowledge_graph_nodes')
    .where('document_id', docId)
    .select('entity_name', 'entity_type', 'properties')

  return nodes
}

async function getGraphRelationships(docId) {
  const db = require('./src/config/database')
  const rels = await db('knowledge_graph_relationships as r')
    .leftJoin('knowledge_graph_nodes as src', 'r.source_node_id', 'src.id')
    .leftJoin('knowledge_graph_nodes as tgt', 'r.target_node_id', 'tgt.id')
    .where('r.document_id', docId)
    .select(
      'src.entity_name as source_name',
      'tgt.entity_name as target_name',
      'r.relationship_type'
    )

  return rels
}

async function main() {
  try {
    // 1. 获取知识库列表
    console.log('\n【步骤1】获取知识库列表')
    console.log('-'.repeat(60))
    const bases = await getKnowledgeBases()
    console.log(`找到 ${bases.length} 个知识库`)

    if (bases.length === 0) {
      console.log('❌ 没有找到知识库，请先创建知识库')
      process.exit(1)
    }

    const kb = bases[0]
    console.log(`✅ 使用知识库: ${kb.name} (${kb.id})`)

    // 2. 上传建筑领域文档
    console.log('\n【步骤2】上传建筑领域文档')
    console.log('-'.repeat(60))
    const archContent = `
某住宅建筑采用框架结构，共8层，层高3.0m。
主体结构采用C30混凝土，柱截面600×600mm，梁截面300×600mm。
楼板厚度120mm，承重墙厚度240mm。
建筑外墙采用加气混凝土砌块，厚度200mm。
门窗采用铝合金材料，主入口门宽度1.2m，高度2.4m。
窗户标准尺寸1.5m×1.8m，采用双层中空玻璃。
    `.trim()

    const archResult = await uploadDocument(kb.id, '建筑设计文档.txt', archContent, 'architecture')
    console.log(`上传结果: ${archResult.success ? '✅ 成功' : '❌ 失败'}`)
    if (archResult.success) {
      console.log(`文档ID: ${archResult.data.id}`)
      console.log(`领域: architecture`)
    } else {
      console.log(`错误: ${archResult.message}`)
    }

    // 3. 上传机械领域文档
    console.log('\n【步骤3】上传机械领域文档')
    console.log('-'.repeat(60))
    const mechContent = `
传动轴采用45号钢，表面淬火处理，配合6205轴承。
轴承内径25mm，外径52mm，宽度15mm，承载能力5000N。
传动齿轮采用20CrMnTi材料，模数3，齿数40，压力角20°。
轴与齿轮之间采用平键连接，键尺寸8×7×50mm。
连接螺栓规格M12×1.5，强度等级8.8级，材料为35钢。
螺母规格M12，采用六角螺母，配合弹簧垫圈防松。
    `.trim()

    const mechResult = await uploadDocument(kb.id, '机械设计文档.txt', mechContent, 'mechanical')
    console.log(`上传结果: ${mechResult.success ? '✅ 成功' : '❌ 失败'}`)
    if (mechResult.success) {
      console.log(`文档ID: ${mechResult.data.id}`)
      console.log(`领域: mechanical`)
    } else {
      console.log(`错误: ${mechResult.message}`)
    }

    // 4. 等待处理完成
    console.log('\n【步骤4】等待文档处理完成（15秒）')
    console.log('-'.repeat(60))
    await new Promise(resolve => setTimeout(resolve, 15000))

    // 5. 对比知识图谱
    console.log('\n【步骤5】对比知识图谱提取结果')
    console.log('-'.repeat(60))

    if (archResult.success) {
      console.log('\n🏗️ 建筑领域 - 提取的实体:')
      const archNodes = await getGraphNodes(archResult.data.id)
      archNodes.forEach((node, idx) => {
        console.log(`  ${idx + 1}. [${node.entity_type}] ${node.entity_name}`)
      })

      console.log('\n🏗️ 建筑领域 - 提取的关系:')
      const archRels = await getGraphRelationships(archResult.data.id)
      archRels.forEach((rel, idx) => {
        console.log(`  ${idx + 1}. ${rel.source_name} -[${rel.relationship_type}]-> ${rel.target_name}`)
      })
    }

    if (mechResult.success) {
      console.log('\n⚙️ 机械领域 - 提取的实体:')
      const mechNodes = await getGraphNodes(mechResult.data.id)
      mechNodes.forEach((node, idx) => {
        console.log(`  ${idx + 1}. [${node.entity_type}] ${node.entity_name}`)
      })

      console.log('\n⚙️ 机械领域 - 提取的关系:')
      const mechRels = await getGraphRelationships(mechResult.data.id)
      mechRels.forEach((rel, idx) => {
        console.log(`  ${idx + 1}. ${rel.source_name} -[${rel.relationship_type}]-> ${rel.target_name}`)
      })
    }

    // 6. 验证领域字段
    console.log('\n【步骤6】验证领域字段存储')
    console.log('-'.repeat(60))
    const db = require('./src/config/database')

    if (archResult.success) {
      const archDoc = await db('knowledge_documents')
        .where('id', archResult.data.id)
        .first()
      console.log(`建筑文档领域: ${archDoc.domain || '(未设置)'}`)
      console.log(`建筑文档metadata.domain: ${archDoc.metadata?.domain || '(未设置)'}`)
    }

    if (mechResult.success) {
      const mechDoc = await db('knowledge_documents')
        .where('id', mechResult.data.id)
        .first()
      console.log(`机械文档领域: ${mechDoc.domain || '(未设置)'}`)
      console.log(`机械文档metadata.domain: ${mechDoc.metadata?.domain || '(未设置)'}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 测试完成！')
    console.log('='.repeat(60))

    console.log('\n📊 总结:')
    console.log('- 建筑领域使用: 墙体、柱、梁、楼板、门、窗等实体类型')
    console.log('- 机械领域使用: 轴、轴承、齿轮、螺栓、螺母、键等实体类型')
    console.log('- 两个领域的知识图谱应该有明显差异')

    process.exit(0)
  } catch (error) {
    console.error('测试失败:', error)
    process.exit(1)
  }
}

main()
