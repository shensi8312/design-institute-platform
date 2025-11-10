import React from 'react';
import { Tag, Tooltip, Space, Typography } from 'antd';
import {
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ProjectOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export interface PermissionTag {
  dimension: string;
  type: 'required' | 'optional' | 'forbidden';
  value: string;
}

interface PermissionTagDisplayProps {
  tags: PermissionTag[];
  mode?: 'full' | 'compact';
  showMissing?: boolean;
  missingTags?: PermissionTag[];
  matchedTags?: PermissionTag[];
}

// 权限维度配置
const DIMENSION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  organization: { label: '组织', icon: <TeamOutlined />, color: 'blue' },
  department: { label: '部门', icon: <ApartmentOutlined />, color: 'green' },
  project: { label: '项目', icon: <ProjectOutlined />, color: 'orange' },
  role: { label: '角色', icon: <UserOutlined />, color: 'purple' },
  level: { label: '级别', icon: <SafetyCertificateOutlined />, color: 'red' },
  phase: { label: '阶段', icon: <ClockCircleOutlined />, color: 'cyan' },
  external: { label: '外部', icon: <CloseCircleOutlined />, color: 'magenta' }
};

const PermissionTagDisplay: React.FC<PermissionTagDisplayProps> = ({
  tags = [],
  mode = 'compact',
  showMissing = false,
  missingTags = [],
  matchedTags = []
}) => {
  // 获取标签颜色
  const getTagColor = (tag: PermissionTag, isMatched?: boolean, isMissing?: boolean) => {
    if (isMissing) return 'error';
    if (isMatched) return 'success';
    
    switch (tag.type) {
      case 'forbidden':
        return 'error';
      case 'optional':
        return 'warning';
      case 'required':
      default:
        return 'processing';
    }
  };

  // 获取标签图标
  const getTagIcon = (tag: PermissionTag) => {
    if (tag.type === 'forbidden') return <CloseCircleOutlined />;
    if (tag.type === 'optional') return <InfoCircleOutlined />;
    return <CheckCircleOutlined />;
  };

  // 渲染单个标签
  const renderTag = (tag: PermissionTag, index: number, isMatched?: boolean, isMissing?: boolean) => {
    const config = DIMENSION_CONFIG[tag.dimension] || { 
      label: tag.dimension, 
      icon: <LockOutlined />, 
      color: 'default' 
    };

    const tagContent = (
      <Space size={2}>
        {mode === 'full' && getTagIcon(tag)}
        {config.icon}
        <span>
          {mode === 'full' ? `${config.label}:` : ''}
          {tag.value}
        </span>
      </Space>
    );

    const tooltipContent = (
      <div>
        <div><strong>{config.label}</strong></div>
        <div>类型: {
          tag.type === 'required' ? '必须' :
          tag.type === 'optional' ? '可选' :
          '禁止'
        }</div>
        <div>值: {tag.value}</div>
        {isMatched && <div style={{ color: '#52c41a' }}>✓ 已匹配</div>}
        {isMissing && <div style={{ color: '#ff4d4f' }}>✗ 缺失</div>}
      </div>
    );

    return (
      <Tooltip key={index} title={tooltipContent}>
        <Tag 
          color={getTagColor(tag, isMatched, isMissing)}
          style={{ 
            marginRight: 4, 
            marginBottom: 4,
            opacity: isMissing ? 0.6 : 1
          }}
        >
          {tagContent}
        </Tag>
      </Tooltip>
    );
  };

  // 紧凑模式：只显示数量
  if (mode === 'compact' && tags.length > 3) {
    const requiredCount = tags.filter(t => t.type === 'required').length;
    const forbiddenCount = tags.filter(t => t.type === 'forbidden').length;
    
    return (
      <Space size={4}>
        {requiredCount > 0 && (
          <Tooltip title={`${requiredCount} 个必须权限`}>
            <Tag color="processing" icon={<CheckCircleOutlined />}>
              必须 {requiredCount}
            </Tag>
          </Tooltip>
        )}
        {forbiddenCount > 0 && (
          <Tooltip title={`${forbiddenCount} 个禁止权限`}>
            <Tag color="error" icon={<CloseCircleOutlined />}>
              禁止 {forbiddenCount}
            </Tag>
          </Tooltip>
        )}
        {showMissing && missingTags.length > 0 && (
          <Tooltip title={`缺少 ${missingTags.length} 个权限`}>
            <Tag color="error" icon={<ExclamationCircleOutlined />}>
              缺失 {missingTags.length}
            </Tag>
          </Tooltip>
        )}
      </Space>
    );
  }

  // 完整模式：显示所有标签
  return (
    <div style={{ display: 'inline-block' }}>
      {/* 已匹配的标签 */}
      {matchedTags.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Text type="success" style={{ fontSize: 12, marginRight: 8 }}>
            <CheckCircleOutlined /> 已匹配:
          </Text>
          {matchedTags.map((tag, index) => renderTag(tag, index, true, false))}
        </div>
      )}

      {/* 普通标签 */}
      {tags.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {tags.map((tag, index) => {
            const isMatched = matchedTags.some(
              mt => mt.dimension === tag.dimension && mt.value === tag.value
            );
            const isMissing = missingTags.some(
              mt => mt.dimension === tag.dimension && mt.value === tag.value
            );
            return renderTag(tag, index, isMatched, isMissing);
          })}
        </div>
      )}

      {/* 缺失的标签 */}
      {showMissing && missingTags.length > 0 && (
        <div>
          <Text type="danger" style={{ fontSize: 12, marginRight: 8 }}>
            <ExclamationCircleOutlined /> 缺失权限:
          </Text>
          {missingTags.map((tag, index) => renderTag(tag, index, false, true))}
        </div>
      )}
    </div>
  );
};

export default PermissionTagDisplay;
