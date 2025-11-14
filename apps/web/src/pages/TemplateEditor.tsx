/**
 * 模板目录编辑器
 * 左侧：可编辑的章节目录树
 * 右侧：章节属性编辑表单
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Tag,
  message,
  Spin,
  Form,
  Input,
  Switch,
  Divider,
  Empty
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  SaveOutlined,
  ExpandOutlined,
  CompressOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import TemplateOutlineTree from '../components/TemplateOutlineTree';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import axios from '../utils/axios';

const { Sider, Content } = Layout;
const { TextArea } = Input;

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface TemplateSection {
  id: string;
  code: string;
  title: string;
  level: number;
  parent_code?: string | null;
  description?: string;
  template_content?: string;
  is_required?: boolean;
  is_editable?: boolean;
  sort_order: number;
}

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [collapsed, setCollapsed] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [selectedSection, setSelectedSection] = useState<TemplateSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  useEffect(() => {
    if (selectedSection) {
      form.setFieldsValue({
        code: selectedSection.code,
        title: selectedSection.title,
        description: selectedSection.description || '',
        template_content: selectedSection.template_content || '',
        is_required: selectedSection.is_required ?? true,
        is_editable: selectedSection.is_editable ?? true,
      });
    } else {
      form.resetFields();
    }
  }, [selectedSection, form]);

  // 加载模板信息
  const loadTemplate = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${id}`);
      if (response.data.success) {
        setTemplate(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理章节选中
  const handleSelectSection = (section: TemplateSection) => {
    setSelectedSection(section);
  };

  // 保存章节
  const handleSaveSection = async () => {
    if (!selectedSection || !id) return;

    try {
      const values = await form.validateFields();
      setSaving(true);

      await axios.put(
        `/api/unified-document/templates/${id}/sections/${selectedSection.id}`,
        {
          code: values.code,
          title: values.title,
          description: values.description,
          template_content: values.template_content,
          is_required: values.is_required,
          is_editable: values.is_editable,
        }
      );

      message.success('章节保存成功');

      // 更新本地状态
      setSelectedSection({
        ...selectedSection,
        ...values,
      });
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 章节变化回调（刷新选中的章节）
  const handleSectionsChange = async () => {
    if (selectedSection && id) {
      try {
        const response = await axios.get(`/api/unified-document/templates/${id}/sections`);
        if (response.data.success) {
          // 查找更新后的章节
          const findSection = (sections: any[]): any => {
            for (const section of sections) {
              if (section.id === selectedSection.id) return section;
              if (section.children) {
                const found = findSection(section.children);
                if (found) return found;
              }
            }
            return null;
          };

          const updatedSection = findSection(response.data.data);
          if (updatedSection) {
            setSelectedSection(updatedSection);
          } else {
            // 章节被删除了
            setSelectedSection(null);
          }
        }
      } catch (error) {
        console.error('刷新章节失败:', error);
      }
    }
  };

  if (!id) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>模板ID缺失</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Card
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '12px 24px' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space size="large">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/templates')}
            >
              返回列表
            </Button>
            <div>
              <Space>
                <FileTextOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  {template?.name || '模板目录编辑器'}
                </span>
                <Tag color="green">目录编辑</Tag>
                <Tag color="blue">可拖拽排序</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                <InfoCircleOutlined /> 点击章节编辑，右键添加/删除，拖拽调整顺序
              </div>
            </div>
          </Space>

          <Space>
            <Button
              icon={collapsed ? <ExpandOutlined /> : <CompressOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? '显示' : '隐藏'}目录
            </Button>
            {selectedSection && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveSection}
                loading={saving}
              >
                保存章节
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* 主体区域 - 左右分栏 */}
      <Layout style={{ flex: 1, background: '#f0f2f5' }}>
        {/* 左侧目录树 */}
        <Sider
          width={320}
          collapsed={collapsed}
          collapsedWidth={0}
          trigger={null}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            overflow: 'hidden',
            transition: 'all 0.2s'
          }}
        >
          {!collapsed && (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* 目录标题 */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fafafa',
                fontWeight: 500,
                fontSize: 14
              }}>
                📖 模板目录
                <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontWeight: 'normal' }}>
                  点击编辑，右键操作，拖拽排序
                </div>
              </div>

              {/* 目录树 */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                <TemplateOutlineTree
                  templateId={id}
                  editable={true}
                  onSelectNode={handleSelectSection}
                  onSectionsChange={handleSectionsChange}
                />
              </div>
            </div>
          )}
        </Sider>

        {/* 右侧编辑区 */}
        <Content style={{
          padding: 16,
          overflow: 'hidden',
          transition: 'all 0.2s'
        }}>
          <div style={{
            height: '100%',
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedSection ? (
              <div style={{
                flex: 1,
                padding: 24,
                overflow: 'auto'
              }}>
                <h3 style={{ marginBottom: 24 }}>编辑章节</h3>
                <Form
                  form={form}
                  layout="vertical"
                  autoComplete="off"
                >
                  <Form.Item
                    label="章节编号"
                    name="code"
                    rules={[{ required: true, message: '请输入章节编号' }]}
                    extra="可手动修改编号，格式如：1, 1.1, 1.2.3"
                  >
                    <Input placeholder="1.2.3" />
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

                  <Divider />

                  <Form.Item
                    label="模板内容"
                    name="template_content"
                    extra="此内容将作为模板，在创建文档时预填充到对应章节"
                  >
                    <ReactQuill
                      theme="snow"
                      placeholder="请输入章节模板内容..."
                      style={{ height: 300, marginBottom: 50 }}
                    />
                  </Form.Item>

                  <Divider />

                  <div style={{ marginBottom: 24 }}>
                    <h4>章节约束</h4>
                  </div>

                  <Form.Item
                    label="是否必填章节"
                    name="is_required"
                    valuePropName="checked"
                    extra="必填章节要求用户必须填写内容"
                  >
                    <Switch />
                  </Form.Item>

                  <Form.Item
                    label="是否允许用户编辑"
                    name="is_editable"
                    valuePropName="checked"
                    extra="不可编辑的章节将锁定，用户无法修改"
                  >
                    <Switch />
                  </Form.Item>
                </Form>
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Empty
                  description="请从左侧目录选择要编辑的章节"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default TemplateEditor;
