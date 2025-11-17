/**
 * 模板目录树组件（可编辑版 + 懒加载）
 * 展示模板的章节层级结构，支持编辑、删除、拖拽排序、懒加载子节点
 */

import React, { useState, useEffect } from 'react';
import { Tree, Input, Dropdown, Modal, message, Spin, Empty, Button, Form } from 'antd';
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

const { TextArea } = Input;

interface OutlineNode {
  id: string;
  code: string;
  title: string;
  level: number;
  sort_order: number;
  parent_code?: string | null;
  description?: string;
  template_content?: string;
  is_required?: boolean;
  is_editable?: boolean;
  isLeaf?: boolean;
  editable_user_ids?: string[];
  metadata?: Record<string, any>;
}

interface Props {
  templateId: string;
  editable?: boolean;
  onSelectNode?: (node: OutlineNode) => void;
  onSectionsChange?: () => void;
}

const TemplateOutlineTree: React.FC<Props> = ({
  templateId,
  editable = false,
  onSelectNode,
  onSectionsChange
}) => {
  const [sections, setSections] = useState<OutlineNode[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRootSections();
  }, [templateId]);

  // 加载根节点
  const loadRootSections = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${templateId}/sections`);

      if (response.data.success) {
        const rootNodes = response.data.data;
        setSections(rootNodes);
        setTreeData(convertToTreeData(rootNodes));
      }
    } catch (error: any) {
      console.error('加载章节失败:', error);
      message.error('加载章节失败');
    } finally {
      setLoading(false);
    }
  };

  // 懒加载子节点
  const onLoadData = async (treeNode: any): Promise<void> => {
    if (treeNode.children && treeNode.children.length > 0) {
      return Promise.resolve();
    }

    try {
      const response = await axios.get(
        `/api/unified-document/templates/${templateId}/sections?parentCode=${encodeURIComponent(treeNode.code)}`
      );

      if (response.data.success) {
        const childNodes = response.data.data;

        // 更新树数据
        setTreeData((prevData) => updateTreeNode(prevData, treeNode.key, convertToTreeData(childNodes)));

        // 更新sections数据（用于查找节点）
        setSections((prev) => [...prev, ...childNodes]);
      }
    } catch (error: any) {
      console.error('加载子节点失败:', error);
      message.error('加载子节点失败');
    }
  };

  // 更新树节点的children
  const updateTreeNode = (nodes: DataNode[], key: string, children: DataNode[]): DataNode[] => {
    return nodes.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeNode(node.children, key, children) };
      }
      return node;
    });
  };

  // 双击编辑章节属性
  const handleDoubleClick = (node: OutlineNode) => {
    if (!editable) return;

    setEditingNode(node);
    form.setFieldsValue({
      code: node.code,
      title: node.title,
      description: node.description || '',
    });
    setEditModalVisible(true);
  };

  // 保存章节属性
  const handleSaveNodeProperties = async () => {
    if (!editingNode) return;

    try {
      const values = await form.validateFields();

      await axios.put(
        `/api/unified-document/templates/${templateId}/sections/${editingNode.id}`,
        {
          code: values.code,
          title: values.title,
          description: values.description,
        }
      );

      message.success('章节属性更新成功');
      setEditModalVisible(false);
      setEditingNode(null);
      form.resetFields();
      await loadRootSections();
      onSectionsChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  // 添加章节
  const handleAddSection = async (parentNode: OutlineNode | null, type: 'sibling' | 'child') => {
    try {
      let parentCode = null;
      let level = 1;
      let sortOrder = 0;

      if (type === 'child' && parentNode) {
        parentCode = parentNode.code;
        level = parentNode.level + 1;
        sortOrder = 1;
      } else if (type === 'sibling' && parentNode) {
        parentCode = parentNode.parent_code || null;
        level = parentNode.level;
        sortOrder = parentNode.sort_order + 1;
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
        await loadRootSections();
        onSectionsChange?.();

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
          await loadRootSections();
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

    const dragNode = findNode(sections, dragKey);
    const dropNode = findNode(sections, dropKey);

    if (!dragNode || !dropNode) return;

    try {
      let newParentCode = null;
      let newLevel = dragNode.level;
      let newSortOrder = dropNode.sort_order;

      if (dropPosition === 0) {
        newParentCode = dropNode.code;
        newLevel = dropNode.level + 1;
        newSortOrder = 1;
      } else {
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
      await loadRootSections();
      onSectionsChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.message || '移动章节失败');
    }
  };

  // 辅助函数：查找节点
  const findNode = (nodes: OutlineNode[], id: string): OutlineNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
    }
    return null;
  };

  // 转换为Antd Tree所需的数据格式
  const convertToTreeData = (nodes: OutlineNode[]): DataNode[] => {
    return nodes.map((node) => {
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
        code: node.code,
        title: editable ? (
          <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 0',
              }}
              onDoubleClick={() => handleDoubleClick(node)}
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
        icon: node.isLeaf ? <FileTextOutlined /> : <FolderOutlined />,
        isLeaf: node.isLeaf,
      };
    });
  };

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    console.log('[TemplateOutlineTree] handleSelect called', { selectedKeys, sectionsCount: sections.length });
    if (selectedKeys.length > 0 && onSelectNode) {
      const selectedNode = findNode(sections, selectedKeys[0] as string);
      console.log('[TemplateOutlineTree] Found node:', {
        code: selectedNode?.code,
        title: selectedNode?.title,
        has_template_content: selectedNode?.template_content !== undefined,
        template_content_length: selectedNode?.template_content?.length || 0
      });
      if (selectedNode) {
        setSelectedKeys([selectedNode.id]);
        console.log('[TemplateOutlineTree] Calling onSelectNode with:', selectedNode);
        onSelectNode(selectedNode);
      } else {
        console.warn('[TemplateOutlineTree] Node not found in sections array!');
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
        {treeData.length > 0 ? (
          <Tree
            showIcon
            loadData={onLoadData}
            draggable={editable}
            onDrop={editable ? handleDrop : undefined}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            onSelect={handleSelect}
            style={{ background: 'transparent' }}
          />
        ) : (
          <Empty
            description="暂无章节"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        )}
      </div>

      {/* 编辑章节属性对话框 */}
      <Modal
        title="编辑章节属性"
        open={editModalVisible}
        onOk={handleSaveNodeProperties}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingNode(null);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="章节编号"
            name="code"
            rules={[{ required: true, message: '请输入章节编号' }]}
          >
            <Input placeholder="如：1.2.3" />
          </Form.Item>

          <Form.Item
            label="章节标题"
            name="title"
            rules={[{ required: true, message: '请输入章节标题' }]}
          >
            <Input placeholder="请输入章节标题" />
          </Form.Item>

          <Form.Item
            label="章节描述"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="章节说明（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateOutlineTree;
