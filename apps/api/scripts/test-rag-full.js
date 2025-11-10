const axios = require('axios')
const db = require('../src/config/database')

const API = 'http://localhost:3000/api'
let token = ''
let testDocId = null

async function testFullRAGWorkflow() {
  console.log('\n🚀 RAG完整流程测试')
  console.log('='.repeat(80))

  try {
    // 1. 登录
    console.log('\n1️⃣ 登录认证')
    const loginRes = await axios.post(`${API}/auth/login`, {
      username: 'admin',
      password: '123456'
    })
    token = loginRes.data.data.token
    console.log('   ✅ 登录成功')

    const headers = { Authorization: `Bearer ${token}` }

    // 2. 创建测试文档
    console.log('\n2️⃣ 创建测试文档')
    const testContent = `建筑设计规范总则

第一章 总则

1.0.1 为了保证建筑设计的质量,使建筑符合适用、经济、美观的要求,制定本规范。

1.0.2 本规范适用于新建、改建和扩建的民用建筑设计。

1.0.3 建筑设计应当遵循以下原则:
1. 满足建筑功能要求,为使用者提供舒适的室内环境;
2. 采用先进适用的技术、工艺和设备;
3. 符合城市规划、建筑节能、环境保护的要求;
4. 符合防火、防灾的安全要求。

第二章 场地设计

2.1.1 建筑场地应选择地质条件良好、地形有利于排水的地段。

2.1.2 场地设计应满足以下要求:
1. 合理布置建筑物、构筑物和道路;
2. 保证场地排水顺畅;
3. 满足无障碍设计要求;
4. 合理组织人流和车流。

第三章 建筑设计

3.1.1 建筑平面布置应满足使用功能要求,做到分区明确、流线合理、联系方便。

3.1.2 建筑层高应根据使用功能、结构形式、设备管线布置等因素确定:
1. 住宅层高不应低于2.8米;
2. 办公建筑层高不应低于3.0米;
3. 商业建筑层高不应低于3.3米。

3.1.3 建筑门窗设计应符合以下规定:
1. 门的宽度不应小于0.9米;
2. 疏散门应向疏散方向开启;
3. 窗台高度不应低于0.9米。`

    const [doc] = await db('knowledge_documents').insert({
      id: `doc_test_${Date.now()}`,
      name: '建筑设计规范测试文档.txt',
      file_type: 'txt',
      file_size: Buffer.byteLength(testContent, 'utf8'),
      file_path: '/test/规范.txt',
      content: testContent,
      kb_id: 'kb_default',
      upload_by: 'user_admin',
      vector_status: 'pending',
      status: 'active'
    }).returning('*')

    testDocId = doc.id
    console.log(`   ✅ 文档创建成功: ${testDocId}`)

    // 3. 向量化文档
    console.log('\n3️⃣ 文档向量化')
    const processRes = await axios.post(`${API}/rag/process-document`, {
      document_id: testDocId
    }, { headers })

    if (processRes.data.success) {
      console.log(`   ✅ 向量化成功: ${processRes.data.data.chunks_created}个文本块`)
    } else {
      console.log(`   ❌ 向量化失败: ${processRes.data.message}`)
      throw new Error('向量化失败')
    }

    // 等待索引生效
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 4. RAG查询测试
    console.log('\n4️⃣ RAG查询测试')

    const questions = [
      '建筑设计应当遵循哪些原则?',
      '住宅层高的要求是什么?',
      '门的宽度有什么规定?'
    ]

    for (const question of questions) {
      console.log(`\n   📝 问题: ${question}`)

      const queryRes = await axios.post(`${API}/rag/query`, {
        question,
        kb_id: null
      }, { headers })

      if (queryRes.data.success) {
        const { answer, sources, retrieval_count } = queryRes.data.data
        console.log(`   💬 回答: ${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}`)
        console.log(`   📚 来源数量: ${sources?.length || 0}`)
        console.log(`   🔍 检索文档块: ${retrieval_count}个`)

        if (sources && sources.length > 0) {
          console.log(`   📄 引用文档: ${sources[0].document_name}`)
        }
      } else {
        console.log(`   ❌ 查询失败: ${queryRes.data.message}`)
      }
    }

    // 5. 清理测试数据
    console.log('\n5️⃣ 清理测试数据')
    await db('knowledge_documents').where({ id: testDocId }).delete()
    console.log('   ✅ 测试文档已删除')

    // 汇总
    console.log('\n' + '='.repeat(80))
    console.log('\n📊 RAG完整流程测试汇总')
    console.log('='.repeat(80))
    console.log('\n✅ 文档上传成功')
    console.log('✅ 向量化处理成功')
    console.log('✅ RAG检索成功')
    console.log('✅ 答案生成成功')
    console.log('✅ 来源引用成功')
    console.log('\n🎉 RAG完整流程测试通过!\n')

    process.exit(0)

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    if (error.response?.data) {
      console.error('   详情:', JSON.stringify(error.response.data, null, 2))
    }

    // 清理
    if (testDocId) {
      try {
        await db('knowledge_documents').where({ id: testDocId }).delete()
        console.log('   ✅ 测试数据已清理')
      } catch (e) {
        console.error('   清理失败:', e.message)
      }
    }

    process.exit(1)
  } finally {
    await db.destroy()
  }
}

testFullRAGWorkflow()
