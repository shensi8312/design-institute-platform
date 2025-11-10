-- ============================================
-- 知识图谱数据清理脚本
-- 功能：清理重复和无效实体数据
-- ============================================

-- 查看清理前的状态
SELECT '清理前统计' as stage,
       COUNT(*) as total_nodes,
       COUNT(DISTINCT entity_name) as unique_names,
       COUNT(*) - COUNT(DISTINCT entity_name) as duplicates
FROM knowledge_graph_nodes;

-- 1. 删除空名称和NULL的实体
DELETE FROM knowledge_graph_nodes
WHERE entity_name = ''
   OR entity_name IS NULL
   OR TRIM(entity_name) = '';

-- 2. 标准化实体名称（去除前后空格）
UPDATE knowledge_graph_nodes
SET entity_name = TRIM(entity_name)
WHERE entity_name != TRIM(entity_name);

-- 3. 查找重复的实体（保留最早创建的）
WITH duplicates AS (
  SELECT
    entity_name,
    entity_type,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY created_at) as all_ids
  FROM knowledge_graph_nodes
  GROUP BY entity_name, entity_type
  HAVING COUNT(*) > 1
)
SELECT
  '发现重复实体' as info,
  entity_name,
  entity_type,
  ARRAY_LENGTH(all_ids, 1) as duplicate_count
FROM duplicates;

-- 4. 合并重复实体的关系
-- 将重复实体的关系转移到保留的实体上
WITH duplicates AS (
  SELECT
    entity_name,
    entity_type,
    MIN(id) as keep_id,
    ARRAY_AGG(id) FILTER (WHERE id != MIN(id)) as delete_ids
  FROM knowledge_graph_nodes
  GROUP BY entity_name, entity_type
  HAVING COUNT(*) > 1
)
UPDATE knowledge_graph_relationships r
SET source_node_id = d.keep_id
FROM duplicates d
WHERE r.source_node_id = ANY(d.delete_ids);

WITH duplicates AS (
  SELECT
    entity_name,
    entity_type,
    MIN(id) as keep_id,
    ARRAY_AGG(id) FILTER (WHERE id != MIN(id)) as delete_ids
  FROM knowledge_graph_nodes
  GROUP BY entity_name, entity_type
  HAVING COUNT(*) > 1
)
UPDATE knowledge_graph_relationships r
SET target_node_id = d.keep_id
FROM duplicates d
WHERE r.target_node_id = ANY(d.delete_ids);

-- 5. 删除重复的实体（保留最早创建的）
WITH duplicates AS (
  SELECT
    entity_name,
    entity_type,
    MIN(id) as keep_id
  FROM knowledge_graph_nodes
  GROUP BY entity_name, entity_type
  HAVING COUNT(*) > 1
)
DELETE FROM knowledge_graph_nodes
WHERE id IN (
  SELECT n.id
  FROM knowledge_graph_nodes n
  JOIN duplicates d ON n.entity_name = d.entity_name
                   AND n.entity_type = d.entity_type
  WHERE n.id != d.keep_id
);

-- 6. 删除孤立节点（没有任何关系的节点，且不是重要类型）
DELETE FROM knowledge_graph_nodes
WHERE id NOT IN (
  SELECT source_node_id FROM knowledge_graph_relationships
  UNION
  SELECT target_node_id FROM knowledge_graph_relationships
)
AND entity_type NOT IN ('标准', '规范', '建筑', '项目')
AND properties->>'importance' IS NULL;

-- 7. 删除自环关系（source和target相同）
DELETE FROM knowledge_graph_relationships
WHERE source_node_id = target_node_id;

-- 8. 删除重复的关系
WITH duplicate_relations AS (
  SELECT
    MIN(id) as keep_id,
    source_node_id,
    target_node_id,
    relationship_type,
    COUNT(*) as dup_count
  FROM knowledge_graph_relationships
  GROUP BY source_node_id, target_node_id, relationship_type
  HAVING COUNT(*) > 1
)
DELETE FROM knowledge_graph_relationships
WHERE id IN (
  SELECT r.id
  FROM knowledge_graph_relationships r
  JOIN duplicate_relations d
    ON r.source_node_id = d.source_node_id
   AND r.target_node_id = d.target_node_id
   AND r.relationship_type = d.relationship_type
  WHERE r.id != d.keep_id
);

-- 查看清理后的状态
SELECT '清理后统计' as stage,
       COUNT(*) as total_nodes,
       COUNT(DISTINCT entity_name) as unique_names,
       COUNT(*) - COUNT(DISTINCT entity_name) as duplicates
FROM knowledge_graph_nodes;

-- 查看清理后的关系统计
SELECT '关系统计' as info,
       COUNT(*) as total_relationships,
       COUNT(DISTINCT relationship_type) as unique_types
FROM knowledge_graph_relationships;

-- 查看实体类型分布
SELECT
  entity_type,
  COUNT(*) as count
FROM knowledge_graph_nodes
GROUP BY entity_type
ORDER BY count DESC;

-- 查看关系类型分布
SELECT
  relationship_type,
  COUNT(*) as count
FROM knowledge_graph_relationships
GROUP BY relationship_type
ORDER BY count DESC;

-- 查看清理日志
SELECT
  NOW() as cleanup_time,
  '数据清理完成' as status;
