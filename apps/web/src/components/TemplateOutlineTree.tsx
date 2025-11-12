/**
 * 模板目录树组件
 * 展示Word文档的标题层级结构，支持搜索和点击跳转
 */

import React, { useState, useEffect } from 'react';
import { Tree, Input, Space, Spin, Empty } from 'antd';
import { SearchOutlined, FolderOutlined, FileTextOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import axios from '../utils/axios';

interface OutlineNode {
  id: string;
  title: string;
  sectionNumber?: string | null;
  sectionTitle?: string;
  level: number;
  order: number;
  children?: OutlineNode[];
}

interface Props {
  templateId: string;
  onSelectNode?: (node: OutlineNode) => void;
}

const TemplateOutlineTree: React.FC<Props> = ({ templateId, onSelectNode }) => {
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    loadOutline();
  }, [templateId]);

  const loadOutline = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/unified-document/templates/${templateId}/outline`
      );

      if (response.data.success) {
        const outlineData = response.data.data.outline || [];
        setOutline(outlineData);

        // 默认展开第一层
        if (outlineData.length > 0) {
          const firstLevelKeys = outlineData.map((n: OutlineNode) => n.id);
          setExpandedKeys(firstLevelKeys);
        }
      }
    } catch (error: any) {
      console.error('加载目录失败:', error);
      // 静默处理错误，设置为空数组
      setOutline([]);
    } finally {
      setLoading(false);
    }
  };

  // 转换为Antd Tree所需的数据格式
  const convertToTreeData = (nodes: OutlineNode[]): DataNode[] => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;

      return {
        key: node.id,
        title: (
          <span
            style={{
              fontSize: 14,
              lineHeight: '22px',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={node.title}
          >
            {node.title}
          </span>
        ),
        icon: hasChildren ? <FolderOutlined /> : <FileTextOutlined />,
        children: hasChildren ? convertToTreeData(node.children!) : undefined,
        data: node // 保存原始数据
      };
    });
  };

  // 过滤搜索
  const filterTree = (nodes: OutlineNode[], searchTerm: string): OutlineNode[] => {
    return nodes.filter((node) => {
      const matchTitle = node.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchChildren = node.children
        ? filterTree(node.children, searchTerm).length > 0
        : false;
      return matchTitle || matchChildren;
    }).map((node) => ({
      ...node,
      children: node.children ? filterTree(node.children, searchTerm) : undefined,
    }));
  };

  const displayOutline = searchValue
    ? filterTree(outline, searchValue)
    : outline;

  const treeData = convertToTreeData(displayOutline);

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0 && onSelectNode) {
      // 找到选中的节点
      const findNode = (nodes: OutlineNode[], key: string): OutlineNode | null => {
        for (const node of nodes) {
          if (node.id === key) return node;
          if (node.children) {
            const found = findNode(node.children, key);
            if (found) return found;
          }
        }
        return null;
      };

      const selectedNode = findNode(outline, selectedKeys[0] as string);
      if (selectedNode) {
        onSelectNode(selectedNode);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载目录中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索框 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="搜索目录..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* 目录树 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {treeData.length > 0 ? (
          <Tree
            showIcon
            defaultExpandAll={!searchValue}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            onSelect={handleSelect}
            style={{ background: 'transparent' }}
          />
        ) : (
          <Empty
            description={searchValue ? '未找到匹配的目录项' : '暂无目录结构'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateOutlineTree;
