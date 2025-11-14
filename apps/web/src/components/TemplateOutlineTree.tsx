/**
 * 模板目录树组件（可编辑版）
 * 展示模板的章节层级结构，支持编辑、删除、拖拽排序
 */

import React, { useState, useEffect } from 'react';
import { Tree, Input, Dropdown, Modal, message, Spin, Empty, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  FolderOutlined,
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import axios from '../utils/axios';

interface OutlineNode {
  id: string;
  code: string;
  title: string;
  level: number;
  sort_order: number;
  parent_code?: string | null;
  children?: OutlineNode[];
}

interface Props {
  templateId: string;
  editable?: boolean;  // 是否可编辑模式
  onSelectNode?: (node: OutlineNode) => void;
  onSectionsChange?: () => void;  // 章节变化回调
}

const TemplateOutlineTree: React.FC<Props> = ({
  templateId,
  editable = false,
  onSelectNode,
  onSectionsChange
}) => {
  const [sections, setSections] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    loadSections();
  }, [templateId]);

  const loadSections = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${templateId}/sections`);

      if (response.data.success) {
        const sectionsData = response.data.data;
        setSections(sectionsData);

        // 默认展开第一层
        if (sectionsData.length > 0) {
          const firstLevelKeys = sectionsData.map((n: OutlineNode) => n.id);
          setExpandedKeys(firstLevelKeys);
        }
      }
    } catch (error: any) {
      console.error('加载章节失败:', error);
      message.error('加载章节失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加章节
  const handleAddSection = async (parentNode: OutlineNode | null, type: 'sibling' | 'child') => {
    try {
      let parentCode = null;
      let level = 1;
      let sortOrder = 0;

      if (type === 'child' && parentNode) {
        // 添加子章节
        parentCode = parentNode.code;
        level = parentNode.level + 1;
        // 查找当前子章节数量
        const children = findNodeChildren(sections, parentNode.code);
        sortOrder = children.length + 1;
      } else if (type === 'sibling' && parentNode) {
        // 添加同级章节
        parentCode = parentNode.parent_code || null;
        level = parentNode.level;
        // 查找同级章节数量
        const siblings = findNodeChildren(sections, parentCode);
        sortOrder = siblings.length + 1;
      } else {
        // 添加顶级章节
        sortOrder = sections.length + 1;
      }

      const response = await axios.post(`/api/unified-document/templates/${templateId}/sections`, {
        title: '新章节',
        level,
        parentCode,
        sortOrder,
        description: '',
        templateContent: '',
        isRequired: true,
        isEditable: true,
      });

      if (response.data.success) {
        message.success('章节创建成功');
        await loadSections();
        onSectionsChange?.();

        // 选中新创建的章节
        const newSection = response.data.data;
        setSelectedKeys([newSection.id]);
        onSelectNode?.(newSection);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建章节失败');
    }
  };

  // 删除章节
  const handleDeleteSection = (node: OutlineNode) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除章节"${node.title}"吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/api/unified-document/templates/${templateId}/sections/${node.id}`);
          message.success('章节删除成功');
          await loadSections();
          onSectionsChange?.();
          setSelectedKeys([]);
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除章节失败');
        }
      },
    });
  };

  // 拖拽处理
  const handleDrop: TreeProps['onDrop'] = async (info) => {
    const dropKey = info.node.key as string;
    const dragKey = info.dragNode.key as string;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    // 查找被拖拽的节点和目标节点
    const dragNode = findNode(sections, dragKey);
    const dropNode = findNode(sections, dropKey);

    if (!dragNode || !dropNode) return;

    try {
      let newParentCode = null;
      let newLevel = dragNode.level;
      let newSortOrder = dropNode.sort_order;

      if (dropPosition === 0) {
        // 放到目标节点内部（成为子节点）
        newParentCode = dropNode.code;
        newLevel = dropNode.level + 1;
        const children = findNodeChildren(sections, dropNode.code);
        newSortOrder = children.length + 1;
      } else {
        // 放到目标节点前面或后面（成为同级）
        newParentCode = dropNode.parent_code || null;
        newLevel = dropNode.level;
        newSortOrder = dropPosition < 0 ? dropNode.sort_order : dropNode.sort_order + 1;
      }

      await axios.post(
        `/api/unified-document/templates/${templateId}/sections/${dragNode.id}/move`,
        {
          newParentCode,
          newLevel,
          newSortOrder,
        }
      );

      message.success('章节移动成功');
      await loadSections();
      onSectionsChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.message || '移动章节失败');
    }
  };

  // 辅助函数：查找节点
  const findNode = (nodes: OutlineNode[], id: string): OutlineNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 辅助函数：查找子节点
  const findNodeChildren = (nodes: OutlineNode[], parentCode: string | null): OutlineNode[] => {
    const result: OutlineNode[] = [];
    for (const node of nodes) {
      if (node.parent_code === parentCode) {
        result.push(node);
      }
      if (node.children) {
        result.push(...findNodeChildren(node.children, parentCode));
      }
    }
    return result;
  };

  // 转换为Antd Tree所需的数据格式
  const convertToTreeData = (nodes: OutlineNode[]): DataNode[] => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;

      // 右键菜单
      const menuItems: MenuProps['items'] = editable ? [
        {
          key: 'add-child',
          label: '添加子章节',
          icon: <PlusOutlined />,
          onClick: () => handleAddSection(node, 'child'),
        },
        {
          key: 'add-sibling',
          label: '添加同级章节',
          icon: <PlusOutlined />,
          onClick: () => handleAddSection(node, 'sibling'),
        },
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDeleteSection(node),
        },
      ] : [];

      return {
        key: node.id,
        title: editable ? (
          <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 0',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={`${node.code} ${node.title}`}
              >
                {node.code} {node.title}
              </span>
              <span
                style={{
                  opacity: 0.6,
                  marginLeft: 8,
                  display: 'none',
                }}
                className="tree-node-actions"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSection(node, 'child');
                  }}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSection(node);
                  }}
                />
              </span>
            </div>
          </Dropdown>
        ) : (
          <span
            style={{
              fontSize: 14,
              lineHeight: '22px',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={`${node.code} ${node.title}`}
          >
            {node.code} {node.title}
          </span>
        ),
        icon: hasChildren ? <FolderOutlined /> : <FileTextOutlined />,
        children: hasChildren ? convertToTreeData(node.children!) : undefined,
      };
    });
  };

  // 过滤搜索
  const filterTree = (nodes: OutlineNode[], searchTerm: string): OutlineNode[] => {
    return nodes.filter((node) => {
      const matchTitle = node.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCode = node.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchChildren = node.children
        ? filterTree(node.children, searchTerm).length > 0
        : false;
      return matchTitle || matchCode || matchChildren;
    }).map((node) => ({
      ...node,
      children: node.children ? filterTree(node.children, searchTerm) : undefined,
    }));
  };

  const displaySections = searchValue
    ? filterTree(sections, searchValue)
    : sections;

  const treeData = convertToTreeData(displaySections);

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0 && onSelectNode) {
      const selectedNode = findNode(sections, selectedKeys[0] as string);
      if (selectedNode) {
        setSelectedKeys([selectedNode.id]);
        onSelectNode(selectedNode);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载章节中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索框 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="搜索章节..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          size="small"
        />
        {editable && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            style={{ marginTop: 8 }}
            onClick={() => handleAddSection(null, 'child')}
          >
            添加顶级章节
          </Button>
        )}
      </div>

      {/* 目录树 */}
      <div
        style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}
        className="template-outline-tree"
      >
        <style>{`
          .template-outline-tree .ant-tree-treenode:hover .tree-node-actions {
            display: inline-block !important;
          }
        `}</style>
        {treeData.length > 0 ? (
          <Tree
            showIcon
            draggable={editable}
            onDrop={editable ? handleDrop : undefined}
            defaultExpandAll={!searchValue}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            onSelect={handleSelect}
            style={{ background: 'transparent' }}
          />
        ) : (
          <Empty
            description={searchValue ? '未找到匹配的章节' : '暂无章节'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateOutlineTree;
