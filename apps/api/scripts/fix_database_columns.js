/**
 * 修复数据库列引用问题
 * 将不存在的列映射到metadata字段中
 */

const fs = require('fs');
const path = require('path');

// 不存在的列列表
const NON_EXISTENT_COLUMNS = [
  'recognition_status',
  'recognition_error',
  'vector_error', 
  'graph_error',
  'minio_status',
  'minio_url',
  'owner_id',
  'visibility',
  'tags',
  'description',
  'content_text'
];

// 实际存在的列
const EXISTING_COLUMNS = [
  'id', 'kb_id', 'name', 'file_type', 'file_size', 'file_path',
  'minio_path', 'content', 'metadata', 'vector_status', 'graph_status',
  'vector_indexed_at', 'graph_indexed_at', 'graph_entities', 
  'graph_relationships', 'upload_by', 'status', 'created_at', 
  'updated_at', 'deleted_at'
];

// 需要修复的文件列表
const FILES_TO_FIX = [
  '../src/services/realTimeDocumentProcessor.js',
  '../src/controllers/KnowledgeController.js', 
  '../src/controllers/KnowledgeBatchController.js'
];

function fixFile(filePath) {
  console.log(`\n正在修复: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let changesCount = 0;
    
    // 修复1: recognition_status -> 使用metadata
    if (content.includes('recognition_status')) {
      console.log('  - 发现 recognition_status 引用');
      
      // 修复update语句中的recognition_status
      content = content.replace(
        /recognition_status:\s*['"]([^'"]+)['"]/g,
        (match, status) => {
          changesCount++;
          return `// [PE-fix] recognition_status moved to metadata\n            status: '${status === 'failed' ? 'failed' : status}'`;
        }
      );
      
      // 修复where条件中的recognition_status  
      content = content.replace(
        /\.orWhereIn\(['"]recognition_status['"]/g,
        ".orWhereIn('status'"
      );
      
      content = content.replace(
        /document\.recognition_status/g,
        "JSON.parse(document.metadata || '{}').recognition_status"
      );
    }
    
    // 修复2: 错误信息字段 -> 存储到metadata
    NON_EXISTENT_COLUMNS.forEach(column => {
      if (content.includes(column) && !['vector_status', 'graph_status'].includes(column)) {
        console.log(`  - 发现 ${column} 引用`);
        
        // 对于错误信息，需要特殊处理
        if (column.endsWith('_error')) {
          const regex = new RegExp(`${column}:\\s*(.+?)(?:,|\\})`, 'g');
          content = content.replace(regex, (match, value) => {
            changesCount++;
            return `// [PE-fix] ${column} moved to metadata\n            metadata: JSON.stringify({...JSON.parse(metadata || '{}'), ${column}: ${value}})`;
          });
        }
      }
    });
    
    // 修复3: owner_id -> upload_by
    if (content.includes('owner_id')) {
      console.log('  - 修复 owner_id -> upload_by');
      content = content.replace(/owner_id/g, 'upload_by');
      changesCount++;
    }
    
    // 修复4: knowledge_base_id -> kb_id
    if (content.includes('knowledge_base_id') && !content.includes('knowledge_base_id = ')) {
      console.log('  - 修复 knowledge_base_id -> kb_id（数据库列）');
      // 只修复数据库操作中的引用，不修复变量名
      content = content.replace(
        /(\s+)(knowledge_base_id)(:)/g,
        '$1kb_id$3'
      );
      changesCount++;
    }
    
    if (changesCount > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ 修复了 ${changesCount} 处引用`);
    } else {
      console.log('  ℹ️ 无需修改');
    }
    
  } catch (error) {
    console.error(`  ❌ 修复失败: ${error.message}`);
  }
}

console.log('开始修复数据库列引用问题...\n');
console.log('不存在的列:', NON_EXISTENT_COLUMNS.join(', '));
console.log('实际存在的列:', EXISTING_COLUMNS.join(', '));

FILES_TO_FIX.forEach(file => {
  const fullPath = path.join(__dirname, file);
  fixFile(fullPath);
});

console.log('\n修复完成！');
console.log('\n注意：这是一个简单的文本替换脚本，可能需要手动检查和调整某些复杂的情况。');
console.log('建议运行后进行代码审查和测试。');