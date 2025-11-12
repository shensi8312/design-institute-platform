const knex = require('./src/config/database');
const fs = require('fs');

async function importCSI() {
  const templateId = 'ac3dfd08-6875-479b-90db-244b9f840798';
  
  console.log('📥 正在读取去重后的CSV数据...');
  const csvContent = fs.readFileSync('/tmp/csi_unique.csv', 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  
  const sections = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    if (parts.length >= 3) {
      sections.push({
        template_id: templateId,
        code: parts[0].trim().replace(/^"|"$/g, ''),
        title: parts[1].trim().replace(/^"|"$/g, ''),
        level: parseInt(parts[2].trim()),
        description: null,
        parent_code: null,
        sort_order: i - 1,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
  }
  
  console.log(`✅ 已读取 ${sections.length} 个章节`);
  
  console.log('\n💾 正在批量插入数据库...');
  const batchSize = 50;
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    await knex('template_sections').insert(batch);
    const progress = i + batchSize > sections.length ? sections.length : i + batchSize;
    if (progress % 500 === 0 || progress === sections.length) {
      console.log(`   进度: ${progress}/${sections.length}`);
    }
  }
  
  console.log('\n🔍 验证导入结果...');
  const byLevel = await knex('template_sections')
    .where('template_id', templateId)
    .select('level')
    .count('* as count')
    .groupBy('level')
    .orderBy('level');
  
  console.log('\n📊 按层级统计:');
  for (const row of byLevel) {
    console.log(`   Level ${row.level}: ${row.count} 个`);
  }
  
  const total = await knex('template_sections')
    .where('template_id', templateId)
    .count('* as count');
  
  console.log(`\n✅ 总计: ${total[0].count} 个章节`);
  console.log('\n🎉 导入完成！');
  
  await knex.destroy();
}

importCSI().catch(err => {
  console.error('❌ 导入失败:', err.message);
  process.exit(1);
});
