/**
 * 填充 template_sections 表的 parent_code 字段
 * 根据 code 推断父子关系
 */

const knex = require('../src/config/database');

function inferParentCode(code) {
  if (!code) return null;

  const trimmed = code.trim();

  // 如果包含小数点，父节点是去掉最后一个小数点部分
  // 例如：'00 24 13.13' -> '00 24 13'
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    parts.pop();
    return parts.join('.');
  }

  // 如果是空格分隔的编号
  const parts = trimmed.split(/\s+/);

  // 6位编号 (如 "00 01 01") - 父节点是前2位 (如 "00")
  if (parts.length === 3) {
    return parts[0];
  }

  // 其他情况：去掉最后一个部分
  if (parts.length > 1) {
    parts.pop();
    return parts.length > 0 ? parts.join(' ') : null;
  }

  // 顶级节点（单个两码）
  return null;
}

async function fixParentCodes() {
  try {
    console.log('开始修复 template_sections 的 parent_code...');

    // 获取所有章节
    const sections = await knex('template_sections')
      .select('id', 'code')
      .orderBy('code');

    console.log(`找到 ${sections.length} 个章节`);

    // 构建 code -> id 映射
    const codeToId = new Map(sections.map(s => [s.code, s.id]));

    let updated = 0;
    let skipped = 0;

    // 逐个更新
    for (const section of sections) {
      const parentCode = inferParentCode(section.code);

      // 检查父节点是否存在
      if (parentCode && !codeToId.has(parentCode)) {
        console.warn(`⚠️  ${section.code} 的父节点 ${parentCode} 不存在`);
        skipped++;
        continue;
      }

      // 更新 parent_code
      await knex('template_sections')
        .where({ id: section.id })
        .update({ parent_code: parentCode });

      updated++;

      if (updated % 100 === 0) {
        console.log(`已更新 ${updated}/${sections.length}...`);
      }
    }

    console.log(`\n✅ 完成！`);
    console.log(`   更新: ${updated} 个`);
    console.log(`   跳过: ${skipped} 个`);

    // 验证结果
    const rootCount = await knex('template_sections')
      .whereNull('parent_code')
      .count('* as count')
      .first();

    console.log(`\n📊 根节点数量: ${rootCount.count}`);

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

fixParentCodes();
