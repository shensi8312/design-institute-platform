#!/usr/bin/env node
/**
 * 修复parts_catalog表，添加category字段
 */

const knex = require('knex');

// 数据库配置
const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    database: process.env.DB_NAME || 'design_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  }
};

const db = knex(config);

async function fixTable() {
  console.log('🔧 修复parts_catalog表...');

  try {
    // 检查字段是否存在
    const hasColumn = await db.schema.hasColumn('parts_catalog', 'category');

    if (hasColumn) {
      console.log('✓ category字段已存在');
    } else {
      console.log('➕ 添加category字段...');
      await db.schema.table('parts_catalog', function(table) {
        table.string('category', 50).nullable();
      });
      console.log('✅ category字段添加成功');

      // 创建索引
      await db.raw('CREATE INDEX IF NOT EXISTS idx_parts_catalog_category ON parts_catalog(category)');
      console.log('✅ category索引创建成功');
    }

    // 显示表结构
    const columns = await db('information_schema.columns')
      .where({ table_name: 'parts_catalog', table_schema: 'public' })
      .select('column_name', 'data_type', 'is_nullable')
      .orderBy('ordinal_position');

    console.log('\n📋 parts_catalog表结构:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(可空)' : '(必填)'}`);
    });

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await db.destroy();
    process.exit(1);
  }
}

fixTable();
