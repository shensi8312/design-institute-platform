import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  message,
  Radio,
  Alert,
  Collapse,
  Input,
  Badge
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  PlusOutlined,
  LockOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ProjectOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  MergeCellsOutlined,
  SwapOutlined,
  StopOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Text, Title } = Typography;
const { Panel } = Collapse;

type PermissionMode = 'inherit' | 'merge' | 'override' | 'restrict';

export interface PermissionTag {
  dimension: string;
  type: 'required' | 'optional' | 'forbidden';
  value: string;
}

interface PermissionSettingProps {
  mode?: PermissionMode;
  tags?: PermissionTag[];
  knowledgeBaseLevel?: string;
  onChange?: (mode: PermissionMode, tags: PermissionTag[]) => void;
  showInheritInfo?: boolean;
}

// 预定义的权限维度
const PERMISSION_DIMENSIONS = {
  organization: { label: '组织', icon: <TeamOutlined />, color: 'blue' },
  department: { label: '部门', icon: <ApartmentOutlined />, color: 'green' },
  project: { label: '项目', icon: <ProjectOutlined />, color: 'orange' },
  role: { label: '角色', icon: <UserOutlined />, color: 'purple' },
  level: { label: '级别', icon: <SafetyCertificateOutlined />, color: 'red' },
  phase: { label: '阶段', icon: <ClockCircleOutlined />, color: 'cyan' },
  external: { label: '外部', icon: <CloseCircleOutlined />, color: 'magenta' }
};

// 预定义的标签值
const PREDEFINED_VALUES = {
  department: ['engineering', 'design', 'construction', 'finance', 'hr', 'admin'],
  role: ['admin', 'manager', 'engineer', 'designer', 'operator', 'viewer'],
  level: ['1', '2', '3', '4', '5', '1+', '2+', '3+', '4+', '5+'],
  phase: ['design', 'review', 'construction', 'maintenance', 'archived'],
  external: ['true', 'false']
};

