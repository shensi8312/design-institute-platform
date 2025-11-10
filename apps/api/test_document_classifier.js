/**
 * 测试文档自动分类功能
 */

const DocumentClassifierService = require('./src/services/document/DocumentClassifierService');
const db = require('./src/config/database');

async function testClassifier() {
  console.log('==========================================');
  console.log('测试文档自动分类功能');
  console.log('==========================================\n');

  try {
    const classifierService = new DocumentClassifierService();

    // 1. 获取或创建测试组织
    console.log('[步骤1] 准备测试数据...');
    let org = await db('organizations').where({ name: '测试组织' }).first();

    if (!org) {
      [org] = await db('organizations').insert({
        name: '测试组织',
        code: 'test_org',
        status: 'active'
      }).returning('*');
      console.log('✓ 创建测试组织:', org.id);
    } else {
      console.log('✓ 使用现有组织:', org.id);
    }

    // 2. 创建测试分类（如果不存在）
    console.log('\n[步骤2] 创建测试分类...');
    const testCategories = [
      { name: '建筑设计', code: 'arch_design', description: '建筑设计相关文档' },
      { name: '结构设计', code: 'struct_design', description: '结构设计相关文档' },
      { name: '施工图', code: 'construction', description: '施工图纸' },
      { name: '技术规范', code: 'tech_spec', description: '技术规范和标准' },
      { name: '其他', code: 'other', description: '其他类型文档' }
    ];

    for (const cat of testCategories) {
      const existing = await db('knowledge_categories')
        .where({ organization_id: org.id, code: cat.code })
        .first();

      if (!existing) {
        await db('knowledge_categories').insert({
          ...cat,
          organization_id: org.id,
          status: 'active',
          sort: 0
        });
        console.log(`✓ 创建分类: ${cat.name}`);
      } else {
        console.log(`✓ 分类已存在: ${cat.name}`);
      }
    }

    // 3. 创建测试知识库
    console.log('\n[步骤3] 创建测试知识库...');
    let kb = await db('knowledge_bases')
      .where({ name: '测试知识库' })
      .first();

    if (!kb) {
      [kb] = await db('knowledge_bases').insert({
        name: '测试知识库',
        description: '用于测试的知识库',
        organization_id: org.id,
        owner_id: 'user_admin',
        status: 'active'
      }).returning('*');
      console.log('✓ 创建知识库:', kb.id);
    } else {
      console.log('✓ 使用现有知识库:', kb.id);
    }

    // 4. 测试不同类型文档的分类
    console.log('\n[步骤4] 测试文档分类...\n');

    const testDocuments = [
      {
        name: '某商业综合体建筑方案设计.pdf',
        content: `项目名称：某市商业综合体建筑方案设计

设计说明：
本项目为大型商业综合体建筑设计，总建筑面积约120000平方米，包括购物中心、办公楼、酒店等功能。
建筑层数：地上30层，地下3层
建筑高度：149.95米
结构形式：框架-核心筒结构
外立面材料：玻璃幕墙、铝板

主要功能分区：
1. 地下三层至地下一层：停车场、设备用房
2. 地上一层至五层：商业购物中心
3. 地上六层至十五层：办公区
4. 地上十六层至三十层：酒店客房

设计特点：
- 采用绿色建筑技术，节能环保
- 合理的功能布局，满足各业态需求
- 现代化的外观设计，成为城市地标`
      },
      {
        name: '高层住宅结构计算书.doc',
        content: `结构设计计算书

项目名称：某高层住宅楼
结构类型：剪力墙结构
抗震设防烈度：7度
建筑高度：99.6米
地上层数：33层
地下层数：2层

主要计算内容：
1. 荷载计算
   - 恒荷载计算
   - 活荷载计算
   - 风荷载计算
   - 地震作用计算

2. 结构分析
   - 采用PKPM软件进行整体结构分析
   - 考虑P-Δ效应
   - 楼层侧移验算
   - 层间位移角验算

3. 构件设计
   - 剪力墙配筋计算
   - 梁板配筋计算
   - 基础设计

计算结果表明，结构设计满足规范要求。`
      },
      {
        name: 'GB50010-2010混凝土结构设计规范.pdf',
        content: `中华人民共和国国家标准

混凝土结构设计规范
Code for design of concrete structures

GB 50010-2010

主编部门：中华人民共和国住房和城乡建设部
批准部门：中华人民共和国住房和城乡建设部
施行日期：2011年7月1日

本规范是根据住房和城乡建设部关于印发《2008年工程建设标准规范制订、修订计划》的通知，
由中国建筑科学研究院会同有关单位对《混凝土结构设计规范》GB 50010-2002进行修订而成。

主要技术内容包括：
1. 总则
2. 术语、符号
3. 基本设计规定
4. 材料
5. 结构分析
6. 承载能力极限状态计算
7. 正常使用极限状态验算
8. 构造规定
9. 预应力混凝土结构设计`
      }
    ];

    for (const doc of testDocuments) {
      console.log(`\n测试文档: ${doc.name}`);
      console.log('='.repeat(60));

      // 创建文档记录
      const [document] = await db('knowledge_documents').insert({
        kb_id: kb.id,
        name: doc.name,
        content: doc.content,
        file_type: 'application/pdf',
        file_size: 1000,
        upload_by: 'user_admin',
        status: 'pending',
        vector_status: 'pending',
        graph_status: 'pending'
      }).returning('*');

      // 执行分类
      const result = await classifierService.classifyDocument(
        document.id,
        doc.content,
        doc.name,
        org.id
      );

      console.log('分类结果:', {
        success: result.success,
        categoryName: result.categoryName,
        categoryCode: result.categoryCode,
        confidence: result.confidence,
        reasoning: result.reasoning
      });

      // 验证数据库更新
      const updatedDoc = await db('knowledge_documents')
        .where({ id: document.id })
        .first('id', 'name', 'category_id');

      console.log('数据库验证:', updatedDoc.category_id ? '✓ 已更新' : '✗ 未更新');
    }

    // 5. 测试批量分类
    console.log('\n\n[步骤5] 测试批量分类...');
    const allDocs = await db('knowledge_documents')
      .where({ kb_id: kb.id })
      .whereNull('category_id')
      .select('id');

    if (allDocs.length > 0) {
      const docIds = allDocs.map(d => d.id);
      const batchResult = await classifierService.batchClassifyDocuments(docIds, org.id);
      console.log(`批量分类完成: ${batchResult.length} 个文档`);
      console.log('成功:', batchResult.filter(r => r.success).length);
      console.log('失败:', batchResult.filter(r => !r.success).length);
    } else {
      console.log('没有需要分类的文档');
    }

    // 6. 显示分类统计
    console.log('\n\n[步骤6] 分类统计...');
    const stats = await db('knowledge_documents')
      .join('knowledge_categories', 'knowledge_documents.category_id', 'knowledge_categories.id')
      .where({ 'knowledge_documents.kb_id': kb.id })
      .groupBy('knowledge_categories.id', 'knowledge_categories.name')
      .select(
        'knowledge_categories.name as category_name',
        db.raw('COUNT(*) as doc_count')
      );

    console.log('\n分类统计:');
    stats.forEach(stat => {
      console.log(`  ${stat.category_name}: ${stat.doc_count} 个文档`);
    });

    console.log('\n\n==========================================');
    console.log('✓ 测试完成');
    console.log('==========================================');

  } catch (error) {
    console.error('\n✗ 测试失败:', error);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

// 运行测试
testClassifier();
