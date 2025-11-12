const knex = require('./src/config/database');

async function fixLevels() {
  const templateId = 'ac3dfd08-6875-479b-90db-244b9f840798';

  console.log('🔧 修复 CSI 层级编号...');

  // 将所有 Level 2 改为 Level 3
  const updated = await knex('template_sections')
    .where({ template_id: templateId, level: 2 })
    .update({ level: 3 });

  console.log(`✅ 已将 ${updated} 个 Level 2 记录更新为 Level 3`);

  // 验证结果
  const byLevel = await knex('template_sections')
    .where('template_id', templateId)
    .select('level')
    .count('* as count')
    .groupBy('level')
    .orderBy('level');

  console.log('\n📊 修复后的层级分布:');
  for (const row of byLevel) {
    console.log(`   Level ${row.level}: ${row.count} 个`);
  }

  const total = await knex('template_sections')
    .where('template_id', templateId)
    .count('* as count');

  console.log(`\n✅ 总计: ${total[0].count} 个章节`);

  await knex.destroy();
}

fixLevels().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