const DocumentPermissionSetting: React.FC<PermissionSettingProps> = ({
  mode = 'inherit',
  tags = [],
  knowledgeBaseLevel = 'project',
  onChange,
  showInheritInfo = true
}) => {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(mode);
  const [permissionTags, setPermissionTags] = useState<PermissionTag[]>(tags);
  const [newTag, setNewTag] = useState<Partial<PermissionTag>>({
    dimension: 'department',
    type: 'required',
    value: ''
  });

  // 添加标签
  const addTag = () => {
    if (!newTag.value) {
      message.warning('请输入标签值');
      return;
    }

    const exists = permissionTags.some(
      t => t.dimension === newTag.dimension && t.value === newTag.value
    );

    if (exists) {
      message.warning('该标签已存在');
      return;
    }

    const tag: PermissionTag = {
      dimension: newTag.dimension!,
      type: newTag.type as 'required' | 'optional' | 'forbidden',
      value: newTag.value
    };

    const updatedTags = [...permissionTags, tag];
    setPermissionTags(updatedTags);
    setNewTag({ ...newTag, value: '' });
    
    onChange?.(permissionMode, updatedTags);
  };

  // 删除标签
  const removeTag = (index: number) => {
    const updatedTags = permissionTags.filter((_, i) => i !== index);
    setPermissionTags(updatedTags);
    onChange?.(permissionMode, updatedTags);
  };

  // 模式改变
  const handleModeChange = (newMode: PermissionMode) => {
    setPermissionMode(newMode);
    onChange?.(newMode, permissionTags);
  };

  // 获取标签颜色
  const getTagColor = (tag: PermissionTag) => {
    if (tag.type === 'forbidden') return 'error';
    if (tag.type === 'optional') return 'warning';
    return 'processing';
  };

  // 获取标签图标
  const getTagIcon = (tag: PermissionTag) => {
    if (tag.type === 'forbidden') return <CloseCircleOutlined />;
    if (tag.type === 'optional') return <InfoCircleOutlined />;
    return <CheckCircleOutlined />;
  };

  // 渲染权限模式说明
  const renderModeDescription = () => {
    const descriptions = {
      inherit: '继承知识库权限设置，文档不设置额外权限',
      merge: '在知识库权限基础上，增加文档特有权限',
      override: '完全覆盖知识库权限，只使用文档权限',
      restrict: '在知识库权限基础上，进一步限制访问'
    };

    return (
      <Alert
        message={`当前模式: ${permissionMode}`}
        description={descriptions[permissionMode as keyof typeof descriptions]}
        type="info"
        showIcon
        icon={
          permissionMode === 'inherit' ? <NodeIndexOutlined /> :
          permissionMode === 'merge' ? <MergeCellsOutlined /> :
          permissionMode === 'override' ? <SwapOutlined /> :
          <StopOutlined />
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  return (
    <Card 
      title={
        <Space>
          <LockOutlined />
          <span>文档权限设置</span>
        </Space>
      }
      size="small"
    >
      {/* 权限模式选择 */}
      <Form.Item label="权限模式">
        <Radio.Group 
          value={permissionMode} 
          onChange={(e: RadioChangeEvent) => handleModeChange(e.target.value as PermissionMode)}
          buttonStyle="solid"
        >
          <Radio.Button value="inherit">
            <NodeIndexOutlined /> 继承
          </Radio.Button>
          <Radio.Button value="merge">
            <MergeCellsOutlined /> 合并
          </Radio.Button>
          <Radio.Button value="override">
            <SwapOutlined /> 覆盖
          </Radio.Button>
          <Radio.Button value="restrict">
            <StopOutlined /> 限制
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {renderModeDescription()}

      {/* 继承信息 */}
      {showInheritInfo && permissionMode === 'inherit' && (
        <Alert
          message={`继承自知识库权限级别: ${knowledgeBaseLevel}`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 权限标签设置 */}
      {permissionMode !== 'inherit' && (
        <>
          <Divider orientation="left">权限标签</Divider>
          
          {/* 已添加的标签 */}
          <div style={{ marginBottom: 16 }}>
            {permissionTags.length === 0 ? (
              <Text type="secondary">暂无权限标签</Text>
            ) : (
              <Space wrap>
                {permissionTags.map((tag, index) => (
                  <Tag
                    key={index}
                    color={getTagColor(tag)}
                    icon={getTagIcon(tag)}
                    closable
                    onClose={() => removeTag(index)}
                  >
                    {PERMISSION_DIMENSIONS[tag.dimension as keyof typeof PERMISSION_DIMENSIONS]?.label || tag.dimension}:
                    {tag.value}
                  </Tag>
                ))}
              </Space>
            )}
          </div>

          {/* 添加新标签 */}
          <Row gutter={8} align="middle">
            <Col span={6}>
              <Select
                value={newTag.dimension}
                onChange={(value) => setNewTag({ ...newTag, dimension: value })}
                style={{ width: '100%' }}
              >
                {Object.entries(PERMISSION_DIMENSIONS).map(([key, config]) => (
                  <Option key={key} value={key}>
                    <Space>
                      {config.icon}
                      {config.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Col>
            
            <Col span={5}>
              <Select
                value={newTag.type}
                onChange={(value) => setNewTag({ ...newTag, type: value as any })}
                style={{ width: '100%' }}
              >
                <Option value="required">
                  <Badge status="processing" text="必须" />
                </Option>
                <Option value="optional">
                  <Badge status="warning" text="可选" />
                </Option>
                <Option value="forbidden">
                  <Badge status="error" text="禁止" />
                </Option>
              </Select>
            </Col>
            
            <Col span={10}>
              {PREDEFINED_VALUES[newTag.dimension as keyof typeof PREDEFINED_VALUES] ? (
                <Select
                  value={newTag.value || undefined}
                  onChange={(value) => setNewTag({ ...newTag, value: Array.isArray(value) ? value[0] : value })}
                  placeholder="选择或输入值"
                  style={{ width: '100%' }}
                  allowClear
                >
                  {PREDEFINED_VALUES[newTag.dimension as keyof typeof PREDEFINED_VALUES]?.map(val => (
                    <Option key={val} value={val}>{val}</Option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={newTag.value}
                  onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                  placeholder="输入标签值"
                  onPressEnter={addTag}
                />
              )}
            </Col>
            
            <Col span={3}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={addTag}
                block
              >
                添加
              </Button>
            </Col>
          </Row>

          {/* 权限标签说明 */}
          <Collapse ghost style={{ marginTop: 16 }}>
            <Panel header="权限标签说明" key="1">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Badge status="processing" text="必须 (Required)" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    用户必须拥有所有必须标签才能访问
                  </Text>
                </div>
                <div>
                  <Badge status="warning" text="可选 (Optional)" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    用户拥有任一可选标签即可增加权限分数
                  </Text>
                </div>
                <div>
                  <Badge status="error" text="禁止 (Forbidden)" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    用户拥有任一禁止标签将被拒绝访问
                  </Text>
                </div>
              </Space>
              
              <Divider />
              
              <Title level={5}>标签值匹配规则</Title>
              <ul>
                <li><Text code>dept:engineering</Text> - 完全匹配</li>
                <li><Text code>dept:*</Text> - 通配符匹配所有部门</li>
                <li><Text code>level:3+</Text> - 级别3及以上</li>
                <li><Text code>role:admin|manager</Text> - 多值匹配</li>
              </ul>
            </Panel>
          </Collapse>
        </>
      )}
    </Card>
  );
};

export default DocumentPermissionSetting;
